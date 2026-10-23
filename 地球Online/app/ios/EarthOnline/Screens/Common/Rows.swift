import SwiftUI
import UIKit

/// 书页里的一天：「D2」+ 标题 + 日期（第八轮：不再列公里数；没有装饰圆点）
struct DayRow: View {
    let day: Day
    let isToday: Bool

    var body: some View {
        HStack(spacing: 12) {
            TagView(text: "D\(day.index)", live: isToday)
                .frame(minWidth: 36, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(plain(day.title))
                    .font(.eoBody)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(meta)
                    .font(.eoSub)
                    .foregroundStyle(isToday ? Color.eoDawnInk : Color.secondary)
                    .monospacedDigit()
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.eoCaption)
                .foregroundStyle(.tertiary)
        }
        .frame(minHeight: Metrics.touch)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var meta: String {
        let date = Fmt.monthDay(day.date)
        return isToday ? String(localized: "今天，\(date)") : date
    }
}

/// 站点行：图标来自景点类型（landmark kinds），打过卡的图标用晨色。第八轮：默认只有名字和时间（类型、备注在站点详情里）
struct StopRow: View {
    let place: PlaceEntry
    var time: String?
    var showsKindLabel = false
    /// 待办的到期日没写时按这个算（出发日）
    var fallbackDue: String = ""
    var today: String? = nil
    /// 从上往下的序号（和浮岛上的针一致）；给了序号时左边是墨底白字的小圆，组图标挪到名字前
    var index: Int? = nil

    var body: some View {
        let kind = LandmarkKinds.classify(place)
        let visited = place.visited == true
        HStack(spacing: 12) {
            if let index {
                Text(verbatim: "\(index)")
                    .font(.eoCaption.weight(.semibold))
                    .foregroundStyle(Color(.systemBackground))
                    .frame(width: 22, height: 22)
                    .background(Circle().fill(visited ? Color.eoDawn : Color.primary))
                    .frame(width: 28, height: 28)
            } else {
                Image(systemName: visited ? "checkmark.circle.fill" : LandmarkKinds.groupSymbol(forKind: kind))
                    .font(.eoBody)
                    .foregroundStyle(visited ? Color.eoDawn : Color.secondary)
                    .frame(width: 28, height: 28)
                    .accessibilityLabel(Text(LandmarkKinds.localizedName(kind)))
            }
            let td = Todos.ofPlace(place, fallbackDue: fallbackDue, today: today)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    if index != nil {
                        Image(systemName: LandmarkKinds.groupSymbol(forKind: kind))
                            .font(.eoSub)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel(Text(LandmarkKinds.localizedName(kind)))
                    }
                    Text(place.name)
                        .font(.eoBody)
                        .lineLimit(1)
                    if td.open > 0 {
                        // 待办的提示跟着站点：名字旁边一个带勾的小标签
                        let nOpen = td.open
                        TagView(text: "\(nOpen)", systemImage: "checkmark")
                            .accessibilityLabel(Text("待办 \(nOpen) 项"))
                    }
                }
                let m = meta(kind)
                if let nt = td.next {
                    let dueText = Fmt.monthDay(nt.due)
                    Text("\(nt.todo.text)，\(dueText) 前")
                        .font(.eoSub)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                } else if !m.isEmpty {
                    Text(m)
                        .font(.eoSub)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            if let time {
                Text(time)
                    .font(.eoSub)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minHeight: Metrics.touch)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func meta(_ kind: String) -> String {
        var parts: [String] = []
        if showsKindLabel { parts.append(LandmarkKinds.localizedName(kind)) }
        if Geo.point(of: place) == nil { parts.append(String(localized: "没有坐标")) }
        return parts.joined(separator: AppLanguage.current.comma)
    }
}

/// 两站之间的交通（一行次要文字）。第八轮：只有交通图标和用时（没有用时就写方式）
struct LegRow: View {
    let legs: [TransportEntry]

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: LandmarkKinds.transportSymbol)
                .font(.eoSub)
                .foregroundStyle(.secondary)
                .frame(width: 28)
            Text(text)
                .font(.eoSub)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .frame(minHeight: 28)
        .accessibilityElement(children: .combine)
    }

