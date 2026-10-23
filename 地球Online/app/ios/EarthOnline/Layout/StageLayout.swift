import SwiftUI

/// 地球页的形态（D90：与 shared/spec/layout.ts 同一套规则，网页 shape.ts、鸿蒙 LayoutState.ets、安卓 LayoutState.kt 都是它的移植）：
///  - compact：一页——手机、折叠机外屏（≈421×616）、展开后竖持（单页放大）——地球铺满，内容卡贴底，图标按钮在右上；
///  - spread：两页——阔折叠 / 书式折叠的内屏展开横持（≈861×609，书脊在中线）、横持平板——内容卡停靠在左页（避开书脊），地球居中在右页；
///  - triple：三页——三折叠全开（≈1360×950）、宽桌面——左页内容卡、中页地球、右页弹层；
///  - hover：半开悬停（横放桌面）——上半屏地球、下半屏内容。
///  设备型号不进这里：Pura X Max、Mate X / XT、Galaxy Z Fold、iPhone Duo 都只是几何（尺寸 + 系统给的书脊划分）。
enum StageLayout: Equatable {
    case compact
    /// foldX：书脊中线的 x（相对舞台）；gap：书脊两侧留白的总宽
    case spread(foldX: CGFloat, gap: CGFloat)
    /// creases：两条书脊中线的 x（从左到右）；gap：每条书脊两侧留白的总宽
    case triple(creases: [CGFloat], gap: CGFloat)
    /// foldY：折痕中线的 y；gap：折痕两侧留白的总宽
    case hover(foldY: CGFloat, gap: CGFloat)

    var isSpread: Bool { if case .spread = self { return true }; return false }
    var isTriple: Bool { if case .triple = self { return true }; return false }
    var isHover: Bool { if case .hover = self { return true }; return false }
    /// 页数
    var panes: Int { switch self { case .compact: return 1; case .spread, .hover: return 2; case .triple: return 3 } }

    // 与 shared/spec/layout.ts 的常量一致
    static let phoneMax: CGFloat = 600
    static let spreadRatio: CGFloat = 0.8
    static let tripleMin: CGFloat = 1100
    static let tripleRatio: CGFloat = 1.3

    /// 几何兜底（没有系统给的书脊划分时）：
    ///  宽 < 600 → 一页；宽 ≥ 1100 且宽高比 ≥ 1.3 → 三页（书脊按三等分估）；宽高比 ≥ 0.8 → 两页（书脊取中线）；否则（展开后竖持）一页。
    ///  两侧共留 24pt（Metrics.foldGap）。
    static func fallback(size: CGSize) -> StageLayout {
        guard size.width > 0, size.height > 0 else { return .compact }
        let w = size.width, ratio = size.width / size.height
        if w < phoneMax { return .compact }
        if w >= tripleMin, ratio >= tripleRatio { return .triple(creases: [(w / 3).rounded(), (w * 2 / 3).rounded()], gap: Metrics.foldGap) }
        if ratio >= spreadRatio { return .spread(foldX: w / 2, gap: Metrics.foldGap) }
        return .compact
    }

    /// 第一条书脊（两页 / 三页都有）：左页就是它左边那一页
    var firstFold: (x: CGFloat, gap: CGFloat)? {
        switch self {
        case .spread(let x, let gap): return (x, gap)
        case .triple(let creases, let gap): return creases.first.map { ($0, gap) }
        case .compact, .hover: return nil
        }
    }

    /// 左页（内容）宽度
    func leftPageWidth(total: CGFloat) -> CGFloat {
        guard let f = firstFold else { return total }
        return max(0, f.x - f.gap / 2)
    }

    /// 中页 / 右页的起点
    func rightPageMinX() -> CGFloat {
        guard let f = firstFold else { return 0 }
        return f.x + f.gap / 2
    }

    /// 右页（三页时放弹层）的横向范围
    func thirdPage(total: CGFloat) -> (minX: CGFloat, width: CGFloat)? {
        guard case .triple(let creases, let gap) = self, creases.count >= 2 else { return nil }
        let minX = creases[1] + gap / 2
        return (minX, max(0, total - minX))
    }

    /// 发给世界层的 layout 名（bridge.ts 的 LayoutState）
    var bridgeName: String {
        switch self {
        case .compact: return "phone"
        case .spread: return "spread"
        case .triple: return "triple"
        case .hover: return "hover"
        }
    }
}
