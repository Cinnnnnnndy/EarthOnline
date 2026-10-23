/** 景点分级：景点太多，不可能一个个建模。分三级：
 *   1. 名胜：最出名的一批，有专门做的、接近真实外形的模型（landmark-famous.ts 登记，按名字或坐标认出来）；
 *   2. 类型：其余的按类型给通用模型和图标（本文件：人文 / 自然 / 休闲 / 吃喝购物 / 交通 / 住宿 六组，约三十种）；
 *   3. 兜底：认不出类型的，按行程里的类别给一个路标式的小模型。
 *  类型的来源依次是：条目里写明的 kind → 类别（机场 / 港口 / 车站 / 住处）→ 地图数据的标签（OpenStreetMap 的 tourism / historic / natural…）→ 名字里的关键词（中、英、北欧、日文）→ 类别兜底。
 *  这里只有纯数据和纯函数（不依赖 three），原生壳可以照同一张表做。 */

import { getLocale, type Locale } from "../i18n/index.ts";

export type KindGroup = "culture" | "nature" | "leisure" | "life" | "transit" | "stay";
export const GROUP_NAME: Record<KindGroup, string> = { culture: "人文", nature: "自然", leisure: "休闲", life: "吃喝购物", transit: "交通", stay: "住宿" };
/** 分组名、类型名的英文与日文（中文就是 GROUP_NAME 与 KINDS 里的 name）。界面用 groupName() / kindName() 取当前语言的 */
export const GROUP_NAMES: Record<Exclude<Locale, "zh-Hans">, Record<KindGroup, string>> = {
  en: { culture: "Culture", nature: "Nature", leisure: "Leisure", life: "Food and shopping", transit: "Transport", stay: "Stay" },
  ja: { culture: "文化", nature: "自然", leisure: "レジャー", life: "グルメと買い物", transit: "交通", stay: "宿泊" },
};
export const KIND_NAMES: Record<Exclude<Locale, "zh-Hans">, Record<string, string>> = {
  en: {
    airport: "Airport", port: "Port", station: "Station", hotel: "Stay",
    mosque: "Mosque", temple: "Temple or shrine", church: "Church", castle: "Castle or palace", museum: "Museum", theater: "Theater", ruins: "Ruins",
    monument: "Monument", bridge: "Bridge", tower: "Tower", square: "Square", oldtown: "Old town",
    viewpoint: "Viewpoint", cablecar: "Cable car", themepark: "Theme park", zoo: "Zoo or aquarium",
    geyser: "Geyser", hotspring: "Hot spring", volcano: "Volcano", waterfall: "Waterfall", glacier: "Glacier", beach: "Beach or coast",
    fjord: "Fjord or canyon", cave: "Cave", lake: "Lake", trail: "Trail", forest: "Park or forest", mountain: "Mountain",
    market: "Market", food: "Café or restaurant", shop: "Shopping", sight: "Sight",
  },
  ja: {
    airport: "空港", port: "港", station: "駅", hotel: "宿",
    mosque: "モスク", temple: "寺社", church: "教会", castle: "城と宮殿", museum: "博物館", theater: "劇場", ruins: "遺跡",
    monument: "記念碑と彫刻", bridge: "橋", tower: "塔", square: "広場", oldtown: "旧市街",
    viewpoint: "展望台", cablecar: "ロープウェイ", themepark: "テーマパーク", zoo: "動物園と水族館",
    geyser: "間欠泉", hotspring: "温泉", volcano: "火山と地熱", waterfall: "滝", glacier: "氷河", beach: "海岸",
    fjord: "フィヨルドと峡谷", cave: "洞窟", lake: "湖", trail: "遊歩道", forest: "森と公園", mountain: "山",
    market: "市場", food: "カフェとレストラン", shop: "ショッピング", sight: "観光スポット",
  },
};
/** 类型名（认不出的 id 按「景点」） */
export function kindName(id: string, locale: Locale = getLocale()): string {
  const k = KIND[id] ?? KIND.sight;
  return locale === "zh-Hans" ? k.name : KIND_NAMES[locale][k.id] ?? k.name;
}
export function groupName(g: KindGroup, locale: Locale = getLocale()): string { return locale === "zh-Hans" ? GROUP_NAME[g] : GROUP_NAMES[locale][g]; }

