import { useState, useRef, useCallback, useEffect } from 'react';
import * as Colyseus from "colyseus.js";
import { GameState } from "./schema/GameState";
import { DrawingCanvas } from "./components/DrawingCanvas";
import { AudioSystem } from "./components/AudioSystem";
import { Lobby } from "./components/Lobby";
import { DriverView } from "./components/views/DriverView";
import { NavigatorView } from "./components/views/NavigatorView";
import "./Game.css";

// Get server URL from environment variable or use localhost
// For local network access, set VITE_SERVER_URL=http://YOUR_IP:2567 in .env
const getServerURL = () => {
  // Check if we're in development or production
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  }
  
  // Try to detect if we're accessing from a mobile device or different host
  const hostname = window.location.hostname;
  
  // If not localhost, assume we're accessing from network and use the same hostname
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `ws://${hostname}:2567`;
  }
  
  // Default to localhost for local development
  return "ws://localhost:2567";
};

const client = new Colyseus.Client(getServerURL());

interface GameProps {
    preassignedRoom?: string; // Room code assigned by monitor
}

export const Game = ({ preassignedRoom }: GameProps) => {
    const [room, setRoom] = useState<Colyseus.Room<GameState> | null>(null);
    const [connected, setConnected] = useState(false);
    const [myRole, setMyRole] = useState<string>("");
    const [mySessionId, setMySessionId] = useState<string>("");
    const [carPosition, setCarPosition] = useState<{ x: number, z: number, angle: number }>({ x: 0, z: 0, angle: 0 });
    const [carSpeed, setCarSpeed] = useState(0);
    const [steeringValue, setSteeringValue] = useState(0);
    type TrapDTO = { id: string; x: number; z: number; type: string; radius: number };
    const [traps, setTraps] = useState<TrapDTO[]>([]);
    const [gamePhase, setGamePhase] = useState<string>("lobby");
    const [challenge, setChallenge] = useState<any>(null);
    const [challengePortal, setChallengePortal] = useState<{ x: number, z: number, active: boolean }>({ x: 0, z: 0, active: false });
    const [carState, setCarState] = useState<any>({});
    const [radioStation, setRadioStation] = useState("normal");
    const [hornActive, setHornActive] = useState(false);
    const [bgmEnabled, setBgmEnabled] = useState(true); // BGM toggle (synced from server)
    const [roomCode, setRoomCode] = useState("");
    const [pathHistory, setPathHistory] = useState<Array<{ x: number; z: number }>>([]);
    const [startPoint, setStartPoint] = useState({ x: 0, z: 0 });
    const [endPoint, setEndPoint] = useState({ x: 100, z: 100 });
    const [trackData, setTrackData] = useState<string>("");
    const [conesData, setConesData] = useState<string>("");
    const audioSystemRef = useRef<any>(null);
    
    // Race state
    const [currentLap, setCurrentLap] = useState(0);
    const [totalLaps, setTotalLaps] = useState(1);
    const [raceProgress, setRaceProgress] = useState(0);
    const [raceFinished, setRaceFinished] = useState(false);
    const [raceTime, setRaceTime] = useState(0);
    
    // Minigame state
    const [minigameActive, setMinigameActive] = useState(false);
    const [minigameSessionId, setMinigameSessionId] = useState("");
    const [minigameResult, setMinigameResult] = useState("");
    const [clarityActive, setClarityActive] = useState(false);
    const [speedBoostActive, setSpeedBoostActive] = useState(false);
    const minigameWindowRef = useRef<Window | null>(null);
    const minigamePollingRef = useRef<NodeJS.Timeout | null>(null);

    // If role hasn't arrived yet (common right after creating the room), poll briefly to avoid rendering "nothing".
    useEffect(() => {
        if (!room || !connected || myRole) return;
        const interval = setInterval(() => {
            try {
                const state = room.state;
                let role = "";
                if (state?.players && (state.players as any).forEach) {
                    (state.players as any).forEach((player: any, key: string) => {
                        if (key === room.sessionId || player?.sessionId === room.sessionId) {
                            if (player?.role) role = player.role;
                        }
                    });
                }
                if (role) {
                    setMyRole(role);
                    clearInterval(interval);
                }
            } catch {
                // ignore and keep polling briefly
            }
        }, 200);
        return () => clearInterval(interval);
    }, [room, connected, myRole]);

    // Handle minigame - open window for BOTH players (cooperative minigame)
    useEffect(() => {
        if (minigameActive && minigameSessionId && myRole) {
            // Open minigame in new tab for BOTH driver and navigator
            const minigameUrl = `/minigame.html?session=${minigameSessionId}&room=${roomCode}&role=${myRole}`;
            if (!minigameWindowRef.current || minigameWindowRef.current.closed) {
                console.log(`Opening minigame for ${myRole}:`, minigameUrl);
                minigameWindowRef.current = window.open(minigameUrl, '_blank');
            }
        }
        // Window will close itself when minigame ends
    }, [minigameActive, minigameSessionId, myRole, roomCode]);

    const setupRoomListeners = useCallback((r: Colyseus.Room<GameState>) => {
        // Ensure we always store the session id we should look up in state.players
        setMySessionId(r.sessionId);

        // Set initial state immediately if available
        const updateState = (state: GameState) => {
            if (!state) {
                console.warn("State is null or undefined");
                return;
            }
            
            console.log("📊 Updating state:", state.gamePhase, "roomCode:", state.roomCode, "trackData:", state.trackData?.length || 0, "chars");
            setGamePhase(state.gamePhase || "lobby");
            setRoomCode(state.roomCode || "");
            
            // Update start and end points
            if (state.startX !== undefined && state.startZ !== undefined) {
                setStartPoint({ x: state.startX, z: state.startZ });
            }
            if (state.endX !== undefined && state.endZ !== undefined) {
                setEndPoint({ x: state.endX, z: state.endZ });
            }
            
            // Determine my role robustly (MapSchema key lookup + value scan fallback)
            let role = "";
            try {
                if (state.players && (state.players as any).get) {
                    const me = (state.players as any).get(r.sessionId);
                    if (me?.role) role = me.role;
                }
            } catch {
                // ignore - we'll try scanning below
            }
            if (!role && state.players && (state.players as any).forEach) {
                (state.players as any).forEach((player: any, key: string) => {
                    if (key === r.sessionId || player?.sessionId === r.sessionId) {
                        if (player?.role) role = player.role;
                    }
                });
            }
            if (role) {
                console.log("👤 My role detected:", role);
                setMyRole(role);
            }
            
            const newPosition = {
                x: state.car?.x || 0,
                z: state.car?.z || 0,
                angle: state.car?.angle || 0
            };
            setCarPosition(newPosition);
            
            // Update path history
            setPathHistory(prev => {
                const newPath = [...prev, newPosition];
                return newPath.slice(-100);
            });

            setCarSpeed(state.car?.speed || 0);
            setSteeringValue(state.car?.steeringValue || 0);
            setCarState({
                turboActive: state.car?.turboActive || false,
                controlsInverted: state.car?.controlsInverted || false,
                cameraCrazy: state.car?.cameraCrazy || false
            });

            // Safely access traps
            if (state.traps && state.traps.forEach) {
                const trapArray: TrapDTO[] = [];
                state.traps.forEach((trap, key) => {
                    trapArray.push({
                        id: key,
                        x: trap.x,
                        z: trap.z,
                        type: trap.type,
                        radius: trap.radius
                    });
                });
                setTraps(trapArray);
            }

            if (state.challengePortalActive) {
                setChallengePortal({
                    x: state.challengePortalX,
                    z: state.challengePortalZ,
                    active: true
                });
            } else {
                setChallengePortal({ x: 0, z: 0, active: false });
            }

            if (state.challenge) {
                setChallenge(state.challenge);
            }

            setRadioStation(state.radioStation || "normal");
            setHornActive(state.hornActive || false);
            setBgmEnabled(state.bgmEnabled !== undefined ? state.bgmEnabled : true);
            setTrackData(state.trackData || "");
            setConesData(state.conesData || "");
            
            // Race state
            setCurrentLap(state.currentLap || 0);
            setTotalLaps(state.totalLaps || 1);
            setRaceProgress(state.raceProgress || 0);
            setRaceFinished(state.raceFinished || false);
            setRaceTime(state.raceTime || 0);
            
            // Minigame state
            setMinigameActive(state.minigameActive || false);
            setMinigameSessionId(state.minigameSessionId || "");
            setMinigameResult(state.minigameResult || "");
            
            const newClarityActive = state.car?.clarityActive || false;
            const newSpeedBoostActive = state.car?.speedBoostActive || false;
            
            // Debug logging
            if (newClarityActive || newSpeedBoostActive) {
                console.log(`🎮 Rewards received! clarity=${newClarityActive}, speedBoost=${newSpeedBoostActive}`);
            }
            
            setClarityActive(newClarityActive);
            setSpeedBoostActive(newSpeedBoostActive);
        };

        // Set initial state
        if (r.state) {
            updateState(r.state);
        }

        // Listen for state changes
        r.onStateChange((state) => {
            updateState(state);
        });

        r.onError((code, message) => {
            console.error("Room error:", code, message);
        });

        r.onLeave((code) => {
            console.log("Left room:", code);
            setConnected(false);
            setRoom(null);
        });
    }, []);

    const handleCreateRoom = useCallback(async () => {
        try {
            console.log("Creating room...");
            console.log("Client URL:", getServerURL());
            
            // Check if client is properly initialized
            if (!client) {
                throw new Error("Client not initialized. Check server connection.");
            }
            
            const r = await client.create<GameState>("game_room");
            console.log("Created room", r.sessionId, "State:", r.state);
            
            if (!r) {
                throw new Error("Room creation returned null");
            }
            
            if (!r.state) {
                throw new Error("Room created but state is missing. Server may not be running.");
            }
            
            setMySessionId(r.sessionId);
            setRoom(r);
            
            // Set default state FIRST so something shows immediately
            setGamePhase("lobby");
            setRoomCode(r.state?.roomCode || "");
            
            // Set connected so we can render
            setConnected(true);
            
            // Setup listeners - this will handle state updates
            setupRoomListeners(r);
            
            console.log("Room created and connected, showing lobby");
        } catch (e) {
            console.error("Create room error", e);
            const errorMessage = e instanceof Error 
                ? e.message 
                : typeof e === 'string' 
                    ? e 
                    : e?.toString?.() || JSON.stringify(e) || "Unknown error - check server connection";
            alert("Error creating room: " + errorMessage);
        }
    }, [setupRoomListeners]);

    const handleJoinRoom = useCallback(async (roomId: string) => {
        try {
            console.log("🔗 Attempting to join room:", roomId);
            const r = await client.joinById<GameState>(roomId);
            console.log("✅ Joined room", r.sessionId, "State:", r.state?.gamePhase, "Track:", r.state?.trackData?.length);
            setRoom(r);
            setMySessionId(r.sessionId);
            setConnected(true);
            setupRoomListeners(r);
        } catch (e) {
            console.error("❌ Join room error", e);
            const errorMessage = e instanceof Error 
                ? e.message 
                : typeof e === 'string' 
                    ? e 
                    : e?.toString?.() || JSON.stringify(e) || "Unknown error";
            alert("Failed to join room: " + errorMessage);
        }
    }, [setupRoomListeners]);

    // Guard to prevent double joining
    const joiningRef = useRef(false);
    
    // Auto-join preassigned room if provided (from monitor assignment)
    useEffect(() => {
        if (preassignedRoom && !room && !connected && !joiningRef.current) {
            joiningRef.current = true;
            console.log("🎮 Auto-joining preassigned room:", preassignedRoom);
            // Join the existing room by its ID (preassignedRoom is the roomId, not code)
            handleJoinRoom(preassignedRoom).finally(() => {
                // Reset guard after join completes (success or failure)
                setTimeout(() => { joiningRef.current = false; }, 1000);
            });
        }
    }, [preassignedRoom, room, connected, handleJoinRoom]);

    const handleSteer = useCallback((value: number) => {
        if (room) {
            room.send("input", { steer: value });
        }
    }, [room]);

    const handleAccelerate = useCallback((active: boolean) => {
        if (room) {
            console.log("CLIENT: Sending accelerate:", active);
            room.send("input", { accelerate: active });
        } else {
            console.log("CLIENT: No room, cannot send accelerate");
        }
    }, [room]);

    const handleHorn = useCallback((active: boolean) => {
        if (room) {
            room.send("horn", { active });
        }
    }, [room]);

    const handleRadio = useCallback(() => {
        if (room) {
            const stations = ["normal", "absurd1", "absurd2"];
            const currentIndex = stations.indexOf(radioStation);
            const nextIndex = (currentIndex + 1) % stations.length;
            room.send("radio", { station: stations[nextIndex] });
        }
    }, [room, radioStation]);

    const handleBgmToggle = useCallback(() => {
        if (room && myRole === "navigator") {
            // Send toggle to server (only navigator can control)
            room.send("bgm_toggle", { enabled: !bgmEnabled });
        }
    }, [room, myRole, bgmEnabled]);

    const handleDrawingComplete = useCallback((canvasData: string) => {
        if (room && challenge && challenge.currentDrawer === mySessionId) {
            room.send("drawing", { canvasData });
        }
    }, [room, challenge, mySessionId]);

    const handleGuess = useCallback((word: string) => {
        if (room && challenge && challenge.currentGuesser === mySessionId) {
            room.send("guess", { word });
        }
    }, [room, challenge, mySessionId]);

    const handleTrackGenerated = useCallback((track: Array<{x: number, y: number}>) => {
        if (room) {
            const trackJson = JSON.stringify(track);
            room.send("track", { trackData: trackJson });
        }
    }, [room]);

    // Handler para cuando el Driver genera los conos/obstáculos
    const handleConesGenerated = useCallback((cones: Array<{x: number, y: number}>) => {
        if (room) {
            console.log("Sending cones to server:", cones.length);
            const conesJson = JSON.stringify(cones);
            room.send("cones", { conesData: conesJson });
        }
    }, [room]);

    // Show main lobby if not connected (only if NOT coming from monitor assignment)
    if (!connected) {
        // If we have a preassigned room, show connecting screen instead of lobby
        if (preassignedRoom) {
            return (
                <div style={{
                    minHeight: '100vh',
                    background: '#0a0a0f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"Press Start 2P", monospace',
                    color: '#fff'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏎️</div>
                        <div style={{ fontSize: '14px', color: '#ffd700', marginBottom: '10px' }}>
                            CONECTANDO A PARTIDA...
                        </div>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            border: '4px solid #e94560',
                            borderTop: '4px solid transparent',
                            borderRadius: '50%',
                            margin: '20px auto',
                            animation: 'spin 1s linear infinite'
                        }} />
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                </div>
            );
        }
        return (
            <Lobby onJoinRoom={handleJoinRoom} onCreateRoom={handleCreateRoom} />
        );
    }
    
    // Show room lobby if connected and gamePhase is lobby (or not set yet)
    if (gamePhase === "lobby" || (!gamePhase && connected && room)) {
        const players = room?.state?.players ? Array.from(room.state.players.values()) : [];
        const playerCount = players.length;
        
        return (
            <div className="pixel-lobby">
                <div className="pixel-bg"></div>
                <div className="lobby-container">
                    <h1 className="lobby-title">
                        ROOM {roomCode || "LOADING..."}
                    </h1>
                    <div className="lobby-subtitle">Waiting for players...</div>
                    <div className="players-list">
                        {playerCount > 0 ? (
                            players.map((player, i) => (
                                <div key={i} className="player-item">
                                    <span className="player-role">{player.role.toUpperCase() || "WAITING..."}</span>
                                    <span className="player-status">{player.connected ? "●" : "○"}</span>
                                </div>
                            ))
                        ) : (
                            <div className="no-rooms">No players yet...</div>
                        )}
                    </div>
                    <div className="lobby-section">
                        <div className="section-header">PLAYERS: {playerCount}/2</div>
                        {playerCount >= 2 && (
                            <button
                                className="pixel-button large"
                                onClick={() => {
                                    if (room) {
                                        room.send("start_game");
                                    }
                                }}
                            >
                                START GAME
                            </button>
                        )}
                        {playerCount < 2 && (
                            <div className="lobby-subtitle" style={{ marginTop: "20px" }}>
                                Need {2 - playerCount} more player{2 - playerCount > 1 ? 's' : ''} to start
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Show challenge overlay if active
    const showChallenge = gamePhase === "challenge" && challenge?.active;
    const isMyTurnToDraw = challenge?.currentDrawer === mySessionId;
    const isMyTurnToGuess = challenge?.currentGuesser === mySessionId;
    const showDrawing1 = challenge?.phase === "drawing2" || challenge?.phase === "guessing";
    const showDrawing2 = challenge?.phase === "guessing";

    // Format time as MM:SS.ms
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="game-container">
            <AudioSystem 
                ref={audioSystemRef}
                hornActive={hornActive}
                radioStation={radioStation}
                turboActive={carState.turboActive}
                bgmEnabled={bgmEnabled}
            />

            {/* Race HUD - Pixel Art Style */}
            {gamePhase === "playing" && (
                <div style={{
                    position: 'fixed',
                    top: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    display: 'flex',
                    gap: '4px',
                    padding: '8px',
                    background: '#1a1a2e',
                    border: '4px solid #16213e',
                    boxShadow: '4px 4px 0px #0f0f23, inset 0 0 0 2px #2a2a4e',
                    imageRendering: 'pixelated',
                    fontFamily: '"Press Start 2P", "Courier New", monospace',
                }}>
                    {/* LAP */}
                    <div style={{
                        background: '#0f3460',
                        border: '2px solid #16213e',
                        padding: '8px 16px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '8px', color: '#7f8c8d', marginBottom: '4px', letterSpacing: '1px' }}>LAP</div>
                        <div style={{ fontSize: '16px', color: '#e94560', textShadow: '2px 2px 0px #1a1a2e' }}>
                            {currentLap}/{totalLaps}
                        </div>
                    </div>
                    {/* TIME */}
                    <div style={{
                        background: '#0f3460',
                        border: '2px solid #16213e',
                        padding: '8px 16px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '8px', color: '#7f8c8d', marginBottom: '4px', letterSpacing: '1px' }}>TIME</div>
                        <div style={{ fontSize: '16px', color: '#00ff88', textShadow: '2px 2px 0px #1a1a2e' }}>
                            {formatTime(raceTime)}
                        </div>
                    </div>
                    {/* PROGRESS */}
                    <div style={{
                        background: '#0f3460',
                        border: '2px solid #16213e',
                        padding: '8px 16px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '8px', color: '#7f8c8d', marginBottom: '4px', letterSpacing: '1px' }}>PROG</div>
                        <div style={{ fontSize: '16px', color: '#00d4ff', textShadow: '2px 2px 0px #1a1a2e' }}>
                            {Math.round(raceProgress * 100)}%
                        </div>
                    </div>
                </div>
            )}

            {/* WIN SCREEN - Pixel Art Style */}
            {raceFinished && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 2000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0a0a0f',
                    fontFamily: '"Press Start 2P", "Courier New", monospace',
                    imageRendering: 'pixelated',
                }}>
                    {/* Pixel border frame */}
                    <div style={{
                        background: '#1a1a2e',
                        border: '8px solid #16213e',
                        boxShadow: '8px 8px 0px #0f0f23, inset 0 0 0 4px #2a2a4e',
                        padding: '48px 64px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        {/* Trophy */}
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '16px',
                            animation: 'bounce 0.5s ease-in-out infinite alternate',
                        }}>
                            🏆
                        </div>
                        
                        {/* VICTORY text */}
                        <div style={{
                            fontSize: '32px',
                            color: '#ffd700',
                            textShadow: '4px 4px 0px #b8860b, -2px -2px 0px #ffec8b',
                            marginBottom: '24px',
                            letterSpacing: '4px',
                        }}>
                            VICTORY!
                        </div>
                        
                        {/* Separator line */}
                        <div style={{
                            width: '200px',
                            height: '4px',
                            background: 'linear-gradient(90deg, transparent, #e94560, transparent)',
                            marginBottom: '24px',
                        }} />
                        
                        {/* Time label */}
                        <div style={{
                            fontSize: '10px',
                            color: '#7f8c8d',
                            marginBottom: '8px',
                            letterSpacing: '2px',
                        }}>
                            FINAL TIME
                        </div>
                        
                        {/* Time value */}
                        <div style={{
                            fontSize: '24px',
                            color: '#00ff88',
                            textShadow: '3px 3px 0px #1a1a2e',
                            marginBottom: '24px',
                        }}>
                            {formatTime(raceTime)}
                        </div>
                        
                        {/* Laps completed */}
                        <div style={{
                            fontSize: '10px',
                            color: '#00d4ff',
                            marginBottom: '32px',
                            letterSpacing: '1px',
                        }}>
                            {totalLaps} LAP{totalLaps > 1 ? 'S' : ''} COMPLETE
                        </div>
                        
                        {/* Play Again button - Pixel style */}
                        <button
                            onClick={() => {
                                if (room) {
                                    room.leave();
                                }
                                // Reload page to go back to lobby
                                window.location.reload();
                            }}
                            style={{
                                padding: '16px 32px',
                                fontSize: '12px',
                                fontFamily: '"Press Start 2P", "Courier New", monospace',
                                background: '#0f3460',
                                color: '#fff',
                                border: '4px solid #16213e',
                                boxShadow: '4px 4px 0px #0f0f23',
                                cursor: 'pointer',
                                letterSpacing: '2px',
                                transition: 'transform 0.1s',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translate(2px, 2px)';
                                e.currentTarget.style.boxShadow = '2px 2px 0px #0f0f23';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translate(0, 0)';
                                e.currentTarget.style.boxShadow = '4px 4px 0px #0f0f23';
                            }}
                        >
                            VOLVER AL LOBBY
                        </button>
                    </div>
                    
                    {/* Decorative pixels in corners */}
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '20px',
                        width: '8px',
                        height: '8px',
                        background: '#e94560',
                        boxShadow: '12px 0 0 #00ff88, 24px 0 0 #00d4ff, 0 12px 0 #ffd700',
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        width: '8px',
                        height: '8px',
                        background: '#00d4ff',
                        boxShadow: '-12px 0 0 #00ff88, -24px 0 0 #e94560, 0 12px 0 #ffd700',
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '20px',
                        width: '8px',
                        height: '8px',
                        background: '#ffd700',
                        boxShadow: '12px 0 0 #e94560, 24px 0 0 #00ff88, 0 -12px 0 #00d4ff',
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        right: '20px',
                        width: '8px',
                        height: '8px',
                        background: '#00ff88',
                        boxShadow: '-12px 0 0 #ffd700, -24px 0 0 #00d4ff, 0 -12px 0 #e94560',
                    }} />
                </div>
            )}

            {/* MINIGAME OVERLAY - shown when minigame is active (for BOTH players) */}
            {minigameActive && myRole && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1500,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.85)',
                    fontFamily: '"Press Start 2P", "Courier New", monospace',
                }}>
                    <div style={{
                        background: '#1a1a2e',
                        border: '8px solid #e94560',
                        boxShadow: '8px 8px 0px #0f0f23',
                        padding: '40px 60px',
                        textAlign: 'center',
                    }}>
                        {minigameResult === "pending" || !minigameResult ? (
                            <>
                                <div style={{ fontSize: '16px', color: '#ffd700', marginBottom: '20px' }}>
                                    ⚠️ ¡CONO GOLPEADO! ⚠️
                                </div>
                                <div style={{ fontSize: '24px', color: '#fff', marginBottom: '20px' }}>
                                    MINIJUEGO
                                </div>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '30px' }}>
                                    Espera el resultado...
                                </div>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    border: '4px solid #e94560',
                                    borderTop: '4px solid transparent',
                                    borderRadius: '50%',
                                    margin: '0 auto',
                                    animation: 'spin 1s linear infinite',
                                }} />
                            </>
                        ) : minigameResult === "won" ? (
                            <>
                                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏆</div>
                                <div style={{ fontSize: '24px', color: '#00ff88', marginBottom: '20px' }}>
                                    ¡GANASTE!
                                </div>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '20px' }}>
                                    +8s Claridad | +8s Velocidad +20%
                                </div>
                                <div style={{ fontSize: '12px', color: '#ffd700', marginTop: '20px' }}>
                                    🚗 Reposicionando... 3s
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
                                <div style={{ fontSize: '24px', color: '#e94560', marginBottom: '20px' }}>
                                    PERDISTE
                                </div>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '20px' }}>
                                    Sin recompensas
                                </div>
                                <div style={{ fontSize: '12px', color: '#ffd700', marginTop: '20px' }}>
                                    🚗 Reposicionando... 3s
                                </div>
                            </>
                        )}
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                </div>
            )}

            {/* REWARD INDICATORS - shown when rewards are active */}
            {(clarityActive || speedBoostActive) && (
                <div style={{
                    position: 'fixed',
                    top: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1100,
                    display: 'flex',
                    gap: '10px',
                    fontFamily: '"Press Start 2P", "Courier New", monospace',
                }}>
                    {clarityActive && (
                        <div style={{
                            background: '#00ff88',
                            color: '#000',
                            padding: '8px 16px',
                            fontSize: '10px',
                            border: '3px solid #000',
                            boxShadow: '3px 3px 0px #0f0f23',
                            animation: 'pulse 0.5s ease-in-out infinite',
                        }}>
                            👁️ CLARIDAD
                        </div>
                    )}
                    {speedBoostActive && (
                        <div style={{
                            background: '#ffd700',
                            color: '#000',
                            padding: '8px 16px',
                            fontSize: '10px',
                            border: '3px solid #000',
                            boxShadow: '3px 3px 0px #0f0f23',
                            animation: 'pulse 0.5s ease-in-out infinite',
                        }}>
                            🚀 +20% VELOCIDAD
                        </div>
                    )}
                    <style>{`
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.7; }
                        }
                    `}</style>
                </div>
            )}

            {/* If role is still loading, show a small status instead of a blank screen */}
            {!myRole && (
                <div style={{ color: "#fff", fontFamily: "monospace", padding: "16px" }}>
                    Loading role… (session: {mySessionId || room?.sessionId})
                </div>
            )}

            {/* Role-specific views */}
            {myRole === "driver" && (
                <DriverView
                    steeringValue={steeringValue}
                    onSteer={handleSteer}
                    onAccelerate={handleAccelerate}
                    onCollision={() => {
                        // Send cone_hit to trigger minigame
                        if (room && !minigameActive) {
                            console.log("🎯 Sending cone_hit to server!");
                            room.send("cone_hit");
                        }
                    }}
                    controlsInverted={carState.controlsInverted}
                    speed={carSpeed}
                    turboActive={carState.turboActive}
                    carPosition={carPosition}
                    traps={traps}
                    startPoint={startPoint}
                    endPoint={endPoint}
                    onTrackGenerated={handleTrackGenerated}
                    onConesGenerated={handleConesGenerated}
                    trackData={trackData}
                    clarityActive={clarityActive}
                    minigameActive={minigameActive}
                />
            )}

            {myRole === "navigator" && (
                <NavigatorView
                    carPosition={carPosition}
                    traps={traps}
                    challengePortal={challengePortal}
                    pathHistory={pathHistory}
                    startPoint={startPoint}
                    endPoint={endPoint}
                    onHorn={handleHorn}
                    onRadio={handleRadio}
                    radioStation={radioStation}
                    hornActive={hornActive}
                    speed={carSpeed}
                    trackData={trackData}
                    conesData={conesData}
                    bgmEnabled={bgmEnabled}
                    onBgmToggle={handleBgmToggle}
                />
            )}

            {/* Challenge Drawing Canvas */}
            {showChallenge && (
                <div className="challenge-overlay">
                    {isMyTurnToDraw && challenge?.phase === "drawing1" && (
                        <div className="challenge-panel">
                            <h2>DRAW: {challenge.word}</h2>
                            <p>12 seconds</p>
                            <DrawingCanvas
                                onComplete={handleDrawingComplete}
                                timeLimit={12000}
                                showPrevious={false}
                            />
                        </div>
                    )}

                    {isMyTurnToDraw && challenge?.phase === "drawing2" && (
                        <div className="challenge-panel">
                            <h2>REINTERPRET</h2>
                            <p>12 seconds</p>
                            {showDrawing1 && challenge.drawing1Data && (
                                <img src={challenge.drawing1Data} alt="Previous" className="previous-drawing" />
                            )}
                            <DrawingCanvas
                                onComplete={handleDrawingComplete}
                                timeLimit={12000}
                                showPrevious={true}
                                previousDrawing={challenge.drawing1Data}
                            />
                        </div>
                    )}

                    {isMyTurnToGuess && challenge?.phase === "guessing" && (
                        <div className="challenge-panel">
                            <h2>GUESS</h2>
                            {showDrawing2 && challenge.drawing2Data && (
                                <img src={challenge.drawing2Data} alt="Final" className="previous-drawing" />
                            )}
                            <input
                                type="text"
                                className="pixel-input"
                                placeholder="Your guess..."
                                onKeyPress={(e) => {
                                    if (e.key === "Enter") {
                                        handleGuess(e.currentTarget.value);
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    )}

                    {!isMyTurnToDraw && !isMyTurnToGuess && (
                        <div className="challenge-panel">
                            <h2>WAITING...</h2>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
