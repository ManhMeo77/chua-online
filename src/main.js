import * as THREE from 'three';
import { buildTemple, SAN_SKY } from './temple.js';
import { buildLandscape } from './landscape.js';
import { buildInterior, CD_SKY } from './interior.js';
import { Leaves } from './leaves.js';
import { updateStatues } from './statues.js';
import { createLookEditor } from './lookeditor.js';
import { DEFAULT_LOOK, cleanLook, sameLook } from './shared/looks.js';
import { BEADS_PER_ROUND, BEAD_MIN_MS, ROUND_MERIT, MANTRAS, SWEEP_PER_MERIT } from './shared/chores.js';
import { Monk } from './monk.js';
import { Net, getClientId, setClientId } from './net.js';
import { createPanels } from './panels.js';
import { Pet } from './pets.js';
import { PETS } from './shared/pets.js';
import { QUESTS, QUEST_BONUS } from './shared/quests.js';
import { CARE, MOODS, BONDS, bondOf, FOODS, TRICKS, tricksFor, BLESSING_MERIT } from './shared/petcare.js';
import * as audio from './audio.js';
import { resolveCollision, findPath, randomSpawn, WALK_SPEED, RUN_SPEED, INTERACT, distTo, portalAt, MAPS, MAP_NAMES, PLAYER_RADIUS } from './shared/world.js';
import { ACTIONS, LEVELS, progressOf, checkinBonus } from './shared/merit.js';

// ───────────────────────── Renderer, scene, camera ─────────────────────────
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);

// ───────────────────────── Hai bản đồ: sân chùa và Chánh Điện ─────────────────────────
// Mỗi map là một nhóm riêng; chỉ nhóm của map hiện tại được hiện (đèn trong nhóm ẩn cũng tắt theo).
const sanRoot = new THREE.Group();
const cdRoot = new THREE.Group();
scene.add(sanRoot, cdRoot);
const temple = buildTemple(sanRoot);
const landscape = buildLandscape(sanRoot);
const interior = buildInterior(cdRoot);
const leaves = new Leaves(sanRoot); // lá rụng trên sân, chung cả phòng
addSkyPanorama(sanRoot);

/** Tranh núi non (tạo bằng ChatGPT) quấn quanh chân trời. Không có ảnh thì bỏ qua, vẫn còn núi 3D. */
function addSkyPanorama(root) {
  new THREE.TextureLoader().load('/textures/nui.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.MirroredRepeatWrapping; // lặp soi gương để không lộ đường nối
    tex.repeat.set(4, 1);
    const sky = new THREE.Mesh(
      new THREE.CylinderGeometry(300, 300, 150, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    sky.position.y = 48; // nửa dưới (sương) chạm chân trời
    sky.renderOrder = -1;
    root.add(sky);
  }, undefined, () => {});
}

let curMap = 'san';
const collideMap = (x, z, r = PLAYER_RADIUS) => resolveCollision(x, z, r, curMap); // va chạm theo map hiện tại
// trong điện: camera thấp hơn và nhìn cao hơn để thấy tượng Phật trên bệ thờ
const MAP_VIEW = { san: { ...SAN_SKY, maxDist: 26, pitch: 0.5, lookY: 1.1 }, cd: { ...CD_SKY, maxDist: 13, pitch: 0.3, lookY: 1.6 } };

function setMap(map) {
  curMap = map;
  sanRoot.visible = map === 'san';
  cdRoot.visible = map === 'cd';
  const v = MAP_VIEW[map];
  scene.background = new THREE.Color(v.color);
  scene.fog = new THREE.Fog(v.color, v.fogNear, v.fogFar);
  renderer.toneMappingExposure = map === 'cd' ? 1.15 : 1.05;
  cam.dist = Math.min(cam.dist, v.maxDist);
  clickTarget = null; pendingAct = null; marker.visible = false;
  me.petObj?.setMap(map);
  document.body.dataset.map = map;
  updateDoorButton();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ───────────────────────── Tên ngẫu nhiên kiểu "Sen Lành" ─────────────────────────
const A = ['Sen', 'Mây', 'Gió', 'Trúc', 'Sương', 'Nắng', 'Suối', 'Lá', 'Khói', 'Hoa', 'Sao', 'Chim', 'Trăng'];
const B = ['Lành', 'Hiền', 'Mai', 'Xuân', 'Thu', 'Khuya', 'Ngàn', 'Biếc', 'Hồng', 'Nhỏ', 'Mới', 'An'];
const randomName = () => `${A[Math.floor(Math.random() * A.length)]} ${B[Math.floor(Math.random() * B.length)]}`;

const QUOTES = [
  'Đi chậm một chút, thở sâu một chút.',
  'Lòng lặng rồi, ở đâu cũng là chùa.',
  'Gieo một hạt lành, đợi một mùa an.',
  'Buông bớt một điều, nhẹ thêm một bước.',
  'Một tiếng chuông, một lần trở về.',
];

// ───────────────────────── DOM ─────────────────────────
const $ = (id) => document.getElementById(id);
const ui = {
  gate: $('gate'), nameInput: $('nameinput'), enterBtn: $('enterbtn'), quote: $('quote'),
  room: $('room'), count: $('count'), status: $('status'),
  chatlog: $('chatlog'), chatform: $('chatform'), chatinput: $('chatinput'),
  merit: $('merit'), lvname: $('lvname'), lvbar: $('lvbar'), meritPill: $('meritpill'),
  mute: $('mute'), notice: $('notice'), toasts: $('toasts'),
  checkin: $('checkin'), boardBtn: $('boardbtn'), accountBtn: $('accountbtn'), petBtn: $('petbtn'),
  petcard: $('petcard'), pcName: $('pc-name'), pcMood: $('pc-mood'), pcBond: $('pc-bond'), pcFull: $('pc-full'), pcJoy: $('pc-joy'),
  pcPat: $('pc-pat'), pcFeed: $('pc-feed'), pcTricks: $('pc-tricks'),
  quests: $('quests'), qhead: $('qhead'), qcount: $('qcount'), qlist: $('qlist'),
  actBtns: { incense: $('act-incense'), bell: $('act-bell'), le: $('act-le') },
  door: $('act-door'), fade: $('mapfade'), mapname: $('mapname'),
  sweepBtn: $('act-sweep'), beadsBtn: $('act-beads'),
  gateLook: $('gatelook'), lookBtn: $('lookbtn'), lookPanel: $('lookpanel'), lookEdit: $('lookedit'),
  lpSave: $('lp-save'), lpCancel: $('lp-cancel'), lpClose: $('lp-close'),
  beads: $('beads'), bdRing: $('bd-ring'), bdSvg: $('bd-svg'), bdCur: $('bd-cur'), bdRound: $('bd-round'), bdMantra: $('bd-mantra'),
  bdMantras: $('bd-mantras'), bdN: $('bd-n'), bdRounds: $('bd-rounds'), bdMo: $('bd-mo'), bdReset: $('bd-reset'), bdClose: $('bd-close'),
};
ui.quote.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
let savedName = '';
try { savedName = localStorage.getItem('dichua.name') || ''; } catch {}
ui.nameInput.value = savedName || randomName();

function logChat(name, text, sys = false) {
  const div = document.createElement('div');
  div.className = 'msg' + (sys ? ' sys' : '');
  if (sys) div.textContent = text;
  else { const b = document.createElement('b'); b.textContent = name + ': '; div.append(b, text); }
  ui.chatlog.append(div);
  while (ui.chatlog.children.length > 6) ui.chatlog.firstChild.remove();
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  ui.toasts.append(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2700);
}

let noticeTimer = 0;
function showNotice(text) {
  ui.notice.textContent = text;
  ui.notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (ui.notice.hidden = true), 7000);
}

// ───────────────────────── Âm thanh: hiệu ứng + nhạc nền ─────────────────────────
const sp = { pop: $('soundpop'), fx: $('sp-fx'), fxVol: $('sp-fxvol'), fxVal: $('sp-fxval'), music: $('sp-music'), musicVol: $('sp-musicvol'), musicVal: $('sp-musicval') };
function syncMute() {
  const fxOn = !audio.isMuted();
  ui.mute.querySelector('.bl').textContent = !fxOn ? 'Âm thanh: tắt' : audio.music.on ? 'Âm thanh ♪' : 'Âm thanh';
  ui.mute.dataset.sound = fxOn ? 'on' : 'off'; // đổi icon loa
  ui.mute.title = !fxOn ? 'Đang tắt toàn bộ âm thanh' : audio.music.on ? 'Đang bật hiệu ứng và nhạc nền' : 'Đang bật hiệu ứng, nhạc nền tắt';
  sp.fx.checked = fxOn;
  sp.music.checked = audio.music.on;
  sp.music.disabled = !fxOn;
  sp.fxVol.value = Math.round(audio.getFxVolume() * 100);
  sp.musicVol.value = Math.round(audio.music.volume * 100);
  sp.fxVal.textContent = sp.fxVol.value;
  sp.musicVal.textContent = sp.musicVol.value;
  sp.fxVol.disabled = !fxOn;
  sp.musicVol.disabled = !fxOn || !audio.music.on;
}
syncMute();
const setSoundPop = (open) => { sp.pop.hidden = !open; ui.mute.setAttribute('aria-expanded', String(open)); };
ui.mute.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); setSoundPop(sp.pop.hidden); });
sp.pop.addEventListener('pointerdown', (e) => e.stopPropagation());
addEventListener('pointerdown', () => setSoundPop(false)); // bấm ra ngoài thì đóng
sp.fx.addEventListener('change', () => { audio.unlock(); audio.setMuted(!sp.fx.checked); syncMute(); });
sp.music.addEventListener('change', () => { audio.unlock(); audio.music.setOn(sp.music.checked); syncMute(); });
sp.fxVol.addEventListener('input', () => { audio.setFxVolume(sp.fxVol.value / 100); sp.fxVal.textContent = sp.fxVol.value; });
sp.fxVol.addEventListener('change', () => audio.chime(0.8)); // nghe thử mức âm lượng mới
sp.musicVol.addEventListener('input', () => { audio.music.setVolume(sp.musicVol.value / 100); sp.musicVal.textContent = sp.musicVol.value; });

