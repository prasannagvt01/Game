# Ultimate Street Racing 3D — Software & Game Architecture

## 1. Executive Summary
**Ultimate Street Racing 3D** is a modular, WebGL-powered 3D street and circuit racing game built on **Three.js**, **HTML5**, **CSS3**, and **ES6 Modules**. It features custom semi-realistic arcade-sim vehicle dynamics, procedural high-detail urban/highway/bridge/tunnel environments, spline-guided AI traffic & race opponents, a synthesized multi-channel Web Audio sound engine, dynamic day/night and rain weather systems, particle VFX, a full progression economy with a 3D interactive garage, and responsive desktop + touch mobile controls.

---

## 2. Project Directory Structure

```text
Ultimate-Street-Racing-3D/
├── package.json                  # Project metadata, dependencies (three), and scripts
├── server.js                     # High-performance zero-config local HTTP server
├── ARCHITECTURE.md               # Detailed system architecture and technical design
├── index.html                    # Main entry HTML with HUD, menus, garage, and mobile UI
├── css/
│   └── styles.css                # AAA racing UI styling, telemetry dials, glassmorphism, mobile touch layout
└── src/
    ├── main.js                   # Application bootstrapper & lifecycle controller
    ├── core/
    │   ├── GameEngine.js         # Main loop, clock, state machine, renderer, scene orchestration
    │   ├── InputManager.js       # Unified Desktop keyboard + Mobile touch/steering wheel input abstraction
    │   ├── CameraController.js   # Chase, Hood, Cockpit, Orbit Garage cameras with spring smoothing & look-back
    │   └── SaveManager.js        # Persistent economy, unlocked cars, upgrades, best lap/stage records, settings
    ├── vehicles/
    │   ├── CarCatalog.js         # Specs for 5 distinct cars (Apex GT, Vortex R, Titan V8, Specter EV, Hyperion X)
    │   ├── CarBuilder.js         # Procedural 3D multi-material car mesh, cockpit, wheels, calipers, lights, spoiler
    │   └── VehiclePhysics.js     # Weight transfer, speed-sensitive steering, drift slip angle, gearbox, suspension
    ├── world/
    │   ├── TrackSpline.js        # Closed highway/city circuit spline, elevation (bridges/tunnels), width, normals
    │   ├── WorldBuilder.js       # Road mesh, markings, barriers, bridges, tunnel arches, buildings, trees, streetlights, signs
    │   └── EnvironmentManager.js # Dynamic Day/Sunset/Night lighting, sky dome, fog, rain weather & wet road reflections
    ├── ai/
    │   ├── TrafficManager.js     # AI vehicles following lanes, distance keeping, braking/lane reaction, OBB collisions
    └── modes/
    │   └── RaceManager.js        # Free Roam, Circuit Race, Time Trial, Checkpoint Blitz, Traffic Dodger + checkpoints & rewards
    ├── effects/
    │   └── ParticleSystem.js     # Tire smoke, drift skidmarks, collision sparks, nitro exhaust flames, rain splashes
    ├── audio/
    │   └── AudioManager.js       # Procedural Web Audio API engine (RPM harmonic synth, turbo blowoff, skid, crash, city ambience)
    └── ui/
        ├── UIManager.js          # Main Menu, Garage 3D preview & upgrades, Mode selector, Settings, Pause, Results screen
        ├── HUDController.js      # Analog/Digital Speedometer, RPM bar, Gear indicator, Timer, Lap/Distance, Notifications
        └── MinimapRenderer.js    # Real-time 2D HTML5 Canvas GPS minimap with track geometry, checkpoints, player & AI blips
```

---

## 3. Core Subsystems Design

### 3.1 Vehicle Physics & Dynamics (`VehiclePhysics.js`)
- **Longitudinal Forces**: Engine torque curve mapped across a 6-speed automatic/sequential transmission plus Reverse (`R`, `N`, `1`–`6`), aerodynamic drag ($F_{drag} \propto v^2$), rolling resistance, and upgraded braking force.
- **Lateral Dynamics & Drifting**: Speed-dependent steering limit ($\delta_{max}(v)$) prevents twitchy high-speed handling. Handbrake (`Space`) or high lateral slip induces controlled oversteer drift with counter-steering support and lateral velocity decay.
- **Suspension & Weight Transfer**: Pitch and roll angles computed from longitudinal and lateral acceleration ($a_x, a_z$), dynamically tilting the chassis mesh and compressing individual wheel struts.
- **OBB / Sphere-Box Collision Detection**: Guardrail boundary constraint solver along the track spline with elastic restitution, scrape sparks, and vehicle-to-vehicle impulse resolution against AI traffic and racers.

### 3.2 Track & Procedural City Environment (`TrackSpline.js`, `WorldBuilder.js`, `EnvironmentManager.js`)
- **Continuous 3.4 km Highway & City Circuit**: Defined via high-resolution Catmull-Rom 3D curve samples with custom elevation profiles:
  - **Downtown Financial District**: High-rise glass towers with illuminated procedural window grids.
  - **Suspension Bridge Overpass**: Elevated highway deck over a reflective river channel with suspension towers and cables.
  - **Subterranean Tunnel**: Enclosed concrete tunnel bore with ceiling Sodium/LED light strips and warning chevrons.
  - **Parkway & Chicane Sector**: Trees, streetlights, overhead highway gantries, and sharp apex curbs.
- **Optimized Rendering**: Uses shared geometries/materials and `THREE.InstancedMesh` / batched geometry where appropriate to maintain 60 FPS on mid-range hardware.

### 3.3 Game Modes (`RaceManager.js`)
1. **Free Roam**: Unlimited exploration with live traffic, drift scoring, and speed trap bonuses.
2. **Circuit Racing**: 3-lap bumper-to-bumper race against 5 competitive AI racers + payout scale by podium position.
3. **Time Trial**: Pure solo hot-lap challenge against Target Gold/Silver/Bronze times.
4. **Traffic Racing (Highway Dodge)**: High-speed dense multi-lane traffic weaving; earn near-miss combo multipliers against the clock.
5. **Checkpoint Racing**: Point-to-point countdown gate blitz where each checkpoint extends the timer.

### 3.4 Audio & VFX (`AudioManager.js`, `ParticleSystem.js`)
- **Zero-External-Asset Web Audio Engine**: Synthesizes realistic multi-oscillator engine harmonics modulated by live RPM and throttle load, tire screech bandpass-filtered white noise during high slip angles, metallic collision thuds, checkpoint chimes, and ambient city rumble.
- **Real-time Particle Pool**: Object-pooled GPU particle system for tire smoke plumes, collision sparks, and weather rain streaks.
