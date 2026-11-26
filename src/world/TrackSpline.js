import * as THREE from 'three';

export class TrackSpline {
  constructor() {
    this.roadWidth = 18.0; // 4-lane USA boulevard/highway width (9m half-width)
    this.barrierHalfWidth = 10.4; // Guardrail collision boundary from center
    this.sampleCount = 600;
    this.samples = [];
    this.totalLength = 0;

    // Connected USA city secondary roads, 4-way intersections, parking lots & building AABB colliders
    this.intersections = [];
    this.secondaryRoads = [];
    this.parkingAreas = [];
    this.buildingColliders = [];

    this._buildCurve();
    this._buildConnectedCityNetwork();
  }

  _buildCurve() {
    // Closed 3D control points designing a multi-district USA city & highway circuit:
    // 1. Downtown Financial District (Manhattan/Chicago style grid & towers)
    // 2. Golden Bay Suspension Bridge (San Francisco elevated bay crossing)
    // 3. Harbor Port & Industrial District (Oakland/Seattle container docks)
    // 4. Blue Ridge Subterranean Tunnel (Interstate mountain bore)
    // 5. Sunset Palms Parkway (California/Miami palm-lined coastal highway)
    const rawControlPoints = [
      new THREE.Vector3(0, 0, -160),      // 0: South Downtown Boulevard
      new THREE.Vector3(0, 0, 0),         // 1: Start / Finish Line (Heading +Z)
      new THREE.Vector3(0, 0, 190),       // 2: North Downtown Boulevard
      new THREE.Vector3(55, 2.5, 340),    // 3: Golden Bay Bridge Approach Ramp
      new THREE.Vector3(190, 11.5, 420),  // 4: Suspension Bridge West Span
      new THREE.Vector3(360, 12.0, 420),  // 5: Suspension Bridge East Span
      new THREE.Vector3(490, 4.0, 340),   // 6: Bridge Exit Ramp
      new THREE.Vector3(555, 0, 190),     // 7: Harbor Port Boulevard
      new THREE.Vector3(470, 0, 40),      // 8: Harbor Industrial S-Curve
      new THREE.Vector3(540, 0, -105),    // 9: Blue Ridge Tunnel Approach
      new THREE.Vector3(460, 0, -275),    // 10: Deep inside Subterranean Tunnel
      new THREE.Vector3(295, 0, -370),    // 11: Tunnel Exit onto Sunset Palms Parkway
      new THREE.Vector3(135, 0, -340),    // 12: Sunset Palms Parkway Plaza
      new THREE.Vector3(55, 0, -255)      // 13: Final Corner onto Downtown Straight
    ];

    this.curve = new THREE.CatmullRomCurve3(rawControlPoints, true, 'centripetal', 0.5);
    this.totalLength = this.curve.getLength();

    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < this.sampleCount; i++) {
      const t = i / this.sampleCount;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();

      const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
      const right = new THREE.Vector3().crossVectors(flatTangent, up).normalize();
      const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();
      const heading = Math.atan2(flatTangent.x, flatTangent.z);

      let sector = 'city';
      let district = 'Downtown Financial District';
      if (t >= 0.20 && t <= 0.43) {
        sector = 'bridge';
        district = 'Golden Bay Suspension Bridge';
      } else if (t > 0.43 && t < 0.58) {
        sector = 'harbor';
        district = 'Harbor Industrial Port';
      } else if (t >= 0.58 && t <= 0.77) {
        sector = 'tunnel';
        district = 'Blue Ridge Interstate Tunnel';
      } else if (t > 0.77 && t < 0.93) {
        sector = 'highway';
        district = 'Sunset Palms Parkway';
      }

      this.samples.push({
        index: i,
        t,
        point,
        tangent,
        flatTangent,
        right,
        normal,
        heading,
        sector,
        district,
        openLeft: false,
        openRight: false
      });
    }
  }

  _buildConnectedCityNetwork() {
    // 1. Signalized 4-Way USA Intersections along Downtown Main Boulevard (x = 0)
    this.intersections = [
      {
        id: 'broadway_4th',
        name: 'Broadway & 4th Ave',
        center: new THREE.Vector3(0, 0, 55),
        radius: 14.0
      },
      {
        id: 'liberty_1st',
        name: 'Liberty St & 1st Ave',
        center: new THREE.Vector3(0, 0, -75),
        radius: 14.0
      },
      {
        id: 'harbor_gate',
        name: 'Harbor Port Terminal Gate',
        center: new THREE.Vector3(506, 0, 105),
        radius: 15.0
      },
      {
        id: 'sunset_plaza_jct',
        name: 'Sunset Palms Plaza Junction',
        center: new THREE.Vector3(175, 0, -352),
        radius: 15.0
      }
    ];

    // 2. Connected Driveable Cross-Streets & Avenues (Axis-aligned & oriented boxes)
    // Creating a complete driveable Downtown USA City Block Loop + Cross Avenues
    this.secondaryRoads = [
      {
        id: 'east_broadway',
        name: 'East Broadway Ave',
        minX: -125, maxX: 11,
        minZ: 46, maxZ: 64,
        y: 0,
        orientation: 'ew'
      },
      {
        id: 'west_broadway',
        name: 'West Broadway Ave',
        minX: -11, maxX: 118,
        minZ: 46, maxZ: 64,
        y: 0,
        orientation: 'ew'
      },
      {
        id: 'east_liberty',
        name: 'East Liberty St',
        minX: -125, maxX: 11,
        minZ: -84, maxZ: -66,
        y: 0,
        orientation: 'ew'
      },
      {
        id: 'west_liberty',
        name: 'West Liberty St',
        minX: -11, maxX: 118,
        minZ: -84, maxZ: -66,
        y: 0,
        orientation: 'ew'
      },
      {
        id: 'lexington_ave',
        name: 'Lexington Ave (East Grid Parallel)',
        minX: -125, maxX: -107,
        minZ: -84, maxZ: 64,
        y: 0,
        orientation: 'ns'
      },
      {
        id: 'madison_ave',
        name: 'Madison Ave (West Grid Parallel)',
        minX: 100, maxX: 118,
        minZ: -84, maxZ: 64,
        y: 0,
        orientation: 'ns'
      }
    ];

    // 3. Driveable USA Parking Areas connected directly to the streets & highway
    this.parkingAreas = [
      {
        id: 'downtown_west_parking',
        name: 'Downtown Metro Parking Lot',
        district: 'Downtown Financial District',
        minX: 25, maxX: 98,
        minZ: -25, maxZ: 48,
        y: 0
      },
      {
        id: 'downtown_east_parking',
        name: 'Civic Center Plaza Parking',
        district: 'Downtown Financial District',
        minX: -105, maxX: -32,
        minZ: -25, maxZ: 48,
        y: 0
      },
      {
        id: 'harbor_dock_yard',
        name: 'Harbor Port Container Apron & Lot',
        district: 'Harbor Industrial Port',
        minX: 502, maxX: 575,
        minZ: 65, maxZ: 145,
        y: 0
      },
      {
        id: 'sunset_mall_parking',
        name: 'Sunset Palms Shopping Plaza Lot',
        district: 'Sunset Palms Parkway',
        minX: 125, maxX: 225,
        minZ: -420, maxZ: -348,
        y: 0
      }
    ];

    // Mark barrier openings along main spline wherever a secondary road, intersection, or parking lot connects
    for (const s of this.samples) {
      if (s.point.y > 1.2 || s.sector === 'tunnel' || s.sector === 'bridge') continue;

      const leftTest = new THREE.Vector3().copy(s.point).addScaledVector(s.right, -this.barrierHalfWidth - 1.5);
      const rightTest = new THREE.Vector3().copy(s.point).addScaledVector(s.right, this.barrierHalfWidth + 1.5);

      if (this.isPointInSecondaryNetwork(leftTest.x, leftTest.z)) {
        s.openLeft = true;
      }
      if (this.isPointInSecondaryNetwork(rightTest.x, rightTest.z)) {
        s.openRight = true;
      }

      for (const inter of this.intersections) {
        if (s.point.distanceTo(inter.center) <= inter.radius) {
          s.openLeft = true;
          s.openRight = true;
        }
      }
    }
  }

  /**
   * Checks if an (x, z) world coordinate lies within any connected cross-street or parking area
   */
  isPointInSecondaryNetwork(x, z, margin = 0) {
    for (const r of this.secondaryRoads) {
      if (x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin) {
        return true;
      }
    }
    for (const p of this.parkingAreas) {
      if (x >= p.minX - margin && x <= p.maxX + margin && z >= p.minZ - margin && z <= p.maxZ + margin) {
        return true;
      }
    }
    return false;
  }

  /**
   * Registers a solid building AABB collider so vehicles cannot drive through buildings
   */
  addBuildingCollider(cx, cz, halfW, halfD) {
    this.buildingColliders.push({
      minX: cx - halfW,
      maxX: cx + halfW,
      minZ: cz - halfD,
      maxZ: cz + halfD,
      cx,
      cz,
      halfW,
      halfD
    });
  }

  /**
   * Checks if a candidate building footprint overlaps any road, intersection, or parking lot
   */
  isFootprintClearOfRoads(x, z, halfW = 10, halfD = 10) {
    const proj = this.projectWorldPoint(new THREE.Vector3(x, 0, z));
    if (proj.absLateral < this.barrierHalfWidth + Math.max(halfW, halfD) + 3.5) {
      return false;
    }

    const pad = 3.5;
    for (const r of this.secondaryRoads) {
      if (x + halfW + pad >= r.minX && x - halfW - pad <= r.maxX &&
          z + halfD + pad >= r.minZ && z - halfD - pad <= r.maxZ) {
        return false;
      }
    }
    for (const p of this.parkingAreas) {
      if (x + halfW + pad >= p.minX && x - halfW - pad <= p.maxX &&
          z + halfD + pad >= p.minZ && z - halfD - pad <= p.maxZ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Resolves vehicle collisions against city buildings and secondary road outer boundaries
   */
  resolveCityCollisions(position, radius = 1.15) {
    let hit = false;
    let normalX = 0;
    let normalZ = 0;

    // 1. Check solid building colliders
    for (let i = 0; i < this.buildingColliders.length; i++) {
      const b = this.buildingColliders[i];
      if (
        position.x + radius > b.minX &&
        position.x - radius < b.maxX &&
        position.z + radius > b.minZ &&
        position.z - radius < b.maxZ
      ) {
        const overlapLeft = (position.x + radius) - b.minX;
        const overlapRight = b.maxX - (position.x - radius);
        const overlapDown = (position.z + radius) - b.minZ;
        const overlapUp = b.maxZ - (position.z - radius);

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapDown, overlapUp);
        if (minOverlap === overlapLeft) {
          position.x = b.minX - radius - 0.03;
          normalX = -1;
        } else if (minOverlap === overlapRight) {
          position.x = b.maxX + radius + 0.03;
          normalX = 1;
        } else if (minOverlap === overlapDown) {
          position.z = b.minZ - radius - 0.03;
          normalZ = -1;
        } else {
          position.z = b.maxZ + radius + 0.03;
          normalZ = 1;
        }
        hit = true;
      }
    }

    // 2. If driving inside the secondary city network (off the main spline), keep inside outer boundary
    const inSecondary = this.isPointInSecondaryNetwork(position.x, position.z, 0.2);
    if (inSecondary) {
      // Find closest containing road or parking rect and clamp if exiting into non-road space
      return { hit, inSecondary: true, normalX, normalZ };
    }

    return { hit, inSecondary: false, normalX, normalZ };
  }

  /**
   * Interpolates track data at normalized t in [0, 1)
   */
  getSampleAt(t) {
    const normT = ((t % 1) + 1) % 1;
    const exactIdx = normT * this.sampleCount;
    const idx0 = Math.floor(exactIdx) % this.sampleCount;
    const idx1 = (idx0 + 1) % this.sampleCount;
    const alpha = exactIdx - Math.floor(exactIdx);

    const s0 = this.samples[idx0];
    const s1 = this.samples[idx1];

    const point = new THREE.Vector3().lerpVectors(s0.point, s1.point, alpha);
    const tangent = new THREE.Vector3().lerpVectors(s0.tangent, s1.tangent, alpha).normalize();
    const right = new THREE.Vector3().lerpVectors(s0.right, s1.right, alpha).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);

    return {
      t: normT,
      point,
      tangent,
      right,
      heading,
      sector: s0.sector,
      district: s0.district,
      openLeft: s0.openLeft || s1.openLeft,
      openRight: s0.openRight || s1.openRight
    };
  }

  /**
   * Projects a 3D world coordinate onto the closest primary road spline point.
   */
  projectWorldPoint(worldPos, hintT = null) {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hintT !== null && hintT !== undefined) {
      const centerIdx = Math.floor((((hintT % 1) + 1) % 1) * this.sampleCount);
      const searchRadius = 40;
      for (let offset = -searchRadius; offset <= searchRadius; offset++) {
        const idx = (centerIdx + offset + this.sampleCount) % this.sampleCount;
        const s = this.samples[idx];
        const dx = worldPos.x - s.point.x;
        const dz = worldPos.z - s.point.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
        }
      }
      // If vehicle drove far onto a secondary avenue, fall back to full search if distance > 45m
      if (bestDistSq > 45 * 45) {
        for (let i = 0; i < this.sampleCount; i++) {
          const s = this.samples[i];
          const dx = worldPos.x - s.point.x;
          const dz = worldPos.z - s.point.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = i;
          }
        }
      }
    } else {
      for (let i = 0; i < this.sampleCount; i++) {
        const s = this.samples[i];
        const dx = worldPos.x - s.point.x;
        const dz = worldPos.z - s.point.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
    }

    const prevIdx = (bestIdx - 1 + this.sampleCount) % this.sampleCount;
    const nextIdx = (bestIdx + 1) % this.sampleCount;

    const sPrev = this.samples[prevIdx];
    const sNext = this.samples[nextIdx];

    const segVec = new THREE.Vector3().subVectors(sNext.point, sPrev.point);
    const segLenSq = segVec.x * segVec.x + segVec.z * segVec.z;
    const toPoint = new THREE.Vector3().subVectors(worldPos, sPrev.point);
    let u = segLenSq > 0.0001 ? (toPoint.x * segVec.x + toPoint.z * segVec.z) / segLenSq : 0.5;
    u = Math.max(0, Math.min(1, u));

    const refinedT = (((bestIdx - 1 + u * 2) / this.sampleCount) % 1 + 1) % 1;
    const sample = this.getSampleAt(refinedT);

    const relX = worldPos.x - sample.point.x;
    const relZ = worldPos.z - sample.point.z;
    const lateralOffset = relX * sample.right.x + relZ * sample.right.z;

    const onSecondaryNetwork = (sample.point.y < 1.5) && this.isPointInSecondaryNetwork(worldPos.x, worldPos.z);

    return {
      t: sample.t,
      roadPoint: sample.point,
      tangent: sample.tangent,
      right: sample.right,
      heading: sample.heading,
      sector: sample.sector,
      district: sample.district,
      openLeft: sample.openLeft,
      openRight: sample.openRight,
      onSecondaryNetwork,
      lateralOffset,
      absLateral: Math.abs(lateralOffset),
      roadHeight: onSecondaryNetwork ? 0 : sample.point.y
    };
  }
}
