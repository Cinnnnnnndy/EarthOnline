import Foundation

/// 截图 / 调试用的示例旅程（启动参数 `-screenshotState traveling|planning|empty`）。只放在内存里，不写盘。
/// 覆盖几种不同的旅行：自驾环岛、城市慢游（铁路）、海岛（船）、徒步、亲子乐园、一日出差。
enum SampleTrips {
    enum Scenario: String { case traveling, planning, empty }

    static func make(_ scenario: Scenario, today: String = DayMath.today(), lang: AppLanguage = .current) -> [Trip] {
        switch scenario {
        case .empty: return []
        case .traveling:
            return [iceland(start: DayMath.add(today, days: -2), lang), kyoto(start: DayMath.add(today, days: 45), lang)]
        case .planning:
            return [bali(start: DayMath.add(today, days: 2), lang), lofoten(start: DayMath.add(today, days: 40), lang),
                    themePark(start: DayMath.add(today, days: 75), lang), business(start: DayMath.add(today, days: 20), lang)]
        }
    }

    // MARK: - 小工具

    private static func t(_ zh: String, _ en: String, _ ja: String, _ lang: AppLanguage) -> String {
        switch lang {
        case .zhHans: return zh
        case .en: return en
        case .ja: return ja
        }
    }

    private static func p(_ id: String, _ name: String, _ cat: PlaceCategory, _ lat: Double, _ lng: Double,
                          at time: String? = nil, visited: Bool = false, notes: String? = nil, kind: String? = nil) -> Entry {
        .place(PlaceEntry(id: id, name: name, category: cat, plannedStart: time, stayMinutes: nil, notes: notes,
                          visited: visited ? true : nil, visitedAt: nil, geo: GeoPoint(lat: lat, lng: lng), kind: kind))
    }

    private static func m(_ id: String, _ mode: TransportMode, _ label: String, _ min: Int, km: Double? = nil) -> Entry {
        .transport(TransportEntry(id: id, mode: mode, label: label, durationMinutes: min, distanceKm: km, polyline: nil))
    }

    private static func trip(_ id: String, _ title: String, _ dest: String, start: String, theme: String, seed: Int, days: [Day]) -> Trip {
        let now = ISO8601.now()
        return Trip(schemaVersion: Spec.schemaVersion, id: id, title: title, destination: dest, startDate: start,
                    endDate: DayMath.add(start, days: max(0, days.count - 1)), theme: theme, seed: seed, status: .planning,
                    plan: nil, days: days, createdAt: now, updatedAt: now)
    }

    private static func day(_ i: Int, _ start: String, _ title: String, _ entries: [Entry], lodging: String? = nil) -> Day {
        Day(index: i, date: DayMath.add(start, days: i - 1), title: title, city: Spec.geoPlate, entries: entries, lodging: lodging)
    }

    // MARK: - 自驾：冰岛环岛（旅行中，今天是 D3）

