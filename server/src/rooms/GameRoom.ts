import { Room, Client } from "colyseus";
import { GameState, Player, Trap, Challenge } from "./schema/GameState";

// Safe words for challenges
const SAFE_WORDS = [
    "coche", "sol", "casa", "árbol", "perro", "gato", "estrella", "luna",
    "flor", "mar", "montaña", "nube", "corazón", "sonrisa", "libro", "pelota",
    "avión", "barco", "tren", "bicicleta", "helado", "tarta", "regalo", "globo"
];

export class GameRoom extends Room<GameState> {
    maxClients = 10; // 2 players + up to 8 spectators (monitors)
    private challengeTimer: NodeJS.Timeout | null = null;
    private challengeInterval: NodeJS.Timeout | null = null;
    private trapEffects: Map<string, NodeJS.Timeout> = new Map();
    public roomCode: string = "";
    private trackPoints: Array<{ x: number; z: number }> = [];
    private readonly TRACK_WIDTH = 240; // keep in sync with client track rendering

    onCreate(options: any) {
        try {
            this.setState(new GameState());
            
            // Generate room code
            this.roomCode = this.generateRoomCode();
            this.state.roomCode = this.roomCode;
            
            // Generate the authoritative procedural circuit on the server.
            // Driver + Navigator share the same circuit AND the car drives on it.
            this.trackPoints = this.generateProceduralTrackPoints();
            this.state.trackData = JSON.stringify(this.trackPoints.map(p => ({ x: p.x, y: p.z })));

            // Spawn car at track start
            const start = this.trackPoints[0] || { x: 0, z: 0 };
            const next = this.trackPoints[1] || { x: start.x + 1, z: start.z };
            this.state.startX = start.x;
            this.state.startZ = start.z;
            this.state.endX = start.x;
            this.state.endZ = start.z;
            this.state.car.x = start.x;
            this.state.car.z = start.z;
            this.state.car.angle = Math.atan2(next.x - start.x, next.z - start.z);
            
            // Store room info globally
            if ((global as any).activeRooms) {
                (global as any).activeRooms.set(this.roomId, {
                    roomId: this.roomId,
                    code: this.roomCode,
                    players: 0
                });
            }
            
            console.log("Room created with code:", this.roomCode);
            
            // Register room by code for minigame callbacks
            const roomsByCode = (global as any).roomsByCode;
            if (roomsByCode) {
                roomsByCode.set(this.roomCode, this);
            }

            // Game Loop (50ms = 20fps)
            this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);
        } catch (error) {
            console.error("Error in onCreate:", error);
            throw error;
        }

        // Input handling
        this.onMessage("input", (client, data) => {
            console.log("INPUT RECEIVED:", JSON.stringify(data), "GamePhase:", this.state.gamePhase);
            
            const player = this.state.players.get(client.sessionId);
            if (!player) {
                console.log("NO PLAYER FOUND for session:", client.sessionId);
                return;
            }
            
            console.log("Player role:", player.role);

            if (player.role === "driver") {
                // Driver controls both steering and acceleration
                if (data.steer !== undefined) {
                    let steerValue = data.steer;
                    // Invert controls if penalty active
                    if (this.state.car.controlsInverted) {
                        steerValue = -steerValue;
                    }
                    this.state.car.steeringValue = steerValue;
                }
                if (data.accelerate !== undefined) {
                    // Set accelerating flag
                    const oldValue = this.state.car.accelerating;
                    this.state.car.accelerating = data.accelerate;
                    console.log("ACCELERATING CHANGED:", oldValue, "->", data.accelerate, "Speed:", this.state.car.speed.toFixed(2));
                }
                // Handle collision with cone - set speed to 0
                if (data.type === "collision") {
                    this.state.car.speed = 0;
                    this.state.car.accelerating = false;
                    console.log("COLLISION: Speed reset to 0");
                }
            } else {
                console.log("NOT DRIVER, role is:", player.role);
            }
        });

