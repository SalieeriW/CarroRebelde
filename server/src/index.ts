import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
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

gameServer.listen(port);
console.log(`Listening on ws://localhost:${port}`);
