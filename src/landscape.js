import * as THREE from 'three';
import { M, box, cyl, roof, signTexture } from './temple.js';
import { CIRCLES, INTERACT, FLOWER_BEDS } from './shared/world.js';
import { statueCard } from './statues.js';

// Cảnh quan quanh sân chùa: sân trước cổng tam quan (hồ sen, tượng Quan Âm, thủy đình, cầu gỗ, nghi môn),
// bảo tháp, nhà Tổ / nhà khách, rặng trúc, cây tùng, đèn đá, chậu bonsai, ghế đá, luống hoa, núi xa.
// Mọi thứ vẽ bằng khối cơ bản; vật thể lặp nhiều (lá sen, trúc, hoa) dùng InstancedMesh cho nhẹ.

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); // cố định để mọi người thấy giống nhau

function shadowAll(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

// ───────────────────────── Mặt đất sân trước ─────────────────────────
function buildForecourt(root) {
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(36, 20), M('gravel', '#cbbd9f', { roughness: 1 }));
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set(0, 0.004, 30);
  gravel.receiveShadow = true;
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 20), M('path', '#d8ccb4'));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.008, 30);
  path.receiveShadow = true;
  // gạch viền lối đi
  const edge = M('stone', '#9d8f7b');
  for (const sx of [-1, 1]) root.add(box(0.25, 0.08, 20, edge, sx * 2.3, 0.04, 30));
  root.add(gravel, path);
  return [gravel, path];
}

// ───────────────────────── Hồ sen ─────────────────────────
function buildPond(root, x0, x1, z0, z1, waterMats) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const rim = M('pondrim', '#8f826d', { roughness: 0.9 });
  root.add(box(w + 0.6, 0.35, 0.3, rim, cx, 0.17, z0), box(w + 0.6, 0.35, 0.3, rim, cx, 0.17, z1));
  root.add(box(0.3, 0.35, d, rim, x0, 0.17, cz), box(0.3, 0.35, d, rim, x1, 0.17, cz));
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M('pondbed', '#3e5a4a'));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(cx, -0.25, cz);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), waterMats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, 0.08, cz);
  water.receiveShadow = true;
  root.add(bottom, water);

  // lá sen + hoa sen (instanced)
  const nLeaf = Math.round(w * d * 0.55);
  const leaves = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 14, 1, false, 0.3, Math.PI * 2 - 0.3), M('lotusleaf', '#4f8a3c', { roughness: 0.7 }), nLeaf);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  for (let i = 0; i < nLeaf; i++) {
    pos.set(x0 + 0.5 + rnd() * (w - 1), 0.1 + rnd() * 0.02, z0 + 0.5 + rnd() * (d - 1));
    e.set((rnd() - 0.5) * 0.15, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.15);
    const s = 0.6 + rnd() * 0.8;
    leaves.setMatrixAt(i, m4.compose(pos, q.setFromEuler(e), sc.set(s, 1, s)));
  }
  leaves.receiveShadow = true;
  root.add(leaves);

  const nFlower = Math.round(nLeaf / 4);
  const petals = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.3, 7, 1, true), M('lotuspetal', '#f2a3b8', { roughness: 0.5, side: THREE.DoubleSide }), nFlower * 2);
  const buds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), M('lotusheart', '#f4d36b', { roughness: 0.5 }), nFlower);
  for (let i = 0; i < nFlower; i++) {
    pos.set(x0 + 0.6 + rnd() * (w - 1.2), 0.32 + rnd() * 0.2, z0 + 0.6 + rnd() * (d - 1.2));
    // hai lớp cánh: một lớp úp ngược (bung), một lớp chụm
    petals.setMatrixAt(i * 2, m4.compose(pos, q.setFromEuler(e.set(Math.PI, rnd() * 6, 0)), sc.set(1.4, 0.8, 1.4)));
    petals.setMatrixAt(i * 2 + 1, m4.compose(pos.clone().add(new THREE.Vector3(0, 0.05, 0)), q.setFromEuler(e.set(0, rnd() * 6, 0)), sc.set(0.9, 0.9, 0.9)));
    buds.setMatrixAt(i, m4.compose(pos.clone().add(new THREE.Vector3(0, 0.02, 0)), q.identity(), sc.set(1, 1, 1)));
  }
  petals.castShadow = true;
  root.add(petals, buds);
  return water;
}

