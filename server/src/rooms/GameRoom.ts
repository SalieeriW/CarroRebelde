import { Room, Client } from "colyseus";
import { GameState, Player, Trap, Challenge } from "./schema/GameState";

// Safe words for challenges
const SAFE_WORDS = [
    "coche", "sol", "casa", "árbol", "perro", "gato", "estrella", "luna",
    "flor", "mar", "montaña", "nube", "corazón", "sonrisa", "libro", "pelota",
    "avión", "barco", "tren", "bicicleta", "helado", "tarta", "regalo", "globo"
];

export class GameRoom extends Room<GameState> {
    maxClients = 4;
    private challengeTimer: NodeJS.Timeout | null = null;
    private challengeInterval: NodeJS.Timeout | null = null;
    private trapEffects: Map<string, NodeJS.Timeout> = new Map();
    public roomCode: string = "";

    onCreate(options: any) {
        this.setState(new GameState());
        
        // Generate room code
        this.roomCode = this.generateRoomCode();
        this.state.roomCode = this.roomCode;
        
        // Set start point (A)
        this.state.startX = 0;
        this.state.startZ = 0;
        this.state.car.x = 0;
        this.state.car.z = 0;
        
        // Set end point (B) - destination
        this.state.endX = 200;
        this.state.endZ = 200;
        
        // Generate road path with walls
        this.generateRoadPath();
        
        // Store room info globally
        if ((global as any).activeRooms) {
            (global as any).activeRooms.set(this.roomId, {
                roomId: this.roomId,
                code: this.roomCode,
                players: 0
            });
        }
        
        console.log("Room created with code:", this.roomCode);

        // Game Loop (50ms = 20fps)
        this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);

        // Input handling
        this.onMessage("input", (client, data) => {
            if (this.state.gamePhase !== "playing") return;

            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            if (player.role === "driver") {
                if (data.steer !== undefined) {
                    let steerValue = data.steer;
                    // Invert controls if penalty active
                    if (this.state.car.controlsInverted) {
                        steerValue = -steerValue;
                    }
                    this.state.car.steeringValue = steerValue;
                }
            } else if (player.role === "accelerator") {
                if (data.accelerate !== undefined) {
                    if (data.accelerate) {
                        const baseAccel = 0.5;
                        const turboMultiplier = this.state.car.turboActive ? 2 : 1;
                        this.state.car.speed += baseAccel * turboMultiplier;
                        // Cap max speed
                        if (this.state.car.speed > 15) {
                            this.state.car.speed = 15;
                        }
                    }
                }
            }
        });

        // Copilot controls
        this.onMessage("horn", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.role === "copilot") {
                this.state.hornActive = data.active || false;
            }
        });

        this.onMessage("radio", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.role === "copilot") {
                this.state.radioStation = data.station || "normal";
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
        if (this.state.gamePhase === "lobby") return;

        const car = this.state.car;
        const deltaSeconds = deltaTime / 1000;

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

        // Friction (car never stops completely, minimum speed)
        car.speed *= 0.98;
        if (car.speed < 0.1) car.speed = 0.1;

        // Steering - apply steering value to angle
        const steeringSpeed = 0.08 * (car.speed > 0.1 ? 1 : 0);
        car.angle += car.steeringValue * steeringSpeed;

        // Movement
        const oldX = car.x;
        const oldZ = car.z;
        
        car.x += Math.sin(car.angle) * car.speed * deltaSeconds * 60;
        car.z += Math.cos(car.angle) * car.speed * deltaSeconds * 60;

        // Check if car crashed (off road)
        if (!this.isOnRoad(car.x, car.z)) {
            // Respawn at nearest road point
            const respawnPoint = this.getNearestRoadPoint(car.x, car.z);
            car.x = respawnPoint.x;
            car.z = respawnPoint.z;
            car.speed = 0.5; // Slow down after respawn
            console.log("Car crashed! Respawned at", car.x, car.z);
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
        console.log(client.sessionId, "joined!");
        const player = new Player();
        player.sessionId = client.sessionId;

        // Role assignment
        const roles = ["driver", "accelerator", "copilot", "navigator"];
        const assignedRoles = Array.from(this.state.players.values()).map(p => p.role);
        const availableRole = roles.find(r => !assignedRoles.includes(r)) || "spectator";

        player.role = availableRole;
        this.state.players.set(client.sessionId, player);
        
        // Update room info
        if ((global as any).activeRooms) {
            const roomInfo = (global as any).activeRooms.get(this.roomId);
            if (roomInfo) {
                roomInfo.players = this.state.players.size;
                (global as any).activeRooms.set(this.roomId, roomInfo);
            }
        }
        
        console.log("Assigned role:", availableRole, "to", client.sessionId);
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");
        this.state.players.delete(client.sessionId);
        
        // Update room info
        if ((global as any).activeRooms) {
            const roomInfo = (global as any).activeRooms.get(this.roomId);
            if (roomInfo) {
                roomInfo.players = this.state.players.size;
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

    private generateRoadPath() {
        // Create F1-style circuit with clear road
        // Simple oval circuit for now
        const centerX = 100;
        const centerZ = 100;
        const radiusX = 80;
        const radiusZ = 60;
        
        // Start and end at same point (circuit)
        this.state.startX = centerX;
        this.state.startZ = centerZ - radiusZ;
        this.state.endX = centerX;
        this.state.endZ = centerZ - radiusZ;
        
        // Set car at start
        this.state.car.x = this.state.startX;
        this.state.car.z = this.state.startZ;
        this.state.car.angle = 0;
        
        this.state.pathX = this.state.endX;
        this.state.pathZ = this.state.endZ;
    }

    // Check if car is on road (inside walls)
    private isOnRoad(x: number, z: number): boolean {
        // Simple check: car should be within road boundaries
        // For oval circuit: check if inside ellipse
        const centerX = 100;
        const centerZ = 100;
        const radiusX = 80;
        const radiusZ = 60;
        const roadWidth = 8;
        
        const dx = (x - centerX) / (radiusX + roadWidth);
        const dz = (z - centerZ) / (radiusZ + roadWidth);
        const dist = dx * dx + dz * dz;
        
        // Check if inside outer ellipse but outside inner ellipse
        const outerDist = dx * dx + dz * dz;
        const innerDx = (x - centerX) / (radiusX - roadWidth);
        const innerDz = (z - centerZ) / (radiusZ - roadWidth);
        const innerDist = innerDx * innerDx + innerDz * innerDz;
        
        return outerDist <= 1 && innerDist >= 1;
    }

    // Get nearest road point for respawn
    private getNearestRoadPoint(x: number, z: number): { x: number, z: number } {
        // Find nearest point on road circuit
        const centerX = 100;
        const centerZ = 100;
        const radiusX = 80;
        const radiusZ = 60;
        
        // Calculate angle from center
        const dx = x - centerX;
        const dz = z - centerZ;
        const angle = Math.atan2(dx, dz);
        
        // Project to road center
        const roadX = centerX + Math.sin(angle) * radiusX;
        const roadZ = centerZ + Math.cos(angle) * radiusZ;
        
        return { x: roadX, z: roadZ };
    }
}
