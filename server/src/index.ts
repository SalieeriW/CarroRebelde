import http from "http";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";
import os from "os";
import { initDatabase, getUserByUsername, getUserById, createUser, usernameExists } from "./database";
import { request } from "http";

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
  monitorId?: string; // ID del monitor que creó la sala
  assignedPlayers: string[]; // IDs de jugadores asignados
}

const activeRooms = new Map<string, RoomInfo>();

// ========== AUTHENTICATION SYSTEM ==========

const MONITOR_SECRET_CODE = "BITS2025";

// Users are now stored in PostgreSQL database (see database.ts)
// Token to user ID mapping still in memory (tokens are ephemeral)

// Waiting players queue (players waiting to be assigned by a monitor)
interface WaitingPlayer {
  oduderId: string;
  username: string;
  joinedAt: Date;
}

const waitingPlayers = new Map<string, WaitingPlayer>();

// Generate simple token (in production, use JWT)
const generateToken = (userId: string): string => {
  return `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Token to user mapping
const tokens = new Map<string, string>(); // token -> oduderId

// Minigame sessions storage
interface MinigameSession {
  sessionId: string;
  roomCode: string;
  startTime: number;
  result: "pending" | "won" | "lost";
}

const minigameSessions = new Map<string, MinigameSession>();

// Store room instances by roomCode for minigame callbacks
const roomsByCode = new Map<string, any>();

// Export for global access
(global as any).minigameSessions = minigameSessions;
(global as any).roomsByCode = roomsByCode;

// Endpoint para listar rooms disponibles
app.get("/rooms", (req, res) => {
  try {
    const roomList = Array.from(activeRooms.values())
      .filter(room => room.players < 2)
      .map(room => ({
        roomId: room.roomId,
        code: room.code,
        players: room.players,
        maxPlayers: 2,
      }));

    res.json(roomList);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.json([]);
  }
});

// Export activeRooms map for GameRoom to use
(global as any).activeRooms = activeRooms;

// ========== AUTH ENDPOINTS ==========

// Register new user
app.post("/auth/register", (req, res) => {
  try {
    const { username, password, monitorCode } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be 3-20 characters" });
    }
    
    // Check if username already exists in database
    if (usernameExists(username)) {
      return res.status(400).json({ error: "Username already exists" });
    }
    
    // Determine role based on monitor code
    const role = monitorCode === MONITOR_SECRET_CODE ? "monitor" : "player";
    
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save user to database
    const user = createUser({
      id: userId,
      username,
      password, // In production, hash this!
      role
    });
    
    // Generate token
    const token = generateToken(userId);
    tokens.set(token, userId);
    
    console.log(`👤 New ${role} registered: ${username} (saved to SQLite)`);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/auth/login", (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    // Find user in database
    const foundUser = getUserByUsername(username);
    
    if (!foundUser || foundUser.password !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    // Generate token
    const token = generateToken(foundUser.id);
    tokens.set(token, foundUser.id);
    
    console.log(`🔑 User logged in: ${username} (${foundUser.role})`);
    
    res.json({
      success: true,
      token,
      user: {
        id: foundUser.id,
        username: foundUser.username,
        role: foundUser.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Verify token middleware
const verifyToken = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: "Invalid or missing token" });
  }
  
  const userId = tokens.get(token)!;
  
  // Get user from database
  const user = getUserById(userId);
  
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  req.user = user;
  next();
};

// Get current user
app.get("/auth/me", verifyToken, (req: any, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

// ========== PLAYER QUEUE ENDPOINTS ==========

// Player joins waiting queue
app.post("/queue/join", verifyToken, (req: any, res) => {
  if (req.user.role !== "player") {
    return res.status(403).json({ error: "Only players can join the queue" });
  }
  
  waitingPlayers.set(req.user.id, {
    oduderId: req.user.id,
    username: req.user.username,
    joinedAt: new Date()
  });
  
  console.log(`📋 Player joined queue: ${req.user.username}`);
  
  res.json({ success: true, message: "Added to waiting queue" });
});

// Player leaves waiting queue
app.post("/queue/leave", verifyToken, (req: any, res) => {
  waitingPlayers.delete(req.user.id);
  console.log(`📋 Player left queue: ${req.user.username}`);
  res.json({ success: true });
});

// Get waiting players (for monitors)
app.get("/queue/players", verifyToken, (req: any, res) => {
  if (req.user.role !== "monitor") {
    return res.status(403).json({ error: "Only monitors can view the queue" });
  }
  
  const players = Array.from(waitingPlayers.values()).map(p => ({
    oduderId: p.oduderId,
    username: p.username,
    waitingTime: Date.now() - p.joinedAt.getTime()
  }));
  
  res.json({ players });
});

// Get room ID by room code (for spectating)
app.get("/room/by-code/:code", (req, res) => {
  const { code } = req.params;
  
  for (const [roomId, roomInfo] of activeRooms.entries()) {
    if (roomInfo.code === code) {
      return res.json({ roomId, code: roomInfo.code });
    }
  }
  
  res.status(404).json({ error: "Room not found" });
});

// ========== MONITOR ENDPOINTS ==========

// Create a room and assign players (monitor only) - combined into one action
app.post("/monitor/create-room", verifyToken, async (req: any, res) => {
  if (req.user.role !== "monitor") {
    return res.status(403).json({ error: "Only monitors can create rooms" });
  }
  
  try {
    // Create a Colyseus room using matchMaker
    const room = await matchMaker.createRoom("game_room", {});
    
    console.log(`🎮 Monitor ${req.user.username} created room: ${room.roomId}`);
    
    // Wait a bit for room to initialize, then get the room code
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the room code from the room state if available
    const roomInstance = matchMaker.getRoomById(room.roomId);
    if (!roomInstance) {
      throw new Error("Room instance not found after creation");
    }
    
    const roomCode = (roomInstance as any)?.state?.roomCode || 
                    (roomInstance as any)?.roomCode || 
                    room.roomId.substring(0, 6).toUpperCase();
    
    console.log(`✅ Room created successfully: ${room.roomId}, code: ${roomCode}`);
    
    res.json({ 
      success: true, 
      roomId: room.roomId,
      roomCode,
      message: "Room created. Assign players to this room."
    });
  } catch (error: any) {
    console.error("Error creating room:", error);
    res.status(500).json({ 
      error: "Failed to create room",
      details: error?.message || String(error)
    });
  }
});

// Assign players to an existing room (monitor only)
app.post("/monitor/assign-players", verifyToken, async (req: any, res) => {
  if (req.user.role !== "monitor") {
    return res.status(403).json({ error: "Only monitors can assign players" });
  }
  
  const { playerIds, roomId } = req.body;
  
  if (!playerIds || !Array.isArray(playerIds) || playerIds.length !== 2) {
    return res.status(400).json({ error: "Must assign exactly 2 players" });
  }
  
  if (!roomId) {
    return res.status(400).json({ error: "roomId is required" });
  }
  
  // Verify that the room still exists before assigning players
  try {
    const roomInstance = matchMaker.getRoomById(roomId);
    if (!roomInstance) {
      console.warn(`⚠️ Monitor ${req.user.username} tried to assign players to non-existent room: ${roomId}`);
      return res.status(404).json({ 
        error: "Room not found. Please create a new room first.",
        roomId 
      });
    }
    
    // Also check if room is in activeRooms
    const roomInfo = activeRooms.get(roomId);
    if (!roomInfo) {
      console.warn(`⚠️ Room ${roomId} exists but not in activeRooms - this might be a stale room`);
      // Don't fail here, but log a warning
    }
  } catch (error: any) {
    console.error(`❌ Error verifying room ${roomId}:`, error);
    return res.status(500).json({ 
      error: "Failed to verify room existence",
      details: error?.message || String(error)
    });
  }
  
  // Remove players from waiting queue
  for (const oduderId of playerIds) {
    waitingPlayers.delete(oduderId);
  }
  
  // Store assignment info with the actual roomId
  (global as any).pendingAssignments = (global as any).pendingAssignments || new Map();
  (global as any).pendingAssignments.set(roomId, {
    playerIds,
    roomId,
    monitorId: req.user.id,
    createdAt: Date.now()
  });
  
  console.log(`🎮 Monitor ${req.user.username} assigned players to room ${roomId}`);
  
  res.json({ 
    success: true, 
    roomId,
    assignedPlayers: playerIds
  });
});

// Get all active rooms (monitor only)
app.get("/monitor/rooms", verifyToken, (req: any, res) => {
  if (req.user.role !== "monitor") {
    return res.status(403).json({ error: "Only monitors can view all rooms" });
  }
  
  const rooms = Array.from(activeRooms.values()).map(room => ({
    roomId: room.roomId,
    code: room.code,
    players: room.players,
    maxPlayers: 2
  }));
  
  res.json({ rooms });
});

// Check player's assignment status
app.get("/queue/status", verifyToken, (req: any, res) => {
  const pendingAssignments = (global as any).pendingAssignments || new Map();
  
  // Check if player is assigned to any room
  for (const [roomId, assignment] of pendingAssignments.entries()) {
    if (assignment.playerIds.includes(req.user.id)) {
      const assignedRoomId = assignment.roomId || roomId;
      
      // Verify room still exists
      try {
        const roomInstance = matchMaker.getRoomById(assignedRoomId);
        if (!roomInstance) {
          console.warn(`⚠️ Assigned room ${assignedRoomId} no longer exists, removing assignment`);
          pendingAssignments.delete(roomId);
          continue;
        }
      } catch (err) {
        console.warn(`⚠️ Error checking room ${assignedRoomId}:`, err);
        pendingAssignments.delete(roomId);
        continue;
      }
      
      console.log(`✅ Player ${req.user.username} assigned to room ${assignedRoomId}`);
      return res.json({
        status: "assigned",
        roomId: assignedRoomId
      });
    }
  }
  
  // Check if player is in queue
  if (waitingPlayers.has(req.user.id)) {
    return res.json({
      status: "waiting",
      position: Array.from(waitingPlayers.keys()).indexOf(req.user.id) + 1
    });
  }
  
  res.json({ status: "none" });
});

// ========== MINIGAME ENDPOINTS ==========

// Start a minigame session (called when driver hits a cone)
app.post("/minigame/start", async (req, res) => {
  const { roomCode } = req.body;
  
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode is required" });
  }
  
  // CLEAR previous sessions for this roomCode to prevent old results from being applied
  for (const [sessionId, session] of minigameSessions.entries()) {
    if (session.roomCode === roomCode) {
      minigameSessions.delete(sessionId);
      console.log(`🗑️ Cleared previous minigame session: ${sessionId} for room ${roomCode}`);
    }
  }
  
  // RESET the minigame room state to clear previous game results
  try {
    const minigameApiUrl = process.env.MINIGAME_API_URL || 'http://localhost:3001';
    const url = new URL(`${minigameApiUrl}/rooms/${roomCode}/reset`);
    
    // Use Node.js http module to make the request
    const postData = '';
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    await new Promise<void>((resolve, reject) => {
      const req = request(options, (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`🔄 Reset minigame room: ${roomCode}`);
          resolve();
        } else {
          console.warn(`⚠️ Failed to reset minigame room: ${roomCode}`, res.statusCode);
          resolve(); // Don't reject, just log the warning
        }
        res.on('data', () => {}); // Consume response
        res.on('end', () => resolve());
      });

      req.on('error', (error) => {
        console.warn(`⚠️ Error resetting minigame room: ${roomCode}`, error.message);
        resolve(); // Don't reject, just log the warning
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.warn(`⚠️ Error resetting minigame room: ${roomCode}`, error);
    // Continue anyway - the minigame will still work
  }
  
  // Generate unique session ID
  const sessionId = `mg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const session: MinigameSession = {
    sessionId,
    roomCode,
    startTime: Date.now(),
    result: "pending"
  };
  
  minigameSessions.set(sessionId, session);
  
  console.log(`🎮 Minigame session started: ${sessionId} for room ${roomCode}`);
  
  res.json({ 
    sessionId,
    minigameUrl: `/minigame?session=${sessionId}` // URL que el minijuego usará
  });
});

