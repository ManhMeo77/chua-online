// Linh thú – mỗi con mở khóa khi đạt một cấp tu (chỉ số trong LEVELS ở merit.js).

export const PETS = {
  meo: { name: 'Mèo chùa', lv: 1, desc: 'Lười biếng mà hiền, thích nằm sưởi nắng bên hiên.' },
  se: { name: 'Chim sẻ', lv: 2, desc: 'Bay lượn theo chủ, chủ đứng yên thì sà xuống đậu trên vai.' },
  tho: { name: 'Thỏ trắng', lv: 3, desc: 'Nhút nhát nhưng quấn chủ, nhảy từng bước nhỏ.' },
  rua: { name: 'Rùa vàng', lv: 4, desc: 'Chậm rãi, điềm tĩnh, sống lâu như chùa.' },
  hac: { name: 'Hạc trắng', lv: 5, desc: 'Thanh cao, chân dài, cổ vươn như đang múa.' },
};

export const PET_ORDER = Object.keys(PETS);

export const isUnlocked = (kind, lv) => !!PETS[kind] && lv >= PETS[kind].lv;

/** Các linh thú vừa mở khóa khi lên từ cấp `from` tới cấp `to` */
export const unlockedBetween = (from, to) => PET_ORDER.filter((k) => PETS[k].lv > from && PETS[k].lv <= to);
