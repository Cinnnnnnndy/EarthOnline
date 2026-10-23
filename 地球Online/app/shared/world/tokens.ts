/** 地球Online 设计令牌（第五轮色卡）：界面、地球、世界层、小人都从这里取色，保证高亮色统一。
 *  规则只有三条：
 *   1. 强调色已去色（第八轮）：能点的、选中的、路线一律用墨（夜里用白），不再有蓝紫色；令牌名 lake 保留，值与墨相同；
 *   2. 高亮色只有一个「晨」：现在（今天、旅行中）与去过（足迹旗、打过卡）；
 *   3. 其余全是墨色的深浅与白（玻璃）。世界层（天空、海、陆地）自成一套柔和的自然色，不进界面。
 *  字体用系统字体（iOS 苹方 / 鸿蒙 HarmonyOS Sans），字阶参照 iOS Dynamic Type 的默认档，按中文正文习惯取 15 号。 */
import type { Locale } from "../i18n/index.ts";

export const COLOR = {
  ink: "#1D1E23",        // 墨：正文、图标、深色标签（D78：文字去紫——只有文字换成中性的墨，图画里的蓝紫不动）
  ink2: "#45464D",       // 墨 · 次：次要正文（第八轮校准：强玻璃上 ≥ 4.5）
  mist: "#5B5C65",       // 雾：说明文字（校准前 #6B7390 在玻璃上只有 2.7–4.1）
  mist2: "#A3A4AC",      // 雾 · 浅：占位、禁用
  line: "rgba(30,38,64,0.10)",
  paper: "#F7F8FB",      // 纸：不透明的底（列表、输入框）
  white: "#FFFFFF",
  lake: "#1D1E23",       // 强调（已去色：同墨；夜里是白）
  lakeSoft: "rgba(30,38,64,0.10)",
  lakeDeep: "#101115",
  dawn: "#F0B03A",       // 晨（高亮色）
  dawnInk: "#754A00",    // 晨 · 字：浅底上的晨色文字（校准：晨填充的标签上 ≥ 4.5）
  dawnSoft: "rgba(240,176,58,0.18)",
  danger: "#BE3A52",     // 只用于删除（校准：抽屉里的删除文字 ≥ 4.5）
} as const;

/** 夜间（地球外是夜、或手机深色外观）：同一套角色换成深底上的值。强调色是白，晨色不变 */
export const COLOR_NIGHT: Record<keyof typeof COLOR, string> = {
  ink: "#F1F1F4", ink2: "#CACBD1", mist: "#9C9DA5", mist2: "#686971", line: "rgba(255,255,255,0.12)",
  paper: "#141836", white: "#FFFFFF",
  lake: "#F1F1F4", lakeSoft: "rgba(255,255,255,0.14)", lakeDeep: "#FFFFFF",
  dawn: "#F5BE4E", dawnInk: "#F5C766", dawnSoft: "rgba(245,190,78,0.2)", danger: "#F07083",
};

/** 表面：玻璃里的分组列表、按下态、浅填充、抓手、输入框、模态底、地图标签 */
export const SURFACE = {
  list: "rgba(255,255,255,0.62)", listStrong: "rgba(255,255,255,0.75)", fill: "rgba(30,38,64,0.08)", press: "rgba(30,38,64,0.05)",
  grab: "rgba(30,38,64,0.25)", field: "#FFFFFF", sheet: "rgba(247,248,251,0.9)", label: "rgba(255,255,255,0.8)", segOn: "#FFFFFF",
} as const;
export const SURFACE_NIGHT: Record<keyof typeof SURFACE, string> = {
  list: "rgba(255,255,255,0.07)", listStrong: "rgba(255,255,255,0.09)", fill: "rgba(255,255,255,0.12)", press: "rgba(255,255,255,0.06)",
  grab: "rgba(255,255,255,0.3)", field: "rgba(255,255,255,0.08)", sheet: "rgba(22,26,56,0.9)", label: "rgba(22,26,56,0.72)", segOn: "rgba(255,255,255,0.2)",
};

/** 「新建旅程」梦幻胶囊的渐变（蜜 → 晨 → 琥珀，只有晨一个色相）：白天 / 夜里；网页画布、iOS 色、鸿蒙与安卓（导出）同一份 */
export const DREAM = { day: ["#F6D58C", "#F0B84A", "#E6A032"], night: ["#EBC25E", "#DFA53C", "#CF8E2C"] } as const;