export interface KindDef {
  id: string; group: KindGroup; name: string;
  /** 图标名（shared/world/icons.ts） */
  icon: string;
  /** 名字里的关键词 */
  re?: RegExp;
  /** OpenStreetMap 标签，形如 "tourism=museum"、"religion=buddhist"、"aerialway"（只写键表示任意值） */
  osm?: string[];
}

/** 顺序有意义：先具体后宽泛（「清水寺三重塔」先落到寺庙而不是塔，「蓝湖」先落到温泉而不是湖，「某某山观景台」先落到观景台而不是山） */
export const KINDS: KindDef[] = [
  // ---- 交通 / 住宿（多半由类别直接给出）
  { id: "airport", group: "transit", name: "机场", icon: "plane", re: /机场|空港|airport|flugvöllur|lufthavn/i, osm: ["aeroway=aerodrome"] },
  { id: "port", group: "transit", name: "港口", icon: "anchor", re: /港口|码头|渡口|ferry|harbou?r|havn(?!en\b)|port\b/i, osm: ["amenity=ferry_terminal"] },
  { id: "station", group: "transit", name: "车站", icon: "rail", re: /站$|车站|駅|station|stasjon|bahnhof/i, osm: ["railway=station", "public_transport=station"] },
  { id: "hotel", group: "stay", name: "住处", icon: "hotel", re: /酒店|宾馆|旅馆|民宿|住处|hotel|hostel|guesthouse|旅館/i, osm: ["tourism=hotel", "tourism=guest_house", "tourism=hostel"] },
  // ---- 人文
  { id: "mosque", group: "culture", name: "清真寺", icon: "mosque", re: /清真寺|mosque|cami|masjid/i, osm: ["religion=muslim"] },
  { id: "temple", group: "culture", name: "寺庙神社", icon: "temple", re: /寺|神社|神宫|神宮|大社|稻荷|稲荷|庙|廟|宫观|道观|祠|temple|shrine|jinja|pagoda/i, osm: ["religion=buddhist", "religion=shinto", "religion=taoist"] },
  { id: "church", group: "culture", name: "教堂", icon: "church", re: /教堂|礼拜堂|kirkja|kirke|kirche|church|cathedral|chapel|basilica|domkirke/i, osm: ["religion=christian"] },
  { id: "castle", group: "culture", name: "城堡宫殿", icon: "castle", re: /城堡|宫殿|王宫|皇宫|故宫|城址|天守|城$|castle|palace|slott?\b|schloss|château|burg\b|fortress|festning/i, osm: ["historic=castle", "historic=fort", "building=palace"] },
  { id: "museum", group: "culture", name: "博物馆", icon: "museum", re: /博物馆|美术馆|艺术馆|纪念馆|展览馆|科技馆|museum|gallery|safn|musée|museo/i, osm: ["tourism=museum", "tourism=gallery"] },
  { id: "theater", group: "culture", name: "剧院", icon: "theater", re: /剧院|歌剧院|音乐厅|剧场|opera|theat|concert hall|konserthus|harpa/i, osm: ["amenity=theatre", "amenity=concert_hall"] },
  { id: "ruins", group: "culture", name: "遗址", icon: "ruins", re: /遗址|遗迹|古迹|废墟|ruins?\b|archaeolog/i, osm: ["historic=ruins", "historic=archaeological_site"] },
  { id: "monument", group: "culture", name: "纪念碑雕塑", icon: "monument", re: /纪念碑|雕像|雕塑|铜像|塑像|monument|statue|memorial|sculpt|mermaid|美人鱼/i, osm: ["historic=monument", "historic=memorial", "tourism=artwork"] },
  { id: "bridge", group: "culture", name: "桥", icon: "bridge", re: /大桥|桥|橋|bridge|brú\b|bro\b|brücke/i, osm: ["bridge"] },
  { id: "tower", group: "culture", name: "塔", icon: "tower", re: /塔|tower|turm|tårn|tornet/i, osm: ["man_made=tower", "tower:type=observation"] },
  { id: "square", group: "culture", name: "广场市政", icon: "square", re: /广场|市政厅|市政|square|plaza|piazza|torg(?!et)|rådhus|city hall/i, osm: ["place=square", "amenity=townhall"] },
  { id: "oldtown", group: "culture", name: "老街小镇", icon: "oldtown", re: /老街|古镇|老城|旧城|街区|小镇|渔村|村$|新港|old town|altstadt|gamla|village|bryggen|nyhavn/i, osm: ["place=village", "place=hamlet"] },
  // ---- 休闲
  { id: "viewpoint", group: "leisure", name: "观景台", icon: "viewpoint", re: /观景台|展望台|瞭望|观景|viewpoint|lookout|utsikt|skywalk/i, osm: ["tourism=viewpoint"] },
  { id: "cablecar", group: "leisure", name: "缆车", icon: "cablecar", re: /缆车|索道|cable ?car|gondola|funicular|fløibanen|fjellheisen|ropeway/i, osm: ["aerialway"] },
  { id: "themepark", group: "leisure", name: "游乐园", icon: "themepark", re: /乐园|游乐园|环球影城|迪士尼|theme park|amusement|tivoli|universal|disney/i, osm: ["tourism=theme_park"] },
  { id: "zoo", group: "leisure", name: "动物园水族馆", icon: "zoo", re: /动物园|水族馆|海洋馆|zoo|aquarium|polaria/i, osm: ["tourism=zoo", "tourism=aquarium"] },
  // ---- 自然
  { id: "geyser", group: "nature", name: "间歇泉", icon: "hotspring", re: /间歇泉|geysir|geyser|strokkur/i, osm: ["natural=geyser"] },
  { id: "hotspring", group: "nature", name: "温泉", icon: "hotspring", re: /温泉|泡汤|蓝湖|onsen|hot spring|blue lagoon|laug|spa\b/i, osm: ["natural=hot_spring", "leisure=spa"] },
  { id: "volcano", group: "nature", name: "火山地热", icon: "volcano", re: /火山|火口|地热|crater|volcano|kerið|kerid|hveri/i, osm: ["natural=volcano"] },
  { id: "waterfall", group: "nature", name: "瀑布", icon: "waterfall", re: /瀑布|滝|foss\b|fossen|falls\b|waterfall/i, osm: ["waterway=waterfall"] },
  { id: "glacier", group: "nature", name: "冰川", icon: "glacier", re: /冰川|冰河|jökull|glacier|breen\b/i, osm: ["natural=glacier"] },
  { id: "beach", group: "nature", name: "海滩海岸", icon: "beach", re: /海滩|沙滩|海岸|海边|海滨|海角|beach|strand|sandur|fjara|coast/i, osm: ["natural=beach", "natural=coastline"] },
  { id: "fjord", group: "nature", name: "峡湾峡谷", icon: "fjord", re: /峡湾|峡谷|大峡|canyon|gorge|fjord|gljúfur|dalen\b/i, osm: ["natural=valley", "natural=gorge"] },
  { id: "cave", group: "nature", name: "洞穴", icon: "cave", re: /洞|窟|cave|grotto|hellir/i, osm: ["natural=cave_entrance"] },
  { id: "lake", group: "nature", name: "湖泊", icon: "lake", re: /湖|池|潭|lake|vatn\b|vatnet|sjø|see\b|lagoon|lón\b/i, osm: ["natural=water", "water=lake"] },
  { id: "trail", group: "nature", name: "徒步步道", icon: "walk", re: /徒步|步道|登山道|trail|hike|hiking|trek/i, osm: ["highway=path", "route=hiking"] },
  { id: "forest", group: "nature", name: "森林公园", icon: "forest", re: /森林|公园|花园|庭园|庭園|植物园|竹林|forest|park\b|garden|skog|lund\b|arboretum/i, osm: ["leisure=park", "landuse=forest", "leisure=garden", "boundary=national_park"] },
  { id: "mountain", group: "nature", name: "山", icon: "mountain", re: /山|峰|岳|岭|嶺|mountain|mount\b|mt\.|fjell|fjall|tind|peak|berg\b/i, osm: ["natural=peak", "natural=ridge"] },
  // ---- 吃喝购物
  { id: "market", group: "life", name: "市场", icon: "shop", re: /市场|市集|鱼市|夜市|商店街|market|torget|halle\b|markt/i, osm: ["amenity=marketplace"] },
  { id: "food", group: "life", name: "餐厅咖啡", icon: "food", re: /餐厅|饭店|食堂|面馆|拉面|寿司|烤肉|咖啡|甜品|麦当劳|café|cafe|coffee|restaurant|bakery|bistro|kaffi|mcdonald|bar\b/i, osm: ["amenity=restaurant", "amenity=cafe", "amenity=fast_food", "amenity=bar"] },
  { id: "shop", group: "life", name: "购物", icon: "shop", re: /商场|百货|购物|outlet|mall\b|shop|store|免税/i, osm: ["shop"] },
  // ---- 兜底
  { id: "sight", group: "culture", name: "景点", icon: "pin" },
];
export const KIND: Record<string, KindDef> = Object.fromEntries(KINDS.map((k) => [k.id, k]));
/** 第八轮：行程列表、站点详情、时间轴里的站点图标按六组给——交通一种（route）、住宿一种（hotel）、其余按人文 / 自然 / 休闲 / 吃喝购物；
 *  类型级的图标（教堂、瀑布……）只在选类型的编辑器里用。iOS 的 LandmarkKinds.groupSymbol 照这张表 */
