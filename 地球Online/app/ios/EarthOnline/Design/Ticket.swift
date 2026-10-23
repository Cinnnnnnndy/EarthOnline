import SwiftUI

/// 票的形状（第八轮末，D74）：四角各一个缺口，撕线的上下各一个小缺口，右边一截票根
struct TicketShape: Shape {
    var notch: CGFloat = 10
    var stub: CGFloat = 76
    var perf: CGFloat = 7

    func path(in r: CGRect) -> Path {
        var p = Path(r)
        let sx = r.maxX - stub
        for c in [r.origin, CGPoint(x: r.maxX, y: r.minY), CGPoint(x: r.minX, y: r.maxY), CGPoint(x: r.maxX, y: r.maxY)] {
            p = p.subtracting(Path(ellipseIn: CGRect(x: c.x - notch, y: c.y - notch, width: notch * 2, height: notch * 2)))
        }
        for c in [CGPoint(x: sx, y: r.minY), CGPoint(x: sx, y: r.maxY)] {
            p = p.subtracting(Path(ellipseIn: CGRect(x: c.x - perf, y: c.y - perf, width: perf * 2, height: perf * 2)))
        }
        return p
    }
}

/// 票（第八轮末，D74）：每一趟旅程都是一张白底黑字的纸票，与网页 ticket.ts 是同一张。
/// 票面（文字要少）：一行印章式的小字（地球ONLINE · No. 0007）加状态标签；大标题是地点，加粗；底下一行小字是书名与日期（旅行中换成今天）；票根竖着印一行（凭票进入 / 天数），底下一个很淡的年份水印。
/// 点票面 = 翻开这本书；撕票根 = 做这一刻最要紧的事（先放撕的动画，尊重「减弱动态效果」）。
/// 票是物件，不是界面：票号、年份这类数字用等宽与字距，这些在界面文案里仍然不用；汉字一律还是系统字体（苹方）。白天夜里都是白纸墨字。
struct TicketView: View {
    let trip: Trip
    var status: String? = nil
    var live = false
    /// 大标题下的一行；空则默认「书名 · 日期」
    var lines: [String] = []
    /// 列表里的小票：矮一截，票根印天数
    var compact = false
    /// 票根上竖着印的字；默认「凭票进入」，小票默认天数
    var stubLabel: String? = nil
    var onFace: (() -> Void)? = nil
    var onStub: (() -> Void)? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tearing = false

    private var stubWidth: CGFloat { compact ? 56 : 76 }
    private var serial: String { TicketView.serial(for: trip) }
    /// 票号：种子取后四位（与网页 ticket.ts 的 serial 同一个数）；行李箱里的票与行李牌也印它
    static func serial(for trip: Trip) -> String { String(format: "No. %04d", abs(trip.seed) % 10000) }
    private var stubText: String { stubLabel ?? (compact ? Counts.days(trip.days.count) : String(localized: "凭票进入")) }
    private var place: String { let d = plainList(trip.destination); return d.isEmpty ? plain(trip.title) : d }
    /// 印章行：大票带状态标签时只印票号（一行放不下两样）；品牌用正文字体（汉字），票号用等宽
    private var stampBrand: String? { (status != nil && !compact) ? nil : String(localized: "地球Online") }
    private var bodyLines: [String] {
        if !lines.isEmpty { return lines }
        // 书名和地点重复就只写日期
        let name = TicketView.dup(plain(trip.title), place) ? "" : plain(trip.title)
        return [[name, Fmt.span(trip.startDate, trip.endDate)].filter { !$0.isEmpty }.joined(separator: " · ")]
    }