/** Tượng Quan Âm Bồ Tát đứng trên tòa sen giữa hồ: áo trắng, tay cầm tịnh bình */
export function makeQuanAm(scale = 1) {
  const g = new THREE.Group();
  const white = M('qa-robe', '#f4f1ea', { roughness: 0.55 });
  const skin = M('qa-skin', '#f1e3cf', { roughness: 0.5 });
  const gold = M('gold', '#d9a93c', { metalness: 0.55, roughness: 0.35, emissive: '#3a2506' });
  const lotus = M('lotus', '#d87d8a', { roughness: 0.6 });
  // tòa sen
  g.add(cyl(0.7, 0.8, 0.3, M('stone', '#9d8f7b'), 0, 0.15, 0, 24));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), lotus);
    p.position.set(Math.cos(a) * 0.62, 0.42, Math.sin(a) * 0.62);
    p.scale.set(0.6, 0.55, 1.1);
    p.lookAt(0, 0.42, 0);
    g.add(p);
  }
  // thân áo dài (lathe), vai, đầu
  const prof = [[0.42, 0], [0.4, 0.4], [0.34, 1.0], [0.3, 1.5], [0.33, 1.9], [0.2, 2.15], [0.12, 2.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), white);
  robe.position.y = 0.5;
  g.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), skin);
  head.position.y = 2.88;
  g.add(head);
  // khăn choàng đầu trắng
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), white);
  hood.position.y = 2.9;
  hood.rotation.x = -0.25;
  g.add(hood);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 8), gold);
  crown.position.y = 3.15;
  g.add(crown);
  // tay trái cầm tịnh bình ngang ngực, tay phải buông cành dương liễu
  const vase = new THREE.Group();
  vase.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), M('vase', '#e9e4d6', { roughness: 0.3 })));
  const neck = cyl(0.025, 0.035, 0.14, M('vase', '#e9e4d6', { roughness: 0.3 }), 0, 0.11, 0, 10);
  vase.add(neck);
  vase.position.set(-0.22, 1.95, 0.3);
  g.add(vase, new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin).translateX(-0.22).translateY(1.85).translateZ(0.28));
  const willow = cyl(0.008, 0.008, 0.5, M('leaf', '#4f7a3a'), 0.25, 1.65, 0.28, 5);
  willow.rotation.z = 0.2;
  g.add(willow);
  // hào quang sau đầu
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 32), M('halo', '#ffd77a', { emissive: '#ffb84a', emissiveIntensity: 0.8 }));
  halo.position.set(0, 2.92, -0.18);
  g.add(halo);
  g.scale.setScalar(scale);
  return shadowAll(g);
}

