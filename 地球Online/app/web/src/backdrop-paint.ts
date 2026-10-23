/** 平面插画层的「印刷质感」：用画布画出来，而不是纯矢量。
 *  参照仓库主人圈出的横幅局部：天空是带细密点彩颗粒的渐变（亮点 + 暗点 + 大块的云状斑驳），
 *  房子是平涂 + 颗粒明暗（墙面上亮下暗、屋顶积雪带淡紫阴影、砖砌底座、门洞里一点暖光），
 *  漂浮的石台上面是雪、下面是紫灰岩石。颜色克制：天空一组、岩石一组、房子两三色、暖光一点。 */
import { DREAM } from "../../shared/world/tokens.ts";
import { mulberry32 } from "../../shared/algo/prng.ts";

export type BdPalette = "sea" | "warm" | "dusk";
interface Pal { sky: [string, string, string]; mottle: string; cloud: string; cloudShade: string; rock: string; rockDark: string; rockLight: string; snow: string; snowShade: string; wall: string; wallShade: string; roof: string; brick: string; door: string; glow: string; tree: string; ink: string }
export const PALETTES: Record<BdPalette, Pal> = {
  sea: { sky: ["#8db2ec", "#b9d0f3", "#efdcec"], mottle: "#ffffff", cloud: "#fbfaff", cloudShade: "#d7dcf3", rock: "#8e83a8", rockDark: "#6c6387", rockLight: "#b3a9c8", snow: "#fbfbff", snowShade: "#d3d4ef", wall: "#f1e7d3", wallShade: "#dccbb0", roof: "#46507c", brick: "#b8a38c", door: "#3a3046", glow: "#ffcf7a", tree: "#4f7d78", ink: "#2a2440" },
  warm: { sky: ["#efbf97", "#f5d8bd", "#fbeee0"], mottle: "#fff8ee", cloud: "#fffaf3", cloudShade: "#f0dcc8", rock: "#a68d7c", rockDark: "#86705f", rockLight: "#c7b09d", snow: "#fffaf3", snowShade: "#eed8c6", wall: "#f6ead6", wallShade: "#e3cfb2", roof: "#7c4f45", brick: "#c2a184", door: "#3d2c2c", glow: "#ffd28a", tree: "#6f8a5e", ink: "#3a2a24" },
  dusk: { sky: ["#9a86cf", "#c8aedf", "#f3cad8"], mottle: "#fff4fb", cloud: "#fbf3fb", cloudShade: "#dccbeb", rock: "#8b73a2", rockDark: "#6a5586", rockLight: "#b39cc7", snow: "#fdf8ff", snowShade: "#d9c9ea", wall: "#f3e2d6", wallShade: "#dfc6b8", roof: "#4b3f6e", brick: "#b99a92", door: "#35283f", glow: "#ffcf8f", tree: "#5f6f86", ink: "#2d2238" },
};

const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; };
const rgba = (c: string, a: number) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

function mk(w: number, h: number, dpr: number) {
  const c = document.createElement("canvas"); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = `${w}px`; c.style.height = `${h}px`;
  const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr); return { c, ctx };
}

/** 点彩颗粒：在当前裁剪区内撒亮点和暗点（大小 0.6–1.6 px），密度按面积算 */
export function stipple(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, o: { light?: string; dark?: string; density?: number; la?: number; da?: number; bias?: (u: number, v: number) => number } = {}) {
  const r = mulberry32(seed); const n = Math.round(w * h * (o.density ?? 0.05));
  for (let i = 0; i < n; i++) {
    const u = r.next(), v = r.next(); const px = x + u * w, py = y + v * h; const b = o.bias ? o.bias(u, v) : 0.5;
    const darkDot = r.next() < b; const c = darkDot ? o.dark : o.light; if (!c) continue;
    const s = 0.5 + r.next() * r.next() * 1.3; ctx.fillStyle = rgba(c, (darkDot ? o.da ?? 0.16 : o.la ?? 0.5) * (0.4 + r.next() * 0.6));
    ctx.fillRect(px, py, s, s);
  }
}
/** 细颗粒（逐像素 ±amp），在已经画好的画布上做 */
function filmGrain(c: HTMLCanvasElement, amp: number, seed: number) {
  const ctx = c.getContext("2d")!; const im = ctx.getImageData(0, 0, c.width, c.height); const d = im.data; const r = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const k = (r.next() - 0.5) * amp; d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  ctx.putImageData(im, 0, 0);
}
/** 大块斑驳：几十个柔边亮斑，像印刷品上墨不匀 */
function mottle(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, seed: number, n = 26, alpha = 0.16) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = r.next() * w, y = r.next() * h, rad = (0.08 + r.next() * 0.22) * Math.max(w, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba(color, alpha * (0.4 + r.next() * 0.6))); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}
/** 在一条路径里做「平涂 + 竖向明暗 + 点彩」 */
function texFill(ctx: CanvasRenderingContext2D, path: Path2D, box: [number, number, number, number], top: string, bottom: string, seed: number, dots: { light?: string; dark?: string; density?: number; la?: number; da?: number } = {}) {
  const [x, y, w, h] = box; ctx.save(); ctx.clip(path);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bottom); ctx.fillStyle = g; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  stipple(ctx, x, y, w, h, seed, { density: 0.09, la: 0.45, da: 0.18, bias: (_u, v) => 0.25 + v * 0.5, ...dots });
  ctx.restore();
}

