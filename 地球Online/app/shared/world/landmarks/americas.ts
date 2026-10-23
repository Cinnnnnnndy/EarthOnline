/** 名胜模型：美洲。积木见 ../landmark-kit.ts；每个模型返回 { group, top, footprint, update? }。
 *  约定：原点在地面中心，+y 向上，正面朝 +z；抓住外形特征并夸张 1.2～1.4 倍，细节从简；每个模型不超过 5 种颜色；
 *  同色的小零件合并成一个网格，每个模型不超过 100 个网格。瀑布的水流贴图用 DataTexture 生成（Node 里也能建，测试会把每个模型建一遍）。
 *  本文件自带的件：平面多边形拉伸成板（峡谷分层、崖口、盐沼）、沿崖口的水帘、台阶楔（玛雅金字塔）、车削体按方位变形（山体、衣褶）。 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../../algo/prng.ts";
import { type Maker, type RGB, C, mat, add, box, cyl, ball, prism } from "../landmark-kit.ts";
import { MORE_AMERICAS } from "./americas-more.ts";

type G = THREE.BufferGeometry;
type P2 = [number, number];
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;

// ---------- 调色（真实色往世界的柔和色板上靠）
const WATER: RGB = [110, 180, 214], GRASS: RGB = [140, 176, 130], MARBLE: RGB = [236, 232, 222], FOAM: RGB = [242, 247, 250];
const waterM = (c: RGB = WATER, opacity = 0.92) => mat(c, 0.1, { metalness: 0.05, transparent: true, opacity });
const puffM = (c: RGB = FOAM, opacity = 0.62) => mat(c, 1, { transparent: true, opacity, depthWrite: false });

// ---------- 几何小工具
const _o = new THREE.Object3D(); _o.rotation.order = "YXZ";
/** 把几何体摆到位（先缩放，再绕 z、x、y 转，最后平移），给合并用 */
function at<T extends G>(q: T, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s: number | [number, number, number] = 1): T {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz, "YXZ"); if (Array.isArray(s)) _o.scale.set(s[0], s[1], s[2]); else _o.scale.setScalar(s);
  _o.updateMatrix(); q.applyMatrix4(_o.matrix); return q;
}
const cube = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const sph = (r: number, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
/** 同色零件合成一个几何体（只留 position / normal，要贴图的留 uv） */
function merged(list: G[], uv = false): G {
  const qs = list.map((q) => { const n = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && !(uv && k === "uv")) n.deleteAttribute(k); n.clearGroups(); return n; });
  const out = mergeGeometries(qs, false); if (!out) throw new Error("mergeGeometries failed"); return out;
}
function bake(g: THREE.Group, list: G[], m: THREE.Material, uv = false): THREE.Mesh | null { return list.length ? add(g, merged(list, uv), m) : null; }
/** 平面着色（方台、棱柱要棱角分明） */
function flat(q: G): G { const n = q.index ? q.toNonIndexed() : q; n.computeVertexNormals(); return n; }
const lathe = (pts: P2[], seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(0, r), y)), seg);
/** 车削体 / 球按方位角 phi（绕 y，0 朝 +z）和高度 y 缩放半径：山体起伏、衣褶 */
function warp<T extends G>(q: T, f: (phi: number, y: number) => number): T {
  const p = q.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = f(Math.atan2(x, z), y); p.setXYZ(i, x * k, y, z * k); }
  q.computeVertexNormals(); return q;
}
/** 两点之间的圆杆（a 端半径 r0，b 端 r1） */
function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, n = 10): G {
  const q = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), n);
  q.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5); return q.translate(m.x, m.y, m.z);
}
/** 平面（x, z）上的多边形竖直拉成板：底 y0、高 h，边缘圆角 bevel；holes 为挖掉的洞 */
function slab(pts: P2[], y0: number, h: number, bevel = 0.03, holes: P2[][] = []): G {
  const s = new THREE.Shape(pts.map(([x, z]) => V2(x, -z)));
  for (const hl of holes) s.holes.push(new THREE.Path(hl.map(([x, z]) => V2(x, -z))));
  const b = Math.min(bevel, h / 3);
  const q = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, h - 2 * b), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments: 6 });
  q.rotateX(-Math.PI / 2); q.translate(0, y0 + b, 0); return q;
}
/** 圆角矩形 / 椭圆的轮廓点（x, z） */
function rrect(w: number, d: number, r: number, cx = 0, cz = 0, n = 4): P2[] {
  const out: P2[] = [], hw = w / 2 - r, hd = d / 2 - r, S: P2[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  S.forEach(([sx, sz], k) => { for (let j = 0; j <= n; j++) { const a = (k + j / n) * (Math.PI / 2); out.push([cx + sx * hw + r * Math.cos(a), cz + sz * hd + r * Math.sin(a)]); } });
  return out;
}
const ell = (rx: number, rz: number, cx = 0, cz = 0, n = 32): P2[] => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cz + rz * Math.sin((i / n) * Math.PI * 2)] as P2);
/** 瀑布水帘：沿崖口折线 pts（x, z）从 yt 落到 yb，下沿朝 toward 鼓出 bulge；uv 按世界尺寸，挪 offset.y 就是水在往下流 */
function curtain(pts: P2[], yb: number, yt: number, toward: P2, bulge = 0.1): G {
  const rows: P2[] = [[0, 0], [0.28, 0.7], [1, 1]], pos: number[] = [], uv: number[] = [], idx: number[] = []; let L = 0;
  pts.forEach(([x, z], i) => {
    if (i) L += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const dx = toward[0] - x, dz = toward[1] - z, dl = Math.hypot(dx, dz) || 1;
    for (const [t, b] of rows) { const y = yt + (yb - yt) * t; pos.push(x + (dx / dl) * bulge * b, y, z + (dz / dl) * bulge * b); uv.push(L * 1.4, y * 1.2); }
  });
  const R = rows.length;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < R - 1; j++) { const a = i * R + j, b = a + 1, c = a + R, d = c + 1; idx.push(a, c, b, b, c, d); }
  const q = new THREE.BufferGeometry(); q.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); q.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); q.setIndex(idx); q.computeVertexNormals(); return q;
}
/** 水流贴图：竖向的白色水痕，纯数据生成 */
function flowTex(): THREE.DataTexture {
  const W = 32, H = 64, d = new Uint8Array(W * H * 4), r = mulberry32(21);
  const cols = Array.from({ length: W }, () => ({ ph: r.next(), len: 0.18 + r.next() * 0.3, deep: r.next() < 0.35 }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cols[x], u = (y / H + c.ph) % 1, streak = u < c.len || (u > 0.55 && u < 0.55 + c.len * 0.5);
    const rgb = streak ? [255, 255, 255] : c.deep ? [178, 212, 232] : [216, 236, 248]; d.set([rgb[0], rgb[1], rgb[2], 255], (y * W + x) * 4);
  }
  const t = new THREE.DataTexture(d, W, H); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
const fallMat = (tex: THREE.Texture, tint: RGB = [255, 255, 255]) => new THREE.MeshStandardMaterial({ map: tex, color: C(tint), roughness: 0.3, transparent: true, opacity: 0.95, side: THREE.DoubleSide, emissive: C([206, 230, 246]), emissiveIntensity: 0.22 });
/** 一团云 / 水雾：几个球合成一个 */
const puffs = (list: G[], ps: [number, number, number, number][]) => { for (const [x, y, z, r] of ps) list.push(at(sph(r, 12, 8), x, y, z)); };
/** 两层圆锥的针叶树 */
function pine(list: G[], x: number, z: number, h: number, r: number, y = 0) { list.push(at(new THREE.ConeGeometry(r, h * 0.62, 8), x, y + h * 0.33, z), at(new THREE.ConeGeometry(r * 0.72, h * 0.5, 8), x, y + h * 0.72, z)); }
/** 台阶楔：从外沿 d0（地面）爬到内沿 d1（高 H），宽 width；朝 +z，stepped=false 时是光滑的斜面（栏杆） */
function stairWedge(d0: number, d1: number, H: number, steps: number, width: number, stepped = true): G {
  const pts = [V2(d1, 0), V2(d0, 0)];
  if (stepped) { const run = (d0 - d1) / steps, rise = H / steps; for (let j = 0; j < steps; j++) pts.push(V2(d0 - j * run, (j + 1) * rise), V2(d0 - (j + 1) * run, (j + 1) * rise)); }
  else pts.push(V2(d1, H));
  const q = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: width, bevelEnabled: false }); q.translate(0, 0, -width / 2); q.rotateY(-Math.PI / 2); return q;
}
/** 小锥刺：从 base 沿 dir 伸出 len（自由女神的王冠光芒） */
function spike(base: THREE.Vector3, dir: THREE.Vector3, len: number, r: number): G {
  const q = new THREE.ConeGeometry(r, len, 6); q.translate(0, len / 2, 0); q.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize())); return q.translate(base.x, base.y, base.z);
}

