import express, { Request, Response } from 'express';
import cors from 'cors';
import levelData from '../../shared/levelData.json';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const DEFAULT_ROOM_CODE = (process.env.DEFAULT_ROOM_CODE || 'ROOM1').toUpperCase();
const START_DELAY_MS = 5000;
const SYNC_WINDOW_MS = 10000;

type Phase = 'lobby' | 'briefing' | 'active' | 'sync_confirm' | 'success' | 'retry';

interface PlayerState {
  sessionId: string;
  selectedAnswer: string[];
  confirmedAt: number;
  isReady: boolean;
  role: 'A' | 'B';
}

interface ChatMessage {
  role: string;
  text: string;
  timestamp: number;
}

interface RoomState {
  sessionCode: string;
  levelId: number;
  phase: Phase;
  startAt: number;
  countdownMs: number;
  playerA: PlayerState;
  playerB: PlayerState;
  moderatorId?: string;
  hintCount: number;
  createdAt: number;
  currentHint: string;
  resultMessage: string;
  resultSuccess: boolean;
  chatMessages: ChatMessage[];
  playersConnected: number;
  exitRequests: { A: boolean; B: boolean };
}

interface RoomRecord {
  state: RoomState;
  countdownTimer: NodeJS.Timeout | null;
  checkTimer: NodeJS.Timeout | null;
  nextLevelTimer: NodeJS.Timeout | null;
}

const rooms = new Map<string, RoomRecord>();

app.use(cors());
app.use(express.json());

const nowMs = () => Date.now();

function createPlayer(role: 'A' | 'B'): PlayerState {
  return {
    sessionId: '',
    selectedAnswer: [],
    confirmedAt: 0,
    isReady: false,
    role,
  };
}

function createRoom(code: string): RoomRecord {
  const state: RoomState = {
    sessionCode: code,
    levelId: 1,
    phase: 'lobby',
    startAt: 0,
    countdownMs: 0,
    playerA: createPlayer('A'),
    playerB: createPlayer('B'),
    moderatorId: '',
    hintCount: 0,
    createdAt: nowMs(),
    currentHint: '',
    resultMessage: '',
    resultSuccess: false,
    chatMessages: [],
    playersConnected: 0,
    exitRequests: { A: false, B: false },
  };

  return {
    state,
    countdownTimer: null,
    checkTimer: null,
    nextLevelTimer: null,
  };
}

function getRoom(code?: string): RoomRecord {
  const roomCode = (code || DEFAULT_ROOM_CODE).toUpperCase();
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, createRoom(roomCode));
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return rooms.get(roomCode)!;
}

function resetRoom(code?: string): RoomRecord {
  const roomCode = (code || DEFAULT_ROOM_CODE).toUpperCase();
  const room = getRoom(roomCode);
  
  // Cancel all timers
  cancelCountdown(room);
  cancelNextLevel(room);
  if (room.checkTimer) {
    clearTimeout(room.checkTimer);
    room.checkTimer = null;
  }
  
  // FORCE clear all player sessions to prevent reconnection with old state
  // This ensures players must reconnect fresh
  room.state.playerA = createPlayer('A');
  room.state.playerB = createPlayer('B');
  room.state.playersConnected = 0;
  room.state.phase = 'lobby';
  room.state.levelId = 1;
  room.state.startAt = 0;
  room.state.countdownMs = 0;
  room.state.hintCount = 0;
  room.state.currentHint = '';
  room.state.resultMessage = '';
  room.state.resultSuccess = false;
  room.state.chatMessages = [];
  room.state.exitRequests = { A: false, B: false };
  room.state.playerA.selectedAnswer = [];
  room.state.playerB.selectedAnswer = [];
  room.state.playerA.confirmedAt = 0;
  room.state.playerB.confirmedAt = 0;
  room.state.playerA.isReady = false;
  room.state.playerB.isReady = false;
  room.state.createdAt = nowMs();
  
  console.log(`🔄 Reset room: ${roomCode} - All state cleared`);
  return room;
}

function countPlayers(state: RoomState): number {
  let count = 0;
  if (state.playerA.sessionId) count++;
  if (state.playerB.sessionId) count++;
  return count;
}

function getRoleByClient(state: RoomState, clientId: string): 'A' | 'B' | null {
  if (state.playerA.sessionId === clientId) return 'A';
  if (state.playerB.sessionId === clientId) return 'B';
  return null;
}

function pushSystemMessage(state: RoomState, text: string) {
  state.chatMessages.push({
    role: 'system',
    text,
    timestamp: nowMs(),
  });
  state.chatMessages = state.chatMessages.slice(-20);
}

function cancelCountdown(room: RoomRecord) {
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = null;
  }
  room.state.startAt = 0;
  room.state.countdownMs = 0;
  if (room.state.phase === 'briefing') {
    room.state.phase = 'lobby';
  }
}

