/** 名胜登记：非洲（纯数据，不依赖 three）。每条：id、中文名、名字正则（中 / 英 / 当地语 / 日文）、坐标、认出半径（公里）、类型、模型名（landmarks/africa.ts 里的键）。
 *  坐标用 WGS84，取游客最常到的那个点：吉萨取胡夫金字塔（1.5 公里内认得出狮身人面像和另两座），桌山取山顶缆车站，
 *  维多利亚瀑布取主瀑布观景区，乞力马扎罗取乌呼鲁峰（5 公里），马赛马拉取保护区中部（名字为主，坐标只能认出一部分）。
 *  名字正则只收专名，不收会认错普通地方的泛称：不单用「金字塔」「狮身人面像大道」「sphinx」「pyramid」「table mountain casino」「kibo」；
 *  同名的别处要排除：卢克索的狮身人面像大道、少女峰的斯芬克斯观景台、墨西哥乔卢拉大金字塔、内蒙古乌海的桌子山、拉巴特的哈桑塔、
 *  乞力马扎罗机场与同名咖啡馆、开普敦和克拉科夫的「十二使徒」。 */
import type { Famous } from "../landmark-famous.ts";

export const FAMOUS_AFRICA: Famous[] = [
  { id: "giza-pyramids", name: "吉萨金字塔群与狮身人面像", en: "Pyramids of Giza and the Great Sphinx", ja: "ギザの三大ピラミッド", re: /吉[萨薩]金字塔|吉[萨薩]高原|吉[萨薩](?:大)?狮身人面像|胡夫(?:大)?金字塔|哈夫拉金字塔|卡夫拉金字塔|门卡乌拉金字塔|孟卡拉金字塔|埃及金字塔|开罗金字塔|(?<!卢克索|卢克索神庙|斯芬克斯)(?:狮身人面像|獅身人面像)(?!大道)|pyramids? of giza|giza pyramids?|giza plateau|giza necropolis|great pyramid of (?:giza|khufu|cheops)|pyramid of (?:khufu|cheops|khafre|chephren|menkaure|mycerinus)|great sphinx(?! of tanis)|sphinx of giza|ギザ(?:の|・)?(?:三大)?ピラミッド|クフ王のピラミッド|ギザの大スフィンクス|大スフィンクス|أهرامات الجيزة|أبو الهول/i, lat: 29.9792, lng: 31.1342, r: 1.5, kind: "ruins", model: "af_giza" },
  { id: "table-mountain", name: "开普敦桌山", en: "Table Mountain, Cape Town", ja: "テーブルマウンテン", re: /(?<!乌海|烏海)桌山|桌山国家公园|(?<!north |south |wyoming )table mountain(?! (?:casino|rancheria|state park|golden))|tafelberg(?!, (?:suriname|nederland))|hoerikwaggo|テーブル・?マウンテン/i, lat: -33.9573, lng: 18.403, r: 2, kind: "mountain", model: "af_table_mountain" },
  { id: "victoria-falls", name: "维多利亚瀑布", en: "Victoria Falls", ja: "ヴィクトリアの滝", re: /维多利亚瀑布|維多利亞瀑布|莫西奥图尼亚|victoria falls(?! (?:airport|hotel|lookout))|mosi[- ]oa[- ]tunya|chinotimba|[ヴビ]ィ?クトリア(?:の滝|・フォールズ)/i, lat: -17.9248, lng: 25.8572, r: 2, kind: "waterfall", model: "af_victoria_falls" },
  { id: "kilimanjaro", name: "乞力马扎罗山", en: "Mount Kilimanjaro", ja: "キリマンジャロ", re: /乞力马扎罗(?!国际机场|机场|咖啡)|乞力馬扎羅(?!國際機場|機場|咖啡)|吉力马扎罗|吉力馬札羅|(?:mount |mt\.? )?kilimanjaro(?! (?:international )?airport| coffee| caf[eé])|uhuru peak|キリマンジャロ(?!空港|コーヒー)/i, lat: -3.0674, lng: 37.3556, r: 5, kind: "mountain", model: "af_kilimanjaro" },
  { id: "hassan-ii-mosque", name: "哈桑二世清真寺", en: "Hassan II Mosque", ja: "ハッサン2世モスク", re: /哈桑二世(?:大)?清真寺|hassan (?:ii|2) mosque|(?:grande )?mosqu[ée]e hassan[- ](?:ii|2)|ハッサン(?:2|二)世モスク|ハサン(?:2|二)世モスク|مسجد الحسن الثاني/i, lat: 33.6073, lng: -7.6326, r: 0.4, kind: "mosque", model: "af_hassan2" },
  { id: "abu-simbel", name: "阿布辛贝神庙", en: "Abu Simbel Temples", ja: "アブ・シンベル神殿", re: /阿布辛贝|阿布辛貝|阿布辛拜勒|阿布·辛拜勒|阿布森贝|abu simbel(?! airport)|abou simbel|アブ・?シンベル|أبو سمبل/i, lat: 22.3372, lng: 31.6258, r: 0.6, kind: "ruins", model: "af_abu_simbel" },
  { id: "masai-mara", name: "马赛马拉国家保护区", en: "Maasai Mara National Reserve", ja: "マサイマラ国立保護区", re: /马赛马拉|馬賽馬拉|马赛玛拉|ma{1,2}sai[- ]?mara|mara triangle|マサイ・?マラ/i, lat: -1.49, lng: 35.14, r: 5, kind: "forest", model: "af_masai_mara" },
  { id: "chefchaouen", name: "舍夫沙万蓝色小镇", en: "Chefchaouen", ja: "シャウエン", re: /舍夫沙[万萬]|舍夫沙文|chefchaouen|\bchaouen\b|\bxauen\b|شفشاون|シェフ?シャウエン|シャウエン/i, lat: 35.1688, lng: -5.2623, r: 1, kind: "oldtown", model: "af_chefchaouen" },
  // ---- 补充（D87）
  { id: "ait-benhaddou", name: "阿伊特本哈杜", en: "Aït Benhaddou", ja: "アイトベンハドゥ", re: /阿伊特本哈杜|艾本哈杜|a[iï]t[- ]ben[- ]?haddou|アイト・?ベン・?ハドゥ/i, lat: 31.047, lng: -7.1289, r: 1, kind: "oldtown", model: "af_ait_benhaddou" },
  { id: "serengeti", name: "塞伦盖蒂", en: "Serengeti", ja: "セレンゲティ", re: /塞伦盖蒂|塞倫蓋提|serengeti|セレンゲティ/i, lat: -2.3333, lng: 34.8333, r: 5, kind: "forest", model: "af_serengeti" },
].map((f) => ({ ...f, region: "africa" as const }));
