import { useEffect, useState, useRef, useCallback } from 'react';
import * as Colyseus from "colyseus.js";
import { GameState, Trap } from "./schema/GameState";
import { DrawingCanvas } from "./components/DrawingCanvas";
import { AudioSystem } from "./components/AudioSystem";
import { Lobby } from "./components/Lobby";
import { DriverView } from "./components/views/DriverView";
import { CopilotView } from "./components/views/CopilotView";
import { AcceleratorView } from "./components/views/AcceleratorView";
import { NavigatorView } from "./components/views/NavigatorView";
import "./Game.css";

const client = new Colyseus.Client("ws://localhost:2567");

export const Game = () => {
    const [room, setRoom] = useState<Colyseus.Room<GameState> | null>(null);
    const [connected, setConnected] = useState(false);
    const [myRole, setMyRole] = useState<string>("");
    const [mySessionId, setMySessionId] = useState<string>("");
    const [carPosition, setCarPosition] = useState<{ x: number, z: number, angle: number }>({ x: 0, z: 0, angle: 0 });
    const [carSpeed, setCarSpeed] = useState(0);
    const [steeringValue, setSteeringValue] = useState(0);
    const [traps, setTraps] = useState<Trap[]>([]);
    const [gamePhase, setGamePhase] = useState<string>("lobby");
    const [challenge, setChallenge] = useState<any>(null);
    const [challengePortal, setChallengePortal] = useState<{ x: number, z: number, active: boolean }>({ x: 0, z: 0, active: false });
    const [carState, setCarState] = useState<any>({});
    const [radioStation, setRadioStation] = useState("normal");
    const [hornActive, setHornActive] = useState(false);
    const [roomCode, setRoomCode] = useState("");
    const [pathHistory, setPathHistory] = useState<Array<{ x: number; z: number }>>([]);
    const [startPoint, setStartPoint] = useState({ x: 0, z: 0 });
    const [endPoint, setEndPoint] = useState({ x: 100, z: 100 });
    const audioSystemRef = useRef<any>(null);

    const handleCreateRoom = useCallback(async () => {
        try {
            console.log("Creating room...");
            const r = await client.create<GameState>("game_room");
            console.log("Created room", r.sessionId, "State:", r.state);
            
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
            alert("Error creating room: " + (e as Error).message);
        }
    }, [client]);

    const handleJoinRoom = useCallback(async (roomId: string) => {
        try {
            const r = await client.joinById<GameState>(roomId);
            console.log("Joined room", r.sessionId);
            setRoom(r);
            setMySessionId(r.sessionId);
            setConnected(true);
            setupRoomListeners(r);
        } catch (e) {
            console.error("Join room error", e);
            alert("Failed to join room");
        }
    }, []);

    const setupRoomListeners = (r: Colyseus.Room<GameState>) => {
        // Set initial state immediately if available
        const updateState = (state: GameState) => {
            if (!state) {
                console.warn("State is null or undefined");
                return;
            }
            
            console.log("Updating state:", state.gamePhase, "roomCode:", state.roomCode);
            setGamePhase(state.gamePhase || "lobby");
            setRoomCode(state.roomCode || "");
            
            // Update start and end points
            if (state.startX !== undefined && state.startZ !== undefined) {
                setStartPoint({ x: state.startX, z: state.startZ });
            }
            if (state.endX !== undefined && state.endZ !== undefined) {
                setEndPoint({ x: state.endX, z: state.endZ });
            }
            
            // Safely access players
            if (state.players && state.players.get) {
                const me = state.players.get(r.sessionId);
                if (me) {
                    setMyRole(me.role);
                }
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
                const currentTraps: Trap[] = [];
                state.traps.forEach((trap) => {
                    currentTraps.push(trap);
                });
                setTraps(currentTraps);
            }

            if (state.challenge) {
                setChallenge(state.challenge);
            }

            setChallengePortal({
                x: state.challengePortalX || 0,
                z: state.challengePortalZ || 0,
                active: state.challengePortalActive || false
            });

            setRadioStation(state.radioStation || "normal");
            setHornActive(state.hornActive || false);
            
            // Update start/end points for circuit
            if (state.startX !== undefined && state.startZ !== undefined) {
                setStartPoint({ x: state.startX, z: state.startZ });
            }
            if (state.endX !== undefined && state.endZ !== undefined) {
                setEndPoint({ x: state.endX, z: state.endZ });
            }
        };
        
        // Set initial state if available
        if (r.state) {
            console.log("Setting initial state from room.state");
            updateState(r.state);
        }
        
        // Listen for state changes
        r.onStateChange((state) => {
            console.log("State changed event");
            updateState(state);
        });
    };

    const handleSteer = useCallback((value: number) => {
        if (room) {
            room.send("input", { steer: value });
        }
    }, [room]);

    const handleAccelerate = useCallback((active: boolean) => {
        if (room && active) {
            room.send("input", { accelerate: true });
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

    // Show main lobby if not connected
    if (!connected) {
        return (
            <Lobby
                client={client}
                onJoinRoom={handleJoinRoom}
                onCreateRoom={handleCreateRoom}
            />
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
                        <div className="section-header">PLAYERS: {playerCount}/4</div>
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

    return (
        <div className="game-container">
            <AudioSystem 
                ref={audioSystemRef}
                hornActive={hornActive}
                radioStation={radioStation}
                turboActive={carState.turboActive}
            />

            {/* Role-specific views */}
            {myRole === "driver" && (
                <DriverView
                    steeringValue={steeringValue}
                    onSteer={handleSteer}
                    controlsInverted={carState.controlsInverted}
                    speed={carSpeed}
                />
            )}

            {myRole === "copilot" && (
                <CopilotView
                    onHorn={handleHorn}
                    onRadio={handleRadio}
                    radioStation={radioStation}
                    hornActive={hornActive}
                    traps={traps}
                    carPosition={carPosition}
                />
            )}

            {myRole === "accelerator" && (
                <AcceleratorView
                    speed={carSpeed}
                    onAccelerate={handleAccelerate}
                    turboActive={carState.turboActive}
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
