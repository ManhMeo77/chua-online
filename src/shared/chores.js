// Quét lá sân chùa + lần tràng hạt: luật chung cho client (hiển thị) và server (tính thật).
import { resolveCollision } from './world.js';

// ───────────────────────── Quét lá ─────────────────────────
// Lá rụng dần trên sân (chung cho cả phòng). Lấy chổi ở giá chổi, đi qua chỗ có lá là quét.
export const LEAF_MAX = 26; // tối đa số lá nằm trên sân cùng lúc
export const LEAF_START = 18; // số lá có sẵn khi phòng mới mở
export const LEAF_SPAWN_MS = 9_000; // cứ chừng này lại rụng thêm một chiếc
export const SWEEP_RADIUS = 0.95; // chổi quét được lá trong bán kính này quanh người
export const SWEEP_PER_MERIT = 3; // quét 3 lá được 1 công đức (tính vào giới hạn ngày)

// Nơi lá hay rụng: quanh 4 gốc đa (nhiều hơn) và rải rác khắp sân trong
const TREES = [[-13, 4], [13, 4], [-13, 13], [13, 13]];

/** Vị trí ngẫu nhiên cho một chiếc lá, luôn nằm trên chỗ đi được để quét tới */
export function randomLeafSpot(rand = Math.random) {
  for (let i = 0; i < 30; i++) {
    let x, z;
    if (rand() < 0.55) {
      const [tx, tz] = TREES[Math.floor(rand() * TREES.length)];
      const a = rand() * Math.PI * 2, r = 1.8 + rand() * 3.2;
      x = tx + Math.cos(a) * r; z = tz + Math.sin(a) * r;
    } else {
      x = (rand() - 0.5) * 24; z = -11 + rand() * 29;
    }
    const p = resolveCollision(x, z, 0.3, 'san');
    if (Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01) return { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
  }
  return { x: 0, z: 10 };
}

// ───────────────────────── Tràng hạt ─────────────────────────
export const BEADS_PER_ROUND = 108;
export const BEAD_MIN_MS = 200; // nhanh hơn thế này thì không tính (chống bấm tự động)
export const ROUND_MERIT = 5; // tròn một chuỗi 108 hạt: +5 công đức (tính vào giới hạn ngày)
export const MANTRAS = [
  'Nam mô A Di Đà Phật',
  'A Di Đà Phật',
  'Nam mô Quán Thế Âm Bồ Tát',
  'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
  'Nam mô Dược Sư Lưu Ly Quang Vương Phật',
];
