/** 名胜模型：欧洲。积木见 ../landmark-kit.ts；每个模型返回 { group, top, footprint, update? }。
 *  约定：原点在地面中心，+y 向上，正面朝 +z；抓住外形特征并夸张 1.2～1.4 倍，细节从简；每个模型不超过 5 种颜色；
 *  重复的小零件（柱子、垛口、尖塔、雕像、窗）合并成一个网格，每个模型不超过 100 个网格。
 *  本文件自带几样欧洲建筑常用的件：拱洞与拱桥立面（半圆拱 / 尖拱）、沿高度扫出的变截面方柱（铁塔腿）、弯到椭圆上的拱廊（斗兽场、圣彼得广场柱廊）、
 *  四坡屋顶、洋葱顶、风车，以及几张纯数据贴图（格构、菱形格、拱廊、条纹、螺旋、折线），Node 里也能建。
 *  配色：真实颜色往世界的柔和色板上靠；白色大理石的建筑（米兰、圣彼得、勃兰登堡门）略压暗一点并配深色门窗，免得在浅色地面上化成一片。 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mulberry32 } from "../../algo/prng.ts";
import { type Maker, type RGB, type Landmark, mat, add, box, cyl, cone, ball, prism, water } from "../landmark-kit.ts";
import { MORE_EUROPE } from "./europe-more.ts";

type G = THREE.BufferGeometry;
type P2 = [number, number];
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// ---------- 调色（真实色往世界的柔和色板上靠）
const WATER: RGB = [110, 180, 214], GRASS: RGB = [140, 176, 130];
const GOLD: RGB = [228, 184, 92], WHITE: RGB = [248, 248, 246], TERRA: RGB = [212, 120, 86];
const goldM = () => mat(GOLD, 0.32, { metalness: 0.35 });
const waterM = (c: RGB = WATER) => mat(c, 0.1, { metalness: 0.05, transparent: true, opacity: 0.92 });

// ---------- 几何小工具
const _o = new THREE.Object3D(); _o.rotation.order = "YXZ";
/** 把几何体摆到位（先绕 z、再绕 x、最后绕 y 转），给合并用 */
function at<T extends G>(q: T, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s: number | [number, number, number] = 1): T {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz, "YXZ"); if (Array.isArray(s)) _o.scale.set(s[0], s[1], s[2]); else _o.scale.setScalar(s);
  _o.updateMatrix(); q.applyMatrix4(_o.matrix); return q;
}
/** 小零件用的直角盒（顶点少；合并时用它，圆角盒留给大件） */
const cube = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** 顶点少的倒角盒（一圈倒角），成批合并的石块、房子用它 */
const rbox = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 3, h / 3, d / 3));
/** 顶点少的小球（雕像的头、树冠） */
const bead = (r: number) => new THREE.SphereGeometry(r, 10, 7);
/** 两点之间的一根杆：round 时是圆杆，否则是方杆 */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, t = w, round = false): G {
  const len = a.distanceTo(b); const q: G = round ? cyl(w / 2, w / 2, len, 8).rotateX(PI / 2) : cube(w, t, len);
  _o.position.copy(a).add(b).multiplyScalar(0.5); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.lookAt(b); _o.updateMatrix(); return q.applyMatrix4(_o.matrix);
}
function merged(list: G[]): G { const out = mergeGeometries(list.map((q) => (q.index ? q.toNonIndexed() : q)), false); if (!out) throw new Error("mergeGeometries failed"); return out; }
/** 一组同色零件合成一个网格 */
function bake(g: THREE.Group, list: G[], m: THREE.Material): THREE.Mesh | null { return list.length ? add(g, merged(list), m) : null; }
/** 平面着色（八角塔身、石块要棱角分明） */
function flat(q: G): G { const n = q.index ? q.toNonIndexed() : q; n.computeVertexNormals(); return n; }
const lathe = (pts: P2[], seg = 16, sr = 1, sy = 1) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r * sr, y * sy)), seg);
/** 半球（穹顶、山包） */
const dome = (r = 1, seg = 20) => new THREE.SphereGeometry(r, seg, 10, 0, PI * 2, 0, PI / 2);
/** 正多边形柱 / 台（八角塔身），平面着色，边对齐坐标轴 */
const prismN = (r: number, h: number, n: number) => flat(new THREE.CylinderGeometry(r, r, h, n).rotateY(PI / n));
const frustumN = (r0: number, r1: number, h: number, n: number) => flat(new THREE.CylinderGeometry(r1, r0, h, n).rotateY(PI / n));
/** 方锥（尖顶），底边与坐标轴平行；w 为底边长 */
const pyramid = (w: number, h: number) => new THREE.ConeGeometry(w / Math.SQRT2, h, 4).rotateY(PI / 4);
/** 四坡屋顶：底 w×d，高 h，四边各往里收 inset（收到一半就成一条脊）。原点在屋檐 */
function hip(w: number, d: number, h: number, inset: number): G {
  const q = new THREE.BoxGeometry(w, h, d), p = q.attributes.position as THREE.BufferAttribute;
  const ix = Math.min(inset, w / 2 - 0.004), iz = Math.min(inset, d / 2 - 0.004);
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, Math.sign(p.getX(i)) * (w / 2 - ix), h / 2, Math.sign(p.getZ(i)) * (d / 2 - iz));
  q.translate(0, h / 2, 0); return flat(q);
}
/** 沿高度扫出一根变截面方柱：f(t) 给出 t∈[0,1] 处的中心 x、高度 y、中心 z、宽、深 */
function sweep(f: (t: number) => [number, number, number, number, number], segs = 6): G {
  const q = new THREE.BoxGeometry(1, 1, 1, 1, segs, 1), p = q.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const [x, y, z, w, d] = f(p.getY(i) + 0.5); p.setXYZ(i, x + p.getX(i) * w, y, z + p.getZ(i) * d); }
  q.computeVertexNormals(); return q;
}
/** 拱洞轮廓：底中心 (cx, y0)，宽 w，拱顶高 h；pointed 为哥特尖拱 */
function archPath(cx: number, y0: number, w: number, h: number, pointed = false): THREE.Path {
  const p = new THREE.Path(), r = w / 2, hs = y0 + h - (pointed ? w * 0.85 : r);
  p.moveTo(cx - r, y0); p.lineTo(cx + r, y0); p.lineTo(cx + r, hs);
  if (pointed) { p.quadraticCurveTo(cx + r, hs + w * 0.55, cx, y0 + h); p.quadraticCurveTo(cx - r, hs + w * 0.55, cx - r, hs); } else p.absarc(cx, hs, r, 0, PI, false);
  p.lineTo(cx - r, y0); return p;
}
function rectPath(cx: number, y0: number, w: number, h: number): THREE.Path {
  const p = new THREE.Path(); p.moveTo(cx - w / 2, y0); p.lineTo(cx + w / 2, y0); p.lineTo(cx + w / 2, y0 + h); p.lineTo(cx - w / 2, y0 + h); p.lineTo(cx - w / 2, y0); return p;
}
/** 平面图形挤出厚度 dep（沿 z，居中） */
function slab(s: THREE.Shape | THREE.Path | P2[], dep: number, bevel = 0): G {
  const shape = Array.isArray(s) ? new THREE.Shape(s.map(([x, y]) => V2(x, y))) : s instanceof THREE.Shape ? s : new THREE.Shape(s.getPoints(8));
  const q = new THREE.ExtrudeGeometry(shape, { depth: dep, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 8 }); q.translate(0, 0, -dep / 2); return q;
}
/** 拱形的深色贴片（门洞、窗），原点在洞底中心，朝 +z */
const archInset = (w: number, h: number, pointed = false, dep = 0.03) => slab(archPath(0, 0, w, h, pointed), dep);
/** 拱桥 / 拱廊的立面：宽 w、高 h、厚 dep；arches 为 [中心 x, 拱宽, 起拱高]，拱从地面开口 */
function arcade(w: number, h: number, dep: number, arches: [number, number, number][]): G {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0);
  for (const [x, aw, sp] of arches) { s.lineTo(x - aw / 2, 0); s.lineTo(x - aw / 2, sp); s.absarc(x, sp, aw / 2, PI, 0, true); s.lineTo(x + aw / 2, 0); }
  s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath(); return slab(s, dep);
}
/** 侧面轮廓（z, y）沿 x 拉成一整条（长 len，居中）：悬崖、山坡 */
function sideExtrude(pts: P2[], len: number): G {
  const q = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => V2(-z, y))), { depth: len, bevelEnabled: false }); q.translate(0, 0, -len / 2); q.rotateY(PI / 2); return q;
}
/** 椭圆（半轴 a 沿 x、b 沿 z）上的点与外法线；θ=0 在 +z，θ 增大往 +x 转 */
const ellP = (a: number, b: number, t: number): P2 => [a * Math.sin(t), b * Math.cos(t)];
const ellN = (a: number, b: number, t: number): P2 => { const nx = b * Math.sin(t), nz = a * Math.cos(t), l = Math.hypot(nx, nz); return [nx / l, nz / l]; };
/** 把一段沿 x 摆开的墙（x ∈ [-w/2, w/2]，+z 朝外）弯到椭圆的 [t0, t1] 弧上 */
function bendArc(q: G, a: number, b: number, t0: number, t1: number, w: number): G {
  const p = q.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = t0 + ((p.getX(i) + w / 2) / w) * (t1 - t0), [px, pz] = ellP(a, b, t), [nx, nz] = ellN(a, b, t), z = p.getZ(i);
    p.setXYZ(i, px + nx * z, p.getY(i), pz + nz * z);
  }
  q.computeVertexNormals(); return q;
}
const arcLen = (a: number, b: number, t0: number, t1: number) => { const [x0, z0] = ellP(a, b, t0), [x1, z1] = ellP(a, b, t1); return Math.hypot(x1 - x0, z1 - z0); };
/** 洋葱顶（圣瓦西里）：r 为最鼓处半径，h 为总高 */
const ONION: P2[] = [[0.56, 0], [0.8, 0.07], [0.96, 0.2], [1.0, 0.33], [0.92, 0.49], [0.7, 0.66], [0.44, 0.8], [0.22, 0.92], [0.09, 1.02], [0.06, 1.12], [0, 1.2]];
const onion = (r: number, h: number, seg = 20) => lathe(ONION, seg, r, h / 1.2);
const _b = new THREE.Box3();
/** 收尾：标签高度 = 最高点 + 0.2 */
function done(g: THREE.Group, footprint: number, update?: (t: number) => void): Landmark { _b.setFromObject(g); return { group: g, top: +(_b.max.y + 0.2).toFixed(2), footprint, update }; }

// ---------- 纯数据贴图（DataTexture，Node 里也能建）：a 为底色，b 为花纹色
type Pat = "grid" | "diamond" | "arcade" | "hband" | "vband" | "spiral" | "zigzag";
const PAT: Record<Pat, (x: number, y: number) => boolean> = {
  grid: (x, y) => x < 0.14 || y < 0.14,
  diamond: (x, y) => (x + y) % 1 < 0.12 || (x - y + 1) % 1 < 0.12,
  arcade: (x, y) => { const dx = Math.abs(x - 0.5) / 0.3; if (dx > 1 || y < 0.1) return false; return y < 0.58 || dx * dx + ((y - 0.58) / 0.3) ** 2 < 1; },
  hband: (_x, y) => y < 0.2,
  vband: (x) => x < 0.2,
  spiral: (x, y) => (x + y) % 1 < 0.5,
  zigzag: (x, y) => (y + Math.abs(x - 0.5)) % 0.5 < 0.25,
};
const texCache = new Map<string, THREE.Material>();
function texMat(kind: Pat, a: RGB, b: RGB, rx: number, ry: number, rough = 0.65, metal = 0): THREE.Material {
  const key = JSON.stringify([kind, a, b, rx, ry, rough, metal]); const hit = texCache.get(key); if (hit) return hit;
  const N = 32, d = new Uint8Array(N * N * 4), f = PAT[kind];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = f((i + 0.5) / N, (j + 0.5) / N) ? b : a; d.set([c[0], c[1], c[2], 255], (j * N + i) * 4); }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rx, ry); t.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal }); texCache.set(key, m); return m;
}

/** 荷兰风车（小孩堤防）：八角茅草塔身、木座、帽子、四片格子帆；返回帆（转动用） */
function windmill(g: THREE.Group, x: number, z: number, s: number, ry: number, thatch: RGB, sail: THREE.Material, wood: THREE.Material): THREE.Group {
  const w = new THREE.Group(); w.position.set(x, 0, z); w.rotation.y = ry; w.scale.setScalar(s); g.add(w);
  add(w, prismN(0.56, 0.2, 8), wood, 0, 0.1, 0);
  add(w, frustumN(0.52, 0.27, 1.32, 8), mat(thatch, 0.95), 0, 0.86, 0);
  add(w, ball(0.3), mat(thatch, 0.95), 0, 1.56, 0.02).scale.set(0.95, 0.75, 1.25);
  add(w, beam(V3(0, 1.4, -0.3), V3(0, 0.1, -1.0), 0.06, 0.06), wood);
  const sails = new THREE.Group(); sails.position.set(0, 1.58, 0.42); w.add(sails);
  const stock: G[] = [], pan: G[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * PI) / 2;
    stock.push(at(cube(0.05, 1.08, 0.05), Math.sin(a) * 0.54, Math.cos(a) * 0.54, 0, 0, 0, -a));
    pan.push(at(cube(0.2, 0.82, 0.02), Math.sin(a) * 0.62 + Math.cos(a) * 0.13, Math.cos(a) * 0.62 - Math.sin(a) * 0.13, 0.02, 0, 0, -a));
  }
  stock.push(at(cyl(0.07, 0.07, 0.14, 10), 0, 0, -0.04, 0, PI / 2));
  bake(sails, stock, wood); bake(sails, pan, sail);
  return sails;
}