// ---------------- 天空
export function paintSky(w: number, h: number, p: BdPalette, seed = 7, night = false): HTMLCanvasElement {
  const P = PALETTES[p]; const dpr = Math.min(1.5, devicePixelRatio || 1); const { c, ctx } = mk(w, h, dpr);
  if (night) {
    // 夜（D85）：深蓝到青蓝，下面亮一点（地平线的余光）；星星大小不一，几颗亮的
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#0a1230"); g.addColorStop(0.55, "#142650"); g.addColorStop(1, "#24417a"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    mottle(ctx, w, h, "#3a5aa8", seed, 26, 0.12); mottle(ctx, w, h, "#060a1e", seed + 1, 12, 0.08);
    const r = mulberry32(seed + 9); const n = Math.round((w * h) / 2600);
    for (let i = 0; i < n; i++) { const x = r.next() * w, y = r.next() * h * 0.85; const big = r.next() < 0.08; const rad = big ? 1.3 + r.next() * 0.9 : 0.4 + r.next() * 0.6; ctx.fillStyle = `rgba(255,255,255,${(big ? 0.9 : 0.35 + r.next() * 0.4) * (1 - y / h * 0.7)})`; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); }
    filmGrain(c, 8, seed + 3);
    return c;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P.sky[0]); g.addColorStop(0.55, P.sky[1]); g.addColorStop(1, P.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  mottle(ctx, w, h, P.mottle, seed, 30, 0.14); mottle(ctx, w, h, P.ink, seed + 1, 10, 0.035);
  stipple(ctx, 0, 0, w, h, seed + 2, { light: "#ffffff", dark: P.ink, density: 0.035, la: 0.55, da: 0.1, bias: (_u, v) => 0.35 - v * 0.2 });
  filmGrain(c, 10, seed + 3);
  return c;
}

// ---------------- 云：平涂，上亮下暗，底边平，带颗粒
export function paintCloud(w: number, p: BdPalette, seed: number): HTMLCanvasElement {
  const P = PALETTES[p]; const h = Math.round(w * 0.42); const { c, ctx } = mk(w, h, Math.min(2, devicePixelRatio || 1)); const r = mulberry32(seed);
  const path = new Path2D(); const base = h * 0.86; let x = w * 0.08;
  path.moveTo(x, base);
  while (x < w * 0.9) { const rad = h * (0.2 + r.next() * 0.22); const cx = x + rad * 0.9; path.arc(cx, base - rad * (0.55 + r.next() * 0.35), rad, Math.PI * 0.95, Math.PI * 2.05); x = cx + rad * 0.7; }
  path.lineTo(w * 0.94, base); path.closePath();
  ctx.save(); ctx.translate(0, h * 0.05); ctx.fillStyle = rgba(P.cloudShade, 0.9); ctx.fill(path); ctx.restore();
  texFill(ctx, path, [0, 0, w, h], P.cloud, P.cloudShade, seed, { light: "#ffffff", dark: P.ink, density: 0.08, da: 0.07, la: 0.6 });
  return c;
}