/** 地球外的底色（画布画好之前、以及画布边缘露出来的颜色），按天色取 */
export const SPACE_BG = { day: "#9cb4f0", dusk: "#6a5a9e", night: "#141a4a" } as const;

/** 世界层（不进界面）：插画天空、地球、底板 */
export const WORLD = {
  skyTop: "#8DB2EC", skyMid: "#B9D0F3", skyLow: "#EFDCEC",
  sea: "#5A96D6", land: "#8FBF76", snow: "#F4F6FA",
} as const;

/** 小人的默认配色：外套取晨色的布料版，毛线奶油色，牛仔是湖色的深版，背包是墨色 */
export const HERO = {
  jacket: [229, 174, 79], knit: [242, 236, 224], denim: [74, 98, 160], boots: [110, 78, 60], pack: [58, 68, 102],
} as const;

/** 字阶（第八轮末，判断 D69）：只有两档字号——17 与 13，两种字重（600 / 400），三种颜色（墨 / 墨·次 / 雾）。
 *  调研的结论：系统给的字阶很长（iOS 11 个文字样式、Material 3 15 个角色），但一屏列表页实际只用两档——
 *  iOS 的邮件 / 设置是 17 正文 + 15 或 13 次要，内联导航标题也是 17 粗；Material 的列表项是 Body Large 16 + Body Medium 14。
 *  我们之前一屏里 22 / 17 / 15 / 12 四档并存，看起来大小不一，所以收成两档：标题也是 17 粗（像 iOS 的内联导航标题），次要与标签都是 13。
 *  角色名（title / headline / body / sub / caption）保留，CSS 变量不用改；title 与 headline、sub 与 caption 现在是同一档。
 *  不用字间距、不用全大写。字体：苹果设备用苹方；鸿蒙用系统的 HarmonyOS Sans；两者都没有的设备才下载随包的 HarmonyOS Sans SC（原版文件，未改动）。 */
export const TYPE = {
  family: `"PingFang SC", "HarmonyOS Sans SC", "HarmonyOS Sans", "App Sans", sans-serif`,
  title: [17, 22, 600],     // 标题：页面 / 抽屉的标题（17 粗）
  headline: [17, 22, 600],  // 正文强调：按钮、行里的数值
  body: [17, 22, 400],      // 正文：列表行、站点名
  sub: [13, 18, 400],       // 次要：行的第二行、日期、用时
  caption: [13, 18, 400],   // 同次要：标签、地图标签（名字留给旧样式）
  large: [17, 22, 600], micro: [13, 18, 400],   // 旧名，指向上面两档
} as const;
export const FONT_FILES = { 400: "fonts/HarmonyOS_Sans_SC_Regular.ttf", 600: "fonts/HarmonyOS_Sans_SC_Medium.ttf" } as const;
/** 按界面语言换字体栈（判断 D50）：中文苹方；日文冬青黑体（Hiragino Sans）等日文字体，避免汉字按中文字形显示；英文用系统字体（SF Pro）。
 *  三套最后都落到 HarmonyOS Sans 与随包的 App Sans，字阶（四个字号、两种字重）不变。这是「其他设备」（桌面、安卓）用的栈。 */
export const FONT_STACK: Record<Locale, string> = {
  "zh-Hans": TYPE.family,
  ja: `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "HarmonyOS Sans", "App Sans", sans-serif`,
  en: `-apple-system, "SF Pro Text", "HarmonyOS Sans", "App Sans", system-ui, sans-serif`,
};
/** 设备：苹果（iPhone / iPad / Mac）、鸿蒙（华为 / 荣耀）、其他 */
export type Platform = "apple" | "harmony" | "other";
export function detectPlatform(ua: string): Platform {
  if (/OpenHarmony|HarmonyOS|ArkWeb|HUAWEI|HONOR|HMSCore/i.test(ua)) return "harmony";
  if (/iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua)) return "apple";
  return "other";
}
/** 第七轮：在手机上和系统 App 用同一套字。
 *  苹果：-apple-system（拉丁字母、数字是 SF Pro，汉字是苹方），和系统 App 完全一样；
 *  鸿蒙：系统字体 HarmonyOS Sans；
 *  其他设备才用上面的 FONT_STACK（苹方 / HarmonyOS Sans / 随包 App Sans）。 */
