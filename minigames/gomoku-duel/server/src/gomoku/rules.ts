import { Board, CellValue, isValidPosition, BOARD_SIZE } from './board';

const DIRECTIONS = [
  [1, 0],   // horizontal
  [0, 1],   // vertical
  [1, 1],   // diagonal \
  [1, -1],  // diagonal /
];

/**
 * Check if placing a stone at (x, y) creates a winning line (5+ in a row)
 */
export function checkWin(board: Board, x: number, y: number): boolean {
  const player = board[x][y];
  if (player === 0) return false;

  for (const [dx, dy] of DIRECTIONS) {
    let count = 1; // Current position

    // Count in positive direction
    let nx = x + dx;
    let ny = y + dy;
    while (isValidPosition(nx, ny) && board[nx][ny] === player) {
      count++;
      nx += dx;
      ny += dy;
    }

    // Count in negative direction
    nx = x - dx;
    ny = y - dy;
    while (isValidPosition(nx, ny) && board[nx][ny] === player) {
      count++;
      nx -= dx;
      ny -= dy;
    }

    if (count >= 5) return true;
  }

  return false;
}

/**
 * Check if any winning line exists on the board
 */
export function hasWinner(board: Board): CellValue {
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (board[x][y] !== 0 && checkWin(board, x, y)) {
        return board[x][y];
      }
    }
  }
  return 0;
}
