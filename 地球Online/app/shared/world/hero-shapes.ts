/** 小人的形体（有向距离场）与网格构建：不依赖 three.js，主线程和 Web Worker 都能用（hero-worker.ts 在后台网格化，不卡界面） */
import { polygonize, union, subtract, intersect, offset, sphere, ellipsoid, roundCone, roundBox, torus, noise3, capsule, type SDF, type Vec3, type MeshData } from "./sdf.ts";
import type { Avatar } from "../spec/types.ts";

export const TAU = Math.PI * 2;
export const HEAD_Y = 3.68;
export const SHOULDER: Vec3 = [0.74, 2.5, 0];
export const HIP: Vec3 = [0.33, 1.2, 0];
/** 眼睛（头部本地坐标，头半径 = 1）：眼球是压扁的椭球 */
/** 可爱：眼睛大、偏低、分得开（婴儿图式），眼睑只剩一道细边 */
/** 豆豆眼：小、亮、偏低、分得开（潮玩的脸只要两颗眼、一抹腮红） */
export const EYE = { x: 0.33, y: -0.2, z: 0.9, r: [0.078, 0.1, 0.045] as Vec3 };

const quilt = (f: SDF, y0: number, period: number, amp: number): SDF => offset(f, (_x, y) => -amp * Math.sin((Math.PI * (y - y0)) / period) ** 2);

/** 睫毛：一条沿眼睛上半圈轮廓的细眼线（正面看就是眼睛的上沿），内细外粗，外眼角小小一翘 */
function lashes(s: number): SDF {
  const E: Vec3 = [s * EYE.x, EYE.y, EYE.z]; const [a, b, c] = EYE.r;
  const N = 24; const pts: Vec3[] = [];
  for (let i = 0; i <= N; i++) { const th = ((18 + (144 * i) / N) * Math.PI) / 180; const cx = Math.cos(th), sy = Math.sin(th); pts.push([E[0] + s * (a + 0.006) * cx, E[1] + (b + 0.006) * sy, E[2] + c * (0.45 + 0.25 * sy)]); }
  const w = (i: number) => { const u = 1 - i / N; return 0.0045 + 0.0055 * u + 0.002 * Math.sin(Math.PI * u); };   // i = 0 是外眼角
  const segs = pts.slice(1).map((p, i) => roundCone(pts[i], p, w(i), w(i + 1)));
  const o = pts[0]; const flick = roundCone(o, [o[0] + s * 0.038, o[1] + 0.03, o[2] - 0.015], 0.009, 0.003);
  const all = union(0.005, ...segs, flick); const bound = ellipsoid(E, [a + 0.08, b + 0.08, c + 0.1]);
  return (x, y, z) => { const d = bound(x, y, z); return d > 0.02 ? d : all(x, y, z); };
}

