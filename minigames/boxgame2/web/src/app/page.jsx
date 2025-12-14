"use client";

import { useEffect, useMemo, useState } from "react";
import ChatBox from "../components/ChatBox";
import Minigame3Online from "../components/Minigame3Online";
import { createWsClient } from "../lib/wsClient";

export default function Page() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8081";
  const ws = useMemo(() => createWsClient(wsUrl), [wsUrl]);

  const [myRole, setMyRole] = useState(null);
  const [players, setPlayers] = useState({ player1: false, player2: false });
  const [gameData, setGameData] = useState({ m3: { inputs: {}, state: null } });
  const [isFull, setIsFull] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatFocused, setChatFocused] = useState(false);
  const [minigameParams, setMinigameParams] = useState({
    session: null,
    room: null,
    role: null, // "driver" | "navigator"
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setMinigameParams({
      session: p.get("session"),
      room: p.get("room"),
      role: p.get("role"),
    });
  }, []);

  useEffect(() => {
    ws.on("full", () => setIsFull(true));

    ws.on("init", (m) => {
      setMyRole(m.role);
      setPlayers(m.players || { player1: false, player2: false });
      if (m.gameData) setGameData(m.gameData);
    });

    ws.on("players", (m) =>
      setPlayers(m.players || { player1: false, player2: false })
    );
    ws.on("game_patch", (m) => m.gameData && setGameData(m.gameData));
    ws.on("reset", () => setGameData({ m3: { inputs: {}, state: null } }));
    ws.on("chat", (m) => {
      setChatMessages((prev) => {
        const next = [...prev, { from: m.from, text: m.text, ts: m.ts }];
        return next.slice(-100); // guarda últimos 100
      });
    });

    return () => ws.close();
  }, [ws]);

  if (isFull) {
    return (
      <div className="pixel-view">
        <div className="view-title">SERVER FULL</div>
        <p>Ya hay 2 jugadores.</p>
      </div>
    );
  }
  if (!myRole) {
    return (
      <div className="pixel-view">
        <div className="view-title">Conectando...</div>
      </div>
    );
  }

  const onSendMove = (move) => ws.send({ type: "input", input: move });
  const onSendState = (state) => ws.send({ type: "state", state });

  return (
    <div className="pixel-view">
      <Minigame3Online
        myRole={myRole}
        players={players}
        gameData={gameData}
        onSendMove={onSendMove}
        onSendState={myRole === "player1" ? onSendState : undefined}
        chatFocused={chatFocused}
        minigameParams={minigameParams}
      />

      <ChatBox
        myRole={myRole}
        wsSend={(obj) => ws.send(obj)}
        messages={chatMessages}
        setMessages={setChatMessages}
        onFocusChange={setChatFocused}
      />
    </div>
  );
}
