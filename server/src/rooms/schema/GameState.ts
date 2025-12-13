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
    @type("number") steeringValue: number = 0; // -1 to 1
    @type("boolean") accelerating: boolean = false;
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
    @type("string") type: string = "spike"; // spike, puddle, spin, radio
    @type("number") radius: number = 1.5;
    @type("number") duration: number = 5000; // milliseconds
}

export class Challenge extends Schema {
    @type("string") word: string = "";
    @type("string") phase: string = "waiting"; // waiting, drawing1, drawing2, guessing
    @type("string") currentDrawer: string = ""; // sessionId
    @type("string") currentGuesser: string = ""; // sessionId
    @type("number") timeLeft: number = 0; // milliseconds
    @type("string") drawing1Data: string = ""; // base64 canvas data
    @type("string") drawing2Data: string = ""; // base64 canvas data
    @type("string") guess: string = "";
    @type("boolean") active: boolean = false;
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Trap }) traps = new MapSchema<Trap>();
    @type(Car) car = new Car();
    @type("string") gamePhase: string = "lobby"; // lobby, playing, challenge
    @type(Challenge) challenge = new Challenge();
    @type("number") challengePortalX: number = 0;
    @type("number") challengePortalZ: number = 0;
    @type("boolean") challengePortalActive: boolean = false;
    @type("string") radioStation: string = "normal"; // normal, absurd1, absurd2
    @type("boolean") hornActive: boolean = false;
    @type("string") roomCode: string = ""; // Código de la sala
    @type("number") pathX: number = 0; // Para el mapa del navegador
    @type("number") pathZ: number = 0;
    @type("number") startX: number = 0; // Punto A (inicio)
    @type("number") startZ: number = 0;
    @type("number") endX: number = 100; // Punto B (destino)
    @type("number") endZ: number = 100;
    @type({ map: "number" }) roadPath = new MapSchema<number>(); // Puntos de la carretera
}
