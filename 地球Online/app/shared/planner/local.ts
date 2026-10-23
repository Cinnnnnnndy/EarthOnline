/** 本机规则规划（离线、确定性）：听懂「下周五去京都玩三天」这类话，缺目的地或日期时只追问一句，
 *  齐了就给一本空白但有天标题的书（形状与 web/src/store.ts 的 createTrip 一致）。
 *
 *  无状态：每次都从整段对话里重新读（后说的覆盖先说的），所以「改成五天」「不去京都了，去奈良」都能改。
 *  能听懂的：
 *   - 目的地：shared/geo/gazetteer.ts 的地名表（名字与别名，中英文都认），景点落到最近的城市；「从上海出发」不算目的地，「不去京都」会撤掉京都
 *   - 天数：三天 / 5天 / 五天四晚 / 两晚 / 一周 / 两个星期 / 半个月 / 周末；3 days / a week / 4 nights / weekend；「多玩两天」「少一天」
 *   - 出发：今天 / 明天 / 三天后 / 周五 / 下周五 / 这个周末 / 下个月 / 下个月5号 / 10月3号 / 10月中 / 国庆 / 2026-10-03；
 *           tomorrow / next Friday / this weekend / next month / Oct 3 / 3rd of October / in 10 days
 *   - 主题（types.ts 的 THEMES）、同行的人、节奏；「随便 / 你定 / whatever」时日期用默认值
 *  其余（具体站点、交通）交给远端的 AI 规划（shared/planner/remote.ts）。 */
import { PLACES, nearestPlace, type Place } from "../geo/gazetteer.ts";
import { SCHEMA_VERSION, THEMES, type Day, type Entry, type Trip } from "../spec/types.ts";
import { hashString } from "../algo/prng.ts";
import { themeName } from "../algo/world-spec.ts";
import { t, format, monthDay, dateRange, type Locale } from "../i18n/index.ts";
import type { Planner, PlanRequest, PlanResult, PlannerContext, PlannerMessage } from "./protocol.ts";

// ---------------------------------------------------------------- 类型
export type Theme = (typeof THEMES)[number];
export type Companions = "solo" | "couple" | "family" | "kids" | "friends";
export type Pace = "relaxed" | "packed";
export interface Destination { name: string; place: Place }
/** 从对话里读出来的槽位 */
export interface PlanSlots {
  destination?: Destination;
  startDate?: string;
  days?: number;
  theme?: Theme;
  companions?: Companions;
  pace?: Pace;
  /** 用户说了「随便 / 你定」（只看最后一句） */
  vague?: boolean;
  /** 出发日期或天数是按默认值补的 */
  defaulted?: boolean;
  /** 天数超过 30，被截到 30 */
  clamped?: boolean;
}
/** 单句读出来的东西（天数增减、周末默认天数、撤掉的目的地要在合并时处理） */
interface Parsed {
  destination?: Destination;
  notDestinations: Place[];
  startDate?: string;
  days?: number;
  daysDelta?: number;
  weekendDays?: number;
  theme?: Theme;
  companions?: Companions;
  pace?: Pace;
  vague?: boolean;
  bareNumber?: number;
}

export const MAX_DAYS = 30;
const DEFAULT_DAYS = 3;

// ---------------------------------------------------------------- 日期工具（全用 UTC，避免时区把日期推一天）
export function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const weekday = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();            // 0 周日 … 6 周六
const mondayOf = (iso: string) => addDays(iso, -((weekday(iso) + 6) % 7));
const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function ymd(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}
/** 只有月、日：今年的这一天已经过了就算明年 */
function upcoming(today: string, m: number, d: number): string | undefined {
  const y = parseInt(today.slice(0, 4), 10);
  const a = ymd(y, m, d); if (!a) return ymd(y + 1, m, d);
  return a < today ? ymd(y + 1, m, d) : a;
}
/** 相对今天的第 n 个月的 d 号（n=0 本月） */
function monthPlus(today: string, n: number, d: number): string | undefined {
  let y = parseInt(today.slice(0, 4), 10), m = parseInt(today.slice(5, 7), 10) + n;
  while (m > 12) { m -= 12; y++; }
  return ymd(y, m, Math.min(d, daysInMonth(y, m)));
}
/** 周几（0 = 周一 … 6 = 周日）：week = 0 本周、1 下周、2 下下周；bare = 只说了「周五」，取今天之后最近的那一个 */
function weekdayDate(today: string, idx: number, week: number | "bare"): string {
  const mon = mondayOf(today);
  if (week === "bare") { const d = addDays(mon, idx); return d > today ? d : addDays(d, 7); }
  const d = addDays(mon, week * 7 + idx);
  return week === 0 && d < today ? addDays(d, 7) : d;
}
function weekendDate(today: string, week: number): string {
  if (week === 0 && weekday(today) === 6) return today;
  const d = addDays(mondayOf(today), week * 7 + 5);
  return d < today ? addDays(d, 7) : d;
}