function buildPonds(root) {
  const waterMats = { water: new THREE.MeshStandardMaterial({ color: '#4f8f8c', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 }) };
  const w1 = buildPond(root, -16, -3.6, 23, 36, waterMats);
  const w2 = buildPond(root, 3.6, 16, 23, 36, waterMats);

  // đảo đá + tượng Quan Âm giữa hồ trái
  const isle = new THREE.Group();
  const rock = M('rock', '#857a68', { roughness: 1, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rnd() * 0.5, 0), rock);
    const a = (i / 7) * Math.PI * 2;
    r.position.set(Math.cos(a) * 1.1, 0.05, Math.sin(a) * 1.1);
    r.scale.y = 0.55;
    isle.add(r);
  }
  isle.add(cyl(1.25, 1.4, 0.4, rock, 0, 0.15, 0, 10));
  // tượng Quan Âm lộ thiên: ảnh tượng đá trắng (ChatGPT vẽ), ngoài nắng nên ít tự sáng hơn
  const qa = statueCard({ url: '/textures/statues/quanam.webp', height: 3.4, fallback: makeQuanAm(1.05), glow: 0.12, tint: 0.95 });
  qa.position.y = 0.32;
  qa.rotation.y = 0.35; // hướng về lối đi chính
  isle.add(qa);
  isle.position.set(-9.8, 0, 29.5);
  root.add(shadowAll(isle));

  // thủy đình trên đảo hồ phải + cầu gỗ
  const wood = M('bridgewood', '#8a5a36', { roughness: 0.8 });
  const red = M('red', '#9b2d1d');
  const deck = box(6.2, 0.18, 2, wood, 6.7, 0.32, 30);
  root.add(deck);
  for (const sz of [-1, 1]) {
    root.add(box(6.2, 0.08, 0.08, red, 6.7, 1.0, 30 + sz * 0.95));
    for (let x = 3.9; x <= 9.6; x += 0.95) root.add(box(0.1, 0.7, 0.1, red, x, 0.65, 30 + sz * 0.95));
  }
  const isle2 = new THREE.Group();
  isle2.add(box(3.4, 0.35, 3.2, M('stone', '#9d8f7b'), 0, 0.18, 0));
  for (const [x, z] of [[-1.4, -1.3], [1.4, -1.3], [-1.4, 1.3], [1.4, 1.3]]) isle2.add(cyl(0.12, 0.14, 2.6, red, x, 1.65, z, 10));
  const r2 = roof(4.2, 4.0, 1.3, 2.95, 0);
  isle2.add(r2);
  // bàn đá nhỏ giữa đình
  isle2.add(cyl(0.45, 0.35, 0.6, M('stone', '#9d8f7b'), 0, 0.65, 0, 16));
  isle2.position.set(11.5, 0, 30);
  root.add(shadowAll(isle2));
  return [w1, w2];
}

// ───────────────────────── Nghi môn (cổng ngoài) ─────────────────────────
function buildOuterGate(root) {
  const g = new THREE.Group();
  const stone = M('stone', '#9d8f7b');
  const red = M('red', '#9b2d1d');
  for (const sx of [-1, 1]) {
    g.add(box(1.2, 4.4, 1.2, stone, sx * 4, 2.2, 0));
    g.add(box(1.5, 0.4, 1.5, M('cap', '#6b2f22'), sx * 4, 4.6, 0));
    // lân đá giữ cổng
    const lion = new THREE.Group();
    lion.add(box(0.7, 0.4, 0.9, stone, 0, 0.2, 0), new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), stone).translateY(0.75).translateZ(0.15));
    lion.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), stone).translateY(0.45).translateZ(-0.15));
    lion.position.set(sx * 5.4, 0, -0.6);
    g.add(lion);
  }
  g.add(box(9.4, 0.6, 0.9, red, 0, 4.0, 0));
  g.add(roof(10.5, 2.6, 1.3, 4.3, 0));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.85), new THREE.MeshStandardMaterial({ map: signTexture('AN LẠC TỰ'), roughness: 0.6 }));
  sign.position.set(0, 3.45, 0.47);
  g.add(sign);
  const back = sign.clone();
  back.position.z = -0.47;
  back.rotation.y = Math.PI;
  g.add(back);
  g.position.set(0, 0, 39.2);
  root.add(shadowAll(g));
  return g;
}

