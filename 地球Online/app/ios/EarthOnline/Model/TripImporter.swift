import Foundation

/// 导入：网页版导出的 JSON（单本或数组，spec 0.1 / 0.2 / 0.3）。旧版本按 shared/spec/migrate.ts 升级到 0.3。
/// 行程页 HTML 交给世界层（网页）的导入器去解析（桥接消息 import-page），见 WorldController.importPage。
enum TripImporter {
    enum ImportError: LocalizedError {
        case empty
        case unknownVersion(String)
        case invalid(String)

        var errorDescription: String? {
            switch self {
            case .empty: return String(localized: "文件里没有旅程。")
            case .unknownVersion(let v): return String(localized: "不认识的数据版本：\(v)")
            case .invalid(let why): return String(localized: "数据不完整：\(why)")
            }
        }
    }

    static func decode(_ data: Data, now: Date = Date()) throws -> [Trip] {
        let json = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        let objects: [Any]
        if let arr = json as? [Any] { objects = arr }
        else if let obj = json as? [String: Any], let trips = obj["trips"] as? [Any] { objects = trips }
        else { objects = [json] }
        guard !objects.isEmpty else { throw ImportError.empty }
        var out: [Trip] = []
        for o in objects {
            guard let dict = o as? [String: Any] else { continue }
            out.append(try migrate(dict, now: now))
        }
        guard !out.isEmpty else { throw ImportError.empty }
        return out
    }

    static func migrate(_ dict: [String: Any], now: Date = Date()) throws -> Trip {
        let v = dict["schemaVersion"] as? String ?? ""
        switch v {
        case "0.3", "0.2":
            var d = dict
            d["schemaVersion"] = Spec.schemaVersion
            let data = try JSONSerialization.data(withJSONObject: d)
            let trip = try JSONDecoder().decode(Trip.self, from: data)
            return try validate(trip)
        case "0.1":
            return try validate(from01(dict, now: now))
        default:
            throw ImportError.unknownVersion(v.isEmpty ? "?" : v)
        }
    }

    /// 最基本的检查（与 validate.ts 的要点一致：有书名、有天、日期格式对）
    static func validate(_ t: Trip) throws -> Trip {
        guard !t.title.isEmpty else { throw ImportError.invalid("title") }
        guard !t.days.isEmpty else { throw ImportError.invalid("days") }
        guard DayMath.parse(t.startDate) != nil, DayMath.parse(t.endDate) != nil else { throw ImportError.invalid("date") }
        return t
    }

    /// 0.1 → 0.3（shared/spec/migrate.ts 的 from01）
    static func from01(_ t: [String: Any], now: Date) throws -> Trip {
        let nowISO = ISO8601.string(now)
        let title = t["title"] as? String ?? ""
        let startDate = t["startDate"] as? String ?? ""
        let rawDays = t["days"] as? [[String: Any]] ?? []
        let days: [Day] = rawDays.enumerated().map { di, d in
            let entries: [Entry] = (d["entries"] as? [[String: Any]] ?? []).enumerated().map { ei, e in
                let id = "d\(di + 1)-e\(ei)"
                switch e["type"] as? String {
                case "transport":
                    let label = e["mode"] as? String ?? "步行"
                    return .transport(TransportEntry(id: id, mode: TransportClassifier.classify(label), label: label,
                                                     durationMinutes: DurationParser.parse(e["durationText"] as? String ?? ""), distanceKm: nil, polyline: nil))
                case "lodging":
                    return .lodging(LodgingEntry(id: id, name: e["name"] as? String ?? "住宿", notes: nil))
                default:
                    let cats: [PlaceCategory] = [.sight, .food, .shop, .station, .airport, .other]
                    let cat = cats.first { $0.rawValue == (e["category"] as? String) } ?? .sight
                    var p = PlaceEntry(id: id, name: e["name"] as? String ?? "", category: cat)
                    p.plannedStart = e["plannedStart"] as? String
                    return .place(p)
                }
            }
            return Day(index: d["index"] as? Int ?? di + 1, date: d["date"] as? String ?? "", title: d["title"] as? String ?? "",
                       city: d["city"] as? String ?? "kyoto", entries: entries, lodging: d["lodging"] as? String)
        }
        let destination: String
        if let s = t["destination"] as? String { destination = s }
        else if let o = t["destination"] as? [String: Any] {
            let parts = [o["country"] as? String, o["region"] as? String].compactMap { $0 }.filter { !$0.isEmpty }
            destination = parts.isEmpty ? "未知目的地" : parts.joined(separator: " · ")
        } else { destination = "未知目的地" }
        let seed: Int
        if let n = t["seed"] as? Int { seed = n }
        else if let s = t["seed"] as? String { seed = Int(PRNG.hashString(s)) }
        else { seed = Int(PRNG.hashString("\(title)|\(startDate)|\(destination)")) }
        let status = TripStatus(rawValue: t["status"] as? String ?? "") ?? .planning
        return Trip(schemaVersion: Spec.schemaVersion, id: "trip-\(TripFactory.base36(Int(PRNG.hashString(title + startDate))))",
                    title: title, destination: destination, startDate: startDate, endDate: t["endDate"] as? String ?? startDate,
                    theme: t["theme"] as? String ?? Spec.themes[0], seed: seed, status: status, plan: nil, days: days,
                    createdAt: nowISO, updatedAt: nowISO)
    }

    static func encode(_ trips: [Trip]) -> Data {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return (try? enc.encode(trips)) ?? Data("[]".utf8)
    }

    static func encode(_ trip: Trip) -> Data {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return (try? enc.encode(trip)) ?? Data("{}".utf8)
    }
}

/// shared/algo/duration.ts 的 parseDuration："50 分钟" / "1 小时 20 分" / "1.5 小时" / "45min" / "1h20m"
enum DurationParser {
    static func parse(_ text: String) -> Int? {
        let s = text.lowercased().filter { !$0.isWhitespace }
        guard !s.isEmpty else { return nil }
        if let m = match(#"^(\d+)h(\d{1,2})$"#, s), let h = Int(m[1]), let mm = Int(m[2]) { return h * 60 + mm }
        if let m = match(#"(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(小时|h|分钟|分|min)"#, s), let a = Double(m[1]), let b = Double(m[2]) {
            let mid = (a + b) / 2
            return Int(((m[3] == "小时" || m[3] == "h") ? mid * 60 : mid).rounded())
        }
        var total = 0.0
        var hit = false
        if let m = match(#"(\d+(?:\.\d+)?)(?:小时|h|hr|hours?)"#, s), let h = Double(m[1]) { total += h * 60; hit = true }
        if let m = match(#"(\d+)(?:分钟|分|min|m(?![a-z]))"#, s), let mm = Double(m[1]) { total += mm; hit = true }
        if !hit {
            if let m = match(#"^(\d+)$"#, s) { return Int(m[1]) }
            return nil
        }
        return Int(total.rounded())
    }

    /// 返回第 0 组（整体）与各捕获组
    static func match(_ pattern: String, _ s: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern),
              let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            guard let r = Range(m.range(at: i), in: s) else { return "" }
            return String(s[r])
        }
    }
}
