import * as THREE from 'three';
import { DEFAULT_LOOK, STYLES, robeColor } from './shared/looks.js';

// Chú tiểu chibi ghép từ khối cơ bản (không cần file model).
// Material được cache theo màu để hàng trăm nhân vật dùng chung.

const matCache = new Map();
function mat(color, roughness = 0.8) {
  const key = color + roughness;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness }); matCache.set(key, m); }
  return m;
}

const G = {
  robe: new THREE.CylinderGeometry(0.2, 0.36, 0.62, 18),
  collar: new THREE.TorusGeometry(0.17, 0.045, 8, 20),
  sash: new THREE.BoxGeometry(0.07, 0.62, 0.02),
  head: new THREE.SphereGeometry(0.31, 24, 18),
  ear: new THREE.SphereGeometry(0.07, 10, 8),
  eye: new THREE.TorusGeometry(0.045, 0.013, 6, 12, Math.PI),
  cheek: new THREE.SphereGeometry(0.04, 8, 6),
  sleeve: new THREE.SphereGeometry(0.12, 12, 10),
  hand: new THREE.SphereGeometry(0.075, 10, 8),
  foot: new THREE.SphereGeometry(0.08, 10, 8),
  beads: new THREE.TorusGeometry(0.19, 0.02, 6, 24),
};

const SKIN = '#f3cda4';
const DARK = '#2a211b';

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Tạo nhãn chữ (sprite canvas) – nhẹ hơn nhiều so với thẻ DOM khi có hàng trăm người. */
export function makeTextSprite(text, { size = 28, color = '#fff6e4', bg = 'rgba(30,22,15,0.72)', sub = '', maxWidth = 360 } = {}) {
  const pad = 14, dpr = 2;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `600 ${size}px "Be Vietnam Pro", system-ui, sans-serif`;
  const subFont = `400 ${Math.round(size * 0.7)}px "Be Vietnam Pro", system-ui, sans-serif`;

  // xuống dòng nếu dài (dùng cho bong bóng chat)
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  let w = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (sub) { ctx.font = subFont; w = Math.max(w, ctx.measureText(sub).width); }
  const lh = size * 1.25;
  const h = lines.length * lh + (sub ? size * 0.95 : 0) + pad;

  c.width = (w + pad * 2) * dpr;
  c.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = bg;
  const r = Math.min(16, h / 2);
  ctx.beginPath();
  ctx.roundRect(0, 0, w + pad * 2, h, r);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = font;
  ctx.fillStyle = color;
  lines.forEach((l, i) => ctx.fillText(l, (w + pad * 2) / 2, pad / 2 + i * lh));
  if (sub) {
    ctx.font = subFont;
    ctx.fillStyle = '#e8c482';
    ctx.fillText(sub, (w + pad * 2) / 2, pad / 2 + lines.length * lh);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const scale = 0.0065;
  sprite.scale.set((c.width / dpr) * scale, (c.height / dpr) * scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Chổi tre: cán dài + bó tre ở đầu. Gốc nhóm nằm ở tay cầm, cán chéo xuống đất phía trước-phải. */
function makeBroom() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.0, 6), mat('#a77b45', 0.7));
  handle.position.y = -0.36;
  inner.add(handle);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), mat('#6b4a22', 0.8));
  tie.position.y = -0.82;
  const bristle = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 10, 1, true), mat('#c9a65a', 0.9));
  bristle.position.y = -0.98;
  // nón mặc định: đáy rộng ở dưới, đầu nhọn phía trên (chỗ buộc) – đúng dáng bó chổi
  bristle.scale.z = 0.45; // bó chổi dẹt
  inner.add(tie, bristle);
  // nghiêng cán: từ tay xuống mặt đất trước mặt, lệch phải
  inner.rotation.set(-0.96, 0, 0.3); // tính để đầu chổi vừa chạm đất (tay cầm cao ~0.5 m)
  inner.scale.setScalar(0.75);
  g.add(inner);
  return g;
}

