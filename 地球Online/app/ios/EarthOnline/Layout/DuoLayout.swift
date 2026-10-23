import SwiftUI

/// iPhone Duo（iOS 27.1）适配。
///
/// iOS 27.1 的 `ArrangementView`、`GeometryProxy.reservedRegions`、`.onHingeChange` 的签名都没有拿正式 SDK 验证过，
/// 所以这里所有用到它们的代码都在 `#if IPHONE_DUO_SDK`（project.yml 的 OTHER_SWIFT_FLAGS 里默认不开）里，
/// 运行时再加 `if #available(iOS 27.1, *)`。默认编译走几何兜底：StageLayout.fallback(size:)。
///
/// 用法：`StageReader { layout in ... }` 取代 GeometryReader，拿到 compact / spread 两种形态。
struct StageReader<Content: View>: View {
    @ViewBuilder var content: (StageLayout, CGSize) -> Content

    var body: some View {
        GeometryReader { proxy in
            content(DuoLayout.resolve(proxy), proxy.size)
        }
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
        return StageLayout.fallback(size: proxy.size)
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