const PLATFORM_STACK: Record<Exclude<Platform, "other">, Record<Locale, string>> = {
  apple: {
    "zh-Hans": `-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`,
    ja: `-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif`,
    en: `-apple-system, BlinkMacSystemFont, sans-serif`,
  },
  harmony: {
    "zh-Hans": `"HarmonyOS Sans SC", "HarmonyOS Sans", system-ui, sans-serif`,
    ja: `"HarmonyOS Sans", system-ui, sans-serif`,
    en: `"HarmonyOS Sans", system-ui, sans-serif`,
  },
};
export const fontFamily = (locale: Locale, platform: Platform = "other"): string =>
  platform === "other" ? FONT_STACK[locale] ?? TYPE.family : PLATFORM_STACK[platform][locale] ?? PLATFORM_STACK[platform]["zh-Hans"];

/** 间距（8 的倍数为主）、圆角、触控尺寸 */
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, touch: 44 } as const;
export const RADIUS = { s: 10, m: 14, l: 22, sheet: 26, pill: 999 } as const;

/** 液态玻璃（参照 iOS 26 Liquid Glass）：半透明 + 背景模糊提饱和 + 一道随光的亮边；不用渐变填充 */
export const GLASS = {
  fill: "rgba(255,255,255,0.46)", fillStrong: "rgba(255,255,255,0.68)", blur: 22, saturate: 1.8,
  rim: "rgba(255,255,255,0.75)", rimSoft: "rgba(255,255,255,0.18)", shadow: "0 10px 30px rgba(30,38,64,0.12)",
} as const;
export const GLASS_NIGHT: Record<keyof typeof GLASS, string | number> = {
  fill: "rgba(26,30,64,0.5)", fillStrong: "rgba(22,26,56,0.72)", blur: 22, saturate: 1.6,
  rim: "rgba(255,255,255,0.34)", rimSoft: "rgba(255,255,255,0.07)", shadow: "0 10px 30px rgba(0,0,0,0.28)",
};

/** 把令牌写成 CSS 变量（网页参考应用启动时调用；原生壳照这张表建各自的主题）。locale 与设备决定 --font */
export function cssVars(night = false, locale: Locale = "zh-Hans", platform: Platform = "other"): Record<string, string> {
  const v: Record<string, string> = {}; const C = night ? COLOR_NIGHT : COLOR; const G = night ? GLASS_NIGHT : GLASS;
  for (const [k, c] of Object.entries(C)) v[`--c-${k}`] = c;
  for (const [k, c] of Object.entries(night ? SURFACE_NIGHT : SURFACE)) v[`--c-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`] = c;
  for (const [k, c] of Object.entries(WORLD)) v[`--w-${k}`] = c;
  for (const [k, [s, l, w]] of Object.entries(TYPE).filter(([k]) => k !== "family") as [string, readonly [number, number, number]][]) { v[`--t-${k}-size`] = `${s}px`; v[`--t-${k}-lh`] = `${l}px`; v[`--t-${k}-w`] = String(w); }
  v["--font"] = fontFamily(locale, platform);
  for (const [k, n] of Object.entries(SPACE)) v[`--s-${k}`] = `${n}px`;
  for (const [k, n] of Object.entries(RADIUS)) v[`--r-${k}`] = `${n}px`;
  v["--g-fill"] = String(G.fill); v["--g-fill-strong"] = String(G.fillStrong); v["--g-blur"] = `${G.blur}px`; v["--g-sat"] = String(G.saturate); v["--g-rim"] = String(G.rim); v["--g-rim-soft"] = String(G.rimSoft); v["--g-shadow"] = String(G.shadow);
  // 旧变量名映射到新令牌，老页面自动跟着统一
  Object.assign(v, { "--accent": C.lake, "--accent-2": C.lake, "--accent-soft": C.lakeSoft, "--gold": C.dawn, "--gold-ink": C.dawnInk, "--gold-soft": C.dawnSoft, "--ok": C.lake,
    "--ink": C.ink, "--ink-2": C.mist, "--ink-3": C.mist2, "--card-ink": C.ink, "--card-ink-2": C.mist, "--line": C.line });
  return v;
}
export const hexToRgb = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
