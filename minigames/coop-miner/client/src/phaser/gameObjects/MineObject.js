export default class MineObject {
  constructor(scene, data, playerRole) {
    this.scene = scene;
    this.id = data.id;
    this.type = data.type;
    this.icon = data.icon;
    this.value = data.value;
    this.weight = data.weight;
    this.size = data.size;
    this.special = data.special;
    this.taken = data.taken || false;
    this.playerRole = playerRole;

    // Size mapping (larger visual difference)
    const sizeMap = {
      small: { fontSize: 28, radius: 20 },
      medium: { fontSize: 40, radius: 28 },
      large: { fontSize: 56, radius: 38 },
    };

    const sizeConfig = sizeMap[this.size] || sizeMap.medium;

    // Calculate position from server data (x, y are 0-100 percentages)
    this.x = 100 + (data.x / 100) * 600;
    this.y = 150 + (data.y / 100) * 350;

    // Create container
    this.container = scene.add.container(this.x, this.y);

    // Background circle (for better visibility)
    this.bg = scene.add.circle(0, 0, sizeConfig.radius, 0xffffff, 0.3);
    this.bg.setStrokeStyle(2, 0x000000);
    this.container.add(this.bg);

    // Icon text - Player A sees clearly, Player B sees grayed out
    if (this.playerRole === 'A') {
      this.sprite = scene.add.text(0, 0, this.icon, {
        fontSize: `${sizeConfig.fontSize}px`,
        align: 'center',
      });
      this.sprite.setOrigin(0.5);
      this.container.add(this.sprite);
    } else {
      this.sprite = scene.add.text(0, 0, '?', {
        fontSize: `${sizeConfig.fontSize}px`,
        align: 'center',
        fill: '#888888',
      });
      this.sprite.setOrigin(0.5);
      this.container.add(this.sprite);
    }

    // Value text - Only visible to Player B
    if (this.playerRole === 'B') {
      this.valueText = scene.add.text(0, sizeConfig.radius + 15, `${this.value >= 0 ? '+' : ''}${this.value}`, {
        fontSize: '14px',
        fontFamily: 'monospace',
        fill: this.value >= 0 ? '#00ff00' : '#ff0000',
        stroke: '#000000',
        strokeThickness: 2,
      });
      this.valueText.setOrigin(0.5);
      this.container.add(this.valueText);
    }

    // Size and weight indicator - Only visible to Player B
    if (this.playerRole === 'B') {
      const sizeLabel = this.size === 'small' ? 'S' : this.size === 'large' ? 'L' : 'M';
      const weightLabel = this.weight === 'light' ? '⚡' : this.weight === 'heavy' ? '🔩' : this.weight === 'very_heavy' ? '⚓' : '●';
      this.sizeText = scene.add.text(0, sizeConfig.radius + 30, `${sizeLabel} ${weightLabel}`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        fill: '#ffff00',
        stroke: '#000000',
        strokeThickness: 2,
      });
      this.sizeText.setOrigin(0.5);
      this.container.add(this.sizeText);
    }

    // Enable physics (for collision detection)
    scene.physics.add.existing(this.container);
    this.container.body.setCircle(sizeConfig.radius);
    this.container.body.setImmovable(true);

    // Store reference for collision
    this.container.setData('mineObject', this);

    // Marked indicator (initially hidden)
    this.markedIndicator = scene.add.text(0, -sizeConfig.radius - 20, '⭐', {
      fontSize: '24px',
    });
    this.markedIndicator.setOrigin(0.5);
    this.markedIndicator.setVisible(false);
    this.container.add(this.markedIndicator);

    if (this.taken) {
      this.container.setVisible(false);
    }
  }

  setMarked(marked) {
    if (this.markedIndicator) {
      this.markedIndicator.setVisible(marked);
    }
  }

  checkCollision(hookX, hookY) {
    if (this.taken) return false;

    const dx = this.x - hookX;
    const dy = this.y - hookY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const sizeRadius = {
      small: 20,
      medium: 28,
      large: 38,
    };

    const hookRadius = 8;
    const collisionRadius = (sizeRadius[this.size] || 28) + hookRadius;

    return distance < collisionRadius;
  }

  setTaken() {
    this.taken = true;
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy();
  }
}
