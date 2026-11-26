import { GameEngine } from './core/GameEngine.js';

window.addEventListener('DOMContentLoaded', () => {
  const engine = new GameEngine('webgl-container');
  window.__USR3D_ENGINE = engine;
  engine.start();
});