// ---------------------------------------------------------------- 数字
const CN: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
export function cnNum(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s === "十") return 10;
  const m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0);
  if (s.length === 1 && s in CN) return CN[s];
  if (s.length === 2 && s[0] in CN && s[1] in CN && CN[s[1]] === CN[s[0]] + 1) return CN[s[1]];   // 「三四天」取大的
  return null;
}
const N = "(\\d{1,3}|[零〇一二两三四五六七八九十]{1,3})";
const EN_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30 };
const EN_N = `(\\d{1,3}|${Object.keys(EN_NUM).join("|")})`;
const enNum = (s: string): number | null => (/^\d+$/.test(s) ? parseInt(s, 10) : EN_NUM[s] ?? null);
const WEEK_ZH: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 };
const WEEK_EN: [RegExp, number][] = [[/^mon/, 0], [/^tue/, 1], [/^wed/, 2], [/^thu/, 3], [/^fri/, 4], [/^sat/, 5], [/^sun/, 6]];
const WEEK_EN_RE = "(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)";
const MONTH_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monthIdx = (s: string) => MONTH_EN.indexOf(s.slice(0, 3)) + 1;

// ---------------------------------------------------------------- 地名
/** 地名表里缺英文名的常见城市 / 国家 → 地名表里的中文名（显示用前面的英文） */
const EN_PLACES: Record<string, [string, string]> = {
  paris: ["巴黎", "Paris"], france: ["巴黎", "France"], london: ["伦敦", "London"], england: ["伦敦", "England"], rome: ["罗马", "Rome"], italy: ["罗马", "Italy"],
  florence: ["佛罗伦萨", "Florence"], venice: ["威尼斯", "Venice"], barcelona: ["巴塞罗那", "Barcelona"], spain: ["巴塞罗那", "Spain"], madrid: ["马德里", "Madrid"],
  lisbon: ["里斯本", "Lisbon"], portugal: ["里斯本", "Portugal"], amsterdam: ["阿姆斯特丹", "Amsterdam"], netherlands: ["阿姆斯特丹", "the Netherlands"],
  berlin: ["柏林", "Berlin"], germany: ["柏林", "Germany"], munich: ["慕尼黑", "Munich"], prague: ["布拉格", "Prague"], vienna: ["维也纳", "Vienna"], austria: ["维也纳", "Austria"],
  budapest: ["布达佩斯", "Budapest"], interlaken: ["因特拉肯", "Interlaken"], switzerland: ["因特拉肯", "Switzerland"], santorini: ["圣托里尼", "Santorini"], greece: ["圣托里尼", "Greece"],
  "new york": ["纽约", "New York"], "san francisco": ["旧金山", "San Francisco"], "los angeles": ["洛杉矶", "Los Angeles"], honolulu: ["檀香山", "Honolulu"], hawaii: ["檀香山", "Hawaii"],
  vancouver: ["温哥华", "Vancouver"], canada: ["温哥华", "Canada"], banff: ["班夫", "Banff"], "mexico city": ["墨西哥城", "Mexico City"], cusco: ["库斯科", "Cusco"], "machu picchu": ["库斯科", "Machu Picchu"], peru: ["库斯科", "Peru"],
  sydney: ["悉尼", "Sydney"], australia: ["悉尼", "Australia"], melbourne: ["墨尔本", "Melbourne"], queenstown: ["皇后镇", "Queenstown"], "new zealand": ["皇后镇", "New Zealand"],
  "cape town": ["开普敦", "Cape Town"], marrakech: ["马拉喀什", "Marrakech"], morocco: ["马拉喀什", "Morocco"], maldives: ["马尔代夫", "the Maldives"],
  seoul: ["首尔", "Seoul"], korea: ["首尔", "Korea"], taipei: ["台北", "Taipei"], "hong kong": ["香港", "Hong Kong"], shanghai: ["上海", "Shanghai"], beijing: ["北京", "Beijing"],
  chengdu: ["成都", "Chengdu"], "xi'an": ["西安", "Xi'an"], xian: ["西安", "Xi'an"], lhasa: ["拉萨", "Lhasa"], tibet: ["拉萨", "Tibet"], dali: ["大理", "Dali"], lijiang: ["丽江", "Lijiang"],
  xiamen: ["厦门", "Xiamen"], hangzhou: ["杭州", "Hangzhou"], singapore: ["新加坡", "Singapore"], bangkok: ["曼谷", "Bangkok"], thailand: ["曼谷", "Thailand"], "chiang mai": ["清迈", "Chiang Mai"],
  phuket: ["普吉岛", "Phuket"], bali: ["巴厘岛", "Bali"], hanoi: ["河内", "Hanoi"], vietnam: ["河内", "Vietnam"], "da nang": ["岘港", "Da Nang"], danang: ["岘港", "Da Nang"],
  dubai: ["迪拜", "Dubai"], istanbul: ["伊斯坦布尔", "Istanbul"], turkey: ["伊斯坦布尔", "Turkey"], cairo: ["开罗", "Cairo"], egypt: ["开罗", "Egypt"],
  sapporo: ["札幌", "Sapporo"], hokkaido: ["札幌", "Hokkaido"], okinawa: ["那霸", "Okinawa"], naha: ["那霸", "Naha"],
};
const BY_NAME = new Map(PLACES.map((p) => [p.name, p] as const));
/** 关西四城用手画底板（与 store.ts 的 PLATE_CITIES 一致） */
const PLATE_CITIES: Record<string, string> = { 大阪: "osaka", 京都: "kyoto", 奈良: "nara", 神户: "kobe" };

