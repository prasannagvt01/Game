export const WHEEL_STYLES = [
  { id: 'twin_five',   name: '5-Twin-Spoke Forged',     rimColor: '#e2e8f0' },
  { id: 'multi_spoke', name: '10-Spoke Competition',    rimColor: '#1e293b' },
  { id: 'gold_bbs',    name: 'Motorsport Gold Mesh',    rimColor: '#eab308' },
  { id: 'aero_blade',  name: 'Carbon Aero Track Disc',  rimColor: '#475569' },
  { id: 'bronze_deep', name: 'Concave Bronze Dish',     rimColor: '#b45309' }
];

export const SPOILER_STYLES = [
  { id: 'stock',    name: 'Factory OEM Aero',       downforceBonus: 0.00 },
  { id: 'lip',      name: 'Carbon Ducktail Lip',    downforceBonus: 0.03 },
  { id: 'sport',    name: 'Street Carbon GT Wing',  downforceBonus: 0.06 },
  { id: 'gt_wing',  name: 'Swan-Neck GT3 RS Wing',  downforceBonus: 0.10 }
];

export const SUSPENSION_STANCES = [
  { id: 'stock',   name: 'Factory OEM Height',   dropMeters: 0.00, stiffnessBonus: 0.00 },
  { id: 'sport',   name: 'Sport Lowered (-20mm)', dropMeters: 0.035, stiffnessBonus: 0.08 },
  { id: 'track',   name: 'Track Slam (-35mm)',    dropMeters: 0.065, stiffnessBonus: 0.16 }
];

export const PAINT_SWATCHES = [
  '#0ea5e9', // Yas Marina / Miami Blue
  '#ef4444', // Rosso Corsa / Guards Red
  '#f97316', // Arancio Borealis / Papaya Orange
  '#eab308', // Giallo Modena / Racing Yellow
  '#10b981', // Isle of Man / Verde Mantis Green
  '#a855f7', // Viola Parsifae Purple
  '#3b82f6', // Nogaro / San Marino Blue
  '#f8fafc', // Alpine / Championship White
  '#64748b', // Nardo / Suzuka Grey
  '#111827'  // Obsidian / Phantom Carbon Black
];

/**
 * Complete 20 Real-World Vehicle Catalog with authentic manufacturers, models,
 * engine specifications, drivetrains, transmissions, curb weights, dimensions, and body silhouettes.
 */
