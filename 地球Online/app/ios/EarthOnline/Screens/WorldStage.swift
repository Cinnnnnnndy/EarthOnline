import SwiftUI

/// 地球舞台：世界层铺满整屏（主画面），其余界面尽量少——右上角几颗玻璃图标、底部一张贴内容的卡片。
/// 卡片挡住的区域报给世界层（set-insets），地球 / 浮岛把视觉中心挪到露出来的那块。
struct WorldStage: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @EnvironmentObject private var world: WorldController
    @Environment(\.colorScheme) private var colorScheme

    @State private var obstruction: CGRect?
    @State private var screen: CGSize = .zero
    /// D109：最近一次的布局态 / 尺寸 / 安全区（卡片报新位置时拿它重算让出的边）
    @State private var geo = StageGeometry()

    private var phase: SkyPhase {
        Daylight.resolvePhase(appearance: store.settings.appearance, systemDark: colorScheme == .dark,
                              now: app.clock, place: store.home.map { (lat: $0.lat, lng: $0.lng) })
    }

    var body: some View {
        StageReader { layout, size, safe in
            let key = StageKey(layout: layout.bridgeName, width: Double(size.width).rounded(), height: Double(size.height).rounded(), insets: insets(layout, safe: safe, size: size))
            let _ = geo.remember(layout, size, safe)
            ZStack {
                Color.space(phase)
                    .ignoresSafeArea()
                WorldView(controller: world)
                    .ignoresSafeArea()
                    .onGeometryChange(for: CGSize.self) { proxy in
                        proxy.size
                    } action: { newValue in
                        screen = newValue
                    }
                    .accessibilityLabel(app.stage.isDay ? Text("这一天的世界") : Text("地球"))
                overlay(layout)
                    .animation(.snappy(duration: 0.35), value: app.stage)
                if app.picking != nil {
                    PickBar()
                        .frame(maxHeight: .infinity, alignment: .top)
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            // D102：原来是 .task(id: insets)，在 iPhone Duo 内屏上只在启动时（尺寸还是 0、按一页算）跑了一次，展开后不再重发，
            // 地球一直按「一页 + 底部卡片」偏上、偏大。改成看「布局态 + 尺寸 + 让出的边」，任何一项变了都重发
            .onChange(of: key, initial: true) { _, k in push(k) }
        }
        .task(id: phase) {
            world.send(WorldMsg.SetSky(phase: phase))
        }
    }

    private func push(_ k: StageKey) {
        world.send(WorldMsg.SetInsets(left: k.insets.left, bottom: k.insets.bottom, top: k.insets.top, right: k.insets.right, fill: k.insets.fill))
        world.send(WorldMsg.SetLayout(layout: k.layout, width: k.width, height: k.height))
    }

    /// D109：卡片报新位置时直接重发让出的边。翻开书时抽屉一帧里量两次（先 228 高、再 494 高），
    /// 第二次只触发了一遍不更新修饰符的布局，上面的 onChange 收不到，地球按半截抽屉留白，路线落在抽屉后面。
    /// 只认当前这一页的卡片：从书回到首页时，正在淡出的书的抽屉还会再报几次位置，不能让首页的地球按它留白
    private func obstructionReport(_ stage: Stage) -> Binding<CGRect?> {
        Binding(get: { obstruction }, set: { v in
            guard app.stage == stage else { return }
            obstruction = v
            DispatchQueue.main.async {
                let g = geo
                push(StageKey(layout: g.layout.bridgeName, width: Double(g.size.width).rounded(), height: Double(g.size.height).rounded(), insets: insets(g.layout, safe: g.safe, size: g.size)))
            }
        })
    }

    @ViewBuilder
    private func overlay(_ layout: StageLayout) -> some View {
        switch app.stage {
        case .home:
            HomeOverlay(layout: layout, obstruction: obstructionReport(app.stage))
                .transition(.opacity)
        case .book(let id):
            BookOverlay(tripID: id, layout: layout, obstruction: obstructionReport(app.stage))
                .transition(.opacity)
        case .day(let id, let i):
            DayOverlay(tripID: id, dayIndex: i, layout: layout, obstruction: obstructionReport(app.stage))
                .transition(.opacity)
        }
    }

    struct Insets: Hashable { var left: Double; var bottom: Double; var right: Double = 0; var top: Double = 0; var fill: Double? = nil }
    struct StageKey: Hashable { var layout: String; var width: Double; var height: Double; var insets: Insets }

    /// 一页：卡片顶边以下都算被挡住；两页：书和某一天的抽屉占满左页 → 地球居中在右页，首页左页只有一张小卡 → 地球在整屏居中（D102）；
    /// 三页：左右两页都让（地球在中页）；悬停：让出下半屏
    private func insets(_ layout: StageLayout, safe: EdgeInsets = EdgeInsets(), size: CGSize = .zero) -> Insets {
        // D105：Duo 展开的首页，地球填满上下各留边之后的那一条（横持时图标在右边一列，上边只留安全区 + 边距）；
        // D109：只认 Duo 展开（机型 + 姿态），别的大屏还是原来的大小
        let duoOpen = DuoDevice.isOpen(fullWidth: size.width + safe.leading + safe.trailing)
        switch layout {
        case .spread(let foldX, let gap):
            if case .home = app.stage {
                guard duoOpen else { return Insets(left: 0, bottom: 0) }
                // D110：图标回到顶上一排，上边也让出那一排。
                // D112：左下角那张票压着地球的左下：左边让出票宽的三分之二，地球往右挪（大小由高度定，不变小）
                let left = obstruction.map { Double($0.maxX * 0.65).rounded() } ?? 0
                return Insets(left: left, bottom: Double(safe.bottom + Metrics.globeBottomMargin).rounded(), top: Double(safe.top + 8 + Metrics.touch + Metrics.globeTopMargin).rounded(), fill: Metrics.globeFill)
            }
            // D112：书和某一天时上边也让出顶上那排按钮，路线不顶到按钮里
            return Insets(left: Double(foldX + gap / 2).rounded(), bottom: 0, top: Double(safe.top + 8 + Metrics.touch).rounded())
        case .triple(let creases, let gap):
            let left = Double((creases.first ?? screen.width / 3) + gap / 2).rounded()
            let right = Double(screen.width - ((creases.count > 1 ? creases[1] : screen.width * 2 / 3) - gap / 2)).rounded()
            return Insets(left: left, bottom: 0, right: max(0, right))
        case .hover(let foldY, let gap):
            return Insets(left: 0, bottom: Double(screen.height - foldY + gap / 2).rounded())
        case .compact:
            // D109：卡片的位置是整屏坐标（.global），屏幕高也要按整屏算——原来用的是安全区里的高（iPhone 18 Pro 上 778，不是 874），
            // 让出的底边少了上下安全区那 96pt：首页地球偏下，翻开书时路线落在抽屉后面
            let fullH = size.height + safe.top + safe.bottom
            guard let f = obstruction, fullH > 0 else { return Insets(left: 0, bottom: 0) }
            let bottom = max(0, Double(fullH - f.minY) + 8).rounded()
            if duoOpen, case .home = app.stage {   // 竖持展开：上边让出图标那一排，下边让出票和新建胶囊，中间那条填满
                return Insets(left: 0, bottom: bottom + Double(Metrics.globeBottomMargin) - 8, top: Double(safe.top + 8 + Metrics.touch + Metrics.globeTopMargin).rounded(), fill: Metrics.globeFill)
            }
            if case .home = app.stage { return Insets(left: 0, bottom: bottom) }
            // D109：书和某一天顶上有返回那排按钮：上边也让出来，路线装在按钮和抽屉之间
            return Insets(left: 0, bottom: bottom, top: Double(safe.top + 8 + Metrics.touch).rounded())
        }
    }
}

/// 舞台最近一次的几何（引用类型：在 body 里记下，不触发重绘）
final class StageGeometry {
    var layout: StageLayout = .compact
    var size: CGSize = .zero
    var safe = EdgeInsets()
    func remember(_ l: StageLayout, _ s: CGSize, _ e: EdgeInsets) { layout = l; size = s; safe = e }
}

/// 在地球上点选时顶部的提示条
private struct PickBar: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "hand.tap")
                .foregroundStyle(Color.eoLake)
            Group {
                if app.picking == .home { Text("点地球上家的位置") } else { Text("点地球上去过的地方") }
            }
            .font(.eoBody)
            Button("取消") { app.cancelPick() }
                .font(.eoBodyStrong)
                .buttonStyle(.glass)
        }
        .padding(.leading, 18)
        .padding(.trailing, 6)
        .padding(.vertical, 6)
        .glassEffect(.regular, in: .capsule)
        .padding(.horizontal, Metrics.gutter)
    }
}

