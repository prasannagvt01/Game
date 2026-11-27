import { GameEngine } from './core/GameEngine.js';

function bootGame() {
  if (window.__USR3D_ENGINE) return;
  const engine = new GameEngine('webgl-container');
  window.__USR3D_ENGINE = engine;
  engine.start();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootGame, { once: true });
} else {
  bootGame();
}
