import Foundation

/// 日期都以 "YYYY-MM-DD" 字符串存（与 JSON 一致）。算术在 UTC 日历上做（不受夏令时影响），
/// 显示时换成本地时区的当天中午再交给 FormatStyle（不会因为时区差一天）。
enum DayMath {
    static let utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return c
    }()

    /// "YYYY-MM-DD" → UTC 零点
    static func parse(_ iso: String) -> Date? {
        let parts = iso.prefix(10).split(separator: "-")
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        return utcCalendar.date(from: DateComponents(year: y, month: m, day: d))
    }

    static func iso(_ date: Date) -> String {
        let c = utcCalendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    /// 当地的「今天」
    static func today(now: Date = Date(), timeZone: TimeZone = .current) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    static func add(_ iso: String, days: Int) -> String {
        guard let d = parse(iso), let r = utcCalendar.date(byAdding: .day, value: days, to: d) else { return iso }
        return DayMath.iso(r)
    }

    /// b − a（天）
    static func diff(_ a: String, _ b: String) -> Int {
        guard let da = parse(a), let db = parse(b) else { return 0 }
        return Int(((db.timeIntervalSince(da)) / 86_400).rounded())
    }

    /// 本地时区的当天中午（给 FormatStyle 显示用）
    static func localNoon(_ iso: String) -> Date {
        let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date() }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        return cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)) ?? Date()
    }

    /// 本地时间 "HH:MM"
    static func clock(now: Date = Date(), timeZone: TimeZone = .current) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.hour, .minute], from: now)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }

    /// "YYYY-MM-DD" 的 年 / 月 / 日
    static func components(_ iso: String) -> (year: Int, month: Int, day: Int)? {
        let p = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return (p[0], p[1], p[2])
    }

    static func make(year: Int, month: Int, day: Int) -> String? {
        guard let d = utcCalendar.date(from: DateComponents(year: year, month: month, day: day)) else { return nil }
        let back = iso(d)
        // 2 月 30 日这类无效日期会被日历进位，按无效处理
        guard back == String(format: "%04d-%02d-%02d", year, month, day) else { return nil }
        return back
    }

    /// 星期几（1 = 周日 … 7 = 周六）
    static func weekday(_ iso: String) -> Int {
        guard let d = parse(iso) else { return 1 }
        return utcCalendar.component(.weekday, from: d)
    }
}

/// 界面上的日期、时长、距离：一律走 FormatStyle，跟随当前语言
enum Fmt {
    static func monthDay(_ iso: String) -> String {
        DayMath.localNoon(iso).formatted(.dateTime.month(.abbreviated).day())
    }

    static func fullDate(_ iso: String) -> String {
        DayMath.localNoon(iso).formatted(.dateTime.year().month(.abbreviated).day())
    }

    static func span(_ a: String, _ b: String) -> String {
        let d1 = DayMath.localNoon(a), d2 = DayMath.localNoon(b)
        guard d2 > d1 else { return monthDay(a) }
        return (d1..<d2).formatted(.interval.month(.abbreviated).day())
    }

    static func duration(_ minutes: Int) -> String {
        guard minutes > 0 else { return "" }
        return Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))
    }

    static func km(_ value: Double) -> String {
        let nf = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(0...(value >= 100 ? 0 : 1)))
        return Measurement(value: value, unit: UnitLength.kilometers)
            .formatted(.measurement(width: .abbreviated, usage: .asProvided, numberFormatStyle: nf))
    }

    static func number(_ n: Int) -> String { n.formatted() }
}
