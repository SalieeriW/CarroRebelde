import Phaser from 'phaser';
import PreloadScene from './scenes/PreloadScene';
import CoopMinerScene from './scenes/CoopMinerScene';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'phaser-container',
  backgroundColor: '#8B7355',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [PreloadScene, CoopMinerScene],
};

export default config;
