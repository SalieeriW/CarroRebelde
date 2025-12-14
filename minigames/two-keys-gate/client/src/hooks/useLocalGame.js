import { useEffect, useMemo, useRef, useState } from 'react';
import levelData from '../../../shared/levelData.json';

const CHANNEL_NAME = 'twokeys-local';
const STATE_KEY = 'twokeys-local-state';
const HOST_KEY = 'twokeys-local-host';

const createInitialState = () => ({
  sessionCode: 'LOCAL',
  levelId: 1,
  phase: 'lobby', // lobby, briefing (countdown), active, sync_confirm, success, retry
  startAt: 0,
  countdownMs: 0,
  playerA: {
    sessionId: '',
    selectedAnswer: [],
    confirmedAt: 0,
    isReady: false,
    role: 'A',
  },
  playerB: {
    sessionId: '',
    selectedAnswer: [],
    confirmedAt: 0,
    isReady: false,
    role: 'B',
  },
  moderatorId: '',
  hintCount: 0,
  createdAt: Date.now(),
  currentHint: '',
  resultMessage: '',
  resultSuccess: false,
  chatMessages: [],
  playersConnected: 0,
  exitRequests: { A: false, B: false },
});

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

/**
 * useLocalGame
 * 本地双窗口模拟，不依赖服务器。
 * 打开两个标签页，手动占位 A/B，状态通过 BroadcastChannel 同步。
 */
