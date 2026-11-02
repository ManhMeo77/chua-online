import * as THREE from 'three';
import { resolveCollision, findPath, clearLine } from './shared/world.js';
import { makeTextSprite } from './monk.js';
import { MOODS } from './shared/petcare.js';

const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// Họa tiết trái tim / chữ "z" vẽ một lần, dùng chung
function iconTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let heartTex, zTex;
const getHeart = () => (heartTex ??= iconTexture((g) => {
  g.fillStyle = '#ff7a8a';
  g.beginPath();
  g.moveTo(32, 54);
  g.bezierCurveTo(4, 34, 10, 8, 32, 22);
  g.bezierCurveTo(54, 8, 60, 34, 32, 54);
  g.fill();
}));
let starTex;
const getStar = () => (starTex ??= iconTexture((g) => {
  g.fillStyle = '#ffd77a';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rr = i % 2 ? 10 : 30;
    g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr);
  }
  g.fill();
}));
const getZ = () => (zTex ??= iconTexture((g) => {
  g.fillStyle = '#f3ecff';
  g.font = '700 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('z', 32, 34);
}));

// Linh thú ghép từ khối cơ bản, đi theo chủ. Mỗi loại có dáng đi riêng:
// mèo đi, chim sẻ nhảy rồi bay lên vai khi chủ chạy, thỏ nhảy, rùa bò chậm, hạc bước dài.

const cache = new Map();
const mat = (color, roughness = 0.75) => {
  const k = color + roughness;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness }));
  return cache.get(k);
};
const DARK = '#2a211b';

