import * as THREE from 'three';

const DEFAULT_GEAR_RATIOS = [3.25, 2.26, 1.65, 1.26, 1.00, 0.84];
const WHEEL_RADIUS = 0.36;

export class VehiclePhysics {
  constructor(trackSpline) {
    this.track = trackSpline;

    // Spatial state
    this.position = new THREE.Vector3(0, 0, 5);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.heading = 0; // Radians around Y (0 = +Z)
    this.speed = 0;   // Signed longitudinal speed in m/s (+ forward, - reverse)
    this.lateralSpeed = 0; // Signed lateral slip velocity in m/s
    this.currentSpeedKmh = 0;

    // Steering & Drift state
    this.steerAngle = 0;
    this.slipAngle = 0;
    this.isDrifting = false;
    this.isHandbraking = false;
    this.driftScoreAccum = 0;
    this.currentDriftPoints = 0;

    // Powertrain & Telemetry
    this.rpm = 950;
    this.gear = 1; // -1 = R, 0 = N, 1..6 = Forward gears
    this.shiftTimer = 0;
    this.nitroAmount = 100; // 0..100
    this.isNitroActive = false;

    // Suspension & Wheel rotation
    this.pitchAngle = 0;
    this.rollAngle = 0;
    this.wheelSpinAngle = 0;
    this.suspTime = 0;

    // Track projection cache
    this.currentTrackT = 0.025;
    this.currentSector = 'city';
    this.currentDistrict = 'Downtown Financial District';
    this.onSecondaryRoad = false;
    this.lateralOffset = 0;
    this.distanceDriven = 0;

    // Collision feedback & cooldown
    this.collisionShake = 0;
    this.lastCollisionImpact = 0;
    this.wallHitCooldown = 0;

    // Weather & Lighting integration
    this.weatherModifiers = {
      weather: 'clear',
      gripMultiplier: 1.0,
      brakeMultiplier: 1.0,
      launchMultiplier: 1.0
    };
    this.headlightsActive = false;

    this.specs = null;
    this.meshBundle = null;
  }

  setWeatherModifiers(mods) {
    if (!mods) return;
    this.weatherModifiers = {
      weather: mods.weather || 'clear',
      gripMultiplier: mods.gripMultiplier ?? 1.0,
      brakeMultiplier: mods.brakeMultiplier ?? 1.0,
      launchMultiplier: mods.launchMultiplier ?? 1.0
    };
  }

  setHeadlightsActive(active) {
    this.headlightsActive = Boolean(active);
    if (this.meshBundle) {
      if (this.meshBundle.headSpotLight) {
        this.meshBundle.headSpotLight.visible = this.headlightsActive;
      }
      if (this.meshBundle.headlightMat) {
        this.meshBundle.headlightMat.emissiveIntensity = this.headlightsActive ? 3.2 : 0.65;
      }
    }
  }

  attachCar(meshBundle, effectiveSpecs) {
    this.meshBundle = meshBundle;
    this.specs = effectiveSpecs;
    this.rpm = effectiveSpecs.idleRpm || 950;
    this.syncMeshTransform();
  }

  resetAtTrackT(t = 0.025, lateralLaneOffset = 0) {
    const sample = this.track.getSampleAt(t);
    this.currentTrackT = sample.t;
    this.heading = sample.heading;
    this.position.copy(sample.point).addScaledVector(sample.right, lateralLaneOffset);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.lateralSpeed = 0;
    this.currentSpeedKmh = 0;
    this.steerAngle = 0;
    this.slipAngle = 0;
    this.isDrifting = false;
    this.isHandbraking = false;
    this.gear = 1;
    this.rpm = this.specs ? this.specs.idleRpm : 950;
    this.pitchAngle = 0;
    this.rollAngle = 0;
    this.collisionShake = 0;
    this.wallHitCooldown = 0;
    this.syncMeshTransform();
  }