// Receive result from minigame service (external service will call this)
// Expected format: {"won": true/false, "roomCode": "ABCD"} or {"won": true/false, "sessionId": "..."}
app.post("/minigame/result", (req, res) => {
  const { won, roomCode, sessionId } = req.body;
  
  if (typeof won !== 'boolean') {
    return res.status(400).json({ error: "Field 'won' (boolean) is required" });
  }
  
  // Identify room by sessionId or roomCode
  let targetRoomCode = roomCode;
  let targetSessionId = sessionId;
  
  if (sessionId && !targetRoomCode) {
    const session = minigameSessions.get(sessionId);
    if (session) {
      targetRoomCode = session.roomCode;
      targetSessionId = sessionId;
      session.result = won ? "won" : "lost";
    } else {
      // Session not found - might be an old session
      return res.status(404).json({ error: "Minigame session not found or expired" });
    }
  }
  
  if (!targetRoomCode) {
    return res.status(400).json({ error: "roomCode or sessionId is required" });
  }
  
  // Find the room and verify the sessionId matches the active minigame
  const room = roomsByCode.get(targetRoomCode);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  
  // CRITICAL: Verify that the sessionId matches the current active minigame session
  // This prevents old results from being applied to new minigames
  if (targetSessionId && room.state.minigameSessionId && room.state.minigameSessionId !== targetSessionId) {
    console.log(`⚠️ Rejected minigame result: sessionId mismatch. Expected: ${room.state.minigameSessionId}, Got: ${targetSessionId}`);
    return res.status(400).json({ error: "Minigame session mismatch. This result is for a different minigame session." });
  }
  
  // Only resolve if there's an active minigame
  if (!room.state.minigameActive) {
    console.log(`⚠️ Rejected minigame result: no active minigame for room ${targetRoomCode}`);
    return res.status(400).json({ error: "No active minigame for this room" });
  }
  
  if (room.resolveMinigame) {
    room.resolveMinigame(won);
    
    // Clean up the session after resolving
    if (targetSessionId) {
      minigameSessions.delete(targetSessionId);
      console.log(`🗑️ Cleaned up resolved minigame session: ${targetSessionId}`);
    }
    
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Room does not support minigame resolution" });
  }
});

// Check minigame status (for polling from client)
app.get("/minigame/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  
  const session = minigameSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  
  res.json({
    sessionId: session.sessionId,
    roomCode: session.roomCode,
    result: session.result,
    elapsed: Date.now() - session.startTime
  });
});

// Clean up old sessions (older than 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of minigameSessions.entries()) {
    if (now - session.startTime > 5 * 60 * 1000) {
      minigameSessions.delete(sessionId);
      console.log(`🗑️ Cleaned up old minigame session: ${sessionId}`);
    }
  }
}, 60000); // Run every minute

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

// Initialize database and start server
function startServer() {
  try {
    // Initialize database tables
    initDatabase();
    
    // Listen on all network interfaces (0.0.0.0)
    server.listen(port, '0.0.0.0', () => {
      console.log(`\n🚀 Server is running!`);
      console.log(`📡 Local network access:`);
      console.log(`   ws://${localIP}:${port}`);
      console.log(`   http://${localIP}:${port}`);
      console.log(`\n💻 Local access:`);
      console.log(`   ws://localhost:${port}`);
      console.log(`   http://localhost:${port}\n`);
      console.log(`💾 Database: SQLite (local)`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
