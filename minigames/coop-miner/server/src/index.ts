import express, { Request, Response } from 'express';
import cors from 'cors';
import minerData from '../../shared/minerLevels.json';

type Phase = 'lobby' | 'briefing' | 'active' | 'success' | 'summary';
type Weight = 'light' | 'medium' | 'heavy' | 'very_heavy';
type Size = 'small' | 'medium' | 'large';

interface PlayerState {
  sessionId: string;
  role: 'A' | 'B';
  isReady: boolean;
}

interface ChatMessage {
  role: string;
  text: string;
  timestamp: number;
}

interface ObjectState {
  id: string;
  type: string;
  icon: string;
  value: number;
  weight: Weight;
  size: Size;
  special?: string;
  x: number;
  y: number;
  taken: boolean;
}

interface HookState {
  state: 'idle' | 'swinging' | 'descending' | 'retracting';
  angle: number;
  x: number;
  y: number;
  boosted: boolean;
  attachedObjectId: string | null;
}

interface RoomState {
  sessionCode: string;
  levelId: number;
  totalLevels: number;
  goalScore: number;
  score: number;
  turnsLeft: number;
  phase: Phase;
  playerA: PlayerState;
  playerB: PlayerState;
  objects: ObjectState[];
  pendingTargetId: string | null;
  chatMessages: ChatMessage[];
  hookState: HookState;
  lastHit?: {
    objectId: string;
    type: string;
    value: number;
    scoreAfter: number;
  } | null;
}

interface RoomRecord {
  state: RoomState;
  advanceTimer: NodeJS.Timeout | null;
}

const PORT = Number(process.env.PORT || 7001);
const DEFAULT_ROOM = (process.env.DEFAULT_ROOM || 'ROOM1').toUpperCase();
const rooms = new Map<string, RoomRecord>();

const app = express();
app.use(cors());
app.use(express.json());

// Utils
const now = () => Date.now();
const randomId = () => Math.random().toString(36).slice(2, 8);

function getLevel(levelId: number) {
  return minerData.levels.find((lvl) => lvl.id === levelId) || minerData.levels[0];
}

function createPlayer(role: 'A' | 'B'): PlayerState {
  return { sessionId: '', role, isReady: false };
}

type LevelObjectDef = {
  type: string;
  icon: string;
  value: number;
  weight: string;
  size: string;
  count: number;
  spread?: number;
  special?: string;
};

function generateObjects(levelId: number): ObjectState[] {
  const level = getLevel(levelId);
  const objects: ObjectState[] = [];
  (level.objects as LevelObjectDef[]).forEach((def) => {
    const count = def.count || 1;
    for (let i = 0; i < count; i += 1) {
      objects.push({
        id: randomId(),
        type: def.type,
        icon: def.icon,
        value: def.value,
        weight: (def.weight as Weight) || 'medium',
        size: (def.size as Size) || 'medium',
        special: def.special,
        x: Math.random() * 100,
        y: Math.random() * 100,
        taken: false,
      });
    }
  });
  return objects;
}

function createRoom(code: string): RoomRecord {
  const levelId = 1;
  const level = getLevel(levelId);
  const totalLevels = minerData.levels.length;
  const state: RoomState = {
    sessionCode: code,
    levelId,
    totalLevels,
    goalScore: level.goalScore,
    score: 0,
    turnsLeft: (level as any).turns || 20,
    phase: 'lobby',
    playerA: createPlayer('A'),
    playerB: createPlayer('B'),
    objects: generateObjects(levelId),
    pendingTargetId: null,
    chatMessages: [],
    hookState: {
      state: 'idle',
      angle: 0,
      x: 400,
      y: 120,
      boosted: false,
      attachedObjectId: null,
    },
    lastHit: null,
  };
  return { state, advanceTimer: null };
}

function getRoom(code?: string): RoomRecord {
  const roomCode = (code || DEFAULT_ROOM).toUpperCase();
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, createRoom(roomCode));
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return rooms.get(roomCode)!;
}

function ensureClientId(req: Request, res: Response): string | null {
  const clientId = (req.body?.clientId || req.query?.clientId || '').toString();
  if (!clientId) {
    res.status(400).json({ error: 'clientId requerido' });
    return null;
  }
  return clientId;
}

