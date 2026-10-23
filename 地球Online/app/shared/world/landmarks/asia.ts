/** 名胜模型：亚洲。积木见 ../landmark-kit.ts；每个模型返回 { group, top, footprint, update? }。
 *  约定：原点在地面中心，+y 向上，正面朝 +z；抓住外形特征并夸张 1.2～1.4 倍，细节从简；每个模型不超过 5 种颜色；
 *  重复的小零件（垛口、兵俑、鸟居、小佛塔、窗）合并成一个网格，每个模型不超过 100 个网格。
 *  本文件自带几样亚洲建筑常用的件：飞檐屋顶（方 / 八角 / 圆）、鸟居、尖拱、层叠塔身（莲苞 / 玉米穗）、覆钵小塔、雪顶山。 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../../algo/prng.ts";
import { type Maker, type RGB, type Landmark, C, mat, add, box, cyl, cone, ball, prism, water } from "../landmark-kit.ts";
import { MORE_ASIA } from "./asia-more.ts";

type G = THREE.BufferGeometry;
type P2 = [number, number];
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DS = { side: THREE.DoubleSide };

// ---------- 调色（真实色往世界的柔和色板上靠）
const MARBLE: RGB = [238, 234, 224], STONE: RGB = [214, 200, 178], WATER: RGB = [110, 180, 214], GRASS: RGB = [140, 176, 130];
const RED: RGB = [200, 78, 62], VERM: RGB = [222, 100, 70], GOLD: RGB = [228, 184, 92], INK: RGB = [72, 66, 70], TEAL: RGB = [96, 150, 146];
const WHITE: RGB = [248, 248, 246];
const goldM = () => mat(GOLD, 0.34, { metalness: 0.3 });
const roofM = (c: RGB, rough = 0.55) => mat(c, rough, DS);
const waterM = (c: RGB = WATER) => mat(c, 0.1, { metalness: 0.05, transparent: true, opacity: 0.92 });

// ---------- 几何小工具
const _o = new THREE.Object3D(); _o.rotation.order = "YXZ";
/** 把几何体摆到位（先绕 z、再绕 x、最后绕 y 转），给合并用 */
function at<T extends G>(q: T, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s: number | [number, number, number] = 1): T {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz, "YXZ"); if (Array.isArray(s)) _o.scale.set(s[0], s[1], s[2]); else _o.scale.setScalar(s);
  _o.updateMatrix(); q.applyMatrix4(_o.matrix); return q;
}
/** 小零件用的直角盒（顶点少；合并成一个网格时用它，圆角盒留给大件） */
const cube = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** 两点之间的一根梁：宽 w（左右）、厚 t（上下），round 时是圆杆 */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, t = w, round = false): G {
  const len = a.distanceTo(b); const q: G = round ? cyl(w / 2, w / 2, len, 8).rotateX(Math.PI / 2) : w + t > 0.2 ? box(w, t, len, Math.min(w, t) * 0.3) : cube(w, t, len);
  _o.position.copy(a).add(b).multiplyScalar(0.5); _o.scale.setScalar(1); _o.lookAt(b); _o.updateMatrix(); return q.applyMatrix4(_o.matrix);
}
function merged(list: G[]): G { const out = mergeGeometries(list.map((q) => (q.index ? q.toNonIndexed() : q)), false); if (!out) throw new Error("mergeGeometries failed"); return out; }
/** 一组同色零件合成一个网格 */
function bake(g: THREE.Group, list: G[], m: THREE.Material): THREE.Mesh | null { return list.length ? add(g, merged(list), m) : null; }
/** 平面着色（方台、八角塔身要棱角分明） */
function flat(q: G): G { const n = q.index ? q.toNonIndexed() : q; n.computeVertexNormals(); return n; }
const lathe = (pts: P2[], seg = 16, sr = 1, sy = 1) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r * sr, y * sy)), seg);
/** 半球（山包、穹顶） */
const dome = (r = 1, seg = 20) => new THREE.SphereGeometry(r, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2);
/** 方台 / 收分墙：下口宽 wb、深 db，高 h，上口按 taper 收 */
const frustum = (wb: number, db: number, h: number, taper = 0.9) => flat(new THREE.CylinderGeometry(taper, 1, h, 4, 1).rotateY(Math.PI / 4).scale(wb / 2 / Math.SQRT1_2, 1, db / 2 / Math.SQRT1_2));
/** 正多边形柱（八角塔身），平面着色，边对齐 */
const prismN = (r: number, h: number, n: number) => flat(new THREE.CylinderGeometry(r, r, h, n).rotateY(Math.PI / n));

interface RoofOpt { sides?: 0 | 4 | 8; lift?: number; top?: number; th?: number; pow?: number }
/** 飞檐屋顶：车削后压成方 / 八角 / 圆；坡面内凹，翼角上翘（lift，绝对高度），檐口有厚度 th。
 *  w、d 为檐口的宽和深（方形按边，八角按对边，圆按直径）；方形 w > d 时拉出正脊（庑殿），w = d 为攒尖；top > 0 时顶上留口（下一层塔身盖住）。原点在檐口高度 */
function roofGeo(w: number, d: number, h: number, o: RoofOpt = {}): G {
  const n = o.sides ?? 4, lift = o.lift ?? 0.12, th = o.th ?? 0.05, pow = o.pow ?? 1.7;
  const top = o.top ?? (n === 4 && w > d + 1e-6 ? 0.04 : 0);
  const pts = [V2(Math.max(top, 0.55), 0), V2(0.97, -th), V2(1, 0)];
  for (let i = 1; i <= 6; i++) { const t = i / 6; pts.push(V2(1 - t * (1 - top), h * Math.pow(t, pow))); }
  const seg = n === 0 ? 24 : 16, cosH = n ? Math.cos(Math.PI / n) : 1;
  const q = new THREE.LatheGeometry(pts, seg, n ? Math.PI / n : 0); const p = q.attributes.position as THREE.BufferAttribute;
  const R = (n === 4 ? d : w) / 2 / cosH, stretch = n === 4 ? Math.max(0, (w - d) / 2) : 0, sector = n ? (Math.PI * 2) / n : 1;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x, z); let f = 1, c = 0;
    if (n && r > 1e-6) { let a = (Math.atan2(x, z) - Math.PI / n) % sector; if (a < 0) a += sector; f = cosH / Math.cos(a - Math.PI / n); c = (f - cosH) / (1 - cosH); }
    const k = Math.max(0, (r - 0.55) / 0.45); y += lift * c * c * k * k;
    x *= f * R; z *= f * R; if (stretch && Math.abs(x) > 1e-6) x += Math.sign(x) * stretch;
    p.setXYZ(i, x, y, z);
  }
  q.computeVertexNormals(); return q;
}
/** 鸟居的笠木：两端上翘的横梁 */
function kasagi(len: number, th: number, dep: number, rise: number): G {
  const s = new THREE.Shape(), n = 8, yb = (u: number) => rise * Math.pow(Math.abs(u), 2.4);
  for (let i = 0; i <= n; i++) { const u = -1 + (2 * i) / n; if (i) s.lineTo((u * len) / 2, yb(u)); else s.moveTo((u * len) / 2, yb(u)); }
  for (let i = n; i >= 0; i--) { const u = -1 + (2 * i) / n; s.lineTo((u * len) / 2, yb(u) + th * (1 + 0.4 * Math.abs(u))); }
  const q = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 1 }); q.translate(0, 0, -dep / 2); return q;
}
/** 鸟居：朱红的柱、贯、岛木、额束放进 red，黑色的笠木和柱脚放进 dark；(x, y, z) 为两柱中点的地面，ry 为朝向 */
function torii(red: G[], dark: G[], x: number, y: number, z: number, h: number, w: number, ry = 0) {
  const pr = h * 0.055, parts: [G, boolean][] = [];
  for (const s of [-1, 1]) { parts.push([cyl(pr * 0.85, pr, h, 10).translate((s * w) / 2, h / 2, 0), false]); parts.push([cyl(pr * 1.3, pr * 1.3, h * 0.1, 10).translate((s * w) / 2, h * 0.05, 0), true]); }
  parts.push([cube(w * 1.28, h * 0.08, pr * 1.5).translate(0, h * 0.72, 0), false]);
  parts.push([cube(pr * 1.3, h * 0.16, pr * 1.2).translate(0, h * 0.81, 0), false]);
  parts.push([cube(w * 1.32, h * 0.07, pr * 2.1).translate(0, h * 0.9, 0), false]);
  parts.push([kasagi(w * 1.58, h * 0.085, pr * 2.5, h * 0.1).translate(0, h * 0.935, 0), true]);
  const m = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), ry), V3(1, 1, 1));
  for (const [q, dk] of parts) (dk ? dark : red).push(q.applyMatrix4(m));
}
/** 拱门洞（半圆拱或尖拱），挤出一点厚度贴在立面上；原点在洞底中心 */
function archGeo(w: number, h: number, dep: number, pointed = false): G {
  const s = new THREE.Shape(), r = w / 2, hs = h - (pointed ? w * 0.8 : r);
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, hs);
  if (pointed) { s.quadraticCurveTo(r, hs + w * 0.5, 0, h); s.quadraticCurveTo(-r, hs + w * 0.5, -r, hs); } else s.absarc(0, hs, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  const q = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: false, curveSegments: 8 }); q.translate(0, 0, -dep / 2); return q;
}
/** 层叠塔身（吴哥的莲苞塔、郑王庙的主塔）：一层一层往里收，中段略鼓，顶上收成尖 */
function budGeo(r: number, h: number, steps: number, seg: number, bulge = 0.15, tip = 0.06, p1 = 2.2, p2 = 0.55, inset = 0.93): G {
  const w = (t: number) => r * (1 + bulge * Math.sin(Math.PI * Math.min(1, t * 1.6))) * Math.pow(Math.max(0, 1 - Math.pow(t, p1)), p2);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < steps; i++) { const t0 = i / steps, t1 = (i + 1) / steps; pts.push(V2(w(t0), t0 * h), V2(w(t0) * inset, t1 * h)); }
  pts.push(V2(0, h * (1 + tip))); return new THREE.LatheGeometry(pts, seg);
}
/** 覆钵小塔（婆罗浮屠的钟形佛塔），r 为钟身半径 */
const BELL: P2[] = [[0.82, 0], [1, 0.1], [1, 0.4], [0.9, 0.74], [0.64, 1.0], [0.32, 1.12], [0.24, 1.14], [0.22, 1.3], [0.13, 1.36], [0.08, 1.62], [0, 1.72]];
const bell = (r: number, seg = 12) => lathe(BELL, seg, r, r);
/** 雪顶山：多段圆锥压成 sides 边的金字塔，顶点可偏；雪顶是上面 cap 比例的一截，下沿锯齿 */
function alp(r: number, h: number, sides: number, lean: number, cap: number, jag: number): [G, G] {
  const seg = sides * 4, sector = (Math.PI * 2) / sides;
  const shape = (q: G, grow: number, drop: boolean) => {
    const p = q.attributes.position as THREE.BufferAttribute; let ymin = Infinity; for (let i = 0; i < p.count; i++) ymin = Math.min(ymin, p.getY(i));
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i); const phi = Math.atan2(p.getX(i), p.getZ(i));
      if (drop && Math.abs(y - ymin) < 1e-4) { const j = Math.round(((phi + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / seg)) % seg; y -= j % 2 ? 0 : jag * (0.6 + (0.4 * ((j * 5) % 3)) / 2); }
      let a = (phi - Math.PI / sides) % sector; if (a < 0) a += sector; const f = Math.cos(Math.PI / sides) / Math.cos(a - Math.PI / sides);
      const rr = (0.5 - y) * f * r * grow, yy = (y + 0.5) * h; p.setXYZ(i, Math.sin(phi) * rr + lean * (yy / h), yy, Math.cos(phi) * rr);
    }
    q.computeVertexNormals(); return q;
  };
  return [shape(new THREE.ConeGeometry(1, 1, seg, 4, true), 1, false), shape(new THREE.ConeGeometry(cap, cap, seg, 2, true).translate(0, 0.5 - cap / 2, 0), 1.03, true)];
}
/** 平摊在地上的一条带子（河、步道）：中线 pts（x, z），宽 w */
function ribbon(pts: P2[], w: number, y = 0.03, th = 0.04): G {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V3(x, 0, z))), n = 40, L: THREE.Vector2[] = [], Rt: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) { const p = c.getPoint(i / n), t = c.getTangent(i / n), nx = -t.z, nz = t.x; L.push(V2(p.x + (nx * w) / 2, -(p.z + (nz * w) / 2))); Rt.push(V2(p.x - (nx * w) / 2, -(p.z - (nz * w) / 2))); }
  const s = new THREE.Shape([...L, ...Rt.reverse()]);
  const q = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }); q.rotateX(-Math.PI / 2); q.translate(0, y - th / 2, 0); return q;
}
/** 条纹 / 格子 / 鸟巢钢网 / 水流虚线贴图（纯数据生成，Node 里也能跑）。
 *  nest：随机交织的粗钢条，条外透明（alphaTest），能透出里面；dash：沿 u 方向的虚线，挪 offset.x 就是水在流 */
