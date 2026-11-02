import * as THREE from 'three';
import { CIRCLES } from './shared/world.js';
import { statueCard } from './statues.js';

// Sân chùa dựng hoàn toàn bằng code (low-poly). Sau này có thể thay từng phần bằng model .glb
// làm trong Blender (nén Draco) mà không phải đổi bố cục – bố cục nằm ở shared/world.js.

const mats = {};
export const M = (key, color, opts = {}) =>
  (mats[key] ??= new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }));

export function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function cyl(rt, rb, h, material, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b9ab94';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const v = 175 + Math.random() * 25;
      g.fillStyle = `rgb(${v},${v - 10},${v - 26})`;
      g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#5a1a12'; g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = '#e8c482'; g.lineWidth = 12; g.strokeRect(10, 10, 1004, 172);
  g.fillStyle = '#f2cf7a';
  g.font = '600 92px "Lora", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Mái ngói kiểu chùa: khối chóp 4 mặt kéo dài + đầu đao cong vút ở 4 góc. */
/** Cửa sổ chấn song gỗ (ô vuông) */
function latticeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(40,18,10,0.85)';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8a3020';
  g.lineWidth = 7;
  for (let i = 0; i <= 128; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(4, 4, 120, 120);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function roof(width, depth, height, y, z, color = '#6b2f22') {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  const r = new THREE.Mesh(geo, M('roof' + color, color, { flatShading: true }));
  r.scale.set(width, height, depth);
  r.position.y = height / 2;
  r.castShadow = r.receiveShadow = true;
  g.add(r);
  // đầu đao
  const tipMat = M('tip', '#c9a24a', { metalness: 0.3, roughness: 0.5 });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const k = Math.max(0.4, Math.min(1, width / 14)); // mái nhỏ thì đầu đao nhỏ theo
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16 * k, 1.1 * k, 6), tipMat);
      tip.position.set((sx * width) / 2, 0.35, (sz * depth) / 2);
      tip.rotation.z = -sx * 0.9;
      tip.rotation.x = sz * 0.5;
      tip.castShadow = true;
      g.add(tip);
    }
  // bờ nóc
  const ridge = box(width * 0.45, 0.25, 0.3, tipMat, 0, height - 0.05, 0);
  g.add(ridge);
  g.position.set(0, y, z);
  return g;
}

