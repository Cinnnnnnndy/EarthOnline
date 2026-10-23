/** 目的地的特色物件（第八轮末，行李箱 D75 / D78 / D80）：按国家一组，每样有 id（对应 shared/world/souvenir-models.ts 里的模型）和三种语言的名字。
 *  目的地写了同一个国家的两段（「日本、关西」「京都 · 大阪」）就依次拿这个国家的第二样、第三样，拿完了给一袋零食。
 *  键是中文国名；英文、日文的国名与常见的城市名通过 ALIAS 对回来。 */
import type { Locale } from "../i18n/index.ts";

export interface Souvenir { id: string; zh: string; en: string; ja: string }
const S = (id: string, zh: string, en: string, ja: string): Souvenir => ({ id, zh, en, ja });

export const SOUVENIRS: Record<string, Souvenir[]> = {
  日本: [S("daruma", "达摩", "Daruma", "だるま"), S("manekineko", "招财猫", "Maneki-neko", "招き猫"), S("matchaTin", "抹茶罐", "Matcha tin", "抹茶缶"), S("omamori", "御守", "Omamori charm", "お守り")],
  冰岛: [S("puffin", "海鹦玩偶", "Puffin plush", "パフィンのぬいぐるみ"), S("lopapeysa", "冰岛毛衣", "Lopapeysa sweater", "ロパペイサ"), S("licorice", "甘草糖", "Licorice", "リコリス"), S("lavaSalt", "火山岩盐", "Lava salt", "溶岩塩")],
  丹麦: [S("butterCookies", "黄油曲奇", "Butter cookies", "バタークッキー"), S("bricks", "彩色积木", "Toy bricks", "ブロック")],
  挪威: [S("brunost", "棕奶酪", "Brunost", "ブルノスト"), S("troll", "山妖玩偶", "Troll figure", "トロール")],
  瑞典: [S("dalaHorse", "达拉木马", "Dala horse", "ダーラナホース"), S("cinnamonBun", "肉桂卷", "Cinnamon bun", "シナモンロール")],
  芬兰: [S("salmiakki", "咸甘草", "Salmiakki", "サルミアッキ")],
  法国: [S("macarons", "马卡龙", "Macarons", "マカロン"), S("beret", "贝雷帽", "Beret", "ベレー帽"), S("croissant", "可颂", "Croissant", "クロワッサン")],
  意大利: [S("pasta", "意面", "Pasta", "パスタ"), S("gelato", "冰淇淋", "Gelato", "ジェラート"), S("venetianMask", "威尼斯面具", "Venetian mask", "ヴェネツィアの仮面")],
  西班牙: [S("jamon", "火腿", "Jamón", "ハモン"), S("handFan", "折扇", "Hand fan", "扇子"), S("oliveOil", "橄榄油", "Olive oil", "オリーブオイル")],
  英国: [S("teaTin", "红茶", "Tea", "紅茶"), S("toyBus", "小巴士", "Toy bus", "2階建てバス"), S("phoneBox", "红色电话亭", "Red phone box", "赤い電話ボックス")],
  德国: [S("gingerbread", "姜饼心", "Gingerbread heart", "レープクーヘン"), S("nutcracker", "胡桃夹子", "Nutcracker", "くるみ割り人形"), S("cuckooClock", "布谷鸟钟", "Cuckoo clock", "鳩時計")],
  瑞士: [S("chocolate", "巧克力", "Chocolate", "チョコレート"), S("cowbell", "牛铃", "Cowbell", "カウベル"), S("swissKnife", "军刀", "Swiss army knife", "アーミーナイフ")],
  荷兰: [S("clogs", "木鞋", "Clogs", "木靴"), S("tulips", "郁金香", "Tulips", "チューリップ"), S("cheeseWheel", "奶酪轮", "Cheese wheel", "チーズホイール")],
  奥地利: [S("mozartkugeln", "莫扎特球", "Mozartkugeln", "モーツァルトクーゲル"), S("sacherTorte", "萨赫蛋糕", "Sachertorte", "ザッハトルテ")],
  葡萄牙: [S("rooster", "巴塞罗斯公鸡", "Barcelos rooster", "バルセロスの雄鶏"), S("pastelDeNata", "蛋挞", "Pastéis de nata", "エッグタルト")],
  希腊: [S("blueDome", "蓝顶小屋", "Blue-domed house", "青い屋根の家"), S("olives", "橄榄罐", "Olives", "オリーブの瓶")],
  捷克: [S("beerStein", "啤酒杯", "Beer stein", "ビアジョッキ"), S("crystalGlass", "水晶杯", "Bohemian crystal", "ボヘミアグラス")],
  爱尔兰: [S("shamrock", "三叶草", "Shamrock", "シャムロック")],
  比利时: [S("waffle", "华夫饼", "Waffle", "ワッフル")],
  俄罗斯: [S("matryoshka", "套娃", "Matryoshka", "マトリョーシカ"), S("ushanka", "乌沙帽", "Ushanka hat", "ウシャンカ")],
  韩国: [S("seaweed", "海苔", "Seaweed", "海苔"), S("hahoeMask", "河回面具", "Hahoe mask", "河回仮面"), S("gochujang", "辣椒酱", "Gochujang", "コチュジャン")],
  泰国: [S("elephant", "木雕小象", "Wooden elephant", "木彫りの象"), S("thaiTea", "泰式奶茶", "Thai tea mix", "タイティー")],
  越南: [S("conicalHat", "斗笠", "Conical hat", "ノンラー"), S("phin", "滴滤咖啡壶", "Phin coffee filter", "フィン")],
  新加坡: [S("kaya", "咖椰酱", "Kaya", "カヤジャム"), S("merlionFigure", "鱼尾狮摆件", "Merlion figurine", "マーライオンの置物")],
  马来西亚: [S("whiteCoffee", "白咖啡", "White coffee", "ホワイトコーヒー")],
  印度尼西亚: [S("krupuk", "虾片", "Krupuk", "クルプック")],
  菲律宾: [S("driedMango", "芒果干", "Dried mango", "ドライマンゴー")],
  柬埔寨: [S("palmSugar", "棕榈糖", "Palm sugar", "パームシュガー")],
  印度: [S("spiceJars", "香料罐", "Spice jars", "スパイスの瓶"), S("paintedElephant", "彩绘小象", "Painted elephant", "彩色の象")],
  蒙古: [S("feltSheep", "毛毡小羊", "Felt sheep", "フェルトの羊")],
  中国: [S("teaCaddy", "茶叶", "Tea", "お茶"), S("panda", "熊猫玩偶", "Panda plush", "パンダのぬいぐるみ"), S("vase", "青花瓷瓶", "Blue-and-white vase", "青花の花瓶"), S("mooncake", "月饼", "Mooncake", "月餅")],
  台湾: [S("pineappleCake", "凤梨酥", "Pineapple cake", "パイナップルケーキ")],
  香港: [S("eggRolls", "蛋卷", "Egg rolls", "エッグロール")],
  澳大利亚: [S("koala", "考拉玩偶", "Koala plush", "コアラのぬいぐるみ"), S("timtam", "Tim Tam", "Tim Tam", "ティムタム"), S("boomerang", "回旋镖", "Boomerang", "ブーメラン")],
  新西兰: [S("manuka", "麦卢卡蜂蜜", "Manuka honey", "マヌカハニー"), S("kiwiBird", "几维鸟玩偶", "Kiwi bird plush", "キーウィのぬいぐるみ"), S("pounamu", "绿玉吊坠", "Pounamu pendant", "ポウナム")],
  美国: [S("peanutButter", "花生酱", "Peanut butter", "ピーナッツバター"), S("baseballCap", "棒球帽", "Baseball cap", "野球帽"), S("libertyFigure", "自由女神摆件", "Liberty figurine", "自由の女神の置物"), S("seaOtterPlush", "海獭玩偶", "Sea otter plush", "ラッコのぬいぐるみ")],
  加拿大: [S("mapleSyrup", "枫糖浆", "Maple syrup", "メープルシロップ"), S("moose", "驼鹿玩偶", "Moose plush", "ヘラジカのぬいぐるみ"), S("sealPlush", "海豹玩偶", "Seal plush", "アザラシのぬいぐるみ")],
  墨西哥: [S("sombrero", "草帽", "Sombrero", "ソンブレロ"), S("sugarSkull", "糖骷髅", "Sugar skull", "シュガースカル")],
  巴西: [S("flipFlops", "人字拖", "Flip-flops", "ビーチサンダル"), S("football", "足球", "Football", "サッカーボール"), S("capybaraPlush", "水豚玩偶", "Capybara plush", "カピバラのぬいぐるみ")],
  阿根廷: [S("mateGourd", "马黛茶杯", "Mate gourd", "マテ茶のカップ")],
  秘鲁: [S("alpaca", "羊驼玩偶", "Alpaca plush", "アルパカのぬいぐるみ"), S("chullo", "安第斯毛帽", "Chullo hat", "チュージョ")],
  古巴: [S("cigarBox", "雪茄盒", "Cigar box", "葉巻の箱")],
  埃及: [S("dates", "椰枣", "Dates", "デーツ"), S("bastet", "猫神像", "Bastet statue", "バステト像")],
  摩洛哥: [S("tagine", "塔吉锅", "Tagine", "タジン鍋"), S("mintTeapot", "薄荷茶壶", "Mint tea pot", "ミントティーポット")],
  肯尼亚: [S("giraffe", "木雕长颈鹿", "Wooden giraffe", "木彫りのキリン")],
  南非: [S("rooibos", "路易波士茶", "Rooibos tea", "ルイボスティー")],
  土耳其: [S("lokum", "土耳其软糖", "Lokum", "ロクム"), S("evilEye", "蓝眼睛", "Evil eye charm", "ナザールボンジュウ"), S("cezve", "土耳其咖啡壶", "Cezve", "ジェズヴェ")],
  阿联酋: [S("camel", "骆驼玩偶", "Camel plush", "ラクダのぬいぐるみ")],
  以色列: [S("deadSeaMud", "死海泥", "Dead Sea mud", "死海の泥")],
  // ---- D82 续加：中欧、巴尔干、北非、东非、中亚、南亚、南美、加勒比、中东
  匈牙利: [S("paprika", "红椒粉", "Paprika", "パプリカ")],
  波兰: [S("polishPottery", "波兰陶杯", "Polish pottery mug", "ポーリッシュポタリー")],
  克罗地亚: [S("lavenderSachet", "薰衣草香包", "Lavender sachet", "ラベンダーのサシェ")],
  保加利亚: [S("roseOil", "玫瑰精油", "Rose oil", "ローズオイル")],
  突尼斯: [S("ceramicPlate", "陶盘", "Ceramic plate", "陶器の皿")],
  埃塞俄比亚: [S("jebena", "咖啡壶", "Jebena coffee pot", "ジェベナ")],
  坦桑尼亚: [S("maasaiBeads", "马赛珠串", "Maasai beads", "マサイのビーズ")],
  乌兹别克斯坦: [S("ceramicBowl", "青花茶碗", "Ceramic tea bowl", "陶器の茶碗")],
  尼泊尔: [S("prayerFlags", "经幡", "Prayer flags", "タルチョ")],
  缅甸: [S("lacquerBox", "漆器盒", "Lacquer box", "漆器の箱")],
  斯里兰卡: [S("ceylonTea", "锡兰红茶", "Ceylon tea", "セイロンティー")],
  智利: [S("wine", "红酒", "Red wine", "赤ワイン")],
  哥伦比亚: [S("coffeeBeans", "咖啡豆", "Coffee beans", "コーヒー豆")],
  哥斯达黎加: [S("sloth", "树懒玩偶", "Sloth plush", "ナマケモノのぬいぐるみ")],
  牙买加: [S("rum", "朗姆酒", "Rum", "ラム酒")],
  伊朗: [S("saffron", "藏红花", "Saffron", "サフラン")],
  约旦: [S("sandBottle", "沙画瓶", "Sand bottle", "サンドボトル")],
};