export const SHAPES = {
  head: (): SDF => {
    const skull = union(0.07,
      union(0.32, ellipsoid([0, 0, 0], [1.0, 0.98, 0.96]), ellipsoid([0.42, -0.38, 0.47], [0.42, 0.34, 0.33]), ellipsoid([-0.42, -0.38, 0.47], [0.42, 0.34, 0.33]), ellipsoid([0, -0.54, 0.3], [0.5, 0.3, 0.38])),
      ellipsoid([0, -0.33, 0.915], [0.05, 0.04, 0.045]));   // 鼻头只是一个小圆点
    // 眼窝：浅浅的两个坑，眼球坐进去
    return skull;   // 豆豆眼直接贴在脸上，不挖眼窝
  },
  lashes: (): SDF => union(0, lashes(1), lashes(-1)),
  hair: (style: Avatar["hair"]): SDF => {
    const low = style === "long" ? -1.95 : style === "short" ? -0.62 : -0.95;
    let shell: SDF = union(0.3, ellipsoid([0, 0.1, -0.06], [1.1, 1.06, 1.08]), ellipsoid([0, -0.42, -0.2], [1.13, 0.8, 0.96]));
    if (style === "long") shell = union(0.35, shell, ellipsoid([0, -1.15, -0.42], [1.0, 0.95, 0.55]));
    const face: SDF = (x, y, z) => ellipsoid([0, -0.28, 0.95], [0.86, 0.78, 0.86])(x, y - 0.05 * Math.cos(x * 9) - 0.03 * Math.cos(x * 23), z);   // 刘海边：大小两层波浪 = 一缕缕
    const cut = subtract(0.12, shell, face);
    const bottom: SDF = (_x, y) => low - y;
    let hair = intersect(0.16, cut, bottom);
    if (style === "bun") hair = union(0.22, hair, ellipsoid([0.92, -0.78, -0.34], [0.28, 0.4, 0.28]), ellipsoid([-0.92, -0.78, -0.34], [0.28, 0.4, 0.28]));
    // 发束：从头顶发旋放射的粗条（细条交给着色器）
    return offset(hair, (x, y, z) => { const a = Math.atan2(x, z + 0.25); return -0.022 * Math.abs(Math.sin(a * 7 + noise3(x * 2, y * 2, z * 2) * 1.5)) ** 0.5 * Math.min(1, Math.max(0, 0.9 - y)); });
  },
  ties: (): SDF => union(0, torus([0.86, -0.46, -0.3], 0.19, 0.055, 0.3), torus([-0.86, -0.46, -0.3], 0.19, 0.055, 0.3)),
  beanie: (): SDF => {
    const tilt = 0.2, cy = 0.35, cz = -0.05; const cs = Math.cos(tilt), sn = Math.sin(tilt);
    const cap = intersect(0.08, ellipsoid([0, 0.42, -0.05], [1.12, 0.86, 1.12]), (_x, y) => 0.5 - y);
    return (x, y, z) => { const py = y - cy, pz = z - cz; return cap(x, cy + py * cs - pz * sn, cz + py * sn + pz * cs); };
  },
  beanieCuff: (): SDF => {
    const tilt = 0.2, cy = 0.35, cz = -0.05; const cs = Math.cos(tilt), sn = Math.sin(tilt);
    // 翻边：一圈厚一点的带子，上沿圆润
    const band = intersect(0.06, ellipsoid([0, 0.42, -0.05], [1.2, 0.95, 1.2]), (_x, y) => Math.abs(y - 0.37) - 0.16);
    const hollow = subtract(0.02, band, ellipsoid([0, 0.42, -0.05], [1.02, 0.8, 1.02]));
    return (x, y, z) => { const py = y - cy, pz = z - cz; return hollow(x, cy + py * cs - pz * sn, cz + py * sn + pz * cs); };
  },
  pom: (): SDF => offset(sphere([0, 1.36, -0.24], 0.3), (x, y, z) => 0.022 * noise3(x * 11, y * 11, z * 11) + 0.012 * noise3(x * 29, y * 29, z * 29)),
  strawHat: (): SDF => {
    const crown = ellipsoid([0, 0.58, -0.08], [1.02, 0.62, 1.02]);
    const brim: SDF = (x, y, z) => { const r = Math.hypot(x, z + 0.08); const yc = 0.3 - 0.045 * r * r; return Math.hypot(Math.max(r - 1.65, 0), Math.max(Math.abs(y - yc) - 0.03, 0)) + Math.min(Math.max(r - 1.65, Math.abs(y - yc) - 0.03), 0) - 0.05; };
    return union(0.14, crown, brim);
  },
  hatBand: (): SDF => torus([0, 0.4, -0.08], 1.0, 0.11),
  jacket: (): SDF => {
    const body = union(0.35, ellipsoid([0, 2.25, 0], [0.8, 0.62, 0.66]), ellipsoid([0, 1.72, 0.03], [0.84, 0.58, 0.68]), ellipsoid([0, 1.3, 0], [0.8, 0.26, 0.62]));
    const q = quilt(body, 1.18, 0.34, 0.045);
    // 拉链的一道凸边 + 两个口袋盖
    const zip = offset(q, (x, _y, z) => (z > 0.3 ? -0.02 * Math.exp(-((x / 0.05) ** 2)) : 0));
    const flap = (s: number) => roundBox([s * 0.46, 1.52, 0.62], [0.2, 0.05, 0.06], 0.035, s * 0.55);
    return union(0.03, zip, flap(1), flap(-1));
  },
  zipPull: (): SDF => union(0.02, roundBox([0, 2.5, 0.72], [0.035, 0.07, 0.02], 0.015), torus([0, 2.58, 0.7], 0.025, 0.01)),
  scarf: (): SDF => union(0.1, torus([0, 2.84, 0.04], 0.52, 0.2), roundBox([0.3, 2.36, 0.62], [0.15, 0.32, 0.075], 0.065, 0.28)),
  fringe: (): SDF => { const fs: SDF[] = []; for (let i = 0; i < 6; i++) { const x = 0.3 + (i - 2.5) * 0.05 * Math.cos(0.28), z = 0.62 - (i - 2.5) * 0.05 * Math.sin(0.28); fs.push(capsule([x, 2.02, z], [x + 0.01 * (i % 2 ? 1 : -1), 1.9 - (i % 3) * 0.02, z + 0.01], 0.022)); } return union(0.01, ...fs); },
  pack: (): SDF => union(0.06, roundBox([0, 2.0, -0.74], [0.52, 0.58, 0.26], 0.2), roundBox([0, 2.4, -0.78], [0.5, 0.22, 0.28], 0.15), roundBox([0, 1.75, -1.0], [0.34, 0.2, 0.08], 0.07), torus([0, 2.66, -0.72], 0.12, 0.03, Math.PI / 2)),
  /** 背包肩带：从背后翻过肩头，垂到胸前 */
  straps: (): SDF => {
    const one = (s: number) => { const pts: Vec3[] = [[s * 0.3, 2.45, -0.62], [s * 0.4, 2.8, -0.35], [s * 0.44, 2.9, 0.05], [s * 0.45, 2.7, 0.46], [s * 0.47, 2.25, 0.66], [s * 0.5, 1.85, 0.66]];
      return union(0.05, ...pts.slice(1).map((p, i) => roundCone(pts[i], p, 0.09, 0.09))); };
    // 做成贴着外套的扁带子：只留离外套表面 0.01–0.07 的一层
    const raw = union(0, one(1), one(-1)); const jk = SHAPES.jacket(); const sc = SHAPES.scarf();
    return (x, y, z) => { const r = raw(x, y, z); if (r > 0.1) return r; return Math.max(r, Math.abs(jk(x, y, z) - 0.04) - 0.03, -sc(x, y, z) + 0.005); };
  },
  hips: (): SDF => ellipsoid([0, 1.15, 0], [0.62, 0.32, 0.5]),
  sleeve: (s: number): SDF => quilt(roundCone([0, 0, 0], [s * 0.2, -0.78, 0.08], 0.3, 0.24), -0.9, 0.3, 0.03),
  mitten: (s: number): SDF => union(0.08, ellipsoid([s * 0.23, -1.02, 0.1], [0.22, 0.24, 0.2]), sphere([s * 0.1, -0.95, 0.26], 0.09), roundCone([s * 0.2, -0.8, 0.08], [s * 0.21, -0.9, 0.09], 0.2, 0.21)),
  pantLeg: (): SDF => roundCone([0, 0, 0], [0, -0.7, 0], 0.27, 0.235),
  pantCuff: (): SDF => torus([0, -0.7, 0], 0.235, 0.055),
  boot: (): SDF => intersect(0.04, union(0.12, ellipsoid([0, -0.99, 0.12], [0.28, 0.22, 0.4]), roundCone([0, -0.74, 0], [0, -0.96, 0.02], 0.25, 0.27)), (_x, y) => -1.12 - y),
  sole: (): SDF => intersect(0.03, ellipsoid([0, -1.1, 0.12], [0.3, 0.16, 0.43]), (_x, y) => Math.abs(y + 1.155) - 0.045),
  laces: (): SDF => { const fs: SDF[] = []; for (let i = 0; i < 3; i++) { const y = -0.84 - i * 0.075, z = 0.2 + i * 0.05; fs.push(capsule([-0.1, y, z], [0.1, y - 0.03, z + 0.012], 0.018), capsule([0.1, y, z], [-0.1, y - 0.03, z + 0.012], 0.018)); } return union(0.01, ...fs); },
  bootCuff: (): SDF => offset(torus([0, -0.76, 0], 0.22, 0.085), (x, y, z) => 0.02 * noise3(x * 14, y * 14, z * 14) + 0.01 * noise3(x * 31, y * 31, z * 31)),
  // 连衣裙
  bodice: (): SDF => union(0.3, ellipsoid([0, 2.25, 0], [0.7, 0.6, 0.58]), ellipsoid([0, 1.85, 0.02], [0.62, 0.35, 0.52])),
  skirt: (): SDF => intersect(0.08, offset(roundCone([0, 1.85, 0], [0, 1.02, 0], 0.62, 1.02), (x, y, z) => (y < 1.8 ? -0.045 * Math.cos(Math.atan2(x, z) * 8) * Math.min(1, (1.8 - y) / 0.5) : 0)), (_x, y) => 1.02 - y),
  collar: (): SDF => torus([0, 2.84, 0.02], 0.36, 0.1),
  puff: (s: number): SDF => offset(ellipsoid([s * 0.05, -0.02, 0], [0.34, 0.3, 0.32]), (x, y, z) => -0.02 * Math.abs(Math.sin(Math.atan2(x - s * 0.05, z) * 5))),
  arm: (s: number): SDF => union(0.1, roundCone([0, -0.15, 0], [s * 0.2, -0.8, 0.08], 0.2, 0.18), sphere([s * 0.24, -1.0, 0.1], 0.21)),
  bareLeg: (): SDF => roundCone([0, 0, 0], [0, -0.8, 0], 0.24, 0.2),
  sock: (): SDF => roundCone([0, -0.62, 0], [0, -0.9, 0], 0.22, 0.22),
  maryJane: (): SDF => intersect(0.04, ellipsoid([0, -1.02, 0.1], [0.26, 0.2, 0.37]), (_x, y) => -1.19 - y),
  // 载具（同一套圆润语言）
  car: (): SDF => {
    const body = union(0.3, roundBox([0, 0.55, 0], [0.98, 0.36, 1.5], 0.34), ellipsoid([0, 0.98, -0.2], [0.86, 0.5, 0.92]));
    return subtract(0.12, body, roundBox([0, 1.25, 0.05], [0.6, 0.55, 0.62], 0.25));
  },
  wheels: (): SDF => { const w = (x: number, z: number) => roundCone([x - 0.14, 0.3, z], [x + 0.14, 0.3, z], 0.3, 0.3); return union(0, w(0.86, 0.95), w(-0.86, 0.95), w(0.86, -0.95), w(-0.86, -0.95)); },
  boat: (): SDF => union(0.1, intersect(0.1, ellipsoid([0, 0.35, 0], [1.1, 0.55, 2.1]), (_x, y) => y - 0.95), roundBox([0, 0.95, -0.7], [0.6, 0.35, 0.5], 0.2)),
  plane: (): SDF => union(0.18, roundCone([0, 1.1, -1.7], [0, 1.1, 1.3], 0.55, 0.44), roundBox([0, 1.05, 0.1], [2.1, 0.09, 0.5], 0.09), roundBox([0, 1.35, -1.55], [0.75, 0.07, 0.3], 0.06), roundBox([0, 1.75, -1.6], [0.06, 0.45, 0.3], 0.06)),
};


