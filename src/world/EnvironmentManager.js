import * as THREE from 'three';

export const TIME_PRESETS = {
  sunrise: {
    id: 'sunrise',
    label: 'Golden Sunrise',
    skyZenith: 0x312e81,
    skyHorizon: 0xfb923c,
    fogColor: 0xfdba74,
    fogDensity: 0.0015,
    sunColor: 0xffedd5,
    sunIntensity: 2.05,
    sunPos: new THREE.Vector3(210, 72, -110),
    hemiSky: 0xfed7aa,
    hemiGround: 0x27272a,
    hemiIntensity: 0.88,
    windowEmissive: 0.55,
    streetLightEmissive: 0.85,
    headlightsOn: true
  },
  day: {
    id: 'day',
    label: 'Sunny Daylight',
    skyZenith: 0x2b7de9,
    skyHorizon: 0x8ec5fc,
    fogColor: 0x8ec5fc,
    fogDensity: 0.0012,
    sunColor: 0xfff8e7,
    sunIntensity: 2.35,
    sunPos: new THREE.Vector3(140, 225, 110),
    hemiSky: 0x9bd4ff,
    hemiGround: 0x2c362c,
    hemiIntensity: 1.05,
    windowEmissive: 0.15,
    streetLightEmissive: 0.15,
    headlightsOn: false
  },
  sunset: {
    id: 'sunset',
    label: 'Golden Sunset',
    skyZenith: 0x3b2d54,
    skyHorizon: 0xf97316,
    fogColor: 0xd96b43,
    fogDensity: 0.0017,
    sunColor: 0xff8c42,
    sunIntensity: 1.85,
    sunPos: new THREE.Vector3(-210, 62, 130),
    hemiSky: 0xff9e6d,
    hemiGround: 0x231d29,
    hemiIntensity: 0.78,
    windowEmissive: 0.85,
    streetLightEmissive: 1.45,
    headlightsOn: true
  },
  night: {
    id: 'night',
    label: 'Neon Midnight',
    skyZenith: 0x030712,
    skyHorizon: 0x0f172a,
    fogColor: 0x080f1e,
    fogDensity: 0.0020,
    sunColor: 0x6c8cff,
    sunIntensity: 0.52,
    sunPos: new THREE.Vector3(-110, 165, -130),
    hemiSky: 0x1a2642,
    hemiGround: 0x080a10,
    hemiIntensity: 0.44,
    windowEmissive: 1.45,
    streetLightEmissive: 2.80,
    headlightsOn: true
  }
};

export const WEATHER_PRESETS = {
  clear: {
    id: 'clear',
    label: 'Sunny / Clear',
    fogMultiplier: 1.0,
    sunMultiplier: 1.0,
    skyTint: new THREE.Color(0xffffff),
    tintWeight: 0.0,
    roadRoughness: 0.74,
    roadMetalness: 0.12,
    gripMultiplier: 1.00,
    brakeMultiplier: 1.00,
    launchMultiplier: 1.00,
    rainVisible: false,
    forceHeadlights: false
  },
  rain: {
    id: 'rain',
    label: 'Rainstorm',
    fogMultiplier: 1.85,
    sunMultiplier: 0.58,
    skyTint: new THREE.Color(0x1e293b),
    tintWeight: 0.55,
    roadRoughness: 0.16,
    roadMetalness: 0.58,
    gripMultiplier: 0.85,
    brakeMultiplier: 0.88,
    launchMultiplier: 0.92,
    rainVisible: true,
    forceHeadlights: true
  },
  fog: {
    id: 'fog',
    label: 'Dense Fog',
    fogMultiplier: 4.80,
    sunMultiplier: 0.50,
    skyTint: new THREE.Color(0x94a3b8),
    tintWeight: 0.68,
    roadRoughness: 0.46,
    roadMetalness: 0.24,
    gripMultiplier: 0.94,
    brakeMultiplier: 0.95,
    launchMultiplier: 0.97,
    rainVisible: false,
    forceHeadlights: true
  }
};

