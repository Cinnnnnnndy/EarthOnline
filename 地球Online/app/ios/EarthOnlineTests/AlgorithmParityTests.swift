import XCTest
@testable import EarthOnline

/// 与 TypeScript 参考实现逐字一致：PRNG、日记、时间线（期望值由 node 跑 shared/algo 算出）
final class AlgorithmParityTests: XCTestCase {
    private let day = Day(index: 1, date: "2026-11-14", title: "大阪 · 抵达", city: "osaka", entries: [
        .place(PlaceEntry(id: "d1-e0", name: "关西机场", category: .airport, plannedStart: "13:30")),
        .transport(TransportEntry(id: "d1-e1", mode: .rail, label: "JR 关空快速", durationMinutes: 50)),
        .place(PlaceEntry(id: "d1-e2", name: "道顿堀", category: .sight, notes: "吃章鱼烧 · 看夜景。", visited: true)),
        .transport(TransportEntry(id: "d1-e3", mode: .walk, label: "", durationMinutes: 80)),
        .place(PlaceEntry(id: "d1-e4", name: "心斋桥", category: .shop)),
        .place(PlaceEntry(id: "d1-e5", name: "大阪城", category: .sight, plannedStart: "18:00")),
    ], lodging: "难波")

    func testHashAndRandom() {
        XCTAssertEqual(PRNG.hashString("2026-11-14"), 1_880_875_346)
        XCTAssertEqual(PRNG.hashString("关西七日|2026-11-14"), 2_042_574_882)
        XCTAssertEqual(PRNG.hashString(""), 2_166_136_261)
        var r = Mulberry32(seed: 12345)
        XCTAssertEqual(r.next(), 0.9797282677609473, accuracy: 1e-15)
        XCTAssertEqual(r.next(), 0.3067522644996643, accuracy: 1e-15)
        XCTAssertEqual(r.next(), 0.484205421525985, accuracy: 1e-15)
    }

    func testDiaryMatchesTypeScript() {
        XCTAssertEqual(DiaryWriter.generate(seed: 20_261_114, day: day, language: .zhHans),
                       "关西机场是今天的起点。JR 关空快速后到了道顿堀（到过）。吃章鱼烧，看夜景。步行，1 小时 20 分钟便是心斋桥。然后是大阪城。晚上住在难波。")
        XCTAssertEqual(DiaryWriter.generate(seed: 7, day: day, language: .zhHans),
                       "关西机场是今天的起点。坐JR 关空快速，50 分钟到了道顿堀（打过卡了）。吃章鱼烧，看夜景。步行，1 小时 20 分钟便是心斋桥。然后是大阪城。晚上住在难波。")
        XCTAssertEqual(DiaryWriter.generate(seed: 3_000_000_000, day: day, language: .zhHans),
                       "这一天从关西机场开始。JR 关空快速，50 分钟便是道顿堀（到过）。吃章鱼烧，看夜景。步行后到了心斋桥。然后是大阪城。晚上住在难波。")
    }

    func testDiaryOtherLanguagesUseSameDraws() {
        let en = DiaryWriter.generate(seed: 7, day: day, language: .en)
        XCTAssertTrue(en.contains("关西机场"))
        XCTAssertTrue(en.contains("(checked in)"))
        let ja = DiaryWriter.generate(seed: 7, day: day, language: .ja)
        XCTAssertTrue(ja.contains("（チェックイン済み）"))
    }

    func testTimelineMatchesTypeScript() {
        let tl = Timeline.build(day)
        let got = tl.items.map { [$0.entryID, $0.start, $0.end, String($0.minutes)] }
        XCTAssertEqual(got, [
            ["d1-e0", "13:30", "14:45", "75"], ["d1-e1", "14:45", "15:35", "50"], ["d1-e2", "15:35", "16:50", "75"],
            ["d1-e3", "16:50", "18:10", "80"], ["d1-e4", "18:10", "18:30", "20"], ["d1-e5", "18:30", "19:45", "75"],
        ])
        XCTAssertEqual(tl.walkMinutes, 80)
        XCTAssertEqual(tl.transitMinutes, 50)
        XCTAssertEqual(tl.stayMinutes, 245)
        XCTAssertEqual(Timeline.nextStop(day, after: "16:00")?.place.name, "心斋桥")
    }

    func testFootprintsRules() {
        var trip = SampleTrips.iceland(start: "2026-09-01", .zhHans)
        trip.status = .planning
        let fps = Footprints.compute(trips: [trip], manual: [ManualFlag(id: "pin-1", name: "巴黎", lat: 48.85, lng: 2.35, date: nil)], today: "2026-09-03")
        let names = Set(fps.map(\.name))
        XCTAssertFalse(names.contains("凯夫拉维克机场"), "机场不插旗")
        XCTAssertTrue(names.contains("古佛斯瀑布"), "过去的日子算去过")
        XCTAssertFalse(names.contains("斯科加瀑布"), "今天没打卡的不算")
        XCTAssertTrue(names.contains("巴黎"))
        let st = Footprints.stats(fps, home: HomePlace(name: "上海", lat: 31.23, lng: 121.47))
        XCTAssertEqual(st.places, fps.count)
        XCTAssertGreaterThan(st.farthestKm, 8000)
    }
}
