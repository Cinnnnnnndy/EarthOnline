import SwiftUI

/// 编辑 / 新建一个条目（站点、交通、住宿）。站点可选景点类型（不选就自动推断），可从小地名表补坐标。
struct EntryEditorSheet: View {
    let tripID: String
    let day: Int
    let entryID: String?
    let kind: EntryKind

    var body: some View {
        NavigationStack {
            EntryEditorForm(tripID: tripID, day: day, entryID: entryID, kind: kind)
        }
        .presentationDetents([.large])
    }
}

struct EntryEditorForm: View {
    let tripID: String
    let day: Int
    let entryID: String?
    let kind: EntryKind

    @EnvironmentObject private var store: TripStore
    @Environment(\.dismiss) private var dismiss

    @State private var loaded = false
    // 站点
    @State private var name = ""
    @State private var category: PlaceCategory = .sight
    @State private var kindID = ""
    @State private var hasTime = false
    @State private var time = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var stay = 0
    @State private var notes = ""
    @State private var geo: GeoPoint?
    // 交通
    @State private var mode: TransportMode = .walk
    @State private var label = ""
    @State private var minutes = 0
    @State private var km: Double = 0

    private var isNew: Bool { entryID == nil }

    var body: some View {
        Form {
            switch kind {
            case .place: placeFields
            case .transport: transportFields
            case .lodging: lodgingFields
            }
            if !isNew {
                Section {
                    Button("删除", role: .destructive) {
                        if let id = entryID { store.removeEntry(tripID, day: day, entryID: id) }
                        dismiss()
                    }
                }
            }
        }
        .font(.eoBody)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("完成") { save(); dismiss() }
                    .disabled(!canSave)
            }
        }
        .onAppear(perform: load)
    }

    private var title: LocalizedStringKey {
        switch kind {
        case .place: return isNew ? "添加站点" : "编辑站点"
        case .transport: return isNew ? "添加交通" : "编辑交通"
        case .lodging: return isNew ? "添加住宿" : "编辑住宿"
        }
    }

    private var canSave: Bool {
        switch kind {
        case .place, .lodging: return !name.trimmingCharacters(in: .whitespaces).isEmpty
        case .transport: return true
        }
    }

    // MARK: - 字段

    @ViewBuilder
    private var placeFields: some View {
        Section {
            TextField("名字", text: $name)
            Picker("类别", selection: $category) {
                ForEach(PlaceCategory.allCases, id: \.self) { c in Text(c.localizedName).tag(c) }
            }
            Picker("景点类型", selection: $kindID) {
                Text("自动（\(LandmarkKinds.localizedName(autoKind))）").tag("")
                ForEach(LandmarkKinds.kinds.filter { $0.id != "sight" }, id: \.id) { k in
                    Label { Text(LandmarkKinds.localizedName(k.id)) } icon: { Image(systemName: LandmarkKinds.symbol(forIcon: k.icon)) }
                        .tag(k.id)
                }
            }
        }
        Section {
            Toggle("计划时间", isOn: $hasTime)
            if hasTime {
                DatePicker("到达", selection: $time, displayedComponents: .hourAndMinute)
            }
            Stepper(value: $stay, in: 0...600, step: 15) {
                if stay == 0 { Text("停留：自动") } else { Text("停留：\(Fmt.duration(stay))") }
            }
        }
        Section {
            TextField("备注", text: $notes, axis: .vertical)
                .lineLimit(2...6)
        }
        Section {
            if let g = geo {
                Text(Coord.name(lat: g.lat, lng: g.lng))
                    .font(.eoSub)
                    .foregroundStyle(.secondary)
                Button("清除坐标", role: .destructive) { geo = nil }
            } else {
                Button("按名字查坐标") {
                    if let p = Gazetteer.locate(name) { geo = GeoPoint(lat: p.lat, lng: p.lng) }
                }
                .disabled(name.isEmpty)
            }
        } header: {
            Text("坐标").font(.eoSub).textCase(nil)
        } footer: {
            Text("有坐标的站点会出现在地球上，也能生成真实地形的底板。").font(.eoSub)
        }
    }

    @ViewBuilder
    private var transportFields: some View {
        Section {
            Picker("方式", selection: $mode) {
                ForEach(TransportMode.allCases, id: \.self) { m in
                    Label { Text(m.localizedName) } icon: { Image(systemName: m.symbol) }.tag(m)
                }
            }
            TextField("名字（如 JR 关空快速）", text: $label)
            Stepper(value: $minutes, in: 0...1440, step: 5) {
                if minutes == 0 { Text("时长：未填") } else { Text("时长：\(Fmt.duration(minutes))") }
            }
            HStack {
                Text("距离")
                Spacer()
                TextField("公里", value: $km, format: .number.precision(.fractionLength(0...1)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 120)
                Text(verbatim: "km").foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var lodgingFields: some View {
        Section {
            TextField("名字", text: $name)
            TextField("备注", text: $notes, axis: .vertical)
                .lineLimit(2...6)
        }
    }

    private var autoKind: String { LandmarkKinds.classify(name: name, category: category, kind: nil) }

    // MARK: - 读写

    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let id = entryID, let t = store.trip(tripID), t.days.indices.contains(day),
              let e = t.days[day].entries.first(where: { $0.id == id }) else { return }
        switch e {
        case .place(let p):
            name = p.name; category = p.category; kindID = p.kind ?? ""; notes = p.notes ?? ""; geo = p.geo; stay = p.stayMinutes ?? 0
            if let s = p.plannedStart, let d = TimeText.date(s) { hasTime = true; time = d }
        case .transport(let tr):
            mode = tr.mode; label = tr.label; minutes = tr.durationMinutes ?? 0; km = tr.distanceKm ?? 0
        case .lodging(let l):
            name = l.name; notes = l.notes ?? ""
        }
    }

    private func save() {
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let entry: Entry
        switch kind {
        case .place:
            var old: PlaceEntry?
            if let id = entryID, let t = store.trip(tripID), t.days.indices.contains(day) {
                old = t.days[day].entries.first { $0.id == id }?.place
            }
            entry = .place(PlaceEntry(id: entryID ?? "new", name: name.trimmingCharacters(in: .whitespaces), category: category,
                                      plannedStart: hasTime ? TimeText.string(time) : nil, stayMinutes: stay > 0 ? stay : nil,
                                      notes: trimmedNotes.isEmpty ? nil : trimmedNotes, visited: old?.visited, visitedAt: old?.visitedAt,
                                      geo: geo, kind: kindID.isEmpty ? nil : kindID))
        case .transport:
            let l = label.trimmingCharacters(in: .whitespaces)
            entry = .transport(TransportEntry(id: entryID ?? "new", mode: mode, label: l.isEmpty ? mode.localizedName : l,
                                              durationMinutes: minutes > 0 ? minutes : nil, distanceKm: km > 0 ? km : nil,
                                              polyline: nil))
        case .lodging:
            entry = .lodging(LodgingEntry(id: entryID ?? "new", name: name.trimmingCharacters(in: .whitespaces),
                                          notes: trimmedNotes.isEmpty ? nil : trimmedNotes))
        }
        if entryID == nil { store.addEntry(tripID, day: day, entry: entry) } else { store.replaceEntry(tripID, day: day, entry: entry) }
    }
}

/// "HH:MM" ↔ Date（今天的那个时刻，只给 DatePicker 用）
enum TimeText {
    static func date(_ s: String) -> Date? {
        let p = s.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2 else { return nil }
        return Calendar.current.date(bySettingHour: p[0], minute: p[1], second: 0, of: Date())
    }

    static func string(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

/// 编辑一整天：标题、住处、条目的顺序与增删
struct DayEditorSheet: View {
    let tripID: String
    let day: Int

    @EnvironmentObject private var store: TripStore
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var lodging = ""
    @State private var loaded = false
    @State private var path: [String] = []

    var body: some View {
        NavigationStack(path: $path) {
            if let trip = store.trip(tripID), trip.days.indices.contains(day) {
                let d = trip.days[day]
                List {
                    Section {
                        TextField("这一天的标题", text: $title)
                        TextField("当晚住处", text: $lodging)
                    } header: {
                        Text(verbatim: "D\(d.index)").font(.eoSub).textCase(nil)
                    }
                    Section {
                        ForEach(d.entries) { e in
                            NavigationLink(value: e.id) { EntryListRow(entry: e) }
                        }
                        .onDelete { idx in
                            for i in idx { store.removeEntry(tripID, day: day, entryID: d.entries[i].id) }
                        }
                        .onMove { from, to in store.moveEntries(tripID, day: day, from: from, to: to) }
                        Menu {
                            Button { path.append("new:place") } label: { Label("站点", systemImage: "mappin") }
                            Button { path.append("new:transport") } label: { Label("交通", systemImage: "tram") }
                            Button { path.append("new:lodging") } label: { Label("住宿", systemImage: "bed.double") }
                        } label: {
                            Label("添加", systemImage: "plus")
                                .font(.eoBody)
                                .foregroundStyle(Color.eoLake)
                        }
                    } header: {
                        Text("行程").font(.eoSub).textCase(nil)
                    }
                }
                .font(.eoBody)
                .navigationTitle(Text("编辑这一天"))
                .navigationBarTitleDisplayMode(.inline)
                .navigationDestination(for: String.self) { key in
                    destination(key, d)
                }
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) { EditButton() }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("完成") { commit(); dismiss() }
                    }
                }
                .onAppear {
                    guard !loaded else { return }
                    loaded = true
                    title = d.title
                    lodging = d.lodging ?? ""
                }
                .onDisappear { commit() }
            } else {
                Text("这一天已经不在了。").font(.eoBody)
            }
        }
        .presentationDetents([.large])
    }

    @ViewBuilder
    private func destination(_ key: String, _ d: Day) -> some View {
        if key.hasPrefix("new:") {
            let k = EntryKind(rawValue: String(key.dropFirst(4))) ?? .place
            EntryEditorForm(tripID: tripID, day: day, entryID: nil, kind: k)
        } else if let e = d.entries.first(where: { $0.id == key }) {
            EntryEditorForm(tripID: tripID, day: day, entryID: e.id, kind: e.kindForEditor)
        }
    }

    private func commit() {
        guard loaded else { return }
        let t = title.trimmingCharacters(in: .whitespaces)
        let l = lodging.trimmingCharacters(in: .whitespaces)
        guard let trip = store.trip(tripID), trip.days.indices.contains(day) else { return }
        let d = trip.days[day]
        if (!t.isEmpty && t != d.title) || (l != (d.lodging ?? "")) {
            store.setDayMeta(tripID, day: day, title: t.isEmpty ? nil : t, lodging: .some(l.isEmpty ? nil : l))
        }
    }
}

/// 编辑列表里的一行
struct EntryListRow: View {
    let entry: Entry

    var body: some View {
        switch entry {
        case .place(let p):
            StopRow(place: p, time: p.plannedStart, showsKindLabel: true)
        case .transport(let t):
            LegRow(legs: [t])
        case .lodging(let l):
            HStack(spacing: 12) {
                Image(systemName: "bed.double").foregroundStyle(.secondary).frame(width: 28)
                Text(l.name).font(.eoBody)
            }
            .frame(minHeight: Metrics.touch)
        }
    }
}

extension Entry {
    var kindForEditor: EntryKind {
        switch self {
        case .place: return .place
        case .transport: return .transport
        case .lodging: return .lodging
        }
    }
}
