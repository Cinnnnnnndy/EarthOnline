import { display, window } from '@kit.ArkUI';
import { PHONE_MAX, SPREAD_RATIO, TRIPLE_MIN, TRIPLE_RATIO, FOLD_GAP } from '../gen/Shared';

/** 屏幕形态（D90）：shared/spec/layout.ts 的 ArkTS 移植——规则、阈值（gen/Shared.ets）、用例（layout.golden.json）三端一致，改一处必须同时改 TS / Kotlin / Swift。
 *  输入只有几何（窗口宽高、折痕段、折叠姿态），输出布局态 + 分页；界面只读 AppStorage 里的 'eo.layout'，不认机型。
 *  布局态：phone 一页 / outer 折叠外屏一页 / spread 两页 / triple 三页（三折叠全开）/ hover 半开悬停（上下两半）。
 *  layoutOf / worldInsets 是纯函数（entry/src/ohosTest/ets/test/Layout.test.ets 跑黄金用例）；LayoutState.watch 负责量窗口与折痕。 */
export type Layout = 'phone' | 'outer' | 'spread' | 'hover' | 'triple';
export type Posture = 'flat' | 'half' | 'closed' | 'unknown';
export type DeviceClass = 'bar' | 'outer' | 'book' | 'wide' | 'tri' | 'tablet' | 'desktop';

export class Segment {
  x: number = 0; y: number = 0; w: number = 0; h: number = 0;
  constructor(x: number, y: number, w: number, h: number) { this.x = x; this.y = y; this.w = w; this.h = h; }
}
/** 一页的横向范围（hover 是纵向的：x = 顶边 y，w = 高） */
export class Pane {
  x: number = 0; w: number = 0;
  constructor(x: number, w: number) { this.x = x; this.w = w; }
}
export class ScreenInfo {
  width: number = 0;
  height: number = 0;
  segments: Segment[] | null = null;
  posture: Posture = 'unknown';
  hasOuter: boolean = false;
}
export class LayoutResult {
  state: Layout = 'phone';
  device: DeviceClass = 'bar';
  panes: Pane[] = [];
  creases: number[] = [];
  gap: number = 0;
  measured: boolean = false;
}
/** 世界该让出来的边（vp = CSS px） */
export class Insets {
  left: number = 0; right: number = 0; top: number = 0; bottom: number = 0;
  key(): string { return this.left + ',' + this.right + ',' + this.top + ',' + this.bottom; }
}

/** 放进 AppStorage('eo.layout') 的整份布局：布局态 + 窗口尺寸 + 量到的折痕与姿态（set-layout 原样带给嵌入页） */
export class LayoutInfo {
  result: LayoutResult = LayoutInfo.phone(360);
  width: number = 360;
  height: number = 780;
  posture: Posture = 'unknown';
  segments: Segment[] = [];

  static phone(w: number): LayoutResult { const r = new LayoutResult(); r.panes = [new Pane(0, w)]; return r; }
}

/** 安全区（vp）：状态栏 / 挖孔、底部导航条 */
export class SafeArea { top: number = 0; bottom: number = 0; left: number = 0; right: number = 0; }

export function isCompact(state: Layout): boolean { return state === 'phone' || state === 'outer'; }

function sideBySide(s: Segment[]): boolean {
  if (s.length < 2) return false;
  for (const g of s) { if (Math.abs(g.y - s[0].y) >= 2 || Math.abs(g.h - s[0].h) >= 2) return false; }
  return true;
}
function stacked(s: Segment[]): boolean {
  return s.length === 2 && Math.abs(s[0].x - s[1].x) < 2 && Math.abs(s[0].w - s[1].w) < 2 && s[0].y !== s[1].y;
}

/** 按折痕（或等分）切出 n 页；axis 'x' 横向分页，'y' 上下分（悬停） */
function cut(total: number, n: number, segs: Segment[] | null, axis: string): LayoutResult {
  const r = new LayoutResult();
  if (segs !== null && segs.length === n) {
    const sorted = segs.slice().sort((a: Segment, b: Segment) => axis === 'x' ? a.x - b.x : a.y - b.y);
    let gap = FOLD_GAP;
    for (let i = 0; i < n - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const aEnd = axis === 'x' ? a.x + a.w : a.y + a.h, bStart = axis === 'x' ? b.x : b.y;
      r.creases.push(Math.floor((aEnd + bStart) / 2));
      gap = Math.max(gap, Math.max(0, bStart - aEnd) + 16);
    }
    r.gap = gap;
    for (let i = 0; i < n; i++) {
      const start = i === 0 ? 0 : r.creases[i - 1] + gap / 2, end = i === n - 1 ? total : r.creases[i] - gap / 2;
      const xs = Math.round(start), xe = Math.round(end);   // 先取整两端再算宽：末页正好贴到边
      r.panes.push(new Pane(xs, Math.max(0, xe - xs)));
    }
    return r;
  }
  for (let i = 1; i < n; i++) r.creases.push(Math.round((total * i) / n));
  r.gap = FOLD_GAP;
  for (let i = 0; i < n; i++) {
    const start = i === 0 ? 0 : r.creases[i - 1] + FOLD_GAP / 2, end = i === n - 1 ? total : r.creases[i] - FOLD_GAP / 2;
    const xs = Math.round(start), xe = Math.round(end);
    r.panes.push(new Pane(xs, xe - xs));
  }
  return r;
}

