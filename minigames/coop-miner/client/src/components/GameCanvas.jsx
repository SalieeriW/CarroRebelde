import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import config from '../phaser/config';

const GameCanvas = ({ myRole, gameState, onObjectCollected, onHookStateUpdate, onMarkTarget }) => {
  const gameRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);

      gameRef.current.events.once('ready', () => {
        sceneRef.current = gameRef.current.scene.getScene('CoopMinerScene');

        if (sceneRef.current) {
          sceneRef.current.scene.restart({
            myRole,
            gameState,
            onObjectCollected,
            onHookStateUpdate,
            onMarkTarget,
          });
        }
      });
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateRole(myRole);
    }
  }, [myRole]);

  useEffect(() => {
    if (sceneRef.current && gameState) {
      sceneRef.current.updateGameState(gameState);
    }
  }, [gameState]);

  return <div id="phaser-container" />;
};

export default GameCanvas;