const panels = createPanels({
  send: (m) => net?.send(m),
  me: () => me,
  setPet: (kind) => net?.send({ t: 'pet', kind }),
  logout: () => { setClientId(null); location.reload(); }, // hồ sơ khách mới sẽ được tạo
});
ui.boardBtn.addEventListener('click', () => net && panels.openBoard());
ui.accountBtn.addEventListener('click', () => net && panels.openAccount());
ui.petBtn.addEventListener('click', () => { if (!net) return; ui.petBtn.classList.remove('gold'); panels.openPets(); });

// ───────────────────────── Nhiệm vụ ngày ─────────────────────────
let questsOpen = innerWidth > 760; // điện thoại: thu gọn mặc định
try { const v = localStorage.getItem('dichua.questsOpen'); if (v !== null) questsOpen = v === '1'; } catch {}
ui.qhead.addEventListener('click', () => {
  questsOpen = !questsOpen;
  try { localStorage.setItem('dichua.questsOpen', questsOpen ? '1' : '0'); } catch {}
  renderQuests();
});
/** Đặt thẻ nhiệm vụ + dòng thông báo ngay dưới thanh trên cùng (thanh này xuống dòng trên điện thoại) */
function layoutTop() {
  const bottom = document.querySelector('.topbar').getBoundingClientRect().bottom;
  ui.quests.style.top = `${Math.round(bottom + 8)}px`;
  ui.notice.style.top = `${Math.round(bottom + 8)}px`;
}
addEventListener('resize', layoutTop);

function renderQuests() {
  const q = me.quests;
  if (!q) return;
  ui.quests.hidden = false;
  layoutTop();
  const done = q.list.filter((x) => x.done).length;
  ui.qcount.textContent = `${done}/${q.list.length}`;
  ui.qhead.setAttribute('aria-expanded', String(questsOpen));
  ui.qlist.hidden = !questsOpen;
  ui.qlist.innerHTML = '';
  for (const it of q.list) {
    const def = QUESTS[it.id];
    const li = document.createElement('li');
    li.className = it.done ? 'done' : '';
    const prog = def.unit ? `${it.n}/${it.goal} ${def.unit}` : `${it.n}/${it.goal}`;
    li.innerHTML = `<div class="q-row"><span class="q-title"></span><span class="q-rw">+${def.reward}</span></div>
      <div class="q-row"><span class="q-bar"><i style="width:${Math.round((it.n / it.goal) * 100)}%"></i></span><span class="q-prog">${it.done ? 'Xong' : prog}</span></div>`;
    li.querySelector('.q-title').textContent = def.title;
    ui.qlist.append(li);
  }
  const bonus = document.createElement('li');
  bonus.className = 'q-bonus' + (q.bonus ? ' done' : '');
  bonus.textContent = q.bonus ? `Đã xong cả ${q.list.length} nhiệm vụ · +${QUEST_BONUS}` : `Xong cả ${q.list.length} nhiệm vụ: thưởng thêm +${QUEST_BONUS}`;
  ui.qlist.append(bonus);
}

// ───────────────────────── Linh thú ─────────────────────────
/** holder là `me` hoặc một phần tử trong `others` */
function setPet(holder, kind, mood, tier) {
  if ((holder.petKind || null) !== (kind || null)) {
    holder.petObj?.dispose();
    holder.petObj = null;
    holder.petKind = kind || null;
    if (kind && PETS[kind]) {
      holder.petObj = new Pet(kind);
      holder.petObj.map = curMap;
      scene.add(holder.petObj.root);
    }
  }
  if (mood !== undefined) holder.petObj?.setMood(mood);
  if (tier !== undefined) holder.petObj?.setTier(tier);
}