function ball(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function cone(r, h, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function stick(r, h, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function eyes(group, y, z, dx, r = 0.022) {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(DARK, 0.3));
    e.position.set(s * dx, y, z);
    group.add(e);
  }
}

/** Mỗi hàm trả về { body, parts, speed, offset } – parts dùng cho hoạt ảnh */
const BUILDERS = {
  meo() {
    const body = new THREE.Group();
    body.add(ball(0.17, '#e3954a', 0, 0.2, 0, 1, 0.85, 1.35));
    body.add(ball(0.1, '#f6e2c4', 0, 0.17, 0.12, 1, 0.8, 0.9));
    const head = new THREE.Group();
    head.position.set(0, 0.36, 0.2);
    head.add(ball(0.14, '#e3954a'), ball(0.07, '#f6e2c4', 0, -0.04, 0.1, 1.2, 0.8, 0.7));
    for (const s of [-1, 1]) { const ear = cone(0.05, 0.1, '#d4823a', s * 0.08, 0.12, -0.01); ear.rotation.z = -s * 0.3; head.add(ear); }
    head.add(ball(0.014, '#e58a92', 0, -0.01, 0.14));
    eyes(head, 0.02, 0.12, 0.055);
    body.add(head);
    const tail = new THREE.Group();
    tail.position.set(0, 0.24, -0.22);
    for (let i = 0; i < 5; i++) tail.add(ball(0.035, '#d4823a', 0, i * 0.05, -i * 0.025));
    tail.rotation.x = -0.4;
    body.add(tail);
    const legs = [[-0.08, 0.12], [0.08, 0.12], [-0.08, -0.12], [0.08, -0.12]].map(([x, z]) => {
      const l = ball(0.045, '#f6e2c4', x, 0.04, z, 1, 1.4, 1);
      body.add(l);
      return l;
    });
    return { body, parts: { head, tail, legs }, speed: 4.6, offset: [-0.75, -0.5] };
  },
  se() {
    const body = new THREE.Group();
    body.add(ball(0.09, '#8a5a36', 0, 0.12, 0, 1, 0.9, 1.25));
    body.add(ball(0.065, '#efe0c8', 0, 0.1, 0.04, 1, 0.9, 1));
    const head = new THREE.Group();
    head.position.set(0, 0.22, 0.07);
    head.add(ball(0.065, '#6e4426'), ball(0.035, '#efe0c8', 0, -0.02, 0.04));
    const beak = cone(0.018, 0.05, '#e0b04a', 0, -0.005, 0.08);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    eyes(head, 0.015, 0.05, 0.035, 0.012);
    body.add(head);
    const wings = [-1, 1].map((s) => {
      const w = new THREE.Group();
      w.position.set(s * 0.08, 0.14, 0);
      w.add(ball(0.06, '#6e4426', s * 0.02, 0, -0.01, 0.35, 0.7, 1.3));
      body.add(w);
      return w;
    });
    const tail = cone(0.04, 0.1, '#6e4426', 0, 0.12, -0.13);
    tail.rotation.x = -Math.PI / 2 - 0.3;
    body.add(tail);
    for (const s of [-1, 1]) body.add(stick(0.008, 0.06, '#c48a3a', s * 0.03, 0.03, 0.01));
    return { body, parts: { head, wings }, speed: 5.5, offset: [0.7, -0.4] };
  },
  tho() {
    const body = new THREE.Group();
    body.add(ball(0.16, '#f7f4ee', 0, 0.17, -0.02, 1, 0.9, 1.2));
    const head = new THREE.Group();
    head.position.set(0, 0.33, 0.14);
    head.add(ball(0.12, '#f7f4ee'));
    const ears = [-1, 1].map((s) => {
      const e = new THREE.Group();
      e.position.set(s * 0.05, 0.1, -0.02);
      e.add(ball(0.035, '#f7f4ee', 0, 0.1, 0, 0.8, 3, 0.6), ball(0.02, '#f2b8be', 0, 0.1, 0.012, 0.6, 2.6, 0.3));
      e.rotation.z = -s * 0.15;
      head.add(e);
      return e;
    });
    head.add(ball(0.014, '#e58a92', 0, -0.02, 0.12));
    eyes(head, 0.02, 0.1, 0.05, 0.018);
    body.add(head);
    body.add(ball(0.05, '#ffffff', 0, 0.18, -0.2));
    for (const s of [-1, 1]) body.add(ball(0.05, '#ece6dc', s * 0.08, 0.05, -0.08, 1, 0.7, 1.6));
    return { body, parts: { head, ears }, speed: 4.4, offset: [-0.7, -0.6] };
  },
  rua() {
    const body = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c99a2e', 0.45));
    shell.scale.set(1, 0.75, 1.15);
    shell.position.y = 0.06;
    shell.castShadow = true;
    body.add(shell);
    // vân mai rùa
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      body.add(ball(0.05, '#a8781e', Math.cos(a) * 0.11, 0.15, Math.sin(a) * 0.13, 1, 0.35, 1));
    }
    body.add(ball(0.06, '#a8781e', 0, 0.2, 0, 1, 0.4, 1));
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), mat('#e4cf8a')); // yếm rùa
    belly.position.y = 0.06;
    belly.scale.z = 1.15;
    body.add(belly);
    const head = new THREE.Group();
    head.position.set(0, 0.1, 0.24);
    head.add(ball(0.065, '#8fa55a', 0, 0, 0, 1, 0.9, 1.2));
    eyes(head, 0.02, 0.06, 0.035, 0.012);
    body.add(head);
    const legs = [[-0.15, 0.13], [0.15, 0.13], [-0.15, -0.13], [0.15, -0.13]].map(([x, z]) => {
      const l = ball(0.05, '#8fa55a', x, 0.04, z, 1, 0.7, 1.2);
      body.add(l);
      return l;
    });
    return { body, parts: { head, legs }, speed: 2.4, offset: [0.75, -0.6] };
  },
  hac() {
    const body = new THREE.Group();
    const torso = new THREE.Group();
    torso.position.y = 0.62;
    torso.add(ball(0.16, '#fbfaf6', 0, 0, 0, 0.9, 0.8, 1.5));
    const tail = ball(0.09, '#2b2b2b', 0, 0.02, -0.22, 1, 0.6, 1.3);
    torso.add(tail);
    const wings = [-1, 1].map((s) => {
      const w = new THREE.Group();
      w.position.set(s * 0.12, 0.04, 0);
      w.add(ball(0.12, '#f1efe8', s * 0.03, 0, -0.04, 0.3, 0.6, 1.4), ball(0.06, '#2b2b2b', s * 0.03, -0.02, -0.2, 0.3, 0.5, 1.2));
      torso.add(w);
      return w;
    });
    // cổ cong + đầu có mào đỏ
    const neck = new THREE.Group();
    neck.position.set(0, 0.06, 0.18);
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.02, -0.02), new THREE.Vector3(0, 0.12, 0.05),
      new THREE.Vector3(0, 0.26, 0.04), new THREE.Vector3(0, 0.38, 0.02),
    ]);
    const neckMesh = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 16, 0.03, 8), mat('#fbfaf6'));
    neckMesh.castShadow = true;
    neck.add(neckMesh);
    const head = new THREE.Group();
    head.position.set(0, 0.38, 0.02);
    head.add(ball(0.05, '#fbfaf6'), ball(0.022, '#d23a26', 0, 0.045, 0));
    const beak = cone(0.014, 0.14, '#4a4a3a', 0, -0.01, 0.1);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    eyes(head, 0.01, 0.035, 0.03, 0.01);
    neck.add(head);
    torso.add(neck);
    body.add(torso);
    const legs = [-1, 1].map((s) => {
      const l = new THREE.Group();
      l.position.set(s * 0.05, 0.55, 0);
      l.add(stick(0.012, 0.55, '#4a4a3a', 0, -0.27, 0));
      l.add(ball(0.018, '#4a4a3a', 0, -0.27, 0, 1, 1.4, 1)); // khớp gối (gập ra sau như chân chim)
      // bàn chân: khớp cổ chân + 3 ngón xòe ra trước + 1 ngón ngắn phía sau, nằm sát đất
      const foot = new THREE.Group();
      foot.position.y = -0.535;
      foot.add(ball(0.016, '#4a4a3a', 0, 0, 0));
      for (const [ang, len] of [[-0.55, 0.09], [0, 0.1], [0.55, 0.09], [Math.PI, 0.05]]) {
        const toe = new THREE.Group();
        toe.rotation.y = ang;
        const bone = stick(0.007, len, '#4a4a3a', 0, -0.006, len / 2);
        bone.rotation.x = Math.PI / 2;
        toe.add(bone, ball(0.008, '#3a3a2e', 0, -0.006, len)); // đầu ngón
        foot.add(toe);
      }
      l.add(foot);
      l.userData.foot = foot;
      body.add(l);
      return l;
    });
    return { body, parts: { torso, neck, wings, legs }, speed: 4.2, offset: [-0.9, -0.7] };
  },
};

