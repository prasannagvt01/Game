import * as THREE from 'three';

export const CAMERA_MODES = [
  { id: 'chase', name: 'Third-Person Chase' },
  { id: 'far_chase', name: 'Far Chase Cam' },
  { id: 'hood', name: 'Hood Cam' },
  { id: 'cockpit', name: 'Cockpit Cam' }
];

export class CameraController {
  constructor(camera, trackSpline = null, worldGroup = null) {
    this.camera = camera;
    this.track = trackSpline;
    this.worldGroup = worldGroup;
    this.modeIndex = 0;

    // Damped spatial state
    this.currentPos = new THREE.Vector3(0, 5, -12);
    this.currentLookAt = new THREE.Vector3(0, 1, 10);
    this.posVelocity = new THREE.Vector3();
    this.smoothedYaw = 0;
    this.smoothedSteerLook = 0;
    this.smoothedRoll = 0;
    this.smoothedPitch = 0;
    this.smoothedGForceZ = 0;
    this.lastVehicleSpeed = 0;

    // Camera collision prevention state
    this.raycaster = new THREE.Raycaster();
    this.collisionDistFactor = 1.0;
    this.lastCollisionAdjusted = false;

    // Garage orbit state
    this.orbitAngle = 0.55;
    this.orbitHeight = 2.1;
    this.orbitRadius = 6.2;

    // Mouse / drag camera rotation support
    this.manualOrbitYaw = 0;
    this.isPointerDragging = false;
    this.lastPointerX = 0;

    this._bindMouseOrbit();
  }

  setEnvironmentRefs(trackSpline, worldGroup = null) {
    this.track = trackSpline;
    this.worldGroup = worldGroup;
  }

