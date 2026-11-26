import * as THREE from 'three';
import { CarBuilder } from '../vehicles/CarBuilder.js';

export class WorldBuilder {
  constructor(scene, trackSpline) {
    this.scene = scene;
    this.track = trackSpline;
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // References for dynamic time-of-day & weather updates
    this.roadMaterial = null;
    this.secondaryRoadMaterials = [];
    this.windowMaterial = null;
    this.streetLightBulbMat = null;
    this.tunnelLightMat = null;
    this.waterMaterial = null;
    this.pedestrians = [];

    // Garage showroom platform located away from main circuit
    this.garageAnchor = new THREE.Vector3(-240, 0.05, 0);
  }

  build() {
    this._buildGroundAndRiver();
    this._buildRoadRibbon();
    this._buildSidewalksAndSecondaryRoads();
    this._buildIntersections();
    this._buildParkingAreas();
    this._buildBarriers();
    this._buildSuspensionBridge();
    this._buildTunnelStructure();
    this._buildStartFinishGantry();
    this._buildStreetlightsAndSigns();
    this._buildCityBuildingsAndTrees();
    this._buildBillboardsAndPedestrians();
    this._buildGarageShowroom();
  }

  _createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Dark USA highway asphalt base
    ctx.fillStyle = '#22262c';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle asphalt aggregate grain
    for (let i = 0; i < 4000; i++) {
      const shade = 26 + Math.floor(Math.random() * 22);
      ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Outer shoulder curbs
    const curbW = 22;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, curbW, 512);
    ctx.fillRect(512 - curbW, 0, curbW, 512);

    // Solid white fog/shoulder lines
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(30, 0, 6, 512);
    ctx.fillRect(512 - 36, 0, 6, 512);

    // Iconic USA Double Yellow Centerline
    ctx.fillStyle = '#f5b82e';
    ctx.fillRect(249, 0, 5, 512);
    ctx.fillRect(258, 0, 5, 512);

    // Dashed white lane dividers (left & right 2-lane carriageways)
    ctx.fillStyle = '#dce4f0';
    ctx.fillRect(140, 40, 5, 180);
    ctx.fillRect(140, 300, 5, 180);
    ctx.fillRect(367, 40, 5, 180);
    ctx.fillRect(367, 300, 5, 180);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  _createParkingLotTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#262b33';
    ctx.fillRect(0, 0, 512, 512);

    // Yellow USA parking stall bays
    ctx.strokeStyle = '#f5b82e';
    ctx.lineWidth = 4;

