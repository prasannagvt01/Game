/**
 * Ultimate Street Racing 3D — Real-time multiplayer room server.
 *
 * - HTTP: serves the built game from /dist (if present) + /health endpoint.
 * - WebSocket (/ws): 2-player rooms with unique 4-digit codes, lobby state,
 *   synchronized race start, state relay, finish ordering, results,
 *   disconnect grace period with session resume, and room cleanup.
 *
 * No secrets or credentials are required or stored.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';

export const MP_CONFIG = {
  MAX_PLAYERS: 2,
  RECONNECT_GRACE_MS: 20000,
  FINISH_TIMEOUT_MS: 60000,
  COUNTDOWN_MS: 3400,
  START_DELAY_MS: 700,
  RACE_LAPS: 2,
  HEARTBEAT_MS: 10000,
  MAX_STATE_MSGS_PER_SEC: 30,
  MAX_PAYLOAD_BYTES: 4096,
  NAME_MAX_LEN: 16
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const sanitizeName = (raw, fallback) => {
  const cleaned = String(raw || '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, MP_CONFIG.NAME_MAX_LEN);
  return cleaned || fallback;
};

const sanitizeId = (raw, maxLen = 40) => String(raw || '').replace(/[^a-z0-9_#-]/gi, '').slice(0, maxLen);

const finiteOr = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

export function attachMultiplayerWebSocket(httpServer, { log = console.log } = {}) {
  /** @type {Map<string, any>} code -> room */
  const rooms = new Map();
  /** @type {Map<string, any>} playerId -> player */
  const players = new Map();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const send = (ws, msg) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  };

  const generateRoomCode = () => {
    if (rooms.size >= 9000) return null;
    for (let i = 0; i < 200; i++) {
      const code = String(crypto.randomInt(1000, 10000));
      if (!rooms.has(code)) return code;
    }
    for (let n = 1000; n <= 9999; n++) {
      if (!rooms.has(String(n))) return String(n);
    }
    return null;
  };

  const publicRoom = (room) => ({
    code: room.code,
    state: room.state,
    hostId: room.hostId,
    laps: room.laps,
    players: room.players.map((p) => ({
      id: p.id,
      slot: p.slot,
      name: p.name,
      carId: p.carId,
      color: p.color,
      connected: p.connected,
      isHost: p.id === room.hostId,
      finished: p.finishTime !== null,
      finishTime: p.finishTime
    }))
  });

  const broadcast = (room, msg, exceptId = null) => {
    for (const p of room.players) {
      if (p.id !== exceptId) send(p.ws, msg);
    }
  };

  const broadcastRoomUpdate = (room) => broadcast(room, { type: 'room_update', room: publicRoom(room) });

  const sendError = (ws, code, message) => send(ws, { type: 'error', code, message });

  const destroyRoom = (room) => {
    if (room.finishTimer) clearTimeout(room.finishTimer);
    for (const p of room.players) {
      if (p.graceTimer) clearTimeout(p.graceTimer);
      players.delete(p.id);
      if (p.ws) p.ws.playerId = null;
    }
    rooms.delete(room.code);
    log(`[mp] room ${room.code} closed`);
  };

  const resetRaceState = (room) => {
    room.state = 'lobby';
    room.raceStartAt = null;
    room.finishCounter = 0;
    if (room.finishTimer) clearTimeout(room.finishTimer);
    room.finishTimer = null;
    room.resultsSent = false;
    for (const p of room.players) {
      p.finishTime = null;
      p.finishSeq = Infinity;
      p.dnf = false;
    }
  };

  /**
   * Ends the race and broadcasts ordered results.
   * @param {object} room
   * @param {object|null} forfeitedPlayer - player who left mid-race (already removed from room)
   */
  const finalizeResults = (room, forfeitedPlayer = null) => {
    if (room.resultsSent || room.state !== 'racing') return;
    room.resultsSent = true;
    if (room.finishTimer) clearTimeout(room.finishTimer);
    room.finishTimer = null;

    const entrants = forfeitedPlayer ? [...room.players, forfeitedPlayer] : [...room.players];
    const rank = (p) => {
      if (p === forfeitedPlayer) return Infinity;
      if (p.finishTime !== null) return p.finishTime;
      // Still racing when the opponent forfeited -> classified ahead of the forfeiter
      return forfeitedPlayer ? 1e9 : Infinity;
    };
    const ordered = entrants.sort((a, b) => {
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return (a.finishSeq ?? Infinity) - (b.finishSeq ?? Infinity);
    });
    const results = ordered.map((p, idx) => ({
      id: p.id,
      name: p.name,
      carId: p.carId,
      place: idx + 1,
      time: p.finishTime,
      dnf: p === forfeitedPlayer || (p.finishTime === null && !forfeitedPlayer),
      forfeit: p === forfeitedPlayer
    }));
    const winner = results.find((r) => !r.dnf) || null;
    room.state = 'results';
    broadcast(room, {
      type: 'race_results',
      results,
      winnerId: winner ? winner.id : null,
      byForfeit: Boolean(forfeitedPlayer)
    });
    broadcastRoomUpdate(room);
  };

  const removePlayerFromRoom = (player, reason = 'left') => {
    const room = rooms.get(player.roomCode);
    players.delete(player.id);
    if (player.graceTimer) clearTimeout(player.graceTimer);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.players.length === 0) {
      destroyRoom(room);
      return;
    }

    if (room.hostId === player.id) {
      room.hostId = room.players[0].id;
    }
    broadcast(room, { type: 'peer_left', id: player.id, name: player.name, reason });

    if (room.state === 'racing') {
      // Opponent left mid-race: remaining player wins by forfeit
      finalizeResults(room, player);
    } else {
      resetRaceState(room);
    }
    broadcastRoomUpdate(room);
  };

  const attachSocket = (player, ws) => {
    player.ws = ws;
    player.connected = true;
    ws.playerId = player.id;
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
  };

  const newPlayer = (ws, msg, slot) => {
    const id = crypto.randomUUID();
    const player = {
      id,
      token: crypto.randomBytes(18).toString('hex'),
      slot,
      name: sanitizeName(msg.name, `Player ${slot}`),
      carId: sanitizeId(msg.carId) || 'toyota_supra_mk5',
      color: /^#[0-9a-f]{6}$/i.test(msg.color || '') ? msg.color : '#38bdf8',
      ws: null,
      connected: false,
      roomCode: null,
      finishTime: null,
      dnf: false,
      graceTimer: null,
      stateWindowStart: 0,
      stateCount: 0
    };
    attachSocket(player, ws);
    players.set(id, player);
    return player;
  };

  const joinedPayload = (room, player) => ({
    type: 'room_joined',
    code: room.code,
    playerId: player.id,
    token: player.token,
    room: publicRoom(room),
    raceStartAt: room.state === 'racing' ? room.raceStartAt : null,
    serverTime: Date.now()
  });

  // ---------------------------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------------------------
  const handlers = {
    ping(ws, msg) {
      send(ws, { type: 'pong', t: finiteOr(msg.t), serverTime: Date.now() });
    },

    create_room(ws, msg) {
      if (ws.playerId && players.has(ws.playerId)) {
        return sendError(ws, 'ALREADY_IN_ROOM', 'You are already in a room. Leave it first.');
      }
      const code = generateRoomCode();
      if (!code) return sendError(ws, 'SERVER_FULL', 'Server is full. Please try again shortly.');

      const player = newPlayer(ws, msg, 1);
      const room = {
        code,
        state: 'lobby',
        hostId: player.id,
        laps: MP_CONFIG.RACE_LAPS,
        players: [player],
        raceStartAt: null,
        finishTimer: null,
        resultsSent: false,
        createdAt: Date.now()
      };
      player.roomCode = code;
      rooms.set(code, room);
      log(`[mp] room ${code} created by ${player.name}`);
      send(ws, joinedPayload(room, player));
    },

    join_room(ws, msg) {
      if (ws.playerId && players.has(ws.playerId)) {
        return sendError(ws, 'ALREADY_IN_ROOM', 'You are already in a room. Leave it first.');
      }
      const code = String(msg.code || '').trim();
      if (!/^\d{4}$/.test(code)) {
        return sendError(ws, 'INVALID_CODE', 'Room codes are exactly 4 digits.');
      }
      const room = rooms.get(code);
      if (!room) return sendError(ws, 'ROOM_NOT_FOUND', `Room ${code} doesn't exist or has closed.`);
      if (room.players.length >= MP_CONFIG.MAX_PLAYERS) {
        return sendError(ws, 'ROOM_FULL', `Room ${code} is full (2/2 players).`);
      }
      if (room.state === 'racing') {
        return sendError(ws, 'RACE_IN_PROGRESS', 'A race is in progress in that room. Try again in a moment.');
      }

      const usedSlots = new Set(room.players.map((p) => p.slot));
      const slot = usedSlots.has(1) ? 2 : 1;
      const player = newPlayer(ws, msg, slot);
      player.roomCode = code;
      room.players.push(player);
      room.players.sort((a, b) => a.slot - b.slot);
      if (room.state === 'results') resetRaceState(room);

      log(`[mp] ${player.name} joined room ${code}`);
      send(ws, joinedPayload(room, player));
      broadcast(room, { type: 'peer_joined', id: player.id, name: player.name }, player.id);
      broadcastRoomUpdate(room);
    },

    resume(ws, msg) {
      const player = players.get(String(msg.playerId || ''));
      const room = player ? rooms.get(player.roomCode) : null;
      if (!player || !room || player.token !== msg.token || String(msg.code) !== room.code) {
        return sendError(ws, 'RESUME_FAILED', 'Your previous session has expired.');
      }
      if (player.ws && player.ws !== ws) {
        try { player.ws.close(4000, 'replaced'); } catch { /* ignore */ }
      }
      attachSocket(player, ws);
      log(`[mp] ${player.name} reconnected to ${room.code}`);
      send(ws, joinedPayload(room, player));
      broadcast(room, { type: 'peer_reconnected', id: player.id, name: player.name }, player.id);
      broadcastRoomUpdate(room);
    },

    update_profile(ws, msg, player, room) {
      if (!player) return;
      if (msg.name !== undefined) player.name = sanitizeName(msg.name, player.name);
      if (msg.carId) player.carId = sanitizeId(msg.carId) || player.carId;
      if (/^#[0-9a-f]{6}$/i.test(msg.color || '')) player.color = msg.color;
      if (room.hostId === player.id && room.state === 'lobby' && msg.laps !== undefined) {
        const parsedLaps = Number(msg.laps);
        if ([1, 2, 3, 5].includes(parsedLaps)) room.laps = parsedLaps;
      }
      broadcastRoomUpdate(room);
    },

    leave_room(ws, msg, player) {
      if (!player) return;
      ws.playerId = null;
      removePlayerFromRoom(player, 'left');
      send(ws, { type: 'left_room' });
    },

    start_race(ws, msg, player, room) {
      if (!player) return;
      if (room.hostId !== player.id) return sendError(ws, 'NOT_HOST', 'Only the host can start the race.');
      if (room.state === 'racing') return sendError(ws, 'RACE_IN_PROGRESS', 'The race has already started.');
      const connected = room.players.filter((p) => p.connected);
      if (connected.length < MP_CONFIG.MAX_PLAYERS) {
        return sendError(ws, 'NEED_TWO_PLAYERS', 'Waiting for both players to be connected.');
      }
      if (msg.laps !== undefined) {
        const parsedLaps = Number(msg.laps);
        if ([1, 2, 3, 5].includes(parsedLaps)) room.laps = parsedLaps;
      }
      resetRaceState(room);
      room.state = 'racing';
      room.raceStartAt = Date.now() + MP_CONFIG.START_DELAY_MS + MP_CONFIG.COUNTDOWN_MS;
      log(`[mp] race started in room ${room.code} (${room.laps} laps)`);
      broadcast(room, {
        type: 'race_start',
        raceStartAt: room.raceStartAt,
        serverTime: Date.now(),
        laps: room.laps,
        room: publicRoom(room)
      });
    },

    state(ws, msg, player, room) {
      if (!player || room.state !== 'racing') return;
      const now = Date.now();
      if (now - player.stateWindowStart >= 1000) {
        player.stateWindowStart = now;
        player.stateCount = 0;
      }
      player.stateCount += 1;
      if (player.stateCount > MP_CONFIG.MAX_STATE_MSGS_PER_SEC) return; // rate limit

      const p = Array.isArray(msg.p) ? msg.p.slice(0, 3).map((v) => finiteOr(v)) : [0, 0, 0];
      broadcast(room, {
        type: 'peer_state',
        id: player.id,
        p,
        h: finiteOr(msg.h),
        s: finiteOr(msg.s),
        st: finiteOr(msg.st),
        pr: finiteOr(msg.pr),
        cp: finiteOr(msg.cp),
        l: finiteOr(msg.l, 1),
        g: finiteOr(msg.g, 1),
        b: msg.b ? 1 : 0,
        n: msg.n ? 1 : 0
      }, player.id);
    },

    finish(ws, msg, player, room) {
      if (!player || room.state !== 'racing' || player.finishTime !== null) return;
      const raceTime = Math.max(0.01, (Date.now() - room.raceStartAt) / 1000);
      const reported = finiteOr(msg.time, raceTime);
      // Trust client race time only within a small tolerance of server-measured time
      player.finishTime = Math.abs(reported - raceTime) <= 2.5 ? reported : raceTime;
      room.finishCounter = (room.finishCounter || 0) + 1;
      player.finishSeq = room.finishCounter;
      const place = room.players.filter((p) => p.finishTime !== null).length;
      broadcast(room, { type: 'player_finished', id: player.id, name: player.name, time: player.finishTime, place });

      if (room.players.every((p) => p.finishTime !== null)) {
        finalizeResults(room);
      } else if (!room.finishTimer) {
        room.finishTimer = setTimeout(() => finalizeResults(room), MP_CONFIG.FINISH_TIMEOUT_MS);
      }
    },

    back_to_lobby(ws, msg, player, room) {
      if (!player) return;
      if (room.state === 'racing') {
        // Forfeit current race
        finalizeResults(room);
      }
      if (room.state === 'results') {
        resetRaceState(room);
      }
      broadcastRoomUpdate(room);
    }
  };

  // ---------------------------------------------------------------------------
  // Disconnect handling
  // ---------------------------------------------------------------------------
  const handleSocketClose = (ws) => {
    const player = ws.playerId ? players.get(ws.playerId) : null;
    if (!player || player.ws !== ws) return;
    const room = rooms.get(player.roomCode);
    player.connected = false;
    player.ws = null;
    if (!room) return;

    log(`[mp] ${player.name} disconnected from ${room.code} (grace ${MP_CONFIG.RECONNECT_GRACE_MS}ms)`);
    broadcast(room, {
      type: 'peer_disconnected',
      id: player.id,
      name: player.name,
      graceMs: MP_CONFIG.RECONNECT_GRACE_MS
    }, player.id);
    broadcastRoomUpdate(room);

    player.graceTimer = setTimeout(() => {
      player.graceTimer = null;
      if (!player.connected) {
        log(`[mp] ${player.name} timed out of ${room.code}`);
        removePlayerFromRoom(player, 'timeout');
      }
    }, MP_CONFIG.RECONNECT_GRACE_MS);
  };

  // ---------------------------------------------------------------------------
  // WebSocket upgrade wiring (shared between standalone Node server & Vite dev)
  // ---------------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true, maxPayload: MP_CONFIG.MAX_PAYLOAD_BYTES });

  const onUpgrade = (req, socket, head) => {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath !== '/ws') return; // allow Vite HMR upgrades on other paths
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  };
  httpServer.on('upgrade', onUpgrade);

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.playerId = null;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return sendError(ws, 'BAD_MESSAGE', 'Malformed message.');
      }
      if (!msg || typeof msg.type !== 'string' || !handlers[msg.type]) {
        return sendError(ws, 'UNKNOWN_MESSAGE', 'Unknown message type.');
      }
      const player = ws.playerId ? players.get(ws.playerId) : null;
      const room = player ? rooms.get(player.roomCode) : null;
      const needsRoom = !['ping', 'create_room', 'join_room', 'resume'].includes(msg.type);
      if (needsRoom && (!player || !room)) {
        return sendError(ws, 'NOT_IN_ROOM', 'You are not in a room.');
      }
      try {
        handlers[msg.type](ws, msg, player, room);
      } catch (err) {
        log(`[mp] handler error (${msg.type}):`, err);
        sendError(ws, 'SERVER_ERROR', 'Something went wrong on the server.');
      }
    });

    ws.on('close', () => handleSocketClose(ws));
    ws.on('error', () => { /* close handler does cleanup */ });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
  }, MP_CONFIG.HEARTBEAT_MS);

  const closeWss = () => new Promise((resolve) => {
    clearInterval(heartbeat);
    httpServer.off('upgrade', onUpgrade);
    for (const room of [...rooms.values()]) destroyRoom(room);
    for (const ws of wss.clients) ws.terminate();
    wss.close(() => resolve());
  });

  return { wss, rooms, players, closeWss };
}