// ───────────────────────── Chăm linh thú ─────────────────────────
function careState() {
  const c = me.petCare;
  if (!c) return null;
  const now = performance.now();
  return { ...c, patWait: Math.max(0, c.patEnd - now), feedWait: Math.max(0, c.feedEnd - now), trickWait: Math.max(0, c.trickEnd - now) };
}
function renderPetCard() {
  const c = careState();
  ui.petcard.hidden = !c || !me.petKind;
  if (ui.petcard.hidden) return;
  const p = PETS[me.petKind], mood = MOODS[c.mood];
  ui.pcName.textContent = p.name;
  ui.pcMood.textContent = mood.label;
  ui.pcMood.style.setProperty('--mood', mood.color);
  const bt = bondOf(c.bond), next = BONDS[bt + 1];
  ui.pcBond.textContent = next ? `${BONDS[bt].name} · ${c.bond}/${next.min}` : `${BONDS[bt].name} · ${c.bond}`;
  ui.pcBond.title = next ? `Còn ${next.min - c.bond} điểm thân thiết nữa để thành ${next.name}` : 'Đã đạt bậc thân thiết cao nhất';
  // nút làm trò: chỉ tạo lại khi danh sách trò đổi (tạo lại liên tục sẽ làm mất cú bấm)
  const tricks = tricksFor(c.tier).join(',');
  if (ui.pcTricks.dataset.list !== tricks) {
    ui.pcTricks.dataset.list = tricks;
    ui.pcTricks.innerHTML = '';
    for (const k of tricksFor(c.tier)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.trick = k;
      b.textContent = TRICKS[k].name;
      b.addEventListener('click', () => net?.send({ t: 'trick', trick: k }));
      ui.pcTricks.append(b);
    }
    ui.pcTricks.hidden = !tricks;
  }
  for (const b of ui.pcTricks.children) b.disabled = c.trickWait > 0;
  ui.pcFull.style.width = `${c.full}%`;
  ui.pcJoy.style.width = `${c.joy}%`;
  ui.pcFull.parentElement.title = `Độ no ${c.full}/100`;
  ui.pcJoy.parentElement.title = `Độ vui ${c.joy}/100`;
  ui.pcPat.disabled = c.patWait > 0;
  ui.pcPat.textContent = c.patWait > 0 ? `${Math.ceil(c.patWait / 1000)}s` : 'Vuốt ve';
  const full = c.full >= CARE.feed.fullLimit;
  ui.pcFeed.disabled = full || c.feedWait > 0;
  ui.pcFeed.textContent = full ? 'Còn no' : c.feedWait > 0 ? `${Math.ceil(c.feedWait / 1000)}s` : 'Cho ăn';
  ui.pcFeed.title = `Cho ${p.name.toLowerCase()} ăn ${FOODS[me.petKind]} (+${CARE.feed.merit} công đức)`;
}
ui.pcPat.addEventListener('click', () => { audio.unlock(); net?.send({ t: 'pat' }); });
ui.pcFeed.addEventListener('click', () => { audio.unlock(); net?.send({ t: 'feed' }); });

/** Ai đó (by) vuốt ve / cho ăn linh thú của chủ (ownerId): chạy hoạt ảnh cho cả hai */
function playPetAct(ownerId, a, byId, trick) {
  const owner = ownerId === net.myId ? me : others.get(ownerId);
  if (!owner?.petObj) return;
  const pet = owner.petObj;
  if (a === 'trick') { pet.react(trick); return; }
  pet.react(a);
  const doer = byId === net.myId ? me : others.get(byId);
  if (doer?.monk) {
    const face = Math.atan2(pet.root.position.x - doer.monk.root.position.x, pet.root.position.z - doer.monk.root.position.z);
    if (doer === me) me.ry = face; else doer.ry = face;
    doer.monk.play(a);
  }
  const vol = audio.falloff(Math.hypot(me.x - pet.root.position.x, me.z - pet.root.position.z), 2, 18);
  if (a === 'pat') audio.chime(vol * 0.5);
}
ui.checkin.addEventListener('click', () => net?.send({ t: 'checkin' }));

function updateAccountHud() {
  requestAnimationFrame(layoutTop); // số nút trên thanh có thể đổi
  ui.accountBtn.querySelector('.bl').textContent = me.user ? me.user : 'Đăng ký';
  ui.accountBtn.classList.toggle('gold', false);
  ui.checkin.hidden = !net;
  ui.checkin.disabled = me.ck.done;
  ui.checkin.classList.toggle('gold', !me.ck.done);
  ui.checkin.querySelector('.bl').textContent = me.ck.done
    ? `Đã điểm danh${me.ck.streak > 1 ? ` · ${me.ck.streak} ngày liền` : ''}`
    : `Điểm danh +${checkinBonus(me.ck.streak + 1)}`;
}

// ───────────────────────── Người chơi ─────────────────────────
const spawn = randomSpawn();
const me = {
  x: spawn.x, z: spawn.z, ry: 0, m: 0, monk: null, name: '',
  merit: 0, lv: 0, color: '#c98a3a', user: null, ck: { done: true, streak: 0 },
  cdEnd: { incense: 0, bell: 0 }, // mốc performance.now() hết thời gian chờ
  broom: false, sweep: 0, // đang cầm chổi? số lá đã quét hôm nay
};
let beadsOpen = false;

// ngoại hình: nhớ trong trình duyệt để lần sau màn hình vào chùa chọn sẵn
let lookChosen = false; // người chơi đã tự chọn (mới gửi lên server khi vào chùa)
let knownLv = 0; // cấp tu lần trước (để màn hình vào chùa biết kiểu áo nào đã mở)
try {
  const saved = JSON.parse(localStorage.getItem('dichua.look') || 'null');
  if (saved) { me.look = cleanLook(saved, 99); lookChosen = true; }
  knownLv = Number(localStorage.getItem('dichua.lv')) || 0;
} catch {}
me.look ??= { ...DEFAULT_LOOK };
const saveLook = () => { try { localStorage.setItem('dichua.look', JSON.stringify(me.look)); } catch {} };
/** @type {Map<number, {monk: Monk, x:number, z:number, ry:number, m:number, lv:number}>} */
const others = new Map();
let net = null;

function setMyMonk() {
  me.monk?.dispose();
  me.monk = new Monk({ name: me.name || ui.nameInput.value, look: me.look, isMe: true, sub: LEVELS[me.lv].name });
  me.monk.root.position.set(me.x, 0, me.z);
  me.monk.holdBroom(me.broom);
  me.monk.setPose(beadsOpen ? 'beads' : null);
  scene.add(me.monk.root);
}
setMyMonk(); // hiện trước để màn chờ có cảnh

function addOther(p) {
  if (p.id === net?.myId || others.has(p.id)) return;
  const monk = new Monk({ name: p.name, look: p.look, color: p.color, sub: LEVELS[p.lv || 0].name });
  monk.root.position.set(p.x, 0, p.z);
  monk.root.rotation.y = p.ry;
  scene.add(monk.root);
  const o = { monk, x: p.x, z: p.z, ry: p.ry, m: p.m, lv: p.lv || 0 };
  others.set(p.id, o);
  monk.holdBroom(p.broom);
  monk.setPose(p.pose);
  setPet(o, p.pet, p.petMood, p.petTier);
}
function removeOther(id) {
  const o = others.get(id);
  if (!o) return;
  o.monk.dispose();
  o.petObj?.dispose();
  others.delete(id);
}

