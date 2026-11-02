// Âm thanh bằng Web Audio: tiếng chuông dùng file ghi âm thật (public/sounds/chuong.mp3),
// các âm khác tổng hợp bằng code. Thiếu file thì chuông tự chuyển sang tiếng tổng hợp.
// Trình duyệt chỉ cho phát âm thanh sau khi người dùng bấm, nên gọi unlock() trong sự kiện click.

let ctx = null;
let master = null;
let reverb = null;
let muted = false;
let fxVol = 0.8; // âm lượng hiệu ứng (chuông, mõ, chổi…) 0..1
try { const v = parseFloat(localStorage.getItem('dichua.fxVol')); if (v >= 0 && v <= 1) fxVol = v; } catch {}
let bellBuf = null; // tiếng chuông chùa ghi âm thật, tải khi mở âm thanh lần đầu
const BELL_URL = '/sounds/chuong.mp3';
try { muted = localStorage.getItem('dichua.muted') === '1'; } catch {}

function impulse(seconds = 3.5) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : fxVol;
    master.connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse();
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);
    fetch(BELL_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((data) => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
      .then((buf) => { bellBuf = buf; })
      .catch(() => {}); // không có file: dùng tiếng tổng hợp
  }
  if (ctx.state === 'suspended') ctx.resume();
  music.start(); // trình duyệt chỉ cho phát nhạc sau cú bấm đầu tiên
}

export const isMuted = () => muted;
/** Tắt / bật toàn bộ âm thanh (cả hiệu ứng lẫn nhạc nền) */
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('dichua.muted', v ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(v ? 0 : fxVol, ctx.currentTime, 0.05);
  music.sync();
}
export const getFxVolume = () => fxVol;
export function setFxVolume(v) {
  fxVol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('dichua.fxVol', String(fxVol)); } catch {}
  if (master && !muted) master.gain.setTargetAtTime(fxVol, ctx.currentTime, 0.05);
}

// ───────────────────────── Nhạc nền ─────────────────────────
// Phát bằng thẻ <audio> để tải dần (bản nhạc dài ~55 phút, không cần tải hết mới nghe), lặp lại khi hết.
// Khi có tiếng chuông, nhạc tự nhỏ đi vài giây cho nghe rõ chuông.
// bản nhạc ~55 phút chia 3 đoạn (~9 MB mỗi đoạn) để tải nhẹ hơn; phát nối tiếp rồi quay lại đoạn đầu
const MUSIC_URLS = ['/sounds/nhac-nen-1.mp3', '/sounds/nhac-nen-2.mp3', '/sounds/nhac-nen-3.mp3'];
export const music = (() => {
  let on = true, vol = 0.35, el = null, started = false, duck = 1, fadeIn = 0, raf = 0;
  try {
    on = localStorage.getItem('dichua.music') !== '0';
    const v = parseFloat(localStorage.getItem('dichua.musicVol'));
    if (v >= 0 && v <= 1) vol = v;
  } catch {}
  const target = () => (muted || !on ? 0 : vol * vol * duck * fadeIn); // bình phương cho thanh trượt nghe "đều tai" hơn
  function tick() {
    raf = 0;
    if (!el) return;
    fadeIn = Math.min(1, fadeIn + 0.02); // ~1 giây là to đủ
    const t = target();
    el.volume += (t - el.volume) * 0.15;
    if (Math.abs(t - el.volume) < 0.002) el.volume = t;
    if ((muted || !on) && el.volume === 0 && !el.paused) el.pause(); // tắt hẳn thì dừng tải / phát
    if (el.volume !== t || fadeIn < 1) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  function play() {
    if (!el) {
      let track = 0;
      el = new Audio(MUSIC_URLS[0]);
      el.addEventListener('ended', () => { // hết đoạn: sang đoạn kế (hết đoạn cuối thì quay về đầu)
        track = (track + 1) % MUSIC_URLS.length;
        el.src = MUSIC_URLS[track];
        el.play().catch(() => {});
      });
      el.preload = 'auto';
      el.volume = 0;
      el.addEventListener('error', () => { el = null; started = false; }); // không có file nhạc: im lặng
    }
    el.play().catch(() => {}); // bị chặn tự phát: lần bấm sau thử lại
    kick();
  }
  return {
    start() { if (started || !on || muted) return; started = true; fadeIn = 0; play(); },
    /** Đồng bộ sau khi đổi bật/tắt hoặc tắt tiếng */
    sync() {
      if (on && !muted) { if (!started) { started = true; fadeIn = 0; } play(); } else kick();
    },
    get on() { return on; },
    get playing() { return !!el && !el.paused; },
    get level() { return el ? el.volume : 0; }, // âm lượng thực tế đang phát (sau mờ dần / nhỏ đi khi có chuông)
    get volume() { return vol; },
    setOn(v) { on = !!v; try { localStorage.setItem('dichua.music', on ? '1' : '0'); } catch {} this.sync(); },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('dichua.musicVol', String(vol)); } catch {} kick(); },
    /** Nhạc nhỏ đi trong `ms` mili giây (khi chuông ngân) */
    duck(ms = 4500, level = 0.35) {
      duck = level; kick();
      clearTimeout(this._duckT);
      this._duckT = setTimeout(() => { duck = 1; kick(); }, ms);
    },
    /** Tab bị ẩn: tạm dừng cho đỡ tốn pin; quay lại thì phát tiếp */
    pauseHidden(hidden) { if (!el) return; if (hidden) el.pause(); else if (on && !muted && started) { el.play().catch(() => {}); kick(); } },
  };
})();
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => music.pauseHidden(document.hidden));