const isLatin = (s: string) => /^[\x20-\x7eÀ-ɏ]+$/.test(s);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
interface Needle { text: string; place: Place; latin: boolean; display?: string }
/** 所有可搜的名字：地名表的名字与别名（中文 ≥2 字、拉丁 ≥3 字母）+ 补的英文名 */
const NEEDLES: Needle[] = (() => {
  const out: Needle[] = [];
  for (const p of PLACES) for (const raw of [p.name, ...p.aliases]) {
    const text = raw.replace(/\s*[·・]\s*/g, "").trim(); const latin = isLatin(text);
    if (latin ? text.length < 3 : text.length < 2) continue;
    out.push({ text: latin ? text.toLowerCase() : text, place: p, latin, display: latin ? text : undefined });
  }
  for (const [k, [zh, en]] of Object.entries(EN_PLACES)) { const p = BY_NAME.get(zh); if (p) out.push({ text: k, place: p, latin: true, display: en }); }
  return out;
})();

interface Hit { n: Needle; start: number; end: number }
function findHits(s: string): Hit[] {
  const hits: Hit[] = [];
  for (const n of NEEDLES) {
    if (n.latin) {
      const re = new RegExp(`(?<![a-z])${escapeRe(n.text)}(?![a-z])`, "g"); let m: RegExpExecArray | null;
      while ((m = re.exec(s))) hits.push({ n, start: m.index, end: m.index + m[0].length });
    } else {
      let i = s.indexOf(n.text);
      while (i >= 0) { hits.push({ n, start: i, end: i + n.text.length }); i = s.indexOf(n.text, i + 1); }
    }
  }
  // 重叠的只留最长的（「京都站」盖过「京都」）
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const kept: Hit[] = [];
  for (const h of hits) if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
  return kept.sort((a, b) => a.start - b.start);
}
/** 景点落到最近的城市；显示名：中文说的国家 / 地区名（冰岛、北海道）照说的写，英文界面用英文名 */
function toDestination(h: Hit, locale: Locale): Destination {
  let place = h.n.place; let viaPoi = false;
  if (place.kind === "poi") { const c = nearestPlace(place.lat, place.lng, 80); if (c) { place = c; viaPoi = true; } }
  let name: string;
  if (locale === "en") name = !viaPoi && h.n.latin && h.n.display ? h.n.display : place.aliases.find((a) => isLatin(a) && /^[A-Z]/.test(a)) ?? place.name;
  else name = !viaPoi && !h.n.latin ? h.n.text : place.name;
  return { name, place };
}
function pickDestination(s: string, locale: Locale, home?: PlannerContext["home"]): { dest?: Destination; neg: Place[]; spans: [number, number][] } {
  const hits = findHits(s); const neg: Place[] = []; let best: { h: Hit; score: number } | null = null;
  for (const h of hits) {
    const before = s.slice(Math.max(0, h.start - (h.n.latin ? 16 : 4)), h.start), after = s.slice(h.end, h.end + 4);
    if (/(不|别|不想|不要|不再)去?$|\b(not|instead of|skip|no longer)\s+(go(ing)?\s+to\s+)?$/.test(before)) { neg.push(h.n.place); continue; }
    let score = h.start / 1000;                                           // 同分取后说的
    if (/(去|到|飞|玩|逛|游|看|往|赴)$|(to|visit|visiting|in|at|for|see)\s$/.test(before)) score += 20;
    if (/(从|自)$|from\s$/.test(before) || /^\s*(出发|起飞|走|动身)/.test(after)) score -= 30;
    if (home && nearKm(h.n.place, home) < 60) score -= 15;
    if (h.n.place.kind === "city") score += 1;
    if (!best || score > best.score) best = { h, score };
  }
  const dest = best && best.score > -10 ? toDestination(best.h, locale) : undefined;
  return { dest, neg, spans: hits.map((h) => [h.start, h.end]) };
}
function nearKm(p: { lat: number; lng: number }, q: { lat: number; lng: number }): number {
  const r = Math.PI / 180; const a = Math.sin(((q.lat - p.lat) * r) / 2) ** 2 + Math.cos(p.lat * r) * Math.cos(q.lat * r) * Math.sin(((q.lng - p.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ---------------------------------------------------------------- 主题、同行、节奏
const THEME_WORDS: [Theme, RegExp][] = [
  ["极光冰原", /极光|冰川|冰原|冰河|雪原|北极|aurora|northern lights|glacier|arctic/],
  ["温泉雪国", /温泉|泡汤|雪国|滑雪|雪景|看雪|hot ?springs?|onsen|ski(ing)?\b|snow/],
  ["樱花春日", /樱花|赏樱|赏花|花见|cherry blossoms?|sakura/],
  ["红叶古都", /红叶|枫叶|赏枫|古都|古城|古镇|寺庙|神社|古迹|老街|历史|autumn leaves|fall foliage|temples?|shrines?|old town|histor/],
  ["离岛夏日", /海岛|海滩|沙滩|潜水|浮潜|离岛|晒太阳|beach|island|diving|snorkel/],
  ["海风港町", /港口|海港|海边|海风|渔港|看海|海鲜|harbou?r|seaside|seafood|by the sea/],
  ["都市霓虹", /购物|逛街|买买买|夜景|夜生活|霓虹|美食|吃吃喝喝|shopping|nightlife|neon|city lights|food/],
];
const COMPANION_WORDS: [Companions, RegExp][] = [
  ["kids", /带娃|带孩子|带小孩|孩子|小孩|亲子|宝宝|儿子|女儿|with (my |the )?(kids?|children|son|daughter|baby)/],
  ["family", /爸妈|父母|家人|全家|一家人|老人|长辈|with (my )?(family|parents|mom|dad)/],
  ["couple", /女朋友|男朋友|老婆|老公|对象|爱人|情侣|蜜月|两个人|俩人|二人世界|with (my )?(girlfriend|boyfriend|wife|husband|partner)|honeymoon|couple/],
  ["friends", /朋友|闺蜜|兄弟|同学|同事|with (my )?(friends|buddies|mates|colleagues)/],
  ["solo", /一个人|独自|自己去|独行|solo|by myself|alone/],
];
const PACE_WORDS: [Pace, RegExp][] = [
  ["relaxed", /轻松|悠闲|慢一点|慢慢|休闲|不赶|别太累|不要太累|躺平|relax|slow|chill|easy ?going|laid[- ]back/],
  ["packed", /紧凑|特种兵|多去几个|赶一点|充实|packed|busy|as much as|intense|full schedule/],
];
const VAGUE = /随便|都行|都可以|你定|你来定|你安排|你看着|看着办|不确定|没想好|还没定|无所谓|whatever|you decide|you pick|up to you|not sure|no idea|don'?t know|dunno|anything works|any ?time/;

/** 没说主题时按目的地猜一个 */
function defaultTheme(place: Place, start?: string): Theme {
  const m = start ? parseInt(start.slice(5, 7), 10) : 0; const name = place.name;
  if (place.lat >= 63) return "极光冰原";
  if (/岛|马尔代夫|三亚|海口|那霸|檀香山|圣托里尼/.test(name)) return "离岛夏日";
  if ((m === 12 || m <= 2) && m && /札幌|哈尔滨|长春|沈阳|因特拉肯|班夫/.test(name)) return "温泉雪国";
  if ((m === 3 || m === 4) && /京都|大阪|奈良|神户|东京|名古屋|福冈|首尔|釜山|武汉/.test(name)) return "樱花春日";
  if (/京都|奈良|西安|洛阳|大理|丽江|苏州|杭州|绍兴|扬州|南京|拉萨|罗马|佛罗伦萨|布拉格|伊斯坦布尔|库斯科|开罗|马拉喀什|爱丁堡/.test(name)) return "红叶古都";
  if (/神户|卑尔根|哥本哈根|里斯本|青岛|大连|厦门|香港|悉尼|旧金山|温哥华|釜山|奥斯陆|威尼斯|开普敦|烟台|泉州|珠海/.test(name)) return "海风港町";
  return "都市霓虹";
}

// ---------------------------------------------------------------- 读一句话
export function parseText(raw: string, today: string, locale: Locale = "zh-Hans", home?: PlannerContext["home"]): Parsed {
  let s = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, " ").toLowerCase();
  const out: Parsed = { notDestinations: [] };
  /** 找到就吃掉（换成等长空格，后面的规则不会再读到它）；回调返回 false 表示不吃 */
  const eat = (re: RegExp, fn: (m: RegExpExecArray) => boolean | void) => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"); let m: RegExpExecArray | null;
    const spans: [number, number][] = [];
    while ((m = g.exec(s))) { if (fn(m) !== false) spans.push([m.index, m.index + m[0].length]); if (m[0].length === 0) g.lastIndex++; }
    for (const [a, b] of spans) s = s.slice(0, a) + " ".repeat(b - a) + s.slice(b);
  };
  const setStart = (d: string | undefined) => { if (d) out.startDate = d; return !!d; };

  // 1. 天数增减：「多玩两天」「少一天」「one more day」
  eat(new RegExp(`(?<![最至起])(?:再)?(多|加|延长|少|减|缩短)(?:玩|待|住|留)?${N}(?:天|日)`), (m) => { const n = cnNum(m[2]); if (n == null) return false; out.daysDelta = /多|加|延长/.test(m[1]) ? n : -n; });
  eat(new RegExp(`\\b${EN_N} (more|extra|fewer|less) days?\\b`), (m) => { const n = enNum(m[1]); if (n == null) return false; out.daysDelta = /more|extra/.test(m[2]) ? n : -n; });

  // 2. 相对今天：「三天后」「过两天」「in 10 days」「in a week」
  eat(new RegExp(`${N}(?:个)?(天|日|周|星期|礼拜)(?:之后|以后|后)`), (m) => { const n = cnNum(m[1]); if (n == null) return false; return setStart(addDays(today, /天|日/.test(m[2]) ? n : n * 7)); });
  eat(/过(两|几)天/, () => setStart(addDays(today, 2)));
  eat(new RegExp(`\\bin ${EN_N} (days?|weeks?)\\b`), (m) => { const n = enNum(m[1]); if (n == null) return false; return setStart(addDays(today, m[2].startsWith("day") ? n : n * 7)); });

  // 3. 具体日期
  eat(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*[日号]?/, (m) => setStart(ymd(+m[1], +m[2], +m[3])));
  eat(new RegExp(`(下下个?月|下个?月|这个?月|本月)(?:${N}(?:号|日))?(初|中|底|末|上旬|中旬|下旬)?`), (m) => {
    const k = m[1].startsWith("下下") ? 2 : m[1].startsWith("下") ? 1 : 0; const d = m[2] ? cnNum(m[2]) : m[3] ? partDay(m[3]) : 1;
    if (d == null) return false; const r = monthPlus(today, k, d); return setStart(r && r < today ? today : r);
  });
  eat(new RegExp(`(?<![个\\d])${N}月(?:份)?(?:${N}(?:号|日))?(初|中|底|末|上旬|中旬|下旬)?`), (m) => {
    const mo = cnNum(m[1]); const d = m[2] ? cnNum(m[2]) : m[3] ? partDay(m[3]) : 1; if (mo == null || d == null) return false;
    const thisMonth = parseInt(today.slice(5, 7), 10) === mo && !m[2] && !m[3];
    return setStart(thisMonth ? today : upcoming(today, mo, d));
  });
  eat(/国庆|十一(?:假期|长假|黄金周)/, () => setStart(upcoming(today, 10, 1)));
  eat(/五一(?![天日个])(?:假期|长假|劳动节)?/, () => setStart(upcoming(today, 5, 1)));
  eat(/元旦/, () => setStart(upcoming(today, 1, 1)));
  eat(/圣诞(?:节)?/, () => setStart(upcoming(today, 12, 24)));
  eat(new RegExp(`${N}号`), (m) => { const d = cnNum(m[1]); if (d == null || d < 1 || d > 31) return false; const r = monthPlus(today, 0, d); return setStart(r && r >= today ? r : monthPlus(today, 1, d)); });
  eat(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`), (m) => setStart(upcoming(today, monthIdx(m[1]), +m[2])));
  eat(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`), (m) => setStart(upcoming(today, monthIdx(m[2]), +m[1])));
  eat(new RegExp(`\\b(?:in|early|mid|late)\\s+${MONTH_RE}\\b`), (m) => { const mo = monthIdx(m[1]); const d = /mid/.test(m[0]) ? 15 : /late/.test(m[0]) ? 25 : 1; return setStart(parseInt(today.slice(5, 7), 10) === mo && d === 1 ? today : upcoming(today, mo, d)); });

  // 4. 星期、周末、下周
  eat(/(下下|下|这个|这|本)?(?:周|星期|礼拜)([一二三四五六日天])/, (m) => { const w = m[1] ? (m[1] === "下下" ? 2 : m[1] === "下" ? 1 : 0) : "bare"; setStart(weekdayDate(today, WEEK_ZH[m[2]], w)); });
  eat(/(下下|下|这个|这|本)?(个)?(长)?周末/, (m) => { const w = m[1] === "下下" ? 2 : m[1] === "下" ? 1 : 0; setStart(weekendDate(today, w)); out.weekendDays = m[3] ? 3 : 2; });
  eat(/(下下|下)(?:一)?(?:个)?(?:周|星期|礼拜)(?![一二三四五六日天末])/, (m) => { setStart(addDays(mondayOf(today), m[1] === "下下" ? 14 : 7)); });
  eat(new RegExp(`\\b(?:(next|this|coming|on)\\s+)?${WEEK_EN_RE}\\b`), (m) => {
    if (!m[1] && !m[2].endsWith("day")) return false;                   // 只有 "sat" 这类缩写又没有前缀：多半不是星期
    const idx = WEEK_EN.find(([re]) => re.test(m[2]))![1]; setStart(weekdayDate(today, idx, m[1] === "next" ? 1 : m[1] === "this" ? 0 : "bare"));
  });
  eat(/\b(next|this|coming)?\s*(long\s+)?weekend\b/, (m) => { setStart(weekendDate(today, m[1] === "next" ? 1 : 0)); out.weekendDays = m[2] ? 3 : 2; });
  eat(/\bnext week\b/, () => { setStart(addDays(mondayOf(today), 7)); });
  eat(/\bnext month\b/, () => { setStart(monthPlus(today, 1, 1)); });

  // 5. 今天、明天
  eat(/大后天|后天|明天|明儿|今天|今晚|\bday after tomorrow\b|\btomorrow\b|\btoday\b|\btonight\b/, (m) => {
    const k = m[0]; setStart(addDays(today, /大后天/.test(k) ? 3 : /后天|day after/.test(k) ? 2 : /明|tomorrow/.test(k) ? 1 : 0));
  });

  // 6. 天数
  const setDays = (n: number | null) => { if (n == null || n < 1) return false; out.days = n; return true; };
  eat(new RegExp(`${N}天${N}(?:夜|晚)`), (m) => setDays(cnNum(m[1])));
  eat(new RegExp(`(?<![月周期拜第每])${N}(?:个)?(?:整)?(?:天|日)(?!后|之后|以后)`), (m) => setDays(cnNum(m[1])));
  eat(new RegExp(`${N}(?:个)?(?:晚上|晚|夜)`), (m) => { const n = cnNum(m[1]); return n == null ? false : setDays(n + 1); });
  eat(new RegExp(`(?<![下这本上])${N}(?:个)?(?:周|星期|礼拜)(?![一二三四五六日天末])`), (m) => { const n = cnNum(m[1]); return n == null ? false : setDays(n * 7); });
  eat(/半个月/, () => setDays(15));
  eat(new RegExp(`${N}个月`), (m) => { const n = cnNum(m[1]); return n == null ? false : setDays(n * 30); });
  eat(new RegExp(`\\b${EN_N}[\\s-]+(days?|nights?)\\b`), (m) => { const n = enNum(m[1]); if (n == null) return false; return setDays(m[2].startsWith("night") ? n + 1 : n); });
  eat(new RegExp(`(?<!next |this )\\b${EN_N}[\\s-]+weeks?\\b`), (m) => setDays((enNum(m[1]) ?? 0) * 7));
  eat(/\bfortnight\b/, () => setDays(14));
  eat(/\b(?:a|one)\s+month\b/, () => setDays(30));

  // 7. 只说了一个数（回答「玩几天？」）
  const bare = s.trim().match(new RegExp(`^${N}$`)); if (bare) out.bareNumber = cnNum(bare[1]) ?? undefined;
  else { const b2 = s.trim().match(new RegExp(`^${EN_N}$`)); if (b2) out.bareNumber = enNum(b2[1]) ?? undefined; }

  // 8. 目的地（去掉地名后再读主题，免得「冰岛」的「岛」读成海岛）
  const d = pickDestination(s, locale, home); out.destination = d.dest; out.notDestinations = d.neg;
  for (const [a, b] of d.spans) s = s.slice(0, a) + " ".repeat(b - a) + s.slice(b);

  // 9. 主题、同行、节奏、随便
  out.theme = THEME_WORDS.find(([, re]) => re.test(s))?.[0];
  out.companions = COMPANION_WORDS.find(([, re]) => re.test(s))?.[0];
  out.pace = PACE_WORDS.find(([, re]) => re.test(s))?.[0];
  out.vague = VAGUE.test(s) || undefined;
  return out;
}
function partDay(p: string): number { return /中/.test(p) ? 15 : /底|末|下旬/.test(p) ? 25 : 1; }

// ---------------------------------------------------------------- 合并整段对话
type Ask = "dest" | "when" | "days" | "whenDays";
/** 上一句 assistant 问的是什么（按本文件的追问原文认） */
function lastAsk(messages: PlannerMessage[]): Ask | undefined {
  const last = [...messages].reverse().find((m) => m.role === "assistant"); if (!last) return undefined;
  for (const L of Object.values(MSG)) for (const k of ["whenDays", "when", "days", "dest"] as Ask[]) if (last.text.trim().endsWith(L.ask[k])) return k;
  return undefined;
}

export function readSlots(req: PlanRequest): PlanSlots {
  const { today, locale, home } = req.context; const slots: PlanSlots = {};
  const users = req.messages.map((m, i) => ({ m, i })).filter(({ m }) => m.role === "user");
  let weekendDays: number | undefined;
  users.forEach(({ m, i }, k) => {
    const p = parseText(m.text, today, locale, home);
    if (slots.destination && p.notDestinations.some((x) => x.name === slots.destination!.place.name || nearKm(x, slots.destination!.place) < 30)) slots.destination = undefined;
    if (p.destination) slots.destination = p.destination;
    if (p.startDate) slots.startDate = p.startDate;
    if (p.days) slots.days = p.days;
    if (p.daysDelta && slots.days) slots.days = Math.max(1, slots.days + p.daysDelta);
    if (p.weekendDays) weekendDays = p.weekendDays;
    if (p.theme) slots.theme = p.theme;
    if (p.companions) slots.companions = p.companions;
    if (p.pace) slots.pace = p.pace;
    // 光秃秃一个数：上一句问的是天数（或出发 + 天数）就当天数
    if (p.bareNumber && !p.days && !p.startDate) {
      const ask = lastAsk(req.messages.slice(0, i)); const n = p.bareNumber;
      if (ask === "days" || ask === "whenDays") slots.days = n;
      else if (ask === "when" && n <= 31) { const r = monthPlus(today, 0, n); slots.startDate = r && r >= today ? r : monthPlus(today, 1, n); }
    }
    if (k === users.length - 1) slots.vague = p.vague;
  });
  if (!slots.days && weekendDays) slots.days = weekendDays;
  if (slots.destination && slots.vague) {
    if (!slots.startDate) { slots.startDate = weekendDate(today, 1); slots.defaulted = true; }
    if (!slots.days) { slots.days = DEFAULT_DAYS; slots.defaulted = true; }
  }
  if (slots.days && slots.days > MAX_DAYS) { slots.days = MAX_DAYS; slots.clamped = true; }
  return slots;
}

// ---------------------------------------------------------------- 回复文字（界面语言；只在本文件用，放不进 i18n 消息表是因为 iOS / 服务端也要同一套追问原文来认上一句）
interface Msgs {
  ask: Record<Ask, string>;
  noDest: string; dest: string; destDays: string; destStart: string; destStartDays: string; start: string; daysOnly: string; startDays: string;
  drafted: string; theme: string; noted: string; defaults: string; overlap: string; clamped: string; next: string;
  companions: Record<Companions, string>; pace: Record<Pace, string>; week: string[];
}
export const MSG: Record<Locale, Msgs> = {
  "zh-Hans": {
    ask: { dest: "想去哪儿？说个城市或国家就行，比如京都、冰岛。", whenDays: "打算哪天出发，玩几天？", when: "哪天出发？", days: "玩几天？" },
    noDest: "没听出目的地。", dest: "去{dest}。", destDays: "去{dest}，玩{n}天。", destStart: "去{dest}，{date}出发。", destStartDays: "去{dest}，{date}出发，玩{n}天。",
    start: "{date}出发。", daysOnly: "玩{n}天。", startDays: "{date}出发，玩{n}天。",
    drafted: "排好了：{title}，{range}。", theme: "主题是{theme}。", noted: "记下了：{parts}。",
    defaults: "日期没定，先按{date}出发、玩{n}天排，想改随时说。", overlap: "这几天和「{title}」重叠了。", clamped: "一本书最多 30 天，先排了 30 天。",
    next: "没问题就点「生成这本书」。",
    companions: { solo: "一个人", couple: "两个人", family: "和家人", kids: "带孩子", friends: "和朋友" }, pace: { relaxed: "节奏轻松", packed: "节奏紧凑" },
    week: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
  },
  en: {
    ask: { dest: "Where to? A city or country is enough, like Kyoto or Iceland.", whenDays: "When do you leave, and for how many days?", when: "When do you leave?", days: "How many days?" },
    noDest: "I didn't catch a destination.", dest: "{dest}.", destDays: "{dest} for {n} {n:day|days}.", destStart: "{dest}, leaving {date}.", destStartDays: "{dest}, leaving {date}, for {n} {n:day|days}.",
    start: "Leaving {date}.", daysOnly: "{n} {n:day|days}.", startDays: "Leaving {date}, for {n} {n:day|days}.",
    drafted: "Planned: {title}, {range}.", theme: "Theme: {theme}.", noted: "Noted: {parts}.",
    defaults: "No dates yet, so I used {date} for {n} {n:day|days}. Tell me if you want different ones.", overlap: "This overlaps with “{title}”.", clamped: "A book holds up to 30 days, so I planned 30.",
    next: "If it looks right, tap “Make this book”.",
    companions: { solo: "solo", couple: "as a couple", family: "with family", kids: "with kids", friends: "with friends" }, pace: { relaxed: "relaxed pace", packed: "packed schedule" },
    week: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  ja: {
    ask: { dest: "どこへ行きたいですか？都市か国の名前だけで大丈夫です。例えば京都、アイスランド。", whenDays: "いつ出発して、何日間ですか？", when: "いつ出発しますか？", days: "何日間ですか？" },
    noDest: "行き先が聞き取れませんでした。", dest: "{dest}ですね。", destDays: "{dest}、{n}日間。", destStart: "{dest}、{date}出発。", destStartDays: "{dest}、{date}出発、{n}日間。",
    start: "{date}出発。", daysOnly: "{n}日間。", startDays: "{date}出発、{n}日間。",
    drafted: "できました：{title}、{range}。", theme: "テーマは{theme}。", noted: "メモしました：{parts}。",
    defaults: "日付が未定なので、{date}出発の{n}日間で組みました。変えたいときは言ってください。", overlap: "「{title}」と日程が重なっています。", clamped: "1冊は最大30日なので、30日で組みました。",
    next: "よければ「この本を作る」を押してください。",
    companions: { solo: "ひとり旅", couple: "ふたり旅", family: "家族と", kids: "子ども連れ", friends: "友だちと" }, pace: { relaxed: "ゆったり", packed: "詰め込み" },
    week: ["日", "月", "火", "水", "木", "金", "土"],
  },
};
const sep = (l: Locale) => (l === "en" ? ", " : l === "ja" ? "、" : "，");
function dateLabel(iso: string, l: Locale): string {
  const w = MSG[l].week[weekday(iso)];
  return l === "en" ? `${w}, ${monthDay(iso, l)}` : l === "ja" ? `${monthDay(iso, l)}（${w}）` : `${monthDay(iso, l)}（${w}）`;
}

// ---------------------------------------------------------------- 书（与 store.createTrip 同形）
export interface DraftInput { destination: Destination; startDate: string; days: number; theme: string; locale: Locale; today: string; now: string; key: string }
export function buildTrip(x: DraftInput): Trip {
  const { destination: dest, locale } = x; const n = Math.max(1, Math.min(MAX_DAYS, x.days));
  const title = t("new.defaultTitle", { place: dest.name, n }, locale).slice(0, 40);
  const seed = hashString(`${title}|${x.startDate}|${x.today}`);
  const city = PLATE_CITIES[dest.place.name] ?? "geo";
  const days: Day[] = Array.from({ length: n }, (_, i) => ({
    index: i + 1, date: addDays(x.startDate, i), city,
    title: i === 0 ? t("new.dayArrive", { dest: dest.name }, locale) : i === n - 1 ? t("new.dayReturn", { dest: dest.name }, locale) : t("new.dayN", { n: i + 1 }, locale),
    entries: city === "geo" ? [{ id: `d${i + 1}-e0`, type: "place", name: t("new.stayIn", { place: dest.name }, locale), category: "hotel", geo: { lat: dest.place.lat, lng: dest.place.lng } } as Entry] : [],
  }));
  return { schemaVersion: SCHEMA_VERSION, id: `trip-${seed.toString(36)}-${hashString(x.key).toString(36)}`, title, destination: dest.name, startDate: x.startDate, endDate: addDays(x.startDate, n - 1),
    theme: x.theme, seed, status: "planning", days, createdAt: x.now, updatedAt: x.now };
}

// ---------------------------------------------------------------- 规划器
export class LocalRulePlanner implements Planner {
  private now: () => string;
  constructor(opts: { now?: () => string } = {}) { this.now = opts.now ?? (() => new Date().toISOString()); }
  async plan(req: PlanRequest): Promise<PlanResult> { return this.planSync(req); }

  planSync(req: PlanRequest): PlanResult {
    const { today } = req.context; const locale: Locale = MSG[req.context.locale] ? req.context.locale : "zh-Hans"; const L = MSG[locale];
    const s = readSlots(req); const f = (tpl: string, v: Record<string, string | number> = {}) => format(tpl, v);
    const dest = s.destination?.name; const date = s.startDate ? dateLabel(s.startDate, locale) : "";
    const ask = (q: Ask, reply: string): PlanResult => ({ reply, question: L.ask[q], done: false, source: "local" });

    if (!s.destination) {
      const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.text.trim() ?? "";
      const reply = s.startDate && s.days ? f(L.startDays, { date, n: s.days }) : s.startDate ? f(L.start, { date }) : s.days ? f(L.daysOnly, { n: s.days }) : lastUser.length > 1 ? L.noDest : "";
      return ask("dest", reply);
    }
    if (!s.startDate && !s.days) return ask("whenDays", f(L.dest, { dest: dest! }));
    if (!s.startDate) return ask("when", f(L.destDays, { dest: dest!, n: s.days! }));
    if (!s.days) return ask("days", f(L.destStart, { dest: dest!, date }));

    const theme = s.theme ?? defaultTheme(s.destination.place, s.startDate);
    const trip = buildTrip({ destination: s.destination, startDate: s.startDate, days: s.days, theme, locale, today, now: this.now(), key: JSON.stringify(req.messages) });
    const parts = [s.companions ? L.companions[s.companions] : "", s.pace ? L.pace[s.pace] : ""].filter(Boolean);
    const clash = (req.context.trips ?? []).find((x) => !(x.endDate < trip.startDate || x.startDate > trip.endDate));
    const lines = [
      f(L.drafted, { title: trip.title, range: dateRange(trip.startDate, trip.endDate, locale) }),
      s.defaulted ? f(L.defaults, { date, n: s.days }) : "",
      s.clamped ? L.clamped : "",
      clash ? f(L.overlap, { title: clash.title }) : "",
      f(L.theme, { theme: themeName(theme, locale) }),
      parts.length ? f(L.noted, { parts: parts.join(sep(locale)) }) : "",
      L.next,
    ].filter(Boolean);
    return { reply: lines.join(locale === "en" ? " " : ""), draft: trip, done: true, source: "local" };
  }
}
