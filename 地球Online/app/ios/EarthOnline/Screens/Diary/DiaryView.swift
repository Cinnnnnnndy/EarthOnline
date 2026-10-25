import SwiftUI
import PhotosUI

/// 封底 = 旅行日记：统计（SAS 式两列：数值 semibold 17、说明 regular 17 次要色）、每天的日记（自动生成、可改）、
/// 导出长图（Pro 高清）、导出行程数据、合上 / 重新翻开这本书
struct DiaryView: View {
    let tripID: String

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @State private var share: ShareBox?
    @State private var exporting = false
    @StateObject private var suitcase = SuitcaseBridge()
    @State private var editingCase = false
    @State private var photoItem: PhotosPickerItem?

    var body: some View {
        if let trip = store.trip(tripID) {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plain(trip.title)).font(.eoTitle)
                        Text(Fmt.fullDate(trip.startDate) + " – " + Fmt.fullDate(trip.endDate))
                            .font(.eoSub)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    StatGrid(items: statItems(trip))
                        .padding(.vertical, 4)
                }
                // 这一趟的行李箱（第八轮末，D75 / D78）：世界层里的 3D 箱子——名胜小模型、特色物件、这趟穿搭的小人；旁边一个导出的图标按钮
                Section {
                    SuitcaseWebView(trip: trip, avatar: store.avatar, bridge: suitcase)
                        .aspectRatio(4 / 5, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .accessibilityLabel(Text("这一趟的行李箱"))
                        .padding(.vertical, 4)
                    HStack {
                        Text("这一趟的行李箱").font(.eoSub).foregroundStyle(.secondary)
                        Spacer()
                        IconButton("slider.horizontal.3", label: "增减箱子里的东西", plain: true) { editingCase = true }
                        IconButton("square.and.arrow.up", label: "导出行李箱", plain: true) {
                            Task { await exportSuitcase(trip) }
                        }
                    }
                    // 箱子的样式（D81）：存在小人的档案里，四款
                    Picker("箱子的样式", selection: Binding(get: { store.avatar.suitcase ?? "sand" }, set: { v in var a = store.avatar; a.suitcase = v; store.setAvatar(a); suitcase.show(trip: trip, avatar: a) })) {
                        Text("沙色硬壳").tag("sand")
                        Text("墨色硬壳").tag("ink")
                        Text("帆布箱").tag("canvas")
                        Text("复古木箱").tag("trunk")
                    }
                    .pickerStyle(.segmented)
                    .font(.eoSub)
                }
                .sheet(isPresented: $editingCase) {
                    SuitcaseEditSheet(trip: trip, bridge: suitcase, photoItem: $photoItem)
                        .presentationDetents([.medium, .large])
                }
                .onChange(of: photoItem) { _, item in
                    guard let item else { return }
                    Task { await addPhoto(item, to: trip) }
                }
                Section {
                    ForEach(Array(trip.days.enumerated()), id: \.element.index) { i, d in
                        DiaryDayEditor(trip: trip, dayIndex: i)
                    }
                } header: {
                    Text("每天的日记").font(.eoSub).textCase(nil)
                }
                Section {
                    Button {
                        Task { await exportImage(trip) }
                    } label: {
                        HStack {
                            Label("导出长图", systemImage: "photo")
                            Spacer()
                            if exporting { LongImageProgress(world: app.world) }
                            else if !app.entitlements.allows(.hdExport) { Text("高清为 Pro").font(.eoSub).foregroundStyle(.secondary) }
                        }
                    }
                    .disabled(exporting)
                    Button {
                        share = ShareBox(items: [ExportFiles.json(for: trip)])
                    } label: {
                        Label("导出行程数据", systemImage: "square.and.arrow.up")
                    }
                    Button {
                        let closed = trip.status == .closed
                        store.update(trip.id) { $0.status = closed ? .planning : .closed }
                        app.showToast(closed ? String(localized: "重新翻开了这本书") : String(localized: "这本书合上了"))
                        app.goHome()
                        app.path = []
                    } label: {
                        Label(trip.status == .closed ? "重新翻开这本书" : "合上这本书", systemImage: "book.closed")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .font(.eoBody)
            .navigationTitle(Text("旅行日记"))
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .sheet(item: $share) { box in
                ShareSheet(items: box.items).presentationDetents([.medium, .large])
            }
        } else {
            Text("这本书已经不在了。").font(.eoBody)
        }
    }

    /// 第七轮 / 第八轮按网页精简：只有四格（天、站点、打卡、国家或目的地）
    private func statItems(_ trip: Trip) -> [StatGrid.Item] {
        let s = Stats.of(trip)
        return [
            .init(value: Fmt.number(s.days), label: String(localized: "天")),
            .init(value: Fmt.number(s.places), label: String(localized: "个站点")),
            .init(value: Fmt.number(s.visited), label: String(localized: "处打过卡")),
            .init(value: Fmt.number(s.destinations), label: s.destinations > 1 ? String(localized: "个国家") : String(localized: "个目的地")),
        ]
    }

    /// 放一张照片进箱子（D82）：Vision 抠出主体做成立牌；它抠不出来再请嵌入页的本机抠图试一次（D99），还不行整张做成拍立得；图存在设备上，书里只记尺寸
    @MainActor
    private func addPhoto(_ item: PhotosPickerItem, to trip: Trip) async {
        defer { photoItem = nil }
        guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data),
              let made = await SubjectLifter.lift(image, fallback: { await suitcase.makeCard(jpeg: $0) }) else { app.showToast(String(localized: "这张照片读不出来")); return }
        let id = "card-" + String(Int(Date().timeIntervalSince1970), radix: 36)
        CaseCardStore.save(made.data, id: id)
        store.setSuitcaseEdits(trip.id) { e in e.cards = Array(((e.cards ?? []) + [CaseCard(id: id, kind: made.kind, w: made.w, h: made.h, label: nil)]).suffix(3)) }
        if let t = store.trip(trip.id) { suitcase.show(trip: t, avatar: store.avatar) }
        app.showToast(String(localized: made.kind == "cutout" ? "抠出了主体，做成了立牌" : "背景太复杂，整张做成了拍立得"))
    }

