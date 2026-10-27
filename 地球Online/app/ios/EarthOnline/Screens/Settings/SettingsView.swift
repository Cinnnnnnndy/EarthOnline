import SwiftUI

/// 设置：iOS「设置」式的分组列表。外观（天色 / 色调 / 画质）用分段控件，其余是带箭头的行。
struct SettingsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @EnvironmentObject private var purchases: StoreService
    @EnvironmentObject private var sync: CloudSyncService
    @Environment(\.colorScheme) private var colorScheme
    @State private var share: ShareBox?
    @State private var confirmClear = false

    var body: some View {
        List {
            // ---- 地球外的天色（驱动世界层的 set-sky）
            Section {
                Picker("地球外的天色", selection: $store.settings.appearance) {
                    Text("跟随手机").tag(Appearance.auto)
                    Text("白天").tag(Appearance.light)
                    Text("夜晚").tag(Appearance.dark)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            } header: {
                header("地球外的天色")
            }

            Section {
                Picker("浮岛的色调", selection: $store.settings.palette) {
                    Text("海天").tag(Palette.sea)
                    Text("暖阳").tag(Palette.warm)
                    Text("暮色").tag(Palette.dusk)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            } header: {
                header("浮岛的色调")
            }

            Section {
                Picker("画质", selection: $store.settings.post) {
                    Text("高").tag(PostLevel.high)
                    Text("中").tag(PostLevel.medium)
                    Text("省电").tag(PostLevel.low)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            } header: {
                header("画质")
            }

            Section {
                NavigationLink(value: AppPage.avatar) { row("person", "小人", trailing: store.avatar.name) }
                NavigationLink(value: AppPage.footprints) { row("flag", "足迹与家", trailing: store.home?.name ?? String(localized: "未设置")) }
                NavigationLink(value: AppPage.shelf) { row("books.vertical", "全部旅程", trailing: Fmt.number(store.trips.count)) }
            }

            // ---- 语音与规划
            Section {
                Toggle(isOn: $store.settings.speakReplies) { Label("朗读规划助手的回复", systemImage: "speaker.wave.2") }
                Toggle(isOn: remotePlannerBinding) {
                    Label { Text("云端规划") } icon: { Image(systemName: "sparkles") }
                }
                if store.settings.useRemotePlanner {
                    TextField("规划服务地址（https://…）", text: $store.settings.plannerEndpoint)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.eoBody)
                }
            } header: {
                header("语音与规划")
            } footer: {
                Text(plannerNote).font(.eoSub)
            }

            // ---- Pro 与同步
            Section {
                if purchases.entitlements.isPro {
                    row("checkmark.seal", "地球Online Pro", trailing: String(localized: "已开通"))
                } else {
                    Button { app.requestPaywall(.unlimitedTrips) } label: {
                        row("sparkles", "地球Online Pro", trailing: String(localized: "了解"))
                    }
                    .foregroundStyle(.primary)
                }
                Toggle(isOn: iCloudBinding) { Label("iCloud 同步", systemImage: "icloud") }
                if store.settings.iCloudSync {
                    HStack {
                        Text(syncText).font(.eoSub).foregroundStyle(.secondary)
                        Spacer()
                        Button("立即同步") { Task { await app.syncNow() } }
                            .font(.eoSub)
                            .buttonStyle(.borderless)
                    }
                }
                Button("恢复购买") { Task { await purchases.restore() } }
            } header: {
                header("地球Online Pro")
            }

            // ---- 数据
            Section {
                Button { share = ShareBox(items: [ExportFiles.allJSON(store.trips)]) } label: {
                    row("square.and.arrow.up", "导出全部旅程", trailing: "JSON")
                }
                .foregroundStyle(.primary)
                Button(role: .destructive) { confirmClear = true } label: {
                    Label("清空全部旅程", systemImage: "trash")
                }
            } footer: {
                Text(store.settings.iCloudSync ? "旅程和足迹存在这台手机上，并通过 iCloud 同步到你的其他设备。" : "旅程和足迹只存在这台手机上。")
                    .font(.eoSub)
            }
        }
        .listStyle(.insetGrouped)
        .font(.eoBody)
        .navigationTitle(Text("设置"))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $share) { box in ShareSheet(items: box.items).presentationDetents([.medium, .large]) }
        .confirmationDialog(Text("清空全部旅程？"), isPresented: $confirmClear, titleVisibility: .visible) {
            Button("清空", role: .destructive) {
                store.deleteAll()
                app.goHome()
            }
        } message: {
            Text("现有的旅程会被删掉，不能恢复。")
        }
    }

    // MARK: - 小件

    private func header(_ key: LocalizedStringKey) -> some View {
        Text(key).font(.eoSub).textCase(nil)
    }

    private func row(_ symbol: String, _ title: LocalizedStringKey, trailing: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(.secondary)
                .frame(width: 28)
            Text(title).font(.eoBody)
            Spacer(minLength: 8)
            Text(trailing).font(.eoBody).foregroundStyle(.secondary)
        }
        .frame(minHeight: Metrics.touch)
        .contentShape(Rectangle())
    }

    private var plannerNote: String {
        if !purchases.entitlements.allows(.remotePlanner) {
            return String(localized: "语音识别和离线规划都在手机上完成。云端规划是 Pro 功能。")
        }
        if store.settings.useRemotePlanner && store.settings.plannerURL == nil {
            return String(localized: "填上规划服务的地址后才会用云端规划；App 里不保存任何密钥。")
        }
        return String(localized: "语音识别在手机上完成；只把对话文字发给你填的规划服务。")
    }

    private var syncText: String {
        switch sync.status {
        case .off: return String(localized: "未开始")
        case .notConfigured: return String(localized: "这个版本还没有开通 iCloud")
        case .noAccount: return String(localized: "请先在系统设置里登录 iCloud")
        case .syncing: return String(localized: "同步中…")
        case .synced(let d):
            let t = d.formatted(date: .omitted, time: .shortened)
            return String(localized: "已同步，\(t)")
        case .failed(let m): return m
        }
    }

    private var remotePlannerBinding: Binding<Bool> {
        Binding {
            store.settings.useRemotePlanner
        } set: { on in
            if on && !purchases.entitlements.allows(.remotePlanner) { app.requestPaywall(.remotePlanner); return }
            store.settings.useRemotePlanner = on
        }
    }

    private var iCloudBinding: Binding<Bool> {
        Binding {
            store.settings.iCloudSync
        } set: { on in
            if on && !purchases.entitlements.allows(.iCloudSync) { app.requestPaywall(.iCloudSync); return }
            store.settings.iCloudSync = on
            if on { Task { await app.syncNow() } }
        }
    }
}

