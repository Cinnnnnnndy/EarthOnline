import Foundation

/// 新建一本书（与 web/src/store.ts 的 createTrip 同一规则）：每天一页；知道目的地坐标时，每天放一个「住处」站点，
/// 让地球和 geo 底板都能落点；种子由书名、出发日期、创建时间派生。
enum TripFactory {
    static let plateCities: [String: String] = ["大阪": "osaka", "京都": "kyoto", "奈良": "nara", "神户": "kobe"]

    static func base36(_ n: Int) -> String { String(n, radix: 36) }

    static func make(title: String, destination: String, place: Place?, startDate: String, days: Int, theme: String,
                     now: Date = Date(), language: AppLanguage = .current) -> Trip {
        let count = max(1, min(30, days))
        let nowISO = ISO8601.string(now)
        let seed = PRNG.hashString("\(title)|\(startDate)|\(nowISO)")
        let city = plateCities[destination] ?? (place != nil ? Spec.geoPlate : "kyoto")
        let dest = destination
        var list: [Day] = []
        for i in 0..<count {
            let dayTitle: String
            if i == 0 { dayTitle = String(localized: "抵达\(dest)") }
            else if i == count - 1 { dayTitle = String(localized: "返程") }
            else {
                let nDay = i + 1
                dayTitle = String(localized: "第 \(nDay) 天")
            }
            var entries: [Entry] = []
            if city == Spec.geoPlate, let place {
                let stayName = String(localized: "住处，\(place.displayName(language))")
                entries.append(.place(PlaceEntry(id: "d\(i + 1)-e0", name: stayName, category: .hotel, geo: GeoPoint(lat: place.lat, lng: place.lng))))
            }
            list.append(Day(index: i + 1, date: DayMath.add(startDate, days: i), title: dayTitle, city: city, entries: entries))
        }
        return Trip(schemaVersion: Spec.schemaVersion,
                    id: "trip-\(base36(Int(seed)))-\(base36(now.millis))",
                    title: String(title.prefix(40)), destination: destination,
                    startDate: startDate, endDate: DayMath.add(startDate, days: count - 1),
                    theme: theme, seed: Int(seed), status: .planning, days: list,
                    createdAt: nowISO, updatedAt: nowISO)
    }

    /// 不填书名时：「京都 5 日」
    static func defaultTitle(destination: String, days: Int) -> String {
        let nDays = days
        return String(localized: "\(destination) \(nDays) 日")
    }
}

/// 主题名的显示（数据里存中文原名，与网页一致）
enum ThemeName {
    static func localized(_ theme: String) -> String {
        switch theme {
        case "红叶古都": return String(localized: "红叶古都")
        case "极光冰原": return String(localized: "极光冰原")
        case "海风港町": return String(localized: "海风港町")
        case "温泉雪国": return String(localized: "温泉雪国")
        case "都市霓虹": return String(localized: "都市霓虹")
        case "樱花春日": return String(localized: "樱花春日")
        case "离岛夏日": return String(localized: "离岛夏日")
        default: return theme
        }
    }
}
