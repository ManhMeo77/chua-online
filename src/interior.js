import * as THREE from 'three';
import { M, box, cyl, signTexture } from './temple.js';
import { MAPS } from './shared/world.js';
import { statueCard } from './statues.js';

// Bên trong Chánh Điện. Gốc tọa độ riêng: cửa phía nam (z = 10), bàn thờ phía bắc (z < −8), trần cao 8 m.
// Tường/sàn/trần là mặt phẳng quay vào trong, nên camera lỡ ra ngoài tường vẫn nhìn xuyên được (không bị che).
//
// Ảnh trang trí (tạo bằng ChatGPT) nằm trong public/textures/. Nếu thiếu ảnh, dùng họa tiết vẽ bằng code thay thế.

export const CD_SKY = { color: '#1a100a', fogNear: 18, fogFar: 46 };

const W = 12, Z_BACK = -16, Z_FRONT = 10, H = 8;
const loader = new THREE.TextureLoader();

/** Tải ảnh, nếu lỗi thì giữ texture vẽ sẵn */
function textureOr(url, fallback) {
  const tex = fallback;
  loader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = fallback.wrapS; t.wrapT = fallback.wrapT;
    t.repeat.copy(fallback.repeat);
    tex.image = t.image;
    tex.needsUpdate = true;
  }, undefined, () => {});
  return tex;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// họa tiết dự phòng: nền đỏ son, hoa sen + mây vàng
const muralFallback = () => canvasTex(768, 256, (g, w, h) => {
  g.fillStyle = '#6e1810'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9a93c'; g.fillStyle = '#d9a93c'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const cx = 64 + i * 128, cy = h / 2;
    for (let k = 0; k < 8; k++) { g.beginPath(); g.ellipse(cx, cy, 14, 44, (k / 8) * Math.PI, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
  }
  g.strokeRect(6, 6, w - 12, h - 12);
});
const haloFallback = () => canvasTex(512, 512, (g, w) => {
  g.fillStyle = '#6e1810'; g.fillRect(0, 0, w, w);
  const grd = g.createRadialGradient(256, 256, 60, 256, 256, 250);
  grd.addColorStop(0, '#ffe7a3'); grd.addColorStop(0.55, '#e0a83c'); grd.addColorStop(1, 'rgba(110,24,16,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff2c4'; g.lineWidth = 3;
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; g.beginPath(); g.moveTo(256 + Math.cos(a) * 120, 256 + Math.sin(a) * 120); g.lineTo(256 + Math.cos(a) * 235, 256 + Math.sin(a) * 235); g.stroke(); }
});
const floorTex = () => {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#6a3a24'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 120 + Math.random() * 25;
      g.fillStyle = `rgb(${v},${v * 0.55},${v * 0.36})`;
      g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 13);
  return t;
};
/** Bảng chữ dọc (câu đối) */
function verticalSign(text) {
  return canvasTex(128, 640, (g, w, h) => {
    g.fillStyle = '#5a1a12'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8c482'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#f2cf7a'; g.font = '600 48px "Lora", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = text.split(' ');
    words.forEach((wd, i) => g.fillText(wd, w / 2, 70 + i * ((h - 140) / Math.max(1, words.length - 1))));
  });
}

function plane(w, h, mat, x, y, z, ry = 0, rx = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0);
  m.receiveShadow = true;
  return m;
}
const shadowAll = (o) => { o.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return o; };

// ───────────────────────── Tượng ─────────────────────────
const GOLD = () => M('cd-gold', '#d9a93c', { metalness: 0.6, roughness: 0.32, emissive: '#3a2506' });

