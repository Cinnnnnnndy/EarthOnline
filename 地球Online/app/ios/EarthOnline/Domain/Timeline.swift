import Foundation

/// shared/algo/timeline.ts：一天的时间线——按条目顺序推算到达 / 离开时刻，交通累加时长，站点按计划时间校准
struct TimelineItem: Hashable, Sendable {
    let entryID: String
    let start: String
    let end: String
    let minutes: Int
}

struct DayTimeline: Sendable {
    let items: [TimelineItem]
    let walkMinutes: Int
    let transitMinutes: Int
    let stayMinutes: Int
    let firstStart: String
    let lastEnd: String

    func item(_ entryID: String) -> TimelineItem? { items.first { $0.entryID == entryID } }
}

enum Timeline {
    static let defaultStay = 75
    static let defaultStart = "09:00"

    static func minutesOf(_ hhmm: String) -> Int {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2 else { return 0 }
        return p[0] * 60 + p[1]
    }

    static func addMinutes(_ hhmm: String, _ min: Int) -> String {
        let t = ((minutesOf(hhmm) + min) % 1440 + 1440) % 1440
        return String(format: "%02d:%02d", t / 60, t % 60)
    }

    static func build(_ day: Day) -> DayTimeline {
        var items: [TimelineItem] = []
        var walk = 0, transit = 0, stay = 0
        let entries = day.entries
        let firstPlannedIndex = entries.firstIndex { ($0.place?.plannedStart).map { !$0.isEmpty } ?? false }
        var clock = firstPlannedIndex.flatMap { entries[$0].place?.plannedStart } ?? defaultStart
        // 第一个有计划时间的站点之前的交通：从它倒推（没有这样的站点时，与 TS 一致：累加全部交通）
        var pre = 0
        for (i, e) in entries.enumerated() {
            if let firstPlannedIndex, i == firstPlannedIndex { break }
            if let t = e.transport { pre += t.durationMinutes ?? 0 }
        }
        clock = addMinutes(clock, -pre)
        for i in entries.indices {
            switch entries[i] {
            case .transport(let t):
                let m = t.durationMinutes ?? 0
                items.append(TimelineItem(entryID: t.id, start: clock, end: addMinutes(clock, m), minutes: m))
                if t.mode == .walk { walk += m } else { transit += m }
                clock = addMinutes(clock, m)
            case .place(let p):
                if let ps = p.plannedStart, !ps.isEmpty, minutesOf(ps) > minutesOf(clock) { clock = ps }
                var m = p.stayMinutes ?? 0
                if (p.stayMinutes ?? 0) == 0 {
                    // 下一个有计划时间的站点减去途中交通，得到停留；没有就用默认
                    var travel = 0
                    var next: PlaceEntry?
                    var j = i + 1
                    while j < entries.count {
                        if let f = entries[j].transport { travel += f.durationMinutes ?? 0 }
                        if let f = entries[j].place { next = f; break }
                        j += 1
                    }
                    if let nps = next?.plannedStart, !nps.isEmpty {
                        m = max(20, minutesOf(nps) - minutesOf(clock) - travel)
                    } else {
                        m = defaultStay
                    }
                }
                items.append(TimelineItem(entryID: p.id, start: clock, end: addMinutes(clock, m), minutes: m))
                stay += m
                clock = addMinutes(clock, m)
            case .lodging(let l):
                items.append(TimelineItem(entryID: l.id, start: clock, end: clock, minutes: 0))
            }
        }
        return DayTimeline(items: items, walkMinutes: walk, transitMinutes: transit, stayMinutes: stay,
                           firstStart: items.first?.start ?? defaultStart, lastEnd: items.last?.end ?? defaultStart)
    }

    /// 下一站：当前时刻之后开始的第一个站点（today 的 "HH:MM"）；都过了返回 nil
    static func nextStop(_ day: Day, after clock: String) -> (place: PlaceEntry, time: String)? {
        let tl = build(day)
        let now = minutesOf(clock)
        for p in day.places {
            guard let it = tl.item(p.id) else { continue }
            if minutesOf(it.start) >= now, p.visited != true { return (p, it.start) }
        }
        return nil
    }
}
