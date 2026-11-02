// Hộp thoại: bảng xếp hạng, tài khoản, linh thú.

import { LEVELS } from './shared/merit.js';
import { PETS, PET_ORDER } from './shared/pets.js';
import { BONDS, BOND_REWARDS, bondOf } from './shared/petcare.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @param {{ send:(m:object)=>void, me:()=>({ user:string|null, name:string, lv:number, petKind:string|null }), setPet:(k:string|null)=>void, logout:()=>void }} deps
 */
export function createPanels({ send, me, setPet, logout }) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalbody');
  let view = null; // 'board' | 'account' | 'pets'
  let board = null;
  let boardTab = 'today';
  let accountTab = 'register';
  let busy = false;

  const open = (v) => {
    view = v;
    modal.hidden = false;
    render();
    setTimeout(() => body.querySelector('input, .tab.on, button')?.focus(), 0);
  };
  const close = () => { modal.hidden = true; view = null; busy = false; };
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.getElementById('modalclose').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  function renderBoard() {
    const list = board ? board[boardTab] : null;
    const myRank = board?.me[boardTab];
    const rows = !list
      ? '<p class="muted">Đang tải…</p>'
      : list.length === 0
        ? `<p class="muted">${boardTab === 'today' ? 'Hôm nay chưa ai tích công đức. Thắp một nén hương để mở hàng nhé.' : 'Chưa có ai trên bảng.'}</p>`
        : `<ol class="rank">${list.map((r, i) => `
            <li class="${r.name === me().name && myRank === i + 1 ? 'mine' : ''}">
              <span class="no">${i + 1}</span>
              <span class="who"><b>${esc(r.name)}</b><small>${LEVELS[r.lv].name}</small></span>
              <span class="pts">${r.merit}</span>
            </li>`).join('')}</ol>`;
    body.innerHTML = `
      <h2 id="modal-title">Bảng công đức</h2>
      <div class="tabs" role="tablist">
        <button class="tab ${boardTab === 'today' ? 'on' : ''}" data-tab="today" role="tab" aria-selected="${boardTab === 'today'}">Hôm nay</button>
        <button class="tab ${boardTab === 'all' ? 'on' : ''}" data-tab="all" role="tab" aria-selected="${boardTab === 'all'}">Tất cả</button>
      </div>
      ${rows}
      <p class="muted small">${myRank ? `Bạn đang đứng thứ ${myRank}.` : 'Bạn chưa có trên bảng này.'}</p>`;
    body.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { boardTab = b.dataset.tab; render(); }));
  }

  function renderAccount() {
    const u = me().user;
    if (u) {
      body.innerHTML = `
        <h2 id="modal-title">Tài khoản</h2>
        <p>Đã đăng nhập: <b>${esc(u)}</b></p>
        <p class="muted">Công đức, cấp tu và chuỗi điểm danh được giữ theo tài khoản. Trên máy khác, chỉ cần đăng nhập bằng tên này.</p>
        <button class="wide ghost" id="logoutbtn" type="button">Đăng xuất</button>`;
      body.querySelector('#logoutbtn').addEventListener('click', logout);
      return;
    }
    const reg = accountTab === 'register';
    body.innerHTML = `
      <h2 id="modal-title">Tài khoản</h2>
      <div class="tabs" role="tablist">
        <button class="tab ${reg ? 'on' : ''}" data-tab="register" role="tab" aria-selected="${reg}">Đăng ký</button>
        <button class="tab ${!reg ? 'on' : ''}" data-tab="login" role="tab" aria-selected="${!reg}">Đăng nhập</button>
      </div>
      <p class="muted">${reg
        ? 'Bạn đang dùng hồ sơ khách, chỉ lưu trên trình duyệt này. Đăng ký để giữ công đức khi đổi máy hoặc xóa dữ liệu trình duyệt.'
        : 'Đăng nhập sẽ chuyển sang hồ sơ của tài khoản. Công đức của hồ sơ khách hiện tại không gộp vào.'}</p>
      <form id="authform" autocomplete="on">
        <label>Tên đăng nhập
          <input id="authuser" name="username" autocomplete="username" maxlength="20" required
            pattern="[A-Za-z0-9_.]{3,20}" title="3–20 ký tự: chữ không dấu, số, dấu chấm, gạch dưới" />
        </label>
        <label>Mật khẩu
          <input id="authpass" name="password" type="password" minlength="6" maxlength="100" required
            autocomplete="${reg ? 'new-password' : 'current-password'}" />
        </label>
        <p class="formerr" id="autherr" hidden></p>
        <button class="wide" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Đang xử lý…' : reg ? 'Đăng ký' : 'Đăng nhập'}</button>
      </form>`;
    body.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { accountTab = b.dataset.tab; render(); }));
    body.querySelector('#authform').addEventListener('submit', (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      const user = body.querySelector('#authuser').value.trim();
      const pass = body.querySelector('#authpass').value;
      send({ t: reg ? 'register' : 'login', user, pass });
      const btn = body.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Đang xử lý…';
    });
  }

  /** Độ thân thiết + danh sách phần thưởng theo bậc của một linh thú */
  function bondHtml(bond) {
    const t = bondOf(bond), next = BONDS[t + 1];
    const rows = Object.entries(BOND_REWARDS).map(([tier, rw]) =>
      `<li class="${t >= +tier ? 'got' : ''}">${BONDS[tier].name} (${BONDS[tier].min}): ${rw.text}, +${rw.gift} công đức</li>`).join('');
    return `<span class="p-bond"><b>${BONDS[t].name}</b><span>${next ? `${bond}/${next.min} điểm thân thiết` : `${bond} điểm thân thiết`}</span></span>
      <ul class="p-rw">${rows}</ul>`;
  }

  function renderPets() {
    const { lv, petKind, petBonds = {} } = me();
    const unlocked = PET_ORDER.filter((k) => lv >= PETS[k].lv).length;
    body.innerHTML = `
      <h2 id="modal-title">Linh thú</h2>
      <p class="muted">Mỗi linh thú mở khóa khi bạn đạt một cấp tu. Vuốt ve (+1) và cho ăn (+3) để tăng thân thiết; mỗi bậc linh thú học một trò mới. Đã mở ${unlocked}/${PET_ORDER.length}.</p>
      <ul class="pets">${PET_ORDER.map((k) => {
        const p = PETS[k], open = lv >= p.lv, on = petKind === k;
        const action = !open ? `<span class="p-lock">Mở khi đạt ${LEVELS[p.lv].name}</span>`
          : on ? `<button class="ghost" data-pet="" type="button">Cất đi</button>`
          : `<button data-pet="${k}" type="button">Dắt theo</button>`;
        return `<li class="${open ? '' : 'locked'} ${on ? 'on' : ''}">
          <span class="p-name">${p.name}${on ? ' · đang đi cùng' : ''}</span>${action}
          <span class="p-desc">${p.desc}</span>
          ${open ? bondHtml(petBonds[k] || 0) : ''}</li>`;
      }).join('')}</ul>`;
    body.querySelectorAll('button[data-pet]').forEach((b) => b.addEventListener('click', () => setPet(b.dataset.pet || null)));
  }

  function render() {
    if (view === 'board') renderBoard();
    else if (view === 'account') renderAccount();
    else if (view === 'pets') renderPets();
  }

  return {
    openBoard() { board = null; open('board'); send({ t: 'board' }); },
    openAccount() { open('account'); },
    openPets() { open('pets'); },
    /** Hồ sơ vừa đổi (cấp tu, linh thú): vẽ lại nếu đang mở bảng linh thú */
    onMe() { if (view === 'pets') renderPets(); },
    onBoard(m) { board = m; if (view === 'board') render(); },
    onAuth() { busy = false; close(); },
    /** Lỗi từ server: nếu đang mở form tài khoản thì hiện ngay trong form. Trả về true nếu đã hiện. */
    onError(msg) {
      if (view !== 'account' || !busy) return false;
      busy = false;
      const err = body.querySelector('#autherr');
      const btn = body.querySelector('button[type=submit]');
      if (btn) { btn.disabled = false; btn.textContent = accountTab === 'register' ? 'Đăng ký' : 'Đăng nhập'; }
      if (err) { err.textContent = msg; err.hidden = false; }
      return true;
    },
    refresh: render,
    get isOpen() { return !modal.hidden; },
  };
}
