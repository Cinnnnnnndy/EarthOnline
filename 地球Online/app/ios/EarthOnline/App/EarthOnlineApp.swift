import SwiftUI

@main
struct EarthOnlineApp: App {
    @StateObject private var app = AppModel(launch: .current())
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .environmentObject(app.store)
                .environmentObject(app.world)
                .environmentObject(app.purchases)
                .environmentObject(app.sync)
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background:
                app.store.saveNow()
            case .active:
                Task { await app.syncNow() }
            default:
                break
            }
        }
    }
}
