/** 多语言（判断 D50）：简体中文（源）、English、日本語。界面文字都从消息表取，日期、时长、距离按语言格式化；
 *  行程内容（书名、地名、交通标签）是数据，不翻译。
 *
 *  用法：
 *    t("home.newTrip")                              → 「新建旅程」/ "New trip" / 「新規旅行」
 *    t("home.nextTrip", { title, n: 3 })            → {var} 换成值；{n:day|days} 按 n 是否为 1 选单复数（英文用）
 *    monthDay("2026-10-03") / dateRange(a, b) / duration(87) / km(12.3) / list([...]) / names([...])
 *
 *  加一条文字：键先加到 zh-Hans.ts，再在 en.ts、ja.ts 各补一条（少了类型检查报错，占位不一致 i18n.test.ts 报错）。
 *  当前语言由应用启动时 setLocale() 定下（网页：设置里的「语言」，默认跟随手机），换语言后重新载入页面。
 *  纯函数、不碰 DOM，Node 测试与原生壳的 Web 组件都能用。 */
import { ZH, type MsgKey } from "./zh-Hans.ts";
import { EN } from "./en.ts";
import { JA } from "./ja.ts";

export type { MsgKey };
export type Locale = "zh-Hans" | "en" | "ja";
export type LangSetting = "auto" | Locale;
export type Vars = Record<string, string | number>;
export const LOCALES: readonly Locale[] = ["zh-Hans", "en", "ja"];
export const CATALOGS: Record<Locale, Record<MsgKey, string>> = { "zh-Hans": ZH, en: EN, ja: JA };
export const isLocale = (x: unknown): x is Locale => typeof x === "string" && (LOCALES as readonly string[]).includes(x);

let current: Locale = "zh-Hans";
export function setLocale(l: Locale) { current = l; }
export function getLocale(): Locale { return current; }

/** 设置 + 手机的语言列表（navigator.languages）→ 界面语言。
 *  繁体（zh-TW / zh-HK / zh-Hant）暂时也用简体；列表里一个都不认识时用英文；列表为空（Node、测试）用简体中文。 */
export function resolveLocale(setting: LangSetting | undefined, langs: readonly string[]): Locale {
  if (setting && setting !== "auto" && isLocale(setting)) return setting;
  for (const raw of langs) {
    const l = raw.toLowerCase();
    if (l === "zh" || l.startsWith("zh-") || l.startsWith("zh_")) return "zh-Hans";
    if (l === "ja" || l.startsWith("ja-") || l.startsWith("ja_")) return "ja";
    if (l === "en" || l.startsWith("en-") || l.startsWith("en_")) return "en";
  }
  return langs.length ? "en" : "zh-Hans";
}

/** 占位替换：{var} → 值；{var:单数|复数} → var 为 1 时取单数，否则取复数。没给的占位原样留着（方便发现漏传） */
export function format(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)(?::([^{}|]*)\|([^{}]*))?\}/g, (m, k: string, one?: string, other?: string) => {
    if (!(k in vars)) return m;
    if (one !== undefined) return Number(vars[k]) === 1 ? one : other ?? "";
    return String(vars[k]);
  });
}
/** 模板里用到的占位名（去重、排序），测试用来比对各语言是否一致 */
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{(\w+)(?::[^{}|]*\|[^{}]*)?\}/g)].map((m) => m[1]))].sort();
}

export function t(key: MsgKey, vars?: Vars, locale: Locale = current): string {
  return format(CATALOGS[locale][key] ?? ZH[key], vars);
}

// ---------------- 并列与分隔（不用「A · B · C」）
type Part = string | number | null | undefined | false;
/** 并列的短语：中文「，」、英文「, 」、日文「、」 */
export const list = (parts: Part[], locale: Locale = current) => parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "").join(t("punct.list", undefined, locale));
/** 并列的名字：中文「、」、英文「, 」、日文「、」 */
export const names = (parts: Part[], locale: Locale = current) => parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "").join(t("punct.names", undefined, locale));
/** 行程数据里常有「A · B」（导入的标题、备注），显示时换成当前语言的逗号（数据不改） */
export const plain = (text: string, locale: Locale = current) => text.replace(/ · /g, t("punct.list", undefined, locale));
/** 目的地这类名字串「冰岛 · 挪威」→「冰岛、挪威」/ "冰岛, 挪威" */
export const plainNames = (text: string, locale: Locale = current) => text.replace(/ · /g, t("punct.names", undefined, locale));