export const MODELS_EUROPE: Record<string, Maker> = {
  ...MORE_EUROPE,   // 补充的一批（D87，europe-more.ts）
  // ---------- 法国
  /** 埃菲尔铁塔：四条弯腿张开、腿间大拱，一、二层平台，格构塔身收成细尖 */
  eu_eiffel: () => {
    const g = new THREE.Group(), br: RGB = [150, 122, 102], line: RGB = [116, 92, 76];
    const m = mat(br, 0.55, { metalness: 0.15 });
    const W = (y: number) => 1.22 * Math.exp(-0.63 * y);
    const legs: G[] = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      legs.push(sweep((t) => { const y = t * 1.0, lw = 0.4 - 0.13 * t, c = W(y) - lw / 2; return [sx * c, y, sz * c, lw, lw]; }, 6));
      legs.push(sweep((t) => { const y = 1.06 + t * 0.94, lw = 0.25 - 0.09 * t, c = W(y) - lw / 2; return [sx * c, y, sz * c, lw, lw]; }, 4));
    }
    for (let k = 0; k < 4; k++) { const ry = (k * PI) / 2, q = new THREE.TorusGeometry(0.66, 0.05, 6, 20, PI).scale(1, 0.92, 1); legs.push(at(q, Math.sin(ry) * 0.85, 0.3, Math.cos(ry) * 0.85, ry)); }
    for (let k = 0; k < 4; k++) { const ry = (k * PI) / 2, c = W(1.55) - 0.06; legs.push(at(cube(2 * c, 0.05, 0.05), Math.sin(ry) * c, 1.55, Math.cos(ry) * c, ry)); }
    bake(g, legs, m);
    add(g, box(1.66, 0.17, 1.66, 0.04), texMat("grid", br, line, 7, 1, 0.55, 0.15), 0, 1.02, 0);
    add(g, box(0.88, 0.13, 0.88, 0.03), texMat("grid", br, line, 4, 1, 0.55, 0.15), 0, 2.02, 0);
    add(g, sweep((t) => { const y = 2.0 + t * 2.46, w = 2 * W(y); return [0, y, 0, w, w]; }, 8), texMat("diamond", br, line, 2, 9, 0.55, 0.15));
    add(g, box(0.26, 0.1, 0.26, 0.03), m, 0, 4.46, 0);
    add(g, box(0.15, 0.16, 0.15, 0.03), m, 0, 4.59, 0);
    add(g, cyl(0.018, 0.03, 0.5, 8), m, 0, 4.92, 0);
    return done(g, 1.3);
  },
  /** 凯旋门：方正的大石块，正中一个高大的半圆拱（拱洞里深一层），两侧各一个小横拱，上面厚檐口和女儿墙，四面浮雕 */
  eu_arc_triomphe: () => {
    const g = new THREE.Group(), lime: RGB = [232, 222, 200], shade: RGB = [198, 184, 160], dark: RGB = [150, 138, 122], cob: RGB = [192, 188, 182];
    const lm = mat(lime, 0.85), sm = mat(shade, 0.9), dm = mat(dark, 0.95, { side: THREE.DoubleSide });
    add(g, cyl(2.1, 2.15, 0.06, 32), mat(cob, 0.9), 0, 0.03, 0);
    const Wd = 2.2, D = 1.1, H = 1.72, aw = 0.84, ah = 1.38, y0 = 0.06, sp = ah - aw / 2;
    const s = new THREE.Shape(); s.moveTo(-Wd / 2, 0); s.lineTo(-aw / 2, 0); s.lineTo(-aw / 2, sp); s.absarc(0, sp, aw / 2, PI, 0, true); s.lineTo(aw / 2, 0); s.lineTo(Wd / 2, 0); s.lineTo(Wd / 2, H); s.lineTo(-Wd / 2, H); s.closePath();
    add(g, slab(s, D), lm, 0, y0, 0);
    add(g, box(Wd + 0.16, 0.12, D + 0.16, 0.03), lm, 0, y0 + H + 0.06, 0);
    add(g, box(Wd, 0.48, D, 0.03), lm, 0, y0 + H + 0.36, 0);
    add(g, box(Wd + 0.06, 0.07, D + 0.06, 0.02), lm, 0, y0 + H + 0.63, 0);
    const S: G[] = [], K: G[] = [];
    // 拱洞内衬（深一层，门洞一眼看得出）与两侧小横拱
    K.push(new THREE.CylinderGeometry(aw / 2 - 0.012, aw / 2 - 0.012, D - 0.02, 16, 1, true, PI / 2, PI).rotateX(PI / 2).translate(0, y0 + sp, 0));
    for (const xs of [-1, 1]) { K.push(at(cube(0.02, sp, D - 0.02), xs * (aw / 2 - 0.014), y0 + sp / 2, 0)); K.push(at(archInset(0.46, 0.84), xs * (Wd / 2 + 0.005), y0, 0, (xs * PI) / 2)); }
    for (const zs of [-1, 1]) {
      S.push(at(cube(Wd + 0.04, 0.12, 0.04), 0, y0 + 1.52, zs * (D / 2 + 0.01)), at(cube(Wd + 0.04, 0.1, 0.04), 0, y0 + H + 0.36, zs * (D / 2 + 0.01)));
      S.push(at(cube(Wd + 0.02, 0.06, 0.04), 0, y0 + sp - 0.02, zs * (D / 2 + 0.01)));
      for (const xs of [-1, 1]) { S.push(at(cube(0.5, 0.56, 0.05), xs * 0.76, y0 + 0.62, zs * (D / 2 + 0.02))); S.push(at(cube(0.5, 0.3, 0.05), xs * 0.76, y0 + 1.2, zs * (D / 2 + 0.02))); }
    }
    bake(g, S, sm); bake(g, K, dm);
    return done(g, 1.5);
  },
  /** 巴黎圣母院：西立面两座平顶方塔、正中玫瑰窗、三座尖拱门；后面长长的中殿、飞扶壁和中央尖顶 */
  eu_notre_dame: () => {
    const g = new THREE.Group(), st: RGB = [224, 212, 188], lead: RGB = [120, 130, 150], dk: RGB = [98, 90, 88], glass: RGB = [104, 122, 182];
    const sm = mat(st, 0.8), lm = mat(lead, 0.55), zf = 1.0;
    add(g, box(1.9, 1.9, 0.55, 0.04), sm, 0, 0.95, zf - 0.275);
    for (const s of [-1, 1]) { add(g, box(0.64, 1.0, 0.55, 0.04), sm, s * 0.63, 2.4, zf - 0.275); add(g, box(0.7, 0.06, 0.6, 0.02), sm, s * 0.63, 2.92, zf - 0.275); }
    add(g, box(0.66, 0.28, 0.2, 0.03), sm, 0, 2.02, zf - 0.12);
    // 中殿、耳堂、后殿与铅皮屋顶
    add(g, box(1.1, 1.55, 2.3, 0.04), sm, 0, 0.775, -0.8);
    add(g, prism(1.16, 0.62, 2.3), lm, 0, 1.55, -0.8);
    add(g, box(2.0, 1.45, 0.52, 0.04), sm, 0, 0.725, -1.0);
    add(g, prism(0.56, 0.58, 2.0).rotateY(PI / 2), lm, 0, 1.45, -1.0);
    add(g, new THREE.CylinderGeometry(0.55, 0.55, 1.4, 14, 1, false, PI / 2, PI), sm, 0, 0.7, -1.95);
    add(g, new THREE.ConeGeometry(0.58, 0.6, 14, 1, false, PI / 2, PI), lm, 0, 1.7, -1.95);
    // 尖顶
    add(g, prismN(0.13, 0.3, 8), lm, 0, 2.3, -1.0);
    add(g, cone(0.14, 1.5, 8), lm, 0, 3.2, -1.0);
    add(g, ball(0.035), goldM(), 0, 3.96, -1.0);
    // 飞扶壁
    const B: G[] = [];
    for (const z of [0.05, -0.4, -1.55, -1.95]) for (const s of [-1, 1]) { B.push(at(box(0.12, 1.05, 0.16, 0.03), s * 0.95, 0.52, z), at(cone(0.07, 0.24, 4), s * 0.95, 1.16, z, PI / 4), beam(V3(s * 0.95, 1.0, z), V3(s * 0.56, 1.36, z), 0.06, 0.07)); }
    bake(g, B, sm);
    // 立面：三座门、国王廊、玫瑰窗、钟楼的尖拱窗
    const D: G[] = [], R: G[] = [];
    D.push(at(archInset(0.44, 0.74, true), 0, 0.02, zf), at(archInset(0.36, 0.64, true), -0.62, 0.02, zf), at(archInset(0.36, 0.64, true), 0.62, 0.02, zf));
    for (let i = 0; i < 14; i++) D.push(at(cube(0.07, 0.14, 0.03), -0.8 + i * 0.123, 0.95, zf));
    for (const s of [-1, 1]) for (const u of [-0.13, 0.13]) D.push(at(archInset(0.15, 0.62, true), s * 0.63 + u, 2.06, zf));
    D.push(at(cube(0.5, 0.2, 0.03), 0, 1.98, zf - 0.02));
    bake(g, D, mat(dk, 0.9));
    add(g, cyl(0.3, 0.3, 0.04, 24).rotateX(PI / 2), mat(glass, 0.3), 0, 1.4, zf + 0.005);
    R.push(at(new THREE.TorusGeometry(0.31, 0.035, 6, 24), 0, 1.4, zf + 0.02));
    for (let k = 0; k < 6; k++) R.push(at(cube(0.025, 0.58, 0.03), 0, 1.4, zf + 0.02, 0, 0, (k * PI) / 6));
    bake(g, R, sm);
    return done(g, 1.6);
  },
  /** 卢浮宫：U 形宫殿（米色石墙、灰蓝斜屋顶、方穹顶的馆）围着玻璃金字塔、三座小金字塔和三角水池 */
  eu_louvre: () => {
    const g = new THREE.Group(), cream: RGB = [236, 226, 206], roof: RGB = [108, 118, 138], plaza: RGB = [222, 214, 200];
    const cm = mat(cream, 0.85), rm = mat(roof, 0.6);
    add(g, box(4.8, 0.06, 4.2, 0.02), mat(plaza, 0.9), 0, 0.03, -0.3);
    const wing = (x: number, z: number, w: number, d: number, h: number) => { add(g, box(w, h, d, 0.04), cm, x, 0.06 + h / 2, z); add(g, hip(w + 0.04, d + 0.04, 0.34, 0.16), rm, x, 0.06 + h, z); };
    wing(0, -1.98, 4.8, 0.5, 0.82);
    for (const s of [-1, 1]) wing(s * 2.15, -0.38, 0.5, 2.9, 0.82);
    const pav = (x: number, z: number, w: number, d: number, h: number) => { add(g, box(w, h, d, 0.04), cm, x, 0.06 + h / 2, z); add(g, hip(w + 0.04, d + 0.04, 0.5, 0.2), rm, x, 0.06 + h, z); add(g, hip(w * 0.5, d * 0.5, 0.14, 0.25), rm, x, 0.06 + h + 0.5, z); };
    pav(0, -1.95, 0.9, 0.64, 1.05);
    for (const s of [-1, 1]) pav(s * 2.12, -0.5, 0.64, 0.86, 1.02);
    const win: G[] = [];
    for (let i = 0; i < 16; i++) { const x = -2.25 + i * 0.3; if (Math.abs(x) < 0.5) continue; for (const y of [0.3, 0.62]) win.push(at(cube(0.09, 0.16, 0.02), x, y, -1.72)); }
    for (const s of [-1, 1]) for (let i = 0; i < 10; i++) { const z = -1.6 + i * 0.3; if (Math.abs(z + 0.5) < 0.45) continue; for (const y of [0.3, 0.62]) win.push(at(cube(0.02, 0.16, 0.09), s * 1.893, y, z)); }
    bake(g, win, rm);
    // 玻璃金字塔（菱形格）与三座小金字塔
    const glass = texMat("diamond", [168, 198, 220], cream, 16, 5, 0.18, 0.25);
    add(g, pyramid(1.46, 1.16), glass, 0, 0.06 + 0.58, 0.25);
    for (const [x, z] of [[-1.15, 0.35], [1.15, 0.35], [0, 1.55]] as P2[]) add(g, pyramid(0.34, 0.27), glass, x, 0.06 + 0.135, z);
    // 三角水池
    const P: G[] = [];
    for (const [x, z, r] of [[-0.95, 1.05, -PI / 4], [0.95, 1.05, PI / 4], [-1.2, -0.75, PI / 4 + PI / 2], [1.2, -0.75, -PI / 4 - PI / 2]] as [number, number, number][]) P.push(at(slab([[-0.55, 0], [0.55, 0], [0, 0.5]], 0.04).rotateX(-PI / 2), x, 0.07, z, r));
    bake(g, P, waterM());
    return done(g, 2.2);
  },
  /** 圣米歇尔山：海湾里的一座尖石山，山脚城墙、坡上房子层层绕上去，山顶修道院和金色天使的哥特尖顶 */
  eu_mont_st_michel: () => {
    const g = new THREE.Group(), rock: RGB = [150, 150, 136], stone: RGB = [214, 200, 178], slate: RGB = [96, 104, 122];
    const sm = mat(stone, 0.85), lm = mat(slate, 0.6);
    water(g, 2.3, 0, 0, 0.03, [124, 180, 200]);
    add(g, box(0.34, 0.06, 1.1, 0.02), sm, 0, 0.07, 1.8);
    const R: P2[] = [[1.45, 0], [1.42, 0.25], [1.3, 0.5], [1.08, 0.88], [0.84, 1.26], [0.64, 1.6], [0.5, 1.84], [0, 1.9]];
    add(g, flat(lathe(R, 11)), mat(rock, 0.95));
    const rAt = (y: number) => { for (let i = 1; i < R.length; i++) if (y <= R[i][1]) { const [r0, y0] = R[i - 1], [r1, y1] = R[i]; return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0); } return 0; };
    // 城墙与圆塔
    const W: G[] = [], Rf: G[] = [];
    W.push(new THREE.CylinderGeometry(1.52, 1.54, 0.4, 28, 1, true, -1.9, 3.8).translate(0, 0.2, 0));
    for (const t of [-1.75, -0.95, 0, 0.9, 1.7]) { const [x, z] = [Math.sin(t) * 1.53, Math.cos(t) * 1.53]; W.push(at(cyl(0.14, 0.15, 0.55, 10), x, 0.27, z)); Rf.push(at(cone(0.17, 0.22, 10), x, 0.65, z)); }
    // 坡上的房子
    const r = mulberry32(21);
    for (const [y, n, span] of [[0.42, 9, 3.6], [0.82, 7, 3.2], [1.2, 5, 2.6]] as [number, number, number][]) for (let i = 0; i < n; i++) {
      const t = -span / 2 + (span * (i + 0.5)) / n + (r.next() - 0.5) * 0.12, rr = rAt(y) - 0.04, x = Math.sin(t) * rr, z = Math.cos(t) * rr, h = 0.2 + r.next() * 0.08;
      W.push(at(cube(0.24, h, 0.2), x, y + h / 2 - 0.04, z, t)); Rf.push(at(cone(0.19, 0.16, 4), x, y + h + 0.04, z, t + PI / 4));
    }
    // 修道院：北侧的「奇迹楼」、教堂、方塔与尖顶
    W.push(at(box(0.9, 0.72, 0.4, 0.03), 0.05, 1.72, -0.5), at(box(0.36, 0.5, 1.0, 0.03), 0, 2.05, -0.05), at(box(0.3, 0.44, 0.3, 0.03), 0, 2.52, -0.05));
    Rf.push(at(prism(0.42, 0.3, 1.02), 0, 2.3, -0.05), at(hip(0.94, 0.44, 0.22, 0.22), 0.05, 2.08, -0.5), at(cone(0.19, 1.15, 8), 0, 3.3, -0.05));
    bake(g, W, sm); bake(g, Rf, lm);
    add(g, cyl(0.02, 0.03, 0.12, 6), goldM(), 0, 3.93, -0.05); add(g, ball(0.035), goldM(), 0, 4.02, -0.05);
    return done(g, 2.2);
  },
  /** 凡尔赛宫：大理石庭院一侧的红砖石宫殿（灰蓝斜屋顶描金），两翼层层向前，前面一道金色的王家栅栏 */
  eu_versailles: () => {
    const g = new THREE.Group(), cream: RGB = [242, 232, 212], brick: RGB = [206, 138, 116], slate: RGB = [100, 112, 132], cob: RGB = [214, 206, 190];
    const bm = texMat("vband", brick, cream, 5, 1, 0.85), cm = mat(cream, 0.85), rm = mat(slate, 0.55), gm = goldM();
    add(g, box(4.2, 0.05, 3.6, 0.02), mat(cob, 0.95), 0, 0.025, 0.2);
    const block = (x: number, z: number, w: number, d: number, h: number, m: THREE.Material, gold = true) => {
      add(g, box(w, h, d, 0.03), m, x, h / 2 + 0.05, z); add(g, hip(w + 0.05, d + 0.05, 0.36, Math.min(w, d) * 0.36), rm, x, h + 0.05, z);
      if (gold) add(g, box(w > d ? w * 0.3 : 0.05, 0.04, w > d ? 0.05 : d * 0.3, 0.01), gm, x, h + 0.42, z);
    };
    block(0, -1.25, 1.3, 0.56, 1.05, bm);
    for (const s of [-1, 1]) { block(s * 0.9, -0.55, 0.5, 1.5, 1.0, bm); block(s * 1.72, 0.1, 0.62, 2.1, 0.9, cm, false); }
    add(g, box(0.5, 0.08, 0.2, 0.02), gm, 0, 0.75, -0.93);
    const D: G[] = [];
    for (let i = 0; i < 4; i++) D.push(at(box(0.14, 0.16, 0.12, 0.02), -0.45 + i * 0.3, 1.36, -1.12));
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) D.push(at(box(0.12, 0.14, 0.14, 0.02), s * 1.57, 1.22, -0.7 + i * 0.4));
    bake(g, D, cm);
    // 王家栅栏：一排金色栏杆，中间一段高、顶上王冠
    const Gd: G[] = [];
    for (let i = 0; i <= 30; i++) { const x = -1.35 + i * 0.09, h = Math.abs(x) < 0.32 ? 0.78 : 0.5; Gd.push(at(cube(0.025, h, 0.025), x, 0.05 + h / 2, 1.4)); }
    Gd.push(at(cube(2.72, 0.04, 0.04), 0, 0.53, 1.4), at(cube(2.72, 0.03, 0.04), 0, 0.12, 1.4), at(cube(0.66, 0.05, 0.05), 0, 0.84, 1.4));
    Gd.push(at(ball(0.07), 0, 0.95, 1.4), at(new THREE.TorusGeometry(0.1, 0.02, 6, 12, PI), 0, 0.84, 1.4));
    for (const s of [-1, 1]) Gd.push(at(new THREE.TorusGeometry(0.16, 0.018, 6, 12, PI / 2), s * 0.16, 0.66, 1.4, 0, 0, s > 0 ? 0 : PI / 2));
    bake(g, Gd, gm);
    for (const s of [-1, 1]) { add(g, box(0.16, 0.7, 0.16, 0.03), cm, s * 1.43, 0.4, 1.4); add(g, ball(0.08), gm, s * 1.43, 0.82, 1.4); }
    return done(g, 2.1);
  },
  // ---------- 英国
  /** 大本钟（伊丽莎白塔）：金黄石塔身、四面大钟、钟楼上陡峭的灰蓝尖顶，脚下连着威斯敏斯特宫 */
  eu_big_ben: () => {
    const g = new THREE.Group(), st: RGB = [220, 196, 146], sh: RGB = [196, 170, 122], slate: RGB = [84, 100, 118], face: RGB = [246, 240, 224];
    const pm = texMat("vband", st, sh, 4, 1, 0.8), sm = mat(st, 0.8), lm = mat(slate, 0.55), gm = goldM();
    const tx = -0.6, tz = 0;
    add(g, box(0.74, 2.9, 0.74, 0.03), pm, tx, 1.45, tz);
    add(g, box(0.9, 0.84, 0.9, 0.04), sm, tx, 3.32, tz);
    add(g, box(0.8, 0.5, 0.8, 0.03), sm, tx, 3.99, tz);
    add(g, pyramid(0.88, 1.0), lm, tx, 4.74, tz);
    add(g, cyl(0.015, 0.03, 0.26, 6), gm, tx, 5.36, tz);
    const F: G[] = [], R: G[] = [], H: G[] = [];
    for (let k = 0; k < 4; k++) {
      const ry = (k * PI) / 2, nx = Math.sin(ry), nz = Math.cos(ry), px = tx + nx * 0.455, pz = tz + nz * 0.455;
      F.push(at(cyl(0.33, 0.33, 0.03, 24).rotateX(PI / 2), px, 3.32, pz, ry));
      R.push(at(new THREE.TorusGeometry(0.335, 0.03, 6, 24), px, 3.32, pz, ry));
      for (const [len, ang] of [[0.2, -1.0], [0.28, 1.05]] as P2[]) H.push(at(cube(0.035, len, 0.02).translate(0, len / 2, 0), px + nx * 0.02, 3.32, pz + nz * 0.02, ry, 0, -ang));
      for (const u of [-0.17, 0.17]) H.push(at(archInset(0.14, 0.34, true, 0.02), tx + nx * 0.405 + Math.cos(ry) * u, 3.8, tz + nz * 0.405 - Math.sin(ry) * u, ry));
      for (const u of [-1, 1]) R.push(at(cone(0.05, 0.3, 4), tx + nx * 0.38 + Math.cos(ry) * u * 0.38, 4.36, tz + nz * 0.38 - Math.sin(ry) * u * 0.38, PI / 4));
    }
    bake(g, F, mat(face, 0.5)); bake(g, R, gm); bake(g, H, lm);
    // 威斯敏斯特宫：一长条哥特宫殿，屋脊一排小尖塔，中央八角尖塔
    add(g, box(2.5, 1.05, 0.9, 0.03), pm, 1.0, 0.525, -0.1);
    add(g, hip(2.5, 0.9, 0.38, 0.45), lm, 1.0, 1.05, -0.1);
    const P: G[] = [];
    for (let i = 0; i < 12; i++) for (const z of [-0.55, 0.35]) P.push(at(cone(0.035, 0.34, 4), -0.1 + i * 0.21, 1.2, z));
    P.push(at(prismN(0.17, 0.55, 8), 1.0, 1.55, -0.1));
    bake(g, P, sm);
    add(g, cone(0.19, 0.75, 8), lm, 1.0, 2.2, -0.1);
    const W: G[] = [];
    for (let i = 0; i < 11; i++) for (const y of [0.3, 0.72]) W.push(at(archInset(0.08, 0.24, true, 0.02), -0.05 + i * 0.21, y - 0.12, 0.36));
    bake(g, W, mat(sh, 0.8));
    return done(g, 1.6);
  },
  /** 伦敦塔桥：河中两座哥特石塔（四角小尖塔、灰蓝尖顶），高处两道蓝白人行天桥，中间的开合桥面会抬起，两侧悬索 */
  eu_tower_bridge: () => {
    const g = new THREE.Group(), st: RGB = [226, 214, 190], slate: RGB = [98, 110, 128], blue: RGB = [128, 170, 208], wh: RGB = [244, 244, 240];
    const sm = mat(st, 0.8), lm = mat(slate, 0.55), bm = mat(blue, 0.5), wm = mat(wh, 0.5);
    add(g, box(5.0, 0.05, 2.2, 0.02), waterM([108, 168, 196]), 0, 0.025, 0);
    const S: G[] = [], L: G[] = [], B: G[] = [], Wt: G[] = [];
    for (const s of [-1, 1]) {
      const x = s * 0.82;
      S.push(at(box(0.84, 0.5, 1.0, 0.1), x, 0.25, 0), at(box(0.6, 2.35, 0.68, 0.03), x, 0.5 + 1.175, 0));
      for (const [cx, cz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { S.push(at(prismN(0.09, 2.42, 8), x + cx * 0.3, 0.5 + 1.21, cz * 0.34)); L.push(at(cone(0.11, 0.38, 8), x + cx * 0.3, 2.92 + 0.19, cz * 0.34)); }
      L.push(at(pyramid(0.66, 0.72), x, 2.85 + 0.36, 0));
      for (const y of [1.0, 1.55, 2.1]) for (const u of [-0.12, 0.12]) L.push(at(archInset(0.1, 0.3, true, 0.02), x + u, y, 0.345));
      // 岸边的小塔与悬索跨
      const xs = s * 2.3;
      S.push(at(box(0.36, 1.05, 0.72, 0.04), xs, 0.525, 0)); L.push(at(pyramid(0.4, 0.4), xs, 1.25, 0));
      B.push(at(box(1.08, 0.08, 0.64, 0.02), s * 1.66, 0.64, 0));
      for (const z of [-0.3, 0.3]) {
        const c = new THREE.QuadraticBezierCurve3(V3(s * 1.12, 2.3, z), V3(s * 1.72, 0.2, z), V3(s * 2.12, 1.1, z));
        B.push(new THREE.TubeGeometry(c, 16, 0.04, 6, false));
        for (let i = 1; i < 5; i++) { const p = c.getPoint(i / 5); Wt.push(at(cube(0.02, p.y - 0.66, 0.02), p.x, (p.y + 0.66) / 2, z)); }
      }
    }
    // 高处的人行天桥（蓝底白格）
    for (const z of [-0.24, 0.24]) { B.push(at(box(1.04, 0.24, 0.12, 0.03), 0, 2.4, z)); Wt.push(at(cube(1.04, 0.03, 0.14), 0, 2.53, z), at(cube(1.04, 0.03, 0.14), 0, 2.27, z)); }
    bake(g, S, sm); bake(g, L, lm); bake(g, B, bm); bake(g, Wt, wm);
    // 开合桥面
    const leaves: THREE.Group[] = [];
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.52, 0.64, 0); g.add(p); add(p, box(0.52, 0.08, 0.62, 0.02), bm, -s * 0.26, 0, 0); leaves.push(p); }
    return done(g, 2.4, (t) => { const k = Math.max(0, Math.sin(t * 0.35)); const a = 1.05 * k * k; leaves[0].rotation.z = a; leaves[1].rotation.z = -a; });
  },
  /** 伦敦眼：泰晤士河边的白色大摩天轮，外圈挂着蛋形玻璃舱，一侧 A 字斜撑；慢慢转 */
  eu_london_eye: () => {
    const g = new THREE.Group(), wh: RGB = [240, 242, 246], glass: RGB = [150, 200, 232], st: RGB = [196, 190, 182];
    const wm = mat(wh, 0.45);
    add(g, box(4.9, 0.05, 1.2, 0.02), waterM(), 0, 0.025, 1.55);
    add(g, box(4.9, 0.16, 0.36, 0.04), mat(st, 0.9), 0, 0.08, 0.8);
    const R = 2.0, hy = 2.36, hz = -0.25;
    const wheel = new THREE.Group(); wheel.position.set(0, hy, hz); g.add(wheel);
    const rim: G[] = [new THREE.TorusGeometry(R, 0.075, 8, 56), new THREE.TorusGeometry(R - 0.17, 0.04, 6, 56), at(cyl(0.14, 0.14, 0.5, 16), 0, 0, 0, 0, PI / 2)];
    for (let i = 0; i < 20; i++) { const a = (i / 20) * PI * 2; rim.push(beam(V3(0, 0, 0), V3(Math.cos(a) * (R - 0.15), Math.sin(a) * (R - 0.15), 0), 0.026, 0.026, true)); }
    for (let i = 0; i < 40; i++) { const a = (i / 40) * PI * 2, b = ((i + 1) / 40) * PI * 2; rim.push(beam(V3(Math.cos(a) * R, Math.sin(a) * R, 0), V3(Math.cos(b) * (R - 0.17), Math.sin(b) * (R - 0.17), 0), 0.02, 0.02, true)); }
    bake(wheel, rim, wm);
    const pods: G[] = [];
    for (let i = 0; i < 28; i++) { const a = (i / 28) * PI * 2; pods.push(at(new THREE.SphereGeometry(0.1, 12, 8), Math.cos(a) * (R + 0.1), Math.sin(a) * (R + 0.1), 0, 0, 0, 0, [1, 1, 2.1])); }
    bake(wheel, pods, mat(glass, 0.15, { metalness: 0.1 }));
    const A: G[] = [];
    for (const s of [-1, 1]) A.push(beam(V3(0.06, hy, hz + s * 0.24), V3(1.45, 0.05, hz + s * 0.95), 0.13, 0.13, true));
    A.push(beam(V3(0.95, 0.85, hz - 0.72), V3(0.95, 0.85, hz + 0.72), 0.07, 0.07, true));
    A.push(at(box(0.9, 0.2, 0.7, 0.05), 0, 0.12, hz));
    bake(g, A, wm);
    return done(g, 2.2, (t) => { wheel.rotation.z = -t * 0.06; });
  },
  /** 巨石阵：草地上一圈立石架着横梁（缺了几块），里面五组更高的三石塔排成马蹄形，外面一块踵石 */
  eu_stonehenge: () => {
    const g = new THREE.Group(), sar: RGB = [170, 168, 156], blu: RGB = [130, 134, 142], grass: RGB = [150, 184, 132];
    add(g, cyl(2.3, 2.36, 0.08, 36), mat(grass, 0.95), 0, 0.04, 0);
    const r = mulberry32(3), S: G[] = [], B: G[] = [], y0 = 0.08, N = 18, Ro = 1.45;
    const gone = new Set([4, 5, 11, 14]), lintel = new Set([0, 1, 2, 7, 8, 9, 15, 16, 17]);
    for (let i = 0; i < N; i++) {
      if (gone.has(i)) continue; const a = (i / N) * PI * 2, h = 0.84 + r.next() * 0.1;
      S.push(at(rbox(0.3, h, 0.2, 0.05), Ro * Math.sin(a), y0 + h / 2, Ro * Math.cos(a), a, 0, (r.next() - 0.5) * 0.08));
      if (lintel.has(i) && !gone.has((i + 1) % N)) { const b = ((i + 0.5) / N) * PI * 2; S.push(at(rbox(2 * Ro * Math.sin(PI / N) + 0.26, 0.16, 0.22, 0.04), Ro * Math.sin(b), y0 + 0.98, Ro * Math.cos(b), b)); }
    }
    // 马蹄形的五组三石塔，开口朝东北（+z）；一组倒了
    for (const [a, h] of [[PI, 1.5], [PI - 0.8, 1.26], [PI + 0.8, 1.26], [PI - 1.55, 1.1], [PI + 1.55, 1.1]] as P2[]) {
      const rr = 0.78, cx = rr * Math.sin(a), cz = rr * Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
      if (Math.abs(a - (PI + 0.8)) < 0.01) { S.push(at(rbox(0.26, h, 0.22, 0.05), cx - tx * 0.16, y0 + h / 2 - 0.05, cz - tz * 0.16, a, 0, 0.28), at(rbox(0.66, 0.2, 0.24, 0.05), cx + tx * 0.2 + 0.25, y0 + 0.1, cz + tz * 0.2 + 0.1, a + 0.7)); continue; }
      for (const u of [-0.17, 0.17]) S.push(at(rbox(0.26, h, 0.22, 0.05), cx + tx * u, y0 + h / 2, cz + tz * u, a));
      S.push(at(rbox(0.66, 0.17, 0.24, 0.04), cx, y0 + h + 0.085, cz, a));
    }
    S.push(at(rbox(0.3, 0.72, 0.26, 0.08), 0.35, y0 + 0.33, 2.0, 0.4, 0.12, 0.1));
    S.push(at(rbox(0.3, 0.2, 0.84, 0.05), Ro * Math.sin(1.5), y0 + 0.1, Ro * Math.cos(1.5) + 0.2, 1.1));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2 + 0.1; if (i % 5 === 2) continue; B.push(at(rbox(0.13, 0.36, 0.1, 0.03), 1.12 * Math.sin(a), y0 + 0.18, 1.12 * Math.cos(a), a)); }
    for (let i = 0; i < 7; i++) { const a = PI + (i - 3) * 0.42; B.push(at(rbox(0.11, 0.42, 0.09, 0.03), 0.48 * Math.sin(a), y0 + 0.21, 0.48 * Math.cos(a), a)); }
    bake(g, S, mat(sar, 0.95)); bake(g, B, mat(blu, 0.9));
    return done(g, 2.3);
  },
  // ---------- 意大利
  /** 罗马斗兽场：椭圆形四层拱廊，外圈一侧残缺、露出内圈和一层层看台，场心的地下迷宫 */
  eu_colosseum: () => {
    const g = new THREE.Group(), tr: RGB = [226, 206, 172], tr2: RGB = [198, 176, 142], sand: RGB = [214, 192, 154], dk: RGB = [170, 148, 118];
    const a = 2.28, b = 1.8, N = 30, th = 0.44, attic = 0.34, T = 0.2, jr = mulberry32(8);
    add(g, cyl(1, 1, 0.06, 40), mat(tr2, 0.95), 0, 0.03, 0).scale.set(a + 0.2, 1, b + 0.2);
    const tc = 0.55, dist = (t: number) => { const d = Math.abs(((t - tc + PI * 3) % (PI * 2)) - PI); return d; };
    const outer: G[] = [], inner: G[] = [];
    const bay = (bw: number, k: number, broken: boolean): G => {
      const tiers = Math.min(k, 3), H = tiers * th + (k >= 4 ? attic : 0) + (broken ? 0.2 : 0);
      const s = new THREE.Shape(); s.moveTo(-bw / 2, 0); s.lineTo(bw / 2, 0);
      if (broken) { s.lineTo(bw / 2, H - jr.next() * 0.16); s.lineTo(0.08, H - jr.next() * 0.18); s.lineTo(-0.1, H - jr.next() * 0.1); s.lineTo(-bw / 2, H - jr.next() * 0.16); } else { s.lineTo(bw / 2, H); s.lineTo(-bw / 2, H); }
      s.closePath();
      for (let i = 0; i < tiers; i++) s.holes.push(archPath(0, i * th + 0.06, bw * 0.56, th * 0.74));
      if (k >= 4) s.holes.push(rectPath(0, 3 * th + attic * 0.4, bw * 0.2, attic * 0.26));
      return slab(s, T);
    };
    for (let i = 0; i < N; i++) {
      const t0 = (i / N) * PI * 2, t1 = ((i + 1) / N) * PI * 2, d = dist((t0 + t1) / 2);
      const k = d < 0.62 ? 0 : d < 0.86 ? 1 : d < 1.08 ? 2 : d < 1.3 ? 3 : 4;
      if (k) { const bw = arcLen(a, b, t0, t1); outer.push(bendArc(bay(bw, k, k < 4), a, b, t0, t1, bw)); }
      const ai = a - 0.34, bi = b - 0.34, bw2 = arcLen(ai, bi, t0, t1); inner.push(bendArc(bay(bw2, 2, false), ai, bi, t0, t1, bw2));
    }
    bake(g, outer, mat(tr, 0.85)); bake(g, inner, mat(tr2, 0.9));
    // 看台：一圈往里下的台阶
    const cav = add(g, lathe([[a - 1.12, 0.3], [a - 0.98, 0.3], [a - 0.98, 0.46], [a - 0.82, 0.46], [a - 0.82, 0.62], [a - 0.66, 0.62], [a - 0.66, 0.78], [a - 0.5, 0.78], [a - 0.5, 0.9], [a - 0.42, 0.92]], 40), mat(dk, 0.95));
    cav.scale.set(1, 1, (b - 0.34) / (a - 0.34));
    // 场心：沙地、露出来的地下隔墙、一端复原的木地板
    const ax = a - 1.12, bz = (b - 0.34) / (a - 0.34) * (a - 1.12);
    add(g, cyl(1, 1, 0.05, 32), mat(dk, 0.95), 0, 0.08, 0).scale.set(ax, 1, bz);
    const Hy: G[] = [];
    for (let i = 0; i < 7; i++) { const z = -bz * 0.72 + i * (bz * 1.44) / 6, len = 2 * ax * Math.sqrt(Math.max(0, 1 - (z / bz) ** 2)) * 0.9; Hy.push(at(cube(len, 0.18, 0.05), 0, 0.19, z)); }
    Hy.push(at(cube(0.05, 0.18, bz * 1.5), 0, 0.19, 0));
    bake(g, Hy, mat(tr2, 0.9));
    add(g, box(ax * 0.62, 0.05, bz * 1.3, 0.02), mat(sand, 0.9), -ax * 0.58, 0.3, 0);
    return done(g, 2.4);
  },
  /** 比萨斜塔：白色大理石圆塔，六层敞廊一圈圈白柱，顶上小钟楼；整座明显往一边歪 */
  eu_pisa: () => {
    const g = new THREE.Group(), mb: RGB = [244, 240, 230], sh: RGB = [176, 168, 154], grass: RGB = [140, 176, 130];
    add(g, cyl(1.5, 1.55, 0.06, 32), mat(grass, 0.95), 0, 0.03, 0);
    const t = new THREE.Group(); t.position.y = 0.1; t.rotation.z = -0.15; t.rotation.x = 0.04; g.add(t);
    const plain = mat(mb, 0.6), R = 0.56, cols: G[] = [], rings: G[] = [];
    let y = 0;
    rings.push(at(cyl(R + 0.06, R + 0.08, 0.14, 28), 0, 0.07, 0)); y = 0.14;
    add(t, cyl(R, R, 0.74, 28), texMat("arcade", mb, [218, 210, 196], 12, 1, 0.6), 0, y + 0.37, 0); y += 0.74;
    for (let i = 0; i < 6; i++) {
      rings.push(at(cyl(R + 0.08, R + 0.08, 0.07, 28), 0, y + 0.035, 0)); y += 0.07;
      for (let k = 0; k < 16; k++) { const a = (k / 16) * PI * 2; cols.push(at(cyl(0.028, 0.028, 0.42, 6), Math.sin(a) * (R + 0.04), y + 0.21, Math.cos(a) * (R + 0.04))); }
      y += 0.42;
    }
    add(t, cyl(R - 0.04, R - 0.04, 6 * 0.49, 28), texMat("arcade", mb, sh, 16, 6, 0.7), 0, 0.88 + (6 * 0.49) / 2, 0);
    rings.push(at(cyl(R + 0.08, R + 0.08, 0.07, 28), 0, y + 0.035, 0)); y += 0.07;
    add(t, cyl(0.36, 0.36, 0.42, 20), texMat("arcade", mb, sh, 8, 1, 0.6), 0, y + 0.21, 0); y += 0.42;
    rings.push(at(cyl(0.4, 0.4, 0.05, 20), 0, y + 0.025, 0), at(cyl(0.16, 0.24, 0.1, 16), 0, y + 0.1, 0));
    bake(t, cols, plain); bake(t, rings, plain);
    return done(g, 1.5);
  },
  /** 圣彼得大教堂：米开朗琪罗的大穹顶（肋线、采光亭），宽立面，前面贝尼尼的椭圆柱廊怀抱广场和方尖碑 */
  eu_st_peters: () => {
    const g = new THREE.Group(), tr: RGB = [234, 220, 192], domeC: RGB = [140, 158, 182], pave: RGB = [192, 188, 182];
    const tm = mat(tr, 0.8);
    add(g, box(4.4, 0.05, 4.4, 0.02), mat(pave, 0.95), 0, 0.025, 0.1);
    // 柱廊：两道弧形，屋顶一排雕像
    const ca = 1.45, cb = 1.02, cz = 0.95, C: G[] = [];
    for (const [t0, t1] of [[0.62, 2.55], [-2.55, -0.62]] as P2[]) {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const u0 = t0 + ((t1 - t0) * i) / n, u1 = t0 + ((t1 - t0) * (i + 1)) / n, bw = arcLen(ca, cb, u0, u1);
        const s = new THREE.Shape(); s.moveTo(-bw / 2, 0); s.lineTo(bw / 2, 0); s.lineTo(bw / 2, 0.5); s.lineTo(-bw / 2, 0.5); s.closePath();
        s.holes.push(rectPath(-bw / 4, 0.02, bw * 0.3, 0.36), rectPath(bw / 4, 0.02, bw * 0.3, 0.36));
        C.push(bendArc(slab(s, 0.3), ca, cb, u0, u1, bw).translate(0, 0.05, cz));
        const [px, pz] = ellP(ca, cb, (u0 + u1) / 2); C.push(at(cyl(0.025, 0.03, 0.1, 6), px, 0.6, pz + cz), at(bead(0.03), px, 0.68, pz + cz));
      }
    }
    C.push(at(cube(0.16, 0.12, 0.16), 0, 0.11, cz), at(cyl(0.035, 0.07, 0.95, 4).rotateY(PI / 4), 0, 0.64, cz), at(cone(0.04, 0.08, 4), 0, 1.15, cz, PI / 4));
    // 立面、中殿、耳堂、鼓座
    C.push(at(rbox(2.1, 1.0, 0.36, 0.03), 0, 0.55, -0.45), at(rbox(2.16, 0.1, 0.42, 0.02), 0, 1.1, -0.45), at(rbox(1.9, 0.2, 0.34, 0.02), 0, 1.25, -0.46));
    for (let i = 0; i < 13; i++) C.push(at(cyl(0.022, 0.028, 0.1, 6), -0.9 + i * 0.15, 1.4, -0.35), at(bead(0.026), -0.9 + i * 0.15, 1.47, -0.35));
    const dz = -1.45;
    C.push(at(rbox(1.1, 1.05, 1.4, 0.03), 0, 0.575, -1.2), at(rbox(2.1, 0.95, 0.7, 0.03), 0, 0.525, dz));
    C.push(at(cyl(0.7, 0.72, 0.5, 24), 0, 1.35, dz));
    for (let k = 0; k < 16; k++) { const a = (k / 16) * PI * 2; C.push(at(cube(0.07, 0.5, 0.07), Math.sin(a) * 0.73, 1.35, dz + Math.cos(a) * 0.73, a)); }
    C.push(at(cyl(0.75, 0.75, 0.07, 24), 0, 1.635, dz));
    bake(g, C, tm);
    const pil: G[] = [];
    for (let i = 0; i < 8; i++) pil.push(at(cube(0.1, 0.9, 0.04), -0.84 + i * 0.24, 0.55, -0.26));
    for (let i = 0; i < 5; i++) pil.push(at(archInset(0.14, 0.32, false, 0.02), -0.48 + i * 0.24, 0.12, -0.255));
    bake(g, pil, mat(pave, 0.85));
    // 穹顶（带肋线的铅灰色，比半球高）与采光亭
    const DP: P2[] = [[0.62, 0], [0.61, 0.18], [0.57, 0.38], [0.48, 0.58], [0.34, 0.74], [0.18, 0.84], [0.1, 0.86]];
    add(g, lathe(DP, 32, 1.2, 1.22), texMat("vband", domeC, tr, 16, 1, 0.55), 0, 1.67, dz);
    add(g, cyl(0.14, 0.15, 0.3, 12), tm, 0, 2.83, dz);
    add(g, cone(0.15, 0.26, 12), mat(domeC, 0.55), 0, 3.11, dz);
    add(g, cyl(0.012, 0.012, 0.18, 6), goldM(), 0, 3.3, dz); add(g, box(0.09, 0.022, 0.022, 0.005), goldM(), 0, 3.33, dz);
    for (const s of [-1, 1]) { add(g, dome(0.22), mat(domeC, 0.55), s * 0.8, 1.0, dz); add(g, cyl(0.04, 0.05, 0.1, 8), tm, s * 0.8, 1.26, dz); }
    return done(g, 2.2);
  },
  /** 佛罗伦萨圣母百花大教堂：红砖八角大穹顶配白色肋线、白色采光亭；白绿粉彩色大理石的教堂和立面右前方的乔托钟楼 */
  eu_florence_duomo: () => {
    const g = new THREE.Group(), wm: RGB = [242, 238, 228], green: RGB = [96, 134, 112];
    const poly = texMat("grid", wm, green, 3, 2, 0.7), terra = mat(TERRA, 0.7), white = mat(wm, 0.7);
    // 中殿（朝前）与立面
    add(g, box(1.0, 1.0, 1.8, 0.03), texMat("grid", wm, green, 6, 2, 0.7), 0, 0.5, 0.1);
    add(g, prism(1.06, 0.34, 1.8), terra, 0, 1.0, 0.1);
    add(g, slab([[-0.62, 0], [0.62, 0], [0.62, 1.2], [0.2, 1.3], [0, 1.48], [-0.2, 1.3], [-0.62, 1.2]], 0.12), texMat("grid", wm, green, 4, 4, 0.7), 0, 0, 1.02);
    add(g, cyl(0.13, 0.13, 0.03, 16).rotateX(PI / 2), mat(green, 0.6), 0, 1.0, 1.09);
    // 八角鼓座、穹顶、三面半圆殿
    const zc = -1.05, ds = 1.16, yd = 1.6;
    add(g, prismN(0.95, 0.5, 8), poly, 0, 1.05, zc);
    add(g, prismN(0.92, 0.3, 8), poly, 0, 1.45, zc);
    const DP: P2[] = [[0.78, 0], [0.77, 0.2], [0.72, 0.42], [0.63, 0.63], [0.5, 0.82], [0.34, 0.97], [0.18, 1.05]];
    add(g, flat(lathe(DP, 8, ds, ds).rotateY(PI / 8)), terra, 0, yd, zc);
    const ribs: G[] = [], top = yd + 1.05 * ds;
    for (let k = 0; k < 8; k++) { const a = (k * PI) / 4 + PI / 8; for (let i = 0; i < DP.length - 1; i++) { const [r0, y0] = DP[i], [r1, y1] = DP[i + 1]; ribs.push(beam(V3(Math.sin(a) * (r0 * ds + 0.02), yd + y0 * ds, zc + Math.cos(a) * (r0 * ds + 0.02)), V3(Math.sin(a) * (r1 * ds + 0.02), yd + y1 * ds, zc + Math.cos(a) * (r1 * ds + 0.02)), 0.055, 0.055, true)); } }
    ribs.push(at(prismN(0.22, 0.08, 8), 0, top + 0.04, zc), at(prismN(0.15, 0.32, 8), 0, top + 0.24, zc), at(cone(0.13, 0.28, 8), 0, top + 0.54, zc));
    bake(g, ribs, white);
    add(g, ball(0.055), goldM(), 0, top + 0.72, zc);
    for (const [x, z, ry] of [[-1.05, zc, -PI / 2], [1.05, zc, PI / 2], [0, zc - 1.0, PI]] as [number, number, number][]) { add(g, prismN(0.36, 0.72, 8), poly, x, 0.36, z); add(g, dome(0.34, 8), terra, x, 0.72, z).rotation.y = ry + PI / 8; }
    // 乔托钟楼（立面右前方）
    add(g, box(0.46, 2.6, 0.46, 0.02), texMat("grid", wm, green, 2, 7, 0.7), 1.02, 1.3, 0.85);
    add(g, box(0.54, 0.12, 0.54, 0.02), white, 1.02, 2.66, 0.85);
    const Wn: G[] = [];
    for (const y of [1.9, 2.26]) Wn.push(at(archInset(0.1, 0.3, true, 0.02), 0.96, y, 1.085), at(archInset(0.1, 0.3, true, 0.02), 1.08, y, 1.085));
    bake(g, Wn, mat(green, 0.7));
    return done(g, 1.8);
  },
  /** 威尼斯里亚托桥：大运河上的白石单拱桥，桥上两排带拱廊的商铺、正中山墙拱门；桥下一条贡多拉 */
  eu_rialto: () => {
    const g = new THREE.Group(), st: RGB = [238, 232, 218], terra: RGB = [206, 120, 90], canal: RGB = [100, 170, 176], dk: RGB = [62, 62, 72], ochre: RGB = [232, 190, 140];
    const sm = mat(st, 0.8), tm = mat(terra, 0.7), dm = mat(dk, 0.6);
    add(g, box(2.7, 0.05, 4.6, 0.02), waterM(canal), 0, 0.025, 0);
    for (const s of [-1, 1]) add(g, box(1.2, 0.12, 4.6, 0.03), sm, s * 1.9, 0.06, 0);
    const deckY = (x: number) => { const t = (1 - x / 1.75) / 2; return 0.45 * ((1 - t) ** 2 + t * t) + 1.55 * 2 * t * (1 - t); };
    const s = new THREE.Shape(); s.moveTo(-1.75, 0); s.lineTo(-1.25, 0); s.quadraticCurveTo(0, 1.35, 1.25, 0); s.lineTo(1.75, 0); s.lineTo(1.75, 0.45); s.quadraticCurveTo(0, 1.55, -1.75, 0.45); s.closePath();
    add(g, slab(s, 1.1, 0.02), sm, 0, 0.05, 0);
    // 桥上商铺（顺着坡一级级升高）与正中拱门
    const Sh: G[] = [], Rf: G[] = [], Dk: G[] = [];
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = sx * (0.44 + i * 0.34), y = deckY(x) + 0.05, slope = Math.atan((deckY(x + 0.05) - deckY(x - 0.05)) / 0.1);
      Sh.push(at(box(0.36, 0.4, 0.62, 0.02), x, y + 0.14, 0)); Rf.push(at(box(0.38, 0.05, 0.74, 0.01), x, y + 0.36, 0, 0, 0, slope));
      for (const z of [-0.315, 0.315]) Dk.push(at(archInset(0.18, 0.26, false, 0.02), x, y - 0.02, z));
    }
    Sh.push(at(box(0.5, 0.66, 0.74, 0.03), 0, 1.33, 0), at(prism(0.6, 0.24, 0.78), 0, 1.66, 0));
    Rf.push(at(prism(0.66, 0.27, 0.6), 0, 1.66, 0));
    for (const z of [-0.375, 0.375]) Dk.push(at(archInset(0.26, 0.46, false, 0.02), 0, 1.02, z));
    bake(g, Sh, sm); bake(g, Rf, tm); bake(g, Dk, dm);
    // 两岸的宫殿
    const Pw: G[] = [], Pr: G[] = [];
    for (const [x, z, w, h, d] of [[-2.0, -1.55, 0.8, 0.95, 1.0], [2.0, -1.45, 0.8, 0.8, 1.1], [-2.08, 1.65, 0.66, 0.66, 0.8], [2.08, 1.6, 0.66, 0.72, 0.8]] as [number, number, number, number, number][]) {
      Pw.push(at(box(w, h, d, 0.03), x, 0.12 + h / 2, z)); Pr.push(at(hip(w + 0.06, d + 0.06, 0.24, 0.3), x, 0.12 + h, z));
      for (let i = 0; i < 3; i++) Dk.push(at(archInset(0.1, 0.22, false, 0.02), x - Math.sign(x) * (w / 2 + 0.005), 0.4 + i * 0.26, z, -Math.sign(x) * PI / 2));
    }
    bake(g, Pw, mat(ochre, 0.85)); bake(g, Pr, tm);
    // 贡多拉
    const gd = new THREE.Group(); gd.position.set(0.45, 0, 1.35); gd.rotation.y = 0.25; g.add(gd);
    add(gd, box(0.16, 0.07, 0.9, 0.03), dm, 0, 0.07, 0);
    add(gd, merged([beam(V3(0, 0.07, 0.42), V3(0, 0.22, 0.56), 0.05, 0.05), beam(V3(0, 0.07, -0.42), V3(0, 0.15, -0.52), 0.05, 0.05), beam(V3(0.06, 0.28, -0.34), V3(0.14, 0.02, -0.02), 0.018, 0.018, true)]), dm);
    add(gd, box(0.03, 0.1, 0.04, 0.01), sm, 0, 0.26, 0.58);
    add(gd, cyl(0.035, 0.045, 0.16, 8), sm, 0, 0.19, -0.34); add(gd, ball(0.032), mat(ochre, 0.8), 0, 0.3, -0.34); add(gd, cyl(0.055, 0.055, 0.012, 12), mat(ochre, 0.8), 0, 0.33, -0.34);
    return done(g, 2.2, (t) => { gd.position.y = Math.sin(t * 1.6) * 0.012; gd.rotation.z = Math.sin(t * 1.2) * 0.03; gd.position.z = 1.35 + Math.sin(t * 0.25) * 0.25; });
  },
  // ---------- 西班牙
  /** 圣家堂：一簇抛物线形的尖塔，正中最高的耶稣塔顶着白十字，前后两组立面钟楼顶着彩色马赛克尖，旁边还有塔吊 */
  eu_sagrada: () => {
    const g = new THREE.Group(), old: RGB = [192, 172, 144], pale: RGB = [228, 216, 194], red: RGB = [206, 98, 80];
    const SP: P2[] = [[1, 0], [0.99, 0.3], [0.94, 0.5], [0.82, 0.68], [0.64, 0.81], [0.44, 0.9], [0.24, 0.96], [0.08, 1.0], [0, 1.0]];
    const dk: RGB = [150, 134, 112], om = texMat("hband", old, dk, 1, 9, 0.85), pm = texMat("hband", pale, old, 1, 12, 0.8);
    const O: G[] = [], Pl: G[] = [], Rd: G[] = [], Gd: G[] = [], Wh: G[] = [];
    // 教堂身体与后殿
    O.push(at(box(1.5, 1.05, 2.0, 0.04), 0, 0.525, -0.1), at(new THREE.CylinderGeometry(0.72, 0.72, 1.05, 14, 1, false, PI / 2, PI), 0, 0.525, -1.1));
    O.push(at(prism(1.5, 0.45, 1.9), 0, 1.05, -0.1));
    // 立面钟楼（前：诞生立面；后：受难立面）
    for (const [z, hs, r, list, top] of [[0.8, [2.9, 3.35, 3.35, 2.9], 0.19, O, true], [-0.95, [2.7, 3.1, 3.1, 2.7], 0.17, Pl, false]] as [number, number[], number, G[], boolean][]) {
      [-0.72, -0.25, 0.25, 0.72].forEach((x, i) => {
        list.push(at(lathe(SP, 14, r, hs[i]), x, 0, z));
        if (top) Rd.push(at(cone(0.08, 0.28, 8), x, hs[i] + 0.12, z), at(ball(0.07), x, hs[i] + 0.3, z)); else Gd.push(at(ball(0.06), x, hs[i] + 0.04, z));
      });
    }
    add(g, box(1.3, 1.25, 0.26, 0.04), mat(old, 0.85), 0, 0.625, 0.95);
    add(g, merged([at(archInset(0.3, 0.72, true), 0, 0, 1.085), at(archInset(0.22, 0.56, true), -0.4, 0, 1.085), at(archInset(0.22, 0.56, true), 0.4, 0, 1.085)]), mat(dk, 0.9));
    // 中央：耶稣塔、四座福音塔、圣母塔
    Pl.push(at(lathe(SP, 18, 0.34, 4.9), 0, 0, -0.2));
    for (const [x, z] of [[-0.44, 0.2], [0.44, 0.2], [-0.44, -0.6], [0.44, -0.6]] as P2[]) { Pl.push(at(lathe(SP, 14, 0.22, 4.0), x, 0, z)); Gd.push(at(ball(0.07), x, 4.02, z)); }
    Pl.push(at(lathe(SP, 14, 0.25, 4.3), 0, 0, -0.95)); Gd.push(at(new THREE.IcosahedronGeometry(0.11, 0), 0, 4.33, -0.95));
    Wh.push(at(cube(0.08, 0.5, 0.08), 0, 5.12, -0.2), at(cube(0.38, 0.08, 0.08), 0, 5.2, -0.2), at(cube(0.08, 0.08, 0.38), 0, 5.2, -0.2));
    // 塔吊
    Gd.push(at(cube(0.09, 4.6, 0.09), 1.55, 2.3, -1.25), at(cube(2.1, 0.08, 0.08), 1.05, 4.62, -1.25), at(cube(0.12, 0.12, 0.12), 1.55, 4.45, -1.25), beam(V3(1.55, 4.95, -1.25), V3(0.1, 4.66, -1.25), 0.02, 0.02, true), beam(V3(1.55, 4.95, -1.25), V3(2.2, 4.66, -1.25), 0.02, 0.02, true), at(cube(0.04, 0.3, 0.04), 1.55, 4.8, -1.25));
    Wh.push(at(box(0.26, 0.14, 0.14, 0.02), 2.25, 4.55, -1.25));
    bake(g, O, om); bake(g, Pl, pm); bake(g, Rd, mat(red, 0.6)); bake(g, Gd, goldM()); bake(g, Wh, mat(pale, 0.4));
    return done(g, 1.9);
  },
  /** 阿尔罕布拉宫：长满树的山头上一圈赭红城墙和方塔（科马雷斯塔最高），柏树点点，背后是雪山 */
  eu_alhambra: () => {
    const g = new THREE.Group(), ochre: RGB = [206, 132, 100], hill: RGB = [140, 170, 118], cyp: RGB = [84, 124, 96], mtn: RGB = [156, 166, 188];
    const om = mat(ochre, 0.85);
    // 背后的内华达雪山
    for (const [x, z, r, h] of [[-1.3, -1.85, 1.0, 1.7], [0.5, -1.95, 1.15, 2.2], [1.65, -1.8, 0.75, 1.5]] as [number, number, number, number][]) {
      add(g, new THREE.ConeGeometry(r, h, 7), mat(mtn, 0.9), x, h / 2, z).scale.set(1, 1, 0.45);
      add(g, new THREE.ConeGeometry(r * 0.42, h * 0.42, 7), mat(WHITE, 0.7), x, h - h * 0.21 + 0.01, z).scale.set(1, 1, 0.47);
    }
    const hr: [number, number, number] = [2.45, 0.72, 1.45], hz = 0.25;
    add(g, dome(1, 24), mat(hill, 0.95), 0, 0, hz).scale.set(...hr);
    const hy = (x: number, z: number) => { const q = 1 - (x / hr[0]) ** 2 - ((z - hz) / hr[2]) ** 2; return q > 0 ? hr[1] * Math.sqrt(q) : 0; };
    const W: G[] = [];
    const loop: P2[] = [[-1.95, 0.35], [-1.45, -0.3], [-0.2, -0.5], [1.15, -0.35], [1.85, 0.15], [1.35, 0.72], [0.15, 0.85], [-1.2, 0.8]];
    for (let i = 0; i < loop.length; i++) {
      const [x0, z0] = loop[i], [x1, z1] = loop[(i + 1) % loop.length], y0 = hy(x0, z0), y1 = hy(x1, z1);
      W.push(beam(V3(x0, y0 + 0.06, z0), V3(x1, y1 + 0.06, z1), 0.1, 0.5));
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.14);
      for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u; W.push(at(cube(0.07, 0.08, 0.11), x, y0 + (y1 - y0) * u + 0.35, z, Math.atan2(x1 - x0, z1 - z0))); }
    }
    const tower = (x: number, z: number, w: number, h: number) => { const y = hy(x, z); W.push(at(box(w, h + 0.2, w, 0.02), x, y - 0.1 + (h + 0.2) / 2, z)); for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; W.push(at(cube(0.07, 0.09, 0.07), x + Math.sin(a) * w * 0.45, y + h + 0.14, z + Math.cos(a) * w * 0.45)); } };
    tower(-2.0, 0.35, 0.44, 0.9); tower(-1.45, -0.3, 0.34, 0.72); tower(-0.2, -0.5, 0.58, 1.3); tower(1.15, -0.35, 0.3, 0.7); tower(1.85, 0.15, 0.32, 0.66); tower(1.35, 0.72, 0.3, 0.62); tower(0.15, 0.85, 0.34, 0.6); tower(-1.2, 0.8, 0.3, 0.64);
    for (const [x, z, w, d, h] of [[0.4, 0.2, 0.9, 0.5, 0.42], [-0.6, 0.25, 0.6, 0.6, 0.36], [1.0, 0.25, 0.5, 0.5, 0.3]] as [number, number, number, number, number][]) W.push(at(box(w, h + 0.3, d, 0.03), x, hy(x, z) - 0.15 + (h + 0.3) / 2, z));
    bake(g, W, om);
    const Cy: G[] = [];
    for (const [x, z] of [[-2.2, 0.9], [-1.7, 1.25], [-0.8, 1.35], [0.2, 1.4], [0.9, 1.25], [1.7, 1.0], [2.2, 0.6], [-2.3, -0.2], [2.15, -0.35], [-0.5, 1.5], [1.3, 1.35]] as P2[]) Cy.push(at(cone(0.08, 0.55, 8), x, hy(x, z) + 0.26, z));
    bake(g, Cy, mat(cyp, 0.85));
    return done(g, 2.3);
  },
  // ---------- 德国
  /** 新天鹅堡：森林山崖上的白色城堡，高高的圆塔和一簇灰蓝尖锥顶，陡屋顶的主楼，门楼是淡红色 */
  eu_neuschwanstein: () => {
    const g = new THREE.Group(), wh: RGB = [244, 240, 232], roof: RGB = [100, 118, 150], rock: RGB = [158, 154, 144], forest: RGB = [110, 146, 110], gate: RGB = [214, 150, 124];
    const wm = mat(wh, 0.75), rm = mat(roof, 0.5);
    add(g, dome(1, 24), mat(forest, 0.95), 0, 0, 0).scale.set(2.3, 0.55, 1.6);
    add(g, flat(lathe([[1.3, 0], [1.26, 0.4], [1.14, 0.8], [1.02, 1.0], [0, 1.02]], 9)), mat(rock, 0.95), 0, 0, -0.1).scale.set(1.25, 1, 0.62);
    const y0 = 1.0, W: G[] = [], R: G[] = [], Wd: G[] = [];
    // 主楼（沿 x 的长条，陡屋顶）与山墙
    W.push(at(box(1.15, 1.55, 0.62, 0.03), 0.55, y0 + 0.775, -0.12)); R.push(at(hip(1.17, 0.64, 0.6, 0.32), 0.55, y0 + 1.55, -0.12));
    W.push(at(prism(0.62, 0.5, 0.2), 1.0, y0 + 1.55, 0.2));
    for (const [cx, cz] of [[-0.02, 0.18], [1.12, 0.18], [1.12, -0.42]] as P2[]) { W.push(at(cyl(0.08, 0.08, 0.5, 10), cx, y0 + 1.6, cz)); R.push(at(cone(0.1, 0.5, 10), cx, y0 + 2.1, cz)); }
    // 高圆塔（北楼梯塔）
    W.push(at(cyl(0.18, 0.19, 2.15, 16), -0.15, y0 + 1.075, -0.2), at(cyl(0.22, 0.22, 0.1, 16), -0.15, y0 + 2.2, -0.2));
    R.push(at(cone(0.22, 0.8, 16), -0.15, y0 + 2.65, -0.2));
    // 方塔、骑士楼、门楼
    W.push(at(box(0.34, 1.3, 0.34, 0.02), -0.48, y0 + 0.65, 0.02)); R.push(at(pyramid(0.42, 0.5), -0.48, y0 + 1.55, 0.02));
    W.push(at(box(0.5, 0.8, 0.46, 0.02), -0.88, y0 + 0.4, -0.12)); R.push(at(hip(0.52, 0.48, 0.3, 0.24), -0.88, y0 + 0.8, -0.12));
    for (const s of [-1, 1]) { W.push(at(cyl(0.07, 0.07, 0.3, 10), -0.88 + s * 0.24, y0 + 0.95, 0.1)); R.push(at(cone(0.09, 0.36, 10), -0.88 + s * 0.24, y0 + 1.28, 0.1)); }
    bake(g, W, wm); bake(g, R, rm);
    add(g, box(0.42, 0.66, 0.46, 0.03), mat(gate, 0.8), -1.3, y0 + 0.27, 0.02);
    add(g, hip(0.46, 0.5, 0.22, 0.25), rm, -1.3, y0 + 0.6, 0.02);
    for (const y of [0.45, 0.8, 1.15]) for (let i = 0; i < 4; i++) Wd.push(at(archInset(0.08, 0.18, false, 0.02), 0.18 + i * 0.25, y0 + y, 0.2));
    bake(g, Wd, rm);
    return done(g, 2.2);
  },
  /** 勃兰登堡门：砂岩门廊，前后各六根多立克柱隔出五条通道，厚檐口，顶上铜绿色的四马战车和胜利女神 */
  eu_brandenburg: () => {
    const g = new THREE.Group(), sand: RGB = [230, 212, 176], cu: RGB = [104, 164, 142], pave: RGB = [192, 188, 182];
    const sm = mat(sand, 0.85), S: G[] = [], Q: G[] = [];
    add(g, box(4.2, 0.05, 2.6, 0.02), mat(pave, 0.95), 0, 0.025, 0.2);
    S.push(at(box(3.0, 0.14, 1.1, 0.03), 0, 0.12, 0));
    const xs = [-1.3, -0.82, -0.3, 0.3, 0.82, 1.3];
    for (const x of xs) {
      for (const z of [-0.38, 0.38]) S.push(at(cyl(0.085, 0.1, 1.3, 12), x, 0.19 + 0.65, z), at(cube(0.22, 0.05, 0.22), x, 0.19 + 1.3, z));
      S.push(at(cube(Math.abs(x) > 1 ? 0.2 : 0.1, 1.3, 0.62), x, 0.19 + 0.65, 0));
    }
    S.push(at(box(2.9, 0.3, 1.0, 0.03), 0, 1.69, 0), at(box(3.0, 0.08, 1.08, 0.02), 0, 1.88, 0));
    S.push(at(box(2.5, 0.14, 0.9, 0.02), 0, 1.99, 0), at(box(1.3, 0.36, 0.8, 0.03), 0, 2.24, 0));
    for (const s of [-1, 1]) S.push(at(box(0.5, 0.95, 0.8, 0.03), s * 1.8, 0.5, 0), at(prism(0.56, 0.2, 0.86).rotateY(PI / 2), s * 1.8, 0.97, 0));
    const tri: G[] = [];
    for (let i = 0; i < 12; i++) tri.push(at(cube(0.06, 0.16, 0.03), -1.32 + i * 0.24, 1.72, 0.51));
    bake(g, S, sm); bake(g, tri, mat([204, 190, 162], 0.85));
    // 四马战车（面朝东，+z）
    const y = 2.42, sc = 1.35;
    for (let i = 0; i < 4; i++) {
      const x = (-0.36 + i * 0.24) * sc, z = 0.18 * sc;
      Q.push(at(box(0.09 * sc, 0.12 * sc, 0.26 * sc, 0.03), x, y + 0.2 * sc, z));
      Q.push(beam(V3(x, y + 0.24 * sc, z + 0.1 * sc), V3(x, y + 0.38 * sc, z + 0.2 * sc), 0.06 * sc, 0.07 * sc), at(box(0.06 * sc, 0.07 * sc, 0.13 * sc, 0.02), x, y + 0.4 * sc, z + 0.24 * sc));
      for (const [lx, lz, h] of [[-0.03, 0.1, 0.18], [0.03, 0.1, 0.18], [-0.03, -0.1, 0.16], [0.03, -0.1, 0.16]]) Q.push(at(cube(0.025 * sc, h * sc, 0.025 * sc), x + lx * sc, y + (0.14 - h / 2) * sc, z + lz * sc, 0, lz > 0 ? -0.5 : 0));
    }
    Q.push(at(box(0.3 * sc, 0.12 * sc, 0.14 * sc, 0.03), 0, y + 0.1 * sc, -0.06 * sc), at(cyl(0.05 * sc, 0.08 * sc, 0.3 * sc, 10), 0, y + 0.3 * sc, -0.08 * sc), at(ball(0.045 * sc), 0, y + 0.5 * sc, -0.08 * sc));
    Q.push(at(cube(0.02 * sc, 0.5 * sc, 0.02 * sc), 0.1 * sc, y + 0.5 * sc, -0.04 * sc), at(new THREE.TorusGeometry(0.05 * sc, 0.012 * sc, 6, 12), 0.1 * sc, y + 0.78 * sc, -0.04 * sc));
    for (const s of [-1, 1]) Q.push(at(box(0.12 * sc, 0.05 * sc, 0.02 * sc, 0.01), 0.1 * sc + s * 0.07 * sc, y + 0.84 * sc, -0.04 * sc, 0, 0, s * 0.3));
    bake(g, Q, mat(cu, 0.55, { metalness: 0.2 }));
    return done(g, 2.2);
  },
  /** 科隆大教堂：深灰石头的一对镂空尖塔高耸入云，塔身满是竖向尖券线，后面长长的中殿和尖塔林 */
  eu_cologne: () => {
    const g = new THREE.Group(), st: RGB = [152, 148, 144], sh: RGB = [112, 110, 112], slate: RGB = [96, 104, 118];
    const vm = texMat("vband", st, sh, 5, 3, 0.9), sm = mat(st, 0.9), lm = mat(slate, 0.55), dm = mat(sh, 0.9);
    const zf = 0.7, S: G[] = [], D: G[] = [];
    for (const s of [-1, 1]) {
      const x = s * 0.56;
      add(g, box(0.74, 2.7, 0.74, 0.03), vm, x, 1.35, zf);
      S.push(at(prismN(0.32, 0.62, 8), x, 3.01, zf));
      for (const [cx, cz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) S.push(at(prismN(0.06, 0.45, 6), x + cx * 0.33, 2.9, zf + cz * 0.33), at(cone(0.07, 0.5, 6), x + cx * 0.33, 3.37, zf + cz * 0.33));
      add(g, flat(new THREE.ConeGeometry(0.34, 2.0, 8).rotateY(PI / 8)), texMat("diamond", st, sh, 6, 5, 0.9), x, 4.32, zf);
      S.push(at(cube(0.05, 0.28, 0.05), x, 5.44, zf), at(cube(0.2, 0.05, 0.05), x, 5.46, zf), at(cube(0.05, 0.05, 0.2), x, 5.46, zf));
      for (const y of [0.9, 1.9]) D.push(at(archInset(0.16, 0.62, true, 0.02), x, y, zf + 0.375));
      D.push(at(archInset(0.18, 0.36, true, 0.02), x, 2.82, zf + 0.33));
    }
    S.push(at(box(0.44, 2.2, 0.66, 0.03), 0, 1.1, zf - 0.02), at(prism(0.46, 0.6, 0.66), 0, 2.2, zf - 0.02));
    D.push(at(archInset(0.26, 0.62, true, 0.02), 0, 0.05, zf + 0.315), at(archInset(0.24, 0.9, true, 0.02), 0, 0.95, zf + 0.315));
    // 中殿、耳堂、后殿
    S.push(at(box(1.2, 1.9, 2.0, 0.03), 0, 0.95, -0.7), at(box(2.2, 1.8, 0.56, 0.03), 0, 0.9, -0.8), at(new THREE.CylinderGeometry(0.6, 0.6, 1.9, 14, 1, false, PI / 2, PI), 0, 0.95, -1.7));
    for (const z of [0.05, -0.3, -1.35, -1.7]) for (const s of [-1, 1]) S.push(at(cube(0.1, 1.5, 0.14), s * 0.72, 0.75, z), at(cone(0.06, 0.42, 4), s * 0.72, 1.7, z, PI / 4));
    bake(g, S, sm); bake(g, D, dm);
    add(g, prism(1.26, 0.7, 2.0), lm, 0, 1.9, -0.7);
    add(g, prism(0.6, 0.66, 2.2).rotateY(PI / 2), lm, 0, 1.8, -0.8);
    add(g, new THREE.ConeGeometry(0.63, 0.7, 14, 1, false, PI / 2, PI), lm, 0, 2.25, -1.7);
    add(g, cone(0.08, 0.9, 8), lm, 0, 2.95, -0.8); add(g, ball(0.05), goldM(), 0, 3.42, -0.8);
    return done(g, 1.9);
  },
  // ---------- 希腊
  /** 雅典卫城帕特农神庙：高台石山上的多立克神庙，一圈白柱、两端三角山花，没有屋顶，长边中间缺了几根柱子 */
  eu_parthenon: () => {
    const g = new THREE.Group(), mb: RGB = [236, 226, 204], rock: RGB = [204, 184, 150], olive: RGB = [128, 152, 108], sh: RGB = [214, 200, 176];
    add(g, flat(lathe([[2.35, 0], [2.25, 0.3], [2.0, 0.62], [1.92, 0.7], [0, 0.72]], 12)), mat(rock, 0.95), 0, 0, 0).scale.set(1, 1, 0.66);
    const O: G[] = [];
    for (const [x, z, s] of [[-2.0, 0.55, 1], [-1.7, 0.95, 0.8], [1.95, 0.6, 0.9], [1.45, 1.1, 0.7], [-0.4, 1.42, 0.7], [0.6, 1.4, 0.8]] as [number, number, number][]) { const rr = Math.hypot(x, z / 0.66), y = rr > 2.25 ? 0.3 * (2.35 - rr) / 0.1 : 0.3 + (0.32 * (2.25 - rr)) / 0.25; O.push(at(bead(0.2 * s), x, Math.max(0.16 * s, y), z, 0, 0, 0, [1.2, 0.8, 1])); }
    bake(g, O, mat(olive, 0.9));
    const t = new THREE.Group(); t.position.set(0, 0.72, -0.15); t.rotation.y = -0.32; g.add(t);
    const M: G[] = [], L = 2.4, D = 1.1;
    for (let i = 0; i < 3; i++) M.push(at(rbox(L + 0.2 - i * 0.08, 0.07, D + 0.2 - i * 0.08, 0.02), 0, 0.035 + i * 0.07, 0));
    const yb = 0.21, ch = 0.74, nx = 12, nz = 6, gap = new Set([5, 6]);
    for (let i = 0; i < nx; i++) for (const s of [-1, 1]) { if (s > 0 && gap.has(i)) continue; M.push(at(flat(cyl(0.065, 0.078, ch, 10)), -L / 2 + 0.1 + (i * (L - 0.2)) / (nx - 1), yb + ch / 2, s * (D / 2 - 0.08))); }
    for (let j = 1; j < nz - 1; j++) for (const s of [-1, 1]) M.push(at(flat(cyl(0.065, 0.078, ch, 10)), s * (L / 2 - 0.1), yb + ch / 2, -D / 2 + 0.08 + (j * (D - 0.16)) / (nz - 1)));
    const ye = yb + ch;
    M.push(at(cube(L - 0.02, 0.2, 0.16), 0, ye + 0.1, -(D / 2 - 0.08)));
    M.push(at(cube(L * 0.36, 0.2, 0.16), -L * 0.32, ye + 0.1, D / 2 - 0.08), at(cube(L * 0.36, 0.2, 0.16), L * 0.32, ye + 0.1, D / 2 - 0.08));
    for (const s of [-1, 1]) { M.push(at(cube(0.16, 0.2, D - 0.02), s * (L / 2 - 0.1), ye + 0.1, 0)); M.push(at(prism(D, 0.3, 0.14).rotateY(PI / 2), s * (L / 2 - 0.1), ye + 0.2, 0)); }
    bake(t, M, mat(mb, 0.75));
    const C: G[] = [];
    C.push(at(cube(1.2, 0.34, 0.08), -0.2, yb + 0.17, -0.18), at(cube(0.08, 0.5, 0.5), 0.55, yb + 0.25, 0), at(cube(0.6, 0.2, 0.3), -0.3, yb + 0.1, 0.12));
    bake(t, C, mat(sh, 0.85));
    return done(g, 2.3);
  },
  /** 圣托里尼伊亚：火山崖顶一层层错落的白房子，正中三颗蓝顶的教堂和白钟楼，崖顶一座风车，脚下爱琴海 */
  eu_oia: () => {
    const g = new THREE.Group(), wh: RGB = [248, 248, 246], blue: RGB = [58, 108, 186], cliff: RGB = [146, 114, 104], sea: RGB = [92, 164, 206], ochre: RGB = [234, 192, 142];
    const wm = mat(wh, 0.7), bm = mat(blue, 0.4);
    add(g, box(4.9, 0.05, 1.6, 0.02), waterM(sea), 0, 0.025, 1.65);
    add(g, sideExtrude([[1.1, 0], [0.98, 0.3], [0.9, 0.62], [0.72, 0.84], [0.52, 0.9], [0.22, 1.08], [-0.25, 1.12], [-0.45, 1.3], [-0.85, 1.34], [-1.05, 1.52], [-2.2, 1.55], [-2.2, 0]], 4.8), mat(cliff, 0.95));
    const r = mulberry32(17), W: G[] = [], O: G[] = [], B: G[] = [];
    const rows: [number, number, [number, number][]][] = [[0.6, 0.9, [[0.75, 1.4]]], [0.02, 1.1, [[-0.75, 0.55]]], [-0.62, 1.32, []], [-1.28, 1.53, [[1.3, 2.3]]]];
    for (const [z, y, skip] of rows) {
      let x = -2.3 + r.next() * 0.2;
      while (x < 2.15) {
        const w = 0.28 + r.next() * 0.16, h = 0.2 + r.next() * 0.16, d = 0.36 + r.next() * 0.1, cx = x + w / 2, zz = z + (r.next() - 0.5) * 0.12;
        if (!skip.some(([a, b]) => cx > a && cx < b) && r.next() > 0.12) {
          (r.next() < 0.16 ? O : W).push(at(rbox(w, h, d, 0.07), cx, y + h / 2 - 0.02, zz));
          if (r.next() < 0.35) W.push(at(new THREE.CylinderGeometry(d / 2 - 0.02, d / 2 - 0.02, w * 0.8, 12, 1, false, -PI / 2, PI).rotateZ(PI / 2), cx, y + h - 0.03, zz));
          if (r.next() < 0.6) B.push(at(cube(0.07, 0.11, 0.02), cx + (r.next() - 0.5) * w * 0.4, y + 0.08, zz + d / 2 + 0.004));
        }
        x += w + 0.03 + r.next() * 0.1;
      }
    }
    // 蓝顶教堂（一大两小）与白钟楼
    const church = (x: number, y: number, z: number, s: number) => {
      W.push(at(rbox(0.58 * s, 0.4 * s, 0.52 * s, 0.05), x, y + 0.2 * s, z), at(cyl(0.25 * s, 0.25 * s, 0.12 * s, 18), x, y + 0.46 * s, z));
      B.push(at(dome(0.28 * s, 18), x, y + 0.52 * s, z, 0, 0, 0, [1, 1.12, 1]));
      W.push(at(cube(0.025, 0.16 * s, 0.025), x, y + 0.9 * s, z), at(cube(0.1 * s, 0.025, 0.025), x, y + 0.92 * s, z));
    };
    church(-0.15, 1.1, 0.05, 1.15); church(-0.62, 1.1, -0.12, 0.75); church(1.08, 0.9, 0.6, 0.8);
    W.push(at(rbox(0.24, 0.78, 0.22, 0.03), 0.38, 1.1 + 0.39, 0.12), at(cyl(0.1, 0.12, 0.08, 12), 0.38, 1.92, 0.12));
    B.push(at(dome(0.11, 12), 0.38, 1.96, 0.12), at(archInset(0.1, 0.18, false, 0.02), 0.38, 1.58, 0.235));
    // 风车
    W.push(at(cyl(0.2, 0.24, 0.62, 14), 1.8, 1.53 + 0.31, -1.25));
    O.push(at(cone(0.26, 0.32, 14), 1.8, 2.31, -1.25));
    const sails = new THREE.Group(); sails.position.set(1.8, 2.2, -0.98); g.add(sails);
    const SL: G[] = [];
    for (let k = 0; k < 6; k++) { const a = (k * PI) / 3; SL.push(at(cube(0.02, 0.56, 0.02).translate(0, 0.28, 0), 0, 0, 0, 0, 0, a), at(slab([[0, 0.1], [0.13, 0.18], [0, 0.54]], 0.01), 0, 0, 0.01, 0, 0, a)); }
    bake(g, W, wm); bake(g, O, mat(ochre, 0.8)); bake(g, B, bm); bake(sails, SL, wm);
    return done(g, 2.3, (t) => { sails.rotation.z = -t * 0.7; });
  },
  // ---------- 俄罗斯
  /** 莫斯科圣瓦西里大教堂：红砖座上九座礼拜堂，中央高高的帐篷顶，四周洋葱顶各有花色（螺旋、条纹、折线） */
  eu_st_basils: () => {
    const g = new THREE.Group(), brick: RGB = [196, 92, 76], cream: RGB = [240, 230, 204], green: RGB = [96, 160, 120], gold: RGB = GOLD, blue: RGB = [92, 132, 200];
    const bm = mat(brick, 0.8), band = texMat("hband", brick, cream, 1, 3, 0.8), gm = goldM();
    add(g, box(2.2, 0.42, 2.2, 0.05), texMat("arcade", brick, cream, 10, 1, 0.8), 0, 0.21, 0);
    // 中央帐篷顶
    add(g, prismN(0.44, 1.3, 8), texMat("arcade", brick, cream, 8, 3, 0.8), 0, 0.42 + 0.65, 0);
    add(g, flat(new THREE.ConeGeometry(0.46, 1.5, 8).rotateY(PI / 8)), texMat("diamond", cream, green, 4, 3, 0.7), 0, 1.72 + 0.75, 0);
    add(g, cyl(0.07, 0.08, 0.16, 10), gm, 0, 3.3, 0); add(g, onion(0.11, 0.24, 14), gm, 0, 3.36, 0);
    // 四座大礼拜堂、四座小礼拜堂
    const big: [number, number, THREE.Material][] = [
      [0, 0.82, texMat("spiral", green, gold, 5, 2, 0.5)], [-0.82, 0, texMat("spiral", brick, cream, 5, 2, 0.5)],
      [0.82, 0, texMat("zigzag", green, cream, 5, 3, 0.5)], [0, -0.82, texMat("spiral", blue, cream, 5, 2, 0.5)],
    ];
    const small: [number, number, THREE.Material][] = [
      [-0.62, 0.62, texMat("grid", gold, green, 4, 3, 0.5)], [0.62, 0.62, texMat("hband", blue, gold, 1, 4, 0.5)],
      [-0.62, -0.62, texMat("diamond", gold, brick, 4, 3, 0.5)], [0.62, -0.62, texMat("spiral", cream, green, 5, 2, 0.5)],
    ];
    const C: G[] = [];
    for (const [x, z, m] of big) { add(g, prismN(0.27, 1.0, 8), band, x, 0.42 + 0.5, z); add(g, cyl(0.16, 0.18, 0.2, 12), bm, x, 1.52, z); add(g, onion(0.34, 0.62), m, x, 1.6, z); C.push(at(cube(0.02, 0.2, 0.02), x, 2.32, z), at(cube(0.1, 0.02, 0.02), x, 2.35, z)); }
    for (const [x, z, m] of small) { add(g, prismN(0.17, 0.72, 8), band, x, 0.42 + 0.36, z); add(g, cyl(0.1, 0.12, 0.14, 12), bm, x, 1.2, z); add(g, onion(0.22, 0.42), m, x, 1.25, z); C.push(at(cube(0.02, 0.14, 0.02), x, 1.73, z)); }
    bake(g, C, gm);
    return done(g, 1.6);
  },
  // ---------- 捷克
  /** 布拉格查理大桥：伏尔塔瓦河上的多孔石拱桥，两侧栏杆立着一排黑色雕像，桥头是尖顶黑瓦的哥特桥塔 */
  eu_charles_bridge: () => {
    const g = new THREE.Group(), st: RGB = [202, 188, 166], dk: RGB = [78, 78, 88], river: RGB = [110, 170, 200];
    const sm = mat(st, 0.9), dm = mat(dk, 0.7);
    add(g, box(5.0, 0.05, 2.4, 0.02), waterM(river), 0, 0.025, 0);
    add(g, arcade(3.9, 0.72, 0.5, [-1.44, -0.72, 0, 0.72, 1.44].map((x) => [x, 0.54, 0.26] as [number, number, number])), sm, 0.1, 0, 0);
    const S: G[] = [], K: G[] = [];
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) S.push(at(cone(0.13, 0.3, 4), -0.98 + i * 0.72, 0.2, s * 0.3, PI / 4, (s * PI) / 2));
    for (const s of [-1, 1]) S.push(at(rbox(3.9, 0.1, 0.06, 0.02), 0.1, 0.76, s * 0.25));
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { const x = -1.35 + i * 0.4 + (s > 0 ? 0.2 : 0); K.push(at(cube(0.1, 0.08, 0.1), x, 0.85, s * 0.25), at(cyl(0.035, 0.05, 0.2, 8), x, 0.99, s * 0.25), at(bead(0.035), x, 1.12, s * 0.25)); }
    // 老城桥塔
    S.push(at(rbox(0.6, 1.75, 0.66, 0.03), -2.05, 0.875, 0));
    K.push(at(pyramid(0.72, 1.05), -2.05, 1.75 + 0.52, 0));
    for (const [cx, cz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) K.push(at(cone(0.06, 0.4, 6), -2.05 + cx * 0.3, 1.95, cz * 0.33));
    K.push(at(archInset(0.34, 0.62, true, 0.02), -2.05, 0.1, 0.335));
    for (const u of [-0.14, 0.14]) K.push(at(archInset(0.1, 0.26, true, 0.02), -2.05 + u, 1.3, 0.335));
    // 小城桥塔
    S.push(at(rbox(0.44, 1.3, 0.5, 0.03), 2.2, 0.65, 0)); K.push(at(pyramid(0.52, 0.72), 2.2, 1.3 + 0.36, 0), at(archInset(0.24, 0.44, true, 0.02), 2.2, 0.1, 0.255));
    bake(g, S, sm); bake(g, K, dm);
    return done(g, 2.4);
  },
  // ---------- 荷兰
  /** 小孩堤防风车：运河边一溜茅草风车，四片格子帆慢慢转 */
  eu_kinderdijk: () => {
    const g = new THREE.Group(), thatch: RGB = [132, 122, 108], sail: RGB = [236, 228, 210], wood: RGB = [110, 84, 70];
    add(g, box(4.9, 0.05, 4.2, 0.02), mat(GRASS, 0.95), 0, 0.025, 0);
    add(g, box(4.7, 0.04, 0.7, 0.02), waterM([104, 162, 190]), 0.05, 0.055, 0.85).rotation.y = 0.3;
    const sm = texMat("grid", sail, wood, 3, 7, 0.8), wm = mat(wood, 0.8);
    const s1 = windmill(g, -1.4, 0.05, 0.95, 0.2, thatch, sm, wm);
    const s2 = windmill(g, 0.25, -0.55, 0.88, 0.25, thatch, sm, wm);
    const s3 = windmill(g, 1.6, -1.15, 0.8, 0.3, thatch, sm, wm);
    return done(g, 2.4, (t) => { s1.rotation.z = -t * 0.9; s2.rotation.z = -t * 0.8 + 0.6; s3.rotation.z = -t * 0.85 + 1.2; });
  },
  // ---------- 匈牙利
  /** 布达佩斯国会大厦：多瑙河边长长的白色新哥特立面、红屋顶、成排小尖塔，正中带肋线的尖穹顶和高尖塔 */
  eu_parliament_budapest: () => {
    const g = new THREE.Group(), wh: RGB = [242, 236, 222], red: RGB = [190, 90, 76], gray: RGB = [176, 170, 164];
    const fm = texMat("arcade", wh, gray, 24, 2, 0.8), wm = mat(wh, 0.8), rm = mat(red, 0.6);
    add(g, box(5.0, 0.05, 1.3, 0.02), waterM([106, 164, 196]), 0, 0.025, 1.6);
    add(g, box(4.7, 0.9, 1.0, 0.03), fm, 0, 0.45, 0);
    add(g, hip(4.7, 1.0, 0.42, 0.5), rm, 0, 0.9, 0);
    const P: G[] = [], R: G[] = [];
    for (const x of [-2.05, -1.2, 1.2, 2.05]) { P.push(at(box(0.44, 1.2, 1.04, 0.03), x, 0.6, 0.02)); R.push(at(hip(0.46, 1.06, 0.55, 0.23), x, 1.2, 0.02)); for (const [cx, cz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) R.push(at(cone(0.04, 0.4, 6), x + cx * 0.22, 1.4, 0.02 + cz * 0.5)); }
    P.push(at(box(1.1, 1.25, 1.05, 0.03), 0, 0.625, 0));
    for (let i = 0; i < 20; i++) { const x = -2.2 + i * 0.23; if (Math.abs(x) < 0.6) continue; P.push(at(cone(0.03, 0.26, 4), x, 1.0, 0.5)); }
    for (const s of [-1, 1]) { P.push(at(box(0.2, 1.9, 0.2, 0.02), s * 0.75, 0.95, -0.35)); R.push(at(pyramid(0.24, 0.6), s * 0.75, 2.2, -0.35)); }
    bake(g, P, wm); bake(g, R, rm);
    const zc = 0;
    add(g, cyl(0.5, 0.5, 0.45, 16), texMat("arcade", wh, gray, 16, 1, 0.8), 0, 1.47, zc);
    add(g, flat(lathe([[0.52, 0], [0.5, 0.22], [0.44, 0.44], [0.32, 0.64], [0.17, 0.78], [0.08, 0.84]], 16)), texMat("vband", red, wh, 16, 1, 0.6), 0, 1.7, zc);
    add(g, cyl(0.09, 0.1, 0.22, 10), wm, 0, 2.62, zc);
    add(g, cone(0.08, 0.9, 8), rm, 0, 3.18, zc);
    add(g, ball(0.03), goldM(), 0, 3.65, zc);
    return done(g, 2.4);
  },
  // ---------- 瑞士
  /** 马特洪峰：孤零零一座陡峭的四棱角锥，下半宽、上半收成一颗尖牙，峰顶略往一侧勾；陡壁是深色岩石，缓一点的坡上挂雪；山下草坡、利菲尔湖和木屋 */
  eu_matterhorn: () => {
    const g = new THREE.Group(), rock: RGB = [112, 108, 118], snow: RGB = [246, 248, 252], grass: RGB = [140, 176, 130], wood: RGB = [150, 104, 76];
    const hr: [number, number, number] = [2.4, 0.35, 1.9], hz = 0.2;
    add(g, dome(1, 24), mat(grass, 0.95), 0, 0, hz).scale.set(...hr);
    const hy = (x: number, z: number) => { const q = 1 - (x / hr[0]) ** 2 - ((z - hz) / hr[2]) ** 2; return q > 0 ? hr[1] * Math.sqrt(q) : 0; };
    // 四棱锥：截面是方的（f 把圆压成方），半径随高度先快后慢地收，顶上往 +x 勾
    const seg = 40, q = new THREE.ConeGeometry(1, 1, seg, 16, true), p = q.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) + 0.5, phi = Math.atan2(p.getX(i), p.getZ(i));
      let a = (phi - PI / 4) % (PI / 2); if (a < 0) a += PI / 2; const f = Math.cos(PI / 4) / Math.cos(a - PI / 4), u = 1 - t;
      const rr = 1.55 * f * (0.3 * Math.pow(u, 2) + 0.7 * u), hook = 0.36 * Math.pow(t, 3.5) + Math.max(0, t - 0.88) * 0.7;
      p.setXYZ(i, Math.sin(phi) * rr + hook, t * 4.3, Math.cos(phi) * rr - 0.2 * t * t);
    }
    const mt = flat(q), pos = mt.attributes.position as THREE.BufferAttribute, col = new Float32Array(pos.count * 3), jr = mulberry32(4);
    const cr = new THREE.Color().setRGB(rock[0] / 255, rock[1] / 255, rock[2] / 255, THREE.SRGBColorSpace), cs = new THREE.Color().setRGB(snow[0] / 255, snow[1] / 255, snow[2] / 255, THREE.SRGBColorSpace);
    // 雪：缓坡上挂满，陡壁上只在一道道冲沟里（按列随机取一段高度），峰顶一点冰
    const gully = Array.from({ length: seg / 2 }, () => { const h0 = 0.12 + jr.next() * 0.35; return jr.next() < 0.5 ? [h0, h0 + 0.12 + jr.next() * 0.35] : [2, 2]; });
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      A.fromBufferAttribute(pos, i); B.fromBufferAttribute(pos, i + 1); Cc.fromBufferAttribute(pos, i + 2);
      const n = B.clone().sub(A).cross(Cc.clone().sub(A)).normalize(), h = (A.y + B.y + Cc.y) / 3 / 4.3;
      const j = Math.floor((((Math.atan2(A.x + B.x + Cc.x, A.z + B.z + Cc.z) + PI * 2) % (PI * 2)) / (PI * 2)) * seg) % seg, [h0, h1] = gully[j >> 1];
      const white = n.y > 0.42 || (h > h0 && h < h1) || h > 0.93;
      const c = white ? cs : cr; for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    mt.setAttribute("color", new THREE.BufferAttribute(col, 3));
    add(g, mt, mat(0xffffff, 0.85, { vertexColors: true }), 0, 0, -0.45).rotation.y = -0.5;
    const lx = -0.95, lz = 1.3;
    water(g, 0.46, lx, lz, hy(lx, lz) + 0.01, [110, 176, 214], 1.35, 0.7);
    const Wd: G[] = [], Rf: G[] = [];
    for (const [x, z, s] of [[1.1, 1.25, 1], [1.62, 0.85, 0.8]] as [number, number, number][]) { const y = hy(x, z) - 0.04; Wd.push(at(rbox(0.4 * s, 0.3 * s, 0.34 * s, 0.03), x, y + 0.15 * s, z)); Rf.push(at(prism(0.5 * s, 0.2 * s, 0.4 * s).rotateY(PI / 2), x, y + 0.3 * s, z)); }
    bake(g, Wd, mat(wood, 0.85)); bake(g, Rf, mat(rock, 0.8));
    return done(g, 2.4);
  },
  // ---------- 土耳其
  /** 伊斯坦布尔蓝色清真寺：大穹顶下层层叠叠的半穹顶和小穹顶，六根铅笔一样细的宣礼塔，前面带小穹顶回廊的庭院 */
  eu_blue_mosque: () => {
    const g = new THREE.Group(), st: RGB = [236, 230, 218], lead: RGB = [132, 150, 180], win: RGB = [150, 144, 140];
    const sm = mat(st, 0.8), lm = mat(lead, 0.5), gm = goldM();
    add(g, box(3.2, 0.05, 4.2, 0.02), mat([222, 214, 200], 0.95), 0, 0.025, 0.2);
    const zc = -0.62, S: G[] = [], L: G[] = [], Gd: G[] = [];
    add(g, box(1.9, 0.6, 1.9, 0.04), texMat("arcade", st, win, 7, 2, 0.8), 0, 0.3, zc);
    S.push(at(box(1.06, 0.4, 1.06, 0.03), 0, 0.8, zc));
    for (let k = 0; k < 4; k++) {
      const ry = (k * PI) / 2, nx = Math.sin(ry), nz = Math.cos(ry);
      L.push(at(new THREE.SphereGeometry(0.46, 18, 8, 0, PI, 0, PI / 2), nx * 0.53, 0.94, zc + nz * 0.53, ry));
      for (const u of [-0.5, 0.5]) L.push(at(dome(0.2, 12), nx * 0.82 + Math.cos(ry) * u, 0.6, zc + nz * 0.82 - Math.sin(ry) * u));
      S.push(at(cyl(0.07, 0.08, 0.5, 10), (nx + Math.cos(ry)) * 0.52, 1.1, zc + (nz - Math.sin(ry)) * 0.52));
      L.push(at(cone(0.09, 0.2, 10), (nx + Math.cos(ry)) * 0.52, 1.45, zc + (nz - Math.sin(ry)) * 0.52));
    }
    S.push(at(cyl(0.56, 0.58, 0.22, 24), 0, 1.11, zc));
    add(g, dome(0.6, 24), lm, 0, 1.22, zc).scale.set(1, 0.85, 1);
    Gd.push(at(cyl(0.015, 0.02, 0.18, 6), 0, 1.8, zc), at(new THREE.TorusGeometry(0.05, 0.012, 6, 12, PI * 1.4), 0, 1.93, zc));
    // 庭院回廊
    const cz0 = 0.4, cz1 = 1.95;
    for (const [x, z, w, d] of [[-0.9, (cz0 + cz1) / 2, 0.24, cz1 - cz0], [0.9, (cz0 + cz1) / 2, 0.24, cz1 - cz0], [0, cz1, 2.04, 0.24]] as [number, number, number, number][]) S.push(at(box(w, 0.32, d, 0.03), x, 0.16, z));
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) L.push(at(dome(0.1, 10), s * 0.9, 0.32, cz0 + 0.15 + i * 0.3));
    for (let i = 0; i < 6; i++) L.push(at(dome(0.1, 10), -0.75 + i * 0.3, 0.32, cz1));
    S.push(at(prismN(0.14, 0.16, 8), 0, 0.08, (cz0 + cz1) / 2)); L.push(at(dome(0.12, 10), 0, 0.16, (cz0 + cz1) / 2));
    // 六根宣礼塔（主殿四角三层阳台，庭院两角两层）
    for (const [x, z, n] of [[-1.12, zc - 1.0, 3], [1.12, zc - 1.0, 3], [-1.12, zc + 1.0, 3], [1.12, zc + 1.0, 3], [-1.12, cz1 + 0.05, 2], [1.12, cz1 + 0.05, 2]] as [number, number, number][]) {
      const h = n === 3 ? 3.0 : 2.6;
      S.push(at(cyl(0.07, 0.085, h, 12), x, h / 2, z));
      for (let b = 0; b < n; b++) S.push(at(cyl(0.12, 0.09, 0.06, 12), x, h * (0.55 + b * 0.16), z));
      L.push(at(cone(0.085, 0.55, 12), x, h + 0.275, z)); Gd.push(at(cyl(0.01, 0.01, 0.14, 6), x, h + 0.6, z));
    }
    bake(g, S, sm); bake(g, L, lm); bake(g, Gd, gm);
    return done(g, 2.2);
  },
  // ---------- 另加两处
  /** 米兰大教堂：粉白大理石的哥特立面（三角形轮廓、六根扶壁尖塔），屋顶上密密的尖塔林，正中尖塔顶着金色圣母像 */
  eu_milan_duomo: () => {
    const g = new THREE.Group(), mb: RGB = [238, 222, 212], roof: RGB = [198, 182, 178], sh: RGB = [132, 122, 128], pave: RGB = [186, 182, 178];
    const mm = mat(mb, 0.75), M: G[] = [], D: G[] = [];
    add(g, box(4.0, 0.05, 4.0, 0.02), mat(pave, 0.95), 0, 0.025, 0.4);
    M.push(at(rbox(1.9, 1.25, 2.3, 0.03), 0, 0.625, -0.4));
    add(g, prism(1.9, 0.32, 2.3), mat(roof, 0.7), 0, 1.25, -0.4);
    M.push(at(slab([[-1.05, 0], [1.05, 0], [1.05, 1.3], [0, 1.95], [-1.05, 1.3]], 0.14), 0, 0, 0.82));
    for (const x of [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]) { const h = 1.3 + (1.05 - Math.abs(x)) * 0.62 + 0.1; M.push(at(rbox(0.1, h, 0.2, 0.02), x, h / 2, 0.92), at(cone(0.06, 0.55, 6), x, h + 0.27, 0.92), at(bead(0.03), x, h + 0.57, 0.92)); }
    for (let i = 0; i < 8; i++) for (const x of [-0.98, -0.52, 0.52, 0.98]) { const z = 0.55 - i * 0.3, h = Math.abs(x) > 0.7 ? 1.45 : 1.6; M.push(at(cube(0.07, 0.3, 0.07), x, h - 0.1, z), at(cone(0.045, 0.42, 6), x, h + 0.25, z)); }
    M.push(at(prismN(0.32, 0.5, 8), 0, 1.75, -0.7));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2 + PI / 8; M.push(at(cone(0.04, 0.4, 6), Math.sin(a) * 0.34, 2.18, -0.7 + Math.cos(a) * 0.34)); }
    M.push(at(cone(0.14, 1.3, 8), 0, 2.65, -0.7));
    bake(g, M, mm);
    for (const [x, w, h] of [[0, 0.3, 0.6], [-0.42, 0.22, 0.48], [0.42, 0.22, 0.48], [-0.8, 0.18, 0.42], [0.8, 0.18, 0.42]] as [number, number, number][]) D.push(at(slab([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + w * 0.4], [-w / 2, h]], 0.02), x, 0.02, 0.9));
    for (const x of [-0.42, 0, 0.42]) D.push(at(archInset(0.16, 0.5, true, 0.02), x, 0.8, 0.9));
    for (const x of [-0.8, 0.8]) D.push(at(archInset(0.12, 0.4, true, 0.02), x, 0.75, 0.9));
    D.push(at(cyl(0.1, 0.1, 0.02, 16).rotateX(PI / 2), 0, 1.5, 0.9));
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) D.push(at(archInset(0.14, 0.6, true, 0.02), s * 0.955, 0.3, 0.5 - i * 0.34, (s * PI) / 2));
    bake(g, D, mat(sh, 0.8));
    add(g, cyl(0.025, 0.04, 0.14, 8), goldM(), 0, 3.37, -0.7); add(g, ball(0.035), goldM(), 0, 3.47, -0.7);
    return done(g, 2.0);
  },
  /** 哈尔施塔特：陡峭的森林山脚下，湖边一排彩色木屋，白教堂细长的尖塔立在水边 */
  eu_hallstatt: () => {
    const g = new THREE.Group(), lake: RGB = [100, 160, 190], forest: RGB = [92, 134, 102], wh: RGB = [246, 244, 238], ochre: RGB = [232, 196, 140], roof: RGB = [108, 86, 80];
    const wm = mat(wh, 0.8), om = mat(ochre, 0.8), rm = mat(roof, 0.7), fm = mat(forest, 0.95);
    add(g, box(4.9, 0.05, 2.3, 0.02), waterM(lake), 0, 0.025, 1.25);
    // 背后的山：两座陡峭的森林山 + 一道矮山坡，坡上一团团树
    const MT: P2[] = [[1, 0], [0.9, 0.2], [0.72, 0.45], [0.55, 0.68], [0.38, 0.86], [0.2, 0.97], [0, 1]];
    add(g, flat(lathe(MT, 12, 1.55, 3.1)), fm, -0.85, 0, -1.6).scale.set(1, 1, 0.6);
    add(g, flat(lathe(MT, 12, 1.3, 2.4)), fm, 1.25, 0, -1.65).scale.set(1, 1, 0.58);
    add(g, dome(1, 20), fm, 0, 0, -0.75).scale.set(2.45, 0.85, 0.72);
    const T: G[] = [], r = mulberry32(12);
    for (let i = 0; i < 16; i++) { const x = -2.2 + i * 0.29 + r.next() * 0.1, z = -1.0 - r.next() * 0.3, y = 0.85 * Math.sqrt(Math.max(0, 1 - (x / 2.45) ** 2 - ((z + 0.75) / 0.72) ** 2)); const s = 0.16 + r.next() * 0.06; if (y > 0.3) T.push(at(bead(s), x, y + 0.06, z, 0, 0, 0, [1, 1.3, 1])); }
    bake(g, T, fm);
    const W: G[] = [], O: G[] = [], R: G[] = [];
    // 湖边一排，后面一排高一些（坡上）
    let x = -2.3;
    while (x < 2.2) {
      const w = 0.3 + r.next() * 0.12, h = 0.5 + r.next() * 0.25, cx = x + w / 2;
      if (cx < 0.15 || cx > 0.8) { (r.next() < 0.45 ? O : W).push(at(rbox(w, h, 0.4, 0.03), cx, h / 2, -0.05)); R.push(at(hip(w + 0.06, 0.46, 0.26, 0.2), cx, h, -0.05)); }
      x += w + 0.03;
    }
    for (let i = 0; i < 7; i++) { const xx = -2.05 + i * 0.66 + r.next() * 0.15; if (Math.abs(xx + 1.3) < 0.3 || Math.abs(xx - 0.5) < 0.25) continue; const h = 0.85 + r.next() * 0.2, w = 0.34; (i % 2 ? O : W).push(at(rbox(w, h, 0.34, 0.03), xx, h / 2, -0.45)); R.push(at(hip(w + 0.06, 0.4, 0.22, 0.2), xx, h, -0.45)); }
    // 湖边的新教教堂：白塔 + 细长尖顶
    W.push(at(rbox(0.36, 0.55, 0.56, 0.03), 0.48, 0.275, -0.1), at(rbox(0.24, 1.2, 0.24, 0.02), 0.48, 0.6, 0.28));
    R.push(at(prism(0.4, 0.26, 0.58), 0.48, 0.55, -0.1), at(pyramid(0.26, 1.15), 0.48, 1.2 + 0.575, 0.28));
    // 坡上的天主教堂
    W.push(at(rbox(0.34, 0.9, 0.5, 0.03), -1.3, 0.45, -0.6), at(rbox(0.2, 1.3, 0.2, 0.02), -1.3, 0.65, -0.28));
    R.push(at(prism(0.38, 0.22, 0.52), -1.3, 0.9, -0.6), at(cone(0.14, 0.6, 8), -1.3, 1.6, -0.28));
    bake(g, W, wm); bake(g, O, om); bake(g, R, rm);
    return done(g, 2.4);
  },
};
