import React, { useState, useEffect, useRef } from 'react';

const BOARD_SIZE = 15;
const COORDS_H = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];

const GomokuBoard = ({ board, lastMove, turn, winner, onMove, disabled, playerColor = 'black', aiColor = 'white' }) => {
  const [selectedPos, setSelectedPos] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevTurnRef = useRef(turn);

  const playerStoneValue = playerColor === 'black' ? 1 : 2;
  const aiStoneValue = aiColor === 'black' ? 1 : 2;

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/GomokuBoard.jsx:15',message:'Turn changed',data:{prevTurn:prevTurnRef.current,currentTurn:turn,isSubmitting},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    if (isSubmitting && prevTurnRef.current === 'ai' && turn === 'player') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/GomokuBoard.jsx:18',message:'Resetting isSubmitting after AI turn',data:{prevTurn:prevTurnRef.current,currentTurn:turn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      setIsSubmitting(false);
    }
    prevTurnRef.current = turn;
  }, [turn, isSubmitting]);

  const handleCellClick = (x, y) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/GomokuBoard.jsx:25',message:'Cell clicked',data:{x,y,disabled,winner,turn,cellValue:board[x][y],isSubmitting},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (disabled || isSubmitting || winner || turn !== 'player' || board[x][y] !== 0) return;
    setSelectedPos({ x, y });
  };

  const handleConfirm = async () => {
    if (!selectedPos || isSubmitting) return;
    const move = { x: selectedPos.x, y: selectedPos.y };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/GomokuBoard.jsx:32',message:'Move confirmed, setting submitting',data:{x:move.x,y:move.y,turn,disabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    setIsSubmitting(true);
    setSelectedPos(null);
    try {
      await onMove(move.x, move.y);
    } catch (e) {
      console.error('Move failed:', e);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedPos(null);
  };

  return (
    <div className="gomoku-board-container">
      {/* Horizontal coordinates */}
      <div className="coords-top">
        <div className="coord-spacer"></div>
        {COORDS_H.map((c) => (
          <div key={c} className="coord-label">
            {c}
          </div>
        ))}
      </div>

      {/* Board rows with vertical coordinates */}
      <div className="board-grid">
        {board.map((row, x) => (
          <div key={x} className="board-row">
            <div className="coord-label">{x + 1}</div>
            {row.map((cell, y) => {
              const isLast = lastMove?.x === x && lastMove?.y === y;
              const isSelected = selectedPos?.x === x && selectedPos?.y === y;
              const cellClass = `cell ${isLast ? 'last-move' : ''} ${
                isSelected ? 'selected' : ''
              } ${cell === 0 && !disabled && !isSubmitting && !winner && turn === 'player' ? 'hoverable' : ''}`;

              const isPlayerStone = cell === playerStoneValue;
              const isAIStone = cell === aiStoneValue;
              const previewColor = playerColor === 'black' ? 'black' : 'white';

              return (
                <div
                  key={`${x}-${y}`}
                  className={cellClass}
                  onClick={() => handleCellClick(x, y)}
                >
                  {isPlayerStone && <div className={`stone ${playerColor}`}>●</div>}
                  {isAIStone && <div className={`stone ${aiColor}`}>●</div>}
                  {isSelected && <div className={`stone preview ${previewColor}`}>●</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Confirm/Cancel buttons */}
      {selectedPos && (
        <div className="move-confirmation">
          <button className="pixel-button large confirm" onClick={handleConfirm}>
            Confirmar jugada
          </button>
          <button className="pixel-button small cancel" onClick={handleCancel}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default GomokuBoard;
