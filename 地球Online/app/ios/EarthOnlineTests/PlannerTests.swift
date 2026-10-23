import XCTest
@testable import EarthOnline

/// 离线规划：目的地、天数、出发日期、主题、旅程类型的抽取（中 / 英 / 日），以及追问与草稿
final class PlannerTests: XCTestCase {
    private let today = "2026-09-30"   // 周三

    func testChineseAutumnKyoto() {
        let s = LocalRulePlanner.extract("十月去京都玩五天，看红叶", today: today, lang: .zhHans)
        XCTAssertEqual(s.destination, "京都")
        XCTAssertEqual(s.days, 5)
        XCTAssertEqual(s.startDate, "2026-10-01")
        XCTAssertEqual(s.theme, "红叶古都")
        XCTAssertEqual(s.style, .city)
    }

    func testChineseRoadTripByCountryAlias() {
        let s = LocalRulePlanner.extract("我想去冰岛自驾一周，下个月出发", today: today, lang: .zhHans)
        XCTAssertEqual(s.destination, "冰岛")
        XCTAssertEqual(s.place?.name, "雷克雅未克")
        XCTAssertEqual(s.days, 7)
        XCTAssertEqual(s.startDate, "2026-10-01")
        XCTAssertEqual(s.style, .roadTrip)
    }

    func testChineseExactDateIsNotDayCount() {
        let s = LocalRulePlanner.extract("10月13日去巴厘岛，玩4天，想潜水", today: today, lang: .zhHans)
        XCTAssertEqual(s.startDate, "2026-10-13")
        XCTAssertEqual(s.days, 4)
        XCTAssertEqual(s.style, .island)
    }

    func testEnglish() {
        let s = LocalRulePlanner.extract("Five days hiking in Banff next month", today: today, lang: .en)
        XCTAssertEqual(s.destination, "Banff")
        XCTAssertEqual(s.days, 5)
        XCTAssertEqual(s.startDate, "2026-10-01")
        XCTAssertEqual(s.style, .hiking)
        let d = LocalRulePlanner.extract("Paris for 3 nights from Oct 12", today: today, lang: .en)
        XCTAssertEqual(d.destination, "Paris")
        XCTAssertEqual(d.days, 4)
        XCTAssertEqual(d.startDate, "2026-10-12")
    }

    func testJapanese() {
        let s = LocalRulePlanner.extract("10月3日から京都に3日間", today: today, lang: .ja)
        XCTAssertEqual(s.destination, "京都")
        XCTAssertEqual(s.days, 3)
        XCTAssertEqual(s.startDate, "2026-10-03")
        XCTAssertEqual(LocalRulePlanner.extract("2泊3日で大阪", today: today, lang: .ja).days, 3)
    }

    func testRelativeDates() {
        XCTAssertEqual(LocalRulePlanner.startDate(in: "明天出发", today: today), "2026-10-01")
        XCTAssertEqual(LocalRulePlanner.startDate(in: "后天走", today: today), "2026-10-02")
        XCTAssertEqual(LocalRulePlanner.startDate(in: "这周末", today: today), "2026-10-03")
        XCTAssertEqual(LocalRulePlanner.startDate(in: "下周去", today: today), "2026-10-05")
        XCTAssertEqual(LocalRulePlanner.startDate(in: "3月去", today: today), "2027-03-01")
        XCTAssertEqual(LocalRulePlanner.days(in: "周末去杭州"), 2)
        XCTAssertEqual(LocalRulePlanner.days(in: "出差，当天往返"), 1)
    }

    func testChineseNumbers() {
        XCTAssertEqual(LocalRulePlanner.parseNumber("十"), 10)
        XCTAssertEqual(LocalRulePlanner.parseNumber("十五"), 15)
        XCTAssertEqual(LocalRulePlanner.parseNumber("二十一"), 21)
        XCTAssertEqual(LocalRulePlanner.parseNumber("两"), 2)
        XCTAssertEqual(LocalRulePlanner.parseNumber("seven"), 7)
        XCTAssertNil(LocalRulePlanner.parseNumber("很多"))
    }

    func testAsksForMissingSlots() async throws {
        let ctx = PlannerContext(today: today, locale: "zh-Hans", home: nil, trips: nil)
        let r1 = try await LocalRulePlanner().plan(conversation: [PlannerMessage(role: .user, text: "想出去玩五天")], context: ctx)
        XCTAssertNotNil(r1.question)
        XCTAssertNil(r1.draft)
        XCTAssertFalse(r1.done)
        let r2 = try await LocalRulePlanner().plan(conversation: [PlannerMessage(role: .user, text: "去东京")], context: ctx)
        XCTAssertNotNil(r2.question)
        XCTAssertNil(r2.draft)
    }

    func testDraftsTripAcrossTurns() async throws {
        let ctx = PlannerContext(today: today, locale: "zh-Hans", home: nil, trips: nil)
        let convo = [
            PlannerMessage(role: .user, text: "去东京"),
            PlannerMessage(role: .assistant, text: "打算玩几天？"),
            PlannerMessage(role: .user, text: "四天，下周出发"),
        ]
        let r = try await LocalRulePlanner().plan(conversation: convo, context: ctx)
        let d = try XCTUnwrap(r.draft)
        XCTAssertTrue(r.done)
        XCTAssertEqual(d.days.count, 4)
        XCTAssertEqual(d.startDate, "2026-10-05")
        XCTAssertEqual(d.endDate, "2026-10-08")
        XCTAssertEqual(d.destination, "东京")
        XCTAssertEqual(d.schemaVersion, "0.3")
        XCTAssertEqual(d.days[0].city, "geo")
        XCTAssertNotNil(d.days[0].places.first?.geo, "知道坐标时每天放一个住处站点")
        XCTAssertNil(d.plan)
    }

    func testRemoteRequestShape() throws {
        let ctx = PlannerContext(today: today, locale: "en", home: HomePlace(name: "Shanghai", lat: 31.2, lng: 121.5),
                                 trips: [PlannerContext.TripSummary(title: "Kyoto", startDate: "2026-11-01", endDate: "2026-11-03")])
        let body = try JSONEncoder().encode(RemotePlanner.Request(messages: [PlannerMessage(role: .user, text: "hi")], context: ctx))
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let msgs = try XCTUnwrap(obj["messages"] as? [[String: Any]])
        XCTAssertEqual(msgs.first?["role"] as? String, "user")
        XCTAssertEqual(msgs.first?["text"] as? String, "hi")
        XCTAssertNil(msgs.first?["id"])
        let c = try XCTUnwrap(obj["context"] as? [String: Any])
        XCTAssertEqual(c["today"] as? String, today)
        XCTAssertEqual(c["locale"] as? String, "en")
        XCTAssertNotNil(c["home"])
        XCTAssertEqual((c["trips"] as? [[String: Any]])?.count, 1)
    }

    func testRemoteReplyDecoding() throws {
        let json = #"{ "reply": "好的", "question": "几号出发？", "done": false }"#
        let r = try JSONDecoder().decode(PlannerReply.self, from: Data(json.utf8))
        XCTAssertEqual(r.reply, "好的")
        XCTAssertEqual(r.question, "几号出发？")
        XCTAssertNil(r.draft)
        XCTAssertFalse(r.done)
    }
}