/** 几何 → 布局态（与 layout.ts 的 layoutOf 逐条对应） */
export function layoutOf(info: ScreenInfo): LayoutResult {
  const w = Math.max(1, info.width), h = Math.max(1, info.height), ratio = w / h;
  const segs: Segment[] | null = info.segments !== null && info.segments.length >= 2
    ? info.segments.slice().sort((a: Segment, b: Segment) => a.x - b.x) : null;
  const posture = info.posture;
  const isStacked = segs !== null && stacked(segs);
  // 半开悬停：横放桌面，上下两段（真量到的），或姿态是半开且横着
  if (isStacked || (posture === 'half' && ratio >= 1)) {
    const r = cut(h, 2, isStacked ? segs : null, 'y');
    r.state = 'hover'; r.device = segs !== null && segs.length === 3 ? 'tri' : 'book'; r.measured = isStacked;
    return r;
  }
  // 三折叠全开：三段并排
  if (segs !== null && segs.length === 3 && sideBySide(segs)) {
    const r = cut(w, 3, segs, 'x'); r.state = 'triple'; r.device = 'tri'; r.measured = true; return r;
  }
  // 书式 / 阔折叠展开：两段并排（竖持时两段上下排不算——那是展开后竖持，单页放大）
  if (segs !== null && segs.length === 2 && sideBySide(segs) && ratio >= SPREAD_RATIO) {
    const r = cut(w, 2, segs, 'x'); r.state = 'spread'; r.device = ratio >= 1.15 ? 'wide' : 'book'; r.measured = true; return r;
  }
  // 没有折痕信息：按宽高估
  const one = new LayoutResult(); one.panes = [new Pane(0, w)];
  if (w < PHONE_MAX) {
    const outer = posture === 'closed' || info.hasOuter;
    one.state = outer ? 'outer' : 'phone'; one.device = outer ? 'outer' : 'bar'; return one;
  }
  if (w >= TRIPLE_MIN && ratio >= TRIPLE_RATIO) {
    const r = cut(w, 3, null, 'x'); r.state = 'triple'; r.device = w >= 1400 ? 'desktop' : 'tablet'; return r;
  }
  if (ratio >= SPREAD_RATIO) {
    const r = cut(w, 2, null, 'x'); r.state = 'spread'; r.device = w >= 900 ? 'tablet' : ratio >= 1.15 ? 'wide' : 'book'; return r;
  }
  one.state = 'phone'; one.device = w >= 900 ? 'tablet' : 'book';   // 展开后竖持：单页放大
  return one;
}

/** 世界该让出来的边：两页让左页，三页让左右两页，悬停让下半；一页由抽屉高度定（这里 0） */
export function worldInsets(l: LayoutResult): Insets {
  const i = new Insets();
  if (l.state === 'spread' && l.panes.length > 1) i.left = l.panes[1].x;
  else if (l.state === 'triple' && l.panes.length > 2) { i.left = l.panes[1].x; i.right = Math.max(0, l.panes[2].w + l.gap / 2); }
  else if (l.state === 'hover' && l.panes.length > 1) i.bottom = l.panes[1].w + l.gap / 2;
  return i;
}

/** 折叠状态 → 姿态。三折叠（Mate XT）的状态值是组合的（第一折 × 第二折），这里折成三种；枚举以当期 @ohos.display 文档为准 */
function postureOf(fold: number): Posture {
  // display.FoldStatus：UNKNOWN 0、EXPANDED 1、FOLDED 2、HALF_FOLDED 3；三折叠的组合值（API 15+）：11 两折全开、12 第一折合上第二折展开、13 半折 + 展开、21 / 22 / 23 ……
  if (fold === 1 || fold === 11 || fold === 12) return 'flat';
  if (fold === 2 || fold === 22) return 'closed';
  if (fold === 3 || fold === 13 || fold === 21 || fold === 23) return 'half';
  return 'unknown';
}

export class LayoutState {
  static info: LayoutInfo = new LayoutInfo();
  private static lastKey: string = '';

  /** px → vp：用显示器的密度（不依赖 UI 上下文里的全局 px2vp） */
  static density(): number {
    try { const d = display.getDefaultDisplaySync().densityPixels; return d > 0 ? d : 1; } catch (e) { return 1; }
  }