function buildHall(scene) {
  const g = new THREE.Group();
  const stone = M('stone', '#9d8f7b');
  const red = M('red', '#9b2d1d');
  const wall = M('wall', '#e6d6b8');

  // nền cao + bậc thềm
  g.add(box(24, 0.9, 7, stone, 0, 0.45, -16.5));
  for (let i = 0; i < 3; i++) g.add(box(9 - i * 0.6, 0.3, 0.45, stone, 0, 0.15 + i * 0.3, -12.75 - i * 0.45));

  // tường + cột
  g.add(box(20, 4, 0.4, wall, 0, 2.9, -19.6));
  g.add(box(0.4, 4, 5, wall, -10, 2.9, -17.2));
  g.add(box(0.4, 4, 5, wall, 10, 2.9, -17.2));
  for (let x = -9; x <= 9; x += 3.6) g.add(cyl(0.28, 0.32, 4, red, x, 2.9, -14.3));
  g.add(box(20.6, 0.5, 0.5, red, 0, 5.05, -14.3)); // xà ngang

  // mặt tiền: tường gỗ đỏ với cửa giữa (lối vào Chánh Điện) và 2 cửa sổ chấn song
  const wood = M('hallwood', '#7d2418', { roughness: 0.7 });
  const zf = -14.85;
  for (const [x0, x1] of [[-10, -6.6], [-4.6, -1.8], [1.8, 4.6], [6.6, 10]]) g.add(box(x1 - x0, 4, 0.25, wood, (x0 + x1) / 2, 2.9, zf));
  g.add(box(3.6, 0.8, 0.25, wood, 0, 4.5, zf)); // lanh tô trên cửa giữa
  for (const sx of [-1, 1]) {
    g.add(box(2, 1.0, 0.25, wood, sx * 5.6, 1.4, zf), box(2, 1.0, 0.25, wood, sx * 5.6, 4.4, zf));
    const lattice = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ map: latticeTexture(), transparent: true, roughness: 0.6 }));
    lattice.position.set(sx * 5.6, 2.9, zf + 0.02);
    g.add(lattice);
  }
  // trong cửa: ánh đèn vàng ấm hắt ra
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.2), new THREE.MeshBasicMaterial({ color: '#ffcf7a' }));
  inner.position.set(0, 2.5, zf - 0.6);
  g.add(inner);
  // 2 cánh cửa mở vào trong
  const doorMat = M('door', '#a8331f', { roughness: 0.55 });
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sx * 1.8, 0.9, zf);
    const leaf = box(1.8, 3.2, 0.1, doorMat, -sx * 0.9, 1.6, 0);
    const knob = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 14), M('tip', '#c9a24a', { metalness: 0.3, roughness: 0.5 }));
    knob.position.set(-sx * 1.6, 1.6, 0.07);
    hinge.add(leaf, knob);
    hinge.rotation.y = sx * 1.25;
    g.add(hinge);
  }
  // biển nhỏ trên cửa
  const doorSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshStandardMaterial({ map: signTexture('CHÁNH ĐIỆN'), roughness: 0.6 }));
  doorSign.position.set(0, 4.55, zf + 0.15);
  g.add(doorSign);

  // hoành phi
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshStandardMaterial({ map: signTexture('ĐẠI HÙNG BẢO ĐIỆN'), roughness: 0.6 }));
  sign.position.set(0, 5.75, -14.0);
  g.add(sign);

  // mái 2 tầng
  g.add(roof(26, 9, 2.6, 5.3, -16.8));
  g.add(roof(15, 5.5, 2.0, 7.3, -16.8));

  // tượng Phật vàng trong điện
  const gold = M('gold', '#d9a93c', { metalness: 0.55, roughness: 0.35, emissive: '#3a2506' });
  const lotus = M('lotus', '#d87d8a', { roughness: 0.6 });
  const buddha = new THREE.Group();
  buddha.add(cyl(1.3, 1.5, 0.8, stone, 0, 0.4, 0, 24));
  for (let i = 0; i < 12; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lotus);
    const a = (i / 12) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 1.05, 0.95, Math.sin(a) * 1.05);
    petal.scale.set(0.6, 0.5, 1);
    petal.lookAt(0, 0.95, 0);
    buddha.add(petal);
  }
  const lap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), gold);
  lap.scale.set(1.15, 0.45, 0.8); lap.position.y = 1.35; buddha.add(lap);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), gold);
  torso.scale.set(1, 1.3, 0.75); torso.position.y = 2.25; buddha.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), gold);
  head.position.y = 3.45; buddha.add(head);
  const ushnisha = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), gold);
  ushnisha.position.y = 3.95; buddha.add(ushnisha);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 40), M('halo', '#ffd77a', { emissive: '#ffb84a', emissiveIntensity: 0.8 }));
  halo.position.set(0, 3.45, -0.35); buddha.add(halo);
  buddha.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  buddha.scale.setScalar(0.85);
  // nhìn qua cửa chính điện thấy tượng Phật thật (ảnh); khối ghép chỉ để dự phòng
  const bcard = statueCard({ url: '/textures/statues/phat.webp', height: 3.6, fallback: buddha, glow: 0.5, maxTurn: 0.5 });
  bcard.position.set(0, 0.9, -18.2);
  g.add(bcard);

  // ánh đèn ấm trong điện
  const glow = new THREE.PointLight('#ffb35c', 12, 12, 1.6);
  glow.position.set(0, 3.5, -15.5);
  g.add(glow);

  scene.add(g);
}

function buildGate(scene) {
  const g = new THREE.Group();
  const red = M('red', '#9b2d1d');
  const wall = M('wall', '#e6d6b8');
  g.add(box(1.4, 3.6, 1.4, wall, -5.5, 1.8, 19.3), box(1.4, 3.6, 1.4, wall, 5.5, 1.8, 19.3));
  g.add(box(12.4, 0.5, 1.2, red, 0, 3.6, 19.3));
  const r = roof(13.5, 3, 1.5, 3.85, 19.3);
  g.add(r);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), new THREE.MeshStandardMaterial({ map: signTexture('TAM QUAN'), roughness: 0.6 }));
  sign.position.set(0, 3.1, 19.95);
  sign.rotation.y = Math.PI;
  g.add(sign);
  scene.add(g);
  const gate = g;

  // tường bao thấp
  const cap = M('cap', '#6b2f22');
  const segs = [
    [-11.75, 20, 11.5, 0], [11.75, 20, 11.5, 0], // trước (chừa cổng)
    [-18, 10, 61, 1], [18, 10, 61, 1], // hai bên (bao cả sân trước)
    [0, -21, 36.5, 0], // phía sau chính điện
  ];
  for (const [x, z, len, rot] of segs) {
    const w = box(rot ? 0.5 : len, 1.6, rot ? len : 0.5, wall, x, 0.8, z);
    const c = box(rot ? 0.8 : len + 0.3, 0.2, rot ? len + 0.3 : 0.8, cap, x, 1.7, z);
    scene.add(w, c);
  }
  return gate;
}

