"use client";

import { useEffect, useRef, useState } from "react";
import "../styles/game.css";

export default function ChatBox({
  myRole,
  wsSend,
  messages,
  setMessages,
  onFocusChange,
}) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // auto-scroll al final
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    wsSend({ type: "chat", text: t });
    setText("");
  };

  return (
    <div
      className="control-section"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        width: "min(400px, 90vw)",
        maxHeight: "300px",
        zIndex: 100,
      }}
    >
      <div className="section-title">Chat ({myRole})</div>

      <div
        ref={listRef}
        style={{
          height: "160px",
          overflowY: "auto",
          border: "3px solid var(--pixel-white)",
          boxShadow: "inset -2px -2px 0px var(--pixel-black), inset 2px 2px 0px var(--pixel-white)",
          padding: "12px",
          marginBottom: "10px",
          background: "var(--pixel-dark)",
          fontSize: "8px",
          lineHeight: "1.6",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ opacity: 0.7, color: "var(--pixel-white)" }}>No hay mensajes.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: "8px", color: "var(--pixel-white)" }}>
              <span style={{ opacity: 0.75, color: "var(--pixel-green)" }}>
                [{new Date(m.ts).toLocaleTimeString()}]{" "}
              </span>
              <b style={{ color: "var(--pixel-yellow)" }}>{m.from}:</b>{" "}
              <span style={{ color: "var(--pixel-white)" }}>{m.text}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={text}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Escribe y Enter..."
          className="pixel-input"
          style={{
            flex: 1,
            fontSize: "8px",
            padding: "8px 10px",
          }}
        />
        <button
          onClick={send}
          className="pixel-button small"
          style={{
            fontSize: "8px",
            padding: "8px 12px",
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
