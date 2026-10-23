import Foundation

/// shared/algo/stats.ts + 网页首页上的公里数 / 自驾时长
struct TripStats: Sendable {
    var days = 0
    var places = 0
    var visited = 0
    var walkMinutes = 0
    var transitMinutes = 0
    var cities: [String] = []
    var lodgings: [String] = []
    /// 地面交通的公里数（不含飞机）
    var km: Double = 0
    /// 开车 / 巴士 / 出租车的时长
    var driveMinutes = 0
    /// 目的地里写了几个地方（「冰岛 · 丹麦 · 挪威」= 3）
    var destinations = 1
}

enum Stats {
    static func of(_ trip: Trip) -> TripStats {
        var s = TripStats()
        s.days = trip.days.count
        var cities: [String] = [], lodgings: [String] = []
        for d in trip.days {
            if !cities.contains(d.city) { cities.append(d.city) }
            if let l = d.lodging, !l.isEmpty, !lodgings.contains(l) { lodgings.append(l) }
            for e in d.entries {
                switch e {
                case .place(let p):
                    s.places += 1
                    if p.visited == true { s.visited += 1 }
                case .transport(let t):
                    if t.mode != .flight { s.km += t.distanceKm ?? 0 }
                    if t.mode == .car || t.mode == .bus || t.mode == .taxi { s.driveMinutes += t.durationMinutes ?? 0 }
                case .lodging: break
                }
            }
            let tl = Timeline.build(d)
            s.walkMinutes += tl.walkMinutes
            s.transitMinutes += tl.transitMinutes
        }
        s.cities = cities
        s.lodgings = lodgings
        let parts = trip.destination.components(separatedBy: CharacterSet(charactersIn: "·、，,")).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        s.destinations = max(1, parts.count)
        return s
    }

    static func dayKm(_ d: Day) -> Double {
        d.entries.reduce(0) { acc, e in
            if let t = e.transport, t.mode != .flight { return acc + (t.distanceKm ?? 0) }
            return acc
        }
    }

    static func dayMoveMinutes(_ d: Day) -> Int {
        d.entries.reduce(0) { acc, e in
            if let t = e.transport, t.mode != .flight { return acc + (t.durationMinutes ?? 0) }
            return acc
        }
    }
}

/// 数量短语（英文有单复数，在 String Catalog 里配）
enum Counts {
    static func days(_ n: Int) -> String { String(localized: "\(n) 天") }
    static func stops(_ n: Int) -> String { String(localized: "\(n) 站") }
    static func checkIns(_ n: Int) -> String { String(localized: "\(n) 处打卡") }
    static func places(_ n: Int) -> String { String(localized: "\(n) 个地方") }

    static func join(_ parts: [String], _ lang: AppLanguage = .current) -> String {
        parts.filter { !$0.isEmpty }.joined(separator: lang.comma)
    }
}
