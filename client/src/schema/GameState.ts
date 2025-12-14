import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("string") role: string = "";
    @type("boolean") connected: boolean = true;
    @type("string") sessionId: string = "";
}

export class Car extends Schema {
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type("number") angle: number = 0;
    @type("number") speed: number = 0;
    @type("number") steeringValue: number = 0;
    @type("boolean") accelerating: boolean = false;
    @type("boolean") turboActive: boolean = false;
    @type("number") turboTimeLeft: number = 0;
    @type("boolean") controlsInverted: boolean = false;
    @type("number") controlsInvertedTimeLeft: number = 0;
    @type("boolean") cameraCrazy: boolean = false;
    @type("number") cameraCrazyTimeLeft: number = 0;
    
    // Minigame rewards
    @type("boolean") clarityActive: boolean = false;
    @type("number") clarityTimeLeft: number = 0;
    @type("boolean") speedBoostActive: boolean = false;
    @type("number") speedBoostTimeLeft: number = 0;
}

export class Trap extends Schema {
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type("string") type: string = "spike";
    @type("number") radius: number = 1.5;
    @type("number") duration: number = 5000;
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Trap }) traps = new MapSchema<Trap>();
    @type(Car) car = new Car();
    @type("string") gamePhase: string = "lobby"; // lobby, playing, finished
    @type("string") radioStation: string = "normal";
    @type("boolean") hornActive: boolean = false;
    @type("boolean") bgmEnabled: boolean = true;
    @type("string") roomCode: string = "";
    @type("number") pathX: number = 0;
    @type("number") pathZ: number = 0;
    @type("number") startX: number = 0;
    @type("number") startZ: number = 0;
    @type("number") endX: number = 100;
    @type("number") endZ: number = 100;
    @type("string") trackData: string = "";
    @type("string") conesData: string = "";
    
    // Race/Lap tracking
    @type("number") currentLap: number = 0;
    @type("number") totalLaps: number = 1;
    @type("number") raceProgress: number = 0;
    @type("number") lastCheckpoint: number = 0;
    @type("boolean") raceFinished: boolean = false;
    @type("number") raceTime: number = 0;
    
    // Minigame state
    @type("boolean") minigameActive: boolean = false;
    @type("string") minigameSessionId: string = "";
    @type("string") minigameResult: string = "";
    @type("string") minigameType: string = ""; // "two-keys-gate", "gomoku-duel"
    @type("string") playedMinigames: string = "[]"; // JSON array of played minigame types
}
