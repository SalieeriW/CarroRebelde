import Phaser from 'phaser';
import Hook from '../gameObjects/Hook';
import MineObject from '../gameObjects/MineObject';

export default class CoopMinerScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoopMinerScene' });
    this.hook = null;
    this.mineObjects = [];
    this.myRole = null;
    this.gameState = null;
    this.boosting = false;
  }

  init(data) {
    this.myRole = data.myRole || null;
    this.gameState = data.gameState || null;
    this.onObjectCollected = data.onObjectCollected || null;
    this.onHookStateUpdate = data.onHookStateUpdate || null;
    this.onMarkTarget = data.onMarkTarget || null;
    this.lastHookSync = 0;
  }

  create() {
    // Background
    this.add.rectangle(400, 300, 800, 600, 0x8B7355);

    // Ground line
    this.add.rectangle(400, 120, 800, 4, 0x654321);

    // Underground area
    const underground = this.add.rectangle(400, 360, 800, 480, 0xD4A574);
    underground.setAlpha(0.8);

    // Miner character
    this.minerText = this.add.text(400, 80, '👷', {
      fontSize: '48px',
    });
    this.minerText.setOrigin(0.5);

    // Create hook
    this.hook = new Hook(this, 400, 120);

    // Setup keyboard controls
    this.setupControls();

    // Create mine objects if gameState is provided
    if (this.gameState && this.gameState.objects) {
      this.createMineObjects(this.gameState.objects);
    }

    // UI Text for controls
    this.createUI();

    // Setup click handler for player B to mark targets
    if (this.myRole === 'B') {
      this.input.on('pointerdown', this.handleClick, this);
    }
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    // Player A: Controls angle (left/right) and launch (space)
    this.input.keyboard.on('keydown-LEFT', () => {
      if (this.myRole === 'A' && (this.hook.state === 'idle' || this.hook.state === 'swinging')) {
        this.hook.startSwinging();
        this.hook.swingDirection = -1;
      }
    });

    this.input.keyboard.on('keydown-RIGHT', () => {
      if (this.myRole === 'A' && (this.hook.state === 'idle' || this.hook.state === 'swinging')) {
        this.hook.startSwinging();
        this.hook.swingDirection = 1;
      }
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.myRole === 'A') {
        this.hook.launch();
      }
    });

    // Player B: Boost controls
    this.input.keyboard.on('keydown-SHIFT', () => {
      if (this.myRole === 'B') {
        this.boosting = true;
        this.hook.setBoost(true);
      }
    });

    this.input.keyboard.on('keyup-SHIFT', () => {
      if (this.myRole === 'B') {
        this.boosting = false;
        this.hook.setBoost(false);
      }
    });

    this.input.keyboard.on('keydown-DOWN', () => {
      if (this.myRole === 'B') {
        this.boosting = true;
        this.hook.setBoost(true);
      }
    });

    this.input.keyboard.on('keyup-DOWN', () => {
      if (this.myRole === 'B') {
        this.boosting = false;
        this.hook.setBoost(false);
      }
    });
  }

  createUI() {
    const controlsY = 570;

    if (this.myRole === 'A') {
      this.controlText = this.add.text(400, controlsY, '[Role A] You see ICONS  |  ← → Angle  |  SPACE Launch', {
        fontSize: '15px',
        fontFamily: 'monospace',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });
      this.controlText.setOrigin(0.5);
    } else if (this.myRole === 'B') {
      this.controlText = this.add.text(400, controlsY, '[Role B] You see VALUES  |  SHIFT/↓ Boost  |  CLICK Mark Target (+5)', {
        fontSize: '14px',
        fontFamily: 'monospace',
        fill: '#ffff00',
        stroke: '#000000',
        strokeThickness: 3,
      });
      this.controlText.setOrigin(0.5);
    }

    // Boost indicator for B
    if (this.myRole === 'B') {
      this.boostIndicator = this.add.text(400, 545, '', {
        fontSize: '14px',
        fill: '#00ff00',
        stroke: '#000000',
        strokeThickness: 2,
      });
      this.boostIndicator.setOrigin(0.5);
    }
  }

  createMineObjects(objectsData) {
    // Clear existing objects
    this.mineObjects.forEach(obj => obj.destroy());
    this.mineObjects = [];

    // Create new objects
    objectsData.forEach(objData => {
      if (!objData.taken) {
        const mineObj = new MineObject(this, objData, this.myRole);
        this.mineObjects.push(mineObj);
      }
    });
  }

  handleClick(pointer) {
    if (this.myRole !== 'B') return;

    const clickX = pointer.x;
    const clickY = pointer.y;

    for (let obj of this.mineObjects) {
      if (!obj.taken && obj.checkCollision(clickX, clickY)) {
        if (this.onMarkTarget) {
          this.onMarkTarget(obj.id);
        }
        break;
      }
    }
  }

  update(time, delta) {
    if (!this.hook) return;

    this.hook.update(delta);

    // Sync hook state to server (Player A only, throttled)
    if (this.myRole === 'A' && this.onHookStateUpdate && time - this.lastHookSync > 100) {
      this.lastHookSync = time;
      this.onHookStateUpdate({
        state: this.hook.state,
        angle: this.hook.angle,
        x: this.hook.x,
        y: this.hook.y,
        boosted: this.hook.boosted,
        attachedObjectId: this.hook.attachedObject?.id || null,
      }).catch(() => {}); // Silently ignore errors
    }

    // Check collisions during descending (only on player A's client to avoid conflicts)
    if (this.myRole === 'A' && this.hook.state === 'descending' && !this.hook.attachedObject) {
      for (let obj of this.mineObjects) {
        if (!obj.taken && obj.checkCollision(this.hook.x, this.hook.y)) {
          this.hook.attachObject(obj);
          this.hook.startRetracting();
          break;
        }
      }
    }

    // Update boost indicator
    if (this.myRole === 'B' && this.boostIndicator) {
      if (this.boosting && this.hook.state === 'descending') {
        this.boostIndicator.setText('🚀 BOOSTING! 🚀');
      } else {
        this.boostIndicator.setText('');
      }
    }
  }

  updateGameState(newState) {
    this.gameState = newState;

    if (newState && newState.objects) {
      this.createMineObjects(newState.objects);
    }

    // Update marked target indicator
    if (newState && newState.pendingTargetId) {
      this.mineObjects.forEach(obj => {
        obj.setMarked(obj.id === newState.pendingTargetId);
      });
    } else {
      this.mineObjects.forEach(obj => obj.setMarked(false));
    }

    // Sync hook state from server (for player B to see A's actions)
    if (newState && newState.hookState && this.hook) {
      const serverHook = newState.hookState;

      // Only update if there's a significant state change to avoid jittering
      if (this.myRole !== 'A') {
        this.hook.state = serverHook.state;
        this.hook.angle = serverHook.angle;
        this.hook.x = serverHook.x;
        this.hook.y = serverHook.y;
        this.hook.boosted = serverHook.boosted;

        // Sync attached object
        if (serverHook.attachedObjectId && !this.hook.attachedObject) {
          const obj = this.mineObjects.find(o => o.id === serverHook.attachedObjectId);
          if (obj) {
            this.hook.attachObject(obj);
          }
        } else if (!serverHook.attachedObjectId && this.hook.attachedObject) {
          this.hook.attachedObject = null;
        }
      }
    }
  }

  updateRole(role) {
    this.myRole = role;

    // Recreate UI with new role
    if (this.controlText) {
      this.controlText.destroy();
    }
    if (this.boostIndicator) {
      this.boostIndicator.destroy();
      this.boostIndicator = null;
    }
    this.createUI();
  }

  shutdown() {
    if (this.hook) {
      this.hook.destroy();
    }
    this.mineObjects.forEach(obj => obj.destroy());
    this.mineObjects = [];
  }
}
