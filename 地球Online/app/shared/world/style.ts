/** 世界层视觉令牌：三套色调（默认清朗海天），与产品构想 v0.3 第 6 节、视觉文档 9.1 节一致 */
import * as THREE from "three";
import type { Palette } from "../spec/types.ts";
import { getLocale, type Locale } from "../i18n/index.ts";

export type RGB = [number, number, number];
export interface WorldStyle {
  name: string;
  skyTop: RGB; skyBottom: RGB; haze: RGB;
  sun: RGB; sunIntensity: number; skyLight: RGB; groundLight: RGB; hemiIntensity: number;
  base: RGB; road: RGB; bridge: RGB; rail: RGB; tie: RGB; subway: RGB;
  ground: Record<string, RGB>; water: RGB; deepWater: RGB;
  canopy: RGB[]; trunk: RGB; hill: RGB[]; bamboo: RGB; house: RGB; roof: RGB;
  accent: RGB; accent2: RGB; gold: RGB; pathRibbon: RGB;
  fogNear: number; fogFar: number;
  /** 夜里的那一套（nightOf 推出来的）：底板上写死的颜色也要过 toneOf 压暗、偏蓝；夜里站点图钉换暖色、撒萤火与灯 */
  night?: boolean;
}

const sea: WorldStyle = {
  name: "清朗海天",
  skyTop: [66, 140, 245], skyBottom: [224, 240, 255], haze: [204, 226, 250],
  sun: [255, 236, 210], sunIntensity: 3.2, skyLight: [190, 220, 255], groundLight: [160, 200, 150], hemiIntensity: 1.1,
  base: [238, 232, 220], road: [250, 250, 246], bridge: [214, 178, 132], rail: [86, 92, 104], tie: [214, 178, 132], subway: [120, 132, 170],
  ground: { U: [222, 216, 204], G: [178, 212, 112], F: [90, 168, 98], Z: [90, 168, 98], M: [96, 148, 116], P: [156, 206, 110], S: [246, 234, 190], Y: [136, 204, 104], W: [56, 172, 230], O: [28, 132, 210] },
  water: [56, 172, 230], deepWater: [28, 132, 210],
  canopy: [[52, 150, 74], [70, 170, 88], [96, 186, 96], [40, 132, 70]], trunk: [112, 74, 44], hill: [[78, 134, 112], [100, 156, 124], [130, 176, 140]], bamboo: [150, 200, 118],
  house: [238, 226, 206], roof: [178, 108, 84],
  accent: [30, 38, 64], accent2: [30, 38, 64], gold: [240, 180, 60], pathRibbon: [255, 226, 120],   // 第八轮：强调色去色，站点针与住处针都是墨
  fogNear: 26, fogFar: 96,
};
const warm: WorldStyle = { ...sea, name: "暖阳纸张",
  skyTop: [232, 190, 130], skyBottom: [250, 240, 220], haze: [246, 228, 200], sun: [255, 224, 180], skyLight: [255, 226, 190], groundLight: [200, 180, 140],
  base: [236, 224, 200], road: [248, 244, 232], ground: { ...sea.ground, U: [232, 222, 200], G: [184, 204, 132], P: [150, 196, 110], W: [96, 158, 206], O: [74, 132, 186] },
  water: [96, 158, 206], deepWater: [74, 132, 186], pathRibbon: [255, 214, 40] };
const dusk: WorldStyle = { ...sea, name: "暮色琥珀",
  skyTop: [106, 76, 147], skyBottom: [250, 196, 150], haze: [240, 200, 180], sun: [255, 190, 130], sunIntensity: 2.6, skyLight: [200, 160, 220], groundLight: [170, 120, 120],
  base: [233, 211, 216], road: [246, 236, 236], ground: { ...sea.ground, U: [226, 206, 200], G: [170, 190, 110], W: [90, 140, 200], O: [60, 100, 170] },
  water: [90, 140, 200], deepWater: [60, 100, 170], pathRibbon: [242, 177, 52] };

