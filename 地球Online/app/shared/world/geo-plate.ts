/** 地理切块底板：「这一天」是从地球上切下来的一块，漂在平面插画天空里。
 *  真实海岸线（Natural Earth 1:10m）+ 程序地形（按地区风格：冰岛苔原与冰川、挪威峡湾尖峰、丹麦平原、城市）+ 真实路形（用户的 OSRM 折线）
 *  + 地标模板 + 装饰；四周是地层切面，底下是锥形的岩石底座（像插画里的浮空岛）。 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Day, WorldSpec } from "../spec/types.ts";
import type { Route } from "../algo/route.ts";
import { project, type GeoFrame } from "../algo/geo.ts";
import type { Ring } from "../geo/topo.ts";
import { mulberry32 } from "../algo/prng.ts";
import { noise3 } from "./sdf.ts";
import { landmarkFor, NORDIC, type Landmark } from "./landmarks.ts";
import { col, toneOf, LANTERN, type WorldStyle, type RGB } from "./style.ts";
import type { NightSpots } from "./night.ts";
import features from "../rules/geo-features.json" with { type: "json" };

export interface GeoPlateBuild {
  group: THREE.Group; pins: Map<string, THREE.Group>; landmarks: Map<string, THREE.Group>; ribbon: THREE.Mesh | null;
  heightAt(x: number, z: number): number; anchorTop(entryId: string): number; update(t: number): void; dispose(): void; cols: number; rows: number;
  nightSpots: NightSpots;
}
type Region = "iceland" | "fjord" | "flat" | "hilly";
function regionOf(lat: number, lng: number): Region {
  if (lat > 62.8 && lat < 67 && lng > -25 && lng < -13) return "iceland";
  if (lat > 54.3 && lat < 57.9 && lng > 7.8 && lng < 13) return "flat";
  if (lat > 58 && lng > 3 && lng < 32 && (lat > 60.2 || lng < 8)) return "fjord";
  return "hilly";
}
const REGION: Record<Region, { amp: number; ridge: number; freq: number; grass: RGB; grass2: RGB; rock: RGB; snowLine: number; shore: RGB; tree: number }> = {
  iceland: { amp: 1.5, ridge: 0.25, freq: 0.11, grass: [112, 150, 86], grass2: [150, 150, 96], rock: [104, 98, 96], snowLine: 2.3, shore: [58, 58, 64], tree: 0.03 },
  fjord: { amp: 3.6, ridge: 0.8, freq: 0.14, grass: [96, 156, 90], grass2: [74, 132, 82], rock: [122, 124, 128], snowLine: 3.7, shore: [210, 200, 170], tree: 0.3 },
  flat: { amp: 0.3, ridge: 0, freq: 0.08, grass: [132, 178, 100], grass2: [168, 190, 110], rock: [150, 140, 120], snowLine: 99, shore: [226, 214, 180], tree: 0.35 },
  hilly: { amp: 1.4, ridge: 0.3, freq: 0.1, grass: [104, 164, 96], grass2: [132, 176, 100], rock: [128, 126, 124], snowLine: 3.6, shore: [226, 214, 180], tree: 0.4 },
};
const GX = 193, GY = 133;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
function fbm(x: number, y: number, oct = 4) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, 7.3 * i); a *= 0.5; f *= 2.03; } return s; }
function ridged(x: number, y: number, oct = 4) { let a = 0.55, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise3(x * f, y * f, 3.1 * i))) ** 2; a *= 0.5; f *= 2.1; } return s; }

export function buildGeoPlate(day: Day, f: GeoFrame, route: Route, spec: WorldSpec, style: WorldStyle, land: Ring[][]): GeoPlateBuild {
  const g = new THREE.Group(); g.name = "geo-plate"; const mats: THREE.Material[] = []; const geos: THREE.BufferGeometry[] = []; const updaters: ((t: number) => void)[] = [];
  const W = f.cols, H = f.rows; const rng = mulberry32(spec.seed ^ Math.round(f.lat0 * 1000));
  const reg = regionOf(f.lat0, f.lng0); const R = REGION[reg]; const city = f.widthKm < 26;
  const ampK = Math.max(0.35, Math.min(1.2, f.kmPerUnit / 2.2)) * (city ? 0.45 : 1);
  const T = toneOf(style);                                   // 夜里（D85）：这里写死的颜色都压暗、偏蓝
  const M = (c: RGB | number, rough = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) => { const m = new THREE.MeshStandardMaterial({ color: typeof c === "number" ? new THREE.Color(c) : col(T(c)), roughness: rough, ...extra }); mats.push(m); return m; };
  const spots: NightSpots = { ground: [], lamps: [], houses: [], fire: null, cols: f.cols, rows: f.rows };
  const G = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };

  // ---------- 陆地遮罩（2× 超采样后取平均，得到海岸的小数覆盖率）
  const S = 2, cw = (GX - 1) * S + 1, ch = (GY - 1) * S + 1;
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch; const cx = cv.getContext("2d", { willReadFrequently: true })!;
  cx.fillStyle = "#000"; cx.fillRect(0, 0, cw, ch); cx.fillStyle = "#fff";
  const pad = 1.5; const { minLat, maxLat, minLng, maxLng } = f.bbox;
  const toPx = (lat: number, lng: number): [number, number] => { const [x, y] = project(f, lat, lng); return [(x / W) * (cw - 1), (y / H) * (ch - 1)]; };
  cx.beginPath();
  for (const poly of land) {
    let hit = false; for (const [lng, lat] of poly[0]) if (lat > minLat - pad && lat < maxLat + pad && lng > minLng - pad * 2 && lng < maxLng + pad * 2) { hit = true; break; }
    if (!hit) continue;
    for (const ring of poly) { ring.forEach(([lng, lat], i) => { const [px, py] = toPx(lat, lng); if (i) cx.lineTo(px, py); else cx.moveTo(px, py); }); cx.closePath(); }
  }
  cx.fill("evenodd");
  // 湖（挖掉）与冰川（记下）
  const inEllipse = (e: { lat: number; lng: number; rx: number; ry: number; rot: number }, x: number, y: number) => {
    const [ex, ey] = project(f, e.lat, e.lng); const r = (e.rot * Math.PI) / 180; const dx = (x - ex) * f.kmPerUnit, dy = (y - ey) * f.kmPerUnit;
    const u = dx * Math.cos(r) - dy * Math.sin(r), v = dx * Math.sin(r) + dy * Math.cos(r); return (u / e.rx) ** 2 + (v / e.ry) ** 2;
  };
  const img = cx.getImageData(0, 0, cw, ch).data;
  const landF = new Float32Array(GX * GY); const idx = (i: number, j: number) => j * GX + i;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const px = Math.min(cw - 1, Math.max(0, i * S + di)), py = Math.min(ch - 1, Math.max(0, j * S + dj)); s += img[(py * cw + px) * 4]; n++; }
    let v = s / n / 255; const x = (i / (GX - 1)) * W, y = (j / (GY - 1)) * H;
    for (const l of features.lakes) { const d = inEllipse(l, x, y); if (d < 1.15) v = Math.min(v, clamp01((d - 0.85) / 0.3)); }
    landF[idx(i, j)] = v;
  }
  // 路（非轮渡、非航班）经过的格子一定是陆地（10m 海岸线会把沿海公路切进海里）
  const roadPts: [number, number][] = []; const shipPts: [number, number][] = [];
  for (const sg of route.segments) for (let k = sg.start; k <= sg.end; k++) { const p = route.path[k]; if (!p) continue; if (sg.mode === "ship") shipPts.push(p); else if (sg.mode !== "flight") roadPts.push(p); }
  for (const [x, y] of roadPts) { const ci = Math.round((x / W) * (GX - 1)), cj = Math.round((y / H) * (GY - 1)); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = idx(Math.min(GX - 1, Math.max(0, ci + di)), Math.min(GY - 1, Math.max(0, cj + dj))); landF[k] = Math.max(landF[k], dj === 0 && di === 0 ? 1 : 0.75); } }

  // ---------- 离岸距离（倒角距离变换，单位：底板单位）
  const cell = W / (GX - 1); const INF = 1e9;
  const dLand = new Float32Array(GX * GY), dSea = new Float32Array(GX * GY);
  for (let k = 0; k < GX * GY; k++) { dLand[k] = landF[k] > 0.5 ? INF : 0; dSea[k] = landF[k] > 0.5 ? 0 : INF; }
  const chamfer = (d: Float32Array) => {
    const a = cell, b = cell * Math.SQRT2;
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { let v = d[idx(i, j)]; if (i > 0) v = Math.min(v, d[idx(i - 1, j)] + a); if (j > 0) { v = Math.min(v, d[idx(i, j - 1)] + a); if (i > 0) v = Math.min(v, d[idx(i - 1, j - 1)] + b); if (i < GX - 1) v = Math.min(v, d[idx(i + 1, j - 1)] + b); } d[idx(i, j)] = v; }
    for (let j = GY - 1; j >= 0; j--) for (let i = GX - 1; i >= 0; i--) { let v = d[idx(i, j)]; if (i < GX - 1) v = Math.min(v, d[idx(i + 1, j)] + a); if (j < GY - 1) { v = Math.min(v, d[idx(i, j + 1)] + a); if (i < GX - 1) v = Math.min(v, d[idx(i + 1, j + 1)] + b); if (i > 0) v = Math.min(v, d[idx(i - 1, j + 1)] + b); } d[idx(i, j)] = v; }
  };
  chamfer(dLand); chamfer(dSea);
  // ---------- 高度
  const hgt = new Float32Array(GX * GY); const glac = new Float32Array(GX * GY);
  const off = rng.next() * 100; const fq = R.freq / ampK;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const k = idx(i, j); const x = (i / (GX - 1)) * W, y = (j / (GY - 1)) * H; const lf = landF[k];
    if (lf <= 0.5) { hgt[k] = lerp(-0.18, -0.95, clamp01(dSea[k] / 6)) + (lf - 0.5) * 0.2; continue; }
    const inland = clamp01(dLand[k] / (reg === "fjord" ? 1.2 : 3.5));
    const base = fbm(x * fq + off, y * fq) * 0.5 + 0.5; const rd = ridged(x * fq * 1.3 + off, y * fq * 1.3);
    let h = 0.12 + inland * R.amp * ampK * (base * (1 - R.ridge) + rd * R.ridge * 1.4);
    let gl = 0; for (const e of features.glaciers) { const d = inEllipse(e, x, y); if (d < 1.3) gl = Math.max(gl, clamp01((1.3 - d) / 0.5)); }
    if (gl > 0) h += gl * (0.9 + Math.sqrt(clamp01(1 - Math.min(1, inEllipse(features.glaciers[0], x, y)))) * 0) * 1.1 * ampK;
    glac[k] = gl; hgt[k] = h;
  }
  // 路廊：公路走在谷地里，沿路压低、抹平；站点周围平整成小台地
  const bucket = new Map<number, number[]>(); const bk = (x: number, y: number) => Math.floor(y / 2) * 1000 + Math.floor(x / 2);
  roadPts.forEach((p, n) => { const kk = bk(p[0], p[1]); (bucket.get(kk) ?? bucket.set(kk, []).get(kk)!).push(n); });
  const rawAt = (x: number, y: number) => { const fi = (x / W) * (GX - 1), fj = (y / H) * (GY - 1); const i = Math.max(0, Math.min(GX - 2, Math.floor(fi))), j = Math.max(0, Math.min(GY - 2, Math.floor(fj))); const a = fi - i, b = fj - j; return lerp(lerp(hgt[idx(i, j)], hgt[idx(i + 1, j)], a), lerp(hgt[idx(i, j + 1)], hgt[idx(i + 1, j + 1)], a), b); };
  const pathH = roadPts.map((p) => rawAt(p[0], p[1])); const smooth = pathH.map((_, n) => { let s = 0, c = 0; for (let q = Math.max(0, n - 12); q <= Math.min(pathH.length - 1, n + 12); q++) { s += pathH[q]; c++; } return Math.max(0.1, (s / c) * 0.7); });
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const x = (i / (GX - 1)) * W, y = (j / (GY - 1)) * H; let best = 9, bh = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const n of bucket.get(bk(x + dx * 2, y + dy * 2)) ?? []) { const d = Math.hypot(roadPts[n][0] - x, roadPts[n][1] - y); if (d < best) { best = d; bh = smooth[n]; } }
    const R0 = 1.4; if (best < R0) { const w = (1 - best / R0) ** 1.5; const k = idx(i, j); hgt[k] = lerp(hgt[k], Math.max(bh, 0.1), w); if (best < 0.45) landF[k] = Math.max(landF[k], 0.8); }
  }
  for (const s of route.stops) { const [sx, sy] = s.center; if (s.offPlate) continue; const h0 = Math.max(0.12, rawAt(sx, sy)); for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { const d = Math.hypot((i / (GX - 1)) * W - sx, (j / (GY - 1)) * H - sy); if (d < 2.2) { const k = idx(i, j); if (landF[k] > 0.5) hgt[k] = lerp(hgt[k], h0, (1 - d / 2.2) ** 0.8); } } }
  const heightAt = (x: number, y: number) => rawAt(Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y)));

  // ---------- 地面网格（顶点色）
  const pos = new Float32Array(GX * GY * 3), colr = new Float32Array(GX * GY * 3); const index: number[] = [];
  const snowLine = R.snowLine * ampK + 0.4; const south = reg === "iceland" && f.lat0 < 64.2;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const k = idx(i, j); const x = (i / (GX - 1)) * W, y = (j / (GY - 1)) * H; const h = hgt[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = y;
    const sx = (hgt[idx(Math.min(GX - 1, i + 1), j)] - hgt[idx(Math.max(0, i - 1), j)]) / (2 * cell), sy = (hgt[idx(i, Math.min(GY - 1, j + 1))] - hgt[idx(i, Math.max(0, j - 1))]) / (2 * cell); const slope = Math.hypot(sx, sy);
    const n1 = noise3(x * 0.6, y * 0.6, 1.7) * 0.5 + 0.5, n2 = noise3(x * 2.3, y * 2.3, 4.1);
    let c: RGB;
    if (landF[k] <= 0.5) c = mix([214, 200, 160], [30, 96, 120], clamp01(dSea[k] / 2.5));
    else {
      c = mix(R.grass, R.grass2, n1); if (reg === "iceland") c = mix(c, [120, 134, 108], clamp01(noise3(x * 0.35, y * 0.35, 9) * 1.2) * 0.45);   // 苔原：淡一点，不要脏斑
      c = mix(c, R.rock, clamp01((slope - 0.85) * 1.3)); c = mix(c, R.rock, clamp01((h - snowLine * 0.7) / (snowLine * 0.3)) * 0.8);
      if (h > snowLine + n2 * 0.4) c = mix(c, [246, 248, 250], clamp01((h - snowLine) * 2));
      const shoreW = clamp01(1 - dLand[k] / (south ? 1.3 : 0.55)); c = mix(c, south ? [54, 54, 60] : R.shore, shoreW * 0.85);
      if (glac[k] > 0) c = mix(c, [226, 240, 250], clamp01(glac[k] * 1.6));
    }
    c = T(c); const jit = 1 + n2 * 0.05; colr[k * 3] = (c[0] / 255) * jit; colr[k * 3 + 1] = (c[1] / 255) * jit; colr[k * 3 + 2] = (c[2] / 255) * jit;
  }
  for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) { const a = idx(i, j), b = idx(i + 1, j), c2 = idx(i + 1, j + 1), d = idx(i, j + 1); index.push(a, d, b, b, d, c2); }
  const tg = G(new THREE.BufferGeometry()); tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const cl = new THREE.BufferAttribute(colr, 3); for (let q = 0; q < colr.length; q++) colr[q] = Math.pow(Math.min(1, colr[q]), 2.2); tg.setAttribute("color", cl);
  tg.setIndex(index); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, M(0xffffff, 0.92, { vertexColors: true })); terrain.receiveShadow = true; terrain.castShadow = true; g.add(terrain);
  // 水面
  const wm = new THREE.MeshPhysicalMaterial({ color: col(T([64, 178, 214])), roughness: 0.08, metalness: 0, transparent: true, opacity: 0.78, clearcoat: 0.6, clearcoatRoughness: 0.1, depthWrite: false }); mats.push(wm);
  const water = new THREE.Mesh(G(new THREE.PlaneGeometry(W, H)), wm); water.rotation.x = -Math.PI / 2; water.position.set(W / 2, 0, H / 2); water.renderOrder = 2; g.add(water);

  // ---------- 切面（地层）与浮空岛底座
  const strata = strataTexture(reg); const sideM = new THREE.MeshStandardMaterial({ map: strata, roughness: 0.95 }); mats.push(sideM);
  const BOT = -2.6;
  const side = (pts: [number, number][]) => {
    const p: number[] = [], uv: number[] = [], ix: number[] = []; let acc = 0;
    pts.forEach(([x, y], n) => { const top = Math.max(heightAt(x, y), -0.05); if (n) acc += Math.hypot(x - pts[n - 1][0], y - pts[n - 1][1]); p.push(x, top, y, x, BOT, y); uv.push(acc / 6, (top - BOT) / 6, acc / 6, 0); if (n) { const a = (n - 1) * 2, b = n * 2; ix.push(a, a + 1, b, b, a + 1, b + 1); } });
    const sg = G(new THREE.BufferGeometry()); sg.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); sg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(ix); sg.computeVertexNormals();
    const m = new THREE.Mesh(sg, sideM); m.receiveShadow = true; g.add(m); return m;
  };
  const edge = (a: [number, number], b: [number, number], n: number) => Array.from({ length: n + 1 }, (_, q) => [lerp(a[0], b[0], q / n), lerp(a[1], b[1], q / n)] as [number, number]);
  side(edge([0, H], [W, H], GX - 1)); side(edge([W, 0], [0, 0], GX - 1)); side(edge([0, 0], [0, H], GY - 1)); side(edge([W, H], [W, 0], GY - 1));
  const sideM2 = side; void sideM2;
  // 海水的切面：水面到海床之间一层半透明蓝
  const seaSide = new THREE.MeshStandardMaterial({ color: col(T([70, 170, 210])), transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false }); mats.push(seaSide);
  for (const [a, b, n] of [[[0, H], [W, H], GX - 1], [[W, 0], [0, 0], GX - 1], [[0, 0], [0, H], GY - 1], [[W, H], [W, 0], GY - 1]] as [[number, number], [number, number], number][]) {
    const pts = edge(a, b, n); const p: number[] = [], ix: number[] = [];
    pts.forEach(([x, y], q) => { const top = heightAt(x, y); p.push(x, 0, y, x, Math.min(0, top), y); if (q) { const a2 = (q - 1) * 2, b2 = q * 2; ix.push(a2, a2 + 1, b2, b2, a2 + 1, b2 + 1); } });
    const sg = G(new THREE.BufferGeometry()); sg.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); sg.setIndex(ix); sg.computeVertexNormals(); const m = new THREE.Mesh(sg, seaSide); m.renderOrder = 3; g.add(m);
  }
  g.add(rockBase(W, H, BOT, G, M, reg, T));

  // ---------- 路（丝带）、轮渡航迹、航班虚线
  let ribbon: THREE.Mesh | null = null;
  const roadM = M(style.road, 0.75); const hiM = new THREE.MeshStandardMaterial({ color: col(style.pathRibbon), roughness: 0.5, emissive: col(style.pathRibbon), emissiveIntensity: style.night ? 0.5 : 0.15 }); mats.push(hiM);
  const ribbonOf = (pts: [number, number][], w: number, lift: number, m: THREE.Material) => {
    if (pts.length < 2) return null; const p: number[] = [], ix: number[] = [];
    pts.forEach(([x, y], n) => { const a = pts[Math.max(0, n - 1)], b = pts[Math.min(pts.length - 1, n + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; const nx = -dy * w, ny = dx * w; const h = Math.max(0.02, heightAt(x, y)) + lift; p.push(x + nx, h, y + ny, x - nx, h, y - ny); if (n) { const q = (n - 1) * 2, r = n * 2; ix.push(q, r, q + 1, q + 1, r, r + 1); } });
    const rg = G(new THREE.BufferGeometry()); rg.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); rg.setIndex(ix); rg.computeVertexNormals(); const mesh = new THREE.Mesh(rg, m); mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  for (const sg of route.segments) {
    const pts = route.path.slice(sg.start, sg.end + 1);
    if (sg.mode === "ship") { const l = new THREE.Line(G(new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => new THREE.Vector3(x, 0.03, y)))), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.4, gapSize: 0.3 })); l.computeLineDistances(); g.add(l); continue; }
    if (sg.mode === "flight") { const l = new THREE.Line(G(new THREE.BufferGeometry().setFromPoints(pts.map(([x, y], n) => new THREE.Vector3(x, heightAt(x, y) + 0.3 + flightAlt(sg.arc, n / Math.max(1, pts.length - 1)), y)))), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.8 })); l.computeLineDistances(); g.add(l); continue; }
    ribbonOf(pts, sg.mode === "walk" ? 0.12 : 0.2, 0.03, roadM);
    const r = ribbonOf(pts, 0.07, 0.045, hiM); if (r) ribbon = r;
  }

  // ---------- 地标、图钉
  const landmarks = new Map<string, THREE.Group>(); const tops = new Map<string, number>(); const pins = new Map<string, THREE.Group>();
  const pinGeo = G(new THREE.ConeGeometry(0.16, 0.5, 14)), headGeo = G(new THREE.SphereGeometry(0.2, 16, 12));
  const placed: [number, number, number][] = [];
  route.stops.forEach((s, si) => {
    const dup = route.stops.slice(0, si).find((o) => o.name === s.name);
    const [x, y] = s.center; const h = Math.max(0.12, heightAt(x, y));
    if (dup) { tops.set(s.entryId, tops.get(dup.entryId) ?? h + 1); return; }
    if (s.offPlate) { const sign = signpost(s.name); sign.position.set(x, h, y); g.add(sign); tops.set(s.entryId, h + 1.6); return; }
    const ent = day.entries.find((e) => e.id === s.entryId); const geo = ent && ent.type === "place" ? ent.geo : undefined;
    const lm = landmarkFor({ name: s.name, category: s.category, kind: ent && ent.type === "place" ? ent.kind : undefined, lat: geo?.lat, lng: geo?.lng }, spec.seed + si * 17);
    const k = 0.62;
    // 地标退到路边：沿路的法向偏移，选地势高（陆地）的一侧，让小人与公路在它前面
    const a = route.path[Math.max(0, s.arrive - 3)], b = route.path[Math.min(route.path.length - 1, s.arrive + 3)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty); if (tl < 1e-6) { tx = 1; ty = 0; } else { tx /= tl; ty /= tl; }
    const offD = lm.footprint * k * 0.9 + 0.7; const c1: [number, number] = [x - ty * offD, y + tx * offD], c2: [number, number] = [x + ty * offD, y - tx * offD];
    const pickSide = heightAt(c1[0], c1[1]) >= heightAt(c2[0], c2[1]) - 0.05 ? c1 : c2;
    const [lx, ly] = [Math.max(1, Math.min(W - 1, pickSide[0])), Math.max(1, Math.min(H - 1, pickSide[1]))]; const lh = Math.max(0.12, heightAt(lx, ly));
    lm.group.scale.setScalar(k); lm.group.position.set(lx, lh, ly); lm.group.rotation.y = Math.atan2(x - lx, y - ly); lm.group.userData = { landmark: s.name, tier: lm.tier, kind: lm.kind };
    lm.group.traverse((o) => (o.userData = { ...o.userData, landmark: s.name }));
    g.add(lm.group); landmarks.set(s.name, lm.group); tops.set(s.entryId, lh + lm.top * k + 0.2); placed.push([lx, ly, lm.footprint * k + 0.8]);
    if (lm.update) updaters.push(lm.update);
    const c: RGB = style.night ? LANTERN : s.category === "hotel" || s.category === "airport" || s.category === "port" ? [29, 40, 66] : style.accent;
    const pm = new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.35, emissive: col(c), emissiveIntensity: style.night ? 0.6 : 0.2 }); mats.push(pm); const p = new THREE.Group();
    const cn = new THREE.Mesh(pinGeo, pm); cn.rotation.x = Math.PI; cn.position.y = 0.25; const bl = new THREE.Mesh(headGeo, pm); bl.position.y = 0.58; p.add(cn, bl);
    p.position.set(lx, lh + lm.top * k + 0.25, ly); p.userData = { baseY: p.position.y, mat: pm, entryId: s.entryId, landmark: s.name }; g.add(p); pins.set(s.entryId, p);
    spots.lamps.push([lx, p.position.y + 0.58, ly]);
    // 篝火（D85）：住处门前；没有住处就在最后一站旁边
    if (s.category === "hotel" || si === route.stops.length - 1) { const fx = Math.max(1, Math.min(W - 1, lx + ty * 1.4 + tx * 0.6)), fy = Math.max(1, Math.min(H - 1, ly - tx * 1.4 + ty * 0.6)); if (s.category === "hotel" || !spots.fire) spots.fire = [fx, Math.max(0.12, heightAt(fx, fy)), fy]; }
  });

  // ---------- 装饰：羊、马、桦树、云杉、红木屋、石头、城镇房子
  const nearRoad = (x: number, y: number, r: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const n of bucket.get(bk(x + dx * 2, y + dy * 2)) ?? []) if (Math.hypot(roadPts[n][0] - x, roadPts[n][1] - y) < r) return true; return false; };
  const free = (x: number, y: number) => !placed.some(([px, py, r]) => Math.hypot(px - x, py - y) < r);
  const inst = (geo: THREE.BufferGeometry, m: THREE.Material, items: { x: number; y: number; s: number; r?: number; sy?: number }[], yOff = 0) => {
    if (!items.length) return; const im = new THREE.InstancedMesh(G(geo), m, items.length); const o = new THREE.Object3D();
    items.forEach((it, n) => { o.position.set(it.x, heightAt(it.x, it.y) + yOff * it.s, it.y); o.rotation.set(0, it.r ?? 0, 0); o.scale.set(it.s, it.s * (it.sy ?? 1), it.s); o.updateMatrix(); im.setMatrixAt(n, o.matrix); });
    im.castShadow = true; im.receiveShadow = true; g.add(im);
  };
  const trees: { x: number; y: number; s: number; r: number }[] = [], spruce: typeof trees = [], sheep: typeof trees = [], horses: typeof trees = [], rocks: typeof trees = [], cabins: { x: number; y: number; s: number; r: number; c: number }[] = [];
  const N = city ? 900 : 1400;
  for (let n = 0; n < N; n++) {
    const x = 1 + rng.next() * (W - 2), y = 1 + rng.next() * (H - 2); const k = idx(Math.round((x / W) * (GX - 1)), Math.round((y / H) * (GY - 1)));
    if (landF[k] < 0.6 || !free(x, y) || nearRoad(x, y, 0.45)) continue; const h = hgt[k]; if (glac[k] > 0.2 || h > snowLine) continue;
    const u = rng.next();
    if (n % 3 === 0) spots.ground.push([x, heightAt(x, y), y]);   // 夜里放蘑菇、起萤火的地方
    if (city) { if (nearRoad(x, y, 2.6) && u < 0.55) cabins.push({ x, y, s: 0.8 + rng.next() * 0.5, r: rng.next() * 6, c: rng.int(NORDIC.length) }); else if (u < 0.8) trees.push({ x, y, s: 0.6 + rng.next() * 0.5, r: rng.next() * 6 }); continue; }
    if (reg === "iceland") { if (u < 0.05) sheep.push({ x, y, s: 1, r: rng.next() * 6 }); else if (u < 0.08) horses.push({ x, y, s: 1, r: rng.next() * 6 }); else if (u < 0.11) rocks.push({ x, y, s: 0.4 + rng.next() * 0.6, r: rng.next() * 6 }); else if (u < 0.2 + R.tree * 0.4) trees.push({ x, y, s: 0.5 + rng.next() * 0.4, r: rng.next() * 6 }); if (dLand[k] < 1.2 && u > 0.985) cabins.push({ x, y, s: 1, r: rng.next() * 6, c: rng.int(NORDIC.length) }); }
    else { if (u < R.tree * 0.9 && h < snowLine * 0.7) (reg === "fjord" ? spruce : trees).push({ x, y, s: 0.6 + rng.next() * 0.6, r: rng.next() * 6 }); else if (u < R.tree + 0.1) rocks.push({ x, y, s: 0.4 + rng.next() * 0.6, r: rng.next() * 6 }); if (dLand[k] < 1.5 && u > 0.965) cabins.push({ x, y, s: 1, r: rng.next() * 6, c: u > 0.99 ? 0 : rng.int(NORDIC.length) }); }
  }
  const leaf = spec.season === "autumn" ? [[196, 120, 60], [226, 170, 70], [120, 150, 70]] as RGB[] : [[80, 150, 80], [110, 170, 90]] as RGB[];
  leaf.forEach((c, n) => inst(new THREE.IcosahedronGeometry(0.28, 1), M(c, 0.8), trees.filter((_, q) => q % leaf.length === n), 0.55));
  inst(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 6), M([100, 72, 50], 0.9), trees, 0.2);
  inst(new THREE.ConeGeometry(0.22, 0.75, 8), M([40, 96, 70], 0.85), spruce, 0.42); inst(new THREE.ConeGeometry(0.15, 0.5, 8), M([52, 112, 80], 0.85), spruce, 0.75);
  inst(new THREE.SphereGeometry(0.1, 10, 8), M([250, 248, 240], 0.95), sheep, 0.09); inst(new THREE.SphereGeometry(0.045, 8, 6), M([40, 36, 36], 0.8), sheep.map((s) => ({ ...s, x: s.x + Math.sin(s.r) * 0.09, y: s.y + Math.cos(s.r) * 0.09 })), 0.12);
  inst(new RoundedBoxGeometry(0.1, 0.1, 0.26, 2, 0.04), M([150, 96, 60], 0.8), horses, 0.14); inst(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 5), M([90, 60, 40]), horses, 0.05);
  inst(new THREE.DodecahedronGeometry(0.16, 0), M(reg === "iceland" ? [128, 124, 130] : [150, 148, 142], 0.95), rocks, 0.05);
  NORDIC.forEach((c, n) => { const cs = cabins.filter((q) => q.c === n); inst(new RoundedBoxGeometry(0.34, 0.28, 0.3, 2, 0.03), M(c, 0.8), cs, 0.14); });
  for (const c of cabins) spots.houses.push({ x: c.x, y: heightAt(c.x, c.y) + 0.14 * c.s, z: c.y, ry: c.r, s: c.s * 0.85 });
  inst(new THREE.ConeGeometry(0.28, 0.2, 4), M([54, 56, 64], 0.6), cabins.map((q) => ({ ...q, r: q.r + Math.PI / 4 })), 0.38);

  return {
    group: g, pins, landmarks, ribbon, cols: W, rows: H, heightAt, nightSpots: spots,
    anchorTop: (id) => tops.get(id) ?? 1.5,
    update: (t) => { for (const u of updaters) u(t); },
    dispose: () => { mats.forEach((m) => m.dispose()); geos.forEach((x) => x.dispose()); strata.dispose(); },
  };
}

export function flightAlt(arc: string | undefined, u: number) { if (arc === "out") return u * u * 6; if (arc === "in") return (1 - u) * (1 - u) * 6; if (arc === "both") return Math.sin(Math.PI * u) * 5; return 0; }

function strataTexture(reg: Region): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512; const x = c.getContext("2d")!;
  const bands: [number, string][] = reg === "iceland" ? [[0.07, "#5f7a4c"], [0.06, "#3d3a3c"], [0.12, "#6b5a4a"], [0.08, "#2f2d31"], [0.15, "#7a6553"], [0.1, "#4a4448"], [0.42, "#5b4e57"]] : [[0.07, "#5f8a52"], [0.1, "#7a5a3e"], [0.12, "#9a7a58"], [0.08, "#6e5846"], [0.18, "#8b8078"], [0.1, "#6d6470"], [0.35, "#5b4e62"]];
  let y = 0; for (const [h, col2] of bands) { x.fillStyle = col2; x.fillRect(0, y * 512, 256, h * 512 + 1); y += h; }
  for (let i = 0; i < 900; i++) { x.fillStyle = i % 2 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)"; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 512, 2 + Math.random() * 6, 1 + Math.random() * 2, 0, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  // 纹理 v 从顶（草皮）往下：uv.v = (top-BOT)/6 → 需要反向取样
  t.repeat.set(1, -1); t.offset.set(0, 1); return t;
}
function rockBase(W: number, H: number, bot: number, G: <T extends THREE.BufferGeometry>(x: T) => T, M: (c: RGB, r?: number) => THREE.Material, reg: Region, T: (c: RGB) => RGB = (c) => c): THREE.Mesh {
  // 浮空岛的底：从底板矩形往下收成一个圆钝的锥，表面起伏
  const rings = 9, seg = 96; const p: number[] = [], c: number[] = [], ix: number[] = [];
  const perim = (t: number): [number, number] => { const L = 2 * (W + H); let s = t * L; if (s < W) return [s, 0]; s -= W; if (s < H) return [W, s]; s -= H; if (s < W) return [W - s, H]; s -= W; return [0, H - s]; };
  const cols: RGB[] = ((reg === "iceland" ? [[74, 66, 72], [92, 82, 88], [62, 56, 64]] : [[122, 104, 132], [104, 90, 118], [86, 74, 100]]) as RGB[]).map(T);
  for (let r = 0; r <= rings; r++) {
    const u = r / rings; const shrink = 1 - Math.pow(u, 0.7) * 0.92; const y = bot - u * 9 - u * u * 3;
    for (let s = 0; s < seg; s++) {
      const [px, pz] = perim(s / seg); const cx2 = W / 2 + (px - W / 2) * shrink, cz = H / 2 + (pz - H / 2) * shrink;
      const n = noise3(px * 0.2, u * 3, pz * 0.2) * (0.6 + u * 1.2);
      p.push(cx2 + (px - W / 2 >= 0 ? 1 : -1) * n * 0.6 * (r > 0 ? 1 : 0), y + noise3(px * 0.3, pz * 0.3, u * 5) * 0.4 * (r > 0 ? 1 : 0), cz + (pz - H / 2 >= 0 ? 1 : -1) * n * 0.6 * (r > 0 ? 1 : 0));
      const k = cols[(r + (s % 3 === 0 ? 1 : 0)) % 3]; const dk = 1 - u * 0.35; c.push(Math.pow((k[0] / 255) * dk, 2.2), Math.pow((k[1] / 255) * dk, 2.2), Math.pow((k[2] / 255) * dk, 2.2));
      if (r) { const a = (r - 1) * seg + s, b = (r - 1) * seg + ((s + 1) % seg), d = r * seg + s, e = r * seg + ((s + 1) % seg); ix.push(a, d, b, b, d, e); }
    }
  }
  const tip = p.length / 3; p.push(W / 2, bot - 13, H / 2); c.push(0.05, 0.04, 0.06); for (let s = 0; s < seg; s++) ix.push(rings * seg + s, tip, rings * seg + ((s + 1) % seg));
  const gg = G(new THREE.BufferGeometry()); gg.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); gg.setAttribute("color", new THREE.Float32BufferAttribute(c, 3)); gg.setIndex(ix); gg.computeVertexNormals();
  const m = M([255, 255, 255], 0.95) as THREE.MeshStandardMaterial; m.vertexColors = true; m.flatShading = true; const mesh = new THREE.Mesh(gg, m); mesh.receiveShadow = true; return mesh;
}
function signpost(name: string): THREE.Group {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 8), m); post.position.y = 0.65; g.add(post);
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.3, 0.06, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.8 })); board.position.y = 1.15; g.add(board);
  const plane = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0xf4f1ea })); plane.rotation.z = -Math.PI / 2; plane.position.set(0.55, 1.15, 0); g.add(plane);
  g.userData = { landmark: name }; return g;
}
