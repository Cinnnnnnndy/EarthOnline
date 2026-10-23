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
        StageReader { layout, size in
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
            .task(id: insets(layout)) {
                let i = insets(layout)
                world.send(WorldMsg.SetInsets(left: i.left, bottom: i.bottom, top: i.top, right: i.right))
                world.send(WorldMsg.SetLayout(layout: layout.bridgeName, width: Double(size.width), height: Double(size.height)))
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

    struct Insets: Hashable { var left: Double; var bottom: Double; var right: Double = 0; var top: Double = 0 }

    /// 一页：卡片顶边以下都算被挡住；两页：左页整页被挡住（地球居中在右页）；三页：左右两页都让（地球在中页）；悬停：让出下半屏
    private func insets(_ layout: StageLayout) -> Insets {
        switch layout {
        case .spread(let foldX, let gap):
            return Insets(left: Double(foldX + gap / 2).rounded(), bottom: 0)
        case .triple(let creases, let gap):
            let left = Double((creases.first ?? screen.width / 3) + gap / 2).rounded()
            let right = Double(screen.width - ((creases.count > 1 ? creases[1] : screen.width * 2 / 3) - gap / 2)).rounded()
            return Insets(left: left, bottom: 0, right: max(0, right))
        case .hover(let foldY, let gap):
            return Insets(left: 0, bottom: Double(screen.height - foldY + gap / 2).rounded())
        case .compact:
            guard let f = obstruction, screen.height > 0 else { return Insets(left: 0, bottom: 0) }
            return Insets(left: 0, bottom: max(0, Double(screen.height - f.minY) + 8).rounded())
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
                            .frame(maxWidth: max(0, min(Metrics.cardMaxWidth, leftWidth - Metrics.gutter * 2)))
                            .reportsObstruction($obstruction)
                            .padding(.bottom, 12)
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .frame(width: leftWidth, height: proxy.size.height, alignment: .topLeading)
                    HStack {
                        Spacer(minLength: 0)
                        trailing
                    }
                    .padding(.top, 8)
                    .padding(.trailing, Metrics.gutter)
                    .frame(width: proxy.size.width, alignment: .topTrailing)
                }
            }
    }
}
