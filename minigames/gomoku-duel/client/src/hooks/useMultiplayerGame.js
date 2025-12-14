import { useEffect, useMemo, useRef, useState } from 'react';

const getRoomCodeFromUrl = () => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || urlParams.get('roomCode');
  }
  return null;
};

const getSessionIdFromUrl = () => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session') || urlParams.get('sessionId');
    if (sessionId) {
      console.log(`🔍 [Gomoku] Found sessionId in URL: ${sessionId}`);
    } else {
      console.warn('⚠️ [Gomoku] No sessionId found in URL - will use localStorage fallback');
    }
    return sessionId;
  }
  return null;
};

const DEFAULT_ROOM = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ROOM_CODE) || 
                     getRoomCodeFromUrl() || 'GOMOKU1';

const buildApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    let url = import.meta.env.VITE_API_URL.replace(/\/$/, '');
    // Replace Docker service names with localhost for browser access
    url = url.replace(/http:\/\/gomoku-server/, 'http://localhost');
    url = url.replace(/https:\/\/gomoku-server/, 'https://localhost');
    return url;
  }
  // Always use localhost when accessed from browser (Docker service names won't work)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    // Use localhost for Docker service names or localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'gomoku-server' || hostname === 'blindrally-server') {
      return 'http://localhost:3002';
    }
    // For network access, use the actual hostname
    return `http://${hostname}:3002`;
  }
  return 'http://localhost:3002';
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const useMultiplayerGame = (preferredRole = null, roomCode = null) => {
  // Get roomCode from URL if not provided
  const urlRoomCode = getRoomCodeFromUrl();
  const resolvedRoomCode = roomCode || urlRoomCode || DEFAULT_ROOM;
  
  // Log for debugging
  console.log(`🔍 [Gomoku] Room code resolution:`, {
    provided: roomCode,
    fromUrl: urlRoomCode,
    default: DEFAULT_ROOM,
    resolved: resolvedRoomCode
  });
  
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const clientIdRef = useRef(null);
  const sessionIdRef = useRef(null);
  const pollRef = useRef(null);
  const apiBase = useMemo(buildApiUrl, []);

  // Get sessionId from URL - this changes for each new minigame session
  const currentSessionId = getSessionIdFromUrl();

  const clientId = useMemo(() => {
    // If sessionId changed, reset the clientId
    if (sessionIdRef.current !== currentSessionId) {
      clientIdRef.current = null;
      sessionIdRef.current = currentSessionId;
    }
    
    if (clientIdRef.current) return clientIdRef.current;
    
    // Generate a UNIQUE clientId for each minigame session
    // Use the sessionId from URL (minigameSessionId) to ensure uniqueness
    // This prevents reusing the same clientId across different minigame sessions
    let id;
    
    if (currentSessionId) {
      // Generate a unique clientId based on the sessionId
      // This ensures each minigame session gets a fresh clientId
      // DO NOT save to localStorage when using sessionId
      id = `${currentSessionId}_${generateId()}`;
      console.log(`🆕 [Gomoku] Generated new clientId for session ${currentSessionId}: ${id}`);
    } else {
      // Fallback: use stored ID or generate new one (for backward compatibility)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('gomoku-client-id') : null;
      id = stored || generateId();
      if (typeof window !== 'undefined') {
        localStorage.setItem('gomoku-client-id', id);
      }
    }
    
    clientIdRef.current = id;
    return id;
  }, [currentSessionId]);

  const deriveRole = (roomState) => {
    if (!roomState) return null;
    if (roomState.playerA?.sessionId === clientId) return 'A';
    if (roomState.playerB?.sessionId === clientId) return 'B';
    return null;
  };

  const fetchState = async () => {
    try {
      const url = `${apiBase}/rooms/${resolvedRoomCode}`;
      console.log(`🔄 [Gomoku] Fetching state from: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`State fetch failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      console.log(`✅ [Gomoku] State received:`, { phase: data.phase, playersConnected: data.playersConnected });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/useMultiplayerGame.js:54',message:'State updated from poll',data:{turn:data.gomoku?.turn,disabled:data.gomoku?.turn === 'ai' || data.gomoku?.winner !== null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setState(data);
      setConnected(true);
      setError(null);
      setMyRole(deriveRole(data));
    } catch (e) {
      console.error('❌ [Gomoku] State poll error:', e);
      setError(e);
      setConnected(false);
    }
  };

  useEffect(() => {
    // Small delay to ensure server reset completes before first fetch
    // This prevents getting stale state from previous minigame session
    const initialDelay = setTimeout(() => {
      fetchState();
      pollRef.current = setInterval(fetchState, 1000);
    }, 200); // 200ms delay to allow server reset to complete
    
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(initialDelay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, resolvedRoomCode]);

  const post = async (path, body = {}) => {
    try {
      const res = await fetch(`${apiBase}/rooms/${resolvedRoomCode}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, clientId }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Request failed ${res.status}`);
      }
      const data = await res.json();
      // #region agent log
      if (path === '/move' || path === '') {
        fetch('http://127.0.0.1:7242/ingest/f4742f3a-4307-4e14-a3d4-5fb2145a2fd7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/useMultiplayerGame.js:86',message:'State updated from POST',data:{path,turn:data.gomoku?.turn,disabled:data.gomoku?.turn === 'ai' || data.gomoku?.winner !== null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion
      setState(data);
      setMyRole(deriveRole(data));
      setConnected(true);
      setError(null);
      return data;
    } catch (e) {
      console.error(`POST ${path} error:`, e);
      setError(e);
      throw e;
    }
  };

  useEffect(() => {
    if (!preferredRole || !state || myRole) return;
    const seat = preferredRole.toUpperCase();
    const seatTaken =
      seat === 'A' ? state.playerA?.sessionId : seat === 'B' ? state.playerB?.sessionId : null;
    if (!seatTaken) {
      post('/claim', { role: seat }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredRole, state, myRole]);

  const claimRole = (role) => post('/claim', { role });
  const releaseRole = (role) => post('/release', { role });
  const setReady = (ready = true) => post('/ready', { ready });
  const setPlayerColor = (color) => post('/color', { color });
  const startCountdown = () => post('/start');
  const makeMove = (x, y) => post('/move', { x, y });
  const resetGame = () => post('/reset');
  const sendChat = (text) => post('/chat', { text });
  const requestExit = () => post('/exit-request');
  const cancelExit = () => post('/exit-cancel');

  const leaveRoom = () => {
    post('/release').catch(() => {});
    setConnected(false);
    setMyRole(null);
  };

  return {
    state,
    error,
    connected,
    myRole,
    sessionCode: state?.sessionCode || resolvedRoomCode,
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
  };
};

export default useMultiplayerGame;
