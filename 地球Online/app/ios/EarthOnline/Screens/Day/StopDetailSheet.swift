import SwiftUI

/// 站点详情（贴内容高度的面板）：类型、名字、计划时间、备注；打卡（晨色）、在地图中打开、编辑
struct StopDetailSheet: View {
    let tripID: String
    let day: Int
    let entryID: String

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @State private var showTodos = false
    @State private var showNotes = false
    @State private var noteDraft = ""
    @State private var showNav = false

    var body: some View {
        if let trip = store.trip(tripID), trip.days.indices.contains(day),
           let place = trip.days[day].entries.first(where: { $0.id == entryID })?.place {
            FittedSheet(extraDetents: [.medium]) {
                content(trip, trip.days[day], place)
            }
        } else {
            Text("这个站点已经不在了。")
                .font(.eoBody)
                .padding(24)
                .presentationDetents([.height(120)])
        }
    }

    private func content(_ trip: Trip, _ d: Day, _ p: PlaceEntry) -> some View {
        let kind = LandmarkKinds.classify(p)
        let visited = p.visited == true
        let item = Timeline.build(d).item(p.id)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: LandmarkKinds.groupSymbol(forKind: kind))
                    .foregroundStyle(.secondary)
                TagView(text: LandmarkKinds.localizedName(kind))
            }
            Text(p.name)
                .font(.eoTitle)
                .fixedSize(horizontal: false, vertical: true)
            if let item {
                let start = item.start
                let end = item.end
                Text(verbatim: "\(start) – \(end)")
                    .font(.eoSub)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            if visited, let at = p.visitedAt {
                let when = String(at.prefix(10))
                Text("打过卡了，\(Fmt.monthDay(when))")
                    .font(.eoSub)
                    .foregroundStyle(Color.eoDawnInk)
            }
            // 待办与备注各占一行，点进去再看（第八轮续：不默认摊开）
            let td = Todos.ofPlace(p, fallbackDue: trip.startDate, today: app.today)
            let note = p.notes ?? ""
            VStack(spacing: 0) {
                entryRow(symbol: "checkmark.circle", title: String(localized: "待办"), count: td.open,
                         meta: td.next.map { nt in let dueText = Fmt.monthDay(nt.due); return String(localized: "\(nt.todo.text)，\(dueText) 前") }) { showTodos = true }
                Divider().padding(.leading, 40)
                entryRow(symbol: "square.and.pencil", title: note.isEmpty ? String(localized: "添加备注") : plain(note), hint: note.isEmpty) { noteDraft = note; showNotes = true }
            }
            .padding(.top, 4)
            HStack(spacing: 12) {
                Button {
                    app.setVisited(trip.id, day: day, entryID: p.id, visited: !visited)
                } label: {
                    Label(visited ? "已打卡" : "打卡", systemImage: visited ? "checkmark.seal.fill" : "checkmark.seal")
                }
                .buttonStyle(InkCapsuleButtonStyle())
                if let g = Geo.point(of: p) {
                    // 导航（第八轮末）：跳到手机上的地图 App，四家任选
                    Button { showNav = true } label: {
                        Label("导航", systemImage: "map")
                            .font(.eoSub.weight(.semibold))
                            .padding(.horizontal, 4)
                    }
                    .buttonStyle(.glass)
                    .confirmationDialog("用哪个地图导航", isPresented: $showNav, titleVisibility: .visible) {
                        ForEach(MapsLink.App.allCases) { mapApp in
                            Button(mapApp.name) { if let url = MapsLink.url(mapApp, name: p.name, lat: g.lat, lng: g.lng) { openURL(url) } }
                        }
                    }
                }
                Spacer(minLength: 8)
                // 编辑是通用操作：图标按钮
                IconButton("pencil", label: "编辑") {
                    app.sheet = .entry(tripID: trip.id, day: day, entryID: p.id, type: .place)
                }
            }
            .padding(.top, 8)
        }
        .padding(.horizontal, 24)
        .padding(.top, 28)
        .padding(.bottom, 12)
        .sheet(isPresented: $showTodos) {
            FittedSheet(extraDetents: [.medium]) {
                if let live = store.trip(tripID)?.days[day].entries.first(where: { $0.id == entryID })?.place {
                    TodoSection(tripID: tripID, day: day, entryID: entryID, dayDate: d.date, todos: live.todos ?? [])
                        .padding(.horizontal, 24)
                        .padding(.top, 28)
                        .padding(.bottom, 16)
                }
            }
        }
        .sheet(isPresented: $showNotes) {
            FittedSheet {
                VStack(alignment: .leading, spacing: 8) {
                    Text("备注").font(.eoTitle)
                    TextEditor(text: $noteDraft)
                        .font(.eoBody)
                        .frame(minHeight: 120)
                        .onChange(of: noteDraft) { _, v in store.setNotes(tripID, day: day, entryID: entryID, v) }
                    HStack {
                        Spacer()
                        Button { showNotes = false } label: { Text("完成") }
                            .buttonStyle(InkCapsuleButtonStyle())
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 28)
                .padding(.bottom, 16)
            }
        }
    }

    /// 站点详情里的入口行：图标、标题（可带数量标签）、一行说明、右边的 chevron；整行可点，高 44
    private func entryRow(symbol: String, title: String, hint: Bool = false, count: Int = 0, meta: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.eoBody)
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(title)
                            .font(.eoBody)
                            .foregroundStyle(hint ? Color.secondary : Color.primary)
                            .lineLimit(1)
                        if count > 0 { TagView(text: "\(count)", systemImage: "checkmark") }
                    }
                    if let meta {
                        Text(meta)
                            .font(.eoSub)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.eoSub.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .frame(minHeight: Metrics.touch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 站点的待办（第八轮）：每行勾选、文字（做完划掉）、到期日标签、删除；最后一行添加（文字 + 提前几天 + 加号）
struct TodoSection: View {
    let tripID: String
    let day: Int
    let entryID: String
    let dayDate: String
    let todos: [Todo]

    @EnvironmentObject private var store: TripStore
    @State private var text = ""
    @State private var lead = 30

    var body: some View {
        let nTodos = todos.count
        VStack(alignment: .leading, spacing: 4) {
            Text(todos.isEmpty ? String(localized: "待办") : String(localized: "待办 \(nTodos) 项"))
                .font(.eoSub)
                .foregroundStyle(.secondary)
            ForEach(todos) { td in
                let done = td.done == true
                HStack(spacing: 8) {
                    IconButton(done ? "checkmark.circle.fill" : "circle", label: "完成", plain: true) {
                        store.setTodoDone(tripID, day: day, entryID: entryID, todoID: td.id, done: !done)
                    }
                    Text(td.text)
                        .font(.eoBody)
                        .strikethrough(done)
                        .foregroundStyle(done ? Color.secondary : Color.primary)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    let dueText = Fmt.monthDay(td.due ?? dayDate)
                    TagView(text: String(localized: "\(dueText) 前"))
                    IconButton("xmark", label: "删除待办", plain: true) {
                        store.removeTodo(tripID, day: day, entryID: entryID, todoID: td.id)
                    }
                }
            }
            HStack(spacing: 8) {
                TextField("比如：买门票", text: $text)
                    .font(.eoBody)
                    .submitLabel(.done)
                    .onSubmit(add)
                Picker("添加待办", selection: $lead) {
                    ForEach(Todos.leadDays, id: \.self) { d in Text(Todos.leadName(d)).tag(d) }
                }
                .labelsHidden()
                IconButton("plus", label: "添加待办", action: add)
            }
        }
    }

    private func add() {
        let t = text.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        store.addTodo(tripID, day: day, entryID: entryID, text: t, due: Todos.dueFromLead(dayDate: dayDate, lead: lead))
        text = ""
    }
}

/// 导航链接（与 shared/geo/maplinks.ts 同一套）：四家都走网页跳转链接，装了 App 就拉起，没装就开网页，不用登记 URL scheme。
/// 坐标一律 WGS-84：高德 coordinate=wgs84、百度 coord_type=wgs84 由对方换算。
enum MapsLink {
    enum App: String, CaseIterable, Identifiable {
        case apple, google, amap, baidu
        var id: String { rawValue }
        var name: String {
            switch self {
            case .apple: return String(localized: "Apple 地图")
            case .google: return String(localized: "Google 地图")
            case .amap: return String(localized: "高德地图")
            case .baidu: return String(localized: "百度地图")
            }
        }
    }

    static func url(_ app: App, name: String, lat: Double, lng: Double) -> URL? {
        let n = name.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? name
        let la = String(format: "%.6f", lat), ln = String(format: "%.6f", lng)
        switch app {
        case .apple: return URL(string: "https://maps.apple.com/?daddr=\(la),\(ln)&q=\(n)&dirflg=w")
        case .google: return URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(la),\(ln)&travelmode=walking")
        case .amap: return URL(string: "https://uri.amap.com/navigation?to=\(ln),\(la),\(n)&mode=walk&coordinate=wgs84&callnative=1&src=earth-online")
        case .baidu: return URL(string: "https://api.map.baidu.com/direction?destination=latlng:\(la),\(ln)%7Cname:\(n)&coord_type=wgs84&mode=walking&output=html&src=earth-online")
        }
    }
}
