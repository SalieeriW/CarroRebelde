import express, { Request, Response } from 'express';
import cors from 'cors';
import { RoomRecord, RoomState, PlayerState, ChatMessage } from './types';
import { createEmptyBoard, isCellEmpty, isBoardFull } from './gomoku/board';
import { checkWin } from './gomoku/rules';
import { makeAIMove } from './gomoku/ai';

const app = express();
const PORT = Number(process.env.PORT) || 3002;
const DEFAULT_ROOM_CODE = (process.env.DEFAULT_ROOM_CODE || 'GOMOKU1').toUpperCase();
const START_DELAY_MS = 5000;

const rooms = new Map<string, RoomRecord>();

app.use(cors());
app.use(express.json());

const nowMs = () => Date.now();

function createPlayer(role: 'A' | 'B'): PlayerState {
  return {
    sessionId: '',
    role,
    isReady: false,
  };
}

function createRoom(code: string): RoomRecord {
  const state: RoomState = {
    sessionCode: code,
    phase: 'lobby',
    startAt: 0,
    countdownMs: 0,
    playerA: createPlayer('A'),
    playerB: createPlayer('B'),
    playersConnected: 0,
    chatMessages: [],
    gomoku: {
      board: createEmptyBoard(),
      turn: 'player',
      winner: null,
      lastMove: null,
      moveHistory: [],
      playerColor: 'black',
      aiColor: 'white',
      currentPlayer: 'A',
    },
    exitRequests: { A: false, B: false },
    createdAt: nowMs(),
  };

  return {
    state,
    countdownTimer: null,
    aiMoveTimer: null,
  };
}

function getRoom(code?: string): RoomRecord {
  const roomCode = (code || DEFAULT_ROOM_CODE).toUpperCase();
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, createRoom(roomCode));
  }
  return rooms.get(roomCode)!;
}

function resetRoom(code?: string): RoomRecord {
  const roomCode = (code || DEFAULT_ROOM_CODE).toUpperCase();
  const room = getRoom(roomCode);
  
  // Cancel all timers
  cancelCountdown(room);
  cancelAIMove(room);
  
  // FORCE clear all player sessions to prevent reconnection with old state
  // This ensures players must reconnect fresh
  room.state.playerA = createPlayer('A');
  room.state.playerB = createPlayer('B');
  room.state.playersConnected = 0;
  room.state.phase = 'lobby';
  room.state.startAt = 0;
  room.state.countdownMs = 0;
  room.state.chatMessages = [];
  room.state.exitRequests = { A: false, B: false };
  room.state.gomoku = {
    board: createEmptyBoard(),
    turn: 'player',
    winner: null,
    lastMove: null,
    moveHistory: [],
    playerColor: 'black',
    aiColor: 'white',
    currentPlayer: 'A',
  };
  room.state.createdAt = nowMs();
  
  console.log(`🔄 [Gomoku] Reset room: ${roomCode} - All state cleared`);
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

function cancelAIMove(room: RoomRecord) {
  if (room.aiMoveTimer) {
    clearTimeout(room.aiMoveTimer);
    room.aiMoveTimer = null;
  }
}

function pushSystemMessage(state: RoomState, text: string) {
  const message: ChatMessage = {
    role: 'SYSTEM',
    text,
    timestamp: nowMs(),
  };
  state.chatMessages.push(message);
  state.chatMessages = state.chatMessages.slice(-20);
}

function getPlayerStoneValue(gomoku: { playerColor: 'black' | 'white' }): 1 | 2 {
  return gomoku.playerColor === 'black' ? 1 : 2;
}

function getAIStoneValue(gomoku: { aiColor: 'black' | 'white' }): 1 | 2 {
  return gomoku.aiColor === 'black' ? 1 : 2;
}

function ensureClientId(req: Request, res: Response): string | null {
  const clientId = (req.body?.clientId || req.query?.clientId || '').toString();
  if (!clientId) {
    res.status(400).json({ error: 'clientId is required' });
    return null;
  }
  return clientId;
}

function resetGame(room: RoomRecord) {
  const playerColor = room.state.gomoku.playerColor;
  room.state.gomoku = {
    board: createEmptyBoard(),
    turn: playerColor === 'black' ? 'player' : 'ai',
    winner: null,
    lastMove: null,
    moveHistory: [],
    playerColor: playerColor,
    aiColor: playerColor === 'black' ? 'white' : 'black',
    currentPlayer: 'A',
  };
  room.state.phase = 'lobby';
  room.state.playerA.isReady = false;
  room.state.playerB.isReady = false;
  room.state.startAt = 0;
  room.state.countdownMs = 0;
  room.state.exitRequests = { A: false, B: false };
  cancelCountdown(room);
  cancelAIMove(room);
}

function makeAIFirstMove(room: RoomRecord) {
  const { gomoku } = room.state;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:139',message:'makeAIFirstMove called',data:{turn:gomoku.turn,moveHistory:gomoku.moveHistory.length,phase:room.state.phase,aiColor:gomoku.aiColor},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  if (gomoku.turn !== 'ai' || gomoku.moveHistory.length > 0 || room.state.phase !== 'active') {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:142',message:'makeAIFirstMove early return',data:{turn:gomoku.turn,moveHistory:gomoku.moveHistory.length,phase:room.state.phase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    return;
  }

  const aiStoneValue = getAIStoneValue(gomoku);

  const openingMoves = [
    { x: 7, y: 7 },
    { x: 7, y: 8 },
    { x: 8, y: 7 },
    { x: 6, y: 7 },
    { x: 7, y: 6 },
  ];

  const move = openingMoves[Math.floor(Math.random() * openingMoves.length)];

  gomoku.board[move.x][move.y] = aiStoneValue;
  gomoku.lastMove = { ...move, by: 'ai' };
  gomoku.moveHistory.push({ ...move, by: 'ai' });
  gomoku.turn = 'player';
  gomoku.currentPlayer = 'A';

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:159',message:'AI first move completed',data:{move,turn:gomoku.turn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
}

// Routes

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gomoku-api', room: DEFAULT_ROOM_CODE });
});

