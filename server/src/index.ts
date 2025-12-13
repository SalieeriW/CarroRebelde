import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";
import os from "os";

const port = Number(process.env.PORT || 2567);
const app = express();

// CORS configuration - allow all origins for local network access
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  server,
});

gameServer.define("game_room", GameRoom);

// Store room info in memory
interface RoomInfo {
  roomId: string;
  code: string;
  players: number;
}

const activeRooms = new Map<string, RoomInfo>();

// Endpoint para listar rooms disponibles
app.get("/rooms", (req, res) => {
  try {
    const roomList = Array.from(activeRooms.values())
      .filter(room => room.players < 4)
      .map(room => ({
        roomId: room.roomId,
        code: room.code,
        players: room.players,
        maxPlayers: 4,
      }));

    res.json(roomList);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.json([]);
  }
});

// Export activeRooms map for GameRoom to use
(global as any).activeRooms = activeRooms;

// Get local network IP address
function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIPAddress();

// Listen on all network interfaces (0.0.0.0)
// The HTTP server needs to listen, and Colyseus is already attached to it
server.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀 Server is running!`);
  console.log(`📡 Local network access:`);
  console.log(`   ws://${localIP}:${port}`);
  console.log(`   http://${localIP}:${port}`);
  console.log(`\n💻 Local access:`);
  console.log(`   ws://localhost:${port}`);
  console.log(`   http://localhost:${port}\n`);
});
