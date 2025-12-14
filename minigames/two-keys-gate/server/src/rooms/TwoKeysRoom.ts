import { Room, Client } from 'colyseus';
import { TwoKeysState, PlayerState, ChatMessage } from '../schema/TwoKeysState';
import levelData from '../../../shared/levelData.json';

export class TwoKeysRoom extends Room<TwoKeysState> {
  maxClients = 3; // 2 players + 1 moderator
  private countdownTimeout: any = null;
  private readonly START_DELAY_MS = 5000;

  onCreate(options: any) {
    this.setState(new TwoKeysState());

    // Generate random 6-character session code
    this.state.sessionCode = this.generateSessionCode();
    this.state.levelId = options.levelId || 1;
    this.state.phase = 'lobby';
    this.state.createdAt = Date.now();
    this.state.startAt = 0;
    this.state.countdownMs = 0;
    // Expose session code so clients can discover/join via getAvailableRooms
    this.setMetadata({ sessionCode: this.state.sessionCode });

    console.log(`[TwoKeysRoom] Created room ${this.roomId} with code ${this.state.sessionCode}`);

    // Message handlers
    this.onMessage('select_answer', (client, data) => {
      this.handleSelectAnswer(client, data);
    });

    this.onMessage('confirm_answer', (client) => {
      this.handleConfirmAnswer(client);
    });

    this.onMessage('chat_message', (client, data) => {
      this.handleChatMessage(client, data);
    });

    this.onMessage('player_ready', (client, data) => {
      this.handlePlayerReady(client, data);
    });

    this.onMessage('start_game', (client) => {
      // Backward compatibility: treat as start request when both ready
      this.handleStartRequest(client);
    });

    this.onMessage('start_request', (client) => {
      this.handleStartRequest(client);
    });

    this.onMessage('claim_role', (client, data) => {
      this.handleClaimRole(client, data);
    });

    this.onMessage('release_role', (client, data) => {
      this.handleReleaseRole(client, data);
    });

    this.onMessage('moderator_hint', (client, data) => {
      if (this.isModerator(client)) {
        this.sendHint(data.hint);
      }
    });

    this.onMessage('moderator_unlock', (client) => {
      if (this.isModerator(client)) {
        this.unlockAndContinue();
      }
    });

    this.onMessage('moderator_end_session', (client) => {
      if (this.isModerator(client)) {
        this.broadcast('session_ended', {
          message: 'El moderador ha finalizado la sesión.'
        });
        this.disconnect();
      }
    });

    // Auto-cleanup after 30 minutes
    this.clock.setTimeout(() => {
      console.log(`[TwoKeysRoom] Room ${this.roomId} expired after 30 minutes`);
      this.disconnect();
    }, 30 * 60 * 1000);
  }

  onJoin(client: Client, options: any) {
    console.log(`[TwoKeysRoom] Client ${client.sessionId} joining`);

    // Check if moderator
    if (options.isModerator) {
      this.state.moderatorId = client.sessionId;
      client.send('role_assigned', { role: 'moderator' });
      return;
    }

    // No auto-assignment; clients claim seats from lobby.
    client.send('session_info', {
      sessionCode: this.state.sessionCode,
      phase: this.state.phase
    });
  }

  handleClaimRole(client: Client, data: any) {
    const desiredRole = (data?.role || '').toUpperCase();
    if (desiredRole !== 'A' && desiredRole !== 'B') return;

    const target = desiredRole === 'A' ? this.state.playerA : this.state.playerB;
    if (target.sessionId && target.sessionId !== client.sessionId) {
      client.send('role_denied', { role: desiredRole });
      return;
    }

    // If the same client already owns the other seat, free it
    const other = desiredRole === 'A' ? this.state.playerB : this.state.playerA;
    if (other.sessionId === client.sessionId) {
      this.resetPlayer(other, desiredRole === 'A' ? 'B' : 'A');
    }

    this.resetPlayer(target, desiredRole as 'A' | 'B');
    target.sessionId = client.sessionId;
    target.role = desiredRole;
    this.state.playersConnected = this.countConnectedPlayers();
    this.cancelCountdownIfNeeded();

    client.send('role_assigned', {
      role: desiredRole,
      sessionCode: this.state.sessionCode
    });
  }

  handleReleaseRole(client: Client, data: any) {
    const role = (data?.role || '').toUpperCase();
    if (role === 'A' && this.state.playerA.sessionId === client.sessionId) {
      this.resetPlayer(this.state.playerA, 'A');
    }
    if (role === 'B' && this.state.playerB.sessionId === client.sessionId) {
      this.resetPlayer(this.state.playerB, 'B');
    }
    if (!role) {
      if (this.state.playerA.sessionId === client.sessionId) {
        this.resetPlayer(this.state.playerA, 'A');
      }
      if (this.state.playerB.sessionId === client.sessionId) {
        this.resetPlayer(this.state.playerB, 'B');
      }
    }
    this.state.playersConnected = this.countConnectedPlayers();
    this.cancelCountdownIfNeeded();
  }

