export const BOARD_SIZE = 15;

export type CellValue = 0 | 1 | 2; // 0 = empty, 1 = player (black), 2 = ai (white)
export type Board = CellValue[][];

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(0)
  );
}

export function isValidPosition(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

export function isCellEmpty(board: Board, x: number, y: number): boolean {
  return isValidPosition(x, y) && board[x][y] === 0;
}

export function isBoardFull(board: Board): boolean {
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (board[x][y] === 0) return false;
    }
  }
  return true;
}

export interface LineInfo {
  count: number;
  openLeft: boolean;
  openRight: boolean;
}

/**
 * Detect consecutive stones from position (x, y) along direction (dx, dy)
 */
export function detectLine(
  board: Board,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: CellValue
): LineInfo {
  if (player === 0) {
    return { count: 0, openLeft: false, openRight: false };
  }

  let count = 0;

  // Extend in positive direction
  let nx = x;
  let ny = y;
  while (isValidPosition(nx, ny) && board[nx][ny] === player) {
    count++;
    nx += dx;
    ny += dy;
  }
  const openRight = isValidPosition(nx, ny) && board[nx][ny] === 0;

  // Extend in negative direction
  nx = x - dx;
  ny = y - dy;
  while (isValidPosition(nx, ny) && board[nx][ny] === player) {
    count++;
    nx -= dx;
    ny -= dy;
  }
  const openLeft = isValidPosition(nx, ny) && board[nx][ny] === 0;

  return { count, openLeft, openRight };
}
