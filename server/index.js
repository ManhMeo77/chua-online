// Server game: HTTP (phục vụ bản build trong dist/) + WebSocket tại /ws.
// Mỗi "phòng" (?phong=...) là một sân chùa riêng, tối đa MAX_PER_ROOM người.
//
// Giao thức (JSON, trường `t` là loại tin):
//   client → server
//     hello { cid, name, phong }      xin vào chùa
//     move  { x, z, ry, m }           vị trí mới (m = 0 đứng, 1 đi, 2 chạy)
//     chat  { text }
//     act   { a: 'incense' | 'bell' } thắp hương / đánh chuông
//     checkin {}                      điểm danh hôm nay
//     board   {}                      xin bảng xếp hạng
//     pet     { kind | null }         dắt linh thú đã mở khóa (null = cất đi)
//     pat     { id? }                 vuốt ve linh thú (không có id = của mình, có id = của người đó)
//     feed    {}                      cho linh thú của mình ăn
//     trick   { trick }               bảo linh thú làm trò đã học (theo bậc thân thiết)
//     portal  {}                      đang đứng ở cổng → chuyển map (sân chùa ↔ Chánh Điện)
//     broom   { on }                  lấy chổi ở giá chổi (on=true) / cất chổi (on=false); cầm chổi đi qua lá là quét
//     bead    { reset? }              lần một hạt tràng hạt (reset = bắt đầu chuỗi mới)
//     pose    { pose: 'beads' | null } đang cầm tràng hạt (để người khác thấy)
//     look    { look }                đổi ngoại hình: { g, style, color, pants, acc[] } (xem src/shared/looks.js)
//     register { user, pass }         tạo tài khoản cho hồ sơ hiện tại
//     login    { user, pass }         đăng nhập: chuyển sang hồ sơ của tài khoản
//   server → client
//     welcome { id, room, players:[P] }   P = { id, name, color, x, z, ry, m, lv }
//     me      { merit, lv, today, cap, cd: { incense, bell }, user, ck: { done, streak } }   hồ sơ riêng
//     auth    { user, cid }                    đăng ký/đăng nhập thành công (client lưu cid mới)
//     rename  { id, name, lv }                 người chơi đổi tên/cấp sau khi đăng nhập
//     quests  { list:[{ id, n, goal, done }], bonus }   nhiệm vụ hôm nay của bạn
//     pet     { id, pet }                      ai đó đổi linh thú (P cũng có trường pet)
//     unlock  { pets:[kind] }                  bạn vừa mở khóa linh thú mới
//     petact  { id, a: 'pat'|'feed', by }      linh thú của người `id` vừa được vuốt ve / cho ăn (bởi `by`)
//     petmood { id, mood }                     tâm trạng linh thú của người `id` đổi
//     mapchange { map, x, z, ry, players:[P] }   bạn vừa sang map khác (chỉ thấy người cùng map)
//     petbond { id, tier }                     linh thú của người `id` lên bậc thân thiết (đổi trang sức)
//     petnote { text }                         lời nhắn riêng cho chủ (ví dụ có người vuốt ve hộ)
//     board   { all:[R], today:[R], me:{ all, today } }   R = { name, merit, lv }; me = hạng của bạn
//     join    { p: P }
//     leave   { id }
//     states  { s: [[id, x, z, ry, m], ...] }   gửi TICK_HZ lần/giây, chỉ người đã thay đổi
//     act     { a, id }                        ai đó vừa thắp hương / đánh chuông (để cả phòng thấy, nghe)
//     gain    { a, merit, streak? }            bạn vừa nhận công đức
//     level   { id, lv }                       ai đó lên cấp tu
//     chat    { id, name, text }
//     notice  { text }                         thông báo chạy chữ cho cả phòng
//     count   { n }
//     leaves  { l: [[id, x, z], ...] }         toàn bộ lá trên sân (khi vào sân)
//     leaf    { l: [[id, x, z], ...] }         lá mới rụng
//     swept   { ids, by }                      lá vừa bị quét (by = người quét)
//     broom   { id, on }                       ai đó cầm / cất chổi
//     pose    { id, pose }                     ai đó cầm / cất tràng hạt
//     look    { id, look }                     ai đó đổi ngoại hình (P cũng có trường look)
//     beads   { n, rounds, cur }               số hạt hôm nay, số chuỗi tròn hôm nay, hạt hiện tại (0..107)
//     error   { msg }

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { resolveCollision, randomSpawn, distTo, RUN_SPEED, INTERACT, MAP_NAMES, portalAt, arrivalPoint } from '../src/shared/world.js';
import { ACTIONS, DAILY_CAP, LEVELS, levelOf, checkinBonus } from '../src/shared/merit.js';
import { Store, REMOTE } from './store.js';
import { QUESTS, QUEST_BONUS, SPOTS, pickQuests } from '../src/shared/quests.js';
import { PETS, isUnlocked, unlockedBetween } from '../src/shared/pets.js';
import { CARE, FOODS, MOODS, fullnessAt, joyAt, fedAtFor, joyAtFor, moodOf, vnHour, newPetState,
  BONDS, bondOf, TRICKS, TRICK_COOLDOWN, BOND_REWARDS, BLESSING_MERIT } from '../src/shared/petcare.js';