function buildIncenseBurner(scene) {
  const g = new THREE.Group();
  const bronze = M('bronze', '#5b4630', { metalness: 0.6, roughness: 0.45 });
  const stone = M('stone', '#9d8f7b');
  g.add(cyl(1.25, 1.35, 0.5, stone, 0, 0.25, 0, 24));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(cyl(0.08, 0.1, 0.6, bronze, Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6, 8));
  }
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.15 + Math.sin(t * Math.PI * 0.55) * 0.9, t * 0.9));
  }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), bronze);
  bowl.position.y = 1.05;
  bowl.castShadow = true;
  g.add(bowl);
  g.add(cyl(0.95, 0.95, 0.05, M('ash', '#8a8378'), 0, 1.9, 0, 28)); // mặt tro
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), bronze);
    h.position.set(sx * 1.05, 2.05, 0);
    h.rotation.y = Math.PI / 2;
    g.add(h);
  }
  // nhang
  const stick = M('stick', '#a2342a');
  const ember = new THREE.MeshBasicMaterial({ color: '#ff8a3c' });
  const tips = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = cyl(0.012, 0.012, 0.7, stick, x, 2.25, z, 5);
    s.rotation.set((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15);
    g.add(s);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), ember);
    tip.position.set(x, 2.6, z);
    g.add(tip);
    tips.push(tip.position.clone());
  }
  const c = CIRCLES.find((o) => o.kind === 'luhuong');
  g.position.set(c.x, 0, c.z);
  scene.add(g);

  // khói nhang: hạt Points bay lên, mờ dần
  const N = 80;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const life = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const smokeTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const smoke = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.6, map: smokeTex, transparent: true, opacity: 0.35, depthWrite: false, color: '#e9e2d6' }));
  smoke.position.copy(g.position);
  scene.add(smoke);

  // nhang người chơi thắp: cháy dần trong BURN_SECONDS rồi tắt
  const BURN_SECONDS = 120;
  const MAX_STICKS = 40;
  const lit = []; // { group, tip, born }
  const fresh = new THREE.MeshBasicMaterial({ color: '#ffb35c' });
  let smokeBoost = 0;

  function addStick() {
    if (lit.length >= MAX_STICKS) removeStick(lit[0]);
    const a = Math.random() * Math.PI * 2, r = 0.15 + Math.random() * 0.6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sg = new THREE.Group();
    sg.position.set(x, 1.92, z);
    sg.rotation.set((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2);
    const s = cyl(0.013, 0.013, 0.7, stick, 0, 0.35, 0, 5);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), fresh);
    tip.position.y = 0.7;
    sg.add(s, tip);
    g.add(sg);
    const tp = new THREE.Vector3(x, 2.62, z);
    tips.push(tp);
    lit.push({ group: sg, stick: s, tip, tp, born: performance.now() });
    smokeBoost = 1;
  }
  function removeStick(o) {
    g.remove(o.group);
    lit.splice(lit.indexOf(o), 1);
    tips.splice(tips.indexOf(o.tp), 1);
  }

  const update = (dt, t) => {
    const now = performance.now();
    for (const o of [...lit]) {
      const k = 1 - (now - o.born) / 1000 / BURN_SECONDS; // phần nhang còn lại
      if (k <= 0.08) { removeStick(o); continue; }
      o.stick.scale.y = k;
      o.stick.position.y = 0.35 * k;
      o.tip.position.y = 0.7 * k;
      o.tp.y = 1.92 + 0.7 * k;
      o.tip.scale.setScalar(0.8 + Math.sin(t * 7 + o.born) * 0.2); // đầu nhang lập lòe
    }
    smokeBoost = Math.max(0, smokeBoost - dt * 0.15);
    smoke.material.opacity = 0.35 + smokeBoost * 0.25 + Math.min(lit.length, 20) * 0.01;
    for (let i = 0; i < N; i++) {
      life[i] += dt * 0.25;
      if (life[i] > 1) life[i] = 0;
      const base = tips[i % tips.length];
      const l = life[i];
      pos[i * 3] = base.x + Math.sin(t * 0.8 + i) * 0.25 * l + l * 0.4;
      pos[i * 3 + 1] = base.y + l * 3.2;
      pos[i * 3 + 2] = base.z + Math.cos(t * 0.6 + i * 1.3) * 0.25 * l;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { update, addStick, object: g };
}

/** Gác chuông: 4 cột, mái nhỏ, chuông đồng treo và khúc gỗ thỉnh chuông. */
function buildBellTower(scene) {
  const c = CIRCLES.find((o) => o.kind === 'bell');
  const g = new THREE.Group();
  const red = M('red', '#9b2d1d');
  const stone = M('stone', '#9d8f7b');
  const bronze = M('bellbronze', '#7a5a2e', { metalness: 0.7, roughness: 0.35, emissive: '#000000' });
  const wood = M('trunk', '#5e4330');
  const rope = M('rope', '#c9b48a');

  g.add(cyl(1.75, 1.85, 0.3, stone, 0, 0.15, 0, 8));
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) g.add(cyl(0.12, 0.14, 3.2, red, x, 1.9, z, 10));
  g.add(box(2.6, 0.18, 0.2, red, 0, 3.45, 0)); // xà treo chuông
  g.add(roof(3.6, 3.6, 1.3, 3.5, 0));

  // chuông: xoay quanh điểm treo
  const pivot = new THREE.Group();
  pivot.position.y = 3.35;
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const tt = i / 12;
    prof.push(new THREE.Vector2(0.18 + Math.pow(tt, 1.6) * 0.42 + (i === 12 ? 0.04 : 0), -tt * 1.15));
  }
  const bellMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), bronze);
  bellMesh.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), bronze);
  const bands = [-0.35, -0.8].map((y) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3 + -y * 0.25, 0.018, 6, 28), bronze);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    return band;
  });
  pivot.add(bellMesh, cap, ...bands);
  g.add(pivot);

  // khúc gỗ thỉnh chuông treo bằng 2 dây
  const striker = new THREE.Group();
  striker.position.set(0, 3.35, 0);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 10), wood);
  log.rotation.z = Math.PI / 2;
  log.position.set(1.25, -1.0, 0);
  log.castShadow = true;
  striker.add(log);
  for (const x of [0.85, 1.65]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.0, 4), rope);
    r.position.set(x, -0.5, 0);
    striker.add(r);
  }
  g.add(striker);

  // sóng âm lan ra khi chuông ngân
  const waves = [];
  const waveMat = new THREE.MeshBasicMaterial({ color: '#ffe3a3', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), waveMat.clone());
    w.rotation.x = -Math.PI / 2;
    w.position.y = 2.6;
    w.visible = false;
    g.add(w);
    waves.push(w);
  }

  g.position.set(c.x, 0, c.z);
  g.rotation.y = -Math.PI / 4; // khúc gỗ quay về phía sân
  scene.add(g);

  let ringT = -1; // giây kể từ lúc đánh, -1 = đứng yên
  const ring = () => { ringT = 0; };
  const update = (dt) => {
    if (ringT < 0) return;
    ringT += dt;
    const t = ringT;
    // khúc gỗ: kéo lùi 0–0.35s, lao vào chuông 0.35–0.45s, nảy lại rồi tắt dần
    let sw;
    if (t < 0.35) sw = (t / 0.35) * 0.55;
    else if (t < 0.45) sw = 0.55 - ((t - 0.35) / 0.1) * 0.6;
    else sw = -0.05 * Math.exp(-(t - 0.45) * 3) * Math.cos((t - 0.45) * 9);
    striker.rotation.z = sw;
    // chuông lắc nhẹ + sáng lên sau cú đánh
    const after = Math.max(0, t - 0.45);
    pivot.rotation.z = t > 0.45 ? Math.sin(after * 6) * 0.05 * Math.exp(-after * 0.8) : 0;
    bronze.emissive.setRGB(0.35 * Math.exp(-after * 1.5) * (t > 0.45 ? 1 : 0), 0.2 * Math.exp(-after * 1.5) * (t > 0.45 ? 1 : 0), 0);
    waves.forEach((w, i) => {
      const wt = after - i * 0.35;
      w.visible = t > 0.45 && wt > 0 && wt < 2.2;
      if (w.visible) {
        w.scale.setScalar(1 + wt * 5);
        w.material.opacity = 0.45 * (1 - wt / 2.2);
      }
    });
    if (t > 6) { ringT = -1; striker.rotation.z = 0; pivot.rotation.z = 0; bronze.emissive.setRGB(0, 0, 0); }
  };
  return { update, ring, object: g };
}