// ---------------- 漂浮的石台 + 北欧小屋（左上）/ 小木屋 + 雪松（右侧）
function slab(ctx: CanvasRenderingContext2D, P: Pal, x: number, y: number, w: number, depth: number, seed: number) {
  const r = mulberry32(seed);
  // 岩石底：倒锥，三块刻面
  const under = new Path2D(); under.moveTo(x, y + 10); under.lineTo(x + w, y + 10);
  const pts: [number, number][] = [[x + w, y + 10], [x + w * 0.92, y + depth * 0.45], [x + w * 0.7, y + depth * 0.8], [x + w * 0.52, y + depth], [x + w * 0.3, y + depth * 0.72], [x + w * 0.1, y + depth * 0.4], [x, y + 10]];
  for (const [px, py] of pts) under.lineTo(px + (r.next() - 0.5) * 6, py); under.closePath();
  texFill(ctx, under, [x, y, w, depth], P.rock, P.rockDark, seed + 1, { light: P.rockLight, dark: P.ink, density: 0.12, da: 0.22 });
  // 刻面亮边
  ctx.save(); ctx.clip(under); ctx.fillStyle = rgba(P.rockLight, 0.45);
  const f = new Path2D(); f.moveTo(x + w * 0.1, y + 10); f.lineTo(x + w * 0.32, y + depth * 0.7); f.lineTo(x + w * 0.4, y + depth * 0.5); f.lineTo(x + w * 0.3, y + 10); f.closePath(); ctx.fill(f);
  ctx.fillStyle = rgba(P.rockDark, 0.5); const f2 = new Path2D(); f2.moveTo(x + w * 0.62, y + 10); f2.lineTo(x + w * 0.52, y + depth); f2.lineTo(x + w * 0.9, y + depth * 0.45); f2.lineTo(x + w, y + 10); f2.closePath(); ctx.fill(f2);
  ctx.restore();
  // 石台正面（厚度）+ 顶面积雪
  const face = new Path2D(); face.roundRect(x - 4, y, w + 8, 16, 4); texFill(ctx, face, [x - 4, y, w + 8, 16], P.rockLight, P.rock, seed + 2, { light: "#ffffff", dark: P.ink, density: 0.1 });
  const snow = new Path2D(); snow.moveTo(x - 8, y + 4);
  for (let i = 0; i <= 12; i++) { const px = x - 8 + ((w + 16) * i) / 12; snow.lineTo(px, y + 2 - Math.sin(i * 1.7 + seed) * 2.5 - 3); }
  snow.lineTo(x + w + 8, y + 5);
  for (let i = 12; i >= 0; i--) { const px = x - 8 + ((w + 16) * i) / 12; snow.lineTo(px, y + 7 + (i % 3 === 0 ? 5 : 1.5)); }
  snow.closePath(); texFill(ctx, snow, [x - 8, y - 8, w + 16, 22], P.snow, P.snowShade, seed + 3, { light: "#ffffff", dark: P.ink, da: 0.08 });
  // 冰柱
  ctx.fillStyle = rgba(P.snow, 0.9); for (let i = 0; i < 5; i++) { const px = x + w * (0.12 + i * 0.19) + r.next() * 8; ctx.beginPath(); ctx.moveTo(px - 2.5, y + 12); ctx.lineTo(px + 2.5, y + 12); ctx.lineTo(px, y + 20 + r.next() * 10); ctx.fill(); }
}
function house(ctx: CanvasRenderingContext2D, P: Pal, x: number, y: number, w: number, h: number, seed: number, door = true) {
  // 墙
  const wall = new Path2D(); wall.rect(x, y, w, h); texFill(ctx, wall, [x, y, w, h], P.wall, P.wallShade, seed, { light: "#ffffff", dark: P.ink, density: 0.1, da: 0.14 });
  // 砖砌底座
  const bh = h * 0.22; const base = new Path2D(); base.rect(x - 3, y + h - bh, w + 6, bh); texFill(ctx, base, [x - 3, y + h - bh, w + 6, bh], P.brick, P.rock, seed + 1, { light: "#ffffff", dark: P.ink, density: 0.12 });
  ctx.save(); ctx.clip(base); ctx.strokeStyle = rgba(P.ink, 0.28); ctx.lineWidth = 0.8;
  for (let row = 0; row < 3; row++) { const yy = y + h - bh + (bh / 3) * row; ctx.beginPath(); ctx.moveTo(x - 3, yy); ctx.lineTo(x + w + 3, yy); ctx.stroke(); for (let k = 0; k < 8; k++) { const xx = x - 3 + ((w + 6) / 6) * (k + (row % 2) * 0.5); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + bh / 3); ctx.stroke(); } }
  ctx.restore();
  // 屋顶 + 积雪
  const roof = new Path2D(); roof.moveTo(x - 12, y + 4); roof.lineTo(x + w / 2, y - h * 0.58); roof.lineTo(x + w + 12, y + 4); roof.closePath();
  texFill(ctx, roof, [x - 12, y - h * 0.6, w + 24, h * 0.64], P.roof, P.ink, seed + 2, { light: "#ffffff", dark: "#000000", density: 0.1, la: 0.25 });
  const cap = new Path2D(); cap.moveTo(x - 14, y + 4); cap.lineTo(x + w / 2, y - h * 0.62); cap.lineTo(x + w + 14, y + 4);
  cap.quadraticCurveTo(x + w + 8, y + 12, x + w * 0.85, y + 2); cap.quadraticCurveTo(x + w * 0.7, y + 9, x + w * 0.55, y - h * 0.12);
  cap.lineTo(x + w / 2, y - h * 0.46); cap.quadraticCurveTo(x + w * 0.3, y - h * 0.1, x + w * 0.18, y + 6); cap.quadraticCurveTo(x, y + 12, x - 14, y + 4); cap.closePath();
  texFill(ctx, cap, [x - 14, y - h * 0.64, w + 28, h * 0.8], P.snow, P.snowShade, seed + 3, { light: "#ffffff", dark: P.ink, da: 0.09 });
  // 门洞 + 暖光
  if (door) {
    const dw = w * 0.3, dh = h * 0.58, dx = x + w * 0.2, dy = y + h - dh - bh * 0.1; const d = new Path2D(); d.moveTo(dx, dy + dh); d.lineTo(dx, dy + dw / 2); d.arc(dx + dw / 2, dy + dw / 2, dw / 2, Math.PI, 0); d.lineTo(dx + dw, dy + dh); d.closePath();
    texFill(ctx, d, [dx, dy, dw, dh], P.door, P.ink, seed + 4, { light: P.glow, dark: "#000000", density: 0.06, la: 0.25 });
    const gl = ctx.createRadialGradient(dx + dw / 2, dy + dh * 0.62, 0, dx + dw / 2, dy + dh * 0.62, dw); gl.addColorStop(0, rgba(P.glow, 0.55)); gl.addColorStop(1, rgba(P.glow, 0));
    ctx.save(); ctx.clip(d); ctx.fillStyle = gl; ctx.fillRect(dx, dy, dw, dh); ctx.restore();
    // 门楣上一盏小火苗（像参考图里的烛台标记）
    ctx.fillStyle = P.glow; ctx.beginPath(); const fx = x + w * 0.72, fy = y + h * 0.26; ctx.moveTo(fx, fy - 7); ctx.quadraticCurveTo(fx + 4, fy - 1, fx, fy + 3); ctx.quadraticCurveTo(fx - 4, fy - 1, fx, fy - 7); ctx.fill();
    ctx.fillStyle = rgba(P.ink, 0.75); ctx.beginPath(); ctx.moveTo(fx - 4, fy + 5); ctx.lineTo(fx + 4, fy + 5); ctx.lineTo(fx, fy + 11); ctx.fill();
  }
  // 窗
  const wx = x + w * (door ? 0.62 : 0.34), wy = y + h * 0.36, ww = w * 0.24, wh = h * 0.26; const win = new Path2D(); win.roundRect(wx, wy, ww, wh, 2);
  texFill(ctx, win, [wx, wy, ww, wh], P.glow, "#e9a54a", seed + 5, { light: "#ffffff", dark: P.ink, density: 0.05, da: 0.1 });
  ctx.strokeStyle = rgba(P.wallShade, 1); ctx.lineWidth = 2; ctx.stroke(win); ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
  ctx.fillStyle = P.snow; ctx.beginPath(); ctx.roundRect(wx - 3, wy + wh - 1, ww + 6, 4, 2); ctx.fill();
}
function pine(ctx: CanvasRenderingContext2D, P: Pal, x: number, y: number, s: number, seed: number) {
  for (let i = 0; i < 3; i++) {
    const w = s * (1 - i * 0.24), top = y - s * (0.55 + i * 0.42), bot = y - s * i * 0.36;
    const t = new Path2D(); t.moveTo(x, top); t.lineTo(x + w / 2, bot); t.lineTo(x - w / 2, bot); t.closePath();
    texFill(ctx, t, [x - w / 2, top, w, bot - top], P.tree, P.ink, seed + i, { light: "#ffffff", dark: "#000000", la: 0.25, density: 0.1 });
    const sn = new Path2D(); sn.moveTo(x, top); sn.lineTo(x + w * 0.2, top + (bot - top) * 0.42); sn.quadraticCurveTo(x, top + (bot - top) * 0.3, x - w * 0.2, top + (bot - top) * 0.42); sn.closePath();
    ctx.fillStyle = P.snow; ctx.fill(sn);
  }
}
export function paintIsland(kind: 0 | 1, p: BdPalette, seed = 3): HTMLCanvasElement {
  const P = PALETTES[p]; const W = kind === 0 ? 260 : 210, H = kind === 0 ? 250 : 210; const { c, ctx } = mk(W, H, Math.min(2, devicePixelRatio || 1));
  if (kind === 0) { slab(ctx, P, 30, 150, 200, 96, seed); house(ctx, P, 78, 84, 96, 66, seed + 10); pine(ctx, P, 206, 150, 34, seed + 20); }
  else { slab(ctx, P, 26, 128, 160, 78, seed + 30); pine(ctx, P, 60, 128, 44, seed + 40); house(ctx, P, 92, 82, 70, 46, seed + 50, false); }
  return c;
}