    static func iceland(start: String, _ l: AppLanguage) -> Trip {
        let car = t("自驾", "Drive", "ドライブ", l)
        return trip("sample-iceland", t("冰岛环岛", "Iceland Ring Road", "アイスランド一周", l), t("冰岛", "Iceland", "アイスランド", l),
                    start: start, theme: "极光冰原", seed: 20_261_001, days: [
            day(1, start, t("抵达雷克雅未克", "Arrive in Reykjavík", "レイキャビク到着", l), [
                p("d1-e0", t("凯夫拉维克机场", "Keflavík Airport", "ケプラヴィーク空港", l), .airport, 63.985, -22.6056, at: "13:30", visited: true),
                m("d1-e1", .car, car, 45, km: 50),
                p("d1-e2", t("哈尔格林姆教堂", "Hallgrímskirkja", "ハットルグリムス教会", l), .sight, 64.1417, -21.9266, at: "15:30", visited: true),
                p("d1-e3", t("雷克雅未克住处", "Reykjavík stay", "レイキャビクの宿", l), .hotel, 64.1466, -21.9426),
            ], lodging: t("雷克雅未克", "Reykjavík", "レイキャビク", l)),
            day(2, start, t("黄金圈", "Golden Circle", "ゴールデンサークル", l), [
                p("d2-e0", t("辛格维利尔国家公园", "Þingvellir National Park", "シンクヴェトリル国立公園", l), .sight, 64.2559, -21.1299, at: "09:30", visited: true, kind: "forest"),
                m("d2-e1", .car, car, 55, km: 60),
                p("d2-e2", t("盖歇尔间歇泉", "Geysir", "ゲイシール", l), .sight, 64.3104, -20.3024, at: "11:30", visited: true),
                m("d2-e3", .car, car, 12, km: 10),
                p("d2-e4", t("古佛斯瀑布", "Gullfoss", "グトルフォスの滝", l), .sight, 64.3271, -20.1199, at: "13:00", visited: true),
            ], lodging: t("塞尔福斯", "Selfoss", "セルフォス", l)),
            day(3, start, t("南岸瀑布与黑沙滩", "South Coast falls and black sand", "南海岸の滝と黒砂海岸", l), [
                p("d3-e0", t("塞里雅兰瀑布", "Seljalandsfoss", "セリャラントスフォス", l), .sight, 63.6156, -19.9886, at: "09:00"),
                m("d3-e1", .car, car, 30, km: 30),
                p("d3-e2", t("斯科加瀑布", "Skógafoss", "スコゥガフォス", l), .sight, 63.5321, -19.5114, at: "11:00"),
                m("d3-e3", .car, car, 35, km: 35),
                p("d3-e4", t("黑沙滩", "Reynisfjara Beach", "レイニスフィヤラ海岸", l), .sight, 63.4044, -19.0449, at: "14:30", kind: "beach"),
                m("d3-e5", .car, car, 12, km: 10),
                p("d3-e6", t("维克教堂", "Vík Church", "ヴィーク教会", l), .sight, 63.4186, -19.006, at: "17:00"),
            ], lodging: t("维克", "Vík", "ヴィーク", l)),
            day(4, start, t("冰河湖", "Glacier Lagoon", "氷河湖", l), [
                m("d4-e0", .car, car, 150, km: 190),
                p("d4-e1", t("杰古沙龙冰河湖", "Jökulsárlón", "ヨークルサルロン", l), .sight, 64.0784, -16.2306, at: "12:00", kind: "glacier"),
                m("d4-e2", .walk, t("步行", "Walk", "徒歩", l), 15, km: 1),
                p("d4-e3", t("钻石沙滩", "Diamond Beach", "ダイヤモンドビーチ", l), .sight, 64.0443, -16.1778, at: "14:00"),
            ], lodging: t("霍芬", "Höfn", "ヘプン", l)),
            day(5, start, t("回程泡蓝湖", "Blue Lagoon on the way back", "帰りにブルーラグーン", l), [
                m("d5-e0", .car, car, 300, km: 420),
                p("d5-e1", t("蓝湖温泉", "Blue Lagoon", "ブルーラグーン", l), .sight, 63.8804, -22.4495, at: "16:00"),
            ], lodging: t("雷克雅未克", "Reykjavík", "レイキャビク", l)),
            day(6, start, t("返程", "Fly home", "帰国", l), [
                p("d6-e0", t("凯夫拉维克机场", "Keflavík Airport", "ケプラヴィーク空港", l), .airport, 63.985, -22.6056, at: "10:00"),
            ]),
        ])
    }

    // MARK: - 城市慢游：京都（铁路）

    static func kyoto(start: String, _ l: AppLanguage) -> Trip {
        trip("sample-kyoto", t("京都红叶", "Kyoto in autumn", "紅葉の京都", l), t("日本、京都", "Kyoto, Japan", "日本、京都", l),
             start: start, theme: "红叶古都", seed: 20_261_115, days: [
            day(1, start, t("抵达京都", "Arrive in Kyoto", "京都到着", l), [
                p("d1-e0", t("京都站", "Kyoto Station", "京都駅", l), .station, 34.9858, 135.7588, at: "11:00"),
                m("d1-e1", .rail, "JR 奈良线", 6, km: 3),
                p("d1-e2", t("伏见稻荷", "Fushimi Inari", "伏見稲荷", l), .sight, 34.9671, 135.7727, at: "12:00"),
                m("d1-e3", .bus, t("市营巴士", "City bus", "市バス", l), 20, km: 5),
                p("d1-e4", t("清水寺", "Kiyomizu-dera", "清水寺", l), .sight, 34.9949, 135.785, at: "15:00"),
            ], lodging: t("祇园", "Gion", "祇園", l)),
            day(2, start, t("岚山", "Arashiyama", "嵐山", l), [
                p("d2-e0", t("嵐山竹林", "Arashiyama Bamboo Grove", "嵐山竹林", l), .sight, 35.017, 135.6717, at: "08:30", kind: "forest"),
                m("d2-e1", .walk, t("步行", "Walk", "徒歩", l), 10, km: 0.8),
                p("d2-e2", t("渡月桥", "Togetsukyō Bridge", "渡月橋", l), .sight, 35.0129, 135.6778, at: "10:00"),
                m("d2-e3", .rail, t("岚电", "Randen tram", "嵐電", l), 25, km: 7),
                p("d2-e4", t("锦市场", "Nishiki Market", "錦市場", l), .food, 35.005, 135.7649, at: "13:00", kind: "market"),
            ], lodging: t("祇园", "Gion", "祇園", l)),
            day(3, start, t("返程", "Head home", "帰路", l), [
                p("d3-e0", t("京都站", "Kyoto Station", "京都駅", l), .station, 34.9858, 135.7588, at: "12:00"),
            ]),
        ])
    }

