import XCTest
@testable import EarthOnline

/// 数据契约：能读网页版导出的 JSON（spec 0.3，含可选的 geo / kind / plan），写回时形状不变；旧版本能升级
final class SpecCodingTests: XCTestCase {
    private let webJSON = """
    {
      "schemaVersion": "0.3", "id": "trip-abc", "title": "冰岛 · 北欧", "destination": "冰岛 · 丹麦", "startDate": "2026-09-25",
      "endDate": "2026-09-26", "theme": "极光冰原", "seed": 3000000000, "status": "traveling",
      "plan": { "group": "iceland", "index": 2, "label": "方案 2" },
      "createdAt": "2026-09-01T00:00:00.000Z", "updatedAt": "2026-09-02T00:00:00.000Z",
      "days": [
        { "index": 1, "date": "2026-09-25", "title": "抵达", "city": "geo", "lodging": "雷克雅未克", "color": "#3d5fd9",
          "entries": [
            { "id": "d1-e0", "type": "place", "name": "凯夫拉维克机场", "category": "airport", "plannedStart": "13:30", "geo": { "lat": 63.985, "lng": -22.6056 } },
            { "id": "d1-e1", "type": "transport", "mode": "car", "label": "自驾", "durationMinutes": 45, "distanceKm": 50.5, "polyline": [[63.98, -22.6], [64.14, -21.93]] },
            { "id": "d1-e2", "type": "place", "name": "哈尔格林姆教堂", "category": "sight", "kind": "church", "visited": true, "visitedAt": "2026-09-25T16:00:00Z" },
            { "id": "d1-e3", "type": "lodging", "name": "市中心民宿" }
          ] },
        { "index": 2, "date": "2026-09-26", "title": "黄金圈", "city": "geo", "entries": [
            { "id": "d2-e0", "type": "place", "name": "未来的类别", "category": "spaceport" },
            { "id": "d2-e1", "type": "transport", "mode": "ferry", "label": "去维斯特曼纳群岛" }
          ] }
      ]
    }
    """

    func testDecodeWebExport() throws {
        let trips = try TripImporter.decode(Data(webJSON.utf8))
        XCTAssertEqual(trips.count, 1)
        let t = try XCTUnwrap(trips.first)
        XCTAssertEqual(t.seed, 3_000_000_000)
        XCTAssertEqual(t.status, .traveling)
        XCTAssertEqual(t.plan?.label, "方案 2")
        XCTAssertEqual(t.days[0].entries.count, 4)
        guard case .place(let airport) = t.days[0].entries[0] else { return XCTFail("place") }
        XCTAssertEqual(airport.geo?.lat, 63.985)
        guard case .transport(let car) = t.days[0].entries[1] else { return XCTFail("transport") }
        XCTAssertEqual(car.mode, .car)
        XCTAssertEqual(car.distanceKm, 50.5)
        XCTAssertEqual(car.polyline?.count, 2)
        guard case .place(let church) = t.days[0].entries[2] else { return XCTFail("place") }
        XCTAssertEqual(church.kind, "church")
        XCTAssertEqual(church.visited, true)
        XCTAssertNotNil(t.days[0].entries[3].lodging)
        // 不认识的枚举值按兜底读入：类别 → other，交通方式 → 按原值的关键词猜
        XCTAssertEqual(t.days[1].entries[0].place?.category, .other)
        XCTAssertEqual(t.days[1].entries[1].transport?.mode, .ship)
    }

    func testRoundTripKeepsShape() throws {
        let t = try XCTUnwrap(TripImporter.decode(Data(webJSON.utf8)).first)
        let data = TripImporter.encode(t)
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(obj["schemaVersion"] as? String, "0.3")
        let day = try XCTUnwrap((obj["days"] as? [[String: Any]])?.first)
        let entries = try XCTUnwrap(day["entries"] as? [[String: Any]])
        XCTAssertEqual(entries[0]["type"] as? String, "place")
        XCTAssertEqual(entries[1]["type"] as? String, "transport")
        XCTAssertEqual(entries[3]["type"] as? String, "lodging")
        XCTAssertNil(entries[0]["visited"], "空的可选字段不写出")
        XCTAssertNil(entries[3]["notes"])
        let again = try JSONDecoder().decode(Trip.self, from: data)
        XCTAssertEqual(again, t)
    }

    func testMigrateFrom01() throws {
        let legacy = """
        { "schemaVersion": "0.1", "title": "关西七日", "destination": { "country": "日本", "region": "关西" },
          "startDate": "2026-11-14", "endDate": "2026-11-20", "theme": "红叶古都", "seed": "kansai-7d-demo", "status": "planning",
          "days": [ { "index": 1, "date": "2026-11-14", "title": "大阪 · 抵达", "city": "osaka", "entries": [
            { "type": "place", "order": 0, "name": "关西机场", "category": "sight", "plannedStart": "13:30" },
            { "type": "transport", "order": 1, "mode": "JR 关空快速", "durationText": "50 分钟" },
            { "type": "lodging", "order": 2, "name": "难波 · 酒店 check-in" } ] } ] }
        """
        let t = try XCTUnwrap(TripImporter.decode(Data(legacy.utf8)).first)
        XCTAssertEqual(t.schemaVersion, "0.3")
        XCTAssertEqual(t.destination, "日本 · 关西")
        XCTAssertEqual(t.seed, Int(PRNG.hashString("kansai-7d-demo")))
        XCTAssertEqual(t.days[0].entries[1].transport?.mode, .rail)
        XCTAssertEqual(t.days[0].entries[1].transport?.durationMinutes, 50)
        XCTAssertEqual(t.days[0].entries[0].id, "d1-e0")
    }

    func testDurationParser() {
        XCTAssertEqual(DurationParser.parse("50 分钟"), 50)
        XCTAssertEqual(DurationParser.parse("1 小时 20 分"), 80)
        XCTAssertEqual(DurationParser.parse("1.5 小时"), 90)
        XCTAssertEqual(DurationParser.parse("45min"), 45)
        XCTAssertEqual(DurationParser.parse("1h20"), 80)
        XCTAssertEqual(DurationParser.parse("2-3h"), 150)
        XCTAssertNil(DurationParser.parse("很久"))
    }

    func testPersistedStateSkipsBrokenTrips() throws {
        let json = """
        { "trips": [ { "schemaVersion": "0.3", "id": "broken" }, \(webJSON) ], "settings": { "appearance": "dark" } }
        """
        let s = try JSONDecoder().decode(PersistedState.self, from: Data(json.utf8))
        XCTAssertEqual(s.trips.count, 1)
        XCTAssertEqual(s.settings.appearance, .dark)
        XCTAssertEqual(s.settings.palette, .sea)
        XCTAssertEqual(s.avatar.name, Avatar.default.name)
    }

    func testPlannerURLValidation() {
        var s = AppSettings()
        XCTAssertNil(s.plannerURL)
        s.plannerEndpoint = " https://plan.example.com/ "
        XCTAssertEqual(s.plannerURL?.absoluteString, "https://plan.example.com")
        XCTAssertEqual(RemotePlanner(endpoint: s.plannerURL!).planURL.absoluteString, "https://plan.example.com/v1/plan")
        s.plannerEndpoint = "ftp://nope"
        XCTAssertNil(s.plannerURL)
    }
}
