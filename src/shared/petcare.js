// Chăm linh thú: độ no, độ vui, tâm trạng, độ thân thiết. Dùng chung client và server.
//
// Độ no và độ vui lưu dưới dạng "mốc thời gian" (fedAt, joyAt): giá trị hiện tại = 100 trừ phần đã giảm
// kể từ mốc đó. Nhờ vậy không cần vòng lặp trừ dần, và linh thú vẫn đói khi người chơi offline.

export const FULL_DECAY_MS = 12 * 3600_000; // từ no hẳn tới đói hẳn: 12 giờ
export const JOY_DECAY_MS = 6 * 3600_000; // từ vui hẳn tới buồn hẳn: 6 giờ

export const CARE = {
  pat: { joy: 25, bond: 1, cooldown: 20_000 }, // chủ vuốt ve
  patOther: { joy: 12, cooldown: 30_000 }, // người khác vuốt ve hộ
  feed: { full: 45, bond: 3, merit: 2, cooldown: 120_000, fullLimit: 85 }, // no quá 85 thì không ăn nữa
};

export const FOODS = { meo: 'cơm chay', se: 'hạt kê', tho: 'cà rốt', rua: 'rau muống', hac: 'hạt sen' };

export const MOODS = {
  vui: { label: 'Vui vẻ', color: '#9fd99b' },
  binhyen: { label: 'Bình yên', color: '#e8c482' },
  buon: { label: 'Buồn, nhớ chủ', color: '#a9b7d6' },
  doi: { label: 'Đói bụng', color: '#f0a08a' },
  buonngu: { label: 'Buồn ngủ', color: '#c8b6e2' },
};

export const BONDS = [
  { name: 'Mới quen', min: 0 },
  { name: 'Quen thân', min: 10 },
  { name: 'Thân thiết', min: 30 },
  { name: 'Tri kỷ', min: 60 },
];
export const bondOf = (bond) => { let i = 0; while (i + 1 < BONDS.length && bond >= BONDS[i + 1].min) i++; return i; };

const clamp = (v) => Math.max(0, Math.min(100, v));
export const fullnessAt = (st, now = Date.now()) => clamp(100 - ((now - st.fedAt) / FULL_DECAY_MS) * 100);
export const joyAt = (st, now = Date.now()) => clamp(100 - ((now - st.joyAt) / JOY_DECAY_MS) * 100);

/** Đổi giá trị mong muốn (0..100) về mốc thời gian tương ứng */
export const fedAtFor = (full, now = Date.now()) => now - ((100 - clamp(full)) / 100) * FULL_DECAY_MS;
export const joyAtFor = (joy, now = Date.now()) => now - ((100 - clamp(joy)) / 100) * JOY_DECAY_MS;

/** Giờ hiện tại ở Việt Nam (0..23) */
export const vnHour = (now = Date.now()) => (new Date(now).getUTCHours() + 7) % 24;

export function moodOf(full, joy, hour) {
  if (full < 25) return 'doi';
  if (hour >= 22 || hour < 5) return 'buonngu';
  if (joy < 25) return 'buon';
  if (joy >= 60 && full >= 50) return 'vui';
  return 'binhyen';
}

/** Linh thú mới nhận: nửa no, nửa vui */
export const newPetState = (now = Date.now()) => ({ bond: 0, fedAt: fedAtFor(55, now), joyAt: joyAtFor(55, now), patCd: 0, feedCd: 0 });

// ───────────── Phần thưởng theo độ thân thiết ─────────────
// Mỗi bậc (chỉ số trong BONDS) một lần: quà công đức, học trò mới, có thể kèm đồ trang sức / phúc lành.
export const TRICKS = {
  chao: { name: 'Cúi chào', tier: 1 },
  xoay: { name: 'Xoay vòng', tier: 2 },
  mua: { name: 'Múa', tier: 3 },
};
export const TRICK_ORDER = Object.keys(TRICKS);
export const TRICK_COOLDOWN = 8_000;

export const BOND_REWARDS = {
  1: { gift: 10, trick: 'chao', text: 'học trò Cúi chào' },
  2: { gift: 20, trick: 'xoay', item: 'Khăn đỏ', text: 'học trò Xoay vòng, được đeo khăn đỏ' },
  3: { gift: 40, trick: 'mua', item: 'Hào quang', blessing: 2, text: 'học trò Múa, có hào quang và ban phúc lành' },
};
// Phúc lành (bậc Tri kỷ): mỗi lần thắp hương khi đang dắt linh thú này được thêm công đức
export const BLESSING_MERIT = 2;

export const tricksFor = (tier) => TRICK_ORDER.filter((k) => TRICKS[k].tier <= tier);
