import React from 'react';

const Lobby = ({
  sessionCode,
  myRole,
  playerA,
  playerB,
  onClaimRole,
  onReleaseRole,
  onToggleReady,
  onStart,
  countdownMs = 0,
  onExit,
  mode = 'local'
}) => {
  const isMultiplayer = mode === 'multi';
  const myPlayer = myRole === 'A' ? playerA : myRole === 'B' ? playerB : null;
  const isCountingDown = countdownMs > 0;
  const aTaken = Boolean(playerA?.sessionId);
  const bTaken = Boolean(playerB?.sessionId);
  const bothReady = aTaken && bTaken && playerA?.isReady && playerB?.isReady;
  const canStart = bothReady && !isCountingDown;

  const renderSeat = (label, player) => {
    const seatRole = label;
    const isMine = myRole === seatRole && player?.sessionId;
    const taken = Boolean(player?.sessionId);

    let status = 'Vacante';
    if (taken && isMine) status = 'Tú';
    else if (taken) status = 'Ocupado';

    const action = () => {
      if (isMine) onReleaseRole?.(seatRole);
      else if (!taken) onClaimRole?.(seatRole);
    };

    const actionLabel = isMine ? 'Liberar' : taken ? '—' : 'Tomar asiento';
    const disabled = taken && !isMine;

    return (
      <div className={`player-item ${player?.isReady ? 'ready' : ''}`}>
        <div className="player-info">
          <div className="player-role">JUGADOR {label}</div>
          <div className="player-name">{status}</div>
        </div>
        <div className="player-status">{player?.isReady ? '✓ LISTO' : taken ? 'ESPERANDO' : '-'}</div>
        <button
          className="pixel-button small"
          style={{ marginTop: '8px', opacity: disabled ? 0.5 : 1 }}
          disabled={disabled}
          onClick={action}
        >
          {actionLabel}
        </button>
      </div>
    );
  };

  return (
    <div className="lobby-container">
      <h1 className="lobby-title">
        SALA DE ESPERA {isMultiplayer ? '(Online)' : '(Local)'}
      </h1>

      {/* Game Description */}
      <div className="lobby-section">
        <div className="section-header">Descripción</div>
        <p className="session-code-hint" style={{ marginTop: '8px' }}>
          Cooperen para alinear las llaves: cada jugador ve pistas distintas, hablen, tomen asiento A/B, pulsen "Estoy listo" y comiencen. Seleccionen la secuencia correcta en cada nivel para avanzar.
        </p>
      </div>

      {/* Player Status */}
      <div className="lobby-section">
        <div className="section-header">Jugadores</div>
        <div className="players-list">
          {renderSeat('A', playerA)}
          {renderSeat('B', playerB)}
        </div>
      </div>

      {/* Ready / Start */}
      {myRole && (
        <div className="lobby-section" style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
          <button
            className="pixel-button large"
            onClick={() => onToggleReady?.(!myPlayer?.isReady)}
          >
            {myPlayer?.isReady ? 'Cancelar listo' : 'Estoy listo'}
          </button>

          {isCountingDown && (
            <div className="waiting-message">
              Iniciando en {Math.ceil(countdownMs / 1000)}s...
            </div>
          )}

          {!isCountingDown && !bothReady && (
            <div className="waiting-message">
              Esperando a que ambos jugadores se sienten y estén listos.
            </div>
          )}

          {canStart && (
            <button className="pixel-button large" onClick={onStart}>
              Comenzar (5s)
            </button>
          )}
        </div>
      )}

      {/* Exit Button */}
      {onExit && (
        <div className="lobby-section">
          <button className="pixel-button small exit-button" onClick={onExit}>
            Volver al Tablero
          </button>
        </div>
      )}
    </div>
  );
};

export default Lobby;