    // MARK: - 海岛：巴厘岛（船）

    static func bali(start: String, _ l: AppLanguage) -> Trip {
        trip("sample-bali", t("巴厘岛海岛假期", "Bali island days", "バリ島の休日", l), t("印度尼西亚、巴厘岛", "Bali, Indonesia", "インドネシア、バリ島", l),
             start: start, theme: "离岛夏日", seed: 20_261_002, days: [
            day(1, start, t("抵达巴厘岛", "Arrive in Bali", "バリ島到着", l), [
                p("d1-e0", t("伍拉·赖机场", "Ngurah Rai Airport", "ングラ・ライ空港", l), .airport, -8.7482, 115.1672, at: "14:00"),
                m("d1-e1", .taxi, t("出租车", "Taxi", "タクシー", l), 30, km: 8),
                p("d1-e2", t("库塔海滩", "Kuta Beach", "クタビーチ", l), .sight, -8.7185, 115.1686, at: "17:30"),
            ], lodging: t("库塔", "Kuta", "クタ", l)),
            day(2, start, t("乘船去蓝梦岛", "Boat to Nusa Lembongan", "船でレンボンガン島へ", l), [
                p("d2-e0", t("沙努尔港", "Sanur Harbour", "サヌール港", l), .port, -8.6781, 115.2631, at: "08:30"),
                m("d2-e1", .ship, t("快艇", "Fast boat", "高速船", l), 35, km: 20),
                p("d2-e2", t("恶魔的眼泪", "Devil's Tear", "デビルズティア", l), .sight, -8.6901, 115.4304, at: "11:00", kind: "beach"),
            ], lodging: t("蓝梦岛", "Nusa Lembongan", "レンボンガン島", l)),
            day(3, start, t("乌布梯田", "Ubud rice terraces", "ウブドの棚田", l), [
                p("d3-e0", t("德格拉朗梯田", "Tegallalang Rice Terrace", "テガラランの棚田", l), .sight, -8.4312, 115.2793, at: "09:00"),
                m("d3-e1", .car, t("包车", "Private driver", "チャーター車", l), 30, km: 12),
                p("d3-e2", t("圣猴森林", "Sacred Monkey Forest", "モンキーフォレスト", l), .sight, -8.5188, 115.2585, at: "13:00"),
            ], lodging: t("乌布", "Ubud", "ウブド", l)),
            day(4, start, t("返程", "Fly home", "帰国", l), [
                p("d4-e0", t("伍拉·赖机场", "Ngurah Rai Airport", "ングラ・ライ空港", l), .airport, -8.7482, 115.1672, at: "12:00"),
            ]),
        ])
    }

    // MARK: - 徒步：罗弗敦

