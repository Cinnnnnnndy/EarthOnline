/** 地标积木（名胜与类型模型共用）：圆角盒、圆柱、圆锥、球、三棱柱、小屋、旗、山峰、水面、蒸汽、材质缓存。
 *  尺寸以地理底板单位计（放进底板时整体再缩 0.62）：一座塔高 3～5，占地（footprint）1～2.5；比例夸张、边角圆润、每个模型不超过 5 种颜色。 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { vivid } from "./style.ts";

export interface Landmark { group: THREE.Group; top: number; update?: (t: number) => void; footprint: number }
export type RGB = [number, number, number];
export const C = (c: RGB | number) => (typeof c === "number" ? new THREE.Color(c) : new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace));
export const matCache = new Map<string, THREE.Material>();
export function mat(c: RGB | number, rough = 0.7, extra: THREE.MeshStandardMaterialParameters = {}): THREE.Material {
  const k = JSON.stringify([c, rough, extra]); let m = matCache.get(k);
  if (!m) {
    // D89：底色统一提一档饱和（style.ts 的 VIVID）；设计稿上的原色记在 userData.base（sRGB 0–255，测试数「设计的颜色」用它）
    m = new THREE.MeshStandardMaterial({ color: vivid(C(c)), roughness: rough, ...extra }); const b = C(c).convertLinearToSRGB(); m.userData.base = [b.r * 255, b.g * 255, b.b * 255]; matCache.set(k, m);
  }
  return m;
}
export function add(g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
}
/** 圆角盒：默认圆角 0.09（D83：参考图那种圆润；第八轮前是 0.06），不超过最短边的三分之一 */
export const box = (w: number, h: number, d: number, r = 0.09) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3));
export const cyl = (r1: number, r2: number, h: number, n = 18) => new THREE.CylinderGeometry(r1, r2, h, n);
export const cone = (r: number, h: number, n = 4) => new THREE.ConeGeometry(r, h, n);
export const ball = (r: number) => new THREE.SphereGeometry(r, 20, 14);
/** 三角山花（横放的三棱柱，正面朝 +z） */
export const prism = (w: number, h: number, d: number) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); g.translate(0, 0, -d / 2); return g; };

export function house(g: THREE.Group, x: number, z: number, wall: RGB, roof: RGB, w = 0.7, h = 0.55, d = 0.6, ry = 0, snow = false) {
  add(g, box(w, h, d, 0.05), mat(wall), x, h / 2, z, ry);
  const r = add(g, cone(Math.max(w, d) * 0.78, 0.45, 4), mat(roof, 0.6), x, h + 0.22, z, ry + Math.PI / 4); r.scale.set(1, 1, d / w + 0.2);
  if (snow) { const s = add(g, cone(Math.max(w, d) * 0.62, 0.2, 4), mat(0xffffff, 0.8), x, h + 0.36, z, ry + Math.PI / 4); s.scale.set(1, 1, d / w + 0.2); }
  add(g, box(0.14, 0.14, 0.02, 0.01), mat([255, 214, 140], 0.4, { emissive: C([255, 190, 110]), emissiveIntensity: 0.6 }), x, h * 0.55, z + d / 2 + 0.005, ry);
}
export function flag(g: THREE.Group, x: number, z: number, h: number, colors: RGB[]) {
  add(g, cyl(0.025, 0.025, h, 8), mat([230, 230, 235]), x, h / 2, z);
  const f = new THREE.Group(); f.position.set(x + 0.02, h - 0.18, z); g.add(f);
  colors.forEach((c, i) => add(f, box(0.42, 0.28 / colors.length, 0.015, 0.005), mat(c, 0.6), 0.22, 0.14 - (0.28 / colors.length) * (i + 0.5), 0));
  return f;
}
export function peak(g: THREE.Group, x: number, z: number, r: number, h: number, snow = true, rock: RGB = [120, 124, 132]) {
  add(g, new THREE.ConeGeometry(r, h, 7), mat(rock, 0.9), x, h / 2, z);
  if (snow) add(g, new THREE.ConeGeometry(r * 0.42, h * 0.42, 7), mat(0xffffff, 0.7), x, h - h * 0.21 + 0.01, z);
}
export function water(g: THREE.Group, r: number, x = 0, z = 0, y = 0.03, col: RGB = [70, 196, 214], sx = 1, sz = 1) {
  const w = add(g, cyl(r, r, 0.06, 32), mat(col, 0.1, { metalness: 0.05, transparent: true, opacity: 0.9 }), x, y, z); w.scale.set(sx, 1, sz); w.castShadow = false; return w;
}
export function steam(g: THREE.Group, x: number, z: number, y0: number, n = 5, s = 0.28): THREE.Group {
  const st = new THREE.Group(); st.position.set(x, y0, z); g.add(st);
  const m = mat(0xffffff, 1, { transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < n; i++) { const b = add(st, ball(s * (1 + i * 0.25)), m, Math.sin(i) * 0.08, i * s * 1.2, Math.cos(i * 2) * 0.08); b.castShadow = false; }
  return st;
}
export const pick = <X,>(r: { next(): number }, a: X[]): X => a[Math.floor(r.next() * a.length)];
export const NORDIC: RGB[] = [[196, 62, 52], [240, 196, 80], [70, 120, 176], [245, 243, 236], [96, 150, 110], [226, 132, 64]];
export function waterTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d")!; x.fillStyle = "#dff4ff"; x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? "rgba(255,255,255,.9)" : "rgba(150,210,240,.7)"; x.fillRect((i * 13) % 64, (i * 29) % 128, 3 + (i % 3), 18 + (i % 5) * 6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export type Maker = (seed: number) => Landmark;