function updateMeritHud() {
  const pr = progressOf(me.merit);
  ui.merit.textContent = me.merit;
  ui.lvname.textContent = LEVELS[me.lv].name;
  ui.lvbar.style.width = `${Math.round(pr.pct * 100)}%`;
  ui.meritPill.title = pr.next ? `Còn ${pr.next - me.merit} công đức nữa để lên ${LEVELS[pr.level + 1].name}` : 'Đã đạt cấp tu cao nhất';
}

/** Hiệu ứng + âm thanh khi một người (mình hoặc người khác) thắp hương / đánh chuông / lễ Phật */
function playAct(a, monk, setFacing) {
  const p = INTERACT[a];
  if (p.map !== curMap) return;
  // lễ Phật: luôn quay mặt về bàn thờ (phía bắc)
  setFacing(a === 'le' ? Math.PI : Math.atan2(p.x - monk.root.position.x, p.z - monk.root.position.z));
  monk.play(a);
  const vol = audio.falloff(Math.hypot(me.x - p.x, me.z - p.z));
  if (a === 'le') {
    setTimeout(() => interior.flash(), 700);
    setTimeout(() => audio.chime(vol * 0.9), 700);
    setTimeout(() => audio.bell(vol * 0.35), 2100);
  } else if (a === 'incense') {
    setTimeout(() => temple.addIncense(), 1300);
    setTimeout(() => audio.chime(vol), 1300);
  } else {
    setTimeout(() => { temple.ringBell(); }, 0);
    setTimeout(() => audio.bell(vol), 420); // khớp lúc khúc gỗ chạm chuông (file ghi âm có tiếng gõ ngay đầu)
  }
}

function onMsg(m) {
  switch (m.t) {
    case 'welcome': {
      for (const id of [...others.keys()]) removeOther(id);
      const mine = m.players.find((p) => p.id === m.id);
      if (mine) { me.x = mine.x; me.z = mine.z; me.ry = mine.ry; me.color = mine.color; me.lv = mine.lv || 0; if (mine.look) me.look = mine.look; setMyMonk(); setPet(me, mine.pet, mine.petMood, mine.petTier); }
      setMap(m.map || 'san');
      m.players.forEach(addOther);
      me.broom = false; me.monk.holdBroom(false);
      if (beadsOpen) net.send({ t: 'pose', pose: 'beads' });
      ui.room.textContent = m.room;
      ui.count.textContent = m.players.length;
      const url = new URL(location.href);
      url.searchParams.set('phong', m.room);
      history.replaceState(null, '', url);
      logChat('', `Bạn đã vào ${m.room}. Chúc an lạc 🙏`, true);
      break;
    }
    case 'me': {
      const lvChanged = m.lv !== me.lv;
      me.merit = m.merit;
      me.lv = m.lv;
      const now = performance.now();
      for (const a of Object.keys(m.cd)) me.cdEnd[a] = now + m.cd[a];
      const userChanged = m.user !== me.user;
      me.user = m.user;
      me.ck = m.ck;
      me.sweep = m.sweep || 0;
      try { localStorage.setItem('dichua.lv', String(m.lv)); } catch {}
      // hồ sơ trên server có ngoại hình khác (ví dụ vừa đăng nhập trên máy mới) → theo server
      if (m.look && !lookOpen && !sameLook(m.look, me.look)) { me.look = m.look; me.monk.setLook(me.look); saveLook(); }
      if (lvChanged) me.monk.setName(me.name, LEVELS[me.lv].name);
      updateMeritHud();
      updateAccountHud();
      setPet(me, m.pet, m.petCare?.mood ?? null);
      me.petCare = m.petCare && { ...m.petCare, patEnd: performance.now() + m.petCare.patCd, feedEnd: performance.now() + m.petCare.feedCd, trickEnd: performance.now() + m.petCare.trickCd };
      me.petBonds = m.petBonds || {};
      if (m.petCare) me.petObj?.setTier(m.petCare.tier);
      renderPetCard();
      if (userChanged) panels.refresh(); // không vẽ lại form khi người dùng đang gõ
      panels.onMe();
      break;
    }
    case 'gain':
      if (m.a === 'checkin') {
        toast(m.streak > 1 ? `Điểm danh ${m.streak} ngày liền: +${m.merit} công đức` : `Điểm danh hôm nay: +${m.merit} công đức`, 'gain');
        audio.chime(0.8);
      } else if (m.a === 'quest') {
        toast(`Xong nhiệm vụ "${m.title}": +${m.merit} công đức`, 'gain');
        audio.chime(0.7);
      } else if (m.a === 'feed') {
        toast(m.merit > 0 ? `Cho ăn ${m.food}: +${m.merit} công đức` : `Đã cho ăn ${m.food}`, 'gain');
      } else if (m.a === 'bond') {
        toast(`${PETS[m.pet].name} đã thành ${BONDS[m.tier].name}: ${m.text} · +${m.merit} công đức`, 'level');
        audio.chime(0.9);
      } else if (m.a === 'blessing') {
        toast(`Phúc lành của ${PETS[m.pet].name}: +${m.merit} công đức`, 'gain');
      } else if (m.a === 'sweep') {
        toast(m.merit > 0 ? `Quét lá sân chùa: +${m.merit} công đức` : 'Hôm nay đã đủ công đức, quét lá vẫn là việc lành 🍂', 'gain');
      } else if (m.a === 'beadround') {
        toast(m.merit > 0 ? `Tròn chuỗi thứ ${m.rounds} hôm nay: +${m.merit} công đức` : `Tròn chuỗi thứ ${m.rounds} hôm nay`, 'level');
        audio.chime(0.8);
      } else if (m.a === 'questbonus') {
        toast(`Hoàn thành mọi nhiệm vụ hôm nay: +${m.merit} công đức`, 'level');
      } else if (m.merit > 0) toast(`+${m.merit} công đức`, 'gain');
      else toast('Hôm nay đã đủ công đức, ngày mai lại tiếp nhé', '');
      ui.meritPill.classList.remove('pulse');
      void ui.meritPill.offsetWidth;
      ui.meritPill.classList.add('pulse');
      break;
    case 'act': {
      if (m.id === net.myId) {
        clickTarget = null; marker.visible = false;
        playAct(m.a, me.monk, (ry) => (me.ry = ry));
      } else {
        const o = others.get(m.id);
        if (o) playAct(m.a, o.monk, (ry) => (o.ry = ry));
      }
      break;
    }
    case 'level': {
      if (m.id === net.myId) { toast(`Chúc mừng! Bạn đã lên cấp ${LEVELS[m.lv].name}`, 'level'); break; }
      const o = others.get(m.id);
      if (o) { o.lv = m.lv; o.monk.setName(o.monk.name, LEVELS[m.lv].name); }
      break;
    }
    case 'notice': showNotice(m.text); break;
    case 'quests': me.quests = m; renderQuests(); break;
    case 'unlock':
      for (const k of m.pets) toast(`Mở khóa linh thú: ${PETS[k].name}`, 'level');
      ui.petBtn.classList.add('gold');
      break;
    case 'petact': playPetAct(m.id, m.a, m.by, m.trick); break;
    case 'petbond': {
      const h = m.id === net.myId ? me : others.get(m.id);
      h?.petObj?.setTier(m.tier);
      break;
    }
    case 'petmood': {
      const h = m.id === net.myId ? me : others.get(m.id);
      h?.petObj?.setMood(m.mood, true);
      break;
    }
    case 'petnote': toast(m.text, 'gain'); break;
    case 'pet':
      if (m.id === net.myId) setPet(me, m.pet, m.mood, m.tier);
      else { const o = others.get(m.id); if (o) setPet(o, m.pet, m.mood, m.tier); }
      panels.onMe();
      break;
    case 'board': panels.onBoard(m); break;
    case 'auth':
      setClientId(m.cid); // lần sau mở trình duyệt sẽ vào thẳng hồ sơ này
      panels.onAuth();
      toast(m.created ? `Đã tạo tài khoản ${m.user}. Công đức của bạn giờ được giữ lâu dài.` : `Chào mừng trở lại, ${m.user}`, 'level');
      break;
    case 'rename': {
      if (m.id === net.myId) {
        me.name = m.name;
        me.lv = m.lv;
        try { localStorage.setItem('dichua.name', me.name); } catch {}
        me.monk.setName(me.name, LEVELS[me.lv].name);
        setPet(me, m.pet, m.petMood, m.petTier);
        break;
      }
      const o = others.get(m.id);
      if (o) { o.lv = m.lv; o.monk.setName(m.name, LEVELS[m.lv].name); setPet(o, m.pet, m.petMood, m.petTier); }
      break;
    }
    case 'join':
      addOther(m.p);
      if (m.from) logChat('', m.from === 'cd' ? `${m.p.name} từ Chánh Điện bước ra sân.` : `${m.p.name} vừa vào Chánh Điện.`, true);
      else logChat('', `${m.p.name} vừa bước qua cổng tam quan.`, true);
      break;
    case 'leaves': leaves.setAll(m.l); break;
    case 'leaf': leaves.add(m.l); break;
    case 'swept': {
      const who = m.by === net.myId ? me.monk : others.get(m.by)?.monk;
      const pos = who ? who.root.position : { x: me.x, z: me.z };
      leaves.sweep(m.ids, pos.x, pos.z);
      const now = performance.now();
      if (now - lastSwish > 140) { lastSwish = now; audio.swish(audio.falloff(Math.hypot(me.x - pos.x, me.z - pos.z), 2, 20)); }
      break;
    }
    case 'broom': {
      if (m.id === net.myId) {
        me.broom = m.on;
        me.monk.holdBroom(m.on);
        if (m.on) toast(`Đã cầm chổi. Đi qua chỗ có lá để quét, ${SWEEP_PER_MERIT} lá được 1 công đức.`, 'gain');
        updateSweepButton();
      } else others.get(m.id)?.monk.holdBroom(m.on);
      break;
    }
    case 'look':
      if (m.id === net.myId) { if (!lookOpen) { me.look = m.look; me.monk.setLook(m.look); saveLook(); } }
      else others.get(m.id)?.monk.setLook(m.look);
      break;
    case 'pose':
      if (m.id !== net.myId) others.get(m.id)?.monk.setPose(m.pose);
      break;
    case 'beads':
      // các lần bấm còn chờ server xác nhận thì giữ số trên máy, xong hết mới khớp lại theo server
      beadPending = Math.max(0, beadPending - 1);
      if (!beadPending || m.reset) { bead.n = m.n; bead.rounds = m.rounds; bead.cur = m.cur; renderBeads(); }
      break;
    case 'mapchange': {
      for (const id of [...others.keys()]) removeOther(id);
      me.broom = false; me.monk.holdBroom(false); // chổi để lại ngoài sân
      me.x = m.x; me.z = m.z; me.ry = m.ry;
      me.monk.root.position.set(me.x, 0, me.z);
      me.monk.root.rotation.y = me.ry;
      setMap(m.map);
      m.players.forEach(addOther);
      cam.pitch = MAP_VIEW[m.map].pitch;
      cam.yaw = 0; // camera phía nam nhìn về bắc: thấy bàn thờ (trong điện) hoặc cả sân (ngoài sân)
      camTarget.set(me.x, MAP_VIEW[m.map].lookY, me.z);
      portalPending = 0;
      lastSent = '';
      setTimeout(() => ui.fade.classList.remove('on'), 120);
      ui.mapname.textContent = MAP_NAMES[m.map];
      ui.mapname.classList.remove('show'); void ui.mapname.offsetWidth; ui.mapname.classList.add('show');
      if (m.map === 'cd') audio.chime(0.5);
      break;
    }
    case 'leave': removeOther(m.id); break;
    case 'count': ui.count.textContent = m.n; break;
    case 'states':
      for (const [id, x, z, ry, mv] of m.s) {
        const o = others.get(id);
        if (o) { o.x = x; o.z = z; o.ry = ry; o.m = mv; }
      }
      break;
    case 'chat': {
      logChat(m.name, m.text);
      if (m.id === net.myId) me.monk.say(m.text);
      else others.get(m.id)?.monk.say(m.text);
      break;
    }
    case 'error': if (!panels.onError(m.msg)) toast(m.msg, 'warn'); break;
  }
}