export const CAR_CATALOG = [
  {
    id: 'toyota_supra_mk5',
    manufacturer: 'Toyota',
    model: 'GR Supra 3.0 (MK5)',
    name: 'Toyota Supra MK5',
    category: 'JDM Sports Coupé',
    price: 0, // Starter Vehicle
    defaultColor: '#ef4444',
    accentColor: '#1e293b',
    bodyStyle: 'coupe_jdm',
    grilleStyle: 'jdm_mesh',
    specs: {
      engineDescription: '3.0L B58 Twin-Scroll Turbo I6 (382 hp)',
      horsepower: 382,
      zeroToHundredSec: 3.9,
      drivetrain: 'RWD',
      gearboxName: '8-Speed ZF Automatic',
      gearCount: 8,
      gearRatios: [3.40, 2.52, 1.92, 1.52, 1.24, 1.00, 0.84, 0.72],
      topSpeedKmh: 262,
      engineForce: 11400,
      brakeForce: 18800,
      mass: 1540,
      turnRate: 2.46,
      driftGrip: 0.82,
      suspensionStiffness: 1.05,
      launchTraction: 1.02,
      redlineRpm: 7200,
      idleRpm: 850,
      nitroBoost: 1.38
    },
    dimensions: { width: 1.86, height: 1.29, length: 4.38, spoilerType: 'lip' },
    description: 'Short-wheelbase 50:50 weight distribution JDM sports coupé with razor-sharp drift balance and punchy inline-six turbo torque.'
  },
  {
    id: 'ford_mustang_gt',
    manufacturer: 'Ford',
    model: 'Mustang GT 5.0',
    name: 'Ford Mustang GT',
    category: 'American V8 Muscle',
    price: 18000,
    defaultColor: '#2563eb',
    accentColor: '#1e293b',
    bodyStyle: 'muscle_fastback',
    grilleStyle: 'mustang_hex',
    specs: {
      engineDescription: '5.0L Coyote Naturally Aspirated V8 (486 hp)',
      horsepower: 486,
      zeroToHundredSec: 4.1,
      drivetrain: 'RWD',
      gearboxName: '6-Speed MT-82 Manual',
      gearCount: 6,
      gearRatios: [3.24, 2.10, 1.42, 1.00, 0.81, 0.68],
      topSpeedKmh: 268,
      engineForce: 12900,
      brakeForce: 19400,
      mass: 1730,
      turnRate: 2.26,
      driftGrip: 0.80,
      suspensionStiffness: 1.00,
      launchTraction: 1.01,
      redlineRpm: 7500,
      idleRpm: 800,
      nitroBoost: 1.40
    },
    dimensions: { width: 1.92, height: 1.38, length: 4.81, spoilerType: 'sport' },
    description: 'Iconic American fastback powered by a high-revving 5.0L Coyote V8 built for smoky power-oversteer and highway pulls.'
  },
  {
    id: 'bmw_m3_comp',
    manufacturer: 'BMW',
    model: 'M3 Competition (G80)',
    name: 'BMW M3 Competition',
    category: 'Super Sports Sedan',
    price: 26000,
    defaultColor: '#10b981',
    accentColor: '#111827',
    bodyStyle: 'sedan_sport',
    grilleStyle: 'bmw_kidney',
    specs: {
      engineDescription: '3.0L S58 Twin-Turbo Inline-6 (503 hp)',
      horsepower: 503,
      zeroToHundredSec: 3.4,
      drivetrain: 'AWD',
      gearboxName: '8-Speed M Steptronic',
      gearCount: 8,
      gearRatios: [3.45, 2.55, 1.94, 1.54, 1.25, 1.00, 0.84, 0.72],
      topSpeedKmh: 290,
      engineForce: 13800,
      brakeForce: 21200,
      mass: 1780,
      turnRate: 2.54,
      driftGrip: 0.87,
      suspensionStiffness: 1.14,
      launchTraction: 1.12,
      redlineRpm: 7200,
      idleRpm: 850,
      nitroBoost: 1.41
    },
    dimensions: { width: 1.90, height: 1.43, length: 4.79, spoilerType: 'lip' },
    description: 'Bavarian super-sedan combining S58 twin-turbo fury with M xDrive all-wheel-drive traction and track-honed chassis stiffness.'
  },
  {
    id: 'bmw_m4_comp',
    manufacturer: 'BMW',
    model: 'M4 Competition (G82)',
    name: 'BMW M4 Competition',
    category: 'Performance GT Coupé',
    price: 29500,
    defaultColor: '#eab308',
    accentColor: '#111827',
    bodyStyle: 'coupe_gt',
    grilleStyle: 'bmw_kidney',
    specs: {
      engineDescription: '3.0L S58 Twin-Turbo Inline-6 (503 hp)',
      horsepower: 503,
      zeroToHundredSec: 3.4,
      drivetrain: 'RWD',
      gearboxName: '8-Speed M Steptronic',
      gearCount: 8,
      gearRatios: [3.45, 2.55, 1.94, 1.54, 1.25, 1.00, 0.84, 0.72],
      topSpeedKmh: 292,
      engineForce: 13900,
      brakeForce: 21500,
      mass: 1725,
      turnRate: 2.60,
      driftGrip: 0.85,
      suspensionStiffness: 1.16,
      launchTraction: 1.08,
      redlineRpm: 7200,
      idleRpm: 850,
      nitroBoost: 1.42
    },
    dimensions: { width: 1.89, height: 1.39, length: 4.79, spoilerType: 'sport' },
    description: 'Wide-track carbon-roof M coupé delivering sharper turn-in, lighter curb weight, and controllable rear-drive precision.'
  },
  {
    id: 'mercedes_amg_c63',
    manufacturer: 'Mercedes-Benz',
    model: 'AMG C63 S Coupé',
    name: 'Mercedes-Benz AMG C63',
    category: 'Biturbo V8 Coupé',
    price: 31000,
    defaultColor: '#64748b',
    accentColor: '#111827',
    bodyStyle: 'coupe_gt',
    grilleStyle: 'amg_panamericana',
    specs: {
      engineDescription: '4.0L M177 Handcrafted Biturbo V8 (503 hp)',
      horsepower: 503,
      zeroToHundredSec: 3.7,
      drivetrain: 'RWD',
      gearboxName: '9-Speed AMG Speedshift MCT',
      gearCount: 9,
      gearRatios: [3.55, 2.68, 2.08, 1.66, 1.34, 1.08, 0.92, 0.79, 0.69],
      topSpeedKmh: 290,
      engineForce: 14200,
      brakeForce: 21000,
      mass: 1755,
      turnRate: 2.48,
      driftGrip: 0.83,
      suspensionStiffness: 1.12,
      launchTraction: 1.05,
      redlineRpm: 7000,
      idleRpm: 800,
      nitroBoost: 1.42
    },
    dimensions: { width: 1.88, height: 1.40, length: 4.75, spoilerType: 'lip' },
    description: 'Affalterbach thunder-coupé packing a handcrafted 4.0L hot-vee biturbo V8 with effortless low-RPM torque.'
  },
  {
    id: 'dodge_challenger_hellcat',
    manufacturer: 'Dodge',
    model: 'Challenger SRT Hellcat',
    name: 'Dodge Challenger Hellcat',
    category: 'Supercharged Muscle',
    price: 35000,
    defaultColor: '#dc2626',
    accentColor: '#111827',
    bodyStyle: 'muscle_boxy',
    grilleStyle: 'hellcat_split',
    specs: {
      engineDescription: '6.2L Supercharged HEMI V8 (717 hp)',
      horsepower: 717,
      zeroToHundredSec: 3.6,
      drivetrain: 'RWD',
      gearboxName: '8-Speed TorqueFlite Auto',
      gearCount: 8,
      gearRatios: [3.40, 2.50, 1.90, 1.50, 1.22, 1.00, 0.84, 0.70],
      topSpeedKmh: 320,
      engineForce: 16900,
      brakeForce: 20500,
      mass: 2018,
      turnRate: 2.12,
      driftGrip: 0.77,
      suspensionStiffness: 0.96,
      launchTraction: 0.98,
      redlineRpm: 6500,
      idleRpm: 780,
      nitroBoost: 1.46
    },
    dimensions: { width: 1.99, height: 1.45, length: 5.02, spoilerType: 'lip' },
    description: 'Unapologetic 717-horsepower supercharged HEMI brute with massive straight-line top speed and tire-shredding torque.'
  },
  {
    id: 'audi_rs7',
    manufacturer: 'Audi',
    model: 'RS7 Sportback Performance',
    name: 'Audi RS7',
    category: 'Quattro Super GT',
    price: 42000,
    defaultColor: '#334155',
    accentColor: '#0f172a',
    bodyStyle: 'sedan_sport',
    grilleStyle: 'audi_singleframe',
    specs: {
      engineDescription: '4.0L TFSI Twin-Turbo V8 (621 hp)',
      horsepower: 621,
      zeroToHundredSec: 3.3,
      drivetrain: 'AWD',
      gearboxName: '8-Speed Tiptronic Quattro',
      gearCount: 8,
      gearRatios: [3.45, 2.55, 1.94, 1.54, 1.25, 1.00, 0.84, 0.72],
      topSpeedKmh: 305,
      engineForce: 15800,
      brakeForce: 22600,
      mass: 2065,
      turnRate: 2.48,
      driftGrip: 0.90,
      suspensionStiffness: 1.15,
      launchTraction: 1.18,
      redlineRpm: 6800,
      idleRpm: 800,
      nitroBoost: 1.43
    },
    dimensions: { width: 1.95, height: 1.42, length: 5.01, spoilerType: 'lip' },
    description: 'Widebody fastback GT with permanent Quattro all-wheel drive, delivering planted high-speed stability even in pouring rain.'
  },
  {
    id: 'bmw_m5_cs',
    manufacturer: 'BMW',
    model: 'M5 CS (F90)',
    name: 'BMW M5',
    category: 'Executive Super Sedan',
    price: 46000,
    defaultColor: '#065f46',
    accentColor: '#b45309',
    bodyStyle: 'sedan_sport',
    grilleStyle: 'bmw_kidney',
    specs: {
      engineDescription: '4.4L S63 Twin-Turbo V8 (627 hp)',
      horsepower: 627,
      zeroToHundredSec: 2.9,
      drivetrain: 'AWD',
      gearboxName: '8-Speed M Steptronic',
      gearCount: 8,
      gearRatios: [3.48, 2.58, 1.96, 1.55, 1.25, 1.00, 0.84, 0.71],
      topSpeedKmh: 306,
      engineForce: 15900,
      brakeForce: 23000,
      mass: 1825,
      turnRate: 2.58,
      driftGrip: 0.89,
      suspensionStiffness: 1.18,
      launchTraction: 1.20,
      redlineRpm: 7200,
      idleRpm: 820,
      nitroBoost: 1.44
    },
    dimensions: { width: 1.90, height: 1.47, length: 4.98, spoilerType: 'lip' },
    description: 'The lightest and most powerful M5 ever built, pairing a 627-hp twin-turbo V8 with switchable M xDrive launch traction.'
  },
  {
    id: 'chevrolet_corvette_c8',
    manufacturer: 'Chevrolet',
    model: 'Corvette Stingray Z51 (C8)',
    name: 'Chevrolet Corvette C8',
    category: 'Mid-Engine Sports Car',
    price: 49000,
    defaultColor: '#f97316',
    accentColor: '#111827',
    bodyStyle: 'mid_supercar',
    grilleStyle: 'supercar_wedge',
    specs: {
      engineDescription: '6.2L LT2 Mid-Mounted V8 (495 hp)',
      horsepower: 495,
      zeroToHundredSec: 2.9,
      drivetrain: 'RWD',
      gearboxName: '8-Speed Tremec Dual-Clutch',
      gearCount: 8,
      gearRatios: [3.50, 2.56, 1.94, 1.52, 1.23, 1.00, 0.83, 0.70],
      topSpeedKmh: 312,
      engineForce: 14700,
      brakeForce: 22800,
      mass: 1655,
      turnRate: 2.68,
      driftGrip: 0.88,
      suspensionStiffness: 1.20,
      launchTraction: 1.15,
      redlineRpm: 6600,
      idleRpm: 800,
      nitroBoost: 1.44
    },
    dimensions: { width: 1.93, height: 1.23, length: 4.63, spoilerType: 'sport' },
    description: 'Rear-mid-engine American supercar layout providing ferocious rear-axle launch bite and balanced apex rotation.'
  },
  {
    id: 'nissan_gtr_r35',
    manufacturer: 'Nissan',
    model: 'GT-R NISMO (R35)',
    name: 'Nissan GT-R R35',
    category: 'JDM AWD Supercar',
    price: 56000,
    defaultColor: '#f8fafc',
    accentColor: '#ef4444',
    bodyStyle: 'coupe_jdm',
    grilleStyle: 'gtr_vmotion',
    specs: {
      engineDescription: '3.8L VR38DETT Hand-Built Twin-Turbo V6 (600 hp)',
      horsepower: 600,
      zeroToHundredSec: 2.7,
      drivetrain: 'AWD',
      gearboxName: '6-Speed BorgWarner Dual-Clutch',
      gearCount: 6,
      gearRatios: [3.35, 2.28, 1.65, 1.25, 1.00, 0.82],
      topSpeedKmh: 315,
      engineForce: 15800,
      brakeForce: 23800,
      mass: 1720,
      turnRate: 2.66,
      driftGrip: 0.90,
      suspensionStiffness: 1.22,
      launchTraction: 1.24,
      redlineRpm: 7100,
      idleRpm: 900,
      nitroBoost: 1.46
    },
    dimensions: { width: 1.89, height: 1.37, length: 4.71, spoilerType: 'gt_wing' },
    description: 'Godzilla in NISMO carbon trim — ATTESA E-TS all-wheel drive and GT3-spec turbochargers launch off the line like a catapult.'
  },
  {
    id: 'mercedes_amg_gt',
    manufacturer: 'Mercedes-Benz',
    model: 'AMG GT Black Series',
    name: 'Mercedes-Benz AMG GT',
    category: 'Track GT Supercar',
    price: 64000,
    defaultColor: '#f97316',
    accentColor: '#111827',
    bodyStyle: 'long_hood_gt',
    grilleStyle: 'amg_panamericana',
    specs: {
      engineDescription: '4.0L M178 LS2 Flat-Plane Biturbo V8 (720 hp)',
      horsepower: 720,
      zeroToHundredSec: 3.1,
      drivetrain: 'RWD',
      gearboxName: '7-Speed AMG Speedshift DCT',
      gearCount: 7,
      gearRatios: [3.40, 2.38, 1.78, 1.38, 1.12, 0.92, 0.78],
      topSpeedKmh: 325,
      engineForce: 16200,
      brakeForce: 24400,
      mass: 1615,
      turnRate: 2.74,
      driftGrip: 0.89,
      suspensionStiffness: 1.24,
      launchTraction: 1.10,
      redlineRpm: 7200,
      idleRpm: 900,
      nitroBoost: 1.47
    },
    dimensions: { width: 2.01, height: 1.28, length: 4.55, spoilerType: 'gt_wing' },
    description: 'Long-hood transaxle track monster with a 720-hp flat-plane-crank V8 and massive bi-plane carbon rear wing.'
  },
  {
    id: 'porsche_911_gt3rs',
    manufacturer: 'Porsche',
    model: '911 GT3 RS (992)',
    name: 'Porsche 911 GT3 RS',
    category: 'Track Aero Supercar',
    price: 72000,
    defaultColor: '#f8fafc',
    accentColor: '#ef4444',
    bodyStyle: 'porsche_911',
    grilleStyle: 'porsche_aero',
    specs: {
      engineDescription: '4.0L Naturally Aspirated Flat-6 (518 hp @ 9,000 RPM)',
      horsepower: 518,
      zeroToHundredSec: 3.0,
      drivetrain: 'RWD',
      gearboxName: '7-Speed Porsche Doppelkupplung (PDK)',
      gearCount: 7,
      gearRatios: [3.42, 2.40, 1.80, 1.40, 1.14, 0.95, 0.82],
      topSpeedKmh: 298,
      engineForce: 14500,
      brakeForce: 26200,
      mass: 1450,
      turnRate: 2.98,
      driftGrip: 0.94,
      suspensionStiffness: 1.34,
      launchTraction: 1.16,
      redlineRpm: 9000,
      idleRpm: 1050,
      nitroBoost: 1.44
    },
    dimensions: { width: 1.98, height: 1.32, length: 4.57, spoilerType: 'gt_wing' },
    description: 'Screaming 9,000-RPM naturally aspirated flat-six paired with DRS swan-neck aerodynamics for the highest cornering G-force in its class.'
  },
  {
    id: 'porsche_911_turbos',
    manufacturer: 'Porsche',
    model: '911 Turbo S (992)',
    name: 'Porsche 911 Turbo S',
    category: 'AWD Everyday Supercar',
    price: 76000,
    defaultColor: '#64748b',
    accentColor: '#eab308',
    bodyStyle: 'porsche_911',
    grilleStyle: 'porsche_aero',
    specs: {
      engineDescription: '3.7L Twin-Turbo VTG Flat-6 (640 hp)',
      horsepower: 640,
      zeroToHundredSec: 2.6,
      drivetrain: 'AWD',
      gearboxName: '8-Speed Porsche PDK',
      gearCount: 8,
      gearRatios: [3.55, 2.60, 1.96, 1.54, 1.24, 1.00, 0.84, 0.71],
      topSpeedKmh: 330,
      engineForce: 16600,
      brakeForce: 25600,
      mass: 1640,
      turnRate: 2.82,
      driftGrip: 0.93,
      suspensionStiffness: 1.26,
      launchTraction: 1.28,
      redlineRpm: 7200,
      idleRpm: 900,
      nitroBoost: 1.48
    },
    dimensions: { width: 1.90, height: 1.30, length: 4.53, spoilerType: 'sport' },
    description: 'The benchmark all-weather supercar: variable-turbine-geometry twin-turbos and Porsche Traction Management deliver 2.6-second launches.'
  },
  {
    id: 'audi_r8_v10',
    manufacturer: 'Audi',
    model: 'R8 V10 Performance Quattro',
    name: 'Audi R8',
    category: 'Mid-Engine V10 Supercar',
    price: 79000,
    defaultColor: '#0ea5e9',
    accentColor: '#1e293b',
    bodyStyle: 'mid_supercar',
    grilleStyle: 'audi_singleframe',
    specs: {
      engineDescription: '5.2L Naturally Aspirated FSI V10 (612 hp @ 8,700 RPM)',
      horsepower: 612,
      zeroToHundredSec: 3.1,
      drivetrain: 'AWD',
      gearboxName: '7-Speed S Tronic Dual-Clutch',
      gearCount: 7,
      gearRatios: [3.40, 2.38, 1.78, 1.38, 1.12, 0.92, 0.78],
      topSpeedKmh: 331,
      engineForce: 16000,
      brakeForce: 24800,
      mass: 1595,
      turnRate: 2.78,
      driftGrip: 0.92,
      suspensionStiffness: 1.24,
      launchTraction: 1.22,
      redlineRpm: 8700,
      idleRpm: 1000,
      nitroBoost: 1.47
    },
    dimensions: { width: 1.94, height: 1.24, length: 4.43, spoilerType: 'sport' },
    description: 'Mid-mounted 5.2-liter naturally aspirated V10 masterpiece with signature carbon sideblades and unshakeable Quattro grip.'
  },
  {
    id: 'ferrari_488_gtb',
    manufacturer: 'Ferrari',
    model: '488 GTB',
    name: 'Ferrari 488 GTB',
    category: 'Italian Mid-Engine Supercar',
    price: 84000,
    defaultColor: '#ef4444',
    accentColor: '#eab308',
    bodyStyle: 'mid_supercar',
    grilleStyle: 'supercar_wedge',
    specs: {
      engineDescription: '3.9L F154 Twin-Turbo Flat-Plane V8 (661 hp)',
      horsepower: 661,
      zeroToHundredSec: 3.0,
      drivetrain: 'RWD',
      gearboxName: '7-Speed F1 Dual-Clutch',
      gearCount: 7,
      gearRatios: [3.42, 2.40, 1.80, 1.40, 1.13, 0.93, 0.79],
      topSpeedKmh: 330,
      engineForce: 16300,
      brakeForce: 25200,
      mass: 1475,
      turnRate: 2.84,
      driftGrip: 0.90,
      suspensionStiffness: 1.26,
      launchTraction: 1.14,
      redlineRpm: 8000,
      idleRpm: 980,
      nitroBoost: 1.48
    },
    dimensions: { width: 1.95, height: 1.21, length: 4.57, spoilerType: 'lip' },
    description: 'Maranello mid-engine berlinetta sculpted with blown rear spoiler aerodynamics and Side Slip Angle Control.'
  },
  {
    id: 'lamborghini_huracan',
    manufacturer: 'Lamborghini',
    model: 'Huracán EVO',
    name: 'Lamborghini Huracán',
    category: 'Mid-Engine V10 Supercar',
    price: 88000,
    defaultColor: '#10b981',
    accentColor: '#111827',
    bodyStyle: 'lambo_wedge',
    grilleStyle: 'supercar_wedge',
    specs: {
      engineDescription: '5.2L Naturally Aspirated V10 (631 hp @ 8,500 RPM)',
      horsepower: 631,
      zeroToHundredSec: 2.9,
      drivetrain: 'AWD',
      gearboxName: '7-Speed LDF Dual-Clutch',
      gearCount: 7,
      gearRatios: [3.44, 2.42, 1.81, 1.40, 1.13, 0.93, 0.79],
      topSpeedKmh: 326,
      engineForce: 16100,
      brakeForce: 25500,
      mass: 1422,
      turnRate: 2.88,
      driftGrip: 0.92,
      suspensionStiffness: 1.28,
      launchTraction: 1.24,
      redlineRpm: 8500,
      idleRpm: 1050,
      nitroBoost: 1.48
    },
    dimensions: { width: 1.93, height: 1.16, length: 4.52, spoilerType: 'sport' },
    description: 'Hexagonal Sant’Agata wedge powered by a howling 8,500-RPM V10 with rear-wheel steering and torque-vectoring AWD.'
  },
  {
    id: 'mclaren_720s',
    manufacturer: 'McLaren',
    model: '720S Coupé',
    name: 'McLaren 720S',
    category: 'Carbon Monocoque Supercar',
    price: 94000,
    defaultColor: '#f97316',
    accentColor: '#111827',
    bodyStyle: 'mid_supercar',
    grilleStyle: 'supercar_wedge',
    specs: {
      engineDescription: '4.0L M840T Twin-Turbo V8 (710 hp)',
      horsepower: 710,
      zeroToHundredSec: 2.8,
      drivetrain: 'RWD',
      gearboxName: '7-Speed SSG Seamless Shift',
      gearCount: 7,
      gearRatios: [3.42, 2.38, 1.78, 1.37, 1.11, 0.91, 0.77],
      topSpeedKmh: 341,
      engineForce: 16700,
      brakeForce: 26000,
      mass: 1419,
      turnRate: 2.90,
      driftGrip: 0.91,
      suspensionStiffness: 1.30,
      launchTraction: 1.15,
      redlineRpm: 8200,
      idleRpm: 1000,
      nitroBoost: 1.50
    },
    dimensions: { width: 1.93, height: 1.19, length: 4.54, spoilerType: 'sport' },
    description: 'Featherweight 1,419-kg Monocage II carbon chassis with Proactive Chassis Control II and relentless mid-range acceleration.'
  },
  {
    id: 'lamborghini_aventador',
    manufacturer: 'Lamborghini',
    model: 'Aventador SVJ',
    name: 'Lamborghini Aventador',
    category: 'Flagship V12 Supercar',
    price: 108000,
    defaultColor: '#a855f7',
    accentColor: '#eab308',
    bodyStyle: 'lambo_wedge',
    grilleStyle: 'supercar_wedge',
    specs: {
      engineDescription: '6.5L Naturally Aspirated L539 V12 (759 hp @ 8,700 RPM)',
      horsepower: 759,
      zeroToHundredSec: 2.8,
      drivetrain: 'AWD',
      gearboxName: '7-Speed ISR Automated Manual',
      gearCount: 7,
      gearRatios: [3.45, 2.42, 1.80, 1.38, 1.11, 0.91, 0.76],
      topSpeedKmh: 352,
      engineForce: 17300,
      brakeForce: 26200,
      mass: 1525,
      turnRate: 2.84,
      driftGrip: 0.92,
      suspensionStiffness: 1.30,
      launchTraction: 1.24,
      redlineRpm: 8700,
      idleRpm: 1100,
      nitroBoost: 1.52
    },
    dimensions: { width: 2.09, height: 1.13, length: 4.94, spoilerType: 'gt_wing' },
    description: 'Stealth-fighter V12 flagship equipped with ALA 2.0 active aerodynamics and brutal single-clutch upshifts.'
  },
  {
    id: 'ferrari_sf90',
    manufacturer: 'Ferrari',
    model: 'SF90 Stradale',
    name: 'Ferrari SF90 Stradale',
    category: 'Hybrid AWD Hypercar',
    price: 122000,
    defaultColor: '#dc2626',
    accentColor: '#111827',
    bodyStyle: 'mid_supercar',
    grilleStyle: 'supercar_wedge',
    specs: {
      engineDescription: '4.0L Twin-Turbo V8 + 3 Electric Motors (986 hp)',
      horsepower: 986,
      zeroToHundredSec: 2.5,
      drivetrain: 'AWD',
      gearboxName: '8-Speed F1 Wet Dual-Clutch',
      gearCount: 8,
      gearRatios: [3.58, 2.62, 1.98, 1.54, 1.24, 1.00, 0.83, 0.70],
      topSpeedKmh: 342,
      engineForce: 18200,
      brakeForce: 26800,
      mass: 1570,
      turnRate: 2.92,
      driftGrip: 0.94,
      suspensionStiffness: 1.32,
      launchTraction: 1.32,
      redlineRpm: 8000,
      idleRpm: 1000,
      nitroBoost: 1.54
    },
    dimensions: { width: 1.97, height: 1.18, length: 4.71, spoilerType: 'lip' },
    description: '986-horsepower tri-motor plug-in hybrid hypercar with RAC-e front-axle torque vectoring and instant 2.5-second 0–100 km/h launches.'
  },
  {
    id: 'koenigsegg_jesko',
    manufacturer: 'Koenigsegg',
    model: 'Jesko Attack',
    name: 'Koenigsegg Jesko',
    category: 'Ultimate Megacar',
    price: 155000,
    defaultColor: '#f8fafc',
    accentColor: '#10b981',
    bodyStyle: 'hyper_teardrop',
    grilleStyle: 'supercar_wedge',
    specs: {
      engineDescription: '5.0L Twin-Turbo Flat-Plane V8 (1,600 hp @ 8,500 RPM)',
      horsepower: 1600,
      zeroToHundredSec: 2.5,
      drivetrain: 'RWD',
      gearboxName: '9-Speed Koenigsegg Light Speed (LST)',
      gearCount: 9,
      gearRatios: [3.65, 2.75, 2.12, 1.68, 1.35, 1.10, 0.92, 0.78, 0.66],
      topSpeedKmh: 385,
      engineForce: 18900,
      brakeForce: 27500,
      mass: 1420,
      turnRate: 2.96,
      driftGrip: 0.93,
      suspensionStiffness: 1.36,
      launchTraction: 1.18,
      redlineRpm: 8500,
      idleRpm: 1150,
      nitroBoost: 1.58
    },
    dimensions: { width: 2.03, height: 1.21, length: 4.61, spoilerType: 'gt_wing' },
    description: 'Ängelholm 1,600-hp megacar featuring the 7-clutch 9-speed Light Speed Transmission, Triplex suspension, and top-mounted boomerang wing.'
  }
];

