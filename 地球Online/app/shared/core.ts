/** 公用的领域核心（D94）：原生壳（鸿蒙、安卓；iOS 也能用）不再各自移植算法，而是通过常驻的世界层 WebView 调这里。
 *  仓库主人：「除了苹果的版本，这次升华完之后统一继续做鸿蒙的版本。还有安卓的版本。可以公用的组件要公用。」
 *
 *  做法：原生发 `{ kind: "core-call", requestId, fn, args, locale? }`，嵌入页（web/src/embed.ts）在这张表里找到 fn、用 args 调用，
 *  回 `{ kind: "core-result", requestId, value }`（出错时带 error）。参数与返回值都是纯 JSON（不传类实例、不传函数）。
 *  这样旅程状态、统计、时间线、日记、待办、足迹、离线规划、地名搜索、配额、导航链接、数据迁移与校验在四端逐字一致，
 *  不用跑四份黄金用例；iOS 早先移植过的 Swift 版保留（离线、不依赖 WebView 的地方用），新壳一律走这里。
 *
 *  加一个函数：在 CORE 里加一项（只收发 JSON），core.test.ts 会用示例行程把每一项都调一遍。 */
import type { Trip, Day, PlaceEntry } from "./spec/types.ts";
import { journeyState } from "./algo/journey.ts";
import { tripStats } from "./algo/stats.ts";
import { buildTimeline } from "./algo/timeline.ts";
import { generateDiary } from "./algo/diary.ts";
import { allTodos, nextTodo, todoCounts, placeTodos, dueFromLead } from "./algo/todos.ts";
import { footprints, footprintStats, type ManualFlag, type HomePlace } from "./algo/footprints.ts";
import { searchPlaces, locate, nearestPlace } from "./geo/gazetteer.ts";
import { placeKind } from "./world/place-kind.ts";
import { LocalRulePlanner, buildTrip, type DraftInput } from "./planner/local.ts";
import type { PlanRequest } from "./planner/protocol.ts";
import { deriveWorldSpec, coverColors } from "./algo/world-spec.ts";
import { tripQuota, canCreateTrip, canUse, aiPlansLeft, entitlementFrom, type PlanLike, type Feature, type Usage } from "./billing/plans.ts";
import { mapLink, navMode, type MapApp, type NavMode } from "./geo/maplinks.ts";
import { migrateTrip } from "./spec/migrate.ts";
import { validateTrip } from "./spec/validate.ts";
import { layoutOf, worldInsets, type ScreenInfo } from "./spec/layout.ts";
import { resolvePhase, type Appearance } from "./world/daylight.ts";
import { setLocale, getLocale, isLocale, t, type Locale, type MsgKey, type Vars } from "./i18n/index.ts";
import type { TransportMode } from "./spec/types.ts";

const planner = new LocalRulePlanner();

/** 旅程状态：返回书的 id（不回整本书，原生自己有） */
function journey(trips: Trip[], today: string) {
  const j = journeyState(trips, today);
  switch (j.kind) {
    case "traveling": return { kind: j.kind, tripId: j.trip.id, dayIndex: j.dayIndex };
    case "departing": return { kind: j.kind, tripId: j.trip.id, inDays: j.inDays };
    case "back": return { kind: j.kind, tripId: j.trip.id, daysAgo: j.daysAgo };
    default: return { kind: "idle" as const, next: j.next ? { tripId: j.next.trip.id, inDays: j.next.inDays } : null };
  }
}

