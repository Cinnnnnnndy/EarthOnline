/** 设计令牌注入 + 屏幕形态（D90）：一套判断管直板机、折叠机的外屏、阔折叠 / 书式折叠的内屏、三折叠、平板与桌面（shared/spec/layout.ts）。
 *  形态（Shape）给 CSS 分支用：
 *    compact = 一页（手机、折叠外屏、展开后竖持）——内容是底部抽屉；
 *    spread  = 两页（阔折叠 / 书式折叠展开横持、横持平板）——抽屉停靠成左页，世界在右页；
 *    triple  = 三页（三折叠全开、宽桌面）——左页抽屉、中页世界、右页弹层；
 *    hover   = 半开悬停（横放桌面）——上半屏世界、下半屏抽屉。
 *  折痕：浏览器给得出 visualViewport.segments（折叠机上的 Chromium）或 CSS 的 viewport-segments 媒体查询时按真折痕分页，否则按等分估；
 *  页的范围写进 CSS 变量 --pane-n-x / --pane-n-w、--crease-n、--crease-gap，面板按页停靠，不跨折痕。
 *  截图与调试：?fold=closed|2|3|half 模拟折叠姿态（closed 外屏、2 两段并排、3 三段并排、half 半开悬停）。
 *  字体栈跟界面语言与设备走（shared/world/tokens.ts 的 fontFamily），<html lang> 同时设好，浏览器按语言挑字形。 */
import { cssVars, FONT_FILES, detectPlatform, type Platform } from "../../shared/world/tokens.ts";
import { getLocale, t } from "../../shared/i18n/index.ts";
import { layoutOf, layoutVars, worldInsets, type Layout, type Segment, type ScreenInfo } from "../../shared/spec/layout.ts";

/** 设备（决定字体栈：苹果用系统字体，鸿蒙用 HarmonyOS Sans，其他才用随包字体）。截图与调试：?platform=apple|harmony|other */
export const platform = (): Platform => { const q = new URLSearchParams(location.search).get("platform"); return q === "apple" || q === "harmony" || q === "other" ? q : detectPlatform(navigator.userAgent); };
export type Shape = "compact" | "spread" | "triple" | "hover";

/** 浏览器量到的折痕段（Viewport Segments API；拿不到时只能从媒体查询知道段数，按等分给） */
function segmentsOf(w: number, h: number): Segment[] | undefined {
  const vv = (globalThis as { visualViewport?: VisualViewport & { segments?: DOMRectReadOnly[] } }).visualViewport;
  if (vv?.segments && vv.segments.length >= 2) return vv.segments.map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
  if (typeof matchMedia !== "function") return undefined;
  for (const n of [3, 2]) if (matchMedia(`(horizontal-viewport-segments: ${n})`).matches) return equalSegments(w, h, n, "x");
  if (matchMedia("(vertical-viewport-segments: 2)").matches) return equalSegments(w, h, 2, "y");
  return undefined;
}
const equalSegments = (w: number, h: number, n: number, axis: "x" | "y"): Segment[] => {
  const segs: Segment[] = []; const gap = 8;
  for (let i = 0; i < n; i++) segs.push(axis === "x" ? { x: Math.round((w / n) * i + (i ? gap / 2 : 0)), y: 0, w: Math.round(w / n - gap / 2), h } : { x: 0, y: Math.round((h / n) * i + (i ? gap / 2 : 0)), w, h: Math.round(h / n - gap / 2) });
  return segs;
};
/** 现在的屏幕：尺寸 + 折痕 + 姿态（?fold= 可以模拟） */
export function screenInfo(): ScreenInfo {
  const w = innerWidth, h = innerHeight; const q = new URLSearchParams(location.search).get("fold");
  if (q === "closed") return { width: w, height: h, posture: "closed", hasOuter: true };
  if (q === "2" || q === "3") return { width: w, height: h, posture: "flat", segments: equalSegments(w, h, +q, "x") };
  if (q === "half") return { width: w, height: h, posture: "half", segments: equalSegments(w, h, 2, "y") };
  return { width: w, height: h, segments: segmentsOf(w, h) };
}
let current: Layout | null = null;
/** 现在的布局（布局态、分页、折痕） */
export const layout = (): Layout => current ?? (current = layoutOf(screenInfo()));
export const shapeOf = (l: Layout): Shape => (l.state === "spread" ? "spread" : l.state === "triple" ? "triple" : l.state === "hover" ? "hover" : "compact");
export const shape = (): Shape => shapeOf(layout());
/** 世界该让出来的边：两页 / 三页 / 悬停由分页定；一页由抽屉的高度定（调用方自己算 bottom） */
export const paneInsets = () => worldInsets(layout());
const listeners = new Set<(s: Shape, l: Layout) => void>();
export function onShape(fn: (s: Shape, l: Layout) => void) { listeners.add(fn); return () => listeners.delete(fn); }
export function applyTokens() {
  const root = document.documentElement; const locale = getLocale();
  root.lang = locale; document.title = t("app.name");
  for (const [k, v] of Object.entries(cssVars(false, locale, platform()))) root.style.setProperty(k, v);
  // 随包字体：只有「其他设备」的字体栈里有它（苹果、鸿蒙用系统字体，不下载）
  if (platform() === "other") { const base = import.meta.env.BASE_URL; const st = document.createElement("style");
  st.textContent = `@font-face{font-family:"App Sans";font-weight:100 499;font-display:swap;src:url("${base}${FONT_FILES[400]}") format("truetype")}@font-face{font-family:"App Sans";font-weight:500 900;font-display:swap;src:url("${base}${FONT_FILES[600]}") format("truetype")}`;
  document.head.append(st); }
  let last = ""; const set = () => {
    current = layoutOf(screenInfo()); const s = shapeOf(current);
    root.dataset.shape = s; root.dataset.layout = current.state; root.dataset.device = current.device; root.dataset.panes = String(current.panes.length);
    for (const [k, v] of Object.entries(layoutVars(current))) root.style.setProperty(k, v);
    const sig = `${s}:${current.panes.map((p) => `${p.x}+${p.w}`).join(",")}`;
    if (sig !== last) { last = sig; listeners.forEach((f) => f(s, current!)); }
  };
  set(); addEventListener("resize", set);
  const vv = (globalThis as { visualViewport?: VisualViewport }).visualViewport; vv?.addEventListener?.("resize", set);   // 折痕段变化（开合）也走 resize
  if (typeof matchMedia === "function") for (const q of ["(horizontal-viewport-segments: 2)", "(horizontal-viewport-segments: 3)", "(vertical-viewport-segments: 2)"]) matchMedia(q).addEventListener?.("change", set);
}