/** Phật ngồi kiết già trên tòa sen. variant: 0 thiền định, 1 xúc địa, 2 cầm bát (chỉ khác thế tay) */
function makeSeatedBuddha(variant = 0) {
  const g = new THREE.Group();
  const gold = GOLD();
  const lotus = M('cd-lotus', '#d0707e', { roughness: 0.55 });
  const lotusIn = M('cd-lotus-in', '#e89aa6', { roughness: 0.55 });
  g.add(cyl(1.05, 1.15, 0.5, M('cd-base', '#7a1e14', { roughness: 0.6 }), 0, 0.25, 0, 24));
  for (const [n, r, y, mat, tilt] of [[16, 1.0, 0.62, lotus, 0.5], [12, 0.78, 0.8, lotusIn, 0.25]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat);
      p.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      p.scale.set(0.55, 0.45, 1.05);
      p.lookAt(0, y + tilt, 0);
      g.add(p);
    }
  }
  const lap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 22, 14), gold);
  lap.scale.set(1.15, 0.42, 0.85); lap.position.y = 1.15; g.add(lap);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 16), gold);
  torso.scale.set(1, 1.35, 0.72); torso.position.y = 1.95; g.add(torso);
  // áo cà sa: vạt chéo vai
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 24, Math.PI), gold);
  sash.position.set(0.05, 2.1, 0.12); sash.rotation.set(0.2, 0, 2.3); g.add(sash);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 16), gold);
  head.position.y = 2.95; g.add(head);
  const ush = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), gold); ush.position.y = 3.33; g.add(ush);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), gold);
    ear.scale.set(0.5, 1.6, 0.6); ear.position.set(sx * 0.4, 2.85, 0); g.add(ear);
  }
  // mắt nhắm, nốt bạch hào
  const dark = M('cd-dark', '#3a2a12', { roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), dark);
    eye.position.set(sx * 0.15, 2.97, 0.38); eye.rotation.z = Math.PI; g.add(eye);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), M('cd-urna', '#fff2c4', { emissive: '#ffcf6a', emissiveIntensity: 1 })).translateY(3.1).translateZ(0.4));
  // tay
  const hand = (x, y, z) => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), gold); h.position.set(x, y, z); h.scale.set(1.2, 0.7, 1); g.add(h); };
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), gold); arm.scale.set(0.8, 1.5, 0.8); arm.position.set(sx * 0.62, 1.85, 0.1); arm.rotation.z = sx * 0.3; g.add(arm); }
  if (variant === 0) { hand(0, 1.38, 0.45); }
  else if (variant === 1) { hand(-0.12, 1.38, 0.45); hand(0.62, 1.2, 0.62); } // tay phải chạm đất
  else { hand(0, 1.38, 0.45); const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('cd-bowl', '#3a2a1e')); bowl.position.set(0, 1.52, 0.47); g.add(bowl); }
  return shadowAll(g);
}

