import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
      console.log(`🔍 Found sessionId in URL: ${sessionId}`);
    } else {
      console.warn('⚠️ No sessionId found in URL - will use localStorage fallback');
    }
    return sessionId;
  }
  return null;
};

const DEFAULT_ROOM = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ROOM_CODE) || 
                     getRoomCodeFromUrl() || 'ROOM1';

const buildApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    let url = import.meta.env.VITE_API_URL.replace(/\/$/, '');
    // Replace Docker service names with localhost for browser access
    url = url.replace(/http:\/\/twokeys-server/, 'http://localhost');
    url = url.replace(/https:\/\/twokeys-server/, 'https://localhost');
    return url;
  }
  // Always use localhost when accessed from browser (Docker service names won't work)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    // Use localhost for Docker service names or localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'twokeys-server' || hostname === 'blindrally-server') {
      return 'http://localhost:3001';
    }
    // For network access, use the actual hostname
    return `http://${hostname}:3001`;
  }
  return 'http://localhost:3001';
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const useMultiplayerGame = (preferredRole = null, roomCode = null) => {
  // Get roomCode from URL if not provided
  const resolvedRoomCode = roomCode || getRoomCodeFromUrl() || DEFAULT_ROOM;
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
      console.log(`🆕 Generated new clientId for session ${currentSessionId}: ${id}`);
    } else {
      // Fallback: use stored ID or generate new one (for backward compatibility)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('twokeys-client-id') : null;
      id = stored || generateId();
      if (typeof window !== 'undefined') {
        localStorage.setItem('twokeys-client-id', id);
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
      const res = await fetch(`${apiBase}/rooms/${resolvedRoomCode}`);
      if (!res.ok) throw new Error(`State fetch failed: ${res.status}`);
      const data = await res.json();
      setState(data);
      setConnected(true);
      setError(null);
      setMyRole(deriveRole(data));
    } catch (e) {
      console.error('State poll error:', e);
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

  // Auto-claim preferred role once if available
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

  const sendRelease = useCallback(
    async (payload = {}) => {
      const body = JSON.stringify({ ...payload, clientId });
      const url = `${apiBase}/rooms/${resolvedRoomCode}/release`;

      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
          return;
        }

        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      } catch (e) {
        console.warn('Release request failed', e);
      }
    },
    [apiBase, resolvedRoomCode, clientId]
  );

  const claimRole = (role) => post('/claim', { role });
  const releaseRole = (role) => post('/release', { role });
  const setReady = (ready = true) => post('/ready', { ready });
  const startCountdown = () => post('/start');

  const sendMessage = (type, payload = {}) => {
    switch (type) {
      case 'select_answer':
        return post('/select', { answer: payload.answer || [] });
      case 'confirm_answer':
        return post('/confirm');
      case 'chat_message':
        return post('/chat', { text: payload.text || '' });
      case 'player_ready':
        return setReady(true);
      case 'start_request':
        return startCountdown();
      case 'request_exit':
        return post('/exit-request');
      case 'cancel_exit':
        return post('/exit-cancel');
      default:
        return Promise.resolve();
    }
  };

  const leaveRoom = useCallback(() => {
    sendRelease();
    setConnected(false);
    setMyRole(null);
  }, [sendRelease]);

  useEffect(() => {
    const handleUnload = () => {
      sendRelease();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleUnload);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleUnload);
      }
    };
  }, [sendRelease]);

  return {
    room: null,
    state,
    error,
    connected,
    myRole,
    sessionCode: state?.sessionCode || resolvedRoomCode,
    claimRole,
    releaseRole,
    setReady,
    startCountdown,
    sendMessage,
    leaveRoom,
  };
};

export default useMultiplayerGame;
