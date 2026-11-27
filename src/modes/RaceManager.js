import * as THREE from 'three';
import { AI_DIFFICULTY_PROFILES } from '../ai/TrafficManager.js';
import { getMissionById } from './MissionCatalog.js';

export const GAME_MODES = {
  circuit: {
    id: 'circuit',
    name: 'Circuit Grand Prix',
    subtitle: '3-Lap closed motorsport circuit race against 5 AI racing opponents',
    icon: '🏁',
    totalLaps: 3,
    hasLapCounter: true,
    hasPositionCounter: true,
    hasTimer: true
  },
  city_race: {
    id: 'city_race',
    name: 'USA City Street Race',
    subtitle: '2-Lap urban street race against 5 AI rivals through live USA city traffic & intersections',
    icon: '🏙️',
    totalLaps: 2,
    hasLapCounter: true,
    hasPositionCounter: true,
    hasTimer: true
  },
  timetrial: {
    id: 'timetrial',
    name: 'Hot Lap Time Trial',
    subtitle: '2-Lap solo precision attack against Gold (1:50), Silver & Bronze targets',
    icon: '⏱️',
    totalLaps: 2,
    hasLapCounter: true,
    hasPositionCounter: false,
    hasTimer: true
  },
  checkpoint: {
    id: 'checkpoint',
    name: 'Checkpoint Blitz',
    subtitle: 'Beat the countdown clock through 12 high-speed neon checkpoint gates',
    icon: '⚡',
    hasLapCounter: false,
    hasPositionCounter: false,
    hasTimer: true
  },
  traffic: {
    id: 'traffic',
    name: 'Highway Traffic Rush',
    subtitle: '75-second dense traffic weaving — stack near-miss & top-speed combos',
    icon: '🚘',
    hasLapCounter: false,
    hasPositionCounter: false,
    hasTimer: true
  },
  freeroam: {
    id: 'freeroam',
    name: 'Free Roam City',
    subtitle: 'Unlimited USA city & highway exploration, drift scoring & near-miss cash bonuses',
    icon: '🌆',
    hasLapCounter: false,
    hasPositionCounter: false,
    hasTimer: true
  }
};

export class RaceManager {
  constructor(scene, trackSpline, trafficManager, saveManager) {
    this.scene = scene;
    this.track = trackSpline;
    this.traffic = trafficManager;
    this.saveManager = saveManager;

    this.currentMode = 'circuit';
    this.activeMission = null; // Non-null when playing a structured campaign mission
    this.isMultiplayer = false;
    this.state = 'idle'; // 'countdown' | 'active' | 'finished' | 'idle'
    this.countdownTimer = 0;
    this.lastCountdownBeep = 4;

    // Telemetry, Anti-Skip Checkpoints & Lap Progress
    this.elapsedTime = 0;
    this.remainingTime = 0;
    this.currentLap = 1;
    this.totalLaps = 3;
    this.lastTrackT = 0.017;

    this.checkpoints = [];
    this.activeCheckpointIdx = 0;
    this.checkpointsClearedInLap = 0;
    this.totalCheckpointsCleared = 0;
    this.checkpointsCleared = 0;
    this.totalCheckpointsToClear = 12;
    this.missedCheckpointWarnCooldown = 0;

    // Mission-Specific State (Delivery, Drift, Traffic Avoidance, Racing, Time Challenge)
    this.cargoIntegrity = 100;
    this.deliveryWaypoints = [];
    this.deliveryWaypointIdx = 0;
    this.collisionCount = 0;
    this.wallDamageCooldown = 0;
    this.missionProgressPct = 0;
    this.missionProgressText = '';

    this.playerTotalProgress = 0;
    this.playerPosition = 1;
    this.totalRacers = 1;

    this.score = 0;
    this.comboMultiplier = 1;
    this.nearMissCount = 0;
    this.freeRoamBankedCredits = 0;

    // 3D Checkpoint / Finish Line / Delivery Zone Arch Mesh
    this.checkpointArchGroup = new THREE.Group();
    this.checkpointArchMat = null;
    this.scene.add(this.checkpointArchGroup);
    this._buildCheckpointArchMesh();

    this.traffic.onNearMissCallback = (speedKmh) => this._handleNearMiss(speedKmh);
    this.traffic.onCollisionCallback = (severity) => this._handleTrafficCollision(severity);

    this.onBannerMessage = null;
    this.onRaceFinished = null;
    this.onMultiplayerLocalFinish = null;
  }

