// Bảng chọn ngoại hình: 4 thẻ Nhân vật · Kiểu áo · Màu · Phụ kiện.
// Dùng ở màn hình vào chùa và trong ngăn "Trang phục". Mỗi lần đổi gọi onChange(look) để xem trước ngay trên nhân vật.
import { GENDERS, STYLES, STYLE_ORDER, COLORS, PANTS, ACCESSORIES, ACC_ORDER, MAX_ACC, EXCLUSIVE, DEFAULT_LOOK, cleanLook, toggleAcc, lookSummary } from './shared/looks.js';
import { LEVELS } from './shared/merit.js';

const TABS = [
  { id: 'nv', name: 'Nhân vật' },
  { id: 'ao', name: 'Kiểu áo' },
  { id: 'mau', name: 'Màu' },
  { id: 'pk', name: 'Phụ kiện' },
];

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/**
 * @param {HTMLElement} root  nơi đặt bảng chọn
 * @param {{ lv: () => number, onChange: (look) => void }} opts
 */
export function createLookEditor(root, { lv, onChange }) {
  let look = { ...DEFAULT_LOOK };
  let tab = 'nv';

  root.classList.add('lookedit');
  const summary = el('p', 'le-summary');
  const tabs = el('div', 'le-tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'le-body');
  const tools = el('div', 'le-tools');
  const dice = el('button', 'le-tool', '🎲 Ngẫu nhiên');
  const reset = el('button', 'le-tool', 'Mặc định');
  dice.type = reset.type = 'button';
  tools.append(dice, reset);
  root.append(summary, tabs, body, tools);

  for (const t of TABS) {
    const b = el('button', 'le-tab', t.name);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.tab = t.id;
    b.addEventListener('click', () => { tab = t.id; render(); });
    tabs.append(b);
  }

  const set = (next) => { look = cleanLook(next, lv()); render(); onChange(look); };
  dice.addEventListener('click', () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const styles = STYLE_ORDER.filter((s) => STYLES[s].lv <= lv());
    let acc = [];
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) acc = toggleAcc(acc, pick(ACC_ORDER.filter((a) => (ACCESSORIES[a].lv || 0) <= lv())));
    set({ g: pick(GENDERS).id, style: pick(styles), color: pick(COLORS).hex, pants: pick(PANTS).hex, acc });
  });
  reset.addEventListener('click', () => set({ ...DEFAULT_LOOK, g: look.g }));

  function option(label, { selected, locked, note, onClick, swatch, wide }) {
    const b = el('button', 'le-opt' + (wide ? ' wide' : '') + (swatch ? ' swatch' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(!!selected));
    if (swatch) {
      b.style.setProperty('--sw', swatch);
      b.title = label;
      b.setAttribute('aria-label', label);
    } else {
      b.append(el('span', 'le-name', label));
      if (note) b.append(el('small', '', note));
    }
    if (locked) { b.disabled = true; b.classList.add('locked'); }
    else b.addEventListener('click', onClick);
    return b;
  }

  function section(title, hint) {
    const s = el('div', 'le-sec');
    s.append(el('h4', '', title));
    if (hint) s.append(el('p', 'le-hint', hint));
    const grid = el('div', 'le-grid');
    s.append(grid);
    body.append(s);
    return grid;
  }

  function render() {
    summary.textContent = lookSummary(look);
    for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    body.innerHTML = '';
    const L = lv();
    if (tab === 'nv') {
      const g = section('Bạn là');
      for (const x of GENDERS) {
        g.append(option(x.name, { selected: look.g === x.id, wide: true, note: x.id === 'nam' ? 'Đầu cạo như chú tiểu' : 'Tóc búi, mái thưa', onClick: () => set({ ...look, g: x.id }) }));
      }
    } else if (tab === 'ao') {
      const g = section('Kiểu áo');
      for (const id of STYLE_ORDER) {
        const s = STYLES[id];
        const locked = s.lv > L;
        g.append(option(s.name, { selected: look.style === id, locked, note: locked ? `🔒 Đạt cấp ${LEVELS[s.lv].name}` : s.desc, onClick: () => set({ ...look, style: id }) }));
      }
    } else if (tab === 'mau') {
      const s = STYLES[look.style];
      const g = section('Màu áo', s.fixed ? `${s.name} có màu cố định.` : null);
      for (const c of COLORS) g.append(option(c.name, { swatch: c.hex, selected: !s.fixed && look.color === c.hex, locked: !!s.fixed, onClick: () => set({ ...look, color: c.hex }) }));
      const p = section('Màu quần', s.pants ? null : 'Kiểu áo này phủ kín chân, đổi sang áo bà ba hoặc áo dài để thấy quần.');
      for (const c of PANTS) p.append(option(c.name, { swatch: c.hex, selected: look.pants === c.hex, locked: !s.pants, onClick: () => set({ ...look, pants: c.hex }) }));
    } else {
      const g = section('Phụ kiện', `Đeo tối đa ${MAX_ACC} món. ${EXCLUSIVE.map((grp) => grp.map((a) => ACCESSORIES[a].name).join(' và ')).join(', ')} không đeo cùng lúc.`);
      for (const id of ACC_ORDER) {
        const a = ACCESSORIES[id];
        const locked = (a.lv || 0) > L;
        g.append(option(a.name, { selected: look.acc.includes(id), locked, note: locked ? `🔒 Đạt cấp ${LEVELS[a.lv].name}` : null, onClick: () => set({ ...look, acc: toggleAcc(look.acc, id) }) }));
      }
    }
  }

  render();
  return {
    get look() { return look; },
    /** Nạp ngoại hình (không gọi onChange) */
    load(l) { look = cleanLook(l, 99); render(); },
    render,
  };
}