const texCache = new Map<string, THREE.MeshStandardMaterial>();
function texMat(kind: "stripe" | "lattice" | "nest" | "dash", a: RGB, b: RGB, rx: number, ry: number, rough = 0.5, metal = 0): THREE.MeshStandardMaterial {
  const key = JSON.stringify([kind, a, b, rx, ry, rough, metal]); const hit = texCache.get(key); if (hit) return hit;
  const W = kind === "stripe" ? 1 : kind === "dash" ? 16 : kind === "nest" ? 64 : 16, H = kind === "stripe" ? 8 : kind === "dash" ? 1 : kind === "nest" ? 64 : 16, d = new Uint8Array(W * H * 4);
  const on = new Uint8Array(W * H);
  if (kind === "nest") {
    const r = mulberry32(8);
    for (let k = 0; k < 22; k++) {
      const x0 = r.next() * W, y0 = r.next() * H, ang = (r.next() < 0.5 ? 1 : -1) * (0.45 + r.next() * 0.7), len = 40 + r.next() * 50, dx = Math.cos(ang), dy = Math.sin(ang);
      for (let s = 0; s < len; s += 0.5) for (let o = -1.6; o <= 1.6; o += 0.8) { const x = Math.floor(x0 + dx * s - dy * o + W * 4) % W, y = Math.floor(y0 + dy * s + dx * o + H * 4) % H; on[y * W + x] = 1; }
    }
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const line = kind === "stripe" ? j < 2 : kind === "dash" ? i % 8 < 3 : kind === "nest" ? on[j * W + i] === 1 : (i + j) % 8 === 0 || (i - j + 16) % 8 === 0;
    const c = line ? b : a; d.set([c[0], c[1], c[2], kind === "nest" && !line ? 0 : 255], (j * W + i) * 4);
  }
  const t = new THREE.DataTexture(d, W, H); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rx, ry); t.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal, ...(kind === "nest" ? { alphaTest: 0.5, side: THREE.DoubleSide } : kind === "dash" ? { transparent: true, opacity: 0.88 } : {}) });
  texCache.set(key, m); return m;
}
/** 车削体按椭圆拉开，顶沿做成马鞍（±z 两侧高、±x 两端低）：鸟巢用 */
function saddle(q: G, RX: number, RZ: number, H: number, dip = 0.3): G {
  const p = q.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), c = Math.cos(Math.atan2(x, z)); p.setXYZ(i, x * RX, y * H * (1 - dip + dip * c * c), z * RZ); }
  q.computeVertexNormals(); return q;
}
/** 渐细的管子（鱼尾狮的尾巴、喷出的水柱）：沿曲线从 r0 收到 r1 */
function taperTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, seg = 20, rad = 10): G {
  const q = new THREE.TubeGeometry(curve, seg, 1, rad, false), p = q.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(i / seg), k = r0 + (r1 - r0) * (i / seg); for (let j = 0; j <= rad; j++) { const n = i * (rad + 1) + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c); p.setXYZ(n, v.x, v.y, v.z); } }
  q.computeVertexNormals(); return q;
}
const _b = new THREE.Box3();
/** 收尾：标签高度 = 最高点 + 0.2 */
function done(g: THREE.Group, footprint: number, update?: (t: number) => void): Landmark { _b.setFromObject(g); return { group: g, top: +(_b.max.y + 0.2).toFixed(2), footprint, update }; }
/** 松树（黄山、金阁寺的小岛）：弯干 + 两层压扁的针叶团；reach 给出一根横伸出去的枝（迎客松那只「手」） */
function pine(list: { trunk: G[]; leaf: G[] }, x: number, y: number, z: number, s: number, reach: [number, number] = [0, 0]) {
  const top = V3(x + reach[0] * 0.25 * s, y + 0.5 * s, z + reach[1] * 0.25 * s), pad = (p: THREE.Vector3, r: number, dy = 0) => list.leaf.push(at(ball(r * s), p.x, p.y + dy * s, p.z, 0, 0, 0, [1.3, 0.48, 1.1]));
  list.trunk.push(beam(V3(x, y - 0.05, z), top, 0.07 * s, 0.07 * s, true));
  if (reach[0] || reach[1]) { const end = V3(x + reach[0] * 0.8 * s, y + 0.42 * s, z + reach[1] * 0.8 * s); list.trunk.push(beam(top, end, 0.05 * s, 0.05 * s, true)); pad(end, 0.24, 0.05); pad(top.clone().lerp(end, 0.5), 0.18, 0.06); }
  pad(top, 0.3, 0.05); pad(top.clone().setX(top.x - 0.05 * s), 0.2, 0.2);
}