function cancelNextLevel(room: RoomRecord) {
  if (room.nextLevelTimer) {
    clearTimeout(room.nextLevelTimer);
    room.nextLevelTimer = null;
  }
}

function resetConfirmations(state: RoomState) {
  state.playerA.confirmedAt = 0;
  state.playerB.confirmedAt = 0;
}

function ensureClientId(req: Request, res: Response): string | null {
  const clientId = (req.body?.clientId || req.query?.clientId || '').toString();
  if (!clientId) {
    res.status(400).json({ error: 'clientId is required' });
    return null;
  }
  return clientId;
}

// ============ Routes ============

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sync-api', room: DEFAULT_ROOM_CODE });
});

app.get('/rooms/:code', (req: Request, res: Response) => {
  const room = getRoom(req.params.code);
  res.json({
    ...room.state,
    totalLevels: levelData.levels.length,
    serverTime: nowMs(),
  });
});

// Reset room state (called when starting a new minigame from Blind Rally)
app.post('/rooms/:code/reset', (req: Request, res: Response) => {
  const room = resetRoom(req.params.code);
  res.json({
    ...room.state,
    totalLevels: levelData.levels.length,
    serverTime: nowMs(),
  });
});

app.post('/rooms/:code/claim', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const role = (req.body?.role || '').toUpperCase();
  if (role !== 'A' && role !== 'B') {
    res.status(400).json({ error: 'role must be A or B' });
    return;
  }

  const room = getRoom(req.params.code);
  const target = role === 'A' ? room.state.playerA : room.state.playerB;
  const other = role === 'A' ? room.state.playerB : room.state.playerA;

  if (target.sessionId && target.sessionId !== clientId) {
    res.status(409).json({ error: 'Seat taken' });
    return;
  }

  // Free other seat if same client occupied it
  if (other.sessionId === clientId) {
    Object.assign(other, createPlayer(other.role));
  }

  Object.assign(target, createPlayer(target.role));
  target.sessionId = clientId;
  room.state.playersConnected = countPlayers(room.state);
  cancelCountdown(room);
  cancelNextLevel(room);

  res.json(room.state);
});

app.post('/rooms/:code/release', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const role = (req.body?.role || '').toUpperCase();
  const room = getRoom(req.params.code);
  const rolesLeft: ('A' | 'B')[] = [];

  if (role === 'A' || role === 'B') {
    const target = role === 'A' ? room.state.playerA : room.state.playerB;
    if (target.sessionId === clientId) {
      Object.assign(target, createPlayer(target.role));
      rolesLeft.push(role);
      const exitRole: 'A' | 'B' = role;
      room.state.exitRequests[exitRole] = false;
    }
  } else {
    if (room.state.playerA.sessionId === clientId) {
      Object.assign(room.state.playerA, createPlayer('A'));
      rolesLeft.push('A');
      room.state.exitRequests.A = false;
    }
    if (room.state.playerB.sessionId === clientId) {
      Object.assign(room.state.playerB, createPlayer('B'));
      rolesLeft.push('B');
      room.state.exitRequests.B = false;
    }
  }

  room.state.playersConnected = countPlayers(room.state);
  cancelCountdown(room);
  cancelNextLevel(room);

  if (rolesLeft.length > 0) {
    const label = rolesLeft.length === 2 ? 'Los jugadores A y B' : `El jugador ${rolesLeft[0]}`;
    pushSystemMessage(room.state, `${label} salió de la sala.`);
  }
  res.json(room.state);
});

app.post('/rooms/:code/ready', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const ready = req.body?.ready === false ? false : true;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  const player = role === 'A' ? room.state.playerA : room.state.playerB;
  player.isReady = ready;
  if (!ready) {
    cancelCountdown(room);
  }
  cancelNextLevel(room);
  res.json(room.state);
});

app.post('/rooms/:code/start', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  const aReady = room.state.playerA.sessionId && room.state.playerA.isReady;
  const bReady = room.state.playerB.sessionId && room.state.playerB.isReady;
  if (!aReady || !bReady) {
    res.status(400).json({ error: 'Players not ready' });
    return;
  }

  cancelCountdown(room);
  cancelNextLevel(room);
  room.state.phase = 'briefing';
  room.state.countdownMs = START_DELAY_MS;
  room.state.startAt = nowMs() + START_DELAY_MS;

  room.countdownTimer = setTimeout(() => {
    room.state.phase = 'active';
    room.state.countdownMs = 0;
    room.state.startAt = 0;
    room.countdownTimer = null;
  }, START_DELAY_MS);

  res.json(room.state);
});

app.post('/rooms/:code/select', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const answer: string[] = Array.isArray(req.body?.answer) ? req.body.answer : [];
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  const player = role === 'A' ? room.state.playerA : room.state.playerB;
  player.selectedAnswer = [...answer];
  res.json(room.state);
});

