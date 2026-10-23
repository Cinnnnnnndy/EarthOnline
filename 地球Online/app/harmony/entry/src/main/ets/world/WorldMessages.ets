import { Avatar, CaseEdits, CaseGroup, CaseItem, HomePlace, Trip } from '../model/Spec';
import { Segment } from '../layout/LayoutState';

/** 原生 → 世界层 / 嵌入页的消息（shared/spec/bridge.ts 的 NativeToWorld + ShellToEmbed，只传 JSON）。
 *  ArkTS 不许无类型的对象字面量，所以每一种消息是一个类：字段名就是 JSON 的键（JSON.stringify 原样输出，undefined 的可选字段不输出）。
 *  哪些是状态（按频道留最新一条、重放）、哪些是一次性动作，看 gen/Shared.ets 的 CHANNEL_OF（shared/spec/channels.ts 导出）。 */
export class WorldMsg {
  kind: string;
  constructor(kind: string) { this.kind = kind; }
}

// ---------------------------------------------------------------- 世界层（NativeToWorld）

export class PlayMsg extends WorldMsg { constructor() { super('play'); } }
export class PauseMsg extends WorldMsg { constructor() { super('pause'); } }
export class RestartMsg extends WorldMsg { constructor() { super('restart'); } }

export class GotoStopMsg extends WorldMsg {
  stopIndex: number;
  constructor(stopIndex: number) { super('goto-stop'); this.stopIndex = stopIndex; }
}

export class SetAvatarMsg extends WorldMsg {
  avatar: Avatar;
  constructor(avatar: Avatar) { super('set-avatar'); this.avatar = avatar; }
}

/** pitch 30 | 90；follow：跟随小人 / 看全天 */
export class SetViewMsg extends WorldMsg {
  pitch?: number;
  follow?: boolean;
  constructor(pitch: number | undefined, follow: boolean | undefined) { super('set-view'); this.pitch = pitch; this.follow = follow; }
}

export class SetPostMsg extends WorldMsg {
  level: string;
  constructor(level: string) { super('set-post'); this.level = level; }
}

/** 布局态（D90）：原生按 shared/spec/layout.ts 的规则算好的；segments / posture 是量到的折痕段与姿态 */
export class SetLayoutMsg extends WorldMsg {
  layout: string;
  width: number;
  height: number;
  segments?: Segment[];
  posture?: string;
  constructor(layout: string, width: number, height: number, segments: Segment[], posture: string) {
    super('set-layout');
    this.layout = layout; this.width = width; this.height = height;
    this.segments = segments.length >= 2 ? segments : undefined;
    this.posture = posture !== 'unknown' ? posture : undefined;
  }
}

// ---------------------------------------------------------------- 嵌入页（ShellToEmbed）

export class ShowGlobeMsg extends WorldMsg { constructor() { super('show-globe'); } }

/** 某一天的浮岛：嵌入页自己用 dayScene(trip, dayIndex) 建路线再 load-plate */
export class ShowDayMsg extends WorldMsg {
  trip: Trip;
  dayIndex: number;
  constructor(trip: Trip, dayIndex: number) { super('show-day'); this.trip = trip; this.dayIndex = dayIndex; }
}

export class SetTripsMsg extends WorldMsg {
  trips: Trip[];
  today: string;
  constructor(trips: Trip[], today: string) { super('set-trips'); this.trips = trips; this.today = today; }
}

export class FocusHomeMsg extends WorldMsg {
  lat: number; lng: number; animate: boolean;
  constructor(lat: number, lng: number, animate: boolean) { super('focus-home'); this.lat = lat; this.lng = lng; this.animate = animate; }
}

export class FocusBookMsg extends WorldMsg {
  id: string; animate: boolean;
  constructor(id: string, animate: boolean) { super('focus-book'); this.id = id; this.animate = animate; }
}

export class FocusDayMsg extends WorldMsg {
  id: string; dayIndex: number; animate: boolean;
  constructor(id: string, dayIndex: number, animate: boolean) { super('focus-day'); this.id = id; this.dayIndex = dayIndex; this.animate = animate; }
}

export class FlyToMsg extends WorldMsg {
  lat: number; lng: number; alt: number;
  constructor(lat: number, lng: number, alt: number) { super('fly-to'); this.lat = lat; this.lng = lng; this.alt = alt; }
}

/** 没有家时显式写 null（嵌入页据此拿掉家的标记） */
export class SetHomeMsg extends WorldMsg {
  home: HomePlace | null;
  constructor(home: HomePlace | null) { super('set-home'); this.home = home; }
}

export class FlagMsg {
  id: string; name: string; lat: number; lng: number;
  constructor(id: string, name: string, lat: number, lng: number) { this.id = id; this.name = name; this.lat = lat; this.lng = lng; }
}
/** 足迹旗；fresh = 还没播过插旗动画的 */
export class SetFootprintsMsg extends WorldMsg {
  flags: FlagMsg[]; fresh: string[];
  constructor(flags: FlagMsg[], fresh: string[]) { super('set-footprints'); this.flags = flags; this.fresh = fresh; }
}

/** 被原生面板挡住的区域（vp = CSS px），地球 / 浮岛把视觉中心挪到露出来的那块 */
export class SetInsetsMsg extends WorldMsg {
  left: number; bottom: number; top: number; right: number;
  constructor(left: number, bottom: number, top: number, right: number) { super('set-insets'); this.left = left; this.bottom = bottom; this.top = top; this.right = right; }
}

/** day | dusk | night */
export class SetSkyMsg extends WorldMsg {
  phase: string;
  constructor(phase: string) { super('set-sky'); this.phase = phase; }
}

