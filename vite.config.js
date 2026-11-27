import { defineConfig } from 'vite';
import { attachMultiplayerWebSocket } from './server/multiplayerServer.js';

function multiplayerDevPlugin() {
  return {
    name: 'usr3d-multiplayer-ws',
    configureServer(viteServer) {
      if (!viteServer.httpServer) return;
      const hub = attachMultiplayerWebSocket(viteServer.httpServer);
      viteServer.middlewares.use('/health', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, rooms: hub.rooms.size, players: hub.players.size }));
      });
    }
  };
}

export default defineConfig({
  root: '.',
  base: './',
  plugins: [multiplayerDevPlugin()],
  server: {
    port: 3000,
    host: true,
    open: false
  },
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});
