/** shared/spec/types.ts 的 ArkTS 版（spec 0.3，JSON Schema 见 trip.schema.json）。改一处必须同时改 TS、Swift、Kotlin 与 Schema。
 *  ArkTS 没有可辨识联合：Entry 是一个接口，按 type（place | transport | lodging）决定哪些可选字段有意义。
 *  这些接口只描述 JSON 的形状（JSON.parse 的结果直接 as 成它们）；新建对象用带类型的对象字面量。
 *  共用核心（shared/core.ts，经桥接 core-call 调）的返回值形状也在这里。 */

export const SCHEMA = '0.3';

export interface Geo { lat: number; lng: number }

/** 一件待办：文字、该做完的日期（YYYY-MM-DD，没有就按出发日）、做完了没有 */
export interface Todo { id: string; text: string; due?: string; done?: boolean }

/** 一条行程：place（站点）| transport（交通）| lodging（住宿） */
export interface Entry {
  id: string;
  type: string;
  // place / lodging
  name?: string;
  // place
  category?: string;          // sight | food | shop | station | airport | port | hotel | other
  plannedStart?: string;      // "HH:MM"
  stayMinutes?: number;
  notes?: string;
  visited?: boolean;
  visitedAt?: string;
  geo?: Geo;
  kind?: string;              // 景点类型（shared/world/landmark-kinds.ts）
  todos?: Todo[];
  // transport
  mode?: string;              // walk | rail | subway | bus | ship | taxi | car | flight
  label?: string;
  durationMinutes?: number;
  distanceKm?: number;
  polyline?: number[][];      // [lat, lng][]
}

export interface Day {
  index: number;
  date: string;
  title: string;
  city: string;               // osaka / kyoto / nara / kobe / geo
  entries: Entry[];
  lodging?: string;
  diary?: string;
  color?: string;
}

export interface TripPlanRef { group: string; index: number; label: string }

export interface CaseCard { id: string; kind: string; w: number; h: number; label?: string }
export interface CaseEdits { hidden?: string[]; picks?: string[]; gear?: string[]; cards?: CaseCard[] }
/** 箱子里的一样（suitcase-contents）：key 是藏东西 / 删卡用的 id；icon 是嵌入页渲染好的 PNG dataUrl */
export interface CaseItem { id: string; type: string; key: string; label: string; icon?: string }
/** 清单里的一格（case-results）：type 是 souvenir / extra / landmark */
export interface CaseEntry { type: string; id: string; boxId?: string; label: string; sub?: string; inBox?: boolean; mine?: boolean; icon?: string }
export interface CaseGroup { id: string; label: string; entries: CaseEntry[] }

export interface Trip {
  schemaVersion: string;
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  theme: string;
  seed: number;
  status: string;             // planning | traveling | closed
  plan?: TripPlanRef;
  days: Day[];
  createdAt: string;
  updatedAt: string;
  suitcase?: CaseEdits;
}

export interface Avatar {
  skin: number;
  hair: string;               // bun | long | short
  hairColor: number;
  dress: number;
  hat: string;                // straw | cap | none
  hatColor: number;
  shoes: number;
  name: string;
  suitcase?: string;          // SUITCASE_STYLES
  form?: string;              // AVATAR_FORMS
}

/** 本机偏好（不进行程数据）：theme 是「地球外的天色 / 界面深浅」，lang 缺省 = auto（跟随手机） */
export interface Settings {
  palette: string;            // sea | warm | dusk
  post: string;               // high | medium | low
  theme: string;              // auto | light | dark
  lang?: string;              // auto | zh-Hans | en | ja
}

export interface HomePlace { name: string; lat: number; lng: number }
export interface ManualFlag { id: string; name: string; lat: number; lng: number; date?: string }

/** 落盘的全部状态（filesDir/state.json）。以后加字段一律可选，旧文件照样读得进来 */
export interface PersistedState {
  trips: Trip[];
  avatar: Avatar;
  settings: Settings;
  home?: HomePlace;
  pins: ManualFlag[];
  planted: string[];
}

/** 与 shared/world/hero.ts 的 DEFAULT_AVATAR 一致 */
export function defaultAvatar(): Avatar {
  const a: Avatar = { skin: 0, hair: 'short', hairColor: 0, dress: 0, hat: 'cap', hatColor: 0, shoes: 0, name: '' };
  return a;
}
export function defaultSettings(): Settings {
  const s: Settings = { palette: 'sea', post: 'high', theme: 'auto', lang: 'auto' };
  return s;
}