// ───────────────────────── Bảo tháp 7 tầng ─────────────────────────
function buildStupa(root) {
  const c = CIRCLES.find((o) => o.kind === 'stupa');
  const g = new THREE.Group();
  const stone = M('stupastone', '#c9bca5', { roughness: 0.85 });
  const red = M('cap', '#6b2f22');
  g.add(box(3.2, 0.5, 3.2, M('stone', '#9d8f7b'), 0, 0.25, 0));
  let y = 0.5, w = 2.4;
  for (let i = 0; i < 7; i++) {
    const h = 1.0 - i * 0.07;
    g.add(box(w, h, w, stone, 0, y + h / 2, 0));
    // cửa vòm tối mỗi tầng
    for (const [rx, rz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.28, h * 0.55), M('stupadoor', '#3a2a1e'));
      door.position.set((rx * w) / 2 + rx * 0.01, y + h * 0.45, (rz * w) / 2 + rz * 0.01);
      door.rotation.y = Math.atan2(rx, rz);
      g.add(door);
    }
    y += h;
    const eave = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2 * (w + 0.7), 0.35, 4), red);
    eave.rotation.y = Math.PI / 4;
    eave.position.y = y + 0.1;
    g.add(eave);
    y += 0.25;
    w *= 0.86;
  }
  // chóp
  const gold = M('gold', '#d9a93c', { metalness: 0.55, roughness: 0.35, emissive: '#3a2506' });
  for (let i = 0; i < 4; i++) g.add(cyl(0.14 - i * 0.025, 0.16 - i * 0.025, 0.12, gold, 0, y + 0.1 + i * 0.16, 0, 12));
  g.add(cone(0.06, 0.5, gold, 0, y + 0.95, 0));
  g.position.set(c.x, 0, c.z);
  root.add(shadowAll(g));
}
function cone(r, h, mat, x, y, z) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), mat); m.position.set(x, y, z); return m; }

// ───────────────────────── Nhà Tổ / nhà khách hai bên ─────────────────────────
function buildSideHalls(root) {
  const wallMat = M('wall', '#e6d6b8');
  const red = M('red', '#9b2d1d');
  for (const [sx, name] of [[-1, 'NHÀ TỔ'], [1, 'NHÀ KHÁCH']]) {
    const g = new THREE.Group();
    g.add(box(2.4, 0.4, 12.4, M('stone', '#9d8f7b'), 0, 0.2, 0));
    g.add(box(0.3, 3, 12, wallMat, sx * 0.9, 1.9, 0)); // tường sau (sát tường bao)
    g.add(box(1.6, 3, 0.3, wallMat, 0.1 * sx, 1.9, -6), box(1.6, 3, 0.3, wallMat, 0.1 * sx, 1.9, 6));
    // hiên cột phía sân
    for (let z = -5.5; z <= 5.5; z += 2.2) g.add(cyl(0.13, 0.15, 3, red, -sx * 1.05, 1.9, z, 10));
    // cửa gỗ + cửa sổ dọc tường trong
    for (let z = -4.4; z <= 4.4; z += 2.2) g.add(box(0.1, 2.0, 1.2, M('hallwood', '#7d2418', { roughness: 0.7 }), sx * 0.72, 1.4, z));
    const r = roof(3.6, 13.4, 1.4, 3.4, 0);
    g.add(r);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.42), new THREE.MeshStandardMaterial({ map: signTexture(name), roughness: 0.6 }));
    sign.position.set(-sx * 1.12, 3.15, 0);
    sign.rotation.y = -sx * Math.PI / 2;
    g.add(sign);
    g.position.set(sx * 16.35, 0, 4);
    root.add(shadowAll(g));
  }
}