    for (let row = 60; row < 460; row += 140) {
      ctx.beginPath();
      ctx.moveTo(40, row);
      ctx.lineTo(472, row);
      ctx.stroke();

      for (let col = 40; col <= 472; col += 54) {
        ctx.beginPath();
        ctx.moveTo(col, row - 42);
        ctx.lineTo(col, row + 42);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _createHighwaySignTexture(topText, mainText, subText) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Reflective Interstate Green background with white border
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 148);

    // Red/Blue USA Interstate shield badge
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(24, 24, 68, 22);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(24, 46, 68, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(topText, 58, 78);

    ctx.textAlign = 'left';
    ctx.font = 'bold 34px Segoe UI, sans-serif';
    ctx.fillText(mainText, 112, 65);

    ctx.font = 'bold 24px Segoe UI, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText(subText, 112, 115);

    return new THREE.CanvasTexture(canvas);
  }

  _createBuildingWindowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#141923';
    ctx.fillRect(0, 0, 256, 512);

    const cols = 8;
    const rows = 16;
    const padX = 6;
    const padY = 6;
    const winW = (256 / cols) - padX * 2;
    const winH = (512 / rows) - padY * 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() > 0.38;
        if (lit) {
          const warm = Math.random() > 0.45;
          ctx.fillStyle = warm ? '#ffe39f' : '#8fd4ff';
        } else {
          ctx.fillStyle = '#1f2837';
        }
        ctx.fillRect(c * (256 / cols) + padX, r * (512 / rows) + padY, winW, winH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _buildGroundAndRiver() {
    const groundGeo = new THREE.PlaneGeometry(2600, 2600);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1d2822,
      roughness: 0.92,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    this.worldGroup.add(ground);

    // Golden Bay water channel flowing beneath the North Suspension Bridge
    const waterGeo = new THREE.PlaneGeometry(560, 250);
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a3d5c,
      roughness: 0.16,
      metalness: 0.78
    });
    const water = new THREE.Mesh(waterGeo, this.waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(275, -0.05, 420);
    this.worldGroup.add(water);
  }

  _buildRoadRibbon() {
    const samples = this.track.samples;
    const N = samples.length;
    const halfW = this.track.roadWidth * 0.5 + 0.8;

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    let accumDist = 0;

    for (let i = 0; i <= N; i++) {
      const s = samples[i % N];
      if (i > 0) {
        const prev = samples[(i - 1) % N];
        accumDist += s.point.distanceTo(prev.point);
      }

      const leftPt = new THREE.Vector3().copy(s.point).addScaledVector(s.right, -halfW);
      const rightPt = new THREE.Vector3().copy(s.point).addScaledVector(s.right, halfW);

      leftPt.y += 0.03;
      rightPt.y += 0.03;

      positions.push(leftPt.x, leftPt.y, leftPt.z);
      positions.push(rightPt.x, rightPt.y, rightPt.z);

      normals.push(0, 1, 0, 0, 1, 0);

      const vCoord = accumDist / 14;
      uvs.push(0, vCoord, 1, vCoord);

      if (i < N) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    const roadTex = this._createAsphaltTexture();
    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.72,
      metalness: 0.12,
      side: THREE.DoubleSide
    });

    const roadMesh = new THREE.Mesh(geo, this.roadMaterial);
    roadMesh.receiveShadow = true;
    this.worldGroup.add(roadMesh);

    // Concrete bridge girder under-deck
    const deckPositions = [];
    const deckIndices = [];
    for (let i = 0; i <= N; i++) {
      const s = samples[i % N];
      const leftTop = new THREE.Vector3().copy(s.point).addScaledVector(s.right, -halfW - 0.5);
      const rightTop = new THREE.Vector3().copy(s.point).addScaledVector(s.right, halfW + 0.5);
      const leftBot = leftTop.clone().add(new THREE.Vector3(0, -1.2, 0));
      const rightBot = rightTop.clone().add(new THREE.Vector3(0, -1.2, 0));

      deckPositions.push(
        leftTop.x, leftTop.y, leftTop.z,
        leftBot.x, leftBot.y, leftBot.z,
        rightTop.x, rightTop.y, rightTop.z,
        rightBot.x, rightBot.y, rightBot.z
      );

      if (i < N) {
        const b = i * 4;
        deckIndices.push(b, b + 1, b + 4, b + 1, b + 5, b + 4);
        deckIndices.push(b + 2, b + 6, b + 3, b + 3, b + 6, b + 7);
        deckIndices.push(b + 1, b + 3, b + 5, b + 3, b + 7, b + 5);
      }
    }

    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPositions, 3));
    deckGeo.setIndex(deckIndices);
    deckGeo.computeVertexNormals();

    const deckMat = new THREE.MeshStandardMaterial({ color: 0x454c59, roughness: 0.85 });
    this.worldGroup.add(new THREE.Mesh(deckGeo, deckMat));
  }

  /**
   * Builds connected Downtown cross-streets, grid avenues, and raised concrete USA sidewalks
   */
  _buildSidewalksAndSecondaryRoads() {
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.82,
      metalness: 0.08
    });

    // Raised concrete sidewalks along Downtown Main Boulevard
    const samples = this.track.samples;
    for (let i = 0; i < samples.length; i += 2) {
      const s = samples[i];
      if (s.sector !== 'city' && s.sector !== 'harbor') continue;
      const next = samples[(i + 2) % samples.length];
      const len = s.point.distanceTo(next.point) + 0.4;

      for (const side of [-1, 1]) {
        if ((side === -1 && s.openLeft) || (side === 1 && s.openRight)) continue;
        const sw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, len), sidewalkMat);
        const pos = new THREE.Vector3().copy(s.point).addScaledVector(s.right, side * 12.1);
        sw.position.set(pos.x, pos.y + 0.11, pos.z);
        sw.rotation.y = s.heading;
        sw.receiveShadow = true;
        this.worldGroup.add(sw);
      }
    }

    // Connected Secondary Roads & Avenues (East/West Broadway, East/West Liberty, Lexington, Madison)
    for (const r of this.track.secondaryRoads) {
      const w = r.maxX - r.minX;
      const d = r.maxZ - r.minZ;
      const cx = (r.minX + r.maxX) * 0.5;
      const cz = (r.minZ + r.maxZ) * 0.5;

      const roadTex = this._createAsphaltTexture();
      const lengthSpan = r.orientation === 'ew' ? w : d;
      roadTex.repeat.set(1, Math.max(1, Math.round(lengthSpan / 16)));

      const secMat = new THREE.MeshStandardMaterial({
        map: roadTex,
        roughness: 0.72,
        metalness: 0.12
      });
      this.secondaryRoadMaterials.push(secMat);

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(r.orientation === 'ew' ? d : w, lengthSpan),
        secMat
      );
      plane.rotation.x = -Math.PI / 2;
      if (r.orientation === 'ew') {
        plane.rotation.z = Math.PI / 2;
      }
      plane.position.set(cx, 0.025, cz);
      plane.receiveShadow = true;
      this.worldGroup.add(plane);

      // Raised concrete sidewalks flanking the secondary avenues
      if (r.orientation === 'ew') {
        const swNorth = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.20, 2.4), sidewalkMat);
        swNorth.position.set(cx, 0.10, r.maxZ + 1.2);
        this.worldGroup.add(swNorth);

        const swSouth = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.20, 2.4), sidewalkMat);
        swSouth.position.set(cx, 0.10, r.minZ - 1.2);
        this.worldGroup.add(swSouth);
      } else {
        const swEast = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.20, d), sidewalkMat);
        swEast.position.set(r.minX - 1.2, 0.10, cz);
        this.worldGroup.add(swEast);

        const swWest = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.20, d), sidewalkMat);
        swWest.position.set(r.maxX + 1.2, 0.10, cz);
        this.worldGroup.add(swWest);
      }
    }
  }

  /**
   * Builds 4-Way USA Signalized Intersections with Zebra Crosswalks & Yellow Traffic Lights
   */
  _buildIntersections() {
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 }); // Classic American yellow traffic light housing
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xef4444, emissiveIntensity: 2.0 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 2.4 });

    for (const inter of this.track.intersections) {
      const group = new THREE.Group();
      group.position.copy(inter.center);

      // Painted White Zebra Crosswalk Stripes on 4 approaches
      for (const offsetZ of [-11.5, 11.5]) {
        for (let sx = -7.5; sx <= 7.5; sx += 1.8) {
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.0), stripeMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(sx, 0.055, offsetZ);
          group.add(stripe);
        }
      }

      // USA Cantilever Traffic Signal Mast Arms on corners
      for (const [cx, cz, rotY] of [
        [-11.2, 11.2, 0],
        [11.2, -11.2, Math.PI]
      ]) {
        const mast = new THREE.Group();
        mast.position.set(cx, 0, cz);
        mast.rotation.y = rotY;

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.6, 8), poleMat);
        post.position.y = 3.3;
        mast.add(post);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.18, 0.18), poleMat);
        arm.position.set(3.5, 6.2, 0);
        mast.add(arm);

        // 2 hanging American traffic signal heads per mast arm
        for (const hx of [2.4, 5.8]) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.15, 0.35), housingMat);
          box.position.set(hx, 5.55, 0);
          mast.add(box);

          const redLens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), redMat);
          redLens.position.set(hx, 5.85, 0.16);
          mast.add(redLens);

          const greenLens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), greenMat);
          greenLens.position.set(hx, 5.25, 0.16);
          mast.add(greenLens);
        }

        group.add(mast);
      }

      this.worldGroup.add(group);
    }
  }

  /**
   * Builds driveable USA Parking Lots with painted stalls, floodlights, and parked cars
   */
  _buildParkingAreas() {
    const lotTex = this._createParkingLotTexture();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
    const parkedColors = ['#3b82f6', '#ef4444', '#e2e8f0', '#10b981', '#64748b', '#f59e0b'];

    for (let idx = 0; idx < this.track.parkingAreas.length; idx++) {
      const lot = this.track.parkingAreas[idx];
      const w = lot.maxX - lot.minX;
      const d = lot.maxZ - lot.minZ;
      const cx = (lot.minX + lot.maxX) * 0.5;
      const cz = (lot.minZ + lot.maxZ) * 0.5;

      const texClone = lotTex.clone();
      texClone.needsUpdate = true;
      texClone.repeat.set(Math.max(1, Math.round(w / 28)), Math.max(1, Math.round(d / 28)));

      const lotMat = new THREE.MeshStandardMaterial({
        map: texClone,
        roughness: 0.78,
        metalness: 0.1
      });

      const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lotMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(cx, 0.02, cz);
      pad.receiveShadow = true;
      this.worldGroup.add(pad);

      // Floodlight poles at parking lot corners
      for (const [px, pz] of [
        [lot.minX + 3, lot.minZ + 3],
        [lot.maxX - 3, lot.maxZ - 3]
      ]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 8.5, 6), poleMat);
        pole.position.set(px, 4.25, pz);
        this.worldGroup.add(pole);
      }

      // Place a few static parked vehicles in outer stalls (leaving center driving lanes wide open)
      for (let c = 0; c < 3; c++) {
        const type = c % 2 === 0 ? 'suv' : 'sedan';
        const color = parkedColors[(idx + c) % parkedColors.length];
        const parked = CarBuilder.buildTrafficVehicle(type, color);
        parked.root.position.set(lot.minX + 10 + c * 16, 0, lot.maxZ - 7);
        this.worldGroup.add(parked.root);
      }
    }
  }

  /**
   * Builds segmented concrete highway barriers with drive-through openings at all intersections & parking lots
   */
  _buildBarriers() {
    const samples = this.track.samples;
    const N = samples.length;
    const offset = this.track.barrierHalfWidth;
    const barrierH = 0.92;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x8d95a5,
      roughness: 0.65,
      metalness: 0.25,
      side: THREE.DoubleSide
    });

    const buildSegmentedSide = (sideSign) => {
      const positions = [];
      const indices = [];
      let vertCount = 0;

      for (let i = 0; i < N; i++) {
        const s0 = samples[i];
        const s1 = samples[(i + 1) % N];

        // Leave physical opening in barrier at intersections, cross-streets, and parking entrances!
        const isOpen = sideSign === -1
          ? (s0.openLeft || s1.openLeft)
          : (s0.openRight || s1.openRight);

        if (isOpen) continue;

        const pair = [s0, s1];
        for (const s of pair) {
          const innerBase = new THREE.Vector3().copy(s.point).addScaledVector(s.right, sideSign * (offset - 0.24));
          const outerBase = new THREE.Vector3().copy(s.point).addScaledVector(s.right, sideSign * (offset + 0.24));
          const innerTop = innerBase.clone().add(new THREE.Vector3(0, barrierH, 0));
          const outerTop = outerBase.clone().add(new THREE.Vector3(0, barrierH, 0));

          positions.push(
            innerBase.x, innerBase.y, innerBase.z,
            innerTop.x, innerTop.y, innerTop.z,
            outerTop.x, outerTop.y, outerTop.z,
            outerBase.x, outerBase.y, outerBase.z
          );
        }

        const b = vertCount;
        // Inner face, top cap, outer face
        indices.push(b, b + 1, b + 4, b + 1, b + 5, b + 4);
        indices.push(b + 1, b + 2, b + 5, b + 2, b + 6, b + 5);
        indices.push(b + 2, b + 3, b + 6, b + 3, b + 7, b + 6);
        vertCount += 8;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.worldGroup.add(mesh);
    };

    buildSegmentedSide(-1);
    buildSegmentedSide(1);
  }

  _buildSuspensionBridge() {
    const towerSampleIndices = [Math.floor(this.track.sampleCount * 0.27), Math.floor(this.track.sampleCount * 0.37)];
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xc9382b, // Golden Gate International Orange
      roughness: 0.42,
      metalness: 0.55
    });
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0xd5dce6,
      roughness: 0.3,
      metalness: 0.8
    });

    for (const idx of towerSampleIndices) {
      const s = this.track.samples[idx];
      const group = new THREE.Group();
      group.position.copy(s.point);
      group.rotation.y = s.heading;

      const pillarGeo = new THREE.BoxGeometry(2.6, 46, 2.6);
      const leftPillar = new THREE.Mesh(pillarGeo, towerMat);
      leftPillar.position.set(-12, 14, 0);
      leftPillar.castShadow = true;
      group.add(leftPillar);

      const rightPillar = new THREE.Mesh(pillarGeo, towerMat);
      rightPillar.position.set(12, 14, 0);
      rightPillar.castShadow = true;
      group.add(rightPillar);

      const beamGeo = new THREE.BoxGeometry(26, 2.4, 2.2);
      const topBeam = new THREE.Mesh(beamGeo, towerMat);
      topBeam.position.set(0, 34, 0);
      group.add(topBeam);

      const midBeam = new THREE.Mesh(beamGeo, towerMat);
      midBeam.position.set(0, 20, 0);
      group.add(midBeam);

      this.worldGroup.add(group);
    }

    const suspGeo = new THREE.CylinderGeometry(0.08, 0.08, 18, 6);
    for (let i = Math.floor(this.track.sampleCount * 0.23); i <= Math.floor(this.track.sampleCount * 0.41); i += 4) {
      const s = this.track.samples[i];
      for (const side of [-1, 1]) {
        const cable = new THREE.Mesh(suspGeo, cableMat);
        cable.position.copy(s.point).addScaledVector(s.right, side * 11.4);
        cable.position.y += 9;
        this.worldGroup.add(cable);
      }
    }
  }

  _buildTunnelStructure() {
    const startIdx = Math.floor(this.track.sampleCount * 0.58);
    const endIdx = Math.floor(this.track.sampleCount * 0.77);

    const tunnelWallMat = new THREE.MeshStandardMaterial({
      color: 0x2c323d,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    this.tunnelLightMat = new THREE.MeshStandardMaterial({
      color: 0xffaa33,
      emissive: 0xff9922,
      emissiveIntensity: 2.2
    });

    const archOuterW = 23.0;
    const archH = 8.4;

    for (let i = startIdx; i < endIdx; i += 2) {
      const s = this.track.samples[i];
      const next = this.track.samples[(i + 2) % this.track.sampleCount];
      const segLen = s.point.distanceTo(next.point) + 0.5;

      const segGroup = new THREE.Group();
      segGroup.position.copy(s.point);
      segGroup.rotation.y = s.heading;

      const wallGeo = new THREE.BoxGeometry(1.4, archH, segLen);
      const leftWall = new THREE.Mesh(wallGeo, tunnelWallMat);
      leftWall.position.set(-archOuterW * 0.5, archH * 0.5, segLen * 0.3);
      segGroup.add(leftWall);

      const rightWall = new THREE.Mesh(wallGeo, tunnelWallMat);
      rightWall.position.set(archOuterW * 0.5, archH * 0.5, segLen * 0.3);
      segGroup.add(rightWall);

      const roofGeo = new THREE.BoxGeometry(archOuterW + 1.5, 1.6, segLen);
      const roof = new THREE.Mesh(roofGeo, tunnelWallMat);
      roof.position.set(0, archH + 0.5, segLen * 0.3);
      roof.castShadow = true;
      segGroup.add(roof);

      if (i % 4 === 0) {
        const lightGeo = new THREE.BoxGeometry(1.2, 0.2, segLen * 0.65);
        const lightLeft = new THREE.Mesh(lightGeo, this.tunnelLightMat);
        lightLeft.position.set(-4.5, archH - 0.35, segLen * 0.3);
        segGroup.add(lightLeft);

        const lightRight = new THREE.Mesh(lightGeo, this.tunnelLightMat);
        lightRight.position.set(4.5, archH - 0.35, segLen * 0.3);
        segGroup.add(lightRight);
      }

      this.worldGroup.add(segGroup);
    }
  }

  _buildStartFinishGantry() {
    const s = this.track.samples[15];
    const gantry = new THREE.Group();
    gantry.position.copy(s.point);
    gantry.rotation.y = s.heading;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, metalness: 0.7, roughness: 0.3 });
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8
    });

    const postGeo = new THREE.BoxGeometry(0.9, 8.5, 0.9);
    const leftPost = new THREE.Mesh(postGeo, frameMat);
    leftPost.position.set(-10.8, 4.25, 0);
    gantry.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, frameMat);
    rightPost.position.set(10.8, 4.25, 0);
    gantry.add(rightPost);

    const overheadGeo = new THREE.BoxGeometry(22.6, 1.8, 1.2);
    const overhead = new THREE.Mesh(overheadGeo, bannerMat);
    overhead.position.set(0, 7.8, 0);
    gantry.add(overhead);

    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 256;
    checkerCanvas.height = 64;
    const ctx = checkerCanvas.getContext('2d');
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 16; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(c * 16, r * 16, 16, 16);
      }
    }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    const startLineMat = new THREE.MeshBasicMaterial({ map: checkerTex });
    const startLineMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.2), startLineMat);
    startLineMesh.rotation.x = -Math.PI / 2;
    startLineMesh.position.set(0, 0.06, 0);
    gantry.add(startLineMesh);

    this.worldGroup.add(gantry);
  }

  _buildStreetlightsAndSigns() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.4 });
    this.streetLightBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff3c4,
      emissive: 0xffd56b,
      emissiveIntensity: 1.0
    });

    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.45
    });

    // USA Interstate Highway Gantry Sign Textures
    const gantrySpecs = [
      { idx: 68, shield: 'I-95', title: 'GOLDEN BAY BRIDGE', sub: 'HARBOR PORT   2 MI ▲' },
      { idx: 265, shield: 'I-95', title: 'HARBOR TERMINAL', sub: 'EXIT 42   CONTAINER DOCK ▶' },
      { idx: 335, shield: 'I-10', title: 'BLUE RIDGE TUNNEL', sub: 'KEEP HEADLIGHTS ON' },
      { idx: 495, shield: 'US-1', title: 'SUNSET PALMS PKWY', sub: 'DOWNTOWN FINANCIAL DIST ▲' }
    ];

    for (const gs of gantrySpecs) {
      const s = this.track.samples[gs.idx % this.track.samples.length];
      const signGroup = new THREE.Group();
      signGroup.position.copy(s.point);
      signGroup.rotation.y = s.heading;

      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 7.8, 8), poleMat);
      pL.position.set(-11.4, 3.9, 0);
      signGroup.add(pL);

      const pR = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 7.8, 8), poleMat);
      pR.position.set(11.4, 3.9, 0);
      signGroup.add(pR);

      const bar = new THREE.Mesh(new THREE.BoxGeometry(23.5, 0.38, 0.38), poleMat);
      bar.position.set(0, 7.3, 0);
      signGroup.add(bar);

      const signTex = this._createHighwaySignTexture(gs.shield, gs.title, gs.sub);
      const boardMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(11.8, 2.7, 0.28), boardMat);
      board.position.set(0, 7.0, 0);
      signGroup.add(board);

      this.worldGroup.add(signGroup);
    }

    const samples = this.track.samples;
    for (let i = 0; i < samples.length; i += 8) {
      const s = samples[i];
      if (s.sector === 'tunnel') continue;

      for (const side of [-1, 1]) {
        if ((side === -1 && s.openLeft) || (side === 1 && s.openRight)) continue;

        const lampGroup = new THREE.Group();
        const basePos = new THREE.Vector3().copy(s.point).addScaledVector(s.right, side * 11.0);
        lampGroup.position.copy(basePos);
        lampGroup.rotation.y = s.heading;

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 6), poleMat);
        pole.position.y = 3.6;
        lampGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), poleMat);
        arm.position.set(-side * 1.0, 7.1, 0);
        lampGroup.add(arm);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 0.32), this.streetLightBulbMat);
        bulb.position.set(-side * 1.9, 7.0, 0);
        lampGroup.add(bulb);

        this.worldGroup.add(lampGroup);
      }

      // Yellow Diamond USA Corner Warning Chevrons on tighter bends
      if (i % 16 === 0) {
        const nextS = samples[(i + 5) % samples.length];
        let angleDiff = nextS.heading - s.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) > 0.14) {
          const outerSide = angleDiff > 0 ? -1 : 1;
          if ((outerSide === -1 && s.openLeft) || (outerSide === 1 && s.openRight)) continue;

          const signPos = new THREE.Vector3().copy(s.point).addScaledVector(s.right, outerSide * 11.3);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), poleMat);
          post.position.copy(signPos).add(new THREE.Vector3(0, 1.1, 0));
          this.worldGroup.add(post);

          const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.95, 0.95), chevronMat);
          chevron.position.copy(signPos).add(new THREE.Vector3(0, 2.0, 0));
          chevron.rotation.y = s.heading + (outerSide * Math.PI * 0.5);
          chevron.rotation.x = Math.PI / 4; // Diamond orientation
          this.worldGroup.add(chevron);
        }
      }
    }
  }

  /**
   * Builds distinct USA Districts:
   * - Downtown Skyscrapers & Setback Towers
   * - Harbor Port Shipping Containers & Warehouses
   * - Sunset Palms Parkway Palm Trees & Plaza Buildings
   */
  _buildCityBuildingsAndTrees() {
    const winTex = this._createBuildingWindowTexture();
    this.windowMaterial = new THREE.MeshStandardMaterial({
      map: winTex,
      emissiveMap: winTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.52
    });

    const accentRoofMat = new THREE.MeshStandardMaterial({ color: 0x27303f, roughness: 0.7 });
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.4 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 });
    const palmFoliageMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });

    const containerColors = [0xdc2626, 0x2563eb, 0xd97706, 0x059669, 0x475569];
    const containerGeo = new THREE.BoxGeometry(3.2, 2.9, 8.5);

    const samples = this.track.samples;

    for (let i = 0; i < samples.length; i += 6) {
      const s = samples[i];
      if (s.sector === 'bridge' || s.sector === 'tunnel') continue;

      for (const side of [-1, 1]) {
        // 1. Trees (Palm trees in Sunset Palms Parkway, Oak/Pine trees in Downtown)
        const treeDist = 15.2 + (i % 3) * 2.2;
        const treePos = new THREE.Vector3().copy(s.point).addScaledVector(s.right, side * treeDist);
        treePos.y = 0;

        if (this.track.isFootprintClearOfRoads(treePos.x, treePos.z, 2.0, 2.0)) {
          const treeGroup = new THREE.Group();
          treeGroup.position.copy(treePos);

          if (s.sector === 'highway') {
            // California / Miami Palm Tree
            const palmTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 6.2, 6), trunkMat);
            palmTrunk.position.y = 3.1;
            palmTrunk.rotation.z = side * 0.08;
            treeGroup.add(palmTrunk);

            for (let f = 0; f < 5; f++) {
              const frond = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.8, 4), palmFoliageMat);
              frond.position.set(0, 6.2, 0);
              frond.rotation.y = (f / 5) * Math.PI * 2;
              frond.rotation.x = 1.1;
              treeGroup.add(frond);
            }
          } else {
            // Urban Boulevard Tree
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 6), trunkMat);
            trunk.position.y = 1.3;
            treeGroup.add(trunk);

            const crown = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.8, 7), foliageMat);
            crown.position.y = 4.4;
            crown.castShadow = true;
            treeGroup.add(crown);
          }

          this.worldGroup.add(treeGroup);
        }

        // 2. District-Specific Architecture & Landmarks
        const bldgDist = 30 + ((i * 13) % 24);
        const bldgPos = new THREE.Vector3().copy(s.point).addScaledVector(s.right, side * bldgDist);
        bldgPos.y = 0;

        const w = 15 + ((i * 7) % 14);
        const d = 15 + ((i * 11) % 14);

        if (!this.track.isFootprintClearOfRoads(bldgPos.x, bldgPos.z, w * 0.55, d * 0.55)) {
          continue;
        }

        if (s.sector === 'harbor') {
          // Harbor Port District: Stacked Corrugated Shipping Containers & Warehouses
          const stackHeight = 1 + (i % 3);
          for (let st = 0; st < stackHeight; st++) {
            const cMat = new THREE.MeshStandardMaterial({
              color: containerColors[(i + st) % containerColors.length],
              roughness: 0.6,
              metalness: 0.35
            });
            const box = new THREE.Mesh(containerGeo, cMat);
            box.position.set(bldgPos.x, 1.45 + st * 2.95, bldgPos.z);
            box.rotation.y = s.heading;
            box.castShadow = true;
            this.worldGroup.add(box);
          }
          this.track.addBuildingCollider(bldgPos.x, bldgPos.z, 2.2, 4.5);
        } else {
          // Downtown Financial Skyscrapers & Sunset Parkway Commercial Plazas
          const h = s.sector === 'city' ? 32 + ((i * 19) % 72) : 14 + ((i * 17) % 24);

          const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.windowMaterial);
          bldg.position.set(bldgPos.x, h * 0.5, bldgPos.z);
          bldg.castShadow = true;
          bldg.receiveShadow = true;
          this.worldGroup.add(bldg);

          // Register solid building footprint in physics collision system
          this.track.addBuildingCollider(bldgPos.x, bldgPos.z, w * 0.5, d * 0.5);

          const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 2.4, d * 0.72), accentRoofMat);
          roofCap.position.set(bldgPos.x, h + 1.2, bldgPos.z);
          this.worldGroup.add(roofCap);

          // Iconic American Skyscraper Setback Crown & Glowing Antenna Spire on tallest towers
          if (h > 65) {
            const upperTier = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, 12, d * 0.48), this.windowMaterial);
            upperTier.position.set(bldgPos.x, h + 6, bldgPos.z);
            this.worldGroup.add(upperTier);

            const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 14, 6), spireMat);
            spire.position.set(bldgPos.x, h + 18, bldgPos.z);
            this.worldGroup.add(spire);
          }
        }
      }
    }

    // Additional Downtown City Block Towers flanking the outer Lexington & Madison Avenues
    const outerBlockCenters = [
      [-155, -20, 22, 22, 68],
      [-155, 25, 20, 24, 82],
      [-70, 92, 26, 20, 58],
      [-70, -112, 24, 20, 62],
      [65, 92, 24, 20, 54],
      [65, -112, 24, 20, 64],
      [148, -20, 22, 22, 74]
    ];

    for (const [bx, bz, bw, bd, bh] of outerBlockCenters) {
      if (!this.track.isFootprintClearOfRoads(bx, bz, bw * 0.55, bd * 0.55)) continue;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), this.windowMaterial);
      tower.position.set(bx, bh * 0.5, bz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.worldGroup.add(tower);
      this.track.addBuildingCollider(bx, bz, bw * 0.5, bd * 0.5);
    }
  }

  _createBillboardTexture(headline, subline, bgHex, accentHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 176);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(headline, 256, 88);

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 26px Segoe UI, sans-serif';
    ctx.fillText(subline, 256, 142);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Adds illuminated 3D Neon City Billboards, Ground-Floor Retail Storefront awnings,
   * and animated Sidewalk Pedestrians walking along Downtown sidewalks.
   */
  _buildBillboardsAndPedestrians() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const billboards = [
      { idx: 28, side: 1, h: 'APEX MOTORSPORT', s: 'STREET SYNDICATE CHAMPIONSHIP', bg: '#0f172a', ac: '#38bdf8' },
      { idx: 95, side: -1, h: 'GOLDEN BAY GP', s: 'INTERSTATE 95 HIGH SPEED SECTOR', bg: '#1e1b4b', ac: '#f97316' },
      { idx: 280, side: 1, h: 'HARBOR PORT', s: 'GLOBAL FREIGHT & CONTAINER DOCKS', bg: '#064e3b', ac: '#34d399' },
      { idx: 525, side: -1, h: 'SUNSET PALMS', s: 'LUXURY AUTO GALLERY & TUNING', bg: '#3b0764', ac: '#e879f9' }
    ];

    for (const bb of billboards) {
      const s = this.track.samples[bb.idx % this.track.samples.length];
      const pos = new THREE.Vector3().copy(s.point).addScaledVector(s.right, bb.side * 18.5);
      const group = new THREE.Group();
      group.position.copy(pos);
      group.rotation.y = s.heading + (bb.side > 0 ? -0.35 : 0.35);

      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 11, 8), poleMat);
      postL.position.set(-3.2, 5.5, 0);
      group.add(postL);

      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 11, 8), poleMat);
      postR.position.set(3.2, 5.5, 0);
      group.add(postR);

      const tex = this._createBillboardTexture(bb.h, bb.s, bb.bg, bb.ac);
      const boardMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.85,
        roughness: 0.3
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(10.5, 3.8, 0.4), boardMat);
      board.position.set(0, 11.2, 0);
      group.add(board);

      this.worldGroup.add(group);
    }

    // Animated Sidewalk Pedestrians walking safely on raised Downtown sidewalks
    const pedHeadGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const pedBodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.95, 8);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.7 });
    const outfitColors = [0x38bdf8, 0xf97316, 0x10b981, 0xe879f9, 0xfacc15, 0xef4444];

    for (let i = 0; i < 24; i++) {
      const sampleIdx = (i * 5) % 110; // Downtown boulevard sector
      const s = this.track.samples[sampleIdx];
      if (s.sector !== 'city') continue;

      const side = i % 2 === 0 ? 1 : -1;
      if ((side === -1 && s.openLeft) || (side === 1 && s.openRight)) continue;

      const pedGroup = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({
        color: outfitColors[i % outfitColors.length],
        roughness: 0.6
      });
      const body = new THREE.Mesh(pedBodyGeo, bodyMat);
      body.position.y = 0.72;
      pedGroup.add(body);

      const head = new THREE.Mesh(pedHeadGeo, skinMat);
      head.position.y = 1.38;
      pedGroup.add(head);

      const basePos = new THREE.Vector3().copy(s.point).addScaledVector(s.right, side * 12.2);
      basePos.y = 0.22;
      pedGroup.position.copy(basePos);
      pedGroup.rotation.y = s.heading;

      this.worldGroup.add(pedGroup);
      this.pedestrians.push({
        mesh: pedGroup,
        basePos: basePos.clone(),
        tangent: s.flatTangent.clone(),
        phase: i * 0.9,
        speed: 1.2 + (i % 3) * 0.35
      });
    }
  }

  updatePedestrians(dt) {
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      p.phase += dt * p.speed;
      const walkOffset = Math.sin(p.phase * 0.45) * 4.5;
      p.mesh.position.copy(p.basePos).addScaledVector(p.tangent, walkOffset);
      p.mesh.position.y = 0.22 + Math.abs(Math.sin(p.phase * 4.5)) * 0.05;
    }
  }

  _buildGarageShowroom() {
    const group = new THREE.Group();
    group.position.copy(this.garageAnchor);

    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x161b26,
      roughness: 0.2,
      metalness: 0.75
    });
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.0, 0.25, 48), podiumMat);
    podium.position.y = -0.12;
    podium.receiveShadow = true;
    group.add(podium);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.8
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.45, 4.65, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f131a,
      roughness: 0.35,
      metalness: 0.4
    });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.1, 36), floorMat);
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    group.add(floor);

    const archMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 1.4
    });
    for (let a = 0; a < 3; a++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.18, 0.35), archMat);
      bar.position.set(0, 4.8, (a - 1) * 2.8);
      group.add(bar);
    }

    const spotLight = new THREE.PointLight(0xe0f2fe, 35, 22);
    spotLight.position.set(0, 5.5, 0);
    group.add(spotLight);

    this.worldGroup.add(group);
  }
}
