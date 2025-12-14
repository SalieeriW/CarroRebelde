import { Schema, type, ArraySchema } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') sessionId: string = '';
  @type(['string']) selectedAnswer = new ArraySchema<string>();
  @type('number') confirmedAt: number = 0;
  @type('boolean') isReady: boolean = false;
  @type('string') role: string = ''; // 'A' or 'B'
}

export class ChatMessage extends Schema {
  @type('string') role: string = '';
  @type('string') text: string = '';
  @type('number') timestamp: number = 0;
}

export class TwoKeysState extends Schema {
  @type('string') sessionCode: string = '';
  @type('number') levelId: number = 1;
  @type('string') phase: string = 'lobby'; // lobby, briefing/countdown, active, sync_confirm, success, retry
  @type('number') startAt: number = 0; // epoch ms for countdown target
  @type('number') countdownMs: number = 0;

  @type(PlayerState) playerA = new PlayerState();
  @type(PlayerState) playerB = new PlayerState();

  @type('string') moderatorId: string = '';
  @type('number') hintCount: number = 0;
  @type('number') createdAt: number = Date.now();

  @type('string') currentHint: string = '';
  @type('string') resultMessage: string = '';
  @type('boolean') resultSuccess: boolean = false;

  @type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
  @type('number') playersConnected: number = 0;
}