function enterTemple() {
  audio.unlock();
  me.name = ui.nameInput.value.trim().slice(0, 20) || randomName();
  try { localStorage.setItem('dichua.name', me.name); } catch {}
  if (lookChosen) saveLook();
  setMyMonk();
  ui.gate.classList.add('hidden');
  net = new Net({
    hello: () => ({ cid: getClientId(), name: me.name, phong: new URLSearchParams(location.search).get('phong') || 'chua-1', look: lookChosen ? me.look : undefined }),
    onMsg,
    onStatus: (ok) => {
      ui.status.textContent = ok ? 'Đã kết nối' : 'Mất kết nối, đang thử lại…';
      ui.status.className = 'pill status ' + (ok ? 'ok' : 'bad');
    },
  });
}
ui.enterBtn.addEventListener('click', enterTemple);

// ───────────────────────── Ngoại hình ─────────────────────────
// Màn hình vào chùa: chọn giới tính, kiểu áo, màu, phụ kiện; nhân vật phía sau đổi theo ngay
const gateEditor = createLookEditor(ui.gateLook, {
  lv: () => Math.max(me.lv, knownLv),
  onChange: (l) => { me.look = l; lookChosen = true; me.monk.setLook(l); },
});
gateEditor.load(me.look);

// Ngăn "Trang phục" trong game: xem trước trên nhân vật, Lưu mới gửi lên server
let lookOpen = false;
const lookEditor = createLookEditor(ui.lookEdit, { lv: () => me.lv, onChange: (l) => me.monk.setLook(l) });
function setLookOpen(open) {
  if (open === lookOpen) return;
  if (open) setBeadsOpen(false);
  lookOpen = open;
  ui.lookPanel.hidden = !open;
  document.body.classList.toggle('look-open', open);
  if (open) lookEditor.load(me.look);
  else me.monk.setLook(me.look); // Hủy: trả lại bộ đang mặc
}
ui.lookBtn.addEventListener('click', () => net && setLookOpen(!lookOpen));
ui.lpCancel.addEventListener('click', () => setLookOpen(false));
ui.lpClose.addEventListener('click', () => setLookOpen(false));
ui.lpSave.addEventListener('click', () => {
  const changed = !sameLook(lookEditor.look, me.look);
  me.look = lookEditor.look;
  lookChosen = true;
  saveLook();
  if (changed) { net?.send({ t: 'look', look: me.look }); toast('Đã thay trang phục 🙏', 'gain'); }
  setLookOpen(false);
});
ui.nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && enterTemple());

