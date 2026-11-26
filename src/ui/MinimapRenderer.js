export class MinimapRenderer {
  constructor(canvasId, trackSpline) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.track = trackSpline;

    this.bounds = { minX: -100, maxX: 600, minZ: -450, maxZ: 500 };
    this._computeBounds();
  }

  _computeBounds() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of this.track.samples) {
      if (s.point.x < minX) minX = s.point.x;
      if (s.point.x > maxX) maxX = s.point.x;
      if (s.point.z < minZ) minZ = s.point.z;
      if (s.point.z > maxZ) maxZ = s.point.z;
    }
    const pad = 45;
    this.bounds = {
      minX: minX - pad,
      maxX: maxX + pad,
      minZ: minZ - pad,
      maxZ: maxZ + pad
    };
  }

  _worldToCanvas(x, z, w, h) {
    const spanX = this.bounds.maxX - this.bounds.minX;
    const spanZ = this.bounds.maxZ - this.bounds.minZ;
    const scale = Math.min(w / spanX, h / spanZ) * 0.88;

    const cx = (this.bounds.minX + this.bounds.maxX) * 0.5;
    const cz = (this.bounds.minZ + this.bounds.maxZ) * 0.5;

    return {
      px: w * 0.5 - (x - cx) * scale,
      py: h * 0.5 - (z - cz) * scale
    };
  }

  render(playerVehicle, trafficVehicles = [], nextCheckpointPos = null, policeUnits = []) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle radar grid background
    ctx.fillStyle = 'rgba(10, 15, 28, 0.78)';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Draw connected parking lots on GPS radar
    if (this.track.parkingAreas) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      for (const lot of this.track.parkingAreas) {
        const pMin = this._worldToCanvas(lot.minX, lot.minZ, w, h);
        const pMax = this._worldToCanvas(lot.maxX, lot.maxZ, w, h);
        const rx = Math.min(pMin.px, pMax.px);
        const ry = Math.min(pMin.py, pMax.py);
        const rw = Math.abs(pMax.px - pMin.px);
        const rh = Math.abs(pMax.py - pMin.py);
        ctx.fillRect(rx, ry, rw, rh);
      }
    }

    // Draw connected Downtown cross-streets & grid avenues on GPS radar
    if (this.track.secondaryRoads) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 3;
      for (const r of this.track.secondaryRoads) {
        const cx = (r.minX + r.maxX) * 0.5;
        const cz = (r.minZ + r.maxZ) * 0.5;
        const p1 = r.orientation === 'ew'
          ? this._worldToCanvas(r.minX, cz, w, h)
          : this._worldToCanvas(cx, r.minZ, w, h);
        const p2 = r.orientation === 'ew'
          ? this._worldToCanvas(r.maxX, cz, w, h)
          : this._worldToCanvas(cx, r.maxZ, w, h);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
    }

    // Draw track loop ribbon
    const samples = this.track.samples;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.beginPath();
    for (let i = 0; i < samples.length; i += 2) {
      const pt = this._worldToCanvas(samples[i].point.x, samples[i].point.z, w, h);
      if (i === 0) ctx.moveTo(pt.px, pt.py);
      else ctx.lineTo(pt.px, pt.py);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner track line colored by sector
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    for (let i = 0; i < samples.length; i += 2) {
      const pt = this._worldToCanvas(samples[i].point.x, samples[i].point.z, w, h);
      if (i === 0) ctx.moveTo(pt.px, pt.py);
      else ctx.lineTo(pt.px, pt.py);
    }
    ctx.closePath();
    ctx.stroke();

    // Start/Finish Line Marker
    const startSample = this.track.getSampleAt(0.025);
    const startPt = this._worldToCanvas(startSample.point.x, startSample.point.z, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(startPt.px - 4, startPt.py - 4, 8, 8);

    // Active Checkpoint Beacon
    if (nextCheckpointPos) {
      const cp = this._worldToCanvas(nextCheckpointPos.x, nextCheckpointPos.z, w, h);
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cp.px, cp.py, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // AI Traffic & Rival Racers
    for (const ai of trafficVehicles) {
      const p = this._worldToCanvas(ai.position.x, ai.position.z, w, h);
      ctx.fillStyle = ai.isRacer ? '#f97316' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(p.px, p.py, ai.isRacer ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Police Patrol & Pursuit Interceptor Blips (Flashing Red / Blue)
    const redFlash = Math.floor(Date.now() / 160) % 2 === 0;
    for (const unit of policeUnits) {
      if (!unit.active) continue;
      const p = this._worldToCanvas(unit.position.x, unit.position.z, w, h);
      ctx.fillStyle = redFlash ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(p.px, p.py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Player Directional Arrow Marker
    if (playerVehicle) {
      const pp = this._worldToCanvas(playerVehicle.position.x, playerVehicle.position.z, w, h);
      ctx.save();
      ctx.translate(pp.px, pp.py);
      ctx.rotate(-playerVehicle.heading);

      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5.5, 5.5);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5.5, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
