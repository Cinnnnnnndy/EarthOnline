import Foundation

/// shared/world/landmark-kinds.ts 的移植：景点分类型（人文 / 自然 / 休闲 / 吃喝购物 / 交通 / 住宿），给行的图标用。
/// 类型来源依次是：条目里写明的 kind → 类别（机场 / 港口 / 车站 / 住处）→ 地图标签 → 名字里的关键词 → 类别兜底。
/// 顺序有意义：先具体后宽泛（「清水寺三重塔」先落到寺庙，「蓝湖」先落到温泉，「某某山观景台」先落到观景台）。
enum KindGroup: String, Sendable { case culture, nature, leisure, life, transit, stay }

struct KindDef: Sendable {
    let id: String
    let group: KindGroup
    /// shared/world/icons.ts 里的图标名
    let icon: String
    let pattern: String?
    let osm: [String]

    init(_ id: String, _ group: KindGroup, _ icon: String, _ pattern: String? = nil, osm: [String] = []) {
        self.id = id; self.group = group; self.icon = icon; self.pattern = pattern; self.osm = osm
    }
}

enum LandmarkKinds {
    static let kinds: [KindDef] = [
        // ---- 交通 / 住宿（多半由类别直接给出）
        KindDef("airport", .transit, "plane", #"机场|空港|airport|flugvöllur|lufthavn"#, osm: ["aeroway=aerodrome"]),
        KindDef("port", .transit, "anchor", #"港口|码头|渡口|ferry|harbou?r|havn(?!en\b)|port\b"#, osm: ["amenity=ferry_terminal"]),
        KindDef("station", .transit, "rail", #"站$|车站|駅|station|stasjon|bahnhof"#, osm: ["railway=station", "public_transport=station"]),
        KindDef("hotel", .stay, "hotel", #"酒店|宾馆|旅馆|民宿|住处|hotel|hostel|guesthouse|旅館"#, osm: ["tourism=hotel", "tourism=guest_house", "tourism=hostel"]),
        // ---- 人文
        KindDef("mosque", .culture, "mosque", #"清真寺|mosque|cami|masjid"#, osm: ["religion=muslim"]),
        KindDef("temple", .culture, "temple", #"寺|神社|神宫|神宮|大社|稻荷|稲荷|庙|廟|宫观|道观|祠|temple|shrine|jinja|pagoda"#, osm: ["religion=buddhist", "religion=shinto", "religion=taoist"]),
        KindDef("church", .culture, "church", #"教堂|礼拜堂|kirkja|kirke|kirche|church|cathedral|chapel|basilica|domkirke"#, osm: ["religion=christian"]),
        KindDef("castle", .culture, "castle", #"城堡|宫殿|王宫|皇宫|故宫|城址|天守|城$|castle|palace|slott?\b|schloss|château|burg\b|fortress|festning"#, osm: ["historic=castle", "historic=fort", "building=palace"]),
        KindDef("museum", .culture, "museum", #"博物馆|美术馆|艺术馆|纪念馆|展览馆|科技馆|museum|gallery|safn|musée|museo"#, osm: ["tourism=museum", "tourism=gallery"]),
        KindDef("theater", .culture, "theater", #"剧院|歌剧院|音乐厅|剧场|opera|theat|concert hall|konserthus|harpa"#, osm: ["amenity=theatre", "amenity=concert_hall"]),
        KindDef("ruins", .culture, "ruins", #"遗址|遗迹|古迹|废墟|ruins?\b|archaeolog"#, osm: ["historic=ruins", "historic=archaeological_site"]),
        KindDef("monument", .culture, "monument", #"纪念碑|雕像|雕塑|铜像|塑像|monument|statue|memorial|sculpt|mermaid|美人鱼"#, osm: ["historic=monument", "historic=memorial", "tourism=artwork"]),
        KindDef("bridge", .culture, "bridge", #"大桥|桥|橋|bridge|brú\b|bro\b|brücke"#, osm: ["bridge"]),
        KindDef("tower", .culture, "tower", #"塔|tower|turm|tårn|tornet"#, osm: ["man_made=tower", "tower:type=observation"]),
        KindDef("square", .culture, "square", #"广场|市政厅|市政|square|plaza|piazza|torg(?!et)|rådhus|city hall"#, osm: ["place=square", "amenity=townhall"]),
        KindDef("oldtown", .culture, "oldtown", #"老街|古镇|老城|旧城|街区|小镇|渔村|村$|新港|old town|altstadt|gamla|village|bryggen|nyhavn"#, osm: ["place=village", "place=hamlet"]),
        // ---- 休闲
        KindDef("viewpoint", .leisure, "viewpoint", #"观景台|展望台|瞭望|观景|viewpoint|lookout|utsikt|skywalk"#, osm: ["tourism=viewpoint"]),
        KindDef("cablecar", .leisure, "cablecar", #"缆车|索道|cable ?car|gondola|funicular|fløibanen|fjellheisen|ropeway"#, osm: ["aerialway"]),
        KindDef("themepark", .leisure, "themepark", #"乐园|游乐园|环球影城|迪士尼|theme park|amusement|tivoli|universal|disney"#, osm: ["tourism=theme_park"]),
        KindDef("zoo", .leisure, "zoo", #"动物园|水族馆|海洋馆|zoo|aquarium|polaria"#, osm: ["tourism=zoo", "tourism=aquarium"]),
        // ---- 自然
        KindDef("geyser", .nature, "hotspring", #"间歇泉|geysir|geyser|strokkur"#, osm: ["natural=geyser"]),
        KindDef("hotspring", .nature, "hotspring", #"温泉|泡汤|蓝湖|onsen|hot spring|blue lagoon|laug|spa\b"#, osm: ["natural=hot_spring", "leisure=spa"]),
        KindDef("volcano", .nature, "volcano", #"火山|火口|地热|crater|volcano|kerið|kerid|hveri"#, osm: ["natural=volcano"]),
        KindDef("waterfall", .nature, "waterfall", #"瀑布|滝|foss\b|fossen|falls\b|waterfall"#, osm: ["waterway=waterfall"]),
        KindDef("glacier", .nature, "glacier", #"冰川|冰河|jökull|glacier|breen\b"#, osm: ["natural=glacier"]),
        KindDef("beach", .nature, "beach", #"海滩|沙滩|海岸|海边|海滨|海角|beach|strand|sandur|fjara|coast"#, osm: ["natural=beach", "natural=coastline"]),
        KindDef("fjord", .nature, "fjord", #"峡湾|峡谷|大峡|canyon|gorge|fjord|gljúfur|dalen\b"#, osm: ["natural=valley", "natural=gorge"]),
        KindDef("cave", .nature, "cave", #"洞|窟|cave|grotto|hellir"#, osm: ["natural=cave_entrance"]),
        KindDef("lake", .nature, "lake", #"湖|池|潭|lake|vatn\b|vatnet|sjø|see\b|lagoon|lón\b"#, osm: ["natural=water", "water=lake"]),
        KindDef("trail", .nature, "walk", #"徒步|步道|登山道|trail|hike|hiking|trek"#, osm: ["highway=path", "route=hiking"]),
        KindDef("forest", .nature, "forest", #"森林|公园|花园|庭园|庭園|植物园|竹林|forest|park\b|garden|skog|lund\b|arboretum"#, osm: ["leisure=park", "landuse=forest", "leisure=garden", "boundary=national_park"]),
        KindDef("mountain", .nature, "mountain", #"山|峰|岳|岭|嶺|mountain|mount\b|mt\.|fjell|fjall|tind|peak|berg\b"#, osm: ["natural=peak", "natural=ridge"]),
        // ---- 吃喝购物
        KindDef("market", .life, "shop", #"市场|市集|鱼市|夜市|商店街|market|torget|halle\b|markt"#, osm: ["amenity=marketplace"]),
        KindDef("food", .life, "food", #"餐厅|饭店|食堂|面馆|拉面|寿司|烤肉|咖啡|甜品|麦当劳|café|cafe|coffee|restaurant|bakery|bistro|kaffi|mcdonald|bar\b"#, osm: ["amenity=restaurant", "amenity=cafe", "amenity=fast_food", "amenity=bar"]),
        KindDef("shop", .life, "shop", #"商场|百货|购物|outlet|mall\b|shop|store|免税"#, osm: ["shop"]),
        // ---- 兜底
        KindDef("sight", .culture, "pin"),
    ]

    static let byID: [String: KindDef] = Dictionary(uniqueKeysWithValues: kinds.map { ($0.id, $0) })

    private static let regexes: [String: NSRegularExpression] = {
        var out: [String: NSRegularExpression] = [:]
        for k in kinds {
            guard let p = k.pattern, let re = try? NSRegularExpression(pattern: JSRegex.compatible(p), options: [.caseInsensitive]) else { continue }
            out[k.id] = re
        }
        return out
    }()

    private static let categoryKind: [PlaceCategory: String] = [.airport: "airport", .port: "port", .station: "station", .hotel: "hotel", .food: "food", .shop: "shop"]

    private static func osmMatch(_ tags: [String: String], _ rule: String) -> Bool {
        let parts = rule.split(separator: "=", maxSplits: 1).map(String.init)
        guard let k = parts.first, let value = tags[k] else { return false }
        guard parts.count == 2 else { return true }
        let v = parts[1]
        return value == v || value.split(separator: ";").map(String.init).contains(v)
    }

    private static func nameMatches(_ k: KindDef, _ name: String) -> Bool {
        JSRegex.test(regexes[k.id], name)
    }

    /// 给一个地点定类型。返回 kinds 里的 id；认不出时是 "sight"
    static func classify(name: String, category: PlaceCategory? = nil, kind: String? = nil, tags: [String: String]? = nil) -> String {
        if let kind, byID[kind] != nil { return kind }
        let byCat = category.flatMap { categoryKind[$0] }
        if let byCat, byCat != "food", byCat != "shop" { return byCat }       // 交通与住处以类别为准
        if let tags {
            for k in kinds where k.osm.contains(where: { osmMatch(tags, $0) }) { return k.id }
        }
        for k in kinds where k.pattern != nil && k.group != .transit && k.group != .stay && nameMatches(k, name) { return k.id }
        if let byCat { return byCat }
        for k in kinds where k.pattern != nil && nameMatches(k, name) { return k.id }  // 最后才让交通 / 住处的关键词参与
        return "sight"
    }

    static func classify(_ p: PlaceEntry) -> String {
        classify(name: p.name, category: p.category, kind: p.kind)
    }

    /// 图标名 → SF Symbol
    static func symbol(forIcon icon: String) -> String {
        switch icon {
        case "plane": return "airplane"
        case "anchor": return "ferry"
        case "rail": return "tram"
        case "hotel": return "bed.double"
        case "mosque": return "moon.stars"
        case "temple": return "house.lodge"
        case "church": return "bell"
        case "castle": return "crown"
        case "museum": return "building.columns"
        case "theater": return "theatermasks"
        case "ruins": return "hourglass"
        case "monument": return "figure.stand"
        case "bridge": return "road.lanes"
        case "tower": return "antenna.radiowaves.left.and.right"
        case "square": return "building.2"
        case "oldtown": return "house"
        case "viewpoint": return "binoculars"
        case "cablecar": return "cablecar"
        case "themepark": return "ferriswheel"
        case "zoo": return "pawprint"
        case "hotspring": return "humidity"
        case "volcano": return "flame"
        case "waterfall": return "water.waves"
        case "glacier": return "snowflake"
        case "beach": return "beach.umbrella"
        case "fjord": return "mountain.2.fill"
        case "cave": return "flashlight.on.fill"
        case "lake": return "drop"
        case "walk": return "figure.hiking"
        case "forest": return "tree"
        case "mountain": return "mountain.2"
        case "shop": return "bag"
        case "food": return "fork.knife"
        default: return "mappin"
        }
    }

    static func symbol(forKind id: String) -> String {
        symbol(forIcon: byID[id]?.icon ?? "pin")
    }

    /// 第八轮：行程列表、下一站、站点详情里的站点图标按六组给——交通一种、住宿一种、其余按人文 / 自然 / 休闲 / 吃喝购物；
    /// 类型级的图标（symbol(forKind:)）只在选类型的编辑器里用。对应 TS 的 GROUP_ICON
    static let transportSymbol = "point.topleft.down.to.point.bottomright.curvepath"

    static func groupSymbol(_ group: KindGroup) -> String {
        switch group {
        case .culture: return "building.columns"
        case .nature: return "mountain.2"
        case .leisure: return "ferriswheel"
        case .life: return "fork.knife"
        case .transit: return transportSymbol
        case .stay: return "bed.double"
        }
    }

    static func groupSymbol(forKind id: String) -> String { groupSymbol(byID[id]?.group ?? .culture) }

    static func localizedName(_ id: String) -> String {
        switch id {
        case "airport": return String(localized: "机场")
        case "port": return String(localized: "港口")
        case "station": return String(localized: "车站")
        case "hotel": return String(localized: "住处")
        case "mosque": return String(localized: "清真寺")
        case "temple": return String(localized: "寺庙神社")
        case "church": return String(localized: "教堂")
        case "castle": return String(localized: "城堡宫殿")
        case "museum": return String(localized: "博物馆")
        case "theater": return String(localized: "剧院")
        case "ruins": return String(localized: "遗址")
        case "monument": return String(localized: "纪念碑雕塑")
        case "bridge": return String(localized: "桥")
        case "tower": return String(localized: "塔")
        case "square": return String(localized: "广场市政")
        case "oldtown": return String(localized: "老街小镇")
        case "viewpoint": return String(localized: "观景台")
        case "cablecar": return String(localized: "缆车")
        case "themepark": return String(localized: "游乐园")
        case "zoo": return String(localized: "动物园水族馆")
        case "geyser": return String(localized: "间歇泉")
        case "hotspring": return String(localized: "温泉")
        case "volcano": return String(localized: "火山地热")
        case "waterfall": return String(localized: "瀑布")
        case "glacier": return String(localized: "冰川")
        case "beach": return String(localized: "海滩海岸")
        case "fjord": return String(localized: "峡湾峡谷")
        case "cave": return String(localized: "洞穴")
        case "lake": return String(localized: "湖泊")
        case "trail": return String(localized: "徒步步道")
        case "forest": return String(localized: "森林公园")
        case "mountain": return String(localized: "山")
        case "market": return String(localized: "市场")
        case "food": return String(localized: "餐厅咖啡")
        case "shop": return String(localized: "购物")
        default: return String(localized: "景点")
        }
    }

    static func localizedGroup(_ g: KindGroup) -> String {
        switch g {
        case .culture: return String(localized: "人文")
        case .nature: return String(localized: "自然")
        case .leisure: return String(localized: "休闲")
        case .life: return String(localized: "吃喝购物")
        case .transit: return String(localized: "交通")
        case .stay: return String(localized: "住宿")
        }
    }
}
