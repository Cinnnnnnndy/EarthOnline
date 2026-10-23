/** 平面插画背景（「平面 + 渲染」结合）：画布画的点彩天空 + 纸片云 + 四角星 + 漂浮石台上的北欧小屋 + 飘落纸屑（backdrop-paint.ts），
 *  三维渲染（地球、底板、小人）用透明背景叠在上面。三套色调跟随设置。 */
import { paintSky, paintCloud, paintIsland, paintSpace, paintStars, paintOrbit, ORBIT_R0, type SpacePhase } from "./backdrop-paint.ts";
export type BackdropPalette = "sea" | "warm" | "dusk";
export interface Backdrop { el: HTMLElement; setPalette(p: BackdropPalette): void; parallax(x: number, y: number): void; setMode(m: "sky" | "horizon" | "space"): void; setPhase(p: SpacePhase): void; orbit(x: number, y: number, r: number, spin: number): void; dispose(): void }

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .1  0 0 0 0 .08  0 0 0 0 .14  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`;

export function mountBackdrop(host: HTMLElement, palette: BackdropPalette = "sea", phase: SpacePhase = "night"): Backdrop {
  const el = document.createElement("div"); el.className = `backdrop pal-${palette}`; let pal = palette; let ph = phase; el.dataset.phase = ph;
  // 天空：画布（渐变 + 斑驳 + 点彩 + 细颗粒），尺寸变了再重画
  const skyHost = document.createElement("div"); skyHost.className = "bd-sky";
  const clouds = [0, 1, 2, 3, 4].map((i) => { const c = document.createElement("div"); c.className = `bd-cloud c${i}`; return c; });
  const isl = [0, 1].map((i) => { const d = document.createElement("div"); d.className = `bd-island i${i}`; return d; });
  const layers = { far: document.createElement("div"), mid: document.createElement("div"), near: document.createElement("div") };
  layers.far.className = "bd-layer far"; layers.mid.className = "bd-layer mid"; layers.near.className = "bd-layer near";
  const sun = document.createElement("div"); sun.className = "bd-sun";
  const hills = document.createElement("div"); hills.className = "bd-hills";
  hills.innerHTML = `<svg viewBox='0 0 1600 300' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg'><path d='M0 170 Q120 90 240 150 T520 120 T820 150 T1120 100 T1400 140 T1600 110 V300 H0Z' fill='var(--bd-hill-far)'/><path d='M0 220 Q160 150 340 205 T700 190 T1060 210 T1380 180 T1600 200 V300 H0Z' fill='var(--bd-hill-near)'/></svg>`;
  // 第五轮消融：去掉四角星与飘落纸屑（装饰过多），只留天空颗粒、云、太阳和两座小岛
  layers.far.append(sun, clouds[0], clouds[3]);
  layers.mid.append(clouds[1], clouds[4], hills);
  layers.near.append(clouds[2], ...isl);
  const grain = document.createElement("div"); grain.className = "bd-grain"; grain.style.backgroundImage = GRAIN;
  // 地球周边：一张画布（层层叠叠的波浪 + 细密颗粒；夜里有星与金色闪光，白天是日晕，晨昏是低处的橘色太阳）+ 夜里几颗很淡的闪烁星
  const spaceHost = document.createElement("div"); spaceHost.className = "bd-space";
  const starLayers = [0, 1, 2].map((i) => { const d = document.createElement("div"); d.className = `bd-stars s${i}`; return d; });
  const twinkles = Array.from({ length: 10 }, (_, i) => { const t = document.createElement("i"); t.className = "bd-tw"; t.style.left = `${(i * 37 + 11) % 97}%`; t.style.top = `${(i * 23 + 7) % 62}%`; t.style.animationDelay = `${-i * 0.9}s`; t.style.animationDuration = `${3 + (i % 4) * 0.8}s`; return t; });
  starLayers[2].append(...twinkles);
  const orbitEl = document.createElement("div"); orbitEl.className = "bd-orbit";
  spaceHost.append(orbitEl, ...starLayers);
  el.append(skyHost, spaceHost, layers.far, layers.mid, layers.near, grain);
  host.prepend(el);
  const paintParts = () => {
    clouds.forEach((c, i) => c.replaceChildren(paintCloud(180 + i * 40, pal, i * 17 + 3)));
    isl.forEach((d, i) => d.replaceChildren(paintIsland(i as 0 | 1, pal, 5 + i * 11)));
  };
  let sized = { w: 0, h: 0 }; let timer = 0;
  const paintSkyNow = () => { const r = el.getBoundingClientRect(); const w = Math.round(r.width), h = Math.round(r.height); if (w < 10 || h < 10) return; if (Math.abs(w - sized.w) < 24 && Math.abs(h - sized.h) < 24 && skyHost.firstChild) return; sized = { w, h }; skyHost.replaceChildren(paintSky(w, h, pal, 7, ph === "night")); };
  let spaceSize = { w: 0, h: 0 };
  const paintSpaceNow = () => { if (el.dataset.mode !== "space") return; const r = el.getBoundingClientRect(); const w = Math.round(r.width), h = Math.round(r.height); if (w < 10 || h < 10) return; if (Math.abs(w - spaceSize.w) < 24 && Math.abs(h - spaceSize.h) < 24 && spaceHost.querySelector(":scope > canvas")) return; spaceSize = { w, h }; spaceHost.querySelector(":scope > canvas")?.remove(); spaceHost.prepend(paintSpace(w, h, ph));
    const sw = Math.round(w * 1.1), shh = Math.round(h * 1.1); starLayers.forEach((d, i) => { d.querySelector("canvas")?.remove(); d.prepend(paintStars(sw, shh, ph, i as 0 | 1 | 2)); });
    if (orbitEl.dataset.phase !== ph) { orbitEl.dataset.phase = ph; orbitEl.replaceChildren(paintOrbit(ph)); } };
  let orb = { x: -1, y: -1, r: -1, s: 0 };
  const ro = new ResizeObserver(() => { clearTimeout(timer); timer = window.setTimeout(() => { paintSkyNow(); paintSpaceNow(); }, skyHost.firstChild ? 220 : 0); }); ro.observe(el);
  paintParts();
  return {
    el,
    setPalette(p) { if (p === pal) return; pal = p; el.className = el.className.replace(/pal-\w+/, `pal-${p}`); sized = { w: 0, h: 0 }; paintSkyNow(); paintParts(); },
    parallax(x, y) { starLayers.forEach((d, i) => { const k = [5, 12, 24][i]; d.style.transform = `translate(${x * k}px, ${y * k * 0.6}px)`; }); layers.far.style.transform = `translate(${x * 6}px, ${y * 4}px)`; layers.mid.style.transform = `translate(${x * 14}px, ${y * 8}px)`; layers.near.style.transform = `translate(${x * 26}px, ${y * 14}px)`; },
    setMode(m) { el.dataset.mode = m; paintSpaceNow(); },
    setPhase(p) { if (p === ph) return; ph = p; el.dataset.phase = p; spaceSize = { w: 0, h: 0 }; paintSpaceNow(); sized = { w: 0, h: 0 }; paintSkyNow(); },   // 天空（某一天的底）夜里也换（D85）
    orbit(x, y, r, spin) {                                     // 环跟着地球：圆心 = 地球在屏幕上的圆心，缩放 = 地球屏幕半径 / 参考半径；拉近到地球占满屏时淡出
      if (Math.abs(x - orb.x) < 0.5 && Math.abs(y - orb.y) < 0.5 && Math.abs(r - orb.r) < 0.5 && Math.abs(spin - orb.s) < 0.05) return; orb = { x, y, r, s: spin };
      const k = r / ORBIT_R0; orbitEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k}) rotate(${spin}deg)`; orbitEl.style.opacity = String(Math.max(0, Math.min(1, (3.2 - k) / 1.4)));
    },
    dispose() { ro.disconnect(); el.remove(); },
  };
}