        // Navigator controls (horn and radio - navigator has copilot role too)
        this.onMessage("horn", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.role === "navigator") {
                this.state.hornActive = data.active || false;
            }
        });

        this.onMessage("radio", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.role === "navigator") {
                this.state.radioStation = data.station || "normal";
            }
        });

        this.onMessage("bgm_toggle", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.role === "navigator") {
                this.state.bgmEnabled = data.enabled !== undefined ? data.enabled : !this.state.bgmEnabled;
            }
        });

        // Audio chat signaling (WebRTC)
        this.onMessage("audio_signal", (client, data) => {
            // Forward signaling message to target player
            const targetClient = Array.from(this.clients).find(c => c.sessionId === data.to);
            if (targetClient) {
                targetClient.send("audio_signal", {
                    ...data,
                    from: client.sessionId
                });
            }
        });

        // Track circuit data from driver
        this.onMessage("track", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            // Allow the driver to regenerate the circuit; keep server authoritative afterwards.
            if (player && player.role === "driver" && data.trackData) {
                try {
                    const parsed = JSON.parse(data.trackData);
                    if (Array.isArray(parsed) && parsed.length > 2) {
                        this.trackPoints = parsed
                            .filter((p: any) => typeof p?.x === "number" && typeof p?.y === "number")
                            .map((p: any) => ({ x: p.x, z: p.y }));

                        if (this.trackPoints.length > 2) {
                            this.state.trackData = data.trackData;

                            const start = this.trackPoints[0] || { x: 0, z: 0 };
                            const next = this.trackPoints[1] || { x: start.x + 1, z: start.z };
                            this.state.startX = start.x;
                            this.state.startZ = start.z;
                            this.state.endX = start.x;
                            this.state.endZ = start.z;
                            this.state.car.x = start.x;
                            this.state.car.z = start.z;
                            this.state.car.speed = 0;
                            this.state.car.accelerating = false;
                            this.state.car.angle = Math.atan2(next.x - start.x, next.z - start.z);
                        }

                        console.log("Track circuit received from driver, points:", this.trackPoints.length);
                    }
                } catch (e) {
                    console.warn("Invalid trackData from driver:", e);
                }
            }
        });

        // Cones/obstacles data from driver - these are the obstacles for NavigatorView
        this.onMessage("cones", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            // Only accept cones from the driver
            if (player && player.role === "driver" && data.conesData) {
                try {
                    const parsed = JSON.parse(data.conesData);
                    if (Array.isArray(parsed)) {
                        // Store the cones data for NavigatorView to use
                        // Note: cones use {x, y} where y = z in server terms
                        this.state.conesData = data.conesData;
                        console.log("Cones received from driver:", parsed.length);
                    }
                } catch (e) {
                    console.warn("Invalid conesData from driver:", e);
                }
            }
        });

        // Cone collision - trigger minigame for ALL players
        this.onMessage("cone_hit", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.role === "driver" && !this.state.minigameActive) {
                // Start minigame
                const sessionId = `mg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.state.minigameActive = true;
                this.state.minigameSessionId = sessionId;
                this.state.minigameResult = "pending";
                
                // Stop the car
                this.state.car.speed = 0;
                
                console.log(`🎮 Minigame triggered for ALL players! Session: ${sessionId}`);
                
                // DUMMY: Auto-resolve after 3 seconds - ALWAYS WIN for testing
                setTimeout(() => {
                    if (this.state.minigameActive && this.state.minigameSessionId === sessionId) {
                        console.log("🎮 Auto-resolving minigame...");
                        this.resolveMinigame(true); // Always win for testing
                    }
                }, 3000);
            }
        });

        // Challenge messages
        this.onMessage("drawing", (client, data) => {
            if (this.state.gamePhase !== "challenge") return;
            const challenge = this.state.challenge;

            if (challenge.phase === "drawing1" && challenge.currentDrawer === client.sessionId) {
                challenge.drawing1Data = data.canvasData;
                // Auto-advance to next phase after receiving drawing
                if (this.challengeTimer) clearTimeout(this.challengeTimer);
                challenge.phase = "drawing2";
                const players = Array.from(this.state.players.values());
                const shuffled = [...players].sort(() => Math.random() - 0.5);
                challenge.currentDrawer = shuffled[1]?.sessionId || shuffled[0]?.sessionId || "";
                challenge.timeLeft = 12000;
                // Restart timer for drawing2
                this.challengeTimer = setTimeout(() => {
                    if (challenge.phase === "drawing2") {
                        challenge.phase = "guessing";
                        challenge.currentGuesser = shuffled[2]?.sessionId || shuffled[0]?.sessionId || "";
                        challenge.timeLeft = 10000;
                        this.challengeTimer = setTimeout(() => {
                            this.endChallenge();
                        }, 10000);
                    }
                }, 12000);
            } else if (challenge.phase === "drawing2" && challenge.currentDrawer === client.sessionId) {
                challenge.drawing2Data = data.canvasData;
                // Auto-advance to guessing phase
                if (this.challengeTimer) clearTimeout(this.challengeTimer);
                challenge.phase = "guessing";
                const players = Array.from(this.state.players.values());
                const shuffled = [...players].sort(() => Math.random() - 0.5);
                challenge.currentGuesser = shuffled[2]?.sessionId || shuffled[0]?.sessionId || "";
                challenge.timeLeft = 10000;
                // Restart timer for guessing
                this.challengeTimer = setTimeout(() => {
                    this.endChallenge();
                }, 10000);
            }
        });

        this.onMessage("guess", (client, data) => {
            if (this.state.gamePhase !== "challenge") return;
            const challenge = this.state.challenge;

            if (challenge.phase === "guessing" && challenge.currentGuesser === client.sessionId) {
                challenge.guess = data.word || "";
                this.endChallenge();
            }
        });

        this.onMessage("start_game", (client, data) => {
            if (this.state.players.size >= 2) {
                this.state.gamePhase = "playing";
                this.spawnChallengePortal();
            }
        });
    }

    update(deltaTime: number) {
        // Allow updates even in lobby for testing
        // if (this.state.gamePhase === "lobby") return;

        const car = this.state.car;
        const deltaSeconds = deltaTime / 1000;

        // FREEZE car during minigame - no physics, no movement
        if (this.state.minigameActive) {
            car.speed = 0;
            car.steeringValue = 0;
            // Still update reward timers
            if (car.clarityTimeLeft > 0) {
                car.clarityTimeLeft -= deltaTime;
                if (car.clarityTimeLeft <= 0) car.clarityActive = false;
            }
            if (car.speedBoostTimeLeft > 0) {
                car.speedBoostTimeLeft -= deltaTime;
                if (car.speedBoostTimeLeft <= 0) car.speedBoostActive = false;
            }
            return; // Skip all physics
        }

        // Update timers
        if (car.turboTimeLeft > 0) {
            car.turboTimeLeft -= deltaTime;
            if (car.turboTimeLeft <= 0) {
                car.turboActive = false;
            }
        }

        if (car.controlsInvertedTimeLeft > 0) {
            car.controlsInvertedTimeLeft -= deltaTime;
            if (car.controlsInvertedTimeLeft <= 0) {
                car.controlsInverted = false;
            }
        }

        if (car.cameraCrazyTimeLeft > 0) {
            car.cameraCrazyTimeLeft -= deltaTime;
            if (car.cameraCrazyTimeLeft <= 0) {
                car.cameraCrazy = false;
            }
        }

        // Clarity timer (reward from minigame)
        if (car.clarityTimeLeft > 0) {
            car.clarityTimeLeft -= deltaTime;
            if (car.clarityTimeLeft <= 0) {
                car.clarityActive = false;
            }
        }

        // Speed boost timer (reward from minigame)
        if (car.speedBoostTimeLeft > 0) {
            car.speedBoostTimeLeft -= deltaTime;
            if (car.speedBoostTimeLeft <= 0) {
                car.speedBoostActive = false;
            }
        }

        // === ARCADE RACING PHYSICS ===
        
        // Acceleration - snappy and responsive
        const maxSpeed = 100;
        const accelRate = 150 * deltaSeconds; // Fast acceleration
        const brakeRate = 100 * deltaSeconds; // Strong brakes
        const friction = 30 * deltaSeconds; // Natural slowdown
        
        if (car.accelerating) {
            car.speed += accelRate;
            if (car.turboActive) {
                car.speed += accelRate * 0.5;
            }
            // Speed boost from minigame win (+20%)
            if (car.speedBoostActive) {
                car.speed += accelRate * 0.2;
            }
        } else {
            // Coast to a stop
            car.speed = Math.max(0, car.speed - friction);
        }
        
        // Speed limits (higher if speed boost active)
        const effectiveMaxSpeed = car.speedBoostActive ? maxSpeed * 1.2 : maxSpeed;
        car.speed = Math.min(car.speed, effectiveMaxSpeed);
        if (car.speed < 1) car.speed = 0;

        // Steering - INVERTED (negative because of coordinate system)
        // More responsive at low speed, tighter at high speed
        if (car.speed > 0.5) {
            const baseSteerRate = 3.5; // Radians per second
            const speedRatio = car.speed / maxSpeed;
            // At low speed: turn faster. At high speed: turn slower
            const steerMultiplier = 1.5 - speedRatio * 0.8;
            // NEGATIVE to fix inversion
            const steerAmount = -car.steeringValue * baseSteerRate * deltaSeconds * steerMultiplier;
            car.angle += steerAmount;
        }

        // Movement - direct and responsive
        const moveMultiplier = 4.0; // Makes car feel fast
        const velocity = car.speed * deltaSeconds * moveMultiplier;
        car.x += Math.sin(car.angle) * velocity;
        car.z += Math.cos(car.angle) * velocity;

        // Check if car crashed (off road) - push back to road gently
        if (!this.isOnRoad(car.x, car.z)) {
            const respawnPoint = this.getNearestRoadPoint(car.x, car.z);
            // Smoothly push car back to road instead of teleporting
            const pushStrength = 0.3;
            car.x = car.x + (respawnPoint.x - car.x) * pushStrength;
            car.z = car.z + (respawnPoint.z - car.z) * pushStrength;
            // Small speed penalty
            car.speed *= 0.95;
        }
        
        // Cap speed (no minimum - allow complete stop)
        car.speed = Math.min(car.speed, 100);
        if (car.speed < 0.5) car.speed = 0;

        // === LAP TRACKING ===
        if (this.state.gamePhase === "playing" && !this.state.raceFinished && this.trackPoints.length > 10) {
            // Update race time
            this.state.raceTime += deltaTime;
            
            // Calculate progress around track (0 to 1)
            const progress = this.getTrackProgress(car.x, car.z);
            const oldProgress = this.state.raceProgress;
            
            const totalSegments = this.trackPoints.length;
            const currentSegment = Math.floor(progress * totalSegments);
            
            // === INVISIBLE BARRIER AT START ===
            // If player hasn't passed checkpoint 25% yet and tries to go backwards (progress > 0.9)
            // Push them back to the start
            const checkpoint25 = Math.floor(totalSegments * 0.25);
            const tryingToGoBackwardsAtStart = this.state.lastCheckpoint < checkpoint25 && progress > 0.85;
            
            if (tryingToGoBackwardsAtStart) {
                // Push car back to start position
                const startPoint = this.trackPoints[5]; // A bit ahead of start
                const nextPoint = this.trackPoints[6];
                if (startPoint && nextPoint) {
                    car.x = startPoint.x;
                    car.z = startPoint.z;
                    car.angle = Math.atan2(nextPoint.x - startPoint.x, nextPoint.z - startPoint.z);
                    car.speed = 0;
                    console.log("🚧 BARRIER: Player tried to go backwards at start!");
                }
                return; // Skip rest of lap tracking
            }
            
            this.state.raceProgress = progress;
            
            // ANTI-CHEAT: Must pass mandatory checkpoints in order
            // Checkpoint 1: 25% of track
            // Checkpoint 2: 50% of track  
            // Checkpoint 3: 75% of track
            // Only then can you cross the finish line
            
            const checkpoint50 = Math.floor(totalSegments * 0.50);
            const checkpoint75 = Math.floor(totalSegments * 0.75);
            
            // Update checkpoint only if moving FORWARD (progress increasing, not wrapping)
            const isMovingForward = (progress > oldProgress && progress - oldProgress < 0.5) ||
                                    (oldProgress > 0.9 && progress < 0.1); // Wrapping around finish
            
            if (isMovingForward) {
                // Track highest checkpoint reached
                if (currentSegment >= checkpoint25 && this.state.lastCheckpoint < checkpoint25) {
                    this.state.lastCheckpoint = checkpoint25;
                    console.log("Checkpoint 25% passed!");
                }
                if (currentSegment >= checkpoint50 && this.state.lastCheckpoint < checkpoint50) {
                    this.state.lastCheckpoint = checkpoint50;
                    console.log("Checkpoint 50% passed!");
                }
                if (currentSegment >= checkpoint75 && this.state.lastCheckpoint < checkpoint75) {
                    this.state.lastCheckpoint = checkpoint75;
                    console.log("Checkpoint 75% passed!");
                }
            }
            
            // Detect lap completion (crossing from ~0.95 to ~0.05)
            // MUST have passed all 3 checkpoints (75% checkpoint = all checkpoints passed)
            const crossedFinishLine = oldProgress > 0.9 && progress < 0.1;
            const hasPassedAllCheckpoints = this.state.lastCheckpoint >= checkpoint75;
            
            if (crossedFinishLine && hasPassedAllCheckpoints) {
                this.state.currentLap++;
                this.state.lastCheckpoint = 0; // Reset checkpoints for next lap
                
                console.log(`LAP ${this.state.currentLap} COMPLETED! Time: ${(this.state.raceTime / 1000).toFixed(2)}s`);
                
                // Check for win
                if (this.state.currentLap >= this.state.totalLaps) {
                    this.state.raceFinished = true;
                    this.state.gamePhase = "finished";
                    console.log("RACE FINISHED! Winner!");
                }
            }
        }

        // Challenge portal collision
        if (this.state.challengePortalActive && this.state.gamePhase === "playing") {
            const dx = car.x - this.state.challengePortalX;
            const dz = car.z - this.state.challengePortalZ;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 3) {
                this.startChallenge();
            }
        }

        // Trap spawning (ahead of car)
        if (Math.random() < 0.01 && this.state.gamePhase === "playing") {
            const trap = new Trap();
            const dist = 20 + Math.random() * 15;
            const angle = car.angle + (Math.random() - 0.5) * 0.8;
            trap.x = car.x + Math.sin(angle) * dist;
            trap.z = car.z + Math.cos(angle) * dist;
            
            const trapTypes: string[] = ["spike", "puddle", "spin", "radio"];
            const randomType = trapTypes[Math.floor(Math.random() * trapTypes.length)];
            trap.type = randomType || "spike";
            trap.radius = 2;
            trap.duration = 5000;

            const id = Math.random().toString(36).substr(2, 9);
            this.state.traps.set(id, trap);

            // Cleanup old traps
            if (this.state.traps.size > 15) {
                const firstKey = this.state.traps.keys().next().value;
                if (firstKey) this.state.traps.delete(firstKey);
            }
        }

        // Trap collision detection
        this.state.traps.forEach((trap, key) => {
            const dx = car.x - trap.x;
            const dz = car.z - trap.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < trap.radius) {
                this.applyTrapEffect(trap.type);
                this.state.traps.delete(key);
            }
        });
        
        // Final speed cap
        car.speed = Math.min(car.speed, 100);
        if (car.speed < 0.5) car.speed = 0;
    }

    applyTrapEffect(type: string) {
        const car = this.state.car;

        switch (type) {
            case "spike":
                // Invert controls for 5 seconds
                car.controlsInverted = true;
                car.controlsInvertedTimeLeft = 5000;
                break;
            case "puddle":
                // Spin the car
                car.angle += Math.PI * 0.5;
                break;
            case "spin":
                // Crazy camera for 5 seconds
                car.cameraCrazy = true;
                car.cameraCrazyTimeLeft = 5000;
                break;
            case "radio":
                // Random radio station
                const stations: string[] = ["absurd1", "absurd2", "normal"];
                const randomStation = stations[Math.floor(Math.random() * stations.length)];
                this.state.radioStation = randomStation || "normal";
                break;
        }
    }

    spawnChallengePortal() {
        const car = this.state.car;
        const dist = 30 + Math.random() * 20;
        const angle = car.angle + (Math.random() - 0.5) * 0.5;
        this.state.challengePortalX = car.x + Math.sin(angle) * dist;
        this.state.challengePortalZ = car.z + Math.cos(angle) * dist;
        this.state.challengePortalActive = true;
    }

    startChallenge() {
        if (this.state.players.size < 2) return;

        this.state.gamePhase = "challenge";
        this.state.challengePortalActive = false;
        
        const challenge = this.state.challenge;
        challenge.active = true;
        const randomWord = SAFE_WORDS[Math.floor(Math.random() * SAFE_WORDS.length)];
        challenge.word = randomWord || "coche";
        challenge.phase = "drawing1";
        challenge.drawing1Data = "";
        challenge.drawing2Data = "";
        challenge.guess = "";

        // Slow down car during challenge
        this.state.car.speed *= 0.3;
        // Re-apply speed cap after challenge slowdown - use Math.min to ensure it's always capped
        this.state.car.speed = Math.min(this.state.car.speed, 100);

        // Assign roles for challenge
        const players = Array.from(this.state.players.values());
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        
        challenge.currentDrawer = shuffled[0]?.sessionId || "";
        challenge.timeLeft = 12000; // 12 seconds

        // Start interval to update timeLeft
        if (this.challengeInterval) clearInterval(this.challengeInterval);
        this.challengeInterval = setInterval(() => {
            if (this.state.gamePhase === "challenge" && challenge.active) {
                challenge.timeLeft = Math.max(0, challenge.timeLeft - 100);
                if (challenge.timeLeft <= 0 && this.challengeTimer) {
                    // Timer will handle phase transitions
                }
            } else {
                if (this.challengeInterval) {
                    clearInterval(this.challengeInterval);
                    this.challengeInterval = null;
                }
            }
        }, 100);

        // Start timer for drawing1
        if (this.challengeTimer) clearTimeout(this.challengeTimer);
        this.challengeTimer = setTimeout(() => {
            if (challenge.phase === "drawing1") {
                challenge.phase = "drawing2";
                challenge.currentDrawer = shuffled[1]?.sessionId || shuffled[0]?.sessionId || "";
                challenge.timeLeft = 12000;
                // Start timer for drawing2
                this.challengeTimer = setTimeout(() => {
                    if (challenge.phase === "drawing2") {
                        challenge.phase = "guessing";
                        challenge.currentGuesser = shuffled[2]?.sessionId || shuffled[0]?.sessionId || "";
                        challenge.timeLeft = 10000; // 10 seconds to guess
                        // Start timer for guessing
                        this.challengeTimer = setTimeout(() => {
                            this.endChallenge();
                        }, 10000);
                    }
                }, 12000);
            }
        }, 12000);
    }

    endChallenge() {
        const challenge = this.state.challenge;
        const correct = challenge.guess.toLowerCase().trim() === challenge.word.toLowerCase().trim();

        if (this.challengeTimer) {
            clearTimeout(this.challengeTimer);
            this.challengeTimer = null;
        }

        if (this.challengeInterval) {
            clearInterval(this.challengeInterval);
            this.challengeInterval = null;
        }

        if (correct) {
            // TURBO!
            this.state.car.turboActive = true;
            this.state.car.turboTimeLeft = 10000; // 10 seconds
        } else {
            // PENALTY
            this.state.car.controlsInverted = true;
            this.state.car.controlsInvertedTimeLeft = 8000;
            this.state.car.cameraCrazy = true;
            this.state.car.cameraCrazyTimeLeft = 8000;
            this.state.radioStation = "absurd1";
        }

        challenge.active = false;
        this.state.gamePhase = "playing";
        
        // Spawn new portal
        setTimeout(() => {
            this.spawnChallengePortal();
        }, 5000);
    }

    onJoin(client: Client, options: any) {
        try {
            console.log(client.sessionId, "joined!");
            
            if (!this.state) {
                console.error("State is not initialized!");
                throw new Error("Game state not initialized");
            }
            
            const player = new Player();
            player.sessionId = client.sessionId;

            // Check if joining as explicit spectator (monitor)
            if (options?.role === 'spectator') {
                player.role = 'spectator';
                console.log("Monitor joined as spectator:", client.sessionId);
            } else {
                // Role assignment (only 2 roles: driver and navigator)
                const roles = ["driver", "navigator"];
                const assignedRoles = Array.from(this.state.players.values())
                    .filter(p => p.role !== 'spectator')
                    .map(p => p.role);
                const availableRole = roles.find(r => !assignedRoles.includes(r)) || "spectator";
                player.role = availableRole;
            }

            this.state.players.set(client.sessionId, player);
            
            // Update room info (only count non-spectator players)
            if ((global as any).activeRooms) {
                const roomInfo = (global as any).activeRooms.get(this.roomId);
                if (roomInfo) {
                    const activePlayers = Array.from(this.state.players.values())
                        .filter(p => p.role !== 'spectator').length;
                    roomInfo.players = activePlayers;
                    (global as any).activeRooms.set(this.roomId, roomInfo);
                }
            }
            
            console.log("Assigned role:", player.role, "to", client.sessionId);
            
            // Auto-start game when both driver and navigator have joined
            const activePlayers = Array.from(this.state.players.values())
                .filter(p => p.role !== 'spectator');
            const hasDriver = activePlayers.some(p => p.role === 'driver');
            const hasNavigator = activePlayers.some(p => p.role === 'navigator');
            
            if (hasDriver && hasNavigator && this.state.gamePhase === 'lobby') {
                console.log("🚀 Auto-starting game - both players ready!");
                this.state.gamePhase = 'playing';
                this.spawnChallengePortal();
            }
        } catch (error) {
            console.error("Error in onJoin:", error);
            throw error;
        }
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");
        this.state.players.delete(client.sessionId);
        
        // Update room info (only count non-spectator players)
        if ((global as any).activeRooms) {
            const roomInfo = (global as any).activeRooms.get(this.roomId);
            if (roomInfo) {
                const activePlayers = Array.from(this.state.players.values())
                    .filter(p => p.role !== 'spectator').length;
                roomInfo.players = activePlayers;
                (global as any).activeRooms.set(this.roomId, roomInfo);
            }
        }
    }

    onDispose() {
        console.log("room disposed!");
        
        // Remove room from global map
        if ((global as any).activeRooms) {
            (global as any).activeRooms.delete(this.roomId);
        }
        
        if (this.challengeTimer) {
            clearTimeout(this.challengeTimer);
        }
        if (this.challengeInterval) {
            clearInterval(this.challengeInterval);
        }
    }

    private generateRoomCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Calculate progress around the track (0 to 1)
    private getTrackProgress(x: number, z: number): number {
        if (!this.trackPoints || this.trackPoints.length < 2) return 0;
        
        let minDistSq = Infinity;
        let closestSegment = 0;
        let closestT = 0;

        for (let i = 0; i < this.trackPoints.length; i++) {
            const p1 = this.trackPoints[i]!;
            const p2 = this.trackPoints[(i + 1) % this.trackPoints.length]!;
            const vx = p2.x - p1.x;
            const vz = p2.z - p1.z;
            const l2 = vx * vx + vz * vz;
            if (l2 === 0) continue;

            let t = ((x - p1.x) * vx + (z - p1.z) * vz) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * vx;
            const projZ = p1.z + t * vz;
            const dx = x - projX;
            const dz = z - projZ;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestSegment = i;
                closestT = t;
            }
        }

        // Progress = (segment + t) / total segments
        const progress = (closestSegment + closestT) / this.trackPoints.length;
        return progress;
    }

    // Distance from a point to the procedural track polyline (closed loop)
    private getTrackInfo(x: number, z: number): { dist: number; proj: { x: number; z: number } } {
        if (!this.trackPoints || this.trackPoints.length < 2) {
            return { dist: Infinity, proj: { x, z } };
        }
        let minDistSq = Infinity;
        let closestProj = { x: this.trackPoints[0]!.x, z: this.trackPoints[0]!.z };

        for (let i = 0; i < this.trackPoints.length; i++) {
            const p1 = this.trackPoints[i]!;
            const p2 = this.trackPoints[(i + 1) % this.trackPoints.length]!;
            const vx = p2.x - p1.x;
            const vz = p2.z - p1.z;
            const l2 = vx * vx + vz * vz;
            if (l2 === 0) continue;

            let t = ((x - p1.x) * vx + (z - p1.z) * vz) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * vx;
            const projZ = p1.z + t * vz;
            const dx = x - projX;
            const dz = z - projZ;
            const distSq = dx * dx + dz * dz;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestProj = { x: projX, z: projZ };
            }
        }

        return { dist: Math.sqrt(minDistSq), proj: closestProj };
    }

    private isOnRoad(x: number, z: number): boolean {
        const { dist } = this.getTrackInfo(x, z);
        return dist <= this.TRACK_WIDTH / 2;
    }

    private getNearestRoadPoint(x: number, z: number): { x: number; z: number } {
        const { proj } = this.getTrackInfo(x, z);
        return proj;
    }

    private generateProceduralTrackPoints(): Array<{ x: number; z: number }> {
        const points: Array<{ x: number; z: number }> = [];
        const numPoints = 300;
        const baseRadius = 2500;

        const layers: Array<{ frequency: number; phase: number; amplitude: number }> = [];
        const numLayers = 6;

        for (let i = 0; i < numLayers; i++) {
            layers.push({
                frequency: Math.floor(Math.random() * 10) + 2,
                phase: Math.random() * Math.PI * 2,
                amplitude: (Math.random() * 800 + 400) / (i + 1.5),
            });
        }

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            let radiusOffset = 0;

            for (const layer of layers) {
                radiusOffset += Math.sin(angle * layer.frequency + layer.phase) * layer.amplitude;
            }

            const r = Math.max(800, baseRadius + radiusOffset);
            points.push({
                x: Math.cos(angle) * r,
                z: Math.sin(angle) * r,
            });
        }
        return points;
    }


    // Resolve minigame result (called by HTTP endpoint or dummy timer)
    public resolveMinigame(won: boolean) {
        console.log(`🎮 resolveMinigame called, won=${won}, minigameActive=${this.state.minigameActive}`);
        
        if (!this.state.minigameActive) {
            console.log("❌ Minigame not active, skipping");
            return;
        }
        
        this.state.minigameResult = won ? "won" : "lost";
        
        if (won) {
            // Apply rewards: 8 seconds clarity + 20% speed boost
            this.state.car.clarityActive = true;
            this.state.car.clarityTimeLeft = 8000; // 8 seconds
            this.state.car.speedBoostActive = true;
            this.state.car.speedBoostTimeLeft = 8000; // 8 seconds of speed boost
            console.log(`🏆 Minigame WON! clarityActive=${this.state.car.clarityActive}, clarityTimeLeft=${this.state.car.clarityTimeLeft}`);
        } else {
            console.log(`❌ Minigame LOST!`);
        }
        
        // Reposition car to center of track and freeze controls
        this.repositionCarToTrackCenter();
        
        // Reset all car controls
        this.state.car.steeringValue = 0;
        this.state.car.accelerating = false;
        this.state.car.speed = 0;
        
        // End minigame after 3 seconds cooldown
        setTimeout(() => {
            this.state.minigameActive = false;
            this.state.minigameSessionId = "";
            this.state.minigameResult = "";
            // Reset controls again just to be safe
            this.state.car.steeringValue = 0;
            this.state.car.speed = 0;
            console.log("🎮 Minigame ended, car repositioned, ready to continue!");
        }, 3000);
    }
    
    // Reposition car to the center of the nearest track segment
    private repositionCarToTrackCenter() {
        if (!this.trackPoints || this.trackPoints.length < 2) return;
        
        const car = this.state.car;
        
        // Find the nearest track point
        let minDist = Infinity;
        let nearestIdx = 0;
        
        for (let i = 0; i < this.trackPoints.length; i++) {
            const p = this.trackPoints[i]!;
            const dx = car.x - p.x;
            const dz = car.z - p.z;
            const dist = dx * dx + dz * dz;
            if (dist < minDist) {
                minDist = dist;
                nearestIdx = i;
            }
        }
        
        // Get the track point and the next one to calculate direction
        const currentPoint = this.trackPoints[nearestIdx]!;
        const nextPoint = this.trackPoints[(nearestIdx + 1) % this.trackPoints.length]!;
        
        // Position car at track center
        car.x = currentPoint.x;
        car.z = currentPoint.z;
        
        // Point car in the direction of the track
        car.angle = Math.atan2(nextPoint.x - currentPoint.x, nextPoint.z - currentPoint.z);
        
        // Reset speed
        car.speed = 0;
        
        console.log(`🚗 Car repositioned to track center at (${car.x.toFixed(0)}, ${car.z.toFixed(0)}), angle=${car.angle.toFixed(2)}`);
    }
}
