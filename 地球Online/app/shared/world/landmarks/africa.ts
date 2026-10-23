/** 名胜模型：非洲。积木见 ../landmark-kit.ts；每个模型返回 { group, top, footprint, update? }。
 *  约定：原点在地面中心，+y 向上，正面朝 +z；抓住外形特征并夸张 1.2～1.4 倍，细节从简；每个模型不超过 5 种颜色；
 *  同色的小零件合并成一个网格，每个模型不超过 100 个网格。
 *  本文件前半是几样共用的件（大洋洲 oceania.ts 也用）：摆放、合并、倒角盒、两点之间的杆与胶囊、纯数据贴图（条纹、菱形格、流水），
 *  以及非洲草原上的金合欢、象、长颈鹿、角马、狮子。贴图都是 DataTexture，Node 里也能建。 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mulberry32 } from "../../algo/prng.ts";
import { type Maker, type RGB, type Landmark, mat, add, cyl, water } from "../landmark-kit.ts";
import { MORE_AFRICA } from "./africa-more.ts";

export type G = THREE.BufferGeometry;
export type P2 = [number, number];
export const PI = Math.PI;
export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------- 几何小工具（大洋洲也用）
const _o = new THREE.Object3D(); _o.rotation.order = "YXZ";
/** 把几何体摆到位（先绕 z、再绕 x、最后绕 y 转），给合并用 */
export function at<T extends G>(q: T, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s: number | [number, number, number] = 1): T {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz, "YXZ"); if (Array.isArray(s)) _o.scale.set(s[0], s[1], s[2]); else _o.scale.setScalar(s);
  _o.updateMatrix(); q.applyMatrix4(_o.matrix); return q;
}
/** 一组零件整体摆放（先缩放、再绕 y 转、最后平移） */
export function place(list: G[], x: number, y: number, z: number, ry = 0, s = 1): G[] { for (const q of list) at(q, x, y, z, ry, 0, 0, s); return list; }
export const cube = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** 倒角盒：seg=1 顶点少（成批合并的小件用），大件用 2 */
export const rbox = (w: number, h: number, d: number, r = 0.04, seg = 1) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 3, h / 3, d / 3));
export const bead = (r: number, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
/** 半球（山包、穹顶、珊瑚头） */
export const dome = (r = 1, seg = 20, hs = 8) => new THREE.SphereGeometry(r, seg, hs, 0, PI * 2, 0, PI / 2);
export const lathe = (pts: P2[], seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/** 两点之间的一根杆：round 时是圆杆，否则是方杆 */
export function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, t = w, round = false): G {
  const len = a.distanceTo(b); const q: G = round ? cyl(w / 2, w / 2, len, 8).rotateX(PI / 2) : cube(w, t, len);
  _o.position.copy(a).add(b).multiplyScalar(0.5); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.lookAt(b); _o.updateMatrix(); return q.applyMatrix4(_o.matrix);
}
/** 两点之间的胶囊（象鼻、长颈鹿脖子、珊瑚枝、云垂下来的边） */
export function capsule(a: THREE.Vector3, b: THREE.Vector3, r: number, rad = 8): G {
  const len = a.distanceTo(b); const q: G = new THREE.CapsuleGeometry(r, len, 3, rad).rotateX(PI / 2);
  _o.position.copy(a).add(b).multiplyScalar(0.5); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.lookAt(b); _o.updateMatrix(); return q.applyMatrix4(_o.matrix);
}
export function merged(list: G[]): G { const out = mergeGeometries(list.map((q) => (q.index ? q.toNonIndexed() : q)), false); if (!out) throw new Error("mergeGeometries failed"); return out; }
/** 一组同色零件合成一个网格 */
export function bake(g: THREE.Object3D, list: G[], m: THREE.Material): THREE.Mesh | null {
  if (!list.length) return null; const o = new THREE.Mesh(merged(list), m); o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
}
/** 平面着色（石块、金字塔、山要棱角分明） */
export function flat(q: G): G { const n = q.index ? q.toNonIndexed() : q; n.computeVertexNormals(); return n; }
/** 平面图形（x, y）挤出厚度 dep（沿 z，居中） */
export function slab(s: THREE.Shape | P2[], dep: number, bevel = 0): G {
  const shape = Array.isArray(s) ? new THREE.Shape(s.map(([x, y]) => new THREE.Vector2(x, y))) : s;
  const q = new THREE.ExtrudeGeometry(shape, { depth: dep, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 }); q.translate(0, 0, -dep / 2); return q;
}
/** 圆形地面（沙地、草原、红土） */
export const ground = (g: THREE.Group, c: RGB, r = 2.45) => add(g, cyl(r, r + 0.04, 0.06, 40), mat(c, 0.95), 0, 0.03, 0);
const _b = new THREE.Box3();
/** 收尾：标签高度 = 最高点 + 0.2 */
export function done(g: THREE.Group, footprint: number, update?: (t: number) => void): Landmark { _b.setFromObject(g); return { group: g, top: +(_b.max.y + 0.2).toFixed(2), footprint, update }; }

// ---------- 纯数据贴图（DataTexture，Node 里也能建）：a 为底色，b 为花纹色；只用两种颜色
export type Pat = "hband" | "vband" | "vlow" | "diamond" | "grid" | "zigzag" | "dots";
const PAT: Record<Pat, (x: number, y: number) => boolean> = {
  hband: (_x, y) => y < 0.22,
  vband: (x) => x < 0.24,
  /** 只在下半截的竖条（球面的 v 从赤道 0 到顶 1）：乌鲁鲁四壁的竖沟 */
  vlow: (x, y) => x < 0.2 + 0.1 * Math.sin(y * 9) && y < 0.62,
  diamond: (x, y) => (x + y) % 1 < 0.14 || (x - y + 1) % 1 < 0.14,
  grid: (x, y) => x < 0.14 || y < 0.14,
  zigzag: (x, y) => (y + Math.abs(x - 0.5) * 0.9) % 0.5 < 0.2,
  dots: (x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.07,
};
const texCache = new Map<string, THREE.Material>();
export function texMat(kind: Pat, a: RGB, b: RGB, rx: number, ry: number, rough = 0.8, extra: THREE.MeshStandardMaterialParameters = {}): THREE.Material {
  const key = JSON.stringify([kind, a, b, rx, ry, rough, extra]); const hit = texCache.get(key); if (hit) return hit;
  const N = 32, d = new Uint8Array(N * N * 4), f = PAT[kind];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = f((i + 0.5) / N, (j + 0.5) / N) ? b : a; d.set([c[0], c[1], c[2], 255], (j * N + i) * 4); }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rx, ry); t.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, ...extra }); texCache.set(key, m); return m;
}
/** 流水贴图（瀑布）：底色 a 上一道道竖向的 b 色水纹；动画时改 offset.y。每次新建（各自滚动） */
export function flowMat(a: RGB, b: RGB, rx: number, ry: number): { m: THREE.MeshStandardMaterial; tex: THREE.DataTexture } {
  const W = 32, H = 64, d = new Uint8Array(W * H * 4), r = mulberry32(11);
  const ph = Array.from({ length: W }, () => r.int(H)), len = Array.from({ length: W }, () => 5 + r.int(9)), on = Array.from({ length: W }, () => r.next() < 0.6);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const s = on[i] && (j + ph[i]) % 24 < len[i]; const c = s ? b : a; d.set([c[0], c[1], c[2], 255], (j * W + i) * 4); }
  const tex = new THREE.DataTexture(d, W, H); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(rx, ry); tex.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, transparent: true, opacity: 0.95, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.12 });
  return { m, tex };
}