/** Bồ Tát đứng: Quan Âm (áo trắng, tịnh bình) hoặc Địa Tạng (đầu tròn, cà sa đỏ, tích trượng + ngọc minh châu) */
function makeStandingBodhisattva(kind) {
  const g = new THREE.Group();
  const isQA = kind === 'quanam';
  const robeMat = isQA ? M('cd-qa-robe', '#f4f1ea', { roughness: 0.5 }) : M('cd-dt-robe', '#a8361f', { roughness: 0.6 });
  const skin = isQA ? M('cd-qa-skin', '#f1e3cf', { roughness: 0.45 }) : GOLD();
  const gold = GOLD();
  g.add(cyl(0.75, 0.85, 0.35, M('cd-base', '#7a1e14', { roughness: 0.6 }), 0, 0.18, 0, 22));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), M('cd-lotus', '#d0707e', { roughness: 0.55 }));
    p.position.set(Math.cos(a) * 0.65, 0.45, Math.sin(a) * 0.65); p.scale.set(0.6, 0.5, 1.1); p.lookAt(0, 0.6, 0);
    g.add(p);
  }
  const prof = [[0.48, 0], [0.45, 0.4], [0.38, 1.0], [0.34, 1.6], [0.38, 2.0], [0.24, 2.3], [0.14, 2.36]].map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(prof, 26), robeMat);
  robe.position.y = 0.5; g.add(robe);
  if (!isQA) { // y vàng bên trong cà sa
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.8, 20, 1, true), M('cd-dt-inner', '#e0a83c'));
    inner.position.set(0, 1.5, 0.05); inner.scale.z = 0.8; g.add(inner);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), skin);
  head.position.y = 3.1; g.add(head);
  if (isQA) {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), robeMat);
    hood.position.y = 3.12; hood.rotation.x = -0.25; g.add(hood);
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 8), gold).translateY(3.4));
    // tịnh bình tay trái, cành dương liễu tay phải
    const vase = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), M('cd-vase', '#eae6da', { roughness: 0.25 }));
    vase.position.set(-0.26, 2.1, 0.34); g.add(vase, cyl(0.025, 0.035, 0.16, M('cd-vase', '#eae6da', { roughness: 0.25 }), -0.26, 2.22, 0.34, 10));
    const wil = cyl(0.008, 0.008, 0.55, M('leaf', '#4f7a3a'), 0.28, 1.8, 0.32, 5); wil.rotation.z = 0.2; g.add(wil);
  } else {
    // tích trượng tay phải, ngọc minh châu tay trái
    g.add(cyl(0.025, 0.025, 3.0, M('cd-staff', '#8a5a2a'), 0.45, 1.85, 0.25, 8));
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 18), gold);
    top.position.set(0.45, 3.4, 0.25); g.add(top);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), M('cd-pearl', '#fff6dc', { emissive: '#ffd77a', emissiveIntensity: 0.9 })).translateX(-0.25).translateY(2.0).translateZ(0.36));
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 32), M('halo', '#ffd77a', { emissive: '#ffb84a', emissiveIntensity: 0.9 }));
  halo.position.set(0, 3.15, -0.22); g.add(halo);
  return shadowAll(g);
}

/** Hộ Pháp (thần hộ vệ) mặc giáp, tay cầm chùy. fierce: mặt đỏ dữ (Trừng Ác) / hiền (Khuyến Thiện) */
function makeGuardian(fierce) {
  const g = new THREE.Group();
  const armor = M(fierce ? 'cd-armor-r' : 'cd-armor-g', fierce ? '#8a2a1a' : '#2f6a4a', { roughness: 0.5, metalness: 0.3 });
  const gold = GOLD();
  const face = M(fierce ? 'cd-face-r' : 'cd-face-w', fierce ? '#c2452e' : '#f0d2b0', { roughness: 0.5 });
  g.add(box(1.4, 0.5, 1.4, M('cd-base', '#7a1e14', { roughness: 0.6 }), 0, 0.25, 0));
  for (const sx of [-1, 1]) g.add(cyl(0.16, 0.2, 1.2, armor, sx * 0.25, 1.1, 0, 10));
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), armor);
  torso.scale.set(1, 1.25, 0.8); torso.position.y = 2.15; g.add(torso);
  g.add(cyl(0.58, 0.62, 0.15, gold, 0, 1.7, 0, 18)); // đai lưng
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), gold); chest.position.set(0, 2.3, 0.45); g.add(chest);
  for (const sx of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), gold); sh.position.set(sx * 0.62, 2.55, 0); sh.scale.y = 0.7; g.add(sh);
    const arm = cyl(0.13, 0.15, 0.8, armor, sx * 0.7, 2.1, 0.12, 10); arm.rotation.x = -0.5; g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), face); head.position.y = 3.05; g.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), gold); helm.position.y = 3.1; g.add(helm);
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 8), M('red', '#9b2d1d')).translateY(3.55));
  const brow = M('cd-dark', '#3a2a12', { roughness: 0.4 });
  for (const sx of [-1, 1]) { const b = box(0.14, 0.035, 0.03, brow, sx * 0.11, 3.13, 0.28); b.rotation.z = sx * (fierce ? 0.45 : -0.15); g.add(b); }
  // chùy / kiếm cầm trước ngực
  g.add(cyl(0.035, 0.035, 2.0, gold, 0, 2.2, 0.55, 8));
  g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), gold).translateY(3.25).translateZ(0.55));
  return shadowAll(g);
}

