import { Board } from './gomoku/board';

export type Phase = 'lobby' | 'briefing' | 'active' | 'finished';
export type Turn = 'player' | 'ai';
export type Winner = 'player' | 'ai' | 'draw' | null;

export interface PlayerState {
  sessionId: string;
  role: 'A' | 'B';
  isReady: boolean;
}

export interface Move {
  x: number;
  y: number;
  by: 'player' | 'ai';
}

export interface ChatMessage {
  role: string;
  text: string;
  timestamp: number;
}

export interface GomokuData {
  board: Board;
  turn: Turn;
  winner: Winner;
  lastMove: Move | null;
  moveHistory: Move[];
  playerColor: 'black' | 'white';
  aiColor: 'black' | 'white';
  currentPlayer: 'A' | 'B';
}

export interface RoomState {
  sessionCode: string;
  phase: Phase;
  startAt: number;
  countdownMs: number;
  playerA: PlayerState;
  playerB: PlayerState;
  playersConnected: number;
  chatMessages: ChatMessage[];
  gomoku: GomokuData;
  createdAt: number;
  exitRequests: { A: boolean; B: boolean };
}

export interface RoomRecord {
  state: RoomState;
  countdownTimer: NodeJS.Timeout | null;
  aiMoveTimer: NodeJS.Timeout | null;
}