export const CORE = {
  /** 首页的旅程状态（旅行中 / 快出发 / 刚回来 / 平常日子） */
  journey: (trips: Trip[], today: string) => journey(trips, today),
  /** 一本书的统计（天、站、走路 / 交通分钟、城市……） */
  tripStats: (trip: Trip) => tripStats(trip),
  /** 某一天的时间线（每一条的开始 / 结束时间） */
  timeline: (day: Day) => buildTimeline(day),
  /** 某一天的日记（用户写过就以用户的为准，这里是生成的那一版） */
  diary: (trip: Trip, dayIndex: number) => generateDiary(trip, trip.days[dayIndex]),
  /** 待办：全部、最近一件、数量 */
  todos: (trip: Trip, today?: string) => ({ all: allTodos(trip), next: nextTodo(trip, today) ?? null, counts: todoCounts(trip) }),
  /** 一个站点的待办（站点行上的数量标签与最近一件） */
  placeTodos: (entry: PlaceEntry, fallbackDue: string, today?: string) => placeTodos(entry, fallbackDue, today),
  /** 「提前 n 天」→ 到期日 */
  dueFromLead: (dayDate: string, lead: number) => dueFromLead(dayDate, lead),
  /** 足迹（去过的地方）与统计 */
  footprints: (trips: Trip[], manual: ManualFlag[], today: string, home?: HomePlace | null) => {
    const fps = footprints(trips, manual, today, (name) => locate(name));
    return { flags: fps, stats: footprintStats(fps, home ?? null) };
  },
  /** 地名搜索（新建旅程、放家、补旗） */
  searchPlaces: (q: string, limit?: number) => searchPlaces(q, limit ?? 8),
  locate: (name: string) => locate(name),
  /** 坐标 → 最近的地名（放家、补旗时给个名字；maxKm 内没有就 null） */
  nearest: (lat: number, lng: number, maxKm?: number) => nearestPlace(lat, lng, maxKm ?? 80, ["city", "poi", "region"]),
  /** 一个站点的类型：组图标、类型名（当前语言）、是不是名胜（站点行与站点详情的标签） */
  kindInfo: (entry: Pick<PlaceEntry, "name" | "category" | "kind" | "geo">) => placeKind(entry),
  /** 离线规划（说一句话做行程）：与网页、服务端同一套规则 */
  plan: (req: PlanRequest) => planner.planSync(req),
  /** 由草稿生成一本书 */
  buildTrip: (input: Omit<DraftInput, "key"> & { key?: string }) => buildTrip({ ...input, key: input.key ?? input.now }),   // key 不给就用 now（同一刻建两本才需要区分）
  /** 世界设定与封面颜色 */
  worldSpec: (trip: Pick<Trip, "seed" | "theme" | "startDate">) => { const spec = deriveWorldSpec(trip); return { spec, cover: coverColors(spec) }; },
  /** 付费：名额、能不能新建、AI 次数、功能 */
  quota: (plan: PlanLike, trips: Trip[], today?: string) => { const q = tripQuota(plan, trips, today); const unlimited = !Number.isFinite(q.limit);   // Infinity 过 JSON 会变成 null，说清楚
    return { used: q.used, limit: unlimited ? null : q.limit, left: unlimited ? null : q.left, unlimited, canCreate: canCreateTrip(plan, trips, today) }; },
  canUse: (plan: PlanLike, feature: Feature, usage?: Usage) => canUse(plan, feature, usage ?? {}),
  aiPlansLeft: (plan: PlanLike, usedThisMonth: number) => aiPlansLeft(plan, usedThisMonth),
  entitlement: (activeProductIds: string[]) => entitlementFrom(activeProductIds),
  /** 导航链接（Apple / Google / 高德 / 百度） */
  mapLink: (app: MapApp, p: { name: string; lat: number; lng: number }, mode?: NavMode | TransportMode) =>
    mapLink(app, p, mode === "walk" || mode === "drive" || mode === "transit" ? mode : navMode(mode as TransportMode | undefined)),
  /** 导入：任意旧版本的行程 JSON → 当前版本；校验 */
  migrate: (raw: unknown) => migrateTrip(raw),
  validate: (trip: unknown) => validateTrip(trip),
  /** 天色（白天 / 晨昏 / 夜里）：设置的外观、系统深浅、此刻、家的位置（没有就按时区推经度）——和网页、iOS 同一套规则（daylight.ts） */
  skyPhase: (appearance: Appearance, systemDark: boolean, nowIso: string, place?: { lat: number; lng: number } | null) => resolvePhase({ appearance, systemDark, now: new Date(nowIso), place: place ?? null }),
  /** 屏幕形态（各壳也有移植；这里给调试与对照用） */
  layout: (info: ScreenInfo) => { const l = layoutOf(info); return { ...l, insets: worldInsets(l) }; },
  /** 一句界面文字（原生通常直接读导出的消息表 JSON；这里给少数要和网页逐字一致的地方用） */
  t: (key: MsgKey, vars?: Vars) => t(key, vars),
} as const;

export type CoreFn = keyof typeof CORE;
export const CORE_FNS = Object.keys(CORE) as CoreFn[];
export const isCoreFn = (x: unknown): x is CoreFn => typeof x === "string" && Object.prototype.hasOwnProperty.call(CORE, x);

/** 调一个核心函数：locale 给了就临时切到那种语言（日记、规划、文字按它出），调完切回来 */
export function callCore(fn: string, args: unknown[], locale?: string): unknown {
  if (!isCoreFn(fn)) throw new Error(`unknown core fn: ${fn}`);
  const prev = getLocale(); if (locale && isLocale(locale)) setLocale(locale as Locale);
  try { return (CORE[fn] as (...a: unknown[]) => unknown)(...(Array.isArray(args) ? args : [])); }
  finally { setLocale(prev); }
}
