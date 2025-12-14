import { useEffect, useRef, useState } from 'react';
import useLocalGame from '../hooks/useLocalGame';
import useMultiplayerGame from '../hooks/useMultiplayerGame';
import Lobby from './Lobby';
import Briefing from './Briefing';
import Level1 from './Level1';
import SuccessScreen from './SuccessScreen';
import PixelDialog from './PixelDialog';
import '../styles/twokeys.css';

const resolveMode = () => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const queryMode = urlParams.get('mode')?.toLowerCase();
    if (queryMode === 'multi' || queryMode === 'local') return queryMode;
  }
  // Default to multiplayer unless explicitly forced to local
  return 'multi';
};

const resolvePreferredRole = () => {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  const param =
    urlParams.get('role') ||
    urlParams.get('player') ||
    urlParams.get('pref') ||
    urlParams.get('seat');
  
  if (param) {
    const upperParam = param.toUpperCase();
    // Map Blind Rally roles to Two Keys Gate roles
    if (upperParam === 'DRIVER') return 'A';
    if (upperParam === 'NAVIGATOR') return 'B';
    // If already A or B, return as is
    if (upperParam === 'A' || upperParam === 'B') return upperParam;
  }

  const port = window.location.port;
  if (port === '5174') return 'A';
  if (port === '5175') return 'B';
  return null;
};

const TwoKeysGateView = ({
  mode,
  state,
  error,
  connected,
  myRole,
  sessionCode,
  sendMessage,
  claimRole,
  releaseRole,
  setReady,
  startCountdown,
  leaveRoom,
}) => {
  const [showDialog, setShowDialog] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!state?.startAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state?.startAt]);

  const countdownMs = state?.startAt ? Math.max(state.startAt - now, 0) : 0;

  useEffect(() => {
    // placeholder for future effects
  }, []);

  const exitingRef = useRef(false);

  const reportResult = async (won = false) => {
    // Get roomCode and sessionId from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room') || urlParams.get('roomCode');
    const sessionId = urlParams.get('session') || urlParams.get('sessionId');
    
    if (!roomCode || !sessionId) {
      console.warn('No roomCode or sessionId found in URL, cannot report result');
      return;
    }

    const host = typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'localhost';
    const url = `http://${host}:2567/minigame/result`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ won, roomCode, sessionId }),
      });
      if (!response.ok) {
        console.warn('Failed to report minigame result:', response.statusText);
      }
    } catch (e) {
      console.warn('No se pudo enviar resultado del minijuego', e);
    }
  };

  const handleExitToMainboard = async (won = false) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    leaveRoom?.();
    await reportResult(won);
    // Always try to close the window (opened from main game)
    // Wait a bit to ensure result is sent
    setTimeout(() => {
      if (window.opener) {
        window.close();
      } else {
        // Fallback: try to close anyway
        window.close();
      }
    }, 500);
  };

  const handleExitConfirm = () => {
    setShowDialog({
      type: 'confirm',
      title: 'Salir del Desafío',
      message: '¿Quieres salir del desafío? Puedes volver cuando quieras.',
      confirmText: 'Salir',
      cancelText: 'Quedarme',
      onConfirm: () => {
        setShowDialog(null);
        handleExitToMainboard();
      },
      onCancel: () => setShowDialog(null),
    });
  };

  // Render loading state
  if (!connected && !error) {
    return (
      <div className="pixel-lobby">
        <div className="pixel-bg"></div>
        <Lobby
          sessionCode={sessionCode}
          myRole={myRole}
          playersConnected={state?.playersConnected || 0}
          mode={mode}
        />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="pixel-lobby">
        <div className="pixel-bg"></div>
        <div className="lobby-container">
          <h1 className="lobby-title">ERROR</h1>
          <p style={{ color: 'var(--pixel-red)', margin: '20px 0' }}>
            {error.message || 'Ha ocurrido un error'}
          </p>
          <button
            className="pixel-button large"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Render game based on phase
  if (!state) {
    return (
      <div className="pixel-lobby">
        <div className="pixel-bg"></div>
        <div className="lobby-container">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  const renderPhase = () => {
    const phase = state?.phase || 'lobby';

    switch (phase) {
      case 'lobby':
        return (
          <Lobby
            sessionCode={sessionCode}
            myRole={myRole}
            playersConnected={state.playersConnected}
            playerA={state.playerA}
            playerB={state.playerB}
            onClaimRole={claimRole}
            onReleaseRole={releaseRole}
            onToggleReady={(ready) => setReady(ready)}
            onStart={startCountdown}
            countdownMs={countdownMs}
            mode={mode}
            onExit={handleExitConfirm}
          />
        );

      case 'briefing':
        return (
          <Briefing
            countdownMs={countdownMs}
            onExit={handleExitConfirm}
          />
        );

      case 'active':
      case 'sync_confirm':
      case 'retry':
        return (
          <Level1
            state={state}
            myRole={myRole}
            sendMessage={sendMessage}
            onExitToMainboard={handleExitToMainboard}
          />
        );

      case 'success':
        const totalLevels = state?.totalLevels || 3;
        const isFinal = (state?.levelId || 1) >= totalLevels;
        return (
          <SuccessScreen
            message={state.resultMessage}
            onExit={isFinal ? () => handleExitToMainboard(true) : null}
          />
        );

      default:
        return (
          <div className="pixel-lobby">
            <div className="pixel-bg"></div>
            <div className="lobby-container">
              <h1 className="lobby-title">RECONEXIÓN</h1>
              <p style={{ color: 'var(--pixel-white)', marginBottom: '15px' }}>
                Estado desconocido. Intentando sincronizar...
              </p>
              <button
                className="pixel-button large"
                onClick={() => window.location.reload()}
              >
                Recargar
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="twokeys-container">
      <div className="pixel-bg"></div>
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
    </div>
  );
};

const TwoKeysGateLocal = ({ mode }) => {
  const game = useLocalGame();
  return <TwoKeysGateView mode={mode} {...game} />;
};

const TwoKeysGateMultiplayer = ({ mode, serverUrl }) => {
  const preferredRole = resolvePreferredRole();
  const game = useMultiplayerGame(preferredRole);
  return <TwoKeysGateView mode={mode} {...game} />;
};

const TwoKeysGate = () => {
  const [mode] = useState(resolveMode);

  return mode === 'multi'
    ? <TwoKeysGateMultiplayer mode={mode} />
    : <TwoKeysGateLocal mode={mode} />;
};

export default TwoKeysGate;
