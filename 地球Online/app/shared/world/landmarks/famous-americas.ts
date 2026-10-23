/** 名胜登记：美洲（纯数据，不依赖 three）。每条：id、中文名、名字正则（中 / 英 / 当地语 / 日文）、坐标、认出半径（公里）、类型、模型名（landmarks/americas.ts 里的键）。
 *  坐标取游客最常到的那个点：建筑取建筑本身，山水取主观景点（大峡谷取南缘马瑟角，尼亚加拉取马蹄瀑布，伊瓜苏取魔鬼咽喉，乌尤尼取印加瓦西岛，复活节岛取通加里基祭坛，纪念碑谷取游客中心）。
 *  名字正则只收专名，避免把普通地方和别处的复制品认错：
 *  「大峡谷」单独不认（东非大裂谷、雅鲁藏布大峡谷、黄石大峡谷都不是它）；台场、巴黎的自由女神像不认；「金门」单独是福建金门岛，不认；
 *  葡萄牙的大基督像（Cristo Rei）、安第斯山的基督像不认；伊瓜苏港、伊瓜苏市（Puerto Iguazú、Foz do Iguaçu）是住宿的小城，不认；「天空之镜」也用来说青海茶卡盐湖，不认。 */
import type { Famous } from "../landmark-famous.ts";

const A = (f: Omit<Famous, "region">): Famous => ({ ...f, region: "americas" });

