/** 原生 ↔ 世界层的桥接消息（两端一致，只传 JSON）。
 *  网页参考应用里两侧在同一进程直接调用；鸿蒙 Web 组件 / iOS WKWebView 通过 postMessage 转发同样的消息。 */
import type { Avatar, CaseEdits, Day, LayoutState, Palette, PostLevel, SuitcaseStyle, Trip, ViewPitch } from "./types.ts";
import type { Segment, FoldPosture } from "./layout.ts";
import type { GeoFrame } from "../algo/geo.ts";
import type { PackedExtra } from "../planner/protocol.ts";
import type { Route } from "../algo/route.ts";

export type NativeToWorld =
  | { kind: "load-plate"; city: string; route: Route; seed: number; dayIndex: number; geo?: { frame: GeoFrame; day: Day } }
  | { kind: "goto-stop"; stopIndex: number }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "restart" }
  | { kind: "set-avatar"; avatar: Avatar }
  | { kind: "set-view"; pitch?: ViewPitch; azimuthStep?: number; follow?: boolean }
  | { kind: "set-post"; level: PostLevel }
  /** 布局态（D90）：原生算好的（shared/spec/layout.ts 的规则）；segments / posture 是原生量到的折痕段与姿态，嵌入页据此定 CSS 变量与世界的留白 */
  | { kind: "set-layout"; layout: LayoutState; width: number; height: number; segments?: Segment[]; posture?: FoldPosture }
  | { kind: "snapshot"; width: number; height: number };

export type WorldToNative =
  /** 页面（世界层）就绪：每次加载一次。原生收到它重放全部状态型消息 */
  | { kind: "ready" }
  /** 某一天的底板建好了（每次 load-plate / show-day 之后一次；不要拿它当 ready，否则重放 show-day 会无限重载） */
  | { kind: "plate-loaded" }
  | { kind: "hero-arrived"; stopIndex: number; entryId: string }
  | { kind: "day-finished" }
  | { kind: "building-tapped"; landmark: string }
  | { kind: "empty-tapped" }
  | { kind: "snapshot-done"; dataUrl: string }
  | { kind: "segment-started"; segmentIndex: number; mode: string; label: string };

export type WorldListener = (msg: WorldToNative) => void;

/** 原生壳（iOS / 鸿蒙）驱动嵌入页的首页地球与某一天用的消息（web/src/embed.ts 处理）。与 ios/README.md 一致。 */
export type ShellToEmbed =
  | { kind: "show-globe" }
  | { kind: "show-day"; trip: Trip; dayIndex: number }
  | { kind: "set-trips"; trips: Trip[]; today: string }
  | { kind: "focus-home"; lat: number; lng: number; animate: boolean }
  | { kind: "focus-book"; id: string; animate: boolean }
  | { kind: "focus-day"; id: string; dayIndex: number; animate: boolean }
  | { kind: "fly-to"; lat: number; lng: number; alt: number }
  | { kind: "set-home"; home: { name: string; lat: number; lng: number } | null }
  | { kind: "set-footprints"; flags: { id: string; name: string; lat: number; lng: number }[]; fresh: string[] }
  | { kind: "set-insets"; left: number; bottom: number; top: number; right: number }
  | { kind: "set-sky"; phase: "day" | "dusk" | "night" }
  | { kind: "set-palette"; palette: Palette }
  | { kind: "mark-visited"; entryId: string; visited: boolean }
  | { kind: "pick-point"; on: boolean }
  | { kind: "import-page"; requestId: string; html: string }
  | { kind: "show-suitcase"; trip: Trip; avatar?: Avatar; extras?: PackedExtra[]; style?: SuitcaseStyle; cards?: { id: string; dataUrl: string }[] }
  | { kind: "export-suitcase" }
  // 清单（D84）：原生打一句话 → 嵌入页用 shared/algo/case-search.ts 检索、分组、渲染类 emoji 的图标，回 case-results；点一格 → case-toggle，嵌入页算出新的增减回 case-edits
  | { kind: "case-search"; query: string }
  | { kind: "case-toggle"; type: "souvenir" | "extra" | "landmark"; id: string }
  // 公用的领域核心（D94，shared/core.ts）：原生按名字调一个纯函数（参数、结果都是 JSON），嵌入页回 core-result；locale 给了就按那种语言出文字
  | { kind: "core-call"; requestId: string; fn: string; args: unknown[]; locale?: string }
  // 长图（D96）：和网页同一份排版（web/src/export.ts）——封面、每天一张世界层的定角度渲染图 + 站点标牌、条目、日记；回 long-image（PNG 的 dataUrl），途中回 long-image-progress
  | { kind: "export-long-image"; requestId: string; trip: Trip }
  // 照片小卡（D99）：原生把一张（缩到长边 ≤ 1280 的）照片给嵌入页，用网页那套本机抠图（web/src/case-cards.ts）做成立牌或拍立得，回 card-made
  | { kind: "make-card"; requestId: string; dataUrl: string };

/** 清单里的一格（给原生的）：type + id 定一样东西，icon 是类 emoji 的小图（PNG 的 dataUrl，渲染好才有） */
export interface CaseEntryMsg { type: "souvenir" | "extra" | "landmark"; id: string; boxId: string; label: string; sub: string; inBox: boolean; mine?: boolean; icon?: string }
export interface CaseGroupMsg { id: string; label: string; entries: CaseEntryMsg[] }

export type EmbedToShell =
  | { kind: "book-tapped"; id: string }
  | { kind: "day-tapped"; id: string; dayIndex: number }
  | { kind: "point-picked"; lat: number; lng: number }
  | { kind: "flags-planted"; ids: string[] }
  | { kind: "import-result"; requestId: string; trips: Trip[]; warnings: string[]; error?: string }
  | { kind: "suitcase-image"; dataUrl: string }
  /** 箱子里现在有什么：id 是藏东西用的 id；type / key 给清单点一格用（card 的 key 是照片卡的 id）；icon 渲染好后会再发一次带图的 */
  | { kind: "suitcase-contents"; items: { id: string; type: "landmark" | "souvenir" | "extra" | "card"; key: string; label: string; icon?: string }[] }
  | { kind: "case-results"; query: string; groups: CaseGroupMsg[]; complete: boolean }
  | { kind: "case-edits"; suitcase: CaseEdits | null; result: "added" | "removed" | "frontFull" | "backFull" }
  | { kind: "core-result"; requestId: string; value?: unknown; error?: string }
  | { kind: "long-image-progress"; requestId: string; text: string }
  | { kind: "long-image"; requestId: string; dataUrl?: string; error?: string }
  /** 做好的卡：kind 是 cutout（抠出了主体，PNG 带透明）/ polaroid（背景太复杂，整张 JPEG）；原生把图存下、把 { id, kind, w, h } 记进书里 */
  | { kind: "card-made"; requestId: string; card?: { kind: "cutout" | "polaroid"; w: number; h: number }; dataUrl?: string; error?: string };

const SHELL_KINDS = new Set(["show-globe", "show-day", "set-trips", "focus-home", "focus-book", "focus-day", "fly-to", "set-home", "set-footprints", "set-insets", "set-sky", "set-palette", "mark-visited", "pick-point", "import-page", "show-suitcase", "export-suitcase", "case-search", "case-toggle", "core-call", "export-long-image", "make-card"]);
/** 这条消息是给嵌入页的（否则原样交给世界层） */
export const isShellMessage = (m: { kind: string }): m is ShellToEmbed => SHELL_KINDS.has(m.kind);