  _buildCheckpointArchMesh() {
    this.checkpointArchMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.85
    });

    const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9, 12), this.checkpointArchMat);
    leftPillar.position.set(-9.5, 4.5, 0);
    this.checkpointArchGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9, 12), this.checkpointArchMat);
    rightPillar.position.set(9.5, 4.5, 0);
    this.checkpointArchGroup.add(rightPillar);

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 1.1), this.checkpointArchMat);
    topBeam.position.set(0, 8.8, 0);
    this.checkpointArchGroup.add(topBeam);

    this.checkpointArchGroup.visible = false;
  }

  /**
   * Starts one of the 6 standard game modes
   */
  startMode(modeId, playerVehicle, audioManager = null) {
    this.isMultiplayer = false;
    this.activeMission = null;
    this.currentMode = GAME_MODES[modeId] ? modeId : 'circuit';
    const settings = this.saveManager.getSettings();
    const aiDifficulty = settings.aiDifficulty || 'medium';

    this._resetCommonTelemetry();
    this.totalLaps = GAME_MODES[this.currentMode].totalLaps || 3;
    this._setupCheckpoints();

    const isMultiCarRace = this.currentMode === 'circuit' || this.currentMode === 'city_race';
    const startT = isMultiCarRace ? 0.017 : 0.025;
    const startLateral = isMultiCarRace ? -3.4 : 2.2;
    playerVehicle.resetAtTrackT(startT, startLateral);
    playerVehicle.distanceDriven = 0;
    playerVehicle.driftScoreAccum = 0;
    this.lastTrackT = startT;

    this.traffic.spawnForMode(
      this.currentMode,
      settings.trafficDensity,
      aiDifficulty,
      this.checkpoints,
      this.totalLaps
    );

    if (this.currentMode === 'freeroam') {
      this.state = 'active';
      this.totalRacers = 1;
      this.playerPosition = 1;
      this.checkpointArchGroup.visible = true;
      this._placeCheckpointArchAt(this.checkpoints[this.activeCheckpointIdx], false);
      if (this.onBannerMessage) {
        this.onBannerMessage('Free Roam • Sector gates award cash', 'cyan');
      }
    } else {
      this.state = 'countdown';
      this.countdownTimer = 3.4;
      this.lastCountdownBeep = 4;
      this.totalRacers = isMultiCarRace ? 6 : 1;
      this.playerPosition = isMultiCarRace ? 6 : 1;

      if (this.currentMode === 'checkpoint') {
        this.remainingTime = 24.0;
        this.totalCheckpointsToClear = 12;
        this.checkpointArchGroup.visible = true;
        this._placeCheckpointArchAt(this.checkpoints[this.activeCheckpointIdx], false);
      } else if (this.currentMode === 'traffic') {
        this.remainingTime = 75.0;
        this.checkpointArchGroup.visible = false;
      } else {
        this.checkpointArchGroup.visible = true;
        this._placeCheckpointArchAt(this.checkpoints[this.activeCheckpointIdx], false);
      }
    }
  }

  /**
   * Starts a structured Mission from MISSION_CATALOG (covering all 6 mission types)
   */
  startMission(missionId, playerVehicle, audioManager = null) {
    this.isMultiplayer = false;
    const mission = getMissionById(missionId);
    this.activeMission = mission;
    this._resetCommonTelemetry();
    this._setupCheckpoints();

    const p = mission.params;
    const startT = p.startT ?? 0.025;
    const startLateral = p.startLateral ?? 2.2;

    playerVehicle.resetAtTrackT(startT, startLateral);
    playerVehicle.distanceDriven = 0;
    playerVehicle.driftScoreAccum = 0;
    this.lastTrackT = startT;

    this.state = 'countdown';
    this.countdownTimer = 3.2;
    this.lastCountdownBeep = 4;

    if (mission.type === 'checkpoint_mission') {
      this.currentMode = 'checkpoint';
      this.remainingTime = p.initialTime || 26.0;
      this.totalCheckpointsToClear = p.targetGates || 8;
      this.totalRacers = 1;
      this.playerPosition = 1;
      this.traffic.spawnForMode('checkpoint', p.trafficDensity || 'low');
      this.checkpointArchGroup.visible = true;
      this._placeCheckpointArchAt(this.checkpoints[0], false);
    } else if (mission.type === 'time_challenge') {
      this.currentMode = 'timetrial';
      this.totalLaps = p.targetLaps || 1;
      this.remainingTime = p.timeLimit || 85.0;
      this.totalRacers = 1;
      this.playerPosition = 1;
      this.traffic.spawnForMode('timetrial', 'low');
      this.checkpointArchGroup.visible = true;
      this._placeCheckpointArchAt(this.checkpoints[0], false);
    } else if (mission.type === 'delivery_mission') {
      this.currentMode = 'freeroam';
      this.remainingTime = p.timeLimit || 70.0;
      this.cargoIntegrity = 100;
      this.deliveryWaypoints = (p.deliveryWaypoints || []).map((wp) => wp.clone());
      this.deliveryWaypointIdx = 0;
      this.totalRacers = 1;
      this.playerPosition = 1;
      this.traffic.spawnForMode('freeroam', p.trafficDensity || 'medium');
      this.checkpointArchGroup.visible = true;
      this._placeDeliveryArchAtCurrentWaypoint();
    } else if (mission.type === 'drift_mission') {
      this.currentMode = 'freeroam';
      this.remainingTime = p.timeLimit || 75.0;
      this.totalRacers = 1;
      this.playerPosition = 1;
      this.traffic.spawnForMode('freeroam', p.trafficDensity || 'low');
      this.checkpointArchGroup.visible = false;
    } else if (mission.type === 'traffic_avoidance') {
      this.currentMode = 'traffic';
      this.remainingTime = p.timeLimit || 65.0;
      this.totalRacers = 1;
      this.playerPosition = 1;
      this.traffic.spawnForMode('traffic', 'high');
      this.checkpointArchGroup.visible = false;
    } else if (mission.type === 'racing_mission') {
      this.currentMode = 'city_race';
      this.totalLaps = p.targetLaps || 2;
      this.totalRacers = 6;
      this.playerPosition = 6;
      this.traffic.spawnForMode(
        'city_race',
        p.trafficDensity || 'medium',
        p.aiDifficulty || 'medium',
        this.checkpoints,
        this.totalLaps
      );
      this.checkpointArchGroup.visible = true;
      this._placeCheckpointArchAt(this.checkpoints[0], false);
    }

    this._updateMissionProgressState(playerVehicle);
  }

  /**
   * Starts a synchronized 1v1 online multiplayer race on the main circuit
   */
  startMultiplayerRace({ laps = 2, slot = 1, countdownSeconds = 3.4 }, playerVehicle) {
    this.isMultiplayer = true;
    this.activeMission = null;
    this.currentMode = 'circuit';

    this._resetCommonTelemetry();
    this.totalLaps = laps || 2;
    this._setupCheckpoints();

    const startT = 0.025;
    const startLateral = slot === 1 ? -2.8 : 2.8;
    playerVehicle.resetAtTrackT(startT, startLateral);
    playerVehicle.distanceDriven = 0;
    playerVehicle.driftScoreAccum = 0;
    this.lastTrackT = startT;

    // Clean 1v1 track so both players race the exact same circuit conditions
    this.traffic.clearAll();

    this.state = 'countdown';
    this.countdownTimer = countdownSeconds;
    this.lastCountdownBeep = Math.max(4, Math.ceil(countdownSeconds) + 1);
    this.totalRacers = 2;
    this.playerPosition = slot === 1 ? 1 : 2;

    this.checkpointArchGroup.visible = true;
    this._placeCheckpointArchAt(this.checkpoints[this.activeCheckpointIdx], false);
  }

  _resetCommonTelemetry() {
    this.elapsedTime = 0;
    this.remainingTime = 0;
    this.currentLap = 1;
    this.activeCheckpointIdx = 0;
    this.checkpointsClearedInLap = 0;
    this.totalCheckpointsCleared = 0;
    this.checkpointsCleared = 0;
    this.missedCheckpointWarnCooldown = 0;
    this.cargoIntegrity = 100;
    this.deliveryWaypointIdx = 0;
    this.collisionCount = 0;
    this.wallDamageCooldown = 0;
    this.missionProgressPct = 0;
    this.missionProgressText = '';
    this.playerTotalProgress = 0;
    this.score = 0;
    this.comboMultiplier = 1;
    this.nearMissCount = 0;
    this.freeRoamBankedCredits = 0;
  }

  _setupCheckpoints() {
    this.checkpoints = [];
    for (let i = 1; i <= 10; i++) {
      const t = Number(((0.025 + i * 0.10) % 1).toFixed(4));
      this.checkpoints.push(t);
    }
    this.activeCheckpointIdx = 0;
    this.checkpointsClearedInLap = 0;
    this.totalCheckpointsCleared = 0;
  }

  _placeCheckpointArchAt(t, isFinishGate = false) {
    const sample = this.track.getSampleAt(t);
    this.checkpointArchGroup.position.copy(sample.point);
    this.checkpointArchGroup.rotation.y = sample.heading;

    if (this.checkpointArchMat) {
      if (isFinishGate) {
        this.checkpointArchMat.color.setHex(0xfbbf24);
        this.checkpointArchMat.emissive.setHex(0xf59e0b);
      } else {
        this.checkpointArchMat.color.setHex(0x22d3ee);
        this.checkpointArchMat.emissive.setHex(0x06b6d4);
      }
    }
  }

  _placeDeliveryArchAtCurrentWaypoint() {
    if (!this.deliveryWaypoints || this.deliveryWaypointIdx >= this.deliveryWaypoints.length) return;
    const wp = this.deliveryWaypoints[this.deliveryWaypointIdx];
    const proj = this.track.projectWorldPoint(wp);
    this.checkpointArchGroup.position.copy(wp);
    this.checkpointArchGroup.rotation.y = proj.heading;

    const isFinalDrop = this.deliveryWaypointIdx === this.deliveryWaypoints.length - 1;
    if (this.checkpointArchMat) {
      this.checkpointArchMat.color.setHex(isFinalDrop ? 0x22c55e : 0xfbbf24);
      this.checkpointArchMat.emissive.setHex(isFinalDrop ? 0x16a34a : 0xd97706);
    }
  }

  update(dt, playerVehicle, audioManager = null, particleSystem = null, mpOpponent = null) {
    if (this.state === 'idle' || this.state === 'finished') return;

    this.missedCheckpointWarnCooldown = Math.max(0, this.missedCheckpointWarnCooldown - dt);
    this.wallDamageCooldown = Math.max(0, this.wallDamageCooldown - dt);

    // 1. Handle 3..2..1..GO! Pre-Race Countdown
    if (this.state === 'countdown') {
      this.countdownTimer -= dt;
      const ceilSec = Math.ceil(this.countdownTimer);
      if (ceilSec < this.lastCountdownBeep && ceilSec >= 1) {
        this.lastCountdownBeep = ceilSec;
        if (this.onBannerMessage) this.onBannerMessage(String(ceilSec), 'white');
        if (audioManager) audioManager.playCountdownBeep(false);
      }

      this.traffic.update(dt, playerVehicle, false, particleSystem, audioManager, 0);

      if (this.countdownTimer <= 0) {
        this.state = 'active';
        if (this.onBannerMessage) {
          this.onBannerMessage(this.activeMission ? `Mission: ${this.activeMission.title}` : 'GO!', 'green');
        }
        if (audioManager) audioManager.playCountdownBeep(true);
      }
      return;
    }

    // 2. Active Racing / Mission State
    this.elapsedTime += dt;
    this.traffic.update(dt, playerVehicle, true, particleSystem, audioManager, this.elapsedTime);

    // Check guardrail/building wall impact for Delivery Mission cargo damage
    if (this.activeMission && this.activeMission.type === 'delivery_mission') {
      if (playerVehicle.lastCollisionImpact > 0.22 && this.wallDamageCooldown <= 0) {
        this.wallDamageCooldown = 0.6;
        this._applyDeliveryCargoDamage(playerVehicle.lastCollisionImpact * 0.65);
        if (this.state === 'finished') return;
      }
    }

    const currT = playerVehicle.currentTrackT;
    const numCp = this.checkpoints.length;

    // 3. Delivery Mission Waypoint Navigation vs Standard Sequential Checkpoints
    if (this.activeMission && this.activeMission.type === 'delivery_mission') {
      const targetWp = this.deliveryWaypoints[this.deliveryWaypointIdx];
      if (targetWp) {
        const distToWp = playerVehicle.position.distanceTo(targetWp);
        if (distToWp < 16.5) {
          if (audioManager) audioManager.playCheckpointChime();
          this.deliveryWaypointIdx += 1;
          if (this.deliveryWaypointIdx >= this.deliveryWaypoints.length) {
            this._updateMissionProgressState(playerVehicle);
            this._finishRace(true, 'VIP CARGO DELIVERED INTACT!');
            return;
          } else {
            this._placeDeliveryArchAtCurrentWaypoint();
            if (this.onBannerMessage) {
              const isLast = this.deliveryWaypointIdx === this.deliveryWaypoints.length - 1;
              this.onBannerMessage(
                isLast ? 'Final drop-off: Harbor Port Zone' : `Delivery route ${this.deliveryWaypointIdx}/${this.deliveryWaypoints.length}`,
                'cyan'
              );
            }
          }
        }
      }
    } else if (this.checkpointArchGroup.visible && numCp > 0) {
      const targetT = this.checkpoints[this.activeCheckpointIdx];
      const sample = this.track.getSampleAt(targetT);
      const distToGate = playerVehicle.position.distanceTo(sample.point);

      if (distToGate < 15.5 && playerVehicle.speed >= -1.0) {
        this._onSequentialCheckpointCleared(audioManager);
        if (this.state === 'finished') return;
      } else {
        let forwardPastGate = currT - targetT;
        if (forwardPastGate < -0.5) forwardPastGate += 1;
        if (forwardPastGate > 0.5) forwardPastGate -= 1;

        if (
          forwardPastGate > 0.045 &&
          forwardPastGate < 0.25 &&
          this.missedCheckpointWarnCooldown <= 0 &&
          this.currentMode !== 'freeroam'
        ) {
          this.missedCheckpointWarnCooldown = 3.5;
          if (this.onBannerMessage) {
            this.onBannerMessage(
              `Checkpoint ${this.activeCheckpointIdx + 1}/${numCp} missed`,
              'white'
            );
          }
        }
      }
    }

    this.lastTrackT = currT;

    // 4. Continuous Progress & Real-Time Position Tracking
    if (numCp > 0) {
      const nextCpT = this.checkpoints[this.activeCheckpointIdx];
      const prevCpT = this.activeCheckpointIdx === 0
        ? this.checkpoints[numCp - 1]
        : this.checkpoints[this.activeCheckpointIdx - 1];

      let segSpan = nextCpT - prevCpT;
      if (segSpan <= 0) segSpan += 1;
      let covered = currT - prevCpT;
      if (covered < -0.1) covered += 1;
      const frac = THREE.MathUtils.clamp(covered / Math.max(0.01, segSpan), 0, 0.999);

      this.playerTotalProgress = this.totalCheckpointsCleared + frac;
    }

    if (this.isMultiplayer) {
      this.totalRacers = 2;
      const oppAhead = mpOpponent && (mpOpponent.finished || mpOpponent.totalProgress > this.playerTotalProgress);
      this.playerPosition = oppAhead ? 2 : 1;
    } else if (this.currentMode === 'circuit' || this.currentMode === 'city_race') {
      let rank = 1;
      for (const ai of this.traffic.vehicles) {
        if (ai.isRacer && (ai.finished || ai.totalProgress > this.playerTotalProgress)) {
          rank++;
        }
      }
      this.playerPosition = rank;
    } else {
      this.playerPosition = 1;
    }

    // 5. Mission Rules & Mode Timers
    if (this.activeMission) {
      this._evaluateActiveMissionRules(dt, playerVehicle);
    } else if (this.currentMode === 'checkpoint') {
      this.remainingTime = Math.max(0, this.remainingTime - dt);
      if (this.remainingTime <= 0) {
        this._finishRace(false, 'TIME EXPIRED!');
      }
    } else if (this.currentMode === 'traffic') {
      this.remainingTime = Math.max(0, this.remainingTime - dt);
      const speedKmh = playerVehicle.getSpeedKmh();
      if (speedKmh > 100) {
        this.score += (speedKmh * 0.35 * this.comboMultiplier) * dt;
      }
      if (this.remainingTime <= 0) {
        this._finishRace(true, 'HIGHWAY RUSH COMPLETE!');
      }
    } else if (this.currentMode === 'freeroam') {
      this.score = Math.round(playerVehicle.driftScoreAccum + this.nearMissCount * 400);
    }
  }

  /**
   * Evaluates live win/fail rules and updates HUD objective progress for all 6 mission types
   */
  _evaluateActiveMissionRules(dt, playerVehicle) {
    const m = this.activeMission;
    if (!m) return;

    if (m.type !== 'racing_mission') {
      this.remainingTime = Math.max(0, this.remainingTime - dt);
    }

    if (m.type === 'drift_mission') {
      this.score = Math.round(playerVehicle.driftScoreAccum);
      this._updateMissionProgressState(playerVehicle);

      if (this.score >= m.params.targetDriftScore) {
        this._finishRace(true, 'DRIFT MISSION ACCOMPLISHED!');
        return;
      }
      if (this.remainingTime <= 0) {
        this._finishRace(false, 'TIME EXPIRED — DRIFT TARGET MISSED!');
        return;
      }
    } else if (m.type === 'traffic_avoidance') {
      const speedKmh = playerVehicle.getSpeedKmh();
      if (speedKmh > 95) {
        this.score += (speedKmh * 0.4 * this.comboMultiplier) * dt;
      }
      this._updateMissionProgressState(playerVehicle);

      if (this.nearMissCount >= m.params.targetNearMisses) {
        this._finishRace(true, 'TRAFFIC AVOIDANCE MASTERED!');
        return;
      }
      if (this.remainingTime <= 0) {
        this._finishRace(false, 'TIME EXPIRED — NEAR-MISS TARGET NOT MET!');
        return;
      }
    } else if (m.type === 'time_challenge' || m.type === 'checkpoint_mission' || m.type === 'delivery_mission') {
      this._updateMissionProgressState(playerVehicle);
      if (this.remainingTime <= 0) {
        this._finishRace(false, 'MISSION FAILED — TIME EXPIRED!');
        return;
      }
    } else if (m.type === 'racing_mission') {
      this._updateMissionProgressState(playerVehicle);
    }
  }

  _updateMissionProgressState(playerVehicle) {
    const m = this.activeMission;
    if (!m) {
      this.missionProgressPct = 0;
      this.missionProgressText = '';
      return;
    }

    const p = m.params;
    if (m.type === 'checkpoint_mission') {
      this.missionProgressPct = Math.min(100, Math.round((this.checkpointsCleared / p.targetGates) * 100));
      this.missionProgressText = `Gates Cleared: ${this.checkpointsCleared} / ${p.targetGates}`;
    } else if (m.type === 'time_challenge') {
      const totalGates = (p.targetLaps || 1) * this.checkpoints.length;
      this.missionProgressPct = Math.min(100, Math.round((this.totalCheckpointsCleared / totalGates) * 100));
      this.missionProgressText = `Sector Gates: ${this.totalCheckpointsCleared} / ${totalGates} • Beat ${p.timeLimit.toFixed(0)}s`;
    } else if (m.type === 'delivery_mission') {
      const totalWp = this.deliveryWaypoints.length || 5;
      this.missionProgressPct = Math.min(100, Math.round((this.deliveryWaypointIdx / totalWp) * 100));
      const nextWp = this.deliveryWaypoints[Math.min(totalWp - 1, this.deliveryWaypointIdx)];
      const dist = nextWp && playerVehicle ? Math.round(playerVehicle.position.distanceTo(nextWp)) : 0;
      this.missionProgressText = `Route ${this.deliveryWaypointIdx}/${totalWp} (${dist}m) • Cargo Integrity: ${this.cargoIntegrity}%`;
    } else if (m.type === 'drift_mission') {
      const currDrift = Math.round(playerVehicle ? playerVehicle.driftScoreAccum : this.score);
      this.missionProgressPct = Math.min(100, Math.round((currDrift / p.targetDriftScore) * 100));
      this.missionProgressText = `Drift Score: ${currDrift.toLocaleString()} / ${p.targetDriftScore.toLocaleString()} pts`;
    } else if (m.type === 'traffic_avoidance') {
      this.missionProgressPct = Math.min(100, Math.round((this.nearMissCount / p.targetNearMisses) * 100));
      this.missionProgressText = `Near Misses: ${this.nearMissCount} / ${p.targetNearMisses} • Collisions: ${this.collisionCount} / ${p.maxCollisions}`;
    } else if (m.type === 'racing_mission') {
      const totalGates = (p.targetLaps || 2) * this.checkpoints.length;
      this.missionProgressPct = Math.min(100, Math.round((this.totalCheckpointsCleared / totalGates) * 100));
      this.missionProgressText = `Position: #${this.playerPosition} / 6 (Target: Top ${p.requiredMaxPosition}) • Lap ${this.currentLap}/${this.totalLaps}`;
    }
  }

  _applyDeliveryCargoDamage(severity) {
    if (!this.activeMission || this.activeMission.type !== 'delivery_mission') return;
    const loss = Math.max(6, Math.round(severity * 24));
    this.cargoIntegrity = Math.max(0, this.cargoIntegrity - loss);

    if (this.onBannerMessage) {
      this.onBannerMessage(`Cargo impact -${loss}% • Integrity ${this.cargoIntegrity}%`, 'white');
    }

    if (this.cargoIntegrity < (this.activeMission.params.minIntegrity || 50)) {
      this._finishRace(false, `CARGO INTEGRITY CRITICAL (${this.cargoIntegrity}% < 50%)!`);
    }
  }

  _onSequentialCheckpointCleared(audioManager) {
    if (audioManager) audioManager.playCheckpointChime();

    const numCp = this.checkpoints.length;
    this.checkpointsClearedInLap += 1;
    this.totalCheckpointsCleared += 1;
    this.checkpointsCleared += 1;

    const completedFullLap = this.checkpointsClearedInLap >= numCp;

    if (completedFullLap) {
      this.checkpointsClearedInLap = 0;
      this.activeCheckpointIdx = 0;
    } else {
      this.activeCheckpointIdx = (this.activeCheckpointIdx + 1) % numCp;
    }

    const isNextGateFinishLine = this.activeCheckpointIdx === numCp - 1;
    this._placeCheckpointArchAt(this.checkpoints[this.activeCheckpointIdx], isNextGateFinishLine);

    if (this.activeMission) {
      const m = this.activeMission;
      if (m.type === 'checkpoint_mission') {
        const bonus = m.params.timeBonusPerGate || 10.0;
        this.remainingTime += bonus;
        if (this.checkpointsCleared >= m.params.targetGates) {
          this._finishRace(true, 'ALL MISSION CHECKPOINTS CLEARED!');
          return;
        } else if (this.onBannerMessage) {
          this.onBannerMessage(
            `Gate ${this.checkpointsCleared}/${m.params.targetGates} • +${bonus.toFixed(1)}s`,
            'cyan'
          );
        }
      } else if (m.type === 'time_challenge') {
        if (completedFullLap && this.currentLap >= this.totalLaps) {
          this._finishRace(true, 'TIME CHALLENGE COMPLETED!');
          return;
        }
      } else if (m.type === 'racing_mission') {
        if (completedFullLap) {
          this._onLapCompleted(audioManager);
          return;
        }
      }
      return;
    }

    if (this.currentMode === 'circuit' || this.currentMode === 'city_race' || this.currentMode === 'timetrial') {
      if (completedFullLap) {
        this._onLapCompleted(audioManager);
      } else if (this.onBannerMessage) {
        this.onBannerMessage(
          `Checkpoint ${this.checkpointsClearedInLap}/${numCp} cleared`,
          'cyan'
        );
      }
    } else if (this.currentMode === 'checkpoint') {
      const timeBonus = Math.max(7.5, 11.5 - this.checkpointsCleared * 0.25);
      this.remainingTime += timeBonus;

      if (this.checkpointsCleared >= this.totalCheckpointsToClear) {
        this._finishRace(true, 'ALL CHECKPOINTS CLEARED!');
      } else if (this.onBannerMessage) {
        this.onBannerMessage(
          `Checkpoint ${this.checkpointsCleared}/${this.totalCheckpointsToClear} • +${timeBonus.toFixed(1)}s`,
          'cyan'
        );
      }
    } else if (this.currentMode === 'freeroam') {
      this.saveManager.addCredits(350);
      this.freeRoamBankedCredits += 350;
      if (this.onBannerMessage) {
        this.onBannerMessage('Sector Gate • +$350', 'green');
      }
    }
  }

  _onLapCompleted(audioManager) {
    if (this.currentLap >= this.totalLaps) {
      if (this.activeMission && this.activeMission.type === 'racing_mission') {
        const reqPos = this.activeMission.params.requiredMaxPosition || 3;
        const standings = this._buildStandingsLeaderboard();
        const playerRow = standings.find((r) => r.isPlayer);
        const finalPos = playerRow ? playerRow.position : this.playerPosition;
        const won = finalPos <= reqPos;
        this._finishRace(
          won,
          won ? `RACING MISSION WON (#${finalPos} FINISH)!` : `FINISHED #${finalPos} — TOP ${reqPos} REQUIRED!`
        );
      } else {
        this._finishRace(true, 'FINISH LINE!');
      }
    } else {
      this.currentLap++;
      if (audioManager) audioManager.playCheckpointChime();
      if (this.onBannerMessage) {
        this.onBannerMessage(
          this.currentLap === this.totalLaps ? 'Final Lap' : `Lap ${this.currentLap} / ${this.totalLaps}`,
          'white'
        );
      }
    }
  }

  _handleNearMiss(speedKmh) {
    this.nearMissCount++;
    this.comboMultiplier = Math.min(5, this.comboMultiplier + 0.5);
    const pts = Math.round(250 * this.comboMultiplier);
    this.score += pts;

    if (this.activeMission && this.activeMission.type === 'traffic_avoidance') {
      if (this.onBannerMessage) {
        this.onBannerMessage(
          `Near Miss ${this.nearMissCount}/${this.activeMission.params.targetNearMisses}`,
          'green'
        );
      }
      return;
    }

    if (this.currentMode === 'freeroam') {
      this.saveManager.addCredits(200);
      this.freeRoamBankedCredits += 200;
      if (this.onBannerMessage) {
        this.onBannerMessage('Near Miss • +$200', 'green');
      }
    } else if (this.onBannerMessage) {
      this.onBannerMessage(`Near Miss ×${this.comboMultiplier.toFixed(1)} • +${pts} pts`, 'green');
    }
  }

  _handleTrafficCollision(severity = 0.5) {
    this.collisionCount++;
    if (this.comboMultiplier > 1) {
      this.comboMultiplier = 1;
    }

    if (this.activeMission) {
      if (this.activeMission.type === 'delivery_mission') {
        this._applyDeliveryCargoDamage(severity);
        return;
      }
      if (this.activeMission.type === 'traffic_avoidance') {
        const maxHits = this.activeMission.params.maxCollisions ?? 2;
        if (this.collisionCount > maxHits) {
          this._finishRace(false, `MISSION FAILED — COLLISION LIMIT EXCEEDED (${this.collisionCount}/${maxHits})!`);
          return;
        } else if (this.onBannerMessage) {
          this.onBannerMessage(`Traffic hit (${this.collisionCount}/${maxHits})`, 'white');
        }
      }
    } else if (this.currentMode === 'traffic' && this.onBannerMessage) {
      this.onBannerMessage('Collision • Combo reset', 'white');
    }
  }

  _buildStandingsLeaderboard() {
    const racers = this.traffic.getRacers();
    if (racers.length === 0) return [];

    const totalRequiredCp = this.totalLaps * this.checkpoints.length;
    const trackLen = this.track.totalLength || 2283;
    const cpLen = trackLen / Math.max(1, this.checkpoints.length);

    const entries = [
      {
        isPlayer: true,
        driverName: 'YOU (Player)',
        aiTier: 'Player',
        finished: true,
        finishTime: this.elapsedTime,
        totalProgress: totalRequiredCp
      }
    ];

    for (const r of racers) {
      let estTime = r.finishTime;
      if (!r.finished || estTime === null) {
        const remainingCp = Math.max(0.05, totalRequiredCp - r.totalProgress);
        const remainingMeters = remainingCp * cpLen;
        const avgSpeed = Math.max(35, r.baseSpeed * 0.85);
        estTime = this.elapsedTime + (remainingMeters / avgSpeed);
      }
      entries.push({
        isPlayer: false,
        driverName: r.driverName || r.name,
        carName: r.carName || '',
        aiTier: r.aiTierLabel || 'Medium AI',
        finished: r.finished,
        finishTime: estTime,
        totalProgress: r.totalProgress
      });
    }

    entries.sort((a, b) => a.finishTime - b.finishTime);
    return entries.map((item, idx) => ({
      position: idx + 1,
      ...item
    }));
  }

  _finishRace(victory, headline) {
    if (this.state === 'finished') return;
    this.state = 'finished';
    this.checkpointArchGroup.visible = false;

    // 0. Online Multiplayer 1v1 Finish -> report to server & wait for authoritative race_results
    if (this.isMultiplayer) {
      if (this.onBannerMessage) {
        this.onBannerMessage('Finish line crossed!', 'green');
      }
      if (this.onMultiplayerLocalFinish) {
        this.onMultiplayerLocalFinish(this.elapsedTime);
      }
      return;
    }

    // 1. Handle Structured Campaign Mission Completion
    if (this.activeMission) {
      const m = this.activeMission;
      let standings = [];
      if (m.type === 'racing_mission') {
        standings = this._buildStandingsLeaderboard();
        const playerRow = standings.find((r) => r.isPlayer);
        if (playerRow) this.playerPosition = playerRow.position;
      }

      const rewardCredits = victory ? m.reward : Math.round(m.reward * 0.15);
      const rankLabel = victory
        ? `MISSION COMPLETED ★ (${m.difficulty})`
        : `MISSION FAILED — ${this.missionProgressText}`;

      let isNewRecord = false;
      if (victory) {
        this.missionProgressPct = 100;
        isNewRecord = this.saveManager.markMissionCompleted(m.id, `${this.elapsedTime.toFixed(1)}s`);
      }
      this.saveManager.addCredits(rewardCredits);

      if (this.onRaceFinished) {
        this.onRaceFinished({
          isMission: true,
          missionId: m.id,
          missionSuccess: victory,
          mode: `${m.typeLabel}: ${m.title}`,
          headline,
          rankLabel,
          elapsedTime: this.elapsedTime,
          rewardCredits,
          isNewRecord,
          nearMissCount: this.nearMissCount,
          standings
        });
      }
      return;
    }

    // 2. Handle Standard Race Modes
    const settings = this.saveManager.getSettings();
    const diffKey = settings.aiDifficulty || 'medium';
    const diffBonus = AI_DIFFICULTY_PROFILES[diffKey]?.rewardBonus || 1.0;

    let rewardCredits = 0;
    let rankLabel = 'Completed';
    let isNewRecord = false;
    let standings = [];

    if (this.currentMode === 'circuit' || this.currentMode === 'city_race') {
      standings = this._buildStandingsLeaderboard();
      const playerEntry = standings.find((e) => e.isPlayer);
      if (playerEntry) {
        this.playerPosition = playerEntry.position;
      }

      const basePayouts = this.currentMode === 'city_race'
        ? [18500, 12000, 8200, 5000, 3200, 1800]
        : [16000, 10500, 7200, 4500, 2800, 1500];
      rewardCredits = Math.round(basePayouts[Math.min(5, this.playerPosition - 1)] * diffBonus);

      const suffixes = ['1st Place 🥇', '2nd Place 🥈', '3rd Place 🥉', '4th Place', '5th Place', '6th Place'];
      rankLabel = `${suffixes[Math.min(5, this.playerPosition - 1)]} (${AI_DIFFICULTY_PROFILES[diffKey]?.label || 'Medium AI'})`;
      if (this.playerPosition === 1) {
        isNewRecord = this.saveManager.recordBestTime(this.currentMode, this.elapsedTime);
      }
    } else if (this.currentMode === 'timetrial') {
      if (this.elapsedTime <= 115) {
        rankLabel = 'GOLD MEDAL 🥇';
        rewardCredits = 14000;
      } else if (this.elapsedTime <= 140) {
        rankLabel = 'SILVER MEDAL 🥈';
        rewardCredits = 9000;
      } else {
        rankLabel = 'BRONZE MEDAL 🥉';
        rewardCredits = 5500;
      }
      isNewRecord = this.saveManager.recordBestTime('timetrial', this.elapsedTime);
    } else if (this.currentMode === 'checkpoint') {
      if (victory) {
        rankLabel = `All ${this.totalCheckpointsToClear} Gates Cleared! ⚡`;
        rewardCredits = 12500 + Math.round(this.remainingTime * 180);
        isNewRecord = this.saveManager.recordBestTime('checkpoint', this.elapsedTime);
      } else {
        rankLabel = `${this.checkpointsCleared} / ${this.totalCheckpointsToClear} Gates Cleared`;
        rewardCredits = this.checkpointsCleared * 750;
      }
    } else if (this.currentMode === 'traffic') {
      const finalScore = Math.round(this.score);
      rankLabel = `Score: ${finalScore.toLocaleString()} pts (${this.nearMissCount} Near Misses)`;
      rewardCredits = Math.max(2500, Math.round(finalScore * 1.4));
      isNewRecord = this.saveManager.recordBestScore('traffic', finalScore);
    }

    this.saveManager.addCredits(rewardCredits);

    if (this.onRaceFinished) {
      this.onRaceFinished({
        isMission: false,
        mode: GAME_MODES[this.currentMode].name,
        headline,
        rankLabel,
        elapsedTime: this.elapsedTime,
        rewardCredits,
        isNewRecord,
        nearMissCount: this.nearMissCount,
        standings
      });
    }
  }

  getNextCheckpointWorldPos() {
    if (!this.checkpointArchGroup.visible) return null;
    return this.checkpointArchGroup.position;
  }
}