  handlePlayerReady(client: Client, data: any) {
    const player = this.getPlayerState(client);
    if (player) {
      player.isReady = data?.ready === false ? false : true;
      console.log(`[TwoKeysRoom] Player ${player.role} is ready: ${player.isReady}`);
      if (!player.isReady) {
        this.cancelCountdownIfNeeded();
      }
    }
  }

  handleStartRequest(client: Client) {
    const aReady = this.state.playerA.sessionId && this.state.playerA.isReady;
    const bReady = this.state.playerB.sessionId && this.state.playerB.isReady;

    if (!aReady || !bReady) {
      client.send('start_rejected', { reason: 'Players not ready' });
      return;
    }

    if (this.state.phase === 'briefing' && this.state.startAt > Date.now()) {
      return;
    }

    this.state.phase = 'briefing';
    this.state.countdownMs = this.START_DELAY_MS;
    this.state.startAt = Date.now() + this.START_DELAY_MS;
    console.log(`[TwoKeysRoom] Countdown started, game begins at ${this.state.startAt}`);

    if (this.countdownTimeout) {
      this.countdownTimeout.clear();
      this.countdownTimeout = null;
    }
    this.countdownTimeout = this.clock.setTimeout(() => {
      this.state.phase = 'active';
      this.state.countdownMs = 0;
      this.state.startAt = 0;
      console.log(`[TwoKeysRoom] Game started after countdown`);
    }, this.START_DELAY_MS);
  }

  handleStartGame(client: Client) {
    // Manual start for backward compatibility
    if (this.state.phase === 'briefing') {
      this.state.phase = 'active';
      this.state.countdownMs = 0;
      this.state.startAt = 0;
      console.log(`[TwoKeysRoom] Game started manually`);
      if (this.countdownTimeout) {
        this.countdownTimeout.clear();
        this.countdownTimeout = null;
      }
    }
  }

  handleSelectAnswer(client: Client, data: any) {
    const player = this.getPlayerState(client);
    if (!player) return;

    player.selectedAnswer.clear();
    data.answer.forEach((item: string) => {
      player.selectedAnswer.push(item);
    });

    console.log(`[TwoKeysRoom] Player ${player.role} selected: ${data.answer.join(', ')}`);

    this.broadcast('answer_updated', {
      role: player.role,
      answer: data.answer
    });
  }

  handleConfirmAnswer(client: Client) {
    const player = this.getPlayerState(client);
    if (!player) return;

    player.confirmedAt = Date.now();
    console.log(`[TwoKeysRoom] Player ${player.role} confirmed answer`);

    this.broadcast('player_confirmed', { role: player.role });

    // Check if both players confirmed
    if (this.state.playerA.confirmedAt && this.state.playerB.confirmedAt) {
      const timeDiff = Math.abs(
        this.state.playerA.confirmedAt - this.state.playerB.confirmedAt
      );

      console.log(`[TwoKeysRoom] Both players confirmed. Time diff: ${timeDiff}ms`);

      if (timeDiff < 10000) { // 10 second sync window
        this.state.phase = 'sync_confirm';
        this.broadcast('sync_started', {});

        // Check answer after animation
        this.clock.setTimeout(() => {
          this.checkAnswer();
        }, 1500);
      } else {
        this.broadcast('sync_failed', {
          message: 'Necesitamos sincronizarnos mejor. ¡Intentemos de nuevo!'
        });
        this.resetConfirmations();
      }
    }
  }

  handleChatMessage(client: Client, data: any) {
    const player = this.getPlayerState(client);
    if (!player) return;

    const message = new ChatMessage();
    message.role = player.role;
    message.text = data.text.substring(0, 100); // Limit to 100 chars
    message.timestamp = Date.now();

    this.state.chatMessages.push(message);

    // Keep only last 20 messages
    if (this.state.chatMessages.length > 20) {
      this.state.chatMessages.shift();
    }

    console.log(`[TwoKeysRoom] Chat from ${player.role}: ${message.text}`);
  }