// Backward-compatible alias map for any legacy save keys
const LEGACY_CAR_ALIASES = {
  apex_gt: 'toyota_supra_mk5',
  vortex_r: 'nissan_gtr_r35',
  titan_v8: 'dodge_challenger_hellcat',
  cobra_rs: 'porsche_911_gt3rs',
  specter_ev: 'ferrari_sf90',
  hyperion_x: 'koenigsegg_jesko'
};

export const UPGRADE_CONFIG = {
  engine: {
    id: 'engine',
    name: 'Engine & ECU Stage',
    icon: '⚙️',
    baseCost: 4200,
    costMultiplier: 1.45,
    maxLevel: 5,
    description: '+5.5% Engine Torque & +3.2% Top Speed per stage'
  },
  turbo: {
    id: 'turbo',
    name: 'Twin-Turbo & Nitro System',
    icon: '🚀',
    baseCost: 4800,
    costMultiplier: 1.48,
    maxLevel: 5,
    description: '+2.0% Top Speed, +7% Nitro Thrust & +14% Boost Recharge'
  },
  brakes: {
    id: 'brakes',
    name: 'Carbon-Ceramic Brakes',
    icon: '🛑',
    baseCost: 3400,
    costMultiplier: 1.40,
    maxLevel: 5,
    description: '+8% Braking Power & Shorter Stopping Distance'
  },
  tires: {
    id: 'tires',
    name: 'Ultra-Grip Slick Tires',
    icon: '🛞',
    baseCost: 3800,
    costMultiplier: 1.42,
    maxLevel: 5,
    description: '+3.5% Lateral Tire Grip & +4.5% Launch Acceleration Traction'
  },
  suspension: {
    id: 'suspension',
    name: 'Active Coilover Suspension',
    icon: '🔩',
    baseCost: 3600,
    costMultiplier: 1.40,
    maxLevel: 5,
    description: '+8% Chassis Roll/Pitch Stability & Faster Corner Transitions'
  },
  handling: {
    id: 'handling',
    name: 'Active Aero & Steering Rack',
    icon: '🏎️',
    baseCost: 4000,
    costMultiplier: 1.44,
    maxLevel: 5,
    description: '+5% Steering Turn-In Rate & High-Speed Downforce'
  }
};

