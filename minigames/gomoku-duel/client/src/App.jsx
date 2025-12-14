import React, { useState, useEffect, useRef, useCallback } from 'react';
import useMultiplayerGame from './hooks/useMultiplayerGame';
import Lobby from './components/Lobby';
import Briefing from './components/Briefing';
import GomokuGame from './components/GomokuGame';
import PixelDialog from './components/PixelDialog';

function App() {
  // Get role from URL parameters (from Blind Rally)
  const getRoleFromUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const role = urlParams.get('role');
      // Map Blind Rally roles to Gomoku roles if needed
      // For now, Gomoku uses A/B, but we can accept driver/navigator and map them
      if (role === 'driver' || role === 'A') return 'A';
      if (role === 'navigator' || role === 'B') return 'B';
      if (role === 'A' || role === 'B') return role;
    }
    return import.meta.env.VITE_DEFAULT_ROLE || null;
  };
  
  const [preferredRole, setPreferredRole] = useState(getRoleFromUrl());
  const [showDialog, setShowDialog] = useState(null);
  const exitingRef = useRef(false);
  const {
    state,
    error,
    connected,
    myRole,
    sessionCode,
    claimRole,
    releaseRole,
    setReady,
    setPlayerColor,
    startCountdown,
    makeMove,
    resetGame,
    sendChat,
    requestExit,
    cancelExit,
    leaveRoom,
  } = useMultiplayerGame(preferredRole);

  const [currentView, setCurrentView] = useState('lobby');

  useEffect(() => {
    if (!state) return;
    setCurrentView(state.phase);
  }, [state?.phase]);

  const handleClaimRole = (role) => {
    claimRole(role);
    setPreferredRole(role);
  };

  const handleReleaseRole = (role) => {
    releaseRole(role);
    setPreferredRole(null);
  };

  const handleToggleReady = (ready) => {
    setReady(ready);
  };

  const handleStart = () => {
    startCountdown();
  };

  const handleMove = (x, y) => {
    makeMove(x, y);
  };

  const handleReset = () => {
    resetGame();
  };

  const handleSendChat = (text) => {
    sendChat(text);
  };

  const handleColorChange = (color) => {
    setPlayerColor(color);
  };

  const reportResult = async (won = false) => {
    // Get roomCode and sessionId from URL parameters
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const roomCode = urlParams?.get('room') || urlParams?.get('roomCode');
    const sessionId = urlParams?.get('session') || urlParams?.get('sessionId');
    
    if (!roomCode || !sessionId) {
      console.warn('No roomCode or sessionId found in URL, cannot report result');
      return;
    }

    const host = typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'localhost';
    const url = `http://${host}:2567/minigame/result`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/App.jsx:73',message:'reportResult called',data:{won,url,roomCode,sessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
    // #endregion

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ won, roomCode, sessionId }),
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/App.jsx:82',message:'Minigame result response',data:{status:response.status,statusText:response.statusText,ok:response.ok,requestBody:{won}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      
      if (!response.ok) {
        console.warn('Failed to send minigame result:', response.status);
      }
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/App.jsx:90',message:'Minigame result error',data:{error:e.message,stack:e.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      console.warn('No se pudo enviar resultado del minijuego', e);
    }
  };

  const handleExitToMainboard = useCallback(async (won = false) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    leaveRoom();
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
  }, [leaveRoom, reportResult]);

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

  const exitRequests = state?.exitRequests || { A: false, B: false };
  const myExitRequested = myRole === 'A' ? exitRequests.A : exitRequests.B;
  const otherExitRequested = myRole === 'A' ? exitRequests.B : exitRequests.A;
  const bothWantExit = Boolean(myExitRequested && otherExitRequested);

  useEffect(() => {
    if (bothWantExit && (currentView === 'active' || currentView === 'finished')) {
      setShowDialog(null);
      handleExitToMainboard(false);
    }
  }, [bothWantExit, currentView, handleExitToMainboard]);

  useEffect(() => {
    if (otherExitRequested && !myExitRequested && !bothWantExit && (currentView === 'active' || currentView === 'finished') && !showDialog) {
      setShowDialog({
        type: 'confirm',
        title: 'Tu compañero quiere salir',
        message: '¿Abandonan la partida? Deben aceptar ambos.',
        confirmText: 'Aceptar',
        cancelText: 'Seguir jugando',
        onConfirm: () => {
          setShowDialog(null);
          requestExit();
        },
        onCancel: () => {
          setShowDialog(null);
          cancelExit();
        },
      });
    }
  }, [otherExitRequested, myExitRequested, bothWantExit, currentView, requestExit, cancelExit, showDialog]);

  const handleGameExit = (won = false) => {
    if (won) {
      handleExitToMainboard(won);
      return;
    }
    setShowDialog({
      type: 'confirm',
      title: 'Abandonar partida',
      message: 'Esta acción solicitará salir. Saldrán solo si ambos aceptan.',
      confirmText: 'Solicitar salida',
      cancelText: 'Cancelar',
      onConfirm: () => {
        setShowDialog(null);
        requestExit();
      },
      onCancel: () => setShowDialog(null),
    });
  };

  if (error) {
    return (
      <div className="error-container" style={{ 
        padding: '40px', 
        textAlign: 'center', 
        color: '#fff', 
        fontFamily: 'monospace',
        backgroundColor: '#1a1a1a',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>Error de Conexión</h1>
        <p style={{ marginBottom: '20px' }}>{error.message}</p>
        <button 
          className="pixel-button" 
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!connected || !state) {
    return (
      <div className="loading-container" style={{ padding: '20px', textAlign: 'center', color: '#fff', fontFamily: 'monospace' }}>
        <h1>Conectando...</h1>
        {error && <p style={{ color: '#ff6b6b' }}>Error: {error.message}</p>}
        {!error && <p>Esperando respuesta del servidor...</p>}
        <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
          Room: {sessionCode || 'N/A'} | Role: {preferredRole || 'N/A'}
        </p>
      </div>
    );
  }

  return (
    <div className="twokeys-container">
      <div className="pixel-bg"></div>
      {currentView === 'lobby' && (
        <div className="pixel-lobby">
          <Lobby
            sessionCode={sessionCode}
            myRole={myRole}
            playerA={state.playerA}
            playerB={state.playerB}
            onClaimRole={handleClaimRole}
            onReleaseRole={handleReleaseRole}
            onToggleReady={handleToggleReady}
            onStart={handleStart}
            onColorChange={handleColorChange}
            playerColor={state.gomoku?.playerColor}
            aiColor={state.gomoku?.aiColor}
            countdownMs={state.countdownMs}
            onExit={handleExitConfirm}
            defaultRole={preferredRole}
          />
        </div>
      )}

      {currentView === 'briefing' && (
        <Briefing countdownMs={state.countdownMs} onExit={handleExitConfirm} />
      )}

      {(currentView === 'active' || currentView === 'finished') && (
        <GomokuGame
          state={state}
          myRole={myRole}
          onMove={handleMove}
          onReset={handleReset}
          onSendChat={handleSendChat}
          onExit={handleGameExit}
        />
      )}

      {showDialog && (
        <PixelDialog
          type={showDialog.type}
          title={showDialog.title}
          message={showDialog.message}
          confirmText={showDialog.confirmText}
          cancelText={showDialog.cancelText}
          onConfirm={showDialog.onConfirm}
          onCancel={showDialog.onCancel}
        />
      )}
    </div>
  );
}

export default App;
