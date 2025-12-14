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
  onColorChange,
  playerColor = 'black',
  aiColor = 'white',
  countdownMs = 0,
  onExit,
  defaultRole = null,
}) => {
  React.useEffect(() => {
    if (defaultRole && !myRole) {
      const seatTaken = defaultRole === 'A' ? playerA?.sessionId : playerB?.sessionId;
      if (!seatTaken) {
        onClaimRole(defaultRole);
      }
    }
  }, [defaultRole, myRole, playerA, playerB, onClaimRole]);

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
      <div className={`player-item ${player?.isReady ? 'ready' : ''}`} key={label}>
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
      <h1 className="lobby-title">DUELO DE GOMOKU</h1>
      <p className="lobby-subtitle">Cooperen para vencer a la IA</p>

      <div className="lobby-section">
        <div className="section-header">Código de Sala</div>
        <div className="session-code-display">{sessionCode}</div>
        <p className="session-code-hint">
          {defaultRole
            ? `Eres Jugador ${defaultRole} - ${defaultRole === 'A' ? 'Mueves primero' : 'Mueves segundo'}`
            : 'Comparte este código para que otro jugador se una.'}
        </p>
      </div>

      {myRole && (
        <div className="lobby-section">
          <div className="section-header">Selección de Color</div>
          <p className="session-code-hint" style={{ marginBottom: '12px' }}>
            Elige qué color usarás. La IA se adaptará automáticamente.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className={`pixel-button ${playerColor === 'black' ? 'active' : ''}`}
              onClick={() => onColorChange?.('black')}
              style={{
                flex: 1,
                background: playerColor === 'black' ? 'var(--pixel-green)' : 'var(--pixel-gray)',
              }}
            >
              Negro ● (Jugadores)
            </button>
            <button
              className={`pixel-button ${playerColor === 'white' ? 'active' : ''}`}
              onClick={() => onColorChange?.('white')}
              style={{
                flex: 1,
                background: playerColor === 'white' ? 'var(--pixel-green)' : 'var(--pixel-gray)',
              }}
            >
              Blanco ○ (Jugadores)
            </button>
          </div>
          <p className="session-code-hint" style={{ marginTop: '8px', fontSize: '8px' }}>
            IA jugará con {aiColor === 'black' ? 'Negro ●' : 'Blanco ○'}
            {aiColor === 'black' ? ' (hará la primera jugada en el centro)' : ''}
          </p>
        </div>
      )}

      <div className="lobby-section">
        <div className="section-header">Jugadores</div>
        <div className="players-list">
          {renderSeat('A', playerA)}
          {renderSeat('B', playerB)}
        </div>
      </div>

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
              Esperando a que ambos jugadores estén listos.
            </div>
          )}

          {canStart && (
            <button className="pixel-button large" onClick={onStart}>
              Comenzar (5s)
            </button>
          )}
        </div>
      )}

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
