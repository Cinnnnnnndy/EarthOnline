import SwiftUI
import UIKit

/// 一本书：地球聚焦这本书；底部一张贴内容的卡——书名、日期、状态、紧凑的天列表、按当下给的主按钮
/// （进入今天 / 从 D1 开始 / 写旅行日记）。点某一天 → 地球聚焦那天，卡片换成那天的站点预览 +「进入这一天」。
struct BookOverlay: View {
    let tripID: String
    let layout: StageLayout
    @Binding var obstruction: CGRect?

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @State private var confirmDelete = false
    @State private var shareItems: ShareBox?

    var body: some View {
        if let trip = store.trip(tripID) {
            StageScaffold(layout: layout, obstruction: $obstruction) {
                GlassIconButton("chevron.left", label: "回到地球") { app.goHome() }
            } trailing: {
                GlassIconBar {
                    GlassIconButton("book.closed", label: "旅行日记") { app.openDiary(trip.id) }
                    moreMenu(trip)
                }
            } bottom: {
                if let d = app.bookDay, trip.days.indices.contains(d) {
                    DayPreviewCard(trip: trip, dayIndex: d)
                        .transition(.opacity)
                } else {
                    BookCard(trip: trip)
                        .transition(.opacity)
                }
            }
            .animation(.snappy(duration: 0.3), value: app.bookDay)
            .confirmationDialog(Text("删除这本书？"), isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("删除", role: .destructive) {
                    store.delete(trip.id)
                    app.goHome()
                }
            } message: {
                Text("删掉后不能恢复。")
            }
            .sheet(item: $shareItems) { box in
                ShareSheet(items: box.items)
                    .presentationDetents([.medium, .large])
            }
        } else {
            Color.clear.onAppear { app.goHome() }
        }
    }

    private func moreMenu(_ trip: Trip) -> some View {
        Menu {
            Button {
                shareItems = ShareBox(items: [ExportFiles.json(for: trip)])
            } label: {
                Label("导出行程数据", systemImage: "square.and.arrow.up")
            }
            Button {
                app.sheet = .editDay(tripID: trip.id, day: app.bookDay ?? (trip.todayIndex(today: app.today) ?? 0))
            } label: {
                Label("编辑行程", systemImage: "pencil")
            }
            Button(role: .destructive) {
                confirmDelete = true
            } label: {
                Label("删除这本书", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.eoBodyStrong)
                .foregroundStyle(.primary)
                .frame(width: Metrics.touch, height: Metrics.touch)
                .contentShape(Circle())
        }
        .glassEffect(.regular.interactive(), in: .circle)
        .accessibilityLabel(Text("更多"))
    }
}

struct ShareBox: Identifiable {
    let id = UUID()
    let items: [Any]
}

/// 书的卡片
struct BookCard: View {
    let trip: Trip
    @EnvironmentObject private var app: AppModel

    var body: some View {
        let today = app.today
        let ti = trip.todayIndex(today: today)
        let phase = trip.phase(today: today)
        // 这趟旅程的票浮在卡片上方，不放在卡片上（D74）：撕票根 = 进入今天 / 从 D1 开始 / 写旅行日记；卡片里只有天的列表
        VStack(spacing: 12) {
            TicketView(trip: trip, status: statusText(phase, today: ti), live: isTraveling(phase), stubLabel: actionTitle(phase),
                       onStub: { primaryAction(phase) })
            GlassCard {
                DayList(trip: trip, todayIndex: ti)
            }
        }
    }

    private func statusText(_ phase: TripPhase, today ti: Int?) -> String {
        if case .traveling = phase, let i = ti {
            let nDay = trip.days[i].index
            return "D\(nDay)"   // 标签要短
        }
        return trip.statusText(today: app.today)
    }
    private func isTraveling(_ phase: TripPhase) -> Bool { if case .traveling = phase { return true }; return false }

    private func actionTitle(_ phase: TripPhase) -> String {
        switch phase {
        case .traveling: return String(localized: "进入今天")
        case .ended, .closed: return String(localized: "写旅行日记")
        case .upcoming:
            let nDay = trip.days.first?.index ?? 1
            return String(localized: "从 D\(nDay) 开始")
        }
    }

    private func primaryAction(_ phase: TripPhase) {
        switch phase {
        case .traveling(let i): app.openDay(trip.id, i)
        case .ended, .closed: app.openDiary(trip.id)
        case .upcoming: app.openDay(trip.id, 0)
        }
    }
}

/// 紧凑的天列表：天多时限高滚动，天少时贴内容
struct DayList: View {
    let trip: Trip
    let todayIndex: Int?
    @EnvironmentObject private var app: AppModel
    @State private var contentHeight: CGFloat = 0

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(trip.days.enumerated()), id: \.element.index) { i, d in
                        Button { app.selectBookDay(i) } label: {
                            DayRow(day: d, isToday: i == todayIndex)
                        }
                        .buttonStyle(.plain)
                        .id(i)
                        if i < trip.days.count - 1 { Divider().padding(.leading, 48) }
                    }
                }
                .onGeometryChange(for: CGFloat.self) { proxy in
                    proxy.size.height
                } action: { newValue in
                    contentHeight = newValue
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(minWidth: 260, idealWidth: 340, maxWidth: .infinity)
            .frame(height: min(max(contentHeight, 44), maxListHeight))
            .onAppear { if let t = todayIndex { reader.scrollTo(t, anchor: .center) } }
        }
    }

    /// 天列表最多占屏幕的 36%
    private var maxListHeight: CGFloat { max(160, UIScreenHeight.value * 0.36) }
}

/// 某一天的预览（仍在地球上）
struct DayPreviewCard: View {
    let trip: Trip
    let dayIndex: Int
    @EnvironmentObject private var app: AppModel
    @State private var contentHeight: CGFloat = 0

    var body: some View {
        let d = trip.days[dayIndex]
        GlassCard {
            Button { app.selectBookDay(nil) } label: {
                Label("全部天", systemImage: "chevron.left")
                    .font(.eoBody)
                    .foregroundStyle(Color.eoLake)
                    .frame(minHeight: Metrics.touch)
            }
            .buttonStyle(.plain)
            Text(verbatim: "D\(d.index) " + plain(d.title))
                .font(.eoTitle)
                .lineLimit(1)
            Text(Fmt.monthDay(d.date))          // 第八轮：只有日期；里程、用时、住处不再列
                .font(.eoSub)
                .foregroundStyle(.secondary)
                .monospacedDigit()
            if d.places.isEmpty {
                Text("这一天还没有站点。")
                    .font(.eoBody)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                ScrollView {
                    ItineraryList(day: d, fallbackDue: trip.startDate, today: app.today)
                        .onGeometryChange(for: CGFloat.self) { proxy in
                            proxy.size.height
                        } action: { newValue in
                            contentHeight = newValue
                        }
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(minWidth: 260, idealWidth: 340, maxWidth: .infinity)
                .frame(height: min(max(contentHeight, 44), max(160, UIScreenHeight.value * 0.32)))
            }
            PrimaryActionButton(title: String(localized: "进入这一天")) { app.openDay(trip.id, dayIndex) }
                .padding(.top, 8)
        }
    }

}

/// 屏幕高度（限定卡片里列表的最大高度用）
enum UIScreenHeight {
    @MainActor static var value: CGFloat {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first?.screen.bounds.height ?? 800
    }
}