function buildTrees(scene) {
  const trunk = M('trunk', '#5e4330');
  const leaf = M('leaf', '#4f7a3a', { flatShading: true });
  const leaf2 = M('leaf2', '#3f6a30', { flatShading: true });
  const stone = M('stone', '#9d8f7b');
  for (const c of CIRCLES.filter((o) => o.kind === 'tree')) {
    const g = new THREE.Group();
    g.add(cyl(1.3, 1.35, 0.45, stone, 0, 0.22, 0, 20));
    g.add(cyl(0.3, 0.45, 3.2, trunk, 0, 1.6, 0, 10));
    const blobs = [[0, 4, 0, 1.9], [1.2, 3.6, 0.4, 1.3], [-1.1, 3.7, -0.3, 1.4], [0.3, 3.5, -1.2, 1.2], [-0.4, 3.4, 1.1, 1.2], [0, 5.1, 0, 1.2]];
    blobs.forEach(([x, y, z, r], i) => {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), i % 2 ? leaf2 : leaf);
      s.position.set(x, y, z);
      s.castShadow = true;
      g.add(s);
    });
    g.position.set(c.x, 0, c.z);
    g.rotation.y = Math.random() * Math.PI;
    scene.add(g);
  }
}

function buildLanterns(scene) {
  const pole = M('pole', '#3a2a1e');
  const lantern = M('lantern', '#d23a26', { emissive: '#b8281a', emissiveIntensity: 0.9, roughness: 0.5 });
  const gold = M('tip', '#c9a24a', { metalness: 0.3, roughness: 0.5 });
  for (const c of CIRCLES.filter((o) => o.kind === 'lantern')) {
    const g = new THREE.Group();
    g.add(cyl(0.08, 0.1, 3.2, pole, 0, 1.6, 0, 8));
    g.add(box(1.0, 0.08, 0.08, pole, 0.4, 3.1, 0));
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), lantern);
    l.scale.y = 1.25;
    l.position.set(0.75, 2.55, 0);
    g.add(l);
    g.add(cyl(0.15, 0.15, 0.08, gold, 0.75, 2.97, 0, 10), cyl(0.15, 0.15, 0.08, gold, 0.75, 2.13, 0, 10));
    g.position.set(c.x, 0, c.z);
    g.rotation.y = c.x < 0 ? 0 : Math.PI;
    scene.add(g);
  }
}

