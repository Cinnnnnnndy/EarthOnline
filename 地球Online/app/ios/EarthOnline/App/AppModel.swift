import SwiftUI

/// 地球上的三种「舞台」：首页（我的旅程）→ 一本书 → 某一天（潜入微缩世界）。世界层常驻，舞台切换只换模式和相机。
enum Stage: Equatable {
    case home
    case book(String)
    case day(String, Int)

    var tripID: String? {
        switch self {
        case .home: return nil
        case .book(let id), .day(let id, _): return id
        }
    }

    var isDay: Bool { if case .day = self { return true }; return false }
}

/// 压栈的整页（不显示地球的列表页）
enum AppPage: Hashable {
    case settings, diary(String), footprints, shelf, avatar
}

/// 底部弹出的面板
enum AppSheet: Identifiable, Equatable {
    case newTrip(NewTripTab)
    case paywall(ProFeature)
    case stop(tripID: String, day: Int, entryID: String)
    case editDay(tripID: String, day: Int)
    case entry(tripID: String, day: Int, entryID: String?, type: EntryKind)

    var id: String {
        switch self {
        case .newTrip(let t): return "new-\(t.rawValue)"
        case .paywall(let f): return "pay-\(f.rawValue)"
        case .stop(let t, let d, let e): return "stop-\(t)-\(d)-\(e)"
        case .editDay(let t, let d): return "edit-\(t)-\(d)"
        case .entry(let t, let d, let e, let k): return "entry-\(t)-\(d)-\(e ?? "new")-\(k.rawValue)"
        }
    }
}

enum NewTripTab: String, CaseIterable, Identifiable {
    case voice, destination, importFile
    var id: String { rawValue }
}

enum EntryKind: String, CaseIterable { case place, transport, lodging }

/// 在地球上点选的用途
enum PickPurpose { case home, pin }

/// 启动参数（UserDefaults 的参数域会读 `-key value`）
struct LaunchOptions {
    var screenshot: SampleTrips.Scenario?
    var proUnlocked: Bool

    static func current() -> LaunchOptions {
        let d = UserDefaults.standard
        return LaunchOptions(screenshot: d.string(forKey: "screenshotState").flatMap(SampleTrips.Scenario.init(rawValue:)),
                             proUnlocked: d.bool(forKey: "proUnlocked"))
    }
}

/// 应用的协调者：导航、面板、提示、与世界层的同步
@MainActor
final class AppModel: ObservableObject {
    @Published var stage: Stage = .home
    @Published var path: [AppPage] = []
    @Published var sheet: AppSheet?
    @Published private(set) var toastText: String?
    @Published var picking: PickPurpose?
    /// 书页里选中的那一天（地球上点了某一天也会设置它）
    @Published var bookDay: Int?
    /// 每分钟走一次的钟（天色、「下一站」、今天）
    @Published private(set) var clock = Date()
    /// 某一天的世界里：小人到过的最后一站（route.stops 的下标）、今天走完了没有
    @Published var heroStop: Int?
    @Published var dayFinished = false
    @Published var playing = true

    let store: TripStore
    let world: WorldController
    let purchases: StoreService
    let sync: CloudSyncService
    let voice = SpeechVoice()
    let launch: LaunchOptions

    private var toastToken = 0
    private var tickTask: Task<Void, Never>?
    private var pushTask: Task<Void, Never>?
    /// 上一次发给世界层的那一天的「形状」（条目、顺序、名字、坐标）；只有形状变了才重建底板
    private var lastDaySignature: String?

