import Foundation

/// shared/spec/types.ts 的 Swift 版（spec 0.3）。字段一一对应，JSON 形状与网页版导出的完全一致：
/// 可选字段为空时不写出（synthesized Encodable 用 encodeIfPresent），不认识的枚举值按兜底值读入，不因为一个字段让整本书读不进来。
enum Spec {
    static let schemaVersion = "0.3"
    static let themes = ["红叶古都", "极光冰原", "海风港町", "温泉雪国", "都市霓虹", "樱花春日", "离岛夏日"]
    static let cityPlates = ["osaka", "kyoto", "nara", "kobe"]
    static let geoPlate = "geo"
}

enum PlaceCategory: String, Codable, CaseIterable, Hashable, Sendable {
    case sight, food, shop, station, airport, port, hotel, other

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PlaceCategory(rawValue: raw) ?? .other
    }
}

enum TransportMode: String, Codable, CaseIterable, Hashable, Sendable {
    case walk, rail, subway, bus, ship, taxi, car, flight

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = TransportMode(rawValue: raw) ?? TransportClassifier.classify(raw)
    }
}

enum TripStatus: String, Codable, CaseIterable, Hashable, Sendable {
    case planning, traveling, closed

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = TripStatus(rawValue: raw) ?? .planning
    }
}

struct GeoPoint: Codable, Hashable, Sendable {
    var lat: Double
    var lng: Double
}

/// 一件待办（第八轮）：文字、该做完的日期（YYYY-MM-DD，没有就按出发日）、做完了没有
struct Todo: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var text: String
    var due: String?
    var done: Bool?
}

struct PlaceEntry: Codable, Hashable, Sendable {
    var id: String
    var name: String
    var category: PlaceCategory
    /// 计划到达 "HH:MM"
    var plannedStart: String?
    var stayMinutes: Int?
    var notes: String?
    /// 已打卡
    var visited: Bool?
    var visitedAt: String?
    /// 真实坐标（有它就能生成 geo 底板、在地球上落点）
    var geo: GeoPoint?
    /// 景点类型（landmark-kinds 的 id；不写就推断）
    var kind: String?
    /// 待办（第八轮，可选）：规划时记下要提前做的事；算法见 Domain/Todos.swift
    var todos: [Todo]?
}

struct TransportEntry: Codable, Hashable, Sendable {
    var id: String
    var mode: TransportMode
    var label: String
    var durationMinutes: Int?
    var distanceKm: Double?
    /// [lat, lng][]
    var polyline: [[Double]]?
}

struct LodgingEntry: Codable, Hashable, Sendable {
    var id: String
    var name: String
    var notes: String?
}

/// 条目：按 "type" 区分三种（与 TS 的联合类型一致）
enum Entry: Codable, Hashable, Identifiable, Sendable {
    case place(PlaceEntry)
    case transport(TransportEntry)
    case lodging(LodgingEntry)

    var id: String {
        switch self {
        case .place(let p): return p.id
        case .transport(let t): return t.id
        case .lodging(let l): return l.id
        }
    }

    var place: PlaceEntry? { if case .place(let p) = self { return p }; return nil }
    var transport: TransportEntry? { if case .transport(let t) = self { return t }; return nil }
    var lodging: LodgingEntry? { if case .lodging(let l) = self { return l }; return nil }

    private enum TypeKey: String, CodingKey { case type }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: TypeKey.self)
        let type = try c.decodeIfPresent(String.self, forKey: .type) ?? "place"
        switch type {
        case "transport": self = .transport(try TransportEntry(from: decoder))
        case "lodging": self = .lodging(try LodgingEntry(from: decoder))
        default: self = .place(try PlaceEntry(from: decoder))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: TypeKey.self)
        switch self {
        case .place(let p):
            try c.encode("place", forKey: .type)
            try p.encode(to: encoder)
        case .transport(let t):
            try c.encode("transport", forKey: .type)
            try t.encode(to: encoder)
        case .lodging(let l):
            try c.encode("lodging", forKey: .type)
            try l.encode(to: encoder)
        }
    }

    func withID(_ newID: String) -> Entry {
        switch self {
        case .place(var p): p.id = newID; return .place(p)
        case .transport(var t): t.id = newID; return .transport(t)
        case .lodging(var l): l.id = newID; return .lodging(l)
        }
    }
}

