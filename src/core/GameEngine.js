import * as THREE from 'three';
import { SaveManager } from './SaveManager.js';
import { InputManager } from './InputManager.js';
import { CameraController } from './CameraController.js';
import { TrackSpline } from '../world/TrackSpline.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { EnvironmentManager } from '../world/EnvironmentManager.js';
import { getCarById, computeEffectiveSpecs } from '../vehicles/CarCatalog.js';
import { CarBuilder } from '../vehicles/CarBuilder.js';
import { VehiclePhysics } from '../vehicles/VehiclePhysics.js';
import { TrafficManager } from '../ai/TrafficManager.js';
import { PoliceManager } from '../ai/PoliceManager.js';
import { RaceManager, GAME_MODES } from '../modes/RaceManager.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUDController } from '../ui/HUDController.js';
import { MinimapRenderer } from '../ui/MinimapRenderer.js';
import { UIManager } from '../ui/UIManager.js';

export class GameEngine {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);

    this.saveManager = new SaveManager();
    this.inputManager = new InputManager();
    this.audioManager = new AudioManager();

    // App State: 'menu' | 'garage' | 'playing' | 'paused'
    this.appState = 'menu';
    this.clock = new THREE.Clock();

    this._initThree();
    this._initSubsystems();
    this._bindInputs();
    this._bindResize();
  }

  _initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.2,
      1100
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.container.appendChild(this.renderer.domElement);
  }

  _initSubsystems() {
    this.cameraController = new CameraController(this.camera);

    // 1. Build 3D Track & City Environment
    this.trackSpline = new TrackSpline();
    this.worldBuilder = new WorldBuilder(this.scene, this.trackSpline);
    this.worldBuilder.build();
    this.cameraController.setEnvironmentRefs(this.trackSpline, this.worldBuilder.worldGroup);

    this.environmentManager = new EnvironmentManager(this.scene, this.worldBuilder);
    const settings = this.saveManager.getSettings();
    this.environmentManager.applyEnvironment(settings.timeOfDay, settings.weather);
    this.audioManager.applyAudioSettings(settings);

    // 2. Particle VFX, AI Traffic & Optional Police Pursuit System
    this.particleSystem = new ParticleSystem(this.scene);
    this.trafficManager = new TrafficManager(this.scene, this.trackSpline);
    this.policeManager = new PoliceManager(this.scene, this.trackSpline, this.saveManager);
    this.policeManager.setEnabled(settings.policeEnabled ?? true);

    // 3. Player Vehicle & Physics
    this.playerPhysics = new VehiclePhysics(this.trackSpline);
    this.activeCarMesh = null;
    this.garageCarMesh = null;
    this.spawnActivePlayerCar();

    // 4. Race Manager
    this.raceManager = new RaceManager(
      this.scene,
      this.trackSpline,
      this.trafficManager,
      this.saveManager
    );

    // 5. UI, HUD & Minimap
    this.hudController = new HUDController();
    this.minimapRenderer = new MinimapRenderer('hud-minimap-canvas', this.trackSpline);

    this.raceManager.onBannerMessage = (msg, color) => {
      this.hudController.showBanner(msg, color);
    };

    this.policeManager.onPursuitNotification = (msg, color) => {
      this.hudController.showBanner(msg, color);
    };

    // Report player traffic collisions to PoliceManager as traffic offenses (reckless driving heat)
    const origCollisionCb = this.trafficManager.onCollisionCallback;
    this.trafficManager.onCollisionCallback = (severity, hitCar) => {
      if (origCollisionCb) origCollisionCb(severity, hitCar);
      if (this.appState === 'playing' && this.raceManager.state === 'active') {
        this.policeManager.reportTrafficOffense(this.playerPhysics, severity);
      }
    };

    this.raceManager.onRaceFinished = (summary) => {
      this.appState = 'menu';
      this.uiManager.showResultsModal(summary);
    };

    this.uiManager = new UIManager(this);

    // Spawn ambient traffic for the live 3D main menu background
    this.trafficManager.spawnForMode('freeroam', settings.trafficDensity);
    this.cameraController.snapToVehicle(this.playerPhysics);
  }

  spawnActivePlayerCar() {
    if (this.activeCarMesh) {
      this.scene.remove(this.activeCarMesh.root);
    }

    const carId = this.saveManager.getSelectedCarId();
    const carDef = getCarById(carId);
    const paint = this.saveManager.getCarColor(carDef.id, carDef.defaultColor);
    const upgrades = this.saveManager.getCarUpgrades(carDef.id);
    const customization = this.saveManager.getCarCustomization(carDef.id, carDef);
    const effectiveSpecs = computeEffectiveSpecs(carDef, upgrades, customization);

    this.activeCarMesh = CarBuilder.buildRaceCar(carDef, paint, true, customization);
    this.scene.add(this.activeCarMesh.root);
    this.playerPhysics.attachCar(this.activeCarMesh, effectiveSpecs);
    this.updateHeadlightState();
  }

  previewGarageCar(carId) {
    if (this.garageCarMesh) {
      this.scene.remove(this.garageCarMesh.root);
    }
    const carDef = getCarById(carId);
    const paint = this.saveManager.getCarColor(carDef.id, carDef.defaultColor);
    const customization = this.saveManager.getCarCustomization(carDef.id, carDef);
    this.garageCarMesh = CarBuilder.buildRaceCar(carDef, paint, false, customization);
    this.garageCarMesh.root.position.copy(this.worldBuilder.garageAnchor);
    this.scene.add(this.garageCarMesh.root);
  }

  updateHeadlightState() {
    const needLights = this.environmentManager.areHeadlightsNeeded() || this.playerPhysics.currentSector === 'tunnel';
    this.playerPhysics.setHeadlightsActive(needLights);
    this.playerPhysics.setWeatherModifiers(this.environmentManager.getWeatherPhysicsModifiers());
  }

  _bindInputs() {
    this.inputManager.callbacks.onCameraToggle = () => {
      if (this.appState === 'playing') {
        this.cycleCamera();
      }
    };

    this.inputManager.callbacks.onPauseToggle = () => {
      if (this.appState === 'playing' || this.appState === 'paused') {
        this.togglePause();
      }
    };

    this.inputManager.callbacks.onResetCar = () => {
      if (this.appState === 'playing') {
        this.playerPhysics.resetAtTrackT(this.playerPhysics.currentTrackT, 0);
        this.hudController.showBanner('Vehicle reset on track', 'white');
      }
    };

    this.inputManager.callbacks.onHorn = () => {
      this.audioManager.init();
      this.audioManager.playHorn();
    };
  }

  cycleCamera() {
    const mode = this.cameraController.cycleMode();
    this.hudController.showBanner(`Camera: ${mode.name}`, 'cyan');
  }

  startRaceMode(modeId) {
    this.audioManager.init();
    if (this.garageCarMesh) {
      this.garageCarMesh.root.visible = false;
    }
    this.spawnActivePlayerCar();
    this.activeCarMesh.root.visible = true;

    this.appState = 'playing';
    this.uiManager.showScreen('hud');

    const modeTitle = document.getElementById('hud-mode-title');
    if (modeTitle && GAME_MODES[modeId]) {
      modeTitle.textContent = GAME_MODES[modeId].name.toUpperCase();
    }

    this.hudController?.clearNotifications();
    this.raceManager.startMode(modeId, this.playerPhysics, this.audioManager);
    this.policeManager.resetForMode(modeId, this.playerPhysics);
    this.cameraController.snapToVehicle(this.playerPhysics);
  }

  restartCurrentRace() {
    if (this.raceManager.activeMission) {
      this.startMissionMode(this.raceManager.activeMission.id);
    } else {
      this.startRaceMode(this.raceManager.currentMode);
    }
  }

  startMissionMode(missionId) {
    this.audioManager.init();
    if (this.garageCarMesh) {
      this.garageCarMesh.root.visible = false;
    }
    this.spawnActivePlayerCar();
    this.activeCarMesh.root.visible = true;

    this.appState = 'playing';
    this.uiManager.showScreen('hud');

    this.hudController?.clearNotifications();
    this.raceManager.startMission(missionId, this.playerPhysics, this.audioManager);
    this.policeManager.resetForMode(this.raceManager.currentMode, this.playerPhysics);

    const modeTitle = document.getElementById('hud-mode-title');
    if (modeTitle && this.raceManager.activeMission) {
      modeTitle.textContent = `${this.raceManager.activeMission.typeLabel.toUpperCase()}: ${this.raceManager.activeMission.title.toUpperCase()}`;
    }

    this.cameraController.snapToVehicle(this.playerPhysics);
  }

  enterMissionsScreen() {
    this.audioManager.init();
    this.appState = 'menu';
    this.uiManager.showScreen('missions');
  }

  enterGarage() {
    this.audioManager.init();
    this.appState = 'garage';
    this.uiManager.showScreen('garage');
    if (this.garageCarMesh) {
      this.garageCarMesh.root.visible = true;
    }
  }

  leaveGarageToMenu() {
    if (this.garageCarMesh) {
      this.garageCarMesh.root.visible = false;
    }
    this.spawnActivePlayerCar();
    this.returnToMainMenu();
  }

  returnToMainMenu() {
    this.appState = 'menu';
    this.uiManager.showScreen('mainMenu');
  }

  togglePause() {
    const pauseModal = document.getElementById('modal-pause');
    if (this.appState === 'playing') {
      this.appState = 'paused';
      pauseModal?.classList.remove('hidden');
      this.audioManager.updateVehicleAudio(this.playerPhysics, this.inputManager, false);
    } else if (this.appState === 'paused') {
      this.appState = 'playing';
      pauseModal?.classList.add('hidden');
      this.clock.getDelta();
    }
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  start() {
    this.clock.start();
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  update(dt) {
    if (this.appState === 'paused') {
      return;
    }

    if (this.appState === 'garage') {
      if (this.garageCarMesh) {
        this.garageCarMesh.root.rotation.y += dt * 0.25;
      }
      this.cameraController.update(dt, null, this.inputManager, true, this.worldBuilder.garageAnchor);
      this.audioManager.updateVehicleAudio(this.playerPhysics, this.inputManager, false);
      return;
    }

    if (this.appState === 'menu') {
      // Live dynamic 3D city showcase behind Main Menu
      this.trafficManager.update(dt, null, true, this.particleSystem, null);
      this.worldBuilder.updatePedestrians(dt);
      this.cameraController.update(dt, this.playerPhysics, this.inputManager, true, this.playerPhysics.position);
      this.environmentManager.update(dt, this.playerPhysics.position);
      this.audioManager.updateVehicleAudio(this.playerPhysics, this.inputManager, false);
      return;
    }

    // Active Playing State
    const canDrive = this.raceManager.state === 'active';
    if (canDrive) {
      this.playerPhysics.update(dt, this.inputManager, this.particleSystem, this.audioManager);
    } else {
      // Allow engine revving on starting grid during 3..2..1 countdown
      const throttle = this.inputManager.getThrottle();
      const idle = this.playerPhysics.specs?.idleRpm || 950;
      const redline = this.playerPhysics.specs?.redlineRpm || 8000;
      const targetRpm = idle + throttle * (redline * 0.78 - idle);
      this.playerPhysics.rpm = THREE.MathUtils.lerp(this.playerPhysics.rpm, targetRpm, 1 - Math.exp(-12 * dt));
    }

    this.updateHeadlightState();
    this.worldBuilder.updatePedestrians(dt);
    this.raceManager.update(dt, this.playerPhysics, this.audioManager, this.particleSystem);
    if (canDrive) {
      this.policeManager.update(
        dt,
        this.playerPhysics,
        this.particleSystem,
        this.audioManager,
        this.trafficManager.vehicles
      );
    }
    this.particleSystem.update(dt);
    this.cameraController.update(dt, this.playerPhysics, this.inputManager, false);
    this.environmentManager.update(dt, this.playerPhysics.position);
    this.audioManager.updateVehicleAudio(this.playerPhysics, this.inputManager, true);
    this.audioManager.updatePoliceSiren(
      dt,
      this.policeManager.wantedLevel,
      this.policeManager.closestUnitDist,
      true
    );

    // Update Telemetry HUD & GPS Minimap
    this.hudController.update(
      this.playerPhysics,
      this.raceManager,
      this.saveManager,
      this.cameraController,
      this.policeManager
    );
    this.minimapRenderer.render(
      this.playerPhysics,
      this.trafficManager.vehicles,
      this.raceManager.getNextCheckpointWorldPos(),
      this.policeManager.getActiveUnits()
    );
  }
}