  _bindMouseOrbit() {
    if (typeof window === 'undefined') return;

    window.addEventListener('pointerdown', (e) => {
      if (e.target.tagName !== 'CANVAS') return;
      this.isPointerDragging = true;
      this.lastPointerX = e.clientX;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDragging) return;
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.manualOrbitYaw -= dx * 0.005;
      this.orbitAngle -= dx * 0.007;
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDragging = false;
    });
  }

  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length;
    return CAMERA_MODES[this.modeIndex];
  }

  setMode(index) {
    this.modeIndex = ((index % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
    return CAMERA_MODES[this.modeIndex];
  }

  getModeId() {
    return CAMERA_MODES[this.modeIndex].id;
  }

  getModeName() {
    return CAMERA_MODES[this.modeIndex].name;
  }

  snapToVehicle(vehicle) {
    if (!vehicle) return;
    this.smoothedYaw = vehicle.heading;
    this.smoothedSteerLook = 0;
    this.smoothedRoll = 0;
    this.smoothedPitch = 0;
    this.collisionDistFactor = 1.0;

    const forward = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
    this.currentPos.copy(vehicle.position).addScaledVector(forward, -6.6).add(new THREE.Vector3(0, 2.45, 0));
    this.currentLookAt.copy(vehicle.position).addScaledVector(forward, 10).add(new THREE.Vector3(0, 1.05, 0));
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * Prevents the camera from clipping through barriers, tunnel walls/ceilings,
   * road surfaces, or 3D world geometry.
   */
  _resolveCameraCollision(dt, vehicle, desiredPos) {
    const safePos = desiredPos.clone();
    this.lastCollisionAdjusted = false;

    const pivot = new THREE.Vector3(
      vehicle.position.x,
      vehicle.position.y + 1.35,
      vehicle.position.z
    );

    // 1. Spline Corridor, Barrier Wall, Floor & Tunnel Roof Clamping
    if (this.track) {
      const proj = this.track.projectWorldPoint(safePos, vehicle.currentTrackT);

      // Minimum floor clearance above road surface / bridge ramp
      const minFloorY = Math.max(proj.roadHeight + 0.78, vehicle.position.y + 0.65);
      if (safePos.y < minFloorY) {
        safePos.y = minFloorY;
        this.lastCollisionAdjusted = true;
      }

      // Tunnel ceiling clearance
      if (proj.sector === 'tunnel' || vehicle.currentSector === 'tunnel') {
        const maxCeilingY = proj.roadHeight + 6.4;
        if (safePos.y > maxCeilingY) {
          safePos.y = maxCeilingY;
          this.lastCollisionAdjusted = true;
        }
      }

      // Guardrail / barrier wall lateral clearance (active when on main enclosed corridor)
      const maxSafeLateral = this.track.barrierHalfWidth - 0.75;
      const sideSign = Math.sign(proj.lateralOffset);
      const isOpenSide = (sideSign < 0 && proj.openLeft) || (sideSign > 0 && proj.openRight);
      if (Math.abs(proj.lateralOffset) > maxSafeLateral && !proj.onSecondaryNetwork && !vehicle.onSecondaryRoad && !isOpenSide) {
        const excess = Math.abs(proj.lateralOffset) - maxSafeLateral;

        // Push camera inward away from barrier wall / roadside buildings
        safePos.x -= proj.right.x * sideSign * (excess + 0.08);
        safePos.z -= proj.right.z * sideSign * (excess + 0.08);

        // Also pull camera slightly closer to car pivot to keep line of sight clear
        const pullRatio = THREE.MathUtils.clamp(excess / 3.5, 0, 0.38);
        safePos.lerp(pivot, pullRatio);
        this.lastCollisionAdjusted = true;
      }
    } else {
      // Fallback ground plane floor clamp
      if (safePos.y < vehicle.position.y + 0.65) {
        safePos.y = vehicle.position.y + 0.65;
        this.lastCollisionAdjusted = true;
      }
    }

    // 2. Raycast Line-of-Sight Occlusion Check from Car Pivot to Camera
    if (this.worldGroup && this.worldGroup.children.length > 0) {
      const toCam = new THREE.Vector3().subVectors(safePos, pivot);
      const fullDist = toCam.length();
      if (fullDist > 0.5) {
        const dir = toCam.clone().divideScalar(fullDist);
        this.raycaster.set(pivot, dir);
        this.raycaster.near = 0.8;
        this.raycaster.far = fullDist;

        const hits = this.raycaster.intersectObjects(this.worldGroup.children, true);
        if (hits.length > 0) {
          const hitDist = Math.max(2.1, hits[0].distance - 0.42);
          const targetFactor = hitDist / fullDist;
          this.collisionDistFactor = Math.min(this.collisionDistFactor, targetFactor);
          this.lastCollisionAdjusted = true;
        } else {
          this.collisionDistFactor = THREE.MathUtils.lerp(
            this.collisionDistFactor,
            1.0,
            1 - Math.exp(-6.5 * dt)
          );
        }

        if (this.collisionDistFactor < 0.99) {
          safePos.copy(pivot).addScaledVector(toCam, this.collisionDistFactor);
        }
      }
    }

    return safePos;
  }

  update(dt, vehicle, inputManager, isGarage = false, garageAnchor = null) {
    const clampedDt = Math.min(dt, 0.05);

    if (isGarage && garageAnchor) {
      if (!this.isPointerDragging) {
        this.orbitAngle += clampedDt * 0.35;
      }
      const targetX = garageAnchor.x + Math.sin(this.orbitAngle) * this.orbitRadius;
      const targetZ = garageAnchor.z + Math.cos(this.orbitAngle) * this.orbitRadius;
      const targetY = garageAnchor.y + this.orbitHeight;

      this.camera.up.set(0, 1, 0);
      this.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 1 - Math.exp(-8 * clampedDt));
      this.camera.lookAt(garageAnchor.x, garageAnchor.y + 0.75, garageAnchor.z);
      if (Math.abs(this.camera.fov - 50) > 0.1) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 50, clampedDt * 8);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    if (!vehicle) return;

    // Toggle exterior cabin glass visibility so Cockpit view is crystal clear
    const mode = CAMERA_MODES[this.modeIndex].id;
    if (vehicle.meshBundle && vehicle.meshBundle.cabin) {
      vehicle.meshBundle.cabin.visible = mode !== 'cockpit';
    }

    // Decay manual orbit yaw smoothly when driving
    if (!this.isPointerDragging) {
      this.manualOrbitYaw = THREE.MathUtils.lerp(this.manualOrbitYaw, 0, 1 - Math.exp(-4.5 * clampedDt));
    }

    const lookBack = Boolean(inputManager && inputManager.keys.lookBack);
    const speedKmh = Math.abs(vehicle.speed) * 3.6;

    // Compute longitudinal acceleration G-force for subtle camera surge/nod
    const accelMs2 = (vehicle.speed - this.lastVehicleSpeed) / Math.max(0.001, clampedDt);
    this.lastVehicleSpeed = vehicle.speed;
    this.smoothedGForceZ = THREE.MathUtils.lerp(
      this.smoothedGForceZ,
      THREE.MathUtils.clamp(accelMs2 * 0.015, -0.35, 0.45),
      1 - Math.exp(-10 * clampedDt)
    );

    // Damped steering look-ahead & chassis roll/pitch
    this.smoothedSteerLook = THREE.MathUtils.lerp(
      this.smoothedSteerLook,
      vehicle.steerAngle,
      1 - Math.exp(-11 * clampedDt)
    );
    this.smoothedRoll = THREE.MathUtils.lerp(
      this.smoothedRoll,
      vehicle.rollAngle || 0,
      1 - Math.exp(-14 * clampedDt)
    );
    this.smoothedPitch = THREE.MathUtils.lerp(
      this.smoothedPitch,
      vehicle.pitchAngle || 0,
      1 - Math.exp(-14 * clampedDt)
    );

    // Dynamic FOV boost with speed & nitro
    const baseFov = mode === 'cockpit' ? 68 : mode === 'hood' ? 65 : 62;
    const speedFovBoost = Math.min(15, (speedKmh / 300) * 13) + (vehicle.isNitroActive ? 6 : 0);
    const targetFov = baseFov + speedFovBoost;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-7 * clampedDt));
      this.camera.updateProjectionMatrix();
    }

    // Vehicle basis vectors in right-handed Three.js coordinates (+Y up)
    const forwardDir = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
    const rightDir = new THREE.Vector3(-Math.cos(vehicle.heading), 0, Math.sin(vehicle.heading));

    if (mode === 'chase' || mode === 'far_chase') {
      this.camera.up.set(0, 1, 0);

      const baseDist = mode === 'chase' ? 6.4 : 9.0;
      const baseHeight = mode === 'chase' ? 2.38 : 3.35;

      // Angular shortest-path damping for camera yaw
      let targetYaw = vehicle.heading + this.manualOrbitYaw + (lookBack ? Math.PI : 0);

      // Swing camera smoothly with drift slip angle for dramatic cornering feel
      if (!lookBack && Math.abs(vehicle.slipAngle) > 0.04 && speedKmh > 20) {
        targetYaw += vehicle.slipAngle * 0.42;
      }

      let yawDiff = targetYaw - this.smoothedYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

      const yawDamping = 1 - Math.exp(-9.8 * clampedDt);
      this.smoothedYaw += yawDiff * yawDamping;

      // Dynamic pullback under acceleration & push-in under braking
      const speedPullback = Math.min(1.1, (speedKmh / 260) * 0.85) + this.smoothedGForceZ * 0.45;
      const effectiveDist = baseDist * (1 + speedPullback * 0.12);

      const camBackX = -Math.sin(this.smoothedYaw) * effectiveDist;
      const camBackZ = -Math.cos(this.smoothedYaw) * effectiveDist;

      const rawDesiredPos = new THREE.Vector3(
        vehicle.position.x + camBackX,
        vehicle.position.y + baseHeight - this.smoothedPitch * 0.8,
        vehicle.position.z + camBackZ
      );

      // Subtle camera vibration on collision impact
      if (vehicle.collisionShake > 0.01) {
        rawDesiredPos.x += (Math.random() - 0.5) * vehicle.collisionShake * 0.38;
        rawDesiredPos.y += (Math.random() - 0.5) * vehicle.collisionShake * 0.28;
      }

      // Resolve camera collision against barriers, ground, tunnel ceiling & world meshes
      const collisionSafePos = this._resolveCameraCollision(clampedDt, vehicle, rawDesiredPos);

      // Critically-damped exponential position & target tracking
      const posDamping = this.lastCollisionAdjusted
        ? 1 - Math.exp(-24 * clampedDt)
        : 1 - Math.exp(-15 * clampedDt);
      this.currentPos.lerp(collisionSafePos, posDamping);
      this.camera.position.copy(this.currentPos);

      const lookAheadDist = lookBack ? -12 : 10.5;
      const desiredLookAt = new THREE.Vector3(
        vehicle.position.x + forwardDir.x * lookAheadDist + rightDir.x * (-this.smoothedSteerLook * 2.5),
        vehicle.position.y + 1.05,
        vehicle.position.z + forwardDir.z * lookAheadDist + rightDir.z * (-this.smoothedSteerLook * 2.5)
      );

      this.currentLookAt.lerp(desiredLookAt, 1 - Math.exp(-20 * clampedDt));
      this.camera.lookAt(this.currentLookAt);
    } else if (mode === 'hood') {
      // Mounted rigidly on the front center hood with subtle chassis roll & pitch
      const rollUp = new THREE.Vector3(0, 1, 0).addScaledVector(rightDir, -this.smoothedRoll * 0.65).normalize();
      this.camera.up.copy(rollUp);

      const hoodPos = new THREE.Vector3()
        .copy(vehicle.position)
        .addScaledVector(forwardDir, 0.78)
        .add(new THREE.Vector3(0, 1.22 - this.smoothedPitch * 0.45, 0));

      this.currentPos.copy(hoodPos);
      this.camera.position.copy(hoodPos);

      const lookSign = lookBack ? -1 : 1;
      const hoodTarget = new THREE.Vector3()
        .copy(hoodPos)
        .addScaledVector(forwardDir, 26 * lookSign)
        .addScaledVector(rightDir, -this.smoothedSteerLook * 3.2)
        .add(new THREE.Vector3(0, -0.35 - this.smoothedPitch * 6.5, 0));

      this.currentLookAt.copy(hoodTarget);
      this.camera.lookAt(hoodTarget);
    } else if (mode === 'cockpit') {
      // Inside driver seat (left-hand drive: -0.34 along rightDir = +0.34 X in local vehicle space)
      const rollUp = new THREE.Vector3(0, 1, 0).addScaledVector(rightDir, -this.smoothedRoll * 0.85).normalize();
      this.camera.up.copy(rollUp);

      // Subtle driver head G-force surge
      const headSurgeForward = -0.06 - this.smoothedGForceZ * 0.12;
      const seatPos = new THREE.Vector3()
        .copy(vehicle.position)
        .addScaledVector(forwardDir, headSurgeForward)
        .addScaledVector(rightDir, -0.34)
        .add(new THREE.Vector3(0, 1.12 - this.smoothedPitch * 0.25, 0));

      this.currentPos.copy(seatPos);
      this.camera.position.copy(seatPos);

      const lookSign = lookBack ? -1 : 1;
      const cockpitTarget = new THREE.Vector3()
        .copy(seatPos)
        .addScaledVector(forwardDir, 22 * lookSign)
        .addScaledVector(rightDir, -this.smoothedSteerLook * 2.6)
        .add(new THREE.Vector3(0, -0.32 - this.smoothedPitch * 5.5, 0));

      this.currentLookAt.copy(cockpitTarget);
      this.camera.lookAt(cockpitTarget);
    }
  }
}