export const STYLES: Record<Palette, WorldStyle> = { sea, warm, dusk };
/** 色调的名字（中文是 WorldStyle.name）；界面用 styleName() 取当前语言的 */
export const STYLE_NAMES: Record<Exclude<Locale, "zh-Hans">, Record<Palette, string>> = {
  en: { sea: "Clear sea and sky", warm: "Warm paper", dusk: "Amber dusk" },
  ja: { sea: "澄んだ海と空", warm: "陽だまりの紙", dusk: "琥珀の夕暮れ" },
};
export const styleName = (p: Palette, locale: Locale = getLocale()): string => (locale === "zh-Hans" ? STYLES[p].name : STYLE_NAMES[locale][p]);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 压暗再往一种颜色偏：k 是亮度，t 是偏多少 */
const dim = (c: RGB, k: number, tint: RGB, t: number): RGB => [Math.round(lerp(c[0] * k, tint[0], t)), Math.round(lerp(c[1] * k, tint[1], t)), Math.round(lerp(c[2] * k, tint[2], t))];
const NIGHT_TINT: RGB = [28, 46, 92], LEAF_TINT: RGB = [38, 118, 118];
/** 夜里的颜色：一般的东西压到四成亮、偏深蓝；绿的（叶、草）偏青——参考仓库主人发来的 Blender 夜林，树叶是蓝青色的，天是深蓝的 */
export function nightTone(c: RGB): RGB {
  const [r, g, b] = c; const green = g > r * 1.15 && g > b * 1.1;
  return green ? dim(c, 0.58, LEAF_TINT, 0.45) : dim(c, 0.5, NIGHT_TINT, 0.3);
}
/** 底板上写死的颜色（不在 WorldStyle 里的）夜里也要过一遍 */
export const toneOf = (s: WorldStyle): ((c: RGB) => RGB) => (s.night ? nightTone : (c) => c);
/** 从白天的一套推出夜里的一套（D85）：深蓝的天、青蓝的叶、月光做主光、暖黄的路；不单独维护一套色 */
export function nightOf(s: WorldStyle): WorldStyle {
  const ground: Record<string, RGB> = {}; for (const k in s.ground) ground[k] = nightTone(s.ground[k]);
  return {
    ...s, night: true,
    skyTop: [10, 18, 48], skyBottom: [36, 62, 118], haze: [24, 40, 84],
    sun: [176, 200, 255], sunIntensity: 1.7, skyLight: [96, 132, 210], groundLight: [30, 44, 76], hemiIntensity: 1.0,
    base: dim(s.base, 0.36, NIGHT_TINT, 0.45), road: dim(s.road, 0.58, NIGHT_TINT, 0.35), bridge: nightTone(s.bridge), rail: nightTone(s.rail), tie: nightTone(s.tie), subway: nightTone(s.subway),
    ground, water: [22, 66, 122], deepWater: [12, 42, 92],
    canopy: s.canopy.map(nightTone), trunk: dim(s.trunk, 0.5, NIGHT_TINT, 0.2), hill: s.hill.map((c) => dim(c, 0.42, NIGHT_TINT, 0.45)), bamboo: nightTone(s.bamboo),
    house: dim(s.house, 0.42, NIGHT_TINT, 0.4), roof: dim(s.roof, 0.42, NIGHT_TINT, 0.3),
    pathRibbon: [255, 206, 110], fogNear: s.fogNear * 1.8, fogFar: s.fogFar * 1.9,   // 夜里的雾淡：看整天时整块地不能糊成一片深蓝
  };
}
/** 夜里站点图钉的颜色：暖黄的灯（白天是墨，D56） */
export const LANTERN: RGB = [255, 222, 150];

export const col = (c: RGB) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
/** 鲜艳（D89，仓库主人：「建模颜色还可以鲜艳一些」）：模型的颜色统一提一档饱和——只动有颜色的（灰、米、白、黑不动），亮度不动。
 *  所有积木（landmark-kit 的 mat()：名胜、物件、动物与自建 IP）、小人的衣帽鞋都过这里，一个旋钮管全部；底板（草、路、水）与界面不过。 */
export const VIVID = 1.28;
export function vivid(c: THREE.Color, k = VIVID): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  if (hsl.s > 0.06 && hsl.l > 0.04 && hsl.l < 0.97) c.setHSL(hsl.h, Math.min(1, hsl.s * k), hsl.l);
  return c;
}
/** col() 再提饱和 */
export const vcol = (c: RGB) => vivid(col(c));
export const hex = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const LZ = 0.55;          // 一层积木的高度（格）
