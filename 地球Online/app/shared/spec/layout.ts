/** 屏幕形态（D90）：直板机、折叠机的外屏、阔折叠 / 书式折叠的内屏、三折叠、平板与桌面——三端共用的一套判断。
 *  仓库主人：「要考虑到折叠屏前后的适配，还有普通直板机的适配，阔折叠的适配，三折叠的适配。」
 *
 *  输入只有几何：窗口的宽高、折痕分出的段（网页 visualViewport.segments / CSS viewport-segments；鸿蒙 getCurrentFoldCreaseRegion；
 *  安卓 WindowLayoutInfo 的 FoldingFeature）、折叠姿态；输出一个布局态加每一页的横向范围。界面只认布局态与分页，不认机型：
 *  Pura X Max、Mate X / XT、Galaxy Z Fold、Pixel Fold、iPhone Duo、平板、桌面都只是这里的一条映射。
 *
 *  五个布局态（产品构想 7.2 节的四个 + 三折叠的一个）：
 *    phone   一页：手机竖持、展开后竖持（单页放大）——内容是底部抽屉
 *    outer   一页，折叠机合上的外屏：和 phone 同一套，只是矮，抽屉的半开要高一点
 *    spread  两页：阔折叠 / 书式折叠展开横持、横持平板、桌面——内容停靠成左页，世界在右页，折痕是书脊
 *    triple  三页：三折叠全展开、宽桌面——左页内容、中页世界、右页弹层（站点详情、清单……不再盖在世界上）
 *    hover   半开悬停（横放桌面）：上半屏世界、下半屏控制 / 键盘
 *
 *  鸿蒙 `harmony/.../layout/LayoutState.ets`、安卓 `android/.../layout/LayoutState.kt`、iOS `ios/.../Layout/StageLayout.swift`
 *  各有一份同样规则的移植；`layout.golden.json` 是三端共用的用例（这里的测试跑它，原生的单元测试也跑它）。单位是 CSS px / vp / dp。 */
import type { LayoutState } from "./types.ts";

export type { LayoutState };
/** 设备类（只供日志、截图、文档；界面不按它分支） */
export type DeviceClass = "bar" | "outer" | "book" | "wide" | "tri" | "tablet" | "desktop";
export type FoldPosture = "flat" | "half" | "closed" | "unknown";
/** 折痕分出的一段（相对窗口左上角） */
export interface Segment { x: number; y: number; w: number; h: number }
export interface ScreenInfo {
  width: number; height: number;
  /** 折痕分出的段：两段并排 = 书式 / 阔折叠展开，三段并排 = 三折叠全开，两段上下 = 半开悬停；没有折叠机或拿不到就不给 */
  segments?: Segment[];
  /** 折叠姿态：flat 展开、half 半开、closed 合上；拿不到就 unknown */
  posture?: FoldPosture;
  /** 合上时窗口在外屏（鸿蒙 FOLD_STATUS_FOLDED、安卓合上后窗口尺寸变小都算） */
  hasOuter?: boolean;
}
/** 一页的横向范围（hover 是纵向的：x = 顶边 y，w = 高） */
export interface Pane { x: number; w: number }
export interface Layout {
  state: LayoutState;
  device: DeviceClass;
  /** 1～3 页；hover 时是上下两页（见 Pane 的注释） */
  panes: Pane[];
  /** 折痕中线（spread / triple 是 x，hover 是 y）；没有折痕就按等分给 */
  creases: number[];
  /** 折痕两侧总共留白；拿到真折痕时 = 折痕宽 + 16，否则 24 */
  gap: number;
  /** 这些折痕是真量到的（segments）还是按等分估的 */
  measured: boolean;
}

/** 单页的上限：窄过它就是手机 / 外屏（Pura X Max 外屏 421、Galaxy Z Fold 外屏 ≈ 360、普通手机 390） */
export const PHONE_MAX = 600;
/** 两页：至少这么宽，且不能是竖长的（展开后竖持是单页放大）；0.8 是为了收下 Galaxy Z Fold 那种近方形的内屏（690 × 829） */
export const SPREAD_MIN = 600, SPREAD_RATIO = 0.8;
/** 三页：宽桌面或三折叠全开（Mate XT 全开约 1360 × 950 dp） */
export const TRIPLE_MIN = 1100, TRIPLE_RATIO = 1.3;
/** 估的折痕留白 */
export const FOLD_GAP = 24;

const byX = (a: Segment, b: Segment) => a.x - b.x;
const sideBySide = (s: Segment[]) => s.length >= 2 && s.every((g) => Math.abs(g.y - s[0].y) < 2 && Math.abs(g.h - s[0].h) < 2);
const stacked = (s: Segment[]) => s.length === 2 && Math.abs(s[0].x - s[1].x) < 2 && Math.abs(s[0].w - s[1].w) < 2 && s[0].y !== s[1].y;

