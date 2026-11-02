// Bố cục thế giới + va chạm. Dùng chung cho cả client và server
// (server dùng để kiểm tra vị trí người chơi gửi lên là hợp lệ).
//
// Có 2 map:
//   'san' – sân chùa: sân trong (chính điện, lư hương, gác chuông…) + sân trước cổng tam quan (hồ sen, thủy đình, nghi môn)
//   'cd'  – bên trong Chánh Điện
// Đi vào cửa giữa chính điện để sang 'cd'; đi ra cửa sau lưng để về 'san'.

export const PLAYER_RADIUS = 0.35;
export const WALK_SPEED = 3.2; // m/s
export const RUN_SPEED = 6.0;

// ───────────────────────── Map sân chùa ─────────────────────────
// Luống hoa [minX, maxX, minZ, maxZ]: hai dãy dọc lối đi sân trong (chừa 2 lối băng ngang rộng 2 m)
// và hai luống trước nhà Tổ / nhà khách. Vừa để vẽ hoa, vừa là vật cản không đi xuyên qua được.
export const FLOWER_BEDS = [
  ...[[-9, 0.3], [2.3, 9.3], [11.3, 16]].flatMap(([z0, z1]) => [[-3.2, -2.4, z0, z1], [2.4, 3.2, z0, z1]]),
  [-15.1, -14.45, -1, 9], [14.45, 15.1, -1, 9],
];

const SAN = {
  // sân trong (z −19.5…19.5) + sân trước cổng (z 20…39.5)
  bounds: { minX: -17.5, maxX: 17.5, minZ: -19.5, maxZ: 39.5 },
  circles: [
    { x: 0, z: -5, r: 1.4, kind: 'luhuong' },
    { x: -13, z: 4, r: 1.3, kind: 'tree' },
    { x: 13, z: 4, r: 1.3, kind: 'tree' },
    { x: -13, z: 13, r: 1.3, kind: 'tree' },
    { x: 13, z: 13, r: 1.3, kind: 'tree' },
    { x: 13, z: -8, r: 1.6, kind: 'bell' },
    { x: -13.5, z: -8, r: 1.7, kind: 'stupa' }, // bảo tháp 7 tầng
    { x: -6, z: -9, r: 0.35, kind: 'lantern' },
    { x: 6, z: -9, r: 0.35, kind: 'lantern' },
    { x: -6, z: 3, r: 0.35, kind: 'lantern' },
    { x: 6, z: 3, r: 0.35, kind: 'lantern' },
    // đèn đá dọc lối đi sân trước
    ...[24, 29, 34].flatMap((z) => [{ x: -2.9, z, r: 0.35, kind: 'stonelamp' }, { x: 2.9, z, r: 0.35, kind: 'stonelamp' }]),
    // chậu cây cảnh trước thềm chính điện
    { x: -4.6, z: -11.6, r: 0.5, kind: 'bonsai' },
    { x: 4.6, z: -11.6, r: 0.5, kind: 'bonsai' },
    // ghế đá dưới gốc đa
    { x: -10.6, z: 8.5, r: 0.55, kind: 'bench' },
    { x: 10.6, z: 8.5, r: 0.55, kind: 'bench' },
    // giá chổi cạnh nhà khách (lấy chổi để quét lá)
    { x: 14.3, z: -3.4, r: 0.55, kind: 'broomrack' },
  ],
  boxes: [
    { minX: -12, maxX: 12, minZ: -20, maxZ: -13, kind: 'hall' },
    // dãy nhà Tổ (trái) và nhà khách (phải) sát tường bên
    { minX: -17.5, maxX: -15.2, minZ: -2, maxZ: 10, kind: 'sidehall' },
    { minX: 15.2, maxX: 17.5, minZ: -2, maxZ: 10, kind: 'sidehall' },
    // tường trước + cột cổng tam quan (lối đi giữa x −4.8…4.8)
    { minX: -18, maxX: -6.2, minZ: 19.6, maxZ: 20.4, kind: 'wall' },
    { minX: 6.2, maxX: 18, minZ: 19.6, maxZ: 20.4, kind: 'wall' },
    { minX: -6.2, maxX: -4.8, minZ: 18.6, maxZ: 20.4, kind: 'gatepillar' },
    { minX: 4.8, maxX: 6.2, minZ: 18.6, maxZ: 20.4, kind: 'gatepillar' },
    // hồ sen trái (có tượng Quan Âm giữa hồ, không lội vào được)
    { minX: -16, maxX: -3.6, minZ: 23, maxZ: 36, kind: 'pond' },
    // hồ sen phải: bao quanh cầu gỗ (z 29…31) dẫn ra thủy đình (x 9.8…13.2)
    { minX: 3.6, maxX: 16, minZ: 23, maxZ: 28.4, kind: 'pond' },
    { minX: 3.6, maxX: 16, minZ: 31.6, maxZ: 36, kind: 'pond' },
    { minX: 13.2, maxX: 16, minZ: 28.4, maxZ: 31.6, kind: 'pond' },
    { minX: 3.6, maxX: 9.8, minZ: 28.4, maxZ: 29, kind: 'pond' },
    { minX: 3.6, maxX: 9.8, minZ: 31, maxZ: 31.6, kind: 'pond' },
    // cột nghi môn (cổng ngoài)
    { minX: -4.6, maxX: -3.4, minZ: 38.6, maxZ: 39.8, kind: 'outerpillar' },
    { minX: 3.4, maxX: 4.6, minZ: 38.6, maxZ: 39.8, kind: 'outerpillar' },
    ...FLOWER_BEDS.map(([minX, maxX, minZ, maxZ]) => ({ minX, maxX, minZ, maxZ, kind: 'flowerbed' })),
  ],
  // cửa giữa chính điện → vào Chánh Điện
  portals: [{ minX: -2.4, maxX: 2.4, minZ: -13.4, maxZ: -12.2, to: 'cd', label: 'Vào Chánh Điện' }],
  spawn: { x: 0, z: 12, ry: Math.PI },
  // vị trí xuất hiện khi từ Chánh Điện đi ra (đứng trên thềm, quay mặt ra sân)
  arrive: { cd: { x: 0, z: -10.8, ry: 0 } },
};