    static func lofoten(start: String, _ l: AppLanguage) -> Trip {
        trip("sample-lofoten", t("罗弗敦徒步", "Hiking Lofoten", "ロフォーテンのハイキング", l), t("挪威、罗弗敦", "Lofoten, Norway", "ノルウェー、ロフォーテン", l),
             start: start, theme: "海风港町", seed: 20_261_110, days: [
            day(1, start, t("抵达斯沃尔韦尔", "Arrive in Svolvær", "スヴォルヴァー到着", l), [
                p("d1-e0", t("斯沃尔韦尔机场", "Svolvær Airport", "スヴォルヴァー空港", l), .airport, 68.2433, 14.6692, at: "12:00"),
                m("d1-e1", .bus, t("机场巴士", "Airport bus", "空港バス", l), 15, km: 6),
                p("d1-e2", t("斯沃尔韦尔港", "Svolvær harbour", "スヴォルヴァー港", l), .port, 68.2341, 14.5683, at: "14:00"),
            ], lodging: t("斯沃尔韦尔", "Svolvær", "スヴォルヴァー", l)),
            day(2, start, t("雷纳布林根徒步", "Reinebringen hike", "レイネブリンゲン登山", l), [
                m("d2-e0", .car, t("租车", "Rental car", "レンタカー", l), 120, km: 130),
                p("d2-e1", t("雷纳布林根步道", "Reinebringen trail", "レイネブリンゲン登山道", l), .sight, 67.9336, 13.0886, at: "10:30", kind: "trail"),
                m("d2-e2", .walk, t("步行", "Walk", "徒歩", l), 20, km: 1.5),
                p("d2-e3", t("雷纳渔村", "Reine village", "レイネの漁村", l), .sight, 67.9326, 13.0892, at: "15:00"),
            ], lodging: t("雷纳", "Reine", "レイネ", l)),
            day(3, start, t("海滩与返程", "Beach, then home", "ビーチから帰路へ", l), [
                p("d3-e0", t("豪克兰海滩", "Haukland Beach", "ハウクランビーチ", l), .sight, 68.1968, 13.5306, at: "10:00"),
                m("d3-e1", .car, t("租车", "Rental car", "レンタカー", l), 60, km: 70),
                p("d3-e2", t("斯沃尔韦尔机场", "Svolvær Airport", "スヴォルヴァー空港", l), .airport, 68.2433, 14.6692, at: "16:00"),
            ]),
        ])
    }

    // MARK: - 亲子：东京迪士尼

    static func themePark(start: String, _ l: AppLanguage) -> Trip {
        trip("sample-disney", t("东京迪士尼亲子行", "Tokyo Disney with the kids", "子どもと東京ディズニー", l), t("日本、东京", "Tokyo, Japan", "日本、東京", l),
             start: start, theme: "都市霓虹", seed: 20_261_225, days: [
            day(1, start, t("抵达东京", "Arrive in Tokyo", "東京到着", l), [
                p("d1-e0", t("羽田机场", "Haneda Airport", "羽田空港", l), .airport, 35.5494, 139.7798, at: "10:00"),
                m("d1-e1", .rail, t("京急线", "Keikyu Line", "京急線", l), 40, km: 25),
                p("d1-e2", t("东京塔", "Tokyo Tower", "東京タワー", l), .sight, 35.6586, 139.7454, at: "15:00"),
            ], lodging: t("舞滨", "Maihama", "舞浜", l)),
            day(2, start, t("迪士尼乐园", "Disneyland", "ディズニーランド", l), [
                p("d2-e0", t("东京迪士尼乐园", "Tokyo Disneyland", "東京ディズニーランド", l), .sight, 35.6329, 139.8804, at: "08:30"),
            ], lodging: t("舞滨", "Maihama", "舞浜", l)),
            day(3, start, t("水族馆与返程", "Aquarium, then home", "水族館から帰路へ", l), [
                p("d3-e0", t("葛西临海水族园", "Kasai Rinkai Aquarium", "葛西臨海水族園", l), .sight, 35.6406, 139.8612, at: "10:00"),
                m("d3-e1", .taxi, t("出租车", "Taxi", "タクシー", l), 35, km: 20),
                p("d3-e2", t("羽田机场", "Haneda Airport", "羽田空港", l), .airport, 35.5494, 139.7798, at: "15:00"),
            ]),
        ])
    }

    // MARK: - 一日出差：上海

    static func business(start: String, _ l: AppLanguage) -> Trip {
        trip("sample-shanghai", t("上海出差", "Shanghai work trip", "上海出張", l), t("上海", "Shanghai", "上海", l),
             start: start, theme: "都市霓虹", seed: 20_261_020, days: [
            day(1, start, t("当天往返", "Day trip", "日帰り", l), [
                p("d1-e0", t("虹桥站", "Hongqiao Station", "虹橋駅", l), .station, 31.1942, 121.3175, at: "09:30"),
                m("d1-e1", .subway, t("地铁 2 号线", "Metro Line 2", "地下鉄2号線", l), 40, km: 26),
                p("d1-e2", t("陆家嘴", "Lujiazui", "陸家嘴", l), .other, 31.2397, 121.4998, at: "10:30"),
                m("d1-e3", .walk, t("步行", "Walk", "徒歩", l), 15, km: 1),
                p("d1-e4", t("外滩咖啡", "Bund café", "外灘のカフェ", l), .food, 31.2400, 121.4900, at: "13:00"),
            ]),
        ])
    }
}
