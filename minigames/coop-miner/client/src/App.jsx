import { useMemo, useState, useEffect, useRef } from 'react';
import levelsData from '../../shared/minerLevels.json';
import useMinerGame from './hooks/useMinerGame';
import GameCanvas from './components/GameCanvas';
import PixelDialog from './components/PixelDialog';
import SuccessScreen from './components/SuccessScreen';

const phaseCopy = {
  lobby: 'Sala',
  briefing: 'Preparación',
  active: 'En juego',
  success: 'Nivel superado',
  summary: 'Sin turnos',
};

const App = () => {
  const game = useMinerGame();
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [showDialog, setShowDialog] = useState(null);
  const exitingRef = useRef(false);
  const roleClaimedRef = useRef(false);

  const phase = game.state?.phase || 'lobby';

  // Map Blind Rally roles (driver/navigator) to coop-miner roles (A/B)
  const resolvePreferredRole = () => {
    if (!game.preferredRole) return null;
    const role = game.preferredRole.toLowerCase();
    // Map driver -> A, navigator -> B
    if (role === 'driver') return 'A';
    if (role === 'navigator') return 'B';
    // If already A or B, use as is
    if (role === 'a' || role === 'b') return role.toUpperCase();
    return null;
  };

  // Auto-claim role from URL if provided
  useEffect(() => {
    if (roleClaimedRef.current || !game.preferredRole || game.myRole) return;
    const mappedRole = resolvePreferredRole();
    if (mappedRole && game.state && !game.myRole) {
      roleClaimedRef.current = true;
      // Small delay to ensure state is loaded
      setTimeout(() => {
        game.claimRole(mappedRole).catch((err) => {
          console.warn('Failed to auto-claim role:', err);
          roleClaimedRef.current = false;
        });
      }, 200);
    }
  }, [game.preferredRole, game.myRole, game.state, game.claimRole]);

  const levelMeta = useMemo(() => {
    if (!game.state) return null;
    return levelsData.levels.find((lvl) => lvl.id === game.state.levelId) || null;
  }, [game.state]);

  const status = game.state ? `${game.state.score}/${game.state.goalScore} pts` : '...';
  const levelInfo = game.state ? `Nivel ${game.state.levelId}/${game.state.totalLevels || 3}` : '';
  const turnsLeft = game.state?.turnsLeft ?? 0;

  const handleObjectCollected = (obj) => {
    game.hook(obj.id).catch(console.error);
  };

  const handleExitToMainboard = async (won = false) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    game.leaveRoom?.();
    await game.reportResult?.(won);
    // Close window after a delay to ensure result is sent
    setTimeout(() => {
      window.close();
    }, 500);
  };

  const handleExitConfirm = () => {
    setShowDialog({
      type: 'confirm',
      title: 'Salir del Minijuego',
      message: '¿Quieres salir? Puedes volver cuando quieras.',
      confirmText: 'Salir',
      cancelText: 'Quedarme',
      onConfirm: () => {
        setShowDialog(null);
        handleExitToMainboard(false);
      },
      onCancel: () => setShowDialog(null),
    });
  };

  // Auto-advance to next level after success (or auto-exit if final level)
  useEffect(() => {
    if (phase === 'success' && game.state) {
      const isFinal = game.state.levelId >= (game.state.totalLevels || 3);
      if (isFinal) {
        // Auto-exit after 3 seconds if it's the final level
        const timer = setTimeout(() => {
          handleExitToMainboard(true);
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        // Auto-advance to next level
        const timer = setTimeout(() => {
          game.start().catch(console.error);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, game.state?.levelId, game.state?.totalLevels]);

  const seatStatus = (role) => {
    const player = role === 'A' ? game.state?.playerA : game.state?.playerB;
    const isMe = game.myRole === role;
    const occupied = !!player?.sessionId;
    return {
      occupied,
      ready: !!player?.isReady,
      label: occupied ? (isMe ? 'Tú' : 'Ocupado') : 'Libre',
    };
  };

  const renderLobby = () => {
    const aStatus = seatStatus('A');
    const bStatus = seatStatus('B');
    return (
      <div className="pixel-lobby">
        <div className="pixel-bg" />
        <div className="lobby-container">
          <div className="lobby-title">Golden Miner · Co-op</div>
          <div className="lobby-subtitle">Dos roles, un gancho. Coordinen con voz para llegar a la meta.</div>

          <div className="lobby-section">
            <div className="section-header">Descripción del reto</div>
            <p>Recolecten {game.state?.goalScore || 0} puntos en equipo. ¡Cada jugador ve información diferente!</p>
            <p className="hint">
              {levelInfo} · Objetivo: {status} · Turnos: {levelMeta?.turns || '—'}
            </p>
            <p className="hint">🔍 A ve ICONOS · B ve VALORES y PESO</p>
            <p className="hint">⭐ B marca objetivos (+5 bonus) · 💬 ¡Comuníquense!</p>
          </div>

          <div className="lobby-section">
            <div className="section-header">Asientos y roles</div>
            <div className="roles-grid">
              <div className={`player-item ${aStatus.ready ? 'ready' : ''}`}>
                <div>
                  <div className="seat-title">Jugador A · Operador del Gancho</div>
                  <div className="seat-desc">Ve solo ICONOS. Controla ángulo (← →) y lanza (ESPACIO).</div>
                  <div className="seat-status">Estado: {aStatus.label} · Listo: {aStatus.ready ? 'Sí' : 'No'}</div>
                </div>
                <div className="seat-actions">
                  <button className="pixel-button small" onClick={() => game.claimRole('A')}>Tomar A</button>
                  <button className="pixel-button small" onClick={game.releaseRole}>Liberar</button>
                </div>
              </div>

              <div className={`player-item ${bStatus.ready ? 'ready' : ''}`}>
                <div>
                  <div className="seat-title">Jugador B · Estratega</div>
                  <div className="seat-desc">Ve VALORES y PESO. Acelera (SHIFT/↓) y marca objetivos (CLICK).</div>
                  <div className="seat-status">Estado: {bStatus.label} · Listo: {bStatus.ready ? 'Sí' : 'No'}</div>
                </div>
                <div className="seat-actions">
                  <button className="pixel-button small" onClick={() => game.claimRole('B')}>Tomar B</button>
                  <button className="pixel-button small" onClick={game.releaseRole}>Liberar</button>
                </div>
              </div>
            </div>
          </div>

          <div className="lobby-section">
            <div className="section-header">Inicio rápido</div>
            <div className="meta-grid">
              <span className="pill">Nivel {game.state?.levelId}/{game.state?.totalLevels || 3}</span>
              <span className="pill">Meta {game.state?.goalScore || 0} pts</span>
              <span className="pill">Fase: {phaseCopy[phase]}</span>
            </div>
            <div className="action-row">
              <button className="pixel-button" onClick={() => game.setReady(true)} disabled={!game.myRole}>Estoy listo</button>
              <button className="pixel-button" onClick={() => game.setReady(false)} disabled={!game.myRole}>No listo</button>
              <button
                className="pixel-button"
                onClick={game.start}
                disabled={!game.state?.playerA?.sessionId || !game.state?.playerB?.sessionId}
              >
                Empezar nivel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGame = () => (
    <div className="game-view">
      <div className="game-top-bar">
        <div className="game-info">
          <div className="level-title">Golden Miner · {levelMeta?.name || 'Nivel'}</div>
          <div className="meta-line">{levelInfo} · Meta: {game.state?.goalScore || 0} pts</div>
        </div>

        <div className="game-stats">
          <span className="pill">Puntos: {game.state?.score ?? 0}</span>
          <span className="pill">Turnos: {turnsLeft}</span>
          <span className="pill">Fase: {phaseCopy[phase]}</span>
        </div>

        <div className="voice-controls">
          <button
            className={`voice-btn ${voiceConnected ? 'connected' : ''}`}
            onClick={() => setVoiceConnected(!voiceConnected)}
          >
            {voiceConnected ? '🎤 Conectado' : '🔇 Desconectado'}
          </button>
          <button
            className="voice-btn small"
            onClick={() => setVoiceMuted(!voiceMuted)}
            disabled={!voiceConnected}
          >
            {voiceMuted ? '🔇' : '🎤'}
          </button>
          <button className="pixel-button small" onClick={handleExitConfirm}>
            Volver
          </button>
        </div>
      </div>

      <div className="phaser-container-wrapper">
        <GameCanvas
          myRole={game.myRole}
          gameState={game.state}
          onObjectCollected={handleObjectCollected}
          onHookStateUpdate={game.updateHookState}
          onMarkTarget={game.markTarget}
        />
      </div>

      <div className="game-bottom-bar">
        <div className="role-info">
          {game.myRole === 'A' && (
            <span className="role-label">Tu rol: Operador (A) - Ves iconos · Controlas ángulo y disparo</span>
          )}
          {game.myRole === 'B' && (
            <span className="role-label">Tu rol: Estratega (B) - Ves valores/peso · Aceleras y marcas objetivos (CLICK)</span>
          )}
        </div>
      </div>

      {game.state?.lastHit && (
        <div className="last-hit-banner">
          Capturado: {game.state.lastHit.type} ({game.state.lastHit.value > 0 ? '+' : ''}{game.state.lastHit.value} pts) → Total: {game.state.lastHit.scoreAfter} pts
        </div>
      )}
    </div>
  );

  const renderSuccess = () => {
    const isFinal = game.state?.levelId >= (game.state?.totalLevels || 3);
    
    return (
      <SuccessScreen
        levelId={game.state?.levelId || 1}
        totalLevels={game.state?.totalLevels || 3}
        score={game.state?.score || 0}
        goalScore={game.state?.goalScore || 0}
        onContinue={!isFinal ? () => game.start() : null}
        onExit={null} // No manual exit button for final level - auto-exit after 3s
        isFinal={isFinal}
      />
    );
  };

  const renderSummary = () => {
    // Determine if won based on score >= goalScore
    const won = game.state && game.state.score >= game.state.goalScore;
    return (
      <div className="pixel-lobby">
        <div className="pixel-bg" />
        <div className="lobby-container">
          <div className="lobby-title">{won ? '¡Victoria!' : 'Intento terminado'}</div>
          <p className="hint">Puntuación: {status} · Turnos agotados.</p>
          <div className="action-row">
            <button className="pixel-button" onClick={() => handleExitToMainboard(won)}>Volver</button>
          </div>
        </div>
      </div>
    );
  };

  const renderPhase = () => {
    switch (phase) {
      case 'lobby':
      case 'briefing':
        return renderLobby();
      case 'active':
        return renderGame();
      case 'success':
        return renderSuccess();
      case 'summary':
        return renderSummary();
      default:
        return renderLobby();
    }
  };

  return (
    <div className="twokeys-container">
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
      {renderPhase()}

      {game.error && (
        <div className="status-banner warn">
          Error: {game.error.message || 'Desconocido'}
        </div>
      )}
    </div>
  );
};

export default App;
