/** 名胜登记：亚洲（纯数据，不依赖 three）。每条：id、中文名、名字正则（中 / 英 / 当地语）、坐标、认出半径（公里）、类型、模型名（landmarks/asia.ts 里的键）。
 *  坐标用 WGS84（和 OpenStreetMap、Natural Earth 一致；中国境内不要用地图 App 里偏移过的坐标），取游客最常到的那个点：
 *  建筑取建筑本身，山水取主观景点（漓江取兴坪二十元观景点，下龙湾取天堂岛，珠峰取北坡大本营）。
 *  国内不少资料（包括示例行程）给的是地图 App 偏移过的坐标，和这里差 500 米上下：东方明珠、雷峰塔的半径放到 0.5 公里，鸟巢连广场算 0.6 公里，
 *  示例行程里的雷峰塔、鸟巢按坐标也能认出来（有测试）。名字能认时先按名字。
 *  名字正则只收专名，避免把普通地方认错：台北故宫、沈阳故宫不是北京故宫；瘦西湖、惠州西湖不是杭州西湖；黄山市、黄山站不是黄山。 */
import type { Famous } from "../landmark-famous.ts";

export const FAMOUS_ASIA: Famous[] = [
  // ---- 中国
  { id: "great-wall", name: "长城（八达岭）", en: "Great Wall at Badaling", ja: "万里の長城（八達嶺）", re: /八达岭|八達嶺|长城|長城|great wall|badaling|만리장성/i, lat: 40.354, lng: 116.0125, r: 3, kind: "ruins", model: "as_great_wall" },
  { id: "forbidden-city", name: "故宫（太和殿）", en: "Forbidden City", ja: "紫禁城", re: /(?<!台北|臺北|国立|國立|沈阳|瀋陽|沈陽|看|望)故[宫宮]|紫禁城|太和殿|forbidden city|hall of supreme harmony|자금성/i, lat: 39.9159, lng: 116.3907, r: 1, kind: "castle", model: "as_forbidden_city" },
  { id: "temple-of-heaven", name: "天坛祈年殿", en: "Temple of Heaven", ja: "天壇", re: /天坛|天壇|祈年殿|temple of heaven|천단/i, lat: 39.8826, lng: 116.4068, r: 0.8, kind: "temple", model: "as_temple_of_heaven" },
  { id: "potala", name: "布达拉宫", en: "Potala Palace", ja: "ポタラ宮", re: /布达拉|布達拉|potala|ポタラ/i, lat: 29.6578, lng: 91.1169, r: 0.5, kind: "castle", model: "as_potala" },
  { id: "terracotta-army", name: "兵马俑", en: "Terracotta Army", ja: "兵馬俑", re: /兵马俑|兵馬俑|terracotta (army|warriors)/i, lat: 34.385, lng: 109.2731, r: 1, kind: "museum", model: "as_terracotta" },
  { id: "oriental-pearl", name: "东方明珠", en: "Oriental Pearl Tower", ja: "東方明珠塔", re: /东方明珠|東方明珠|oriental pearl/i, lat: 31.2417, lng: 121.4947, r: 0.5, kind: "tower", model: "as_oriental_pearl" },
  { id: "li-river", name: "漓江山水", en: "Li River", ja: "漓江", re: /漓江|桂林山水|阳朔|陽朔|兴坪|興坪|li river|yangshuo|xingping/i, lat: 24.9251, lng: 110.5166, r: 5, kind: "mountain", model: "as_li_river" },
  { id: "huangshan", name: "黄山", en: "Mount Huangshan", ja: "黄山", re: /(?<![大小])[黄黃]山(?![市站区區路]|[南北东西]站)|迎客松|huangshan|yellow mountain/i, lat: 30.1246, lng: 118.1704, r: 4, kind: "mountain", model: "as_huangshan" },
  { id: "leifeng-pagoda", name: "西湖雷峰塔", en: "Leifeng Pagoda", ja: "雷峰塔", re: /雷峰塔|杭州西湖|(?<![瘦州])西湖(?![区區]|醋[鱼魚]|[龙龍]井)|leifeng|west lake/i, lat: 30.2339, lng: 120.145, r: 0.5, kind: "tower", model: "as_leifeng" },
  { id: "birds-nest", name: "鸟巢（国家体育场）", en: "Beijing National Stadium (Bird's Nest)", ja: "北京国家体育場（鳥の巣）", re: /鸟巢|鳥巢|鳥の巣|国家体育场|國家體育場|bird'?s nest|beijing national stadium/i, lat: 39.9916, lng: 116.3905, r: 0.6, kind: "square", model: "as_birds_nest" },
  // ---- 日本
  { id: "fuji", name: "富士山", en: "Mount Fuji", ja: "富士山", re: /富士山|mount fuji|mt\.? ?fuji|fuji-?san|ふじさん/i, lat: 35.3606, lng: 138.7274, r: 5, kind: "mountain", model: "as_fuji" },
  { id: "kiyomizu", name: "清水寺", en: "Kiyomizu-dera", ja: "清水寺", re: /清水寺|kiyomizu-?dera|kiyomizu temple|きよみずでら/i, lat: 34.995, lng: 135.785, r: 0.4, kind: "temple", model: "as_kiyomizu" },
  { id: "fushimi-inari", name: "伏见稻荷大社", en: "Fushimi Inari Taisha", ja: "伏見稲荷大社", re: /伏见稻荷|伏見稲荷|伏見稻荷|千本鸟居|千本鳥居|fushimi ?inari/i, lat: 34.9671, lng: 135.7727, r: 0.6, kind: "temple", model: "as_fushimi_inari" },
  { id: "kinkakuji", name: "金阁寺", en: "Kinkaku-ji", ja: "金閣寺", re: /金阁寺|金閣寺|鹿苑寺|kinkaku-?ji|golden pavilion/i, lat: 35.0394, lng: 135.7292, r: 0.3, kind: "temple", model: "as_kinkakuji" },
  { id: "osaka-castle", name: "大阪城", en: "Osaka Castle", ja: "大阪城", re: /大阪城|大坂城|osaka castle/i, lat: 34.6873, lng: 135.5259, r: 0.6, kind: "castle", model: "as_osaka_castle" },
  { id: "tokyo-tower", name: "东京塔", en: "Tokyo Tower", ja: "東京タワー", re: /东京塔|東京塔|東京タワー|tokyo tower/i, lat: 35.6586, lng: 139.7454, r: 0.3, kind: "tower", model: "as_tokyo_tower" },
  { id: "tokyo-skytree", name: "东京晴空塔", en: "Tokyo Skytree", ja: "東京スカイツリー", re: /晴空塔|天空树|天空樹|スカイツリー|sky ?tree/i, lat: 35.7101, lng: 139.8107, r: 0.3, kind: "tower", model: "as_skytree" },
  { id: "itsukushima", name: "严岛神社大鸟居", en: "Itsukushima Shrine", ja: "厳島神社", re: /严岛|嚴島|厳島|宫岛|宮島|itsukushima|miyajima/i, lat: 34.296, lng: 132.3197, r: 0.5, kind: "temple", model: "as_itsukushima" },
  { id: "todaiji", name: "奈良东大寺", en: "Todai-ji", ja: "東大寺", re: /东大寺|東大寺|大佛殿|大仏殿|todai-?ji/i, lat: 34.689, lng: 135.8398, r: 0.4, kind: "temple", model: "as_todaiji" },
  // ---- 韩国
  { id: "gyeongbokgung", name: "景福宫", en: "Gyeongbokgung Palace", ja: "景福宮", re: /景福宫|景福宮|光化门|光化門|gyeongbokgung|gwanghwamun|경복궁|광화문/i, lat: 37.5786, lng: 126.9772, r: 0.6, kind: "castle", model: "as_gyeongbokgung" },
  // ---- 东南亚
  { id: "angkor-wat", name: "吴哥窟", en: "Angkor Wat", ja: "アンコール・ワット", re: /吴哥窟|吳哥窟|小吴哥|angkor wat|アンコール・?ワット|អង្គរវត្ត/i, lat: 13.4125, lng: 103.8667, r: 1, kind: "temple", model: "as_angkor_wat" },
  { id: "wat-arun", name: "郑王庙", en: "Wat Arun", ja: "ワット・アルン", re: /郑王庙|鄭王廟|黎明寺|wat arun|ワット・?アルン|วัดอรุณ/i, lat: 13.7437, lng: 100.4888, r: 0.3, kind: "temple", model: "as_wat_arun" },
  { id: "marina-bay-sands", name: "滨海湾金沙", en: "Marina Bay Sands", ja: "マリーナベイ・サンズ", re: /滨海湾金沙|濱海灣金沙|marina bay sands|マリーナ・?ベイ・?サンズ/i, lat: 1.2834, lng: 103.8607, r: 0.4, kind: "viewpoint", model: "as_marina_bay_sands" },
  { id: "merlion", name: "鱼尾狮", en: "Merlion", ja: "マーライオン", re: /鱼尾狮|魚尾獅|merlion|マーライオン/i, lat: 1.2868, lng: 103.8545, r: 0.2, kind: "monument", model: "as_merlion" },
  { id: "petronas", name: "吉隆坡双子塔", en: "Petronas Twin Towers", ja: "ペトロナスツインタワー", re: /吉隆坡[双雙]子塔|[国國]油[双雙]峰塔|petronas|ペトロナス/i, lat: 3.1579, lng: 101.7116, r: 0.3, kind: "tower", model: "as_petronas" },
  { id: "borobudur", name: "婆罗浮屠", en: "Borobudur", ja: "ボロブドゥール", re: /婆罗浮屠|婆羅浮屠|borobudur|ボロブドゥール/i, lat: -7.6079, lng: 110.2038, r: 0.6, kind: "temple", model: "as_borobudur" },
  { id: "ha-long-bay", name: "下龙湾", en: "Ha Long Bay", ja: "ハロン湾", re: /下龙湾|下龍灣|ha ?long bay|vịnh hạ long|ハロン湾/i, lat: 20.8626, lng: 107.0672, r: 5, kind: "beach", model: "as_ha_long" },
  { id: "taipei-101", name: "台北101", en: "Taipei 101", ja: "台北101", re: /[台臺]北\s?101|taipei\s?101/i, lat: 25.0339, lng: 121.5645, r: 0.3, kind: "tower", model: "as_taipei101" },
  // ---- 南亚 / 中东
  { id: "taj-mahal", name: "泰姬陵", en: "Taj Mahal", ja: "タージ・マハル", re: /泰姬陵|泰姬瑪哈陵|taj mahal(?! palace)|タージ・?マハル|ताज महल/i, lat: 27.1751, lng: 78.0421, r: 0.5, kind: "monument", model: "as_taj_mahal" },
  { id: "burj-khalifa", name: "哈利法塔", en: "Burj Khalifa", ja: "ブルジュ・ハリファ", re: /哈利法塔|迪拜塔|杜拜塔|burj khalifa|ブルジュ・?ハリファ|برج خليفة/i, lat: 25.1972, lng: 55.2744, r: 0.4, kind: "tower", model: "as_burj_khalifa" },
  { id: "petra-khazneh", name: "佩特拉卡兹尼神殿", en: "Al-Khazneh, Petra", ja: "ペトラ遺跡エル・カズネ", re: /佩特拉|卡兹尼|al[- ]?khazneh|\bpetra\b|ペトラ|البتراء|الخزنة/i, lat: 30.3222, lng: 35.4516, r: 0.5, kind: "ruins", model: "as_petra" },
  { id: "everest", name: "珠穆朗玛峰", en: "Mount Everest", ja: "エベレスト", re: /珠穆朗[玛瑪]|珠峰|everest|sagarmatha|chomolungma|エベレスト|सगरमाथा/i, lat: 28.1414, lng: 86.8514, r: 5, kind: "mountain", model: "as_everest" },
  // ---- 补充（D87）
  { id: "himeji-castle", name: "姬路城", en: "Himeji Castle", ja: "姫路城", re: /姬路城|姫路城|himeji(?:-j[oō]| castle)/i, lat: 34.8394, lng: 134.6939, r: 0.4, kind: "castle", model: "as_himeji" },
  { id: "kaminarimon", name: "浅草寺雷门", en: "Kaminarimon, Senso-ji", ja: "浅草寺雷門", re: /雷门|雷門|浅草寺|浅草観音|kaminarimon|sens[oō]-?ji|asakusa/i, lat: 35.7111, lng: 139.7966, r: 0.3, kind: "temple", model: "as_kaminarimon" },
  { id: "shirakawa-go", name: "白川乡合掌村", en: "Shirakawa-go", ja: "白川郷", re: /白川乡|白川鄉|白川郷|shirakawa-?go|合掌村|合掌造/i, lat: 36.2578, lng: 136.9061, r: 2, kind: "oldtown", model: "as_shirakawago" },
  { id: "shwedagon", name: "仰光大金塔", en: "Shwedagon Pagoda", ja: "シュエダゴンパゴダ", re: /大金塔|大金寺|shwedagon|シュエダゴン/i, lat: 16.7983, lng: 96.1497, r: 0.4, kind: "temple", model: "as_shwedagon" },
  { id: "burj-al-arab", name: "帆船酒店", en: "Burj Al Arab", ja: "ブルジュアルアラブ", re: /帆船酒店|阿拉伯塔|burj al[- ]?arab|ブルジュ・?アル・?アラブ/i, lat: 25.1412, lng: 55.1853, r: 0.4, kind: "tower", model: "as_burj_al_arab" },
  { id: "sigiriya", name: "狮子岩", en: "Sigiriya", ja: "シーギリヤ", re: /狮子岩|獅子岩|sigiriya|シーギリヤ/i, lat: 7.957, lng: 80.7603, r: 1, kind: "ruins", model: "as_sigiriya" },
].map((f) => ({ ...f, region: "asia" as const }));