ui.chatform.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = ui.chatinput.value.trim();
  if (text && net) net.send({ t: 'chat', text });
  ui.chatinput.value = '';
  ui.chatinput.blur();
});

// ───────────────────────── Thắp hương / đánh chuông ─────────────────────────
let pendingAct = null; // hành động sẽ làm khi đi tới nơi
let lastActSent = 0;

function actState(a) {
  if (INTERACT[a].map !== curMap) return { state: 'away' };
  const wait = (me.cdEnd[a] || 0) - performance.now();
  if (wait > 0) return { state: 'cool', wait };
  if (distTo(a, me.x, me.z) <= INTERACT[a].range) return { state: 'ready' };
  return { state: 'far' };
}

function tryAct(a) {
  if (!net || me.monk.busy) return;
  if (a === 'broom' && me.broom) { pendingAct = null; return net.send({ t: 'broom', on: false }); } // đang cầm: cất chổi
  const s = actState(a);
  if (s.state === 'away') return;
  if (s.state === 'cool') return toast(`Chờ thêm ${Math.ceil(s.wait / 1000)} giây nhé`, 'warn');
  if (s.state === 'ready') {
    if (performance.now() - lastActSent < 800) return;
    lastActSent = performance.now();
    pendingAct = null;
    if (a === 'broom') return net.send({ t: 'broom', on: true });
    return net.send({ t: 'act', a });
  }
  // còn xa: tự đi tới cạnh vật thể rồi làm
  const p = INTERACT[a];
  const dx = me.x - p.x, dz = me.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  walkTo(collideMap(p.x + (dx / d) * (p.range - 0.8), p.z + (dz / d) * (p.range - 0.8)));
  marker.position.set(clickTarget.x, 0.03, clickTarget.z);
  marker.visible = true;
  pendingAct = a;
}

for (const [a, btn] of Object.entries(ui.actBtns)) btn.addEventListener('click', () => { audio.unlock(); tryAct(a); });

// Nút cửa: đi tới cửa chính điện (ở sân) hoặc cửa ra (trong Chánh Điện); bước vào cổng là tự chuyển map
function updateDoorButton() {
  const p = MAPS[curMap].portals[0];
  ui.door.querySelector('.al').textContent = p.label;
  ui.door.querySelector('small').textContent = curMap === 'san' ? 'Bấm để đi tới cửa chính điện' : 'Bấm để đi ra cửa';
}
ui.door.addEventListener('click', () => {
  if (!net || me.monk.busy) return;
  const p = MAPS[curMap].portals[0];
  pendingAct = null;
  const shown = collideMap((p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2); // sát cửa nhất có thể, vẫn nằm trong vùng cổng
  walkTo(shown);
  marker.position.set(shown.x, 0.03, shown.z);
  marker.visible = true;
});

// ───────────────────────── Quét lá ─────────────────────────
let lastSwish = 0;
ui.sweepBtn.addEventListener('click', () => { audio.unlock(); tryAct('broom'); });
function updateSweepButton() {
  const b = ui.sweepBtn;
  b.hidden = curMap !== 'san';
  if (b.hidden) return;
  const sub = b.querySelector('small');
  if (me.broom) {
    b.dataset.state = 'holding';
    b.querySelector('.al').textContent = 'Cất chổi';
    sub.textContent = `Đã quét ${me.sweep} lá hôm nay · sân còn ${leaves.count} lá`;
  } else {
    const s = actState('broom').state;
    b.dataset.state = s === 'ready' ? 'ready' : 'far';
    b.querySelector('.al').textContent = 'Quét lá';
    sub.textContent = s === 'ready' ? 'Lấy chổi · phím E' : `Sân có ${leaves.count} lá · bấm để đi lấy chổi`;
  }
}

// ───────────────────────── Tràng hạt ─────────────────────────
const bead = { n: 0, rounds: 0, cur: 0 };
let beadPending = 0, lastBeadAt = 0;
let mantraIdx = 0, moOn = true;
try { mantraIdx = Math.min(MANTRAS.length - 1, Math.max(0, Number(localStorage.getItem('dichua.mantra')) || 0)); moOn = localStorage.getItem('dichua.mo') !== '0'; } catch {}
ui.bdMo.checked = moOn;

// 108 hạt quanh vòng + một hạt "mẫu" màu đỏ ở đỉnh
const SVGNS = 'http://www.w3.org/2000/svg';
const beadEls = [];
(function buildRing() {
  const track = document.createElementNS(SVGNS, 'circle');
  Object.entries({ cx: 150, cy: 150, r: 134, class: 'track' }).forEach(([k, v]) => track.setAttribute(k, v));
  ui.bdSvg.append(track);
  const N = BEADS_PER_ROUND;
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + (i / (N + 1)) * Math.PI * 2;
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', (150 + Math.cos(a) * 134).toFixed(1));
    c.setAttribute('cy', (150 + Math.sin(a) * 134).toFixed(1));
    c.setAttribute('r', i === 0 ? 9 : 4.6);
    c.setAttribute('class', i === 0 ? 'guru' : 'b');
    ui.bdSvg.append(c);
    if (i) beadEls.push(c);
  }
})();

MANTRAS.forEach((text, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.textContent = text;
  b.addEventListener('click', () => {
    mantraIdx = i;
    try { localStorage.setItem('dichua.mantra', String(i)); } catch {}
    renderBeads();
  });
  ui.bdMantras.append(b);
});

let shownCur = -1;
function renderBeads() {
  ui.bdCur.textContent = bead.cur;
  ui.bdRound.textContent = `Chuỗi thứ ${bead.rounds + 1} hôm nay`;
  ui.bdMantra.textContent = MANTRAS[mantraIdx];
  ui.bdN.textContent = bead.n;
  ui.bdRounds.textContent = bead.rounds;
  [...ui.bdMantras.children].forEach((b, i) => b.setAttribute('aria-checked', String(i === mantraIdx)));
  if (shownCur !== bead.cur) {
    beadEls.forEach((c, i) => c.setAttribute('class', i < bead.cur - 1 ? 'b done' : i === bead.cur - 1 ? 'b cur' : 'b'));
    shownCur = bead.cur;
  }
}