export const GROUP_ICON: Record<KindGroup, string> = { culture: "museum", nature: "mountain", leisure: "themepark", life: "food", transit: "route", stay: "hotel" };
export const groupIconOfKind = (kindId: string): string => GROUP_ICON[(KIND[kindId] ?? KIND.sight).group];

const CATEGORY_KIND: Record<string, string> = { airport: "airport", port: "port", station: "station", hotel: "hotel", food: "food", shop: "shop" };

function osmMatch(tags: Record<string, string>, rule: string): boolean {
  const [k, v] = rule.split("="); if (!(k in tags)) return false; return v === undefined || tags[k] === v || tags[k].split(";").includes(v);
}

/** 给一个地点定类型。返回 KINDS 里的 id；认不出时是 "sight" */
export function classifyPlace(p: { name: string; category?: string; kind?: string; tags?: Record<string, string> }): string {
  if (p.kind && KIND[p.kind]) return p.kind;
  const byCat = p.category ? CATEGORY_KIND[p.category] : undefined;
  if (byCat && byCat !== "food" && byCat !== "shop") return byCat;            // 交通与住处以类别为准（「某某站前酒店」是住处不是车站）
  if (p.tags) for (const k of KINDS) if (k.osm?.some((r) => osmMatch(p.tags!, r))) return k.id;
  for (const k of KINDS) if (k.re && k.group !== "transit" && k.group !== "stay" && k.re.test(p.name)) return k.id;
  if (byCat) return byCat;
  for (const k of KINDS) if (k.re && k.re.test(p.name)) return k.id;           // 最后才让交通 / 住处的关键词参与
  return "sight";
}