export const MODELS_ASIA: Record<string, Maker> = {
  ...MORE_ASIA,   // 补充的一批（D87，asia-more.ts）
  // ---------- 中国
  /** 长城（八达岭）：沿山脊起伏的城墙 + 垛口 + 敌楼 */
  as_great_wall: () => {
    const g = new THREE.Group(), brick: RGB = [210, 192, 160];
    const hills: [number, number, number, number, number][] = [[-1.55, 0.95, 0.85, 0.5, 0.8], [-0.8, -0.3, 1.2, 1.3, 1.05], [0.45, 0.3, 1.0, 0.75, 0.9], [1.55, -0.85, 1.05, 1.55, 0.95]];
    for (const [x, z, rx, h, rz] of hills) add(g, dome(1), mat(GRASS, 0.95), x, 0, z).scale.set(rx, h, rz);
    const ground = (x: number, z: number) => Math.max(0, ...hills.map(([hx, hz, rx, h, rz]) => { const q = 1 - ((x - hx) / rx) ** 2 - ((z - hz) / rz) ** 2; return q > 0 ? h * Math.sqrt(q) : 0; }));
    const curve = new THREE.CatmullRomCurve3(([[-2.15, 1.45], [-1.8, 0.9], [-1.25, 0.05], [-0.8, -0.3], [-0.25, -0.05], [0.35, 0.35], [0.95, 0.05], [1.55, -0.85], [2.0, -1.5]] as P2[]).map(([x, z]) => V3(x, 0, z)));
    const pts = curve.getSpacedPoints(28).map((p) => V3(p.x, ground(p.x, p.z) + 0.08, p.z));
    const wall: G[] = [], dark: G[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], d = b.clone().sub(a), n = V3(-d.z, 0, d.x).normalize();
      wall.push(beam(a.clone().setY(a.y - 0.05), b.clone().setY(b.y - 0.05), 0.3, 0.46));
      const k = Math.max(1, Math.round(a.distanceTo(b) / 0.13));
      for (let j = 0; j < k; j++) { const p = a.clone().lerp(b, (j + 0.5) / k); for (const s of [-1, 1]) wall.push(at(cube(0.07, 0.1, 0.07), p.x + n.x * s * 0.12, p.y + 0.23, p.z + n.z * s * 0.12)); }
    }
    for (const [tx, tz] of [[-0.8, -0.3], [1.55, -0.85], [-1.85, 0.9]]) {
      let best = pts[0]; for (const p of pts) if ((p.x - tx) ** 2 + (p.z - tz) ** 2 < (best.x - tx) ** 2 + (best.z - tz) ** 2) best = p;
      const i = pts.indexOf(best), dir = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]), ry = Math.atan2(dir.x, dir.z), cs = Math.cos(ry), sn = Math.sin(ry);
      const P = (lx: number, ly: number, lz: number, q: G) => at(q, best.x + lx * cs + lz * sn, best.y + ly, best.z - lx * sn + lz * cs, ry);
      wall.push(P(0, 0.16, 0, box(0.54, 0.66, 0.54, 0.05)));
      for (let j = 0; j < 12; j++) { const side = Math.floor(j / 3), u = ((j % 3) - 1) * 0.17; const [lx, lz] = side === 0 ? [u, 0.24] : side === 1 ? [u, -0.24] : side === 2 ? [0.24, u] : [-0.24, u]; wall.push(P(lx, 0.53, lz, cube(0.08, 0.11, 0.08))); }
      for (const s of [-1, 1]) for (const u of [-0.12, 0.12]) dark.push(P(s * 0.27, 0.2, u, cube(0.03, 0.17, 0.09)));
    }
    bake(g, wall, mat(brick, 0.85)); bake(g, dark, mat([104, 90, 80], 0.9));
    return done(g, 2.4);
  },
  /** 故宫太和殿：三层汉白玉台基、朱红殿身、重檐庑殿黄琉璃顶 */
  as_forbidden_city: () => {
    const g = new THREE.Group(), yel: RGB = [230, 154, 34], z0 = -0.1;
    // 三层汉白玉须弥座，每层边上一圈栏杆（望柱 + 扶手合成一个网格）
    const MB: G[] = [];
    for (let i = 0; i < 3; i++) {
      const w = 3.7 - i * 0.34, d = 2.5 - i * 0.3, y = 0.18 + i * 0.18;
      MB.push(at(box(w, 0.18, d, 0.04), 0, y - 0.09, z0));
      for (const [len, x, z, ry] of [[w, 0, d / 2, 0], [w, 0, -d / 2, 0], [d, w / 2, 0, Math.PI / 2], [d, -w / 2, 0, Math.PI / 2]] as [number, number, number, number][]) {
        const segs = z > 0 ? [[-w / 2, -0.32], [0.32, w / 2]] : [[-len / 2, len / 2]];
        for (const [a, b] of segs) { MB.push(at(cube(b - a, 0.025, 0.04), x + (ry ? 0 : (a + b) / 2), y + 0.1, z0 + z + (ry ? (a + b) / 2 : 0), ry)); const n = Math.max(2, Math.round((b - a) / 0.22)); for (let k = 0; k <= n; k++) { const u = a + ((b - a) * k) / n; MB.push(at(cube(0.035, 0.1, 0.035), ry ? x : x + u, y + 0.05, z0 + z + (ry ? u : 0))); } }
      }
    }
    bake(g, MB, mat(MARBLE, 0.8));
    add(g, box(0.56, 0.06, 0.86, 0.02), mat(MARBLE, 0.8), 0, 0.27, z0 + 1.28).rotation.x = 0.69;
    add(g, box(2.5, 0.62, 1.3, 0.04), mat(RED, 0.7), 0, 0.85, z0 - 0.05);
    // 正面十一开间：深红的隔扇门板，柱子留出来
    const DR: G[] = []; for (let i = 0; i < 11; i++) DR.push(at(cube(0.17, 0.46, 0.03), -1.1 + i * 0.22, 0.82, z0 + 0.61));
    bake(g, DR, mat([150, 58, 52], 0.75));
    add(g, box(2.56, 0.09, 1.36, 0.02), mat(TEAL, 0.6), 0, 1.2, z0 - 0.05);
    add(g, roofGeo(3.2, 1.95, 0.3, { lift: 0.12, top: 0.5 }), roofM(yel), 0, 1.24, z0 - 0.05);
    add(g, box(2.26, 0.42, 1.02, 0.03), mat(RED, 0.7), 0, 1.5, z0 - 0.05);
    add(g, box(2.3, 0.08, 1.06, 0.02), mat(TEAL, 0.6), 0, 1.74, z0 - 0.05);
    add(g, roofGeo(3.1, 1.85, 0.78, { lift: 0.2 }), roofM(yel), 0, 1.76, z0 - 0.05);
    add(g, box(1.36, 0.1, 0.1, 0.03), mat(yel, 0.5), 0, 2.56, z0 - 0.05);
    for (const s of [-1, 1]) add(g, box(0.1, 0.22, 0.14, 0.03), mat(yel, 0.5), s * 0.66, 2.64, z0 - 0.05);
    return done(g, 1.9);
  },
  /** 天坛祈年殿：三层圆台、三重蓝琉璃圆顶、金顶 */
  as_temple_of_heaven: () => {
    const g = new THREE.Group(), blue: RGB = [72, 106, 180];
    for (let i = 0; i < 3; i++) { const r = 1.75 - i * 0.3; add(g, cyl(r, r + 0.04, 0.18, 24), mat(MARBLE, 0.8), 0, 0.09 + i * 0.18, 0); const rail = add(g, new THREE.CylinderGeometry(r - 0.03, r - 0.03, 0.09, 24, 1, true), mat(MARBLE, 0.8, DS), 0, 0.225 + i * 0.18, 0); rail.castShadow = false; }
    let y = 0.54; const bodies: P2[] = [[0.78, 0.46], [0.62, 0.3], [0.48, 0.3]], roofs: P2[] = [[1.12, 0.3], [0.92, 0.3], [0.74, 0.62]];
    for (let i = 0; i < 3; i++) {
      const [br, bh] = bodies[i], [rr, rh] = roofs[i];
      add(g, cyl(br, br, bh, 24), mat(RED, 0.7), 0, y + bh / 2, 0); y += bh;
      add(g, cyl(br + 0.03, br + 0.03, 0.08, 24), mat(TEAL, 0.6), 0, y + 0.04, 0); y += 0.08;
      add(g, roofGeo(rr * 2, rr * 2, rh, { sides: 0, lift: 0, top: i < 2 ? (bodies[i + 1][0] + 0.02) / rr : 0, pow: 1.5 }), roofM(blue, 0.45), 0, y, 0); y += i < 2 ? rh - 0.05 : rh;
    }
    add(g, cyl(0.03, 0.06, 0.16, 12), goldM(), 0, y + 0.06, 0); add(g, ball(0.09), goldM(), 0, y + 0.2, 0);
    return done(g, 1.8);
  },
  /** 布达拉宫：红山上层层收分的白宫，正中高起红宫，墙顶一圈深褐边玛草墙，红宫顶上金顶，黑框梯形窗。
   *  正面的之字形大台阶试过（斜带贴墙），这个尺寸下像搭在墙上的木板，去掉了 */
  as_potala: () => {
    const g = new THREE.Group(), white: RGB = [246, 242, 232], maroon: RGB = [184, 74, 64], dark: RGB = [92, 56, 54], earth: RGB = [180, 160, 126];
    const W: G[] = [], R: G[] = [], D: G[] = [], AU: G[] = [], E: G[] = [];
    // 红山：身后的山体，两头从宫墙底下露出来
    E.push(at(dome(1), 0, 0, -0.55, 0, 0, 0, [2.35, 1.3, 1.25]), at(dome(1), -2.12, 0, 0.5, 0, 0, 0, [0.5, 0.62, 0.75]), at(dome(1), 2.12, 0, 0.45, 0, 0, 0, [0.48, 0.5, 0.7]));
    /** 收分墙：(x, y0, z) 为墙脚中心，返回正面在高度 y 处的 z（窗、台阶贴在上面） */
    const wall = (list: G[], x: number, y0: number, z: number, w: number, d: number, h: number, t: number) => { list.push(at(frustum(w, d, h, t), x, y0 + h / 2, z)); return (y: number) => z + (d / 2) * (1 - (1 - t) * ((y - y0) / h)); };
    /** 一排梯形黑框窗：上窄下宽 */
    const wins = (face: (y: number) => number, x0: number, x1: number, n: number, ys: number[], s = 1) => {
      for (const y of ys) for (let i = 0; i < n; i++) D.push(at(frustum(0.1 * s, 0.03, 0.13 * s, 0.7), n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : (x0 + x1) / 2, y, face(y) + 0.005));
    };
    // 山脚的长墙（下宫墙）、两翼白宫、正中红宫
    const f0 = wall(W, 0, 0, 0.75, 4.15, 1.1, 0.78, 0.88);
    const fL = wall(W, -1.3, 0.72, 0.2, 1.8, 1.1, 0.78, 0.9), fR = wall(W, 1.3, 0.72, 0.2, 1.8, 1.1, 0.78, 0.9);
    wall(W, 0, 0.72, 0.25, 1.3, 1.0, 0.5, 0.94);
    const fT = wall(W, 1.25, 1.5, 0.0, 0.9, 0.8, 0.36, 0.94);
    const fRed = wall(R, 0, 1.18, 0.1, 1.5, 1.05, 1.2, 0.9);
    // 墙顶的边玛草墙（深褐）
    D.push(at(box(1.38, 0.14, 0.97, 0.02), 0, 2.33, 0.1), at(box(1.64, 0.09, 1.0, 0.02), -1.3, 1.47, 0.2), at(box(1.64, 0.09, 1.0, 0.02), 1.3, 1.47, 0.2), at(box(0.85, 0.07, 0.76, 0.02), 1.25, 1.84, 0.0));
    // 窗：下宫墙稀，白宫、红宫密
    wins(f0, -1.75, 1.75, 13, [0.55]); wins(fL, -2.0, -0.62, 5, [0.98, 1.24]); wins(fR, 0.62, 2.0, 5, [0.98, 1.24]); wins(fT, 0.95, 1.55, 3, [1.68]);
    wins(fRed, -0.55, 0.55, 5, [1.45, 1.72, 1.98], 1.1); D.push(at(box(0.32, 0.5, 0.03, 0.01), 0, 1.72, fRed(1.72) + 0.006));
    bake(g, E, mat(earth, 0.95)); bake(g, W, mat(white, 0.8)); bake(g, R, mat(maroon, 0.8)); bake(g, D, mat(dark, 0.9));
    // 红宫顶上的金顶（中间最大）
    for (const [x, z, s] of [[-0.42, -0.05, 0.85], [0.42, -0.05, 0.85], [0, -0.12, 1.1]] as [number, number, number][]) { AU.push(at(roofGeo(0.44 * s, 0.38 * s, 0.22 * s, { lift: 0.05 }), x, 2.4, z), at(cyl(0.02, 0.045, 0.16, 8), x, 2.4 + 0.3 * s, z)); AU.push(at(box(0.4 * s, 0.1, 0.34 * s, 0.02), x, 2.36, z)); }
    bake(g, AU, mat(GOLD, 0.34, { metalness: 0.3, side: THREE.DoubleSide }));
    return done(g, 2.4);
  },
  /** 兵马俑：一号坑的隔墙与一排排小俑，前面站一尊大俑 */
  as_terracotta: () => {
    const g = new THREE.Group(), clay: RGB = [186, 136, 102], armor: RGB = [146, 104, 80], earth: RGB = [216, 190, 154], wallC: RGB = [198, 168, 132], r = mulberry32(11);
    add(g, box(4.0, 0.08, 2.3, 0.03), mat(earth, 1), 0, 0.04, -0.55);
    for (let i = 0; i < 4; i++) add(g, box(3.9, 0.3, 0.18, 0.06), mat(wallC, 0.95), 0, 0.15, -1.62 + i * 0.66);
    const men: G[] = [], vest: G[] = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) {
      const x = -1.6 + i * 0.46 + (r.next() - 0.5) * 0.05, z = -1.29 + row * 0.66 + (r.next() - 0.5) * 0.04;
      men.push(at(cyl(0.07, 0.1, 0.26, 8), x, 0.21, z), at(new THREE.SphereGeometry(0.075, 10, 8), x, 0.5, z), at(new THREE.SphereGeometry(0.035, 8, 6), x + 0.035, 0.58, z - 0.01));
      vest.push(at(box(0.22, 0.15, 0.13, 0.04), x, 0.38, z));
    }
    bake(g, men, mat(clay, 0.85)); bake(g, vest, mat(armor, 0.8));
    const w = new THREE.Group(); w.position.set(1.15, 0, 1.0); w.scale.setScalar(1.3); w.rotation.y = -0.25; g.add(w);
    const bx = 0, bz = 0;
    add(w, box(0.72, 0.1, 0.56, 0.03), mat(wallC, 0.95), bx, 0.05, bz);
    add(w, cyl(0.2, 0.3, 0.64, 16), mat(clay, 0.85), bx, 0.42, bz);
    add(w, box(0.52, 0.48, 0.34, 0.1), mat(armor, 0.8), bx, 0.95, bz);
    for (const s of [-1, 1]) { add(w, ball(0.1), mat(armor, 0.8), bx + s * 0.27, 1.12, bz); const a = add(w, cyl(0.065, 0.06, 0.46, 10), mat(clay, 0.85), bx + s * 0.3, 0.86, bz + 0.03); a.rotation.z = s * 0.12; add(w, ball(0.07), mat(clay, 0.85), bx + s * 0.32, 0.6, bz + 0.07); }
    add(w, cyl(0.07, 0.08, 0.1, 10), mat(clay, 0.85), bx, 1.23, bz);
    const head = add(w, ball(0.19), mat(clay, 0.85), bx, 1.42, bz); head.scale.set(0.95, 1.05, 0.95);
    add(w, ball(0.085), mat(armor, 0.8), bx + 0.09, 1.6, bz - 0.04);
    // 脸：一双眼、八字胡，看得出是正脸
    const face: G[] = [at(ball(0.026), bx - 0.065, 1.46, bz + 0.17), at(ball(0.026), bx + 0.065, 1.46, bz + 0.17), at(box(0.075, 0.022, 0.03, 0.01), bx - 0.04, 1.37, bz + 0.175, 0, 0, 0.25), at(box(0.075, 0.022, 0.03, 0.01), bx + 0.04, 1.37, bz + 0.175, 0, 0, -0.25)];
    bake(w, face, mat(armor, 0.8)); add(w, ball(0.03), mat(clay, 0.85), bx, 1.41, bz + 0.19);
    return done(g, 2.2);
  },
  /** 东方明珠：三根斜撑、三根立柱串起一大一小两颗粉色球和太空舱 */
  as_oriental_pearl: () => {
    const g = new THREE.Group(), pink: RGB = [224, 108, 150], silver: RGB = [208, 212, 224], base: RGB = [226, 220, 210];
    const pm = mat(pink, 0.28, { metalness: 0.25 }), sm = mat(silver, 0.35, { metalness: 0.3 });
    add(g, cyl(1.0, 1.1, 0.14, 24), mat(base, 0.8), 0, 0.07, 0);
    const legs: G[] = [];
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 6, s = Math.sin(a), c = Math.cos(a); legs.push(beam(V3(s * 0.88, 0.1, c * 0.88), V3(s * 0.2, 1.0, c * 0.2), 0.16, 0.16, true)); legs.push(at(cyl(0.085, 0.085, 3.2, 12), s * 0.19, 1.7, c * 0.19)); legs.push(at(ball(0.12), s * 0.88, 0.14, c * 0.88)); }
    bake(g, legs, sm);
    for (const [y, r] of [[1.3, 0.52], [3.15, 0.42]]) { add(g, new THREE.SphereGeometry(r, 24, 16), pm, 0, y, 0); add(g, new THREE.TorusGeometry(r + 0.01, 0.025, 8, 32), sm, 0, y, 0).rotation.x = Math.PI / 2; }
    for (const y of [2.0, 2.3, 2.6]) add(g, ball(0.13), pm, 0, y, 0);
    add(g, cyl(0.09, 0.13, 0.75, 12), sm, 0, 3.9, 0); add(g, ball(0.17), pm, 0, 4.3, 0);
    add(g, cyl(0.025, 0.06, 1.0, 8), sm, 0, 4.9, 0); add(g, ball(0.035), pm, 0, 5.42, 0);
    return done(g, 1.1);
  },
  /** 桂林漓江（兴坪，二十元人民币背面那一眼）：一条弯河从一排排圆顶陡壁的喀斯特峰之间流出来，远山淡、近山绿，河上一张竹筏 */
  as_li_river: () => {
    const g = new THREE.Group(), base: RGB = [150, 186, 138], near: RGB = [98, 150, 110], far: RGB = [150, 180, 168], bamboo: RGB = [226, 202, 148], r = mulberry32(5);
    add(g, cyl(2.35, 2.35, 0.05, 32), mat(base, 0.95), 0, 0.025, 0).scale.set(1, 1, 0.97);
    const river: P2[] = [[-0.1, -2.15], [0.15, -1.35], [-0.3, -0.55], [0.05, 0.35], [0.6, 1.15], [0.8, 2.05]], rc = new THREE.CatmullRomCurve3(river.map(([x, z]) => V3(x, 0, z)));
    add(g, ribbon(river, 0.78, 0.06), waterM());
    /** 喀斯特峰：陡壁、圆顶，像竖起来的馒头；有的是两座连在一起 */
    const KARST: P2[] = [[0.64, 0], [0.67, 0.1], [0.66, 0.3], [0.61, 0.5], [0.53, 0.66], [0.41, 0.8], [0.25, 0.93], [0, 1.0]];
    const back: [number, number, number, number][] = [[-1.5, -1.5, 0.72, 1.85], [-0.62, -1.95, 0.66, 2.05], [0.72, -1.85, 0.7, 1.95], [1.7, -1.2, 0.62, 1.6], [-2.05, -0.55, 0.5, 1.25], [2.1, -0.25, 0.46, 1.1]];
    const front: [number, number, number, number][] = [[-1.4, -0.35, 0.66, 1.4], [1.05, -0.75, 0.6, 1.3], [1.6, 0.4, 0.56, 1.05], [-1.7, 0.85, 0.5, 0.9], [-0.95, 0.45, 0.4, 0.75], [1.75, 1.35, 0.4, 0.6], [-1.05, 1.6, 0.34, 0.45]];
    const peaks = (list: [number, number, number, number][], out: G[]) => list.forEach(([x, z, rr, h]) => {
      const sx = rr * (0.92 + r.next() * 0.2), sz = rr * (0.85 + r.next() * 0.2), ry = r.next() * 3;
      out.push(at(lathe(KARST, 14), x, 0, z, ry, 0, 0, [sx, h, sz]));
      if (h > 1.5) out.push(at(lathe(KARST, 12), x + Math.cos(ry) * sx * 0.7, 0, z + Math.sin(ry) * sz * 0.55, 0, 0, 0, [sx * 0.72, h * 0.78, sz * 0.72]));
    });
    const F: G[] = [], N: G[] = []; peaks(back, F); peaks(front, N);
    bake(g, F, mat(far, 0.95)); bake(g, N, mat(near, 0.9));
    // 竹筏：五根竹子并排，撑篙的人戴斗笠
    const raft = new THREE.Group(), rp = rc.getPointAt(0.72), rt = rc.getTangentAt(0.72); raft.position.set(rp.x, 0.08, rp.z); raft.rotation.y = Math.atan2(rt.x, rt.z); raft.scale.setScalar(1.5); g.add(raft);
    const B: G[] = [], P: G[] = [];
    for (let i = 0; i < 5; i++) B.push(at(cyl(0.022, 0.022, 0.7, 8), -0.09 + i * 0.045, 0, 0, 0, Math.PI / 2));
    B.push(at(cone(0.12, 0.07, 14), 0, 0.33, -0.1), at(cyl(0.007, 0.007, 0.7, 6), 0.1, 0.22, 0.02, 0, 0.45));
    P.push(at(cyl(0.045, 0.065, 0.2, 10), 0, 0.12, -0.1), at(ball(0.05), 0, 0.26, -0.1));
    bake(raft, B, mat(bamboo, 0.8)); bake(raft, P, mat(near, 0.8));
    return done(g, 2.35, (t) => { raft.position.y = 0.08 + Math.sin(t * 1.4) * 0.012; raft.rotation.z = Math.sin(t * 1.1) * 0.03; });
  },
  /** 黄山：花岗岩石柱林立，前面石头上伸出迎客松，脚下一片云海 */
  as_huangshan: () => {
    const g = new THREE.Group(), rock: RGB = [196, 190, 178], rock2: RGB = [168, 164, 156], leaf: RGB = [84, 128, 100], trunk: RGB = [136, 108, 86], r = mulberry32(3);
    const SPIRE: P2[] = [[0.5, 0], [0.49, 0.32], [0.43, 0.38], [0.42, 0.9], [0.35, 0.96], [0.33, 1.45], [0.26, 1.52], [0.24, 1.9], [0.14, 2.1], [0, 2.18]];
    const spires: [number, number, number, number][] = [[-1.2, -0.8, 0.55, 1.35], [-0.2, -1.3, 0.5, 1.05], [0.85, -0.65, 0.6, 1.45], [1.65, 0.3, 0.45, 0.9], [-1.75, 0.45, 0.45, 0.8], [0.05, 0.55, 0.52, 0.6]];
    const A: G[] = [], B: G[] = [], P = { trunk: [] as G[], leaf: [] as G[] };
    spires.forEach(([x, z, rr, s], i) => (i % 2 ? A : B).push(at(lathe(SPIRE, 10), x, 0, z, r.next() * 3, 0, 0, [rr * 1.05, s * 1.0, rr * 0.85])));
    bake(g, A, mat(rock, 0.9)); bake(g, B, mat(rock2, 0.9));
    pine(P, 0.05, 1.3, 0.55, 1.4, [1, 0.7]);
    for (const [x, z, s] of [[-1.2, -0.8, 1.35], [0.85, -0.65, 1.45], [1.65, 0.3, 0.9], [-1.75, 0.45, 0.8]] as [number, number, number][]) pine(P, x, 2.18 * s - 0.12, z, 0.6);
    bake(g, P.trunk, mat(trunk, 0.9)); bake(g, P.leaf, mat(leaf, 0.85));
    const clouds: G[] = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3; clouds.push(at(ball(0.34 + (i % 3) * 0.08), Math.cos(a) * 1.5, 0.45 + (i % 2) * 0.12, Math.sin(a) * 1.15 + 0.2, 0, 0, 0, [1.6, 0.5, 1])); }
    const cm = bake(g, clouds, mat(WHITE, 1, { transparent: true, opacity: 0.9 }))!; cm.castShadow = false;
    return done(g, 2.2, (t) => { cm.rotation.y = Math.sin(t * 0.15) * 0.12; });
  },
  /** 杭州西湖雷峰塔：湖边小山上的八角五层楼阁式塔，铜色飞檐 */
  as_leifeng: () => {
    const g = new THREE.Group(), body: RGB = [204, 112, 84], roofC: RGB = [186, 138, 90];
    add(g, dome(1), mat(GRASS, 0.95), 0, 0, -0.3).scale.set(1.9, 0.42, 1.5);
    water(g, 1.0, 0, 1.72, 0.04, WATER, 2.25, 0.62);
    add(g, prismN(1.0, 0.26, 8), mat(STONE, 0.85), 0, 0.5, -0.3);
    let y = 0.63;
    for (let i = 0; i < 5; i++) {
      const br = 0.62 - i * 0.07, bh = 0.4, ap = br * Math.cos(Math.PI / 8);
      add(g, prismN(br, bh, 8), mat(body, 0.7), 0, y + bh / 2, -0.3); y += bh;
      const next = i < 4 ? (0.62 - (i + 1) * 0.07) * Math.cos(Math.PI / 8) : 0;
      add(g, roofGeo(2 * (ap + 0.3), 2 * (ap + 0.3), 0.2, { sides: 8, lift: 0.09, top: i < 4 ? (next + 0.02) / (ap + 0.3) : 0, th: 0.06 }), roofM(roofC, 0.45), 0, y, -0.3); y += i < 4 ? 0.16 : 0.2;
    }
    add(g, cyl(0.03, 0.06, 0.62, 10), mat(roofC, 0.4, { metalness: 0.3 }), 0, y + 0.28, -0.3);
    for (const [dy, rr] of [[0.14, 0.09], [0.28, 0.08], [0.42, 0.07]]) add(g, cyl(rr, rr, 0.04, 12), mat(roofC, 0.4, { metalness: 0.3 }), 0, y + dy, -0.3);
    return done(g, 1.9);
  },
  /** 北京鸟巢（国家体育场）：椭圆马鞍形的碗，外面一层随机交织的银灰钢网，透过钢网看见里面的红色看台 */
  as_birds_nest: () => {
    const g = new THREE.Group(), steel: RGB = [186, 188, 196], red: RGB = [206, 84, 66], plaza: RGB = [224, 218, 208], RX = 2.15, RZ = 1.6, H = 1.6;
    add(g, cyl(1, 1, 0.06, 32), mat(plaza, 0.9), 0, 0.03, 0).scale.set(2.5, 1, 2.0);
    // 碗：里面一圈圈浅灰看台，外面一圈红墙（从钢网缝里透出来的就是它）
    add(g, saddle(lathe([[0.56, 0.08], [0.7, 0.3], [0.84, 0.58], [0.93, 0.8]], 32), RX, RZ, H), mat(plaza, 0.85, DS));
    add(g, saddle(lathe([[0.93, 0.8], [0.95, 0.4], [0.94, 0.06]], 32), RX, RZ, H), mat(red, 0.7, DS));
    add(g, cyl(0.56, 0.56, 0.03, 32), mat(GRASS, 0.95), 0, 0.09, 0).scale.set(RX, 1, RZ);
    // 外壳：从地面鼓出去再收进来，顶上一圈钢网屋盖，中间开口
    const shell = saddle(lathe([[0.98, 0.04], [1.04, 0.28], [1.06, 0.52], [1.03, 0.76], [0.96, 0.92], [0.86, 1.0], [0.74, 1.02], [0.62, 0.99]], 40), RX, RZ, H);
    add(g, shell, texMat("nest", steel, steel, 10, 2.2, 0.4, 0.35));
    // 屋盖下面一层半透明的膜（从上往下看是一圈浅色，中间开口里才是红看台和草坪）
    const mem = add(g, saddle(lathe([[0.95, 0.88], [0.85, 0.965], [0.73, 0.985], [0.63, 0.955]], 40), RX * 0.985, RZ * 0.985, H * 0.99), mat(plaza, 0.6, { transparent: true, opacity: 0.82, side: THREE.DoubleSide })); mem.castShadow = false;
    // 几根粗的主钢条压在网上（每边斜着交叉），剪影更像鸟巢
    const S: G[] = [];
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2, a1 = a0 + (i % 2 ? 0.55 : -0.55), P = (a: number, t: number) => { const rr = 1.05 - 0.07 * t, c = Math.cos(a); return V3(Math.sin(a) * rr * RX, H * t * (0.7 + 0.3 * c * c) * 0.92, Math.cos(a) * rr * RZ); };
      S.push(beam(P(a0, 0.02), P(a1, 0.95), 0.07, 0.07, true));
    }
    bake(g, S, mat(steel, 0.4, { metalness: 0.35 }));
    return done(g, 2.4);
  },
  // ---------- 日本
  /** 富士山：内凹的完美圆锥、锯齿雪顶，山前湖水与樱花 */
  as_fuji: () => {
    const g = new THREE.Group(), blue: RGB = [126, 144, 192], pink: RGB = [242, 186, 202], wood: RGB = [150, 116, 96];
    const P: P2[] = [[2.0, 0], [1.68, 0.26], [1.3, 0.78], [0.95, 1.38], [0.66, 2.0], [0.46, 2.5], [0.36, 2.72], [0.18, 2.7], [0, 2.64]];
    add(g, lathe(P, 24), mat(blue, 0.85), 0, 0, -0.25);
    const rAt = (y: number) => { for (let i = 1; i < 7; i++) if (y <= P[i][1]) { const [r0, y0] = P[i - 1], [r1, y1] = P[i]; return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0); } return P[6][0]; };
    const ys = [1.55, 1.85, 2.15, 2.45, 2.72], sp = [...ys.map((y) => V2(rAt(y) + 0.02, y + 0.005)), V2(0.2, 2.725), V2(0, 2.67)];
    const sg = new THREE.LatheGeometry(sp, 24), pa = sg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i); if (Math.abs(y - 1.555) > 1e-3) continue;
      const x = pa.getX(i), z = pa.getZ(i), j = Math.round(((Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 12)) % 24;
      const ny = y - (j % 2 ? 0 : 0.3 + (0.3 * ((j * 7) % 3)) / 2), k = (rAt(ny) + 0.02) / Math.hypot(x, z); pa.setXYZ(i, x * k, ny, z * k);
    }
    sg.computeVertexNormals(); add(g, sg, mat(WHITE, 0.6), 0, 0, -0.25);
    water(g, 1.0, 0, 1.95, 0.035, WATER, 2.2, 0.42);
    const tr: G[] = [], bl: G[] = [];
    for (const [x, z, s] of [[-1.75, 1.45, 1], [-1.3, 1.85, 0.8], [1.8, 1.5, 0.9]] as [number, number, number][]) { tr.push(at(cyl(0.04, 0.06, 0.4 * s, 8), x, 0.2 * s, z)); bl.push(at(ball(0.3 * s), x, 0.5 * s, z, 0, 0, 0, [1.1, 0.85, 1])); }
    bake(g, tr, mat(wood, 0.9)); bake(g, bl, mat(pink, 0.8));
    return done(g, 2.3);
  },
  /** 清水寺：悬在崖边的木造舞台（下面一片立柱）、大屋顶本堂、朱红三重塔、红叶 */
  as_kiyomizu: () => {
    const g = new THREE.Group(), green: RGB = [132, 170, 122], wood: RGB = [170, 124, 88], roofC: RGB = [100, 88, 86], maple: RGB = [234, 142, 86];
    add(g, box(4.2, 1.1, 1.9, 0.25), mat(green, 0.95), 0, 0.55, -1.25);
    add(g, box(1.9, 0.5, 1.1, 0.04), mat(wood, 0.8), -0.25, 1.35, -0.78);
    add(g, roofGeo(2.6, 1.7, 0.72, { lift: 0.1, pow: 1.4 }), roofM(roofC, 0.8), -0.25, 1.6, -0.78);
    add(g, box(0.95, 0.08, 0.08, 0.02), mat(roofC, 0.8), -0.25, 2.33, -0.78);
    const W: G[] = [];
    W.push(at(box(2.1, 0.07, 1.0, 0.02), -0.25, 1.12, 0.22), at(cube(2.1, 0.09, 0.03), -0.25, 1.2, 0.71));
    const xs = [-1.2, -0.72, -0.25, 0.22, 0.7], zs = [0.66, 0.28, -0.1];
    for (const x of xs) for (const z of zs) W.push(at(cyl(0.035, 0.035, 1.1, 6), x, 0.55, z));
    for (const y of [0.38, 0.78]) { for (const z of zs) W.push(at(cube(1.95, 0.05, 0.04), -0.25, y, z)); for (const x of xs) W.push(at(cube(0.04, 0.05, 0.8), x, y, 0.28)); }
    bake(g, W, mat(wood, 0.8));
    const tx = 1.35, tz = -1.45; let y = 1.1; const V: G[] = [], R: G[] = [];
    for (let i = 0; i < 3; i++) { const w = 0.4 - i * 0.04; V.push(at(box(w, 0.3, w, 0.02), tx, y + 0.15, tz)); y += 0.3; R.push(at(roofGeo(w + 0.4, w + 0.4, 0.14, { lift: 0.07, top: i < 2 ? (w - 0.1) / (w + 0.4) : 0 }), tx, y, tz)); y += 0.1; }
    R.push(at(cyl(0.02, 0.03, 0.5, 8), tx, y + 0.28, tz));
    bake(g, V, mat(VERM, 0.6)); bake(g, R, roofM(roofC, 0.8));
    // 红叶：矮树干 + 三团叶子，崖下一片、山上几棵
    const M: G[] = [], TR: G[] = [];
    for (const [x, yy, z, s] of [[1.25, 0, 0.95, 1.0], [1.8, 0, 0.3, 0.85], [-1.7, 0, 0.8, 0.95], [-1.25, 0, 1.45, 0.7], [0.55, 0, 1.4, 0.65], [-1.75, 1.1, -1.55, 0.8], [0.55, 1.1, -1.8, 0.7]] as [number, number, number, number][]) {
      TR.push(at(cyl(0.035 * s, 0.05 * s, 0.34 * s, 6), x, yy + 0.17 * s, z));
      M.push(at(ball(0.26 * s), x, yy + 0.46 * s, z, 0, 0, 0, [1.1, 0.8, 1.05]), at(ball(0.18 * s), x + 0.18 * s, yy + 0.4 * s, z + 0.08 * s), at(ball(0.17 * s), x - 0.14 * s, yy + 0.6 * s, z - 0.06 * s));
    }
    bake(g, TR, mat(wood, 0.8)); bake(g, M, mat(maple, 0.85));
    return done(g, 2.3);
  },
  /** 伏见稻荷大社：沿山路一道接一道的朱红千本鸟居，入口一座大鸟居，两只白狐 */
  as_fushimi_inari: () => {
    const g = new THREE.Group(), green: RGB = [134, 170, 126], fox: RGB = [244, 240, 232], ped: RGB = [196, 192, 184];
    const hx = 0, hz = -1.0, hr = [1.55, 1.05, 1.25] as const;
    add(g, dome(1), mat(green, 0.95), hx, 0, hz).scale.set(hr[0], hr[1], hr[2]);
    const hillY = (x: number, z: number) => { const q = 1 - ((x - hx) / hr[0]) ** 2 - ((z - hz) / hr[2]) ** 2; return q > 0 ? hr[1] * Math.sqrt(q) : 0; };
    const c = new THREE.CatmullRomCurve3(([[0.1, 1.45], [0.35, 0.9], [0.1, 0.35], [-0.5, -0.1], [-0.55, -0.75], [0.05, -1.25]] as P2[]).map(([x, z]) => V3(x, 0, z)));
    const red: G[] = [], dark: G[] = [], N = 17;
    for (let i = 0; i < N; i++) { const u = i / (N - 1), p = c.getPointAt(u), t = c.getTangentAt(u); torii(red, dark, p.x, Math.max(0, hillY(p.x, p.z) - 0.04), p.z, 0.74, 0.5, Math.atan2(t.x, t.z)); }
    torii(red, dark, 0.05, 0, 2.0, 1.3, 1.0, 0.05);
    bake(g, red, mat([228, 100, 64], 0.55)); bake(g, dark, mat(INK, 0.6));
    const F: G[] = [], S: G[] = [];
    for (const s of [-1, 1]) {
      const x = 0.05 + s * 0.95, z = 2.05; S.push(at(box(0.3, 0.34, 0.3, 0.04), x, 0.17, z));
      F.push(at(cyl(0.08, 0.11, 0.24, 10), x, 0.46, z), at(ball(0.085), x, 0.64, z + 0.03), at(cone(0.045, 0.12, 8), x, 0.63, z + 0.14, 0, Math.PI / 2), at(ball(0.07), x + s * 0.1, 0.42, z - 0.12, 0, 0, 0, [0.8, 1.6, 0.8]));
      for (const e of [-1, 1]) F.push(at(cone(0.035, 0.11, 8), x + e * 0.045, 0.74, z + 0.02));
    }
    bake(g, F, mat(fox, 0.7)); bake(g, S, mat(ped, 0.9));
    return done(g, 2.2);
  },
  /** 金阁寺：镜湖池上的三层楼阁，二、三层贴金，顶上金凤凰，池里有松岛 */
  as_kinkakuji: () => {
    const g = new THREE.Group(), cream: RGB = [238, 228, 206], roofC: RGB = [96, 84, 78], pineC: RGB = [106, 148, 108], z0 = -0.55;
    water(g, 1.0, 0.05, 0.45, 0.03, WATER, 2.1, 1.25);
    const gm = mat([238, 186, 64], 0.26, { metalness: 0.55, emissive: C([150, 96, 16]), emissiveIntensity: 0.3 });
    add(g, box(1.5, 0.1, 1.2, 0.03), mat(cream, 0.8), 0, 0.05, z0);
    add(g, box(1.3, 0.48, 1.05, 0.03), mat(cream, 0.8), 0, 0.34, z0);
    add(g, roofGeo(1.64, 1.38, 0.12, { lift: 0.05, top: 0.6, th: 0.04 }), roofM(roofC, 0.7), 0, 0.6, z0);
    add(g, box(1.16, 0.46, 0.94, 0.03), gm, 0, 0.9, z0);
    add(g, roofGeo(1.56, 1.32, 0.12, { lift: 0.05, top: 0.38, th: 0.04 }), roofM(roofC, 0.7), 0, 1.14, z0);
    add(g, box(0.78, 0.44, 0.78, 0.03), gm, 0, 1.42, z0);
    add(g, roofGeo(1.12, 1.12, 0.42, { lift: 0.07, th: 0.04 }), roofM(roofC, 0.7), 0, 1.65, z0);
    add(g, box(0.07, 0.12, 0.16, 0.03), gm, 0, 2.14, z0); add(g, box(0.28, 0.03, 0.07, 0.01), gm, 0, 2.17, z0 - 0.02);
    const P = { trunk: [] as G[], leaf: [] as G[] };
    for (let i = 0; i < 6; i++) P.trunk.push(at(cube(0.05, 0.46, 0.03), -0.6 + i * 0.24, 0.34, z0 + 0.53));
    for (const [x, z, s] of [[-1.3, 0.9, 0.55], [1.15, 1.05, 0.45], [-0.3, 1.3, 0.35]] as [number, number, number][]) { P.leaf.push(at(dome(0.34 * s / 0.45), x, 0.02, z, 0, 0, 0, [1.2, 0.5, 1])); pine(P, x, 0.1, z, s, [0.6, 0.3]); }
    bake(g, P.trunk, mat(roofC, 0.8)); bake(g, P.leaf, mat(pineC, 0.85));
    return done(g, 2.0);
  },
  /** 大阪城：巨石收分台基上五层白壁绿瓦天守，顶层墨色描金、金鯱 */
  as_osaka_castle: () => {
    const g = new THREE.Group(), stone: RGB = [160, 156, 150], white: RGB = [246, 243, 236], green: RGB = [112, 170, 148], dark: RGB = [70, 72, 82];
    add(g, frustum(2.0, 1.9, 0.72, 0.82), mat(stone, 0.9), 0, 0.36, 0);
    let y = 0.72; const ws = [1.28, 1.12, 0.96, 0.8, 0.64];
    for (let i = 0; i < 5; i++) {
      const w = ws[i], d = w * 0.86, last = i === 4;
      add(g, box(w, 0.44, d, 0.03), mat(last ? dark : white, 0.8), 0, y + 0.22, 0); y += 0.44;
      if (last) add(g, box(w + 0.02, 0.06, d + 0.02, 0.02), goldM(), 0, y - 0.05, 0);
      add(g, roofGeo(w + 0.32, d + 0.3, last ? 0.4 : 0.18, { lift: 0.12, top: last ? undefined : 0.5 }), roofM(green, 0.5), 0, y - 0.02, 0);
      if (i < 3) { const gw = i === 1 ? 0.3 : w * 0.5; for (const gx of i === 1 ? [-0.24, 0.24] : [0]) { add(g, prism(gw, 0.24, 0.14), mat(green, 0.5), gx, y - 0.02, d / 2 + 0.12); add(g, ball(0.04), goldM(), gx, y + 0.08, d / 2 + 0.2); } }
      y += last ? 0.4 : 0.1;
    }
    add(g, box(0.36, 0.08, 0.08, 0.02), mat(green, 0.5), 0, y + 0.02, 0);
    for (const s of [-1, 1]) { const f = add(g, box(0.07, 0.2, 0.1, 0.03), goldM(), s * 0.2, y + 0.12, 0); f.rotation.z = -s * 0.35; }
    return done(g, 1.5);
  },
  /** 东京塔：国际橙与白相间的铁塔，四脚张开，大展望台与顶部展望台 */
  as_tokyo_tower: () => {
    const g = new THREE.Group(), orange: RGB = [234, 112, 72], white: RGB = [246, 243, 238], glass: RGB = [206, 218, 232];
    const hw = (y: number) => 0.07 + 0.84 * Math.pow(Math.max(0, 1 - y / 4.0), 2.4);
    const lv = [0, 0.5, 1.0, 1.5, 1.95, 2.4, 2.85, 3.3, 3.75], O: G[] = [], W: G[] = [];
    for (let k = 0; k < lv.length - 1; k++) {
      const y0 = lv[k], y1 = lv[k + 1], a = hw(y0), b = hw(y1), list = k % 2 ? W : O, t = 0.05 + a * 0.06;
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) list.push(beam(V3(sx * a, y0, sz * a), V3(sx * b, y1, sz * b), t));
      for (const [ax, az, bx, bz] of [[1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1], [-1, 1, 1, 1]]) {
        list.push(beam(V3(ax * b, y1, az * b), V3(bx * b, y1, bz * b), 0.04));
        if (y0 > 0.3) { list.push(beam(V3(ax * a, y0, az * a), V3(bx * b, y1, bz * b), 0.025), beam(V3(bx * a, y0, bz * a), V3(ax * b, y1, az * b), 0.025)); }
      }
    }
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { O.push(at(new THREE.TorusGeometry(0.72, 0.05, 6, 16, Math.PI), sx * 0.8, 0, sz * 0.8, sx ? Math.PI / 2 : 0)); }
    O.push(at(cyl(0.035, 0.05, 0.5, 8), 0, 4.0, 0)); W.push(at(cyl(0.02, 0.035, 0.5, 8), 0, 4.5, 0));
    bake(g, O, mat(orange, 0.55)); bake(g, W, mat(white, 0.6));
    add(g, box(0.86, 0.2, 0.86, 0.06), mat(glass, 0.25, { metalness: 0.2 }), 0, 1.78, 0); add(g, box(0.72, 0.16, 0.72, 0.05), mat(white, 0.6), 0, 1.96, 0);
    add(g, box(0.34, 0.16, 0.34, 0.04), mat(glass, 0.25, { metalness: 0.2 }), 0, 3.26, 0);
    return done(g, 1.1);
  },
  /** 东京晴空塔：细的青灰色格构塔身，两圈环形展望台，顶上长天线。第八轮核对：原来的白色格构在浅底上几乎看不见，塔身与格线都压深了一档 */
  as_skytree: () => {
    const g = new THREE.Group(), glass: RGB = [96, 116, 158], white: RGB = [232, 238, 246];
    const shaft = lathe([[0.62, 0], [0.5, 0.4], [0.41, 1.0], [0.34, 1.8], [0.29, 2.6], [0.26, 3.0], [0.22, 3.6], [0.17, 4.0], [0.12, 4.4], [0.1, 4.5]], 12);
    add(g, shaft, texMat("lattice", [178, 190, 212], [96, 112, 148], 6, 14, 0.5));
    for (const [y, r, h] of [[2.82, 0.5, 0.14], [3.08, 0.46, 0.12]]) add(g, cyl(r, r - 0.02, h, 24), mat(glass, 0.2, { metalness: 0.3 }), 0, y, 0);
    add(g, cyl(0.54, 0.52, 0.1, 24), mat(white, 0.5), 0, 2.95, 0); add(g, cyl(0.44, 0.48, 0.08, 24), mat(white, 0.5), 0, 3.18, 0);
    add(g, cyl(0.3, 0.28, 0.18, 24), mat(glass, 0.2, { metalness: 0.3 }), 0, 3.8, 0); add(g, cyl(0.31, 0.31, 0.05, 24), mat(white, 0.5), 0, 3.92, 0);
    add(g, cyl(0.04, 0.08, 0.72, 10), mat(white, 0.5), 0, 4.84, 0); add(g, cyl(0.015, 0.03, 0.26, 6), mat([190, 196, 206], 0.5), 0, 5.33, 0);
    return done(g, 0.9);
  },
  /** 严岛神社大鸟居：海上的朱红两部鸟居（主柱前后各有稚儿柱），背后是宫岛的青山 */
  as_itsukushima: () => {
    const g = new THREE.Group(), red: RGB = [226, 98, 64], green: RGB = [122, 162, 122];
    water(g, 2.2, 0, 0.2, 0.03, [104, 176, 206], 1.05, 0.95);
    add(g, dome(1), mat(green, 0.95), 0.3, 0, -1.6).scale.set(2.0, 1.25, 0.7);
    const R: G[] = [], D: G[] = [], H = 2.1, W = 1.6, z = 0.3;
    for (const s of [-1, 1]) {
      const x = (s * W) / 2; R.push(at(cyl(0.1, 0.12, H, 14), x, H / 2, z));
      for (const dz of [-0.4, 0.4]) { R.push(at(cyl(0.055, 0.06, 1.2, 10), x, 0.6, z + dz)); D.push(at(box(0.18, 0.06, 0.18, 0.02), x, 1.23, z + dz)); }
      for (const y of [0.62, 1.12]) R.push(at(box(0.06, 0.07, 0.86, 0.02), x, y, z));
    }
    R.push(at(box(W * 1.3, 0.11, 0.14, 0.03), 0, 1.5, z), at(box(0.12, 0.3, 0.1, 0.02), 0, 1.72, z), at(box(W * 1.32, 0.12, 0.2, 0.03), 0, 1.93, z));
    D.push(at(box(0.3, 0.32, 0.05, 0.02), 0, 1.72, z + 0.07), at(kasagi(W * 1.72, 0.14, 0.26, 0.22), 0, 2.0, z));
    bake(g, R, mat(red, 0.55)); bake(g, D, mat(INK, 0.6));
    return done(g, 2.2);
  },
  /** 奈良东大寺大佛殿：宽大的重檐木构大殿，灰瓦、金鸱尾，正面唐破风，门前小鹿 */
  as_todaiji: () => {
    const g = new THREE.Group(), stone: RGB = [214, 208, 196], cream: RGB = [242, 234, 218], wood: RGB = [168, 114, 86], tile: RGB = [100, 98, 106], z0 = -0.35;
    add(g, box(3.8, 0.2, 2.4, 0.04), mat(stone, 0.9), 0, 0.1, z0);
    add(g, box(3.1, 0.68, 1.8, 0.04), mat(cream, 0.8), 0, 0.54, z0);
    const cols: G[] = [];
    for (let i = 0; i < 9; i++) cols.push(at(cube(0.08, 0.66, 0.04), -1.44 + i * 0.36, 0.53, z0 + 0.91));
    for (let i = 0; i < 7; i++) cols.push(at(cube(0.07, 0.4, 0.04), -1.14 + i * 0.38, 1.2, z0 + 0.73));
    add(g, roofGeo(3.7, 2.35, 0.3, { lift: 0.08, top: 0.58 }), roofM(tile, 0.7), 0, 0.88, z0);
    add(g, box(2.8, 0.46, 1.44, 0.03), mat(cream, 0.8), 0, 1.2, z0);
    add(g, roofGeo(3.55, 2.2, 0.86, { lift: 0.12, pow: 1.5 }), roofM(tile, 0.7), 0, 1.42, z0);
    add(g, box(1.45, 0.12, 0.12, 0.04), mat(tile, 0.7), 0, 2.3, z0);
    for (const s of [-1, 1]) { const sb = add(g, box(0.1, 0.26, 0.16, 0.04), goldM(), s * 0.72, 2.42, z0); sb.rotation.z = s * 0.3; }
    // 正面的唐破风：中间拱起、两端反翘的曲线山花，下面是白色的观相窗
    const kara = (w: number, h: number) => { const s = new THREE.Shape(), n = 12; s.moveTo(-w / 2, 0);
      for (let i = 1; i <= n; i++) { const u = -1 + (2 * i) / n, a = Math.abs(u); s.lineTo((u * w) / 2, h * (a < 0.55 ? Math.cos((a / 0.55) * Math.PI * 0.5) * 0.7 + 0.3 : 0.3 * Math.pow((1 - a) / 0.45, 1.6))); }
      return s; };
    const kg = new THREE.ExtrudeGeometry(kara(1.2, 0.46), { depth: 0.62, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 4 }); kg.translate(0, 0, -0.31);
    add(g, kg, mat(tile, 0.7), 0, 0.93, z0 + 0.95);
    const kf = new THREE.ShapeGeometry(kara(1.0, 0.36)); add(g, kf, mat(cream, 0.8), 0, 0.95, z0 + 1.3);
    // 门前的鹿：圆身子、细腿、抬着头
    const deer: G[] = [];
    for (const [x, z, ry] of [[-1.15, 1.5, 0.7], [0.85, 1.7, -0.6], [1.6, 1.15, 2.6]] as [number, number, number][]) {
      const cs = Math.cos(ry), sn = Math.sin(ry), P = (lx: number, ly: number, lz: number, q: G, rx = 0) => at(q, x + lx * cs + lz * sn, ly, z - lx * sn + lz * cs, ry, rx);
      deer.push(P(0, 0.36, 0, new THREE.SphereGeometry(0.13, 12, 8).scale(0.78, 0.72, 1.45)), P(0, 0.5, 0.16, cyl(0.04, 0.055, 0.22, 8), 0.35), P(0, 0.64, 0.22, new THREE.SphereGeometry(0.068, 10, 8).scale(0.85, 0.85, 1.35)));
      for (const s of [-1, 1]) deer.push(P(s * 0.05, 0.7, 0.18, cone(0.022, 0.08, 6)), P(s * 0.06, 0.13, 0.13, cyl(0.018, 0.016, 0.28, 6)), P(s * 0.06, 0.13, -0.13, cyl(0.018, 0.016, 0.28, 6)));
    }
    bake(g, cols, mat(wood, 0.8)); bake(g, deer, mat(wood, 0.8));
    return done(g, 2.1);
  },
  // ---------- 韩国
  /** 景福宫光化门：三孔石拱门台、上承重檐二层门楼（灰瓦、红柱、绿彩画），背后北岳山 */
  as_gyeongbokgung: () => {
    const g = new THREE.Group(), stone: RGB = [206, 200, 188], dark: RGB = [68, 62, 66], red: RGB = [188, 76, 62], green: RGB = [112, 158, 128], tile: RGB = [98, 100, 108];
    add(g, dome(1), mat(green, 0.95), 0.5, 0, -1.6).scale.set(1.5, 2.1, 0.7); add(g, dome(1), mat(green, 0.95), -1.3, 0, -1.55).scale.set(1.0, 1.3, 0.7);
    add(g, box(2.6, 0.9, 1.0, 0.05), mat(stone, 0.9), 0, 0.45, 0);
    const A: G[] = [archGeo(0.44, 0.62, 0.04).translate(0, 0, 0.51), archGeo(0.34, 0.5, 0.04).translate(-0.72, 0, 0.51), archGeo(0.34, 0.5, 0.04).translate(0.72, 0, 0.51)];
    bake(g, A, mat(dark, 0.9));
    for (const s of [-1, 1]) { add(g, box(0.85, 0.55, 0.32, 0.04), mat(stone, 0.9), s * 1.7, 0.28, -0.1); add(g, box(0.92, 0.07, 0.42, 0.02), mat(tile, 0.7), s * 1.7, 0.58, -0.1); }
    add(g, box(1.9, 0.46, 0.72, 0.03), mat(red, 0.7), 0, 1.13, 0); add(g, box(1.94, 0.08, 0.76, 0.02), mat(green, 0.6), 0, 1.38, 0);
    add(g, roofGeo(2.45, 1.26, 0.28, { lift: 0.14, top: 0.2 }), roofM(tile, 0.65), 0, 1.41, 0);
    add(g, box(1.46, 0.38, 0.58, 0.03), mat(red, 0.7), 0, 1.72, 0); add(g, box(1.5, 0.07, 0.62, 0.02), mat(green, 0.6), 0, 1.93, 0);
    add(g, roofGeo(2.2, 1.1, 0.52, { lift: 0.18 }), roofM(tile, 0.65), 0, 1.95, 0);
    add(g, box(1.14, 0.09, 0.1, 0.03), mat(tile, 0.65), 0, 2.49, 0);
    return done(g, 2.2);
  },
  // ---------- 东南亚
  /** 吴哥窟：三层回廊台基上五座莲苞塔（中间最高），前面倒影池与糖棕 */
  as_angkor_wat: () => {
    const g = new THREE.Group(), s1: RGB = [198, 184, 156], s2: RGB = [170, 156, 130], palm: RGB = [118, 158, 108], z0 = -0.45;
    add(g, box(3.4, 0.05, 0.6, 0.02), waterM(), 0, 0.03, 1.65);
    add(g, box(3.4, 0.28, 2.2, 0.04), mat(s1, 0.9), 0, 0.14, z0); add(g, box(2.7, 0.3, 1.8, 0.04), mat(s1, 0.9), 0, 0.43, z0); add(g, box(2.0, 0.34, 1.4, 0.04), mat(s1, 0.9), 0, 0.75, z0);
    add(g, box(0.5, 0.05, 0.9, 0.02), mat(s1, 0.9), 0, 0.02, 0.95);
    const T: G[] = [];
    for (const [x, z] of [[-0.78, -0.48], [0.78, -0.48], [-0.78, 0.48], [0.78, 0.48]]) T.push(at(budGeo(0.26, 1.15, 6, 8), x, 0.92, z0 + z));
    T.push(at(box(0.8, 0.2, 0.8, 0.03), 0, 1.02, z0), at(budGeo(0.36, 1.8, 7, 8), 0, 1.12, z0));
    bake(g, T, mat(s2, 0.9));
    const P: G[] = [], L: G[] = [];
    for (const [x, z] of [[-1.85, 1.2], [1.8, 1.05], [-1.6, 0.85]]) { P.push(at(cyl(0.03, 0.04, 1.0, 6), x, 0.5, z)); L.push(at(ball(0.2), x, 1.05, z, 0, 0, 0, [1.2, 0.8, 1.2])); }
    bake(g, P, mat(s2, 0.9)); bake(g, L, mat(palm, 0.85));
    return done(g, 2.0);
  },
  /** 曼谷郑王庙：河边高耸的白色高棉式主塔（一层层收上去，顶上三叉戟），四角四座小塔 */
  as_wat_arun: () => {
    const g = new THREE.Group(), stone: RGB = [214, 206, 192], white: RGB = [242, 238, 230], pink: RGB = [228, 178, 160], z0 = -0.3;
    water(g, 1.0, 0, 1.95, 0.04, WATER, 2.3, 0.42);
    // 塔身像玉米棒：一圈圈檐口往上收，上半段收得快；表面白底嵌彩瓷（用粉色细纹代替）
    const skin = texMat("stripe", white, pink, 1, 22, 0.6), skin2 = texMat("stripe", white, pink, 1, 12, 0.6);
    const T: G[] = [], S: G[] = [];
    // 三层陡台基，正面一道很陡的台阶
    for (const [w, h, y] of [[2.9, 0.34, 0], [2.15, 0.42, 0.34], [1.5, 0.3, 0.76]] as [number, number, number][]) S.push(at(box(w, h, w, 0.04), 0, y + h / 2, z0), at(cube(w + 0.04, 0.04, w + 0.04), 0, y + h - 0.02, z0));
    S.push(beam(V3(0, 0.02, z0 + 1.62), V3(0, 1.02, z0 + 0.72), 0.3, 0.1));
    bake(g, S, mat(stone, 0.9));
    add(g, budGeo(0.62, 2.8, 11, 16, 0.1, 0.02, 2.0, 0.75, 0.84), skin, 0, 1.06, z0);
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) T.push(at(budGeo(0.22, 1.3, 6, 12, 0.1, 0.03, 2.0, 0.75, 0.84), x, 0.34, z0 + z));
    bake(g, T, skin2);
    const TIP: G[] = [at(cyl(0.025, 0.05, 0.55, 8), 0, 4.1, z0)];
    for (const s of [-1, 0, 1]) TIP.push(at(cyl(0.01, 0.012, 0.16, 6), s * 0.045, 4.42, z0, 0, 0, -s * 0.35));
    bake(g, TIP, mat(pink, 0.5));
    return done(g, 2.0);
  },
  /** 新加坡滨海湾金沙：三栋双腿分开的酒店塔楼，顶上一艘伸出去的空中花园「船」 */
  as_marina_bay_sands: () => {
    const g = new THREE.Group(), glass: RGB = [182, 200, 222], white: RGB = [244, 244, 240], green: RGB = [132, 176, 124], z0 = -0.35, H = 2.25;
    water(g, 1.0, 0, 1.75, 0.04, WATER, 2.3, 0.6);
    // 三栋塔楼宽面朝海湾；每栋两条腿：前腿笔直，后腿从地面斜着靠上来，在高处并拢
    const T: G[] = [];
    for (const x of [-1.2, 0, 1.2]) {
      T.push(at(box(0.62, H, 0.24, 0.04), x, H / 2, z0 + 0.16));
      T.push(at(box(0.62, H * 1.02, 0.24, 0.04), x, H / 2, z0 - 0.22, 0, 0.19));
    }
    bake(g, T, texMat("stripe", glass, [150, 170, 198], 1, 20, 0.35, 0.2));
    // 空中花园：一艘长船横跨三栋楼顶，北端（左）悬挑出去
    const hull = new THREE.Shape([V2(-2.4, 0), V2(-2.15, 0.22), V2(1.55, 0.3), V2(1.7, 0.18), V2(1.7, -0.18), V2(1.55, -0.3), V2(-2.15, -0.22)]);
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }); hg.rotateX(-Math.PI / 2);
    add(g, hg, mat(white, 0.5), 0, H + 0.02, z0 - 0.02);
    add(g, box(1.9, 0.03, 0.12, 0.01), waterM(), -0.9, H + 0.2, z0 + 0.14);
    const L: G[] = []; for (let i = 0; i < 12; i++) L.push(at(ball(0.075), -1.8 + i * 0.29, H + 0.25, z0 - 0.14));
    bake(g, L, mat(green, 0.85));
    return done(g, 2.4);
  },
  /** 新加坡鱼尾狮：狮子头（一圈鬃毛）、鱼身坐在海边台座上、尾巴在身后卷起来，张嘴往海湾里喷一道水 */
  as_merlion: () => {
    const g = new THREE.Group(), stone: RGB = [242, 240, 232], dark: RGB = [98, 98, 108], base: RGB = [196, 192, 184], jet: RGB = [150, 206, 234], z0 = -0.55;
    water(g, 1.0, 0, 1.45, 0.035, WATER, 2.3, 1.0);
    const BS: G[] = [at(box(1.9, 0.42, 1.6, 0.1), 0, 0.21, z0), at(box(2.3, 0.1, 0.3, 0.04), 0, 0.47, z0 + 0.66)];
    for (let i = 0; i < 9; i++) BS.push(at(cube(0.04, 0.22, 0.04), -1.0 + i * 0.25, 0.55, z0 + 0.72));
    BS.push(at(cube(2.1, 0.04, 0.05), 0, 0.66, z0 + 0.72));
    bake(g, BS, mat(base, 0.9));
    const W: G[] = [], D: G[] = [];
    // 鱼身：直立的瓶形，下面宽；尾巴从身后卷上来，末端一对尾鳍
    W.push(at(lathe([[0.5, 0], [0.56, 0.2], [0.54, 0.5], [0.46, 0.8], [0.38, 1.05], [0.34, 1.2]], 18), 0, 0.42, z0, 0, 0, 0, [1, 1, 0.85]));
    const tail = new THREE.CatmullRomCurve3([V3(0.1, 0.62, z0 - 0.3), V3(0.35, 0.58, z0 - 0.8), V3(0.4, 0.9, z0 - 1.1), V3(0.25, 1.28, z0 - 0.98), V3(0.12, 1.42, z0 - 0.7)]);
    W.push(taperTube(tail, 0.3, 0.08, 24, 12));
    const tip = tail.getPointAt(1);
    for (const s of [-1, 1]) W.push(at(cone(0.14, 0.34, 10), tip.x + s * 0.12, tip.y + 0.14, tip.z + 0.06, 0, 0.3, -s * 0.8, [1, 1, 0.35]));
    // 狮子头：大圆头 + 一圈鬃毛 + 前伸的口鼻，嘴张开
    const hy = 1.95, hz = z0 + 0.08;
    W.push(at(ball(0.46), 0, hy, hz, 0, 0, 0, [1, 0.96, 0.92]));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; W.push(at(ball(0.2), Math.cos(a) * 0.46, hy + Math.sin(a) * 0.44, hz - 0.12, 0, 0, 0, [1, 1, 0.75])); }
    W.push(at(ball(0.2), 0, hy - 0.1, hz + 0.4, 0, 0, 0, [1.2, 0.72, 0.9]), at(ball(0.16), 0, hy - 0.32, hz + 0.34, 0, 0, 0, [1.1, 0.5, 0.9]));
    D.push(at(ball(0.12), 0, hy - 0.22, hz + 0.44, 0, 0, 0, [1.2, 0.5, 0.6]), at(ball(0.06), 0, hy - 0.02, hz + 0.58, 0, 0, 0, [1.3, 0.8, 0.8]));
    for (const s of [-1, 1]) D.push(at(ball(0.055), s * 0.19, hy + 0.1, hz + 0.39));
    bake(g, W, mat(stone, 0.6)); bake(g, D, mat(dark, 0.7));
    // 喷水：从嘴里抛出去落进海湾，虚线贴图往前流
    const arc = new THREE.QuadraticBezierCurve3(V3(0, hy - 0.22, hz + 0.5), V3(0, hy + 0.05, hz + 1.55), V3(0, 0.05, hz + 2.55));
    const jm = texMat("dash", jet, [236, 248, 255], 6, 1, 0.15);
    const j = add(g, taperTube(arc, 0.07, 0.12, 24, 10), jm); j.castShadow = false;
    const foam = add(g, ball(0.18), mat(stone, 0.5), 0, 0.06, hz + 2.55); foam.scale.set(1.6, 0.35, 1.2); foam.castShadow = false;
    return done(g, 2.2, (t) => { (jm.map as THREE.Texture).offset.x = -t * 1.2; foam.scale.x = 1.6 + Math.sin(t * 6) * 0.12; });
  },
  /** 吉隆坡双子塔：两座八角星平面的银色塔，层层收分到尖顶，中段一座空中天桥 */
  as_petronas: () => {
    const g = new THREE.Group(), silver: RGB = [214, 218, 228];
    const star = (R: number, h: number) => { const s = new THREE.Shape(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? R * 0.8 : R; if (i) s.lineTo(Math.sin(a) * r, Math.cos(a) * r); else s.moveTo(Math.sin(a) * r, Math.cos(a) * r); } const q = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); q.rotateX(-Math.PI / 2); return q; };
    const T: G[] = [], S: G[] = [];
    for (const x of [-0.6, 0.6]) {
      let y = 0;
      for (const [R, h] of [[0.42, 2.3], [0.37, 0.55], [0.32, 0.45], [0.26, 0.38], [0.2, 0.3]] as P2[]) { T.push(at(star(R, h), x, y, 0)); y += h; S.push(at(cyl(R * 0.86, R * 0.86, 0.04, 16), x, y, 0)); }
      S.push(at(cyl(0.1, 0.16, 0.35, 12), x, y + 0.17, 0), at(cone(0.1, 0.42, 12), x, y + 0.55, 0), at(cyl(0.012, 0.03, 0.55, 6), x, y + 1.0, 0));
    }
    bake(g, T, texMat("stripe", silver, [140, 152, 176], 1, 3, 0.35, 0.45));
    S.push(at(box(0.52, 0.1, 0.14, 0.03), 0, 2.02, 0), beam(V3(0, 1.97, 0), V3(-0.2, 1.3, 0), 0.04, 0.04, true), beam(V3(0, 1.97, 0), V3(0.2, 1.3, 0), 0.04, 0.04, true));
    bake(g, S, mat(silver, 0.3, { metalness: 0.5 }));
    return done(g, 1.1);
  },
  /** 婆罗浮屠：五层方台 + 三层圆台，圆台上一圈圈钟形小佛塔，顶上大佛塔 */
  as_borobudur: () => {
    const g = new THREE.Group(), stone: RGB = [158, 154, 146], light: RGB = [184, 178, 166];
    add(g, box(3.9, 0.06, 3.9, 0.03), mat(GRASS, 0.95), 0, 0.03, 0);
    [3.3, 2.9, 2.5, 2.1, 1.74].forEach((w, i) => add(g, box(w, 0.2, w, 0.03), mat(stone, 0.9), 0, 0.16 + i * 0.2, 0));
    add(g, box(0.28, 0.06, 1.4, 0.02), mat(light, 0.9), 0, 0.53, 1.31).rotation.x = 0.88;
    const B: G[] = []; let y = 1.06;
    for (const [tr, br, n] of [[0.84, 0.75, 16], [0.66, 0.56, 12], [0.48, 0.38, 8]]) { add(g, cyl(tr, tr + 0.02, 0.12, 24), mat(stone, 0.9), 0, y + 0.06, 0); y += 0.12; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; B.push(at(bell(0.075, 10), Math.sin(a) * br, y, Math.cos(a) * br)); } }
    B.push(at(bell(0.3, 16), 0, y, 0));
    bake(g, B, mat(light, 0.85));
    return done(g, 2.0);
  },
  /** 下龙湾：翡翠色海面上一座座石灰岩孤岛（底部被海水掏空、顶上长草），一艘蝙蝠翼帆的中式帆船 */
  as_ha_long: () => {
    const g = new THREE.Group(), sea: RGB = [104, 184, 180], rock: RGB = [150, 150, 144], green: RGB = [110, 154, 106], hull: RGB = [140, 98, 72], sail: RGB = [222, 124, 80], r = mulberry32(9);
    water(g, 2.3, 0, 0, 0.03, sea, 1, 0.92);
    // 石灰岩孤岛：水线处被海水掏进去一圈，陡壁灰白，上半截披着绿（绿是同一条轮廓放大一点、只取上段）
    const ISLE: P2[] = [[0.78, 0], [0.7, 0.06], [0.8, 0.14], [0.9, 0.3], [0.94, 0.48], [0.9, 0.64], [0.78, 0.78], [0.58, 0.9], [0.3, 0.98], [0, 1.0]];
    const TOP: P2[] = [[0.9, 0.6], [0.935, 0.66], [0.815, 0.78], [0.61, 0.9], [0.32, 0.985], [0, 1.02]];
    const isles: [number, number, number, number][] = [[-1.3, -1.0, 0.6, 2.0], [-0.25, -1.6, 0.5, 1.5], [0.85, -1.05, 0.62, 2.3], [1.75, -0.15, 0.45, 1.4], [-1.8, 0.35, 0.42, 1.1], [1.4, 1.25, 0.34, 0.85], [-1.0, 1.3, 0.3, 0.6], [-0.55, -0.35, 0.34, 1.0]];
    const RK: G[] = [], GR: G[] = [];
    for (const [x, z, rr, h] of isles) for (const k of h > 1.4 ? [0, 1] : [0]) {
      const sx = rr * (0.85 + r.next() * 0.3) * (k ? 0.7 : 1), sz = rr * (0.8 + r.next() * 0.3) * (k ? 0.7 : 1), ry = r.next() * 3, hh = h * (k ? 0.72 : 1);
      const px = x + (k ? Math.cos(ry) * rr * 0.7 : 0), pz = z + (k ? Math.sin(ry) * rr * 0.55 : 0);
      RK.push(at(lathe(ISLE, 10), px, 0, pz, ry, 0, 0, [sx, hh, sz])); GR.push(at(lathe(TOP, 10), px, 0, pz, ry, 0, 0, [sx, hh, sz]));
    }
    bake(g, RK, mat(rock, 0.9)); bake(g, GR, mat(green, 0.9));
    const boat = new THREE.Group(); boat.position.set(0.1, 0.04, 0.95); boat.rotation.y = Math.PI / 2 - 0.3; g.add(boat);
    add(boat, box(0.3, 0.14, 0.95, 0.06), mat(hull, 0.8), 0, 0.07, 0); add(boat, box(0.28, 0.12, 0.26, 0.04), mat(hull, 0.8), 0, 0.2, -0.33);
    const sailGeo = (h: number) => { const s = new THREE.Shape(); s.moveTo(-0.2, 0); s.lineTo(0.18, 0); s.quadraticCurveTo(0.32, h * 0.6, 0.12, h); s.quadraticCurveTo(-0.1, h * 0.95, -0.22, h * 0.75); s.lineTo(-0.2, 0); const q = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 6 }); q.rotateY(Math.PI / 2); return q; };
    const SL: G[] = [], MS: G[] = [];
    for (const [z, h] of [[-0.28, 0.62], [0.02, 0.78], [0.3, 0.56]] as P2[]) { SL.push(sailGeo(h).translate(0, 0.2, z)); MS.push(at(cyl(0.012, 0.012, h + 0.12, 6), 0, 0.2 + (h + 0.12) / 2, z)); for (let k = 1; k < 4; k++) MS.push(at(cube(0.03, 0.012, 0.36), 0, 0.2 + (h * k) / 4, z)); }
    bake(boat, SL, mat(sail, 0.75, DS)); bake(boat, MS, mat(hull, 0.8));
    return done(g, 2.3, (t) => { boat.position.y = 0.04 + Math.sin(t * 1.3) * 0.015; boat.rotation.z = Math.sin(t * 1.1) * 0.03; });
  },
  // ---------- 南亚 / 中东
  /** 泰姬陵：白色大理石台基、尖拱门面、洋葱穹顶和四座小亭，四角宣礼塔，前面长条水池与柏树 */
  as_taj_mahal: () => {
    const g = new THREE.Group(), white: RGB = [247, 242, 234], shade: RGB = [218, 210, 198], cyp: RGB = [96, 138, 108], z0 = -0.5;
    add(g, box(3.0, 0.2, 2.2, 0.03), mat(white, 0.7), 0, 0.1, z0);
    add(g, box(1.44, 0.95, 1.44, 0.14), mat(white, 0.7), 0, 0.675, z0);
    const A: G[] = [];
    for (const [ry, ox, oz] of [[0, 0, 0.73], [Math.PI / 2, 0.73, 0], [-Math.PI / 2, -0.73, 0]] as [number, number, number][]) {
      A.push(at(archGeo(0.5, 0.74, 0.03, true).translate(0, 0.26, 0), ox, 0, z0 + oz, ry));
      for (const s of [-1, 1]) for (const yy of [0.26, 0.66]) A.push(at(archGeo(0.2, 0.3, 0.03, true).translate(s * 0.47, yy, 0), ox, 0, z0 + oz, ry));
    }
    bake(g, A, mat(shade, 0.8));
    const Wt: G[] = [];
    Wt.push(at(cyl(0.4, 0.42, 0.26, 24), 0, 1.28, z0), at(lathe([[0.42, 0], [0.52, 0.1], [0.58, 0.28], [0.57, 0.45], [0.48, 0.64], [0.32, 0.8], [0.16, 0.92], [0.05, 1.02], [0, 1.1]], 24), 0, 1.41, z0));
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      Wt.push(at(cyl(0.13, 0.13, 0.18, 8), sx * 0.5, 1.24, z0 + sz * 0.5), at(dome(0.15, 12), sx * 0.5, 1.33, z0 + sz * 0.5));
      const mx = sx * 1.36, mz = z0 + sz * 0.96;
      Wt.push(at(cyl(0.085, 0.11, 1.6, 12), mx, 1.0, mz)); for (const yy of [0.72, 1.18, 1.72]) Wt.push(at(cyl(0.15, 0.13, 0.05, 12), mx, yy, mz));
      Wt.push(at(cyl(0.1, 0.1, 0.12, 8), mx, 1.86, mz), at(dome(0.11, 12), mx, 1.92, mz));
    }
    bake(g, Wt, mat(white, 0.7));
    add(g, cyl(0.02, 0.03, 0.24, 8), goldM(), 0, 2.58, z0); add(g, ball(0.04), goldM(), 0, 2.72, z0);
    add(g, box(0.4, 0.05, 1.55, 0.02), waterM(), 0, 0.03, 1.5);
    const CY: G[] = []; for (let i = 0; i < 4; i++) for (const s of [-1, 1]) CY.push(at(cone(0.1, 0.5, 8), s * 0.42, 0.25, 0.85 + i * 0.44));
    bake(g, CY, mat(cyp, 0.85));
    return done(g, 2.1);
  },
  /** 迪拜哈利法塔：Y 形平面的三翼按螺旋逐段收分，中心筒一路收成尖针 */
  as_burj_khalifa: () => {
    const g = new THREE.Group(), glass: RGB = [196, 208, 226], light: RGB = [232, 236, 244];
    const T: G[] = [];
    for (let w = 0; w < 3; w++) {
      const a = (w / 3) * Math.PI * 2; let y0 = 0;
      for (let k = 0; k < 6; k++) { const len = 0.92 - k * 0.14, y1 = 0.55 + k * 0.5 + w * 0.17; T.push(at(box(0.3, y1 - y0, len, 0.05), Math.sin(a) * len * 0.5, (y0 + y1) / 2, Math.cos(a) * len * 0.5, a)); y0 = y1; }
    }
    T.push(at(flat(new THREE.CylinderGeometry(0.2, 0.26, 3.8, 6)), 0, 1.9, 0), at(flat(new THREE.CylinderGeometry(0.12, 0.2, 0.7, 6)), 0, 4.15, 0));
    bake(g, T, texMat("stripe", glass, [160, 178, 206], 1, 10, 0.3, 0.35));
    add(g, cyl(0.02, 0.11, 0.85, 10), mat(light, 0.35, { metalness: 0.4 }), 0, 4.92, 0);
    return done(g, 1.0);
  },
  /** 佩特拉卡兹尼神殿：玫瑰红岩壁上凿出的两层柱廊立面（下层山花、上层圆亭与断山花），前面一峰骆驼 */
  as_petra: () => {
    const g = new THREE.Group(), rock: RGB = [190, 112, 94], face: RGB = [238, 184, 150], dark: RGB = [118, 70, 62], sand: RGB = [232, 204, 166], camel: RGB = [198, 154, 110], r = mulberry32(21);
    // 身后的崖壁：一排竖着的岩片，高低错落；两侧峡谷（蛇道）的岩壁往前收，把立面夹在中间
    const RK: G[] = [];
    for (let i = 0; i < 7; i++) { const x = -2.05 + i * 0.68, h = 2.5 + r.next() * 0.6; RK.push(at(box(0.74, h, 1.0, 0.07), x, h / 2, -1.05 - r.next() * 0.1, (r.next() - 0.5) * 0.12)); }
    for (const s of [-1, 1]) for (const [dx, z, h, w, ry] of [[1.72, -0.35, 2.6, 0.62, 0.2], [1.84, 0.25, 2.2, 0.56, 0.32], [1.98, 0.85, 1.7, 0.5, 0.45], [2.12, 1.4, 1.2, 0.44, 0.5]] as [number, number, number, number, number][])
      RK.push(at(box(w, h + (r.next() - 0.5) * 0.25, 0.72, 0.07), s * dx, h / 2, z, s * ry));
    bake(g, RK, mat(rock, 0.95));
    add(g, box(2.8, 0.05, 1.9, 0.02), mat(sand, 1), 0, 0.025, 0.55);
    const F: G[] = [];
    F.push(at(box(2.1, 2.6, 0.12, 0.03), 0, 1.3, -0.5), at(box(2.0, 0.14, 0.42, 0.03), 0, 0.07, -0.3));
    for (const x of [-0.85, -0.55, -0.25, 0.25, 0.55, 0.85]) F.push(at(cyl(0.06, 0.07, 1.0, 12), x, 0.64, -0.2));
    F.push(at(box(2.0, 0.16, 0.36, 0.03), 0, 1.22, -0.28), at(prism(1.0, 0.3, 0.3), 0, 1.3, -0.3));
    F.push(at(box(1.9, 0.08, 0.3, 0.02), 0, 1.5, -0.35), at(cyl(0.24, 0.24, 0.72, 16), 0, 1.9, -0.35), at(cone(0.3, 0.26, 16), 0, 2.39, -0.35), at(ball(0.08), 0, 2.58, -0.35));
    for (const s of [-1, 1]) { F.push(at(box(0.5, 0.72, 0.28, 0.03), s * 0.75, 1.9, -0.36), at(box(0.52, 0.07, 0.3, 0.02), s * 0.78, 2.32, -0.36, 0, 0, -s * 0.35)); for (const dx of [-0.2, 0.2]) F.push(at(cyl(0.04, 0.045, 0.64, 10), s * 0.75 + dx, 1.86, -0.2)); }
    bake(g, F, mat(face, 0.85));
    add(g, box(0.3, 0.56, 0.04, 0.02), mat(dark, 0.9), 0, 0.42, -0.42);
    const K: G[] = [], cx = 0.95, cz = 1.0;
    K.push(at(ball(0.22), cx, 0.62, cz, 0, 0, 0, [1.45, 0.75, 0.8]), at(ball(0.12), cx + 0.02, 0.78, cz), beam(V3(cx - 0.26, 0.64, cz), V3(cx - 0.44, 0.92, cz), 0.07, 0.07, true), at(ball(0.07), cx - 0.5, 0.94, cz, 0, 0, 0, [1.5, 0.8, 0.8]));
    for (const [dx, dz] of [[-0.2, -0.08], [-0.2, 0.08], [0.2, -0.08], [0.2, 0.08]]) K.push(at(cyl(0.025, 0.025, 0.5, 6), cx + dx, 0.25, cz + dz));
    bake(g, K, mat(camel, 0.85));
    return done(g, 2.2);
  },
  /** 台北 101：像竹节一样的八段倒梯形塔身（每段上宽下窄），顶上尖塔 */
  as_taipei101: () => {
    const g = new THREE.Group(), glass: RGB = [128, 174, 172], frame: RGB = [92, 128, 134];
    const skin = texMat("stripe", glass, [104, 146, 148], 1, 6, 0.3, 0.25);
    add(g, box(1.3, 0.35, 1.3, 0.05), mat(frame, 0.6), 0, 0.175, 0);
    add(g, frustum(0.95, 0.95, 1.1, 0.8), skin, 0, 0.9, 0);
    const J: G[] = []; let y = 1.45;
    for (let i = 0; i < 8; i++) { add(g, flat(new THREE.CylinderGeometry(1, 0.76, 0.36, 4, 1).rotateY(Math.PI / 4).scale(0.5, 1, 0.5)), skin, 0, y + 0.18, 0); y += 0.36; J.push(at(cube(0.66, 0.035, 0.66), 0, y, 0)); }
    J.push(at(box(0.42, 0.24, 0.42, 0.03), 0, y + 0.12, 0), at(box(0.3, 0.16, 0.3, 0.03), 0, y + 0.32, 0), at(cyl(0.04, 0.07, 0.24, 8), 0, y + 0.52, 0), at(cyl(0.012, 0.025, 0.5, 6), 0, y + 0.88, 0));
    bake(g, J, mat(frame, 0.5, { metalness: 0.2 }));
    return done(g, 0.9);
  },
  /** 珠穆朗玛峰：金字塔形主峰（北壁正对前方）与雪顶，峰顶旗云；山脚经幡和黄帐篷 */
  as_everest: () => {
    const g = new THREE.Group(), rock: RGB = [118, 116, 130], blue: RGB = [96, 140, 204], yel: RGB = [242, 200, 88], red: RGB = [216, 96, 80];
    const RK: G[] = [], SN: G[] = [];
    for (const [x, z, rr, h, sides, lean, cap] of [[0, -0.5, 1.55, 3.9, 4, -0.18, 0.55], [1.35, -0.9, 1.0, 2.5, 5, 0.1, 0.45], [-1.4, -0.6, 0.95, 2.0, 5, 0.12, 0.4]] as [number, number, number, number, number, number, number][]) {
      const [rk, sn] = alp(rr, h, sides, lean, cap, 0.3 / h); RK.push(rk.translate(x, 0, z)); SN.push(sn.translate(x, 0, z));
    }
    bake(g, RK, mat(rock, 0.9)); bake(g, SN, mat(WHITE, 0.6));
    // 旗云：从峰顶往一侧拖出去的一串云
    const PL: G[] = [[-0.12, 3.74, 0.2], [0.22, 3.66, 0.24], [0.6, 3.56, 0.22], [0.95, 3.46, 0.17]].map(([x, y, rr]) => at(ball(rr), x, y, -0.5, 0, 0, 0, [1.5, 0.62, 0.8]));
    const plume = bake(g, PL, mat(WHITE, 1, { transparent: true, opacity: 0.8, depthWrite: false }))!; plume.castShadow = false;
    const a = V3(-1.5, 0.95, 1.5), b = V3(0.6, 0.42, 1.85);
    add(g, cyl(0.025, 0.03, 0.95, 8), mat(rock, 0.8), a.x, 0.475, a.z); const cairn: G[] = []; [[0.26, 0.1], [0.21, 0.09], [0.16, 0.08], [0.11, 0.07], [0.07, 0.06]].reduce((y, [cr, ch], i) => { cairn.push(at(ball(cr), b.x + (i % 2 ? 0.02 : -0.02), y + ch / 2, b.z, i, 0, 0, [1, (ch / cr) * 0.75, 0.9])); return y + ch; }, 0); bake(g, cairn, mat(rock, 0.9));
    const flags = new THREE.Group(); g.add(flags); const FL: [G[], RGB][] = [[[], blue], [[], WHITE], [[], red], [[], yel]];
    const line: G[] = [];
    for (let i = 0; i < 12; i++) { const u = (i + 0.5) / 12, p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * 0.18; FL[i % 4][0].push(at(cube(0.11, 0.13, 0.012), p.x, p.y - 0.07, p.z, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2)); }
    for (let i = 0; i < 12; i++) { const u0 = i / 12, u1 = (i + 1) / 12, p0 = a.clone().lerp(b, u0), p1 = a.clone().lerp(b, u1); p0.y -= Math.sin(u0 * Math.PI) * 0.18; p1.y -= Math.sin(u1 * Math.PI) * 0.18; line.push(beam(p0, p1, 0.012, 0.012, true)); }
    for (const [list, c] of FL) bake(flags, list, mat(c, 0.7)); bake(g, line, mat(rock, 0.8));
    add(g, prism(0.42, 0.3, 0.46), mat(yel, 0.7), 1.2, 0, 1.3).rotation.y = 0.5;
    return done(g, 2.3, (t) => { flags.position.y = Math.sin(t * 3) * 0.008; plume.position.x = Math.sin(t * 0.7) * 0.04; });
  },
};