  checkAnswer() {
    const level = levelData.levels[this.state.levelId - 1];
    const correctAnswer = level.correctAnswer;

    const playerA_answer = Array.from(this.state.playerA.selectedAnswer);
    const playerB_answer = Array.from(this.state.playerB.selectedAnswer);

    console.log(`[TwoKeysRoom] Checking answer:`);
    console.log(`  Player A: ${playerA_answer.join(', ')}`);
    console.log(`  Player B: ${playerB_answer.join(', ')}`);
    console.log(`  Correct: ${correctAnswer.join(', ')}`);

    // Check if both players have same answer
    if (JSON.stringify(playerA_answer) !== JSON.stringify(playerB_answer)) {
      this.state.phase = 'retry';
      this.state.resultSuccess = false;
      this.state.resultMessage = 'Parece que eligieron respuestas diferentes. Revisen juntos.';

      this.broadcast('result', {
        success: false,
        message: this.state.resultMessage
      });

      this.resetConfirmations();
      this.clock.setTimeout(() => {
        this.state.phase = 'active';
      }, 3000);
      return;
    }

    // Check if answer is correct
    if (JSON.stringify(playerA_answer) === JSON.stringify(correctAnswer)) {
      this.state.phase = 'success';
      this.state.resultSuccess = true;
      this.state.resultMessage = level.successMessage;

      this.broadcast('result', {
        success: true,
        message: this.state.resultMessage
      });

      console.log(`[TwoKeysRoom] SUCCESS! Correct answer`);

      // Return to mainboard after 5 seconds
      this.clock.setTimeout(() => {
        this.broadcast('exit_to_mainboard', {});
      }, 5000);
    } else {
      this.state.phase = 'retry';
      this.state.resultSuccess = false;
      this.state.hintCount++;

      const hint = this.getHint(level);
      this.state.currentHint = hint;
      this.state.resultMessage = level.retryMessage;

      this.broadcast('result', {
        success: false,
        message: this.state.resultMessage,
        hint: hint
      });

      console.log(`[TwoKeysRoom] Wrong answer. Hint count: ${this.state.hintCount}`);

      this.resetConfirmations();
      this.clock.setTimeout(() => {
        this.state.phase = 'active';
      }, 3000);
    }
  }

  getHint(level: any): string {
    if (this.state.hintCount === 1) {
      return level.hints.generic;
    } else if (this.state.hintCount === 2) {
      return level.hints.specific;
    } else {
      return level.hints.stepByStep;
    }
  }

  sendHint(hint: string) {
    this.state.currentHint = hint;
    this.broadcast('moderator_hint', { hint });
    console.log(`[TwoKeysRoom] Moderator sent hint: ${hint}`);
  }

  unlockAndContinue() {
    const level = levelData.levels[this.state.levelId - 1];

    this.state.phase = 'success';
    this.state.resultSuccess = true;
    this.state.resultMessage = '¡No pasa nada! A veces las señales son difíciles de descifrar. Continuemos...';

    this.broadcast('moderator_unlocked', {
      message: this.state.resultMessage,
      correctAnswer: level.correctAnswer
    });

    console.log(`[TwoKeysRoom] Moderator unlocked the level`);

    // Return to mainboard after 5 seconds
    this.clock.setTimeout(() => {
      this.broadcast('exit_to_mainboard', {});
    }, 5000);
  }

  resetConfirmations() {
    this.state.playerA.confirmedAt = 0;
    this.state.playerB.confirmedAt = 0;
  }

  getPlayerState(client: Client): PlayerState | null {
    if (client.sessionId === this.state.playerA.sessionId) {
      return this.state.playerA;
    }
    if (client.sessionId === this.state.playerB.sessionId) {
      return this.state.playerB;
    }
    return null;
  }

  isModerator(client: Client): boolean {
    return client.sessionId === this.state.moderatorId;
  }

  generateSessionCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.getPlayerState(client);

    if (player) {
      console.log(`[TwoKeysRoom] Player ${player.role} left`);
      this.resetPlayer(player, player.role as 'A' | 'B');
      this.state.playersConnected = this.countConnectedPlayers();
      this.cancelCountdownIfNeeded();

      this.broadcast('player_left', {
        role: player.role,
        message: 'Tu compañero se ha desconectado. Puedes esperar o volver al tablero.'
      });
    }
  }

  onDispose() {
    console.log(`[TwoKeysRoom] Room ${this.roomId} disposed`);
  }

  private resetPlayer(player: PlayerState, role: 'A' | 'B') {
    player.sessionId = '';
    player.role = role;
    player.isReady = false;
    player.confirmedAt = 0;
    player.selectedAnswer.clear();
  }

  private countConnectedPlayers(): number {
    let count = 0;
    if (this.state.playerA.sessionId) count++;
    if (this.state.playerB.sessionId) count++;
    return count;
  }

  private cancelCountdownIfNeeded() {
    if (this.countdownTimeout) {
      this.countdownTimeout.clear();
      this.countdownTimeout = null;
    }
    if (this.state.phase === 'briefing') {
      this.state.phase = 'lobby';
    }
    this.state.startAt = 0;
    this.state.countdownMs = 0;
  }
}