// ---------------- 日期（输入都是 YYYY-MM-DD）
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (iso: string): [number, number, number] => [parseInt(iso.slice(0, 4), 10), parseInt(iso.slice(5, 7), 10), parseInt(iso.slice(8, 10), 10)];
const dotted = (iso: string) => iso.slice(0, 10).replace(/-/g, ".");

/** 10月3日 / Oct 3 / 10月3日 */
export function monthDay(iso: string, locale: Locale = current): string {
  const [, m, d] = ymd(iso);
  return locale === "en" ? `${MON[m - 1]} ${d}` : `${m}月${d}日`;
}
/** 同月：10月3日 – 12日 / Oct 3 – 12；跨月：9月28日 – 10月3日 / Sep 28 – Oct 3 */
export function dateRange(a: string, b: string, locale: Locale = current): string {
  const [ya, ma] = ymd(a), [yb, mb, db] = ymd(b); const sameMonth = ya === yb && ma === mb;
  if (locale === "en") return `${monthDay(a, locale)} – ${sameMonth ? db : monthDay(b, locale)}`;
  return `${monthDay(a, locale)} – ${sameMonth ? `${db}日` : monthDay(b, locale)}`;
}
/** 带年份：2026.10.03 / Oct 3, 2026 */
export function fullDate(iso: string, locale: Locale = current): string {
  if (locale === "en") { const [y] = ymd(iso); return `${monthDay(iso, locale)}, ${y}`; }
  return dotted(iso);
}
/** 带年份的区间：2026.10.03 – 10.12 / Oct 3 – 12, 2026；跨年两头都写年份 */
export function fullDateRange(a: string, b: string, locale: Locale = current): string {
  const [ya] = ymd(a), [yb] = ymd(b);
  if (locale === "en") return ya === yb ? `${dateRange(a, b, locale)}, ${ya}` : `${fullDate(a, locale)} – ${fullDate(b, locale)}`;
  return ya === yb ? `${dotted(a)} – ${dotted(b).slice(5)}` : `${dotted(a)} – ${dotted(b)}`;
}

// ---------------- 时长、距离、数量
/** 87 → 1 小时 27 分钟 / 1 h 27 min / 1時間27分；空值 → "" */
export function duration(minutes: number | null | undefined, locale: Locale = current): string {
  if (minutes == null) return "";
  const min = Math.round(minutes); const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return t("unit.hm", { h, m }, locale);
  if (h) return t("unit.h", { h }, locale);
  return t("unit.m", { m }, locale);
}
const TAG: Record<Locale, string> = { "zh-Hans": "zh-Hans", en: "en", ja: "ja" };
/** 数字按语言分组（1,234.5）；最多一位小数 */
export const num = (n: number, locale: Locale = current) => new Intl.NumberFormat(TAG[locale], { maximumFractionDigits: 1 }).format(n);
/** 12.34 → 12.3 公里 / 12.3 km；100 以上取整 */
export function km(n: number, locale: Locale = current): string {
  const v = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return t("unit.km", { n: num(v, locale) }, locale);
}
/** 5 天 / 5 days / 5日間 */
export const days = (n: number, locale: Locale = current) => t("count.day", { n }, locale);
/** 12 站 / 12 stops / 12か所 */
export const stops = (n: number, locale: Locale = current) => t("count.stop", { n }, locale);
/** 北纬 64.1°，西经 21.9° / 64.1° N, 21.9° W / 北緯 64.1°、西経 21.9° */
export function latLng(lat: number, lng: number, locale: Locale = current): string {
  const v = (x: number) => Math.abs(x).toFixed(1);
  return list([t(lat >= 0 ? "geo.n" : "geo.s", { v: v(lat) }, locale), t(lng >= 0 ? "geo.e" : "geo.w", { v: v(lng) }, locale)], locale);
}
