// Lưu hồ sơ người chơi (công đức, tài khoản…) dạng JSON.
//
// Hai nơi lưu:
//  - Mặc định: file JSON trong thư mục data/ (chạy trên máy mình hoặc VPS có ổ đĩa lâu dài).
//  - Có biến môi trường UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN: lưu lên Upstash Redis (gói miễn phí).
//    Dùng cho các host miễn phí như Render Free, nơi ổ đĩa bị xóa mỗi lần khởi động lại / ngủ.
// Đủ dùng cho vài nghìn người. Khi lớn hơn, thay bằng SQLite/Postgres với cùng các hàm get/save.

import fs from 'node:fs';
import path from 'node:path';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const REMOTE = !!(REDIS_URL && REDIS_TOKEN);

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Upstash HTTP ${r.status}`);
  return j.result;
}

export class Store {
  /** @param {string} file đường dẫn file JSON (tên file cũng là khóa trên Redis) */
  constructor(file) {
    this.file = file;
    this.key = 'dichua:' + path.basename(file, '.json');
    this.dirty = false;
    this.saving = null;
    this.data = {};
    // ready: chờ đọc xong dữ liệu rồi mới mở server
    this.ready = REMOTE ? this._loadRemote() : Promise.resolve(this._loadFile());
    this.timer = setInterval(() => this.save(), REMOTE ? 30_000 : 10_000); // lưu từ xa thưa hơn cho đỡ tốn lượt gọi
  }

  _loadFile() {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('Không đọc được dữ liệu, bắt đầu trống:', e.message);
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }

  async _loadRemote() {
    for (let i = 0; i < 5; i++) {
      try {
        const s = await redis(['GET', this.key]);
        this.data = s ? JSON.parse(s) : {};
        console.log(`Đã tải ${Object.keys(this.data).length} bản ghi "${this.key}" từ Upstash`);
        return;
      } catch (e) {
        console.error('Chưa tải được dữ liệu từ Upstash, thử lại:', e.message);
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
    // không tải được: dừng hẳn còn hơn chạy với dữ liệu trống rồi ghi đè mất dữ liệu thật
    throw new Error('Không tải được dữ liệu từ Upstash');
  }

  /** Lấy (hoặc tạo) hồ sơ theo mã khách. */
  get(cid) {
    let r = this.data[cid];
    if (!r) {
      r = { name: '', merit: 0, day: '', today: 0, cd: {}, created: Date.now() };
      this.data[cid] = r;
      this.dirty = true;
    }
    return r;
  }

  /** Đọc không tạo mới */
  peek(key) { return this.data[key]; }

  /** Ghi một bản ghi bất kỳ */
  put(key, value) { this.data[key] = value; this.dirty = true; }

  touch() { this.dirty = true; }

  /** Lưu nếu có thay đổi. Trả về Promise (lưu từ xa) để lúc tắt server có thể chờ. */
  save() {
    if (!this.dirty || this.saving) return this.saving || Promise.resolve();
    this.dirty = false;
    const json = JSON.stringify(this.data);
    if (REMOTE) {
      this.saving = redis(['SET', this.key, json])
        .catch((e) => { console.error('Lỗi lưu lên Upstash:', e.message); this.dirty = true; })
        .finally(() => { this.saving = null; });
      return this.saving;
    }
    const tmp = this.file + '.tmp';
    try {
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, this.file); // ghi nguyên tử: không bao giờ để file hỏng giữa chừng
    } catch (e) {
      console.error('Lỗi lưu dữ liệu:', e.message);
      this.dirty = true;
    }
    return Promise.resolve();
  }

  async close() {
    clearInterval(this.timer);
    await this.saving;
    await this.save();
  }
}