    /// 让嵌入页渲染一张 1080 × 1350 的 PNG（SuitcaseBridge），存到临时目录给分享面板
    @MainActor
    private func exportSuitcase(_ trip: Trip) async {
        guard let data = await suitcase.export() else { app.showToast(String(localized: "导出失败")); return }
        let url = ExportFiles.directory().appendingPathComponent(ExportFiles.safeName(String(localized: "\(trip.title) 行李箱")) + ".png")
        do {
            try data.write(to: url, options: .atomic)
            share = ShareBox(items: [url])
        } catch {
            app.showToast(String(localized: "导出失败"))
        }
    }

    @MainActor
    private func exportImage(_ trip: Trip) async {
        exporting = true
        defer { exporting = false }
        // 先用嵌入页的长图（D96：每天一张世界层的渲染图，和网页、鸿蒙、安卓同一份排版）；拿不到再用原生的文字版
        if let png = await app.world.exportLongImage(trip: trip) {
            let url = ExportFiles.directory().appendingPathComponent("\(ExportFiles.safeName(trip.title)).png")
            if (try? png.write(to: url, options: .atomic)) != nil { share = ShareBox(items: [url]); return }
        }
        let hd = app.entitlements.allows(.hdExport)
        if let url = LongImageExporter.export(trip: trip, highResolution: hd) {
            share = ShareBox(items: [url])
        } else {
            app.showToast(String(localized: "导出失败"))
        }
    }
}

/// 两列统计：数值 semibold、说明 regular 次要色，同一字号
struct StatGrid: View {
    struct Item: Hashable {
        var value: String
        var label: String
    }

    let items: [Item]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)], alignment: .leading, spacing: 12) {
            ForEach(items, id: \.self) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.value)
                        .font(.eoBodyStrong)
                        .monospacedDigit()
                    Text(item.label)
                        .font(.eoBody)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// 一天的日记：标题、日期与城市、可编辑正文、「重写」
struct DiaryDayEditor: View {
    let trip: Trip
    let dayIndex: Int