// ───────────────────────── Map Chánh Điện ─────────────────────────
// Gốc tọa độ riêng: cửa ở phía nam (z ≈ 10), bàn thờ ở phía bắc (z < −8)
const CD = {
  bounds: { minX: -11.5, maxX: 11.5, minZ: -8, maxZ: 9.7 },
  circles: [
    // 2 hàng cột gỗ sơn son
    ...[-5.5, -0.5, 4.5].flatMap((z) => [{ x: -5.2, z, r: 0.38, kind: 'column' }, { x: 5.2, z, r: 0.38, kind: 'column' }]),
    // Hộ Pháp hai bên cửa
    { x: -6.6, z: 7.4, r: 1.0, kind: 'guardian' },
    { x: 6.6, z: 7.4, r: 1.0, kind: 'guardian' },
    // trống (trái) và chuông (phải)
    { x: -9.6, z: 2.5, r: 1.0, kind: 'drum' },
    { x: 9.6, z: 2.5, r: 1.0, kind: 'bigbell' },
  ],
  boxes: [
    { minX: -12, maxX: 12, minZ: -16, maxZ: -7.6, kind: 'altar' }, // bệ thờ nhiều tầng
    { minX: -2.6, maxX: 2.6, minZ: -7.2, maxZ: -5.9, kind: 'table' }, // bàn hương án
    { minX: -11.6, maxX: -8.9, minZ: -7.6, maxZ: -4.4, kind: 'sidealtar' }, // ban thờ phụ trái
    { minX: 8.9, maxX: 11.6, minZ: -7.6, maxZ: -4.4, kind: 'sidealtar' }, // ban thờ phụ phải
  ],
  portals: [{ minX: -2.2, maxX: 2.2, minZ: 9.1, maxZ: 10.2, to: 'san', label: 'Ra sân chùa' }],
  spawn: { x: 0, z: 7.8, ry: Math.PI },
  arrive: { san: { x: 0, z: 7.6, ry: Math.PI } },
};