function tapBead() {
  if (!net) return;
  const now = performance.now();
  if (now - lastBeadAt < BEAD_MIN_MS + 15) return; // khớp với giới hạn của server
  lastBeadAt = now;
  audio.unlock();
  bead.n++;
  bead.cur++;
  if (bead.cur >= BEADS_PER_ROUND) { bead.cur = 0; bead.rounds++; }
  beadPending++;
  net.send({ t: 'bead' });
  if (moOn) audio.mo(0.9);
  me.monk.beadTick();
  renderBeads();
  const center = ui.bdRing.querySelector('.bd-center');
  center.classList.remove('pop'); void center.offsetWidth; center.classList.add('pop');
}

function setBeadsOpen(open) {
  if (open === beadsOpen) return;
  if (open) setLookOpen(false);
  beadsOpen = open;
  ui.beads.hidden = !open;
  document.body.classList.toggle('beads-open', open);
  ui.beadsBtn.dataset.state = open ? 'holding' : 'far';
  me.monk.setPose(open ? 'beads' : null);
  net?.send({ t: 'pose', pose: open ? 'beads' : null });
  if (open) { renderBeads(); ui.bdRing.focus({ preventScroll: true }); }
}
ui.beadsBtn.addEventListener('click', () => { if (net) { audio.unlock(); setBeadsOpen(!beadsOpen); } });
ui.bdClose.addEventListener('click', () => setBeadsOpen(false));
ui.bdRing.addEventListener('click', (e) => { e.preventDefault(); tapBead(); });
// phím Cách / Enter do bộ lắng nghe chung xử lý; chặn hành vi "bấm nút" mặc định để không tính 2 lần
for (const ev of ['keydown', 'keyup']) ui.bdRing.addEventListener(ev, (e) => { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
ui.bdMo.addEventListener('change', () => { moOn = ui.bdMo.checked; try { localStorage.setItem('dichua.mo', moOn ? '1' : '0'); } catch {} });
ui.bdReset.addEventListener('click', () => {
  bead.cur = 0; beadPending = 0; renderBeads();
  net?.send({ t: 'bead', reset: true });
});

// Chuyển map: khi bước vào vùng cổng thì xin server cho sang (server kiểm tra lại vị trí)
let portalPending = 0;
function checkPortal() {
  if (!net || portalPending && performance.now() - portalPending < 2500) return;
  if (portalPending) { portalPending = 0; ui.fade.classList.remove('on'); } // server không trả lời: bỏ qua
  const p = portalAt(curMap, me.x, me.z);
  if (!p) return;
  net.send({ t: 'move', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), m: 0 }); // để server thấy mình đã tới cổng
  net.send({ t: 'portal' });
  portalPending = performance.now();
  clickTarget = null; marker.visible = false;
  ui.fade.classList.add('on');
}

function updateActButtons() {
  for (const [a, btn] of Object.entries(ui.actBtns)) {
    const s = actState(a);
    btn.hidden = s.state === 'away';
    if (btn.hidden) continue;
    const sub = btn.querySelector('small');
    btn.dataset.state = s.state;
    sub.textContent =
      s.state === 'cool' ? `Chờ ${Math.ceil(s.wait / 1000)} giây` :
      s.state === 'ready' ? `+${ACTIONS[a].merit} công đức · phím E` :
      a === 'incense' ? 'Bấm để đi tới lư hương' : a === 'bell' ? 'Bấm để đi tới gác chuông' : 'Bấm để đi tới bồ đoàn';
  }
}

// ───────────────────────── Điều khiển ─────────────────────────
const keys = new Set();
const typing = () => document.activeElement?.tagName === 'INPUT';
addEventListener('keydown', (e) => {
  if (typing()) { if (e.key === 'Escape') { document.activeElement.blur(); setSoundPop(false); } return; }
  if (panels.isOpen) return;
  if (beadsOpen) {
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tapBead(); return; }
    if (e.key === 'Escape') { setBeadsOpen(false); return; }
  }
  if (lookOpen && e.key === 'Escape') { setLookOpen(false); return; }
  if (!sp.pop.hidden && e.key === 'Escape') { setSoundPop(false); return; }
  if (e.key === 'Enter' && ui.gate.classList.contains('hidden')) { ui.chatinput.focus(); e.preventDefault(); return; }
  if (e.code === 'KeyE') {
    // làm hành động ở gần nhất
    const near = Object.keys(INTERACT).filter((a) => INTERACT[a].map === curMap).sort((a, b) => distTo(a, me.x, me.z) - distTo(b, me.x, me.z))[0];
    if (distTo(near, me.x, me.z) <= INTERACT[near].range) tryAct(near);
    return;
  }
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// Camera: kéo chuột/ngón tay để xoay, lăn chuột để zoom. Bấm (không kéo) xuống nền để đi tới.
const cam = { yaw: 0, pitch: 0.5, dist: 12 };
let drag = null;
let clickTarget = null; // đích cuối khi bấm để đi tới
let walkPath = []; // các điểm rẽ tìm được (vòng qua luống hoa, lư hương…), điểm cuối là đích
/** Đi tới một điểm: tìm đường vòng qua vật cản */
function walkTo(t) {
  clickTarget = t;
  walkPath = findPath(curMap, me.x, me.z, t.x, t.z);
}
const raycaster = new THREE.Raycaster();
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.25, 0.35, 24),
  new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.85, depthWrite: false }),
);
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);

function pick(e) {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // linh thú (của mình hoặc người khác) được ưu tiên vì nhỏ, dễ bị che
  if (me.petObj && raycaster.intersectObject(me.petObj.root, true).length) return { pet: net?.myId };
  for (const [id, o] of others) if (o.petObj && raycaster.intersectObject(o.petObj.root, true).length) return { pet: id };
  const L = curMap === 'san'
    ? { items: [...temple.interactables, ...landscape.interactables], ground: [...temple.groundMeshes, ...landscape.groundMeshes] }
    : { items: interior.interactables, ground: interior.groundMeshes };
  for (const it of L.items) {
    if (raycaster.intersectObject(it.object, true).length) return { kind: it.kind };
  }
  const hit = raycaster.intersectObjects(L.ground, false)[0];
  return hit ? { ground: hit.point } : null;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
let hoverAt = 0;
canvas.addEventListener('pointermove', (e) => {
  if (!drag) {
    // đổi con trỏ khi rê lên lư hương / chuông (giới hạn ~12 lần/giây)
    if (e.pointerType === 'mouse' && performance.now() - hoverAt > 80) {
      hoverAt = performance.now();
      const h = pick(e);
      canvas.style.cursor = h?.kind || h?.pet ? 'pointer' : '';
    }
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 6) drag.moved = true;
  if (drag.moved) {
    cam.yaw = drag.yaw - dx * 0.006;
    cam.pitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.004, 0.25, 1.35);
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved && ui.gate.classList.contains('hidden')) {
    const hit = pick(e);
    if (hit?.pet) net?.send(hit.pet === net.myId ? { t: 'pat' } : { t: 'pat', id: hit.pet });
    else if (hit?.kind) tryAct(hit.kind);
    else if (hit?.ground) {
      pendingAct = null;
      walkTo(collideMap(hit.ground.x, hit.ground.z));
      marker.position.set(clickTarget.x, 0.03, clickTarget.z);
      marker.visible = true;
    }
  }
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  cam.dist = THREE.MathUtils.clamp(cam.dist + Math.sign(e.deltaY) * 1.2, 5, MAP_VIEW[curMap].maxDist);
}, { passive: true });