// ───────────────────────── Đèn đá, bonsai, ghế đá ─────────────────────────
function buildStoneLamps(root) {
  const stone = M('stonelamp', '#a89b84', { roughness: 0.9 });
  const glow = new THREE.MeshBasicMaterial({ color: '#ffd38a' });
  for (const c of CIRCLES.filter((o) => o.kind === 'stonelamp')) {
    const g = new THREE.Group();
    g.add(box(0.6, 0.15, 0.6, stone, 0, 0.08, 0), cyl(0.12, 0.15, 0.8, stone, 0, 0.55, 0, 8), box(0.55, 0.1, 0.55, stone, 0, 1.0, 0));
    g.add(box(0.42, 0.38, 0.42, stone, 0, 1.24, 0));
    for (const [rx, rz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.22), glow);
      w.position.set(rx * 0.215, 1.24, rz * 0.215);
      w.rotation.y = Math.atan2(rx, rz);
      g.add(w);
    }
    const capm = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.32, 4), stone);
    capm.rotation.y = Math.PI / 4;
    capm.position.y = 1.6;
    g.add(capm, new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), stone).translateY(1.8));
    g.position.set(c.x, 0, c.z);
    root.add(shadowAll(g));
  }
}

function buildBonsai(root) {
  const pot = M('pot', '#4b6f8a', { roughness: 0.4 });
  const trunk = M('trunk', '#5e4330');
  const leaf = M('leaf', '#4f7a3a', { flatShading: true });
  for (const c of CIRCLES.filter((o) => o.kind === 'bonsai')) {
    const g = new THREE.Group();
    g.add(cyl(0.5, 0.38, 0.45, pot, 0, 0.23, 0, 14));
    const t = cyl(0.06, 0.1, 0.9, trunk, 0.05, 0.85, 0, 7);
    t.rotation.z = 0.35;
    g.add(t);
    for (const [x, y, z, r] of [[-0.15, 1.2, 0, 0.32], [0.3, 1.05, 0.1, 0.25], [0.05, 1.45, -0.05, 0.22]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
      b.position.set(x, y, z);
      b.scale.y = 0.6;
      g.add(b);
    }
    g.position.set(c.x, 0, c.z);
    root.add(shadowAll(g));
  }
}

function buildBenches(root) {
  const stone = M('stone', '#9d8f7b');
  for (const c of CIRCLES.filter((o) => o.kind === 'bench')) {
    const g = new THREE.Group();
    g.add(box(1.3, 0.12, 0.45, stone, 0, 0.45, 0), box(0.18, 0.42, 0.4, stone, -0.45, 0.21, 0), box(0.18, 0.42, 0.4, stone, 0.45, 0.21, 0));
    g.position.set(c.x, 0, c.z);
    g.rotation.y = Math.PI / 2;
    root.add(shadowAll(g));
  }
}

// ───────────────────────── Thực vật: trúc, tùng, luống hoa ─────────────────────────
function buildBamboo(root, areas) {
  const stalks = [];
  for (const [x0, x1, z0, z1, n] of areas) for (let i = 0; i < n; i++) stalks.push([x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0), 3.5 + rnd() * 3]);
  const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.065, 1, 6), M('bamboo', '#7a9a3a', { roughness: 0.6 }), stalks.length);
  const nodes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 6), M('bamboonode', '#5f7f2c'), stalks.length * 5);
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), M('bambooleaf', '#6b9a44', { flatShading: true }), stalks.length * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  stalks.forEach(([x, z, h], i) => {
    const lean = (rnd() - 0.5) * 0.12;
    q.setFromEuler(e.set(lean, 0, (rnd() - 0.5) * 0.12));
    stem.setMatrixAt(i, m4.compose(p.set(x, h / 2, z), q, sc.set(1, h, 1)));
    for (let k = 0; k < 5; k++) nodes.setMatrixAt(i * 5 + k, m4.compose(p.set(x, (h * (k + 1)) / 6, z), q, sc.set(1, 1, 1)));
    for (let k = 0; k < 3; k++) {
      leaves.setMatrixAt(i * 3 + k, m4.compose(p.set(x + (rnd() - 0.5) * 0.9, h - 0.3 - k * 0.6, z + (rnd() - 0.5) * 0.9),
        q.setFromEuler(e.set(rnd(), rnd() * 6, rnd())), sc.set(1.1 + rnd() * 0.5, 0.35, 0.8 + rnd() * 0.4)));
    }
  });
  stem.castShadow = leaves.castShadow = true;
  root.add(stem, nodes, leaves);
}