/** Màu trời / sương mù của map sân chùa (main.js gán cho scene khi đang ở map này) */
export const SAN_SKY = { color: '#e9c99a', fogNear: 45, fogFar: 160 };

export function buildTemple(scene) {
  scene.add(new THREE.HemisphereLight('#fff1d6', '#6b553b', 1.1));
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.2);
  sun.position.set(14, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 40, bottom: -40, near: 1, far: 90 });
  sun.position.set(14, 26, 18);
  sun.target.position.set(0, 0, 8);
  scene.add(sun.target);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // mặt đất ngoài + sân lát đá
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M('grass', '#7f8f55'));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.01;
  grass.receiveShadow = true;
  scene.add(grass);

  const tex = tileTexture();
  tex.repeat.set(9, 10);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(36, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  yard.rotation.x = -Math.PI / 2;
  yard.receiveShadow = true;
  scene.add(yard);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 31), M('path', '#d8ccb4'));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.005, 3.5);
  path.receiveShadow = true;
  scene.add(path);

  buildHall(scene);
  const gate = buildGate(scene);
  buildTrees(scene);
  buildLanterns(scene);
  const burner = buildIncenseBurner(scene);
  const bell = buildBellTower(scene);

  return {
    groundMeshes: [grass, yard, path],
    // vật thể bấm vào được → loại hành động
    interactables: [
      { kind: 'incense', object: burner.object },
      { kind: 'bell', object: bell.object },
    ],
    addIncense: burner.addStick,
    ringBell: bell.ring,
    update: (dt, t, camera, player) => {
      burner.update(dt, t);
      bell.update(dt);
      // ẩn cổng tam quan khi nó nằm giữa camera và người chơi, để không che tầm nhìn
      gate.visible = (camera.position.z - 19.3) * (player.z - 19.3) > 0;
    },
  };
}
