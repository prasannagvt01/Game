export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;

    // Granular volume channels persisted in settings
    this.masterVolume = 0.75;
    this.engineVolume = 0.85;
    this.sfxVolume = 0.85;
    this.ambientVolume = 0.70;
    this.isMuted = false;

    // Continuous Web Audio nodes
    this.masterGain = null;
    this.engineBus = null;
    this.sfxBus = null;
    this.ambientBus = null;

    this.engineGain = null;
    this.accelGain = null;
    this.oscMain = null;
    this.oscSub = null;
    this.oscHarmonic = null;
    this.engineFilter = null;
    this.accelFilter = null;

    this.skidGain = null;
    this.skidFilter = null;
    this.brakeGain = null;
    this.brakeFilter = null;

    this.ambientGain = null;
    this.ambientFilter = null;

    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;

    this.noiseBuffer = null;
    this.lastGear = 1;
    this.telemetryState = {
      currentEngineFreq: 55,
      currentEngineGain: 0,
      currentAccelGain: 0,
      currentBrakeGain: 0,
      currentSkidGain: 0,
      currentAmbientGain: 0,
      currentSirenGain: 0
    };
  }

  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AudioCtx) {
      // Headless / automated test environment fallback so audio state can still be verified
      this.isInitialized = true;
      return;
    }

    this.ctx = new AudioCtx();

    // Master & Channel Buses
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.engineBus = this.ctx.createGain();
    this.engineBus.gain.value = this.engineVolume;
    this.engineBus.connect(this.masterGain);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.masterGain);

    this.ambientBus = this.ctx.createGain();
    this.ambientBus.gain.value = this.ambientVolume;
    this.ambientBus.connect(this.masterGain);

    this._createSharedNoiseBuffer();
    this._setupEngineAndAccelerationSynth();
    this._setupBrakingSkidAndAmbientSynth();

    this.isInitialized = true;
  }

  _createSharedNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  _setupEngineAndAccelerationSynth() {
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 260;
    this.engineFilter.Q.value = 3.2;

    // 1. Primary sawtooth combustion harmonic
    this.oscMain = this.ctx.createOscillator();
    this.oscMain.type = 'sawtooth';
    this.oscMain.frequency.value = 55;

    // 2. Secondary sub-octave triangle growl
    this.oscSub = this.ctx.createOscillator();
    this.oscSub.type = 'triangle';
    this.oscSub.frequency.value = 27.5;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.68;

    // 3. Third harmonic acceleration intake / turbo whine
    this.oscHarmonic = this.ctx.createOscillator();
    this.oscHarmonic.type = 'square';
    this.oscHarmonic.frequency.value = 110;

    this.accelFilter = this.ctx.createBiquadFilter();
    this.accelFilter.type = 'bandpass';
    this.accelFilter.frequency.value = 420;
    this.accelFilter.Q.value = 2.5;

    this.accelGain = this.ctx.createGain();
    this.accelGain.gain.value = 0.0;

    this.oscMain.connect(this.engineFilter);
    this.oscSub.connect(subGain);
    subGain.connect(this.engineFilter);

    this.oscHarmonic.connect(this.accelFilter);
    this.accelFilter.connect(this.accelGain);
    this.accelGain.connect(this.engineBus);

    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.engineBus);

    this.oscMain.start();
    this.oscSub.start();
    this.oscHarmonic.start();
  }

  _setupBrakingSkidAndAmbientSynth() {
    // 1. Tire Skid & Drift Screech Node
    const skidSource = this.ctx.createBufferSource();
    skidSource.buffer = this.noiseBuffer;
    skidSource.loop = true;

    this.skidFilter = this.ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1350;
    this.skidFilter.Q.value = 4.8;

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.value = 0.0;

    skidSource.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.sfxBus);
    skidSource.start();

    // 2. Progressive Braking Disc Friction & Tire Scrub Node
    const brakeSource = this.ctx.createBufferSource();
    brakeSource.buffer = this.noiseBuffer;
    brakeSource.loop = true;

    this.brakeFilter = this.ctx.createBiquadFilter();
    this.brakeFilter.type = 'bandpass';
    this.brakeFilter.frequency.value = 780;
    this.brakeFilter.Q.value = 2.8;

    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.value = 0.0;

    brakeSource.connect(this.brakeFilter);
    this.brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.sfxBus);
    brakeSource.start();

    // 3. Ambient City Traffic Hum & Aerodynamic Wind Rush Node
    const ambientSource = this.ctx.createBufferSource();
    ambientSource.buffer = this.noiseBuffer;
    ambientSource.loop = true;

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.value = 180;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.03;

    ambientSource.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.ambientBus);
    ambientSource.start();

    // 4. USA Police Pursuit Wail/Yelp Siren Oscillator
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;

    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxBus);
    this.sirenOsc.start();
  }

  /**
   * Modulates the Police Pursuit wail siren pitch & distance-attenuated gain
   */
  updatePoliceSiren(dt, wantedLevel = 0, closestDist = Infinity, isPlaying = true) {
    if (!isPlaying || wantedLevel <= 0 || closestDist > 135) {
      this.telemetryState.currentSirenGain = 0;
      if (this.ctx && this.sirenGain) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return;
    }

    this.sirenPhase += dt * (2.6 + wantedLevel * 0.45);
    const wailMod = (Math.sin(this.sirenPhase) + 1) * 0.5;
    const sirenFreq = 640 + wailMod * 540;
    const distAtten = Math.max(0, 1 - closestDist / 135);
    const targetGain = 0.02 + distAtten * 0.085;

    this.telemetryState.currentSirenGain = targetGain;

    if (this.ctx && this.sirenOsc && this.sirenGain) {
      const now = this.ctx.currentTime;
      this.sirenOsc.frequency.setTargetAtTime(sirenFreq, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }
  }

  applyAudioSettings(settings = {}) {
    if (settings.soundVolume !== undefined) this.setVolume(settings.soundVolume);
    if (settings.engineVolume !== undefined) this.setEngineVolume(settings.engineVolume);
    if (settings.sfxVolume !== undefined) this.setSfxVolume(settings.sfxVolume);
    if (settings.ambientVolume !== undefined) this.setAmbientVolume(settings.ambientVolume);
    if (settings.audioMuted !== undefined) this.setMuted(Boolean(settings.audioMuted));
  }

  setVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.04);
    }
  }

  setEngineVolume(val) {
    this.engineVolume = Math.max(0, Math.min(1, val));
    if (this.engineBus && this.ctx) {
      this.engineBus.gain.setTargetAtTime(this.engineVolume, this.ctx.currentTime, 0.04);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.04);
    }
  }

  setAmbientVolume(val) {
    this.ambientVolume = Math.max(0, Math.min(1, val));
    if (this.ambientBus && this.ctx) {
      this.ambientBus.gain.setTargetAtTime(this.ambientVolume, this.ctx.currentTime, 0.04);
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.04);
    }
    return this.isMuted;
  }

  toggleMute() {
    return this.setMuted(!this.isMuted);
  }

  /**
   * Modulates Engine, Acceleration, Braking, Tire Skid/Drift, and Ambient audio
   * according to live vehicle RPM, speed, throttle load, braking, and slip angle.
   */
  updateVehicleAudio(vehicle, input, isPlaying = true) {
    if (!isPlaying || !vehicle) {
      this.telemetryState.currentEngineGain = 0;
      this.telemetryState.currentAccelGain = 0;
      this.telemetryState.currentBrakeGain = 0;
      this.telemetryState.currentSkidGain = 0;
      if (this.ctx && this.engineGain) {
        const now = this.ctx.currentTime;
        this.engineGain.gain.setTargetAtTime(0, now, 0.08);
        this.accelGain.gain.setTargetAtTime(0, now, 0.08);
        this.skidGain.gain.setTargetAtTime(0, now, 0.08);
        this.brakeGain.gain.setTargetAtTime(0, now, 0.08);
      }
      return;
    }

    const rpm = vehicle.rpm || 950;
    const redline = vehicle.specs?.redlineRpm || 8000;
    const rpmNorm = Math.min(1, Math.max(0, (rpm - 800) / (redline - 800)));
    const speedKmh = vehicle.getSpeedKmh();
    const throttle = input ? input.getThrottle() : 0;
    const brakeInput = input ? input.getBrake() : 0;
    const isForwardBraking = brakeInput > 0 && vehicle.speed > 2.5;

    // Detect gear upshift for turbo blow-off valve chirp
    if (vehicle.gear !== this.lastGear) {
      if (vehicle.gear > this.lastGear && this.lastGear >= 1 && speedKmh > 35) {
        this.playGearShiftSound();
      }
      this.lastGear = vehicle.gear;
    }

    // 1. Engine RPM & Speed Pitch Calculation
    const baseFreq = 38 + rpmNorm * 168 + (speedKmh * 0.12) + (vehicle.isNitroActive ? 26 : 0);
    const cutoff = 180 + rpmNorm * 980 + throttle * 460;
    const targetEngineGain = 0.08 + rpmNorm * 0.095 + throttle * 0.055;

    // 2. Acceleration Intake & Turbo Spool Audio
    const targetAccelGain = throttle > 0.1
      ? Math.min(0.11, (0.025 + rpmNorm * 0.065 + (vehicle.isNitroActive ? 0.035 : 0)) * throttle)
      : 0.0;
    const accelFreq = 260 + rpmNorm * 1150 + (vehicle.isNitroActive ? 350 : 0);

    // 3. Braking Friction Audio
    const targetBrakeGain = isForwardBraking
      ? Math.min(0.10, (speedKmh / 180) * 0.09 * brakeInput)
      : 0.0;

    // 4. Tire Skid & Drift Audio
    let targetSkidGain = 0;
    let skidPitch = 1300;
    if (vehicle.isDrifting && speedKmh > 22) {
      const slipIntensity = Math.min(1, Math.abs(vehicle.slipAngle) * 2.4 + (vehicle.isHandbraking ? 0.4 : 0));
      targetSkidGain = 0.04 + slipIntensity * 0.15;
      skidPitch = 1180 + slipIntensity * 480;
    } else if (vehicle.isHandbraking && speedKmh > 18) {
      targetSkidGain = 0.12;
      skidPitch = 1420;
    } else if (isForwardBraking && speedKmh > 70) {
      targetSkidGain = 0.045;
      skidPitch = 1250;
    }

    // 5. Ambient City & Aerodynamic Wind Audio
    const windCutoff = 145 + Math.min(720, speedKmh * 2.6);
    const targetAmbientGain = 0.025 + Math.min(0.095, (speedKmh / 290) * 0.085);

    this.telemetryState = {
      currentEngineFreq: baseFreq,
      currentEngineGain: targetEngineGain,
      currentAccelGain: targetAccelGain,
      currentBrakeGain: targetBrakeGain,
      currentSkidGain: targetSkidGain,
      currentAmbientGain: targetAmbientGain
    };

    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;

    this.oscMain.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.03);
    this.oscHarmonic.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.03);

    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.04);
    this.engineGain.gain.setTargetAtTime(targetEngineGain, now, 0.04);

    this.accelFilter.frequency.setTargetAtTime(accelFreq, now, 0.04);
    this.accelGain.gain.setTargetAtTime(targetAccelGain, now, 0.04);

    this.brakeFilter.frequency.setTargetAtTime(680 + Math.min(500, speedKmh * 2.2), now, 0.05);
    this.brakeGain.gain.setTargetAtTime(targetBrakeGain, now, 0.04);

    this.skidFilter.frequency.setTargetAtTime(skidPitch, now, 0.05);
    this.skidGain.gain.setTargetAtTime(targetSkidGain, now, 0.04);

    this.ambientFilter.frequency.setTargetAtTime(windCutoff, now, 0.1);
    this.ambientGain.gain.setTargetAtTime(targetAmbientGain, now, 0.1);
  }

  playGearShiftSound() {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playCollision(severity = 0.6) {
    this.telemetryState.lastCollisionSeverity = severity;
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    // Low-end chassis impact thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.25);

    gain.gain.setValueAtTime(Math.min(0.48, severity * 0.45), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.28);

    // Metallic crunch noise burst
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 920;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(Math.min(0.28, severity * 0.25), now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxBus);
      noise.start(now);
      noise.stop(now + 0.19);
    }
  }

  playUIClick() {
    this.telemetryState.lastUISound = 'click';
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.exponentialRampToValueAtTime(1720, now + 0.035);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playUIConfirm() {
    this.telemetryState.lastUISound = 'confirm';
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);

      gain.gain.setValueAtTime(0.12, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.19);
    });
  }

  playCheckpointChime() {
    this.telemetryState.lastUISound = 'checkpoint';
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    const freqs = [587.33, 880.0];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);

      gain.gain.setValueAtTime(0.16, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.30);
    });
  }

  playCountdownBeep(isGo = false) {
    this.telemetryState.lastUISound = isGo ? 'go' : 'countdown';
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.45 : 0.22));

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + (isGo ? 0.46 : 0.24));
  }

  playHorn() {
    this.telemetryState.lastUISound = 'horn';
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    [349.23, 440.0].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.34);
    });
  }
}