function buildConifers(root) {
  const spots = [];
  for (let z = -24; z <= 44; z += 4.2) for (const sx of [-1, 1]) spots.push([sx * (21 + rnd() * 5), z + rnd() * 2]);
  for (let x = -16; x <= 16; x += 4.5) spots.push([x + rnd() * 2, -25 - rnd() * 4]);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1, 6), M('trunk', '#5e4330'), spots.length);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 1, 7), M('pine', '#3f6342', { flatShading: true }), spots.length * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  spots.forEach(([x, z], i) => {
    const h = 5 + rnd() * 4;
    trunk.setMatrixAt(i, m4.compose(p.set(x, 1, z), q.identity(), sc.set(1, 2, 1)));
    for (let k = 0; k < 3; k++) {
      const s = 1 - k * 0.25;
      crowns.setMatrixAt(i * 3 + k, m4.compose(p.set(x, 2 + k * (h / 4), z), q, sc.set(s, h / 2.6, s)));
    }
  });
  trunk.castShadow = crowns.castShadow = true;
  root.add(trunk, crowns);
}

function buildFlowerBeds(root) {
  const beds = FLOWER_BEDS; // dùng chung với va chạm trong shared/world.js
  const soil = M('soil', '#6b5038');
  const curb = M('curb', '#8c8170', { roughness: 0.95 });
  const colors = ['#e8546b', '#f2c14e', '#f7f2e8', '#c86fd0', '#f08a3c'];
  // mật độ đều cho mọi luống: số bụi tính theo diện tích, đặt theo lưới có xê dịch ngẫu nhiên để không trống chỗ
  const SPACING = 0.32; // khoảng cách giữa các bụi (m)
  const FLOWERS_PER_BUSH = 3;
  const plan = beds.map(([x0, x1, z0, z1]) => {
    const cols = Math.max(1, Math.round((x1 - x0 - 0.2) / SPACING));
    const rows = Math.max(1, Math.round((z1 - z0 - 0.2) / SPACING));
    return { x0, x1, z0, z1, cols, rows };
  });
  const total = plan.reduce((n, b) => n + b.cols * b.rows, 0);
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 7, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), total * FLOWERS_PER_BUSH);
  const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.24, 0), M('bush', '#5d8a46', { flatShading: true }), total);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let fi = 0, bi = 0;
  for (const { x0, x1, z0, z1, cols, rows } of plan) {
    // viền đá thấp + đất
    root.add(box(x1 - x0 + 0.12, 0.16, z1 - z0 + 0.12, curb, (x0 + x1) / 2, 0.08, (z0 + z1) / 2));
    root.add(box(x1 - x0 - 0.04, 0.14, z1 - z0 - 0.04, soil, (x0 + x1) / 2, 0.1, (z0 + z1) / 2));
    const cw = (x1 - x0 - 0.2) / cols, rh = (z1 - z0 - 0.2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + 0.1 + (c + 0.5 + (rnd() - 0.5) * 0.5) * cw;
        const z = z0 + 0.1 + (r + 0.5 + (rnd() - 0.5) * 0.5) * rh;
        q.setFromAxisAngle(p.set(0, 1, 0), rnd() * Math.PI * 2);
        bush.setMatrixAt(bi++, m4.compose(p.set(x, 0.22, z), q, sc.set(1, 0.7 + rnd() * 0.2, 1)));
        q.identity();
        for (let k = 0; k < FLOWERS_PER_BUSH; k++) {
          flowers.setMatrixAt(fi, m4.compose(p.set(x + (rnd() - 0.5) * 0.3, 0.36 + rnd() * 0.08, z + (rnd() - 0.5) * 0.3), q, sc.set(1, 1, 1)));
          flowers.setColorAt(fi++, col.set(colors[Math.floor(rnd() * colors.length)]));
        }
      }
    }
  }
  flowers.count = fi;
  bush.count = bi;
  root.add(flowers, bush);
}

