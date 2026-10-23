import Foundation

/// 一件待办在整本书里的位置（给总表与首页「最近一件」用）
struct TodoRef: Identifiable, Hashable, Sendable {
    let tripID: String
    let dayIndex: Int
    let dayDate: String
    let entryID: String
    let placeName: String
    let todo: Todo
    /// 该做完的日期：待办自己的 due，没有就按出发日
    let due: String

    var id: String { "\(entryID)/\(todo.id)" }
}

/// 待办（第八轮，shared/algo/todos.ts 的原生版）：规划时给站点记一件要提前做的事，比如「提前一个月买门票」。
/// 待办挂在站点上（PlaceEntry.todos）。这里只有纯函数：按「提前几天」算日期、列出整本书的待办、找最近要做的一件。
enum Todos {
    /// 添加时可选的「提前几天」：一个月、两周、一周、一天、当天
    static let leadDays = [30, 14, 7, 1, 0]

    static func dueFromLead(dayDate: String, lead: Int) -> String { DayMath.add(dayDate, days: -lead) }

    static func leadName(_ lead: Int) -> String {
        switch lead {
        case 30: return String(localized: "提前 1 个月")
        case 14: return String(localized: "提前 2 周")
        case 7: return String(localized: "提前 1 周")
        case 1: return String(localized: "提前 1 天")
        default: return String(localized: "当天")
        }
    }

    /// 整本书的待办，按到期日、再按天排序
    static func all(_ trip: Trip) -> [TodoRef] {
        var out: [TodoRef] = []
        for (dayIndex, d) in trip.days.enumerated() {
            for e in d.entries {
                guard case .place(let p) = e, let todos = p.todos, !todos.isEmpty else { continue }
                for td in todos {
                    out.append(TodoRef(tripID: trip.id, dayIndex: dayIndex, dayDate: d.date, entryID: p.id, placeName: p.name, todo: td, due: td.due ?? trip.startDate))
                }
            }
        }
        return out.sorted { a, b in a.due == b.due ? a.dayIndex < b.dayIndex : a.due < b.due }
    }

    static func open(_ trip: Trip) -> [TodoRef] { all(trip).filter { $0.todo.done != true } }

    /// 一个站点自己的待办（提示跟着站点走，不汇总到整个行程）：没做完的数量，以及最近要做的一件
    static func ofPlace(_ p: PlaceEntry, fallbackDue: String, today: String? = nil) -> (open: Int, next: (todo: Todo, due: String)?) {
        let open = (p.todos ?? []).filter { $0.done != true }.map { (todo: $0, due: $0.due ?? fallbackDue) }.sorted { $0.due < $1.due }
        let next = (today.flatMap { t in open.first(where: { $0.due >= t }) }) ?? open.first
        return (open.count, next)
    }

    /// 最近要做的一件：今天起最早到期的；都已经过期就是最早那件（提醒它漏了）
    static func next(_ trip: Trip, today: String?) -> TodoRef? {
        let o = open(trip)
        if let today, let hit = o.first(where: { $0.due >= today }) { return hit }
        return o.first
    }
}
