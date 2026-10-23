/** 把公用的东西导出给原生壳（D94）。仓库主人：「可以公用的组件要公用。」
 *
 *    npm run export:shared          # 消息表、令牌、桥接表、布局用例 → 鸿蒙 rawfile/shared、安卓 assets/shared；生成两端的常量源文件与应用名资源
 *    npm run sync:shells            # 上面那些 + 把 web/dist（世界层）拷进两端（先 npm run build）
 *    npm run check:shared           # 只比对不写：两端的生成文件和源头对不上就失败（npm run check 里跑；改了 shared/ 忘了导出会被拦下）
 *
 *  四端公用的只有一份源头：
 *    - 世界层：web/dist（地球、某一天的浮岛、行李箱、物件图标），原生用 WebView 装；
 *    - 领域核心：shared/core.ts，原生经桥接 core-call 调（不再各自移植算法）；
 *    - 消息表：shared/i18n（zh-Hans 源、en、ja），原生读导出的 JSON，占位与英文单复数规则照 format() 移植一个小函数；
 *    - 桥接表：shared/spec/bridge.ts + channels.ts（哪些消息是状态、按什么顺序重放）；
 *    - 屏幕形态：shared/spec/layout.ts 的阈值与 layout.golden.json 的用例（三端移植都要跑过）；
 *    - 设计令牌：shared/world/tokens.ts（墨 / 晨 / 雾、玻璃、圆角、两档字号）。
 *  生成的文件头上都写着「自动生成，勿改」；改源头再跑一遍。iOS 的 String Catalog 不从这里生成（键是中文原文，check_strings.py 管）。 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGS, LOCALES, format } from "../shared/i18n/index.ts";
import { COLOR, COLOR_NIGHT, SURFACE, SURFACE_NIGHT, SPACE_BG, SPACE, RADIUS, GLASS, GLASS_NIGHT, TYPE, DREAM } from "../shared/world/tokens.ts";
import { SKIN_COLORS, HAIR_COLORS, DRESS_COLORS, HAT_COLORS, SHOE_COLORS } from "../shared/world/hero.ts";
import { CHANNELS, REPLAY_ORDER, CHANNEL_OF } from "../shared/spec/channels.ts";
import { PHONE_MAX, SPREAD_MIN, SPREAD_RATIO, TRIPLE_MIN, TRIPLE_RATIO, FOLD_GAP } from "../shared/spec/layout.ts";
import { AVATAR_FORMS, SUITCASE_STYLES, SCHEMA_VERSION } from "../shared/spec/types.ts";
import { CORE_FNS } from "../shared/core.ts";
import { LEAD_DAYS } from "../shared/algo/todos.ts";
import { MAP_APPS } from "../shared/geo/maplinks.ts";
import { PRODUCTS } from "../shared/billing/plans.ts";
import { STARTER_SAMPLES } from "../shared/spec/samples.ts";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const HARMONY = join(APP, "harmony/entry/src/main");
const ANDROID = join(APP, "android/app/src/main");
const withWorld = process.argv.includes("--world");
const checkOnly = process.argv.includes("--check");
const stale: string[] = [];
const HEAD = "自动生成（tools/export-shared.ts），勿改；改源头（shared/）再跑 npm run export:shared";

const write = (path: string, text: string) => {
  const body = text.endsWith("\n") ? text : text + "\n";
  if (checkOnly) { if (!existsSync(path) || readFileSync(path, "utf8") !== body) stale.push(path.slice(APP.length + 1)); return; }
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, body); console.log("  " + path.slice(APP.length + 1));
};
const json = (v: unknown) => JSON.stringify(v, null, 2);

// ---------------------------------------------------------------- 1. 运行时读的 JSON（两端同一份）
const bridge = { note: HEAD, schemaVersion: SCHEMA_VERSION, channels: CHANNELS, replayOrder: REPLAY_ORDER, channelOf: CHANNEL_OF, coreFns: CORE_FNS, leadDays: LEAD_DAYS, mapApps: MAP_APPS, starterSamples: STARTER_SAMPLES, products: PRODUCTS };
const avatarColors = { skin: SKIN_COLORS, hair: HAIR_COLORS, dress: DRESS_COLORS, hat: HAT_COLORS, shoes: SHOE_COLORS };   // 捏人面板的色块（RGB 0–255，下标就是 Avatar 里存的数）
const tokens = { note: HEAD, color: COLOR, colorNight: COLOR_NIGHT, surface: SURFACE, surfaceNight: SURFACE_NIGHT, spaceBg: SPACE_BG, space: SPACE, radius: RADIUS, glass: GLASS, glassNight: GLASS_NIGHT, type: TYPE, dream: DREAM, avatarColors };
const layout = { note: HEAD, PHONE_MAX, SPREAD_MIN, SPREAD_RATIO, TRIPLE_MIN, TRIPLE_RATIO, FOLD_GAP };
const golden = readFileSync(join(APP, "shared/spec/layout.golden.json"), "utf8");
for (const dir of [join(HARMONY, "resources/rawfile/shared"), join(ANDROID, "assets/shared")]) {
  for (const l of LOCALES) write(join(dir, `i18n.${l}.json`), json(CATALOGS[l]));
  write(join(dir, "bridge.json"), json(bridge));
  write(join(dir, "tokens.json"), json(tokens));
  write(join(dir, "layout.json"), json(layout));
  write(join(dir, "layout.golden.json"), golden);
}

// ---------------------------------------------------------------- 2. 应用名与少量系统要的文字（启动器、权限说明）：默认英文，中文 / 日文各一份（与 resolveLocale 一致：认不出的语言用英文）
const SYS: Record<string, Record<"zh-Hans" | "en" | "ja", string>> = {
  app_name: { "zh-Hans": format(CATALOGS["zh-Hans"]["app.name"]), en: format(CATALOGS.en["app.name"]), ja: format(CATALOGS.ja["app.name"]) },
  module_desc: { "zh-Hans": "把旅程做成一本书、一个世界", en: "Turn a trip into a book and a little world", ja: "旅を一冊の本と小さな世界に" },
  ability_desc: { "zh-Hans": "地球与某一天的世界", en: "The globe and the world of a day", ja: "地球とある一日の世界" },
  reason_internet: { "zh-Hans": "连接规划服务（可选）与同步", en: "Connect to the planning service (optional) and sync", ja: "プランニングサービス（任意）と同期に接続します" },
  reason_microphone: { "zh-Hans": "说一句话做行程时听你说话", en: "Listen when you describe a trip by voice", ja: "声で旅程を作るときに使います" },
  reason_location: { "zh-Hans": "把家放在你所在的城市（只在你点「用现在的位置」时）", en: "Put home where you are (only when you tap “Use my location”)", ja: "「現在地を使う」を押したときだけ、家を今いる街に置きます" },
};
// 鸿蒙：resources/<qualifier>/element/string.json（base = 默认）
const harmonyRes: [string, "zh-Hans" | "en" | "ja"][] = [["base", "en"], ["en_US", "en"], ["zh_CN", "zh-Hans"], ["ja_JP", "ja"]];
for (const [dir, l] of harmonyRes) write(join(HARMONY, `resources/${dir}/element/string.json`), json({ string: Object.entries(SYS).map(([name, v]) => ({ name, value: v[l] })) }));
// 安卓：res/values-*/strings.xml
const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "\\'").replace(/"/g, '\\"');
const androidRes: [string, "zh-Hans" | "en" | "ja"][] = [["values", "en"], ["values-zh", "zh-Hans"], ["values-ja", "ja"]];
for (const [dir, l] of androidRes) write(join(ANDROID, `res/${dir}/strings.xml`), `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${HEAD} -->\n<resources>\n${Object.entries(SYS).map(([n, v]) => `    <string name="${n}">${xmlEsc(v[l])}</string>`).join("\n")}\n</resources>`);

// ---------------------------------------------------------------- 3. 两端的常量源文件（令牌、频道、布局阈值、形态）
const hex = (c: string) => c.startsWith("#") ? c : c;   // rgba(...) 原样（两端各自有解析）
const rgbHex = (c: readonly number[]) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
const ktColor = (c: string) => {
  if (c.startsWith("#")) return `Color(0xFF${c.slice(1).toUpperCase()})`;
  const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return "Color.Unspecified";
  const [r, g, b, a = "1"] = m[1].split(",").map((x) => x.trim()); return `Color(${r}, ${g}, ${b}, ${Math.round(parseFloat(a) * 255)})`;
};
const ets = `/** ${HEAD} */
export const SCHEMA_VERSION: string = '${SCHEMA_VERSION}';
export const AVATAR_FORMS: string[] = [${AVATAR_FORMS.map((f) => `'${f}'`).join(", ")}];
export const SUITCASE_STYLES: string[] = [${SUITCASE_STYLES.map((f) => `'${f}'`).join(", ")}];
/** 状态型消息的频道与重放顺序（shared/spec/channels.ts） */
export const REPLAY_ORDER: string[] = [${REPLAY_ORDER.map((c) => `'${c}'`).join(", ")}];
export const CHANNEL_OF: Record<string, string> = {
${Object.entries(CHANNEL_OF).filter(([, c]) => c).map(([k, c]) => `  '${k}': '${c}'`).join(",\n")}
};
/** 领域核心能调的函数（shared/core.ts） */
export const CORE_FNS: string[] = [${CORE_FNS.map((f) => `'${f}'`).join(", ")}];
/** 待办「提前几天」的选项（shared/algo/todos.ts）、导航的四家地图（shared/geo/maplinks.ts）、第一次启动装的示例（shared/spec/samples.ts） */
export const LEAD_DAYS: number[] = [${LEAD_DAYS.join(", ")}];
export const MAP_APPS: string[] = [${MAP_APPS.map((f) => `'${f}'`).join(", ")}];
export const STARTER_SAMPLES: string[] = [${STARTER_SAMPLES.map((f) => `'${f}'`).join(", ")}];
/** 屏幕形态的阈值（shared/spec/layout.ts） */
export const PHONE_MAX: number = ${PHONE_MAX};
export const SPREAD_RATIO: number = ${SPREAD_RATIO};
export const TRIPLE_MIN: number = ${TRIPLE_MIN};
export const TRIPLE_RATIO: number = ${TRIPLE_RATIO};
export const FOLD_GAP: number = ${FOLD_GAP};
/** 设计令牌（shared/world/tokens.ts）：白天 / 夜里两套，ArkUI 直接收 '#RRGGBB' 与 'rgba(...)' 字符串 */
export class Palette {
${Object.keys(COLOR).map((k) => `  ${k}: string = '';`).join("\n")}
${Object.keys(SURFACE).map((k) => `  ${k}: string = '';`).join("\n")}
  glassFill: string = ''; glassFillStrong: string = ''; glassRim: string = '';
}
function pal(c: Record<string, string>, s: Record<string, string>, g: Record<string, string>): Palette {
  const p = new Palette();
${Object.keys(COLOR).map((k) => `  p.${k} = c['${k}'];`).join("\n")}
${Object.keys(SURFACE).map((k) => `  p.${k} = s['${k}'];`).join("\n")}
  p.glassFill = g['fill']; p.glassFillStrong = g['fillStrong']; p.glassRim = g['rim'];
  return p;
}
export const DAY: Palette = pal(${JSON.stringify(COLOR)}, ${JSON.stringify(SURFACE)}, ${JSON.stringify({ fill: GLASS.fill, fillStrong: GLASS.fillStrong, rim: GLASS.rim })});
export const NIGHT: Palette = pal(${JSON.stringify(COLOR_NIGHT)}, ${JSON.stringify(SURFACE_NIGHT)}, ${JSON.stringify({ fill: GLASS_NIGHT.fill, fillStrong: GLASS_NIGHT.fillStrong, rim: GLASS_NIGHT.rim })});
export const SPACE_BG: Record<string, string> = ${JSON.stringify(SPACE_BG)};
/** 「新建旅程」梦幻胶囊的渐变（白天 / 夜里） */
export const DREAM_DAY: string[] = ${JSON.stringify(DREAM.day)};
export const DREAM_NIGHT: string[] = ${JSON.stringify(DREAM.night)};
/** 捏人面板的色块：'#RRGGBB'，下标就是 Avatar 里存的数 */
${Object.entries(avatarColors).map(([k, v]) => `export const ${k.toUpperCase()}_COLORS: string[] = ${JSON.stringify(v.map(rgbHex))};`).join("\n")}
/** 间距、圆角（vp） */
export const SPACE_S: number = ${SPACE.s}; export const SPACE_M: number = ${SPACE.m}; export const SPACE_L: number = ${SPACE.l}; export const SPACE_XL: number = ${SPACE.xl}; export const TOUCH: number = ${SPACE.touch};
export const RADIUS_S: number = ${RADIUS.s}; export const RADIUS_M: number = ${RADIUS.m}; export const RADIUS_L: number = ${RADIUS.l}; export const RADIUS_SHEET: number = ${RADIUS.sheet};
/** 字号只有两档（fp）：17 与 13；字重 600 / 400 */
export const FONT_BODY: number = ${TYPE.body[0]}; export const FONT_SUB: number = ${TYPE.sub[0]};
`;
write(join(HARMONY, "ets/gen/Shared.ets"), ets);

const kt = `// ${HEAD}
package app.earthonline.android.gen

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object Shared {
    const val SCHEMA_VERSION = "${SCHEMA_VERSION}"
    val AVATAR_FORMS = listOf(${AVATAR_FORMS.map((f) => `"${f}"`).join(", ")})
    val SUITCASE_STYLES = listOf(${SUITCASE_STYLES.map((f) => `"${f}"`).join(", ")})
    /** 状态型消息的频道与重放顺序（shared/spec/channels.ts） */
    val REPLAY_ORDER = listOf(${REPLAY_ORDER.map((c) => `"${c}"`).join(", ")})
    val CHANNEL_OF: Map<String, String> = mapOf(
${Object.entries(CHANNEL_OF).filter(([, c]) => c).map(([k, c]) => `        "${k}" to "${c}"`).join(",\n")}
    )
    /** 领域核心能调的函数（shared/core.ts） */
    val CORE_FNS = listOf(${CORE_FNS.map((f) => `"${f}"`).join(", ")})
    /** 待办「提前几天」的选项、导航的四家地图、第一次启动装的示例 */
    val LEAD_DAYS = listOf(${LEAD_DAYS.join(", ")})
    val MAP_APPS = listOf(${MAP_APPS.map((f) => `"${f}"`).join(", ")})
    val STARTER_SAMPLES = listOf(${STARTER_SAMPLES.map((f) => `"${f}"`).join(", ")})
    /** 屏幕形态的阈值（shared/spec/layout.ts） */
    const val PHONE_MAX = ${PHONE_MAX}f
    const val SPREAD_RATIO = ${SPREAD_RATIO}f
    const val TRIPLE_MIN = ${TRIPLE_MIN}f
    const val TRIPLE_RATIO = ${TRIPLE_RATIO}f
    const val FOLD_GAP = ${FOLD_GAP}f
}

/** 设计令牌（shared/world/tokens.ts）：白天 / 夜里两套 */
data class EoPalette(
${[...Object.keys(COLOR), ...Object.keys(SURFACE), "glassFill", "glassFillStrong", "glassRim"].map((k) => `    val ${k}: Color`).join(",\n")},
)

object Tokens {
    val Day = EoPalette(
${Object.entries(COLOR).map(([k, v]) => `        ${k} = ${ktColor(v)}`).join(",\n")},
${Object.entries(SURFACE).map(([k, v]) => `        ${k} = ${ktColor(v)}`).join(",\n")},
        glassFill = ${ktColor(GLASS.fill)}, glassFillStrong = ${ktColor(GLASS.fillStrong)}, glassRim = ${ktColor(GLASS.rim)},
    )
    val Night = EoPalette(
${Object.entries(COLOR_NIGHT).map(([k, v]) => `        ${k} = ${ktColor(v)}`).join(",\n")},
${Object.entries(SURFACE_NIGHT).map(([k, v]) => `        ${k} = ${ktColor(v)}`).join(",\n")},
        glassFill = ${ktColor(String(GLASS_NIGHT.fill))}, glassFillStrong = ${ktColor(String(GLASS_NIGHT.fillStrong))}, glassRim = ${ktColor(String(GLASS_NIGHT.rim))},
    )
    /** 「新建旅程」梦幻胶囊的渐变（白天 / 夜里） */
    val DreamDay = listOf(${DREAM.day.map(ktColor).join(", ")})
    val DreamNight = listOf(${DREAM.night.map(ktColor).join(", ")})
    /** 捏人面板的色块，下标就是 Avatar 里存的数 */
${Object.entries(avatarColors).map(([k, v]) => `    val ${k[0].toUpperCase() + k.slice(1)}Colors = listOf(${v.map((c) => ktColor(rgbHex(c))).join(", ")})`).join("\n")}
    val SpaceBg = mapOf(${Object.entries(SPACE_BG).map(([k, v]) => `"${k}" to ${ktColor(v)}`).join(", ")})
    val SpaceS = ${SPACE.s}.dp; val SpaceM = ${SPACE.m}.dp; val SpaceL = ${SPACE.l}.dp; val SpaceXl = ${SPACE.xl}.dp; val Touch = ${SPACE.touch}.dp
    val RadiusS = ${RADIUS.s}.dp; val RadiusM = ${RADIUS.m}.dp; val RadiusL = ${RADIUS.l}.dp; val RadiusSheet = ${RADIUS.sheet}.dp
    /** 字号只有两档：17 与 13；字重 600 / 400 */
    val FontBody = ${TYPE.body[0]}.sp; val FontSub = ${TYPE.sub[0]}.sp
}
`;
write(join(ANDROID, "java/app/earthonline/android/gen/Shared.kt"), kt);
void hex;

// ---------------------------------------------------------------- 4. 世界层（--world）：web/dist → 两端（不进版本库）
if (withWorld && !checkOnly) {
  const dist = join(APP, "web/dist");
  if (!existsSync(join(dist, "embed.html"))) { console.error("web/dist/embed.html 不存在：先 npm run build"); process.exit(1); }
  for (const dst of [join(HARMONY, "resources/rawfile/world"), join(ANDROID, "assets/world")]) {
    rmSync(dst, { recursive: true, force: true }); cpSync(dist, dst, { recursive: true }); console.log("  " + dst.slice(APP.length + 1) + "/ ← web/dist");
  }
}
if (checkOnly) {
  if (stale.length > 0) { console.error("两端的生成文件过期了（改了 shared/ 没导出）——跑 npm run export:shared：\n  " + stale.join("\n  ")); process.exit(1); }
  console.log("shared exports up to date");
} else console.log("done");
