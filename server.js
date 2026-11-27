import path from 'path';
import { fileURLToPath } from 'url';
import { createMultiplayerServer } from './server/multiplayerServer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const mp = createMultiplayerServer({
  port: PORT,
  staticDir: path.join(__dirname, 'dist')
});

mp.ready.then((port) => {
  console.log('=====================================================');
  console.log('  Ultimate Street Racing 3D - Game + Multiplayer Server');
  console.log(`  Game:        http://localhost:${port}`);
  console.log(`  WebSocket:   ws://localhost:${port}/ws`);
  console.log(`  Health:      http://localhost:${port}/health`);
  console.log('=====================================================');
});

const shutdown = () => mp.close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