import { LEAF_MAX, LEAF_START, LEAF_SPAWN_MS, SWEEP_RADIUS, SWEEP_PER_MERIT, randomLeafSpot,
  BEADS_PER_ROUND, BEAD_MIN_MS, ROUND_MERIT } from '../src/shared/chores.js';
import { cleanLook, robeColor, COLORS as LOOK_COLORS, DEFAULT_LOOK } from '../src/shared/looks.js';
import { normUser, checkCredentials, hashPassword, verifyPassword, Limiter } from './accounts.js';

const PORT = Number(process.env.PORT) || 8787;
const TICK_HZ = 10;
const MAX_PER_ROOM = 300;
const CHAT_COOLDOWN_MS = 1200;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const store = new Store(path.join(DATA_DIR, 'players.json'));
const accounts = new Store(path.join(DATA_DIR, 'accounts.json')); // user → { salt, hash, cid, created }
const loginLimiter = new Limiter();

const BANNED_WORDS = ['dm', 'dcm', 'vcl', 'vkl', 'clm', 'địt', 'đụ', 'lồn', 'cặc']; // ví dụ, mở rộng sau

// Ngày theo giờ Việt Nam, dùng cho giới hạn công đức mỗi ngày
const dayOf = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const today = () => dayOf(Date.now());
const yesterday = () => dayOf(Date.now() - 86_400_000);

/** Sang ngày mới thì đặt lại bộ đếm trong ngày */
function rollDay(rec) {
  if (rec.day !== today()) { rec.day = today(); rec.today = 0; rec.dayTotal = 0; }
}

