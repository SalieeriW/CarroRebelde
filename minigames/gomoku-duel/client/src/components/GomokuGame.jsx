import React from 'react';
import GomokuBoard from './GomokuBoard';
import TeamChat from './TeamChat';
import gameData from '../gameData.json';

const GomokuGame = ({ state, myRole, onMove, onReset, onSendChat, onExit }) => {
  const { gomoku, chatMessages } = state;
  const { board, turn, winner, lastMove, playerColor, aiColor, currentPlayer } = gomoku;
  const { messages } = gameData;

  const getTurnText = () => {
    if (winner) return '';
    if (turn === 'ai') return messages.aiTurn;
    if (currentPlayer === 'A') return messages.yourTurnPlayerA;
    return messages.yourTurnPlayerB;
  };

  const getResultPanel = () => {
    if (!winner) return null;

    let title = '';
    let message = '';
    let panelClass = '';
    const won = winner === 'player';

    if (winner === 'player') {
      title = messages.victory;
      message = messages.victoryMessage;
      panelClass = 'victory';
    } else if (winner === 'ai') {
      title = messages.defeat;
      message = messages.defeatMessage;
      panelClass = 'defeat';
    } else {
      title = messages.draw;
      message = messages.drawMessage;
      panelClass = 'draw';
    }

    return (
      <div className={`result-panel ${panelClass}`}>
        <h2 className="result-title">{title}</h2>
        <p className="result-message">{message}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          <button className="pixel-button large" onClick={() => onExit(won)}>
            Salir
          </button>
          {!won && (
            <button className="pixel-button small" onClick={onReset}>
              {messages.reset}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="level-view">
      {/* Top bar */}
      <div className="level-top-bar">
        <button className="exit-button-top" onClick={() => onExit(false)}>
          ← {messages.exit}
        </button>
        <div className="level-title">{gameData.nameES}</div>
        <div className={`turn-indicator ${turn === 'ai' ? 'ai-turn' : ''}`}>
          {getTurnText()}
        </div>
      </div>

      <div className="level-container">
        {/* Left panel - Board */}
        <div className="left-panel">
          <div className="control-section">
            <GomokuBoard
              board={board}
              lastMove={lastMove}
              turn={turn}
              winner={winner}
              onMove={onMove}
              disabled={(() => {
                const disabled = turn === 'ai' || winner !== null || (turn === 'player' && currentPlayer !== myRole);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/GomokuGame.jsx:71',message:'GomokuBoard disabled calculated',data:{turn,winner,currentPlayer,myRole,disabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                return disabled;
              })()}
              playerColor={playerColor}
              aiColor={aiColor}
            />
          </div>

          {/* Chat */}
          <div className="chat-container">
            <TeamChat
              messages={chatMessages || []}
              onSendMessage={onSendChat}
              myRole={myRole}
            />
          </div>
        </div>

        {/* Right panel - Info and result */}
        <div className="right-panel">
          {/* Rules info */}
          <div className="control-section info-section">
            <h3>Reglas</h3>
            <p>
              <strong>Objetivo:</strong> Cinco fichas consecutivas
              (horizontal, vertical o diagonal) antes que la IA.
            </p>
            <p>
              <strong>Turnos:</strong> Jugador A mueve primero, Jugador B segundo.
              La IA ({aiColor === 'black' ? 'Negro ●' : 'Blanco ○'}) responde automáticamente.
            </p>
          </div>

          {/* Result panel */}
          {getResultPanel()}
        </div>
      </div>
    </div>
  );
};

export default GomokuGame;
