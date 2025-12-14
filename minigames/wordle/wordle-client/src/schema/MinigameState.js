import { Schema, MapSchema } from "@colyseus/schema";

export class MinigamePlayer extends Schema {
  constructor() {
    super();
    this.sessionId = "";
    this.connected = true;
    this.role = "";
  }
}

export class MinigameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.gamePhase = "waiting";
    this.selectedMinigame = 0;
    this.roomCode = "";
    this.gameData = "{}";
    this.score = 0;
    this.gameCompleted = false;
    this.timeLeft = 0;
  }
}