// ---------------- 地球周边：流动的夜（仓库主人选定的参考：黑与藏青、半透明层层叠叠的波浪、没有硬边、浪尖一点粉白、满画面细密颗粒）
function wave(x: number, w: number, base: number, amp: number, k: number, ph: number) {
  const u = x / w; return base + amp * (Math.sin(u * k + ph) * 0.62 + Math.sin(u * k * 2.3 + ph * 1.7) * 0.26 + Math.sin(u * k * 4.1 + ph * 0.6) * 0.12);
}
/** 三种天色（跟随手机当地时间与深浅外观，见 shared/world/daylight.ts）。地球外分三层：
 *  底（渐变 + 银河 + 细颗粒 + 零星闪光，满屏不动）、环（绕着地球的几道流动光带与星尘，跟着地球的位置与大小走）、星（远中近三层视差）。
 *  夜 = 仓库主人选定的「流动的藏青 + 细密颗粒」，加「Mysterious Realm」里零星的金色闪光；
 *  白天 = 长春花蓝到淡丁香粉的梦幻天（潮玩参考里的天空），淡星仍在；
 *  晨昏 = 橘红渐变参考：上靛蓝、中藕紫、下珊瑚到杏色。 */
export type SpacePhase = "day" | "dusk" | "night";
interface SpacePal { bg: [number, string][]; stars: number; starTop: number; glints: number; glint: string; grain: number; milky: number; sky: { n: [number, number, number]; a: number; top: number };
  orbit: { halo: [number, string][]; bands: { col: number[]; hi: number[]; a: number }[]; dust: string; dustA: number; crest: number; core: string } }
