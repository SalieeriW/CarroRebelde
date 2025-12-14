export default class Hook {
  constructor(scene, x, y) {
    this.scene = scene;
    this.startX = x;
    this.startY = y;

    // Hook states: 'idle', 'swinging', 'launching', 'descending', 'retracting'
    this.state = 'idle';

    // Swing angle (in radians)
    this.angle = 0;
    this.swingSpeed = 0.015;
    this.swingDirection = 1;
    this.maxSwingAngle = Math.PI / 3; // 60 degrees

    // Hook position
    this.x = x;
    this.y = y;

    // Descending speed (slower for better control)
    this.baseSpeed = 120;
    this.currentSpeed = this.baseSpeed;
    this.boosted = false;

    // Attached object
    this.attachedObject = null;

    // Rope length
    this.ropeLength = 0;
    this.maxRopeLength = 500;

    // Graphics
    this.rope = scene.add.graphics();
    this.hookGraphics = scene.add.graphics();

    // Hook head representation (simple circle for now)
    this.hookHead = scene.add.circle(x, y, 8, 0xff6600, 1);
    this.hookHead.setStrokeStyle(2, 0x000000);

    this.draw();
  }

  update(delta) {
    const deltaInSeconds = delta / 1000;

    switch (this.state) {
      case 'swinging':
        this.updateSwing(deltaInSeconds);
        break;
      case 'descending':
        this.updateDescending(deltaInSeconds);
        break;
      case 'retracting':
        this.updateRetracting(deltaInSeconds);
        break;
    }

    this.draw();
  }

  updateSwing(delta) {
    this.angle += this.swingSpeed * this.swingDirection;

    if (Math.abs(this.angle) >= this.maxSwingAngle) {
      this.swingDirection *= -1;
      this.angle = Math.sign(this.angle) * this.maxSwingAngle;
    }

    // Update hook head position during swing
    const swingRadius = 40;
    this.x = this.startX + Math.sin(this.angle) * swingRadius;
    this.y = this.startY + Math.cos(this.angle) * swingRadius;
  }

  updateDescending(delta) {
    const speed = this.boosted ? this.currentSpeed * 1.5 : this.currentSpeed;
    const dx = Math.sin(this.angle) * speed * delta;
    const dy = Math.cos(this.angle) * speed * delta;

    this.x += dx;
    this.y += dy;
    this.ropeLength += Math.sqrt(dx * dx + dy * dy);

    // Check boundaries
    if (this.y > 550 || this.ropeLength > this.maxRopeLength) {
      this.startRetracting();
    }
  }

  updateRetracting(delta) {
    const dx = this.startX - this.x;
    const dy = this.startY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      this.reset();
      return;
    }

    // Retract speed depends on weight
    let retractSpeed = 250;
    if (this.attachedObject) {
      const weightMultiplier = {
        light: 1.5,
        medium: 1.0,
        heavy: 0.5,
        very_heavy: 0.3,
      };
      retractSpeed *= weightMultiplier[this.attachedObject.weight] || 1.0;
    }

    const ratio = (retractSpeed * delta) / distance;
    this.x += dx * ratio;
    this.y += dy * ratio;

    // Update attached object position
    if (this.attachedObject) {
      this.attachedObject.sprite.x = this.x;
      this.attachedObject.sprite.y = this.y + 15;
    }
  }

  draw() {
    // Clear previous graphics
    this.rope.clear();
    this.hookGraphics.clear();

    // Draw rope
    this.rope.lineStyle(2, 0x654321, 1);
    this.rope.lineBetween(this.startX, this.startY, this.x, this.y);

    // Update hook head position
    this.hookHead.setPosition(this.x, this.y);

    // Draw hook shape
    this.hookGraphics.lineStyle(3, 0xff6600, 1);
    this.hookGraphics.strokeCircle(this.x, this.y, 6);
  }

  startSwinging() {
    if (this.state === 'idle') {
      this.state = 'swinging';
    }
  }

  launch() {
    if (this.state === 'swinging' || this.state === 'idle') {
      this.state = 'descending';
      this.ropeLength = 0;
    }
  }

  startRetracting() {
    this.state = 'retracting';
  }

  attachObject(obj) {
    this.attachedObject = obj;
    obj.sprite.setVisible(true);
  }

  setBoost(boosted) {
    this.boosted = boosted;
  }

  reset() {
    this.state = 'idle';
    this.angle = 0;
    this.x = this.startX;
    this.y = this.startY;
    this.ropeLength = 0;
    this.boosted = false;

    if (this.attachedObject) {
      this.attachedObject.sprite.setVisible(false);
      this.attachedObject.taken = true;

      // Notify scene about collected object
      if (this.scene.onObjectCollected) {
        this.scene.onObjectCollected(this.attachedObject);
      }

      this.attachedObject = null;
    }

    this.draw();
  }

  destroy() {
    this.rope.destroy();
    this.hookGraphics.destroy();
    this.hookHead.destroy();
  }
}
