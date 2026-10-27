import SwiftUI

/// 首页：按用户旅程的哪一步决定地球上浮什么（与网页首页同一套判断，见 JourneyState）。
///  - 旅行中：一张三行的卡（旅行中，第 N 天 / 今天的标题 / 下一站与时间）+ 右边的小胶囊「进入」；新建旅程缩成右上的一颗加号
///  - 快出发：一张卡（后天出发 / 书名 / 第一天）+「查看」，外加梦幻的新建胶囊
///  - 刚回来：一张卡（欢迎回家 / 书名）+「写日记」，外加新建胶囊；统计在日记页
///  - 平常日子：地球回到家，只有新建胶囊；有将来的书时胶囊上方一枚小胶囊「下一段：……」
struct HomeOverlay: View {
    let layout: StageLayout
    @Binding var obstruction: CGRect?

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore

    var body: some View {
        let state = app.journey
        StageScaffold(layout: layout, obstruction: $obstruction) {
            EmptyView()
        } trailing: {
            iconBar(state)
        } bottom: {
            bottomStack(state)
        }
    }

    // MARK: - 右上的玻璃图标

    private func iconBar(_ state: JourneyState) -> some View {
        GlassIconBar {
            if case .traveling = state {
                GlassIconButton("plus", label: "新建旅程") { app.sheet = .newTrip(.voice) }
            }
            // D108：回正——点一下回家；长按选去哪（家、旅行中 / 下一趟、任意一趟）
            GlassIconButton("scope", label: "回到家") { app.world.send(WorldMsg.Recenter(target: nil)) }
                .contextMenu {
                    Button { app.world.send(WorldMsg.Recenter(target: nil)) } label: { Label("回到家", systemImage: "house") }
                    ForEach(store.trips) { t in
                        Button { app.world.send(WorldMsg.Recenter(target: t.id)) } label: { Label { Text(verbatim: t.title) } icon: { Image(systemName: "flag") } }
                    }
                }
            GlassIconButton("books.vertical", label: "全部旅程") { app.show(.shelf) }
            GlassIconButton("square.and.arrow.down", label: "导入") { app.sheet = .newTrip(.importFile) }
            GlassIconButton("flag", label: "足迹与家") { app.show(.footprints) }
            GlassIconButton("gearshape", label: "设置") { app.show(.settings) }
        }
    }

    // MARK: - 底部

    @ViewBuilder
    private func bottomStack(_ state: JourneyState) -> some View {
        if WelcomeHomeCard.pending(store) {
            WelcomeHomeCard()   // 第一次打开先放家（D100 / D102）：答完之前底部只放这张卡
        } else {
            journeyStack(state)
        }
    }

    @ViewBuilder
    private func journeyStack(_ state: JourneyState) -> some View {
        VStack(spacing: 16) {
            switch state {
            case .traveling(let id, let day):
                if let t = store.trip(id) {
                    JourneyCard(trip: t, kind: .traveling(dayIndex: day))
                }
            case .departing(let id, let n):
                newTripCapsule
                if let t = store.trip(id) {
                    JourneyCard(trip: t, kind: .departing(inDays: n))
                }
            case .justBack(let id, _):
                newTripCapsule
                if let t = store.trip(id) {
                    JourneyCard(trip: t, kind: .justBack)
                }
            case .idle(let next):
                if let next, let t = store.trip(next.tripID) {
                    NextTripChip(trip: t, inDays: next.inDays)
                }
                newTripCapsule
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var newTripCapsule: some View {
        DreamyCapsuleButton(title: "新建旅程") { app.sheet = .newTrip(.voice) }
            .accessibilityHint(Text("说一说或选一个目的地，生成一本新的旅程"))
    }
}

/// 「下一段：京都红叶，45 天后」
struct NextTripChip: View {
    let trip: Trip
    let inDays: Int
    @EnvironmentObject private var app: AppModel

    var body: some View {
        // 每一趟旅程都是一张票（D74）：空闲时下一趟是一张小票
        TicketView(trip: trip, status: JourneyState.departLabel(inDays), compact: true, onFace: { app.openBook(trip.id) })
    }
}

/// 首页的旅程卡（第七轮 / 第八轮按网页精简）：左边是状态、标题（17）、一行要点，点了打开这本书；右边一个墨色小胶囊做这一刻最要紧的事
struct JourneyCard: View {
    enum Kind: Equatable {
        case traveling(dayIndex: Int)
        case departing(inDays: Int)
        case justBack
    }

    let trip: Trip
    let kind: Kind

    @EnvironmentObject private var app: AppModel

    var body: some View {
        // 每一趟旅程都是一张票（D74）：点票面翻开这本书，撕票根做这一刻最要紧的事（进入 / 查看 / 写日记）
        TicketView(trip: trip, status: highlight, live: isTraveling, lines: ticketLines, stubLabel: stubLabel,
                   onFace: { app.openBook(trip.id) }, onStub: primaryAction)
            .accessibilityAction(named: Text("打开这本书")) { app.openBook(trip.id) }
    }

    /// 票面上的一行（文字要少）：旅行中是「D8 · 今天的标题」；要出发是「D1 · 第一天」；刚回来用默认的书名与日期
    private var ticketLines: [String] {
        switch kind {
        case .traveling(let i):
            guard trip.days.indices.contains(i) else { return [] }
            return ["D\(trip.days[i].index) · " + plain(trip.days[i].title)]
        case .departing:
            return trip.days.first.map { ["D1 · " + plain($0.title)] } ?? []
        case .justBack:
            return []
        }
    }

    /// 票根上的字：旅行中是「凭票进入」（默认），其余写这一刻的动作
    private var stubLabel: String? {
        switch kind {
        case .traveling: return nil
        case .departing: return String(localized: "查看")
        case .justBack: return String(localized: "写日记")
        }
    }

    private var highlight: String {
        switch kind {
        case .traveling(let i):
            let nDay = i + 1
            return "D\(nDay)"   // 标签要短
        case .departing(let n): return JourneyState.departLabel(n)
        case .justBack: return String(localized: "欢迎回家")
        }
    }

    private var isTraveling: Bool { if case .traveling = kind { return true } else { return false } }

    private func primaryAction() {
        switch kind {
        case .traveling(let i): app.openDay(trip.id, i)
        case .departing: app.openBook(trip.id)
        case .justBack: app.openDiary(trip.id)
        }
    }
}