const SPACE: Record<SpacePhase, SpacePal> = {
  night: {
    bg: [[0, "#070b2c"], [0.5, "#121a55"], [1, "#27307c"]], stars: 0.0011, starTop: 1, glints: 16, glint: "245,211,138", grain: 16, milky: 1,
    sky: { n: [1 / 240, 1 / 1400, 1 / 9000], a: 1, top: 1 },
    orbit: { halo: [[0, "rgba(120,140,255,0.34)"], [0.35, "rgba(110,120,240,0.14)"], [1, "rgba(110,120,240,0)"]],
      bands: [{ col: [96, 118, 236], hi: [206, 216, 255], a: 0.55 }, { col: [128, 118, 230], hi: [255, 210, 232], a: 0.5 }, { col: [84, 104, 214], hi: [190, 204, 255], a: 0.42 }, { col: [110, 96, 200], hi: [236, 214, 255], a: 0.34 }],
      dust: "226,232,255", dustA: 0.7, crest: 0.26, core: "rgba(236,104,150,0.5)" },
  },
  day: {
    bg: [[0, "#7f9ef0"], [0.5, "#a9bef5"], [0.85, "#dcd8f6"], [1, "#efe2f2"]], stars: 0, starTop: 0, glints: 9, glint: "255,255,255", grain: 8, milky: 0,
    sky: { n: [1 / 900, 1 / 4000, 1 / 20000], a: 0.55, top: 0.62 },
    orbit: { halo: [[0, "rgba(255,255,255,0.5)"], [0.35, "rgba(240,244,255,0.2)"], [1, "rgba(240,244,255,0)"]],
      bands: [{ col: [236, 242, 255], hi: [255, 255, 255], a: 0.42 }, { col: [240, 228, 252], hi: [255, 252, 255], a: 0.38 }, { col: [226, 236, 255], hi: [255, 255, 255], a: 0.32 }, { col: [248, 236, 250], hi: [255, 255, 255], a: 0.28 }],
      dust: "255,255,255", dustA: 0.55, crest: 0.14, core: "rgba(255,244,214,0.7)" },
  },
  dusk: {
    bg: [[0, "#1f2468"], [0.42, "#6a4390"], [0.78, "#d07f82"], [1, "#f2b98e"]], stars: 0.0008, starTop: 0.4, glints: 7, glint: "255,226,170", grain: 14, milky: 0.45,
    sky: { n: [1 / 420, 1 / 2400, 1 / 14000], a: 0.85, top: 0.55 },
    orbit: { halo: [[0, "rgba(255,190,200,0.36)"], [0.35, "rgba(250,160,170,0.14)"], [1, "rgba(250,160,170,0)"]],
      bands: [{ col: [236, 128, 140], hi: [255, 214, 190], a: 0.5 }, { col: [246, 156, 124], hi: [255, 230, 196], a: 0.46 }, { col: [196, 112, 170], hi: [255, 200, 222], a: 0.4 }, { col: [255, 176, 136], hi: [255, 238, 210], a: 0.34 }],
      dust: "255,236,220", dustA: 0.6, crest: 0.2, core: "rgba(255,160,100,0.55)" },
  },
};
export function paintSpace(w: number, h: number, phase: SpacePhase = "night", seed = 11): HTMLCanvasElement {
  const P = SPACE[phase]; const dpr = Math.min(1.5, devicePixelRatio || 1); const { c, ctx } = mk(w, h, dpr); const r = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h); for (const [t, col] of P.bg) g.addColorStop(t, col); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const neb = `#${P.orbit.bands[1].col.map((v) => v.toString(16).padStart(2, "0")).join("")}`; mottle(ctx, w, h, neb, seed + 3, 8, phase === "day" ? 0.1 : 0.12);   // 几团很淡的星云
  // 银河：一条斜穿上半幅的淡光带，带里是更密的星尘与几缕暗的尘埃（只在夜与晨昏）
  if (P.milky > 0) {
    const bandY = (x: number) => h * (0.06 + 0.3 * (x / w)) + Math.sin(x / w * 3.2) * h * 0.03, bw = h * 0.11;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let x = -40; x <= w + 40; x += 18) {
      const y = bandY(x); const gr = ctx.createRadialGradient(x, y, 0, x, y, bw * 1.3);
      gr.addColorStop(0, `rgba(200,206,255,${0.06 * P.milky})`); gr.addColorStop(0.5, `rgba(170,170,245,${0.035 * P.milky})`); gr.addColorStop(1, "rgba(170,170,245,0)");
      ctx.fillStyle = gr; ctx.fillRect(x - bw * 1.3, y - bw * 1.3, bw * 2.6, bw * 2.6);
    }
    ctx.restore();
    ctx.save(); for (let i = 0; i < 40; i++) { const x = r.next() * w, y = bandY(x) + (r.next() - 0.5) * bw * 0.8, rr = 6 + r.next() * 22; const dg = ctx.createRadialGradient(x, y, 0, x, y, rr); dg.addColorStop(0, `rgba(8,10,34,${0.22 * P.milky})`); dg.addColorStop(1, "rgba(8,10,34,0)"); ctx.fillStyle = dg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); } ctx.restore();
    const n = Math.round(w * h * 0.012 * P.milky);
    for (let i = 0; i < n; i++) { const x = r.next() * w; const g2 = (r.next() + r.next() + r.next() - 1.5) / 1.5; const y = bandY(x) + g2 * bw; const s2 = 0.4 + r.next() * r.next() * 0.9; ctx.fillStyle = `rgba(236,238,255,${(0.18 + r.next() * 0.5) * P.milky})`; ctx.fillRect(x, y, s2, s2); }
  }
  // 细密颗粒：亮处多一些亮点，暗处是极细的星尘；星只落在画面上部 starTop 以内
  const im = ctx.getImageData(0, 0, c.width, c.height); const d = im.data; const W = c.width, starRows = P.starTop * c.height;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3; const n = r.next();
    const k = (n - 0.5) * (P.grain + lum * 0.2);
    d[i] = Math.max(0, Math.min(255, d[i] + k)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k * 1.1));
    if (P.stars && n > 1 - P.stars && (i >> 2) / W < starRows) { d[i] = d[i + 1] = d[i + 2] = 230 + r.next() * 25; }
  }
  ctx.putImageData(im, 0, 0);
  // 零星的四角闪光（夜里是金色，白天是白色），很小、很少
  for (let i = 0; i < P.glints; i++) {
    const x = r.next() * w, y = r.next() * h * (phase === "day" ? 0.7 : 0.62); const s = 3 + r.next() * r.next() * 7; const a = 0.5 + r.next() * 0.45;
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = "screen";
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6); gl.addColorStop(0, `rgba(${P.glint},${a * 0.5})`); gl.addColorStop(1, `rgba(${P.glint},0)`); ctx.fillStyle = gl; ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    ctx.fillStyle = `rgba(${P.glint},${a})`; ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill();
    ctx.restore();
  }
  return c;
}