function out(volume) {
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(master);
  g.connect(reverb);
  return g;
}

/** Tiếng chuông chùa. volume 0..1 (theo khoảng cách người nghe). Đứng xa thì nghe trầm và vang hơn. */
export function bell(volume = 1) {
  if (!ctx || volume <= 0.01) return;
  if (volume > 0.3) music.duck(5000, 0.3);
  if (bellBuf) {
    const src = ctx.createBufferSource();
    src.buffer = bellBuf;
    const lp = ctx.createBiquadFilter(); // xa thì mất bớt tiếng cao
    lp.type = 'lowpass';
    lp.frequency.value = 1800 + volume * 14000;
    const dry = ctx.createGain();
    dry.gain.value = 0.95 * volume;
    const send = ctx.createGain(); // vang sân chùa: nhiều hơn khi đứng xa
    send.gain.value = 0.25 + (1 - volume) * 0.35;
    src.connect(lp);
    lp.connect(dry).connect(master);
    lp.connect(send).connect(reverb);
    src.start();
    return;
  }
  const t = ctx.currentTime;
  const dest = out(volume * 0.5);
  const f = 98; // Sol trầm
  const partials = [
    [0.5, 0.55, 9], [1, 1, 8], [1.183, 0.45, 6], [1.506, 0.35, 5], [2, 0.32, 4.5],
    [2.514, 0.22, 3.5], [2.662, 0.18, 3], [3.011, 0.14, 2.5], [4.166, 0.09, 1.8], [5.433, 0.05, 1.2],
  ];
  for (const [ratio, amp, decay] of partials) {
    for (const detune of [0, 0.6]) { // hai dao động lệch nhẹ tạo tiếng "ngân" (beating)
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * ratio + detune;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 0.5, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }
  // tiếng gỗ chạm vào chuông
  const n = ctx.createBufferSource();
  const nb = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  n.buffer = nb;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.value = 0.6;
  n.connect(lp).connect(ng).connect(dest);
  n.start(t);
}

/** Tiếng chuông gió nhỏ khi thắp hương xong */
export function chime(volume = 1) {
  if (!ctx || volume <= 0.01) return;
  const t = ctx.currentTime;
  const dest = out(volume * 0.18);
  [1318.5, 1975.5, 2637].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const s = t + i * 0.09;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.4, s + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 1.6);
    o.connect(g).connect(dest);
    o.start(s);
    o.stop(s + 1.7);
  });
}

/** Âm lượng theo khoảng cách người nghe – nguồn âm */
export const falloff = (dist, near = 4, far = 40) => Math.max(0, Math.min(1, 1 - (dist - near) / (far - near)));

/** Tiếng mõ gỗ: "cốc" ngắn, trầm ấm (gõ mỗi hạt tràng hạt) */
export function mo(volume = 1) {
  if (!ctx || volume <= 0.01) return;
  const t = ctx.currentTime;
  const dest = out(volume * 0.5);
  for (const [f, a, d] of [[540, 0.9, 0.16], [1210, 0.25, 0.07], [300, 0.35, 0.12]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.06, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

/** Tiếng chổi tre quét "soạt" (tiếng ồn lọc dải) */
export function swish(volume = 1) {
  if (!ctx || volume <= 0.01) return;
  const t = ctx.currentTime;
  const len = 0.28;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) { const k = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.sin(k * Math.PI) ** 2; }
  const n = ctx.createBufferSource();
  n.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2600, t);
  bp.frequency.linearRampToValueAtTime(1500, t + len);
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = volume * 0.22;
  n.connect(bp).connect(g).connect(master);
  n.start(t);
}