// ---------- 草原上的东西（乞力马扎罗、马赛马拉共用）
/** 金合欢：一根斜干分三叉，顶上压扁的伞形树冠（两层） */
export function acacia(T: G[], C: G[], x: number, z: number, h: number, cr: number, ry = 0) {
  const fork = V3(x + Math.cos(ry) * 0.05, h * 0.5, z - Math.sin(ry) * 0.05);
  T.push(beam(V3(x, 0, z), fork, 0.07 + h * 0.02, 0, true));
  for (let k = 0; k < 3; k++) { const a = ry + k * 2.1 + 0.4; T.push(beam(fork, V3(x + Math.cos(a) * cr * 0.5, h - 0.04, z + Math.sin(a) * cr * 0.45), 0.045, 0, true)); }
  C.push(at(bead(1, 16, 8), x, h, z, ry, 0, 0, [cr, cr * 0.22, cr * 0.82]));
  C.push(at(bead(1, 12, 6), x - cr * 0.22, h + cr * 0.12, z + cr * 0.08, ry, 0, 0, [cr * 0.62, cr * 0.16, cr * 0.5]));
}
/** 大象（朝 +x），身体与腿用 body 色，象牙用 tusk 色 */
export function elephant(B: G[], Tk: G[], x: number, z: number, ry: number, s: number) {
  const b: G[] = [
    at(bead(0.3, 14, 10), 0, 0.52, 0, 0, 0, 0, [1.25, 0.95, 0.85]),
    at(bead(0.19, 12, 8), 0.4, 0.62, 0),
    capsule(V3(0.53, 0.6, 0), V3(0.62, 0.36, 0), 0.065), capsule(V3(0.62, 0.36, 0), V3(0.6, 0.1, 0), 0.05),
    beam(V3(-0.36, 0.6, 0), V3(-0.42, 0.36, 0), 0.03),
  ];
  for (const sz of [-1, 1]) b.push(at(cyl(0.18, 0.18, 0.03, 14), 0.3, 0.62, sz * 0.17, sz * 0.35, PI / 2, 0, [1, 1, 1.2]));
  for (const [lx, lz] of [[0.2, 0.12], [0.2, -0.12], [-0.2, 0.12], [-0.2, -0.12]]) b.push(at(cyl(0.08, 0.085, 0.36, 10), lx, 0.18, lz));
  const t: G[] = [capsule(V3(0.5, 0.5, 0.07), V3(0.64, 0.42, 0.1), 0.025, 6), capsule(V3(0.5, 0.5, -0.07), V3(0.64, 0.42, -0.1), 0.025, 6)];
  B.push(...place(b, x, 0, z, ry, s)); Tk.push(...place(t, x, 0, z, ry, s));
}
/** 长颈鹿（朝 +x）：浅棕身体、深色斑点与角 */
export function giraffe(Tn: G[], Dk: G[], x: number, z: number, ry: number, s: number, lean = 0) {
  const nx = 0.36 + lean * 0.12, ny = 1.18 - lean * 0.08;
  const b: G[] = [at(rbox(0.4, 0.22, 0.17, 0.07), 0, 0.64, 0, 0, 0, 0.12), capsule(V3(0.15, 0.7, 0), V3(nx, ny, 0), 0.05), at(rbox(0.17, 0.07, 0.075, 0.03), nx + 0.06, ny + 0.02, 0, 0, 0, -0.35)];
  for (const [lx, lz, h] of [[0.14, 0.055, 0.6], [0.14, -0.055, 0.6], [-0.14, 0.055, 0.54], [-0.14, -0.055, 0.54]]) b.push(at(cube(0.05, h, 0.05), lx, h / 2, lz));
  const d: G[] = [at(cube(0.02, 0.07, 0.02), nx + 0.02, ny + 0.09, 0.022), at(cube(0.02, 0.07, 0.02), nx + 0.02, ny + 0.09, -0.022), beam(V3(-0.2, 0.66, 0), V3(-0.25, 0.42, 0), 0.02)];
  for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) d.push(at(bead(0.035, 6, 4), -0.13 + i * 0.09, 0.62 + (i % 2) * 0.05, sz * 0.085, 0, 0, 0, [1, 1, 0.35]));
  for (let i = 0; i < 3; i++) { const u = 0.25 + i * 0.25; for (const sz of [-1, 1]) d.push(at(bead(0.024, 6, 4), 0.15 + (nx - 0.15) * u, 0.7 + (ny - 0.7) * u, sz * 0.042, 0, 0, 0, [1, 1, 0.4])); }
  Tn.push(...place(b, x, 0, z, ry, s)); Dk.push(...place(d, x, 0, z, ry, s));
}
/** 角马（朝 +x），全身深色：迁徙的一群 */
export function wildebeest(D: G[], x: number, z: number, ry: number, s: number) {
  const b: G[] = [at(rbox(0.22, 0.1, 0.09, 0.03), 0, 0.2, 0, 0, 0, 0.12), at(bead(0.06, 8, 6), 0.07, 0.25, 0), at(rbox(0.09, 0.055, 0.05, 0.02), 0.15, 0.2, 0, 0, 0, -0.7)];
  for (const [lx, lz] of [[0.07, 0.03], [0.07, -0.03], [-0.07, 0.03], [-0.07, -0.03]]) b.push(at(cube(0.022, 0.16, 0.022), lx, 0.08, lz));
  D.push(...place(b, x, 0, z, ry, s));
}
/** 趴着的狮子（朝 +x）：浅棕身体、深色鬃毛 */
export function lion(Tn: G[], Dk: G[], x: number, z: number, ry: number, s: number) {
  const b: G[] = [at(rbox(0.34, 0.13, 0.15, 0.05), 0, 0.075, 0), at(bead(0.065, 10, 8), 0.22, 0.17, 0), beam(V3(-0.17, 0.06, 0), V3(-0.3, 0.03, 0.06), 0.025)];
  for (const sz of [-1, 1]) b.push(at(rbox(0.16, 0.04, 0.045, 0.015), 0.22, 0.02, sz * 0.05));
  const d: G[] = [at(bead(0.1, 10, 8), 0.18, 0.16, 0, 0, 0, 0, [0.8, 1, 1.05]), at(bead(0.025, 6, 4), -0.31, 0.03, 0.06)];
  Tn.push(...place(b, x, 0, z, ry, s)); Dk.push(...place(d, x, 0, z, ry, s));
}