function getRole(state: RoomState, clientId: string): 'A' | 'B' | null {
  if (state.playerA.sessionId === clientId) return 'A';
  if (state.playerB.sessionId === clientId) return 'B';
  return null;
}

function resetAdvance(room: RoomRecord) {
  if (room.advanceTimer) {
    clearTimeout(room.advanceTimer);
    room.advanceTimer = null;
  }
}

function countPlayers(state: RoomState): number {
  let count = 0;
  if (state.playerA.sessionId) count += 1;
  if (state.playerB.sessionId) count += 1;
  return count;
}

function resetForLevel(room: RoomRecord, nextLevelId: number) {
  const level = getLevel(nextLevelId);
  room.state.levelId = nextLevelId;
  room.state.goalScore = level.goalScore;
  room.state.score = 0;
  room.state.turnsLeft = (level as any).turns || 20;
  room.state.phase = 'active';
  room.state.objects = generateObjects(nextLevelId);
  room.state.pendingTargetId = null;
  room.state.playerA.isReady = false;
  room.state.playerB.isReady = false;
  room.state.lastHit = null;
}

function markSuccess(room: RoomRecord) {
  room.state.phase = 'success';
  resetAdvance(room);
  if (room.state.levelId < room.state.totalLevels) {
    room.advanceTimer = setTimeout(() => {
      resetForLevel(room, room.state.levelId + 1);
    }, 3000);
  }
}

function applySpecials(room: RoomRecord, obj: ObjectState, base: number): number {
  // Simple specials: combo, next_bonus, slow, speed_buff
  let gain = base;
  if ((room.state as any).nextBonus) {
    gain += 5;
    (room.state as any).nextBonus = false;
  }
  if (obj.special === 'combo') {
    const lastType = (room.state as any).lastComboType;
    gain += lastType === obj.type ? 5 : 0;
    (room.state as any).lastComboType = obj.type;
  } else {
    (room.state as any).lastComboType = null;
  }
  if (obj.special === 'next_bonus') {
    (room.state as any).nextBonus = true;
  }
  return gain;
}

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'coop-miner', time: now() });
});

app.get('/rooms/:code', (req, res) => {
  const room = getRoom(req.params.code);
  res.json(room.state);
});

app.post('/rooms/:code/claim', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const role = (req.body?.role || '').toUpperCase();
  if (role !== 'A' && role !== 'B') {
    res.status(400).json({ error: 'role debe ser A o B' });
    return;
  }
  const room = getRoom(req.params.code);
  const target = role === 'A' ? room.state.playerA : room.state.playerB;
  const other = role === 'A' ? room.state.playerB : room.state.playerA;
  if (target.sessionId && target.sessionId !== clientId) {
    res.status(409).json({ error: 'asiento ocupado' });
    return;
  }
  if (other.sessionId === clientId) {
    Object.assign(other, createPlayer(other.role));
  }
  Object.assign(target, createPlayer(role));
  target.sessionId = clientId;
  target.isReady = false;
  room.state.phase = 'lobby';
  res.json(room.state);
});

app.post('/rooms/:code/release', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const roomCode = (req.params.code || DEFAULT_ROOM).toUpperCase();
  const room = getRoom(roomCode);
  if (room.state.playerA.sessionId === clientId) {
    Object.assign(room.state.playerA, createPlayer('A'));
  }
  if (room.state.playerB.sessionId === clientId) {
    Object.assign(room.state.playerB, createPlayer('B'));
  }
  room.state.phase = 'lobby';
  
  const playersConnected = countPlayers(room.state);
  
  if (playersConnected === 0) {
    resetAdvance(room);
    rooms.set(roomCode, createRoom(roomCode));
    res.json(getRoom(roomCode).state);
    return;
  }
  
  res.json(room.state);
});

app.post('/rooms/:code/ready', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRole(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'asiento no asignado' });
    return;
  }
  const ready = req.body?.ready === false ? false : true;
  const player = role === 'A' ? room.state.playerA : room.state.playerB;
  player.isReady = ready;
  res.json(room.state);
});