/// 小人：名字、发型、帽子（颜色等更多装扮在 Pro 的装扮包里）
struct AvatarView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @EnvironmentObject private var purchases: StoreService
    @State private var avatar = Avatar()
    @State private var loaded = false

    var body: some View {
        Form {
            Section {
                TextField("名字", text: $avatar.name)
            }
            // 默认形象（D101）：点一下整套换上，下面的选项还能再细调
            Section {
                HStack(spacing: 12) {
                    ForEach(AvatarPreset.all) { p in
                        Button { avatar = p.applied(to: avatar) } label: {
                            VStack(spacing: 6) {
                                Image(systemName: p.symbol).font(.eoBody)
                                Text(verbatim: p.avatar.name).font(.eoSub)
                            }
                            .frame(maxWidth: .infinity, minHeight: 64)
                        }
                        .buttonStyle(.glass)
                        .accessibilityLabel(Text(verbatim: p.avatar.name))
                    }
                }
            } header: {
                Text("默认形象").font(.eoSub).textCase(nil)
            }
            Section {
                // 形态（D86）：小人、八只动物、三只自建 IP（嵌入页按 form 建角色）
                Picker("形态", selection: Binding(get: { avatar.form ?? "human" }, set: { avatar.form = $0 == "human" ? nil : $0 })) {
                    Text("小人").tag("human")
                    Text("狐狸").tag("fox")
                    Text("猫").tag("cat")
                    Text("柴犬").tag("shiba")
                    Text("小熊").tag("bear")
                    Text("兔子").tag("rabbit")
                    Text("企鹅").tag("penguin")
                    Text("熊猫").tag("panda")
                    Text("小鸭").tag("duck")
                    Text("豆丁").tag("bean")
                    Text("云团").tag("cloud")
                    Text("海豹").tag("seal")
                    Text("海獭").tag("otter")
                    Text("水豚").tag("capybara")
                    Text("石头精").tag("pebble")
                    Text("长毛猫").tag("persian")
                }
            }
            Section {
                Picker("发型", selection: $avatar.hair) {
                    Text("丸子头").tag("bun")
                    Text("长发").tag("long")
                    Text("短发").tag("short")
                }
                Picker("帽子", selection: $avatar.hat) {
                    Text("草帽").tag("straw")
                    Text("棒球帽").tag("cap")
                    Text("不戴").tag("none")
                }
                Toggle("眼镜", isOn: Binding(get: { avatar.glasses ?? false }, set: { avatar.glasses = $0 ? true : nil }))
                Stepper(value: $avatar.dress, in: 0...(purchases.entitlements.allows(.outfitPack) ? 11 : 3)) {
                    let nStyle = avatar.dress + 1
                    Text("衣服：第 \(nStyle) 款")
                }
                Stepper(value: $avatar.skin, in: 0...4) {
                    let nTone = avatar.skin + 1
                    Text("肤色：第 \(nTone) 种")
                }
            } footer: {
                if !purchases.entitlements.allows(.outfitPack) {
                    Button("更多衣服和帽子在装扮包里") { app.requestPaywall(.outfitPack) }
                        .font(.eoSub)
                        .buttonStyle(.borderless)
                }
            }
        }
        .font(.eoBody)
        .navigationTitle(Text("小人"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !loaded else { return }
            avatar = store.avatar
            loaded = true
        }
        .onChange(of: avatar) { _, a in
            guard loaded else { return }
            store.setAvatar(a)
            app.world.send(WorldMsg.SetAvatar(avatar: a))
        }
    }
}
