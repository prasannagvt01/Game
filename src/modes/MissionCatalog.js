import * as THREE from 'three';

export const MISSION_TYPES = {
  checkpoint_mission: { id: 'checkpoint_mission', label: 'Checkpoint Mission', icon: '⚡' },
  time_challenge:     { id: 'time_challenge',     label: 'Time Challenge',     icon: '⏱️' },
  delivery_mission:   { id: 'delivery_mission',   label: 'Delivery Mission',   icon: '📦' },
  drift_mission:      { id: 'drift_mission',      label: 'Drift Mission',      icon: '💨' },
  traffic_avoidance:  { id: 'traffic_avoidance',  label: 'Traffic Avoidance',  icon: '🚘' },
  racing_mission:     { id: 'racing_mission',     label: 'Racing Mission',     icon: '🏁' }
};

export const MISSION_CATALOG = [
  {
    id: 'msn_checkpoint_blitz',
    type: 'checkpoint_mission',
    typeLabel: 'Checkpoint Mission',
    icon: '⚡',
    title: 'Neon Boulevard Gate Blitz',
    difficulty: 'Easy',
    reward: 9500,
    description: 'Race from Downtown across the Golden Bay Bridge and Harbor Port, clearing 8 sequential neon checkpoint gates before the countdown timer runs out.',
    objective: 'Clear 8 Sequential Checkpoint Gates before time expires',
    params: {
      targetGates: 8,
      initialTime: 26.0,
      timeBonusPerGate: 10.5,
      startT: 0.025,
      startLateral: 2.2,
      trafficDensity: 'low'
    }
  },
  {
    id: 'msn_time_challenge',
    type: 'time_challenge',
    typeLabel: 'Time Challenge',
    icon: '⏱️',
    title: 'Golden Bay Express Hot-Lap',
    difficulty: 'Medium',
    reward: 13500,
    description: 'Push your vehicle to the limit on an open, traffic-free circuit sprint. Clear all 10 sequential sector gates and cross the Finish Line in under 85.0 seconds.',
    objective: 'Complete 1 Full Circuit Lap (10/10 Gates) in under 01:25.0',
    params: {
      targetLaps: 1,
      timeLimit: 85.0,
      startT: 0.025,
      startLateral: 0,
      trafficDensity: 'none'
    }
  },
  {
    id: 'msn_delivery_cargo',
    type: 'delivery_mission',
    typeLabel: 'Delivery Mission',
    icon: '📦',
    title: 'VIP Prototype Parts Delivery',
    difficulty: 'Medium',
    reward: 16000,
    description: 'Transport fragile hypercar telemetry hardware from the Downtown Financial District to the Harbor Port Container Terminal. Avoid heavy crashes to keep Cargo Integrity above 50%.',
    objective: 'Deliver cargo across 5 route waypoints to Harbor Port with ≥ 50% Integrity in 70s',
    params: {
      timeLimit: 70.0,
      minIntegrity: 50,
      startT: 0.025,
      startLateral: 2.2,
      // Waypoints along route from Downtown -> Golden Bay Bridge -> Harbor Port Terminal Lot
      deliveryWaypoints: [
        new THREE.Vector3(0, 0, 175),
        new THREE.Vector3(190, 11.5, 420),
        new THREE.Vector3(440, 6.5, 370),
        new THREE.Vector3(550, 0, 195),
        new THREE.Vector3(535, 0, 105) // Final Drop-off Zone inside Harbor Port Lot
      ],
      trafficDensity: 'medium'
    }
  },
  {
    id: 'msn_drift_showdown',
    type: 'drift_mission',
    typeLabel: 'Drift Mission',
    icon: '💨',
    title: 'Harbor & Parkway Drift King',
    difficulty: 'Medium',
    reward: 14500,
    description: 'Shred your rear tires through the Harbor Port S-curves and Sunset Palms Parkway. Use the handbrake (SPACE) and counter-steering to rack up 1,800 Drift Points within 75 seconds.',
    objective: 'Score 1,800 Drift Points within 75 seconds',
    params: {
      targetDriftScore: 1800,
      timeLimit: 75.0,
      startT: 0.43,
      startLateral: 2.2,
      trafficDensity: 'low'
    }
  },
  {
    id: 'msn_traffic_avoidance',
    type: 'traffic_avoidance',
    typeLabel: 'Traffic Avoidance',
    icon: '🚘',
    title: 'Interstate Rush Hour Weave',
    difficulty: 'Hard',
    reward: 19500,
    description: 'Thread the needle through dense 4-lane USA highway traffic at over 95 km/h. Perform 5 high-speed Near-Miss overtakes within 65 seconds with no more than 2 collisions!',
    objective: 'Perform 5 High-Speed Near Misses (Max 2 Collisions allowed) in 65s',
    params: {
      targetNearMisses: 5,
      maxCollisions: 2,
      timeLimit: 65.0,
      startT: 0.025,
      startLateral: 2.2,
      trafficDensity: 'high'
    }
  },
  {
    id: 'msn_street_race_duel',
    type: 'racing_mission',
    typeLabel: 'Racing Mission',
    icon: '🏁',
    title: 'USA Street Syndicate Championship',
    difficulty: 'Hard',
    reward: 24000,
    description: 'Compete against 5 elite AI street racers across a 2-Lap USA City Street Race with live civilian traffic. Finish on the Podium (Top 3 or better) to claim the syndicate prize.',
    objective: 'Finish in Top 3 (3rd Place or better) in a 2-Lap City Street Race',
    params: {
      targetLaps: 2,
      requiredMaxPosition: 3,
      aiDifficulty: 'medium',
      startT: 0.017,
      startLateral: -3.4,
      trafficDensity: 'medium'
    }
  }
];

export function getMissionById(missionId) {
  return MISSION_CATALOG.find((m) => m.id === missionId) || MISSION_CATALOG[0];
}
