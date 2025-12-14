import { useState, useEffect, useRef } from 'react';
import * as Colyseus from 'colyseus.js';

const useColyseus = (serverUrl = 'ws://localhost:3001', roomName = 'two_keys') => {
  const [room, setRoom] = useState(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const sessionCodeRef = useRef(null);
  const clientRef = useRef(null);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new Colyseus.Client(serverUrl);
    }
  }, [serverUrl]);

  const createRoom = async (options = {}) => {
    try {
      const joinedRoom = await clientRef.current.create(roomName, {
        levelId: options.levelId || 1,
        ...options
      });

      setupRoom(joinedRoom);
      return joinedRoom;
    } catch (e) {
      console.error('Error creating room:', e);
      setError(e);
      throw e;
    }
  };

  const joinRoom = async (roomId, options = {}) => {
    try {
      const joinedRoom = await clientRef.current.joinById(roomId, options);
      setupRoom(joinedRoom);
      return joinedRoom;
    } catch (e) {
      console.error('Error joining room:', e);
      setError(e);
      throw e;
    }
  };

  const joinOrCreateRoom = async (options = {}) => {
    try {
      // Prefer joining an existing available room before creating a new one
      const rooms = await clientRef.current.getAvailableRooms(roomName);
      const target = rooms.find((r) => r.clients < r.maxClients);

      let joinedRoom;
      if (target) {
        joinedRoom = await joinRoom(target.roomId, options);
      } else {
        joinedRoom = await clientRef.current.joinOrCreate(roomName, {
          levelId: options.levelId || 1,
          ...options,
        });
      }
      setupRoom(joinedRoom);
      return joinedRoom;
    } catch (e) {
      console.error('Error joinOrCreate room:', e);
      setError(e);
      throw e;
    }
  };

  const joinByCode = async (code, options = {}) => {
    try {
      // Find room by session code
      const rooms = await clientRef.current.getAvailableRooms(roomName);
      const targetRoom = rooms.find(r => r.metadata?.sessionCode === code);

      if (!targetRoom) {
        throw new Error('Room not found with that code');
      }

      return await joinRoom(targetRoom.roomId, options);
    } catch (e) {
      console.error('Error joining by code:', e);
      setError(e);
      throw e;
    }
  };

  const setupRoom = (joinedRoom) => {
    setRoom(joinedRoom);
    setConnected(true);
    sessionIdRef.current = joinedRoom.sessionId;
    // set initial state immediately to avoid null renders
    if (joinedRoom.state) {
      setState(joinedRoom.state);
      thisMaybeSetRoleFromState(joinedRoom.state, joinedRoom.sessionId);
      if (joinedRoom.state.sessionCode && !sessionCodeRef.current) {
        sessionCodeRef.current = joinedRoom.state.sessionCode;
        setSessionCode(joinedRoom.state.sessionCode);
      }
    }

    // State change handler
    joinedRoom.onStateChange((newState) => {
      setState(newState);
      // ensure session code is populated even if role_assigned message was missed
      if (newState?.sessionCode && !sessionCodeRef.current) {
        sessionCodeRef.current = newState.sessionCode;
        setSessionCode(newState.sessionCode);
      }
      thisMaybeSetRoleFromState(newState, joinedRoom.sessionId);
    });

    // Message handlers
    joinedRoom.onMessage('role_assigned', (data) => {
      console.log('Role assigned:', data.role);
      setMyRole(data.role);
      if (data.sessionCode) {
        sessionCodeRef.current = data.sessionCode;
        setSessionCode(data.sessionCode);
      }
    });

    joinedRoom.onMessage('role_denied', (data) => {
      console.warn('Role denied:', data.role);
    });

    joinedRoom.onMessage('session_info', (data) => {
      if (data.sessionCode) {
        sessionCodeRef.current = data.sessionCode;
        setSessionCode(data.sessionCode);
      }
    });

    joinedRoom.onMessage('room_full', (data) => {
      setError(new Error(data.message));
    });

    // Optional info messages (avoid console errors if broadcast without handler)
    joinedRoom.onMessage('both_players_connected', () => {});

    // Error handler
    joinedRoom.onError((code, message) => {
      console.error('Room error:', code, message);
      setError({ code, message });
    });

    // Leave handler
    joinedRoom.onLeave((code) => {
      console.log('Left room with code:', code);
      setConnected(false);
      setRoom(null);
    });
  };

  const sendMessage = (type, data = {}) => {
    if (room) {
      room.send(type, data);
    }
  };

  const leaveRoom = () => {
    if (room) {
      room.leave();
      setRoom(null);
      setConnected(false);
      setMyRole(null);
      setSessionCode(null);
      sessionIdRef.current = null;
    }
  };

  const thisMaybeSetRoleFromState = (newState, currentSessionId) => {
    if (!newState || !currentSessionId) return;
    if (newState.playerA?.sessionId === currentSessionId) {
      setMyRole('A');
    } else if (newState.playerB?.sessionId === currentSessionId) {
      setMyRole('B');
    }
  };

  return {
    room,
    state,
    error,
    connected,
    myRole,
    sessionCode,
    createRoom,
    joinRoom,
    joinOrCreateRoom,
    joinByCode,
    sendMessage,
    leaveRoom
  };
};

export default useColyseus;
