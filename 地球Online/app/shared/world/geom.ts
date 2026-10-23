/** 程序化几何工具：旋转面（可加褶皱）、锥形管、切开的球、团状树冠 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function lathe(profile: [number, number][], segs = 48, fold?: { k: number; amp: number[] }, depthScale = 1): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = []; const n = profile.length;
  for (let i = 0; i < n; i++) {
    const [r, y] = profile[i]; const a = fold ? fold.amp[i] ?? 0 : 0;
    for (let j = 0; j < segs; j++) {
      const th = (2 * Math.PI * j) / segs; const rr = r + (fold ? a * Math.cos(fold.k * th) : 0);
      pos.push(rr * Math.cos(th), y, rr * Math.sin(th) * depthScale);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * segs + j, b = i * segs + ((j + 1) % segs), c = (i + 1) * segs + ((j + 1) % segs), d = (i + 1) * segs + j;
    idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function taperedTube(points: THREE.Vector3[], radii: number[], segs = 14, radial = 10): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const frames = curve.computeFrenetFrames(segs, false); const pos: number[] = [], idx: number[] = [];
  const nR = radii.length;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const p = curve.getPointAt(t);
    const rf = t * (nR - 1), r0 = Math.floor(rf), r1 = Math.min(nR - 1, r0 + 1); const r = radii[r0] + (radii[r1] - radii[r0]) * (rf - r0);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j < radial; j++) { const a = (2 * Math.PI * j) / radial; pos.push(p.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z)); }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + ((j + 1) % radial), d = (i + 1) * radial + j;
    idx.push(a, b, c, a, c, d);
  }
  // 两端封口
  for (const [ring, flip] of [[0, true], [segs, false]] as const) {
    const cIdx = pos.length / 3; const p = curve.getPointAt(ring / segs); pos.push(p.x, p.y, p.z);
    for (let j = 0; j < radial; j++) { const a = ring * radial + j, b = ring * radial + ((j + 1) % radial); if (flip) idx.push(cIdx, b, a); else idx.push(cIdx, a, b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** 球面上删掉不要的三角形（用于发帽露出脸） */
export function cutSphere(r: number, keep: (c: THREE.Vector3) => boolean, w = 48, h = 32): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, w, h).toNonIndexed(); const p = g.getAttribute("position"); const out: number[] = []; const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    c.set((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3);
    if (keep(c)) for (let k = 0; k < 3; k++) out.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
  }
  const o = new THREE.BufferGeometry(); o.setAttribute("position", new THREE.Float32BufferAttribute(out, 3)); o.computeVertexNormals(); return o;
}

function hash3(x: number, y: number, z: number, s: number) { let h = Math.imul((x * 374761393 + y * 668265263 + z * 2147483647 + s * 1013904223) | 0, 1274126177); h = (h ^ (h >>> 13)) >>> 0; return (h % 1000) / 1000; }
/** 团状树冠：细分二十面体按噪声推挤，共享一份几何，每棵树靠旋转出差异 */
export function lumpySphere(r: number, seed: number, amp = 0.28, detail = 3): THREE.BufferGeometry {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail)); const p = g.getAttribute("position"); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)); const n = hash3(Math.round(v.x * 3), Math.round(v.y * 3), Math.round(v.z * 3), seed) - 0.5;
    v.multiplyScalar(1 + n * amp * 2); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

export function capsuleBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
}
