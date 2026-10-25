import Foundation
import SwiftUI

/// 本地存储：先存本机（Codable JSON，Application Support），Pro 开了 iCloud 同步再与 CloudKit 私有库合并。
/// 所有修改都走这里的方法：改完立即更新界面，写盘做 0.3 秒去抖。
@MainActor
final class TripStore: ObservableObject {
    @Published private(set) var state: PersistedState
    /// 截图 / 预览模式：只在内存里，不写盘
    let isEphemeral: Bool
    private let fileURL: URL
    private var saveTask: Task<Void, Never>?

    init(ephemeral: PersistedState? = nil) {
        fileURL = TripStore.defaultFileURL()
        if let ephemeral {
            state = ephemeral
            isEphemeral = true
        } else {
            state = TripStore.load(from: fileURL) ?? PersistedState()
            isEphemeral = false
        }
    }

    // MARK: - 读

    var trips: [Trip] { state.trips }
    var avatar: Avatar { state.avatar }
    var home: HomePlace? { state.home }
    var pins: [ManualFlag] { state.pins }
    var planted: [String] { state.planted }

    var settings: AppSettings {
        get { state.settings }
        set { state.settings = newValue; scheduleSave() }
    }

    func trip(_ id: String) -> Trip? { state.trips.first { $0.id == id } }

    // MARK: - 书

    @discardableResult
    func insert(_ trip: Trip) -> Trip {
        var t = trip
        if state.trips.contains(where: { $0.id == t.id }) { t.id = "\(t.id)-\(TripFactory.base36(Date().millis))" }
        state.trips.insert(t, at: 0)
        state.deletedTripIDs.removeAll { $0 == t.id }
        scheduleSave()
        return t
    }

    var samplesInstalled: Bool { state.samplesInstalled }

    /// 第一次启动的示例（D100）：按给的顺序放在书架最前，已有同 id 的不重复装；只装一次。
    /// 和鸿蒙、安卓一样直接放进去、不走付费墙，但它们照常占名额（与网页一致）
    func installSamples(_ trips: [Trip]) {
        guard !state.samplesInstalled else { return }
        let fresh = trips.filter { t in !state.trips.contains { $0.id == t.id } }
        state.trips.insert(contentsOf: fresh, at: 0)
        state.samplesInstalled = true
        scheduleSave()
    }

    /// 同 id 的替换，否则插到最前（导入行程页时用）
    func upsert(_ trip: Trip) {
        if let i = state.trips.firstIndex(where: { $0.id == trip.id }) { state.trips[i] = trip } else { state.trips.insert(trip, at: 0) }
        scheduleSave()
    }

    func update(_ id: String, _ body: (inout Trip) -> Void) {
        guard let i = state.trips.firstIndex(where: { $0.id == id }) else { return }
        var t = state.trips[i]
        body(&t)
        t.updatedAt = ISO8601.now()
        state.trips[i] = t
        scheduleSave()
    }

    func delete(_ id: String) {
        state.trips.removeAll { $0.id == id }
        if !state.deletedTripIDs.contains(id) { state.deletedTripIDs.append(id) }
        scheduleSave()
    }

    func deleteAll() {
        state.deletedTripIDs.append(contentsOf: state.trips.map(\.id))
        state.trips = []
        scheduleSave()
    }

    /// 同步合并的结果整体替换（不改 updatedAt）
    func replaceTrips(_ trips: [Trip], clearTombstones: Bool) {
        state.trips = trips
        if clearTombstones { state.deletedTripIDs = [] }
        scheduleSave()
    }

    // MARK: - 某一天的条目

    func setDayMeta(_ tripID: String, day: Int, title: String? = nil, lodging: String?? = nil, diary: String?? = nil) {
        update(tripID) { t in
            guard t.days.indices.contains(day) else { return }
            if let title { t.days[day].title = title }
            if let lodging { t.days[day].lodging = lodging }
            if let diary { t.days[day].diary = diary }
        }
    }

    func addEntry(_ tripID: String, day: Int, entry: Entry, after afterID: String? = nil) {
        update(tripID) { t in
            guard t.days.indices.contains(day) else { return }
            let e = entry.withID(TripStore.newEntryID(t.days[day]))
            if let afterID, let i = t.days[day].entries.firstIndex(where: { $0.id == afterID }) {
                t.days[day].entries.insert(e, at: i + 1)
            } else {
                t.days[day].entries.append(e)
            }
        }
    }

    func replaceEntry(_ tripID: String, day: Int, entry: Entry) {
        update(tripID) { t in
            guard t.days.indices.contains(day), let i = t.days[day].entries.firstIndex(where: { $0.id == entry.id }) else { return }
            t.days[day].entries[i] = entry
        }
    }

    func removeEntry(_ tripID: String, day: Int, entryID: String) {
        update(tripID) { t in
            guard t.days.indices.contains(day) else { return }
            t.days[day].entries.removeAll { $0.id == entryID }
        }
    }