  /** 现在的屏幕：窗口尺寸 + 折痕矩形（折成段）+ 姿态 */
  static screenInfo(win: window.Window): ScreenInfo {
    const info = new ScreenInfo();
    const rect = win.getWindowProperties().windowRect;
    const dp = LayoutState.density();
    info.width = Math.round(rect.width / dp);
    info.height = Math.round(rect.height / dp);
    try {
      if (!display.isFoldable()) return info;
      info.posture = postureOf(display.getFoldStatus() as number);
      // FoldDisplayMode：UNKNOWN 0、FULL 1、MAIN 2、SUB 3、COORDINATION 4；姿态拿不到时，主 / 副屏单独显示也算外屏
      let mode = 0;
      try { mode = display.getFoldDisplayMode() as number; } catch (e) { mode = 0; }
      info.hasOuter = info.posture === 'closed' || (info.posture === 'unknown' && (mode === 2 || mode === 3));
      if (info.posture === 'closed') return info;
      const creases = display.getCurrentFoldCreaseRegion().creaseRects;
      if (creases.length === 0) return info;
      // 折痕矩形（px，相对屏幕）→ 折痕两侧的段（vp，相对窗口）
      const vertical = creases[0].height > creases[0].width;   // 竖折痕：左右分页；横折痕：上下分（悬停）
      const sorted = creases.slice().sort((a: display.Rect, b: display.Rect) => vertical ? a.left - b.left : a.top - b.top);
      const segs: Segment[] = [];
      let cursor = 0;
      for (const c of sorted) {
        const s = vertical ? (c.left - rect.left) / dp : (c.top - rect.top) / dp;
        const e = vertical ? (c.left + c.width - rect.left) / dp : (c.top + c.height - rect.top) / dp;
        if (s <= 0 || s >= (vertical ? info.width : info.height)) continue;   // 折痕不在这个窗口里（分屏）
        segs.push(vertical ? new Segment(Math.round(cursor), 0, Math.round(s - cursor), info.height)
                           : new Segment(0, Math.round(cursor), info.width, Math.round(s - cursor)));
        cursor = e;
      }
      if (segs.length === 0) return info;
      segs.push(vertical ? new Segment(Math.round(cursor), 0, Math.round(info.width - cursor), info.height)
                         : new Segment(0, Math.round(cursor), info.width, Math.round(info.height - cursor)));
      info.segments = segs;
    } catch (e) { /* 非折叠机或接口不可用：只按宽高估 */ }
    return info;
  }

  static measure(win: window.Window): LayoutInfo {
    const s = LayoutState.screenInfo(win);
    const li = new LayoutInfo();
    li.result = layoutOf(s);
    li.width = s.width;
    li.height = s.height;
    li.posture = s.posture;
    li.segments = s.segments !== null ? s.segments : [];
    return li;
  }

  /** 开始量：尺寸变化、折叠开合、主副屏切换都重算；有变化才通知（onChange 里发 set-layout） */
  static watch(win: window.Window, onChange: (info: LayoutInfo) => void): void {
    const apply = (): void => {
      const li = LayoutState.measure(win);
      let key = li.result.state + '|' + li.width + 'x' + li.height + '|' + li.posture;
      for (const p of li.result.panes) key += '|' + p.x + '+' + p.w;
      if (key === LayoutState.lastKey) return;
      LayoutState.lastKey = key;
      LayoutState.info = li;
      AppStorage.setOrCreate<LayoutInfo>('eo.layout', li);
      onChange(li);
    };
    apply();
    win.on('windowSizeChange', () => apply());
    try { display.on('foldStatusChange', () => apply()); } catch (e) { /* 非折叠机 */ }
    try { display.on('foldDisplayModeChange', () => apply()); } catch (e) { /* 非折叠机 */ }
  }

  /** 安全区：状态栏 / 挖孔在上，导航条在下；变了（转屏、开合）就更新 AppStorage('eo.safe') */
  static watchSafeArea(win: window.Window): void {
    const apply = (): void => {
      const dp = LayoutState.density();
      const s = new SafeArea();
      try {
        const sys = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
        const notch = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_CUTOUT);
        const nav = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR);
        s.top = Math.round(Math.max(sys.topRect.height, notch.topRect.height) / dp);
        s.bottom = Math.round(Math.max(nav.bottomRect.height, sys.bottomRect.height) / dp);
        s.left = Math.round(notch.leftRect.width / dp);
        s.right = Math.round(notch.rightRect.width / dp);
      } catch (e) { /* 拿不到就当 0 */ }
      AppStorage.setOrCreate<SafeArea>('eo.safe', s);
    };
    apply();
    win.on('avoidAreaChange', () => apply());
  }
}
