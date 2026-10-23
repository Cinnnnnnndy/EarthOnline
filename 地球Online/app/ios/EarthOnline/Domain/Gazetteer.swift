import Foundation

/// shared/geo/gazetteer.ts：小地名表（离线）。新建旅程搜目的地、给没有坐标的站点落到地球上、给「点地球放家」起名。
/// 数据在 GazetteerData.swift（由 shared/rules/gazetteer.json 生成，另外补了英文、日文名）。
struct Place: Hashable, Identifiable, Sendable {
    enum Kind: String, Sendable { case city, poi, region }
    let name: String
    let aliases: [String]
    let lat: Double
    let lng: Double
    let kind: Kind
    let en: String?
    let ja: String?

    var id: String { "\(name)@\(lat),\(lng)" }

    func displayName(_ lang: AppLanguage = .current) -> String {
        switch lang {
        case .zhHans: return name
        case .en: return en ?? name
        case .ja: return ja ?? name
        }
    }

    /// 搜索用的全部名字
    var allNames: [String] { [name] + aliases + [en, ja].compactMap { $0 } }
}

enum Gazetteer {
    static let places: [Place] = GazetteerData.places

    static func norm(_ s: String) -> String {
        s.lowercased().filter { !$0.isWhitespace && $0 != "·" && $0 != "・" }
    }

    static func search(_ q: String, limit: Int = 8) -> [Place] {
        let n = norm(q)
        if n.isEmpty { return Array(places.filter { $0.kind == .city }.prefix(limit)) }
        func score(_ p: Place) -> Int {
            let names = p.allNames.map(norm)
            if names.contains(where: { $0 == n }) { return 0 }
            if names.contains(where: { $0.hasPrefix(n) }) { return 1 }
            if names.contains(where: { $0.contains(n) }) { return 2 }
            if names.contains(where: { !$0.isEmpty && n.contains($0) }) { return 3 }
            return 9
        }
        return places.map { ($0, score($0)) }
            .filter { $0.1 < 9 }
            .sorted { $0.1 != $1.1 ? $0.1 < $1.1 : ($0.0.kind == .city && $1.0.kind != .city) }
            .prefix(limit)
            .map(\.0)
    }

    /// 站点名 → 坐标（名字互相包含即可；取最长匹配）
    static func locate(_ name: String) -> Place? {
        let n = norm(name)
        guard !n.isEmpty else { return nil }
        var best: Place?
        var bestLen = 0
        for p in places {
            for x in p.allNames {
                let k = norm(x)
                if k.count >= 2, n.contains(k) || k.contains(n), k.count > bestLen { best = p; bestLen = k.count }
            }
        }
        return best
    }

    /// 离这个坐标最近的城市（maxKm 以内）
    static func nearest(lat: Double, lng: Double, maxKm: Double = 80, kinds: Set<Place.Kind> = [.city]) -> Place? {
        var best: Place?
        var bd = maxKm
        for p in places where kinds.contains(p.kind) {
            let d = Geo.haversineKm((lat, lng), (p.lat, p.lng))
            if d < bd { bd = d; best = p }
        }
        return best
    }

    /// 在一段话里找目的地（规划用）：城市优先，取最长的名字；返回命中的那个词与地点
    static func find(in text: String) -> (matched: String, place: Place)? {
        let n = norm(text)
        guard !n.isEmpty else { return nil }
        var best: (String, Place)?
        var bestScore = 0
        for p in places {
            for x in p.allNames {
                let k = norm(x)
                guard k.count >= 2, n.contains(k) else { continue }
                let score = k.count * 10 + (p.kind == .city ? 15 : 0)
                if score > bestScore { bestScore = score; best = (x, p) }
            }
        }
        return best.map { (matched: $0.0, place: $0.1) }
    }
}