export class EnvironmentManager {
  constructor(scene, worldBuilder) {
    this.scene = scene;
    this.worldBuilder = worldBuilder;

    this.timeOfDay = 'day';
    this.weather = 'clear'; // 'clear' | 'rain' | 'fog'

    // Current interpolated state for smooth transitions
    this.currentState = {
      skyColor: new THREE.Color(TIME_PRESETS.day.skyHorizon),
      zenithColor: new THREE.Color(TIME_PRESETS.day.skyZenith),
      fogColor: new THREE.Color(TIME_PRESETS.day.fogColor),
      fogDensity: TIME_PRESETS.day.fogDensity,
      sunColor: new THREE.Color(TIME_PRESETS.day.sunColor),
      sunIntensity: TIME_PRESETS.day.sunIntensity,
      sunOffset: TIME_PRESETS.day.sunPos.clone(),
      hemiSky: new THREE.Color(TIME_PRESETS.day.hemiSky),
      hemiGround: new THREE.Color(TIME_PRESETS.day.hemiGround),
      hemiIntensity: TIME_PRESETS.day.hemiIntensity,
      windowEmissive: TIME_PRESETS.day.windowEmissive,
      streetLightEmissive: TIME_PRESETS.day.streetLightEmissive,
      roadRoughness: WEATHER_PRESETS.clear.roadRoughness,
      roadMetalness: WEATHER_PRESETS.clear.roadMetalness
    };

    // Target state for smooth transition
    this.targetState = {
      skyColor: this.currentState.skyColor.clone(),
      zenithColor: this.currentState.zenithColor.clone(),
      fogColor: this.currentState.fogColor.clone(),
      fogDensity: this.currentState.fogDensity,
      sunColor: this.currentState.sunColor.clone(),
      sunIntensity: this.currentState.sunIntensity,
      sunOffset: this.currentState.sunOffset.clone(),
      hemiSky: this.currentState.hemiSky.clone(),
      hemiGround: this.currentState.hemiGround.clone(),
      hemiIntensity: this.currentState.hemiIntensity,
      windowEmissive: this.currentState.windowEmissive,
      streetLightEmissive: this.currentState.streetLightEmissive,
      roadRoughness: this.currentState.roadRoughness,
      roadMetalness: this.currentState.roadMetalness
    };

    this._setupLights();
    this._setupSkyDomeAndCelestialDisc();
    this._setupCloudsLayer();
    this._setupRainSystem();
    this.applyEnvironment('day', 'clear', true);
  }

