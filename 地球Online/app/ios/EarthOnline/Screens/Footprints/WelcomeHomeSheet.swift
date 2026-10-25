import SwiftUI

/// 第一次打开：先把家放到地球上（D100）。像游戏开局的第一步——地球在后面，面板只问一件事。
/// 首选「用当前位置」（只要「使用 App 期间」的大致位置），也可以搜城市或在地球上点一下；「以后再说」跳过。
/// 不管选哪条都只问这一次（homeAsked），以后在「足迹与家」里改。
struct WelcomeHomeSheet: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @Environment(\.dismiss) private var dismiss
    @State private var locating = false

    var body: some View {
        FittedSheet {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    Image(systemName: "house.fill")
                        .font(.eoBody)
                        .foregroundStyle(Color.eoDawn)
                        .frame(width: Metrics.touch, height: Metrics.touch)
                        .glassEffect(.regular, in: .circle)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("先在地球上放下你的家").font(.eoTitle)
                        Text("旅程从这里出发，回来也落在这里；地球外的天色跟着家的日出日落。")
                            .font(.eoSub)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Button {
                    Task { await useCurrentLocation() }
                } label: {
                    HStack(spacing: 8) {
                        if locating { ProgressView().tint(Color(uiColor: .systemBackground)) } else { Image(systemName: "location.fill") }
                        Text("用当前位置")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(InkCapsuleButtonStyle())
                .disabled(locating)

                PlaceSearchField(prompt: "或者搜一个城市") { p in
                    setHome(name: p.displayName(), lat: p.lat, lng: p.lng)
                }

                HStack {
                    Button {
                        store.markHomeAsked()
                        app.startPick(.home)
                    } label: {
                        Label("在地球上点一下", systemImage: "hand.tap")
                    }
                    .buttonStyle(.glass)
                    Spacer()
                    Button("以后再说") {
                        store.markHomeAsked()
                        dismiss()
                    }
                    .font(.eoSub)
                    .foregroundStyle(.secondary)
                    .frame(minHeight: Metrics.touch)
                }
            }
            .padding(20)
        }
        .interactiveDismissDisabled(locating)
        .onDisappear { store.markHomeAsked() }
    }

    private func useCurrentLocation() async {
        locating = true
        defer { locating = false }
        guard let loc = await LocationOnce.fetch() else {
            app.showToast(String(localized: "没拿到位置，可以搜城市或在地球上点一下"))
            return
        }
        let lat = loc.coordinate.latitude, lng = loc.coordinate.longitude
        setHome(name: Gazetteer.nearest(lat: lat, lng: lng)?.displayName() ?? String(localized: "我的家"), lat: lat, lng: lng)
    }

    private func setHome(name: String, lat: Double, lng: Double) {
        store.setHome(HomePlace(name: name, lat: lat, lng: lng))
        store.markHomeAsked()
        app.showToast(String(localized: "家：\(name)"))
        app.world.send(WorldMsg.FlyTo(lat: lat - 6, lng: lng, alt: 1.3))
        dismiss()
    }
}
