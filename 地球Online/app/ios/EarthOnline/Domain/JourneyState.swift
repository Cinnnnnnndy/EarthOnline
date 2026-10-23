import Foundation

/// 一本书相对「今天」处在哪一段
enum TripPhase: Equatable, Sendable {
    /// 旅行中；dayIndex 从 0 起
    case traveling(dayIndex: Int)
    /// 还没出发；inDays ≥ 1
    case upcoming(inDays: Int)
    /// 已经结束（按日期）；daysAgo ≥ 1
    case ended(daysAgo: Int)
    /// 书合上了（手动）
    case closed(daysAgo: Int)
}

extension Trip {
    func phase(today: String) -> TripPhase {
        let sinceEnd = DayMath.diff(endDate, today)
        if status == .closed { return .closed(daysAgo: max(0, sinceEnd)) }
        let untilStart = DayMath.diff(today, startDate)
        if untilStart > 0 { return .upcoming(inDays: untilStart) }
        if sinceEnd > 0 { return .ended(daysAgo: sinceEnd) }
        let exact = days.firstIndex { $0.date == today }
        let offset = min(max(0, -untilStart), max(0, days.count - 1))
        return .traveling(dayIndex: exact ?? offset)
    }

    /// 今天是这本书的第几天（0 起），不在旅途中为 nil
    func isTravelingNow(today: String) -> Bool { if case .traveling = phase(today: today) { return true }; return false }

    func todayIndex(today: String) -> Int? {
        if case .traveling(let i) = phase(today: today) { return i }
        return nil
    }
}

/// 首页讲的是「用户旅程的哪一步」：旅行中 / 快出发 / 刚回来 / 平常日子。与网页版首页的判断一致。
enum JourneyState: Equatable, Sendable {
    case traveling(tripID: String, dayIndex: Int)
    case departing(tripID: String, inDays: Int)
    case justBack(tripID: String, daysAgo: Int)
    case idle(next: UpcomingTrip?)

    static let departWindow = 3
    static let backWindow = 7

    static func compute(trips: [Trip], today: String) -> JourneyState {
        var traveling: [(Trip, Int)] = []
        var upcoming: [(Trip, Int)] = []
        var back: [(Trip, Int)] = []
        for t in trips {
            switch t.phase(today: today) {
            case .traveling(let i): traveling.append((t, i))
            case .upcoming(let n): upcoming.append((t, n))
            case .ended(let n): if n <= backWindow { back.append((t, n)) }
            case .closed(let n):
                // 合上的书：结束日期在最近 7 天内（或提前合上）也算刚回来
                if n <= backWindow, DayMath.diff(t.startDate, today) >= 0 { back.append((t, n)) }
            }
        }
        if let t = traveling.sorted(by: { $0.0.startDate < $1.0.startDate }).first {
            return .traveling(tripID: t.0.id, dayIndex: t.1)
        }
        let soonest = upcoming.sorted { $0.1 < $1.1 || ($0.1 == $1.1 && $0.0.title < $1.0.title) }
        if let t = soonest.first, t.1 <= departWindow {
            return .departing(tripID: t.0.id, inDays: t.1)
        }
        if let t = back.sorted(by: { $0.1 < $1.1 }).first {
            return .justBack(tripID: t.0.id, daysAgo: t.1)
        }
        return .idle(next: soonest.first.map { UpcomingTrip(tripID: $0.0.id, inDays: $0.1) })
    }

    /// 地球要聚焦的书（平常日子聚焦在家）
    var focusedTripID: String? {
        switch self {
        case .traveling(let id, _), .departing(let id, _), .justBack(let id, _): return id
        case .idle: return nil
        }
    }

    /// 「今天出发 / 明天出发 / 后天出发 / N 天后出发」
    static func departLabel(_ inDays: Int) -> String {
        switch inDays {
        case ...0: return String(localized: "今天出发")
        case 1: return String(localized: "明天出发")
        case 2: return String(localized: "后天出发")
        default:
            let nDays = inDays
            return String(localized: "\(nDays) 天后出发")
        }
    }
}

struct UpcomingTrip: Equatable, Sendable {
    let tripID: String
    let inDays: Int
}

extension Trip {
    /// 书的状态文字（列表右侧、书页状态行）
    func statusText(today: String) -> String {
        switch phase(today: today) {
        case .traveling(let i):
            let nDay = days.indices.contains(i) ? days[i].index : i + 1
            return "D\(nDay)"   // 标签要短
        case .upcoming(let n): return JourneyState.departLabel(n)
        case .ended: return String(localized: "已结束")
        case .closed: return String(localized: "已合上")
        }
    }
}
