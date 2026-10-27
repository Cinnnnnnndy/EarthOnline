/** 地球Online · 数据契约（与平台无关）。JSON Schema 见 trip.schema.json；改这里必须同步改 Schema 与 migrations.md */
import type { Locale } from "../i18n/index.ts";

export const SCHEMA_VERSION = "0.3" as const;

export type PlaceCategory = "sight" | "food" | "shop" | "station" | "airport" | "port" | "hotel" | "other";
export type TransportMode = "walk" | "rail" | "subway" | "bus" | "ship" | "taxi" | "car" | "flight";

export interface PlaceEntry {
  id: string;
  type: "place";
  name: string;
  category: PlaceCategory;
  /** 计划到达 "HH:MM" */
  plannedStart?: string;
  /** 计划停留分钟数 */
  stayMinutes?: number;
  notes?: string;
  /** 已打卡 */
  visited?: boolean;
  /** 打卡时间 ISO */
  visitedAt?: string;
  /** 真实坐标（有它就能生成 geo 底板） */
  geo?: { lat: number; lng: number };
  /** 景点类型（可选，见 shared/world/landmark-kinds.ts 的 KINDS；不写就按类别、地图标签、名字推断） */
  kind?: string;
  /** 待办（第八轮，可选）：规划时记下要提前做的事，比如「提前一个月买门票」；算法见 shared/algo/todos.ts */
  todos?: Todo[];
}
/** 一件待办：文字、该做完的日期（YYYY-MM-DD，没有就按出发日）、做完了没有 */
export interface Todo { id: string; text: string; due?: string; done?: boolean }
export interface TransportEntry {
  id: string;
  type: "transport";
  mode: TransportMode;
  /** 用户看到的名字，如 "JR 关空快速" */
  label: string;
  durationMinutes?: number;
  distanceKm?: number;
  /** 真实路线折线 [lat, lng][]（如 OSRM 结果），有它 geo 底板上的路就是真路形 */
  polyline?: [number, number][];
}
export interface LodgingEntry {
  id: string;
  type: "lodging";
  name: string;
  notes?: string;
}
export type Entry = PlaceEntry | TransportEntry | LodgingEntry;

export interface Day {
  index: number;
  date: string;
  title: string;
  /** 底板：rules/cities 里的城市 id（osaka / kyoto / nara / kobe），或 "geo"（按当天站点坐标与折线生成，见 mapgen/geo-plate.ts） */
  city: string;
  entries: Entry[];
  /** 当晚住处（简称，用于「住 xx」与跨城判断） */
  lodging?: string;
  /** 日记正文（用户改过就以用户的为准） */
  diary?: string;
  /** 这一天在地球与底板上的路线颜色（导入时沿用来源页面的配色） */
  color?: string;
}

export type TripStatus = "planning" | "traveling" | "closed";

export interface Trip {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  theme: string;
  /** 世界生成种子：封面、装饰布置、日记措辞都从它派生 */
  seed: number;
  status: TripStatus;
  /** 同一来源的多个方案（如「方案 1 / 方案 2」），地球上可切换对照 */
  plan?: { group: string; index: number; label: string };
  days: Day[];
  createdAt: string;
  updatedAt: string;
  /** 行李箱的增减（第八轮末，D82）：藏起来的、从库里挑的、自己放进去的照片卡 */
  suitcase?: CaseEdits;
}

/** 自己放进箱子的一张照片：抠出主体做成立牌（cutout），抠不出来就整张做成拍立得（polaroid）；图本身存在设备上（网页 IndexedDB / iOS 文件），这里只记尺寸 */
export interface CaseCard { id: string; kind: "cutout" | "polaroid"; w: number; h: number; label?: string }
/** 行李箱的增减：hidden 是藏起来的东西（名胜 lm:名字、特色物件 sv:id、AI 加的 ex:kind），picks 是从库里挑的特色物件 id，
 *  gear 是自己从清单里挑的随身物件（D84，ExtraKind；AI 加的不记在这里），cards 是照片卡 */
export interface CaseEdits { hidden?: string[]; picks?: string[]; gear?: string[]; cards?: CaseCard[] }

export interface Avatar {
  skin: number;
  hair: "bun" | "long" | "short";
  hairColor: number;
  dress: number;
  hat: "straw" | "cap" | "none";
  hatColor: number;
  shoes: number;
  name: string;
  /** 我的行李箱是哪一款（第八轮末，D81）：沙色硬壳 / 墨色硬壳 / 帆布箱 / 复古木箱；没写 = 沙色硬壳 */
  suitcase?: SuitcaseStyle;
  /** 形态（D86）：小人，或 Q 版的动物 / 自建 IP（shared/world/mascot.ts）；没写 = 小人 */
  form?: AvatarForm;
}
export const AVATAR_FORMS = ["human", "xiaowang", "xiaowu", "fugui", "fox", "cat", "shiba", "bear", "rabbit", "penguin", "panda", "duck", "seal", "otter", "capybara", "bean", "cloud", "pebble"] as const;   // D89b：海豹、海獭、水豚（仓库主人点名）；D101：小王、小伍、福贵（仓库主人一家，排在小人后面）
export type AvatarForm = (typeof AVATAR_FORMS)[number];
export const SUITCASE_STYLES = ["sand", "ink", "canvas", "trunk"] as const;
export type SuitcaseStyle = (typeof SUITCASE_STYLES)[number];

export type Palette = "sea" | "warm" | "dusk";
export type Season = "spring" | "summer" | "autumn" | "winter";

/** 由 Trip 派生的世界设定（不落库，随时可重算） */
export interface WorldSpec {
  seed: number;
  palette: Palette;
  season: Season;
  theme: string;
  /** 0–1，装饰密度 */
  decorDensity: number;
  coverHue: number;
}

/** 布局态（D90 加了三折叠的 triple；规则在 shared/spec/layout.ts）：phone 一页、outer 外屏一页、spread 两页、triple 三页、hover 半开悬停上下两半 */
export type LayoutState = "phone" | "outer" | "spread" | "hover" | "triple";
export type PostLevel = "high" | "medium" | "low";
export type ViewPitch = 30 | 90;

/** 应用设置（本机偏好，不进行程数据；原生壳各自存）。lang 缺省视为 "auto"：跟随手机语言（见 shared/i18n） */
export interface Settings {
  palette: Palette;
  post: PostLevel;
  theme: "auto" | "light" | "dark";
  lang?: "auto" | Locale;
}

export const THEMES = ["红叶古都", "极光冰原", "海风港町", "温泉雪国", "都市霓虹", "樱花春日", "离岛夏日"] as const;
export const CITY_IDS = ["osaka", "kyoto", "nara", "kobe"] as const;
export const GEO_PLATE = "geo" as const;
export type CityId = (typeof CITY_IDS)[number];