export const FAMOUS_AMERICAS: Famous[] = [
  // ---- 美国
  A({ id: "statue-of-liberty", name: "自由女神像", en: "Statue of Liberty", ja: "自由の女神像", re: /(?<!台场|台場|お台場の?|巴黎|パリの?|拉斯维加斯)自由女神|(?<!台场|台場|お台場の?|パリの?)自由の女神|statue of liberty|liberty island|自由岛|自由島|liberty enlightening the world/i, lat: 40.6892, lng: -74.0445, r: 0.4, kind: "monument", model: "am_liberty" }),
  A({ id: "empire-state-building", name: "帝国大厦", en: "Empire State Building", ja: "エンパイア・ステート・ビルディング", re: /帝国大厦|帝國大廈|empire state building|エンパイア・?ステート・?ビル/i, lat: 40.7484, lng: -73.9857, r: 0.2, kind: "tower", model: "am_empire_state" }),
  A({ id: "golden-gate-bridge", name: "金门大桥", en: "Golden Gate Bridge", ja: "ゴールデン・ゲート・ブリッジ", re: /金门大桥|金門大橋|金门桥|金門橋|golden gate bridge|ゴールデン・?ゲート・?ブリッジ/i, lat: 37.8199, lng: -122.4783, r: 1.5, kind: "bridge", model: "am_golden_gate" }),
  A({ id: "grand-canyon", name: "科罗拉多大峡谷", en: "Grand Canyon", ja: "グランド・キャニオン", re: /科罗拉多大峡谷|科羅拉多大峽谷|美国大峡谷|美國大峽谷|大峡谷国家公园|大峽谷國家公園|大峡谷[南北]缘|大峽谷[南北]緣|grand canyon(?! of the yellowstone)|グランド・?キャニオン|mather point|马瑟角/i, lat: 36.0617, lng: -112.1077, r: 5, kind: "fjord", model: "am_grand_canyon" }),
  A({ id: "niagara-falls", name: "尼亚加拉瀑布", en: "Niagara Falls", ja: "ナイアガラの滝", re: /尼亚加拉(?!湖滨|湖边)|尼亞加拉(?!湖濱|湖邊)|尼加拉瀑布|尼加拉大瀑布|niagara(?![- ]on[- ]the[- ]lake)|ナイアガラ/i, lat: 43.0775, lng: -79.0757, r: 2, kind: "waterfall", model: "am_niagara" }),
  A({ id: "mount-rushmore", name: "总统山", en: "Mount Rushmore", ja: "ラシュモア山", re: /总统山|總統山|拉什莫尔|拉什莫爾|rushmore|ラシュモア/i, lat: 43.8791, lng: -103.4591, r: 1, kind: "monument", model: "am_rushmore" }),
  A({ id: "space-needle", name: "西雅图太空针塔", en: "Space Needle", ja: "スペースニードル", re: /太空针|太空針|space needle|スペース・?ニードル/i, lat: 47.6205, lng: -122.3493, r: 0.3, kind: "tower", model: "am_space_needle" }),
  A({ id: "old-faithful", name: "黄石老忠实泉", en: "Old Faithful Geyser", ja: "オールド・フェイスフル・ガイザー", re: /老忠实|老忠實|old faithful(?! geyser of california)|オールド・?フェイスフル/i, lat: 44.4605, lng: -110.8281, r: 1, kind: "geyser", model: "am_old_faithful" }),
  A({ id: "white-house", name: "白宫", en: "White House", ja: "ホワイトハウス", re: /白宫|白宮|white house|ホワイトハウス/i, lat: 38.8977, lng: -77.0365, r: 0.3, kind: "castle", model: "am_white_house" }),
  A({ id: "monument-valley", name: "纪念碑谷", en: "Monument Valley", ja: "モニュメント・バレー", re: /纪念碑谷|紀念碑谷|monument valley|モニュメント・?バレー/i, lat: 36.9831, lng: -110.1114, r: 4, kind: "mountain", model: "am_monument_valley" }),
  A({ id: "hollywood-sign", name: "好莱坞标志", en: "Hollywood Sign", ja: "ハリウッドサイン", re: /好莱坞标志|好萊塢標誌|好莱坞山字|hollywood sign|ハリウッド・?サイン/i, lat: 34.1341, lng: -118.3215, r: 0.5, kind: "monument", model: "am_hollywood" }),
  // ---- 加拿大
  A({ id: "cn-tower", name: "多伦多 CN 塔", en: "CN Tower", ja: "CNタワー", re: /(?<![a-z])cn ?(塔|tower|タワー)|加拿大国家电视塔|加拿大國家電視塔|多伦多电视塔|多倫多電視塔|tour cn/i, lat: 43.6426, lng: -79.3871, r: 0.3, kind: "tower", model: "am_cn_tower" }),
  // ---- 墨西哥、中美洲
  A({ id: "chichen-itza", name: "奇琴伊察库库尔坎金字塔", en: "Chichén Itzá", ja: "チチェン・イッツァ", re: /奇琴伊察|奇琴伊薩|库库尔坎金字塔|庫庫爾坎金字塔|chich[eé]n[ -]?itz[aá]|(pyramid|temple|templo|pir[aá]mide) (of |de )?kukulc[aá]n|チチェン・?イッツァ|ククルカン/i, lat: 20.6829, lng: -88.5686, r: 1, kind: "ruins", model: "am_chichen_itza" }),
  A({ id: "tikal", name: "蒂卡尔神庙", en: "Tikal", ja: "ティカル", re: /蒂卡尔|蒂卡爾|tikal|ティカル/i, lat: 17.2221, lng: -89.6237, r: 1, kind: "ruins", model: "am_tikal" }),
  // ---- 南美洲
  A({ id: "christ-the-redeemer", name: "里约基督像", en: "Christ the Redeemer", ja: "コルコバードのキリスト像", re: /里约.{0,4}基督像|里約.{0,4}基督像|基督救世主像|救世基督像|耶稣山|耶穌山|科尔科瓦多|科爾科瓦多|cristo redentor|christ the redeemer(?! of the andes)|corcovado|コルコバード/i, lat: -22.9519, lng: -43.2105, r: 0.8, kind: "monument", model: "am_christ_redeemer" }),
  A({ id: "machu-picchu", name: "马丘比丘", en: "Machu Picchu", ja: "マチュ・ピチュ", re: /马丘比丘|馬丘比丘|machu ?picchu|マチュ・?ピチュ|huayna picchu|瓦纳比丘|瓦納比丘/i, lat: -13.1631, lng: -72.545, r: 2, kind: "ruins", model: "am_machu_picchu" }),
  A({ id: "iguazu-falls", name: "伊瓜苏瀑布", en: "Iguazu Falls", ja: "イグアスの滝", re: /伊瓜[苏蘇索](?![港市])|(?<!puerto |foz do )igua[zç][uú]|イグアス|garganta del diablo|魔鬼咽喉/i, lat: -25.6953, lng: -54.4367, r: 3, kind: "waterfall", model: "am_iguazu" }),
  A({ id: "salar-de-uyuni", name: "乌尤尼盐沼", en: "Salar de Uyuni", ja: "ウユニ塩湖", re: /乌尤尼(?![镇市]|火车)|烏尤尼(?![鎮市]|火車)|salar de uyuni|uyuni salt|ウユニ塩湖|incahuasi|印加瓦西/i, lat: -20.2422, lng: -67.6258, r: 5, kind: "lake", model: "am_uyuni" }),
  A({ id: "easter-island-moai", name: "复活节岛摩艾石像", en: "Moai of Easter Island", ja: "イースター島のモアイ", re: /摩艾|复活节岛|復活節島|rapa ?nui|\bmoai\b|easter island|isla de pascua|tongariki|通加里基|イースター島|モアイ/i, lat: -27.1258, lng: -109.2769, r: 3, kind: "monument", model: "am_moai" }),
  // ---- 补充（D87）
  A({ id: "brooklyn-bridge", name: "布鲁克林大桥", en: "Brooklyn Bridge", ja: "ブルックリン橋", re: /布鲁克林大桥|布魯克林大橋|brooklyn bridge|ブルックリン橋/i, lat: 40.7061, lng: -73.9969, r: 0.4, kind: "bridge", model: "am_brooklyn_bridge" }),
  A({ id: "cloud-gate", name: "云门（芝加哥豆子）", en: "Cloud Gate", ja: "クラウドゲート", re: /云门(?!山|寺|舞)|雲門(?!山|寺|舞)|芝加哥豆|the bean|cloud gate|クラウド・?ゲート/i, lat: 41.8827, lng: -87.6233, r: 0.2, kind: "monument", model: "am_cloud_gate" }),
  A({ id: "perito-moreno", name: "莫雷诺冰川", en: "Perito Moreno Glacier", ja: "ペリトモレノ氷河", re: /莫雷诺冰川|佩里托莫雷诺|perito moreno|ペリト・?モレノ/i, lat: -50.4967, lng: -73.1377, r: 3, kind: "glacier", model: "am_perito_moreno" }),
  A({ id: "lake-louise", name: "路易斯湖", en: "Lake Louise", ja: "レイクルイーズ", re: /路易斯湖|露易丝湖|露易絲湖|lake louise|レイク・?ルイーズ/i, lat: 51.4166, lng: -116.2125, r: 2, kind: "lake", model: "am_lake_louise" }),
];
