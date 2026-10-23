import SwiftUI
import CoreLocation

/// 足迹与家：去过几个地方、离家最远；放家（搜城市 / 当前位置 / 在地球上点）；去过的地方列表；补一面旗
struct FootprintsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @State private var locating = false

    var body: some View {
        let fps = Footprints.compute(trips: store.trips, manual: store.pins, today: app.today)
        let st = Footprints.stats(fps, home: store.home)
        List {
            Section {
                StatGrid(items: [
                    .init(value: Fmt.number(st.places), label: String(localized: "个地方")),
                    .init(value: store.home != nil && st.farthest != nil ? Fmt.km(Double(st.farthestKm)) : "—",
                          label: st.farthest.map { String(localized: "最远，\($0)") } ?? String(localized: "离家最远")),
                ])
                .padding(.vertical, 4)
            }

            Section {
                if let h = store.home {
                    HStack(spacing: 12) {
                        Image(systemName: "house").foregroundStyle(.secondary).frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(h.name).font(.eoBody)
                            Text(Coord.name(lat: h.lat, lng: h.lng)).font(.eoSub).foregroundStyle(.secondary)
                        }
                        Spacer()
                        IconButton("xmark", label: "清除", plain: true) { store.setHome(nil) }
                    }
                    .frame(minHeight: Metrics.touch)
                } else {
                    Text("还没有标注。")
                        .font(.eoSub)
                        .foregroundStyle(.secondary)
                }
                PlaceSearchField(prompt: "搜索城市") { p in
                    store.setHome(HomePlace(name: p.displayName(), lat: p.lat, lng: p.lng))
                    let name = p.displayName()
                    app.showToast(String(localized: "家：\(name)"))
                }
                Button {
                    Task { await useCurrentLocation() }
                } label: {
                    HStack {
                        Label("用当前位置", systemImage: "location")
                        if locating { Spacer(); ProgressView() }
                    }
                }
                .disabled(locating)
                Button { app.startPick(.home) } label: { Label("在地球上选", systemImage: "hand.tap") }
            } header: {
                Text("家").font(.eoSub).textCase(nil)
            }

            Section {
                if fps.isEmpty {
                    Text("还没有去过的地方。")
                        .font(.eoSub)
                        .foregroundStyle(.secondary)
                }
                ForEach(fps) { f in
                    FootprintRow(footprint: f, tripTitle: f.trips.compactMap { store.trip($0)?.title }.first)
                        .swipeActions {
                            if f.source == .manual {
                                Button(role: .destructive) { store.removePin(f.id) } label: { Label("拔掉这面旗", systemImage: "trash") }
                            }
                        }
                }
            } header: {
                Text("去过的地方").font(.eoSub).textCase(nil)
            }

            Section {
                PlaceSearchField(prompt: "搜索地点") { p in
                    store.addPin(name: p.displayName(), lat: p.lat, lng: p.lng)
                    let name = p.displayName()
                    app.showToast(String(localized: "已添加：\(name)"))
                }
                Button { app.startPick(.pin) } label: { Label("在地球上选", systemImage: "hand.tap") }
            } header: {
                Text("补充一个地方").font(.eoSub).textCase(nil)
            }
        }
        .listStyle(.insetGrouped)
        .font(.eoBody)
        .navigationTitle(Text("足迹与家"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func useCurrentLocation() async {
        locating = true
        defer { locating = false }
        guard let loc = await LocationOnce.fetch() else {
            app.showToast(String(localized: "没拿到位置，可以搜城市或在地球上点一下"))
            return
        }
        let lat = loc.coordinate.latitude, lng = loc.coordinate.longitude
        let name = Gazetteer.nearest(lat: lat, lng: lng)?.displayName() ?? String(localized: "我的家")
        store.setHome(HomePlace(name: name, lat: lat, lng: lng))
        app.showToast(String(localized: "家：\(name)"))
    }
}

struct FootprintRow: View {
    let footprint: Footprint
    let tripTitle: String?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "flag.fill")
                .foregroundStyle(Color.eoDawn)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(footprint.name).font(.eoBody).lineLimit(1)
                Text(meta).font(.eoSub).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .frame(minHeight: Metrics.touch)
        .accessibilityElement(children: .combine)
    }

    private var meta: String {
        var parts: [String] = []
        if !footprint.date.isEmpty { parts.append(Fmt.fullDate(footprint.date)) }
        if footprint.source == .manual { parts.append(String(localized: "手动补的")) }
        else if let t = tripTitle { parts.append(plain(t)) }
        return Counts.join(parts)
    }
}

/// 取一次当前位置（最多等 8 秒）
enum LocationOnce {
    @MainActor private static var manager: CLLocationManager?

    @MainActor
    static func fetch(timeout: Duration = .seconds(8)) async -> CLLocation? {
        let m = manager ?? CLLocationManager()
        manager = m
        if m.authorizationStatus == .notDetermined { m.requestWhenInUseAuthorization() }
        return await withTaskGroup(of: CLLocation?.self) { group in
            group.addTask {
                do {
                    for try await update in CLLocationUpdate.liveUpdates() {
                        if let l = update.location { return l }
                    }
                } catch {
                    return nil
                }
                return nil
            }
            group.addTask {
                try? await Task.sleep(for: timeout)
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }
}
