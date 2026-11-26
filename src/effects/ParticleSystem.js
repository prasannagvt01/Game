import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.smokePool = [];
    this.sparkPool = [];

    this._initPools();
  }

  _initPools() {
    // Tire smoke & Nitro puff pool
    const smokeGeo = new THREE.SphereGeometry(0.28, 7, 7);
    for (let i = 0; i < 90; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd1d5db,
        transparent: true,
        opacity: 0
      });
      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.smokePool.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 0.6,
        velocity: new THREE.Vector3(),
        growRate: 2.2
      });
    }

    // Collision & barrier scrape spark pool
    const sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.35);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let i = 0; i < 60; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.sparkPool.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 0.35,
        velocity: new THREE.Vector3()
      });
    }
  }

  emitTireSmoke(worldPos) {
    const p = this.smokePool.find((item) => !item.active);
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.45 + Math.random() * 0.25;
    p.growRate = 2.6;
    p.mesh.material.color.setHex(0xdbe2ec);
    p.mesh.position.copy(worldPos);
    p.mesh.position.x += (Math.random() - 0.5) * 0.25;
    p.mesh.position.z += (Math.random() - 0.5) * 0.25;
    p.mesh.scale.setScalar(0.65);
    p.mesh.material.opacity = 0.42;
    p.mesh.visible = true;

    p.velocity.set(
      (Math.random() - 0.5) * 1.6,
      0.9 + Math.random() * 1.1,
      (Math.random() - 0.5) * 1.6
    );
  }

  emitNitroFlame(worldPos) {
    const p = this.smokePool.find((item) => !item.active);
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.14;
    p.growRate = -1.2;
    p.mesh.material.color.setHex(0x38bdf8);
    p.mesh.position.copy(worldPos);
    p.mesh.scale.setScalar(0.55);
    p.mesh.material.opacity = 0.85;
    p.mesh.visible = true;

    p.velocity.set(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.5
    );
  }

  emitRainSpray(worldPos) {
    const p = this.smokePool.find((item) => !item.active);
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.28 + Math.random() * 0.15;
    p.growRate = 1.85;
    p.mesh.material.color.setHex(0xbfdbfe);
    p.mesh.position.copy(worldPos);
    p.mesh.scale.setScalar(0.45);
    p.mesh.material.opacity = 0.26;
    p.mesh.visible = true;

    p.velocity.set(
      (Math.random() - 0.5) * 1.4,
      0.7 + Math.random() * 0.9,
      (Math.random() - 0.5) * 1.4
    );
  }

  emitSparks(worldPos, count = 12) {
    let spawned = 0;
    for (let i = 0; i < this.sparkPool.length && spawned < count; i++) {
      const s = this.sparkPool[i];
      if (s.active) continue;

      s.active = true;
      s.life = 0;
      s.maxLife = 0.25 + Math.random() * 0.25;
      s.mesh.position.copy(worldPos);
      s.mesh.visible = true;

      s.velocity.set(
        (Math.random() - 0.5) * 14,
        3 + Math.random() * 8,
        (Math.random() - 0.5) * 14
      );
      spawned++;
    }
  }

  update(dt) {
    for (const p of this.smokePool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const ratio = p.life / p.maxLife;
      p.mesh.position.addScaledVector(p.velocity, dt);
      const scale = Math.max(0.1, 0.65 + ratio * p.growRate);
      p.mesh.scale.setScalar(scale);
      p.mesh.material.opacity = (1 - ratio) * (p.growRate < 0 ? 0.85 : 0.42);
    }

    for (const s of this.sparkPool) {
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }

      s.velocity.y -= 24 * dt; // Gravity
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.mesh.lookAt(s.mesh.position.clone().add(s.velocity));
    }
  }
}