// ---------- 埃及件
/** 方锥（金字塔）：底边 w 与坐标轴平行，原点在底面中心，平面着色 */
const pyramid = (w: number, h: number) => flat(new THREE.ConeGeometry(w / Math.SQRT2, h, 4, 1).rotateY(PI / 4).translate(0, h / 2, 0));
/** 法老头巾（nemes）：上窄下宽的四棱台，平面着色 */
const nemes = (rt: number, rb: number, h: number) => flat(new THREE.CylinderGeometry(rt, rb, h, 4, 1).rotateY(PI / 4).scale(1, 1, 0.78));
/** 狮身人面像（朝 +z）：趴着的狮身、伸前的两爪、条纹头巾下一张脸 */
function sphinx(body: THREE.Material, cloth: THREE.Material, dark: THREE.Material): THREE.Group {
  const s = new THREE.Group(), B: G[] = [];
  B.push(at(rbox(0.5, 0.34, 0.42, 0.12, 2), 0, 0.17, -0.52), at(rbox(0.44, 0.3, 0.8, 0.1, 2), 0, 0.15, -0.14), at(rbox(0.46, 0.4, 0.3, 0.1, 2), 0, 0.2, 0.2));
  for (const sx of [-1, 1]) B.push(at(rbox(0.13, 0.1, 0.52, 0.04), sx * 0.15, 0.05, 0.56));
  B.push(at(rbox(0.15, 0.14, 0.14, 0.04), 0, 0.44, 0.22), at(rbox(0.16, 0.19, 0.14, 0.05), 0, 0.55, 0.28));
  B.push(beam(V3(0.2, 0.08, -0.7), V3(0.26, 0.04, -0.2), 0.04));
  bake(s, B, body);
  add(s, nemes(0.1, 0.19, 0.3), cloth, 0, 0.53, 0.2);
  bake(s, [at(cube(0.04, 0.022, 0.01), -0.036, 0.585, 0.352), at(cube(0.04, 0.022, 0.01), 0.036, 0.585, 0.352), at(cube(0.05, 0.014, 0.01), 0, 0.505, 0.352)], dark);
  return s;
}
/** 骆驼（朝 +x） */
function camel(list: G[], x: number, z: number, ry: number, s: number) {
  const b: G[] = [at(rbox(0.36, 0.17, 0.15, 0.06), 0, 0.38, 0), at(bead(0.1, 10, 8), -0.02, 0.47, 0, 0, 0, 0, [1.2, 0.95, 0.8]), capsule(V3(0.15, 0.4, 0), V3(0.27, 0.6, 0), 0.04), at(rbox(0.14, 0.065, 0.065, 0.025), 0.32, 0.61, 0, 0, 0, -0.15), beam(V3(-0.18, 0.42, 0), V3(-0.21, 0.28, 0), 0.025)];
  for (const [lx, lz] of [[0.12, 0.045], [0.12, -0.045], [-0.12, 0.045], [-0.12, -0.045]]) b.push(at(cube(0.045, 0.32, 0.045), lx, 0.16, lz));
  list.push(...place(b, x, 0, z, ry, s));
}
/** 拉美西斯二世坐像（朝 +z，原点在立面前脚下）：宝座、双腿、手放膝上、头巾、双冠。headless 时只剩身子 */
function colossus(list: G[], x: number, z: number, headless = false): void {
  const b: G[] = [at(rbox(0.5, 0.56, 0.34, 0.05), 0, 0.28, 0.17), at(rbox(0.36, 0.13, 0.46, 0.05), 0, 0.6, 0.3), at(rbox(0.32, 0.46, 0.2, 0.06), 0, 0.88, 0.13)];
  for (const sx of [-1, 1]) {
    b.push(at(rbox(0.13, 0.54, 0.15, 0.04), sx * 0.09, 0.27, 0.46), at(rbox(0.13, 0.06, 0.2, 0.02), sx * 0.09, 0.03, 0.55));
    b.push(at(rbox(0.08, 0.32, 0.1, 0.03), sx * 0.18, 0.84, 0.14), at(rbox(0.08, 0.07, 0.3, 0.025), sx * 0.13, 0.7, 0.33));
  }
  if (!headless) {
    b.push(at(rbox(0.17, 0.2, 0.16, 0.05), 0, 1.2, 0.15), nemes(0.1, 0.2, 0.3).translate(0, 1.16, 0.1), at(rbox(0.05, 0.1, 0.05, 0.015), 0, 1.06, 0.23));
    for (const sx of [-1, 1]) b.push(at(rbox(0.06, 0.2, 0.045, 0.015), sx * 0.1, 0.98, 0.2));
    b.push(cyl(0.065, 0.1, 0.22, 10).translate(0, 1.42, 0.1), at(bead(0.05, 8, 6), 0, 1.56, 0.1));
  }
  list.push(...place(b, x, 0, z));
}