/** 国名 / 城市名 → 表里的键。小写的英文、日文、中文城市都认 */
const ALIAS: Record<string, string> = {
  japan: "日本", 日本国: "日本", 東京: "日本", 东京: "日本", 京都: "日本", 大阪: "日本", 关西: "日本", 関西: "日本", 北海道: "日本", 冲绳: "日本", 沖縄: "日本", 奈良: "日本", 福冈: "日本", 名古屋: "日本", 札幌: "日本", tokyo: "日本", kyoto: "日本", osaka: "日本", kansai: "日本", hokkaido: "日本", okinawa: "日本",
  iceland: "冰岛", アイスランド: "冰岛", 雷克雅未克: "冰岛", reykjavik: "冰岛", reykjavík: "冰岛",
  denmark: "丹麦", デンマーク: "丹麦", 哥本哈根: "丹麦", copenhagen: "丹麦",
  norway: "挪威", ノルウェー: "挪威", 奥斯陆: "挪威", 卑尔根: "挪威", 特罗姆瑟: "挪威", 罗弗敦: "挪威", oslo: "挪威", bergen: "挪威", tromsø: "挪威", tromso: "挪威", lofoten: "挪威",
  sweden: "瑞典", スウェーデン: "瑞典", 斯德哥尔摩: "瑞典", stockholm: "瑞典",
  finland: "芬兰", フィンランド: "芬兰", 赫尔辛基: "芬兰", 罗瓦涅米: "芬兰", helsinki: "芬兰", rovaniemi: "芬兰",
  france: "法国", フランス: "法国", 巴黎: "法国", paris: "法国",
  italy: "意大利", イタリア: "意大利", 罗马: "意大利", 威尼斯: "意大利", 米兰: "意大利", 佛罗伦萨: "意大利", rome: "意大利", venice: "意大利", milan: "意大利", florence: "意大利",
  spain: "西班牙", スペイン: "西班牙", 巴塞罗那: "西班牙", 马德里: "西班牙", barcelona: "西班牙", madrid: "西班牙",
  uk: "英国", "united kingdom": "英国", britain: "英国", england: "英国", scotland: "英国", イギリス: "英国", 英格兰: "英国", 苏格兰: "英国", 伦敦: "英国", london: "英国", edinburgh: "英国", 爱丁堡: "英国",
  germany: "德国", ドイツ: "德国", 柏林: "德国", 慕尼黑: "德国", berlin: "德国", munich: "德国",
  switzerland: "瑞士", スイス: "瑞士", 苏黎世: "瑞士", zurich: "瑞士",
  netherlands: "荷兰", holland: "荷兰", オランダ: "荷兰", 阿姆斯特丹: "荷兰", amsterdam: "荷兰",
  austria: "奥地利", オーストリア: "奥地利", 维也纳: "奥地利", 萨尔茨堡: "奥地利", vienna: "奥地利", salzburg: "奥地利",
  portugal: "葡萄牙", ポルトガル: "葡萄牙", 里斯本: "葡萄牙", 波尔图: "葡萄牙", lisbon: "葡萄牙", porto: "葡萄牙",
  greece: "希腊", ギリシャ: "希腊", 雅典: "希腊", 圣托里尼: "希腊", athens: "希腊", santorini: "希腊",
  czechia: "捷克", "czech republic": "捷克", czech: "捷克", チェコ: "捷克", 布拉格: "捷克", prague: "捷克",
  ireland: "爱尔兰", アイルランド: "爱尔兰", 都柏林: "爱尔兰", dublin: "爱尔兰",
  belgium: "比利时", ベルギー: "比利时", 布鲁塞尔: "比利时", brussels: "比利时",
  russia: "俄罗斯", ロシア: "俄罗斯", 莫斯科: "俄罗斯", moscow: "俄罗斯",
  korea: "韩国", "south korea": "韩国", 韓国: "韩国", 首尔: "韩国", 釜山: "韩国", seoul: "韩国", busan: "韩国",
  thailand: "泰国", タイ: "泰国", 曼谷: "泰国", 清迈: "泰国", 普吉: "泰国", 普吉岛: "泰国", bangkok: "泰国", "chiang mai": "泰国", phuket: "泰国",
  vietnam: "越南", ベトナム: "越南", 河内: "越南", 胡志明: "越南", 岘港: "越南", hanoi: "越南", "ho chi minh": "越南", "da nang": "越南",
  singapore: "新加坡", シンガポール: "新加坡",
  malaysia: "马来西亚", マレーシア: "马来西亚", 吉隆坡: "马来西亚", "kuala lumpur": "马来西亚",
  indonesia: "印度尼西亚", インドネシア: "印度尼西亚", 印尼: "印度尼西亚", 巴厘岛: "印度尼西亚", 巴厘: "印度尼西亚", bali: "印度尼西亚",
  philippines: "菲律宾", フィリピン: "菲律宾", 马尼拉: "菲律宾", 宿务: "菲律宾", manila: "菲律宾", cebu: "菲律宾",
  cambodia: "柬埔寨", カンボジア: "柬埔寨", 暹粒: "柬埔寨", 吴哥: "柬埔寨", "siem reap": "柬埔寨", angkor: "柬埔寨",
  india: "印度", インド: "印度", 德里: "印度", 新德里: "印度", 孟买: "印度", delhi: "印度", mumbai: "印度",
  mongolia: "蒙古", モンゴル: "蒙古", 乌兰巴托: "蒙古", ulaanbaatar: "蒙古",
  china: "中国", 中国大陆: "中国", 北京: "中国", 上海: "中国", 成都: "中国", 西安: "中国", 杭州: "中国", beijing: "中国", shanghai: "中国", chengdu: "中国",
  taiwan: "台湾", 台北: "台湾", taipei: "台湾",
  "hong kong": "香港", hongkong: "香港",
  australia: "澳大利亚", オーストラリア: "澳大利亚", 悉尼: "澳大利亚", 墨尔本: "澳大利亚", sydney: "澳大利亚", melbourne: "澳大利亚",
  "new zealand": "新西兰", ニュージーランド: "新西兰", 奥克兰: "新西兰", 皇后镇: "新西兰", auckland: "新西兰", queenstown: "新西兰",
  usa: "美国", "united states": "美国", america: "美国", アメリカ: "美国", 纽约: "美国", 洛杉矶: "美国", 旧金山: "美国", 夏威夷: "美国", 檀香山: "美国", "new york": "美国", "los angeles": "美国", "san francisco": "美国", hawaii: "美国",
  canada: "加拿大", カナダ: "加拿大", 温哥华: "加拿大", 多伦多: "加拿大", vancouver: "加拿大", toronto: "加拿大",
  mexico: "墨西哥", メキシコ: "墨西哥", 墨西哥城: "墨西哥", 坎昆: "墨西哥", cancun: "墨西哥",
  brazil: "巴西", ブラジル: "巴西", 里约: "巴西", 里约热内卢: "巴西", rio: "巴西", "rio de janeiro": "巴西",
  argentina: "阿根廷", アルゼンチン: "阿根廷", 布宜诺斯艾利斯: "阿根廷", "buenos aires": "阿根廷",
  peru: "秘鲁", ペルー: "秘鲁", 利马: "秘鲁", 库斯科: "秘鲁", lima: "秘鲁", cusco: "秘鲁",
  cuba: "古巴", キューバ: "古巴", 哈瓦那: "古巴", havana: "古巴",
  egypt: "埃及", エジプト: "埃及", 开罗: "埃及", cairo: "埃及",
  morocco: "摩洛哥", モロッコ: "摩洛哥", 马拉喀什: "摩洛哥", marrakech: "摩洛哥",
  kenya: "肯尼亚", ケニア: "肯尼亚", 内罗毕: "肯尼亚", nairobi: "肯尼亚",
  "south africa": "南非", 南アフリカ: "南非", 开普敦: "南非", "cape town": "南非",
  turkey: "土耳其", türkiye: "土耳其", トルコ: "土耳其", 伊斯坦布尔: "土耳其", istanbul: "土耳其",
  uae: "阿联酋", "united arab emirates": "阿联酋", アラブ首長国連邦: "阿联酋", 迪拜: "阿联酋", 阿布扎比: "阿联酋", dubai: "阿联酋", "abu dhabi": "阿联酋",
  israel: "以色列", イスラエル: "以色列", 特拉维夫: "以色列", 耶路撒冷: "以色列", "tel aviv": "以色列", jerusalem: "以色列",
  hungary: "匈牙利", ハンガリー: "匈牙利", 布达佩斯: "匈牙利", budapest: "匈牙利",
  poland: "波兰", ポーランド: "波兰", 华沙: "波兰", 克拉科夫: "波兰", warsaw: "波兰", krakow: "波兰", kraków: "波兰",
  croatia: "克罗地亚", クロアチア: "克罗地亚", 杜布罗夫尼克: "克罗地亚", dubrovnik: "克罗地亚",
  bulgaria: "保加利亚", ブルガリア: "保加利亚", 索菲亚: "保加利亚", sofia: "保加利亚",
  tunisia: "突尼斯", チュニジア: "突尼斯",
  ethiopia: "埃塞俄比亚", エチオピア: "埃塞俄比亚", 亚的斯亚贝巴: "埃塞俄比亚", "addis ababa": "埃塞俄比亚",
  tanzania: "坦桑尼亚", タンザニア: "坦桑尼亚", 桑给巴尔: "坦桑尼亚", zanzibar: "坦桑尼亚",
  uzbekistan: "乌兹别克斯坦", ウズベキスタン: "乌兹别克斯坦", 撒马尔罕: "乌兹别克斯坦", samarkand: "乌兹别克斯坦",
  nepal: "尼泊尔", ネパール: "尼泊尔", 加德满都: "尼泊尔", kathmandu: "尼泊尔",
  myanmar: "缅甸", burma: "缅甸", ミャンマー: "缅甸", 仰光: "缅甸", yangon: "缅甸",
  "sri lanka": "斯里兰卡", スリランカ: "斯里兰卡", 科伦坡: "斯里兰卡", colombo: "斯里兰卡",
  chile: "智利", チリ: "智利", 圣地亚哥: "智利", santiago: "智利",
  colombia: "哥伦比亚", コロンビア: "哥伦比亚", 波哥大: "哥伦比亚", bogota: "哥伦比亚", bogotá: "哥伦比亚",
  "costa rica": "哥斯达黎加", コスタリカ: "哥斯达黎加",
  jamaica: "牙买加", ジャマイカ: "牙买加",
  iran: "伊朗", イラン: "伊朗", 德黑兰: "伊朗", tehran: "伊朗",
  jordan: "约旦", ヨルダン: "约旦", 安曼: "约旦", 佩特拉: "约旦", amman: "约旦", petra: "约旦",
};