app.get('/rooms/:code', (req: Request, res: Response) => {
  const room = getRoom(req.params.code);
  res.json({
    ...room.state,
    serverTime: nowMs(),
  });
});

// Reset room state (called when starting a new minigame from Blind Rally)
app.post('/rooms/:code/reset-public', (req: Request, res: Response) => {
  const room = resetRoom(req.params.code);
  res.json({
    ...room.state,
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

  if (other.sessionId === clientId) {
    Object.assign(other, createPlayer(other.role));
  }

  Object.assign(target, createPlayer(target.role));
  target.sessionId = clientId;
  room.state.playersConnected = countPlayers(room.state);
  cancelCountdown(room);

  res.json(room.state);
});

app.post('/rooms/:code/release', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const role = (req.body?.role || '').toUpperCase();
  const room = getRoom(req.params.code);
  const rolesLeft: ('A' | 'B')[] = [];

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:215',message:'Release request received',data:{clientId,role,playerA:room.state.playerA.sessionId,playerB:room.state.playerB.sessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
  // #endregion

  if (role === 'A' || role === 'B') {
    const target = role === 'A' ? room.state.playerA : room.state.playerB;
    if (target.sessionId === clientId) {
      Object.assign(target, createPlayer(target.role));
      rolesLeft.push(role);
      room.state.exitRequests[role] = false;
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
  cancelAIMove(room);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:240',message:'Player released',data:{rolesLeft,playersConnected:room.state.playersConnected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
  // #endregion

  if (rolesLeft.length > 0) {
    const exitRole: 'A' | 'B' = rolesLeft[0];
    room.state.exitRequests[exitRole] = false;
    const label = rolesLeft.length === 2 ? 'Los jugadores A y B' : `El jugador ${rolesLeft[0]}`;
    pushSystemMessage(room.state, `${label} salió de la sala.`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:244',message:'System message pushed',data:{message:`${label} salió de la sala.`,chatMessagesCount:room.state.chatMessages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
  }

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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:256',message:'Exit request received',data:{role,exitRequests:room.state.exitRequests},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
  // #endregion

  room.state.exitRequests[role] = true;
  cancelCountdown(room);
  cancelAIMove(room);

  pushSystemMessage(
    room.state,
    `El jugador ${role} quiere abandonar. Esperando confirmación del otro jugador.`
  );

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:268',message:'Exit request processed',data:{exitRequests:room.state.exitRequests,bothRequested:room.state.exitRequests.A && room.state.exitRequests.B},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
  // #endregion

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
  room.state.phase = 'briefing';
  room.state.countdownMs = START_DELAY_MS;
  room.state.startAt = nowMs() + START_DELAY_MS;

  room.countdownTimer = setTimeout(() => {
    room.state.phase = 'active';
    room.state.countdownMs = 0;
    room.state.startAt = 0;
    room.countdownTimer = null;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:272',message:'Game started',data:{phase:room.state.phase,aiColor:room.state.gomoku.aiColor,turn:room.state.gomoku.turn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    if (room.state.gomoku.aiColor === 'black' && room.state.gomoku.turn === 'ai') {
      setTimeout(() => makeAIFirstMove(room), 500);
    }
  }, START_DELAY_MS);

  res.json(room.state);
});

app.post('/rooms/:code/move', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const { x, y } = req.body;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);

  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  const { gomoku } = room.state;

  if (gomoku.turn !== 'player' || gomoku.winner !== null) {
    res.status(400).json({ error: 'Not player turn or game finished' });
    return;
  }

  if (gomoku.currentPlayer !== role) {
    res.status(400).json({ error: 'Not your turn' });
    return;
  }

  if (!isCellEmpty(gomoku.board, x, y)) {
    res.status(400).json({ error: 'Cell already occupied' });
    return;
  }

  const playerStoneValue = getPlayerStoneValue(gomoku);
  const aiStoneValue = getAIStoneValue(gomoku);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:305',message:'Player move received',data:{x,y,currentTurn:gomoku.turn,currentPlayer:gomoku.currentPlayer,role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  gomoku.board[x][y] = playerStoneValue;
  gomoku.lastMove = { x, y, by: 'player' };
  gomoku.moveHistory.push({ x, y, by: 'player' });

  if (checkWin(gomoku.board, x, y)) {
    gomoku.winner = 'player';
    room.state.phase = 'finished';
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:313',message:'Player wins',data:{winner:gomoku.winner},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    res.json(room.state);
    return;
  }

  if (isBoardFull(gomoku.board)) {
    gomoku.winner = 'draw';
    room.state.phase = 'finished';
    res.json(room.state);
    return;
  }

  gomoku.turn = 'ai';
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:326',message:'Turn switched to AI',data:{turn:gomoku.turn,moveHistory:gomoku.moveHistory.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  res.json(room.state);

  cancelAIMove(room);
  room.aiMoveTimer = setTimeout(() => {
    const aiMove = makeAIMove(gomoku.board, aiStoneValue, playerStoneValue);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:331',message:'AI move calculated',data:{aiMove,currentTurn:gomoku.turn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!aiMove) {
      gomoku.winner = 'draw';
      room.state.phase = 'finished';
      room.aiMoveTimer = null;
      return;
    }

    gomoku.board[aiMove.x][aiMove.y] = aiStoneValue;
    gomoku.lastMove = { ...aiMove, by: 'ai' };
    gomoku.moveHistory.push({ ...aiMove, by: 'ai' });

    if (checkWin(gomoku.board, aiMove.x, aiMove.y)) {
      gomoku.winner = 'ai';
      room.state.phase = 'finished';
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:344',message:'AI wins',data:{winner:gomoku.winner},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } else if (isBoardFull(gomoku.board)) {
      gomoku.winner = 'draw';
      room.state.phase = 'finished';
    } else {
      gomoku.turn = 'player';
      // Switch to next player after AI move
      gomoku.currentPlayer = gomoku.currentPlayer === 'A' ? 'B' : 'A';
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.ts:350',message:'Turn switched back to player',data:{turn:gomoku.turn,currentPlayer:gomoku.currentPlayer,moveHistory:gomoku.moveHistory.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    }

    room.aiMoveTimer = null;
  }, 800);
});

app.post('/rooms/:code/color', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);

  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  if (room.state.phase !== 'lobby') {
    res.status(400).json({ error: 'Can only change color in lobby' });
    return;
  }

  const color = req.body?.color;
  if (color !== 'black' && color !== 'white') {
    res.status(400).json({ error: 'color must be black or white' });
    return;
  }

  room.state.gomoku.playerColor = color;
  room.state.gomoku.aiColor = color === 'black' ? 'white' : 'black';
  room.state.gomoku.turn = color === 'black' ? 'player' : 'ai';
  room.state.gomoku.currentPlayer = 'A';

  res.json(room.state);
});

app.post('/rooms/:code/reset', (req: Request, res: Response) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRoleByClient(room.state, clientId);

  if (!role) {
    res.status(403).json({ error: 'Seat not claimed' });
    return;
  }

  resetGame(room);
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

app.listen(PORT, () => {
  console.log('='.repeat(40));
  console.log(` Gomoku Duel API running on :${PORT}`);
  console.log(` Default room: ${DEFAULT_ROOM_CODE}`);
  console.log('='.repeat(40));
});