export function createMultiplayerServer({ port = 3001, staticDir = null, log = console.log } = {}) {
  const resolvedStatic = staticDir && fs.existsSync(staticDir) ? path.resolve(staticDir) : null;
  let mpHub = null;

  const httpServer = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        rooms: mpHub ? mpHub.rooms.size : 0,
        players: mpHub ? mpHub.players.size : 0
      }));
      return;
    }
    if (!resolvedStatic) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Ultimate Street Racing 3D multiplayer server is running. Build the game (npm run build) to serve it here.');
      return;
    }
    let filePath = path.normalize(path.join(resolvedStatic, urlPath === '/' ? 'index.html' : urlPath));
    if (!filePath.startsWith(resolvedStatic)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) filePath = path.join(resolvedStatic, 'index.html');
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  mpHub = attachMultiplayerWebSocket(httpServer, { log });

  // Reject non-/ws upgrades on standalone server so stray sockets don't hang
  httpServer.on('upgrade', (req, socket) => {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath !== '/ws') socket.destroy();
  });

  const ready = new Promise((resolve) => {
    httpServer.listen(port, () => resolve(httpServer.address().port));
  });

  const close = () => mpHub.closeWss().then(() => new Promise((resolve) => httpServer.close(() => resolve())));

  return { httpServer, wss: mpHub.wss, rooms: mpHub.rooms, players: mpHub.players, ready, close };
}