    var body: some View {
        HStack(spacing: 0) {
            Button { onFace?() } label: {
                VStack(alignment: .leading, spacing: compact ? 2 : 6) {
                    HStack(spacing: 8) {
                        if let b = stampBrand {
                            Text(verbatim: b)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.ticketInk2)
                        }
                        Text(verbatim: serial)
                            .font(.system(size: 13, weight: .regular, design: .monospaced))
                            .kerning(0.8)
                            .foregroundStyle(Color.ticketInk2)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        if let status { TagView(text: status, live: live) }
                    }
                    Text(place)
                        .font(compact ? Font.body.weight(.bold) : Font.system(size: 22, weight: .bold))
                        .foregroundStyle(Color.ticketInk)
                        .lineLimit(1)
                    ForEach(bodyLines, id: \.self) { l in
                        Text(l)
                            .font(.system(size: 13))
                            .monospacedDigit()
                            .foregroundStyle(Color.ticketInk2)
                            .lineLimit(1)
                    }
                }
                .padding(.leading, compact ? 16 : 18)
                .padding(.trailing, 12)
                .padding(.vertical, compact ? 10 : 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(onFace == nil)
            .accessibilityLabel(Text("翻开「\(plain(trip.title))」"))

            // 票根：虚线撕线 + 竖着的印字 + 年份水印
            Button { tear() } label: {
                ZStack {
                    Text(String(trip.startDate.prefix(4)))          // 年份水印：整个露出来，居中
                        .font(.system(size: compact ? 28 : 40, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.ticketInk.opacity(0.07))
                        .fixedSize()
                        .rotationEffect(.degrees(90))
                    Text(stubText)
                        .font(.system(size: 13, weight: .semibold))
                        .kerning(1.2)
                        .textCase(.uppercase)
                        .foregroundStyle(Color.ticketInk)
                        .fixedSize()
                        .rotationEffect(.degrees(90))
                }
                .frame(width: stubWidth)
                .frame(maxHeight: .infinity)
                .overlay(alignment: .leading) {
                    DashedLine()
                        .stroke(Color.ticketInk.opacity(0.22), style: StrokeStyle(lineWidth: 2, dash: [5, 4]))
                        .frame(width: 2)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(onStub == nil)
            .accessibilityLabel(Text(stubText))
            .accessibilityHidden(onStub == nil)
            .rotationEffect(.degrees(tearing ? 14 : 0), anchor: .bottomLeading)
            .offset(x: tearing ? 30 : 0, y: tearing ? 16 : 0)
            .opacity(tearing ? 0 : 1)
        }
        .frame(minHeight: compact ? 88 : 132)
        .background {
            ZStack {
                Color.white
                Image(uiImage: GrainTexture.image)
                    .resizable(resizingMode: .tile)
                    .opacity(0.16)
                    .allowsHitTesting(false)
            }
        }
        .clipShape(TicketShape(stub: stubWidth))
        .compositingGroup()
        .shadow(color: Color.ticketInk.opacity(compact ? 0.16 : 0.22), radius: compact ? 8 : 12, x: 0, y: compact ? 4 : 8)
        .environment(\.colorScheme, .light)          // 白纸墨字，深色外观下也一样
    }

    /// 两段文字算不算重复：去掉标点后一个包含另一个，或共用任意一个 2 字以上的词（与网页 ticket.ts 的 dup 同一套）
    static func dup(_ a: String, _ b: String) -> Bool {
        let seps = CharacterSet.punctuationCharacters.union(.symbols).union(.whitespaces)   // 「·、，+ - / ()」都算分隔
        let na = a.components(separatedBy: seps).joined(), nb = b.components(separatedBy: seps).joined()
        if na.isEmpty || nb.isEmpty { return false }
        if na.contains(nb) || nb.contains(na) { return true }
        let wb = Set(b.components(separatedBy: seps).filter { $0.count >= 2 })
        return a.components(separatedBy: seps).filter { $0.count >= 2 }.contains { wb.contains($0) }
    }

    private func tear() {
        guard let onStub, !tearing else { return }
        if reduceMotion { onStub(); return }
        withAnimation(.easeOut(duration: 0.5)) { tearing = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) { onStub(); tearing = false }
    }
}

struct DashedLine: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.midX, y: r.minY))
        p.addLine(to: CGPoint(x: r.midX, y: r.maxY))
        return p
    }
}

extension Color {
    /// 票面的墨与墨·次（固定值：票在深色外观下也是白纸墨字）
    /// 票上的墨（D78：文字去紫，与 tokens.ts 的 ink / ink2 同值）
    static let ticketInk = Color(red: 0x1D / 255, green: 0x1E / 255, blue: 0x23 / 255)
    static let ticketInk2 = Color(red: 0x45 / 255, green: 0x46 / 255, blue: 0x4D / 255)
}
