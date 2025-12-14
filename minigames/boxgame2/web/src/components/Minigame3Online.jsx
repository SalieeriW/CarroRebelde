"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/game.css";
import { sendMinigameResult } from "../lib/blindRallyMinigameApi";

const DEFAULT_TILE_SIZE = 40;
const GRID_WIDTH = 11;
const GRID_HEIGHT = 11;

const EMPTY = 0;
const WALL = 1;

const initialGrid = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const initialBoxes = [
  { id: "b1", x: 3, y: 2, type: "normal" },
  { id: "b2", x: 5, y: 4, type: "player1" },
  { id: "b3", x: 7, y: 6, type: "player2" },
];

const initialTargets = [
  { x: 8, y: 2 },
  { x: 8, y: 4 },
  { x: 8, y: 6 },
];

const initialPlayer1 = { x: 1, y: 1 };
const initialPlayer2 = { x: 1, y: 8 };

function inBounds(x, y) {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

function isFreeCellForTarget(grid, x, y) {
  return grid[y][x] === EMPTY;
}

function randomTargets(grid, count, forbiddenSet) {
  const candidates = [];

  for (let y = 1; y < GRID_HEIGHT - 1; y++) {
    for (let x = 1; x < GRID_WIDTH - 1; x++) {
      if (!isFreeCellForTarget(grid, x, y)) continue;
      const k = `${x},${y}`;
      if (forbiddenSet.has(k)) continue;
      candidates.push({ x, y });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
}

export default function Minigame3Online({
  myRole,
  players,
  gameData,
  onSendMove,
  onSendState,
  chatFocused,
  minigameParams,
}) {
  const canvasRef = useRef(null);
  const isHost = myRole === "player1";

  const [tileSize, setTileSize] = useState(DEFAULT_TILE_SIZE);

  // Estado local
  const [boxes, setBoxes] = useState(initialBoxes);
  const [player1, setPlayer1] = useState(initialPlayer1);
  const [player2, setPlayer2] = useState(initialPlayer2);
  const [gameWon, setGameWon] = useState(false);

  // Targets: se generan aleatoriamente SOLO 1 vez (host)
  const [targets, setTargets] = useState(initialTargets);
  const targetsInitializedRef = useRef(false);

  // Para host: recordar último seq procesado de cada jugador
  const lastSeqRef = useRef({ player1: 0, player2: 0 });

  const resultSentRef = useRef(false);

  const blindRallyUrl =
    process.env.NEXT_PUBLIC_BLINDRALLY_SERVER_URL || "http://localhost:2567";

  const targetSet = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => s.add(`${t.x},${t.y}`));
    return s;
  }, [targets]);

  // Responsive tile size
  useEffect(() => {
    const updateSize = () => {
      const newTileSize = Math.floor(window.innerWidth / GRID_WIDTH);
      setTileSize(Math.max(newTileSize, 20));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    // solo cuando termina (ganan o pierden)
    // en tu juego ahora solo hay win; si luego añades lose, lo metes igual
    if (!gameWon) return;

    const roomCode = minigameParams?.room;
    const roleParam = minigameParams?.role; // "driver" o "navigator"

    if (!roomCode) return;

    // IMPORTANTE: Solo una llamada para toda la sala
    // Elige un único "emisor": driver (player1) envía el resultado
    // Map Blind Rally roles: driver -> player1, navigator -> player2
    const mappedRole = roleParam === "driver" ? "player1" : roleParam === "navigator" ? "player2" : null;
    const iShouldSend =
      (mappedRole === "player1" || (!roleParam && myRole === "player1"));

    if (!iShouldSend) return;
    if (resultSentRef.current) return;
    resultSentRef.current = true;

    (async () => {
      try {
        await sendMinigameResult({
          serverUrl: blindRallyUrl,
          roomCode: minigameParams.room,
          won: true,
          sessionId: minigameParams.session,
        });

        // Close window after a delay to ensure result is sent
        setTimeout(() => {
          window.close();
        }, 500);
      } catch (e) {
        console.error("Error enviando resultado minijuego:", e);
        // Si quieres reintentar, comenta el guard:
        // resultSentRef.current = false;
      }
    })();
  }, [gameWon, minigameParams, myRole, blindRallyUrl]);

  // CLIENT: aplica state remoto (incluye targets)
  useEffect(() => {
    const st = gameData?.m3?.state;
    if (!st) return;
    if (isHost) return;

    if (st.targets) setTargets(st.targets);
    setBoxes(st.boxes);
    setPlayer1(st.player1);
    setPlayer2(st.player2);
    setGameWon(!!st.gameWon);
  }, [gameData, isHost]);

  // HOST: inicializa targets SOLO 1 vez al montar (si no existen ya en state)
  useEffect(() => {
    if (!isHost) return;
    if (targetsInitializedRef.current) return;

    const st = gameData?.m3?.state;

    // Si el server ya tiene targets (reconexión), úsalo.
    if (st?.targets?.length) {
      targetsInitializedRef.current = true;
      setTargets(st.targets);
      // también sincroniza la base por si el host acaba de entrar
      onSendState?.({
        targets: st.targets,
        boxes: st.boxes ?? initialBoxes,
        player1: st.player1 ?? initialPlayer1,
        player2: st.player2 ?? initialPlayer2,
        gameWon: !!st.gameWon,
      });
      return;
    }

    // Si no hay targets aún, genera UNA vez
    const forbidden = new Set([
      `${initialPlayer1.x},${initialPlayer1.y}`,
      `${initialPlayer2.x},${initialPlayer2.y}`,
      ...initialBoxes.map((b) => `${b.x},${b.y}`),
    ]);

    const newTargets = randomTargets(initialGrid, 3, forbidden);
    const finalTargets = newTargets.length === 3 ? newTargets : initialTargets;

    targetsInitializedRef.current = true;
    setTargets(finalTargets);

    // Publica state inicial con targets (y posiciones base)
    onSendState?.({
      targets: finalTargets,
      boxes: initialBoxes,
      player1: initialPlayer1,
      player2: initialPlayer2,
      gameWon: false,
    });
  }, [isHost, gameData, onSendState]);

  const checkWin = useCallback(
    (nextBoxes) =>
      nextBoxes.length > 0 &&
      nextBoxes.every((b) => targetSet.has(`${b.x},${b.y}`)),
    [targetSet]
  );

  const boxAt = useCallback((arrBoxes, x, y) => {
    return arrBoxes.findIndex((b) => b.x === x && b.y === y);
  }, []);

  const applyMove = useCallback(
    (role, dx, dy, cur) => {
      const grid = initialGrid;

      const me = role === "player1" ? cur.player1 : cur.player2;
      const other = role === "player1" ? cur.player2 : cur.player1;

      const newX = me.x + dx;
      const newY = me.y + dy;

      if (!inBounds(newX, newY)) return cur;
      if (grid[newY][newX] === WALL) return cur;

      const idx = boxAt(cur.boxes, newX, newY);
      let nextBoxes = cur.boxes;

      if (idx !== -1) {
        const box = cur.boxes[idx];

        if (
          (box.type === "player1" && role !== "player1") ||
          (box.type === "player2" && role !== "player2")
        ) {
          return cur;
        }

        const boxNewX = newX + dx;
        const boxNewY = newY + dy;

        if (!inBounds(boxNewX, boxNewY)) return cur;
        if (grid[boxNewY][boxNewX] === WALL) return cur;
        if (boxAt(cur.boxes, boxNewX, boxNewY) !== -1) return cur;
        if (other.x === boxNewX && other.y === boxNewY) return cur;

        nextBoxes = [...cur.boxes];
        nextBoxes[idx] = { ...nextBoxes[idx], x: boxNewX, y: boxNewY };
      }

      return {
        boxes: nextBoxes,
        player1: role === "player1" ? { x: newX, y: newY } : cur.player1,
        player2: role === "player2" ? { x: newX, y: newY } : cur.player2,
      };
    },
    [boxAt]
  );

  // REINICIAR: SOLO resetea cajas + jugadores (NO toca targets)
  const restart = useCallback(() => {
    if (!isHost) return;

    lastSeqRef.current = { player1: 0, player2: 0 };
    setBoxes(initialBoxes);
    setPlayer1(initialPlayer1);
    setPlayer2(initialPlayer2);
    setGameWon(false);

    onSendState?.({
      targets, // <-- se mantienen
      boxes: initialBoxes,
      player1: initialPlayer1,
      player2: initialPlayer2,
      gameWon: false,
    });
  }, [isHost, onSendState, targets]);

  // Controles: cada dispositivo controla SOLO su jugador
  const seqRef = useRef(0);
  useEffect(() => {
    const onKeyDown = (e) => {
      if (chatFocused) return;

      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (k === "r") {
        e.preventDefault();
        if (isHost) restart();
        return;
      }
      if (gameWon) return;

      let dx = 0,
        dy = 0;

      if (myRole === "player1") {
        if (k === "w") dy = -1;
        else if (k === "s") dy = 1;
        else if (k === "a") dx = -1;
        else if (k === "d") dx = 1;
        else return;
      } else {
        if (k === "ArrowUp") dy = -1;
        else if (k === "ArrowDown") dy = 1;
        else if (k === "ArrowLeft") dx = -1;
        else if (k === "ArrowRight") dx = 1;
        else return;
      }

      e.preventDefault();
      seqRef.current += 1;
      onSendMove?.({ dx, dy, seq: seqRef.current });
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatFocused, myRole, isHost, gameWon, onSendMove, restart]);

  // HOST: procesa inputs y publica state (incluye targets SIEMPRE)
  useEffect(() => {
    if (!isHost) return;

    const inp = gameData?.m3?.inputs || {};
    const cur = { boxes, player1, player2 };

    let next = cur;
    let changed = false;

    for (const role of ["player1", "player2"]) {
      const m = inp[role];
      if (!m) continue;

      const seq = Number(m.seq || 0);
      if (seq <= (lastSeqRef.current[role] || 0)) continue;

      lastSeqRef.current[role] = seq;

      const after = applyMove(role, m.dx, m.dy, next);
      if (after !== next) {
        next = after;
        changed = true;
      }
    }

    if (!changed) return;

    const wonNow = checkWin(next.boxes);

    setBoxes(next.boxes);
    setPlayer1(next.player1);
    setPlayer2(next.player2);
    setGameWon(wonNow);

    onSendState?.({
      targets, // <-- CLAVE: siempre mandar targets
      boxes: next.boxes,
      player1: next.player1,
      player2: next.player2,
      gameWon: wonNow,
    });
  }, [
    isHost,
    gameData,
    boxes,
    player1,
    player2,
    targets,
    applyMove,
    checkWin,
    onSendState,
  ]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    canvas.width = GRID_WIDTH * tileSize;
    canvas.height = GRID_HEIGHT * tileSize;

    // Pixel art background - dark theme
    ctx.fillStyle = "#0f0f1e"; // --pixel-dark
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid - pixel art style
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const px = x * tileSize;
        const py = y * tileSize;

        if (initialGrid[y][x] === WALL) {
          // Pixel art brown walls
          ctx.fillStyle = "#654321"; // Dark brown
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.strokeStyle = "#8B4513"; // Lighter brown border
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, tileSize, tileSize);
          // Pixel art detail line
          ctx.strokeStyle = "#A0522D";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py + tileSize / 2);
          ctx.lineTo(px + tileSize, py + tileSize / 2);
          ctx.stroke();
        } else {
          // Pixel art floor - dark gray
          ctx.fillStyle = "#1a1a2e"; // --pixel-bg
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.strokeStyle = "#16213e"; // --pixel-light border
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, tileSize, tileSize);
        }
      }
    }

    // targets - pixel art yellow
    targets.forEach((t) => {
      const px = t.x * tileSize;
      const py = t.y * tileSize;
      ctx.fillStyle = "#f9d71c"; // --pixel-yellow
      ctx.fillRect(px + 5, py + 5, tileSize - 10, tileSize - 10);
      ctx.strokeStyle = "#ff0040"; // --pixel-red border for contrast
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 5, py + 5, tileSize - 10, tileSize - 10);
    });

    // boxes - pixel art colors
    boxes.forEach((box) => {
      const px = box.x * tileSize;
      const py = box.y * tileSize;
      const isOnTarget = targetSet.has(`${box.x},${box.y}`);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(px + 3, py + 3, tileSize - 6, tileSize - 6);

      let boxColor = "#000000";
      if (box.type === "player1") boxColor = "#ff0040"; // --pixel-red
      else if (box.type === "player2") boxColor = "#00d9ff"; // --pixel-blue

      ctx.fillStyle = isOnTarget ? "#00ff41" : boxColor; // --pixel-green when on target
      ctx.fillRect(px + 5, py + 5, tileSize - 10, tileSize - 10);

      ctx.strokeStyle = "#ffffff"; // --pixel-white border
      if (box.type === "player1") ctx.strokeStyle = "#ff0040";
      else if (box.type === "player2") ctx.strokeStyle = "#00d9ff";

      ctx.lineWidth = 2;
      ctx.strokeRect(px + 5, py + 5, tileSize - 10, tileSize - 10);

      // Pixel art X pattern
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 10, py + 10);
      ctx.lineTo(px + tileSize - 10, py + tileSize - 10);
      ctx.moveTo(px + tileSize - 10, py + 10);
      ctx.lineTo(px + 10, py + tileSize - 10);
      ctx.stroke();
    });

    // players - pixel art style
    function drawPlayer(p, fill, stroke) {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.arc(
        p.x * tileSize + tileSize / 2 + 2,
        p.y * tileSize + tileSize / 2 + 2,
        (tileSize - 20) / 2,
        0,
        2 * Math.PI
      );
      ctx.fill();

      // Player circle
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(
        p.x * tileSize + tileSize / 2,
        p.y * tileSize + tileSize / 2,
        (tileSize - 20) / 2,
        0,
        2 * Math.PI
      );
      ctx.fill();

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Pixel art player colors
    drawPlayer(player1, "#ff0040", "#ffffff"); // Red player with white border
    drawPlayer(player2, "#00d9ff", "#ffffff"); // Blue player with white border

    if (gameWon) {
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);
      ctx.fillStyle = "#f9d71c"; // --pixel-yellow
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("¡GANASTE!", canvas.width / 2, canvas.height / 2);
    }
  }, [boxes, targets, player1, player2, gameWon, targetSet, tileSize]);

  return (
    <div className="pixel-view">
      <div className="pixel-bg"></div>
      <div className="view-title">MINIGAME 3 - Puzzle Cooperativo (Online)</div>

      <div className="driver-container">
        <canvas 
          ref={canvasRef} 
          className="driver-canvas"
          style={{
            imageRendering: "pixelated",
            imageRendering: "-moz-crisp-edges",
            imageRendering: "crisp-edges"
          }}
        />
        <div className="game-instructions">
          <p>
            Tu rol: <b>{myRole}</b> | P1:{players.player1 ? "ON" : "OFF"} P2:
            {players.player2 ? "ON" : "OFF"}
          </p>
          <p>Jugador 1: WASD | Jugador 2: Flechas</p>
          <p>Cajas negras: ambos. Rojas: solo J1. Azules: solo J2.</p>

          <button
            onClick={restart}
            disabled={!isHost}
            className="restart-button"
            style={{
              padding: "10px 20px",
              backgroundColor: !isHost ? "#444" : "var(--pixel-red)",
              color: "var(--pixel-white)",
              border: "3px solid var(--pixel-white)",
              fontFamily: "'Press Start 2P', cursive",
              fontSize: "10px",
              cursor: !isHost ? "not-allowed" : "pointer",
              marginTop: "10px",
              opacity: !isHost ? 0.6 : 1,
            }}
          >
            Reiniciar (R) {isHost ? "" : "(solo host)"}
          </button>

          {gameWon && (
            <p>¡Felicidades! Han completado el puzzle cooperativo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