  update(dt, input, particleSystem = null, audioManager = null) {
    if (!this.specs || !this.meshBundle) return;

    const clampedDt = Math.min(dt, 0.05);
    this.suspTime += clampedDt;
    this.collisionShake = Math.max(0, this.collisionShake - clampedDt * 3.5);
    this.wallHitCooldown = Math.max(0, this.wallHitCooldown - clampedDt);
    this.lastCollisionImpact = 0;

    const throttleInput = input.getThrottle(); // W
    const brakeInput = input.getBrake();       // S (Brake / Reverse)
    const rawSteer = input.getSteerInput();    // A (+1 Left) / D (-1 Right)
    const handbrake = Boolean(input.keys.handbrake); // Space
    const wantsNitro = Boolean(input.keys.nitro);

    this.isHandbraking = handbrake;

    const maxSpeedMs = this.specs.topSpeedKmh / 3.6;
    const absSpeed = Math.abs(this.speed);
    const speedKmh = absSpeed * 3.6;

    // 1. Nitro Boost System
    if (wantsNitro && throttleInput > 0.1 && this.nitroAmount > 2 && this.speed > 3) {
      this.isNitroActive = true;
      this.nitroAmount = Math.max(0, this.nitroAmount - 24 * clampedDt);
    } else {
      this.isNitroActive = false;
      const recharge = (this.specs.nitroRechargeRate || 1) * (this.isDrifting ? 15 : 6.5);
      this.nitroAmount = Math.min(100, this.nitroAmount + recharge * clampedDt);
    }

    // 2. Speed-Dependent Steering with Fast Self-Centering Caster Return & Suspension Stiffness
    const suspStiffness = this.specs.suspensionStiffness || 1.0;
    const speedFactor = 1 / (1 + Math.pow(speedKmh / (142 + (suspStiffness - 1) * 35), 1.28));
    const maxSteerRad = 0.50 * Math.max(0.22, speedFactor);
    const targetSteer = rawSteer * maxSteerRad;
    const baseSteerRate = Math.abs(rawSteer) > 0.01 ? 12.5 : 16.5;
    const steerResponse = baseSteerRate * (0.85 + suspStiffness * 0.15);
    this.steerAngle = THREE.MathUtils.lerp(
      this.steerAngle,
      targetSteer,
      1 - Math.exp(-steerResponse * clampedDt)
    );

    // 3. Longitudinal Dynamics: Acceleration (W), Braking & Reverse (S), Handbrake (Space)
    let driveForce = 0;
    let isBraking = false;
    const weatherBrakeMult = this.weatherModifiers?.brakeMultiplier ?? 1.0;
    const isAWD = this.specs.drivetrain === 'AWD';
    // AWD cars retain better traction in wet/rainy conditions
    const weatherLaunchMult = isAWD
      ? 1 - (1 - (this.weatherModifiers?.launchMultiplier ?? 1.0)) * 0.45
      : (this.weatherModifiers?.launchMultiplier ?? 1.0);
    const weatherGripMult = isAWD
      ? 1 - (1 - (this.weatherModifiers?.gripMultiplier ?? 1.0)) * 0.45
      : (this.weatherModifiers?.gripMultiplier ?? 1.0);

    const activeGearRatios = this.specs.gearRatios || DEFAULT_GEAR_RATIOS;

    if (throttleInput > 0) {
      if (this.speed < -0.5) {
        // Pressing W while rolling backward -> apply brakes first
        driveForce += this.specs.brakeForce * weatherBrakeMult * 1.15 * throttleInput;
        isBraking = true;
      } else {
        // Forward acceleration with vehicle-specific gearbox ratios & RWD/AWD Launch Traction
        if (this.gear < 1) this.gear = 1;
        const gearRatio = activeGearRatios[Math.max(0, Math.min(activeGearRatios.length - 1, this.gear - 1))] || 1.0;
        const awdLaunchBoost = isAWD && this.gear <= 2 ? 1.08 : 1.0;
        const launchBonus = (this.gear <= 2 ? (this.specs.launchTraction || 1.0) : 1.0) * weatherLaunchMult * awdLaunchBoost;
        const gearMultiplier = (0.80 + gearRatio * 0.28) * launchBonus;
        const nitroMult = this.isNitroActive ? this.specs.nitroBoost : 1.0;
        const effectiveTopMs = maxSpeedMs * (this.isNitroActive ? 1.12 : 1.0);
        const topSpeedRatio = Math.min(1, absSpeed / Math.max(10, effectiveTopMs));
        const powerCurve = Math.max(0.04, 1 - Math.pow(topSpeedRatio, 2.5));

        driveForce += this.specs.engineForce * throttleInput * gearMultiplier * nitroMult * powerCurve;
      }
    }

    if (brakeInput > 0) {
      if (this.speed > 0.5) {
        // Pressing S while moving forward -> progressive high-power braking (modulated by wet road condition)
        driveForce -= this.specs.brakeForce * weatherBrakeMult * brakeInput;
        isBraking = true;
      } else {
        // Stopped or already moving backward -> engage Reverse gear (R)
        this.gear = -1;
        const revMaxMs = 56 / 3.6; // ~56 km/h top reverse speed
        const revLimiter = Math.max(0, 1 - Math.abs(this.speed) / revMaxMs);
        driveForce -= this.specs.engineForce * 0.72 * brakeInput * revLimiter;
      }
    }

    if (handbrake) {
      isBraking = true;
      // Rear-wheel mechanical lockup deceleration
      if (absSpeed > 0.15) {
        driveForce -= Math.sign(this.speed) * this.specs.brakeForce * weatherBrakeMult * 0.68;
      }
    }

    // Aerodynamic quadratic drag & tire rolling resistance
    const dragForce = -0.44 * this.speed * absSpeed;
    const rollingResistance = -this.speed * 110;

    const totalLongForce = driveForce + dragForce + rollingResistance;
    const longAccel = totalLongForce / this.specs.mass;

    this.speed += longAccel * clampedDt;

    // Prevent micro-creeping at rest when no pedals are pressed
    if (throttleInput === 0 && brakeInput === 0 && Math.abs(this.speed) < 0.22) {
      this.speed = 0;
    }

    // 4. Angular Yaw & Drift Mechanics
    const directionSign = this.speed >= -0.05 ? 1 : -1;
    const minTurnFactor = Math.min(1, absSpeed / 2.2);
    const yawRate = this.steerAngle * this.specs.turnRate * minTurnFactor * directionSign;

    // Handbrake & RWD power-oversteer yaw boost for distinct RWD vs AWD drifting feel
    const rwdOversteerMult = isAWD ? 0.85 : 1.16;
    let driftYawBonus = 0;
    if (handbrake && absSpeed > 6.5 && Math.abs(this.steerAngle) > 0.04) {
      driftYawBonus = Math.sign(this.steerAngle) * 0.95 * rwdOversteerMult * directionSign;
    } else if (this.isDrifting && throttleInput > 0.5 && absSpeed > 12) {
      driftYawBonus = Math.sign(this.steerAngle) * 0.34 * rwdOversteerMult * directionSign;
    }

    this.heading += (yawRate + driftYawBonus) * clampedDt;

    // Lateral slip velocity (centrifugal throw vs tire lateral grip)
    const slipThrowFactor = (handbrake ? 0.64 : (throttleInput > 0.7 && absSpeed > 18 ? 0.34 : 0.26)) * rwdOversteerMult;
    const centrifugalImpulse = (yawRate + driftYawBonus * 0.5) * this.speed * slipThrowFactor;
    this.lateralSpeed += centrifugalImpulse * clampedDt;

    // Lateral tire grip recovery (modulated by handbrake, drift state, and wet/foggy road grip)
    const baseActiveGrip = handbrake
      ? 1.85
      : (this.isDrifting ? this.specs.driftGrip * 5.4 : this.specs.driftGrip * 8.4);
    const activeGrip = baseActiveGrip * weatherGripMult;
    this.lateralSpeed *= Math.exp(-activeGrip * clampedDt);

    this.slipAngle = absSpeed > 3.0 ? Math.atan2(this.lateralSpeed, absSpeed) : 0;
    this.isDrifting = (
      absSpeed > 10 &&
      (Math.abs(this.slipAngle) > 0.11 || (handbrake && Math.abs(this.steerAngle) > 0.06))
    );

    if (this.isDrifting) {
      const framePoints = absSpeed * (Math.abs(this.slipAngle) + (handbrake ? 0.15 : 0)) * 34 * clampedDt;
      this.currentDriftPoints += framePoints;
      this.driftScoreAccum += framePoints;
    } else if (this.currentDriftPoints > 0) {
      this.currentDriftPoints = 0;
    }

    // 5. Vehicle World Movement & Speed Calculation
    // In right-handed coordinates (+Y up), forward = (sinH, 0, cosH), right = forward x up = (-cosH, 0, sinH)
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    const rightX = -cosH;
    const rightZ = sinH;

    const vx = sinH * this.speed + rightX * this.lateralSpeed;
    const vz = cosH * this.speed + rightZ * this.lateralSpeed;

    this.velocity.set(vx, 0, vz);
    this.position.x += vx * clampedDt;
    this.position.z += vz * clampedDt;

    const totalPlanarSpeed = Math.hypot(vx, vz);
    this.currentSpeedKmh = Math.round(totalPlanarSpeed * 3.6);
    this.distanceDriven += totalPlanarSpeed * clampedDt;

    // 6. Track Projection & Multi-Road / Building Collision Handling
    const proj = this.track.projectWorldPoint(this.position, this.currentTrackT);
    this.currentTrackT = proj.t;
    this.currentSector = proj.sector;
    this.currentDistrict = proj.district || 'Downtown Financial District';
    this.onSecondaryRoad = Boolean(proj.onSecondaryNetwork);
    this.lateralOffset = proj.lateralOffset;

    // Smooth vertical grounding onto road/bridge/tunnel/parking elevation
    this.position.y = THREE.MathUtils.lerp(this.position.y, proj.roadHeight, 1 - Math.exp(-25 * clampedDt));

    const maxLateral = this.track.barrierHalfWidth - 1.05;
    const sideSign = Math.sign(proj.lateralOffset);
    const hasIntersectionOpening = (sideSign < 0 && proj.openLeft) || (sideSign > 0 && proj.openRight);

    // Check building AABB collisions across all districts & avenues
    if (this.track.resolveCityCollisions) {
      const cityHit = this.track.resolveCityCollisions(this.position, 1.15);
      if (cityHit.hit) {
        const impactSeverity = Math.min(1, absSpeed / 28);
        this.speed *= 0.65;
        this.collisionShake = Math.max(this.collisionShake, impactSeverity * 0.85);
        this.lastCollisionImpact = impactSeverity;
        if (impactSeverity > 0.22 && this.wallHitCooldown <= 0) {
          this.wallHitCooldown = 0.50;
          if (audioManager) audioManager.playCollision(impactSeverity);
        }
      }
    }

    // Main highway guardrail collision (bypassed when turning through an intersection or driving on secondary roads/parking lots)
    if (Math.abs(proj.lateralOffset) > maxLateral && !hasIntersectionOpening && !proj.onSecondaryNetwork) {
      const penetration = Math.abs(proj.lateralOffset) - maxLateral;

      // Resolve penetration out of barrier wall
      this.position.x -= proj.right.x * sideSign * (penetration + 0.04);
      this.position.z -= proj.right.z * sideSign * (penetration + 0.04);

      // Redirect heading smoothly along barrier tangent
      let headingDiff = proj.heading - this.heading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

      if (Math.abs(headingDiff) < Math.PI * 0.65) {
        this.heading += headingDiff * Math.min(1, 9.0 * clampedDt);
      }

      const impactSeverity = Math.min(1, (absSpeed / 32) * (0.25 + Math.abs(headingDiff)));
      this.speed *= Math.exp(-(1.1 + Math.abs(headingDiff) * 3.2) * clampedDt);
      this.lateralSpeed = -sideSign * Math.min(3.6, absSpeed * 0.16);
      this.collisionShake = Math.max(this.collisionShake, impactSeverity * 0.75);
      this.lastCollisionImpact = impactSeverity;

      if (impactSeverity > 0.25 && this.wallHitCooldown <= 0) {
        this.wallHitCooldown = 0.55;
        if (audioManager) audioManager.playCollision(impactSeverity);
      }
    }

    // 7. Automatic 6-Speed Transmission & Engine RPM
    this._updateGearboxAndRpm(clampedDt, absSpeed, maxSpeedMs, throttleInput);

    // 8. Suspension Weight Transfer (Modulated by Active Coilover Suspension Stiffness) & 4-Wheel Rotation
    const invStiff = 1 / Math.max(0.8, suspStiffness);
    const targetPitch = THREE.MathUtils.clamp((-longAccel * 0.0038) * invStiff, -0.055, 0.065);
    const lateralAccel = yawRate * this.speed;
    const targetRoll = THREE.MathUtils.clamp((lateralAccel * 0.0045) * invStiff, -0.08, 0.08);
    const suspDamping = 12 * suspStiffness;

    this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, 1 - Math.exp(-suspDamping * clampedDt));
    this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRoll, 1 - Math.exp(-suspDamping * clampedDt));
    this.wheelSpinAngle += (this.speed / WHEEL_RADIUS) * clampedDt;

    // Brake light & running tail light glow (brighter running tail lights at Sunset/Night/Rain/Fog)
    if (this.meshBundle.taillightMat) {
      const runningTailGlow = this.headlightsActive ? 1.55 : 0.75;
      this.meshBundle.taillightMat.emissiveIntensity = isBraking ? 3.8 : runningTailGlow;
    }

    // Tire smoke, wet-road rain spray & Nitro exhaust VFX
    if (particleSystem) {
      const yAxis = new THREE.Vector3(0, 1, 0);
      if (this.isDrifting || (handbrake && absSpeed > 6.5)) {
        const rearLeft = new THREE.Vector3(-0.85, 0.15, -1.35).applyAxisAngle(yAxis, this.heading).add(this.position);
        const rearRight = new THREE.Vector3(0.85, 0.15, -1.35).applyAxisAngle(yAxis, this.heading).add(this.position);
        particleSystem.emitTireSmoke(rearLeft);
        particleSystem.emitTireSmoke(rearRight);
      } else if (this.weatherModifiers?.weather === 'rain' && absSpeed > 11 && particleSystem.emitRainSpray) {
        const rearLeft = new THREE.Vector3(-0.85, 0.18, -1.55).applyAxisAngle(yAxis, this.heading).add(this.position);
        const rearRight = new THREE.Vector3(0.85, 0.18, -1.55).applyAxisAngle(yAxis, this.heading).add(this.position);
        particleSystem.emitRainSpray(rearLeft);
        particleSystem.emitRainSpray(rearRight);
      }
      if (this.isNitroActive) {
        const exL = new THREE.Vector3(-0.46, 0.32, -2.25).applyAxisAngle(yAxis, this.heading).add(this.position);
        const exR = new THREE.Vector3(0.46, 0.32, -2.25).applyAxisAngle(yAxis, this.heading).add(this.position);
        particleSystem.emitNitroFlame(exL);
        particleSystem.emitNitroFlame(exR);
      }
    }

    this.syncMeshTransform();
  }

  _updateGearboxAndRpm(dt, absSpeed, maxSpeedMs, throttleInput) {
    const idle = this.specs.idleRpm || 950;
    const redline = this.specs.redlineRpm || 8000;

    if (this.speed < -0.35) {
      this.gear = -1;
      const revRatio = Math.min(1, absSpeed / (56 / 3.6));
      this.rpm = THREE.MathUtils.lerp(this.rpm, idle + revRatio * (redline * 0.76 - idle), 1 - Math.exp(-12 * dt));
      return;
    }

    if (absSpeed < 0.25 && throttleInput === 0) {
      if (this.gear < 1) this.gear = 1;
      this.rpm = THREE.MathUtils.lerp(this.rpm, idle, 1 - Math.exp(-10 * dt));
      return;
    }

    // Dynamic 6, 7, 8, or 9-Speed Transmission based on vehicle's authentic gearCount
    const gearCount = this.specs.gearCount || (this.specs.gearRatios ? this.specs.gearRatios.length : 6);
    const normSpeed = Math.min(1, absSpeed / maxSpeedMs);
    const gearThresholds = [];
    for (let g = 1; g <= gearCount; g++) {
      gearThresholds.push(g === gearCount ? 1.05 : Number((Math.pow(g / gearCount, 1.08) * 0.98).toFixed(3)));
    }

    let desiredGear = 1;
    for (let g = 0; g < gearThresholds.length; g++) {
      if (normSpeed < gearThresholds[g]) {
        desiredGear = g + 1;
        break;
      }
    }

    if (this.gear < 1) this.gear = 1;
    this.shiftTimer = Math.max(0, this.shiftTimer - dt);

    if (desiredGear !== this.gear && this.shiftTimer <= 0) {
      this.gear = desiredGear;
      this.shiftTimer = 0.22;
    }

    const lowBound = this.gear === 1 ? 0 : gearThresholds[this.gear - 2] * 0.82;
    const highBound = gearThresholds[this.gear - 1];
    const gearProgress = THREE.MathUtils.clamp((normSpeed - lowBound) / Math.max(0.05, highBound - lowBound), 0, 1);

    const targetRpm = idle + (0.22 + gearProgress * 0.76) * (redline - idle) + (throttleInput * 380);
    this.rpm = THREE.MathUtils.lerp(this.rpm, Math.min(redline, targetRpm), 1 - Math.exp(-15 * dt));
  }

  syncMeshTransform() {
    if (!this.meshBundle) return;
    const { root, chassisTilt, wheels, cockpitWheel } = this.meshBundle;

    root.position.copy(this.position);
    root.rotation.y = this.heading;

    const roadMicroBump = Math.sin(this.suspTime * 28) * Math.min(0.004, Math.abs(this.speed) * 0.00012);
    chassisTilt.rotation.x = this.pitchAngle + roadMicroBump;
    chassisTilt.rotation.z = this.rollAngle;

    for (let i = 0; i < wheels.length; i++) {
      const w = wheels[i];
      if (w.isFront) {
        w.knuckle.rotation.y = this.steerAngle * 0.88;
      }
      w.spinHub.rotation.x = this.wheelSpinAngle;

      const isLeft = i % 2 === 0;
      const rollOffset = (isLeft ? -1 : 1) * this.rollAngle * 0.45;
      const pitchOffset = (w.isFront ? -1 : 1) * this.pitchAngle * 0.45;
      w.knuckle.position.y = w.baseY + rollOffset + pitchOffset;
    }

    if (cockpitWheel) {
      cockpitWheel.rotation.z = this.steerAngle * 2.4;
    }
  }

  getGearLabel() {
    if (this.gear === -1) return 'R';
    if (this.gear === 0) return 'N';
    return String(this.gear);
  }

  getSpeedKmh() {
    return this.currentSpeedKmh || Math.round(Math.abs(this.speed) * 3.6);
  }
}
