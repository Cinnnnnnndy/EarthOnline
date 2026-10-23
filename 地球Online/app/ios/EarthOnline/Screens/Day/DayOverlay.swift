import SwiftUI

/// 某一天 = 潜入微缩世界：世界铺满整屏，左上一颗玻璃返回键，右上一小组控制（暂停、视角、重走、编辑），
/// 底部一张贴内容的卡：这一天、下一站、当天的站点列表（图标来自景点类型）。点站点 → 小人走过去 + 站点详情。
struct DayOverlay: View {
    let tripID: String
    let dayIndex: Int
    let layout: StageLayout
    @Binding var obstruction: CGRect?

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @EnvironmentObject private var world: WorldController
    @State private var topView = false
    @State private var listHeight: CGFloat = 0

    var body: some View {
        if let trip = store.trip(tripID), trip.days.indices.contains(dayIndex) {
            let day = trip.days[dayIndex]
            StageScaffold(layout: layout, obstruction: $obstruction) {
                GlassIconButton("chevron.left", label: "回到这本书") { app.openBook(trip.id, day: dayIndex) }
            } trailing: {
                controls(trip)
            } bottom: {
                card(trip, day)
            }
        } else {
            Color.clear.onAppear { app.goHome() }
        }
    }

    // MARK: - 右上控制

    private func controls(_ trip: Trip) -> some View {
        GlassIconBar {
            GlassIconButton(app.playing ? "pause.fill" : "play.fill", label: app.playing ? "暂停" : "继续") {
                app.playing.toggle()
                if app.playing { world.send(WorldMsg.Play()) } else { world.send(WorldMsg.Pause()) }
            }
            GlassIconButton(topView ? "view.3d" : "view.2d", label: topView ? "带角度" : "俯视") {
                topView.toggle()
                world.send(WorldMsg.SetView(pitch: topView ? 90 : 30, follow: nil))
            }
            GlassIconButton("arrow.counterclockwise", label: "重走今天") {
                app.heroStop = nil
                app.dayFinished = false
                app.playing = true
                world.send(WorldMsg.Restart())
                world.send(WorldMsg.Play())
            }
            GlassIconButton("pencil", label: "编辑这一天") {
                app.sheet = .editDay(tripID: trip.id, day: dayIndex)
            }
        }
    }

    // MARK: - 底部卡片

    private func card(_ trip: Trip, _ day: Day) -> some View {
        GlassCard(spacing: 4) {
            HStack(alignment: .center, spacing: 4) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: "D\(day.index) " + plain(day.title))
                        .font(.eoTitle)
                        .lineLimit(1)
                    Text(dateLine(trip, day))
                        .font(.eoSub)
                        .foregroundStyle(isToday(trip) ? Color.eoDawnInk : Color.secondary)
                }
                Spacer(minLength: 8)
                pageButton("chevron.left", label: "前一天", enabled: dayIndex > 0) { app.openDay(trip.id, dayIndex - 1) }
                pageButton("chevron.right", label: "后一天", enabled: dayIndex < trip.days.count - 1) { app.openDay(trip.id, dayIndex + 1) }
            }
            nextStopLine(trip, day)
                .padding(.top, 6)
            if !day.entries.isEmpty {
                Divider().padding(.vertical, 4)
                ScrollView {
                    ItineraryList(day: day, fallbackDue: trip.startDate, today: app.today) { place, i in
                        world.send(WorldMsg.GotoStop(stopIndex: i))
                        app.sheet = .stop(tripID: trip.id, day: dayIndex, entryID: place.id)
                    }
                    .onGeometryChange(for: CGFloat.self) { proxy in
                        proxy.size.height
                    } action: { newValue in
                        listHeight = newValue
                    }
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(minWidth: 260, idealWidth: 340, maxWidth: .infinity)
                .frame(height: min(max(listHeight, 44), max(132, UIScreenHeight.value * 0.28)))
            }
            if app.dayFinished {
                finishedActions(trip)
                    .padding(.top, 8)
            }
        }
    }

    private func pageButton(_ symbol: String, label: LocalizedStringKey, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.eoBodyStrong)
                .frame(width: Metrics.touch, height: Metrics.touch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(enabled ? Color.primary : Color.secondary)
        .disabled(!enabled)
        .accessibilityLabel(Text(label))
    }

    @ViewBuilder
    private func nextStopLine(_ trip: Trip, _ day: Day) -> some View {
        let places = day.places
        if places.isEmpty {
            Text("这一天还没有站点。")
                .font(.eoSub)
                .foregroundStyle(.secondary)
        } else if app.dayFinished {
            Label("今天走完了", systemImage: "flag.checkered")
                .font(.eoBodyStrong)
                .foregroundStyle(Color.eoDawnInk)
        } else {
            // 第八轮按网页精简：下一站只有一行（类型图标、名字、时间）
            let nextIndex = min(places.count - 1, (app.heroStop ?? -1) + 1)
            let next = places[nextIndex]
            let time = Timeline.build(day).item(next.id)?.start
            HStack(spacing: 12) {
                Image(systemName: LandmarkKinds.groupSymbol(forKind: LandmarkKinds.classify(next)))
                    .font(.eoBody)
                    .foregroundStyle(.secondary)
                    .frame(width: 28)
                Text("下一站").font(.eoSub).foregroundStyle(.secondary)
                Text(next.name).font(.eoBodyStrong).lineLimit(1)
                Spacer(minLength: 8)
                if let time {
                    Text(time).font(.eoSub).monospacedDigit().foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    @ViewBuilder
    private func finishedActions(_ trip: Trip) -> some View {
        if dayIndex < trip.days.count - 1 {
            PrimaryActionButton(title: String(localized: "去下一天")) { app.openDay(trip.id, dayIndex + 1) }
        } else {
            PrimaryActionButton(title: String(localized: "写旅行日记")) { app.openDiary(trip.id) }
        }
    }

    private func isToday(_ trip: Trip) -> Bool { trip.todayIndex(today: app.today) == dayIndex }

    /// 第八轮：只有日期（住处、里程、用时不再列）
    private func dateLine(_ trip: Trip, _ day: Day) -> String {
        let date = Fmt.monthDay(day.date)
        return isToday(trip) ? String(localized: "今天，\(date)") : date
    }
}
