import * as THREE from 'three';
import { CarBuilder } from '../vehicles/CarBuilder.js';
import { CAR_CATALOG } from '../vehicles/CarCatalog.js';

const TRAFFIC_COLORS = [
  '#475569', '#dc2626', '#2563eb', '#d97706', '#059669',
  '#7c3aed', '#e2e8f0', '#334155', '#0891b2', '#ea580c'
];

// 6 distinct USA civilian vehicle archetypes with tailored speed & dynamic profiles
export const TRAFFIC_ARCHETYPES = {
  sedan:  { type: 'sedan',  label: 'Commuter Sedan',  cruiseSpeed: 24.5, accel: 9.5,  decel: 22.0 },
  suv:    { type: 'suv',    label: 'Crossover SUV',   cruiseSpeed: 23.0, accel: 8.8,  decel: 21.0 },
  muscle: { type: 'muscle', label: 'Street Muscle',   cruiseSpeed: 28.5, accel: 12.5, decel: 24.0 },
  pickup: { type: 'pickup', label: 'USA Pickup 4x4',  cruiseSpeed: 22.0, accel: 8.2,  decel: 20.0 },
  van:    { type: 'van',    label: 'Delivery Van',    cruiseSpeed: 20.5, accel: 7.5,  decel: 19.5 },
  semi:   { type: 'semi',   label: 'Freight Hauler',  cruiseSpeed: 18.5, accel: 6.0,  decel: 17.5 }
};

// AI Racing Opponent Difficulty Profiles (Easy, Medium, Hard)
export const AI_DIFFICULTY_PROFILES = {
  easy: {
    id: 'easy',
    label: 'Easy AI',
    minSpeed: 44.0,       // ~158 km/h
    maxSpeed: 51.0,       // ~184 km/h
    accelRate: 15.0,
    decelRate: 22.0,
    cornerMinFactor: 0.62,
    cornerSensitivity: 1.05,
    overtakeCooldown: 2.2,
    apexSkill: 0.45,
    rewardBonus: 1.0
  },
  medium: {
    id: 'medium',
    label: 'Medium AI',
    minSpeed: 53.0,       // ~191 km/h
    maxSpeed: 62.0,       // ~223 km/h
    accelRate: 19.5,
    decelRate: 26.5,
    cornerMinFactor: 0.73,
    cornerSensitivity: 0.88,
    overtakeCooldown: 1.4,
    apexSkill: 0.75,
    rewardBonus: 1.25
  },
  hard: {
    id: 'hard',
    label: 'Hard AI',
    minSpeed: 63.0,       // ~227 km/h
    maxSpeed: 73.5,       // ~265 km/h
    accelRate: 24.5,
    decelRate: 31.0,
    cornerMinFactor: 0.84,
    cornerSensitivity: 0.72,
    overtakeCooldown: 0.8,
    apexSkill: 1.0,
    rewardBonus: 1.6
  }
};

const RIVAL_DRIVERS = [
  { driverName: 'M. Vance',   tier: 'easy' },
  { driverName: 'K. Tanaka',  tier: 'medium' },
  { driverName: 'L. Navarro', tier: 'medium' },
  { driverName: 'S. Mercer',  tier: 'hard' },
  { driverName: 'V. Sterling', tier: 'hard' }
];

const TRAFFIC_TYPES = ['sedan', 'suv', 'muscle', 'pickup', 'van', 'semi'];
const LANES = [-6.0, -2.2, 2.2, 6.0];

const CITY_GRID_ROUTES = [
  {
    id: 'downtown_west_loop',
    name: 'West Broadway & Madison Grid Loop',
    cruiseSpeed: 16.5,
    waypoints: [
      new THREE.Vector3(6, 0, 55),
      new THREE.Vector3(109, 0, 55),
      new THREE.Vector3(109, 0, -75),
      new THREE.Vector3(6, 0, -75)
    ]
  },
  {
    id: 'downtown_east_loop',
    name: 'East Broadway & Lexington Grid Loop',
    cruiseSpeed: 16.0,
    waypoints: [
      new THREE.Vector3(-6, 0, -75),
      new THREE.Vector3(-116, 0, -75),
      new THREE.Vector3(-116, 0, 55),
      new THREE.Vector3(-6, 0, 55)
    ]
  }
];

export class TrafficManager {
  constructor(scene, trackSpline) {
    this.scene = scene;
    this.track = trackSpline;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.vehicles = [];
    this.inactivePool = [];

    this.activeMode = 'freeroam';
    this.aiDifficulty = 'medium';
    this.signalBlinkTimer = 0;
    this.recycleCount = 0;

    this.onNearMissCallback = null;
    this.onCollisionCallback = null;
  }