export const MAPS = { san: SAN, cd: CD };
export const MAP_NAMES = { san: 'Sân chùa', cd: 'Chánh Điện' };

// Giữ tên cũ cho phần code chỉ dùng sân chùa
export const BOUNDS = SAN.bounds;
export const CIRCLES = SAN.circles;
export const BOXES = SAN.boxes;

// Điểm tương tác: phải đứng trong `range` mét tính từ tâm (và đúng map) mới thực hiện được
export const INTERACT = {
  incense: { map: 'san', x: 0, z: -5, range: 3.0, label: 'Thắp hương' },
  bell: { map: 'san', x: 13, z: -8, range: 3.0, label: 'Đánh chuông' },
  le: { map: 'cd', x: 0, z: -4.4, range: 2.4, label: 'Lễ Phật' },
  broom: { map: 'san', x: 14.3, z: -3.4, range: 2.2, label: 'Lấy chổi' }, // không phải hành động công đức, chỉ là chỗ lấy chổi
};

export function distTo(kind, x, z) {
  const p = INTERACT[kind];
  return Math.hypot(x - p.x, z - p.z);
}

/** Cổng chuyển map mà điểm (x,z) đang đứng trong (hoặc null) */
export function portalAt(map, x, z, pad = 0) {
  for (const p of MAPS[map].portals) {
    if (x > p.minX - pad && x < p.maxX + pad && z > p.minZ - pad && z < p.maxZ + pad) return p;
  }
  return null;
}

/** Đẩy điểm (x,z) ra khỏi mọi vật cản của map. Trả về {x,z} mới. */
export function resolveCollision(x, z, r = PLAYER_RADIUS, map = 'san') {
  const M = MAPS[map] || SAN;
  const B = M.bounds;
  x = Math.min(B.maxX - r, Math.max(B.minX + r, x));
  z = Math.min(B.maxZ - r, Math.max(B.minZ + r, z));

  for (const c of M.circles) {
    const dx = x - c.x, dz = z - c.z;
    const min = c.r + r;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2);
      if (d < 1e-6) { z = c.z + min; continue; } // đứng đúng tâm: đẩy ra phía trước
      x = c.x + (dx / d) * min;
      z = c.z + (dz / d) * min;
    }
  }

  for (const b of M.boxes) {
    const minX = b.minX - r, maxX = b.maxX + r, minZ = b.minZ - r, maxZ = b.maxZ + r;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      // đẩy ra theo cạnh gần nhất
      const pushes = [
        [x - minX, minX, null],
        [maxX - x, maxX, null],
        [z - minZ, null, minZ],
        [maxZ - z, null, maxZ],
      ].sort((a, b) => a[0] - b[0]);
      const [, px, pz] = pushes[0];
      if (px !== null) x = px; else z = pz;
    }
  }
  return { x, z };
}

/** Điểm xuất hiện ngẫu nhiên trong sân trong (gần cổng tam quan) */
export function randomSpawn() {
  for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * 10;
    const z = 9 + Math.random() * 7;
    const p = resolveCollision(x, z);
    if (Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01) return p;
  }
  return { x: 0, z: 12 };
}

/** Điểm xuất hiện khi chuyển từ map `from` sang map `to` (lệch ngẫu nhiên một chút để không đè nhau) */
export function arrivalPoint(to, from) {
  const a = MAPS[to].arrive[from] || MAPS[to].spawn;
  const p = resolveCollision(a.x + (Math.random() - 0.5) * 1.6, a.z + (Math.random() - 0.5) * 0.6, PLAYER_RADIUS, to);
  return { x: p.x, z: p.z, ry: a.ry };
}

