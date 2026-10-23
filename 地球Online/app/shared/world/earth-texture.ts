/** 风格化地球贴图（等距圆柱投影画在 canvas 上）：海洋渐变 + 近岸浅水 + 按纬度与干旱带的地表色 + 沙色海岸线 + 国界 + 颗粒。
 *  不是卫星图：是「游戏里的世界地图」，与平面插画背景同一套语言。 */
import type { Ring } from "../geo/topo.ts";

const DESERTS: [number, number, number, number][] = [   // [lng, lat, rx(度), ry(度)]
  [12, 23, 26, 8], [45, 23, 12, 7], [133, -25, 14, 7], [104, 42, 14, 4.5], [-112, 33, 7, 5], [-70, -24, 3, 7], [20, -24, 7, 5], [65, 33, 12, 5], [80, 40, 8, 3],
];
/** 主要山脉的脊线（[宽度(度), [经度, 纬度]…]），只为晕渲用，粗略即可 */
const MOUNTAINS: [number, [number, number][]][] = [
  [3.2, [[73, 35.5], [77, 34], [81, 30.5], [85, 28.5], [89, 28], [93, 28.6], [96, 28.2]]],             // 喜马拉雅
  [2.6, [[76, 36.5], [82, 36], [88, 36.2], [94, 35.5], [100, 34.5]]],                                   // 昆仑
  [1.8, [[70, 41], [76, 41.8], [81, 42.5], [87, 43.2], [93, 43.2]]],                                    // 天山
  [1.6, [[98.5, 25], [100, 28.5], [101.5, 31.5], [103, 33.5]]],                                         // 横断
  [2.2, [[-78, 8], [-77.5, -2], [-75.5, -10], [-72, -16], [-68.5, -22], [-69.5, -30], [-70.5, -36], [-72, -44], [-73.5, -50]]],  // 安第斯
  [2.4, [[-152, 62], [-140, 60.5], [-128, 55], [-120, 50], [-114, 45], [-109, 40], [-106, 35], [-104, 31]]],  // 落基
  [1.2, [[-122, 48], [-121.5, 44], [-121, 40], [-119, 37]]],                                            // 喀斯喀特 / 内华达
  [1.0, [[5.5, 44.5], [7, 45.8], [10, 46.6], [13, 47], [15.5, 47.2]]],                                  // 阿尔卑斯
  [0.9, [[39.5, 43.5], [43, 42.7], [46.5, 41.6], [49, 40.6]]],                                          // 高加索
  [1.1, [[5.8, 59.5], [8.5, 61.5], [12.5, 64], [16, 67], [19.5, 69], [23, 70]]],                        // 斯堪的纳维亚
  [0.8, [[58.5, 51], [59.5, 56], [60, 61], [62, 65.5], [65, 68]]],                                     // 乌拉尔
  [1.0, [[-8.5, 30.8], [-4.5, 32.5], [0.5, 34.2], [6, 35.5], [9, 36.3]]],                               // 阿特拉斯
  [1.3, [[44.5, 37], [48, 34], [51.5, 30.5], [55, 28], [57.5, 27]]],                                    // 扎格罗斯
  [1.0, [[146.5, -37.5], [149.5, -35], [151, -31], [152, -27], [148, -21], [145.5, -17]]],             // 大分水岭
  [1.0, [[37.3, -3], [36.5, 1], [38, 7], [39.5, 10], [38.5, 14]]],                                      // 东非高原
  [0.8, [[-85, 34.5], [-81, 36.8], [-78, 39], [-74.5, 42], [-71.5, 44.5]]],                             // 阿巴拉契亚
  [0.8, [[137.5, 35.6], [138.5, 36.5], [139.5, 37.8], [140.5, 39.5]]],                                  // 日本阿尔卑斯
  [0.9, [[168, -45.5], [170, -44], [171.5, -43]]],                                                      // 南阿尔卑斯
];
function latColor(lat: number): string {
  const a = Math.abs(lat);
  const stops: [number, [number, number, number]][] = [[0, [104, 170, 104]], [10, [122, 178, 108]], [18, [182, 188, 128]], [26, [214, 200, 150]], [34, [160, 184, 120]], [46, [136, 180, 116]], [58, [116, 156, 112]], [67, [138, 162, 124]], [73, [184, 192, 176]], [79, [234, 238, 244]], [90, [246, 248, 252]]];
  for (let i = 1; i < stops.length; i++) if (a <= stops[i][0]) { const [a0, c0] = stops[i - 1], [a1, c1] = stops[i]; const t = (a - a0) / (a1 - a0); return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(",")})`; }
  return "rgb(246,250,252)";
}
/** 跨 180° 经线的环（楚科奇、弗兰格尔岛）先展开成连续经度，再在接缝两侧各画一份，避免横贯全图的直线 */
function unwrap(ring: Ring): { ring: Ring; crosses: boolean } {
  let off = 0, crosses = false; const out: Ring = [];
  ring.forEach(([lng, lat], i) => { if (i) { const d = lng - ring[i - 1][0]; if (d > 180) { off -= 360; crosses = true; } else if (d < -180) { off += 360; crosses = true; } } out.push([lng + off, lat]); });
  return { ring: out, crosses };
}
export function drawRings(ctx: CanvasRenderingContext2D, polys: Ring[][], proj: (lng: number, lat: number) => [number, number], closed = true) {
  ctx.beginPath();
  const trace = (ring: Ring, shift: number) => { ring.forEach(([lng, lat], i) => { const [x, y] = proj(lng + shift, lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); if (closed) ctx.closePath(); };
  for (const poly of polys) for (const r of poly) { const u = unwrap(r); if (!u.crosses) trace(r, 0); else { trace(u.ring, 0); trace(u.ring, 360); trace(u.ring, -360); } }
}
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export interface EarthOpts { width: number; height: number; bbox?: { minLng: number; maxLng: number; minLat: number; maxLat: number }; shelf?: number; borders?: Ring[]; seed?: number }
/** 画一张地图（全球或一个范围），返回颜色图与粗糙度图 */
export function paintEarth(land: Ring[][], o: EarthOpts): { color: HTMLCanvasElement; rough: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const W = o.width, H = o.height; const b = o.bbox ?? { minLng: -180, maxLng: 180, minLat: -90, maxLat: 90 };
  const proj = (lng: number, lat: number): [number, number] => [((lng - b.minLng) / (b.maxLng - b.minLng)) * W, ((b.maxLat - lat) / (b.maxLat - b.minLat)) * H];
  const latAt = (y: number) => b.maxLat - (y / H) * (b.maxLat - b.minLat);
  const pxPerDeg = W / (b.maxLng - b.minLng);
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  // 陆地遮罩
  const mask = mk(); const mx = mask.getContext("2d")!; mx.fillStyle = "#000"; mx.fillRect(0, 0, W, H); mx.fillStyle = "#fff"; drawRings(mx, land, proj); mx.fill("evenodd");
  // 同一块陆地的 alpha 版（透明底上画陆地）：给 destination-in / source-in 用，免得逐像素读回（手机上读回大画布很慢）
  const maskA = mk(); const ma = maskA.getContext("2d")!; ma.fillStyle = "#fff"; drawRings(ma, land, proj); ma.fill("evenodd");
  const color = mk(); const c = color.getContext("2d")!;
  // 海：高纬偏深青，赤道偏亮蓝
  const og = c.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i <= 8; i++) { const y = i / 8; const lat = Math.abs(latAt(y * H)); const t = Math.min(1, lat / 70); og.addColorStop(y, `rgb(${Math.round(84 - 16 * t)},${Math.round(150 - 30 * t)},${Math.round(214 - 34 * t)})`); }
  c.fillStyle = og; c.fillRect(0, 0, W, H);
  // 近岸浅水：模糊遮罩着青绿色
  const blur = Math.max(2, (o.shelf ?? 0.35) * pxPerDeg);
  const shelfA = mk(); const sa = shelfA.getContext("2d")!; sa.filter = `blur(${blur}px)`; sa.drawImage(maskA, 0, 0); sa.globalAlpha = 0.4; sa.drawImage(maskA, 0, 0); sa.filter = "none"; sa.globalAlpha = 1;
  sa.globalCompositeOperation = "source-in"; sa.fillStyle = "rgb(150,210,228)"; sa.fillRect(0, 0, W, H);
  c.globalAlpha = 0.7; c.drawImage(shelfA, 0, 0); c.globalAlpha = 1;
  // 地表：纬度带 + 干旱带 + 斑驳
  const biome = mk(); const bx = biome.getContext("2d")!;
  for (let y = 0; y < H; y += 2) { bx.fillStyle = latColor(latAt(y)); bx.fillRect(0, y, W, 2); }
  const R = rng(o.seed ?? 7);
  for (const [lng, lat, rx, ry] of DESERTS) { const [x, y] = proj(lng, lat); const g = bx.createRadialGradient(x, y, 0, x, y, rx * pxPerDeg); g.addColorStop(0, "rgba(226,200,142,0.95)"); g.addColorStop(0.7, "rgba(222,196,138,0.55)"); g.addColorStop(1, "rgba(222,196,138,0)"); bx.save(); bx.translate(x, y); bx.scale(1, ry / rx); bx.translate(-x, -y); bx.fillStyle = g; bx.beginPath(); bx.arc(x, y, rx * pxPerDeg, 0, Math.PI * 2); bx.fill(); bx.restore(); }
  { const [x, y] = proj(-41, 73); const g = bx.createRadialGradient(x, y, 0, x, y, 16 * pxPerDeg); g.addColorStop(0, "rgba(246,250,252,1)"); g.addColorStop(0.75, "rgba(240,246,250,0.9)"); g.addColorStop(1, "rgba(240,246,250,0)"); bx.fillStyle = g; bx.save(); bx.translate(x, y); bx.scale(0.95, 1); bx.translate(-x, -y); bx.beginPath(); bx.arc(x, y, 16 * pxPerDeg, 0, Math.PI * 2); bx.fill(); bx.restore(); }
  const blotches = Math.round((W * H) / 9000);
  // 斑驳：柔边（径向渐变），半径按全球贴图的尺度封顶，放大的补丁里也不会出硬边圆圈
  const blotR = Math.min(pxPerDeg, W / 360 * 1.2);
  for (let i = 0; i < blotches; i++) { const x = R() * W, y = R() * H, r = (0.6 + R() * 2.4) * blotR * 0.9; const light = R() < 0.5; const gr = bx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, light ? "rgba(255,255,230,0.07)" : "rgba(20,60,30,0.06)"); gr.addColorStop(1, light ? "rgba(255,255,230,0)" : "rgba(20,60,30,0)"); bx.fillStyle = gr; bx.fillRect(x - r, y - r, r * 2, r * 2); }
  // 山脊：像手绘地图的晕渲，西北侧受光、东南侧背光
  const bump = mk(); const bu = bump.getContext("2d")!; bu.fillStyle = "#000"; bu.fillRect(0, 0, W, H);
  const lw = (w: number) => Math.max(2, w * pxPerDeg);
  const ridge = (ctx: CanvasRenderingContext2D, pts: [number, number][], shift: [number, number], style: string, width: number, blurPx: number) => {
    ctx.save(); ctx.filter = `blur(${blurPx}px)`; ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
    pts.forEach(([lng, lat], i) => { const [x, y] = proj(lng, lat); if (i) ctx.lineTo(x + shift[0], y + shift[1]); else ctx.moveTo(x + shift[0], y + shift[1]); }); ctx.stroke(); ctx.restore();
  };
  for (const [w, pts] of MOUNTAINS) {
    const o = Math.max(1, w * pxPerDeg * 0.35);
    ridge(bx, pts, [o, o], "rgba(74,70,120,0.07)", lw(w * 1.3), Math.max(2, w * pxPerDeg * 0.6));
    ridge(bx, pts, [-o * 0.6, -o * 0.6], "rgba(255,250,236,0.10)", lw(w * 0.8), Math.max(2, w * pxPerDeg * 0.5));
    if (w > 2.1) ridge(bx, pts, [0, 0], "rgba(246,248,252,0.22)", lw(w * 0.3), Math.max(1.5, w * pxPerDeg * 0.25));
    ridge(bu, pts, [0, 0], "rgba(255,255,255,0.9)", lw(w * 1.1), Math.max(2, w * pxPerDeg * 0.6));
  }
  // 点彩：和平面插画层同一种颗粒
  for (let i = 0, n = Math.round((W * H) / 260); i < n; i++) { const x = R() * W, y = R() * H; bx.fillStyle = R() < 0.55 ? "rgba(255,255,240,0.10)" : "rgba(30,40,70,0.07)"; bx.fillRect(x, y, 1.2, 1.2); }
  bx.globalCompositeOperation = "destination-in"; bx.drawImage(maskA, 0, 0);
  bu.globalCompositeOperation = "destination-in"; bu.drawImage(maskA, 0, 0);
  c.drawImage(biome, 0, 0);
  // 沙色海岸线
  c.strokeStyle = "rgba(250,236,196,0.75)"; c.lineWidth = Math.max(1, pxPerDeg * 0.05); c.lineJoin = "round"; drawRings(c, land, proj); c.stroke();
  // 国界
  if (o.borders) { c.strokeStyle = "rgba(255,255,255,0.38)"; c.lineWidth = Math.max(0.8, pxPerDeg * 0.03); drawRings(c, o.borders.map((l) => [l]), proj, false); c.stroke(); }
  // 颗粒
  c.fillStyle = c.createPattern(grainTile(99), "repeat")!; c.fillRect(0, 0, W, H);
  // 粗糙度：海光滑、陆粗糙（G 通道）
  const rough = mk(); const rx = rough.getContext("2d")!; rx.fillStyle = "rgb(100,100,100)"; rx.fillRect(0, 0, W, H); rx.filter = "blur(1px)"; rx.globalCompositeOperation = "lighter"; rx.globalAlpha = 0.6; rx.drawImage(mask, 0, 0);
  return { color, rough, bump };
}
/** 颗粒小贴片（256²，只做一次）：黑白点、很低的不透明度，平铺在地图上等于逐像素 ±5 的噪声 */
let grainCache: HTMLCanvasElement | null = null;
function grainTile(seed: number): HTMLCanvasElement {
  if (grainCache) return grainCache;
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d")!; const id = x.createImageData(256, 256); const d = id.data; const R = rng(seed);
  for (let i = 0; i < d.length; i += 4) { const n = R() - 0.5; const v = n > 0 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.round(Math.abs(n) * 2 * 10); }
  x.putImageData(id, 0, 0); return (grainCache = c);
}

/** 云：分形值噪声阈值化 */
export function paintClouds(W = 1024, H = 512, seed = 3): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!; const id = x.createImageData(W, H); const d = id.data;
  const R = rng(seed); const G = 64; const grid = new Float32Array((G + 1) * (G / 2 + 1)); for (let i = 0; i < grid.length; i++) grid[i] = R();
  const val = (u: number, v: number, f: number) => { const gu = (u * f) % G, gv = Math.min(G / 2 - 0.001, v * f * 0.5); const i = Math.floor(gu), j = Math.floor(gv), a = gu - i, b = gv - j; const s = (t: number) => t * t * (3 - 2 * t); const g = (ii: number, jj: number) => grid[(jj * (G + 1)) + ((ii % G) + G) % G]; return (g(i, j) * (1 - s(a)) + g(i + 1, j) * s(a)) * (1 - s(b)) + (g(i, j + 1) * (1 - s(a)) + g(i + 1, j + 1) * s(a)) * s(b); };
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const u = xx / W, v = y / H; let n = 0, amp = 0.55, f = 6;
    for (let o = 0; o < 4; o++) { n += val(u, v, f) * amp; amp *= 0.5; f *= 2; }
    const lat = Math.abs(v - 0.5) * 2; const band = 0.55 + 0.25 * Math.cos(lat * Math.PI * 3);
    const a = Math.max(0, Math.min(1, (n * band - 0.34) * 4.2));
    const k = (y * W + xx) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a * 235;
  }
  x.putImageData(id, 0, 0); return c;
}