// ───────────────────────── Đồ thờ ─────────────────────────
function makeTable() {
  const g = new THREE.Group();
  const lacquer = M('cd-lacquer', '#7a1e14', { roughness: 0.45 });
  const gold = GOLD();
  g.add(box(5.2, 1.0, 1.3, lacquer, 0, 0.5, 0), box(5.3, 0.06, 1.38, gold, 0, 1.02, 0), box(5.25, 0.06, 1.35, gold, 0, 0.12, 0));
  // bát hương đồng giữa
  const bronze = M('bronze', '#5b4630', { metalness: 0.6, roughness: 0.45 });
  g.add(cyl(0.32, 0.24, 0.32, bronze, 0, 1.2, 0, 18));
  const sticks = [];
  for (let i = 0; i < 7; i++) {
    const s = cyl(0.008, 0.008, 0.45, M('stick', '#a2342a'), (i - 3) * 0.04, 1.58, (i % 2) * 0.04, 5);
    g.add(s);
    sticks.push(s);
  }
  // 2 chân nến
  const flames = [];
  for (const sx of [-1, 1]) {
    g.add(cyl(0.06, 0.12, 0.5, gold, sx * 1.1, 1.3, 0, 10), cyl(0.05, 0.05, 0.3, M('candle', '#c8352a'), sx * 1.1, 1.7, 0, 10));
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 8), new THREE.MeshBasicMaterial({ color: '#ffcc66' }));
    f.position.set(sx * 1.1, 1.92, 0);
    g.add(f);
    flames.push(f);
  }
  // bình hoa sen, mâm ngũ quả
  for (const sx of [-1, 1]) {
    g.add(cyl(0.1, 0.14, 0.4, M('cd-vase2', '#2f5e8a', { roughness: 0.3 }), sx * 1.8, 1.25, 0.1, 12));
    for (let i = 0; i < 3; i++) {
      const st = cyl(0.008, 0.008, 0.5, M('leaf', '#4f7a3a'), sx * 1.8 + (i - 1) * 0.06, 1.65, 0.1, 5);
      g.add(st, new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 7), M('lotuspetal', '#f2a3b8', { roughness: 0.5 })).translateX(sx * 1.8 + (i - 1) * 0.06).translateY(1.92 + i * 0.03).translateZ(0.1));
    }
    g.add(cyl(0.3, 0.2, 0.05, gold, sx * 0.55, 1.08, 0.25, 16));
    const fruit = ['#f2c14e', '#e8546b', '#7ab34a', '#f08a3c', '#c86fd0'];
    fruit.forEach((c, i) => {
      const a = (i / 5) * Math.PI * 2;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M('fruit' + c, c, { roughness: 0.5 })).translateX(sx * 0.55 + Math.cos(a) * 0.13).translateY(1.18 + (i === 0 ? 0.08 : 0)).translateZ(0.25 + Math.sin(a) * 0.13));
    });
  }
  return { group: shadowAll(g), flames, sticks };
}

function makeCushion() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.16, 20), M('cd-cushion', '#d9a32e', { roughness: 0.85 }));
  c.position.y = 0.08;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 6, 24), M('cd-cushion2', '#a8361f'));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.16;
  g.add(c, rim);
  return g;
}

function makeDrum() {
  const g = new THREE.Group();
  const wood = M('cd-wood', '#5a2a16', { roughness: 0.6 });
  for (const sz of [-1, 1]) g.add(box(0.15, 2.4, 0.15, wood, 0, 1.2, sz * 0.85)); // giá trống đứng dọc, mặt trống nhìn ra giữa điện
  g.add(box(0.15, 0.15, 1.85, wood, 0, 2.35, 0));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.8, 24), M('cd-drum', '#a8261a', { roughness: 0.5 }));
  drum.rotation.z = Math.PI / 2; drum.position.y = 1.5;
  for (const sx of [-1, 1]) { const skin = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), M('cd-skin', '#e7d2a6')); skin.position.set(sx * 0.41, 1.5, 0); skin.rotation.y = sx * Math.PI / 2; g.add(skin); }
  g.add(drum);
  return shadowAll(g);
}