export const DEFAULT_CAR_UPGRADES = {
  engine: 0,
  turbo: 0,
  brakes: 0,
  tires: 0,
  suspension: 0,
  handling: 0
};

export function getCarById(carId) {
  const resolvedId = LEGACY_CAR_ALIASES[carId] || carId;
  return CAR_CATALOG.find((c) => c.id === resolvedId) || CAR_CATALOG[0];
}

export function getManufacturersList() {
  return ['ALL', ...Array.from(new Set(CAR_CATALOG.map((c) => c.manufacturer)))];
}

export function getUpgradeCost(statKey, currentLevel) {
  const cfg = UPGRADE_CONFIG[statKey];
  if (!cfg || currentLevel >= cfg.maxLevel) return null;
  return Math.round(cfg.baseCost * Math.pow(cfg.costMultiplier, currentLevel));
}

export function computeEffectiveSpecs(car, upgrades = DEFAULT_CAR_UPGRADES, customization = null) {
  const engLvl = upgrades.engine || 0;
  const trbLvl = upgrades.turbo || 0;
  const brkLvl = upgrades.brakes || 0;
  const tirLvl = upgrades.tires || 0;
  const susLvl = upgrades.suspension || 0;
  const hndLvl = upgrades.handling || 0;

  // Apply optional custom spoiler downforce & suspension stance bonuses
  const spoilerObj = SPOILER_STYLES.find((s) => s.id === (customization?.spoilerStyle || car.dimensions?.spoilerType)) || SPOILER_STYLES[0];
  const stanceObj = SUSPENSION_STANCES.find((s) => s.id === (customization?.stance || 'stock')) || SUSPENSION_STANCES[0];

  const topSpeedKmh = Math.round(
    car.specs.topSpeedKmh * (1 + engLvl * 0.032 + trbLvl * 0.020 + hndLvl * 0.005)
  );
  const horsepower = Math.round(
    (car.specs.horsepower || 450) * (1 + engLvl * 0.06 + trbLvl * 0.04)
  );
  const launchTraction = (car.specs.launchTraction || 1.0) * (1 + tirLvl * 0.045 + susLvl * 0.015);
  const engineForce = Math.round(
    car.specs.engineForce * (1 + engLvl * 0.055 + trbLvl * 0.030) * (1 + (launchTraction - 1) * 0.45)
  );
  const brakeForce = Math.round(
    car.specs.brakeForce * (1 + brkLvl * 0.08 + tirLvl * 0.025 + susLvl * 0.015)
  );
  const turnRate = Number(
    (car.specs.turnRate * (1 + hndLvl * 0.05 + susLvl * 0.025 + tirLvl * 0.02 + spoilerObj.downforceBonus * 0.5)).toFixed(2)
  );
  const driftGrip = Number(
    Math.min(0.98, car.specs.driftGrip + tirLvl * 0.015 + hndLvl * 0.008 + susLvl * 0.006 + spoilerObj.downforceBonus * 0.15).toFixed(3)
  );
  const suspensionStiffness = Number(
    ((car.specs.suspensionStiffness || 1.0) * (1 + susLvl * 0.085 + hndLvl * 0.02 + stanceObj.stiffnessBonus)).toFixed(2)
  );
  const nitroBoost = Number((car.specs.nitroBoost + trbLvl * 0.07).toFixed(2));
  const nitroRechargeRate = Number((1 + trbLvl * 0.14).toFixed(2));
  const zeroToHundredSec = Number(
    Math.max(1.8, (car.specs.zeroToHundredSec || 3.5) / (1 + engLvl * 0.04 + trbLvl * 0.025 + tirLvl * 0.02)).toFixed(2)
  );

  const gripScore = Math.min(100, Math.round((driftGrip * 65 + suspensionStiffness * 22)));

  const piRating = Math.min(
    999,
    Math.round(
      (topSpeedKmh * 0.82) +
      (engineForce / 100) +
      (brakeForce / 200) +
      (turnRate * 45) +
      (driftGrip * 62) +
      (suspensionStiffness * 26)
    )
  );

  let piClass = 'B';
  if (piRating >= 925) piClass = 'X';
  else if (piRating >= 830) piClass = 'S2';
  else if (piRating >= 740) piClass = 'S1';
  else if (piRating >= 650) piClass = 'A';

  return {
    ...car.specs,
    horsepower,
    zeroToHundredSec,
    topSpeedKmh,
    engineForce,
    brakeForce,
    turnRate,
    driftGrip,
    suspensionStiffness,
    launchTraction,
    nitroBoost,
    nitroRechargeRate,
    gripScore,
    piRating,
    piClass
  };
}