/** 接触阴影：沿法线往外走几步，看离最近的表面（自己或邻居）有多远 —— 距离场版的环境光遮蔽 */
export function bakeAO(m: MeshData, fs: SDF[]): Float32Array {
  const f: SDF = fs.length === 1 ? fs[0] : (x, y, z) => { let d = Infinity; for (const g of fs) d = Math.min(d, g(x, y, z)); return d; };
  const n = m.positions.length / 3; const out = new Float32Array(n * 3); const steps = [0.035, 0.08, 0.14, 0.22];
  for (let i = 0; i < n; i++) {
    const px = m.positions[i * 3], py = m.positions[i * 3 + 1], pz = m.positions[i * 3 + 2]; const nx = m.normals[i * 3], ny = m.normals[i * 3 + 1], nz = m.normals[i * 3 + 2];
    let occ = 0, w = 1;
    for (const d of steps) { const s = f(px + nx * d, py + ny * d, pz + nz * d); occ += w * Math.max(0, d - s) / d; w *= 0.6; }
    const ao = Math.max(0.5, Math.min(1, 1 - occ * 0.55)); out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = ao;
  }
  return out;
}


/** 一个部件的网格说明：用哪个形体（名字 + 参数）、包围盒、格子大小、算接触阴影时的邻居（可带平移） */
export type ShapeRef = [keyof typeof SHAPES, (string | number)?];
export interface PartSpec { key: string; shape: ShapeRef; lo: Vec3; hi: Vec3; cell: number; occ?: { shape: ShapeRef; off?: Vec3 }[] }
export function shapeOf(r: ShapeRef): SDF { const fn = SHAPES[r[0]] as (a?: unknown) => SDF; return fn(r[1]); }
export interface PartMesh extends MeshData { colors: Float32Array }
export function buildPart(spec: PartSpec): PartMesh {
  const f = shapeOf(spec.shape); const m = polygonize(f, spec.lo, spec.hi, spec.cell);
  const occ = (spec.occ ?? []).map((o) => { const g = shapeOf(o.shape); const d = o.off; return d ? ((x: number, y: number, z: number) => g(x + d[0], y + d[1], z + d[2])) as SDF : g; });
  return { ...m, colors: bakeAO(m, [f, ...occ]) };
}