const useLocalGame = () => {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const channelRef = useRef(null);
  const stateRef = useRef(null);
  const hostIdRef = useRef(null);
  const timeoutsRef = useRef([]);
  const countdownRef = useRef(null);
  const nextLevelRef = useRef(null);
  const joinRequestedRef = useRef(false);
  const clientId = useMemo(() => generateId(), []);

  // Helpers
  const clearTimers = () => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    if (nextLevelRef.current) {
      clearTimeout(nextLevelRef.current);
      nextLevelRef.current = null;
    }
  };

  const pushState = (nextState) => {
    stateRef.current = nextState;
    setState(nextState);
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(nextState));
    } catch (e) {
      console.warn('Persist state failed', e);
    }
    channelRef.current?.postMessage({ type: 'state', state: nextState, sender: clientId });
  };

  const ensureHost = () => {
    const storedHost = localStorage.getItem(HOST_KEY);
    if (!storedHost) {
      localStorage.setItem(HOST_KEY, clientId);
      hostIdRef.current = clientId;
    } else {
      hostIdRef.current = storedHost;
    }
  };

  const isHost = () => hostIdRef.current === clientId;
  const shouldHandleActions = () => {
    const storedHost = localStorage.getItem(HOST_KEY);
    // If no host, claim it
    if (!storedHost) {
      localStorage.setItem(HOST_KEY, clientId);
      hostIdRef.current = clientId;
    }
    return hostIdRef.current === clientId;
  };

  const resetConfirmations = (draft) => {
    draft.playerA.confirmedAt = 0;
    draft.playerB.confirmedAt = 0;
  };

  const cancelCountdown = (draft) => {
    draft.startAt = 0;
    draft.countdownMs = 0;
    if (draft.phase === 'briefing') {
      draft.phase = 'lobby';
    }
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    if (nextLevelRef.current) {
      clearTimeout(nextLevelRef.current);
      nextLevelRef.current = null;
    }
  };

  const recalcPlayersConnected = (draft) => {
    draft.playersConnected =
      (draft.playerA.sessionId ? 1 : 0) + (draft.playerB.sessionId ? 1 : 0);
  };

  const checkAnswer = () => {
    const current = stateRef.current;
    if (!current) return;
    const level = levelData.levels[current.levelId - 1];
    const correct = level.correctAnswer;
    const a = current.playerA.selectedAnswer || [];
    const b = current.playerB.selectedAnswer || [];

    // 玩家答案必须一致
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const draft = {
        ...current,
        phase: 'retry',
        resultSuccess: false,
        resultMessage: 'Parece que eligieron respuestas diferentes. Revisen juntos.',
      };
      resetConfirmations(draft);
      pushState(draft);
      const t = setTimeout(() => {
        const c = stateRef.current;
        if (c) pushState({ ...c, phase: 'active' });
      }, 3000);
      timeoutsRef.current.push(t);
      return;
    }

    // 答案正确
    if (JSON.stringify(a) === JSON.stringify(correct)) {
      const draft = {
        ...current,
        phase: 'success',
        resultSuccess: true,
        resultMessage: level.successMessage,
      };
      pushState(draft);
    } else {
      // 答案错误，提供提示
      const hintCount = current.hintCount + 1;
      let hint = level.hints.generic;
      if (hintCount === 2) hint = level.hints.specific;
      if (hintCount >= 3) hint = level.hints.stepByStep;

      const draft = {
        ...current,
        phase: 'retry',
        resultSuccess: false,
        hintCount,
        currentHint: hint,
        resultMessage: level.retryMessage,
      };
      resetConfirmations(draft);
      pushState(draft);
      const t = setTimeout(() => {
        const c = stateRef.current;
        if (c) pushState({ ...c, phase: 'active' });
      }, 3000);
      timeoutsRef.current.push(t);
    }
  };

  const handleAction = (action, payload, sender) => {
    const current = stateRef.current || createInitialState();
    let draft = { ...current };

    switch (action) {
      case 'join': {
        // No auto seat; just sync state
        recalcPlayersConnected(draft);
        pushState(draft);
        break;
      }
      case 'leave': {
        const leftRoles = [];
        if (draft.playerA.sessionId === sender) {
          draft.playerA = { ...createInitialState().playerA };
          leftRoles.push('A');
        }
        if (draft.playerB.sessionId === sender) {
          draft.playerB = { ...createInitialState().playerB };
          leftRoles.push('B');
        }
        draft.exitRequests = { A: false, B: false };
        if (leftRoles.length) {
          const label = leftRoles.length === 2 ? 'Los jugadores A y B' : `El jugador ${leftRoles[0]}`;
          draft.chatMessages = [
            ...(draft.chatMessages || []),
            { role: 'system', text: `${label} salió de la sala.`, timestamp: Date.now() },
          ].slice(-20);
        }
        recalcPlayersConnected(draft);
        cancelCountdown(draft);
        pushState(draft);
        break;
      }
      case 'claim_role': {
        const role = (payload.role || '').toUpperCase();
        if (role !== 'A' && role !== 'B') break;
        const target = role === 'A' ? draft.playerA : draft.playerB;
        const other = role === 'A' ? draft.playerB : draft.playerA;

        // Deny if seat taken by another client
        if (target.sessionId && target.sessionId !== sender) break;

        // Free other seat if owned by same client
        if (other.sessionId === sender) {
          Object.assign(other, { ...createInitialState()[role === 'A' ? 'playerB' : 'playerA'] });
        }

        Object.assign(target, { ...createInitialState()[role === 'A' ? 'playerA' : 'playerB'] });
        target.sessionId = sender;
        target.role = role;
        draft.exitRequests = { ...draft.exitRequests, [role]: false };
        recalcPlayersConnected(draft);
        cancelCountdown(draft);
        pushState(draft);
        break;
      }
      case 'release_role': {
        const role = (payload.role || '').toUpperCase();
        if (role === 'A' && draft.playerA.sessionId === sender) {
          draft.playerA = { ...createInitialState().playerA };
          draft.chatMessages = [
            ...(draft.chatMessages || []),
            { role: 'system', text: 'El jugador A salió de la sala.', timestamp: Date.now() },
          ].slice(-20);
          draft.exitRequests.A = false;
        }
        if (role === 'B' && draft.playerB.sessionId === sender) {
          draft.playerB = { ...createInitialState().playerB };
          draft.chatMessages = [
            ...(draft.chatMessages || []),
            { role: 'system', text: 'El jugador B salió de la sala.', timestamp: Date.now() },
          ].slice(-20);
          draft.exitRequests.B = false;
        }
        recalcPlayersConnected(draft);
        cancelCountdown(draft);
        pushState(draft);
        break;
      }
      case 'player_ready': {
        const role = payload.role;
        const target = role === 'A' ? draft.playerA : draft.playerB;
        if (target.sessionId !== sender) break;
        target.isReady = payload.ready === false ? false : true;
        if (!target.isReady) {
          cancelCountdown(draft);
        }
        pushState(draft);
        break;
      }
      case 'start_request': {
        const aReady = draft.playerA.sessionId && draft.playerA.isReady;
        const bReady = draft.playerB.sessionId && draft.playerB.isReady;
        if (!aReady || !bReady) break;
        draft.phase = 'briefing';
        draft.startAt = Date.now() + 5000;
        draft.countdownMs = 5000;
        pushState(draft);
        if (countdownRef.current) {
          clearTimeout(countdownRef.current);
        }
        countdownRef.current = setTimeout(() => {
          const c = stateRef.current;
          if (c) {
            pushState({
              ...c,
              phase: 'active',
              startAt: 0,
              countdownMs: 0,
            });
          }
          countdownRef.current = null;
        }, 5000);
        break;
      }
      case 'select_answer': {
        const role = payload.role;
        const target = role === 'A' ? draft.playerA : draft.playerB;
        target.selectedAnswer = [...(payload.answer || [])];
        pushState(draft);
        break;
      }
      case 'confirm_answer': {
        const role = payload.role;
        const target = role === 'A' ? draft.playerA : draft.playerB;
        target.confirmedAt = Date.now();
        pushState(draft);

        if (draft.playerA.confirmedAt && draft.playerB.confirmedAt) {
          const diff = Math.abs(draft.playerA.confirmedAt - draft.playerB.confirmedAt);
          if (diff < 10000) {
            // 同步成功，播放动画后校验
            draft.phase = 'sync_confirm';
            pushState(draft);
            const t = setTimeout(() => checkAnswer(), 1500);
            timeoutsRef.current.push(t);
          } else {
            draft.phase = 'active';
            resetConfirmations(draft);
            pushState(draft);
          }
        }
        break;
      }
      case 'chat_message': {
        const role = payload.role;
        const text = (payload.text || '').slice(0, 100);
        const nextMessages = [...(draft.chatMessages || []), {
          role,
          text,
          timestamp: Date.now(),
        }].slice(-20);
        draft.chatMessages = nextMessages;
        pushState(draft);
        break;
      }
      case 'request_exit': {
        const role = (payload.role || '').toUpperCase();
        if (role !== 'A' && role !== 'B') break;
        draft.exitRequests = { ...draft.exitRequests, [role]: true };
        draft.chatMessages = [
          ...(draft.chatMessages || []),
          { role: 'system', text: `El jugador ${role} quiere abandonar. Esperando confirmación del otro jugador.`, timestamp: Date.now() },
        ].slice(-20);
        pushState(draft);
        break;
      }
      case 'cancel_exit': {
        const role = (payload.role || '').toUpperCase();
        if (role !== 'A' && role !== 'B') break;
        draft.exitRequests = { ...draft.exitRequests, [role]: false };
        draft.chatMessages = [
          ...(draft.chatMessages || []),
          { role: 'system', text: `El jugador ${role} decidió seguir jugando.`, timestamp: Date.now() },
        ].slice(-20);
        pushState(draft);
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    ensureHost();

    // 初始化状态
    try {
      const cached = localStorage.getItem(STATE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.exitRequests = parsed.exitRequests || { A: false, B: false };
        stateRef.current = parsed;
        setState(parsed);
      } else {
        const init = createInitialState();
        stateRef.current = init;
        setState(init);
      }
    } catch {
      const init = createInitialState();
      stateRef.current = init;
      setState(init);
    }

    // 消息监听
    channelRef.current.onmessage = (evt) => {
      const data = evt.data;
      if (data.type === 'state') {
        if (data.sender === clientId) return; // ignore own echo
        stateRef.current = data.state;
        setState(data.state);
      }
      if (data.type === 'action') {
        if (data.clientId === clientId) return; // ignore own echo
        if (!shouldHandleActions()) return;
        handleAction(data.action, data.payload, data.clientId);
      }
    };

    // 通知加入
    channelRef.current.postMessage({ type: 'action', action: 'join', clientId });

    const handleUnload = () => {
      channelRef.current?.postMessage({ type: 'action', action: 'leave', clientId });
      if (isHost()) {
        localStorage.removeItem(HOST_KEY);
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      handleUnload();
      clearTimers();
      channelRef.current?.close();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derive role & connected
  useEffect(() => {
    if (!state) return;
    setConnected(true);
    if (state.playerA.sessionId === clientId) {
      setMyRole('A');
    } else if (state.playerB.sessionId === clientId) {
      setMyRole('B');
    } else {
      // 未分配则尝试分配（只发一次）
      if (!joinRequestedRef.current) {
        joinRequestedRef.current = true;
        sendAction('join', {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, clientId]);

  // Send action helper (handle locally if host, always broadcast)
  const sendAction = (action, payload = {}) => {
    try {
      if (shouldHandleActions()) {
        handleAction(action, payload, clientId);
      }
      channelRef.current?.postMessage({
        type: 'action',
        action,
        payload,
        clientId,
      });
    } catch (e) {
      setError(e);
    }
  };

  const sendMessage = (type, payload = {}) => {
    sendAction(type, { ...payload, role: myRole });
  };

  const leaveRoom = () => {
    channelRef.current?.postMessage({ type: 'action', action: 'leave', clientId });
    if (isHost()) {
      localStorage.removeItem(HOST_KEY);
    }
    setConnected(false);
    setMyRole(null);
  };

  return {
    room: null,
    state,
    error,
    connected,
    myRole,
    sessionCode: state?.sessionCode || 'LOCAL',
    claimRole: (role) => sendAction('claim_role', { role }),
    releaseRole: (role) => sendAction('release_role', { role }),
    setReady: (ready = true) => sendAction('player_ready', { ready }),
    startCountdown: () => sendAction('start_request'),
    sendMessage,
    leaveRoom,
  };
};

export default useLocalGame;