// ───────────────────────── Tìm đường (bấm để đi tới) ─────────────────────────
// Lưới 0,5 m phủ cả map, ô đi được = người đứng ở tâm ô không chạm vật cản. A* 8 hướng, rồi "kéo căng dây"
// (bỏ các điểm trung gian nếu nhìn thẳng thấy nhau) để đường đi tự nhiên. Chỉ client dùng; server vẫn kiểm tra va chạm.
const CELL = 0.5;
const grids = {};
const isFree = (x, z, map, r = PLAYER_RADIUS + 0.04) => { const p = resolveCollision(x, z, r, map); return Math.abs(p.x - x) < 1e-4 && Math.abs(p.z - z) < 1e-4; };

function gridOf(map) {
  if (grids[map]) return grids[map];
  const B = MAPS[map].bounds;
  const w = Math.floor((B.maxX - B.minX) / CELL), h = Math.floor((B.maxZ - B.minZ) / CELL);
  const ok = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) ok[j * w + i] = isFree(B.minX + (i + 0.5) * CELL, B.minZ + (j + 0.5) * CELL, map) ? 1 : 0;
  return (grids[map] = { w, h, ok, B });
}

/** Đoạn thẳng a→b không vướng gì (lấy mẫu mỗi 0,2 m). r = bán kính vật đi qua (người, linh thú) */
export function clearLine(map, ax, az, bx, bz, r = PLAYER_RADIUS) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
  for (let k = 1; k < n; k++) { const t = k / n; if (!isFree(ax + (bx - ax) * t, az + (bz - az) * t, map, r)) return false; }
  return true;
}

/** Các điểm cần đi qua từ (sx,sz) tới (tx,tz), điểm cuối là đích. Không có đường thì trả [đích]. */
export function findPath(map, sx, sz, tx, tz) {
  if (clearLine(map, sx, sz, tx, tz)) return [{ x: tx, z: tz }];
  const G = gridOf(map), { w, h, ok, B } = G;
  const cellOf = (x, z) => [Math.max(0, Math.min(w - 1, Math.floor((x - B.minX) / CELL))), Math.max(0, Math.min(h - 1, Math.floor((z - B.minZ) / CELL)))];
  const center = (i, j) => ({ x: B.minX + (i + 0.5) * CELL, z: B.minZ + (j + 0.5) * CELL });
  // ô đi được gần nhất (khi điểm đầu / cuối sát vật cản)
  const nearestOk = ([ci, cj]) => {
    for (let r = 0; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < w && j < h && ok[j * w + i]) return [i, j];
    }
    return null;
  };
  const s = nearestOk(cellOf(sx, sz)), t = nearestOk(cellOf(tx, tz));
  if (!s || !t) return [{ x: tx, z: tz }];
  const N = w * h, si = s[1] * w + s[0], ti = t[1] * w + t[0];
  const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; // [f, idx] – binary heap nhỏ nhất
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const hf = (i) => { const dx = Math.abs((i % w) - t[0]), dz = Math.abs(((i / w) | 0) - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  g[si] = 0; push(hf(si), si);
  let found = false;
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    if (cur === ti) { found = true; break; }
    closed[cur] = 1;
    const ci = cur % w, cj = (cur / w) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const n = nj * w + ni;
      if (!ok[n] || closed[n]) continue;
      if (di && dj && (!ok[cj * w + ni] || !ok[nj * w + ci])) continue; // không cắt góc vật cản
      const ng = g[cur] + (di && dj ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; came[n] = cur; push(ng + hf(n), n); }
    }
  }
  if (!found) return [{ x: tx, z: tz }];
  const cells = [];
  for (let c = ti; c !== -1; c = came[c]) cells.push(center(c % w, (c / w) | 0));
  cells.reverse();
  cells.push({ x: tx, z: tz });
  // kéo căng: từ điểm hiện tại nhảy tới điểm xa nhất còn nhìn thẳng thấy
  const out = [];
  let ax = sx, az = sz, k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) if (clearLine(map, ax, az, cells[m].x, cells[m].z)) { far = m; break; }
    out.push(cells[far]);
    ax = cells[far].x; az = cells[far].z;
    k = far + 1;
  }
  return out;
}
