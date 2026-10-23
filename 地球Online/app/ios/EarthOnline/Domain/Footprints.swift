import Foundation

/// shared/algo/footprints.ts：去过的地方在地球上插一面小旗。
///  1. 打过卡的站点一定算；2. 书已合上 → 这本书的所有站点都算；3. 日期早于今天的那几天 → 当天的站点都算；
///  4. 住处和机场不插旗；5. 同名或相距 2 km 以内算同一个地方；6. 手动补的旗照样插。
struct Footprint: Identifiable, Hashable, Sendable {
    enum Source: String, Sendable { case trip, manual }
    var id: String
    var name: String
    var lat: Double
    var lng: Double
    var date: String
    var source: Source
    var trips: [String]
}

struct FootprintStats: Sendable {
    var places: Int
    var farthestKm: Int
    var farthest: String?
}

enum Geo {
    static func haversineKm(_ a: (Double, Double), _ b: (Double, Double)) -> Double {
        let r = Double.pi / 180
        let dLat = (b.0 - a.0) * r, dLng = (b.1 - a.1) * r
        let h = pow(sin(dLat / 2), 2) + cos(a.0 * r) * cos(b.0 * r) * pow(sin(dLng / 2), 2)
        return 12_742 * asin(min(1, sqrt(h)))
    }

    /// 一组点的球面平均（地球上书的中心）
    static func mean(_ pts: [(Double, Double)]) -> (Double, Double) {
        guard !pts.isEmpty else { return (30, 60) }
        let r = Double.pi / 180
        var x = 0.0, y = 0.0, z = 0.0
        for (a, b) in pts {
            x += cos(a * r) * cos(b * r); y += cos(a * r) * sin(b * r); z += sin(a * r)
        }
        return (atan2(z, hypot(x, y)) / r, atan2(y, x) / r)
    }

    /// 站点坐标：写明的 geo 优先，否则查小地名表
    static func point(of p: PlaceEntry) -> GeoPoint? {
        if let g = p.geo { return g }
        if let hit = Gazetteer.locate(p.name) { return GeoPoint(lat: hit.lat, lng: hit.lng) }
        return nil
    }

    /// 一本书在地球上的大致位置
    static func center(of trip: Trip) -> GeoPoint? {
        let pts = trip.days.flatMap(\.places).compactMap(point(of:)).map { ($0.lat, $0.lng) }
        if pts.isEmpty {
            if let hit = Gazetteer.locate(trip.destination) { return GeoPoint(lat: hit.lat, lng: hit.lng) }
            return nil
        }
        let m = mean(pts)
        return GeoPoint(lat: m.0, lng: m.1)
    }
}

enum Footprints {
    static func compute(trips: [Trip], manual: [ManualFlag], today: String) -> [Footprint] {
        var out: [Footprint] = []
        func merge(_ f: Footprint) {
            if let i = out.firstIndex(where: { $0.name == f.name || Geo.haversineKm(($0.lat, $0.lng), (f.lat, f.lng)) < 2 }) {
                if f.date < out[i].date { out[i].date = f.date }
                for t in f.trips where !out[i].trips.contains(t) { out[i].trips.append(t) }
            } else {
                out.append(f)
            }
        }
        for t in trips {
            for d in t.days {
                let past = t.status == .closed || d.date < today
                for p in d.places {
                    if p.category == .hotel || p.category == .airport { continue }
                    guard p.visited == true || past, let g = Geo.point(of: p) else { continue }
                    merge(Footprint(id: "trip:\(p.name)", name: p.name, lat: g.lat, lng: g.lng,
                                    date: p.visitedAt.map { String($0.prefix(10)) } ?? d.date, source: .trip, trips: [t.id]))
                }
            }
        }
        for m in manual {
            merge(Footprint(id: m.id, name: m.name, lat: m.lat, lng: m.lng, date: m.date ?? "", source: .manual, trips: []))
        }
        return out.sorted {
            let a = $0.date.isEmpty ? "9999" : $0.date, b = $1.date.isEmpty ? "9999" : $1.date
            return a != b ? a < b : $0.name < $1.name
        }
    }

    static func stats(_ fps: [Footprint], home: HomePlace?) -> FootprintStats {
        var far = 0.0
        var farName: String?
        if let home {
            for f in fps {
                let k = Geo.haversineKm((home.lat, home.lng), (f.lat, f.lng))
                if k > far { far = k; farName = f.name }
            }
        }
        return FootprintStats(places: fps.count, farthestKm: Int(far.rounded()), farthest: farName)
    }
}