    func moveEntries(_ tripID: String, day: Int, from: IndexSet, to: Int) {
        update(tripID) { t in
            guard t.days.indices.contains(day) else { return }
            t.days[day].entries.move(fromOffsets: from, toOffset: to)
        }
    }

    func setVisited(_ tripID: String, day: Int, entryID: String, visited: Bool) {
        update(tripID) { t in
            guard t.days.indices.contains(day), let i = t.days[day].entries.firstIndex(where: { $0.id == entryID }),
                  case .place(var p) = t.days[day].entries[i] else { return }
            p.visited = visited ? true : nil
            p.visitedAt = visited ? ISO8601.now() : nil
            t.days[day].entries[i] = .place(p)
        }
    }

    // MARK: - 待办（第八轮）：挂在站点上

    private func updatePlace(_ tripID: String, day: Int, entryID: String, _ body: (inout PlaceEntry) -> Void) {
        update(tripID) { t in
            guard t.days.indices.contains(day), let i = t.days[day].entries.firstIndex(where: { $0.id == entryID }),
                  case .place(var p) = t.days[day].entries[i] else { return }
            body(&p)
            t.days[day].entries[i] = .place(p)
        }
    }

    /// 备注（第八轮续：站点详情里点「添加备注」进来写；空字符串当作没有）
    /// 行李箱的增减（D82）：藏起来的、从库里挑的、照片卡
    func setSuitcaseEdits(_ tripID: String, _ body: (inout CaseEdits) -> Void) {
        update(tripID) { t in
            var e = t.suitcase ?? CaseEdits()
            body(&e)
            t.suitcase = (e.hidden?.isEmpty ?? true) && (e.picks?.isEmpty ?? true) && (e.gear?.isEmpty ?? true) && (e.cards?.isEmpty ?? true) ? nil : e
        }
    }

    func setNotes(_ tripID: String, day: Int, entryID: String, _ notes: String?) {
        updatePlace(tripID, day: day, entryID: entryID) { p in p.notes = (notes?.isEmpty ?? true) ? nil : notes }
    }

    func addTodo(_ tripID: String, day: Int, entryID: String, text: String, due: String?) {
        updatePlace(tripID, day: day, entryID: entryID) { p in
            var list = p.todos ?? []
            list.append(Todo(id: "td-\(Int(Date().timeIntervalSince1970))-\(list.count)", text: text, due: due, done: nil))
            p.todos = list
        }
    }

    func setTodoDone(_ tripID: String, day: Int, entryID: String, todoID: String, done: Bool) {
        updatePlace(tripID, day: day, entryID: entryID) { p in
            guard var list = p.todos, let i = list.firstIndex(where: { $0.id == todoID }) else { return }
            list[i].done = done ? true : nil
            p.todos = list
        }
    }

    func removeTodo(_ tripID: String, day: Int, entryID: String, todoID: String) {
        updatePlace(tripID, day: day, entryID: entryID) { p in
            p.todos = p.todos?.filter { $0.id != todoID }
            if p.todos?.isEmpty == true { p.todos = nil }
        }
    }

    static func newEntryID(_ d: Day) -> String {
        var n = d.entries.count
        while d.entries.contains(where: { $0.id == "d\(d.index)-e\(n)" }) { n += 1 }
        return "d\(d.index)-e\(n)"
    }

    // MARK: - 小人、家与足迹

    func setAvatar(_ a: Avatar) { state.avatar = a; scheduleSave() }
    func setHome(_ h: HomePlace?) { state.home = h; scheduleSave() }

    @discardableResult
    func addPin(name: String, lat: Double, lng: Double) -> ManualFlag {
        let f = ManualFlag(id: "pin-\(TripFactory.base36(Date().millis))", name: name, lat: lat, lng: lng, date: nil)
        state.pins.append(f)
        scheduleSave()
        return f
    }

    func removePin(_ id: String) {
        state.pins.removeAll { $0.id == id }
        state.planted.removeAll { $0 == id }
        scheduleSave()
    }

    func markPlanted(_ ids: [String]) {
        var set = Set(state.planted)
        for i in ids where !set.contains(i) { state.planted.append(i); set.insert(i) }
        scheduleSave()
    }

    // MARK: - 写盘

    private func scheduleSave() {
        guard !isEphemeral else { return }
        saveTask?.cancel()
        saveTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }

    func saveNow() {
        guard !isEphemeral else { return }
        saveTask?.cancel()
        saveTask = nil
        do {
            let enc = JSONEncoder()
            enc.outputFormatting = [.sortedKeys]
            let data = try enc.encode(state)
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            #if DEBUG
            print("TripStore save failed: \(error)")
            #endif
        }
    }

    private static func defaultFileURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return base.appendingPathComponent("EarthOnline", isDirectory: true).appendingPathComponent("state.json")
    }

    private static func load(from url: URL) -> PersistedState? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(PersistedState.self, from: data)
    }
}

enum ISO8601 {
    static func now() -> String { string(Date()) }
    static func string(_ d: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: d)
    }
}

extension Date {
    var millis: Int { Int((timeIntervalSince1970 * 1000).rounded()) }
}