/** sea | warm | dusk */
export class SetPaletteMsg extends WorldMsg {
  palette: string;
  constructor(palette: string) { super('set-palette'); this.palette = palette; }
}

export class MarkVisitedMsg extends WorldMsg {
  entryId: string; visited: boolean;
  constructor(entryId: string, visited: boolean) { super('mark-visited'); this.entryId = entryId; this.visited = visited; }
}

export class PickPointMsg extends WorldMsg {
  on: boolean;
  constructor(on: boolean) { super('pick-point'); this.on = on; }
}

export class ImportPageMsg extends WorldMsg {
  requestId: string; html: string;
  constructor(requestId: string, html: string) { super('import-page'); this.requestId = requestId; this.html = html; }
}

/** 照片小卡的图：书里 suitcase.cards 记着的那几张（id → data URL） */
export class CardImage {
  id: string; dataUrl: string;
  constructor(id: string, dataUrl: string) { this.id = id; this.dataUrl = dataUrl; }
}

export class ShowSuitcaseMsg extends WorldMsg {
  trip: Trip; avatar: Avatar; style?: string; cards?: CardImage[];
  constructor(trip: Trip, avatar: Avatar, style: string | undefined, cards: CardImage[]) {
    super('show-suitcase'); this.trip = trip; this.avatar = avatar; this.style = style;
    if (cards.length > 0) this.cards = cards;
  }
}

/** 照片小卡（D99）：嵌入页用网页那套本机抠图做成立牌 / 拍立得，回 card-made */
export class MakeCardMsg extends WorldMsg {
  requestId: string; dataUrl: string;
  constructor(requestId: string, dataUrl: string) { super('make-card'); this.requestId = requestId; this.dataUrl = dataUrl; }
}

export class ExportSuitcaseMsg extends WorldMsg { constructor() { super('export-suitcase'); } }

/** 清单：一句话或一个词（空的给默认分组），回 case-results */
export class CaseSearchMsg extends WorldMsg {
  query: string;
  constructor(query: string) { super('case-search'); this.query = query; }
}

/** 清单：点一格（放进去 / 拿出来），回 case-edits；type 是 souvenir / extra / landmark */
export class CaseToggleMsg extends WorldMsg {
  type: string; id: string;
  constructor(type: string, id: string) { super('case-toggle'); this.type = type; this.id = id; }
}

/** 长图（D96）：嵌入页借世界层逐天渲染、按网页同一份排版拼好，回 long-image（data URL）；途中发 long-image-progress */
export class ExportLongImageMsg extends WorldMsg {
  requestId: string; trip: Trip;
  constructor(requestId: string, trip: Trip) { super('export-long-image'); this.requestId = requestId; this.trip = trip; }
}

/** 公用的领域核心（D94）：按名字调 shared/core.ts 里的纯函数，参数与结果都是 JSON；locale 给了就按那种语言出文字 */
export class CoreCallMsg extends WorldMsg {
  requestId: string; fn: string; args: Object[]; locale?: string;
  constructor(requestId: string, fn: string, args: Object[], locale: string | undefined) {
    super('core-call'); this.requestId = requestId; this.fn = fn; this.args = args; this.locale = locale;
  }
}

// ---------------------------------------------------------------- 世界层 / 嵌入页 → 原生（WorldToNative + EmbedToShell）

/** 收到的一条消息：所有种类的字段都声明成可选，按 kind 取用 */
/** card-made 里的卡：cutout（PNG 带透明）/ polaroid（整张 JPEG） */
export interface MadeCardInfo { kind: string; w: number; h: number }

export interface WorldEvent {
  kind: string;
  // ready（页面级，每次载入一次）/ plate-loaded（底板建好）/ day-finished / empty-tapped：没有别的字段
  stopIndex?: number;          // hero-arrived
  entryId?: string;            // hero-arrived
  landmark?: string;           // building-tapped
  dataUrl?: string;            // snapshot-done / suitcase-image / long-image
  segmentIndex?: number;       // segment-started
  mode?: string;
  label?: string;
  id?: string;                 // book-tapped / day-tapped
  dayIndex?: number;           // day-tapped
  lat?: number;                // point-picked
  lng?: number;
  ids?: string[];              // flags-planted
  requestId?: string;          // import-result / core-result / long-image(-progress)
  text?: string;               // long-image-progress
  trips?: Trip[];              // import-result
  warnings?: string[];
  error?: string;
  value?: Object;              // core-result
  suitcase?: CaseEdits | null; // case-edits（null = 没改过）
  result?: string;             // case-edits：added / removed / frontFull / backFull
  items?: CaseItem[];          // suitcase-contents
  query?: string;              // case-results
  groups?: CaseGroup[];        // case-results
  complete?: boolean;          // case-results（先回不带图标的一版，图标渲染好再回一次）
  card?: MadeCardInfo;         // card-made（图在 dataUrl）
}

/** 把一段 JSON 文本变成 JS 字符串字面量：JSON.stringify(字符串) 会把引号、反斜杠、换行都转义；
 *  U+2028 / U+2029 在旧的 JS 引擎里不能出现在字符串字面量里，再补一道 */
export function jsLiteral(json: string): string {
  return JSON.stringify(json).split('\u2028').join('\\u2028').split('\u2029').join('\\u2029');
}

/** 一批消息合成一段脚本：EarthWorld 还没出现就返回 "no"（原生据此认定没送达），每条单独 try，一条坏了不连累后面 */
export function sendScript(jsons: string[]): string {
  let body = '';
  for (const j of jsons) body += 'try{w.send(' + jsLiteral(j) + ');}catch(e){console.error(e);}';
  return '(function(){var w=window.EarthWorld;if(!w||!w.send){return "no";}' + body + 'return "ok";})()';
}