    @EnvironmentObject private var store: TripStore
    @State private var text = ""
    @State private var loaded = false

    var body: some View {
        let d = trip.days[dayIndex]
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 6) {
                TagView(text: "D\(d.index)")
                Text(plain(d.title))
                    .font(.eoBodyStrong)
                    .lineLimit(1)
                Spacer(minLength: 8)
                IconButton("arrow.counterclockwise", label: "重写", plain: true) {
                    store.setDayMeta(trip.id, day: dayIndex, diary: .some(nil))
                    text = DiaryWriter.generate(seed: trip.seed, day: d)
                }
            }
            Text(Fmt.monthDay(d.date))
                .font(.eoSub)
                .foregroundStyle(.secondary)
            TextEditor(text: $text)
                .font(.eoBody)
                .frame(minHeight: 96)
                .scrollContentBackground(.hidden)
                .onChange(of: text) { _, new in
                    guard loaded else { return }
                    let generated = DiaryWriter.generate(seed: trip.seed, day: d)
                    let current = store.trip(trip.id)?.days[dayIndex].diary
                    if new == generated && current == nil { return }
                    if new != current { store.setDayMeta(trip.id, day: dayIndex, diary: .some(new)) }
                }
        }
        .padding(.vertical, 4)
        .onAppear {
            guard !loaded else { return }
            text = d.diary ?? DiaryWriter.generate(seed: trip.seed, day: d)
            loaded = true
        }
    }
}


/// 增减箱子里的东西（D82）：列出箱子里现在有什么（嵌入页发来的清单），滑一下拿出来；放一张照片进去；恢复默认
/// 清单（D82 / D84）：照仓库主人发来的那条视频——一个搜索框（打一句话或一个词）、几枚场景标签、下面按组一格一格类 emoji 的东西，点一格放进箱子或拿出来。
/// 检索、分组、图标都是嵌入页做的（SuitcaseBridge 的 case-search / case-toggle），这里只画；放照片、恢复默认在最下面。
struct SuitcaseEditSheet: View {
    let trip: Trip
    @ObservedObject var bridge: SuitcaseBridge
    @Binding var photoItem: PhotosPickerItem?

    @EnvironmentObject private var store: TripStore
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var searchTask: Task<Void, Never>?

