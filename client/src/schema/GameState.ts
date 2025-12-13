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
    @type("boolean") turboActive: boolean = false;
    @type("number") turboTimeLeft: number = 0;
    @type("boolean") controlsInverted: boolean = false;
    @type("number") controlsInvertedTimeLeft: number = 0;
    @type("boolean") cameraCrazy: boolean = false;
    @type("number") cameraCrazyTimeLeft: number = 0;
}

export class Trap extends Schema {
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type("string") type: string = "spike";
    @type("number") radius: number = 1.5;
    @type("number") duration: number = 5000;
}

export class Challenge extends Schema {
    @type("string") word: string = "";
    @type("string") phase: string = "waiting";
    @type("string") currentDrawer: string = "";
    @type("string") currentGuesser: string = "";
    @type("number") timeLeft: number = 0;
    @type("string") drawing1Data: string = "";
    @type("string") drawing2Data: string = "";
    @type("string") guess: string = "";
    @type("boolean") active: boolean = false;
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Trap }) traps = new MapSchema<Trap>();
    @type(Car) car = new Car();
    @type("string") gamePhase: string = "lobby";
    @type(Challenge) challenge = new Challenge();
    @type("number") challengePortalX: number = 0;
    @type("number") challengePortalZ: number = 0;
    @type("boolean") challengePortalActive: boolean = false;
    @type("string") radioStation: string = "normal";
    @type("boolean") hornActive: boolean = false;
    @type("string") roomCode: string = "";
    @type("number") pathX: number = 0;
    @type("number") pathZ: number = 0;
    @type("number") startX: number = 0;
    @type("number") startZ: number = 0;
    @type("number") endX: number = 100;
    @type("number") endZ: number = 100;
}