export class Pet {
  constructor(kind) {
    this.kind = kind;
    const b = BUILDERS[kind]();
    this.root = new THREE.Group();
    this.root.add(b.body);
    this.body = b.body;
    this.parts = b.parts;
    this.speed = b.speed;
    this.offset = b.offset;
    this.phase = Math.random() * 10;
    this.placed = false;
    this.map = 'san'; // map đang ở – để va chạm đúng bản đồ
    this.mood = null;
    this.action = null; // { type: 'pat' | 'feed', t, dur }
    this.fx = []; // tim bay lên, chữ z… { sprite, t, life, vx, vy }
    this.bubble = null;
    this.bubbleUntil = 0;
    this.moodTimer = 2 + Math.random() * 3;
    this.height = { meo: 0.55, se: 0.35, tho: 0.6, rua: 0.35, hac: 1.15 }[kind];
    this.tier = 0;
    this.acc = null; // khăn, hào quang
    this.still = 0; // chim sẻ: số giây chủ đứng yên
    this.birdMode = 'fly';
  }

  /** Bậc thân thiết: từ Thân thiết đeo khăn đỏ, tới Tri kỷ có thêm hào quang */
  setTier(tier) {
    tier = tier || 0;
    if (tier === this.tier && this.acc) return;
    this.tier = tier;
    if (this.acc) { this.acc.scarf?.removeFromParent(); this.acc.halo?.removeFromParent(); }
    this.acc = {};
    if (tier >= 2) {
      // vị trí cổ của từng loài: [x, y, z, bán kính]
      const [x, y, z, rad] = { meo: [0, 0.29, 0.17, 0.085], se: [0, 0.17, 0.06, 0.05], tho: [0, 0.24, 0.12, 0.08], rua: [0, 0.1, 0.2, 0.055], hac: [0, 0.67, 0.2, 0.04] }[this.kind];
      const scarf = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, rad * 0.38, 8, 20), mat('#c8352a', 0.6));
      ring.rotation.x = Math.PI / 2 - 0.35;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(rad * 0.7, rad * 1.4, rad * 0.25), mat('#a82a20', 0.6));
      tail.position.set(rad * 0.4, -rad * 0.75, rad * 0.75);
      tail.rotation.z = -0.3;
      scarf.add(ring, tail);
      scarf.position.set(x, y, z);
      scarf.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.body.add(scarf);
      this.acc.scarf = scarf;
    }
    if (tier >= 3) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(this.kind === 'hac' ? 0.07 : 0.09, 0.012, 8, 28),
        new THREE.MeshStandardMaterial({ color: '#ffd77a', emissive: '#ffb84a', emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.3 }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = this.height + 0.04;
      this.body.add(halo);
      this.acc.halo = halo;
    }
  }

  /** Đổi tâm trạng; show = hiện bong bóng tên tâm trạng */
  setMood(mood, show = false) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (show && mood) this.say(MOODS[mood].label);
  }

  say(text, ms = 2800) {
    this.clearBubble();
    this.bubble = makeTextSprite(text, { size: 22, bg: 'rgba(255,248,232,0.95)', color: '#2a1d10', maxWidth: 260 });
    this.bubble.center.set(0.5, 0);
    this.bubble.scale.multiplyScalar(0.5); // nhỏ hơn bong bóng của người
    this.bubble.position.y = this.height + 0.15;
    this.root.add(this.bubble);
    this.bubbleUntil = performance.now() + ms;
  }

  clearBubble() {
    if (!this.bubble) return;
    this.root.remove(this.bubble);
    this.bubble.material.map.dispose();
    this.bubble.material.dispose();
    this.bubble = null;
  }

  /** Phản ứng: 'pat' vuốt ve, 'feed' cho ăn, hoặc trò 'chao' / 'xoay' / 'mua' */
  react(type) {
    this.action = { type, t: 0, dur: { feed: 2.6, pat: 1.4, chao: 1.6, xoay: 1.3, mua: 3.2 }[type] ?? 1.4 };
    if (type === 'pat') for (let i = 0; i < 5; i++) this.emit(getHeart(), 0.16, 0.5 + i * 0.12);
    if (type === 'xoay') for (let i = 0; i < 4; i++) this.emit(getStar(), 0.12, 0.8 + i * 0.1);
    if (type === 'mua') for (let i = 0; i < 8; i++) this.emit(i % 2 ? getHeart() : getStar(), 0.13, 0.3 + i * 0.35);
    if (type === 'feed') {
      this.bowl?.removeFromParent();
      this.bowl = new THREE.Group();
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.06, 16), mat('#c9a77a', 0.6));
      bowl.position.y = 0.03;
      const food = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(this.kind === 'tho' ? '#f08a3c' : this.kind === 'rua' ? '#6fa24a' : '#f2ead8', 0.8));
      food.position.y = 0.05;
      food.scale.y = 0.5;
      this.bowl.add(bowl, food);
      this.bowl.position.set(0, 0, this.kind === 'hac' ? 0.4 : 0.3);
      this.bowl.userData.food = food;
      this.root.add(this.bowl);
    }
  }

  emit(tex, size, delay = 0) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.setScalar(size);
    sp.position.set((Math.random() - 0.5) * 0.25, this.height * 0.8, (Math.random() - 0.5) * 0.15);
    sp.visible = delay <= 0;
    this.root.add(sp);
    this.fx.push({ sprite: sp, t: -delay, life: 1.4, vx: (Math.random() - 0.5) * 0.15, vy: 0.45 + Math.random() * 0.2 });
  }

  _tickFx(dt) {
    for (const f of [...this.fx]) {
      f.t += dt;
      if (f.t < 0) continue;
      f.sprite.visible = true;
      f.sprite.position.x += f.vx * dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.material.opacity = 1 - f.t / f.life;
      if (f.t >= f.life) { this.root.remove(f.sprite); f.sprite.material.dispose(); this.fx.splice(this.fx.indexOf(f), 1); }
    }
    if (this.bubble && performance.now() > this.bubbleUntil) this.clearBubble();
    if (this.acc?.halo) { // hào quang xoay chậm, nhấp nhô
      this.acc.halo.rotation.z += dt * 1.2;
      this.acc.halo.position.y = this.height + 0.04 + Math.sin(performance.now() / 600) * 0.015;
    }
  }

  /** Biểu hiện tâm trạng khi đứng yên: ngủ gật, đòi ăn, nhảy vui… */
  _moodIdle(dt) {
    this.moodTimer -= dt;
    if (this.moodTimer > 0) return;
    switch (this.mood) {
      case 'buonngu': this.emit(getZ(), 0.14); this.moodTimer = 1.6; break;
      case 'doi': this.say('Đói bụng…', 2000); this.moodTimer = 9; break;
      case 'buon': this.say('Nhớ chủ…', 2000); this.moodTimer = 14; break;
      case 'vui': this.hop = 0.35; this.moodTimer = 4 + Math.random() * 3; break;
      default: this.moodTimer = 5;
    }
  }

  /**
   * Đi theo chủ kiểu "có quán tính": linh thú có vận tốc, tăng tốc và hãm dần khi tới nơi,
   * nên không còn khựng lại / giật lên như khi bước đều về đích.
   * @param {number} dt
   * @param {THREE.Object3D} owner nhân vật chủ
   * @param {number} ownerMove 0 đứng, 1 đi, 2 chạy
   */
  /** Chuyển sang map khác: đặt lại ngay cạnh chủ */
  setMap(map) { this.map = map; this.placed = false; }

  update(dt, owner, ownerMove) {
    if (this.kind === 'se') return this._updateBird(dt, owner, ownerMove);
    const r = this.root, op = owner.position;
    this.idleT = (this.idleT || 0) + dt;

    // hướng "neo" xoay chậm theo chủ: chủ quay tại chỗ thì linh thú không bị quăng vòng quanh
    this.heading = this.heading === undefined ? owner.rotation.y : lerpAngle(this.heading, owner.rotation.y, 1 - Math.exp(-dt * 2.5));
    const [sx, sz] = this.offset;
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    let tgt = resolveCollision(op.x + sx * c + sz * s, op.z - sx * s + sz * c, 0.2, this.map);
    this.checkT = (this.checkT || 0) - dt; // kiểm tra vật cản ~5 lần/giây cho nhẹ
    if (this.checkT <= 0) {
      this.checkT = 0.2;
      // chỗ đứng cạnh chủ bị vật cản chắn (ví dụ rơi sang bên kia luống hoa) → đứng ngay sau lưng chủ
      this.spotBlocked = !clearLine(this.map, op.x, op.z, tgt.x, tgt.z, 0.2);
    }
    if (this.spotBlocked) {
      const b = resolveCollision(op.x - Math.sin(this.heading) * 0.75, op.z - Math.cos(this.heading) * 0.75, 0.2, this.map);
      tgt = clearLine(this.map, op.x, op.z, b.x, b.z, 0.2) ? b : { x: op.x, z: op.z };
    }

    if (!this.placed) { r.position.set(tgt.x, 0, tgt.z); r.rotation.y = this.heading; this.vel = { x: 0, z: 0 }; this.placed = true; }
    this._tickFx(dt);
    if (this.action) { this.vel.x = this.vel.z = 0; this.gait = 0; this._animateAction(dt); return; } // đang được vuốt ve / làm trò thì đứng yên

    let dx = tgt.x - r.position.x, dz = tgt.z - r.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 8) { r.position.set(tgt.x, 0, tgt.z); this.vel.x = this.vel.z = 0; this.path = null; return; } // chủ vừa dịch chuyển / vào phòng

    // tìm đường: không nhìn thẳng thấy chỗ cần tới (luống hoa, lư hương… chắn giữa) thì đi theo đường vòng
    this.repathT = (this.repathT || 0) - dt;
    if (dist > 0.35 && this.checkT === 0.2) this.lineBlocked = !clearLine(this.map, r.position.x, r.position.z, tgt.x, tgt.z, 0.2);
    if (dist > 0.35 && this.lineBlocked) {
      const moved = this.pathEnd ? Math.hypot(this.pathEnd.x - tgt.x, this.pathEnd.z - tgt.z) : Infinity;
      if (!this.path?.length || this.repathT <= 0 || moved > 1) {
        this.path = findPath(this.map, r.position.x, r.position.z, tgt.x, tgt.z);
        this.pathEnd = { x: tgt.x, z: tgt.z };
        this.repathT = 0.6;
      }
      // bỏ điểm rẽ khi đã tới nơi, hoặc khi đã nhìn thẳng thấy điểm kế tiếp (không cắt góc luống hoa)
      while (this.path.length > 1 && (Math.hypot(this.path[0].x - r.position.x, this.path[0].z - r.position.z) < 0.15 ||
        (this.checkT === 0.2 && clearLine(this.map, r.position.x, r.position.z, this.path[1].x, this.path[1].z, 0.2)))) this.path.shift();
      const wp = this.path[0];
      const wl = Math.hypot(wp.x - r.position.x, wp.z - r.position.z) || 1;
      dx = ((wp.x - r.position.x) / wl) * dist; // hướng theo điểm rẽ, độ dài giữ = khoảng cách thật tới chỗ cần tới
      dz = ((wp.z - r.position.z) / wl) * dist;
    } else this.path = null;

    // vùng chết có trễ: chỉ bắt đầu đi khi lệch > 0.45 m, dừng khi < 0.1 m → không nhích lên nhích xuống
    if (!this.following && dist > 0.45) this.following = true;
    if (this.following && dist < 0.1 && ownerMove === 0) this.following = false;

    const moodSlow = this.mood === 'buon' || this.mood === 'buonngu' ? 0.8 : 1;
    // càng xa càng nhanh (đuổi kịp khi chủ chạy), tới gần thì chậm dần (arrive)
    const vmax = this.speed * moodSlow * (1 + Math.min(1, Math.max(0, (dist - 1) / 2.5)) * 1.4);
    const want = this.following && dist > 1e-4 ? Math.min(vmax, dist * 3 + 0.2) : 0;
    const wx = dist > 1e-4 ? (dx / dist) * want : 0, wz = dist > 1e-4 ? (dz / dist) * want : 0;
    const accel = (want > 0 ? 12 : 14) * dt; // phanh gấp hơn tăng tốc một chút
    const ax = wx - this.vel.x, az = wz - this.vel.z, al = Math.hypot(ax, az);
    const k = al > accel ? accel / al : 1;
    this.vel.x += ax * k; this.vel.z += az * k;
    if (!this.following && Math.hypot(this.vel.x, this.vel.z) < 0.05) this.vel.x = this.vel.z = 0;

    const np = resolveCollision(r.position.x + this.vel.x * dt, r.position.z + this.vel.z * dt, 0.2, this.map);
    const stepped = Math.hypot(np.x - r.position.x, np.z - r.position.z);
    r.position.x = np.x; r.position.z = np.z;
    // lưới cuối cùng: vẫn kẹt quá 2,5 giây mà chủ ở xa thì "nhảy" về cạnh chủ
    this.stuckT = this.following && dist > 1.5 && stepped < this.speed * 0.15 * dt ? (this.stuckT || 0) + dt : 0;
    if (this.stuckT > 2.5) { r.position.set(tgt.x, 0, tgt.z); this.vel.x = this.vel.z = 0; this.stuckT = 0; this.path = null; }

    const spd = Math.hypot(this.vel.x, this.vel.z);
    // gait 0..1: độ "đang đi", tăng giảm mượt để dáng đi không bật tắt
    this.gait = (this.gait || 0) + (Math.min(1, spd / (this.speed * 0.6)) - (this.gait || 0)) * Math.min(1, dt * 8);
    const g = this.gait;

    // quay mặt theo hướng chạy, đứng yên thì quay dần theo hướng chủ; giới hạn tốc độ quay
    const face = spd > 0.25 ? Math.atan2(this.vel.x, this.vel.z) : this.heading;
    const dAng = Math.atan2(Math.sin(face - r.rotation.y), Math.cos(face - r.rotation.y));
    r.rotation.y += Math.sign(dAng) * Math.min(Math.abs(dAng) * Math.min(1, dt * (spd > 0.25 ? 9 : 3)), 7 * dt);

    // nhịp chân tỉ lệ với tốc độ thật
    this.phase += dt * (spd / this.speed) * 13;
    this.animate(dt, g, ownerMove);

    // tâm trạng thể hiện qua dáng
    const idle = 1 - g;
    const sleepy = this.mood === 'buonngu';
    const sad = this.mood === 'buon';
    this.body.scale.y += ((sleepy ? 1 - 0.22 * idle : 1) - this.body.scale.y) * Math.min(1, dt * 3);
    if (this.kind !== 'tho') this.body.rotation.x += ((sad ? 0.12 * idle : 0) - this.body.rotation.x) * Math.min(1, dt * 3); // buồn thì cúi đầu
    if (this.hop > 0) { // nhảy cẫng lên vì vui
      this.hop = Math.max(0, this.hop - dt);
      r.position.y = Math.sin((1 - this.hop / 0.35) * Math.PI) * 0.12;
    } else r.position.y = 0;
    if (g < 0.1) this._moodIdle(dt);
  }

  /**
   * Chim sẻ: bay theo chủ ngang vai; chủ đứng yên hơn 1 giây thì sà xuống đậu trên vai;
   * được cho ăn thì sà xuống đất cạnh chủ. Bay có quán tính 3 chiều, nghiêng người khi lượn.
   */
  _updateBird(dt, owner, ownerMove) {
    const r = this.root, op = owner.position, ory = owner.rotation.y;
    this.heading = this.heading === undefined ? ory : lerpAngle(this.heading, ory, 1 - Math.exp(-dt * 3));
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    const cs = Math.cos(ory), ss = Math.sin(ory);
    // điểm bay dùng hướng neo (mượt); điểm đậu dùng hướng thật của chủ (để đậu đúng vai)
    const flyAt = (lx, y, lz) => ({ x: op.x + lx * c + lz * s, y, z: op.z - lx * s + lz * c });
    const bodyAt = (lx, y, lz) => ({ x: op.x + lx * cs + lz * ss, y, z: op.z - lx * ss + lz * cs });

    const ovx = this.lastOp && dt > 0 ? (op.x - this.lastOp.x) / dt : 0, ovz = this.lastOp && dt > 0 ? (op.z - this.lastOp.z) / dt : 0;
    const moved = Math.hypot(ovx, ovz) * dt;
    this.lastOp = { x: op.x, z: op.z };
    if (ownerMove > 0 || moved > 0.002) this.still = 0; else this.still += dt;

    if (this.action?.type === 'feed') this.birdMode = 'ground';
    else if (!this.action) this.birdMode = this.still > 1.2 ? 'perch' : 'fly';

    this.phase += dt;
    const tgt = this.birdMode === 'perch' ? bodyAt(0.24, 0.6, 0.02) // vai chú tiểu
      : this.birdMode === 'ground' ? bodyAt(0.45, 0, 0.45)
      : flyAt(0.55, 1.25 + Math.sin(this.phase * 2.2) * 0.07, -0.25);

    if (!this.placed) { r.position.set(tgt.x, tgt.y, tgt.z); r.rotation.y = ory; this.vel = { x: 0, y: 0, z: 0 }; this.placed = true; }
    this._tickFx(dt);

    const dx = tgt.x - r.position.x, dy = tgt.y - r.position.y, dz = tgt.z - r.position.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 8) { r.position.set(tgt.x, tgt.y, tgt.z); this.vel = { x: 0, y: 0, z: 0 }; return; }

    const v = this.vel;
    const landing = this.birdMode !== 'fly';
    // bay nhanh, đuổi kịp khi chủ chạy; lúc đáp thì chậm và êm
    const vmax = landing ? 3 : 7 * (1 + Math.min(1, Math.max(0, (dist - 0.8) / 2.5)) * 0.9);
    const want = Math.min(vmax, dist * (landing ? 3.2 : 3.6));
    const inv = dist > 1e-4 ? want / dist : 0;
    const ax = dx * inv - v.x, ay = dy * inv - v.y, az = dz * inv - v.z, al = Math.hypot(ax, ay, az);
    const accel = 20 * dt, k = al > accel ? accel / al : 1;
    v.x += ax * k; v.y += ay * k; v.z += az * k;

    // đậu hẳn: dính theo vai chủ, không trôi
    // gần chạm thì "hút" êm vào chỗ đậu thay vì đặt bụp vào
    const settle = landing && dist < 0.05;
    if (settle) {
      const f = 1 - Math.exp(-dt * 14);
      r.position.x += dx * f; r.position.y += dy * f; r.position.z += dz * f;
      // đang đậu thì "đi cùng" chủ: giữ vận tốc của chủ để lúc cất cánh không bị hụt đà
      v.x += (ovx - v.x) * f; v.y *= 1 - f; v.z += (ovz - v.z) * f;
    } else { r.position.x += v.x * dt; r.position.y = Math.max(0, r.position.y + v.y * dt); r.position.z += v.z * dt; }
    const landed = settle && dist < 0.03;

    const hs = Math.hypot(v.x, v.z), spd = Math.hypot(v.x, v.y, v.z);
    const face = hs > 0.3 ? Math.atan2(v.x, v.z) : landed ? ory : this.heading;
    const dAng = Math.atan2(Math.sin(face - r.rotation.y), Math.cos(face - r.rotation.y));
    const yawRate = Math.sign(dAng) * Math.min(Math.abs(dAng) * Math.min(1, dt * 8), 8 * dt);
    r.rotation.y += yawRate;

    const P = this.parts, b = this.body;
    if (this.bowl) this.bowl.visible = landed; // bát chỉ hiện khi chim đã đáp đất
    // làm trò / được vuốt ve thì diễn tại chỗ; được cho ăn thì sà xuống đất xong mới ăn
    if (this.action && (this.action.type !== 'feed' || landed)) { this._animateAction(dt); return; }

    // độ mở cánh / tần số vỗ cánh chuyển mượt giữa bay và đậu
    const flying = landed ? 0 : 1;
    this.flapAmp = (this.flapAmp ?? 0) + ((flying ? 0.6 + Math.min(1, spd / 6) * 0.5 : 0) - (this.flapAmp ?? 0)) * Math.min(1, dt * 6);
    this.flapPhase = (this.flapPhase || 0) + dt * (18 + spd * 2);
    const open = this.flapAmp > 0.05 ? 0.5 : 0.1;
    const flap = Math.sin(this.flapPhase) * this.flapAmp;
    P.wings[0].rotation.z += (open + flap - P.wings[0].rotation.z) * Math.min(1, dt * 20);
    P.wings[1].rotation.z = -P.wings[0].rotation.z;

    // chúc đầu khi lao tới, ngẩng khi bay lên; nghiêng người theo tốc độ rẽ
    const pitch = flying ? Math.min(1, hs / 6) * 0.35 - Math.max(-0.3, Math.min(0.3, v.y * 0.12)) : 0;
    b.rotation.x += (pitch - b.rotation.x) * Math.min(1, dt * 5);
    const bank = flying ? Math.max(-0.6, Math.min(0.6, -(yawRate / Math.max(dt, 1e-3)) * 0.12)) : 0;
    b.rotation.z += (bank - b.rotation.z) * Math.min(1, dt * 5);

    if (landed) {
      // đậu: ngó nghiêng, ở dưới đất thì mổ thóc
      P.head.rotation.y = Math.sin(this.phase * 0.9) * 0.6;
      P.head.rotation.x = this.birdMode === 'ground' ? Math.max(0, Math.sin(this.phase * 5)) * 0.5 : 0;
      b.scale.y += ((this.mood === 'buonngu' ? 0.8 : 1) - b.scale.y) * Math.min(1, dt * 3);
      if (!this.action) this._moodIdle(dt);
    } else {
      P.head.rotation.y *= 1 - Math.min(1, dt * 6);
      P.head.rotation.x *= 1 - Math.min(1, dt * 6);
      b.scale.y += (1 - b.scale.y) * Math.min(1, dt * 6);
    }
  }

  _animateAction(dt) {
    const a = this.action;
    a.t += dt;
    const p = a.t / a.dur, b = this.body, P = this.parts;
    b.scale.y = 1;
    if (a.type === 'chao') {
      // cúi chào hai lần
      b.rotation.x = Math.max(0, Math.sin(p * 2 * Math.PI)) * (this.kind === 'hac' ? 0.3 : 0.5);
      if (this.kind === 'hac') P.neck.rotation.x = Math.max(0, Math.sin(p * 2 * Math.PI)) * 0.9;
    } else if (a.type === 'xoay') {
      // nhảy lên xoay một vòng
      b.rotation.y = p * Math.PI * 2;
      b.position.y = Math.sin(p * Math.PI) * 0.18;
    } else if (a.type === 'mua') {
      // múa: lắc lư, nhún nhảy, cánh xòe (hạc, chim sẻ), chim sẻ lượn vòng
      const t = a.t;
      b.rotation.y = Math.sin(t * 4) * 0.7 + (p > 0.75 ? (p - 0.75) * 4 * Math.PI * 2 : 0);
      b.rotation.z = Math.sin(t * 6) * 0.15;
      b.position.y = Math.abs(Math.sin(t * 6)) * 0.1;
      if (this.kind === 'se') {
        b.position.set(Math.cos(t * 4) * 0.3, Math.sin(t * 8) * 0.06, Math.sin(t * 4) * 0.3);
        P.wings[0].rotation.z = 0.5 + Math.sin(t * 28) * 0.9; P.wings[1].rotation.z = -P.wings[0].rotation.z;
      }
      if (this.kind === 'hac') { P.wings[0].rotation.z = 1.1 + Math.sin(t * 5) * 0.3; P.wings[1].rotation.z = -P.wings[0].rotation.z; }
      if (this.kind === 'tho') P.ears.forEach((e, i) => (e.rotation.z = Math.sin(t * 6 + i * Math.PI) * 0.4));
      if (this.kind === 'meo') P.tail.rotation.z = Math.sin(t * 8) * 0.7;
    } else if (a.type === 'pat') {
      // nhún xuống rồi bật lên, lắc nhẹ – như đang khoái chí
      b.scale.y = 1 - Math.sin(Math.min(1, p * 2) * Math.PI) * 0.18;
      b.position.y = Math.max(0, Math.sin(Math.max(0, p - 0.45) * 2 * Math.PI)) * 0.1;
      b.rotation.z = Math.sin(a.t * 14) * 0.08 * (1 - p);
    } else {
      // cúi đầu ăn, thức ăn vơi dần
      b.rotation.x = 0.2 + Math.abs(Math.sin(a.t * 9)) * 0.15;
      const food = this.bowl?.userData.food;
      if (food) food.scale.setScalar(Math.max(0.05, 1 - p)), (food.scale.y = Math.max(0.03, 0.5 * (1 - p)));
    }
    if (a.t >= a.dur) {
      this.action = null;
      b.rotation.set(0, 0, 0);
      b.position.set(0, 0, 0);
      if (this.kind === 'hac') { P.neck.rotation.x = 0; P.wings[0].rotation.z = 0; P.wings[1].rotation.z = 0; }
      if (this.kind === 'tho') P.ears.forEach((e, i) => (e.rotation.z = (i ? -1 : 1) * 0.15));
      if (a.type === 'feed') { this.bowl?.removeFromParent(); this.bowl = null; for (let i = 0; i < 3; i++) this.emit(getHeart(), 0.13, i * 0.15); }
    }
  }

  /** Dáng đi theo gait g (0 đứng yên … 1 đi hẳn): biên độ bước chân tỉ lệ g, cử chỉ lúc nghỉ tỉ lệ 1 − g */
  animate(dt, g, ownerMove) {
    const t = this.phase, it = this.idleT, P = this.parts, b = this.body, idle = 1 - g;
    switch (this.kind) {
      case 'meo': {
        b.position.y = Math.abs(Math.sin(t)) * 0.03 * g;
        P.legs.forEach((l, i) => (l.position.z = (i < 2 ? 0.12 : -0.12) + Math.sin(t + (i % 2 ? Math.PI : 0)) * 0.045 * g));
        P.tail.rotation.z = Math.sin(it * 1.6) * 0.4 * idle + Math.sin(t * 0.5) * 0.25 * g;
        P.head.rotation.y = Math.sin(it * 0.6) * 0.4 * idle;
        break;
      }
      // chim sẻ có đường bay riêng trong _updateBird()
      case 'tho': {
        b.position.y = Math.abs(Math.sin(t * 0.8)) * 0.14 * g;
        b.rotation.x = -Math.cos(t * 0.8) * 0.15 * g;
        P.ears.forEach((e, i) => (e.rotation.x = 0.4 * g + Math.sin(it * 1.4 + i) * 0.15 * idle));
        P.head.position.y = 0.33 + Math.sin(it * 6) * 0.005 * idle; // khụt khịt mũi
        break;
      }
      case 'rua': {
        P.legs.forEach((l, i) => (l.position.z = (i < 2 ? 0.13 : -0.13) + Math.sin(t * 0.6 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.04 * g));
        P.head.position.z = 0.24 + 0.02 * g + Math.sin(it * 0.8) * 0.03 * idle;
        b.rotation.z = Math.sin(t * 0.6) * 0.04 * g;
        break;
      }
      case 'hac': {
        P.legs[0].rotation.x = Math.sin(t * 0.7) * 0.45 * g;
        P.legs[1].rotation.x = -Math.sin(t * 0.7) * 0.45 * g;
        // bàn chân luôn nằm song song mặt đất dù cẳng chân đang vung
        P.legs.forEach((l) => (l.userData.foot.rotation.x = -l.rotation.x));
        P.torso.position.y = 0.62 + Math.abs(Math.sin(t * 0.7)) * 0.02 * g;
        P.neck.rotation.x = (0.15 + Math.sin(t * 0.7) * 0.08) * g + Math.sin(it * 0.5) * 0.1 * idle;
        // thỉnh thoảng xòe cánh khi đứng yên
        const spread = Math.max(0, Math.sin(it * 0.36) - 0.85) * 6 * idle;
        P.wings[0].rotation.z = spread; P.wings[1].rotation.z = -spread;
        break;
      }
    }
  }

  dispose() {
    this.clearBubble();
    for (const f of this.fx) f.sprite.material.dispose();
    this.root.removeFromParent();
  }
}