export const MODELS_AMERICAS: Record<string, Maker> = {
  ...MORE_AMERICAS,   // 补充的一批（D87，americas-more.ts）
  // ---------- 自由女神像：星形堡垒 + 花岗岩基座 + 铜绿色的像（高举火炬、七道光芒的王冠、左手抱书板）；像比真实比例放大，基座压矮
  am_liberty: () => {
    const g = new THREE.Group(); const PAT: RGB = [126, 186, 166], GRANITE: RGB = [224, 214, 198], FORT: RGB = [198, 188, 172], FLAME: RGB = [240, 188, 92];
    add(g, cyl(2.0, 2.05, 0.1, 24), mat(GRASS, 0.95), 0, 0.05, 0);
    const star: P2[] = []; for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, rr = i % 2 ? 1.08 : 1.6; star.push([Math.sin(a) * rr, Math.cos(a) * rr]); }
    add(g, slab(star, 0.1, 0.26, 0.03), mat(FORT, 0.85));
    const Pd: G[] = [at(box(1.2, 0.2, 1.2, 0.04), 0, 0.46, 0), at(flat(new THREE.CylinderGeometry(0.4 * Math.SQRT2, 0.48 * Math.SQRT2, 0.7, 4, 1).rotateY(Math.PI / 4)), 0, 0.91, 0),
      at(box(0.96, 0.09, 0.96, 0.03), 0, 1.305, 0), at(box(0.78, 0.17, 0.78, 0.03), 0, 1.435, 0), at(box(0.86, 0.05, 0.86, 0.02), 0, 1.545, 0)];
    for (let k = 0; k < 4; k++) Pd.push(at(box(0.3, 0.34, 0.06, 0.02), Math.sin((k * Math.PI) / 2) * 0.45, 0.93, Math.cos((k * Math.PI) / 2) * 0.45, (k * Math.PI) / 2));
    bake(g, Pd, mat(GRANITE, 0.8));
    const y0 = 1.57, K = 1.2, S: G[] = [];
    const robe = warp(lathe([[0.3, 0], [0.33, 0.06], [0.31, 0.3], [0.27, 0.75], [0.24, 1.15], [0.25, 1.4], [0.28, 1.58], [0.2, 1.7], [0.09, 1.76], [0, 1.78]], 24),
      (phi, y) => 1 + 0.07 * Math.sin(6 * phi + 0.4) * Math.max(0, Math.min(1, (1.35 - y) / 0.25)));
    S.push(at(robe, 0, 0, 0, 0, 0, 0, [1, 1, 0.84]));
    S.push(at(sph(0.18, 16, 12), 0, 1.93, 0.01), at(cyl(0.19, 0.2, 0.08, 16), 0, 2.03, 0));
    const hc = V3(0, 2.04, 0);
    for (let i = 0; i < 7; i++) { const a = (-1 + i / 3) * 1.35, e = 0.3 + 0.32 * (1 - Math.abs(i - 3) / 3), d = V3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); S.push(spike(hc.clone().addScaledVector(d, 0.15), d, 0.42, 0.05)); }
    // 右臂（像的右手在 -x）高举火炬；左臂抱书板
    S.push(rod(V3(-0.2, 1.5, 0), V3(-0.3, 1.95, 0.01), 0.13, 0.1), rod(V3(-0.24, 1.6, 0), V3(-0.4, 2.55, 0.03), 0.09, 0.07), rod(V3(-0.4, 2.48, 0.03), V3(-0.42, 2.74, 0.03), 0.055, 0.06));
    S.push(at(box(0.24, 0.5, 0.08, 0.02), 0.3, 1.18, 0.15, 0, -0.12, 0.22), rod(V3(0.24, 1.58, 0), V3(0.33, 1.3, 0.16), 0.08, 0.065));
    const F: G[] = [at(cyl(0.12, 0.06, 0.1, 14), -0.42, 2.79, 0.03), at(lathe([[0, 0], [0.09, 0.05], [0.1, 0.13], [0.055, 0.26], [0, 0.36]], 14), -0.42, 2.83, 0.03)];
    const up = (q: G) => q.scale(K, K, K).translate(0, y0, 0);
    add(g, up(merged(S)), mat(PAT, 0.6));
    add(g, up(merged(F)), mat(FLAME, 0.35, { metalness: 0.3, emissive: C([255, 190, 90]), emissiveIntensity: 0.35 }));
    return { group: g, top: y0 + 3.19 * K + 0.2, footprint: 1.8 };
  },

  // ---------- 帝国大厦：石灰石色的阶梯形塔身 + 竖向壁柱 + 顶上的系泊塔和天线
  am_empire_state: () => {
    const g = new THREE.Group(); const LIME: RGB = [232, 224, 208], WIN: RGB = [150, 166, 190], MAST: RGB = [210, 214, 222];
    const L: G[] = [], W: G[] = [], M: G[] = [];
    const tier = (w: number, d: number, y: number, h: number, n: number) => {
      W.push(at(box(w - 0.06, h, d - 0.06, 0.02), 0, y + h / 2, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(at(box(0.12, h, 0.12, 0.02), sx * (w / 2 - 0.06), y + h / 2, sz * (d / 2 - 0.06)));
      for (let i = 1; i < n; i++) { const x = -w / 2 + (w * i) / n; for (const sz of [-1, 1]) L.push(at(cube(0.055, h, 0.05), x, y + h / 2, sz * (d / 2 - 0.02))); }
      const m = Math.max(2, Math.round((n * d) / w)); for (let i = 1; i < m; i++) { const z = -d / 2 + (d * i) / m; for (const sx of [-1, 1]) L.push(at(cube(0.05, h, 0.055), sx * (w / 2 - 0.02), y + h / 2, z)); }
      L.push(at(box(w + 0.02, 0.06, d + 0.02, 0.02), 0, y + h - 0.03, 0));
    };
    L.push(at(box(2.1, 0.46, 1.7, 0.05), 0, 0.23, 0)); W.push(at(box(2.14, 0.12, 1.74, 0.02), 0, 0.26, 0));
    tier(1.5, 1.22, 0.46, 0.26, 6); tier(1.12, 0.86, 0.72, 2.56, 7); tier(0.9, 0.7, 3.28, 0.3, 5); tier(0.72, 0.56, 3.58, 0.26, 4); tier(0.56, 0.46, 3.84, 0.18, 3);
    L.push(at(box(0.46, 0.1, 0.46, 0.03), 0, 4.07, 0));
    M.push(at(flat(new THREE.CylinderGeometry(0.13, 0.19, 0.4, 8)), 0, 4.32, 0), at(cyl(0.09, 0.12, 0.1, 12), 0, 4.57, 0), at(sph(0.09, 12, 8), 0, 4.62, 0), rod(V3(0, 4.62, 0), V3(0, 5.3, 0), 0.04, 0.012, 8));
    for (let k = 0; k < 4; k++) M.push(at(box(0.05, 0.46, 0.08, 0.02), Math.sin((k * Math.PI) / 2) * 0.16, 4.3, Math.cos((k * Math.PI) / 2) * 0.16, (k * Math.PI) / 2));
    bake(g, L, mat(LIME, 0.75)); bake(g, W, mat(WIN, 0.35, { metalness: 0.15 })); bake(g, M, mat(MAST, 0.35, { metalness: 0.4 }));
    return { group: g, top: 5.5, footprint: 1.2 };
  },

  // ---------- 金门大桥：国际橘的两座门式塔 + 下垂的主缆和吊索，海湾、两头的岬角、一团雾
  am_golden_gate: () => {
    const g = new THREE.Group(); const OR: RGB = [214, 96, 70], PIER: RGB = [214, 208, 198];
    add(g, slab(ell(2.5, 1.1, 0, 0, 40), 0, 0.06, 0.02), waterM()).castShadow = false;
    const O: G[] = [], P: G[] = [], F: G[] = [];
    O.push(at(box(4.9, 0.14, 0.52, 0.04), 0, 0.72, 0), at(box(4.9, 0.08, 0.4, 0.02), 0, 0.62, 0));
    for (const tx of [-1.25, 1.25]) {
      for (const sz of [-1, 1]) { const z = sz * 0.22; O.push(at(box(0.2, 0.95, 0.2, 0.03), tx, 0.675, z), at(box(0.17, 0.75, 0.17, 0.03), tx, 1.525, z), at(box(0.14, 0.62, 0.14, 0.03), tx, 2.21, z)); }
      for (const [y, h] of [[1.2, 0.1], [1.7, 0.12], [2.18, 0.12], [2.47, 0.14]]) O.push(at(box(0.12, h, 0.46, 0.02), tx, y, 0));
      P.push(at(box(0.5, 0.24, 0.72, 0.05), tx, 0.12, 0));
    }
    for (const x of [-1.95, 1.95]) P.push(at(box(0.16, 0.6, 0.3, 0.03), x, 0.3, 0));
    const cy = (x: number) => { const ax = Math.abs(x); if (ax <= 1.25) return 0.9 + (2.5 - 0.9) * (ax / 1.25) ** 2; const u = (ax - 1.25) / 1.2; return 2.5 + (0.8 - 2.5) * u - 0.16 * Math.sin(Math.PI * u); };
    for (const z of [-0.22, 0.22]) {
      for (const [a, b] of [[-2.45, -1.25], [-1.25, 1.25], [1.25, 2.45]]) { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 12; i++) { const x = a + ((b - a) * i) / 12; pts.push(V3(x, cy(x), z)); } O.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.032, 6, false)); }
      for (let x = -2.3; x <= 2.31; x += 0.15) { if (Math.abs(Math.abs(x) - 1.25) < 0.08) continue; const t = cy(x); if (t - 0.78 > 0.04) O.push(at(cube(0.014, t - 0.78, 0.014), x, (t + 0.78) / 2, z)); }
    }
    bake(g, O, mat(OR, 0.55)); bake(g, P, mat(PIER, 0.85));
    const hill = mat(GRASS, 0.95); add(g, sph(1, 18, 12), hill, 2.28, 0, -0.1).scale.set(0.42, 0.78, 0.9); add(g, sph(1, 18, 12), hill, -2.3, 0, 0.1).scale.set(0.4, 0.66, 0.8);
    puffs(F, [[1.55, 1.35, -0.45, 0.24], [1.85, 1.45, -0.3, 0.3], [2.15, 1.3, -0.2, 0.22], [1.75, 1.2, -0.05, 0.18]]);
    const fog = bake(g, F, puffM([250, 250, 250], 0.72))!; fog.castShadow = false;
    return { group: g, top: 2.75, footprint: 2.5, update: (t) => { fog.position.x = Math.sin(t * 0.25) * 0.2; } };
  },

  // ---------- 大峡谷：从南缘马瑟角往北看：北岸一级级红、奶油、锈色岩层退台下到谷底的科罗拉多河，谷中立着几座平顶的「神庙」孤峰；南岸压低，不挡视线
  am_grand_canyon: () => {
    const g = new THREE.Group(); const RUST: RGB = [166, 86, 70], RED: RGB = [212, 110, 76], CREAM: RGB = [238, 204, 158], RIVER: RGB = [96, 168, 164], SCRUB: RGB = [140, 158, 104];
    const X = 2.3, ZB = -1.8, ZF = 1.8, zc = (x: number) => 0.55 + 0.2 * Math.sin(1.2 * x + 0.5);
    const L: { y: number; h: number; hw: number; c: RGB; amp: number }[] = [
      { y: 0, h: 0.3, hw: 0.26, c: RUST, amp: 0.03 }, { y: 0.3, h: 0.3, hw: 0.46, c: RED, amp: 0.06 }, { y: 0.6, h: 0.34, hw: 0.76, c: CREAM, amp: 0.1 },
      { y: 0.94, h: 0.34, hw: 1.0, c: RED, amp: 0.14 }, { y: 1.28, h: 0.26, hw: 1.18, c: CREAM, amp: 0.16 },
    ];
    const lists = new Map<RGB, G[]>([[RUST, []], [RED, []], [CREAM, []]]);
    L.forEach((l, k) => {
      const hw = (x: number, s: number) => l.hw * (s > 0 ? 0.62 : 1) + l.amp * (0.5 + 0.5 * Math.sin(3.7 * x + k * 1.7 + s)) + 0.05 * Math.sin(9.1 * x + k);
      const N: P2[] = [[-X, ZB], [X, ZB]]; for (let i = 0; i <= 28; i++) { const x = X - (2 * X * i) / 28; N.push([x, zc(x) - hw(x, -1)]); }
      lists.get(l.c)!.push(slab(N, l.y, l.h, 0.04));
      if (k === 0) { const S: P2[] = []; for (let i = 0; i <= 28; i++) { const x = -X + (2 * X * i) / 28; S.push([x, Math.min(ZF - 0.15, zc(x) + hw(x, 1))]); } S.push([X, ZF], [-X, ZF]); lists.get(l.c)!.push(slab(S, 0, 0.18, 0.04)); }
    });
    lists.get(RUST)!.push(slab(rrect(2 * X, ZF - ZB, 0.1), 0, 0.05, 0.02));
    // 谷中的孤峰：坐在第二层上，往上叠出同样的岩层，顶上收尖
    for (const [x, off, s] of [[-1.3, -0.64, 1], [0.1, -0.62, 0.85], [1.35, -0.6, 1.1]] as [number, number, number][]) {
      const z = zc(x) + off;
      lists.get(CREAM)!.push(at(box(0.54 * s, 0.34, 0.44 * s, 0.08), x, 0.77, z)); lists.get(RED)!.push(at(box(0.4 * s, 0.34, 0.33 * s, 0.08), x, 1.11, z));
      lists.get(CREAM)!.push(at(box(0.24 * s, 0.2, 0.2 * s, 0.06), x, 1.38, z));
    }
    for (const [c, l] of lists) bake(g, l, mat(c, 0.9));
    const rv: P2[] = []; for (let i = 0; i <= 30; i++) { const x = -X + (2 * X * i) / 30; rv.push([x, zc(x) - 0.14]); } for (let i = 30; i >= 0; i--) { const x = -X + (2 * X * i) / 30; rv.push([x, zc(x) + 0.14]); }
    add(g, slab(rv, 0.04, 0.04, 0.01), waterM(RIVER, 0.95)).castShadow = false;
    const r = mulberry32(5), SC: G[] = [];
    for (let i = 0; i < 30; i++) {
      const x = -X + 0.2 + r.next() * (2 * X - 0.4), north = i % 3 !== 0;
      if (north) { const zmax = zc(x) - 1.35; if (zmax < ZB + 0.15) continue; SC.push(at(sph(0.07 + r.next() * 0.06, 10, 7), x, 1.55, ZB + 0.12 + r.next() * (zmax - ZB - 0.12), 0, 0, 0, [1, 0.8, 1])); }
      else { const zmin = zc(x) + 0.4; if (zmin > ZF - 0.15) continue; SC.push(at(sph(0.07 + r.next() * 0.05, 10, 7), x, 0.19, zmin + r.next() * (ZF - 0.12 - zmin), 0, 0, 0, [1, 0.8, 1])); }
    }
    bake(g, SC, mat(SCRUB, 0.95));
    return { group: g, top: 1.8, footprint: 2.4 };
  },

  // ---------- 尼亚加拉瀑布：马蹄形的加拿大瀑布 + 一旁笔直的美国瀑布，翡翠色的河、升起的水雾、蓝雨衣挤满的游船
  am_niagara: () => {
    const g = new THREE.Group(); const ROCK: RGB = [160, 148, 136], TURQ: RGB = [100, 184, 180], BLUE: RGB = [84, 124, 200];
    const H = 1.15, arc: P2[] = [];
    for (let i = 0; i <= 16; i++) { const t = Math.PI * 2 - (i / 16) * Math.PI; arc.push([0.85 * Math.cos(t), 0.3 + 0.95 * Math.sin(t)]); }
    const plateau: P2[] = [[-2.3, -1.75], [2.3, -1.75], [2.3, 0.3], ...arc, [-1.5, 0.3], [-1.5, 1.3], [-2.3, 1.3]];
    add(g, slab(plateau, 0, H - 0.08, 0.04), mat(ROCK, 0.9)); add(g, slab(plateau, H - 0.1, 0.12, 0.03), mat(GRASS, 0.95));
    const up = [slab([...arc, [-1.3, -0.1], [-1.3, -1.75], [0.7, -1.75], [0.95, -0.2]], H + 0.01, 0.04, 0), slab([[1.25, 0.3], [2.1, 0.3], [2.15, -0.6], [1.55, -1.75], [1.2, -1.75], [1.3, -0.4]], H + 0.01, 0.04, 0)];
    add(g, merged(up), waterM(TURQ, 0.95)).castShadow = false;
    add(g, slab(rrect(4.6, 2.5, 0.3, 0, 0.5), 0, 0.06, 0.02), waterM(TURQ, 0.95)).castShadow = false;
    const tex = flowTex(); const fm = fallMat(tex);
    const falls = add(g, merged([curtain(arc.map(([x, z]) => [x * 0.98, 0.3 + (z - 0.3) * 0.98] as P2), 0.06, H + 0.03, [0, 0.3], 0.14), curtain([[1.25, 0.32], [1.7, 0.32], [2.1, 0.32]], 0.06, H + 0.03, [1.7, 1.2], 0.1)], true), fm); falls.castShadow = false;
    const B: G[] = []; for (let i = 0; i < 7; i++) B.push(at(sph(0.1 + (i % 3) * 0.03, 10, 7), 1.3 + i * 0.12, 0.08, 0.5 + (i % 2) * 0.08));
    bake(g, B, mat(ROCK, 0.9));
    const M: G[] = []; for (const [x, y, z, rr, sy] of [[-0.45, 0.22, 0.05, 0.3, 0.6], [0.45, 0.22, 0.05, 0.3, 0.6], [0, 0.3, -0.2, 0.36, 0.65], [-0.25, 0.62, -0.3, 0.3, 0.75], [0.28, 0.72, -0.34, 0.28, 0.75], [0, 1.0, -0.42, 0.3, 0.8], [0.18, 1.32, -0.5, 0.24, 0.85], [-0.12, 1.5, -0.5, 0.18, 0.9]] as number[][]) M.push(at(sph(rr, 12, 8), x, y, z, 0, 0, 0, [1.25, sy, 1]));
    const mist = add(g, merged(M), puffM(FOAM, 0.5)); mist.castShadow = false;
    const boat = new THREE.Group(); boat.position.set(0.35, 0.06, 0.95); boat.rotation.y = 0.3; g.add(boat);
    add(boat, box(0.58, 0.12, 0.24, 0.05), mat(FOAM, 0.6), 0, 0.06, 0); add(boat, box(0.44, 0.1, 0.2, 0.04), mat(BLUE, 0.7), -0.02, 0.16, 0); add(boat, box(0.3, 0.03, 0.18, 0.01), mat(FOAM, 0.6), -0.04, 0.25, 0);
    return { group: g, top: 1.95, footprint: 2.4, update: (t) => { tex.offset.y = t * 0.9; mist.scale.setScalar(1 + Math.sin(t * 0.8) * 0.05); mist.rotation.y = Math.sin(t * 0.3) * 0.1; boat.position.y = 0.06 + Math.sin(t * 1.6) * 0.015; boat.rotation.z = Math.sin(t * 1.3) * 0.03; } };
  },

  // ---------- 总统山：灰白花岗岩山崖上凿出的四张脸（华盛顿、杰斐逊、老罗斯福、林肯），脚下碎石坡和松林
  am_rushmore: () => {
    const g = new THREE.Group(); const MT: RGB = [182, 176, 168], FACE: RGB = [232, 226, 216], EYE: RGB = [132, 126, 122], PINE: RGB = [96, 134, 104];
    // 山体：一块立着的崖面（脸凿在它前面）+ 一圈平面着色的碎块，看上去是嶙峋的花岗岩
    const R: G[] = [at(box(4.0, 1.8, 1.4, 0.12), 0, 0.9, -0.72)];
    for (const [x, y, z, sx, sy, sz] of [[-1.4, 1.95, -0.85, 0.75, 0.55, 0.6], [-0.4, 2.12, -1.0, 0.8, 0.5, 0.55], [0.6, 2.08, -0.95, 0.75, 0.5, 0.6], [1.5, 1.85, -0.85, 0.62, 0.5, 0.6],
      [-2.0, 1.25, -0.55, 0.48, 0.72, 0.62], [2.02, 1.15, -0.55, 0.46, 0.66, 0.62], [-1.95, 0.45, 0.0, 0.5, 0.5, 0.5], [2.0, 0.42, 0.0, 0.48, 0.45, 0.5]])
      R.push(at(flat(warp(new THREE.IcosahedronGeometry(1, 1), (phi, y) => 1 + 0.12 * Math.sin(5 * phi + 3 * y + x))), x, y, z, x, 0, 0, [sx, sy, sz]));
    const F: G[] = [at(sph(1, 20, 10), 0, 0.02, 0.35, 0, 0, 0, [2.0, 0.55, 0.6])], E: G[] = [];
    const head = (hx: number, hy: number, hz: number, ry: number, s: number, beard = false) => {
      const P = (q: G) => F.push(at(q, hx, hy, hz, ry, 0, 0, s));
      P(at(sph(1, 16, 12), 0, 0, 0, 0, 0, 0, [0.28, 0.4, 0.26])); P(at(box(0.38, 0.08, 0.14, 0.03), 0, 0.1, 0.19)); P(at(box(0.1, 0.24, 0.15, 0.03), 0, -0.04, 0.25, 0, -0.22));
      P(at(sph(1, 12, 8), 0, -0.25, 0.1, 0, 0, 0, beard ? [0.25, 0.18, 0.17] : [0.2, 0.14, 0.15])); P(at(cyl(0.2, 0.28, 0.55, 12), 0, -0.47, -0.08));
      P(at(sph(1, 12, 8), 0, 0.2, -0.04, 0, 0, 0, [0.3, 0.26, 0.26]));
      for (const sx of [-1, 1]) E.push(at(at(sph(0.055, 8, 6), sx * 0.1, 0.03, 0.2), hx, hy, hz, ry, 0, 0, s));
    };
    head(-1.12, 1.66, 0.36, 0.14, 1.15); head(-0.36, 1.8, 0.16, 0.4, 1.08); head(0.26, 1.58, 0.0, 0.02, 1.02); head(1.02, 1.64, 0.3, -0.16, 1.15, true);
    bake(g, R, mat(MT, 0.9)); bake(g, F, mat(FACE, 0.85)); bake(g, E, mat(EYE, 0.9));
    const T: G[] = [], r = mulberry32(9);
    for (let i = 0; i < 16; i++) { const left = i % 2 === 0, x = (left ? -1 : 1) * (1.0 + r.next() * 1.15), z = 0.35 + r.next() * 1.1; pine(T, x, z, 0.55 + r.next() * 0.4, 0.17 + r.next() * 0.06); }
    for (let i = 0; i < 5; i++) pine(T, -0.9 + i * 0.45 + r.next() * 0.1, 1.2 + r.next() * 0.35, 0.45 + r.next() * 0.2, 0.15);
    bake(g, T, mat(PINE, 0.9));
    return { group: g, top: 2.9, footprint: 2.2 };
  },

  // ---------- 西雅图太空针塔：三对细腿在腰部收拢成沙漏，顶上一只飞碟（白色光环 + 玻璃观景层 + 1962 年的「银河金」屋顶）
  am_space_needle: () => {
    const g = new THREE.Group(); const WH: RGB = [242, 240, 234], CORE: RGB = [200, 200, 196], GLASS: RGB = [158, 202, 228], GOLD: RGB = [232, 170, 98];
    const K: G[] = [at(cyl(0.8, 0.86, 0.1, 24), 0, 0.05, 0), at(cyl(0.1, 0.12, 3.7, 12), 0, 1.9, 0), at(cyl(0.44, 0.44, 0.06, 6), 0, 0.62, 0)];
    const legs: G[] = [], prof: P2[] = [[0.84, 0.08], [0.56, 0.45], [0.3, 0.95], [0.15, 1.45], [0.2, 2.2], [0.28, 3.0], [0.34, 3.5], [0.3, 3.76]];
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 3, rx = Math.sin(a), rz = Math.cos(a), tx = rz * s * 0.06, tz = -rx * s * 0.06;
      legs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(prof.map(([r, y]) => V3(rx * r + tx, y, rz * r + tz))), 30, 0.042, 6, false));
    }
    bake(g, legs, mat(WH, 0.5)); bake(g, K, mat(CORE, 0.6));
    const W: G[] = [lathe([[0.1, 3.58], [0.4, 3.76], [0.78, 3.97], [1.0, 4.1], [1.04, 4.15], [0.98, 4.19], [0.7, 4.2]], 24), lathe([[0.66, 4.39], [0.86, 4.41], [0.86, 4.46], [0.72, 4.48]], 24), rod(V3(0, 4.7, 0), V3(0, 5.3, 0), 0.035, 0.01, 8)];
    bake(g, W, mat(WH, 0.45)); add(g, cyl(0.7, 0.66, 0.2, 24), mat(GLASS, 0.15, { metalness: 0.3 }), 0, 4.3, 0);
    bake(g, [lathe([[0.8, 4.46], [0.58, 4.55], [0.32, 4.64], [0.18, 4.7], [0, 4.71]], 24), at(cyl(0.1, 0.14, 0.1, 14), 0, 4.74, 0)], mat(GOLD, 0.45, { metalness: 0.2 }));
    return { group: g, top: 5.5, footprint: 1.1 };
  },

  // ---------- 多伦多 CN 塔：三片「Y」形翼墙托着细长的混凝土塔身，三分之二处一个带玻璃环的主舱，再上是小天空舱和长天线
  am_cn_tower: () => {
    const g = new THREE.Group(); const CONC: RGB = [228, 224, 216], GLASS: RGB = [146, 186, 218], ANT: RGB = [196, 200, 208];
    const K: G[] = [at(cyl(0.95, 1.0, 0.08, 24), 0, 0.04, 0), at(cyl(0.1, 0.22, 3.3, 12), 0, 1.7, 0)];
    const fin = new THREE.Shape([V2(0, 0), V2(0.62, 0), V2(0.6, 0.12), V2(0.34, 0.7), V2(0.2, 1.8), V2(0.11, 3.3), V2(0, 3.3)]);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + Math.PI / 3, q = new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }); q.translate(0, 0.06, -0.07); K.push(at(q, 0, 0, 0, a - Math.PI / 2)); }
    K.push(lathe([[0.1, 3.18], [0.36, 3.3], [0.54, 3.42], [0.6, 3.46]], 24), lathe([[0.6, 3.64], [0.66, 3.66], [0.66, 3.72], [0.56, 3.75], [0.34, 3.82], [0.1, 3.86]], 24), at(cyl(0.08, 0.1, 0.62, 12), 0, 4.16, 0), at(cyl(0.19, 0.12, 0.05, 16), 0, 4.61, 0), at(cyl(0.12, 0.19, 0.05, 16), 0, 4.44, 0));
    bake(g, K, mat(CONC, 0.7));
    bake(g, [at(cyl(0.58, 0.6, 0.18, 24), 0, 3.55, 0), at(cyl(0.18, 0.18, 0.12, 16), 0, 4.525, 0)], mat(GLASS, 0.15, { metalness: 0.3 }));
    bake(g, [rod(V3(0, 4.62, 0), V3(0, 5.32, 0), 0.06, 0.014, 8), at(cyl(0.07, 0.07, 0.04, 10), 0, 4.82, 0), at(cyl(0.05, 0.05, 0.04, 10), 0, 5.02, 0)], mat(ANT, 0.4, { metalness: 0.4 }));
    return { group: g, top: 5.52, footprint: 1.0 };
  },

  // ---------- 黄石老忠实泉：浅色泉华丘，中间冲起一柱水，上面翻滚的水汽被风吹向一边，前面半圈木栈道，后面一排美国黑松
  am_old_faithful: () => {
    const g = new THREE.Group(); const SINTER: RGB = [230, 224, 210], CRUST: RGB = [218, 172, 124], STEAM: RGB = [250, 251, 252], PINE: RGB = [96, 134, 104], WOOD: RGB = [176, 138, 102];
    const mound = (r: number) => 0.46 * Math.pow(Math.max(0, 1 - r / 1.7), 1.5);
    const p1: P2[] = [], p2: P2[] = []; for (let i = 0; i <= 12; i++) { const r = 1.7 * (1 - i / 12); p1.push([r, mound(r)]); } for (let i = 0; i <= 6; i++) { const r = 0.85 - (0.73 * i) / 6; p2.push([r, mound(r) + 0.012]); }
    add(g, lathe(p1, 24), mat(SINTER, 0.9)); add(g, lathe(p2, 24), mat(CRUST, 0.9, { side: THREE.DoubleSide }));
    const plume = new THREE.Group(); plume.position.y = 0.44; g.add(plume);
    const jet = add(plume, lathe([[0.1, 0], [0.15, 0.3], [0.13, 1.2], [0.17, 1.9], [0.12, 2.3], [0, 2.4]], 16), mat(STEAM, 0.5, { transparent: true, opacity: 0.95 })); jet.castShadow = false;
    const S: G[] = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; S.push(at(sph(0.16, 12, 8), Math.sin(a) * 0.24, 0.1, Math.cos(a) * 0.24, 0, 0, 0, [1, 0.7, 1])); }
    puffs(S, [[0.05, 0.9, 0.04, 0.2], [-0.06, 1.35, -0.03, 0.22], [0.1, 1.8, 0.02, 0.26], [0.02, 2.25, 0, 0.32], [0.3, 2.45, 0.06, 0.34], [0.62, 2.7, 0.02, 0.36], [0.35, 2.85, -0.12, 0.3], [0.92, 2.95, 0.05, 0.3], [0.08, 2.6, 0.12, 0.28], [1.15, 3.1, -0.04, 0.24]]);
    const cloud = add(plume, merged(S), puffM(STEAM, 0.72)); cloud.castShadow = false;
    const Wd: G[] = [], a0 = -1.25, a1 = 1.25, n = 18, walk: P2[] = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; walk.push([Math.sin(a) * 2.12, Math.cos(a) * 2.12]); }
    for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; walk.push([Math.sin(a) * 1.86, Math.cos(a) * 1.86]); }
    Wd.push(slab(walk, 0.12, 0.05, 0.01));
    const rail: THREE.Vector3[] = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; rail.push(V3(Math.sin(a) * 1.9, 0.32, Math.cos(a) * 1.9)); if (i % 3 === 0) Wd.push(at(cube(0.035, 0.32, 0.035), Math.sin(a) * 1.9, 0.16, Math.cos(a) * 1.9)); }
    Wd.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 36, 0.018, 5, false));
    bake(g, Wd, mat(WOOD, 0.85));
    const T: G[] = [], r = mulberry32(4); for (let i = 0; i < 8; i++) { const a = Math.PI * (0.62 + (0.76 * i) / 7), rr = 1.95 + r.next() * 0.35; pine(T, Math.sin(a) * rr, Math.cos(a) * rr, 1.1 + r.next() * 0.55, 0.22); }
    bake(g, T, mat(PINE, 0.9));
    return { group: g, top: 3.95, footprint: 2.2, update: (t) => { const k = 0.5 + 0.5 * Math.sin(t * 1.1); jet.scale.set(1, 0.86 + 0.14 * k, 1); cloud.scale.set(0.96 + 0.06 * k, 0.9 + 0.1 * k, 0.96 + 0.06 * k); cloud.rotation.y = Math.sin(t * 0.3) * 0.25; } };
  },

  // ---------- 里约基督像：陡峭的科尔科瓦多山（绿林 + 灰色岩壁），山顶平台上张开双臂的皂石白色基督像
  am_christ_redeemer: () => {
    const g = new THREE.Group(); const FOREST: RGB = [116, 160, 106], ROCK: RGB = [170, 166, 160], SOAP: RGB = [238, 234, 224];
    const prof: P2[] = [[1.9, 0], [1.75, 0.22], [1.45, 0.6], [1.1, 1.1], [0.78, 1.6], [0.52, 2.0], [0.34, 2.22], [0.18, 2.32], [0, 2.36]];
    const bump = (phi: number, y: number) => (1 + 0.09 * Math.sin(3 * phi + 1) + 0.05 * Math.sin(7 * phi + 2 * y)) * (0.84 + 0.16 * Math.cos(phi) ** 2);
    add(g, warp(lathe(prof, 20), bump), mat(FOREST, 0.95));
    const face = warp(new THREE.LatheGeometry(prof.slice(2, 8).map(([r, y]) => V2(r * 1.025, y)), 6, -0.75, 0.5), bump);
    add(g, face, mat(ROCK, 0.9, { side: THREE.DoubleSide }));
    add(g, cyl(0.3, 0.34, 0.12, 16), mat(ROCK, 0.9), 0, 2.36, 0);
    const y0 = 2.76, S: G[] = [at(box(0.24, 0.36, 0.24, 0.03), 0, 2.6, 0)];
    S.push(at(lathe([[0.14, 0], [0.155, 0.05], [0.13, 0.35], [0.11, 0.7], [0.12, 0.9], [0.14, 1.0], [0.1, 1.08], [0.05, 1.12], [0, 1.13]], 16), 0, y0, 0, 0, 0, 0, [1, 1, 0.75]));
    const arms = new THREE.Shape([V2(-0.74, 1.1), V2(0.74, 1.1), V2(0.75, 1.0), V2(0.36, 0.96), V2(0.13, 0.72), V2(-0.13, 0.72), V2(-0.36, 0.96), V2(-0.75, 1.0)]);
    const aq = new THREE.ExtrudeGeometry(arms, { depth: 0.1, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }); aq.translate(0, y0, -0.05); S.push(aq);
    S.push(at(sph(0.085, 14, 10), 0, y0 + 1.21, 0.01)); for (const sx of [-1, 1]) S.push(at(sph(0.045, 10, 8), sx * 0.77, y0 + 1.05, 0));
    bake(g, S, mat(SOAP, 0.7));
    return { group: g, top: 4.3, footprint: 1.9 };
  },

  // ---------- 马丘比丘：背后尖尖的瓦纳比丘峰，鞍部上一格格无顶的石屋（几间盖着茅草顶），左前方一级级梯田，山间飘着云
  am_machu_picchu: () => {
    const g = new THREE.Group(); const MTN: RGB = [112, 154, 104], GR: RGB = [156, 190, 126], ST: RGB = [206, 198, 184], THATCH: RGB = [186, 150, 100], CLOUD: RGB = [250, 250, 250];
    const M: G[] = [slab(rrect(4.7, 3.5, 0.5, 0, 0.1), 0, 0.2, 0.06)];
    const rug = (phi: number, y: number) => 1 + 0.1 * Math.sin(4 * phi + 0.5) + 0.06 * Math.sin(9 * phi + 3 * y);
    M.push(at(warp(lathe([[1.05, 0], [0.95, 0.5], [0.74, 1.3], [0.52, 2.1], [0.34, 2.75], [0.2, 3.15], [0.08, 3.3], [0, 3.32]], 14), rug), 0.35, 0, -1.2, 0, 0, 0, [1, 1, 0.8]));
    M.push(at(warp(lathe([[0.75, 0], [0.62, 0.5], [0.42, 1.0], [0.16, 1.3], [0, 1.36]], 12), rug), -0.8, 0, -1.4, 0, 0, 0, [1, 1, 0.8]));
    bake(g, M, mat(MTN, 0.95));
    const Sg: G[] = [], Gg: G[] = [];
    for (let k = 3; k >= 0; k--) { const top = 0.62 - 0.1 * (k + 1), w = 3.2 + 0.3 * (k + 1), d = 2.2 + 0.16 * (k + 1), cx = 0.35 - 0.15 * (k + 1), cz = 0.35 + 0.08 * (k + 1); Sg.push(slab(rrect(w, d, 0.3, cx, cz), 0.15, top - 0.18, 0.02)); Gg.push(slab(rrect(w - 0.04, d - 0.04, 0.3, cx, cz), top - 0.04, 0.05, 0.015)); }
    Sg.push(slab(rrect(3.2, 2.2, 0.3, 0.35, 0.35), 0.15, 0.43, 0.02)); Gg.push(slab(rrect(3.16, 2.16, 0.3, 0.35, 0.35), 0.57, 0.05, 0.015));
    const y = 0.62, Th: G[] = [];
    const room = (cx: number, cz: number, w: number, d: number, roof: boolean) => {
      const h = 0.26; Sg.push(at(cube(w, h, 0.05), cx, y + h / 2, cz - d / 2), at(cube(w, h, 0.05), cx, y + h / 2, cz + d / 2), at(cube(0.05, h, d), cx - w / 2, y + h / 2, cz), at(cube(0.05, h, d), cx + w / 2, y + h / 2, cz));
      if (roof) Th.push(at(prism(d + 0.1, 0.24, w + 0.08), cx, y + h, cz, Math.PI / 2));
    };
    for (const [cx, cz, w, d, rf] of [[-0.75, -0.25, 0.5, 0.34, 1], [-0.18, -0.3, 0.44, 0.3, 0], [-0.8, 0.3, 0.42, 0.3, 0], [-0.2, 0.28, 0.42, 0.3, 1], [-0.55, 0.85, 0.5, 0.3, 0],
      [1.0, -0.3, 0.46, 0.32, 0], [1.52, -0.12, 0.4, 0.3, 1], [1.02, 0.34, 0.5, 0.3, 0], [1.56, 0.5, 0.36, 0.3, 0], [1.18, 0.98, 0.44, 0.3, 1]] as [number, number, number, number, number][]) room(cx, cz, w, d, rf === 1);
    Sg.push(at(cyl(0.2, 0.22, 0.34, 16), 0.42, y + 0.17, -0.55));
    bake(g, Sg, mat(ST, 0.9)); bake(g, Gg, mat(GR, 0.95)); bake(g, Th, mat(THATCH, 0.85));
    const Cl: G[] = []; for (const [x, y, z, rr] of [[-0.3, 1.75, -0.75, 0.3], [0.05, 1.85, -0.6, 0.36], [0.45, 1.72, -0.55, 0.28], [-1.6, 1.05, -0.9, 0.24], [-1.3, 1.12, -0.8, 0.3], [1.6, 1.3, -1.0, 0.26]] as number[][]) Cl.push(at(sph(rr, 12, 8), x, y, z, 0, 0, 0, [1.6, 0.55, 1]));
    const cloud = add(g, merged(Cl), puffM(CLOUD, 0.8)); cloud.castShadow = false;
    return { group: g, top: 3.5, footprint: 2.3, update: (t) => { cloud.position.x = Math.sin(t * 0.2) * 0.15; } };
  },

  // ---------- 奇琴伊察库库尔坎金字塔：九层台阶式金字塔，四面各一道带栏杆的大台阶，北面台阶脚下一对羽蛇头，顶上带三道门的神殿
  am_chichen_itza: () => {
    const g = new THREE.Group(); const ST: RGB = [230, 216, 186], SH: RGB = [196, 178, 146], DOOR: RGB = [104, 92, 84];
    add(g, box(4.4, 0.08, 4.0, 0.04), mat(GRASS, 0.95), 0, 0.04, 0);
    const S: G[] = [], D: G[] = [], K: G[] = [], n = 9, h = 0.19, b0 = 2.9, b1 = 1.22, y0 = 0.08, PH = n * h;
    for (let i = 0; i < n; i++) { const w = b0 - ((b0 - b1) * i) / (n - 1); S.push(at(box(w, h, w, 0.03), 0, y0 + h * (i + 0.5), 0)); }
    for (let k = 0; k < 4; k++) {
      S.push(at(stairWedge(b0 / 2 + 0.3, b1 / 2 - 0.05, PH - 0.05, 14, 0.62), 0, y0, 0, (k * Math.PI) / 2));
      for (const sx of [-1, 1]) K.push(at(at(stairWedge(b0 / 2 + 0.34, b1 / 2 - 0.02, PH + 0.02, 1, 0.08, false), sx * 0.35, 0, 0), 0, y0, 0, (k * Math.PI) / 2));
    }
    for (const sx of [-1, 1]) K.push(at(box(0.16, 0.15, 0.22, 0.04), sx * 0.35, y0 + 0.075, b0 / 2 + 0.42));
    const ty = y0 + PH; S.push(at(box(1.0, 0.42, 0.9, 0.03), 0, ty + 0.21, 0)); K.push(at(box(1.08, 0.08, 0.98, 0.02), 0, ty + 0.46, 0), at(box(1.04, 0.07, 0.94, 0.02), 0, ty + 0.36, 0));
    for (const x of [-0.28, 0, 0.28]) D.push(at(cube(0.14, 0.24, 0.02), x, ty + 0.13, 0.455));
    for (const [x, z, ry] of [[0.505, 0, Math.PI / 2], [-0.505, 0, Math.PI / 2], [0, -0.455, 0]] as [number, number, number][]) D.push(at(cube(0.16, 0.24, 0.02), x, ty + 0.13, z, ry));
    bake(g, S, mat(ST, 0.85)); bake(g, K, mat(SH, 0.85)); bake(g, D, mat(DOOR, 0.9));
    return { group: g, top: ty + 0.7, footprint: 2.2 };
  },

  // ---------- 复活节岛摩艾石像：通加里基祭坛上一排背朝大海的深色石像（大头、重眉、长鼻、长耳），其中一尊戴红色石帽
  am_moai: (seed) => {
    const g = new THREE.Group(); const TUFF: RGB = [128, 120, 112], PUKAO: RGB = [184, 104, 80], AHU: RGB = [170, 164, 154];
    add(g, slab(rrect(4.6, 2.8, 0.5, 0, 0.35), 0, 0.08, 0.03), mat(GRASS, 0.95));
    add(g, slab(rrect(4.8, 0.9, 0.3, 0, -1.55), 0, 0.05, 0.02), waterM()).castShadow = false;
    const A: G[] = [at(box(4.1, 0.26, 0.62, 0.05), 0, 0.21, -0.55), at(box(4.1, 0.04, 0.5, 0.02), 0, 0.1, 0.02)];
    const T: G[] = [], Pk: G[] = [], r = mulberry32(seed), Hs = [1.55, 1.8, 1.65, 1.9, 1.6, 1.75];
    Hs.forEach((H, i) => {
      const x = -1.7 + i * 0.68, z = -0.55, yb = 0.34, hb = 0.4 * H, hh = 0.6 * H, ry = (r.next() - 0.5) * 0.12, P = (q: G) => T.push(at(q, x, 0, z, ry));
      P(at(box(0.46, hb, 0.34, 0.07), 0, yb + hb / 2, 0)); const hy = yb + hb - 0.02, top = hy + hh;
      P(at(box(0.4, hh, 0.34, 0.06), 0, hy + hh / 2, -0.01)); P(at(box(0.42, 0.08, 0.12, 0.03), 0, top - 0.2 * hh, 0.15));
      const nb = top - 0.2 * hh - 0.38 * hh; P(at(box(0.11, 0.38 * hh, 0.12, 0.03), 0, nb + 0.19 * hh, 0.19, 0, -0.1)); P(at(cube(0.18, 0.05, 0.1), 0, nb, 0.19));
      P(at(cube(0.3, 0.1, 0.12), 0, hy + 0.08, 0.13)); for (const sx of [-1, 1]) P(at(cube(0.05, 0.42 * hh, 0.1), sx * 0.21, hy + 0.55 * hh, 0));
      if (i === 3) Pk.push(at(cyl(0.19, 0.21, 0.18, 16), x, top + 0.09, z));
    });
    bake(g, A, mat(AHU, 0.9)); bake(g, T, mat(TUFF, 0.9)); bake(g, Pk, mat(PUKAO, 0.85));
    return { group: g, top: 2.62, footprint: 2.3 };
  },

  // ---------- 伊瓜苏瀑布：一大圈被雨林盖住的红褐色崖，几十道瀑布分两级落下，正中是最深的「魔鬼咽喉」，栈道伸到它的边上
  am_iguazu: () => {
    const g = new THREE.Group(); const ROCK: RGB = [150, 110, 92], JUNG: RGB = [104, 156, 96], RIV: RGB = [128, 170, 168], STEEL: RGB = [206, 202, 196];
    const cz = 0.8, RX = 1.95, RZ = 1.75, H1 = 1.25, H2 = 0.6, t0 = 219 * DEG, t1 = -39 * DEG;
    const throat = (th: number) => 0.32 * Math.exp(-(((th - Math.PI / 2) / 0.33) ** 2)), ledge = (th: number) => 0.34 * (1 - Math.exp(-(((th - Math.PI / 2) / 0.55) ** 2)));
    const P = (th: number, grow: number): P2 => [(RX + grow) * Math.cos(th), cz - (RZ + grow) * Math.sin(th)];
    const arcA: P2[] = [], arcB: P2[] = []; for (let i = 0; i <= 48; i++) { const th = t1 + ((t0 - t1) * i) / 48; arcA.push(P(th, throat(th))); arcB.push(P(th, throat(th) - ledge(th))); }
    const outer = (a: P2[]): P2[] => [[-1.9, 1.9], ...Array.from({ length: 7 }, (_, i) => { const t = Math.PI / 2 + (i / 6) * (Math.PI / 2); return [-1.9 + 0.5 * Math.cos(t), 1.4 + 0.5 * Math.sin(t)] as P2; }).slice(1), [-2.4, -1.9], [2.4, -1.9], ...Array.from({ length: 7 }, (_, i) => { const t = (i / 6) * (Math.PI / 2); return [1.9 + 0.5 * Math.cos(t), 1.4 + 0.5 * Math.sin(t)] as P2; }), ...a];
    const R: G[] = [slab(outer(arcA), 0, H1, 0.04), slab(outer(arcB), 0, H2, 0.04)];
    bake(g, R, mat(ROCK, 0.9));
    add(g, slab(outer(arcA), H1 - 0.02, 0.06, 0.02), mat(JUNG, 0.95));
    const band: P2[] = []; const b0 = -25 * DEG, b1 = 205 * DEG; for (let i = 0; i <= 40; i++) { const th = b0 + ((b1 - b0) * i) / 40; band.push(P(th, throat(th))); } for (let i = 40; i >= 0; i--) { const th = b0 + ((b1 - b0) * i) / 40; band.push(P(th, throat(th) + 0.32)); }
    const wat = add(g, merged([slab(band, H1 + 0.02, 0.04, 0), slab(outer(arcB), H2 - 0.01, 0.04, 0), slab(rrect(4.7, 3.7, 0.3), 0.02, 0.05, 0)]), waterM(RIV, 0.96)); wat.castShadow = false;
    const seg = (a: number, b: number, grow: (th: number) => number): P2[] => Array.from({ length: 9 }, (_, i) => { const th = (a + ((b - a) * i) / 8) * DEG; return P(th, grow(th) - 0.02); });
    const C: G[] = [];
    for (const [a, b] of [[-22, -8], [0, 18], [28, 48], [58, 122], [132, 152], [162, 180], [190, 204]]) { const mid = ((a + b) / 2) * DEG, deep = ledge(mid) < 0.05; C.push(curtain(seg(a, b, throat), deep ? 0.07 : H2 + 0.03, H1 + 0.04, [0, cz], deep ? 0.16 : 0.1)); }
    for (const [a, b] of [[-32, -6], [6, 40], [140, 172], [184, 214]]) C.push(curtain(seg(a, b, (th) => throat(th) - ledge(th)), 0.07, H2 + 0.03, [0, cz], 0.1));
    const tex = flowTex(); const falls = add(g, merged(C, true), fallMat(tex, [252, 246, 236])); falls.castShadow = false;
    const J: G[] = [], r = mulberry32(12);
    for (const a of [-8, 0, 18, 28, 48, 58, 122, 132, 152, 162, 180, 190, 204]) { const th = a * DEG, [x, z] = P(th, throat(th) + 0.1); J.push(at(sph(0.14 + r.next() * 0.05, 10, 7), x, H1 + 0.06, z)); }
    for (let i = 0; i < 34; i++) { const th = t1 - 0.1 + r.next() * (t0 - t1 + 0.2), [x, z] = P(th, throat(th) + 0.45 + r.next() * 0.5); if (Math.abs(x) > 2.3 || Math.abs(z) > 1.8) continue; J.push(at(sph(0.16 + r.next() * 0.1, 10, 7), x, H1 + 0.08, z)); }
    bake(g, J, mat(JUNG, 0.95));
    const Mi: G[] = []; puffs(Mi, [[0, 0.35, -0.75, 0.34], [0.2, 0.8, -0.85, 0.34], [-0.15, 1.25, -0.9, 0.36], [0.1, 1.65, -0.95, 0.3], [-0.3, 1.1, -0.7, 0.26]]);
    const mist = add(g, merged(Mi), puffM(FOAM, 0.55)); mist.castShadow = false;
    const [ex, ez] = P(Math.PI / 2 + 0.25, throat(Math.PI / 2 + 0.25) + 0.05), s0 = V3(1.9, H1 + 0.14, -1.75), s1 = V3(ex, H1 + 0.14, ez);
    const Wk: G[] = [rod(s0, s1, 0.05, 0.05, 4)]; for (let i = 0; i <= 6; i++) { const p = s0.clone().lerp(s1, i / 6); Wk.push(at(cube(0.03, 0.14, 0.03), p.x, H1 + 0.06, p.z)); }
    Wk.push(rod(s0.clone().setY(H1 + 0.26), s1.clone().setY(H1 + 0.26), 0.012, 0.012, 4), at(cyl(0.14, 0.14, 0.04, 12), ex, H1 + 0.14, ez));
    bake(g, Wk, mat(STEEL, 0.5, { metalness: 0.3 }));
    return { group: g, top: 2.15, footprint: 2.4, update: (t) => { tex.offset.y = t * 0.9; mist.scale.setScalar(1 + Math.sin(t * 0.7) * 0.06); } };
  },

  // ---------- 乌尤尼盐沼：雪白的六边形盐壳，一片薄水成了「天空之镜」，倒映着越野车；远处印加瓦西岛上立着大仙人掌
  am_uyuni: () => {
    const g = new THREE.Group(); const SALT: RGB = [246, 244, 238], SKY: RGB = [186, 218, 240], ROCK: RGB = [176, 146, 116], CACT: RGB = [122, 164, 112], JEEP: RGB = [214, 104, 84];
    const T = 0.4, ex = 0.75, ez = 0.6, erx = 1.45, erz = 1.0, outline = rrect(4.8, 3.8, 0.8);
    const Sa: G[] = [slab(outline, 0, T, 0.05, [ell(erx, erz, ex, ez, 36)])];
    const R = 0.34; for (let i = -9; i <= 9; i++) for (let j = -7; j <= 7; j++) {
      const x = i * 1.5 * R, z = (j + (i & 1 ? 0.5 : 0)) * Math.sqrt(3) * R;
      if (Math.abs(x) > 2.1 || Math.abs(z) > 1.6 || ((x - ex) / (erx + 0.3)) ** 2 + ((z - ez) / (erz + 0.3)) ** 2 < 1 || (x > 1.9 && Math.abs(z) > 1.2) || (x < -1.9 && Math.abs(z) > 1.2)) continue;
      Sa.push(at(new THREE.TorusGeometry(R * 0.97, 0.022, 3, 6).rotateX(Math.PI / 2), x, T, z));
    }
    bake(g, Sa, mat(SALT, 0.8));
    add(g, slab(ell(erx + 0.02, erz + 0.02, ex, ez, 36), 0, 0.02, 0), mat(SKY, 0.5));
    add(g, slab(ell(erx + 0.01, erz + 0.01, ex, ez, 36), T - 0.035, 0.02, 0), mat(SKY, 0.05, { metalness: 0.45, transparent: true, opacity: 0.5 })).castShadow = false;
    const ix = -1.15, iz = -0.75, Rk: G[] = [at(sph(1, 18, 10), ix, T - 0.12, iz, 0, 0, 0, [1.0, 0.55, 0.72]), at(sph(0.3, 10, 7), ix + 0.85, T - 0.05, iz + 0.25, 0, 0, 0, [1, 0.6, 0.8])];
    const Ca: G[] = [], cr = mulberry32(3);
    for (const [dx, dz, h] of [[-0.35, 0.1, 0.8], [0.05, -0.15, 1.0], [0.4, 0.15, 0.7], [-0.1, 0.35, 0.6], [0.55, -0.25, 0.85], [-0.55, -0.3, 0.75]] as [number, number, number][]) {
      const x = ix + dx, z = iz + dz, yb = T - 0.12 + 0.55 * Math.sqrt(Math.max(0, 1 - dx * dx - (dz / 0.72) ** 2)) - 0.04;
      Ca.push(at(cyl(0.065, 0.075, h, 10), x, yb + h / 2, z), at(sph(0.065, 10, 6), x, yb + h, z));
      const arms = 1 + cr.int(2); for (let k = 0; k < arms; k++) { const s = k ? -1 : 1, ay = yb + h * (0.4 + 0.12 * k), ah = 0.22 + cr.next() * 0.12; Ca.push(at(cyl(0.045, 0.045, 0.14, 8), x + s * 0.09, ay, z, 0, 0, Math.PI / 2), at(cyl(0.045, 0.045, ah, 8), x + s * 0.16, ay + ah / 2, z), at(sph(0.045, 8, 6), x + s * 0.16, ay + ah, z)); }
    }
    bake(g, Rk, mat(ROCK, 0.9)); bake(g, Ca, mat(CACT, 0.8));
    // 越野车和两个人站在镜面上；镜面下面放一份上下颠倒的，透过半透明的水看是倒影
    const car = new THREE.Group(); car.position.set(0.9, T, 0.55); car.rotation.y = -0.5; g.add(car);
    add(car, box(0.48, 0.14, 0.24, 0.04), mat(JEEP, 0.55), 0, 0.12, 0); add(car, box(0.3, 0.13, 0.22, 0.03), mat(JEEP, 0.55), -0.05, 0.25, 0); add(car, box(0.31, 0.05, 0.225, 0.01), mat(SKY, 0.1, { metalness: 0.3 }), -0.05, 0.25, 0);
    add(car, box(0.28, 0.03, 0.2, 0.01), mat(ROCK, 0.8), -0.05, 0.33, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(car, cyl(0.06, 0.06, 0.05, 12), mat(ROCK, 0.8), sx * 0.15, 0.06, sz * 0.12).rotation.x = Math.PI / 2;
    for (const [px, pz, c] of [[0.35, 0.28, JEEP], [0.5, 0.08, SKY]] as [number, number, RGB][]) { add(car, cyl(0.035, 0.045, 0.2, 8), mat(c, 0.7), px, 0.1, pz); add(car, sph(0.04, 10, 8), mat(SALT, 0.7), px, 0.24, pz); }
    car.scale.setScalar(1.25); const refl = car.clone(); refl.scale.y = -1.25; refl.position.y = T - 0.035; g.add(refl);
    return { group: g, top: 2.05, footprint: 2.4 };
  },

  // ---------- 蒂卡尔一号神庙（大美洲豹神庙）：九层陡峭的台基、正面一道直上的台阶、顶上小神殿和高高的屋冠，从雨林里冒出来
  am_tikal: (seed) => {
    const g = new THREE.Group(); const ST: RGB = [208, 200, 180], DK: RGB = [150, 146, 136], J1: RGB = [124, 172, 110], J2: RGB = [86, 138, 92];
    add(g, slab(rrect(4.7, 3.9, 0.6), 0, 0.06, 0.03), mat(J1, 0.95));
    const S: G[] = [], D: G[] = [], n = 9, h = 0.28, y0 = 0.06, PH = n * h;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); S.push(at(box(1.6 - 0.86 * t, h, 1.44 - 0.8 * t, 0.03), 0, y0 + h * (i + 0.5), -0.05)); }
    S.push(at(stairWedge(0.98, 0.3, PH - 0.02, 18, 0.46), 0, y0, 0));
    for (const sx of [-1, 1]) D.push(at(at(stairWedge(1.0, 0.3, PH, 1, 0.05, false), sx * 0.255, 0, 0), 0, y0, 0));
    const ty = y0 + PH; S.push(at(box(0.64, 0.5, 0.52, 0.03), 0, ty + 0.25, -0.05)); D.push(at(cube(0.16, 0.28, 0.02), 0, ty + 0.16, 0.215));
    D.push(at(flat(new THREE.CylinderGeometry(0.2 * Math.SQRT2, 0.27 * Math.SQRT2, 0.72, 4, 1).rotateY(Math.PI / 4)), 0, ty + 0.86, -0.12, 0, 0, 0, [1, 1, 0.45]), at(box(0.6, 0.05, 0.3, 0.02), 0, ty + 0.72, -0.1));
    bake(g, S, mat(ST, 0.85)); bake(g, D, mat(DK, 0.9));
    const r = mulberry32(seed), A: G[] = [], B: G[] = [];
    for (let i = 0; i < 70 && A.length + B.length < 34; i++) {
      const x = (r.next() - 0.5) * 4.3, z = (r.next() - 0.5) * 3.5, s = 0.26 + r.next() * 0.22;
      if ((Math.abs(x) < 1.05 && Math.abs(z + 0.05) < 0.95) || (Math.abs(x) < 0.8 && z > 0)) continue;
      (i % 2 ? A : B).push(at(sph(s, 12, 8), x, s * 0.9 + (z < -0.5 ? 0.15 : 0), z, 0, 0, 0, [1, 0.85, 1]));
    }
    bake(g, A, mat(J1, 0.95)); bake(g, B, mat(J2, 0.95));
    return { group: g, top: ty + 1.44, footprint: 2.3 };
  },

  // ---------- 白宫（南面）：白色主楼，正中半圆形的南门廊（六根柱子 + 杜鲁门阳台），屋顶飘着星条旗，南草坪上一个喷泉
  am_white_house: () => {
    const g = new THREE.Group(); const WH: RGB = [246, 244, 238], ROOF: RGB = [196, 200, 208], WIN: RGB = [118, 134, 176], RED: RGB = [204, 88, 80];
    add(g, box(4.4, 0.06, 3.2, 0.03), mat(GRASS, 0.95), 0, 0.03, 0);
    const W: G[] = [at(box(2.7, 1.0, 1.1, 0.04), 0, 0.56, -0.45), at(box(2.76, 0.1, 1.16, 0.02), 0, 1.11, -0.45)];
    for (const sx of [-1, 1]) W.push(at(box(0.8, 0.5, 0.7, 0.03), sx * 1.8, 0.31, -0.6), at(cube(0.12, 0.2, 0.12), sx * 0.8, 1.36, -0.45));
    const half = (r: number, h: number, y: number) => at(new THREE.CylinderGeometry(r, r, h, 24, 1, false, -Math.PI / 2, Math.PI), 0, y, 0.1);
    W.push(half(0.62, 0.2, 0.16), half(0.36, 0.8, 0.66), half(0.6, 0.05, 0.56), half(0.64, 0.1, 1.11));
    for (const a of [-1.3, -0.8, -0.3, 0.3, 0.8, 1.3]) W.push(at(cyl(0.04, 0.045, 0.8, 10), Math.sin(a) * 0.54, 0.66, 0.1 + Math.cos(a) * 0.54));
    W.push(at(new THREE.TorusGeometry(0.6, 0.012, 4, 20, Math.PI), 0, 0.66, 0.1, 0, Math.PI / 2, 0));
    W.push(at(cyl(0.38, 0.4, 0.08, 20), 0, 0.1, 1.05), at(cyl(0.05, 0.07, 0.24, 10), 0, 0.2, 1.05));
    const Wn: G[] = [at(cyl(0.33, 0.33, 0.04, 20), 0, 0.13, 1.05)];
    for (const x of [0.62, 0.9, 1.18]) for (const sx of [-1, 1]) for (const y of [0.36, 0.78]) Wn.push(at(cube(0.14, 0.24, 0.02), sx * x, y, 0.105));
    for (const a of [-0.6, 0, 0.6]) for (const y of [0.4, 0.8]) Wn.push(at(cube(0.1, 0.24, 0.02), Math.sin(a) * 0.365, y, 0.1 + Math.cos(a) * 0.365, a));
    bake(g, W, mat(WH, 0.6)); bake(g, Wn, mat(WIN, 0.4, { metalness: 0.1 }));
    add(g, box(2.5, 0.1, 0.9, 0.03), mat(ROOF, 0.7), 0, 1.21, -0.45);
    add(g, cyl(0.015, 0.015, 1.0, 8), mat(WH, 0.5), 0, 1.76, -0.45);
    const flag = new THREE.Group(); flag.position.set(0.01, 2.22, -0.45); g.add(flag);
    const Fr: G[] = [], Fw: G[] = []; for (let i = 0; i < 7; i++) (i % 2 ? Fw : Fr).push(at(cube(0.5, 0.04, 0.012), 0.26, -0.02 - i * 0.04, 0));
    bake(flag, Fr, mat(RED, 0.6)); bake(flag, Fw, mat(WH, 0.6)); add(flag, cube(0.2, 0.16, 0.016), mat(WIN, 0.6), 0.11, -0.08, 0);
    return { group: g, top: 2.45, footprint: 2.2, update: (t) => { flag.rotation.y = Math.sin(t * 2) * 0.2; } };
  },

  // ---------- 纪念碑谷：红土平原上两座「手套」孤峰（大块岩体 + 一根拇指石柱）和梅里克孤峰，高高的碎石裙边，一条直直通向它们的公路
  am_monument_valley: (seed) => {
    const g = new THREE.Group(); const FLOOR: RGB = [236, 178, 132], TAL: RGB = [212, 132, 94], BUT: RGB = [184, 92, 66], SCRUB: RGB = [150, 158, 108], ROAD: RGB = [120, 118, 122];
    const Fl: G[] = [slab(rrect(4.8, 3.8, 0.6), 0, 0.08, 0.03)], Ta: G[] = [], Bu: G[] = [], rr = mulberry32(17);
    const skirt = (x: number, z: number, sx: number, sz: number, top: number) => Ta.push(at(lathe([[1, 0], [0.8, 0.12 * top], [0.62, 0.36 * top], [0.52, 0.7 * top], [0.48, top]], 16), x, 0.06, z, 0, 0, 0, [sx, 1, sz]));
    /** 平面不规则的岩体：竖直的崖壁、平顶 */
    const rock = (x: number, z: number, w: number, d: number, y: number, h: number, n = 10) => {
      const pts: P2[] = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = 0.88 + rr.next() * 0.2; pts.push([x + (w / 2) * k * Math.sign(c) * Math.pow(Math.abs(c), 0.6), z + (d / 2) * k * Math.sign(s) * Math.pow(Math.abs(s), 0.6)]); }
      Bu.push(slab(pts, y, h, 0.05));
    };
    const butte = (x: number, z: number, w: number, d: number, h: number, ts: number, thumb: [number, number, number] | null) => {
      skirt(x, z, w * 1.2, d * 1.45, ts); rock(x, z, w, d, ts - 0.06, h);
      if (thumb) { const [dx, tw, th] = thumb; skirt(x + dx, z, tw * 2.6, tw * 2.8, ts * 0.9); rock(x + dx, z, tw, tw * 1.2, ts * 0.9 - 0.05, th, 8); }
    };
    butte(-1.4, -0.5, 0.78, 0.5, 1.12, 0.62, [0.58, 0.17, 0.98]); butte(0.25, -1.0, 0.74, 0.5, 1.02, 0.6, [0.55, 0.16, 0.9]); butte(1.72, -0.3, 0.72, 0.62, 0.78, 0.55, null);
    bake(g, Fl, mat(FLOOR, 0.95)); bake(g, Ta, mat(TAL, 0.95)); bake(g, Bu, mat(BUT, 0.9));
    bake(g, [slab([[-0.26, 1.9], [0.26, 1.9], [0.14, 0.4], [0.08, 0.1], [-0.02, 0.1], [-0.08, 0.4]], 0.07, 0.03, 0)], mat(ROAD, 0.8));
    const Ds: G[] = []; for (let i = 0; i < 6; i++) { const t = i / 6; Ds.push(at(cube(0.03, 0.012, 0.13), 0.0 + t * 0.03, 0.105, 1.75 - t * 1.5)); }
    bake(g, Ds, mat(FLOOR, 0.8));
    const r = mulberry32(seed), Sc: G[] = []; for (let i = 0; i < 44; i++) { const x = (r.next() - 0.5) * 4.4, z = (r.next() - 0.5) * 3.4; if (Math.abs(x) < 0.35 && z > 0) continue; Sc.push(at(sph(0.05 + r.next() * 0.05, 8, 6), x, 0.1, z, 0, 0, 0, [1, 0.7, 1])); }
    bake(g, Sc, mat(SCRUB, 0.95));
    return { group: g, top: 1.95, footprint: 2.4 };
  },

  // ---------- 好莱坞标志：李山干黄褐的山坡（高度场，点缀灌木），坡上九个白色大字 HOLLYWOOD，有点歪歪扭扭；右边山顶是李山的发射塔
  am_hollywood: (seed) => {
    const g = new THREE.Group(); const HILL: RGB = [190, 172, 120], BRUSH: RGB = [118, 142, 98], WH: RGB = [248, 248, 244];
    const bell = (v: number) => (v >= 1 ? 0 : (Math.cos(v * Math.PI) + 1) / 2);
    const H = (x: number, z: number) => {
      const ridge = z > -0.75 ? 1.5 * bell((z + 0.75) / 2.1) : 1.5 * bell((-0.75 - z) / 1.2), ends = 1 - Math.max(0, Math.min(1, (Math.abs(x) - 1.6) / 0.8)) ** 2;
      return Math.max(0, (ridge + 0.3 * Math.exp(-((x - 1.0) ** 2) / 0.25 - ((z + 0.8) ** 2) / 0.2) + 0.18 * Math.exp(-((x + 1.3) ** 2) / 0.35 - ((z + 0.75) ** 2) / 0.25) + 0.05 * Math.sin(3.1 * x + 1) * bell(Math.abs(z + 0.3) / 1.5)) * ends);
    };
    const pl = new THREE.PlaneGeometry(4.8, 3.3, 48, 33).rotateX(-Math.PI / 2).translate(0, 0, -0.3), p = pl.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)));
    pl.computeVertexNormals(); add(g, pl, mat(HILL, 0.95, { side: THREE.DoubleSide }));
    const S = 0.09, D = 0.07, L: G[] = [];
    const bar = (x1: number, y1: number, x2: number, y2: number): G => at(new THREE.BoxGeometry(Math.hypot(x2 - x1, y2 - y1) + S * 0.4, S, D), (x1 + x2) / 2, (y1 + y2) / 2, 0, 0, 0, Math.atan2(y2 - y1, x2 - x1));
    const band = (cx: number, rxo: number, ryo: number, rxi: number, ryi: number, a0: number, a1: number, closed: boolean): G => {
      const n = 20, o: THREE.Vector2[] = [], inn: THREE.Vector2[] = [];
      for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push(V2(cx + rxo * Math.cos(a), 0.3 + ryo * Math.sin(a))); inn.push(V2(cx + rxi * Math.cos(a), 0.3 + ryi * Math.sin(a))); }
      const s = closed ? new THREE.Shape(o.slice(0, n)) : new THREE.Shape([...o, ...inn.reverse()]); if (closed) s.holes.push(new THREE.Path(inn.slice(0, n)));
      return new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -D / 2);
    };
    const glyph: Record<string, () => G[]> = {
      H: () => [bar(-0.14, 0, -0.14, 0.6), bar(0.14, 0, 0.14, 0.6), bar(-0.14, 0.31, 0.14, 0.31)],
      O: () => [band(0, 0.19, 0.3, 0.1, 0.2, 0, Math.PI * 2, true)],
      L: () => [bar(-0.13, 0, -0.13, 0.6), bar(-0.13, S / 2, 0.16, S / 2)],
      Y: () => [bar(-0.17, 0.6, 0, 0.29), bar(0.17, 0.6, 0, 0.29), bar(0, 0, 0, 0.32)],
      W: () => [bar(-0.22, 0.6, -0.11, 0), bar(-0.11, 0, 0, 0.45), bar(0, 0.45, 0.11, 0), bar(0.11, 0, 0.22, 0.6)],
      D: () => [bar(-0.14, 0, -0.14, 0.6), band(-0.14, 0.32, 0.3, 0.225, 0.205, -Math.PI / 2, Math.PI / 2, false)],
    };
    const r = mulberry32(seed), zL = 0.36;
    [..."HOLLYWOOD"].forEach((ch, i) => { const x = (i - 4) * 0.5, yb = Math.max(H(x - 0.18, zL - 0.05), H(x + 0.18, zL - 0.05)) - 0.02 + r.next() * 0.03; for (const q of glyph[ch]()) L.push(at(q, x, yb, zL, (r.next() - 0.5) * 0.08, -0.05, (r.next() - 0.5) * 0.06)); });
    L.push(rod(V3(1.0, H(1.0, -0.8) - 0.05, -0.8), V3(1.0, H(1.0, -0.8) + 0.5, -0.8), 0.03, 0.012, 6), at(cube(0.2, 0.12, 0.12), 1.0, H(1.0, -0.8) + 0.04, -0.8));
    bake(g, L, mat(WH, 0.55));
    const B: G[] = []; for (let i = 0; i < 90 && B.length < 56; i++) { const x = (r.next() - 0.5) * 4.3, z = 1.1 - r.next() * 2.8; if (z > 0.2 && z < 0.55 && Math.abs(x) < 2.3) continue; const y = H(x, z); if (y < 0.05) continue; B.push(at(sph(0.06 + r.next() * 0.07, 8, 6), x, y + 0.02, z, 0, 0, 0, [1, 0.75, 1])); }
    bake(g, B, mat(BRUSH, 0.95));
    return { group: g, top: 2.45, footprint: 2.4 };
  },
};
