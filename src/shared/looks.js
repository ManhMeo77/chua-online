// Ngoại hình nhân vật: giới tính, kiểu áo, màu áo, màu quần, phụ kiện.
// Dùng chung client (bảng chọn, dựng nhân vật) và server (kiểm tra hợp lệ, mở khóa theo cấp tu).

export const GENDERS = [
  { id: 'nam', name: 'Nam' },
  { id: 'nu', name: 'Nữ' },
];

// lv = cấp tu cần đạt để mặc (chỉ số trong LEVELS ở merit.js); fixed = màu cố định của kiểu áo
export const STYLES = {
  tieu: { name: 'Áo chú tiểu', desc: 'Áo tràng ngắn, thắt dây chéo, gọn gàng để làm công quả.', lv: 0 },
  trang: { name: 'Áo tràng', desc: 'Áo tràng rộng của Phật tử, tay áo thụng, cổ chéo.', lv: 0 },
  baba: { name: 'Áo bà ba', desc: 'Áo ngắn cài khuy, quần dài – mộc mạc như đi lễ chùa quê.', lv: 0, pants: true },
  aodai: { name: 'Áo dài', desc: 'Áo dài cổ đứng, tà dài, mặc cùng quần.', lv: 0, pants: true },
  nau: { name: 'Áo nâu sồng', desc: 'Áo nâu giản dị của người xuất gia.', lv: 2, fixed: '#6e4a2e' },
  casa: { name: 'Cà sa', desc: 'Cà sa vàng đắp chéo vai.', lv: 4, fixed: '#d98a1e' },
};
export const STYLE_ORDER = ['tieu', 'trang', 'baba', 'aodai', 'nau', 'casa'];

export const COLORS = [
  { hex: '#c98a3a', name: 'Vàng nghệ' },
  { hex: '#f2efe6', name: 'Trắng' },
  { hex: '#8c8a84', name: 'Xám' },
  { hex: '#3f6fb8', name: 'Lam' },
  { hex: '#2f9e8f', name: 'Ngọc' },
  { hex: '#2f7a4f', name: 'Lục' },
  { hex: '#b8392e', name: 'Đỏ' },
  { hex: '#e48aa6', name: 'Hồng' },
  { hex: '#6b4c9a', name: 'Tím' },
  { hex: '#2a2a30', name: 'Đen' },
];

export const PANTS = [
  { hex: '#efe9dc', name: 'Trắng' },
  { hex: '#2a2a30', name: 'Đen' },
  { hex: '#e2d2ad', name: 'Kem' },
  { hex: '#2c3e66', name: 'Xanh đen' },
];

export const ACCESSORIES = {
  beadsNeck: { name: 'Chuỗi hạt đeo cổ' },
  beadsWrist: { name: 'Chuỗi hạt cổ tay' },
  non: { name: 'Nón lá' },
  khan: { name: 'Khăn vấn' },
  tui: { name: 'Túi vải' },
  quat: { name: 'Quạt giấy' },
  sen: { name: 'Hoa sen cài áo', lv: 1 },
};
export const ACC_ORDER = ['beadsNeck', 'beadsWrist', 'non', 'khan', 'tui', 'quat', 'sen'];
export const MAX_ACC = 2;
// các món không đeo cùng lúc
export const EXCLUSIVE = [['non', 'khan'], ['beadsNeck', 'beadsWrist']];

export const DEFAULT_LOOK = { g: 'nam', style: 'tieu', color: '#c98a3a', pants: '#2a2a30', acc: ['beadsNeck'] };

/** Màu áo thật sự hiển thị (kiểu áo có màu cố định thì dùng màu đó) */
export const robeColor = (look) => STYLES[look.style]?.fixed || look.color;

/** Kiểm tra + sửa ngoại hình gửi lên cho hợp lệ. lv = cấp tu hiện tại (để khóa kiểu áo / phụ kiện cao cấp). */
export function cleanLook(raw, lv = 0) {
  const l = raw && typeof raw === 'object' ? raw : {};
  const g = GENDERS.some((x) => x.id === l.g) ? l.g : DEFAULT_LOOK.g;
  const style = STYLES[l.style] && STYLES[l.style].lv <= lv ? l.style : DEFAULT_LOOK.style;
  const color = COLORS.some((c) => c.hex === l.color) ? l.color : DEFAULT_LOOK.color;
  const pants = PANTS.some((c) => c.hex === l.pants) ? l.pants : DEFAULT_LOOK.pants;
  const acc = [];
  for (const a of Array.isArray(l.acc) ? l.acc : []) {
    if (!ACCESSORIES[a] || (ACCESSORIES[a].lv || 0) > lv || acc.includes(a) || acc.length >= MAX_ACC) continue;
    if (EXCLUSIVE.some((grp) => grp.includes(a) && grp.some((b) => acc.includes(b)))) continue;
    acc.push(a);
  }
  return { g, style, color, pants, acc };
}

/** Thêm / bỏ một phụ kiện theo luật (tối đa 2 món, món loại trừ nhau thì thay thế) */
export function toggleAcc(acc, a) {
  if (acc.includes(a)) return acc.filter((x) => x !== a);
  let next = acc.filter((x) => !EXCLUSIVE.some((grp) => grp.includes(a) && grp.includes(x)));
  if (next.length >= MAX_ACC) next = next.slice(1); // bỏ món chọn sớm nhất
  return [...next, a];
}

/** Mô tả ngắn: "Áo dài · Trắng · Nón lá" */
export function lookSummary(look) {
  const s = STYLES[look.style];
  const colorName = s.fixed ? null : COLORS.find((c) => c.hex === look.color)?.name;
  return [GENDERS.find((x) => x.id === look.g)?.name, s.name, colorName, ...look.acc.map((a) => ACCESSORIES[a].name)].filter(Boolean).join(' · ');
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const sameLook = (a, b) => same(cleanLook(a, 99), cleanLook(b, 99));
