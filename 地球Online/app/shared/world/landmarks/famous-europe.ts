/** 名胜登记：欧洲（纯数据，不依赖 three）。每条：id、中文名、名字正则（中 / 英 / 当地语 / 日文）、坐标、认出半径（公里）、类型、模型名（landmarks/europe.ts 里的键）。
 *  坐标用 WGS84，取游客最常到的那个点：建筑取建筑本身，大片的地方取主观景点（圣托里尼取伊亚城堡日落点旁的村中心，
 *  马特洪峰取利菲尔湖倒影观景点，5 公里内能认出采尔马特、戈尔内格拉特与黑湖；小孩堤防取风车群中段）。
 *  名字正则只收专名，不收会认错普通地方的泛称：不单用「圣母院」「大教堂」「塔」「桥」「城堡」「cathedral」「tower」「bridge」；
 *  同名的别处要排除：日内瓦、雷根斯堡的圣彼得大教堂，波茨坦的勃兰登堡门，阿布扎比卢浮宫，惠州的哈尔施塔特小镇，大不里士、埃里温的蓝色清真寺，
 *  拉斯维加斯凯撒宫的 Colosseum，迪士尼的 Matterhorn 雪橇。 */
import type { Famous } from "../landmark-famous.ts";

export const FAMOUS_EUROPE: Famous[] = [
  // ---- 法国
  { id: "eiffel-tower", name: "埃菲尔铁塔", en: "Eiffel Tower", ja: "エッフェル塔", re: /埃菲尔铁塔|艾菲尔铁塔|艾菲爾鐵塔|巴黎铁塔|eiffel tower|tour eiffel|エッフェル塔/i, lat: 48.8584, lng: 2.2945, r: 0.4, kind: "tower", model: "eu_eiffel" },
  { id: "arc-de-triomphe", name: "凯旋门", en: "Arc de Triomphe", ja: "凱旋門", re: /(?<!平壤|朝鲜|朝鮮|卡鲁塞尔|卡魯塞爾|小|巴塞罗那|巴塞隆納|布加勒斯特|万象|萬象|澳门|澳門)(?:巴黎)?凯旋门|(?<!平壤|小|カルーゼル|澳門|澳门)凱旋門|arc de triomphe(?! du carrousel)/i, lat: 48.8738, lng: 2.295, r: 0.3, kind: "monument", model: "eu_arc_triomphe" },
  { id: "notre-dame-paris", name: "巴黎圣母院", en: "Notre-Dame de Paris", ja: "パリのノートルダム大聖堂", re: /巴黎圣母院|巴黎聖母院|notre[- ]dame de paris|cathédrale notre[- ]dame de paris|notre[- ]dame cathedral,? paris|パリ.{0,2}ノートルダム/i, lat: 48.853, lng: 2.3499, r: 0.3, kind: "church", model: "eu_notre_dame" },
  { id: "louvre", name: "卢浮宫玻璃金字塔", en: "Louvre Pyramid", ja: "ルーヴル美術館", re: /(?<!阿布扎比|阿布達比|朗斯)(?:卢浮宫|盧浮宮|罗浮宫|羅浮宮)|louvre(?! abu dhabi|[- ]lens)|musée du louvre|ルーヴル|ルーブル(?!・アブダビ)/i, lat: 48.861, lng: 2.3358, r: 0.4, kind: "museum", model: "eu_louvre" },
  { id: "mont-saint-michel", name: "圣米歇尔山", en: "Mont-Saint-Michel", ja: "モン・サン＝ミシェル", re: /圣米歇尔山|聖米歇爾山|圣米歇尔修道院|mont[- ]saint[- ]michel|mont[- ]st\.?[- ]michel|モン・?サン[＝=・]?ミシェル/i, lat: 48.636, lng: -1.5115, r: 1.5, kind: "church", model: "eu_mont_st_michel" },
  { id: "versailles", name: "凡尔赛宫", en: "Palace of Versailles", ja: "ヴェルサイユ宮殿", re: /凡尔赛宫|凡爾賽宮|凡尔赛花园|palace of versailles|versailles palace|ch[âa]teau de versailles|gardens of versailles|ヴェルサイユ宮殿|ベルサイユ宮殿/i, lat: 48.8049, lng: 2.1204, r: 1, kind: "castle", model: "eu_versailles" },
  // ---- 英国
  { id: "big-ben", name: "大本钟（伊丽莎白塔）", en: "Big Ben (Elizabeth Tower)", ja: "ビッグ・ベン", re: /大本钟|大笨钟|大本鐘|大笨鐘|伊丽莎白塔|伊莉莎白塔|威斯敏斯特宫|西敏宫|big ben|elizabeth tower|palace of westminster|houses of parliament|ビッグ・?ベン/i, lat: 51.5007, lng: -0.1246, r: 0.3, kind: "tower", model: "eu_big_ben" },
  { id: "tower-bridge", name: "伦敦塔桥", en: "Tower Bridge", ja: "タワーブリッジ", re: /伦敦塔桥|倫敦塔橋|(?<!sacramento )tower bridge|タワー・?ブリッジ/i, lat: 51.5055, lng: -0.0754, r: 0.3, kind: "bridge", model: "eu_tower_bridge" },
  { id: "london-eye", name: "伦敦眼", en: "London Eye", ja: "ロンドン・アイ", re: /伦敦眼|倫敦眼|london eye|millennium wheel|ロンドン・?アイ/i, lat: 51.5033, lng: -0.1196, r: 0.3, kind: "viewpoint", model: "eu_london_eye" },
  { id: "stonehenge", name: "巨石阵", en: "Stonehenge", ja: "ストーンヘンジ", re: /巨石阵|巨石陣|史前巨石柱|stonehenge|ストーンヘンジ/i, lat: 51.1789, lng: -1.8262, r: 1, kind: "ruins", model: "eu_stonehenge" },
  // ---- 意大利
  { id: "colosseum", name: "罗马斗兽场", en: "Colosseum", ja: "コロッセオ", re: /罗马斗兽场|羅馬鬥獸場|罗马竞技场|羅馬競技場|古罗马斗兽场|(?<!caesars )colosseum|colosseo|flavian amphitheat(?:re|er)|コロッセオ/i, lat: 41.8902, lng: 12.4922, r: 0.4, kind: "ruins", model: "eu_colosseum" },
  { id: "leaning-tower-pisa", name: "比萨斜塔", en: "Leaning Tower of Pisa", ja: "ピサの斜塔", re: /比萨斜塔|比薩斜塔|leaning tower of pisa|pisa tower|torre (?:pendente )?di pisa|ピサの斜塔/i, lat: 43.723, lng: 10.3966, r: 0.3, kind: "tower", model: "eu_pisa" },
  { id: "st-peters-basilica", name: "圣彼得大教堂", en: "St. Peter's Basilica", ja: "サン・ピエトロ大聖堂", re: /(?<!日内瓦|日內瓦|雷根斯堡|不来梅|不萊梅|里加|维也纳|維也納)(?:圣彼得大教堂|聖彼得大教堂)|圣伯多禄大殿|聖伯多祿大殿|圣彼得广场|聖彼得廣場|(?:st\.?|saint) peter'?s (?:basilica|square)|basilica di san pietro|piazza san pietro|サン・?ピエトロ大聖堂|サン・?ピエトロ広場/i, lat: 41.9022, lng: 12.4539, r: 0.4, kind: "church", model: "eu_st_peters" },
  { id: "florence-duomo", name: "佛罗伦萨圣母百花大教堂", en: "Florence Cathedral", ja: "フィレンツェ大聖堂", re: /圣母百花|聖母百花|花之圣母|花之聖母|佛罗伦萨大教堂|佛羅倫斯大教堂|佛罗伦萨主教座堂|santa maria del fiore|florence cathedral|duomo di firenze|firenze duomo|florence duomo|フィレンツェ大聖堂|サンタ・?マリア・?デル・?フィオーレ/i, lat: 43.7731, lng: 11.256, r: 0.3, kind: "church", model: "eu_florence_duomo" },
  { id: "rialto-bridge", name: "威尼斯里亚托桥", en: "Rialto Bridge", ja: "リアルト橋", re: /里亚托桥|里亞托橋|里阿尔托桥|雷雅托桥|威尼斯大运河|威尼斯大運河|rialto bridge|ponte di rialto|mercato di rialto|grand canal,? venice|リアルト橋/i, lat: 45.438, lng: 12.3359, r: 0.3, kind: "bridge", model: "eu_rialto" },
  // ---- 西班牙
  { id: "sagrada-familia", name: "圣家堂", en: "Sagrada Família", ja: "サグラダ・ファミリア", re: /圣家堂|聖家堂|圣家族大教堂|聖家族大教堂|神圣家族|sagrada fam[ií]lia|サグラダ・?ファミリア/i, lat: 41.4036, lng: 2.1744, r: 0.3, kind: "church", model: "eu_sagrada" },
  { id: "alhambra", name: "阿尔罕布拉宫", en: "Alhambra", ja: "アルハンブラ宮殿", re: /阿尔罕布拉|阿爾罕布拉|阿兰布拉宫|阿蘭布拉宮|\balhambra\b(?! (?:theat|ca\b|california|high))|アルハンブラ/i, lat: 37.1761, lng: -3.5881, r: 0.6, kind: "castle", model: "eu_alhambra" },
  // ---- 德国
  { id: "neuschwanstein", name: "新天鹅堡", en: "Neuschwanstein Castle", ja: "ノイシュヴァンシュタイン城", re: /新天鹅堡|新天鵝堡|neuschwanstein|ノイシュ[ヴバ]ァ?ンシュタイン/i, lat: 47.5576, lng: 10.7498, r: 0.5, kind: "castle", model: "eu_neuschwanstein" },
  { id: "brandenburg-gate", name: "勃兰登堡门", en: "Brandenburg Gate", ja: "ブランデンブルク門", re: /(?<!波茨坦)(?:勃兰登堡门|勃蘭登堡門|布兰登堡门|布蘭登堡門)|brandenburg gate|brandenburger tor(?!,? potsdam)|ブランデンブルク門/i, lat: 52.5163, lng: 13.3777, r: 0.3, kind: "monument", model: "eu_brandenburg" },
  { id: "cologne-cathedral", name: "科隆大教堂", en: "Cologne Cathedral", ja: "ケルン大聖堂", re: /科隆大教堂|科隆主教座堂|科隆座堂|cologne cathedral|k[öo]lner dom|ケルン大聖堂/i, lat: 50.9413, lng: 6.9583, r: 0.3, kind: "church", model: "eu_cologne" },
  // ---- 希腊
  { id: "parthenon", name: "雅典卫城帕特农神庙", en: "Parthenon, Acropolis of Athens", ja: "パルテノン神殿", re: /帕特农|帕德嫩|巴特农|雅典卫城|雅典衛城|(?<!nashville )parthenon|acropolis of athens|athens acropolis|^(?:the )?acropolis$|パルテノン|παρθενώνας|ακρόπολη αθηνών/i, lat: 37.9715, lng: 23.7267, r: 0.5, kind: "ruins", model: "eu_parthenon" },
  { id: "oia-santorini", name: "圣托里尼伊亚", en: "Oia, Santorini", ja: "サントリーニ島イア", re: /圣托里尼|聖托里尼|伊亚小镇|伊亞小鎮|伊亚村|santorini|oia,? santorini|サントリーニ|σαντορίνη/i, lat: 36.4616, lng: 25.374, r: 1.5, kind: "oldtown", model: "eu_oia" },
  // ---- 俄罗斯
  { id: "st-basils", name: "圣瓦西里大教堂", en: "Saint Basil's Cathedral", ja: "聖ワシリイ大聖堂", re: /圣瓦西里|聖瓦西里|瓦西里升天|莫斯科红场|莫斯科紅場|红场|紅場|(?:st\.?|saint) basil'?s|red square|собор василия блаженного|храм василия блаженного|красная площадь|聖ワシリ[イー]|ワシリー寺院/i, lat: 55.7525, lng: 37.6231, r: 0.3, kind: "church", model: "eu_st_basils" },
  // ---- 捷克
  { id: "charles-bridge", name: "布拉格查理大桥", en: "Charles Bridge", ja: "カレル橋", re: /查理大桥|查理大橋|查理士桥|查理桥|查理橋|charles bridge|karl[uů]v most|カレル橋/i, lat: 50.0865, lng: 14.4114, r: 0.3, kind: "bridge", model: "eu_charles_bridge" },
  // ---- 荷兰
  { id: "kinderdijk", name: "小孩堤防风车", en: "Kinderdijk windmills", ja: "キンデルダイクの風車群", re: /小孩堤防|小孩堤坝|小孩堤壩|金德代克|kinderdijk|キンデルダイク/i, lat: 51.8846, lng: 4.6374, r: 1.5, kind: "oldtown", model: "eu_kinderdijk" },
  // ---- 匈牙利
  { id: "hungarian-parliament", name: "布达佩斯国会大厦", en: "Hungarian Parliament Building", ja: "ハンガリー国会議事堂", re: /布达佩斯国会|布達佩斯國會|匈牙利国会|匈牙利國會|hungarian parliament|budapest parliament|parliament of hungary|országház|ハンガリー国会議事堂/i, lat: 47.5071, lng: 19.0457, r: 0.4, kind: "square", model: "eu_parliament_budapest" },
  // ---- 瑞士
  { id: "matterhorn", name: "马特洪峰", en: "Matterhorn", ja: "マッターホルン", re: /马特洪峰|馬特洪峰|马特洪|matterhorn(?! bobsled)|cervino|mont cervin|マッターホルン/i, lat: 45.9866, lng: 7.7524, r: 5, kind: "mountain", model: "eu_matterhorn" },
  // ---- 土耳其
  { id: "blue-mosque", name: "伊斯坦布尔蓝色清真寺", en: "Blue Mosque (Sultan Ahmed Mosque)", ja: "ブルーモスク", re: /(?<!大不里士|埃里温|埃里溫|马扎里沙里夫|莎阿南)(?:蓝色清真寺|藍色清真寺)|苏丹艾哈迈德清真寺|蘇丹艾哈邁德清真寺|(?<!tabriz |yerevan |shah alam )blue mosque|sultan ?ahmed mosque|sultanahmet camii|ブルーモスク|スルタンアフメト・?モスク/i, lat: 41.0054, lng: 28.9768, r: 0.3, kind: "mosque", model: "eu_blue_mosque" },
  // ---- 另加：米兰、哈尔施塔特
  { id: "milan-cathedral", name: "米兰大教堂", en: "Milan Cathedral", ja: "ミラノ大聖堂", re: /米兰大教堂|米蘭大教堂|米兰主教座堂|milan cathedral|duomo di milano|milan duomo|ミラノ大聖堂|ドゥオーモ・?ディ・?ミラノ/i, lat: 45.4642, lng: 9.1916, r: 0.3, kind: "church", model: "eu_milan_duomo" },
  { id: "hallstatt", name: "哈尔施塔特", en: "Hallstatt", ja: "ハルシュタット", re: /(?<!惠州|五矿|五礦|博罗|博羅)(?:哈尔施塔特|哈爾施塔特|哈施塔特)|(?<!huizhou )\bhallstatt\b|ハルシュタット/i, lat: 47.5622, lng: 13.6493, r: 1, kind: "oldtown", model: "eu_hallstatt" },
  // ---- 补充（D87）
  { id: "buckingham-palace", name: "白金汉宫", en: "Buckingham Palace", ja: "バッキンガム宮殿", re: /白金汉宫|白金漢宮|buckingham palace|バッキンガム宮殿/i, lat: 51.5014, lng: -0.1419, r: 0.3, kind: "castle", model: "eu_buckingham" },
  { id: "belem-tower", name: "贝伦塔", en: "Belém Tower", ja: "ベレンの塔", re: /贝伦塔|貝倫塔|bel[eé]m tower|torre de bel[eé]m|ベレンの塔/i, lat: 38.6916, lng: -9.2159, r: 0.3, kind: "castle", model: "eu_belem" },
  { id: "prague-clock", name: "布拉格天文钟", en: "Prague Astronomical Clock", ja: "プラハの天文時計", re: /布拉格天文钟|布拉格天文鐘|天文钟|天文鐘|astronomical clock|orloj|天文時計/i, lat: 50.087, lng: 14.4208, r: 0.2, kind: "square", model: "eu_prague_clock" },
  { id: "cinque-terre", name: "五渔村", en: "Cinque Terre", ja: "チンクエテッレ", re: /五渔村|五漁村|cinque terre|チンクエ・?テッレ/i, lat: 44.1272, lng: 9.7106, r: 3, kind: "oldtown", model: "eu_cinque_terre" },
  { id: "atomium", name: "原子塔", en: "Atomium", ja: "アトミウム", re: /原子塔|原子球塔|atomium|アトミウム/i, lat: 50.8949, lng: 4.3415, r: 0.3, kind: "monument", model: "eu_atomium" },
].map((f) => ({ ...f, region: "europe" as const }));
