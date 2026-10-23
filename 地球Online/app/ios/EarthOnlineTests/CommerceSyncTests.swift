import XCTest
@testable import EarthOnline

/// 付费门槛与 iCloud 合并规则
final class CommerceSyncTests: XCTestCase {
    func testFreeTierAllowsThreeTrips() {
        let free = Entitlements.free
        XCTAssertTrue(free.canAddTrip(currentCount: 2))
        XCTAssertFalse(free.canAddTrip(currentCount: 3))
        XCTAssertFalse(free.allows(.remotePlanner))
        XCTAssertFalse(free.allows(.iCloudSync))
        XCTAssertFalse(free.allows(.hdExport))
        let pack = Entitlements(isPro: false, packs: [ProductIDs.landmarkPack])
        XCTAssertTrue(pack.allows(.landmarkPack))
        XCTAssertFalse(pack.allows(.unlimitedTrips))
        let pro = Entitlements(isPro: true, packs: [])
        XCTAssertTrue(pro.canAddTrip(currentCount: 99))
        for f in ProFeature.allCases { XCTAssertTrue(pro.allows(f), f.rawValue) }
    }

    func testPlannerFactoryRespectsEntitlements() {
        var s = AppSettings()
        s.useRemotePlanner = true
        s.plannerEndpoint = "https://plan.example.com"
        XCTAssertTrue(PlannerFactory.make(settings: s, entitlements: .free) is LocalRulePlanner)
        XCTAssertTrue(PlannerFactory.make(settings: s, entitlements: Entitlements(isPro: true, packs: [])) is FallbackPlanner)
        s.plannerEndpoint = ""
        XCTAssertTrue(PlannerFactory.make(settings: s, entitlements: Entitlements(isPro: true, packs: [])) is LocalRulePlanner)
    }

    private func trip(_ id: String, updated: String) -> Trip {
        Trip(schemaVersion: Spec.schemaVersion, id: id, title: id, destination: "X", startDate: "2026-10-01", endDate: "2026-10-01",
             theme: Spec.themes[0], seed: 1, status: .planning, plan: nil,
             days: [Day(index: 1, date: "2026-10-01", title: "D1", city: "geo", entries: [])], createdAt: "", updatedAt: updated)
    }

    func testMergeByUpdatedAt() {
        let local = [trip("a", updated: "2026-10-02T00:00:00Z"), trip("b", updated: "2026-10-01T00:00:00Z"), trip("c", updated: "2026-10-01T00:00:00Z")]
        let remote = [trip("a", updated: "2026-10-01T00:00:00Z"), trip("b", updated: "2026-10-03T00:00:00Z"),
                      trip("d", updated: "2026-10-01T00:00:00Z"), trip("gone", updated: "2026-10-01T00:00:00Z")]
        let plan = CloudSyncService.merge(local: local, remote: remote, tombstones: ["gone"])
        XCTAssertEqual(plan.merged.map(\.id), ["a", "b", "c", "d"])
        XCTAssertEqual(plan.merged.first { $0.id == "b" }?.updatedAt, "2026-10-03T00:00:00Z", "远端更新的取远端")
        XCTAssertEqual(Set(plan.upload.map(\.id)), ["a", "c"], "本地更新的、只有本地有的上传")
        XCTAssertEqual(plan.deleteRemote, ["gone"])
    }
}