/** Chuỗi tràng hạt cầm tay: vòng hạt nâu + quả tua đỏ */
function makeHandBeads() {
  const g = new THREE.Group();
  const bead = new THREE.SphereGeometry(0.018, 6, 5);
  const m = mat('#6b3f22', 0.45);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const b = new THREE.Mesh(bead, i === 0 ? mat('#c9a24a', 0.4) : m);
    b.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.11, 0);
    g.add(b);
  }
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), mat('#b3261e', 0.7));
  tassel.position.set(0, -0.16, 0);
  g.add(tassel);
  return g;
}

/** Hình khối dùng chung (không dispose khi đổi trang phục) */
const SHARED_GEO = new Set(Object.values(G));
const darker = (hex, k = 0.72) => new THREE.Color(hex).multiplyScalar(k).getStyle();
const own = (geo, material, x, y, z) => mesh(geo, material, x, y, z); // khối riêng của bộ đồ (sẽ dispose)

/** Dựng bộ đồ theo ngoại hình. Trả về { outfit (gắn vào thân), hair (gắn vào đầu), neckBeads } */
function buildOutfit(look) {
  const outfit = new THREE.Group();
  const hair = new THREE.Group();
  const color = robeColor(look);
  const robe = mat(color);
  const robeDark = mat(darker(color));
  const skin = mat(SKIN);
  const nu = look.g === 'nu';
  const S = STYLES[look.style] ? look.style : 'tieu';

  const sleeves = (sx = 1, sy = 1, y = 0.5, x = 0.24) => {
    for (const side of [-1, 1]) { const m = mesh(G.sleeve, robe, side * x, y, 0.06); m.scale.set(sx, sy, sx); outfit.add(m); }
  };
  // dải vải chạy trên mặt áo (cổ chéo, dây thắt, khăn cà sa); tilt = độ nghiêng theo thân áo loe
  const strip = (w, h, m, x, y, z, rz, tilt = -0.29) => { const b = own(new THREE.BoxGeometry(w, h, 0.02), m, x, y, z); b.rotation.set(tilt, 0, rz); outfit.add(b); return b; };
  const legs = (r0, r1) => {
    const pm = mat(look.pants);
    for (const side of [-1, 1]) outfit.add(own(new THREE.CylinderGeometry(r0, r1, 0.34, 12), pm, side * 0.1, 0.19, 0));
  };

  if (S === 'tieu') {
    outfit.add(mesh(G.robe, robe, 0, 0.36, 0));
    const collar = mesh(G.collar, robeDark, 0, 0.66, 0); collar.rotation.x = Math.PI / 2; outfit.add(collar);
    strip(0.07, 0.62, robeDark, 0.04, 0.38, 0.27, 0.55, -0.3);
    sleeves();
  } else if (S === 'trang' || S === 'nau') {
    outfit.add(own(new THREE.CylinderGeometry(0.21, 0.4, 0.64, 20), robe, 0, 0.35, 0));
    // cổ áo giao nhau hình chữ V
    strip(0.045, 0.3, robeDark, -0.045, 0.55, 0.25, -0.45);
    strip(0.045, 0.3, robeDark, 0.045, 0.55, 0.25, 0.45);
    sleeves(1.3, 1.55, 0.46, 0.26); // tay áo thụng
  } else if (S === 'casa') {
    outfit.add(own(new THREE.CylinderGeometry(0.21, 0.4, 0.64, 20), robe, 0, 0.35, 0));
    const drape = mat('#b5641a');
    strip(0.13, 0.72, drape, 0.0, 0.4, 0.27, 0.62); // vạt cà sa đắp chéo từ vai trái xuống hông phải
    const sh = own(new THREE.SphereGeometry(0.13, 12, 10), drape, -0.17, 0.64, 0.02); sh.scale.set(1.1, 0.6, 1.1); outfit.add(sh);
    sleeves(1.1, 1.2);
  } else if (S === 'baba') {
    outfit.add(own(new THREE.CylinderGeometry(0.2, 0.28, 0.34, 18), robe, 0, 0.5, 0));
    const collar = mesh(G.collar, robeDark, 0, 0.67, 0); collar.rotation.x = Math.PI / 2; collar.scale.setScalar(0.85); outfit.add(collar);
    const btn = mat('#f4ecd8', 0.4);
    for (let i = 0; i < 3; i++) outfit.add(own(new THREE.SphereGeometry(0.016, 6, 5), btn, 0, 0.6 - i * 0.08, 0.215 + i * 0.019));
    legs(0.085, 0.1);
    sleeves(0.95, 1.15, 0.52);
  } else if (S === 'aodai') {
    outfit.add(own(new THREE.CylinderGeometry(nu ? 0.18 : 0.19, nu ? 0.2 : 0.22, 0.32, 18), robe, 0, 0.53, 0));
    outfit.add(own(new THREE.CylinderGeometry(0.1, 0.115, 0.07, 14), robeDark, 0, 0.705, 0)); // cổ đứng
    // hai tà áo trước / sau buông dài
    for (const side of [1, -1]) {
      const ta = own(new THREE.BoxGeometry(nu ? 0.26 : 0.3, 0.44, 0.02), robe, 0, 0.2, side * 0.165);
      ta.rotation.x = side * 0.05;
      outfit.add(ta);
    }
    // đường viền chéo cài khuy bên phải (áo dài truyền thống)
    strip(0.025, 0.16, robeDark, 0.08, 0.63, 0.19, 0.9, -0.1);
    legs(0.1, 0.125); // quần ống rộng
    sleeves(0.85, 1.3, 0.52, 0.22);
  }
  // bàn tay chắp
  outfit.add(mesh(G.hand, skin, -0.05, 0.52, 0.27), mesh(G.hand, skin, 0.05, 0.52, 0.27));

  // tóc (nữ): mái + búi sau gáy, chừa khuôn mặt
  if (nu) {
    const hm = mat('#2b1d16', 0.55);
    const cap = own(new THREE.SphereGeometry(0.33, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hm, 0, 0.0, -0.02);
    cap.rotation.x = -0.3; // ngả ra sau để lộ mặt, phủ kín gáy
    hair.add(cap);
    const bangs = own(new THREE.SphereGeometry(0.2, 16, 10), hm, 0, 0.17, 0.21); // mái thưa trước trán
    bangs.scale.set(1.45, 0.5, 0.65);
    hair.add(bangs);
    for (const sx of [-1, 1]) { // tóc mai hai bên má
      const lock = own(new THREE.SphereGeometry(0.1, 10, 8), hm, sx * 0.27, -0.02, 0.06);
      lock.scale.set(0.55, 1.5, 0.75);
      hair.add(lock);
    }
    if (!look.acc.includes('non')) {
      const bun = own(new THREE.SphereGeometry(0.125, 14, 10), hm, 0, 0.17, -0.3);
      hair.add(bun);
      const pin = own(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), mat('#c9a24a', 0.4), 0, 0.2, -0.3);
      pin.rotation.z = 1.2;
      hair.add(pin);
    }
  }

  // phụ kiện
  let neckBeads = null;
  for (const a of look.acc) {
    if (a === 'beadsNeck') {
      neckBeads = mesh(G.beads, mat('#5a3a22', 0.5), 0, 0.62, 0.05);
      neckBeads.rotation.x = Math.PI / 2 - 0.5;
      outfit.add(neckBeads);
    } else if (a === 'beadsWrist') {
      const w = own(new THREE.TorusGeometry(0.05, 0.014, 6, 16), mat('#5a3a22', 0.45), -0.07, 0.51, 0.26);
      w.rotation.y = Math.PI / 2;
      outfit.add(w);
    } else if (a === 'non') {
      const non = own(new THREE.ConeGeometry(0.46, 0.22, 28, 1, true), mat('#e3cf95', 0.75), 0, 0.28, 0);
      non.material.side = THREE.DoubleSide;
      hair.add(non);
    } else if (a === 'khan') {
      // khăn vấn / khăn đóng quấn quanh đầu, ngang trán
      const k = own(new THREE.TorusGeometry(0.29, 0.055, 10, 28), mat(nu ? '#7a2a2a' : '#26262c', 0.6), 0, 0.1, -0.02);
      k.rotation.x = Math.PI / 2 + 0.18;
      hair.add(k);
    } else if (a === 'tui') {
      const bag = mat('#9b7a4e', 0.85);
      strip(0.03, 0.64, bag, 0.02, 0.45, 0.26, -0.75);
      const b = own(new THREE.BoxGeometry(0.17, 0.16, 0.07), bag, 0.27, 0.3, 0.06);
      b.rotation.y = 0.5;
      outfit.add(b);
    } else if (a === 'quat') {
      const fan = own(new THREE.CircleGeometry(0.13, 14, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.7, side: THREE.DoubleSide }), 0.2, 0.42, 0.22);
      fan.rotation.set(-0.3, 0.5, -0.5);
      outfit.add(fan);
    } else if (a === 'sen') {
      const pm = mat('#f2a3b8', 0.5);
      for (let i = 0; i < 5; i++) {
        const pt = own(new THREE.ConeGeometry(0.025, 0.06, 6), pm, -0.13 + Math.cos(i * 1.26) * 0.02, 0.6, 0.235 + Math.sin(i * 1.26) * 0.01);
        pt.rotation.z = (i - 2) * 0.35;
        outfit.add(pt);
      }
      outfit.add(own(new THREE.SphereGeometry(0.014, 6, 5), mat('#f2c14e', 0.5), -0.13, 0.6, 0.245));
    }
  }
  if (nu) outfit.scale.set(0.95, 1, 0.95);
  return { outfit, hair, neckBeads };
}

