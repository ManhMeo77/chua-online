import * as THREE from 'three';

// Lá rụng trên sân chùa: một InstancedMesh cho tất cả (rẻ), có hoạt ảnh rơi xuống và bay tung khi bị quét.

const MAX = 64;
const COLORS = ['#c98a2a', '#d9a43a', '#b5651d', '#8f5a24', '#c7a046', '#a8472a'];

function leafGeometry() {
  // phiến lá hình giọt nước có gân giữa, nằm phẳng trên mặt đất
  const s = new THREE.Shape();
  s.moveTo(0, -0.13);
  s.quadraticCurveTo(0.09, -0.04, 0, 0.13);
  s.quadraticCurveTo(-0.09, -0.04, 0, -0.13);
  const g = new THREE.ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);
  g.scale(1.5, 1, 1.5); // to hơn lá thật một chút để nhìn rõ từ camera
  return g;
}

export class Leaves {
  constructor(root) {
    this.mesh = new THREE.InstancedMesh(leafGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    root.add(this.mesh);
    /** @type {Map<number, {x:number,z:number,rot:number,slot:number,fall:number,gone:number,vx:number,vz:number,spin:number}>} */
    this.items = new Map();
    this.free = [...Array(MAX).keys()].reverse();
    this.dummy = new THREE.Object3D();
    for (let i = 0; i < MAX; i++) this._hide(i);
    this.mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
  }

  get count() { let n = 0; for (const l of this.items.values()) if (!l.gone) n++; return n; }

  /** Đặt lại toàn bộ lá (khi vào sân) */
  setAll(list) {
    for (const id of [...this.items.keys()]) this._release(id);
    for (const [id, x, z] of list) this._add(id, x, z, false);
  }

  /** Lá mới rụng: rơi từ trên cây xuống */
  add(list) { for (const [id, x, z] of list) this._add(id, x, z, true); }

  /** Lá bị quét: tung lên, xoay rồi biến mất. dir = hướng người quét đang đi */
  sweep(ids, fromX, fromZ) {
    for (const id of ids) {
      const l = this.items.get(id);
      if (!l || l.gone) continue;
      l.gone = 0.001;
      const dx = l.x - fromX, dz = l.z - fromZ, d = Math.hypot(dx, dz) || 1;
      l.vx = (dx / d) * 2.2 + (Math.random() - 0.5);
      l.vz = (dz / d) * 2.2 + (Math.random() - 0.5);
      l.spin = (Math.random() - 0.5) * 16;
    }
  }

  _add(id, x, z, falling) {
    if (this.items.has(id) || !this.free.length) return;
    const slot = this.free.pop();
    this.items.set(id, { x, z, rot: Math.random() * Math.PI * 2, slot, fall: falling ? 1 : 0, gone: 0, vx: 0, vz: 0, spin: 0, seed: Math.random() * 10 });
    this.mesh.setColorAt(slot, new THREE.Color(COLORS[(id * 7) % COLORS.length]));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  _release(id) {
    const l = this.items.get(id);
    if (!l) return;
    this._hide(l.slot);
    this.free.push(l.slot);
    this.items.delete(id);
  }

  _hide(slot) {
    this.dummy.position.set(0, -50, 0);
    this.dummy.scale.setScalar(0.0001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(slot, this.dummy.matrix);
  }

  update(dt, t) {
    const d = this.dummy;
    for (const [id, l] of this.items) {
      let y = 0.015, tilt = 0, s = 1;
      if (l.fall > 0) {
        // rơi chao lượn từ độ cao ~3.5 m trong khoảng 2.5 giây
        l.fall = Math.max(0, l.fall - dt / 2.5);
        y = 0.015 + l.fall * 3.5;
        l.rot += dt * 2;
        tilt = Math.sin(t * 5 + l.seed) * 0.8 * l.fall;
        d.position.set(l.x + Math.sin(t * 2 + l.seed) * 0.4 * l.fall, y, l.z);
      } else if (l.gone > 0) {
        l.gone += dt / 0.7;
        if (l.gone >= 1) { this._release(id); continue; }
        const k = l.gone;
        l.x += l.vx * dt; l.z += l.vz * dt;
        l.vx *= 0.94; l.vz *= 0.94;
        l.rot += l.spin * dt;
        y = 0.015 + Math.sin(k * Math.PI) * 0.7;
        tilt = k * 4;
        s = 1 - k * k;
        d.position.set(l.x, y, l.z);
      } else {
        // khẽ lay trong gió
        tilt = Math.sin(t * 1.3 + l.seed) * 0.06;
        d.position.set(l.x, y, l.z);
      }
      d.rotation.set(tilt, l.rot, 0);
      d.scale.setScalar(s);
      d.updateMatrix();
      this.mesh.setMatrixAt(l.slot, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
