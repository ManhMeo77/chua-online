// Tài khoản: tên đăng nhập + mật khẩu, băm bằng scrypt (có sẵn trong Node, không cần thư viện).
// Mỗi tài khoản trỏ tới một hồ sơ công đức (cid). Đăng nhập trên máy khác = dùng lại hồ sơ đó.

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

export const USER_RE = /^[a-z0-9_.]{3,20}$/;
export const PASS_MIN = 6;

/** Chuẩn hóa tên đăng nhập: chữ thường, bỏ khoảng trắng 2 đầu */
export const normUser = (s) => String(s || '').trim().toLowerCase();

export function checkCredentials(user, pass) {
  if (!USER_RE.test(user)) return 'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới.';
  if (typeof pass !== 'string' || pass.length < PASS_MIN) return `Mật khẩu cần ít nhất ${PASS_MIN} ký tự.`;
  if (pass.length > 100) return 'Mật khẩu quá dài.';
  return null;
}

export async function hashPassword(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(pass, salt, 32)).toString('hex');
  return { salt, hash };
}

export async function verifyPassword(pass, { salt, hash }) {
  const got = await scrypt(pass, salt, 32);
  const want = Buffer.from(hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/**
 * Chống dò mật khẩu: tối đa `max` lần sai trong `windowMs` cho mỗi khóa
 * (khóa theo tên đăng nhập và theo địa chỉ IP).
 */
export class Limiter {
  constructor(max = 8, windowMs = 10 * 60_000) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }
  blocked(key) {
    const h = this.hits.get(key);
    if (!h) return false;
    if (Date.now() - h.first > this.windowMs) { this.hits.delete(key); return false; }
    return h.n >= this.max;
  }
  fail(key) {
    const h = this.hits.get(key);
    if (!h || Date.now() - h.first > this.windowMs) this.hits.set(key, { n: 1, first: Date.now() });
    else h.n++;
  }
  clear(key) { this.hits.delete(key); }
}