  _setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0x9bd4ff, 0x2c362c, 1.05);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff8e7, 2.35);
    this.dirLight.position.set(140, 225, 110);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 450;
    const d = 95;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.scene.fog = new THREE.FogExp2(0x8ec5fc, 0.0012);
  }

  _setupSkyDomeAndCelestialDisc() {
    // 3D Atmospheric Sky Dome with vertical gradient shader
    const skyGeo = new THREE.SphereGeometry(950, 24, 16);
    this.skyUniforms = {
      topColor: { value: new THREE.Color(TIME_PRESETS.day.skyZenith) },
      bottomColor: { value: new THREE.Color(TIME_PRESETS.day.skyHorizon) },
      offset: { value: 20.0 },
      exponent: { value: 0.65 }
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Glowing Sun / Moon Celestial Sphere in the sky
    this.celestialMat = new THREE.MeshBasicMaterial({
      color: 0xfff8e7,
      fog: false
    });
    this.celestialDisc = new THREE.Mesh(new THREE.SphereGeometry(26, 16, 16), this.celestialMat);
    this.scene.add(this.celestialDisc);
  }

  _setupCloudsLayer() {
    this.cloudGroup = new THREE.Group();
    this.cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.78
    });

    const puffGeo = new THREE.BoxGeometry(48, 10, 32);
    for (let i = 0; i < 24; i++) {
      const cluster = new THREE.Group();
      const angle = (i / 24) * Math.PI * 2;
      const radius = 220 + (i % 4) * 135;
      cluster.position.set(
        Math.cos(angle) * radius,
        215 + (i % 3) * 28,
        Math.sin(angle) * radius
      );

      const mainPuff = new THREE.Mesh(puffGeo, this.cloudMat);
      const subPuff = new THREE.Mesh(puffGeo, this.cloudMat);
      subPuff.scale.set(0.7, 0.8, 0.75);
      subPuff.position.set(22, -2, 12);
      cluster.add(mainPuff);
      cluster.add(subPuff);
      cluster.rotation.y = angle;
      this.cloudGroup.add(cluster);
    }

    this.scene.add(this.cloudGroup);
  }

  _setupRainSystem() {
    const rainCount = 2600;
    const positions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0xb4d4ff,
      size: 0.22,
      transparent: true,
      opacity: 0.68
    });

    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  /**
   * Sets target time-of-day ('day' | 'sunset' | 'night') and weather ('clear' | 'rain' | 'fog').
   * When `instant` is false (default), smoothly transitions lighting, sky, fog, and road wetness in `update(dt)`.
   */
  applyEnvironment(timeOfDay, weather, instant = false) {
    this.timeOfDay = TIME_PRESETS[timeOfDay] ? timeOfDay : 'day';
    this.weather = WEATHER_PRESETS[weather] ? weather : 'clear';

    const tPreset = TIME_PRESETS[this.timeOfDay];
    const wPreset = WEATHER_PRESETS[this.weather];

    const horizonCol = new THREE.Color(tPreset.skyHorizon);
    const zenithCol = new THREE.Color(tPreset.skyZenith);
    const fogCol = new THREE.Color(tPreset.fogColor);

    if (wPreset.tintWeight > 0) {
      horizonCol.lerp(wPreset.skyTint, wPreset.tintWeight);
      zenithCol.lerp(wPreset.skyTint, wPreset.tintWeight * 0.85);
      fogCol.lerp(wPreset.skyTint, wPreset.tintWeight);
    }

    this.targetState.skyColor.copy(horizonCol);
    this.targetState.zenithColor.copy(zenithCol);
    this.targetState.fogColor.copy(fogCol);
    this.targetState.fogDensity = tPreset.fogDensity * wPreset.fogMultiplier;

    this.targetState.sunColor.setHex(tPreset.sunColor);
    this.targetState.sunIntensity = tPreset.sunIntensity * wPreset.sunMultiplier;
    this.targetState.sunOffset.copy(tPreset.sunPos);

    this.targetState.hemiSky.setHex(tPreset.hemiSky);
    this.targetState.hemiGround.setHex(tPreset.hemiGround);
    this.targetState.hemiIntensity = tPreset.hemiIntensity * (this.weather === 'clear' ? 1.0 : 0.85);

    this.targetState.windowEmissive = this.weather === 'clear'
      ? tPreset.windowEmissive
      : Math.max(tPreset.windowEmissive, 0.75);
    this.targetState.streetLightEmissive = this.weather === 'clear'
      ? tPreset.streetLightEmissive
      : Math.max(tPreset.streetLightEmissive, 1.65);

    this.targetState.roadRoughness = wPreset.roadRoughness;
    this.targetState.roadMetalness = wPreset.roadMetalness;

    this.rainPoints.visible = wPreset.rainVisible;

    if (instant) {
      this._copyTargetToCurrent();
      this._commitStateToScene(new THREE.Vector3(0, 0, 0));
    }
  }

  _copyTargetToCurrent() {
    this.currentState.skyColor.copy(this.targetState.skyColor);
    this.currentState.zenithColor.copy(this.targetState.zenithColor);
    this.currentState.fogColor.copy(this.targetState.fogColor);
    this.currentState.fogDensity = this.targetState.fogDensity;
    this.currentState.sunColor.copy(this.targetState.sunColor);
    this.currentState.sunIntensity = this.targetState.sunIntensity;
    this.currentState.sunOffset.copy(this.targetState.sunOffset);
    this.currentState.hemiSky.copy(this.targetState.hemiSky);
    this.currentState.hemiGround.copy(this.targetState.hemiGround);
    this.currentState.hemiIntensity = this.targetState.hemiIntensity;
    this.currentState.windowEmissive = this.targetState.windowEmissive;
    this.currentState.streetLightEmissive = this.targetState.streetLightEmissive;
    this.currentState.roadRoughness = this.targetState.roadRoughness;
    this.currentState.roadMetalness = this.targetState.roadMetalness;
  }

  _commitStateToScene(focusPos) {
    this.scene.background = this.currentState.skyColor;
    this.skyUniforms.topColor.value.copy(this.currentState.zenithColor);
    this.skyUniforms.bottomColor.value.copy(this.currentState.skyColor);

    this.scene.fog.color.copy(this.currentState.fogColor);
    this.scene.fog.density = this.currentState.fogDensity;

    this.dirLight.color.copy(this.currentState.sunColor);
    this.dirLight.intensity = this.currentState.sunIntensity;

    this.hemiLight.color.copy(this.currentState.hemiSky);
    this.hemiLight.groundColor.copy(this.currentState.hemiGround);
    this.hemiLight.intensity = this.currentState.hemiIntensity;

    if (focusPos) {
      this.skyDome.position.set(focusPos.x, 0, focusPos.z);
      this.dirLight.target.position.copy(focusPos);
      this.dirLight.position.copy(focusPos).add(this.currentState.sunOffset);
      this.celestialDisc.position.copy(focusPos).addScaledVector(this.currentState.sunOffset, 3.2);
      this.celestialMat.color.copy(this.currentState.sunColor);
      this.celestialDisc.visible = this.weather !== 'fog' && this.weather !== 'rain';

      if (this.cloudGroup) {
        this.cloudGroup.position.x = focusPos.x;
        this.cloudGroup.position.z = focusPos.z;
        this.cloudMat.color.copy(this.currentState.sunColor).lerp(new THREE.Color(0xffffff), 0.45);
        this.cloudMat.opacity = this.timeOfDay === 'night' ? 0.28 : 0.76;
      }
    }

    if (this.worldBuilder) {
      if (this.worldBuilder.windowMaterial) {
        this.worldBuilder.windowMaterial.emissiveIntensity = this.currentState.windowEmissive;
      }
      if (this.worldBuilder.streetLightBulbMat) {
        this.worldBuilder.streetLightBulbMat.emissiveIntensity = this.currentState.streetLightEmissive;
      }
      if (this.worldBuilder.roadMaterial) {
        this.worldBuilder.roadMaterial.roughness = this.currentState.roadRoughness;
        this.worldBuilder.roadMaterial.metalness = this.currentState.roadMetalness;
      }
      if (this.worldBuilder.secondaryRoadMaterials) {
        for (const mat of this.worldBuilder.secondaryRoadMaterials) {
          mat.roughness = this.currentState.roadRoughness;
          mat.metalness = this.currentState.roadMetalness;
        }
      }
    }
  }

  /**
   * Returns live physics grip, braking, and launch multipliers for the current weather condition
   */
  getWeatherPhysicsModifiers() {
    const wPreset = WEATHER_PRESETS[this.weather] || WEATHER_PRESETS.clear;
    return {
      weather: this.weather,
      gripMultiplier: wPreset.gripMultiplier,
      brakeMultiplier: wPreset.brakeMultiplier,
      launchMultiplier: wPreset.launchMultiplier
    };
  }

  areHeadlightsNeeded() {
    const tPreset = TIME_PRESETS[this.timeOfDay];
    const wPreset = WEATHER_PRESETS[this.weather];
    return Boolean(tPreset?.headlightsOn || wPreset?.forceHeadlights);
  }

  update(dt, focusPos) {
    const clampedDt = Math.min(dt, 0.1);
    const lerpFactor = 1 - Math.exp(-3.8 * clampedDt);

    // Smoothly interpolate all environmental lighting, sky, fog, and road surface values
    this.currentState.skyColor.lerp(this.targetState.skyColor, lerpFactor);
    this.currentState.zenithColor.lerp(this.targetState.zenithColor, lerpFactor);
    this.currentState.fogColor.lerp(this.targetState.fogColor, lerpFactor);
    this.currentState.fogDensity = THREE.MathUtils.lerp(this.currentState.fogDensity, this.targetState.fogDensity, lerpFactor);

    this.currentState.sunColor.lerp(this.targetState.sunColor, lerpFactor);
    this.currentState.sunIntensity = THREE.MathUtils.lerp(this.currentState.sunIntensity, this.targetState.sunIntensity, lerpFactor);
    this.currentState.sunOffset.lerp(this.targetState.sunOffset, lerpFactor);

    this.currentState.hemiSky.lerp(this.targetState.hemiSky, lerpFactor);
    this.currentState.hemiGround.lerp(this.targetState.hemiGround, lerpFactor);
    this.currentState.hemiIntensity = THREE.MathUtils.lerp(this.currentState.hemiIntensity, this.targetState.hemiIntensity, lerpFactor);

    this.currentState.windowEmissive = THREE.MathUtils.lerp(this.currentState.windowEmissive, this.targetState.windowEmissive, lerpFactor);
    this.currentState.streetLightEmissive = THREE.MathUtils.lerp(this.currentState.streetLightEmissive, this.targetState.streetLightEmissive, lerpFactor);
    this.currentState.roadRoughness = THREE.MathUtils.lerp(this.currentState.roadRoughness, this.targetState.roadRoughness, lerpFactor);
    this.currentState.roadMetalness = THREE.MathUtils.lerp(this.currentState.roadMetalness, this.targetState.roadMetalness, lerpFactor);

    this._commitStateToScene(focusPos);

    if (this.cloudGroup) {
      this.cloudGroup.rotation.y += clampedDt * 0.008;
    }

    // Animate falling rain particles around camera/car focus
    if (this.rainPoints.visible && focusPos) {
      const posAttr = this.rainPoints.geometry.attributes.position;
      const arr = posAttr.array;

      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= 36 * clampedDt;
        arr[i] -= 3.5 * clampedDt;
        if (arr[i + 1] < 0) {
          arr[i] = focusPos.x + (Math.random() - 0.5) * 85;
          arr[i + 1] = focusPos.y + 28 + Math.random() * 12;
          arr[i + 2] = focusPos.z + (Math.random() - 0.5) * 85;
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}