  _acquireTrafficMesh(type, colorHex) {
    const idx = this.inactivePool.findIndex((m) => m.type === type);
    if (idx !== -1) {
      const meshBundle = this.inactivePool.splice(idx, 1)[0];
      if (meshBundle.bodyMat) {
        meshBundle.bodyMat.color.set(colorHex);
      }
      meshBundle.root.visible = true;
      return meshBundle;
    }
    const created = CarBuilder.buildTrafficVehicle(type, colorHex);
    this.group.add(created.root);
    return created;
  }

  clearAll() {
    for (const v of this.vehicles) {
      if (v.isRacer) {
        this.group.remove(v.mesh.root);
      } else {
        v.mesh.root.visible = false;
        this.inactivePool.push(v.mesh);
      }
    }
    this.vehicles = [];
  }

  /**
   * Configures AI racers and/or civilian traffic for the active game mode
   */
  spawnForMode(mode, densitySetting = 'medium', aiDifficulty = 'medium', checkpoints = [], totalLaps = 3) {
    this.clearAll();
    this.activeMode = mode;
    this.aiDifficulty = AI_DIFFICULTY_PROFILES[aiDifficulty] ? aiDifficulty : 'medium';

    if (mode === 'timetrial') {
      return;
    }

    // Spawn 5 competitive AI Racing Opponents for both 'circuit' (Grand Prix Circuit) and 'city_race' (USA City Street Race)
    if (mode === 'circuit' || mode === 'city_race') {
      this._spawnCircuitRacers(this.aiDifficulty, checkpoints, totalLaps);
      if (mode === 'circuit') {
        return; // Pure closed circuit has only racing opponents
      }
    }

    let splineCount = 14;
    if (densitySetting === 'low') splineCount = 8;
    if (densitySetting === 'high') splineCount = 22;
    if (mode === 'traffic') splineCount = 26;
    if (mode === 'city_race') splineCount = 12; // Live city traffic during street race!

    for (let i = 0; i < splineCount; i++) {
      // Keep starting grid area (t = 0.01..0.06) clear of civilian traffic at race start
      const t = (0.085 + (i / splineCount) * 0.86) % 1;
      const typeKey = TRAFFIC_TYPES[i % TRAFFIC_TYPES.length];
      const archetype = TRAFFIC_ARCHETYPES[typeKey];
      const color = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];

      let laneIdx = i % LANES.length;
      if (typeKey === 'semi' || typeKey === 'van') {
        laneIdx = (i % 2 === 0) ? 3 : (mode === 'traffic' ? 2 : 0);
      }
      const laneOffset = LANES[laneIdx];
      const direction = (mode === 'traffic' || mode === 'city_race' || laneIdx >= 2) ? 1 : -1;

      const meshBundle = this._acquireTrafficMesh(typeKey, color);
      meshBundle.root.scale.set(1, 1, 1);
      meshBundle.root.rotation.set(0, 0, 0);
      const speedVariance = ((i % 3) - 1) * 1.4;
      const baseSpeed = Math.max(15, archetype.cruiseSpeed + speedVariance);

      const aiCar = {
        id: `traffic_${i}`,
        isRacer: false,
        routeType: 'spline',
        vehicleType: typeKey,
        name: archetype.label,
        mesh: meshBundle,
        t,
        laps: 0,
        totalProgress: t,
        direction,
        laneIdx,
        currentLateral: laneOffset,
        targetLateral: laneOffset,
        baseSpeed,
        speed: baseSpeed,
        accelRate: archetype.accel,
        decelRate: archetype.decel,
        isBraking: false,
        turnSignalDir: 0,
        position: new THREE.Vector3(),
        heading: 0,
        halfLength: meshBundle.halfLength || 2.2,
        halfWidth: meshBundle.halfWidth || 0.96,
        nearMissCooldown: 0,
        collisionCooldown: 0,
        laneChangeCooldown: 0,
        stuckTimer: 0
      };

      this._updateVehicleTransform(aiCar);
      this.vehicles.push(aiCar);
    }