    private var text: String {
        let min = legs.reduce(0) { $0 + ($1.durationMinutes ?? 0) }
        if min > 0 { return Fmt.duration(min) }
        return (legs.first?.mode ?? .walk).localizedName
    }
}

/// 一天的行程列表：站点行之间插入交通行
struct ItineraryList: View {
    let day: Day
    var showTimes = true
    /// 待办到期日的兜底（出发日）与今天：给站点行上的待办提示用
    var fallbackDue: String = ""
    var today: String? = nil
    var onTapPlace: ((PlaceEntry, Int) -> Void)?

    var body: some View {
        let tl = Timeline.build(day)
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(groups.enumerated()), id: \.offset) { _, g in
                if !g.legs.isEmpty { LegRow(legs: g.legs) }
                if let p = g.place {
                    let row = StopRow(place: p, time: showTimes ? tl.item(p.id)?.start : nil, fallbackDue: fallbackDue, today: today, index: g.placeIndex + 1)
                    if let onTapPlace {
                        Button { onTapPlace(p, g.placeIndex) } label: { row }
                            .buttonStyle(.plain)
                    } else {
                        row
                    }
                }
            }
        }
        // 一条细线把序号从上串到下（行程是有顺序的）
        .background(alignment: .leading) {
            Rectangle().fill(Color.primary.opacity(0.1)).frame(width: 2).padding(.leading, 13).padding(.vertical, 22)
        }
    }

    private struct Segment { var legs: [TransportEntry]; var place: PlaceEntry?; var placeIndex: Int }

    private var groups: [Segment] {
        var out: [Segment] = []
        var pending: [TransportEntry] = []
        var n = 0
        for e in day.entries {
            switch e {
            case .transport(let t): pending.append(t)
            case .place(let p):
                out.append(Segment(legs: pending, place: p, placeIndex: n))
                n += 1
                pending = []
            case .lodging: break
            }
        }
        if !pending.isEmpty { out.append(Segment(legs: pending, place: nil, placeIndex: n)) }
        return out
    }
}

/// 把底部卡片的位置报给舞台（算世界层的留白）
struct ObstructionReporter: ViewModifier {
    @Binding var frame: CGRect?

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .global)
            } action: { newValue in
                frame = newValue
            }
        // 不在 onDisappear 里清空：舞台切换时新卡片的首个位置可能先于旧卡片的消失回调到达
    }
}

extension View {
    func reportsObstruction(_ frame: Binding<CGRect?>) -> some View { modifier(ObstructionReporter(frame: frame)) }
}

/// 贴内容高度的面板：量出内容高度，给 .presentationDetents([.height(h)])
struct FittedSheet<Content: View>: View {
    var extraDetents: Set<PresentationDetent> = []
    @ViewBuilder var content: Content
    @State private var height: CGFloat = 320

    var body: some View {
        content
            .fixedSize(horizontal: false, vertical: true)
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.height
            } action: { newValue in
                height = newValue
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .presentationDetents(Set([PresentationDetent.height(max(160, height + 8))]).union(extraDetents))
            .presentationDragIndicator(.visible)
    }
}

/// 系统分享面板
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

/// 地名搜索（离线小地名表）
struct PlaceSearchField: View {
    let prompt: LocalizedStringKey
    var limit = 6
    let onPick: (Place) -> Void
    @State private var query = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField(prompt, text: $query)
                    .font(.eoBody)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                if !query.isEmpty {
                    Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text("清除"))
                }
            }
            .frame(minHeight: Metrics.touch)
            if !query.trimmingCharacters(in: .whitespaces).isEmpty {
                ForEach(Gazetteer.search(query, limit: limit)) { p in
                    Button {
                        query = ""
                        onPick(p)
                    } label: {
                        HStack {
                            Text(p.displayName()).font(.eoBody).foregroundStyle(.primary)
                            Spacer()
                            Text(secondaryName(p)).font(.eoSub).foregroundStyle(.secondary)
                        }
                        .frame(minHeight: Metrics.touch)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func secondaryName(_ p: Place) -> String {
        let shown = p.displayName()
        return ([p.name, p.en, p.ja].compactMap { $0 } + p.aliases).first { $0 != shown } ?? ""
    }
}