export class Monk {
  constructor({ name = 'Khách', look = null, color = '#c98a3a', isMe = false, sub = 'Sơ tâm' } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    // đầu
    this.head = new THREE.Group();
    this.head.position.y = 0.98;
    this.body.add(this.head);
    this.head.add(mesh(G.head, mat(SKIN, 0.6)));
    this.head.add(mesh(G.ear, mat(SKIN), -0.3, -0.03, 0), mesh(G.ear, mat(SKIN), 0.3, -0.03, 0));
    for (const sx of [-1, 1]) {
      const eye = mesh(G.eye, mat(DARK, 0.4), sx * 0.11, -0.01, 0.285);
      eye.rotation.z = Math.PI; // mắt nhắm cười
      eye.castShadow = false;
      this.head.add(eye);
      const cheek = mesh(G.cheek, mat('#ee9e94'), sx * 0.18, -0.09, 0.25);
      cheek.scale.set(1, 0.6, 0.4);
      cheek.castShadow = false;
      this.head.add(cheek);
    }
    const mouth = mesh(G.eye, mat('#8a3b25'), 0, -0.12, 0.29);
    mouth.scale.setScalar(0.6);
    mouth.rotation.z = Math.PI;
    mouth.castShadow = false;
    this.head.add(mouth);

    // chân
    this.footL = mesh(G.foot, mat(DARK), -0.11, 0.05, 0.05);
    this.footR = mesh(G.foot, mat(DARK), 0.11, 0.05, 0.05);
    this.footL.scale.set(1, 0.6, 1.4);
    this.footR.scale.set(1, 0.6, 1.4);
    this.root.add(this.footL, this.footR);

    // vòng sáng dưới chân cho nhân vật của mình
    if (isMe) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 32),
        new THREE.MeshBasicMaterial({ color: '#f2c96b', transparent: true, opacity: 0.6, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.root.add(ring);
    }

    // nén nhang cầm trên tay khi thắp hương (ẩn bình thường)
    this.incense = new THREE.Group();
    const stickMat = mat('#a2342a');
    for (const dx of [-0.025, 0, 0.025]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 4), stickMat);
      s.position.set(dx, 0.2, 0);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff9a4a' }));
      tip.position.set(dx, 0.42, 0);
      this.incense.add(s, tip);
    }
    this.incense.position.set(0, 0.55, 0.3);
    this.incense.visible = false;
    this.body.add(this.incense);

    // chổi tre (khi quét lá): treo ở tay, đầu chổi chạm đất phía trước
    this.broom = makeBroom();
    this.broom.position.set(0.04, 0.5, 0.27);
    this.broom.visible = false;
    this.body.add(this.broom);

    // tràng hạt cầm tay (khi lần chuỗi) – chuỗi đeo cổ ẩn đi
    this.handBeads = makeHandBeads();
    this.handBeads.position.set(0, 0.44, 0.3);
    this.handBeads.visible = false;
    this.body.add(this.handBeads);
    this.pose = null;

    this.setLook(look || { ...DEFAULT_LOOK, color });

    this.name = name;
    this.isMe = isMe;
    this.setName(name, sub);
    this.action = null; // { type, t, dur }
    this.bubble = null;
    this.bubbleUntil = 0;
    this.phase = Math.random() * 10;
    this.moveState = 0;
  }

  /** Đổi trang phục / giới tính / phụ kiện (dựng lại phần áo và tóc, giữ nguyên mặt và hoạt ảnh) */
  setLook(look) {
    for (const g of [this.outfit, this.hair]) {
      if (!g) continue;
      g.removeFromParent();
      g.traverse((o) => { if (o.isMesh && !SHARED_GEO.has(o.geometry)) o.geometry.dispose(); });
    }
    const built = buildOutfit(look);
    this.look = look;
    this.outfit = built.outfit;
    this.hair = built.hair;
    this.neckBeads = built.neckBeads;
    this.body.add(this.outfit);
    this.head.add(this.hair);
    this.setPose(this.pose);
  }

  /** sub: dòng phụ dưới tên, thường là cấp tu */
  setName(name, sub) {
    if (this.label) { this.root.remove(this.label); this.label.material.map.dispose(); this.label.material.dispose(); }
    this.name = name;
    this.label = makeTextSprite(name, { size: 26, sub: this.isMe ? `${sub} · Bạn` : sub });
    this.label.position.y = 1.62;
    this.root.add(this.label);
  }

  say(text) {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    this.bubble = makeTextSprite(text, { size: 26, bg: 'rgba(255,248,232,0.95)', color: '#2a1d10', maxWidth: 320 });
    this.bubble.center.set(0.5, 0);
    this.bubble.position.y = 2.0;
    this.root.add(this.bubble);
    this.bubbleUntil = performance.now() + 5000;
  }

  /** Chạy động tác: 'incense' (cầm nhang vái 3 lần), 'bell' (thỉnh chuông), 'le' (chắp tay lạy Phật 3 lạy), 'pat' / 'feed' (chăm linh thú) */
  play(type) {
    this.action = { type, t: 0, dur: type === 'incense' ? 3.6 : type === 'le' ? 4.2 : type === 'pat' ? 1.2 : type === 'feed' ? 1.4 : 1.4 };
    this.incense.visible = type === 'incense';
  }

  get busy() { return !!this.action; }

  /** Cầm / cất chổi */
  holdBroom(on) { this.broom.visible = !!on; this.broomOn = !!on; }

  /** 'beads' = cầm tràng hạt lần chuỗi, null = bình thường */
  setPose(pose) {
    this.pose = pose || null;
    this.handBeads.visible = this.pose === 'beads';
    if (this.neckBeads) this.neckBeads.visible = this.pose !== 'beads';
    if (!this.pose) this.head.rotation.x = 0;
  }

  /** Lần một hạt: hạt trên tay khẽ trượt (chỉ là hiệu ứng) */
  beadTick() { this.beadKick = 1; }

  _animateAction(dt) {
    const a = this.action;
    a.t += dt;
    const p = a.t / a.dur;
    this.footL.position.z = this.footR.position.z = 0.05;
    this.body.position.y = 0;
    this.body.rotation.z = 0;
    if (a.type === 'incense') {
      // nâng nhang lên trán rồi vái 3 lần
      const bows = Math.max(0, Math.sin(Math.min(1, p * 1.05) * Math.PI * 3));
      this.body.rotation.x = bows * 0.45;
      this.incense.position.y = 0.55 + Math.min(1, a.t * 3) * 0.15;
    } else if (a.type === 'le') {
      // 3 lạy: mỗi lạy hạ thấp người (quỳ) rồi cúi sâu, đứng lên
      const k = Math.max(0, Math.sin(Math.min(1, p * 1.04) * Math.PI * 3));
      const e = k * k * (3 - 2 * k); // làm mềm hai đầu
      this.body.position.y = -e * 0.22;
      this.body.rotation.x = e * 0.85;
      this.footL.position.z = this.footR.position.z = 0.05 - e * 0.12;
    } else if (a.type === 'pat' || a.type === 'feed') {
      // cúi xuống xoa đầu / đặt bát thức ăn
      this.body.rotation.x = Math.sin(Math.min(1, p) * Math.PI) * 0.55;
    } else {
      // ngả người kéo dây rồi đẩy khúc gỗ vào chuông
      const t = a.t;
      this.body.rotation.x = t < 0.35 ? -(t / 0.35) * 0.25 : -0.25 + Math.min(1, (t - 0.35) / 0.12) * 0.55 - Math.max(0, t - 0.47) * 0.3;
      this.body.rotation.x = Math.max(-0.25, Math.min(0.3, this.body.rotation.x));
    }
    if (a.t >= a.dur) {
      this.action = null;
      this.incense.visible = false;
      this.body.rotation.x = 0;
      this.body.position.y = 0;
    }
  }

  /** @param {number} dt  @param {number} m  0 đứng, 1 đi, 2 chạy */
  animate(dt, m) {
    this.moveState = m;
    if (this.action) { this._animateAction(dt); this._bubbleTick(); return; }
    // chổi: đi tới đâu đưa chổi qua lại tới đó; đứng yên thì chổi dựng nghỉ
    if (this.broomOn) {
      this.sweepPhase = (this.sweepPhase || 0) + dt * (m ? 7 : 0);
      const target = m ? Math.sin(this.sweepPhase) * 0.55 : 0;
      this.broom.rotation.y += (target - this.broom.rotation.y) * Math.min(1, dt * 12);
    }
    if (this.pose === 'beads') {
      // cúi đầu niệm, hạt trên tay nhích theo mỗi lần lần chuỗi
      this.head.rotation.x += (0.18 - this.head.rotation.x) * Math.min(1, dt * 6);
      this.beadKick = Math.max(0, (this.beadKick || 0) - dt * 5);
      this.handBeads.rotation.z = (this.handBeads.rotation.z || 0) + this.beadKick * dt * 3;
      this.handBeads.position.y = 0.44 - this.beadKick * 0.015;
    }
    const speed = m === 2 ? 15 : m === 1 ? 9 : 0;
    if (speed) {
      this.phase += dt * speed;
      const s = Math.sin(this.phase);
      this.body.position.y = Math.abs(s) * 0.07;
      this.body.rotation.z = s * 0.07;
      this.body.rotation.x = m === 2 ? 0.12 : 0.04;
      this.footL.position.z = 0.05 + s * 0.14;
      this.footR.position.z = 0.05 - s * 0.14;
    } else {
      // thở nhẹ khi đứng yên
      this.phase += dt * 2;
      this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, 0, 0.2);
      this.body.rotation.z *= 0.8;
      this.body.rotation.x *= 0.8;
      this.head.position.y = 0.98 + Math.sin(this.phase) * 0.008;
      this.footL.position.z = THREE.MathUtils.lerp(this.footL.position.z, 0.05, 0.2);
      this.footR.position.z = THREE.MathUtils.lerp(this.footR.position.z, 0.05, 0.2);
    }
    this._bubbleTick();
  }

  _bubbleTick() {
    if (this.bubble && performance.now() > this.bubbleUntil) {
      this.root.remove(this.bubble);
      this.bubble.material.map.dispose();
      this.bubble.material.dispose();
      this.bubble = null;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); }
    });
    this.root.removeFromParent();
  }
}