    init(launch: LaunchOptions) {
        self.launch = launch
        if let s = launch.screenshot {
            var st = PersistedState()
            st.trips = SampleTrips.make(s)
            st.home = HomePlace(name: String(localized: "上海"), lat: 31.2304, lng: 121.4737)
            store = TripStore(ephemeral: st)
        } else {
            store = TripStore()
        }
        world = WorldController()
        purchases = StoreService(debugPro: launch.proUnlocked)
        sync = CloudSyncService()
        world.onEvent = { [weak self] e in self?.handle(e) }
        tickTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                self?.clock = Date()
            }
        }
        pushWorldState(animate: false)
        enterStage(.home, animate: false)
    }

    // MARK: - 派生

    var today: String { DayMath.today(now: clock) }
    var journey: JourneyState { JourneyState.compute(trips: store.trips, today: today) }
    var entitlements: Entitlements { purchases.entitlements }

    /// 家（没设家时：时区推出的经度、纬度 30°）
    var homePoint: (lat: Double, lng: Double) {
        if let h = store.home { return (h.lat, h.lng) }
        return Daylight.guessPlace(date: clock)
    }

    // MARK: - 舞台

    func goHome() {
        bookDay = nil
        enterStage(.home, animate: true)
    }

    func openBook(_ id: String, day: Int? = nil) {
        guard store.trip(id) != nil else { return }
        path = []
        bookDay = day
        enterStage(.book(id), animate: true)
    }

    func openDay(_ id: String, _ index: Int) {
        guard let t = store.trip(id), t.days.indices.contains(index) else { return }
        path = []
        enterStage(.day(id, index), animate: true)
    }

    func openDiary(_ id: String) { path = [.diary(id)] }
    func show(_ page: AppPage) { path.append(page) }

    private func enterStage(_ s: Stage, animate: Bool) {
        stage = s
        switch s {
        case .home:
            world.send(WorldMsg.ShowGlobe())
            focusHome(animate: animate)
        case .book(let id):
            world.send(WorldMsg.ShowGlobe())
            if let d = bookDay { world.send(WorldMsg.FocusDay(id: id, dayIndex: d, animate: animate)) }
            else { world.send(WorldMsg.FocusBook(id: id, animate: animate)) }
        case .day(let id, let i):
            guard let t = store.trip(id) else { return }
            heroStop = nil
            dayFinished = false
            playing = true
            lastDaySignature = AppModel.signature(t.days[i])
            world.send(WorldMsg.SetAvatar(avatar: store.avatar))
            world.send(WorldMsg.SetPost(level: store.settings.post))
            world.send(WorldMsg.ShowDay(trip: t, dayIndex: i))
            world.send(WorldMsg.SetView(pitch: 30, follow: true))
            world.send(WorldMsg.Play())
        }
    }

    /// 首页相机：有「现在」的书就聚焦它，平常日子回到家
    func focusHome(animate: Bool) {
        if let id = journey.focusedTripID {
            world.send(WorldMsg.FocusBook(id: id, animate: animate))
        } else {
            let p = homePoint
            world.send(WorldMsg.FocusHome(lat: p.lat, lng: p.lng, animate: animate))
        }
    }

    func selectBookDay(_ day: Int?) {
        guard case .book(let id) = stage else { return }
        bookDay = day
        if let day { world.send(WorldMsg.FocusDay(id: id, dayIndex: day, animate: true)) }
        else { world.send(WorldMsg.FocusBook(id: id, animate: true)) }
    }

    // MARK: - 世界层同步

    /// 书、家、足迹有变化时推给世界层（去抖 0.4 秒）
    func tripsChanged() {
        pushTask?.cancel()
        pushTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            self?.pushWorldState(animate: true)
        }
    }

    func pushWorldState(animate: Bool) {
        world.send(WorldMsg.SetTrips(trips: store.trips, today: today))
        world.send(WorldMsg.SetHome(home: store.home))
        let fps = Footprints.compute(trips: store.trips, manual: store.pins, today: today)
        let planted = Set(store.planted)
        world.send(WorldMsg.SetFootprints(flags: fps.map { WorldMsg.SetFootprints.Flag(id: $0.id, name: $0.name, lat: $0.lat, lng: $0.lng) },
                                          fresh: fps.map(\.id).filter { !planted.contains($0) }))
        world.send(WorldMsg.SetPalette(palette: store.settings.palette))
        if case .day(let id, let i) = stage, let t = store.trip(id), t.days.indices.contains(i) {
            // 某一天的条目改了（增删、改名、挪顺序、改坐标）才让世界层重建路线；打卡只发 mark-visited
            let sig = AppModel.signature(t.days[i])
            if sig != lastDaySignature {
                lastDaySignature = sig
                world.send(WorldMsg.ShowDay(trip: t, dayIndex: i))
            }
        }
    }

    static func signature(_ d: Day) -> String {
        d.entries.map { e -> String in
            switch e {
            case .place(let p): return "p|\(p.id)|\(p.name)|\(p.category.rawValue)|\(p.kind ?? "")|\(p.geo?.lat ?? 0),\(p.geo?.lng ?? 0)|\(p.plannedStart ?? "")"
            case .transport(let t): return "t|\(t.id)|\(t.mode.rawValue)|\(t.label)|\(t.durationMinutes ?? 0)|\(t.polyline?.count ?? 0)"
            case .lodging(let l): return "l|\(l.id)|\(l.name)"
            }
        }.joined(separator: ";") + "#\(d.city)"
    }

    /// 打卡：改数据，并让世界层里那一站的标牌变成「去过」
    func setVisited(_ tripID: String, day: Int, entryID: String, visited: Bool) {
        store.setVisited(tripID, day: day, entryID: entryID, visited: visited)
        world.send(WorldMsg.MarkVisited(entryId: entryID, visited: visited))
    }

    func handle(_ e: WorldEvent) {
        switch e {
        case .heroArrived(let i, _):
            heroStop = i
        case .dayFinished:
            dayFinished = true
        case .bookTapped(let id):
            if case .day = stage { return }
            openBook(id)
        case .dayTapped(let id, let d):
            if case .book(let cur) = stage, cur == id { selectBookDay(d) } else { openBook(id, day: d) }
        case .pointPicked(let lat, let lng):
            finishPick(lat: lat, lng: lng)
        case .flagsPlanted(let ids):
            store.markPlanted(ids)
            if case .home = stage, !ids.isEmpty {
                let nPlaces = ids.count
                showToast(String(localized: "新增 \(nPlaces) 个去过的地方"))
            }
        default:
            break
        }
    }

    // MARK: - 在地球上点选（放家 / 补旗）

    func startPick(_ p: PickPurpose) {
        path = []
        sheet = nil
        if case .day = stage { enterStage(.home, animate: true) }
        picking = p
        world.send(WorldMsg.PickPoint(on: true))
    }

    func cancelPick() {
        picking = nil
        world.send(WorldMsg.PickPoint(on: false))
    }

    private func finishPick(lat: Double, lng: Double) {
        guard let p = picking else { return }
        picking = nil
        world.send(WorldMsg.PickPoint(on: false))
        switch p {
        case .home:
            let name = Gazetteer.nearest(lat: lat, lng: lng)?.displayName() ?? String(localized: "我的家")
            store.setHome(HomePlace(name: name, lat: lat, lng: lng))
            showToast(String(localized: "家：\(name)"))
        case .pin:
            let name = Gazetteer.nearest(lat: lat, lng: lng, maxKm: 60, kinds: [.city, .poi])?.displayName() ?? Coord.name(lat: lat, lng: lng)
            store.addPin(name: name, lat: lat, lng: lng)
            showToast(String(localized: "已添加：\(name)"))
        }
        world.send(WorldMsg.FlyTo(lat: lat - 6, lng: lng, alt: 1.3))
    }

    // MARK: - 新建、导入、付费墙

    /// 加入新书；免费版超过 3 本时停下并返回 false（调用方弹付费墙）
    @discardableResult
    func addTrips(_ trips: [Trip]) -> [Trip] {
        var added: [Trip] = []
        for t in trips {
            guard entitlements.canAddTrip(currentCount: store.trips.count) else { break }
            added.append(store.insert(t))
        }
        return added
    }

    var canAddTrip: Bool { entitlements.canAddTrip(currentCount: store.trips.count) }

    func requestPaywall(_ f: ProFeature) { sheet = .paywall(f) }

    /// 从「文件」/ 分享面板打开的 JSON
    func openFile(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            let trips = try TripImporter.decode(data)
            let added = addTrips(trips)
            if added.count < trips.count { requestPaywall(.unlimitedTrips) }
            if let first = added.first {
                let nBooks = added.count
                showToast(String(localized: "导入了 \(nBooks) 本旅程"))
                openBook(first.id)
            }
        } catch {
            showToast(String(localized: "导入失败：\(error.localizedDescription)"))
        }
    }

    // MARK: - 同步

    func syncNow() async {
        await sync.sync(store: store, entitled: entitlements.allows(.iCloudSync))
    }

    // MARK: - 提示

    func showToast(_ text: String) {
        toastToken += 1
        let token = toastToken
        withAnimation(.snappy) { toastText = text }
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(2600))
            guard let self, self.toastToken == token else { return }
            withAnimation(.snappy) { self.toastText = nil }
        }
    }
}

/// 「北纬 64.1°，西经 21.9°」
enum Coord {
    static func name(lat: Double, lng: Double) -> String {
        let a = abs(lat).formatted(.number.precision(.fractionLength(1)))
        let b = abs(lng).formatted(.number.precision(.fractionLength(1)))
        let ns = lat >= 0 ? String(localized: "北纬 \(a)°") : String(localized: "南纬 \(a)°")
        let ew = lng >= 0 ? String(localized: "东经 \(b)°") : String(localized: "西经 \(b)°")
        return ns + AppLanguage.current.comma + ew
    }
}
