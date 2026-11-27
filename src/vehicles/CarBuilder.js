import * as THREE from 'three';
import { WHEEL_STYLES, SUSPENSION_STANCES } from './CarCatalog.js';

export class CarBuilder {
  /**
   * Builds a detailed, multi-part 3D real-world car model with clearcoat physical paint,
   * body-style-specific sculpted silhouettes (Supercar Wedge, Porsche Fastback, Long-Hood GT,
   * Muscle Fastback, Sports Sedan, JDM Coupé, Teardrop Hypercar), signature manufacturer grilles,
   * side mirrors, interior bucket seats, dashboard, digital gauge cluster, rotating steering wheel,
   * customizable wheel rims, brake discs/calipers, spoilers, and suspension stance drop.
   */
  static buildRaceCar(carDef, paintHex = null, isPlayer = true, customization = null) {
    const root = new THREE.Group();
    const chassisTilt = new THREE.Group();
    root.add(chassisTilt);

    const colorHex = paintHex || carDef.defaultColor || '#0ea5e9';
    const dim = carDef.dimensions || { width: 1.96, height: 1.24, length: 4.55, spoilerType: 'sport' };
    const bodyStyle = carDef.bodyStyle || 'coupe_gt';
    const grilleStyle = carDef.grilleStyle || 'jdm_mesh';

    const spoilerStyle = customization?.spoilerStyle || dim.spoilerType || 'sport';
    const wheelStyleId = customization?.wheelStyle || 'twin_five';
    const stanceId = customization?.stance || 'stock';

    const wheelCfg = WHEEL_STYLES.find((w) => w.id === wheelStyleId) || WHEEL_STYLES[0];
    const stanceCfg = SUSPENSION_STANCES.find((s) => s.id === stanceId) || SUSPENSION_STANCES[0];

    // Apply suspension stance ride-height drop to sprung chassis
    chassisTilt.position.y = -stanceCfg.dropMeters;

    // 1. Clearcoat Metallic Automotive Paint Material
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorHex),
      metalness: 0.68,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x151821,
      metalness: 0.45,
      roughness: 0.42
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.15
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x09101d,
      metalness: 0.92,
      roughness: 0.08,
      transparent: true,
      opacity: 0.84
    });

    const isMidEngine = bodyStyle === 'mid_supercar' || bodyStyle === 'lambo_wedge' || bodyStyle === 'hyper_teardrop';
    const isMuscle = bodyStyle === 'muscle_boxy' || bodyStyle === 'muscle_fastback';
    const isSedan = bodyStyle === 'sedan_sport';

    // 2. Sculpted Multi-Section Body Tub, Hood, Fenders & Side Intakes
    const mainChassisH = isMidEngine ? 0.44 : isMuscle ? 0.56 : 0.50;
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(dim.width * 0.96, mainChassisH, dim.length * 0.88),
      bodyMat
    );
    lowerBody.position.set(0, 0.30 + mainChassisH * 0.5, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    chassisTilt.add(lowerBody);

    // Sculpted Front Nose & Sloped Hood
    const noseLen = bodyStyle === 'long_hood_gt' ? dim.length * 0.32 : dim.length * 0.24;
    const noseH = isMidEngine ? 0.30 : isMuscle ? 0.48 : 0.38;
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(dim.width * 0.92, noseH, noseLen),
      bodyMat
    );
    nose.position.set(0, 0.28 + noseH * 0.5, dim.length * 0.48 - noseLen * 0.45);
    nose.rotation.x = isMidEngine ? 0.19 : isMuscle ? 0.05 : 0.12;
    nose.castShadow = true;
    chassisTilt.add(nose);

    // Hood Power Dome / Air Scoop (for Muscle, AMG, GT3 RS)
    const hoodScoop = new THREE.Mesh(
      new THREE.BoxGeometry(dim.width * 0.42, 0.08, dim.length * 0.26),
      isMuscle ? carbonMat : bodyMat
    );
    hoodScoop.position.set(0, 0.30 + mainChassisH + 0.02, dim.length * 0.22);
    hoodScoop.rotation.x = 0.06;
    chassisTilt.add(hoodScoop);

    // Sculpted Muscular Front & Rear Fender Wheel Arches
    const archW = dim.width * 1.04;
    const archH = mainChassisH * 0.82;
    const frontArch = new THREE.Mesh(new THREE.BoxGeometry(archW, archH, 0.98), bodyMat);
    frontArch.position.set(0, 0.32 + archH * 0.5, dim.length * 0.30);
    frontArch.castShadow = true;
    chassisTilt.add(frontArch);

    const rearArch = new THREE.Mesh(new THREE.BoxGeometry(archW * 1.02, archH * 1.05, 1.04), bodyMat);
    rearArch.position.set(0, 0.33 + archH * 0.5, -dim.length * 0.30);
    rearArch.castShadow = true;
    chassisTilt.add(rearArch);

    // Mid-Engine Side Air Intakes / Audi R8 Sideblades
    if (isMidEngine || bodyStyle === 'porsche_911') {
      const intakeGeo = new THREE.BoxGeometry(dim.width * 1.05, 0.28, 0.65);
      const sideIntakes = new THREE.Mesh(intakeGeo, carbonMat);
      sideIntakes.position.set(0, 0.55, -0.35);
      chassisTilt.add(sideIntakes);
    }

    // Carbon Front Aero Splitter, Side Skirts & Rear Finned Diffuser
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(dim.width * 1.02, 0.07, dim.length * 1.02),
      carbonMat
    );
    splitter.position.set(0, 0.26, 0);
    chassisTilt.add(splitter);

    for (let fin = -2; fin <= 2; fin++) {
      const diffuserFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.35), carbonMat);
      diffuserFin.position.set(fin * 0.24, 0.28, -dim.length * 0.49);
      chassisTilt.add(diffuserFin);
    }

    // 3. Manufacturer-Signature Front Grille Fascia
    const frontZ = dim.length * 0.502;
    if (grilleStyle === 'bmw_kidney') {
      // Iconic Twin Kidney Grille
      for (const side of [-1, 1]) {
        const kidneyRim = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.28, 0.05), chromeMat);
        kidneyRim.position.set(side * 0.19, 0.50, frontZ);
        chassisTilt.add(kidneyRim);
        const kidneyCore = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.23, 0.06), carbonMat);
        kidneyCore.position.set(side * 0.19, 0.50, frontZ + 0.005);
        chassisTilt.add(kidneyCore);
      }
    } else if (grilleStyle === 'audi_singleframe') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.30, 0.05), chromeMat);
      frame.position.set(0, 0.48, frontZ);
      chassisTilt.add(frame);
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.25, 0.06), carbonMat);
      core.position.set(0, 0.48, frontZ + 0.005);
      chassisTilt.add(core);
    } else if (grilleStyle === 'amg_panamericana') {
      const amgGrille = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.05), carbonMat);
      amgGrille.position.set(0, 0.46, frontZ);
      chassisTilt.add(amgGrille);
      for (let s = -3; s <= 3; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.21, 0.06), chromeMat);
        slat.position.set(s * 0.12, 0.46, frontZ + 0.005);
        chassisTilt.add(slat);
      }
    } else {
      // Wide Performance Aero Intake Mesh
      const aeroGrille = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.68, 0.20, 0.06), carbonMat);
      aeroGrille.position.set(0, 0.42, frontZ);
      chassisTilt.add(aeroGrille);
    }

    // 4. Aerodynamic Cabin Greenhouse, Raked Windshield, Rear Fastback & Side Mirrors
    const cabinW = dim.width * (isMidEngine ? 0.76 : 0.81);
    const cabinH = isMidEngine ? 0.40 : isSedan ? 0.49 : 0.44;
    const cabinLen = isSedan ? dim.length * 0.54 : isMidEngine ? dim.length * 0.44 : dim.length * 0.48;
    const cabinZ = isMidEngine ? 0.05 : bodyStyle === 'long_hood_gt' ? -0.32 : -0.14;

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(cabinW, cabinH, cabinLen),
      glassMat
    );
    cabin.position.set(0, 0.30 + mainChassisH + cabinH * 0.46, cabinZ);
    cabin.castShadow = true;
    chassisTilt.add(cabin);

    // Painted Roof Panel & Rear Fastback Engine Deck
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(cabinW * 0.94, 0.06, cabinLen * 0.72),
      bodyMat
    );
    roof.position.set(0, 0.30 + mainChassisH + cabinH * 0.94, cabinZ - 0.05);
    chassisTilt.add(roof);

    if (isMidEngine) {
      // Louvered Mid-Engine V10/V12 Rear Deck Spine
      const engineCover = new THREE.Mesh(
        new THREE.BoxGeometry(cabinW * 0.68, 0.16, dim.length * 0.28),
        carbonMat
      );
      engineCover.position.set(0, 0.30 + mainChassisH + 0.12, -dim.length * 0.28);
      engineCover.rotation.x = -0.16;
      chassisTilt.add(engineCover);
    }

    // Left & Right Sculpted Side Wing Mirrors on Stalks
    for (const side of [-1, 1]) {
      const mirrorGroup = new THREE.Group();
      mirrorGroup.position.set(side * (dim.width * 0.48), 0.30 + mainChassisH + 0.16, cabinZ + cabinLen * 0.32);

      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.05), carbonMat);
      mirrorGroup.add(stalk);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.12), bodyMat);
      cap.position.set(side * 0.08, 0.04, -0.02);
      mirrorGroup.add(cap);

      const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.02), chromeMat);
      mirrorGlass.position.set(side * 0.08, 0.04, -0.082);
      mirrorGroup.add(mirrorGlass);

      chassisTilt.add(mirrorGroup);
    }

    // 5. Detailed Interior Cockpit (Bucket Seats, Dashboard, Digital Cluster & Animated Steering Wheel)
    let cockpitWheel = null;
    if (isPlayer) {
      // Dual Sport Bucket Seats
      for (const seatX of [-0.34, 0.34]) {
        const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.10), carbonMat);
        seatBack.position.set(seatX, 0.78, -0.22);
        seatBack.rotation.x = -0.15;
        chassisTilt.add(seatBack);
      }

      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(dim.width * 0.74, 0.28, 0.46),
        carbonMat
      );
      dash.position.set(0, 0.86, 0.44);
      chassisTilt.add(dash);

      const clusterMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.6
      });
      const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.04), clusterMat);
      cluster.position.set(0.34, 0.96, 0.36);
      chassisTilt.add(cluster);

      cockpitWheel = new THREE.Group();
      cockpitWheel.position.set(0.34, 0.92, 0.24);
      cockpitWheel.rotation.x = -0.22;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 10, 24), carbonMat);
      cockpitWheel.add(rim);
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.028, 0.02), bodyMat);
      cockpitWheel.add(spoke);
      const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), bodyMat);
      centerCap.rotation.x = Math.PI / 2;
      cockpitWheel.add(centerCap);
      chassisTilt.add(cockpitWheel);
    }

    // 6. Customizable Rear Spoiler Package ('stock' | 'lip' | 'sport' | 'gt_wing')
    const deckY = 0.30 + mainChassisH + 0.04;
    if (spoilerStyle === 'lip') {
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(dim.width * 0.88, 0.07, 0.18),
        carbonMat
      );
      lip.position.set(0, deckY + 0.03, -dim.length * 0.47);
      lip.rotation.x = 0.22;
      chassisTilt.add(lip);
    } else if (spoilerStyle === 'sport' || spoilerStyle === 'gt_wing') {
      const isGT3 = spoilerStyle === 'gt_wing';
      const wingH = isGT3 ? 0.38 : 0.22;
      const strutGeo = new THREE.BoxGeometry(0.05, wingH, 0.24);

      const leftStrut = new THREE.Mesh(strutGeo, carbonMat);
      leftStrut.position.set(-dim.width * 0.32, deckY + wingH * 0.5, -dim.length * 0.44);
      chassisTilt.add(leftStrut);

      const rightStrut = new THREE.Mesh(strutGeo, carbonMat);
      rightStrut.position.set(dim.width * 0.32, deckY + wingH * 0.5, -dim.length * 0.44);
      chassisTilt.add(rightStrut);

      const bladeW = isGT3 ? dim.width * 1.02 : dim.width * 0.92;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(bladeW, 0.05, isGT3 ? 0.36 : 0.28),
        isGT3 ? carbonMat : bodyMat
      );
      blade.position.set(0, deckY + wingH, -dim.length * 0.45);
      blade.rotation.x = -0.14;
      blade.castShadow = true;
      chassisTilt.add(blade);

      if (isGT3) {
        // Swan-neck GT3 RS / Jesko aerodynamic wing endplates
        const endplateGeo = new THREE.BoxGeometry(0.03, 0.22, 0.42);
        for (const side of [-1, 1]) {
          const ep = new THREE.Mesh(endplateGeo, bodyMat);
          ep.position.set(side * (bladeW * 0.5), deckY + wingH - 0.02, -dim.length * 0.45);
          chassisTilt.add(ep);
        }
      }
    }

    // 7. LED Headlights, 3D Beam SpotLight & Taillights
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.0
    });
    const hlGeo = new THREE.BoxGeometry(0.38, 0.11, 0.10);
    const hlLeft = new THREE.Mesh(hlGeo, headlightMat);
    hlLeft.position.set(-dim.width * 0.34, 0.54, dim.length * 0.485);
    chassisTilt.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeo, headlightMat);
    hlRight.position.set(dim.width * 0.34, 0.54, dim.length * 0.485);
    chassisTilt.add(hlRight);

    let headSpotLight = null;
    if (isPlayer) {
      headSpotLight = new THREE.SpotLight(0xfffbeb, 32, 68, Math.PI / 5, 0.45, 1.2);
      headSpotLight.position.set(0, 0.72, dim.length * 0.48);
      headSpotLight.target.position.set(0, 0.2, dim.length * 0.48 + 26);
      chassisTilt.add(headSpotLight);
      chassisTilt.add(headSpotLight.target);
    }

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff1e1e,
      emissive: 0xd90429,
      emissiveIntensity: 1.0
    });

    if (bodyStyle === 'porsche_911' || bodyStyle === 'hyper_teardrop') {
      // Full-width LED lightbar tail light (Porsche 992 / Modern Supercar style)
      const lightbar = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.88, 0.09, 0.08), taillightMat);
      lightbar.position.set(0, 0.62, -dim.length * 0.495);
      chassisTilt.add(lightbar);
    } else {
      const tlGeo = new THREE.BoxGeometry(0.46, 0.13, 0.08);
      const tlLeft = new THREE.Mesh(tlGeo, taillightMat);
      tlLeft.position.set(-dim.width * 0.32, 0.60, -dim.length * 0.495);
      chassisTilt.add(tlLeft);

      const tlRight = new THREE.Mesh(tlGeo, taillightMat);
      tlRight.position.set(dim.width * 0.32, 0.60, -dim.length * 0.495);
      chassisTilt.add(tlRight);
    }

    // Quad Performance Exhaust Tips
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.92, roughness: 0.18 });
    const pipeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.25, 10);
    pipeGeo.rotateX(Math.PI / 2);
    for (const exX of [-0.52, -0.38, 0.38, 0.52]) {
      const pipe = new THREE.Mesh(pipeGeo, exhaustMat);
      pipe.position.set(exX, 0.30, -dim.length * 0.505);
      chassisTilt.add(pipe);
    }

    // 8. 4 Independent Wheel Assemblies with Customizable Rim Designs & Brake Calipers
    const wheelPositions = [
      { x: -dim.width * 0.48, y: 0.36, z: dim.length * 0.30, isFront: true },
      { x: dim.width * 0.48, y: 0.36, z: dim.length * 0.30, isFront: true },
      { x: -dim.width * 0.48, y: 0.36, z: -dim.length * 0.30, isFront: false },
      { x: dim.width * 0.48, y: 0.36, z: -dim.length * 0.30, isFront: false }
    ];

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.86 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(wheelCfg.rimColor || '#e2e8f0'),
      metalness: 0.88,
      roughness: 0.18
    });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.35 });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(carDef.accentColor === '#111827' ? '#ef4444' : (carDef.accentColor || '#ef4444')),
      roughness: 0.3
    });

    const wheels = [];

    for (const wp of wheelPositions) {
      const knuckle = new THREE.Group();
      knuckle.position.set(wp.x, wp.y, wp.z);

      // Ventilated Brake Rotor & Caliper
      const rotorGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.04, 16);
      rotorGeo.rotateZ(Math.PI / 2);
      const rotor = new THREE.Mesh(rotorGeo, rotorMat);
      knuckle.add(rotor);

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.13), caliperMat);
      caliper.position.set(wp.x < 0 ? 0.05 : -0.05, 0.08, -0.09);
      knuckle.add(caliper);

      const spinHub = new THREE.Group();
      knuckle.add(spinHub);

      const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.29, 22);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      spinHub.add(tire);

      const rimBarrelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.295, 16);
      rimBarrelGeo.rotateZ(Math.PI / 2);
      const rimBarrel = new THREE.Mesh(rimBarrelGeo, rimMat);
      spinHub.add(rimBarrel);

      // Build Spokes according to selected Wheel Style
      const spokeCount = wheelStyleId === 'multi_spoke' || wheelStyleId === 'gold_bbs' ? 5 : 3;
      const spokeThickness = wheelStyleId === 'aero_blade' ? 0.11 : 0.042;
      for (let s = 0; s < spokeCount; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.305, 0.45, spokeThickness), rimMat);
        spoke.rotation.x = (s / spokeCount) * Math.PI;
        spinHub.add(spoke);
      }

      root.add(knuckle);
      wheels.push({
        knuckle,
        spinHub,
        baseY: wp.y,
        isFront: wp.isFront
      });
    }

    return {
      root,
      chassisTilt,
      cabin,
      bodyMat,
      taillightMat,
      headlightMat,
      headSpotLight,
      cockpitWheel,
      wheels
    };
  }

  /**
   * Builds 6 varied USA civilian traffic vehicle types:
   * 'sedan', 'suv', 'muscle', 'pickup', 'van', 'semi'
   */
  static buildTrafficVehicle(type = 'sedan', colorHex = '#64748b') {
    const root = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      metalness: 0.48,
      roughness: 0.34
    });
    const secondaryMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.3,
      roughness: 0.5
    });
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.82
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.9 });

    let w = 1.92;
    let len = 4.38;
    let bodyH = 0.56;

    if (type === 'suv') {
      w = 2.02; len = 4.68; bodyH = 0.72;
    } else if (type === 'muscle') {
      w = 1.98; len = 4.48; bodyH = 0.50;
    } else if (type === 'pickup') {
      w = 2.06; len = 5.15; bodyH = 0.68;
    } else if (type === 'van') {
      w = 2.10; len = 5.10; bodyH = 1.52;
    } else if (type === 'semi') {
      w = 2.28; len = 6.60; bodyH = 0.75;
    }

    const lower = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, len), bodyMat);
    lower.position.y = 0.35 + bodyH * 0.5;
    lower.castShadow = true;
    lower.receiveShadow = true;
    root.add(lower);

    if (type === 'sedan' || type === 'suv' || type === 'muscle') {
      const cabinLen = type === 'suv' ? len * 0.60 : len * 0.48;
      const cabinH = type === 'suv' ? 0.56 : type === 'muscle' ? 0.40 : 0.46;
      const cabinZ = type === 'suv' ? -0.28 : -0.15;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, cabinH, cabinLen), glassMat);
      cabin.position.set(0, 0.35 + bodyH + cabinH * 0.5, cabinZ);
      cabin.castShadow = true;
      root.add(cabin);

      if (type === 'muscle') {
        const spoiler = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.08, 0.28), darkTrimMat);
        spoiler.position.set(0, 0.35 + bodyH + 0.16, -len * 0.45);
        root.add(spoiler);
      }
    } else if (type === 'pickup') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.58, len * 0.42), glassMat);
      cab.position.set(0, 0.35 + bodyH + 0.29, len * 0.08);
      cab.castShadow = true;
      root.add(cab);

      const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.12, len * 0.38), darkTrimMat);
      bedFloor.position.set(0, 0.35 + bodyH + 0.04, -len * 0.29);
      root.add(bedFloor);
    } else if (type === 'semi') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.90, 1.15, len * 0.28), bodyMat);
      cab.position.set(0, 0.35 + bodyH + 0.57, len * 0.32);
      cab.castShadow = true;
      root.add(cab);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.52, 0.12), glassMat);
      windshield.position.set(0, 0.35 + bodyH + 0.72, len * 0.46);
      root.add(windshield);

      const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 1.85, len * 0.66), secondaryMat);
      cargoBox.position.set(0, 0.35 + bodyH + 0.92, -len * 0.16);
      cargoBox.castShadow = true;
      root.add(cargoBox);
    }

    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 1.5 });
    const tlMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xd90429, emissiveIntensity: 1.1 });
    const leftSignalMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.1 });
    const rightSignalMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.1 });

    const hl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.14, 0.08), hlMat);
    hl.position.set(0, 0.62, len * 0.5);
    root.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 0.14, 0.08), tlMat);
    tl.position.set(0, 0.65, -len * 0.5);
    root.add(tl);

    const sigGeo = new THREE.BoxGeometry(0.16, 0.14, 0.10);
    const sigRearL = new THREE.Mesh(sigGeo, leftSignalMat);
    sigRearL.position.set(w * 0.42, 0.65, -len * 0.5);
    root.add(sigRearL);

    const sigRearR = new THREE.Mesh(sigGeo, rightSignalMat);
    sigRearR.position.set(-w * 0.42, 0.65, -len * 0.5);
    root.add(sigRearR);

    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheels = [];
    const offsets = [
      [-w * 0.48, 0.35, len * 0.31],
      [w * 0.48, 0.35, len * 0.31],
      [-w * 0.48, 0.35, -len * 0.31],
      [w * 0.48, 0.35, -len * 0.31]
    ];

    for (const [wx, wy, wz] of offsets) {
      const wm = new THREE.Mesh(wheelGeo, tireMat);
      wm.position.set(wx, wy, wz);
      root.add(wm);
      wheels.push(wm);
    }

    return {
      root,
      type,
      bodyMat,
      wheels,
      taillightMat: tlMat,
      leftSignalMat,
      rightSignalMat,
      halfLength: len * 0.5,
      halfWidth: w * 0.5
    };
  }
}
