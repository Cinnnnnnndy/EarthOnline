/** 名胜登记：大洋洲（纯数据，不依赖 three）。每条：id、中文名、名字正则（中 / 英 / 当地语 / 日文）、坐标、认出半径（公里）、类型、模型名（landmarks/oceania.ts 里的键）。
 *  坐标用 WGS84，取游客最常到的那个点：歌剧院与海港大桥相距约 0.6 公里，各自半径 0.3；大堡礁取心形礁（名字为主，坐标只认那一片），
 *  米尔福德峡湾取游船码头，十二使徒岩取主观景台。
 *  名字正则只收专名，不收会认错普通地方的泛称：不单用「歌剧院」「大桥」「十二门徒」「Great Ocean Road」「Opera House」「Harbour Bridge」；
 *  同名的别处要排除：开普敦的十二使徒山与十二使徒酒店、克拉科夫等地的十二使徒教堂、新西兰的大堡岛（Great Barrier Island）、
 *  艾尔斯岩度假村与机场。 */
import type { Famous } from "../landmark-famous.ts";

export const FAMOUS_OCEANIA: Famous[] = [
  { id: "sydney-opera-house", name: "悉尼歌剧院", en: "Sydney Opera House", ja: "シドニー・オペラハウス", re: /悉尼歌[剧劇]院|雪梨歌[剧劇]院|sydney opera house|シドニー・?オペラ・?ハウス/i, lat: -33.8568, lng: 151.2153, r: 0.3, kind: "theater", model: "oc_sydney_opera" },
  { id: "sydney-harbour-bridge", name: "悉尼海港大桥", en: "Sydney Harbour Bridge", ja: "シドニー・ハーバーブリッジ", re: /悉尼海港大桥|悉尼港湾大桥|悉尼港大桥|悉尼大桥|雪梨港灣大橋|雪梨海港大橋|sydney harbou?r bridge|harbou?r bridge,? sydney|bridgeclimb sydney|シドニー・?ハーバー・?ブリッジ/i, lat: -33.8522, lng: 151.2106, r: 0.3, kind: "bridge", model: "oc_harbour_bridge" },
  { id: "uluru", name: "乌鲁鲁（艾尔斯岩）", en: "Uluru (Ayers Rock)", ja: "ウルル（エアーズロック）", re: /乌鲁鲁|烏魯魯|艾尔斯岩(?!度假村|机场)|艾爾斯岩(?!度假村|機場)|艾尔斯巨石|\buluru\b(?!.{0,3}(?:airport|resort))|ayers rock(?! (?:resort|airport|campground))|ウルル|エアーズ・?ロック(?!・?リゾート|空港)/i, lat: -25.3444, lng: 131.0369, r: 3, kind: "mountain", model: "oc_uluru" },
  { id: "great-barrier-reef", name: "大堡礁", en: "Great Barrier Reef", ja: "グレート・バリア・リーフ", re: /大堡礁|心形礁|great barrier reef|heart reef|グレート・?バリア・?リーフ|ハート・?リーフ/i, lat: -19.7754, lng: 149.2478, r: 5, kind: "beach", model: "oc_great_barrier_reef" },
  { id: "milford-sound", name: "米尔福德峡湾", en: "Milford Sound", ja: "ミルフォード・サウンド", re: /米尔福德峡湾|米爾福德峽灣|米佛峡湾|米佛峽灣|米尔福德湾|米尔福德海峡|主教冠峰|milford sound|piopiotahi|mitre peak|ミルフォード・?サウンド/i, lat: -44.6723, lng: 167.928, r: 5, kind: "fjord", model: "oc_milford_sound" },
  { id: "twelve-apostles", name: "大洋路十二使徒岩", en: "Twelve Apostles, Great Ocean Road", ja: "トゥエルブ・アポストルズ", re: /十二使徒岩|十二门徒岩|十二門徒岩|十二使徒石|十二门徒石|十二門徒石|大洋路(?:的)?十二(?:使徒|门徒|門徒)|(?<!church of (?:the )?|cape town(?:'s)? )(?:twelve|12) apostles(?! (?:church|cathedral|hotel|mountains?|range|nature reserve|trail))|(?:twelve|12) apostles(?:,? great ocean road| marine national park| lookout)|トゥエルブ・?アポストルズ|12人の使徒/i, lat: -38.6619, lng: 143.1053, r: 1.5, kind: "beach", model: "oc_twelve_apostles" },
  { id: "hobbiton", name: "霍比特人村", en: "Hobbiton Movie Set", ja: "ホビット村", re: /霍比特人?村|霍比特屯|哈比人村|哈比屯|夏尔(?:村|霍比特)|hobbiton|ホビット村|ホビトン/i, lat: -37.8575, lng: 175.6797, r: 0.8, kind: "oldtown", model: "oc_hobbiton" },
  // ---- 补充（D87）
  { id: "sky-tower", name: "奥克兰天空塔", en: "Auckland Sky Tower", ja: "スカイタワー", re: /奥克兰天空塔|奧克蘭天空塔|天空塔|auckland sky tower|sky tower|スカイタワー/i, lat: -36.8484, lng: 174.7622, r: 0.3, kind: "tower", model: "oc_sky_tower" },
  { id: "queenstown-gondola", name: "皇后镇缆车", en: "Skyline Queenstown Gondola", ja: "クイーンズタウンのゴンドラ", re: /皇后镇缆车|皇后镇天际线|皇后鎮纜車|skyline queenstown|queenstown (?:gondola|skyline)|クイーンズタウンのゴンドラ/i, lat: -45.0272, lng: 168.6556, r: 1, kind: "cablecar", model: "oc_queenstown_gondola" },
  { id: "waitomo", name: "怀托摩萤火虫洞", en: "Waitomo Glowworm Caves", ja: "ワイトモ洞窟", re: /怀托摩|懷托摩|萤火虫洞|螢火蟲洞|waitomo|ワイトモ/i, lat: -38.2609, lng: 175.1034, r: 1, kind: "cave", model: "oc_waitomo" },
].map((f) => ({ ...f, region: "oceania" as const }));
