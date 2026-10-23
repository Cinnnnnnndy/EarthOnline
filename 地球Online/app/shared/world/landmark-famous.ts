/** 第一级：名胜登记表。只收最出名、一眼就该认出来的那一批，每个有专门做的模型（接近真实外形，仍是潮玩的圆润比例）。
 *  认的方式：名字（多语言别名）或坐标（在半径 r 公里内）。住处、机场、港口、车站不参与（「哈尔格林姆教堂大本营」是住处）。
 *  model 为 null 的是「还没做」：先用它所属类型的通用模型，做好一个就填上模板名。各大洲的登记在 landmarks/famous-*.ts，模型在 landmarks/*.ts。 */
import { KIND } from "./landmark-kinds.ts";
import { FAMOUS_ASIA } from "./landmarks/famous-asia.ts";
import { FAMOUS_EUROPE } from "./landmarks/famous-europe.ts";
import { FAMOUS_AFRICA } from "./landmarks/famous-africa.ts";
import { FAMOUS_AMERICAS } from "./landmarks/famous-americas.ts";
import { FAMOUS_OCEANIA } from "./landmarks/famous-oceania.ts";

export type Region = "nordic" | "asia" | "europe" | "africa" | "americas" | "oceania";
export interface Famous { id: string; name: string; en?: string; ja?: string; re: RegExp; lat: number; lng: number; r: number; kind: string; model: string | null; region?: Region }

const FAMOUS_NORDIC: Famous[] = [
  // ---- 已做：冰岛
  { id: "hallgrimskirkja", name: "哈尔格林姆教堂", re: /哈尔格林姆教堂(?!大本营)|hallgrímskirkja|hallgrimskirkja/i, lat: 64.1417, lng: -21.9266, r: 0.3, kind: "church", model: "hallgrimskirkja" },
  { id: "thingvellir", name: "辛格韦德利", re: /辛格韦德利|þingvellir|thingvellir/i, lat: 64.2559, lng: -21.1295, r: 3, kind: "fjord", model: "rift" },
  { id: "geysir", name: "盖锡尔间歇泉", re: /盖锡尔|斯托克|geysir|strokkur/i, lat: 64.3104, lng: -20.3024, r: 1, kind: "geyser", model: "geyser" },
  { id: "kerid", name: "火口湖", re: /火口湖|kerið|kerid/i, lat: 64.041, lng: -20.885, r: 1, kind: "volcano", model: "crater" },
  { id: "blue-lagoon", name: "蓝湖", re: /蓝湖|blue lagoon|bláa lónið/i, lat: 63.8804, lng: -22.4495, r: 1.5, kind: "hotspring", model: "bluelagoon" },
  { id: "jokulsarlon", name: "冰河湖", re: /冰河湖|jökulsárlón|jokulsarlon/i, lat: 64.0785, lng: -16.2306, r: 2, kind: "lake", model: "lagoon" },
  { id: "diamond-beach", name: "钻石冰沙滩", re: /钻石冰?沙滩|diamond beach|breiðamerkursandur/i, lat: 64.0468, lng: -16.1826, r: 1.5, kind: "beach", model: "diamondbeach" },
  { id: "reynisfjara", name: "黑沙滩", re: /黑沙滩|reynisfjara/i, lat: 63.4064, lng: -19.045, r: 2, kind: "beach", model: "blackbeach" },
  // ---- 已做：挪威
  { id: "arctic-cathedral", name: "北极大教堂", re: /北极大教堂|ishavskatedralen|arctic cathedral/i, lat: 69.6479, lng: 19.0034, r: 0.4, kind: "church", model: "arcticCathedral" },
  { id: "polaria", name: "北极之门 Polaria", re: /polaria|北极之门/i, lat: 69.6367, lng: 18.9639, r: 0.3, kind: "zoo", model: "polaria" },
  { id: "tromso-mcd", name: "全世界最北麦当劳", re: /最北麦当劳/i, lat: 69.6494, lng: 18.9587, r: 0.1, kind: "food", model: "mcdonalds" },
  { id: "reine", name: "Reine 渔村", re: /reine|雷讷|hamnøy|哈姆诺伊/i, lat: 67.9331, lng: 13.0888, r: 3, kind: "oldtown", model: "fishingVillage" },
  { id: "bryggen", name: "Bryggen 彩色木屋", re: /bryggen|布吕根/i, lat: 60.3971, lng: 5.3235, r: 0.3, kind: "oldtown", model: "rowHouses" },
  { id: "oslo-opera", name: "奥斯陆歌剧院", re: /奥斯陆歌剧院|operahuset|oslo opera/i, lat: 59.9075, lng: 10.753, r: 0.3, kind: "theater", model: "opera" },
  { id: "vigeland", name: "Vigeland 雕塑公园", re: /vigeland|维格兰/i, lat: 59.9269, lng: 10.7008, r: 0.6, kind: "monument", model: "sculpture" },
  { id: "oslo-city-hall", name: "奥斯陆市政厅", re: /奥斯陆市政厅|oslo rådhus|市政厅 \+ 诺贝尔/i, lat: 59.9114, lng: 10.7332, r: 0.2, kind: "square", model: "cityhall" },
  // ---- 已做：丹麦
  { id: "nyhavn", name: "新港", re: /新港|nyhavn/i, lat: 55.6797, lng: 12.591, r: 0.3, kind: "oldtown", model: "rowHouses" },
  { id: "little-mermaid", name: "小美人鱼铜像", re: /小美人鱼|den lille havfrue|little mermaid/i, lat: 55.6929, lng: 12.599, r: 0.2, kind: "monument", model: "mermaid" },
  { id: "amalienborg", name: "阿美琳堡宫", re: /阿美琳堡|amalienborg/i, lat: 55.6845, lng: 12.5934, r: 0.2, kind: "castle", model: "palace" },
  { id: "rosenborg", name: "玫瑰堡", re: /玫瑰堡|rosenborg/i, lat: 55.6853, lng: 12.5766, r: 0.3, kind: "castle", model: "palace" },
];

