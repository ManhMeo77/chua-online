// Nhiệm vụ ngày – dùng chung client (hiển thị) và server (tính tiến độ).
// Mỗi người nhận 3 nhiệm vụ/ngày, chọn cố định theo mã hồ sơ + ngày (tải lại trang không đổi).

export const QUESTS = {
  incense3: { title: 'Thắp 3 nén hương', ev: 'incense', goal: 3, reward: 15 },
  bell2: { title: 'Thỉnh chuông 2 lần', ev: 'bell', goal: 2, reward: 10 },
  checkin: { title: 'Điểm danh hôm nay', ev: 'checkin', goal: 1, reward: 5 },
  chat3: { title: 'Gửi 3 lời chào trong khu trò chuyện', ev: 'chat', goal: 3, reward: 6 },
  walk150: { title: 'Đi dạo 150 m quanh sân chùa', ev: 'walk', goal: 150, reward: 8, unit: 'm' },
  hall: { title: 'Đến chiêm bái trước chính điện', ev: 'hall', goal: 1, reward: 6 },
  tree: { title: 'Ghé nghỉ dưới gốc đa', ev: 'tree', goal: 1, reward: 6 },
  vaocd: { title: 'Vào Chánh Điện chiêm bái', ev: 'enter_cd', goal: 1, reward: 6 },
  le1: { title: 'Lễ Phật trong Chánh Điện', ev: 'le', goal: 1, reward: 8 },
  sweep12: { title: 'Quét 12 chiếc lá trên sân', ev: 'sweep', goal: 12, reward: 8, unit: 'lá' },
  bead27: { title: 'Lần 27 hạt tràng hạt', ev: 'bead', goal: 27, reward: 6, unit: 'hạt' },
  pat3: { title: 'Vuốt ve linh thú 3 lần', ev: 'pat', goal: 3, reward: 6, needPet: true },
  feed: { title: 'Cho linh thú ăn', ev: 'feed', goal: 1, reward: 5, needPet: true },
};

export const QUESTS_PER_DAY = 3;
export const QUEST_BONUS = 10; // xong cả 3 nhiệm vụ

// Điểm "đến nơi" cho nhiệm vụ tham quan
export const SPOTS = {
  hall: [{ x: 0, z: -12.2, r: 2.2 }],
  tree: [{ x: -13, z: 4 }, { x: 13, z: 4 }, { x: -13, z: 13 }, { x: 13, z: 13 }].map((p) => ({ ...p, r: 2.6 })),
};

// Số ngẫu nhiên có hạt giống: cùng đầu vào → cùng kết quả
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/**
 * Chọn 3 nhiệm vụ cho một người trong một ngày; luôn có ít nhất một nghi lễ (hương hoặc chuông).
 * Nhiệm vụ về linh thú chỉ có khi người đó đang dắt linh thú.
 */
export function pickQuests(cid, day, hasPet = false) {
  const rnd = seeded(`${cid}|${day}`);
  const ids = Object.keys(QUESTS).filter((id) => hasPet || !QUESTS[id].needPet);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const list = ids.slice(0, QUESTS_PER_DAY);
  if (!list.includes('incense3') && !list.includes('bell2')) list[0] = rnd() < 0.5 ? 'incense3' : 'bell2';
  return list;
}
