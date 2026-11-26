import * as THREE from 'three';
import { CarBuilder } from '../vehicles/CarBuilder.js';

// Limit active police vehicles to 6 for smooth 60 FPS performance across desktop & mobile
const MAX_POLICE_UNITS = 6;
const SWARM_LANES = [-6.0, -2.2, 2.2, 6.0];

export class PoliceManager {
  constructor(scene, trackSpline, saveManager) {
    this.scene = scene;
    this.track = trackSpline;
    this.saveManager = saveManager;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.enabled = true;
    this.wantedLevel = 0;       // 0..5 Stars
    this.state = 'patrol';      // 'patrol' | 'pursuit' | 'escaping'
    this.heatScore = 0;
    this.escapeTimer = 0;
    this.escapeDuration = 9.0;  // Configurable visual-contact loss duration to escape
    this.escapeProgress = 0;    // 0..100%
    this.bustedTimer = 0;
    this.bustedDuration = 4.5;
    this.bustedProgress = 0;

    this.strobeTimer = 0;
    this.detectionRange = 75.0;
    this.escapeRange = 110.0;
    this.closestUnitDist = Infinity;

    this.units = [];
    this.sirenPointLight = new THREE.PointLight(0xff0022, 0, 28);
    this.scene.add(this.sirenPointLight);

    this.onPursuitNotification = null;
    this.onPursuitEscaped = null;
    this.onPlayerBusted = null;

    this._initUnitPool();
  }

  _initUnitPool() {
    for (let i = 0; i < MAX_POLICE_UNITS; i++) {
      const meshBundle = CarBuilder.buildPoliceVehicle();
      meshBundle.root.visible = false;
      this.group.add(meshBundle.root);

      this.units.push({
        id: `police_${i}`,
        active: false,
        isPolice: true,
        role: i < 4 ? 'chaser' : 'interceptor',
        mesh: meshBundle,
        t: (0.12 + i * 0.14) % 1,
        currentLateral: SWARM_LANES[i % SWARM_LANES.length],
        targetLateral: SWARM_LANES[i % SWARM_LANES.length],
        speed: 24.0,
        basePatrolSpeed: 24.0,
        position: new THREE.Vector3(),
        heading: 0,
        halfLength: meshBundle.halfLength || 2.31,
        halfWidth: meshBundle.halfWidth || 0.99,
        collisionCooldown: 0,
        avoidCooldown: 0
      });
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.clearPursuit(false);
      for (const u of this.units) {
        u.active = false;
        u.mesh.root.visible = false;
      }
      this.sirenPointLight.intensity = 0;
    }
  }

  setEscapeDuration(seconds) {
    if (Number.isFinite(seconds) && seconds > 1) {
      this.escapeDuration = seconds;
    }
  }