/** 环：绕着地球的几道流动光带（像星云的旋臂，一侧亮一侧淡），带里撒星尘，最里一圈是贴着地球的柔光。
 *  画在一张以地球为中心的方画布上，参考半径 ORBIT_R0；运行时按地球在屏幕上的位置与半径平移、缩放。 */
export const ORBIT_R0 = 150;
export function paintOrbit(phase: SpacePhase, seed = 5): HTMLCanvasElement {
  const O = SPACE[phase].orbit; const S = ORBIT_R0 * 6.2; const dpr = Math.min(1.5, devicePixelRatio || 1); const { c, ctx } = mk(S, S, dpr); const r = mulberry32(seed);
  const cx = S / 2, cy = S / 2, r0 = ORBIT_R0;
  { const hg = ctx.createRadialGradient(cx, cy, r0 * 0.96, cx, cy, r0 * 2); for (const [t, col] of O.halo) hg.addColorStop(t, col); ctx.fillStyle = hg; ctx.fillRect(0, 0, S, S); }
  const bands = [
    { rb: 1.3, flat: 0.88, rot: -0.35, th: 0.2, spin: 0.1, th0: 0.7, blur: 9 },
    { rb: 1.62, flat: 0.8, rot: 0.3, th: 0.28, spin: 0.14, th0: 3.0, blur: 13 },
    { rb: 2.0, flat: 0.76, rot: -0.18, th: 0.34, spin: 0.16, th0: 5.0, blur: 17 },
    { rb: 2.45, flat: 0.72, rot: 0.42, th: 0.4, spin: 0.2, th0: 1.8, blur: 22 },
  ];
  const TAU = Math.PI * 2, N = 300;
  const at = (B: typeof bands[0], t: number, off: number, ph: number) => {   // 带上一点（t∈[0,1)，off∈[-0.5,0.5] 是横跨带宽的位置）
    const th = t * TAU; const env = Math.pow(0.5 + 0.5 * Math.cos(th - B.th0), 1.4);
    const rr = r0 * B.rb * (1 + B.spin * (t - 0.5) + 0.035 * Math.sin(3 * th + ph)) + off * r0 * B.th * (0.35 + 0.65 * env);
    const x = Math.cos(th) * rr, y = Math.sin(th) * rr * B.flat; const cs = Math.cos(B.rot), sn = Math.sin(B.rot);
    return { x: cx + x * cs - y * sn, y: cy + x * sn + y * cs, env };
  };
  // 沿带的明暗（一侧亮一侧淡）用锥形渐变表达：每道只画一条整路径，几十次绘制就够（逐段描边在手机上会卡）
  const conic = (B: typeof bands[0], col: number[], a: number) => {
    const g = ctx.createConicGradient(0, cx, cy);
    for (let i = 0; i <= 48; i++) { const phi = (i / 48) * TAU; const pl = phi - B.rot; const th = Math.atan2(Math.sin(pl) / B.flat, Math.cos(pl)); const env = Math.pow(0.5 + 0.5 * Math.cos(th - B.th0), 1.4); g.addColorStop(i / 48, `rgba(${col.join(",")},${a * env})`); }
    return g;
  };
  const pathOf = (B: typeof bands[0], u: number, ph: number) => { const p = new Path2D(); for (let i = 0; i <= N; i++) { const q = at(B, (i % N) / N, u, ph); if (i) p.lineTo(q.x, q.y); else p.moveTo(q.x, q.y); } return p; };
  bands.forEach((B, bi) => {
    const C = O.bands[bi]; const ph = r.next() * TAU;
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.filter = `blur(${B.blur}px)`; ctx.lineJoin = "round";
    for (let k = 0; k < 5; k++) {                                          // 横跨带宽的 5 道，外沿亮、内沿淡
      const u = k / 4 - 0.5; const col = u > 0.2 ? C.hi : C.col; ctx.lineWidth = r0 * B.th * 0.28;
      ctx.strokeStyle = conic(B, col, C.a * (0.35 + 0.65 * (u + 0.5))); ctx.stroke(pathOf(B, u, ph));
    }
    ctx.restore();
    // 星尘：顺着带撒的细点，中心密两边疏（像沙画的颗粒，也像星）
    const n = Math.round(900 * (1 + bi * 0.4));
    for (let i = 0; i < n; i++) { const t = r.next(); const u = (r.next() + r.next() + r.next() - 1.5) / 3; const p = at(B, t, u * 1.3, ph); if (r.next() > p.env) continue;
      const sz = 0.5 + r.next() * r.next() * 1.4; ctx.fillStyle = `rgba(${O.dust},${O.dustA * (0.3 + r.next() * 0.7) * p.env})`; ctx.fillRect(p.x, p.y, sz, sz); }
    if (bi === 1) {                                                          // 一团柔光芯（夜：粉；晨昏：橘；白天：奶油）
      const p = at(B, B.th0 / TAU, 0.2, ph); const rr = r0 * 0.7; const cg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr); cg.addColorStop(0, O.core); cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = cg; ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2); ctx.restore();
    }
    if (bi === 0) {                                                          // 最里一道的外沿：一缕淡虹彩
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.filter = "blur(2.5px)"; ctx.lineWidth = 2.2;
      ([[[255, 130, 140], 0.62], [[255, 230, 160], 0.56], [[170, 236, 255], 0.5]] as [number[], number][]).forEach(([col, u]) => { ctx.strokeStyle = conic(B, col, O.crest); ctx.stroke(pathOf(B, u, ph)); });
      ctx.restore();
    }
  });
  // 外缘柔和地消失（画布边不留硬边）
  ctx.save(); ctx.globalCompositeOperation = "destination-in"; const fg = ctx.createRadialGradient(cx, cy, r0 * 2.3, cx, cy, S / 2); fg.addColorStop(0, "rgba(0,0,0,1)"); fg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = fg; ctx.fillRect(0, 0, S, S); ctx.restore();
  return c;
}