export function previewUpgradeSpecs(car, currentUpgrades, statKey, customization = null) {
  const currentSpecs = computeEffectiveSpecs(car, currentUpgrades, customization);
  if (!statKey || !UPGRADE_CONFIG[statKey]) {
    return { currentSpecs, nextSpecs: currentSpecs, deltas: null };
  }

  const currLvl = currentUpgrades[statKey] || 0;
  if (currLvl >= UPGRADE_CONFIG[statKey].maxLevel) {
    return { currentSpecs, nextSpecs: currentSpecs, deltas: null };
  }

  const nextUpgrades = {
    ...currentUpgrades,
    [statKey]: currLvl + 1
  };
  const nextSpecs = computeEffectiveSpecs(car, nextUpgrades, customization);

  return {
    currentSpecs,
    nextSpecs,
    deltas: {
      topSpeedKmh: nextSpecs.topSpeedKmh - currentSpecs.topSpeedKmh,
      engineForce: nextSpecs.engineForce - currentSpecs.engineForce,
      brakeForce: nextSpecs.brakeForce - currentSpecs.brakeForce,
      turnRate: Number((nextSpecs.turnRate - currentSpecs.turnRate).toFixed(2)),
      gripScore: nextSpecs.gripScore - currentSpecs.gripScore,
      piRating: nextSpecs.piRating - currentSpecs.piRating
    }
  };
}
