import Foundation

/// shared/algo/transport.ts：从用户写的交通名字猜方式
enum TransportClassifier {
    private static func re(_ p: String) -> NSRegularExpression? { try? NSRegularExpression(pattern: JSRegex.compatible(p), options: [.caseInsensitive]) }
    private static let rail = re(#"(JR|近铁|新干线|南海|阪急|阪神|京阪|新快速|关空|电车|列车|火车|铁路|铁道|线(?!路)|train|rail)"#)
    private static let subway = re(#"(地铁|地下铁|metro|subway)"#)
    private static let bus = re(#"(巴士|公交|公车|bus)"#)
    private static let ship = re(#"(船|渡轮|渡船|ferry|boat)"#)
    private static let taxi = re(#"(出租|计程|的士|taxi|打车|网约车)"#)
    private static let car = re(#"(自驾|租车|开车|驾车|drive|car\b)"#)
    private static let flight = re(#"(飞机|航班|✈|flight|fly)"#)

    static func classify(_ label: String) -> TransportMode {
        if JSRegex.test(flight, label) { return .flight }
        if JSRegex.test(subway, label) { return .subway }
        if JSRegex.test(bus, label) { return .bus }
        if JSRegex.test(ship, label) { return .ship }
        if JSRegex.test(taxi, label) { return .taxi }
        if JSRegex.test(car, label) { return .car }
        if JSRegex.test(rail, label) { return .rail }
        return .walk
    }
}

extension TransportMode {
    /// SF Symbol
    var symbol: String {
        switch self {
        case .walk: return "figure.walk"
        case .rail: return "tram"
        case .subway: return "tram.fill"
        case .bus: return "bus"
        case .ship: return "ferry"
        case .taxi: return "car"
        case .car: return "car"
        case .flight: return "airplane"
        }
    }

    var localizedName: String {
        switch self {
        case .walk: return String(localized: "步行")
        case .rail: return String(localized: "铁路")
        case .subway: return String(localized: "地铁")
        case .bus: return String(localized: "巴士")
        case .ship: return String(localized: "船")
        case .taxi: return String(localized: "出租车")
        case .car: return String(localized: "自驾")
        case .flight: return String(localized: "飞机")
        }
    }
}

extension PlaceCategory {
    var localizedName: String {
        switch self {
        case .sight: return String(localized: "景点")
        case .food: return String(localized: "吃饭")
        case .shop: return String(localized: "购物")
        case .station: return String(localized: "车站")
        case .airport: return String(localized: "机场")
        case .port: return String(localized: "港口")
        case .hotel: return String(localized: "住处")
        case .other: return String(localized: "其他")
        }
    }
}

/// 让 NSRegularExpression 的行为贴近 JavaScript：JS 的 \b 只认 ASCII 单词字符（汉字算非单词字符），ICU 的 \b 把汉字也当字母。
enum JSRegex {
    private static let asciiWordBoundary = #"(?:(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?=[A-Za-z0-9_]))"#

    static func compatible(_ pattern: String) -> String {
        pattern.replacingOccurrences(of: #"\b"#, with: asciiWordBoundary)
    }

    static func test(_ re: NSRegularExpression?, _ s: String) -> Bool {
        guard let re else { return false }
        return re.firstMatch(in: s, options: [], range: NSRange(s.startIndex..., in: s)) != nil
    }
}