/** 三层星（远 / 中 / 近）：各画一张透明画布，拖地球时以不同幅度平移，出「外面是浩瀚宇宙」的纵深。
 *  远层：很多很小很暗；中层：一些带淡彩（蓝白、淡金、淡粉）；近层：少数亮星，带光晕，其中几颗有四道星芒。 */
export function paintStars(w: number, h: number, phase: SpacePhase, layer: 0 | 1 | 2, seed = 29): HTMLCanvasElement {
  const P = SPACE[phase].sky; const dpr = Math.min(1.5, devicePixelRatio || 1); const { c, ctx } = mk(w, h, dpr); const r = mulberry32(seed + layer * 101);
  const n = Math.round(w * h * P.n[layer]); const tint = ["236,240,255", "255,236,200", "255,214,230", "206,222,255"];
  for (let i = 0; i < n; i++) {
    const x = r.next() * w, v = Math.pow(r.next(), phase === "night" ? 1 : 1.6), y = v * h * P.top;     // 晨昏 / 白天：星多在上方
    const fade = phase === "night" ? 1 - Math.max(0, v - 0.7) * 1.4 : 1 - v * 0.8;
    const col = layer === 0 ? tint[0] : tint[Math.floor(r.next() * (layer === 1 ? 4 : 2))];
    if (layer === 0) { const s = 0.5 + r.next() * 0.7; ctx.fillStyle = `rgba(${col},${(0.25 + r.next() * 0.5) * P.a * fade})`; ctx.fillRect(x, y, s, s); continue; }
    const s = layer === 1 ? 0.7 + r.next() * 0.9 : 1.2 + r.next() * 1.3; const a = (layer === 1 ? 0.55 + r.next() * 0.4 : 0.85) * P.a * fade;
    const halo = s * (layer === 1 ? 3 : 5.5); const g = ctx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, `rgba(${col},${a * 0.55})`); g.addColorStop(0.3, `rgba(${col},${a * 0.14})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a * 1.1)})`; ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, Math.PI * 2); ctx.fill();
    if (layer === 2 && r.next() < 0.35) {                                           // 四道星芒
      const L = s * (5 + r.next() * 6); ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = "lighter";
      for (const [dx, dy] of [[1, 0], [0, 1]]) { const lg = ctx.createLinearGradient(-dx * L, -dy * L, dx * L, dy * L); lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(0.5, `rgba(${col},${a * 0.7})`); lg.addColorStop(1, `rgba(${col},0)`); ctx.strokeStyle = lg; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-dx * L, -dy * L); ctx.lineTo(dx * L, dy * L); ctx.stroke(); }
      ctx.restore();
    }
  }
  return c;
}

