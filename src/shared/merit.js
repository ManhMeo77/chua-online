// Luật công đức & cấp tu – dùng chung client (hiển thị) và server (tính thật).

export const ACTIONS = {
  incense: { merit: 5, cooldown: 60_000 }, // mỗi người 1 lần / 60 giây
  bell: { merit: 3, cooldown: 45_000, roomCooldown: 6_000 }, // chuông cả phòng nghỉ 6 giây giữa 2 tiếng
  le: { merit: 4, cooldown: 60_000 }, // lễ Phật trong Chánh Điện
};

// Giới hạn công đức nhận từ hành động mỗi ngày (chống treo máy cày điểm)
export const DAILY_CAP = 150;

// Điểm danh hằng ngày: ngày 1 được 10, mỗi ngày liên tiếp thêm 2, tối đa 22 (từ ngày thứ 7).
// Không tính vào giới hạn ngày.
export const checkinBonus = (streak) => 10 + Math.min(Math.max(streak, 1) - 1, 6) * 2;

export const LEVELS = [
  { name: 'Sơ tâm', min: 0 },
  { name: 'Phát tâm', min: 30 },
  { name: 'Tinh tấn', min: 100 },
  { name: 'Kiên định', min: 250 },
  { name: 'Thanh tịnh', min: 600 },
  { name: 'An lạc', min: 1200 },
];

export function levelOf(merit) {
  let i = 0;
  while (i + 1 < LEVELS.length && merit >= LEVELS[i + 1].min) i++;
  return i;
}

/** Tiến độ tới cấp kế (0..1) và mốc kế tiếp */
export function progressOf(merit) {
  const i = levelOf(merit);
  const cur = LEVELS[i], next = LEVELS[i + 1];
  if (!next) return { level: i, pct: 1, next: null };
  return { level: i, pct: (merit - cur.min) / (next.min - cur.min), next: next.min };
}