app.post('/rooms/:code/confirm', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  const player = role === 'A' ? room.state.playerA : room.state.playerB;
  player.confirmedAt = nowMs();

  if (room.state.playerA.confirmedAt && room.state.playerB.confirmedAt) {
    const diff = Math.abs(room.state.playerA.confirmedAt - room.state.playerB.confirmedAt);
    if (diff < SYNC_WINDOW_MS) {
      room.state.phase = 'sync_confirm';
      if (room.checkTimer) clearTimeout(room.checkTimer);
      room.checkTimer = setTimeout(() => {
        checkAnswer(room);
        room.checkTimer = null;
      }, 1500);
    } else {
      resetConfirmations(room.state);
      room.state.phase = 'active';
    }
  }

  res.json(room.state);
});

app.post('/rooms/:code/chat', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }
  const text = (req.body?.text || '').toString().slice(0, 100);
  if (!text) {
    res.status(400).json({ error: 'text required' });
    return;
  }

  const message: ChatMessage = {
    role,
    text,
    timestamp: nowMs(),
  };
  room.state.chatMessages.push(message);
  room.state.chatMessages = room.state.chatMessages.slice(-20);
  res.json(room.state);
});

app.post('/rooms/:code/exit-request', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  room.state.exitRequests[role] = true;
  cancelCountdown(room);
  cancelNextLevel(room);

  pushSystemMessage(
    room.state,
    `El jugador ${role} quiere abandonar. Esperando confirmación del otro jugador.`
  );

  if (room.state.exitRequests.A && room.state.exitRequests.B) {
    pushSystemMessage(room.state, 'Ambos jugadores aceptaron abandonar. Cerrando partida.');
  }

  res.json(room.state);
});

app.post('/rooms/:code/exit-cancel', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  room.state.exitRequests[role] = false;
  pushSystemMessage(room.state, `El jugador ${role} decidió seguir jugando.`);
  res.json(room.state);
});

// ============ Game Logic ============

function getHint(room: RoomState) {
  const level = levelData.levels[room.levelId - 1];
  if (!level) return '';
  if (room.hintCount === 1) return level.hints.generic;
  if (room.hintCount === 2) return level.hints.specific;
  return level.hints.stepByStep;
}

function checkAnswer(room: RoomRecord) {
  const state = room.state;
  const level = levelData.levels[state.levelId - 1];
  if (!level) return;
  const totalLevels = levelData.levels.length;

  const a = state.playerA.selectedAnswer;
  const b = state.playerB.selectedAnswer;
  const correct = level.correctAnswer;

  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) {
    state.phase = 'retry';
    state.resultSuccess = false;
    state.resultMessage = 'Parece que eligieron respuestas diferentes. Revisen juntos.';
    resetConfirmations(state);
    setTimeout(() => {
      state.phase = 'active';
    }, 3000);
    return;
  }

  const correctMatch = JSON.stringify(a) === JSON.stringify(correct);
  if (correctMatch) {
    state.phase = 'success';
    state.resultSuccess = true;
    state.resultMessage = level.successMessage;
    state.startAt = 0;
    state.countdownMs = 0;
    resetConfirmations(state);

    // Auto-advance only if there are more levels
    cancelNextLevel(room);
    if (state.levelId < totalLevels) {
      const nextLevelId = state.levelId + 1;
      room.nextLevelTimer = setTimeout(() => {
        resetForNextRound(room, nextLevelId, true);
        room.nextLevelTimer = null;
      }, 5000);
    }
  } else {
    state.phase = 'retry';
    state.resultSuccess = false;
    state.hintCount += 1;
    state.currentHint = getHint(state);
    state.resultMessage = level.retryMessage;
    resetConfirmations(state);
    setTimeout(() => {
      state.phase = 'active';
    }, 3000);
  }
}

function resetForNextRound(room: RoomRecord, nextLevelId?: number, autoContinue = false) {
  const state = room.state;
  state.phase = autoContinue ? 'briefing' : 'lobby';
  state.startAt = 0;
  state.countdownMs = 0;
  state.levelId = nextLevelId || state.levelId;
  state.hintCount = 0;
  state.currentHint = '';
  state.resultMessage = '';
  state.resultSuccess = false;
  state.playerA.selectedAnswer = [];
  state.playerB.selectedAnswer = [];
  state.playerA.isReady = false;
  state.playerB.isReady = false;
  resetConfirmations(state);
  state.exitRequests = { A: false, B: false };

  if (autoContinue) {
    // Briefing 1s then active
    state.countdownMs = 1000;
    state.startAt = nowMs() + 1000;
    room.countdownTimer = setTimeout(() => {
      state.phase = 'active';
      state.countdownMs = 0;
      state.startAt = 0;
      room.countdownTimer = null;
    }, 1000);
  }
}

// ============ Start server ============

app.listen(PORT, () => {
  console.log('='.repeat(40));
  console.log(` Two Keys Gate Sync API running on :${PORT}`);
  console.log(` Default room: ${DEFAULT_ROOM_CODE}`);
  console.log('='.repeat(40));
});
