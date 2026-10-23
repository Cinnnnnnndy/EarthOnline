/** 从 Trip 派生世界设定：色板、季节、装饰密度、封面色相 —— 每本书不一样，但同一本书永远一样 */
import type { Trip, WorldSpec, Palette, Season } from "../spec/types.ts";
import { mulberry32 } from "./prng.ts";
import { t, getLocale, type Locale, type MsgKey } from "../i18n/index.ts";

const THEME_PALETTE: Record<string, Palette> = { "红叶古都": "sea", "极光冰原": "sea", "海风港町": "sea", "温泉雪国": "sea", "都市霓虹": "dusk", "樱花春日": "sea", "离岛夏日": "sea" };
const THEME_SEASON: Record<string, Season> = { "红叶古都": "autumn", "极光冰原": "autumn", "海风港町": "summer", "温泉雪国": "winter", "都市霓虹": "autumn", "樱花春日": "spring", "离岛夏日": "summer" };

/** 主题的显示名：书里存的是中文主题名（数据），界面按语言显示；不认识的（用户自己写的）原样显示 */
const THEME_KEY: Record<string, MsgKey> = { "红叶古都": "theme.autumnTown", "极光冰原": "theme.aurora", "海风港町": "theme.harbor", "温泉雪国": "theme.snowOnsen", "都市霓虹": "theme.neon", "樱花春日": "theme.sakura", "离岛夏日": "theme.island" };
export const themeName = (theme: string, locale: Locale = getLocale()): string => (THEME_KEY[theme] ? t(THEME_KEY[theme], undefined, locale) : theme);

export function deriveWorldSpec(trip: Pick<Trip, "seed" | "theme" | "startDate">): WorldSpec {
  const rng = mulberry32(trip.seed);
  const month = parseInt(trip.startDate.slice(5, 7), 10) || 6;
  const bySeasonMonth: Season = month <= 2 || month === 12 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
  return { seed: trip.seed, palette: THEME_PALETTE[trip.theme] ?? "sea", season: THEME_SEASON[trip.theme] ?? bySeasonMonth, theme: trip.theme, decorDensity: 0.55 + rng.next() * 0.35, coverHue: Math.floor(rng.next() * 360) };
}

/** 封面渐变：整套界面只用一个靛蓝色系（第五轮「不要用太多颜色」），主题只在色系内微调色相，seed 再抖一点 */
export function coverColors(spec: WorldSpec): { a: string; b: string; c: string; title: string; sub: string } {
  const shift: Record<string, number> = { "红叶古都": -10, "极光冰原": -18, "海风港町": -6, "温泉雪国": 4, "都市霓虹": 16, "樱花春日": 12, "离岛夏日": -14 };
  const h = 226 + (shift[spec.theme] ?? 0) + ((spec.coverHue % 9) - 4);
  return { a: `hsl(${h} 62% 66%)`, b: `hsl(${h} 50% 45%)`, c: `hsl(${h + 6} 46% 25%)`, title: "#ffffff", sub: "#ffe19a" };
}