    private let scenes = ["追极光", "躺海边", "慢慢逛", "走山路"]
    private let columns = [GridItem(.adaptive(minimum: 72), spacing: 4)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                        TextField("找东西，或说一句：下雨天去京都逛三天", text: $query)
                            .font(.eoBody)
                            .textInputAutocapitalization(.never)
                            .submitLabel(.search)
                            .onSubmit { bridge.search(query) }
                        if !query.isEmpty {
                            Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                                .accessibilityLabel(Text("清除"))
                        }
                    }
                    .padding(.horizontal, 12).frame(height: 40)
                    .background(Color(.secondarySystemFill), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(scenes, id: \.self) { key in
                                let text = String(localized: String.LocalizationValue(key))
                                Button(text) { query = text; bridge.search(text) }
                                    .font(.eoSub)
                                    .padding(.horizontal, 12).frame(height: 32)
                                    .overlay(Capsule().strokeBorder(Color(.separator), lineWidth: 0.5))
                            }
                        }
                    }
                    if !bridge.items.isEmpty && query.isEmpty {
                        Text("箱子里的").font(.eoSub).foregroundStyle(.secondary).padding(.top, 4)
                        LazyVGrid(columns: columns, spacing: 8) {
                            ForEach(bridge.items) { item in
                                CaseTile(label: item.label, sub: nil, icon: item.icon, inBox: true, remove: true) { removeFromBox(item) }
                            }
                        }
                    }
                    if bridge.groups.isEmpty && !query.isEmpty {
                        Text("库里没有这样的东西").font(.eoSub).foregroundStyle(.secondary).padding(.vertical, 16)
                    }
                    ForEach(bridge.groups) { group in
                        Text(group.label).font(.eoSub).foregroundStyle(.secondary).padding(.top, 4)
                        LazyVGrid(columns: columns, spacing: 8) {
                            ForEach(group.entries) { entry in
                                CaseTile(label: entry.label, sub: entry.sub, icon: entry.icon, inBox: entry.inBox, remove: false) { bridge.toggle(entry) }
                            }
                        }
                    }
                    Divider().padding(.vertical, 6)
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("放一张照片进去", systemImage: "photo.badge.plus").font(.eoBody)
                    }
                    if !(trip.suitcase?.hidden?.isEmpty ?? true) || !(trip.suitcase?.picks?.isEmpty ?? true) || !(trip.suitcase?.gear?.isEmpty ?? true) {
                        Button {
                            store.setSuitcaseEdits(trip.id) { e in e.hidden = nil; e.picks = nil; e.gear = nil }
                            reshow()
                        } label: {
                            Label("恢复默认", systemImage: "arrow.counterclockwise").font(.eoBody)
                        }
                    }
                }
                .padding(16)
            }
            .navigationTitle(Text("清单"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
            .onAppear {
                bridge.onEdits = { [weak store, weak app, weak bridge] edits, result in
                    guard let store, let bridge else { return }
                    if result == "frontFull" { app?.showToast(String(localized: "前排放满了，先拿出一样")); return }
                    if result == "backFull" { app?.showToast(String(localized: "后排放满了，先拿出一样")); return }
                    store.setSuitcaseEdits(trip.id) { e in e = edits ?? CaseEdits() }
                    if let t = store.trip(trip.id) { bridge.show(trip: t, avatar: store.avatar) }
                    bridge.search(bridge.lastQuery)
                }
                bridge.search(query)
            }
            .onChange(of: query) { _, q in
                searchTask?.cancel()
                searchTask = Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(200))
                    if !Task.isCancelled { bridge.search(q) }
                }
            }
        }
    }

    /// 「箱子里的」那一排点一格：照片卡直接删，其余和清单里点一格一样走嵌入页的规则
    private func removeFromBox(_ item: SuitcaseBridge.SuitcaseItem) {
        if item.type == "card" {
            store.setSuitcaseEdits(trip.id) { e in e.cards = (e.cards ?? []).filter { $0.id != item.key } }
            CaseCardStore.delete(id: item.key)
            reshow()
        } else {
            bridge.toggle(SuitcaseBridge.CaseEntry(type: item.type, key: item.key, label: item.label, sub: "", inBox: true, icon: nil))
        }
    }

    private func reshow() {
        if let t = store.trip(trip.id) { bridge.show(trip: t, avatar: store.avatar) }
        bridge.search(bridge.lastQuery)
    }
}

/// 清单里的一格：类 emoji 的图标（嵌入页渲染的）+ 名字（+ 副标题）；在箱子里的右上角一个勾，「箱子里的」那排是叉
private struct CaseTile: View {
    let label: String
    let sub: String?
    let icon: UIImage?
    let inBox: Bool
    let remove: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 1) {
                ZStack(alignment: .topTrailing) {
                    Group {
                        if let icon { Image(uiImage: icon).resizable().scaledToFit() }
                        else { RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(.secondarySystemFill)).frame(width: 44, height: 44) }
                    }
                    .frame(width: 62, height: 62)
                    if inBox {
                        Image(systemName: remove ? "xmark" : "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(remove ? Color.secondary : Color(.systemBackground))
                            .frame(width: 18, height: 18)
                            .background(remove ? Color(.secondarySystemFill) : Color.primary, in: Circle())
                    }
                }
                Text(label).font(.caption).fontWeight(inBox && !remove ? .semibold : .regular).lineLimit(1)
                if let sub, !sub.isEmpty { Text(sub).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(inBox ? "拿出\(label)" : "放进\(label)"))
    }
}

/// 导出长图时的进度：嵌入页按天回的那句（「渲染第 2 / 5 天」「拼图」）加一个转圈；世界层还没回话时只有转圈
private struct LongImageProgress: View {
    @ObservedObject var world: WorldController

    var body: some View {
        HStack(spacing: 6) {
            if let text = world.longImageProgress { Text(text).font(.eoSub).foregroundStyle(.secondary).lineLimit(1) }
            ProgressView()
        }
    }
}
