import { Board, CellValue, detectLine, LineInfo, BOARD_SIZE } from './board';

const DIRECTIONS = [
  [1, 0],   // horizontal
  [0, 1],   // vertical
  [1, 1],   // diagonal \
  [1, -1],  // diagonal /
];

/**
 * Score a line pattern based on count and open ends
 */
function scorePattern(line: LineInfo): number {
  const { count, openLeft, openRight } = line;
  const openEnds = (openLeft ? 1 : 0) + (openRight ? 1 : 0);

  if (count >= 5) return 100000; // Already won

  if (count === 4) {
    if (openEnds === 2) return 10000; // Live four (guaranteed win)
    if (openEnds === 1) return 5000;  // Dead four
  }

  if (count === 3) {
    if (openEnds === 2) return 1000;  // Live three
    if (openEnds === 1) return 200;   // Dead three
  }

  if (count === 2) {
    if (openEnds === 2) return 100;   // Live two
    if (openEnds === 1) return 10;    // Dead two
  }

  return 1; // Single stone
}

/**
 * Evaluate the score of placing a stone at position (x, y)
 */
function evaluatePosition(
  board: Board,
  x: number,
  y: number,
  aiStoneValue: CellValue,
  playerStoneValue: CellValue
): number {
  if (board[x][y] !== 0) return -Infinity;

  let score = 0;

  board[x][y] = aiStoneValue;
  for (const [dx, dy] of DIRECTIONS) {
    const line = detectLine(board, x, y, dx, dy, aiStoneValue);
    score += scorePattern(line);
  }

  board[x][y] = playerStoneValue;
  for (const [dx, dy] of DIRECTIONS) {
    const line = detectLine(board, x, y, dx, dy, playerStoneValue);
    score += scorePattern(line) * 1.5;
  }

  board[x][y] = 0;

  const centerDist = Math.abs(x - 7) + Math.abs(y - 7);
  score += (14 - centerDist) * 2;

  return score;
}

/**
 * AI selects the best move using heuristic evaluation
 */
export function makeAIMove(
  board: Board,
  aiStoneValue: CellValue = 2,
  playerStoneValue: CellValue = 1
): { x: number; y: number } | null {
  let bestScore = -Infinity;
  let bestMove: { x: number; y: number } | null = null;

  if (board[7][7] === 0) {
    let isEmpty = true;
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        if (board[x][y] !== 0) {
          isEmpty = false;
          break;
        }
      }
      if (!isEmpty) break;
    }
    if (isEmpty) return { x: 7, y: 7 };
  }

  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (board[x][y] !== 0) continue;

      const score = evaluatePosition(board, x, y, aiStoneValue, playerStoneValue);
      if (score > bestScore) {
        bestScore = score;
        bestMove = { x, y };
      }
    }
  }

  return bestMove;
}
