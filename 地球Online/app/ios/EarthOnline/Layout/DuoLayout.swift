import SwiftUI

/// iPhone Duo（iOS 27.1）适配。
///
/// iOS 27.1 的 `ArrangementView`、`GeometryProxy.reservedRegions`、`.onHingeChange` 的签名都没有拿正式 SDK 验证过，
/// 所以这里所有用到它们的代码都在 `#if IPHONE_DUO_SDK`（project.yml 的 OTHER_SWIFT_FLAGS 里默认不开）里，
/// 运行时再加 `if #available(iOS 27.1, *)`。默认编译走几何兜底：StageLayout.fallback(size:)。
///
/// 用法：`StageReader { layout in ... }` 取代 GeometryReader，拿到 compact / spread 两种形态。
struct StageReader<Content: View>: View {
    @ViewBuilder var content: (StageLayout, CGSize, EdgeInsets) -> Content

    var body: some View {
        GeometryReader { proxy in
            content(DuoLayout.resolve(proxy), proxy.size, proxy.safeAreaInsets)
                .environment(\.duoOpen, DuoDevice.isOpen(proxy))
        }
    }
}

/// D109：只给 iPhone Duo 展开时用的那套布局（D105 的地球放大、上下留边、横持图标右边一列、左页离边 32pt）。
/// 原来按「整屏宽 ≥ 600」判，会把 iPad 上跑的 iPhone 版、以后别的大屏也当成 Duo；现在按机型 + 展开姿态判：
/// 机型是 iPhone Duo（iPhone19,4；模拟器读 SIMULATOR_MODEL_IDENTIFIER），并且现在用的是内屏（外屏 ≈421 宽，内屏展开 ≥ 600）。
/// 有 Duo SDK 以后，姿态改读系统给的铰链状态。
enum DuoDevice {
    static let modelIdentifiers: Set<String> = ["iPhone19,4"]

    static let isDuo: Bool = {
        if let sim = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] { return modelIdentifiers.contains(sim) }
        var info = utsname()
        uname(&info)
        let machine = withUnsafeBytes(of: &info.machine) { raw in
            String(decoding: raw.prefix(while: { $0 != 0 }), as: UTF8.self)
        }
        return modelIdentifiers.contains(machine)
    }()

    /// 是 Duo、并且展开着（内屏）
    @MainActor
    static func isOpen(_ proxy: GeometryProxy) -> Bool {
        let s = proxy.safeAreaInsets
        return isOpen(fullWidth: proxy.size.width + s.leading + s.trailing)
    }

    static func isOpen(fullWidth: CGFloat) -> Bool { isDuo && fullWidth >= StageLayout.phoneMax }
}

private struct DuoOpenKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    /// D109：iPhone Duo 展开着（StageReader 设）
    var duoOpen: Bool {
        get { self[DuoOpenKey.self] }
        set { self[DuoOpenKey.self] = newValue }
    }
}

enum DuoLayout {
    /// 由 GeometryProxy 定形态：有 SDK 时优先读系统给的「书脊」划分，否则按尺寸兜底
    @MainActor
    static func resolve(_ proxy: GeometryProxy) -> StageLayout {
        #if IPHONE_DUO_SDK
        if #available(iOS 27.1, *) {
            if let fold = foldFromReservedRegions(proxy) { return fold }
        }
        #endif
        // D102：按整个窗口（含安全区）判形态，和 shared/spec/layout.ts 一样按屏幕尺寸算；
        // 只用安全区里的尺寸时，Duo 内屏竖持（669×951，上下安全区很高）会被量成 669×835，宽高比刚好过 0.8，被错当成两页
        let s = proxy.safeAreaInsets
        let full = CGSize(width: proxy.size.width + s.leading + s.trailing, height: proxy.size.height + s.top + s.bottom)
        switch StageLayout.fallback(size: full) {
        case .spread(let x, let gap): return .spread(foldX: x - s.leading, gap: gap)
        case .triple(let c, let gap): return .triple(creases: c.map { $0 - s.leading }, gap: gap)
        case .hover(let y, let gap): return .hover(foldY: y - s.top, gap: gap)
        case .compact: return .compact
        }
    }

    #if IPHONE_DUO_SDK
    /// 【未验证的 API】reservedRegions：系统保留区域（书脊 division、内屏摄像头 occlusion），每个有 frame / margins / isActive。
    /// 这里只取「活动的、竖直的、在中间附近」那条划分作为书脊。
    @available(iOS 27.1, *)
    @MainActor
    private static func foldFromReservedRegions(_ proxy: GeometryProxy) -> StageLayout? {
        let size = proxy.size
        for region in proxy.reservedRegions where region.isActive {
            let f = region.frame
            let vertical = f.height >= size.height * 0.8 && f.width < size.width * 0.2
            if vertical, size.width >= 700 {
                return .spread(foldX: f.midX, gap: max(Metrics.foldGap, f.width + region.margins.leading + region.margins.trailing))
            }
        }
        return nil
    }
    #endif
}

extension View {
    /// 折叠 / 展开时的回调（有 SDK 时接 `.onHingeChange`，否则由尺寸变化驱动）
    @ViewBuilder
    func onFoldChange(_ action: @escaping () -> Void) -> some View {
        #if IPHONE_DUO_SDK
        if #available(iOS 27.1, *) {
            self.onHingeChange { _ in action() }   // 【未验证的 API】
        } else {
            self
        }
        #else
        self
        #endif
    }
}