struct Day: Codable, Hashable, Identifiable, Sendable {
    var index: Int
    var date: String
    var title: String
    /// 底板：osaka / kyoto / nara / kobe，或 "geo"（按站点坐标生成）
    var city: String
    var entries: [Entry]
    var lodging: String?
    var diary: String?
    var color: String?

    var id: Int { index }
    var places: [PlaceEntry] { entries.compactMap(\.place) }
}

struct TripPlan: Codable, Hashable, Sendable {
    var group: String
    var index: Int
    var label: String
}

/// 自己放进箱子的一张照片（D82）：抠出主体做成立牌（cutout），抠不出来就整张做成拍立得（polaroid）；图存在 Application Support/EarthOnline/cards/<id>.png，这里只记尺寸
struct CaseCard: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var kind: String
    var w: Int
    var h: Int
    var label: String?
}

/// 行李箱的增减（D82 / D84）：hidden 是藏起来的东西（名胜 lm:名字、特色物件 sv:id、AI 加的 ex:kind），picks 是从库里挑的特色物件 id，
/// gear 是自己从清单里挑的随身物件（种类 id），cards 是照片卡
struct CaseEdits: Codable, Hashable, Sendable {
    var hidden: [String]?
    var picks: [String]?
    var gear: [String]?
    var cards: [CaseCard]?
}

struct Trip: Codable, Hashable, Identifiable, Sendable {
    var schemaVersion: String
    var id: String
    var title: String
    var destination: String
    var startDate: String
    var endDate: String
    var theme: String
    var seed: Int
    var status: TripStatus
    var plan: TripPlan?
    var days: [Day]
    var createdAt: String
    var updatedAt: String
    /// 行李箱的增减（D82），可选
    var suitcase: CaseEdits?
}

struct Avatar: Codable, Hashable, Sendable {
    var skin = 0
    var hair = "bun"
    var hairColor = 0
    var dress = 0
    var hat = "straw"
    var hatColor = 0
    var shoes = 0
    var name = "小旅"
    /// 我的行李箱是哪一款（D81）：sand / ink / canvas / trunk；nil = 沙色硬壳。嵌入页按它搭箱子
    var suitcase: String?
    /// 形态（D86）：human / fox / cat / shiba / bear / rabbit / penguin / panda / duck / bean / cloud / pebble；nil = 小人。嵌入页按它建角色
    var form: String?
    /// 戴眼镜（D101）；nil = 不戴。只对小人生效
    var glasses: Bool?

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = Avatar.default
        skin = try c.decodeIfPresent(Int.self, forKey: .skin) ?? d.skin
        hair = try c.decodeIfPresent(String.self, forKey: .hair) ?? d.hair
        hairColor = try c.decodeIfPresent(Int.self, forKey: .hairColor) ?? d.hairColor
        dress = try c.decodeIfPresent(Int.self, forKey: .dress) ?? d.dress
        hat = try c.decodeIfPresent(String.self, forKey: .hat) ?? d.hat
        hatColor = try c.decodeIfPresent(Int.self, forKey: .hatColor) ?? d.hatColor
        shoes = try c.decodeIfPresent(Int.self, forKey: .shoes) ?? d.shoes
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? d.name
        suitcase = try c.decodeIfPresent(String.self, forKey: .suitcase)
        form = try c.decodeIfPresent(String.self, forKey: .form)
        glasses = try c.decodeIfPresent(Bool.self, forKey: .glasses)
    }

    static let `default` = Avatar()
}

/// 家（足迹的原点、天色的默认地点）
struct HomePlace: Codable, Hashable, Sendable {
    var name: String
    var lat: Double
    var lng: Double
}

/// 手动补的足迹旗
struct ManualFlag: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var name: String
    var lat: Double
    var lng: Double
    var date: String?
}

enum Palette: String, Codable, CaseIterable, Sendable { case sea, warm, dusk }
enum PostLevel: String, Codable, CaseIterable, Sendable { case high, medium, low }
