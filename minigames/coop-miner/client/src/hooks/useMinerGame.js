import { useEffect, useMemo, useRef, useState } from 'react';

const buildApi = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:7001`;
  }
  return 'http://localhost:7001';
};

const DEFAULT_ROOM = (import.meta.env.VITE_ROOM_CODE || 'ROOM1').toUpperCase();

const getRoomCodeFromURL = () => {
  if (typeof window === 'undefined') return DEFAULT_ROOM;
  const urlParams = new URLSearchParams(window.location.search);
  return (urlParams.get('room') || DEFAULT_ROOM).toUpperCase();
};

const getSessionIdFromURL = () => {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('session');
};

const getPreferredRoleFromURL = () => {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role');
  return role ? role.toUpperCase() : null;
};

const useMinerGame = () => {
  const apiBase = useMemo(buildApi, []);
  const clientIdRef = useRef(null);
  const pollRef = useRef(null);
  const roomCode = useMemo(getRoomCodeFromURL, []);
  const sessionId = useMemo(getSessionIdFromURL, []);
  const preferredRole = useMemo(getPreferredRoleFromURL, []);

  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [myRole, setMyRole] = useState(null);

  const clientId = useMemo(() => {
    // If we have a sessionId from URL, use it to create a unique clientId for this minigame session
    // This ensures each minigame session gets a fresh clientId
    if (sessionId) {
      const uniqueId = `${sessionId}_${Math.random().toString(36).slice(2, 9)}`;
      clientIdRef.current = uniqueId;
      // Don't store in localStorage when sessionId is present - we want unique IDs per session
      return uniqueId;
    }
    // Fallback to localStorage for standalone play
    const stored = typeof window !== 'undefined' ? localStorage.getItem('miner-client-id') : null;
    const id = stored || crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    if (typeof window !== 'undefined') localStorage.setItem('miner-client-id', id);
    clientIdRef.current = id;
    return id;
  }, [sessionId]);

  const fetchState = async () => {
    try {
      const res = await fetch(`${apiBase}/rooms/${roomCode}`);
      if (!res.ok) throw new Error(`Estado ${res.status}`);
      const data = await res.json();
      setState(data);
      setConnected(true);
      setError(null);
      if (data.playerA?.sessionId === clientId) setMyRole('A');
      else if (data.playerB?.sessionId === clientId) setMyRole('B');
      else setMyRole(null);
    } catch (e) {
      setError(e);
      setConnected(false);
    }
  };

  useEffect(() => {
    // Small delay before initial fetch to allow server-side reset to complete
    const initialDelay = setTimeout(() => {
      fetchState();
      pollRef.current = setInterval(fetchState, 1000);
    }, 200);
    
    return () => {
      clearTimeout(initialDelay);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const post = async (path, body = {}) => {
    const res = await fetch(`${apiBase}/rooms/${roomCode}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, clientId }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || `Error ${res.status}`);
    }
    const data = await res.json();
    setState(data);
    if (data.playerA?.sessionId === clientId) setMyRole('A');
    else if (data.playerB?.sessionId === clientId) setMyRole('B');
    else setMyRole(null);
    setConnected(true);
    setError(null);
    return data;
  };

  const reportResult = async (won = false) => {
    const host = (typeof window !== 'undefined' && window.location.hostname) || 'localhost';
    const url = `http://${host}:2567/minigame/result`;
    const payload = { won, roomCode };
    if (sessionId) payload.sessionId = sessionId;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log(`✅ [Coop-Miner] Result sent: won=${won}, roomCode=${roomCode}, sessionId=${sessionId || 'none'}`);
    } catch (e) {
      console.warn('Failed to send minigame result', e);
    }
  };

  const leaveRoom = () => {
    releaseRole().catch(() => {});
  };

  const claimRole = (role) => post('/claim', { role });
  const releaseRole = () => post('/release');
  const setReady = (ready = true) => post('/ready', { ready });
  const start = () => post('/start');
  const markTarget = (targetId) => post('/action/target', { targetId });
  const hook = (targetId) => post('/action/hook', { targetId });
  const sendChat = (text) => post('/action/chat', { text });
  const reset = () => post('/reset');
  const updateHookState = (hookState) => post('/action/hook-update', hookState);

  return {
    state,
    error,
    connected,
    myRole,
    roomCode,
    preferredRole,
    claimRole,
    releaseRole,
    setReady,
    start,
    markTarget,
    hook,
    sendChat,
    reset,
    updateHookState,
    reportResult,
    leaveRoom,
  };
};

export default useMinerGame;
