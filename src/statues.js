import * as THREE from 'three';

// Tượng dạng "bảng ảnh": ảnh tượng thật (vẽ bằng ChatGPT, đã tách nền thành trong suốt) dán lên một mặt phẳng
// luôn xoay về phía camera quanh trục đứng. Trông giống thật hơn nhiều so với tượng ghép khối,
// mà vẫn nhẹ như một tấm ảnh. Chưa tải được ảnh thì hiện tạm tượng ghép khối (fallback).

const loader = new THREE.TextureLoader();
const cache = new Map(); // url → Promise<Texture>
const all = new Set(); // các tượng cần xoay theo camera

function load(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((ok, fail) => loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      ok(t);
    }, undefined, fail)));
  }
  return cache.get(url);
}

/**
 * @param {object} o
 * @param {string} o.url        ảnh PNG có nền trong suốt
 * @param {number} o.height     chiều cao tượng (m), chiều ngang tính theo tỉ lệ ảnh
 * @param {THREE.Object3D} [o.fallback]  tượng ghép khối hiện khi chưa có ảnh
 * @param {number} [o.glow]     độ tự sáng (ảnh đã có sẵn ánh sáng, nên không để đèn cảnh làm tối quá)
 * @param {number} [o.tint]     nhân màu (dịu bớt khi đặt ngoài trời nắng)
 * @param {boolean} [o.billboard] xoay theo camera (mặc định có)
 * @param {number} [o.maxTurn]  góc xoay tối đa khỏi hướng chính (rad), để tượng trên bệ thờ không quay hẳn ngang
 */
export function statueCard({ url, height, fallback = null, glow = 0.45, tint = 1, billboard = true, maxTurn = Math.PI }) {
  const group = new THREE.Group();
  if (fallback) group.add(fallback);
  const pivot = new THREE.Group(); // xoay quanh trục đứng
  group.add(pivot);
  const s = { group, pivot, billboard, maxTurn, baseYaw: null };

  load(url).then((tex) => {
    const aspect = tex.image.width / tex.image.height;
    const geo = new THREE.PlaneGeometry(height * aspect, height);
    geo.translate(0, height / 2, 0); // gốc ở chân tượng
    const color = new THREE.Color(tint, tint, tint);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0,
      color, emissive: new THREE.Color(1, 1, 1).multiplyScalar(tint), emissiveMap: tex, emissiveIntensity: glow,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.castShadow = true; // bóng đổ theo đúng hình tượng nhờ alphaTest
    pivot.add(plane);
    if (fallback) fallback.visible = false;
    if (billboard) all.add(s);
  }).catch(() => {}); // không có ảnh: giữ tượng ghép khối

  return group;
}

const wp = new THREE.Vector3();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
/** Gọi mỗi khung hình: tượng xoay mặt về camera (chỉ những tượng đang hiện) */
export function updateStatues(camera) {
  for (const s of all) {
    if (!isVisible(s.group)) continue;
    s.group.getWorldPosition(wp);
    if (s.baseYaw === null) { s.group.getWorldQuaternion(q); s.baseYaw = e.setFromQuaternion(q, 'YXZ').y; }
    let yaw = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z) - s.baseYaw;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    s.pivot.rotation.y = Math.max(-s.maxTurn, Math.min(s.maxTurn, yaw));
  }
}

function isVisible(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