// ───────────────────────── HTTP: phục vụ file tĩnh khi chạy production ─────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: [...rooms.values()].map((r) => [r.name, r.players.size]) }));
  }
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Server game đang chạy. Khi dev hãy mở http://localhost:5173 (Vite). Chạy "npm run build" để server tự phục vụ giao diện.');
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  const stat = fs.statSync(file);
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    // file trong assets/ có mã băm trong tên → lưu mãi; ảnh/nhạc lưu 1 ngày; index.html luôn hỏi lại
    'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    'accept-ranges': 'bytes',
    'last-modified': stat.mtime.toUTCString(),
  };
  if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(stat.mtime.toUTCString())) {
    res.writeHead(304, headers);
    return res.end();
  }
  // tải từng đoạn (Range): thẻ <audio> cần để tua / phát dần, Safari bắt buộc phải có
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : stat.size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : stat.size - 1;
    start = Math.max(0, start); end = Math.min(end, stat.size - 1);
    if (start > end) { res.writeHead(416, { 'content-range': `bytes */${stat.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'content-length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});

// ───────────────────────── Phòng & người chơi ─────────────────────────
/** @type {Map<string, {name:string, players:Map<number, any>, lastBell:number}>} */
const rooms = new Map();
let nextId = 1;

function getRoom(name) {
  let r = rooms.get(name);
  if (!r) {
    r = { name, players: new Map(), lastBell: 0, leaves: new Map(), leafSeq: 1 };
    for (let i = 0; i < LEAF_START; i++) addLeaf(r);
    rooms.set(name, r);
  }
  return r;
}

/** Chọn phòng: phòng được yêu cầu nếu còn chỗ, không thì chua-2, chua-3… */
function pickRoom(wanted) {
  const base = /^[a-z0-9-]{1,24}$/.test(wanted || '') ? wanted : 'chua-1';
  let name = base;
  for (let i = 2; getRoom(name).players.size >= MAX_PER_ROOM; i++) name = `chua-${i}`;
  return getRoom(name);
}

const r2 = (n) => Math.round(n * 100) / 100;
/** Ngoại hình đang dùng (hồ sơ cũ chưa chọn thì mặc áo chú tiểu màu ngẫu nhiên của lần vào này) */
const lookOf = (p) => p.rec.look || { ...DEFAULT_LOOK, color: p.color };
const publicP = (p) => ({ id: p.id, name: p.name, color: robeColor(lookOf(p)), look: lookOf(p), x: r2(p.x), z: r2(p.z), ry: r2(p.ry), m: p.m, lv: levelOf(p.rec.merit), pet: p.rec.pet || null, petMood: petMood(p.rec), petTier: petTier(p.rec), broom: !!p.broom, pose: p.pose || null });

// ───────────────────────── Quét lá ─────────────────────────
function addLeaf(room) {
  if (room.leaves.size >= LEAF_MAX) return null;
  const id = room.leafSeq++;
  const p = randomLeafSpot();
  room.leaves.set(id, p);
  return [id, p.x, p.z];
}
const leavesMsg = (room) => ({ t: 'leaves', l: [...room.leaves].map(([id, p]) => [id, p.x, p.z]) });

/** Lấy / cất chổi */
function handleBroom(me, room, on) {
  on = !!on;
  if (on === !!me.broom) return;
  if (on) {
    if (me.map !== 'san') return send(me.ws, { t: 'error', msg: 'Giá chổi ở ngoài sân chùa.' });
    if (distTo('broom', me.x, me.z) > INTERACT.broom.range + 0.6) return send(me.ws, { t: 'error', msg: 'Hãy tới giá chổi cạnh nhà khách để lấy chổi.' });
  }
  me.broom = on;
  broadcastMap(room, me.map, { t: 'broom', id: me.id, on });
}

/** Cầm chổi đi tới đâu thì quét lá ở đó */
function sweepAt(me, room) {
  if (!me.broom || me.map !== 'san') return;
  const ids = [];
  for (const [id, p] of room.leaves) if (Math.hypot(p.x - me.x, p.z - me.z) <= SWEEP_RADIUS) ids.push(id);
  if (!ids.length) return;
  for (const id of ids) room.leaves.delete(id);
  broadcastMap(room, 'san', { t: 'swept', ids, by: me.id });
  const rec = me.rec;
  if (rec.sweep?.day !== today()) rec.sweep = { day: today(), n: 0 };
  const before = Math.floor(rec.sweep.n / SWEEP_PER_MERIT);
  rec.sweep.n += ids.length;
  store.touch();
  const earned = Math.floor(rec.sweep.n / SWEEP_PER_MERIT) - before;
  if (earned > 0) {
    const g = addMerit(me, room, earned, true);
    send(me.ws, { t: 'gain', a: 'sweep', merit: g });
  }
  send(me.ws, meMsg(rec));
  questEvent(me, room, 'sweep', ids.length);
  if (room.leaves.size === 0) broadcast(room, { t: 'notice', text: `Sân chùa đã sạch lá. Tùy hỷ công quả của thí chủ ${me.name} 🍂` });
}

// ───────────────────────── Tràng hạt ─────────────────────────
function beadSt(rec) {
  if (rec.beads?.day !== today()) rec.beads = { day: today(), n: 0, rounds: 0, cur: rec.beads?.cur || 0 }; // hạt đang lần dở vẫn giữ qua ngày
  return rec.beads;
}
const beadsMsg = (rec) => { const b = beadSt(rec); return { t: 'beads', n: b.n, rounds: b.rounds, cur: b.cur }; };

function handleBead(me, room, reset) {
  const rec = me.rec;
  const b = beadSt(rec);
  if (reset) { b.cur = 0; store.touch(); return send(me.ws, beadsMsg(rec)); }
  const now = Date.now();
  if (now - (me.lastBead || 0) < BEAD_MIN_MS) return; // bấm quá nhanh: bỏ qua
  me.lastBead = now;
  b.n++;
  b.cur++;
  if (b.cur >= BEADS_PER_ROUND) {
    b.cur = 0;
    b.rounds++;
    const g = addMerit(me, room, ROUND_MERIT, true);
    send(me.ws, { t: 'gain', a: 'beadround', merit: g, rounds: b.rounds });
    send(me.ws, meMsg(rec));
  }
  store.touch();
  send(me.ws, beadsMsg(rec));
  questEvent(me, room, 'bead');
}

/** Đổi ngoại hình: kiểm tra hợp lệ + khóa theo cấp tu, lưu vào hồ sơ, báo cả map */
function handleLook(me, room, look) {
  const now = Date.now();
  if (now - (me.lastLook || 0) < 800) return;
  me.lastLook = now;
  me.rec.look = cleanLook(look, levelOf(me.rec.merit));
  store.touch();
  broadcastMap(room, me.map, { t: 'look', id: me.id, look: me.rec.look });
}

function handlePose(me, room, pose) {
  pose = pose === 'beads' ? 'beads' : null;
  if (pose === (me.pose || null)) return;
  me.pose = pose;
  broadcastMap(room, me.map, { t: 'pose', id: me.id, pose });
}
function petTier(rec) { return rec.pet ? bondOf(petSt(rec, rec.pet).bond) : 0; }

/** Kiểm tra lên bậc thân thiết sau mỗi lần tăng độ thân thiết; mỗi bậc chỉ thưởng một lần */
function checkBond(owner, room, kind) {
  const st = petSt(owner.rec, kind);
  const tier = bondOf(st.bond);
  st.tierGot ??= 0;
  while (st.tierGot < tier) {
    st.tierGot++;
    const rw = BOND_REWARDS[st.tierGot];
    const gain = addMerit(owner, room, rw.gift, false);
    send(owner.ws, { t: 'gain', a: 'bond', merit: gain, tier: st.tierGot, pet: kind, text: rw.text });
    broadcast(room, { t: 'notice', text: `${PETS[kind].name} của thí chủ ${owner.name} đã thành ${BONDS[st.tierGot].name}` });
    broadcast(room, { t: 'petbond', id: owner.id, tier: st.tierGot });
  }
}

// ───────────────────────── Chăm linh thú ─────────────────────────
/** Trạng thái chăm sóc của một linh thú (mỗi con một bộ riêng, giữ khi đổi con) */
function petSt(rec, kind) {
  rec.pets ??= {};
  rec.pets[kind] ??= newPetState();
  return rec.pets[kind];
}
function petMood(rec) {
  if (!rec.pet) return null;
  const st = petSt(rec, rec.pet);
  return moodOf(fullnessAt(st), joyAt(st), vnHour());
}
function petCareMsg(rec) {
  if (!rec.pet) return null;
  const st = petSt(rec, rec.pet), now = Date.now();
  return {
    full: Math.round(fullnessAt(st)), joy: Math.round(joyAt(st)), bond: st.bond, mood: petMood(rec),
    patCd: Math.max(0, st.patCd + CARE.pat.cooldown - now), feedCd: Math.max(0, st.feedCd + CARE.feed.cooldown - now),
    tier: bondOf(st.bond), trickCd: Math.max(0, (st.trickCd || 0) + TRICK_COOLDOWN - now),
  };
}
/** Báo cả phòng nếu tâm trạng linh thú của người này vừa đổi */
function syncMood(p, room) {
  const m = petMood(p.rec);
  if (m !== p.lastMood) { p.lastMood = m; broadcast(room, { t: 'petmood', id: p.id, mood: m }); }
}
const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

/** Chỉ gửi cho người đang ở cùng map (vị trí, người vào/ra…) */
function broadcastMap(room, map, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.map === map && p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
}
const playersIn = (room, map) => [...room.players.values()].filter((p) => p.map === map);

/** Chuyển map khi đứng ở cổng (cửa Chánh Điện). Server tự kiểm tra vị trí. */
function handlePortal(me, room) {
  const now = Date.now();
  if (now - (me.lastPortal || 0) < 1200) return;
  const p = portalAt(me.map, me.x, me.z, 0.6);
  if (!p) return send(me.ws, { t: 'error', msg: 'Hãy đi tới cửa để vào.' });
  me.lastPortal = now;
  const from = me.map, to = p.to;
  me.broom = false; // chổi để lại ngoài sân
  broadcastMap(room, from, { t: 'leave', id: me.id }, me.id);
  const a = arrivalPoint(to, from);
  me.map = to;
  me.x = a.x; me.z = a.z; me.ry = a.ry; me.m = 0;
  me.lastMove = now;
  send(me.ws, { t: 'mapchange', map: to, x: r2(a.x), z: r2(a.z), ry: r2(a.ry), players: playersIn(room, to).map(publicP) });
  if (to === 'san') send(me.ws, leavesMsg(room));
  broadcastMap(room, to, { t: 'join', p: publicP(me), from }, me.id);
  if (to === 'cd') questEvent(me, room, 'enter_cd');
}

function broadcast(room, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
}

function cleanName(s) {
  s = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return s || 'Khách viếng';
}

function cleanChat(s) {
  s = String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
  for (const w of BANNED_WORDS) s = s.replace(new RegExp(`(^|\\s)${w}(?=\\s|$)`, 'giu'), '$1***');
  return s;
}

/** Hồ sơ riêng gửi cho chính người chơi */
function meMsg(rec) {
  const now = Date.now();
  const cd = {};
  for (const a of Object.keys(ACTIONS)) cd[a] = Math.max(0, (rec.cd[a] || 0) + ACTIONS[a].cooldown - now);
  const ck = rec.ck || {};
  return {
    t: 'me', merit: rec.merit, lv: levelOf(rec.merit), today: rec.day === today() ? rec.today : 0, cap: DAILY_CAP, cd,
    user: rec.user || null,
    pet: rec.pet || null,
    // độ thân thiết của mọi linh thú đã từng dắt (cho bảng Linh thú)
    petBonds: Object.fromEntries(Object.entries(rec.pets || {}).map(([k, v]) => [k, v.bond])),
    petCare: petCareMsg(rec),
    sweep: rec.sweep?.day === today() ? rec.sweep.n : 0, // số lá đã quét hôm nay
    look: rec.look || null,
    ck: { done: ck.last === today(), streak: ck.last === today() || ck.last === yesterday() ? ck.streak || 0 : 0 },
  };
}

/** Cộng công đức, báo lên cấp nếu có. capped = tính vào giới hạn ngày */
function addMerit(me, room, amount, capped) {
  const rec = me.rec;
  rollDay(rec);
  const gain = capped ? Math.max(0, Math.min(amount, DAILY_CAP - rec.today)) : amount;
  const before = levelOf(rec.merit);
  rec.merit += gain;
  if (capped) rec.today += gain;
  rec.dayTotal = (rec.dayTotal || 0) + gain;
  store.touch();
  boardCache = null;
  const after = levelOf(rec.merit);
  if (after > before) {
    broadcast(room, { t: 'level', id: me.id, lv: after });
    broadcast(room, { t: 'notice', text: `Tùy hỷ thí chủ ${me.name} vừa lên cấp tu ${LEVELS[after].name}` });
    const fresh = unlockedBetween(before, after);
    if (fresh.length) {
      send(me.ws, { t: 'unlock', pets: fresh });
      if (!rec.pet) { rec.pet = fresh[0]; broadcast(room, { t: 'pet', id: me.id, pet: rec.pet, mood: petMood(rec), tier: petTier(rec) }); } // linh thú đầu tiên tự đi theo
    }
  }
  return gain;
}

// ───────────────────────── Nhiệm vụ ngày ─────────────────────────
function ensureQuests(me) {
  const rec = me.rec;
  if (rec.q?.day === today()) return rec.q;
  rec.q = { day: today(), list: pickQuests(me.cid || 'khach', today(), !!rec.pet).map((id) => ({ id, n: 0 })), bonus: false };
  store.touch();
  return rec.q;
}

function questsMsg(me) {
  const q = ensureQuests(me);
  return {
    t: 'quests',
    list: q.list.map(({ id, n }) => ({ id, n: Math.floor(Math.min(n, QUESTS[id].goal)), goal: QUESTS[id].goal, done: n >= QUESTS[id].goal })),
    bonus: q.bonus,
  };
}

/** Ghi nhận một sự kiện cho nhiệm vụ (thắp hương, đi bộ…). Xong nhiệm vụ thì thưởng ngay. */
function questEvent(me, room, ev, amount = 1) {
  const q = ensureQuests(me);
  let changed = false, rewarded = false;
  for (const item of q.list) {
    const def = QUESTS[item.id];
    if (def.ev !== ev || item.n >= def.goal) continue;
    const before = Math.floor(item.n / 10);
    item.n = Math.min(def.goal, item.n + amount);
    // đi bộ: chỉ báo client mỗi 10 m để đỡ tốn băng thông
    if (ev !== 'walk' || Math.floor(item.n / 10) !== before || item.n >= def.goal) changed = true;
    if (item.n >= def.goal) {
      const g = addMerit(me, room, def.reward, false);
      send(me.ws, { t: 'gain', a: 'quest', merit: g, title: def.title });
      rewarded = true;
    }
  }
  if (!q.bonus && q.list.every((it) => it.n >= QUESTS[it.id].goal)) {
    q.bonus = true;
    const g = addMerit(me, room, QUEST_BONUS, false);
    send(me.ws, { t: 'gain', a: 'questbonus', merit: g });
    rewarded = changed = true;
  }
  if (changed || rewarded) store.touch();
  if (changed) send(me.ws, questsMsg(me));
  if (rewarded) send(me.ws, meMsg(me.rec));
}

/** Kiểm tra đi bộ + tham quan sau mỗi lần di chuyển */
function questMove(me, room, moved) {
  if (moved > 0 && me.m > 0) {
    me.walkAcc = (me.walkAcc || 0) + moved;
    if (me.walkAcc >= 1) { const w = Math.floor(me.walkAcc); me.walkAcc -= w; questEvent(me, room, 'walk', w); }
  }
  if (me.map !== 'san') return; // các điểm tham quan đều ở sân chùa
  for (const [ev, spots] of Object.entries(SPOTS)) {
    if (spots.some((s) => Math.hypot(me.x - s.x, me.z - s.z) <= s.r)) {
      const q = ensureQuests(me);
      if (q.list.some((it) => QUESTS[it.id].ev === ev && it.n < QUESTS[it.id].goal)) questEvent(me, room, ev, 1);
    }
  }
}

/** Dắt / cất linh thú */
function handlePet(me, room, kind) {
  const now = Date.now();
  if (now - (me.lastPet || 0) < 500) return;
  me.lastPet = now;
  if (kind !== null && !PETS[kind]) return;
  if (kind && !isUnlocked(kind, levelOf(me.rec.merit))) {
    return send(me.ws, { t: 'error', msg: `${PETS[kind].name} mở khóa khi đạt cấp ${LEVELS[PETS[kind].lv].name}.` });
  }
  me.rec.pet = kind;
  store.touch();
  me.lastMood = petMood(me.rec);
  broadcast(room, { t: 'pet', id: me.id, pet: kind, mood: me.lastMood, tier: petTier(me.rec) });
  send(me.ws, meMsg(me.rec));
}

/** Vuốt ve: linh thú của mình (tăng vui + thân thiết) hoặc của người đứng gần (chỉ tăng vui) */
function handlePat(me, room, targetId) {
  const now = Date.now();
  const owner = targetId && targetId !== me.id ? room.players.get(targetId) : me;
  if (!owner) return;
  if (!owner.rec.pet) return send(me.ws, { t: 'error', msg: owner === me ? 'Bạn chưa dắt linh thú nào.' : 'Người này không dắt linh thú.' });
  const kind = owner.rec.pet, name = PETS[kind].name, st = petSt(owner.rec, kind);

  if (owner === me) {
    const wait = st.patCd + CARE.pat.cooldown - now;
    if (wait > 0) return send(me.ws, { t: 'error', msg: `${name} vừa được vuốt ve, chờ ${Math.ceil(wait / 1000)} giây nhé.` });
    st.patCd = now;
    st.joyAt = joyAtFor(joyAt(st, now) + CARE.pat.joy, now);
    st.bond += CARE.pat.bond;
  } else {
    if (Math.hypot(owner.x - me.x, owner.z - me.z) > 3.5) return send(me.ws, { t: 'error', msg: `Lại gần ${name} hơn một chút.` });
    me.patOther ??= {};
    const wait = (me.patOther[owner.id] || 0) + CARE.patOther.cooldown - now;
    if (wait > 0) return send(me.ws, { t: 'error', msg: `Chờ ${Math.ceil(wait / 1000)} giây rồi vuốt ve tiếp nhé.` });
    me.patOther[owner.id] = now;
    st.joyAt = joyAtFor(joyAt(st, now) + CARE.patOther.joy, now);
    send(owner.ws, { t: 'petnote', text: `${me.name} vừa vuốt ve ${name} của bạn` });
  }
  store.touch();
  broadcast(room, { t: 'petact', id: owner.id, a: 'pat', by: me.id });
  send(owner.ws, meMsg(owner.rec));
  syncMood(owner, room);
  if (owner === me) { checkBond(me, room, kind); questEvent(me, room, 'pat'); }
}

/** Làm trò: chỉ trò đã học ở bậc thân thiết hiện tại */
function handleTrick(me, room, trick) {
  const rec = me.rec;
  if (!rec.pet) return send(me.ws, { t: 'error', msg: 'Bạn chưa dắt linh thú nào.' });
  const def = TRICKS[trick];
  if (!def) return;
  const kind = rec.pet, st = petSt(rec, kind), now = Date.now();
  if (bondOf(st.bond) < def.tier) return send(me.ws, { t: 'error', msg: `${PETS[kind].name} học trò ${def.name} khi thành ${BONDS[def.tier].name}.` });
  const wait = (st.trickCd || 0) + TRICK_COOLDOWN - now;
  if (wait > 0) return send(me.ws, { t: 'error', msg: `${PETS[kind].name} đang nghỉ, chờ ${Math.ceil(wait / 1000)} giây nhé.` });
  st.trickCd = now;
  store.touch();
  broadcast(room, { t: 'petact', id: me.id, a: 'trick', trick, by: me.id });
  send(me.ws, meMsg(rec));
}

/** Cho ăn: chỉ linh thú của mình, khi chưa no hẳn */
function handleFeed(me, room) {
  const now = Date.now();
  const rec = me.rec;
  if (!rec.pet) return send(me.ws, { t: 'error', msg: 'Bạn chưa dắt linh thú nào.' });
  const kind = rec.pet, name = PETS[kind].name, st = petSt(rec, kind);
  const full = fullnessAt(st, now);
  if (full >= CARE.feed.fullLimit) return send(me.ws, { t: 'error', msg: `${name} còn no, để lát nữa nhé.` });
  const wait = st.feedCd + CARE.feed.cooldown - now;
  if (wait > 0) return send(me.ws, { t: 'error', msg: `${name} vừa ăn xong, chờ ${Math.ceil(wait / 1000)} giây nhé.` });
  st.feedCd = now;
  st.fedAt = fedAtFor(full + CARE.feed.full, now);
  st.bond += CARE.feed.bond;
  broadcast(room, { t: 'petact', id: me.id, a: 'feed', by: me.id });
  const gain = addMerit(me, room, CARE.feed.merit, true);
  send(me.ws, { t: 'gain', a: 'feed', merit: gain, food: FOODS[kind] });
  send(me.ws, meMsg(rec));
  syncMood(me, room);
  checkBond(me, room, kind);
  questEvent(me, room, 'feed');
}

/** Xử lý thắp hương / đánh chuông. Mọi kiểm tra đều ở đây, client không tự cộng điểm. */
function handleAction(me, room, a) {
  const rule = ACTIONS[a];
  if (!rule) return;
  const rec = me.rec;
  const now = Date.now();

  if (INTERACT[a].map !== me.map) return send(me.ws, { t: 'error', msg: a === 'le' ? 'Hãy vào Chánh Điện để lễ Phật.' : 'Việc này làm ở sân chùa.' });
  if (distTo(a, me.x, me.z) > INTERACT[a].range + 0.6) return send(me.ws, { t: 'error', msg: 'Bạn cần lại gần hơn một chút.' });
  const wait = (rec.cd[a] || 0) + rule.cooldown - now;
  if (wait > 0) return send(me.ws, { t: 'error', msg: `Chờ thêm ${Math.ceil(wait / 1000)} giây nhé.` });
  if (rule.roomCooldown && now - room.lastBell < rule.roomCooldown) {
    return send(me.ws, { t: 'error', msg: 'Tiếng chuông còn đang ngân, chờ chút rồi đánh tiếp.' });
  }

  rec.cd[a] = now;
  if (rule.roomCooldown) room.lastBell = now;

  broadcast(room, { t: 'act', a, id: me.id });
  // giới hạn công đức theo ngày: vẫn được làm, chỉ không cộng thêm khi đã đủ
  const gain = addMerit(me, room, rule.merit, true);
  send(me.ws, { t: 'gain', a, merit: gain });
  // phúc lành: linh thú Tri kỷ đi cùng khi thắp hương
  if (a === 'incense' && rec.pet && BOND_REWARDS[petTier(rec)]?.blessing) {
    const g = addMerit(me, room, BLESSING_MERIT, false);
    send(me.ws, { t: 'gain', a: 'blessing', merit: g, pet: rec.pet });
  }
  send(me.ws, meMsg(rec));
  questEvent(me, room, a);
}

/** Điểm danh: mỗi ngày (giờ Việt Nam) một lần, ngày liên tiếp được thưởng thêm */
function handleCheckin(me, room) {
  if (!me.cid) return send(me.ws, { t: 'error', msg: 'Trình duyệt này chưa lưu được hồ sơ nên chưa điểm danh được.' });
  const rec = me.rec;
  const ck = rec.ck || { last: '', streak: 0 };
  if (ck.last === today()) return send(me.ws, { t: 'error', msg: 'Hôm nay bạn đã điểm danh rồi.' });
  ck.streak = ck.last === yesterday() ? ck.streak + 1 : 1;
  ck.last = today();
  rec.ck = ck;
  const gain = addMerit(me, room, checkinBonus(ck.streak), false);
  send(me.ws, { t: 'gain', a: 'checkin', merit: gain, streak: ck.streak });
  send(me.ws, meMsg(rec));
  questEvent(me, room, 'checkin');
}

// ───────────────────────── Bảng xếp hạng ─────────────────────────
let boardCache = null; // tính lại tối đa mỗi 5 giây hoặc khi có người được cộng điểm
function getBoard() {
  if (boardCache && Date.now() - boardCache.at < 5000) return boardCache;
  const d = today();
  const rows = Object.values(store.data).filter((r) => r.merit > 0 && r.name);
  const all = [...rows].sort((a, b) => b.merit - a.merit);
  const day = rows.filter((r) => r.day === d && r.dayTotal > 0).sort((a, b) => b.dayTotal - a.dayTotal);
  boardCache = { at: Date.now(), all, day };
  return boardCache;
}
function boardMsg(rec) {
  const b = getBoard();
  const row = (r, v) => ({ name: r.name, merit: v, lv: levelOf(r.merit) });
  const rank = (list) => { const i = list.indexOf(rec); return i < 0 ? null : i + 1; };
  return {
    t: 'board',
    all: b.all.slice(0, 10).map((r) => row(r, r.merit)),
    today: b.day.slice(0, 10).map((r) => row(r, r.dayTotal)),
    me: { all: rank(b.all), today: rank(b.day) },
  };
}

// ───────────────────────── Tài khoản ─────────────────────────
/** Chuyển kết nối sang hồ sơ khác (sau khi đăng nhập) và báo cả phòng */
function switchProfile(me, room, cid) {
  me.cid = cid;
  me.rec = store.get(cid);
  if (me.rec.name) me.name = me.rec.name;
  me.lastMood = petMood(me.rec);
  broadcast(room, { t: 'rename', id: me.id, name: me.name, lv: levelOf(me.rec.merit), pet: me.rec.pet || null, petMood: me.lastMood, petTier: petTier(me.rec) });
  broadcastMap(room, me.map, { t: 'look', id: me.id, look: lookOf(me) }); // hồ sơ tài khoản có thể có ngoại hình khác
}

async function handleRegister(me, room, msg) {
  const user = normUser(msg.user);
  const err = checkCredentials(user, msg.pass);
  if (err) return send(me.ws, { t: 'error', msg: err });
  if (!me.cid) return send(me.ws, { t: 'error', msg: 'Trình duyệt này chưa lưu được hồ sơ, hãy tải lại trang.' });
  if (me.rec.user) return send(me.ws, { t: 'error', msg: `Hồ sơ này đã gắn với tài khoản ${me.rec.user}.` });
  if (accounts.peek(user)) return send(me.ws, { t: 'error', msg: 'Tên đăng nhập này đã có người dùng.' });
  const h = await hashPassword(msg.pass);
  if (accounts.peek(user)) return send(me.ws, { t: 'error', msg: 'Tên đăng nhập này đã có người dùng.' }); // đăng ký trùng cùng lúc
  accounts.put(user, { ...h, cid: me.cid, created: Date.now() });
  me.rec.user = user;
  store.touch();
  send(me.ws, { t: 'auth', user, cid: me.cid, created: true });
  send(me.ws, meMsg(me.rec));
}

async function handleLogin(me, room, msg) {
  const user = normUser(msg.user);
  const ipKey = 'ip:' + me.ip, userKey = 'u:' + user;
  if (loginLimiter.blocked(ipKey) || loginLimiter.blocked(userKey)) {
    return send(me.ws, { t: 'error', msg: 'Sai quá nhiều lần. Thử lại sau 10 phút nhé.' });
  }
  const acc = accounts.peek(user);
  const ok = acc && typeof msg.pass === 'string' && (await verifyPassword(msg.pass, acc));
  if (!ok) {
    loginLimiter.fail(ipKey);
    loginLimiter.fail(userKey);
    return send(me.ws, { t: 'error', msg: 'Sai tên đăng nhập hoặc mật khẩu.' });
  }
  loginLimiter.clear(userKey);
  if (me.cid !== acc.cid) switchProfile(me, room, acc.cid);
  send(me.ws, { t: 'auth', user, cid: acc.cid });
  send(me.ws, meMsg(me.rec));
  send(me.ws, questsMsg(me));
}

// ───────────────────────── WebSocket ─────────────────────────
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 });

wss.on('connection', (ws, req) => {
  // sau Cloudflare/Nginx thì IP thật nằm ở header
  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  let me = null; // người chơi của kết nối này, có sau khi hello
  let room = null;

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'hello' && !me) {
      room = pickRoom(msg.phong);
      const spawn = randomSpawn();
      // cid hợp lệ thì có hồ sơ lưu lâu dài; không thì là khách tạm
      const cid = typeof msg.cid === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(msg.cid) ? msg.cid : null;
      const rec = cid ? store.get(cid) : { name: '', merit: 0, day: '', today: 0, cd: {} };
      me = {
        id: nextId++, ws, cid, rec, ip,
        name: cleanName(msg.name),
        color: LOOK_COLORS[Math.floor(Math.random() * 4)].hex, // màu áo tạm cho người chưa chọn ngoại hình
        x: spawn.x, z: spawn.z, ry: Math.PI, m: 0, map: 'san',
        dirty: false, lastMove: Date.now(), lastChat: 0,
      };
      if (rec.name !== me.name) { rec.name = me.name; store.touch(); }
      // ngoại hình chọn ở màn hình vào chùa (client chỉ gửi khi người chơi đã chọn)
      if (msg.look) { rec.look = cleanLook(msg.look, levelOf(rec.merit)); store.touch(); }
      me.lastMood = petMood(rec);
      room.players.set(me.id, me);
      send(ws, { t: 'welcome', id: me.id, room: room.name, map: 'san', players: playersIn(room, 'san').map(publicP) });
      send(ws, meMsg(rec));
      send(ws, questsMsg(me));
      send(ws, leavesMsg(room));
      send(ws, beadsMsg(rec));
      broadcastMap(room, 'san', { t: 'join', p: publicP(me) }, me.id);
      broadcast(room, { t: 'count', n: room.players.size });
      return;
    }
    if (!me) return;

    if (msg.t === 'move') {
      const now = Date.now();
      const dt = Math.min(1, (now - me.lastMove) / 1000);
      me.lastMove = now;
      let x = Number(msg.x), z = Number(msg.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      // chống "dịch chuyển tức thời": giới hạn quãng đường theo tốc độ chạy (+ dung sai mạng)
      const dx = x - me.x, dz = z - me.z;
      const maxD = RUN_SPEED * dt * 1.5 + 0.5;
      const d = Math.hypot(dx, dz);
      if (d > maxD) { x = me.x + (dx / d) * maxD; z = me.z + (dz / d) * maxD; }
      const p = resolveCollision(x, z, undefined, me.map);
      const moved = Math.hypot(p.x - me.x, p.z - me.z);
      me.x = p.x; me.z = p.z;
      me.ry = Number.isFinite(+msg.ry) ? +msg.ry : me.ry;
      me.m = [0, 1, 2].includes(msg.m) ? msg.m : 0;
      me.dirty = true;
      questMove(me, room, moved);
      sweepAt(me, room);
      return;
    }

    if (msg.t === 'act') return handleAction(me, room, msg.a);
    if (msg.t === 'checkin') return handleCheckin(me, room);
    if (msg.t === 'pet') return handlePet(me, room, msg.kind ?? null);
    if (msg.t === 'pat') return handlePat(me, room, Number(msg.id) || null);
    if (msg.t === 'feed') return handleFeed(me, room);
    if (msg.t === 'trick') return handleTrick(me, room, String(msg.trick || ''));
    if (msg.t === 'portal') return handlePortal(me, room);
    if (msg.t === 'broom') return handleBroom(me, room, msg.on);
    if (msg.t === 'bead') return handleBead(me, room, !!msg.reset);
    if (msg.t === 'pose') return handlePose(me, room, msg.pose);
    if (msg.t === 'look') return handleLook(me, room, msg.look);
    if (msg.t === 'board') {
      const now = Date.now();
      if (now - (me.lastBoard || 0) < 1000) return;
      me.lastBoard = now;
      return send(ws, boardMsg(me.rec));
    }
    if (msg.t === 'register' || msg.t === 'login') {
      if (me.authBusy) return;
      me.authBusy = true;
      const fn = msg.t === 'register' ? handleRegister : handleLogin;
      fn(me, room, msg).catch((e) => { console.error(e); send(ws, { t: 'error', msg: 'Có lỗi, thử lại sau.' }); })
        .finally(() => (me.authBusy = false));
      return;
    }

    if (msg.t === 'chat') {
      const now = Date.now();
      if (now - me.lastChat < CHAT_COOLDOWN_MS) return send(ws, { t: 'error', msg: 'Nói chậm lại một chút nhé 🙏' });
      const text = cleanChat(msg.text);
      if (!text) return;
      me.lastChat = now;
      broadcast(room, { t: 'chat', id: me.id, name: me.name, text });
      questEvent(me, room, 'chat');
    }
  });

  ws.on('close', () => {
    if (!me) return;
    room.players.delete(me.id);
    broadcast(room, { t: 'leave', id: me.id });
    broadcast(room, { t: 'count', n: room.players.size });
    if (room.players.size === 0 && room.name !== 'chua-1') rooms.delete(room.name);
  });
});

// Vòng tick: gom các vị trí đã thay đổi rồi gửi một gói cho cả phòng.
// Khi phòng đông (vài trăm người) nên thêm "interest management": chỉ gửi người ở gần.
setInterval(() => {
  for (const room of rooms.values()) {
    const byMap = {};
    for (const p of room.players.values()) {
      if (!p.dirty) continue;
      p.dirty = false;
      (byMap[p.map] ??= []).push([p.id, r2(p.x), r2(p.z), r2(p.ry), p.m]);
    }
    for (const [map, s] of Object.entries(byMap)) broadcastMap(room, map, { t: 'states', s });
  }
}, 1000 / TICK_HZ);

// Lá rụng dần: mỗi phòng thêm một chiếc lá sau mỗi LEAF_SPAWN_MS (tới khi đủ LEAF_MAX)
setInterval(() => {
  for (const room of rooms.values()) {
    const l = addLeaf(room);
    if (l && room.players.size) broadcastMap(room, 'san', { t: 'leaf', l: [l] });
  }
}, LEAF_SPAWN_MS);

// Tâm trạng linh thú đổi theo thời gian (đói dần, buồn dần, tới giờ ngủ): kiểm tra mỗi 30 giây
setInterval(() => {
  for (const room of rooms.values()) for (const p of room.players.values()) {
    const before = p.lastMood;
    syncMood(p, room);
    if (p.lastMood !== before) send(p.ws, meMsg(p.rec));
  }
}, 30_000);

// Ping định kỳ để dọn kết nối chết
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

// Lưu dữ liệu khi tắt server (Ctrl+C, hoặc host gửi SIGTERM khi khởi động lại / cho server ngủ)
let closing = false;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  if (closing) return;
  closing = true;
  try { await Promise.all([store.close(), accounts.close()]); } catch (e) { console.error(e); }
  process.exit(0);
});

// đọc xong dữ liệu (file hoặc Upstash) rồi mới nhận người chơi
await Promise.all([store.ready, accounts.ready]);
server.listen(PORT, () => console.log(`🛕 Server chùa chạy tại http://localhost:${PORT}  (WebSocket: /ws) · lưu dữ liệu: ${REMOTE ? 'Upstash Redis' : DATA_DIR}`));
