import { WebSocketServer } from "ws";
import http from "http";
import express from "express";

const PORT = process.env.PORT || 8080;
const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let p1 = null;
let p2 = null;

// Inputs del puzzle: último movimiento pedido por cada jugador
let inputs = {
  player1: null, // { dx, dy, seq }
  player2: null, // { dx, dy, seq }
};

// Estado autoritativo (lo manda player1)
let gameState = null;

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(msg) {
  send(p1, msg);
  send(p2, msg);
}

function assignRole(ws) {
  if (!p1) {
    p1 = ws;
    return "player1";
  }
  if (!p2) {
    p2 = ws;
    return "player2";
  }
  return null;
}

function resetAll() {
  inputs.player1 = null;
  inputs.player2 = null;
  gameState = null;
}

// HTTP endpoint for reset (called by Blind Rally server)
app.post("/rooms/:code/reset", (req, res) => {
  const { code } = req.params;
  console.log(`🔄 Reset boxgame2 room: ${code}`);
  resetAll();
  broadcast({ type: "reset" });
  res.json({ success: true, message: "Room reset" });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "boxgame2", time: Date.now() });
});

server.listen(PORT, () => {
  console.log(`[boxgame2] Server listening on :${PORT}`);
});

wss.on("connection", (ws) => {
  const role = assignRole(ws);

  if (!role) {
    send(ws, { type: "full" });
    ws.close();
    return;
  }

  send(ws, {
    type: "init",
    role,
    players: { player1: !!p1, player2: !!p2 },
    gameData: { m3: { inputs, state: gameState } },
  });

  broadcast({ type: "players", players: { player1: !!p1, player2: !!p2 } });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
      // chat: cualquier jugador puede mandar texto
      if (msg.type === "chat" && typeof msg.text === "string") {
        const text = msg.text.trim().slice(0, 240);
        if (!text) return;

        broadcast({
          type: "chat",
          from: role, // "player1" | "player2"
          text,
          ts: Date.now(),
        });
        return;
      }
    } catch {
      return;
    }

    // Player1/2 -> manda "move"
    if (msg.type === "input" && (role === "player1" || role === "player2")) {
      const m = msg.input;
      // esperamos {dx, dy, seq}
      if (!m || typeof m.dx !== "number" || typeof m.dy !== "number") return;

      inputs[role] = { dx: m.dx, dy: m.dy, seq: Number(m.seq || 0) };
      broadcast({
        type: "game_patch",
        gameData: { m3: { inputs, state: gameState } },
      });
      return;
    }

    // SOLO host publica estado completo
    if (msg.type === "state" && role === "player1") {
      gameState = msg.state ?? null;
      broadcast({
        type: "game_patch",
        gameData: { m3: { inputs, state: gameState } },
      });
      return;
    }

    if (msg.type === "reset") {
      resetAll();
      broadcast({ type: "reset" });
    }
  });

  ws.on("close", () => {
    if (ws === p1) p1 = null;
    if (ws === p2) p2 = null;

    resetAll();
    broadcast({ type: "reset" });
    broadcast({ type: "players", players: { player1: !!p1, player2: !!p2 } });
  });
});