function makeBigBell() {
  const g = new THREE.Group();
  const wood = M('cd-wood', '#5a2a16', { roughness: 0.6 });
  for (const sx of [-1, 1]) g.add(box(0.15, 2.8, 0.15, wood, sx * 0.8, 1.4, 0));
  g.add(box(1.75, 0.15, 0.2, wood, 0, 2.75, 0));
  const prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(0.25 + Math.pow(t, 1.5) * 0.4, -t * 1.3)); }
  const bell = new THREE.Mesh(new THREE.LatheGeometry(prof, 26), M('bellbronze2', '#6f5228', { metalness: 0.7, roughness: 0.35 }));
  bell.position.y = 2.6;
  g.add(bell);
  return shadowAll(g);
}

// ───────────────────────── Ráp Chánh Điện ─────────────────────────
export function buildInterior(root) {
  const lacquer = M('cd-lacquer', '#7a1e14', { roughness: 0.45 });
  const red = M('red', '#9b2d1d');
  const gold = GOLD();

  // ánh sáng: tối ấm, đèn vàng từ bàn thờ + đèn lồng
  root.add(new THREE.HemisphereLight('#ffe0b0', '#3a2416', 0.75));
  const key = new THREE.DirectionalLight('#ffd9a0', 0.9);
  key.position.set(4, 12, 9); key.target.position.set(0, 0, -6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 1, far: 40 });
  key.shadow.bias = -0.0005;
  root.add(key, key.target);
  const altarLight = new THREE.PointLight('#ffbf66', 30, 18, 1.6);
  altarLight.position.set(0, 5.5, -9);
  root.add(altarLight);
  const doorLight = new THREE.PointLight('#fff0d0', 10, 12, 1.8);
  doorLight.position.set(0, 3, 8.5);
  root.add(doorLight);

  // sàn gạch + thảm đỏ lối giữa
  const floor = plane(W * 2, Z_FRONT - Z_BACK, new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.75 }), 0, 0, (Z_FRONT + Z_BACK) / 2, 0, -Math.PI / 2);
  root.add(floor);
  const carpet = plane(2.4, 15.6, M('cd-carpet', '#8a1c18', { roughness: 0.95 }), 0, 0.01, 1.8, 0, -Math.PI / 2);
  root.add(carpet);
  for (const sx of [-1, 1]) root.add(plane(0.12, 15.6, gold, sx * 1.2, 0.012, 1.8, 0, -Math.PI / 2));

  // tường: chân tường gỗ + bích họa + diềm trên
  const mural = textureOr('/textures/bich-hoa.jpg', muralFallback());
  const muralMat = new THREE.MeshStandardMaterial({ map: mural, roughness: 0.6 });
  const wainscot = M('cd-wainscot', '#4a1a10', { roughness: 0.7 });
  const upper = M('cd-upper', '#6a1e14', { roughness: 0.7 });
  // hai tường bên (x = ±12): bích họa giữa các cột tường
  for (const sx of [-1, 1]) {
    const ry = -sx * Math.PI / 2;
    root.add(plane(Z_FRONT - Z_BACK, 1.6, wainscot, sx * W, 0.8, (Z_FRONT + Z_BACK) / 2, ry));
    root.add(plane(Z_FRONT - Z_BACK, H - 5.2, upper, sx * W, 5.2 + (H - 5.2) / 2, (Z_FRONT + Z_BACK) / 2, ry));
    for (let i = 0; i < 3; i++) {
      const zc = -11 + i * 7.5;
      root.add(plane(6.6, 2.2, muralMat, sx * (W - 0.01), 2.7, zc, ry));
      root.add(plane(6.8, 0.08, gold, sx * (W - 0.02), 3.84, zc, ry), plane(6.8, 0.08, gold, sx * (W - 0.02), 1.56, zc, ry));
      root.add(plane(6.6, 1.4, muralMat, sx * (W - 0.01), 4.5, zc, ry)); // dải trên
    }
    // cột tường
    for (let z = Z_BACK + 0.6; z <= Z_FRONT; z += 3.75) root.add(cyl(0.25, 0.28, H, lacquer, sx * (W - 0.3), H / 2, z, 12));
  }
  // tường sau bàn thờ
  root.add(plane(W * 2, H, upper, 0, H / 2, Z_BACK, 0));
  // tường trước (có cửa ở giữa, ánh sáng ngoài sân hắt vào)
  const front = new THREE.Group();
  front.add(plane(W - 1.8, H, upper, -(W + 1.8) / 2, H / 2, Z_FRONT, Math.PI));
  front.add(plane(W - 1.8, H, upper, (W + 1.8) / 2, H / 2, Z_FRONT, Math.PI));
  front.add(plane(3.6, H - 3.4, upper, 0, 3.4 + (H - 3.4) / 2, Z_FRONT, Math.PI));
  front.add(plane(3.6, 3.4, new THREE.MeshBasicMaterial({ color: '#fbe7bf' }), 0, 1.7, Z_FRONT + 0.3, Math.PI)); // khung trời sáng bên ngoài
  for (const sx of [-1, 1]) front.add(box(0.2, 3.6, 0.3, gold, sx * 1.9, 1.8, Z_FRONT - 0.05));
  front.add(box(4, 0.25, 0.3, gold, 0, 3.5, Z_FRONT - 0.05));
  root.add(front);
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshStandardMaterial({ map: signTexture('RA SÂN CHÙA'), roughness: 0.6 }));
  exitSign.position.set(0, 4.05, Z_FRONT - 0.2); exitSign.rotation.y = Math.PI;
  root.add(exitSign);

  // trần: ván gỗ tối + xà ngang chạm vàng
  root.add(plane(W * 2, Z_FRONT - Z_BACK, M('cd-ceiling', '#3a1a10', { roughness: 0.8 }), 0, H, (Z_FRONT + Z_BACK) / 2, 0, Math.PI / 2));
  for (let z = -13; z <= 8; z += 3.5) root.add(box(W * 2, 0.35, 0.35, lacquer, 0, H - 0.4, z), box(W * 2, 0.05, 0.37, gold, 0, H - 0.6, z));
  for (const x of [-5.2, 5.2]) root.add(box(0.4, 0.45, Z_FRONT - Z_BACK, lacquer, x, H - 0.7, (Z_FRONT + Z_BACK) / 2));

  // cột gỗ sơn son, đai vàng
  for (const c of MAPS.cd.circles.filter((o) => o.kind === 'column')) {
    root.add(cyl(0.34, 0.38, H, lacquer, c.x, H / 2, c.z, 18));
    for (const y of [0.25, 3.2, H - 1.1]) root.add(cyl(0.4, 0.4, 0.14, gold, c.x, y, c.z, 18));
  }
  // câu đối trên hai cột gần bàn thờ
  [['TỪ BI HỶ XẢ', -5.2], ['PHẬT PHÁP NHIỆM MẦU', 5.2]].forEach(([txt, x]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.8), new THREE.MeshStandardMaterial({ map: verticalSign(txt), roughness: 0.6 }));
    s.position.set(x, 4.6, -5.5 + 0.4); root.add(s);
  });

  // bệ thờ 3 tầng
  const tiers = [[22, 0.7, -8.6, 2], [20, 1.5, -10.8, 2.4], [15, 2.4, -13.6, 3.2]];
  for (const [w, h, z, d] of tiers) {
    root.add(box(w, h, d, lacquer, 0, h / 2, z));
    root.add(box(w + 0.1, 0.08, d + 0.1, gold, 0, h, z), box(w + 0.05, 0.12, 0.05, gold, 0, h * 0.5, z + d / 2 + 0.01));
  }
  // phông hào quang (ảnh) sau 3 tượng Phật
  const haloTex = textureOr('/textures/hao-quang.png', haloFallback());
  const haloMat = new THREE.MeshStandardMaterial({ map: haloTex, transparent: true, roughness: 0.5, emissive: '#3a2008', emissiveMap: haloTex, emissiveIntensity: 0.6 });
  const halos = [];
  for (const x of [-4, 0, 4]) {
    const h = plane(x === 0 ? 4.6 : 4.0, x === 0 ? 4.6 : 4.0, haloMat, x, x === 0 ? 5.7 : 5.3, Z_BACK + 0.05, 0); // tâm hào quang ngang đầu tượng
    root.add(h);
    halos.push(h);
  }
  // Tam Thế Phật (quá khứ – hiện tại – vị lai)
  [[-4, 1, 1.0], [0, 0, 1.15], [4, 2, 1.0]].forEach(([x, v, s]) => {
    const b = makeSeatedBuddha(v);
    b.scale.setScalar(s);
    // ảnh tượng thật (ChatGPT vẽ); tượng ghép khối chỉ hiện khi chưa tải được ảnh
    const card = statueCard({ url: '/textures/statues/phat.webp', height: 3.7 * s, fallback: b, glow: 0.5, maxTurn: 0.55 });
    card.position.set(x, 2.4, -14);
    root.add(card);
  });
  // Quan Âm (trái) và Địa Tạng (phải) ở tầng giữa
  const qa = statueCard({ url: '/textures/statues/quanam.webp', height: 3.7, fallback: makeStandingBodhisattva('quanam'), glow: 0.45, maxTurn: 0.9 });
  qa.position.set(-7.6, 1.5, -10.9); qa.rotation.y = 0.25; root.add(qa);
  const dt = statueCard({ url: '/textures/statues/diatang.webp', height: 3.8, fallback: makeStandingBodhisattva('diatang'), glow: 0.45, maxTurn: 0.9 });
  dt.position.set(7.6, 1.5, -10.9); dt.rotation.y = -0.25; root.add(dt);
  // hoành phi trên cao
  const big = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2), new THREE.MeshStandardMaterial({ map: signTexture('ĐẠI HÙNG BẢO ĐIỆN'), roughness: 0.55 }));
  big.position.set(0, 7.25, Z_BACK + 0.08); root.add(big);

  // ban thờ phụ hai bên (lư trầm + đèn)
  for (const sx of [-1, 1]) {
    const x = sx * 10.25;
    root.add(box(2.6, 1.0, 3.0, lacquer, x, 0.5, -6), box(2.7, 0.06, 3.1, gold, x, 1.02, -6));
    root.add(cyl(0.18, 0.14, 0.25, M('bronze', '#5b4630', { metalness: 0.6, roughness: 0.45 }), x, 1.17, -6, 14));
    root.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), M('cd-lampglow', '#ffd38a', { emissive: '#ffb84a', emissiveIntensity: 1.2 })).translateX(x).translateY(1.5).translateZ(-7));
  }

  // bàn hương án
  const table = makeTable();
  table.group.position.set(0, 0, -6.55);
  root.add(table.group);

  // bồ đoàn (đệm lạy) – vị trí "Lễ Phật"
  const cushions = new THREE.Group();
  for (const [x, z] of [[-1.3, -4.4], [0, -4.4], [1.3, -4.4], [-1.95, -3.1], [-0.65, -3.1], [0.65, -3.1], [1.95, -3.1]]) {
    const c = makeCushion();
    c.position.set(x, 0, z);
    cushions.add(c);
  }
  root.add(cushions);

  // Hộ Pháp hai bên cửa
  // Hộ Pháp gác cửa: Khuyến Thiện (trái, hiền) và Trừng Ác (phải, dữ) – nhìn ra lối giữa
  const g1 = statueCard({ url: '/textures/statues/hophap-thien.webp', height: 3.9, fallback: makeGuardian(false), glow: 0.4 });
  g1.position.set(-6.6, 0, 7.4); g1.rotation.y = Math.PI / 2 - 0.4; root.add(g1);
  const g2 = statueCard({ url: '/textures/statues/hophap-ac.webp', height: 3.9, fallback: makeGuardian(true), glow: 0.4 });
  g2.position.set(6.6, 0, 7.4); g2.rotation.y = -(Math.PI / 2 - 0.4); root.add(g2);

  // trống, chuông
  const drum = makeDrum(); drum.position.set(-9.6, 0, 2.5); root.add(drum);
  const bigBell = makeBigBell(); bigBell.position.set(9.6, 0, 2.5); bigBell.rotation.y = Math.PI / 2; root.add(bigBell);

  // phướn ngũ sắc treo dọc hai bên + đèn lồng
  const banners = [];
  const colors = ['#2f5e8a', '#e2b33a', '#a8261a', '#f2efe6', '#e07a2e'];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -12 + i * 4.2;
      const pivot = new THREE.Group();
      pivot.position.set(sx * 7.6, H - 0.6, z);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2), new THREE.MeshStandardMaterial({ color: colors[i], side: THREE.DoubleSide, roughness: 0.8 }));
      b.position.y = -1.6;
      b.rotation.y = Math.PI / 2;
      const tassel = box(0.75, 0.12, 0.05, gold, 0, -3.25, 0);
      tassel.rotation.y = Math.PI / 2;
      pivot.add(b, tassel);
      root.add(pivot);
      banners.push(pivot);
    }
  }
  const lanternMat = M('cd-lantern', '#d23a26', { emissive: '#b8281a', emissiveIntensity: 1.0, roughness: 0.5 });
  const lanterns = [];
  for (const [x, z] of [[-2.6, -1.5], [2.6, -1.5], [-2.6, 4.5], [2.6, 4.5]]) {
    const g = new THREE.Group();
    g.add(cyl(0.01, 0.01, 1.2, M('rope', '#c9b48a'), 0, -0.6, 0, 4));
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), lanternMat);
    l.scale.y = 1.25; l.position.y = -1.6;
    g.add(l, cyl(0.18, 0.18, 0.08, gold, 0, -1.1, 0, 12), cyl(0.18, 0.18, 0.08, gold, 0, -2.1, 0, 12));
    g.position.set(x, H, z);
    root.add(g);
    lanterns.push(g);
  }

  // khói trầm từ bát hương (hạt Points)
  const N = 50, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), life = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const smokeTex = canvasTex(64, 64, (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); });
  const smoke = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.45, map: smokeTex, transparent: true, opacity: 0.3, depthWrite: false, color: '#efe6d6' }));
  smoke.position.set(0, 1.8, -6.55);
  root.add(smoke);

  let flash = 0;
  return {
    groundMeshes: [floor, carpet],
    interactables: [{ kind: 'le', object: cushions }, { kind: 'le', object: table.group }],
    /** Hiệu ứng khi có người lễ Phật: hào quang sáng bừng lên rồi dịu lại */
    flash() { flash = 1; },
    update(dt, t) {
      for (const [i, p] of banners.entries()) p.rotation.x = Math.sin(t * 0.7 + i) * 0.04;
      for (const [i, l] of lanterns.entries()) l.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.03;
      for (const [i, f] of table.flames.entries()) f.scale.set(1, 0.85 + Math.sin(t * 13 + i * 2) * 0.15 + Math.random() * 0.05, 1);
      altarLight.intensity = 28 + Math.sin(t * 7) * 1.5 + flash * 40;
      flash = Math.max(0, flash - dt * 0.6);
      haloMat.emissiveIntensity = 0.6 + flash * 1.2;
      for (let i = 0; i < N; i++) {
        life[i] += dt * 0.22;
        if (life[i] > 1) life[i] = 0;
        const l = life[i];
        pos[i * 3] = Math.sin(t * 0.7 + i) * 0.18 * l;
        pos[i * 3 + 1] = l * 2.6;
        pos[i * 3 + 2] = Math.cos(t * 0.5 + i * 1.3) * 0.18 * l;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
