import React, { useState, useEffect, useMemo } from 'react';
import TeamChat from './TeamChat';
import AnswerButton from './AnswerButton';
import HintPanel from './HintPanel';
import PixelDialog from './PixelDialog';
import levelData from '../../../shared/levelData.json';

const Level1 = ({ state, myRole, sendMessage, onExitToMainboard }) => {
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [otherPlayerConfirmed, setOtherPlayerConfirmed] = useState(false);
  const [showDialog, setShowDialog] = useState(null);

  const level = useMemo(() => {
    const idx = Math.max(0, Math.min(levelData.levels.length - 1, (state?.levelId || 1) - 1));
    return levelData.levels[idx];
  }, [state?.levelId]);

  // Sync local UI flags based on shared state
  useEffect(() => {
    if (!state) return;
    const me = myRole === 'A' ? state.playerA : state.playerB;
    const other = myRole === 'A' ? state.playerB : state.playerA;
    setOtherPlayerConfirmed(Boolean(other?.confirmedAt));

    // If my confirmation is pending during sync animation
    setIsConfirming(state.phase === 'sync_confirm' && Boolean(me?.confirmedAt));

    // Reset local selections on retry
    if (state.phase === 'retry') {
      setTimeout(() => setSelectedAnswers([]), 500);
    }
  }, [state, myRole]);

  // Clear selection when level changes
  useEffect(() => {
    setSelectedAnswers([]);
    setIsConfirming(false);
  }, [state?.levelId]);

  const handleAnswerClick = (answer) => {
    if (isConfirming) return;

    const newAnswers = [...selectedAnswers];
    const index = newAnswers.indexOf(answer);

    if (index > -1) {
      // Remove this answer and all subsequent answers
      // This allows users to "go back" and reselect from this point
      newAnswers.splice(index);
    } else {
      // Add to selection
      newAnswers.push(answer);
    }

    setSelectedAnswers(newAnswers);
    sendMessage('select_answer', { answer: newAnswers });
  };

  const handleClearAnswers = () => {
    if (isConfirming) return;
    setSelectedAnswers([]);
    sendMessage('select_answer', { answer: [] });
  };

  const handleConfirm = () => {
    if (selectedAnswers.length !== level.correctAnswer.length) {
      setShowDialog({
        type: 'alert',
        title: '¡Atención!',
        message: `Por favor selecciona ${level.correctAnswer.length} respuestas en el orden correcto.`,
        onConfirm: () => setShowDialog(null)
      });
      return;
    }

    setIsConfirming(true);
    sendMessage('confirm_answer');
  };

  const handleSendChat = (text) => {
    sendMessage('chat_message', { text });
  };

  // Get player-specific content
  const playerContent = myRole === 'A' ? level.playerA : level.playerB;
  const otherRole = myRole === 'A' ? 'B' : 'A';

  // Render player A view (symbols sequence)
  const renderPlayerAView = () => (
    <div className="player-content">
      <div className="content-title">{level.playerA.title}</div>
      <p className="content-description">{level.playerA.description}</p>

      <div className="sequence-display">
        {level.playerA.sequence.map((symbol, i) => (
          <React.Fragment key={i}>
            <span className="sequence-symbol">{symbol}</span>
            {i < level.playerA.sequence.length - 1 && (
              <span className="sequence-arrow">→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      <p className="content-instruction">{level.playerA.instruction}</p>
    </div>
  );

  // Render player B view (mapping table)
  const renderPlayerBView = () => (
    <div className="player-content">
      <div className="content-title">{level.playerB.title}</div>
      <p className="content-description">{level.playerB.description}</p>

      <div className="mapping-table">
        {Object.entries(level.playerB.mapping).map(([symbol, emotion]) => (
          <div key={symbol} className="mapping-row">
            <span className="mapping-symbol">{symbol}</span>
            <span className="mapping-arrow">→</span>
            <span className="mapping-value">{emotion}</span>
          </div>
        ))}
      </div>

      <p className="content-instruction">{level.playerB.instruction}</p>
    </div>
  );

  // Messages from state
  const chatMessages = state.chatMessages ? Array.from(state.chatMessages) : [];
  const totalLevels = levelData.levels.length;
  const exitRequests = state?.exitRequests || { A: false, B: false };
  const myExitRequested = myRole === 'A' ? exitRequests.A : exitRequests.B;
  const otherExitRequested = myRole === 'A' ? exitRequests.B : exitRequests.A;
  const bothWantExit = Boolean(myExitRequested && otherExitRequested);

  useEffect(() => {
    if (bothWantExit && onExitToMainboard) {
      onExitToMainboard(false);
    }
  }, [bothWantExit, onExitToMainboard]);

  // Prompt when the other player wants to abandon
  useEffect(() => {
    if (otherExitRequested && !myExitRequested) {
      setShowDialog({
        type: 'confirm',
        title: 'Tu compañero quiere salir',
        message: '¿Abandonan la partida? Deben aceptar ambos.',
        confirmText: 'Aceptar',
        cancelText: 'Seguir jugando',
        onConfirm: () => {
          setShowDialog(null);
          sendMessage('request_exit');
        },
        onCancel: () => {
          setShowDialog(null);
          sendMessage('cancel_exit');
        }
      });
    }
  }, [otherExitRequested, myExitRequested, sendMessage]);

  const shuffledOptions = useMemo(() => {
    const arr = Array.from(level.options || []);
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.levelId, level.options]);

  const canShowExit = ['active', 'retry', 'sync_confirm'].includes(state?.phase);

  const handleAbandonClick = () => {
    setShowDialog({
      type: 'confirm',
      title: 'Abandonar partida',
      message: 'Esta acción solicitará salir. Saldrán solo si ambos aceptan.',
      confirmText: 'Solicitar salida',
      cancelText: 'Cancelar',
      onConfirm: () => {
        setShowDialog(null);
        sendMessage('request_exit');
      },
      onCancel: () => setShowDialog(null),
    });
  };

  const handleCancelExit = () => {
    sendMessage('cancel_exit');
  };

  return (
    <div className="pixel-view level-view">
      {/* Dialog */}
      {showDialog && (
        <PixelDialog
          type={showDialog.type}
          title={showDialog.title}
          message={showDialog.message}
          onConfirm={showDialog.onConfirm}
          onCancel={showDialog.onCancel}
          confirmText={showDialog.confirmText}
          cancelText={showDialog.cancelText}
        />
      )}


      {/* Top Bar */}
      <div className="level-top-bar">
        {canShowExit && (
          <button className="exit-button-top" onClick={handleAbandonClick}>
            ← Volver (abandonar)
          </button>
        )}
        <div className="level-title">{level.nameES}</div>
        <div className="level-progress">Nivel {state?.levelId || 1}/{totalLevels}</div>
      </div>

      <div className="level-container">
        {/* Left Panel - Player-specific content */}
        <div className="left-panel">
          <div className="control-section">
            {myRole === 'A' ? renderPlayerAView() : renderPlayerBView()}
          </div>

          {/* Chat */}
          <TeamChat
            messages={chatMessages}
            onSendMessage={handleSendChat}
            myRole={myRole}
          />
        </div>

        {/* Right Panel - Answers and hints */}
        <div className="right-panel">
          {/* Hint Panel */}
          <HintPanel hint={state.currentHint} />

          {/* Answer Selection */}
          <div className="control-section answer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div className="section-title">Selecciona tu respuesta:</div>
              {selectedAnswers.length > 0 && (
                <button
                  className="pixel-button small"
                  onClick={handleClearAnswers}
                  style={{ background: 'var(--pixel-red)', color: 'var(--pixel-white)', padding: '8px 12px', fontSize: '8px' }}
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="answer-grid">
              {shuffledOptions.map((option) => {
                const isSelected = selectedAnswers.includes(option);
                const selectionIndex = selectedAnswers.indexOf(option);

                return (
                  <div key={option} className="answer-wrapper">
                    <AnswerButton
                      label={option}
                      selected={isSelected}
                      onClick={() => handleAnswerClick(option)}
                    />
                    {isSelected && (
                      <div className="selection-number">{selectionIndex + 1}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected sequence display */}
            {selectedAnswers.length > 0 && (
              <div className="selected-sequence">
                <div className="sequence-label">Tu secuencia:</div>
                <div className="sequence-items">
                  {selectedAnswers.map((answer, i) => (
                    <React.Fragment key={i}>
                      <span className="sequence-item">{answer}</span>
                      {i < selectedAnswers.length - 1 && (
                        <span className="sequence-arrow">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Button */}
          <div className="confirm-section">
            <button
              className={`pixel-button large confirm-button ${
                isConfirming ? 'confirming' : ''
              }`}
              onClick={handleConfirm}
              disabled={
                isConfirming ||
                selectedAnswers.length !== level.correctAnswer.length
              }
            >
              {isConfirming
                ? otherPlayerConfirmed
                  ? 'Insertando llaves...'
                  : 'Esperando al otro jugador...'
                : 'Insertar Llave'}
            </button>

              {otherPlayerConfirmed && !isConfirming && (
              <div className="other-player-waiting">
                Jugador {otherRole} está esperando...
              </div>
            )}

            {(myExitRequested || otherExitRequested) && (
              <div className="exit-notice">
                {bothWantExit && (
                  <div className="exit-notice-text">Ambos aceptaron abandonar. Saliendo...</div>
                )}
                {myExitRequested && !otherExitRequested && (
                  <div className="exit-notice-text">Has solicitado abandonar. Esperando a Jugador {otherRole}.</div>
                )}
                {!myExitRequested && otherExitRequested && (
                  <div className="exit-notice-text">Jugador {otherRole} quiere abandonar. ¿Aceptas?</div>
                )}

                {myExitRequested && !otherExitRequested && (
                  <button className="pixel-button small" onClick={handleCancelExit}>
                    Cancelar solicitud
                  </button>
                )}
                {!myExitRequested && otherExitRequested && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button className="pixel-button small" onClick={() => sendMessage('request_exit')}>
                      Aceptar
                    </button>
                    <button className="pixel-button small" onClick={() => sendMessage('cancel_exit')}>
                      Seguir jugando
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Result Message */}
          {state.phase === 'sync_confirm' && (
            <div className="result-message sync-confirm">
              🔑 Alineando las llaves... 🔑
            </div>
          )}

          {state.resultMessage && state.phase === 'retry' && (
            <div className="result-message retry">
              {state.resultMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Level1;