// ───────────────────────── Vòng lặp ─────────────────────────
const clock = new THREE.Clock();
let sendTimer = 0;
let lastSent = '';
let buttonTimer = 0;
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function updateMe(dt) {
  let ix = 0, iz = 0;
  const busy = me.monk.busy || !!portalPending; // đang vái / thỉnh chuông / qua cửa thì đứng yên
  if (!typing() && !busy) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  }
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  let dx = 0, dz = 0;

  if (ix || iz) {
    clickTarget = null;
    pendingAct = null;
    marker.visible = false;
    // hướng đi theo góc camera
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    dx = ix * c + iz * s;
    dz = -ix * s + iz * c;
  } else if (clickTarget && !busy) {
    let wp = walkPath[0] || clickTarget;
    if (walkPath.length > 1 && Math.hypot(wp.x - me.x, wp.z - me.z) < 0.25) { walkPath.shift(); wp = walkPath[0]; } // tới điểm rẽ
    dx = wp.x - me.x;
    dz = wp.z - me.z;
    if (walkPath.length <= 1 && Math.hypot(clickTarget.x - me.x, clickTarget.z - me.z) < 0.15) { clickTarget = null; walkPath = []; marker.visible = false; dx = dz = 0; }
  }

  const len = Math.hypot(dx, dz);
  if (len > 0) {
    const speed = running ? RUN_SPEED : WALK_SPEED;
    const step = Math.min(speed * dt, clickTarget ? len : Infinity);
    const px = me.x, pz = me.z;
    let p = collideMap(me.x + (dx / len) * step, me.z + (dz / len) * step);
    if (clickTarget && Math.hypot(p.x - px, p.z - pz) < step * 0.3) {
      // vướng vật cản (lư hương, cột, cây…): thử lách chéo sang hai bên, ưu tiên hướng vẫn tiến lại gần đích
      const base = Math.atan2(dx, dz);
      let best = null;
      for (const off of [0.8, -0.8, 1.4, -1.4]) {
        const a = base + off;
        const q = collideMap(me.x + Math.sin(a) * step, me.z + Math.cos(a) * step);
        const moved = Math.hypot(q.x - px, q.z - pz);
        const closer = Math.hypot(clickTarget.x - q.x, clickTarget.z - q.z);
        if (moved > step * 0.5 && (!best || closer < best.closer)) best = { q, closer };
      }
      if (best) { p = best.q; dx = p.x - px; dz = p.z - pz; }
    }
    me.x = p.x; me.z = p.z;
    if (clickTarget && Math.hypot(me.x - px, me.z - pz) < step * 0.2) { clickTarget = null; marker.visible = false; } // kẹt hẳn
    me.ry = angleLerp(me.ry, Math.atan2(dx, dz), Math.min(1, dt * 12));
    me.m = running ? 2 : 1;
  } else me.m = 0;

  // tới nơi thì tự thắp hương / đánh chuông
  if (pendingAct && !clickTarget && actState(pendingAct).state === 'ready') tryAct(pendingAct);
  else if (pendingAct && !clickTarget) pendingAct = null;
  checkPortal();

  me.monk.root.position.set(me.x, 0, me.z);
  me.monk.root.rotation.y = angleLerp(me.monk.root.rotation.y, me.ry, Math.min(1, dt * 14));
  me.monk.animate(dt, me.m);
  me.petObj?.update(dt, me.monk.root, me.m);

  // gửi vị trí 10 lần/giây, chỉ khi có thay đổi
  sendTimer += dt;
  if (net && sendTimer >= 0.1 && !portalPending) {
    sendTimer = 0;
    const msg = { t: 'move', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), m: me.m };
    const key = `${msg.x},${msg.z},${msg.ry},${msg.m}`;
    if (key !== lastSent) { net.send(msg); lastSent = key; }
  }
}

function updateOthers(dt) {
  const k = 1 - Math.exp(-dt * 10); // nội suy mượt về vị trí server gửi
  for (const o of others.values()) {
    const r = o.monk.root;
    r.position.x += (o.x - r.position.x) * k;
    r.position.z += (o.z - r.position.z) * k;
    r.rotation.y = angleLerp(r.rotation.y, o.ry, k);
    const catchingUp = Math.hypot(o.x - r.position.x, o.z - r.position.z) > 0.05;
    o.monk.animate(dt, o.m || (catchingUp ? 1 : 0));
    o.petObj?.update(dt, r, o.m);
  }
}

const camTarget = new THREE.Vector3(me.x, 1, me.z);
// cận cảnh nhân vật khi đang ở màn hình vào chùa hoặc mở ngăn Trang phục (camera đứng trước mặt)
const isCloseUp = () => !ui.gate.classList.contains('hidden') || lookOpen;
let closeSaved = null;
function updateCamera(dt) {
  const cu = isCloseUp();
  if (cu && !closeSaved) { closeSaved = { yaw: cam.yaw }; cam.yaw = me.ry; }
  if (!cu && closeSaved) { cam.yaw = closeSaved.yaw; closeSaved = null; }
  if (cu) {
    const narrow = innerWidth <= 760;
    // đẩy tâm nhìn sang phải (máy tính) / xuống dưới (điện thoại) để nhân vật không bị bảng chọn che
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    const tgt = new THREE.Vector3(me.x, narrow ? 0.05 : 0.7, me.z).addScaledVector(right, narrow ? 0 : 0.95);
    camTarget.lerp(tgt, 1 - Math.exp(-dt * 6));
    const dist = narrow ? 4.4 : 3.6, pitch = 0.14;
    const h = Math.cos(pitch) * dist;
    camera.position.set(camTarget.x + Math.sin(cam.yaw) * h, camTarget.y + Math.sin(pitch) * dist + (narrow ? 0.6 : 0), camTarget.z + Math.cos(cam.yaw) * h);
    camera.lookAt(camTarget);
    return;
  }
  camTarget.lerp(new THREE.Vector3(me.x, MAP_VIEW[curMap].lookY, me.z), 1 - Math.exp(-dt * 8));
  const h = Math.cos(cam.pitch) * cam.dist;
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * h,
    camTarget.y + Math.sin(cam.pitch) * cam.dist,
    camTarget.z + Math.cos(cam.yaw) * h,
  );
  camera.lookAt(camTarget);
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  updateMe(dt);
  updateOthers(dt);
  updateCamera(dt);
  if (curMap === 'san') {
    temple.update(dt, t, camera, me);
    landscape.update(dt, t, camera, me);
    leaves.update(dt, t);
  } else interior.update(dt, t);
  updateStatues(camera);
  marker.material.opacity = 0.5 + Math.sin(t * 6) * 0.3;
  buttonTimer += dt;
  if (buttonTimer > 0.25) { buttonTimer = 0; updateActButtons(); updateSweepButton(); renderPetCard(); }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
setMap('san');
updateMeritHud();
updateAccountHud();
loop();

// tiện debug trong console
window.__game = { audio, me, others, scene, camera, temple, interior, landscape, leaves, bead, get map() { return curMap; } };
