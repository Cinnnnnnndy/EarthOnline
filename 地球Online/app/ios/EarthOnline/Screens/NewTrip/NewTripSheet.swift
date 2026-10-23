import SwiftUI
import UniformTypeIdentifiers

/// 新建旅程：说一说（语音 + 规划助手）/ 选目的地 / 导入。免费版第 4 本时弹付费墙（草稿留着）。
struct NewTripSheet: View {
    let initialTab: NewTripTab

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @Environment(\.dismiss) private var dismiss
    @State private var tab: NewTripTab
    @State private var paywall: ProFeature?

    init(initialTab: NewTripTab) {
        self.initialTab = initialTab
        _tab = State(initialValue: initialTab)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("新建方式", selection: $tab) {
                    Text("说一说").tag(NewTripTab.voice)
                    Text("选目的地").tag(NewTripTab.destination)
                    Text("导入").tag(NewTripTab.importFile)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .padding(.horizontal, Metrics.gutter)
                .padding(.vertical, 8)
                switch tab {
                case .voice:
                    VoiceComposer(onCreate: create)
                case .destination:
                    DestinationForm(onCreate: create)
                case .importFile:
                    ImportPane(onImported: add)
                }
            }
            .navigationTitle(Text("新建旅程"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .sheet(item: $paywall) { f in
            PaywallSheet(feature: f)
        }
    }

    private func create(_ trip: Trip) {
        add([trip])
    }

    private func add(_ trips: [Trip]) {
        guard !trips.isEmpty else { return }
        guard app.canAddTrip else { paywall = .unlimitedTrips; return }
        let added = app.addTrips(trips)
        guard let first = added.first else { paywall = .unlimitedTrips; return }
        dismiss()
        if added.count < trips.count {
            let nAdded = added.count
            app.showToast(String(localized: "免费版这次只加了 \(nAdded) 本"))
        } else if added.count > 1 {
            let nBooks = added.count
            app.showToast(String(localized: "导入了 \(nBooks) 本旅程"))
        }
        app.openBook(first.id)
    }
}

/// 选目的地：搜地名（离线）、书名、出发日期、天数、主题
struct DestinationForm: View {
    let onCreate: (Trip) -> Void

    @EnvironmentObject private var app: AppModel
    @State private var place: Place?
    @State private var title = ""
    @State private var start = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    @State private var days = 5
    @State private var theme = Spec.themes[0]

    var body: some View {
        Form {
            Section {
                if let p = place {
                    HStack {
                        Image(systemName: "mappin").foregroundStyle(Color.eoLake).frame(width: 28)
                        Text(p.displayName()).font(.eoBodyStrong)
                        Spacer()
                        Button("换一个") { place = nil }
                            .font(.eoSub)
                            .buttonStyle(.borderless)
                    }
                    .frame(minHeight: Metrics.touch)
                } else {
                    PlaceSearchField(prompt: "去哪？冰岛、京都、巴黎……") { p in
                        place = p
                        app.world.send(WorldMsg.FlyTo(lat: p.lat - 4, lng: p.lng, alt: 0.55))
                    }
                }
            } header: {
                Text("目的地").font(.eoSub).textCase(nil)
            }
            Section {
                TextField("书名（不填按目的地起名）", text: $title)
                DatePicker("出发", selection: $start, displayedComponents: .date)
                Stepper(value: $days, in: 1...21) {
                    HStack {
                        Text("天数")
                        Spacer()
                        Text(Counts.days(days)).foregroundStyle(.secondary)
                    }
                }
                Picker("主题", selection: $theme) {
                    ForEach(Spec.themes, id: \.self) { t in Text(ThemeName.localized(t)).tag(t) }
                }
            }
            Section {
                Button {
                    guard let p = place else { return }
                    let dest = p.displayName()
                    let name = title.trimmingCharacters(in: .whitespaces)
                    let trip = TripFactory.make(title: name.isEmpty ? TripFactory.defaultTitle(destination: dest, days: days) : name,
                                                destination: dest, place: p, startDate: DayMath.today(now: start), days: days, theme: theme)
                    onCreate(trip)
                } label: {
                    Text("生成这本书")
                }
                .buttonStyle(InkCapsuleButtonStyle())
                .frame(maxWidth: .infinity, alignment: .trailing)
                .disabled(place == nil)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
        }
        .font(.eoBody)
    }
}

/// 导入：选文件（本应用 / 网页版导出的 JSON；行程页 HTML 交给世界层的导入器）或粘贴
struct ImportPane: View {
    let onImported: ([Trip]) -> Void

    @EnvironmentObject private var app: AppModel
    @State private var importing = false
    @State private var pasted = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                Button { importing = true } label: { Label("选择文件", systemImage: "doc") }
            } footer: {
                Text("本应用或网页版导出的 JSON；也可以是带路线数据的行程页 HTML。").font(.eoSub)
            }
            Section {
                TextField("或者把整页 HTML / JSON 粘贴进来", text: $pasted, axis: .vertical)
                    .lineLimit(4...10)
                    .font(.eoSub)
                Button {
                    Task { await parse(pasted) }
                } label: {
                    HStack {
                        Text("导入")
                        if busy { Spacer(); ProgressView() }
                    }
                }
                .disabled(pasted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy)
            }
            if let error {
                Section {
                    Text(error).font(.eoSub).foregroundStyle(.red)
                }
            }
        }
        .font(.eoBody)
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json, .html, .plainText], allowsMultipleSelection: false) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) else {
                error = String(localized: "读不出这个文件。")
                return
            }
            Task { await parse(text) }
        }
    }

    @MainActor
    private func parse(_ raw: String) async {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        error = nil
        busy = true
        defer { busy = false }
        if text.hasPrefix("{") || text.hasPrefix("[") {
            do {
                onImported(try TripImporter.decode(Data(text.utf8)))
            } catch let e {
                error = String(localized: "导入失败：\(e.localizedDescription)")
            }
            return
        }
        guard let r = await app.world.importPage(html: text) else {
            error = String(localized: "这个版本还不能在手机上解析行程页，请先在网页版导入后导出 JSON。")
            return
        }
        if let e = r.error {
            error = String(localized: "导入失败：\(e)")
        } else if r.trips.isEmpty {
            error = String(localized: "页面里没有找到行程。")
        } else {
            onImported(r.trips)
        }
    }
}