/** 国名的英文与日文（D84，清单的分组标题用；键是表里的中文国名） */
export const COUNTRY_NAMES: Record<string, [en: string, ja: string]> = {
  日本: ["Japan", "日本"], 冰岛: ["Iceland", "アイスランド"], 丹麦: ["Denmark", "デンマーク"], 挪威: ["Norway", "ノルウェー"], 瑞典: ["Sweden", "スウェーデン"], 芬兰: ["Finland", "フィンランド"],
  法国: ["France", "フランス"], 意大利: ["Italy", "イタリア"], 西班牙: ["Spain", "スペイン"], 英国: ["UK", "イギリス"], 德国: ["Germany", "ドイツ"], 瑞士: ["Switzerland", "スイス"], 荷兰: ["Netherlands", "オランダ"],
  奥地利: ["Austria", "オーストリア"], 葡萄牙: ["Portugal", "ポルトガル"], 希腊: ["Greece", "ギリシャ"], 捷克: ["Czechia", "チェコ"], 爱尔兰: ["Ireland", "アイルランド"], 比利时: ["Belgium", "ベルギー"], 俄罗斯: ["Russia", "ロシア"],
  韩国: ["Korea", "韓国"], 泰国: ["Thailand", "タイ"], 越南: ["Vietnam", "ベトナム"], 新加坡: ["Singapore", "シンガポール"], 马来西亚: ["Malaysia", "マレーシア"], 印度尼西亚: ["Indonesia", "インドネシア"], 菲律宾: ["Philippines", "フィリピン"],
  柬埔寨: ["Cambodia", "カンボジア"], 印度: ["India", "インド"], 蒙古: ["Mongolia", "モンゴル"], 中国: ["China", "中国"], 台湾: ["Taiwan", "台湾"], 香港: ["Hong Kong", "香港"], 澳大利亚: ["Australia", "オーストラリア"], 新西兰: ["New Zealand", "ニュージーランド"],
  美国: ["United States", "アメリカ"], 加拿大: ["Canada", "カナダ"], 墨西哥: ["Mexico", "メキシコ"], 巴西: ["Brazil", "ブラジル"], 阿根廷: ["Argentina", "アルゼンチン"], 秘鲁: ["Peru", "ペルー"], 古巴: ["Cuba", "キューバ"],
  埃及: ["Egypt", "エジプト"], 摩洛哥: ["Morocco", "モロッコ"], 肯尼亚: ["Kenya", "ケニア"], 南非: ["South Africa", "南アフリカ"], 土耳其: ["Türkiye", "トルコ"], 阿联酋: ["UAE", "アラブ首長国連邦"], 以色列: ["Israel", "イスラエル"],
  匈牙利: ["Hungary", "ハンガリー"], 波兰: ["Poland", "ポーランド"], 克罗地亚: ["Croatia", "クロアチア"], 保加利亚: ["Bulgaria", "ブルガリア"], 突尼斯: ["Tunisia", "チュニジア"], 埃塞俄比亚: ["Ethiopia", "エチオピア"], 坦桑尼亚: ["Tanzania", "タンザニア"],
  乌兹别克斯坦: ["Uzbekistan", "ウズベキスタン"], 尼泊尔: ["Nepal", "ネパール"], 缅甸: ["Myanmar", "ミャンマー"], 斯里兰卡: ["Sri Lanka", "スリランカ"], 智利: ["Chile", "チリ"], 哥伦比亚: ["Colombia", "コロンビア"], 哥斯达黎加: ["Costa Rica", "コスタリカ"],
  牙买加: ["Jamaica", "ジャマイカ"], 伊朗: ["Iran", "イラン"], 约旦: ["Jordan", "ヨルダン"],
};
/** 表里的键 → 界面语言的国名（表里没有的原样给中文） */
export function countryLabel(key: string, locale: Locale): string {
  const n = COUNTRY_NAMES[key]; return !n || locale === "zh-Hans" ? key : locale === "ja" ? n[1] : n[0];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** 从一句话里认出国家（D84，清单的搜索框：「国庆去韩国玩7天」→ 韩国）：国名、城市名的中英日都认，拉丁字母按整词，按出现的先后排，
 *  同一处被更长的名字盖住的不算（「印度尼西亚」里的「印度」不算） */
export function countriesIn(text: string): string[] {
  const low = text.toLowerCase(); const hits: { i: number; len: number; key: string }[] = [];
  const consider = (word: string, key: string) => {
    if (!word) return;
    if (/^[a-z]/.test(word)) { const m = new RegExp(`(^|[^a-z])${escapeRe(word)}(?=$|[^a-z])`).exec(low); if (m) hits.push({ i: m.index + m[1].length, len: word.length, key }); }
    else { const i = low.indexOf(word); if (i >= 0) hits.push({ i, len: word.length, key }); }
  };
  for (const key of Object.keys(SOUVENIRS)) consider(key, key);
  for (const [alias, key] of Object.entries(ALIAS)) consider(alias, key);
  hits.sort((a, b) => b.len - a.len);
  const kept: typeof hits = [];
  for (const h of hits) if (!kept.some((k) => k.key !== h.key && h.i >= k.i && h.i + h.len <= k.i + k.len)) kept.push(h);
  kept.sort((a, b) => a.i - b.i); return [...new Set(kept.map((h) => h.key))];
}

/** 从目的地的一段名字（「日本」「Japan」「京都」）对回表里的键（中文国名）；对不上返回 null */
export function souvenirKey(place: string): string | null {
  const p = place.trim(); return SOUVENIRS[p] ? p : ALIAS[p.toLowerCase()] ?? ALIAS[p] ?? null;
}
/** 一个国家的那几样 */
export const souvenirItems = (country: string): Souvenir[] => SOUVENIRS[country] ?? [];
/** 全部物件（给实验台排成一格一格看） */
export const ALL_SOUVENIRS: { country: string; item: Souvenir }[] = Object.entries(SOUVENIRS).flatMap(([country, items]) => items.map((item) => ({ country, item })));
const byId = new Map(ALL_SOUVENIRS.map((x) => [x.item.id, x.item]));
export function souvenirName(id: string | null, locale: Locale): string | null {
  const s = id ? byId.get(id) : undefined; if (!s) return null;
  return locale === "en" ? s.en : locale === "ja" ? s.ja : s.zh;
}
/** 从目的地的一段名字找这个国家的第一样；找不到返回 null */
export function souvenirOf(place: string, locale: Locale): string | null {
  const key = souvenirKey(place); return key ? souvenirName(souvenirItems(key)[0]?.id ?? null, locale) : null;
}
