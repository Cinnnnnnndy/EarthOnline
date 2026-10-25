import SwiftUI

/// 根：地球舞台（NavigationStack 的根，导航栏隐藏）+ 压栈的列表页 + 底部面板 + 顶部提示
struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @EnvironmentObject private var purchases: StoreService
    /// 舞台的尺寸：三页宽（三折叠全开 / 宽 iPad，StageLayout.triple）时弹层改成右边的检查器栏（D90），不盖住中页的地球
    @State private var stageSize: CGSize = .zero

    private var docksSheets: Bool { StageLayout.fallback(size: stageSize).isTriple }
    /// 一页 / 两页时走普通的 sheet
    private var modalSheet: Binding<AppSheet?> {
        Binding(get: { docksSheets ? nil : app.sheet }, set: { app.sheet = $0 })
    }
    /// 三页时走右页的检查器栏
    private var inspectorShown: Binding<Bool> {
        Binding(get: { docksSheets && app.sheet != nil }, set: { if !$0 { app.sheet = nil } })
    }

    var body: some View {
        NavigationStack(path: $app.path) {
            WorldStage()
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: AppPage.self) { page in
                    switch page {
                    case .settings: SettingsView()
                    case .diary(let id): DiaryView(tripID: id)
                    case .footprints: FootprintsView()
                    case .shelf: ShelfView()
                    case .avatar: AvatarView()
                    }
                }
        }
        .sheet(item: modalSheet) { sheet in
            sheetContent(sheet)
        }
        .inspector(isPresented: inspectorShown) {
            Group { if let sheet = app.sheet { sheetContent(sheet) } }
                .inspectorColumnWidth(min: 320, ideal: 380, max: 460)
        }
        // 量的是加上检查器栏之后的整个窗口（放在 .inspector 之后）：栏打开时内容变窄不会让判断来回跳
        .onGeometryChange(for: CGSize.self) { proxy in proxy.size } action: { stageSize = $0 }
        .overlay(alignment: .top) {
            if let text = app.toastText {
                ToastView(text: text)
                    .padding(.top, 8)
                    .padding(.horizontal, Metrics.gutter)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .preferredColorScheme(preferredScheme)
        .tint(Color.eoLake)
        .onOpenURL { url in app.openFile(url) }
        .onChange(of: store.trips) { _, _ in app.tripsChanged() }
        .onChange(of: store.home) { _, _ in app.tripsChanged() }
        .onChange(of: store.pins) { _, _ in app.tripsChanged() }
        .onChange(of: store.settings.palette) { _, _ in app.tripsChanged() }
        .onChange(of: purchases.entitlements) { _, _ in Task { await app.syncNow() } }
        .task {
            await purchases.loadProducts()
            await app.syncNow()
        }
    }

    /// 设置里固定了白天 / 夜晚就跟着固定界面的深浅；「跟随手机」时不干预
    private var preferredScheme: ColorScheme? {
        switch store.settings.appearance {
        case .auto: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    @ViewBuilder
    private func sheetContent(_ sheet: AppSheet) -> some View {
        switch sheet {
        case .newTrip(let tab):
            NewTripSheet(initialTab: tab)
        case .paywall(let feature):
            PaywallSheet(feature: feature)
        case .stop(let tripID, let day, let entryID):
            StopDetailSheet(tripID: tripID, day: day, entryID: entryID)
        case .editDay(let tripID, let day):
            DayEditorSheet(tripID: tripID, day: day)
        case .entry(let tripID, let day, let entryID, let type):
            EntryEditorSheet(tripID: tripID, day: day, entryID: entryID, kind: type)
        case .welcomeHome:
            WelcomeHomeSheet()
        }
    }
}
