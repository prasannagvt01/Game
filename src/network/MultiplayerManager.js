import * as THREE from 'three';
import { getCarById } from '../vehicles/CarCatalog.js';
import { CarBuilder } from '../vehicles/CarBuilder.js';

const SEND_INTERVAL_SEC = 0.05; // 20 Hz state updates (~110 bytes/msg)
const PING_INTERVAL_MS = 5000;
const WHEEL_RADIUS = 0.36;
const LS_NAME_KEY = 'usr3d_mp_player_name';
const LS_SERVER_KEY = 'usr3d_mp_server_url';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

function shortestAngleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class MultiplayerManager {
  constructor(scene, trackSpline, saveManager, WebSocketImpl = null) {
    this.scene = scene;
    this.track = trackSpline;
    this.saveManager = saveManager;
    this.WS = WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);

    this.ws = null;
    this.connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
    this.pingMs = 0;
    this.serverClockOffset = 0;

    // Room & session state
    this.room = null;
    this.roomCode = null;
    this.playerId = null;
    this.resumeToken = null;
    this.localSlot = 1;
    this.isHost = false;
    this.isRacing = false;
    this.localFinishedSent = false;

    // Reconnection & timers
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.pendingAction = null;
    this.sendAccum = 0;

    // Remote opponent 3D car & telemetry state
    this.peerGroup = new THREE.Group();
    this.scene.add(this.peerGroup);
    this.opponent = null; // { id, name, carId, color, mesh, nametagSprite, pos, targetPos, heading, targetHeading, speed, steer, totalProgress, checkpointsCleared, lap, gear, braking, nitro, wheelSpin, hitCooldown, lastPacketAt, connected, finished, finishTime }

    // Event hooks
    this.onRoomUpdate = null;
    this.onError = null;
    this.onRaceStart = null;
    this.onPlayerFinished = null;
    this.onRaceResults = null;
    this.onLeftRoom = null;
    this.onNotify = null;
    this.onConnectionChange = null;
  }

  getSavedPlayerName() {
    try {
      return localStorage.getItem(LS_NAME_KEY) || '';
    } catch {
      return '';
    }
  }

  setSavedPlayerName(name) {
    const cleaned = String(name || '').trim().slice(0, 16);
    try {
      if (cleaned) localStorage.setItem(LS_NAME_KEY, cleaned);
    } catch { /* ignore */ }
    return cleaned || 'Racer';
  }

  getCustomServerUrl() {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('mp');
        if (fromQuery) return fromQuery.trim();
      }
      return localStorage.getItem(LS_SERVER_KEY) || '';
    } catch {
      return '';
    }
  }

  setCustomServerUrl(url) {
    const trimmed = String(url || '').trim();
    try {
      if (trimmed) localStorage.setItem(LS_SERVER_KEY, trimmed);
      else localStorage.removeItem(LS_SERVER_KEY);
    } catch { /* ignore */ }
  }

  resolveWebSocketUrl(explicitUrl = null) {
    const raw = explicitUrl !== null ? String(explicitUrl).trim() : this.getCustomServerUrl();
    if (raw) {
      if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
        return raw.endsWith('/ws') || raw.includes('/ws?') ? raw : `${raw.replace(/\/+$/, '')}/ws`;
      }
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const wsProto = raw.startsWith('https://') ? 'wss://' : 'ws://';
        const rest = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        return rest.endsWith('/ws') ? `${wsProto}${rest}` : `${wsProto}${rest}/ws`;
      }
      return `wss://${raw.replace(/\/+$/, '')}/ws`;
    }
    if (typeof window !== 'undefined' && window.location && window.location.host) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/ws`;
    }
    return 'ws://localhost:3001/ws';
  }

  isInRoom() {
    return Boolean(this.room && this.roomCode && this.playerId);
  }

  getOpponentInfo() {
    if (!this.room) return null;
    return this.room.players.find((p) => p.id !== this.playerId) || null;
  }

  _setConnectionState(next) {
    if (this.connectionState === next) return;
    this.connectionState = next;
    if (this.onConnectionChange) this.onConnectionChange(next);
  }

  _send(payload) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  _connectAndSend(actionPayload, explicitUrl = null) {
    if (!this.WS) {
      if (this.onError) this.onError('NO_WS', 'WebSocket is not supported in this environment.');
      return;
    }

    if (this.ws && this.ws.readyState === 1) {
      this._send(actionPayload);
      return;
    }

    this.pendingAction = actionPayload;
    this.intentionalClose = false;
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }

    const wsUrl = this.resolveWebSocketUrl(explicitUrl);
    this._setConnectionState(this.resumeToken ? 'reconnecting' : 'connecting');

    let sock;
    try {
      sock = new this.WS(wsUrl);
    } catch {
      this._setConnectionState('disconnected');
      if (this.onError) {
        this.onError('INVALID_URL', 'Invalid multiplayer server URL.');
      }
      return;
    }

    this.ws = sock;

    const onOpen = () => {
      if (this.ws !== sock) return;
      this.reconnectAttempts = 0;
      this._startPingLoop();

      if (this.pendingAction) {
        this._setConnectionState('connected');
        const msg = this.pendingAction;
        this.pendingAction = null;
        this._send(msg);
      } else if (this.roomCode && this.playerId && this.resumeToken) {
        // Stay in 'reconnecting' state until server confirms 'room_joined'
        this._send({
          type: 'resume',
          code: this.roomCode,
          playerId: this.playerId,
          token: this.resumeToken
        });
      } else {
        this._setConnectionState('connected');
      }
    };

    const onMessage = (evt) => {
      if (this.ws !== sock) return;
      const raw = typeof evt.data === 'string' ? evt.data : evt.data?.toString?.() || '';
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      this._handleServerMessage(msg);
    };

    const onClose = () => {
      if (this.ws !== sock) return;
      this._stopPingLoop();
      this.ws = null;

      if (this.intentionalClose) {
        this._setConnectionState('disconnected');
        return;
      }

      if (this.roomCode && this.playerId && this.resumeToken && this.reconnectAttempts < 6) {
        this._setConnectionState('reconnecting');
        const delay = Math.min(4000, 600 * Math.pow(1.6, this.reconnectAttempts));
        this.reconnectAttempts += 1;
        if (this.onNotify && this.reconnectAttempts === 1) {
          this.onNotify('Connection interrupted • Reconnecting...', 'white');
        }
        this.reconnectTimer = setTimeout(() => {
          this._connectAndSend(null, explicitUrl);
        }, delay);
      } else {
        const hadPending = Boolean(this.pendingAction);
        this.pendingAction = null;
        this._setConnectionState('disconnected');
        if (hadPending && this.onError) {
          this.onError(
            'CONNECT_FAILED',
            'Could not reach multiplayer server. Make sure the server is running.'
          );
        } else if (this.roomCode) {
          this._clearRoomState();
          if (this.onLeftRoom) this.onLeftRoom('disconnected');
        }
      }
    };

    const onError = () => {
      // onclose handles cleanup & user-facing message
    };

    if (typeof sock.addEventListener === 'function') {
      sock.addEventListener('open', onOpen);
      sock.addEventListener('message', onMessage);
      sock.addEventListener('close', onClose);
      sock.addEventListener('error', onError);
    } else if (typeof sock.on === 'function') {
      sock.on('open', onOpen);
      sock.on('message', (data) => onMessage({ data: data.toString() }));
      sock.on('close', onClose);
      sock.on('error', onError);
    }
  }

  _startPingLoop() {
    this._stopPingLoop();
    this._send({ type: 'ping', t: Date.now() });
    this.pingTimer = setInterval(() => {
      this._send({ type: 'ping', t: Date.now() });
    }, PING_INTERVAL_MS);
  }

  _stopPingLoop() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  _buildLocalProfile(customName = null) {
    const carId = this.saveManager.getSelectedCarId();
    const carDef = getCarById(carId);
    const color = this.saveManager.getCarColor(carDef.id, carDef.defaultColor);
    const name = this.setSavedPlayerName(customName || this.getSavedPlayerName() || 'Racer');
    return { name, carId: carDef.id, color };
  }

  createRoom(customName = null, serverUrl = null) {
    if (serverUrl !== null) this.setCustomServerUrl(serverUrl);
    if (this.isInRoom()) {
      this._send({ type: 'leave_room' });
      this._clearRoomState();
    }
    const profile = this._buildLocalProfile(customName);
    this._connectAndSend({ type: 'create_room', ...profile }, serverUrl);
  }

  joinRoom(code, customName = null, serverUrl = null) {
    const cleanedCode = String(code || '').trim();
    if (!/^\d{4}$/.test(cleanedCode)) {
      if (this.onError) {
        this.onError('INVALID_CODE', 'Please enter a valid 4-digit room code (e.g. 4829).');
      }
      return false;
    }
    if (serverUrl !== null) this.setCustomServerUrl(serverUrl);
    if (this.isInRoom()) {
      this._send({ type: 'leave_room' });
      this._clearRoomState();
    }
    const profile = this._buildLocalProfile(customName);
    this._connectAndSend({ type: 'join_room', code: cleanedCode, ...profile }, serverUrl);
    return true;
  }

  syncProfile(customName = null, laps = undefined) {
    if (!this.isInRoom()) return;
    const profile = this._buildLocalProfile(customName);
    const payload = { type: 'update_profile', ...profile };
    if (laps !== undefined) payload.laps = Number(laps);
    this._send(payload);
  }

  requestStartRace(laps = undefined) {
    if (!this.isInRoom()) return;
    const payload = { type: 'start_race' };
    if (laps !== undefined) payload.laps = Number(laps);
    this._send(payload);
  }

  reportLocalFinish(elapsedSeconds) {
    if (!this.isInRoom() || this.localFinishedSent) return;
    this.localFinishedSent = true;
    if (this.connectionState !== 'connected' || !this._send({ type: 'finish', time: round3(elapsedSeconds) })) {
      this.pendingFinishTime = elapsedSeconds;
    }
  }

  returnToRoomLobby() {
    if (!this.isInRoom()) return;
    this.isRacing = false;
    this.localFinishedSent = false;
    this._setOpponentVisible(false);
    this._send({ type: 'back_to_lobby' });
  }

  leaveRoom(closeSocket = true) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.intentionalClose = Boolean(closeSocket);
    if (this.ws && this.ws.readyState === 1 && this.roomCode) {
      this._send({ type: 'leave_room' });
    }
    this._clearRoomState();
    if (closeSocket && this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
      this._stopPingLoop();
      this._setConnectionState('disconnected');
    }
  }

  _clearRoomState() {
    this.room = null;
    this.roomCode = null;
    this.playerId = null;
    this.resumeToken = null;
    this.isHost = false;
    this.isRacing = false;
    this.localFinishedSent = false;
    this._disposeOpponentMesh();
  }

  // ---------------------------------------------------------------------------
  // Server message dispatch
  // ---------------------------------------------------------------------------
  _handleServerMessage(msg) {
    switch (msg.type) {
      case 'pong': {
        const now = Date.now();
        if (msg.t) {
          const rtt = Math.max(1, now - msg.t);
          this.pingMs = this.pingMs ? Math.round(this.pingMs * 0.65 + rtt * 0.35) : rtt;
        }
        if (msg.serverTime) {
          this.serverClockOffset = msg.serverTime - (now - Math.round((this.pingMs || 0) * 0.5));
        }
        break;
      }

      case 'room_joined': {
        this._setConnectionState('connected');
        if (msg.serverTime) {
          this.serverClockOffset = msg.serverTime - Date.now();
        }
        this.roomCode = msg.code;
        this.playerId = msg.playerId;
        this.resumeToken = msg.token;
        this._applyRoomSnapshot(msg.room);

        // If rejoining an active race after brief disconnect
        if (msg.room.state === 'racing' && msg.raceStartAt) {
          this.isRacing = true;
          if (!this.opponent) this._spawnOpponentOnGrid();
          if (this.pendingFinishTime !== null && this.pendingFinishTime !== undefined) {
            const ft = this.pendingFinishTime;
            this.pendingFinishTime = null;
            this._send({ type: 'finish', time: round3(ft) });
          }
        }
        break;
      }

      case 'room_update': {
        this._applyRoomSnapshot(msg.room);
        break;
      }

      case 'peer_joined': {
        if (this.onNotify) this.onNotify(`${msg.name} joined the room`, 'green');
        break;
      }

      case 'peer_disconnected': {
        if (this.opponent && this.opponent.id === msg.id) {
          this.opponent.connected = false;
        }
        if (this.onNotify) this.onNotify(`${msg.name} connection unstable...`, 'white');
        break;
      }

      case 'peer_reconnected': {
        if (this.opponent && this.opponent.id === msg.id) {
          this.opponent.connected = true;
        }
        if (this.onNotify) this.onNotify(`${msg.name} reconnected`, 'green');
        break;
      }

      case 'peer_left': {
        if (this.opponent && this.opponent.id === msg.id) {
          this._disposeOpponentMesh();
        }
        if (this.onNotify) this.onNotify(`${msg.name} left the room`, 'white');
        break;
      }

      case 'left_room': {
        this._clearRoomState();
        if (this.onLeftRoom) this.onLeftRoom('left');
        break;
      }

      case 'race_start': {
        if (msg.serverTime) {
          this.serverClockOffset = msg.serverTime - Date.now();
        }
        if (msg.room) this._applyRoomSnapshot(msg.room);
        this.isRacing = true;
        this.localFinishedSent = false;

        const estServerNow = Date.now() + this.serverClockOffset;
        const countdownSeconds = THREE.MathUtils.clamp((msg.raceStartAt - estServerNow) / 1000, 1.2, 5.0);

        this._spawnOpponentOnGrid();

        if (this.onRaceStart) {
          this.onRaceStart({
            raceStartAt: msg.raceStartAt,
            laps: msg.laps || 2,
            slot: this.localSlot,
            countdownSeconds,
            room: this.room
          });
        }
        break;
      }

      case 'peer_state': {
        this._handlePeerState(msg);
        break;
      }

      case 'player_finished': {
        if (this.opponent && msg.id === this.opponent.id) {
          this.opponent.finished = true;
          this.opponent.finishTime = msg.time;
          if (this.onNotify) {
            this.onNotify(`${msg.name} finished (#${msg.place})`, 'cyan');
          }
        }
        if (this.onPlayerFinished) this.onPlayerFinished(msg);
        break;
      }

      case 'race_results': {
        this.isRacing = false;
        if (this.onRaceResults) {
          this.onRaceResults({
            results: msg.results || [],
            winnerId: msg.winnerId || null,
            byForfeit: Boolean(msg.byForfeit),
            localPlayerId: this.playerId,
            roomCode: this.roomCode
          });
        }
        break;
      }

      case 'error': {
        if (msg.code === 'RESUME_FAILED') {
          this._clearRoomState();
          if (this.onLeftRoom) this.onLeftRoom('expired');
        }
        if (this.onError) this.onError(msg.code, msg.message);
        break;
      }
    }
  }

  _applyRoomSnapshot(room) {
    if (!room) return;
    this.room = room;
    this.isHost = room.hostId === this.playerId;
    const me = room.players.find((p) => p.id === this.playerId);
    if (me) this.localSlot = me.slot || 1;

    const peer = room.players.find((p) => p.id !== this.playerId) || null;
    if (!peer) {
      this._disposeOpponentMesh();
    } else {
      this._ensureOpponentVisual(peer);
    }

    if (this.onRoomUpdate) {
      this.onRoomUpdate(room, this.playerId);
    }
  }

  // ---------------------------------------------------------------------------
  // 3D Opponent Car + Floating Nametag Sprite + Real-Time Interpolation
  // ---------------------------------------------------------------------------
  _createNametagSprite(playerName, accentHex = '#38bdf8') {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = 'rgba(10, 16, 30, 0.78)';
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 3;
      ctx.fillRect(14, 10, 228, 44);
      ctx.strokeRect(14, 10, 228, 44);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(playerName || 'Player 2').slice(0, 16), 128, 33);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.4, 0.85, 1);
    sprite.position.set(0, 2.25, 0);
    sprite.renderOrder = 10;
    return sprite;
  }

  _ensureOpponentVisual(peerInfo) {
    const needsRebuild =
      !this.opponent ||
      this.opponent.id !== peerInfo.id ||
      this.opponent.carId !== peerInfo.carId ||
      this.opponent.color !== peerInfo.color ||
      this.opponent.name !== peerInfo.name;

    if (!needsRebuild) {
      this.opponent.connected = peerInfo.connected;
      return;
    }

    const prevPos = this.opponent ? this.opponent.pos.clone() : new THREE.Vector3();
    const prevHeading = this.opponent ? this.opponent.heading : 0;
    const wasVisible = this.opponent?.mesh?.root?.visible ?? false;

    this._disposeOpponentMesh();

    const carDef = getCarById(peerInfo.carId);
    const paint = peerInfo.color || carDef.defaultColor;
    const meshBundle = CarBuilder.buildRaceCar(carDef, paint, false);
    meshBundle.root.visible = wasVisible || this.isRacing;

    const nametag = this._createNametagSprite(peerInfo.name, '#38bdf8');
    if (nametag) meshBundle.root.add(nametag);

    this.peerGroup.add(meshBundle.root);

    this.opponent = {
      id: peerInfo.id,
      slot: peerInfo.slot || 2,
      name: peerInfo.name,
      carId: carDef.id,
      carName: carDef.name,
      color: paint,
      mesh: meshBundle,
      nametagSprite: nametag,
      pos: prevPos,
      targetPos: prevPos.clone(),
      heading: prevHeading,
      targetHeading: prevHeading,
      speed: 0,
      steer: 0,
      totalProgress: 0,
      checkpointsCleared: 0,
      lap: 1,
      gear: 1,
      braking: false,
      nitro: false,
      wheelSpin: 0,
      hitCooldown: 0,
      lastPacketAt: performance.now(),
      connected: peerInfo.connected,
      finished: Boolean(peerInfo.finished),
      finishTime: peerInfo.finishTime ?? null
    };

    meshBundle.root.position.copy(prevPos);
    meshBundle.root.rotation.y = prevHeading;
  }

  _spawnOpponentOnGrid() {
    const peer = this.getOpponentInfo();
    if (!peer) return;
    this._ensureOpponentVisual(peer);
    if (!this.opponent) return;

    const peerSlot = peer.slot || (this.localSlot === 1 ? 2 : 1);
    const startLateral = peerSlot === 1 ? -2.8 : 2.8;
    const sample = this.track.getSampleAt(0.025);
    const startPos = sample.point.clone().addScaledVector(sample.right, startLateral);

    this.opponent.pos.copy(startPos);
    this.opponent.targetPos.copy(startPos);
    this.opponent.heading = sample.heading;
    this.opponent.targetHeading = sample.heading;
    this.opponent.speed = 0;
    this.opponent.steer = 0;
    this.opponent.totalProgress = 0;
    this.opponent.checkpointsCleared = 0;
    this.opponent.lap = 1;
    this.opponent.finished = false;
    this.opponent.finishTime = null;
    this._setOpponentVisible(true);

    this.opponent.mesh.root.position.copy(startPos);
    this.opponent.mesh.root.rotation.y = sample.heading;
  }

  _setOpponentVisible(visible) {
    if (this.opponent && this.opponent.mesh) {
      this.opponent.mesh.root.visible = Boolean(visible);
    }
  }

  _disposeOpponentMesh() {
    if (this.opponent && this.opponent.mesh) {
      this.peerGroup.remove(this.opponent.mesh.root);
    }
    this.opponent = null;
  }

  _handlePeerState(msg) {
    if (!this.opponent || msg.id !== this.opponent.id) return;
    const [x, y, z] = msg.p;
    this.opponent.targetPos.set(x, y, z);
    this.opponent.targetHeading = msg.h;
    this.opponent.speed = msg.s;
    this.opponent.steer = msg.st || 0;
    this.opponent.totalProgress = msg.pr || 0;
    this.opponent.checkpointsCleared = msg.cp || 0;
    this.opponent.lap = msg.l || 1;
    this.opponent.gear = msg.g || 1;
    this.opponent.braking = Boolean(msg.b);
    this.opponent.nitro = Boolean(msg.n);
    this.opponent.lastPacketAt = performance.now();

    // Snap if very far out of sync (e.g. initial spawn or car reset)
    if (this.opponent.pos.distanceToSquared(this.opponent.targetPos) > 900) {
      this.opponent.pos.copy(this.opponent.targetPos);
      this.opponent.heading = this.opponent.targetHeading;
    }
  }

  update(dt, localVehicle, raceManager, particleSystem = null, audioManager = null) {
    if (!this.isInRoom()) return;

    // 1. Send compact local vehicle & race telemetry at 20 Hz while racing
    if (this.isRacing && localVehicle && raceManager) {
      this.sendAccum += dt;
      if (this.sendAccum >= SEND_INTERVAL_SEC) {
        this.sendAccum = 0;
        this._send({
          type: 'state',
          p: [round2(localVehicle.position.x), round2(localVehicle.position.y), round2(localVehicle.position.z)],
          h: round3(localVehicle.heading),
          s: round2(localVehicle.speed),
          st: round3(localVehicle.steerAngle),
          pr: round3(raceManager.playerTotalProgress),
          cp: raceManager.checkpointsClearedInLap,
          l: raceManager.currentLap,
          g: localVehicle.gear,
          b: localVehicle.speed > 0.5 && this.opponent ? (localVehicle.meshBundle?.taillightMat?.emissiveIntensity > 2.5 ? 1 : 0) : 0,
          n: localVehicle.isNitroActive ? 1 : 0
        });
      }
    }

    // 2. Dead-reckon & smoothly interpolate remote opponent car in 3D space
    const opp = this.opponent;
    if (!opp || !opp.mesh || !opp.mesh.root.visible) return;

    opp.hitCooldown = Math.max(0, opp.hitCooldown - dt);

    const ageMs = performance.now() - opp.lastPacketAt;
    if (ageMs < 220 && Math.abs(opp.speed) > 0.05) {
      const stepDt = Math.min(dt, 0.05);
      opp.targetPos.x += Math.sin(opp.targetHeading) * opp.speed * stepDt;
      opp.targetPos.z += Math.cos(opp.targetHeading) * opp.speed * stepDt;
    }

    const posBlend = 1 - Math.exp(-14 * dt);
    opp.pos.lerp(opp.targetPos, posBlend);
    opp.heading += shortestAngleDiff(opp.heading, opp.targetHeading) * (1 - Math.exp(-16 * dt));

    opp.mesh.root.position.copy(opp.pos);
    opp.mesh.root.rotation.y = opp.heading;

    // Spin wheels & steer front wheels
    opp.wheelSpin += (opp.speed / WHEEL_RADIUS) * dt;
    if (opp.mesh.wheels) {
      for (const w of opp.mesh.wheels) {
        if (w.isFront) w.knuckle.rotation.y = opp.steer * 0.88;
        w.spinHub.rotation.x = opp.wheelSpin;
      }
    }

    if (opp.mesh.taillightMat) {
      opp.mesh.taillightMat.emissiveIntensity = opp.braking ? 3.8 : 1.0;
    }

    if (opp.nitro && particleSystem) {
      const yAxis = new THREE.Vector3(0, 1, 0);
      const exL = new THREE.Vector3(-0.46, 0.32, -2.25).applyAxisAngle(yAxis, opp.heading).add(opp.pos);
      const exR = new THREE.Vector3(0.46, 0.32, -2.25).applyAxisAngle(yAxis, opp.heading).add(opp.pos);
      particleSystem.emitNitroFlame(exL);
      particleSystem.emitNitroFlame(exR);
    }

    // Gentle side-by-side car contact push when racing
    if (this.isRacing && localVehicle && raceManager?.state === 'active') {
      const dx = localVehicle.position.x - opp.pos.x;
      const dz = localVehicle.position.z - opp.pos.z;
      const dy = Math.abs(localVehicle.position.y - opp.pos.y);
      const distSq = dx * dx + dz * dz;
      if (dy < 2.2 && distSq > 0.001 && distSq < 6.25) {
        const dist = Math.sqrt(distSq);
        const overlap = 2.5 - dist;
        if (overlap > 0) {
          localVehicle.position.x += (dx / dist) * overlap * 0.55;
          localVehicle.position.z += (dz / dist) * overlap * 0.55;
          if (opp.hitCooldown <= 0) {
            opp.hitCooldown = 0.45;
            localVehicle.collisionShake = Math.max(localVehicle.collisionShake, 0.35);
            if (audioManager) audioManager.playCollision(0.35);
          }
        }
      }
    }
  }

  getOpponentMinimapMarker() {
    if (!this.opponent || !this.opponent.mesh?.root?.visible) return null;
    return {
      position: this.opponent.pos,
      heading: this.opponent.heading,
      name: this.opponent.name,
      color: '#f43f5e'
    };
  }
}