/// 舞台两侧的布局骨架：紧凑时「右上图标 + 底部内容」，展开时「左页内容 + 右页图标」
struct StageScaffold<Leading: View, Trailing: View, Bottom: View>: View {
    let layout: StageLayout
    /// D109：Duo 展开时左页离边 32pt、图标右边一列；别的两页设备照旧
    @Environment(\.duoOpen) private var duoOpen
    @Binding var obstruction: CGRect?
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing
    @ViewBuilder var bottom: Bottom

    var body: some View {
        if let fold = layout.firstFold {
            // 两页 / 三页：内容停在第一条书脊左边那一页，图标在整个舞台的右上（三页时就在右页的右上）
            spreadBody(foldX: fold.x, gap: fold.gap)
        } else {
            // 一页 / 悬停：右上图标 + 底部内容（悬停时底部内容落在下半屏，正是折痕下面）
            VStack(spacing: 0) {
                HStack(alignment: .top) {
                    leading
                    Spacer(minLength: 12)
                    trailing
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 8)
                Spacer(minLength: 0)
                bottom
                    .frame(maxWidth: Metrics.cardMaxWidth)
                    .reportsObstruction($obstruction)
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.bottom, 12)
            }
        }
    }

    private func spreadBody(foldX: CGFloat, gap: CGFloat) -> some View {
            GeometryReader { proxy in
                let leftWidth = max(0, foldX - gap / 2)
                let inset = duoOpen ? Metrics.spreadLeading : Metrics.gutter
                ZStack(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 0) {
                        leading
                            .padding(.top, 8)
                        Spacer(minLength: 12)
                        bottom
                            .frame(maxWidth: max(0, min(Metrics.cardMaxWidth, leftWidth - inset - Metrics.gutter)))
                            .reportsObstruction($obstruction)
                            .padding(.bottom, 12)
                    }
                    .padding(.leading, inset)
                    .padding(.trailing, Metrics.gutter)
                    .frame(width: leftWidth, height: proxy.size.height, alignment: .topLeading)
                    // D110：所有机型图标都在顶上一排（D105 的 Duo 横持右边一列撤掉）；Duo 横持时让开右上角竖放的状态栏
                    trailing
                        .padding(.top, 8)
                        .padding(.trailing, Metrics.gutter + (duoOpen ? Metrics.statusSideWidth : 0))
                        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topTrailing)
                }
            }
    }
}