/** 「新建旅程」按钮的底：一小片梦幻宇宙（长春花蓝 → 藕紫 → 粉，两道星云弧、细颗粒、几颗小星）。平面、有沙画颗粒，不做立体的渐变 */
/** 「新建旅程」的底（第八轮）：全应用唯一带颜色的按钮。不是蓝紫，而是和高亮色「晨」同一家的暖色：晨金 → 杏 → 珊瑚（像日出），
 *  白色的星云弧与小星，字是墨色（对比够）。夜里底深一档，字仍是墨。颗粒与两道弧的笔触和地球外的环一样。 */
export function paintDreamButton(w: number, h: number, seed = 23, night = false): string {
  const dpr = 2; const { c, ctx } = mk(w, h, dpr); const r = mulberry32(seed);
  const stops: readonly [string, string, string] = night ? DREAM.night : DREAM.day;   // 蜜 → 晨 → 琥珀：只有晨色一个色相，和天空、「现在」的标签、小人的外套都是一家
  const g = ctx.createLinearGradient(0, 0, w, h * 0.6); g.addColorStop(0, stops[0]); g.addColorStop(0.55, stops[1]); g.addColorStop(1, stops[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const glow = (x: number, y: number, rr: number, col: string) => { const gg = ctx.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, col); gg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = gg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); };
  const lum = "255,255,255";                                                            // 星、弧、柔光都是白
  ctx.save(); ctx.globalCompositeOperation = "screen"; glow(w * 0.82, h * 0.7, h * 1.1, `rgba(${lum},0.28)`); glow(w * 0.12, h * 0.1, h * 1.0, `rgba(${lum},0.22)`); ctx.restore();
  // 两道星云弧（和地球外的环同一种笔触）
  ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.filter = "blur(3px)"; ctx.lineCap = "round";
  for (const [y0, amp, a, lw] of [[0.72, 0.22, 0.34, 7], [0.36, 0.16, 0.22, 4]] as const) {
    ctx.strokeStyle = `rgba(${lum},${a})`; ctx.lineWidth = lw; ctx.beginPath();
    for (let x = -10; x <= w + 10; x += 4) { const y = h * (y0 - amp * Math.sin((x / w) * Math.PI * 1.2 + 0.4)); if (x < -9) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  // 细颗粒
  const im = ctx.getImageData(0, 0, c.width, c.height); const d = im.data;
  for (let i = 0; i < d.length; i += 4) { const k = (r.next() - 0.5) * 22; d[i] = Math.max(0, Math.min(255, d[i] + k)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k)); }
  ctx.putImageData(im, 0, 0);
  // 几颗小星 + 一个四角闪光
  for (let i = 0; i < 7; i++) { const x = r.next() * w, y = r.next() * h, s = 0.6 + r.next() * 0.9; ctx.fillStyle = `rgba(${lum},${0.55 + r.next() * 0.4})`; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); }
  { const x = w * 0.9, y = h * 0.28, s = 5; ctx.fillStyle = "rgba(255,250,235,0.95)"; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill(); }
  return c.toDataURL("image/png");
}

/** 票的纸面（第八轮末，D74）：白底黑字的纸票——纯白加一层细颗粒，右上角一片很淡的墨色晕（像纸的厚度），不带颜色。按旅程的 seed 出不同的颗粒 */
const ticketCache = new Map<number, string>();
export function paintTicket(seed = 1): string {
  const hit = ticketCache.get(seed); if (hit) return hit;
  const w = 320, h = 140, dpr = 2; const { c, ctx } = mk(w, h, dpr); const r = mulberry32(seed);
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.92, h * 0.1, 0, w * 0.92, h * 0.1, w * 0.7); g.addColorStop(0, "rgba(30,38,64,0.035)"); g.addColorStop(1, "rgba(30,38,64,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const im = ctx.getImageData(0, 0, c.width, c.height); const d = im.data;
  for (let i = 0; i < d.length; i += 4) { const k = (r.next() - 0.5) * 14; d[i] = Math.max(0, Math.min(255, d[i] + k)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k)); }
  ctx.putImageData(im, 0, 0);
  const url = c.toDataURL("image/png"); ticketCache.set(seed, url); return url;
}
