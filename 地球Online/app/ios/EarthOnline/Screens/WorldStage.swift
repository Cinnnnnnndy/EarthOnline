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

    private var phase: SkyPhase {
        Daylight.resolvePhase(appearance: store.settings.appearance, systemDark: colorScheme == .dark,
                              now: app.clock, place: store.home.map { (lat: $0.lat, lng: $0.lng) })
    }

    var body: some View {
        StageReader { layout, size, safe in
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
            .onChange(of: StageKey(layout: layout.bridgeName, width: Double(size.width).rounded(), height: Double(size.height).rounded(), insets: insets(layout, safe: safe, size: size)), initial: true) { _, k in
                world.send(WorldMsg.SetInsets(left: k.insets.left, bottom: k.insets.bottom, top: k.insets.top, right: k.insets.right, fill: k.insets.fill))
                world.send(WorldMsg.SetLayout(layout: k.layout, width: k.width, height: k.height))
            }
        }
        .task(id: phase) {
            world.send(WorldMsg.SetSky(phase: phase))
        }
    }

    @ViewBuilder
    private func overlay(_ layout: StageLayout) -> some View {
        switch app.stage {
        case .home:
            HomeOverlay(layout: layout, obstruction: $obstruction)
                .transition(.opacity)
        case .book(let id):
            BookOverlay(tripID: id, layout: layout, obstruction: $obstruction)
                .transition(.opacity)
        case .day(let id, let i):
            DayOverlay(tripID: id, dayIndex: i, layout: layout, obstruction: $obstruction)
                .transition(.opacity)
        }
    }

    struct Insets: Hashable { var left: Double; var bottom: Double; var right: Double = 0; var top: Double = 0; var fill: Double? = nil }
    struct StageKey: Equatable { var layout: String; var width: Double; var height: Double; var insets: Insets }

    /// 一页：卡片顶边以下都算被挡住；两页：书和某一天的抽屉占满左页 → 地球居中在右页，首页左页只有一张小卡 → 地球在整屏居中（D102）；
    /// 三页：左右两页都让（地球在中页）；悬停：让出下半屏
    private func insets(_ layout: StageLayout, safe: EdgeInsets = EdgeInsets(), size: CGSize = .zero) -> Insets {
        // D105：展开的大屏首页，地球填满上下各留边之后的那一条（横持时图标在右边一列，上边只留安全区 + 边距）
        let unfolded = size.width + safe.leading + safe.trailing >= StageLayout.phoneMax
        switch layout {
        case .spread(let foldX, let gap):
            if case .home = app.stage {
                return Insets(left: 0, bottom: Double(safe.bottom + Metrics.globeBottomMargin).rounded(), top: Double(safe.top + Metrics.globeTopMargin).rounded(), fill: Metrics.globeFill)
            }
            return Insets(left: Double(foldX + gap / 2).rounded(), bottom: 0)
        case .triple(let creases, let gap):
            let left = Double((creases.first ?? screen.width / 3) + gap / 2).rounded()
            let right = Double(screen.width - ((creases.count > 1 ? creases[1] : screen.width * 2 / 3) - gap / 2)).rounded()
            return Insets(left: left, bottom: 0, right: max(0, right))
        case .hover(let foldY, let gap):
            return Insets(left: 0, bottom: Double(screen.height - foldY + gap / 2).rounded())
        case .compact:
            guard let f = obstruction, screen.height > 0 else { return Insets(left: 0, bottom: 0) }
            let bottom = max(0, Double(screen.height - f.minY) + 8).rounded()
            if unfolded, case .home = app.stage {   // 竖持展开：上边让出图标那一排，下边让出票和新建胶囊，中间那条填满
                return Insets(left: 0, bottom: bottom + Double(Metrics.globeBottomMargin) - 8, top: Double(safe.top + 8 + Metrics.touch + Metrics.globeTopMargin).rounded(), fill: Metrics.globeFill)
            }
            return Insets(left: 0, bottom: bottom)
        }
    }
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
                ZStack(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 0) {
                        leading
                            .padding(.top, 8)
                        Spacer(minLength: 12)
                        bottom
                            .frame(maxWidth: max(0, min(Metrics.cardMaxWidth, leftWidth - Metrics.spreadLeading - Metrics.gutter)))
                            .reportsObstruction($obstruction)
                            .padding(.bottom, 12)
                    }
                    .padding(.leading, Metrics.spreadLeading)
                    .padding(.trailing, Metrics.gutter)
                    .frame(width: leftWidth, height: proxy.size.height, alignment: .topLeading)
                    // D105：两页时图标竖着排在右边一列，顶上让出右上角竖放的状态栏
                    trailing
                        .environment(\.iconBarVertical, true)
                        .padding(.top, Metrics.statusClearance)
                        .padding(.trailing, Metrics.gutter)
                        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topTrailing)
                }
            }
    }
}