app.post('/rooms/:code/start', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRole(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'asiento no asignado' });
    return;
  }
  if (!room.state.playerA.sessionId || !room.state.playerB.sessionId) {
    res.status(400).json({ error: 'faltan jugadores' });
    return;
  }
  const level = getLevel(room.state.levelId);
  room.state.phase = 'active';
  room.state.score = 0;
  room.state.turnsLeft = (level as any).turns || 20;
  room.state.objects = generateObjects(room.state.levelId);
  room.state.pendingTargetId = null;
  room.state.playerA.isReady = false;
  room.state.playerB.isReady = false;
  room.state.lastHit = null;
  res.json(room.state);
});

app.post('/rooms/:code/action/target', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRole(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'asiento no asignado' });
    return;
  }
  const targetId = (req.body?.targetId || '').toString();
  room.state.pendingTargetId = targetId || null;
  res.json(room.state);
});

app.post('/rooms/:code/action/hook', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRole(room.state, clientId);
  if (!role) {
    res.status(403).json({ error: 'no asignado a un rol' });
    return;
  }
  if (room.state.phase !== 'active') {
    res.status(400).json({ error: 'no activo' });
    return;
  }
  if (room.state.turnsLeft <= 0) {
    res.status(400).json({ error: 'sin turnos' });
    return;
  }
  let targetId = (req.body?.targetId || '').toString();
  if (!targetId && room.state.pendingTargetId) {
    targetId = room.state.pendingTargetId;
  }

  const available = room.state.objects.filter((o) => !o.taken);
  let obj: ObjectState | undefined;
  if (targetId) {
    obj = available.find((o) => o.id === targetId);
  }
  if (!obj) {
    obj = available.sort((a, b) => b.value - a.value)[0];
  }
  if (!obj) {
    res.json(room.state);
    return;
  }

  obj.taken = true;

  // Check if this was the marked target for bonus points
  const wasMarked = room.state.pendingTargetId === obj.id;
  room.state.pendingTargetId = null;

  let gain = applySpecials(room, obj, obj.value);

  // Bonus points for catching marked target
  if (wasMarked) {
    gain += 5;
  }

  room.state.score += gain;
  if (room.state.score < 0) room.state.score = 0;
  room.state.lastHit = {
    objectId: obj.id,
    type: obj.type,
    value: gain,
    scoreAfter: room.state.score,
  };
  room.state.turnsLeft -= 1;

  if (room.state.score >= room.state.goalScore) {
    markSuccess(room);
  } else if (room.state.turnsLeft <= 0) {
    room.state.phase = 'summary';
  }

  res.json(room.state);
});

app.post('/rooms/:code/action/chat', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRole(room.state, clientId) || 'S';
  const text = (req.body?.text || '').toString().slice(0, 120);
  if (text) {
    room.state.chatMessages.push({ role, text, timestamp: now() });
    room.state.chatMessages = room.state.chatMessages.slice(-20);
  }
  res.json(room.state);
});

app.post('/rooms/:code/action/hook-update', (req, res) => {
  const clientId = ensureClientId(req, res);
  if (!clientId) return;
  const room = getRoom(req.params.code);
  const role = getRole(room.state, clientId);

  const { state, angle, x, y, boosted, attachedObjectId } = req.body;

  if (state !== undefined) room.state.hookState.state = state;
  if (angle !== undefined) room.state.hookState.angle = angle;
  if (x !== undefined) room.state.hookState.x = x;
  if (y !== undefined) room.state.hookState.y = y;
  if (boosted !== undefined) room.state.hookState.boosted = boosted;
  if (attachedObjectId !== undefined) room.state.hookState.attachedObjectId = attachedObjectId;

  res.json(room.state);
});

app.post('/rooms/:code/reset', (req, res) => {
  const room = getRoom(req.params.code);
  resetAdvance(room);
  rooms.set(req.params.code.toUpperCase(), createRoom(req.params.code.toUpperCase()));
  res.json(getRoom(req.params.code).state);
});

app.listen(PORT, () => {
  console.log(`Coop Miner API corriendo en http://localhost:${PORT}`);
});
