import SwiftUI

/// 内容卡：高度、宽度都贴着内容（最宽 420pt），液态玻璃，圆角 22。
/// 宽度 = 子视图理想宽度的最大值（不超过可用宽度），按钮等「撑满」的子视图跟着卡片宽度走。
struct GlassCard<Content: View>: View {
    var maxWidth: CGFloat = Metrics.cardMaxWidth
    var minWidth: CGFloat = 240
    var spacing: CGFloat = 6
    @ViewBuilder var content: Content

    var body: some View {
        HugWidthStack(spacing: spacing, minWidth: minWidth - Metrics.cardPadding * 2, maxWidth: maxWidth - Metrics.cardPadding * 2) {
            content
        }
        .padding(Metrics.cardPadding)
        .glassEffect(.regular, in: .rect(cornerRadius: Metrics.cardRadius))
    }
}

/// 竖排、左对齐、宽度贴内容的布局
struct HugWidthStack: Layout {
    var spacing: CGFloat = 6
    var minWidth: CGFloat = 0
    var maxWidth: CGFloat = .infinity

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = resolvedWidth(proposal: proposal, subviews: subviews)
        var height: CGFloat = 0
        for (i, s) in subviews.enumerated() {
            height += s.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
            if i > 0 { height += spacing }
        }
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for s in subviews {
            let size = s.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            s.place(at: CGPoint(x: bounds.minX, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: bounds.width, height: size.height))
            y += size.height + spacing
        }
    }

    private func resolvedWidth(proposal: ProposedViewSize, subviews: Subviews) -> CGFloat {
        let limit = min(proposal.width ?? maxWidth, maxWidth)
        let ideal = subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        let w = min(max(ideal, minWidth), limit)
        return max(0, w.isFinite ? w : limit)
    }
}

/// 浮在地球上的圆形玻璃图标按钮（44pt）
struct GlassIconButton: View {
    let systemName: String
    let label: LocalizedStringKey
    var tint: Color? = nil
    let action: () -> Void

    init(_ systemName: String, label: LocalizedStringKey, tint: Color? = nil, action: @escaping () -> Void) {
        self.systemName = systemName
        self.label = label
        self.tint = tint
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.eoBodyStrong)
                .foregroundStyle(tint ?? Color.primary)
                .frame(width: Metrics.touch, height: Metrics.touch)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .circle)
        .accessibilityLabel(Text(label))
    }
}

/// 一组浮动图标按钮（右上角），放在同一个 GlassEffectContainer 里让玻璃彼此融合
struct GlassIconBar<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 10) { content }
        }
    }
}

/// 贴内容宽度的玻璃小胶囊（「下一段：……」、提示条）
struct GlassChip<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: 8) { content }
            .font(.eoSub)
            .padding(.horizontal, 16)
            .frame(minHeight: Metrics.touch)
            .glassEffect(.regular.interactive(), in: .capsule)
    }
}

/// 第七轮：主按钮——墨色小胶囊（白天深底白字，夜里白底深字），高 36、随内容宽；不用湖色填充（与网页 .btn.primary 同一套）
struct InkCapsuleButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.eoSub.weight(.semibold))
            .lineLimit(1)
            .padding(.horizontal, 16)
            .frame(minHeight: 36)
            .foregroundStyle(Color(uiColor: .systemBackground))
            .background(Capsule().fill(Color.primary))
            .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.4)
            .contentShape(Capsule())
    }
}

/// 卡片里的主按钮：墨色小胶囊，靠右
struct PrimaryActionButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) { Text(title) }
            .buttonStyle(InkCapsuleButtonStyle())
            .frame(maxWidth: .infinity, alignment: .trailing)
    }
}

/// 卡片里的次按钮
struct SecondaryActionButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.eoBodyStrong)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 30)
        }
        .buttonStyle(.glass)
        .controlSize(.large)
    }
}

/// 顶部提示（toast）
struct ToastView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.eoSub)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .glassEffect(.regular, in: .capsule)
            .accessibilityAddTraits(.isStaticText)
    }
}

/// 标签（第八轮）：同一类信息用同一种小标签——状态、第几天、类型、到期日、省多少。字 12、高 20、胶囊；默认浅填充次墨字，live（现在）用晨色
struct TagView: View {
    let text: String
    var live = false
    var systemImage: String? = nil

    var body: some View {
        HStack(spacing: 3) {
            if let systemImage { Image(systemName: systemImage).font(.caption2.weight(.semibold)) }
            Text(text)
        }
            .font(.eoCaption.weight(.semibold))
            .monospacedDigit()
            .lineLimit(1)
            .padding(.horizontal, 7)
            .frame(minHeight: 20)                     // 随动态字体长高，不裁字
            .background(Capsule().fill(live ? Color.eoDawn.opacity(0.18) : Color.primary.opacity(0.08)))
            .foregroundStyle(live ? Color.eoDawnInk : Color.eoInk2)
    }
}

/// 图标按钮（第八轮）：编辑、删除、清除、重写、导入、导出这类通用操作一律用图标。32pt 的圆，点击区 44，带无障碍标签
struct IconButton: View {
    let systemName: String
    let label: LocalizedStringKey
    var plain = false
    var danger = false
    let action: () -> Void

    init(_ systemName: String, label: LocalizedStringKey, plain: Bool = false, danger: Bool = false, action: @escaping () -> Void) {
        self.systemName = systemName
        self.label = label
        self.plain = plain
        self.danger = danger
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.eoSub.weight(.semibold))
                .foregroundStyle(danger ? Color.red : (plain ? Color.secondary : Color.primary))
                .frame(width: 32, height: 32)
                .background(Circle().fill(danger ? Color.red.opacity(0.12) : (plain ? Color.clear : Color.primary.opacity(0.08))))
                .frame(width: Metrics.touch, height: Metrics.touch)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(label))
    }
}