/** 贴着车削山面的一层雪：rAt(y) 为山的半径，snowLine(φ) 为各方向的雪线高度，一直铺到 yTop */
function snowCap(rAt: (y: number) => number, snowLine: (f: number) => number, yTop: number, seg: number, rows: number): G {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= seg; j++) { const f = (j / seg) * PI * 2, yb = snowLine(f); for (let i = 0; i <= rows; i++) { const y = yb + ((yTop - yb) * i) / rows, r = rAt(y) + 0.025; pos.push(Math.sin(f) * r, y, Math.cos(f) * r); uv.push(j / seg, i / rows); } }
  for (let j = 0; j < seg; j++) for (let i = 0; i < rows; i++) { const a = j * (rows + 1) + i, b = a + rows + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const q = new THREE.BufferGeometry(); q.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); q.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); q.setIndex(idx); q.computeVertexNormals(); return q;
}

export const MODELS_AFRICA: Record<string, Maker> = {
  ...MORE_AFRICA,   // 补充的一批（D87，africa-more.ts）
  /** 吉萨金字塔群：胡夫、哈夫拉（塔尖留着一圈白色外壳石）、孟卡拉三座斜着排开，孟卡拉前三座小王后金字塔；前面趴着狮身人面像，旁边一头骆驼 */
  af_giza: () => {
    const g = new THREE.Group(), sand: RGB = [236, 214, 170], lime: RGB = [216, 178, 122], casing: RGB = [250, 242, 222], sph: RGB = [204, 154, 98], dk: RGB = [120, 90, 68];
    const stone = texMat("hband", lime, sand, 1, 8, 0.9), sm = mat(sand, 0.95), plain = mat(lime, 0.9);
    ground(g, sand);
    bake(g, [at(dome(1, 16, 5), -1.85, 0.05, -1.75, 0, 0, 0, [0.55, 0.12, 0.5]), at(dome(1, 16, 5), 2.0, 0.05, -1.0, 0, 0, 0, [0.4, 0.1, 0.7])], sm);
    add(g, pyramid(1.72, 1.42), stone, -1.0, 0.06, -0.85);
    add(g, rbox(1.84, 0.1, 1.84, 0.04), sm, 0.85, 0.08, -1.35);
    add(g, pyramid(1.6, 1.52), stone, 0.85, 0.13, -1.35);
    const hc = 0.46; add(g, pyramid((1.6 * hc) / 1.52, hc), mat(casing, 0.6), 0.85, 0.13 + 1.52 - hc + 0.006, -1.35).scale.set(1.06, 1.0, 1.06);
    add(g, pyramid(0.92, 0.76), stone, 1.72, 0.06, 0.32);
    bake(g, [0, 1, 2].map((i) => at(pyramid(0.34, 0.28), 1.15 + i * 0.4, 0.06, 1.0)), plain);
    const sp = sphinx(mat(sph, 0.85), texMat("hband", sph, casing, 1, 5, 0.8), mat(dk, 0.9)); sp.position.set(-0.35, 0.06, 0.95); sp.rotation.y = 0.75; sp.scale.setScalar(1.35); g.add(sp);
    const C: G[] = []; camel(C, -1.75, 1.15, 0.5, 1.15); bake(g, C, mat(sph, 0.85));
    return done(g, 2.4);
  },

  /** 开普敦桌山：平顶的灰色岩壁（竖向的沟），山脚一圈绿色灌木坡；左边魔鬼峰、右边狮子头；平顶上铺着「桌布云」，从崖边一道道垂下来（缓缓起伏）；缆车上下 */
  af_table_mountain: () => {
    const g = new THREE.Group(), rock: RGB = [176, 170, 174], rockD: RGB = [146, 140, 150], fyn: RGB = [140, 172, 118], white: RGB = [252, 252, 252], sea: RGB = [110, 180, 214];
    const rm = mat(rock, 0.9), gm = mat(fyn, 0.95), wm = mat(white, 1), dm = mat(rockD, 0.9);
    water(g, 2.2, 0, 1.78, 0.02, sea, 1.0, 0.3);
    add(g, dome(1, 32, 10), gm, 0, 0, -0.62).scale.set(2.3, 0.62, 1.15);
    add(g, slab([[-1.5, 0.2], [1.3, 0.2], [1.34, 1.1], [1.22, 1.8], [-1.3, 1.82], [-1.44, 1.1]], 1.0, 0.05), texMat("vband", rock, rockD, 2.6, 1, 0.9), 0, 0, -0.62);
    add(g, flat(new THREE.ConeGeometry(0.64, 1.66, 7)), rm, -1.82, 0.83, -0.3);
    add(g, flat(new THREE.CylinderGeometry(0.4, 0.72, 0.62, 7)), gm, -1.82, 0.31, -0.3);
    add(g, lathe([[0.62, 0], [0.56, 0.2], [0.46, 0.42], [0.36, 0.58], [0.3, 0.66], [0, 0.68]], 18), gm, 1.9, 0, 0.45);
    add(g, flat(lathe([[0.32, 0], [0.33, 0.14], [0.3, 0.32], [0.22, 0.46], [0.1, 0.55], [0, 0.56]], 9)), rm, 1.86, 0.6, 0.43).rotation.z = 0.12;
    add(g, dome(1, 16, 6), gm, 2.0, 0, 1.25).scale.set(0.4, 0.34, 0.75);
    // 桌布云：平铺的一层 + 几团鼓起 + 前沿垂下的一排
    const W: G[] = [at(rbox(2.56, 0.12, 1.06, 0.05, 2), -0.04, 1.88, -0.62)];
    for (const [x, z, s] of [[-0.9, -0.75, 0.34], [-0.2, -0.9, 0.4], [0.55, -0.65, 0.36], [1.0, -0.9, 0.28]] as [number, number, number][]) W.push(at(bead(s, 12, 8), x, 1.94, z, 0, 0, 0, [1.3, 0.4, 1]));
    for (let i = 0; i < 10; i++) W.push(at(bead(0.17, 12, 8), -1.18 + i * 0.26, 1.86, -0.1, 0, 0, 0, [1.1, 0.8, 0.75]));
    W.push(at(rbox(0.14, 0.09, 0.12, 0.02), 0.94, 0.42, 0.42));
    bake(g, W, wm);
    // 桌布云往下垂的一排：长短不一、软软的
    const drips = new THREE.Group(); drips.position.set(0, 1.86, -0.08); g.add(drips);
    const D: G[] = []; for (let i = 0; i < 7; i++) { const len = [0.32, 0.16, 0.46, 0.24, 0.38, 0.12, 0.28][i], r = 0.14; D.push(at(new THREE.CapsuleGeometry(r, len, 4, 12), -1.02 + i * 0.34, -(len / 2 + r) + 0.12, 0, 0, 0, 0, [1.05, 1, 0.5])); }
    bake(drips, D, wm);
    // 缆车：一根索、一个车厢在上下两站之间来回
    const lo = V3(0.94, 0.47, 0.42), hi = V3(1.0, 1.8, -0.12);
    add(g, beam(lo, hi, 0.014, 0.014), dm);
    const cab = add(g, rbox(0.09, 0.08, 0.09, 0.025), wm);
    return done(g, 2.4, (t) => { drips.scale.y = 1 + 0.14 * Math.sin(t * 0.7); const k = (Math.sin(t * 0.45) + 1) / 2; cab.position.lerpVectors(lo, hi, 0.1 + 0.8 * k).y -= 0.06; });
  },

  /** 维多利亚瀑布：一整条笔直的玄武岩崖口，赞比西河从上面整幅泻进一道窄峡谷（几座小岛把水幕分成几段），对面是长着雨林的崖；
   *  峡谷从右侧的缺口拐出去；水雾冲天（「轰鸣的烟雾」）。水幕的纹理往下流 */
  af_victoria_falls: () => {
    const g = new THREE.Group(), bas: RGB = [112, 106, 112], green: RGB = [126, 168, 110], river: RGB = [110, 180, 214], white: RGB = [250, 252, 252];
    const bm = mat(bas, 0.95), gm = mat(green, 0.95), rv = mat(river, 0.15, { metalness: 0.05 }), wm = mat(white, 1);
    const H = 1.45, zl = -0.32;
    add(g, rbox(4.4, H, 1.58, 0.08, 2), bm, 0, H / 2, zl - 0.8);
    add(g, rbox(4.3, 0.06, 1.42, 0.03), rv, 0, H + 0.01, zl - 0.8);
    const Gr: G[] = [], Tr: G[] = [];
    for (const [x, w] of [[-1.28, 0.24], [-0.28, 0.24], [1.08, 0.26]] as P2[]) { Gr.push(at(rbox(w, 0.12, 0.55, 0.04), x, H + 0.04, zl - 0.26)); Tr.push(at(bead(0.11, 10, 7), x, H + 0.16, zl - 0.2), at(bead(0.08, 10, 7), x + 0.04, H + 0.15, zl - 0.42)); }
    // 水幕（四段）、崖口的白浪
    const segs: P2[] = [[-2.15, -1.4], [-1.16, -0.4], [-0.16, 0.95], [1.21, 2.15]];
    const { m: fm, tex } = flowMat(white, river, 1.6, 1.2);
    const F: G[] = [], Wh: G[] = [];
    for (const [a, b] of segs) {
      const w = b - a, q = new THREE.PlaneGeometry(w, H, 1, 1), uv = q.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * w);
      F.push(at(q, (a + b) / 2, H / 2 + 0.02, zl + 0.025));
      Wh.push(at(rbox(w + 0.04, 0.1, 0.14, 0.045), (a + b) / 2, H + 0.02, zl + 0.0));
      for (let i = 0; i < Math.round(w * 3); i++) Wh.push(at(bead(0.1, 10, 6), a + (i + 0.5) / (w * 3) * w, 0.1, zl + 0.12, 0, 0, 0, [1.3, 0.8, 1]));
    }
    const fall = bake(g, F, fm)!; fall.castShadow = false;
    // 峡谷底的河、出口向前拐的一段
    bake(g, [at(rbox(4.3, 0.06, 0.56, 0.03), 0, 0.04, zl + 0.3), at(rbox(0.56, 0.06, 1.5, 0.03), 1.48, 0.04, 0.95), at(rbox(1.0, 0.06, 0.34, 0.03), 1.1, 0.04, 1.62)], rv);
    // 对面的崖（雨林）：被出口分成左右两块
    add(g, rbox(3.38, 0.5, 1.14, 0.06, 2), bm, -0.51, 0.25, 0.85);
    add(g, rbox(0.42, 0.5, 1.14, 0.06, 2), bm, 1.99, 0.25, 0.85);
    Gr.push(at(rbox(3.4, 0.08, 1.16, 0.03), -0.51, 0.52, 0.85), at(rbox(0.44, 0.08, 1.16, 0.03), 1.99, 0.52, 0.85));
    const r = mulberry32(17);
    for (let i = 0; i < 12; i++) { const x = -2.0 + i * 0.3 + r.next() * 0.08, s = 0.12 + r.next() * 0.07; Tr.push(at(bead(s, 10, 7), x, 0.58 + s * 0.8, 0.75 + r.next() * 0.6)); }
    for (const z of [0.6, 1.15]) Tr.push(at(bead(0.14, 10, 7), 1.99, 0.68, z));
    bake(g, Gr, gm); bake(g, Tr, gm); bake(g, Wh, wm);
    // 水雾柱
    const mist = new THREE.Group(); mist.position.set(-0.3, 0, zl + 0.3); g.add(mist);
    const mm = mat(white, 1, { transparent: true, opacity: 0.88 });
    const M: G[] = [];
    for (const [x, y, z, s] of [[-1.3, 1.45, 0.12, 0.26], [-0.6, 1.5, 0.08, 0.3], [0.2, 1.48, 0.12, 0.3], [0.95, 1.42, 0.1, 0.24], [-0.85, 1.9, 0.1, 0.34], [-0.1, 2.0, 0.1, 0.38], [0.6, 1.86, 0.1, 0.3], [-0.4, 2.42, 0.1, 0.32]] as [number, number, number, number][]) M.push(at(bead(s, 14, 10), x, y, z, 0, 0, 0, [1.25, 0.85, 0.8]));
    const mistMesh = bake(mist, M, mm)!; mistMesh.castShadow = false;
    return done(g, 2.3, (t) => { tex.offset.y = t * 1.2; mist.position.y = Math.sin(t * 0.5) * 0.06; mist.scale.setScalar(1 + Math.sin(t * 0.7) * 0.03); });
  },

  /** 乞力马扎罗：宽厚的火山穹（基博峰）顶是平的、顶着一圈雪，雪舌顺坡垂下；左后是尖碎的马文齐峰；山腰一圈云；山前稀树草原上金合欢和象 */
  af_kilimanjaro: () => {
    const g = new THREE.Group(), slate: RGB = [140, 148, 174], snow: RGB = [250, 251, 253], straw: RGB = [224, 200, 142], leaf: RGB = [132, 158, 98], dark: RGB = [118, 106, 104];
    const sm = mat(slate, 0.9), wm = mat(snow, 0.8);
    ground(g, straw);
    const K: P2[] = [[2.25, 0], [2.1, 0.2], [1.82, 0.58], [1.46, 1.08], [1.14, 1.6], [0.94, 2.0], [0.84, 2.24], [0.72, 2.36], [0.38, 2.42], [0, 2.42]];
    const rAt = (y: number) => { for (let i = 1; i < K.length; i++) if (y <= K[i][1]) { const [r0, y0] = K[i - 1], [r1, y1] = K[i]; return r0 + ((y - y0) / (y1 - y0 || 1)) * (r1 - r0); } return 0; };
    const zc = -0.62, sz = 0.7, y0 = 0.06;
    add(g, lathe(K, 24).scale(1, 1, sz), sm, 0, y0, zc);
    add(g, flat(new THREE.ConeGeometry(0.5, 1.55, 5)), sm, -1.62, 0.775, -1.42, 0.3);
    add(g, flat(new THREE.ConeGeometry(0.3, 1.0, 5)), sm, -1.3, 0.55, -1.2, 1.1);
    // 雪顶 + 冰舌
    // 雪顶：沿山面贴一层，下沿是起伏的雪线（几处冰川往下伸得长一些）
    const snowLine = (f: number) => 1.9 - 0.16 * Math.max(0, Math.sin(f * 5 + 0.7)) ** 2 - 0.3 * Math.max(0, Math.sin(f * 3 - 0.4)) ** 6 + 0.05 * Math.sin(f * 11);
    const S: G[] = [snowCap(rAt, snowLine, 2.36, 48, 6).scale(1, 1, sz).translate(0, y0, zc), lathe([[0.75, 2.36], [0.74, 2.375], [0.4, 2.445], [0, 2.445]], 24).scale(1, 1, sz).translate(0, y0, zc)];
    // 山腰的云
    for (let k = 0; k < 9; k++) { const f = -1.6 + k * 0.4, rr = rAt(0.95) + 0.12, s = 0.24 + (k % 3) * 0.06; S.push(at(bead(s, 12, 8), Math.sin(f) * rr, 0.95 + (k % 2) * 0.12, zc + Math.cos(f) * rr * sz, f, 0, 0, [1.7, 0.55, 1])); }
    bake(g, S, wm);
    const Tr: G[] = [], Cn: G[] = [], E: G[] = [], Tk: G[] = [];
    acacia(Tr, Cn, -1.5, 1.3, 1.05, 0.52, 0.3); acacia(Tr, Cn, 1.62, 1.05, 0.88, 0.42, 1.2);
    elephant(E, Tk, 0.15, 1.55, PI, 0.62); elephant(E, Tk, -0.45, 1.75, PI, 0.4);
    bake(g, Tr, mat(dark, 0.9)); bake(g, E, mat(dark, 0.9)); bake(g, Cn, mat(leaf, 0.95)); bake(g, Tk, mat(straw, 0.6));
    return done(g, 2.4);
  },

  /** 舍夫沙万：两座「角」一样的里夫山下，一坡蓝白小方屋层层叠上去，蓝色台阶边摆着陶土花盆；八角形的大清真寺宣礼塔和带垛口的卡斯巴城堡是土红色的 */
  af_chefchaouen: () => {
    const g = new THREE.Group(), blue: RGB = [96, 142, 212], sky: RGB = [168, 200, 238], white: RGB = [248, 248, 246], sage: RGB = [156, 170, 142], terra: RGB = [204, 128, 92];
    const bm = mat(blue, 0.7), lm = mat(sky, 0.75), wm = mat(white, 0.8), sm = mat(sage, 0.95), tm = mat(terra, 0.8);
    ground(g, sage);
    // 两座山「角」
    const Hl: G[] = [at(dome(1, 20, 8), -0.95, 0.04, -1.75, 0, 0, 0, [1.25, 2.4, 0.75]), at(dome(1, 20, 8), 1.05, 0.04, -1.8, 0, 0, 0, [1.2, 2.0, 0.68])];
    // 台地：一层层往后升高
    const rows = 5, step = 0.3, depth = 0.56, z0 = 1.35;
    for (let k = 0; k < rows; k++) { const zf = z0 - k * depth - depth / 2, h = k * step + 0.04; if (k > 0) Hl.push(at(cube(4.2 - k * 0.3, h, depth + 0.02), 0, h / 2, zf)); }
    bake(g, Hl, sm);
    const r = mulberry32(19), B: G[] = [], S: G[] = [], W: G[] = [], T: G[] = [];
    for (let k = 0; k < rows; k++) {
      const base = k * step + 0.04, zc = z0 - k * depth - depth / 2, half = 2.0 - k * 0.15;
      let x = -half + r.next() * 0.1;
      while (x < half - 0.3) {
        const w = 0.34 + r.next() * 0.22, h = 0.3 + r.next() * 0.26, d = 0.4 + r.next() * 0.1, cx = x + w / 2;
        if (Math.abs(cx - 0.32) < 0.24 && k < 4) { x += 0.5; continue; }
        const tone = r.next(), dz = (r.next() - 0.5) * 0.08;
        (tone < 0.62 ? B : tone < 0.9 ? S : W).push(at(rbox(w, h, d, 0.04), cx, base + h / 2, zc + dz));
        (tone < 0.62 ? S : W).push(at(rbox(w + 0.03, 0.04, d + 0.03, 0.015), cx, base + h + 0.01, zc + dz));
        (r.next() < 0.5 ? S : B).push(at(rbox(0.09, 0.15, 0.02, 0.01), cx + (r.next() - 0.5) * (w - 0.14), base + 0.08, zc + d / 2 + 0.03));
        x += w + 0.04 + r.next() * 0.06;
      }
    }
    // 蓝色台阶从第一层通到第四层，两边陶土花盆
    for (let i = 0; i < 16; i++) { const t = i / 16, y = t * (3 * step) + 0.06, z = z0 - depth / 2 - t * 3 * depth + 0.22; B.push(at(rbox(0.34, 0.08, 0.2, 0.02), 0.32, y, z)); if (i % 3 === 1) for (const sx of [-1, 1]) T.push(at(cyl(0.035, 0.025, 0.07, 8), 0.32 + sx * 0.21, y + 0.06, z)); }
    // 大清真寺的八角宣礼塔、卡斯巴城堡
    const mx = -0.6, mz = z0 - 2 * depth - depth / 2, my = 2 * step + 0.04;
    T.push(at(flat(new THREE.CylinderGeometry(0.17, 0.17, 1.15, 8)), mx, my + 0.575, mz), at(flat(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 8)), mx, my + 1.18, mz), at(flat(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 8)), mx, my + 1.32, mz), at(bead(0.05, 8, 6), mx, my + 1.48, mz));
    const kx = 1.3, kz = z0 - depth / 2 - 0.05, ky = 0.04;
    T.push(at(rbox(0.5, 0.42, 0.42, 0.03), kx, ky + 0.21, kz), at(rbox(0.26, 0.82, 0.26, 0.03), kx + 0.2, ky + 0.41, kz - 0.1));
    for (let i = 0; i < 3; i++) for (const sz of [-1, 1]) T.push(at(cube(0.06, 0.08, 0.05), kx + 0.1 + i * 0.1, ky + 0.86, kz - 0.1 + sz * 0.11));
    bake(g, B, bm); bake(g, S, lm); bake(g, W, wm); bake(g, T, tm);
    return done(g, 2.4);
  },

  /** 卡萨布兰卡哈桑二世清真寺：海边一座方形宣礼塔（米白石身、绿色马赛克嵌板、雉堞），塔顶小灯楼与金色的三球尖；右边长长的礼拜大殿（绿瓦四坡顶、一排拱门），后面是大西洋 */
  af_hassan2: () => {
    const g = new THREE.Group(), cream: RGB = [242, 234, 216], teal: RGB = [70, 146, 128], gold: RGB = [228, 184, 92], sea: RGB = [110, 180, 214], plaza: RGB = [216, 206, 188];
    const cm = mat(cream, 0.75), tm = mat(teal, 0.45), gm = mat(gold, 0.32, { metalness: 0.35 });
    const zel = texMat("diamond", teal, cream, 2, 7, 0.5);
    water(g, 2.45, 0, -1.4, 0.02, sea, 1, 0.42);
    add(g, rbox(4.4, 0.1, 2.9, 0.04), mat(plaza, 0.9), 0.05, 0.05, 0.75);
    // 宣礼塔
    const mx = -1.3, mz = -0.45, S = 0.64, Hs = 3.4, y0 = 0.1;
    add(g, rbox(S, Hs, S, 0.03, 2), cm, mx, y0 + Hs / 2, mz);
    const P: G[] = [], A: G[] = [], Cr: G[] = [];
    for (let k = 0; k < 4; k++) {
      const ry = (k * PI) / 2, nx = Math.sin(ry), nz = Math.cos(ry), o = S / 2 + 0.006;
      P.push(at(cube(0.38, 1.9, 0.02), mx + nx * o, y0 + 2.2, mz + nz * o, ry));
      A.push(at(slab(archShape(0.2, 0.42), 0.02), mx + nx * o, y0 + 0.75, mz + nz * o, ry), at(cube(0.44, 0.06, 0.02), mx + nx * o, y0 + 3.2, mz + nz * o, ry));
      for (let i = 0; i < 4; i++) Cr.push(at(cube(0.1, 0.13, 0.07), mx + nx * (S / 2 + 0.02) + Math.cos(ry) * (-0.24 + i * 0.16), y0 + Hs + 0.15, mz + nz * (S / 2 + 0.02) - Math.sin(ry) * (-0.24 + i * 0.16), ry));
    }
    bake(g, P, zel);
    A.push(at(rbox(S + 0.1, 0.1, S + 0.1, 0.03), mx, y0 + Hs + 0.04, mz));
    // 灯楼
    const ly = y0 + Hs + 0.1;
    Cr.push(at(rbox(0.3, 0.5, 0.3, 0.03), mx, ly + 0.25, mz));
    for (let k = 0; k < 4; k++) { const ry = (k * PI) / 2; A.push(at(slab(archShape(0.12, 0.3), 0.02), mx + Math.sin(ry) * 0.156, ly + 0.08, mz + Math.cos(ry) * 0.156, ry)); }
    A.push(at(rbox(0.36, 0.06, 0.36, 0.02), mx, ly + 0.53, mz), at(dome(0.15, 16, 6), mx, ly + 0.56, mz));
    bake(g, Cr, cm);
    bake(g, [at(cyl(0.015, 0.02, 0.42, 6), mx, ly + 0.9, mz), at(bead(0.06, 10, 8), mx, ly + 0.82, mz), at(bead(0.05, 10, 8), mx, ly + 0.95, mz), at(bead(0.04, 10, 8), mx, ly + 1.06, mz)], gm);
    // 礼拜大殿：主体、绿色四坡顶与中间高起的一段、正面一排拱门
    add(g, rbox(2.9, 0.78, 1.05, 0.04, 2), cm, 0.6, y0 + 0.39, -0.45);
    A.push(at(hip(2.96, 1.1, 0.3, 0.32), 0.6, y0 + 0.78, -0.45), at(rbox(1.3, 0.2, 0.7, 0.03), 0.6, y0 + 0.98, -0.45), at(hip(1.34, 0.74, 0.26, 0.2), 0.6, y0 + 1.08, -0.45));
    for (let i = 0; i < 11; i++) { const x = -0.6 + i * 0.24; A.push(at(slab(archShape(0.15, i === 5 ? 0.56 : 0.44), 0.02), x, y0 + 0.06, 0.085)); }
    // 右侧的柱廊
    add(g, rbox(0.42, 0.5, 1.9, 0.03), cm, 1.9, y0 + 0.25, 0.85);
    A.push(at(hip(0.46, 1.94, 0.14, 0.2), 1.9, y0 + 0.5, 0.85));
    for (let i = 0; i < 7; i++) A.push(at(slab(archShape(0.13, 0.32), 0.02), 1.685, y0 + 0.05, 0.1 + i * 0.25, -PI / 2));
    bake(g, A, tm);
    return done(g, 1.9);
  },

  /** 阿布辛贝神庙：沙岩山前凿出的梯形立面，四尊拉美西斯二世坐像（左二那尊的头掉在脚下），中间一道深门和太阳神龛，顶上一排狒狒；前面是纳赛尔湖 */
  af_abu_simbel: () => {
    const g = new THREE.Group(), rock: RGB = [212, 158, 104], face: RGB = [242, 214, 168], dark: RGB = [110, 82, 64], sand: RGB = [242, 222, 180], lake: RGB = [110, 180, 214];
    const fm = mat(face, 0.85), dm = mat(dark, 0.95), rm = mat(rock, 0.92);
    ground(g, sand);
    water(g, 2.3, 0, 1.85, 0.05, lake, 1, 0.26);
    add(g, flat(dome(1, 11, 5)), rm, 0, 0.04, -0.8).scale.set(2.4, 2.0, 1.45);
    add(g, slab([[-1.62, 0], [1.62, 0], [1.42, 2.05], [-1.42, 2.05]], 0.44, 0.03), rm, 0, 0.06, 0.05);
    const B: G[] = [at(rbox(2.98, 0.12, 0.5, 0.03), 0, 2.1, 0.07)];
    for (let i = 0; i < 16; i++) B.push(at(rbox(0.09, 0.13, 0.08, 0.025), -1.28 + i * 0.171, 2.21, 0.25));
    B.push(at(rbox(0.12, 0.3, 0.08, 0.03), 0, 1.06, 0.28));
    for (const [x, hl] of [[-1.0, false], [-0.38, true], [0.38, false], [1.0, false]] as [number, boolean][]) colossus(B, x, 0.3, hl);
    // 掉在地上的头：侧躺着，头巾、双冠一起
    const head: G[] = [at(rbox(0.17, 0.2, 0.16, 0.05), 0, 0.0, 0.05), nemes(0.1, 0.2, 0.3).translate(0, -0.04, 0), cyl(0.065, 0.1, 0.22, 10).translate(0, 0.22, 0)];
    B.push(...place(head.map((q) => at(q, 0, 0, 0, 0, 0, 1.35)), -0.62, 0.14, 0.98, 0.5));
    bake(g, B.map((q) => q.translate(0, 0.06, 0)), fm);
    bake(g, [at(rbox(0.26, 0.62, 0.05, 0.02), 0, 0.37, 0.29), at(rbox(0.22, 0.38, 0.04, 0.02), 0, 1.04, 0.278)], dm);
    return done(g, 2.0);
  },

  /** 马赛马拉：金黄的草原，几棵平顶的金合欢；长颈鹿在树下够叶子，大象、趴着的狮子，远处一群迁徙的角马；天上一只热气球（缓缓上下） */
  af_masai_mara: () => {
    const g = new THREE.Group(), straw: RGB = [226, 200, 132], leaf: RGB = [128, 156, 94], bark: RGB = [104, 80, 64], tan: RGB = [230, 170, 98], grey: RGB = [156, 150, 154];
    ground(g, straw);
    const r = mulberry32(31), Gs: G[] = [];
    for (let i = 0; i < 26; i++) { const a = r.next() * PI * 2, d = 0.4 + r.next() * 1.9; Gs.push(at(new THREE.ConeGeometry(0.06, 0.16 + r.next() * 0.1, 5), Math.cos(a) * d, 0.12, Math.sin(a) * d)); }
    bake(g, Gs, mat(straw, 0.95));
    const Tr: G[] = [], Cn: G[] = [], Tn: G[] = [], Dk: G[] = [], E: G[] = [], Tk: G[] = [];
    acacia(Tr, Cn, -1.05, -0.95, 1.7, 0.9, 0.2); acacia(Tr, Cn, 1.25, -1.35, 1.45, 0.72, 1.4); acacia(Tr, Cn, 1.95, 0.75, 1.0, 0.48, 2.4);
    giraffe(Tn, Dk, -0.45, -0.5, PI * 0.82, 1.18); giraffe(Tn, Dk, 0.2, -0.9, PI * 0.9, 0.9, 1);
    elephant(E, Tk, 0.75, 0.55, PI * 1.15, 0.85);
    lion(Tn, Dk, -0.9, 1.25, -0.4, 1.3);
    for (let i = 0; i < 9; i++) wildebeest(Dk, 0.65 + (i % 5) * 0.3 + r.next() * 0.1, -0.2 + Math.floor(i / 5) * 0.26 + r.next() * 0.08, 0.2 + r.next() * 0.3, 1.05);
    // 热气球
    const bal = new THREE.Group(); bal.position.set(-1.75, 1.7, 0.2); g.add(bal);
    add(bal, lathe([[0, 0], [0.08, 0.02], [0.17, 0.09], [0.27, 0.21], [0.34, 0.37], [0.37, 0.52], [0.34, 0.66], [0.25, 0.77], [0.12, 0.83], [0, 0.85]], 16), texMat("vband", tan, leaf, 8, 1, 0.7), 0, 0, 0);
    const R: G[] = [at(rbox(0.13, 0.09, 0.13, 0.025), 0, -0.2, 0)];
    for (const [x, z] of [[0.05, 0.05], [0.05, -0.05], [-0.05, 0.05], [-0.05, -0.05]]) R.push(beam(V3(x, -0.16, z), V3(x * 1.6, 0.01, z * 1.6), 0.008));
    bake(bal, R, mat(bark, 0.9));
    bake(g, Tr, mat(bark, 0.9)); bake(g, Cn, mat(leaf, 0.95)); bake(g, Tn, mat(tan, 0.8)); bake(g, Dk, mat(bark, 0.9)); bake(g, E, mat(grey, 0.85)); bake(g, Tk, mat(straw, 0.6));
    return done(g, 2.4, (t) => { bal.position.y = 1.7 + Math.sin(t * 0.5) * 0.12; bal.rotation.y = t * 0.1; });
  },
};

/** 摩尔式拱门（马蹄拱）的轮廓：宽 w、高 h，原点在洞底中心 */
function archShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape(), r = w / 2, hs = h - r * 1.1; s.moveTo(-r * 0.9, 0); s.lineTo(r * 0.9, 0); s.lineTo(r * 0.9, hs);
  s.absarc(0, hs, r, -0.45, PI + 0.45, false); s.lineTo(-r * 0.9, 0); return s;
}
/** 四坡屋顶：底 w×d，高 h，四边各往里收 inset。原点在屋檐 */
export function hip(w: number, d: number, h: number, inset: number): G {
  const q = new THREE.BoxGeometry(w, h, d), p = q.attributes.position as THREE.BufferAttribute;
  const ix = Math.min(inset, w / 2 - 0.004), iz = Math.min(inset, d / 2 - 0.004);
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, Math.sign(p.getX(i)) * (w / 2 - ix), h / 2, Math.sign(p.getZ(i)) * (d / 2 - iz));
  q.translate(0, h / 2, 0); return flat(q);
}