/** 全部名胜：北欧（第一批）+ 各大洲（landmarks/famous-*.ts）。按名字认时按这个顺序取第一个 */
export const FAMOUS: Famous[] = [
  ...FAMOUS_NORDIC.map((f) => ({ ...f, region: "nordic" as const })),
  ...FAMOUS_ASIA, ...FAMOUS_EUROPE, ...FAMOUS_AFRICA, ...FAMOUS_AMERICAS, ...FAMOUS_OCEANIA,
];

const NOT_SIGHT = new Set(["hotel", "airport", "port", "station"]);
const km = (a: number, b: number, c: number, d: number) => { const R = Math.PI / 180, x = Math.sin(((c - a) * R) / 2) ** 2 + Math.cos(a * R) * Math.cos(c * R) * Math.sin(((d - b) * R) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };

/** 认名胜：先按名字，再按坐标（半径内最近的一个） */
export function famousFor(p: { name: string; category?: string; lat?: number; lng?: number }): Famous | null {
  if (p.category && NOT_SIGHT.has(p.category)) return null;
  const byName = FAMOUS.find((f) => f.re.test(p.name)); if (byName) return byName;
  if (p.lat == null || p.lng == null) return null;
  let best: Famous | null = null, bd = Infinity;
  for (const f of FAMOUS) { const d = km(p.lat, p.lng, f.lat, f.lng); if (d <= f.r && d < bd) { best = f; bd = d; } }
  return best;
}

export type Tier = "famous" | "kind" | "fallback";
/** 一个地点最终用哪一级、哪种类型：给世界层挑模型，也给界面挑图标和说明 */
export function tierOf(p: { name: string; category?: string; kind?: string; lat?: number; lng?: number }, classify: (p: { name: string; category?: string; kind?: string }) => string): { tier: Tier; kind: string; famous: Famous | null } {
  const f = famousFor(p);
  if (f) return { tier: f.model ? "famous" : "kind", kind: f.kind, famous: f };
  const kind = classify(p);
  return { tier: kind === "sight" || !KIND[kind] ? "fallback" : "kind", kind, famous: null };
}