  resetForMode(modeId, playerVehicle) {
    this.clearPursuit(false);

    if (!this.enabled || modeId === 'timetrial') {
      for (const u of this.units) {
        u.active = false;
        u.mesh.root.visible = false;
      }
      return;
    }

    const baseT = playerVehicle ? playerVehicle.currentTrackT : 0.025;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      u.mesh.root.scale.set(1, 1, 1);
      u.mesh.root.rotation.set(0, 0, 0);

      if (i < 2) {
        u.active = true;
        u.mesh.root.visible = true;
        u.t = (baseT + 0.14 + i * 0.35) % 1;
        u.currentLateral = i % 2 === 0 ? 6.0 : 2.2;
        u.targetLateral = u.currentLateral;
        u.speed = u.basePatrolSpeed;
        this._syncUnitTransform(u, 0);
      } else {
        u.active = false;
        u.mesh.root.visible = false;
      }
    }
  }

  clearPursuit(notify = false) {
    this.wantedLevel = 0;
    this.state = 'patrol';
    this.heatScore = 0;
    this.escapeTimer = 0;
    this.escapeProgress = 0;
    this.bustedTimer = 0;
    this.bustedProgress = 0;
    this.sirenPointLight.intensity = 0;

    for (let i = 2; i < this.units.length; i++) {
      this.units[i].active = false;
      this.units[i].mesh.root.visible = false;
    }

    if (notify && this.onPursuitNotification) {
      this.onPursuitNotification('Pursuit cleared', 'cyan');
    }
  }

  /**
   * Escalates Police Pursuit according to the 1..5 Wanted Level
   */
  triggerPursuit(playerVehicle, reason = 'TRAFFIC OFFENSE', targetLevel = 1) {
    if (!this.enabled) return;

    const prevLevel = this.wantedLevel;
    this.wantedLevel = Math.max(this.wantedLevel, Math.min(5, targetLevel));
    if (this.wantedLevel <= 0) return;

    this.state = 'pursuit';
    this.escapeTimer = 0;
    this.escapeProgress = 0;

    // Scale active police units with Wanted Level (capped at MAX_POLICE_UNITS = 6 for performance)
    // Level 1: 2 units, Level 2: 3 units, Level 3: 4 units, Level 4: 5 units, Level 5: 6 units
    const desiredUnits = Math.min(MAX_POLICE_UNITS, this.wantedLevel + 1);
    const baseT = playerVehicle ? playerVehicle.currentTrackT : 0.025;
    const playerLat = playerVehicle ? playerVehicle.lateralOffset : 2.2;

    for (let i = 0; i < desiredUnits; i++) {
      const u = this.units[i];
      if (!u.active) {
        u.active = true;
        u.mesh.root.visible = true;
        u.mesh.root.scale.set(1, 1, 1);

        if (i < 4) {
          const row = Math.floor(i / 2);
          u.role = 'chaser';
          u.t = ((baseT - 0.008 - row * 0.006) % 1 + 1) % 1;
          u.currentLateral = SWARM_LANES[i % SWARM_LANES.length];
        } else {
          const row = i - 4;
          u.role = 'interceptor';
          u.t = ((baseT + 0.015 + row * 0.010) % 1 + 1) % 1;
          u.currentLateral = SWARM_LANES[i % SWARM_LANES.length];
        }
        u.targetLateral = playerLat;
        u.speed = Math.max(28, playerVehicle ? Math.abs(playerVehicle.speed) : 30);
        this._syncUnitTransform(u, 0);
      }
    }

    if (this.wantedLevel > prevLevel && this.onPursuitNotification) {
      const stars = '★'.repeat(this.wantedLevel) + '☆'.repeat(5 - this.wantedLevel);
      const msg = prevLevel === 0
        ? `Pursuit Level ${this.wantedLevel} (${stars})`
        : `Wanted Level ${this.wantedLevel} (${stars})`;
      this.onPursuitNotification(msg, 'white');
    }
  }

  /**
   * Standard traffic offense handler (reckless driving / traffic collision heat)
   */
  reportTrafficOffense(playerVehicle, severity = 0.6) {
    if (!this.enabled) return;
    if (severity < 0.35) return;

    this.heatScore += severity;
    this.escapeTimer = Math.max(0, this.escapeTimer - 2.0);

    if (this.wantedLevel === 0 && (this.closestUnitDist < 120 || this.heatScore >= 1.2)) {
      this.triggerPursuit(playerVehicle, 'RECKLESS DRIVING & TRAFFIC COLLISION', 1);
    } else if (this.wantedLevel > 0 && this.heatScore >= this.wantedLevel * 2.2 && this.wantedLevel < 5) {
      this.triggerPursuit(playerVehicle, 'WANTED HEAT ESCALATED', this.wantedLevel + 1);
    }
  }

  getActiveUnits() {
    return this.units.filter((u) => u.active);
  }

  update(dt, playerVehicle, particleSystem = null, audioManager = null, trafficVehicles = []) {
    if (!this.enabled || !playerVehicle) return;

    const clampedDt = Math.min(dt, 0.05);
    const trackLen = this.track.totalLength || 2283;
    this.strobeTimer += clampedDt;

    const redPhase = Math.sin(this.strobeTimer * 22) > 0;
    const playerSpeedKmh = playerVehicle.getSpeedKmh();

    this.closestUnitDist = Infinity;
    let closestUnit = null;

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.active) continue;

      u.collisionCooldown = Math.max(0, u.collisionCooldown - clampedDt);
      u.avoidCooldown = Math.max(0, u.avoidCooldown - clampedDt);

      if (this.wantedLevel > 0) {
        u.mesh.redStrobeMat.emissiveIntensity = redPhase ? 4.2 : 0.2;
        u.mesh.blueStrobeMat.emissiveIntensity = redPhase ? 0.2 : 4.2;
      } else {
        u.mesh.redStrobeMat.emissiveIntensity = 0.6;
        u.mesh.blueStrobeMat.emissiveIntensity = 0.6;
      }

      const distToPlayer = u.position.distanceTo(playerVehicle.position);
      if (distToPlayer < this.closestUnitDist) {
        this.closestUnitDist = distToPlayer;
        closestUnit = u;
      }

      if (this.wantedLevel === 0) {
        u.speed = THREE.MathUtils.lerp(u.speed, u.basePatrolSpeed, 1 - Math.exp(-4 * clampedDt));
        u.t = (u.t + (u.speed * clampedDt) / trackLen) % 1;
        this._syncUnitTransform(u, clampedDt);

        // Speed trap patrol detection (> 150 km/h right past a patrol car)
        if (distToPlayer < this.detectionRange && playerSpeedKmh > 150) {
          this.triggerPursuit(
            playerVehicle,
            `SPEEDING (${playerSpeedKmh} KM/H IN PATROL ZONE)`,
            1
          );
        }
      } else {
        this._updatePursuitUnitAI(u, i, clampedDt, trackLen, playerVehicle, trafficVehicles);
      }

      this._checkPolicePlayerCollision(u, playerVehicle, particleSystem, audioManager);
    }

    if (this.wantedLevel > 0) {
      if (closestUnit && this.closestUnitDist < 55) {
        this.sirenPointLight.position.copy(closestUnit.position).add(new THREE.Vector3(0, 1.8, 0));
        this.sirenPointLight.color.setHex(redPhase ? 0xff1122 : 0x0077ff);
        this.sirenPointLight.intensity = 22;
      } else {
        this.sirenPointLight.intensity = 0;
      }

      // Visual Contact Escape Mechanics
      const effectiveEscapeDist = playerVehicle.onSecondaryRoad ? 78.0 : this.escapeRange;
      if (this.closestUnitDist > effectiveEscapeDist) {
        this.state = 'escaping';
        this.escapeTimer += clampedDt;
        this.escapeProgress = Math.min(100, Math.round((this.escapeTimer / this.escapeDuration) * 100));

        if (this.escapeTimer >= this.escapeDuration) {
          const escapedStars = this.wantedLevel;
          const bounty = escapedStars * 1500;
          this.saveManager?.addCredits(bounty);
          this.clearPursuit(false);

          if (this.onPursuitNotification) {
            this.onPursuitNotification(`Pursuit evaded • +$${bounty.toLocaleString()}`, 'green');
          }
          if (this.onPursuitEscaped) {
            this.onPursuitEscaped(escapedStars, bounty);
          }
          return;
        }
      } else {
        this.state = 'pursuit';
        this.escapeTimer = Math.max(0, this.escapeTimer - clampedDt * 1.6);
        this.escapeProgress = Math.min(100, Math.round((this.escapeTimer / this.escapeDuration) * 100));
      }

      // Busted check if pinned at near-zero speed
      if (this.closestUnitDist < 8.5 && playerSpeedKmh < 12) {
        this.bustedTimer += clampedDt;
        this.bustedProgress = Math.min(100, Math.round((this.bustedTimer / this.bustedDuration) * 100));

        if (this.bustedTimer >= this.bustedDuration) {
          const fine = Math.min(this.saveManager ? this.saveManager.getCredits() : 1000, this.wantedLevel * 800);
          this.saveManager?.spendCredits(fine);
          this.clearPursuit(false);
          playerVehicle.resetAtTrackT(playerVehicle.currentTrackT, 2.2);

          if (this.onPursuitNotification) {
            this.onPursuitNotification(`Busted by Patrol • -$${fine.toLocaleString()}`, 'white');
          }
          if (this.onPlayerBusted) {
            this.onPlayerBusted(fine);
          }
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - clampedDt * 2.0);
        this.bustedProgress = Math.min(100, Math.round((this.bustedTimer / this.bustedDuration) * 100));
      }
    }
  }

  _updatePursuitUnitAI(u, unitIdx, dt, trackLen, playerVehicle, trafficVehicles = []) {
    let dT = playerVehicle.currentTrackT - u.t;
    if (dT > 0.5) dT -= 1;
    if (dT < -0.5) dT += 1;
    const signedDistMeters = dT * trackLen;

    const starBonusSpeed = 48 + this.wantedLevel * 4.6;
    let targetSpeed = starBonusSpeed;

    if (signedDistMeters > 14) {
      targetSpeed = starBonusSpeed;
    } else if (signedDistMeters >= -8 && signedDistMeters <= 14) {
      targetSpeed = Math.max(16, Math.abs(playerVehicle.speed) * 1.04);
    } else {
      targetSpeed = Math.max(8, Math.abs(playerVehicle.speed) * 0.65);
    }

    // Obstacle Avoidance: Check ahead for civilian traffic vehicles in the police car's path
    let desiredLateral = playerVehicle.lateralOffset + ((unitIdx % 3) - 1) * 0.7;
    if (u.avoidCooldown <= 0 && trafficVehicles.length > 0 && Math.abs(signedDistMeters) > 18) {
      for (let j = 0; j < trafficVehicles.length; j++) {
        const civ = trafficVehicles[j];
        if (civ.routeType !== 'spline') continue;
        let dTCiv = civ.t - u.t;
        if (dTCiv < 0) dTCiv += 1;
        const distAhead = dTCiv * trackLen;
        if (distAhead > 0 && distAhead < 22 && Math.abs(civ.currentLateral - u.currentLateral) < 2.2) {
          // Steer around civilian obstacle
          desiredLateral = civ.currentLateral > 0 ? civ.currentLateral - 3.6 : civ.currentLateral + 3.6;
          u.avoidCooldown = 0.65;
          break;
        }
      }
    }

    const accel = 20 + this.wantedLevel * 2.4;
    if (u.speed < targetSpeed) {
      u.speed = Math.min(targetSpeed, u.speed + accel * dt);
    } else {
      u.speed = Math.max(targetSpeed, u.speed - 28 * dt);
    }

    u.t = ((u.t + (u.speed * dt) / trackLen) % 1 + 1) % 1;

    const clampedLat = THREE.MathUtils.clamp(
      desiredLateral,
      -this.track.barrierHalfWidth + 1.4,
      this.track.barrierHalfWidth - 1.4
    );
    u.targetLateral = clampedLat;
    u.currentLateral = THREE.MathUtils.lerp(u.currentLateral, u.targetLateral, 1 - Math.exp(-5.8 * dt));

    this._syncUnitTransform(u, dt);
  }

  _syncUnitTransform(u, dt = 0.016) {
    const sample = this.track.getSampleAt(u.t);
    u.position.copy(sample.point).addScaledVector(sample.right, u.currentLateral);
    u.heading = sample.heading;

    u.mesh.root.position.copy(u.position);
    u.mesh.root.rotation.y = u.heading;

    const wheelSpin = (u.speed / 0.35) * dt;
    if (u.mesh.wheels) {
      for (const wm of u.mesh.wheels) {
        wm.rotation.x += wheelSpin;
      }
    }
  }

  _checkPolicePlayerCollision(u, player, particleSystem, audioManager) {
    const dx = player.position.x - u.position.x;
    const dz = player.position.z - u.position.z;
    const dy = Math.abs(player.position.y - u.position.y);
    if (dy > 2.5) return;

    const distSq = dx * dx + dz * dz;
    if (distSq > 42) return;

    const sinH = Math.sin(u.heading);
    const cosH = Math.cos(u.heading);
    const localForward = dx * sinH + dz * cosH;
    const localRight = -dx * cosH + dz * sinH;

    const combinedHalfLen = u.halfLength + 2.15;
    const combinedHalfWid = u.halfWidth + 0.96;

    const overlapLen = combinedHalfLen - Math.abs(localForward);
    const overlapWid = combinedHalfWid - Math.abs(localRight);

    if (overlapLen > 0 && overlapWid > 0) {
      const pushDist = Math.min(overlapLen, overlapWid) + 0.08;
      const dist = Math.max(0.01, Math.sqrt(distSq));
      const nx = dx / dist;
      const nz = dz / dist;

      player.position.x += nx * pushDist * 0.65;
      player.position.z += nz * pushDist * 0.65;
      u.currentLateral -= (localRight >= 0 ? 1 : -1) * Math.min(1.1, pushDist * 0.45);

      if (u.collisionCooldown <= 0) {
        u.collisionCooldown = 0.55;
        const relSpeed = Math.abs(player.speed - u.speed);
        const severity = THREE.MathUtils.clamp(relSpeed / 28, 0.28, 1.0);

        player.speed *= 0.80;
        player.lateralSpeed += (localRight >= 0 ? 1 : -1) * 4.2;
        player.collisionShake = Math.max(player.collisionShake, severity);

        if (audioManager) {
          audioManager.playCollision(severity);
        }

        // Hitting a patrol car triggers at least Wanted Level 1
        if (this.wantedLevel === 0) {
          this.triggerPursuit(player, 'POLICE CRUISER HIT', 1);
        } else {
          this.escapeTimer = 0;
        }
      }
    }
  }
}