/** 按折痕（或等分）切出 n 页 */
function cut(total: number, n: number, segs: Segment[] | null, axis: "x" | "y"): { panes: Pane[]; creases: number[]; gap: number } {
  if (segs && segs.length === n) {
    const sorted = [...segs].sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
    const creases: number[] = [], gaps: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const aEnd = axis === "x" ? a.x + a.w : a.y + a.h, bStart = axis === "x" ? b.x : b.y;
      creases.push(Math.floor((aEnd + bStart) / 2)); gaps.push(Math.max(0, bStart - aEnd) + 16);
    }
    const gap = Math.max(FOLD_GAP, ...gaps);
    const panes: Pane[] = sorted.map((s, i) => {
      const start = i === 0 ? 0 : creases[i - 1] + gap / 2, end = i === n - 1 ? total : creases[i] - gap / 2;
      const xs = Math.round(start), xe = Math.round(end); return { x: xs, w: Math.max(0, xe - xs) };   // 先取整两端再算宽：末页正好贴到边
    });
    return { panes, creases, gap };
  }
  const creases: number[] = []; for (let i = 1; i < n; i++) creases.push(Math.round((total * i) / n));
  const panes: Pane[] = []; for (let i = 0; i < n; i++) { const start = i === 0 ? 0 : creases[i - 1] + FOLD_GAP / 2, end = i === n - 1 ? total : creases[i] - FOLD_GAP / 2; const xs = Math.round(start), xe = Math.round(end); panes.push({ x: xs, w: xe - xs }); }
  return { panes, creases, gap: FOLD_GAP };
}

/** 几何 → 布局态。纯函数；三端同一套规则（改这里要同时改 ArkTS / Kotlin / Swift 的移植，并给 layout.golden.json 加一条） */
export function layoutOf(info: ScreenInfo): Layout {
  const w = Math.max(1, info.width), h = Math.max(1, info.height), ratio = w / h;
  const segs = info.segments && info.segments.length >= 2 ? [...info.segments].sort(byX) : null;
  const posture = info.posture ?? "unknown";
  // 半开悬停：横放桌面，上下两段（真量到的），或姿态是半开且横着
  if ((segs && stacked(segs)) || (posture === "half" && ratio >= 1)) {
    const c = cut(h, 2, segs && stacked(segs) ? segs : null, "y");
    return { state: "hover", device: segs && segs.length === 3 ? "tri" : "book", ...c, measured: !!(segs && stacked(segs)) };
  }
  // 三折叠全开：三段并排
  if (segs && segs.length === 3 && sideBySide(segs)) return { state: "triple", device: "tri", ...cut(w, 3, segs, "x"), measured: true };
  // 书式 / 阔折叠展开：两段并排（竖持时两段上下排不算——那是展开后竖持，单页放大）
  if (segs && segs.length === 2 && sideBySide(segs) && ratio >= SPREAD_RATIO) return { state: "spread", device: ratio >= 1.15 ? "wide" : "book", ...cut(w, 2, segs, "x"), measured: true };
  // 没有折痕信息：按宽高估
  const one = { panes: [{ x: 0, w }], creases: [], gap: 0, measured: false };
  if (w < PHONE_MAX) return { state: posture === "closed" || info.hasOuter ? "outer" : "phone", device: posture === "closed" || info.hasOuter ? "outer" : "bar", ...one };
  if (w >= TRIPLE_MIN && ratio >= TRIPLE_RATIO) return { state: "triple", device: w >= 1400 ? "desktop" : "tablet", ...cut(w, 3, null, "x"), measured: false };
  if (ratio >= SPREAD_RATIO) return { state: "spread", device: w >= 900 ? "tablet" : ratio >= 1.15 ? "wide" : "book", ...cut(w, 2, null, "x"), measured: false };
  return { state: "phone", device: w >= 900 ? "tablet" : "book", ...one };   // 展开后竖持：单页放大
}

/** 网页 / 嵌入页的 CSS 变量（--pane-1-x / --pane-1-w …、--crease-gap）：面板按页停靠，不跨折痕 */
export function layoutVars(l: Layout): Record<string, string> {
  const v: Record<string, string> = { "--crease-gap": `${l.gap}px`, "--pane-count": String(l.panes.length) };
  l.panes.forEach((p, i) => { v[`--pane-${i + 1}-x`] = `${p.x}px`; v[`--pane-${i + 1}-w`] = `${p.w}px`; });
  l.creases.forEach((c, i) => { v[`--crease-${i + 1}`] = `${c}px`; });
  return v;
}

/** 世界该让出来的边（像素）：spread 让出左页，triple 让出左右两页，hover 让出下半屏；phone / outer 由抽屉的高度决定（这里给 0） */
export function worldInsets(l: Layout): { left: number; right: number; top: number; bottom: number } {
  if (l.state === "spread") return { left: l.panes[1].x, right: 0, top: 0, bottom: 0 };
  if (l.state === "triple") return { left: l.panes[1].x, right: Math.max(0, l.panes[2].w + l.gap / 2), top: 0, bottom: 0 };
  if (l.state === "hover") return { left: 0, right: 0, top: 0, bottom: l.panes[1].w + l.gap / 2 };
  return { left: 0, right: 0, top: 0, bottom: 0 };
}