/** 主题（Trip.theme 存的是中文原名，界面按 theme.* 键显示） */
export const THEMES: string[] = ['红叶古都', '极光冰原', '海风港町', '温泉雪国', '都市霓虹', '樱花春日', '离岛夏日'];
export const THEME_KEYS: string[] = ['theme.autumnTown', 'theme.aurora', 'theme.harbor', 'theme.snowOnsen', 'theme.neon', 'theme.sakura', 'theme.island'];
/** 导航的四家地图、待办「提前几天」的选项：导出的（gen/Shared.ets） */
export { MAP_APPS, LEAD_DAYS } from '../gen/Shared';

// ---------------------------------------------------------------- 共用核心的返回值（shared/core.ts）

/** journey：旅行中 / 快出发 / 刚回来 / 平常日子（只回书的 id） */
export interface JourneyNext { tripId: string; inDays: number }
export interface JourneyResult { kind: string; tripId?: string; dayIndex?: number; inDays?: number; daysAgo?: number; next?: JourneyNext }

export interface TripStats { days: number; places: number; visited: number; walkMinutes: number; transitMinutes: number; cities: string[]; lodgings: string[] }

export interface TimelineItem { entryId: string; type: string; start: string; end: string; minutes: number }
export interface Timeline { items: TimelineItem[]; walkMinutes: number; transitMinutes: number; stayMinutes: number; firstStart: string; lastEnd: string }

export interface PlaceTodoNext { todo: Todo; due: string }
export interface PlaceTodos { open: number; next?: PlaceTodoNext }

export interface Footprint { id: string; name: string; lat: number; lng: number; date: string; source: string; trips: string[] }
export interface FootprintStats { places: number; countries: string[]; farthestKm: number; farthest?: string }
export interface FootprintsResult { flags: Footprint[]; stats: FootprintStats }

/** 地名表的一条（shared/geo/gazetteer.ts） */
export interface Place { name: string; aliases: string[]; lat: number; lng: number; kind: string }
/** 站点的类型（core 的 kindInfo，shared/world/place-kind.ts）：组图标名、类型名（当前语言）、是不是名胜 */
export interface KindInfo { kind: string; group: string; icon: string; label: string; groupLabel: string; tier: string; famous: boolean }

/** 离线规划（shared/planner/protocol.ts） */
export interface PlannerMessage { role: string; text: string }
export interface PlannerTripRef { title: string; startDate: string; endDate: string }
export interface PlannerContext { today: string; locale: string; home?: HomePlace; trips?: PlannerTripRef[] }
export interface PlanRequest { messages: PlannerMessage[]; context: PlannerContext }
export interface PlanResult { reply: string; question?: string; draft?: Trip; done: boolean; source?: string }

/** buildTrip 的输入（shared/planner/local.ts 的 DraftInput；key 不给就用 now） */
export interface Destination { name: string; place: Place }
export interface DraftInput { destination: Destination; startDate: string; days: number; theme: string; locale: string; today: string; now: string; key?: string }

/** 名额（core 的 quota）：Pro 不限名额时 limit / left 是 null、unlimited 为 true */
export interface Quota { used: number; limit: number | null; left: number | null; unlimited: boolean; canCreate: boolean }

export interface MapPoint { name: string; lat: number; lng: number }

/** 示例行程目录（rawfile/world/assets/samples/trips/index.json） */
export interface SampleInfo { id: string; file: string; title: string; type: string; blurb: string }

// ---------------------------------------------------------------- 小工具（只读数据，不是领域算法）

export function cloneTrip(t: Trip): Trip { return JSON.parse(JSON.stringify(t)) as Trip; }

export function placesOf(d: Day): Entry[] { return d.entries.filter((e: Entry) => e.type === 'place'); }

/** 今天是这本书的第几天（下标）；不在旅程里返回 -1 */
export function todayIndexOf(t: Trip, today: string): number {
  for (let i = 0; i < t.days.length; i++) { if (t.days[i].date === today) return i; }
  return -1;
}

/** 这本书此刻的阶段（只比较 YYYY-MM-DD 字符串） */
export function phaseOf(t: Trip, today: string): string {
  if (t.status === 'closed') return 'closed';
  if (t.startDate <= today && today <= t.endDate) return 'traveling';
  if (t.endDate < today) return 'ended';
  return 'upcoming';
}