// ───────────────────────── Núi xa ─────────────────────────
function buildMountains(root) {
  const mats = ['#7f9479', '#8fa08a', '#9fae9c', '#a9b5a8'].map((c) => M('mt' + c, c, { flatShading: true, roughness: 1 }));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.15;
    const dist = 95 + rnd() * 45;
    const h = 18 + rnd() * 26;
    const m = new THREE.Mesh(new THREE.ConeGeometry(16 + rnd() * 16, h, 6 + Math.floor(rnd() * 3)), mats[Math.min(3, Math.floor((dist - 95) / 12))]);
    m.position.set(Math.cos(a) * dist, h / 2 - 2, 8 + Math.sin(a) * dist);
    m.rotation.y = rnd() * 3;
    root.add(m);
  }
}

// ───────────────────────── Ráp tất cả ─────────────────────────
/** Giá chổi tre cạnh nhà khách: chỗ lấy chổi để quét lá */
function buildBroomRack(root) {
  const g = new THREE.Group();
  const wood = M('rackwood', '#6b4426', { roughness: 0.8 });
  for (const sx of [-1, 1]) g.add(box(0.1, 1.3, 0.1, wood, sx * 0.55, 0.65, 0));
  g.add(box(1.3, 0.08, 0.12, wood, 0, 1.22, 0), box(1.3, 0.06, 0.1, wood, 0, 0.35, 0.02));
  const handleMat = M('broomhandle', '#a77b45', { roughness: 0.7 });
  const strawMat = M('broomstraw', '#c9a65a', { roughness: 0.9 });
  for (const [x, tilt] of [[-0.32, 0.12], [0, -0.05], [0.3, 0.1]]) {
    const b = new THREE.Group();
    const h = cyl(0.02, 0.024, 1.2, handleMat, 0, 0.75, 0, 6);
    const straw = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 10, 1, true), strawMat);
    straw.scale.z = 0.45; straw.position.y = 0.2; straw.castShadow = true;
    b.add(h, straw);
    b.position.set(x, 0, 0.12);
    b.rotation.set(-0.12, 0, tilt);
    g.add(b);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), new THREE.MeshStandardMaterial({ map: signTexture('GIÁ CHỔI'), roughness: 0.6 }));
  sign.position.set(0, 1.42, 0.02);
  g.add(sign);
  g.position.set(INTERACT.broom.x, 0, INTERACT.broom.z);
  g.rotation.y = -Math.PI / 2 + 0.25; // quay mặt ra sân (về phía tây)
  root.add(g);
  return g;
}

export function buildLandscape(root) {
  const ground = buildForecourt(root);
  const waters = buildPonds(root);
  const outerGate = buildOuterGate(root);
  buildStupa(root);
  buildSideHalls(root);
  buildStoneLamps(root);
  buildBonsai(root);
  buildBenches(root);
  buildBamboo(root, [
    [-17.4, -16.2, 21, 38.5, 26], [16.2, 17.4, 21, 38.5, 26], // hai bên sân trước
    [-17.4, -14.8, -19.4, -11, 18], [14.8, 17.4, -19.4, -11.2, 16], // góc sau
  ]);
  buildConifers(root);
  buildFlowerBeds(root);
  buildMountains(root);
  const rack = buildBroomRack(root);

  return {
    groundMeshes: ground,
    interactables: [{ kind: 'broom', object: rack }],
    update(dt, t, camera, player) {
      // mặt nước lăn tăn: đổi nhẹ độ bóng / màu theo thời gian
      for (const w of waters) w.material.color.setHSL(0.48, 0.3, 0.42 + Math.sin(t * 0.8) * 0.02);
      // nghi môn: ẩn khi nằm giữa camera và người chơi
      outerGate.visible = (camera.position.z - 39.2) * (player.z - 39.2) > 0;
    },
  };
}