    if (mode === 'freeroam' || mode === 'checkpoint' || mode === 'city_race') {
      this._spawnCityGridTraffic();
    }
  }

  _spawnCityGridTraffic() {
    let gridId = 0;
    for (let rIdx = 0; rIdx < CITY_GRID_ROUTES.length; rIdx++) {
      const route = CITY_GRID_ROUTES[rIdx];
      for (let k = 0; k < 2; k++) {
        const typeKey = TRAFFIC_TYPES[(rIdx * 2 + k) % 4];
        const archetype = TRAFFIC_ARCHETYPES[typeKey];
        const color = TRAFFIC_COLORS[(rIdx * 3 + k + 2) % TRAFFIC_COLORS.length];
        const meshBundle = this._acquireTrafficMesh(typeKey, color);
        meshBundle.root.scale.set(1, 1, 1);
        meshBundle.root.rotation.set(0, 0, 0);

        const wpIndex = (k * 2) % route.waypoints.length;
        const nextWpIndex = (wpIndex + 1) % route.waypoints.length;
        const startPos = new THREE.Vector3().lerpVectors(
          route.waypoints[wpIndex],
          route.waypoints[nextWpIndex],
          0.35
        );
        const dirVec = new THREE.Vector3().subVectors(route.waypoints[nextWpIndex], route.waypoints[wpIndex]).normalize();

        const gridCar = {
          id: `grid_traffic_${gridId++}`,
          isRacer: false,
          routeType: 'city_grid',
          route,
          wpIndex: nextWpIndex,
          vehicleType: typeKey,
          name: archetype.label,
          mesh: meshBundle,
          t: 0,
          laps: 0,
          totalProgress: 0,
          direction: 1,
          laneIdx: 2,
          currentLateral: 0,
          targetLateral: 0,
          baseSpeed: route.cruiseSpeed,
          speed: route.cruiseSpeed,
          accelRate: archetype.accel,
          decelRate: archetype.decel,
          isBraking: false,
          turnSignalDir: 0,
          position: startPos,
          heading: Math.atan2(dirVec.x, dirVec.z),
          halfLength: meshBundle.halfLength || 2.2,
          halfWidth: meshBundle.halfWidth || 0.96,
          nearMissCooldown: 0,
          collisionCooldown: 0,
          laneChangeCooldown: 0,
          stuckTimer: 0
        };

        gridCar.mesh.root.position.copy(gridCar.position);
        gridCar.mesh.root.rotation.y = gridCar.heading;
        this.vehicles.push(gridCar);
      }
    }
  }

  /**
   * Spawns 5 competitive AI Racing Opponents arranged on a staggered 2-column starting grid
   * with Easy, Medium, and Hard AI behavior profiles and sequential checkpoint navigation.
   */
  _spawnCircuitRacers(difficultyKey = 'medium', checkpoints = [], totalLaps = 3) {
    const profile = AI_DIFFICULTY_PROFILES[difficultyKey] || AI_DIFFICULTY_PROFILES.medium;
    const startLineT = 0.025;
    // Staggered motorsport starting grid slots behind/at start line (Player starts at P6: t = 0.017, lateral = -3.4)
    const gridSlots = [
      { tOffset: 0.008, lateral: 3.4 },  // P1 Pole Position
      { tOffset: 0.006, lateral: -3.4 }, // P2
      { tOffset: 0.004, lateral: 3.4 },  // P3
      { tOffset: 0.002, lateral: -3.4 }, // P4
      { tOffset: 0.000, lateral: 3.4 }   // P5
    ];

    for (let i = 0; i < 5; i++) {
      const carDef = CAR_CATALOG[(i + 1) % CAR_CATALOG.length];
      const rivalInfo = RIVAL_DRIVERS[i];
      const meshBundle = CarBuilder.buildRaceCar(carDef, carDef.defaultColor, false);
      this.group.add(meshBundle.root);

      const slot = gridSlots[i];
      const t = (startLineT + slot.tOffset) % 1;
      const speedFraction = i / 4; // 0..1 across the 5 opponents
      const baseSpeed = THREE.MathUtils.lerp(profile.minSpeed, profile.maxSpeed, speedFraction);

      const racer = {
        id: `racer_${i}`,
        isRacer: true,
        routeType: 'spline',
        vehicleType: 'racer',
        driverName: rivalInfo.driverName,
        name: `${rivalInfo.driverName} (${carDef.name})`,
        carName: carDef.name,
        difficulty: difficultyKey,
        aiTierLabel: profile.label,
        profile,
        mesh: meshBundle,
        t,
        // Sequential checkpoint & lap navigation state
        checkpoints: [...checkpoints],
        activeCheckpointIdx: 0,
        checkpointsClearedInLap: 0,
        totalCheckpointsCleared: 0,
        laps: 0,
        currentLap: 1,
        totalLaps,
        totalProgress: slot.tOffset, // Initial grid order progress
        finished: false,
        finishTime: null,
        direction: 1,
        laneIdx: i % 2 === 0 ? 2 : 1,
        currentLateral: slot.lateral,
        targetLateral: slot.lateral,
        baseSpeed,
        speed: 0,
        accelRate: profile.accelRate,
        decelRate: profile.decelRate,
        isBraking: false,
        turnSignalDir: 0,
        position: new THREE.Vector3(),
        heading: 0,
        halfLength: 2.25,
        halfWidth: 1.0,
        nearMissCooldown: 0,
        collisionCooldown: 0,
        laneChangeCooldown: 0.8 + i * 0.25,
        stuckTimer: 0
      };

      this._updateVehicleTransform(racer);
      this.vehicles.push(racer);
    }
  }

  getRacers() {
    return this.vehicles.filter((v) => v.isRacer);
  }

  update(dt, playerVehicle, canMove = true, particleSystem = null, audioManager = null, elapsedRaceTime = 0) {
    const clampedDt = Math.min(dt, 0.05);
    const trackLen = this.track.totalLength || 2283;
    this.signalBlinkTimer += clampedDt;
    const blinkOn = Math.sin(this.signalBlinkTimer * 11) > 0;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      v.nearMissCooldown = Math.max(0, v.nearMissCooldown - clampedDt);
      v.collisionCooldown = Math.max(0, v.collisionCooldown - clampedDt);
      v.laneChangeCooldown = Math.max(0, v.laneChangeCooldown - clampedDt);

      if (!canMove) {
        this._updateVehicleTransform(v, 0);
        continue;
      }

      if (v.routeType === 'city_grid') {
        this._updateCityGridVehicle(v, clampedDt, playerVehicle);
      } else {
        this._updateSplineVehicle(v, i, clampedDt, trackLen, playerVehicle, elapsedRaceTime);
      }

      if (v.mesh.taillightMat) {
        v.mesh.taillightMat.emissiveIntensity = v.isBraking ? 3.5 : 1.0;
      }
      if (v.mesh.leftSignalMat && v.mesh.rightSignalMat) {
        const isChangingLane = Math.abs(v.targetLateral - v.currentLateral) > 0.25;
        if (!isChangingLane) v.turnSignalDir = 0;
        v.mesh.leftSignalMat.emissiveIntensity = (v.turnSignalDir < 0 && blinkOn) ? 3.0 : 0.1;
        v.mesh.rightSignalMat.emissiveIntensity = (v.turnSignalDir > 0 && blinkOn) ? 3.0 : 0.1;
      }

      if (playerVehicle) {
        this._checkPlayerInteraction(v, playerVehicle, particleSystem, audioManager);
      }
    }

    if (canMove && playerVehicle && this.activeMode !== 'circuit') {
      this._manageSpawnLifecycle(clampedDt, playerVehicle);
    }
  }

  _updateSplineVehicle(v, index, dt, trackLen, playerVehicle, elapsedRaceTime = 0) {
    let desiredSpeed = v.baseSpeed;
    v.isBraking = false;

    // If an AI racer has already finished the race, cruise at a cool-down speed
    if (v.isRacer && v.finished) {
      desiredSpeed = 28.0;
    }

    // 1. Look ahead for road curvature & cornering apex racing line
    const lookAheadOffset = v.isRacer ? 0.018 : 0.012;
    const aheadSample = this.track.getSampleAt((v.t + lookAheadOffset * v.direction + 1) % 1);
    const currSample = this.track.getSampleAt(v.t);
    let signedCornerAngle = aheadSample.heading - currSample.heading;
    while (signedCornerAngle > Math.PI) signedCornerAngle -= Math.PI * 2;
    while (signedCornerAngle < -Math.PI) signedCornerAngle += Math.PI * 2;

    const absCornerAngle = Math.abs(signedCornerAngle);
    const minFactor = v.isRacer && v.profile ? v.profile.cornerMinFactor : 0.74;
    const cornerSens = v.isRacer && v.profile ? v.profile.cornerSensitivity : 0.92;
    const cornerSlowdown = Math.max(minFactor, 1 - absCornerAngle * cornerSens);
    desiredSpeed *= cornerSlowdown;

    // AI Racers hug the inside corner apex when no obstacle is blocking
    if (v.isRacer && !v.finished && absCornerAngle > 0.08 && v.laneChangeCooldown <= 0) {
      const apexSide = signedCornerAngle > 0 ? -1 : 1; // Inside of turn
      const apexOffset = apexSide * 3.8 * (v.profile ? v.profile.apexSkill : 0.7);
      if (this._isLateralSlotClear(v, apexOffset, trackLen, playerVehicle, false)) {
        v.targetLateral = apexOffset;
      }
    }

    // 2. Distance keeping & obstacle avoidance against other AI vehicles ahead
    let closestGap = Infinity;
    let leaderSpeed = desiredSpeed;

    for (let j = 0; j < this.vehicles.length; j++) {
      if (index === j) continue;
      const other = this.vehicles[j];
      if (other.routeType !== 'spline' || other.direction !== v.direction) continue;

      let dT = (other.t - v.t) * v.direction;
      if (dT < 0) dT += 1;
      const centerDist = dT * trackLen;
      const bumperGap = centerDist - (v.halfLength + other.halfLength);

      if (centerDist > 0 && centerDist < 36 && Math.abs(other.currentLateral - v.currentLateral) < 2.35) {
        if (bumperGap < closestGap) {
          closestGap = bumperGap;
          leaderSpeed = other.speed;
        }
      }
    }

    // 3. React to the Player's vehicle
    if (playerVehicle && !playerVehicle.onSecondaryRoad) {
      let dTPlayer = (playerVehicle.currentTrackT - v.t) * v.direction;
      if (dTPlayer < 0) dTPlayer += 1;
      const distAheadToPlayer = dTPlayer * trackLen;
      const distBehindToPlayer = (1 - dTPlayer) * trackLen;
      const lateralDiff = Math.abs(playerVehicle.lateralOffset - v.currentLateral);
      const playerSpeedInDir = playerVehicle.speed * v.direction;

      if (distAheadToPlayer > 0 && distAheadToPlayer < 38 && lateralDiff < 2.45) {
        const playerBumperGap = distAheadToPlayer - (v.halfLength + 2.25);

        if (playerSpeedInDir >= -2) {
          if (playerBumperGap < closestGap) {
            closestGap = playerBumperGap;
            leaderSpeed = Math.max(0, playerSpeedInDir);
          }
        } else {
          v.isBraking = true;
          desiredSpeed = Math.min(desiredSpeed, 4.0);
          if (v.laneChangeCooldown <= 0) {
            this._trySafeLaneChange(v, playerVehicle, true);
          }
        }
      }

      if (!v.isRacer && distBehindToPlayer > 0 && distBehindToPlayer < 26 && lateralDiff < 2.2) {
        if (playerSpeedInDir > v.speed + 10 && v.laneChangeCooldown <= 0) {
          this._trySafeLaneChange(v, playerVehicle, false);
        }
      }
    }

    // 4. Overtake or apply IDM progressive braking
    if (closestGap < 28) {
      const canTryOvertake = v.laneChangeCooldown <= 0 && (leaderSpeed < desiredSpeed * 0.94 || closestGap < 18);
      let changedLane = false;
      if (canTryOvertake) {
        changedLane = this._trySafeLaneChange(v, playerVehicle, false);
      }

      if (!changedLane) {
        const minSafeGap = v.isRacer ? 4.2 : 5.5;
        const desiredGap = minSafeGap + v.speed * (v.isRacer ? 0.75 : 1.15);
        if (closestGap <= minSafeGap) {
          desiredSpeed = 0;
          v.isBraking = true;
        } else if (closestGap < desiredGap) {
          const gapRatio = THREE.MathUtils.clamp((closestGap - minSafeGap) / (desiredGap - minSafeGap), 0, 1);
          desiredSpeed = Math.min(desiredSpeed, leaderSpeed * gapRatio);
          v.isBraking = true;
        }
      }
    }

    // 5. Smooth Acceleration & Braking Integration
    if (v.speed < desiredSpeed) {
      v.speed = Math.min(desiredSpeed, v.speed + v.accelRate * dt);
    } else if (v.speed > desiredSpeed) {
      const brakeIntensity = closestGap < 9 ? v.decelRate * 1.45 : v.decelRate;
      v.speed = Math.max(desiredSpeed, v.speed - brakeIntensity * dt);
      if (v.speed - desiredSpeed > 0.3) v.isBraking = true;
    }
    if (closestGap < 12 && v.speed < 2.5) {
      v.isBraking = true;
    }

    // Advance along road spline
    const deltaT = (v.speed * dt / trackLen) * v.direction;
    v.t = ((v.t + deltaT) % 1 + 1) % 1;

    const lateralLerpRate = v.isRacer ? 7.0 : 5.5;
    v.currentLateral = THREE.MathUtils.lerp(v.currentLateral, v.targetLateral, 1 - Math.exp(-lateralLerpRate * dt));
    this._updateVehicleTransform(v, dt);

    // 6. AI Racer Sequential Checkpoint & Lap Completion Navigation
    if (v.isRacer && v.checkpoints && v.checkpoints.length > 0 && !v.finished) {
      this._updateRacerCheckpoints(v, elapsedRaceTime);
    }
  }

  /**
   * Advances AI racer through sequential checkpoints and records lap/race completion
   */
  _updateRacerCheckpoints(racer, elapsedRaceTime) {
    const numCp = racer.checkpoints.length;
    const targetCpT = racer.checkpoints[racer.activeCheckpointIdx];
    const cpSample = this.track.getSampleAt(targetCpT);

    // Check if AI racer reached its active sequential checkpoint gate
    const distToCp = racer.position.distanceTo(cpSample.point);
    let dTToCp = targetCpT - racer.t;
    if (dTToCp > 0.5) dTToCp -= 1;
    if (dTToCp < -0.5) dTToCp += 1;

    if (distToCp < 18.0 || Math.abs(dTToCp) < 0.012) {
      racer.checkpointsClearedInLap += 1;
      racer.totalCheckpointsCleared += 1;

      // Did the AI racer just cross the final checkpoint (Finish Line Gate) of the lap?
      if (racer.checkpointsClearedInLap >= numCp) {
        racer.laps += 1;
        racer.checkpointsClearedInLap = 0;
        racer.activeCheckpointIdx = 0;

        if (racer.laps >= racer.totalLaps) {
          racer.finished = true;
          racer.finishTime = elapsedRaceTime;
        } else {
          racer.currentLap = racer.laps + 1;
        }
      } else {
        racer.activeCheckpointIdx = (racer.activeCheckpointIdx + 1) % numCp;
      }
    }

    // Compute exact continuous race progress for real-time position tracking
    const nextCpT = racer.checkpoints[racer.activeCheckpointIdx];
    const prevCpT = racer.activeCheckpointIdx === 0
      ? racer.checkpoints[numCp - 1]
      : racer.checkpoints[racer.activeCheckpointIdx - 1];

    let segSpan = nextCpT - prevCpT;
    if (segSpan <= 0) segSpan += 1;
    let covered = racer.t - prevCpT;
    if (covered < -0.1) covered += 1;
    const frac = THREE.MathUtils.clamp(covered / Math.max(0.01, segSpan), 0, 0.999);

    racer.totalProgress = racer.totalCheckpointsCleared + frac;
  }

  _trySafeLaneChange(v, playerVehicle, isEmergencyEvade = false) {
    const trackLen = this.track.totalLength || 2283;

    if (v.isRacer) {
      const candidateOffsets = [-4.5, -1.8, 1.8, 4.5].sort(
        (a, b) => Math.abs(a - v.currentLateral) - Math.abs(b - v.currentLateral)
      );
      for (const candLat of candidateOffsets) {
        if (Math.abs(candLat - v.currentLateral) < 1.5) continue;
        if (this._isLateralSlotClear(v, candLat, trackLen, playerVehicle, isEmergencyEvade)) {
          v.turnSignalDir = candLat > v.currentLateral ? 1 : -1;
          v.targetLateral = candLat;
          v.laneChangeCooldown = v.profile ? v.profile.overtakeCooldown : 1.4;
          return true;
        }
      }
      return false;
    }

    const validLaneIndices = (this.activeMode === 'traffic' || this.activeMode === 'city_race')
      ? [0, 1, 2, 3]
      : (v.direction === 1 ? [2, 3] : [0, 1]);

    const candidateIndices = validLaneIndices
      .filter((idx) => idx !== v.laneIdx)
      .sort((a, b) => Math.abs(a - v.laneIdx) - Math.abs(b - v.laneIdx));

    for (const candIdx of candidateIndices) {
      const candLateral = LANES[candIdx];
      if (this._isLateralSlotClear(v, candLateral, trackLen, playerVehicle, isEmergencyEvade)) {
        v.turnSignalDir = (candLateral - v.currentLateral) * v.direction > 0 ? 1 : -1;
        v.laneIdx = candIdx;
        v.targetLateral = candLateral;
        v.laneChangeCooldown = isEmergencyEvade ? 1.2 : 2.6;
        return true;
      }
    }

    return false;
  }

  _isLateralSlotClear(v, candidateLateral, trackLen, playerVehicle, isEmergency = false) {
    const forwardMargin = isEmergency ? 11 : (v.isRacer ? 16 : 22);
    const rearMargin = isEmergency ? 8 : (v.isRacer ? 11 : 15);

    for (const other of this.vehicles) {
      if (other === v || other.routeType !== 'spline') continue;
      if (Math.abs(other.currentLateral - candidateLateral) < 2.2 || Math.abs(other.targetLateral - candidateLateral) < 2.2) {
        let dT = (other.t - v.t) * v.direction;
        if (dT > 0.5) dT -= 1;
        if (dT < -0.5) dT += 1;
        const signedDist = dT * trackLen;

        if (signedDist > -rearMargin && signedDist < forwardMargin) {
          return false;
        }
      }
    }

    if (playerVehicle && !playerVehicle.onSecondaryRoad) {
      if (Math.abs(playerVehicle.lateralOffset - candidateLateral) < 2.3) {
        let dT = (playerVehicle.currentTrackT - v.t) * v.direction;
        if (dT > 0.5) dT -= 1;
        if (dT < -0.5) dT += 1;
        const signedDist = dT * trackLen;

        if (signedDist > -rearMargin && signedDist < forwardMargin) {
          return false;
        }
      }
    }

    return true;
  }

  _updateCityGridVehicle(v, dt, playerVehicle) {
    const targetWp = v.route.waypoints[v.wpIndex];
    const toTarget = new THREE.Vector3().subVectors(targetWp, v.position);
    toTarget.y = 0;
    const distToWp = toTarget.length();

    if (distToWp < 4.5) {
      v.wpIndex = (v.wpIndex + 1) % v.route.waypoints.length;
    }

    const nextWp = v.route.waypoints[v.wpIndex];
    const dir = new THREE.Vector3().subVectors(nextWp, v.position);
    dir.y = 0;
    const dist = Math.max(0.01, dir.length());
    dir.divideScalar(dist);

    const desiredHeading = Math.atan2(dir.x, dir.z);
    let hDiff = desiredHeading - v.heading;
    while (hDiff > Math.PI) hDiff -= Math.PI * 2;
    while (hDiff < -Math.PI) hDiff += Math.PI * 2;
    v.heading += hDiff * Math.min(1, 7.5 * dt);

    let desiredSpeed = dist < 14 ? v.baseSpeed * 0.65 : v.baseSpeed;
    v.isBraking = false;

    const forwardX = Math.sin(v.heading);
    const forwardZ = Math.cos(v.heading);

    if (playerVehicle) {
      const dx = playerVehicle.position.x - v.position.x;
      const dz = playerVehicle.position.z - v.position.z;
      const fwdDist = dx * forwardX + dz * forwardZ;
      const latDist = Math.abs(-dx * forwardZ + dz * forwardX);

      if (fwdDist > 0 && fwdDist < 22 && latDist < 3.2) {
        desiredSpeed = fwdDist < 8.5 ? 0 : Math.min(desiredSpeed, Math.max(0, playerVehicle.speed * 0.7));
        v.isBraking = true;
      }
    }

    for (const other of this.vehicles) {
      if (other === v) continue;
      const dx = other.position.x - v.position.x;
      const dz = other.position.z - v.position.z;
      const fwdDist = dx * forwardX + dz * forwardZ;
      const latDist = Math.abs(-dx * forwardZ + dz * forwardX);

      if (fwdDist > 0 && fwdDist < 16 && latDist < 2.8) {
        desiredSpeed = fwdDist < 7.5 ? 0 : Math.min(desiredSpeed, other.speed * 0.8);
        v.isBraking = true;
      }
    }

    if (v.speed < desiredSpeed) {
      v.speed = Math.min(desiredSpeed, v.speed + v.accelRate * dt);
    } else {
      v.speed = Math.max(desiredSpeed, v.speed - v.decelRate * dt);
    }

    v.position.x += Math.sin(v.heading) * v.speed * dt;
    v.position.z += Math.cos(v.heading) * v.speed * dt;
    v.position.y = 0;

    v.mesh.root.position.copy(v.position);
    v.mesh.root.rotation.y = v.heading;

    const wheelSpin = (v.speed / 0.35) * dt;
    if (v.mesh.wheels) {
      for (const wm of v.mesh.wheels) {
        wm.rotation.x += wheelSpin;
      }
    }
  }

  _manageSpawnLifecycle(dt, playerVehicle) {
    const trackLen = this.track.totalLength || 2283;

    for (const v of this.vehicles) {
      if (v.isRacer || v.routeType !== 'spline') continue;

      if (v.speed < 0.5) {
        v.stuckTimer += dt;
      } else {
        v.stuckTimer = 0;
      }

      const distToPlayer = v.position.distanceTo(playerVehicle.position);
      if (v.stuckTimer > 8.0 && distToPlayer > 45) {
        this.recycleTrafficVehicle(v, playerVehicle, trackLen);
      }
    }
  }

  recycleTrafficVehicle(v, playerVehicle, trackLen = 2283) {
    const baseT = playerVehicle ? playerVehicle.currentTrackT : 0.025;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidateT = (baseT + 0.12 + Math.random() * 0.65) % 1;
      const laneIdx = (this.activeMode === 'traffic' || this.activeMode === 'city_race')
        ? Math.floor(Math.random() * 4)
        : (v.direction === 1 ? (2 + (attempt % 2)) : (attempt % 2));
      const candidateLat = LANES[laneIdx];

      v.t = candidateT;
      if (this._isLateralSlotClear(v, candidateLat, trackLen, playerVehicle, true)) {
        v.laneIdx = laneIdx;
        v.currentLateral = candidateLat;
        v.targetLateral = candidateLat;
        v.speed = v.baseSpeed;
        v.stuckTimer = 0;
        v.isBraking = false;
        this._updateVehicleTransform(v, 0);
        this.recycleCount++;
        return true;
      }
    }
    v.stuckTimer = 0;
    return false;
  }

  _updateVehicleTransform(v, dt = 0.016) {
    const sample = this.track.getSampleAt(v.t);
    v.position.copy(sample.point).addScaledVector(sample.right, v.currentLateral);
    v.heading = v.direction === 1 ? sample.heading : sample.heading + Math.PI;

    v.mesh.root.position.copy(v.position);
    v.mesh.root.rotation.y = v.heading;

    const wheelSpin = (v.speed / 0.35) * dt;
    if (v.isRacer && v.mesh.wheels) {
      for (const w of v.mesh.wheels) {
        w.spinHub.rotation.x += wheelSpin;
      }
    } else if (v.mesh.wheels) {
      for (const wm of v.mesh.wheels) {
        wm.rotation.x += wheelSpin;
      }
    }
  }

  _checkPlayerInteraction(aiCar, player, particleSystem, audioManager) {
    const dx = player.position.x - aiCar.position.x;
    const dz = player.position.z - aiCar.position.z;
    const dy = Math.abs(player.position.y - aiCar.position.y);
    if (dy > 2.5) return;

    const distSq = dx * dx + dz * dz;
    if (distSq > 44) return;

    const sinH = Math.sin(aiCar.heading);
    const cosH = Math.cos(aiCar.heading);
    const localForward = dx * sinH + dz * cosH;
    const localRight = -dx * cosH + dz * sinH;

    const combinedHalfLen = aiCar.halfLength + 2.15;
    const combinedHalfWid = aiCar.halfWidth + 0.96;

    const overlapLen = combinedHalfLen - Math.abs(localForward);
    const overlapWid = combinedHalfWid - Math.abs(localRight);

    if (overlapLen > 0 && overlapWid > 0) {
      const pushDist = Math.min(overlapLen, overlapWid) + 0.08;
      const dist = Math.max(0.01, Math.sqrt(distSq));
      const nx = dx / dist;
      const nz = dz / dist;

      player.position.x += nx * pushDist * 0.7;
      player.position.z += nz * pushDist * 0.7;
      if (aiCar.routeType === 'spline') {
        aiCar.currentLateral -= (localRight >= 0 ? 1 : -1) * Math.min(1.2, pushDist * 0.5);
      }

      if (aiCar.collisionCooldown <= 0) {
        aiCar.collisionCooldown = 0.55;
        const relSpeed = Math.abs(player.speed - aiCar.speed * aiCar.direction);
        const playerSpeedKmh = player.getSpeedKmh ? player.getSpeedKmh() : Math.abs(player.speed) * 3.6;
        const severity = THREE.MathUtils.clamp((relSpeed / 28) * 0.7 + (playerSpeedKmh / 180) * 0.3, 0.12, 1.0);

        player.speed *= 0.80;
        player.lateralSpeed += (localRight >= 0 ? 1 : -1) * 4.2;
        player.collisionShake = Math.max(player.collisionShake, severity);
        aiCar.speed *= 0.60;

        if (audioManager) {
          audioManager.playCollision(severity);
        }
        if (this.onCollisionCallback) {
          this.onCollisionCallback(severity, aiCar);
        }
      }
    } else if (
      aiCar.nearMissCooldown <= 0 &&
      Math.abs(localForward) < combinedHalfLen + 0.8 &&
      Math.abs(localRight) < combinedHalfWid + 1.35 &&
      player.getSpeedKmh() >= 95
    ) {
      aiCar.nearMissCooldown = 2.5;
      if (this.onNearMissCallback) {
        this.onNearMissCallback(player.getSpeedKmh());
      }
    }
  }
}
