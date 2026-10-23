import XCTest
@testable import EarthOnline

/// 书的状态（旅行中 / 将出发 / 刚回来 / 平常日子）与首页判断
final class JourneyStateTests: XCTestCase {
    private let today = "2026-10-10"

    private func trip(_ id: String, start: String, days: Int, status: TripStatus = .planning) -> Trip {
        let list = (0..<days).map { i in
            Day(index: i + 1, date: DayMath.add(start, days: i), title: "D\(i + 1)", city: "geo", entries: [])
        }
        return Trip(schemaVersion: Spec.schemaVersion, id: id, title: id, destination: "X", startDate: start,
                    endDate: DayMath.add(start, days: days - 1), theme: Spec.themes[0], seed: 1, status: status,
                    plan: nil, days: list, createdAt: "", updatedAt: "")
    }

    func testDayMath() {
        XCTAssertEqual(DayMath.add("2026-12-30", days: 3), "2027-01-02")
        XCTAssertEqual(DayMath.diff("2026-10-10", "2026-10-13"), 3)
        XCTAssertEqual(DayMath.diff("2026-10-13", "2026-10-10"), -3)
        XCTAssertEqual(DayMath.diff("2026-03-28", "2026-03-30"), 2)   // 跨夏令时也不差一天
        XCTAssertNil(DayMath.make(year: 2026, month: 2, day: 30))
    }

    func testTripPhase() {
        XCTAssertEqual(trip("a", start: "2026-10-08", days: 5).phase(today: today), .traveling(dayIndex: 2))
        XCTAssertEqual(trip("b", start: "2026-10-12", days: 3).phase(today: today), .upcoming(inDays: 2))
        XCTAssertEqual(trip("c", start: "2026-10-01", days: 4).phase(today: today), .ended(daysAgo: 6))
        XCTAssertEqual(trip("d", start: "2026-10-01", days: 4, status: .closed).phase(today: today), .closed(daysAgo: 6))
        XCTAssertEqual(trip("e", start: "2026-10-10", days: 1).phase(today: today), .traveling(dayIndex: 0))
    }

    func testTravelingWins() {
        let s = JourneyState.compute(trips: [trip("soon", start: "2026-10-11", days: 2), trip("now", start: "2026-10-09", days: 3)], today: today)
        XCTAssertEqual(s, .traveling(tripID: "now", dayIndex: 1))
        XCTAssertEqual(s.focusedTripID, "now")
    }

    func testDepartingWithinThreeDays() {
        XCTAssertEqual(JourneyState.compute(trips: [trip("a", start: "2026-10-12", days: 3)], today: today), .departing(tripID: "a", inDays: 2))
        XCTAssertEqual(JourneyState.compute(trips: [trip("a", start: "2026-10-13", days: 3)], today: today), .departing(tripID: "a", inDays: 3))
        XCTAssertEqual(JourneyState.compute(trips: [trip("a", start: "2026-10-14", days: 3)], today: today),
                       .idle(next: UpcomingTrip(tripID: "a", inDays: 4)))
    }

    func testDepartLabels() {
        XCTAssertEqual(JourneyState.departLabel(0), String(localized: "今天出发"))
        XCTAssertEqual(JourneyState.departLabel(1), String(localized: "明天出发"))
        XCTAssertEqual(JourneyState.departLabel(2), String(localized: "后天出发"))
    }

    func testJustBackWithinSevenDays() {
        XCTAssertEqual(JourneyState.compute(trips: [trip("back", start: "2026-10-01", days: 5)], today: today), .justBack(tripID: "back", daysAgo: 5))
        XCTAssertEqual(JourneyState.compute(trips: [trip("old", start: "2026-09-01", days: 5)], today: today), .idle(next: nil))
        // 提前合上的书也算刚回来
        XCTAssertEqual(JourneyState.compute(trips: [trip("closed", start: "2026-10-09", days: 5, status: .closed)], today: today),
                       .justBack(tripID: "closed", daysAgo: 0))
    }

    func testDepartingBeatsJustBack() {
        let s = JourneyState.compute(trips: [trip("back", start: "2026-10-01", days: 5), trip("soon", start: "2026-10-11", days: 2)], today: today)
        XCTAssertEqual(s, .departing(tripID: "soon", inDays: 1))
    }

    func testIdleNoTripsFocusesHome() {
        let s = JourneyState.compute(trips: [], today: today)
        XCTAssertEqual(s, .idle(next: nil))
        XCTAssertNil(s.focusedTripID)
    }

    func testIdleShowsNearestUpcoming() {
        let s = JourneyState.compute(trips: [trip("far", start: "2026-12-01", days: 2), trip("near", start: "2026-11-01", days: 2)], today: today)
        XCTAssertEqual(s, .idle(next: UpcomingTrip(tripID: "near", inDays: 22)))
    }

    func testSampleScenarios() {
        let t = DayMath.today()
        if case .traveling(let id, let d) = JourneyState.compute(trips: SampleTrips.make(.traveling, today: t), today: t) {
            XCTAssertEqual(id, "sample-iceland")
            XCTAssertEqual(d, 2)
        } else { XCTFail("traveling sample") }
        XCTAssertEqual(JourneyState.compute(trips: SampleTrips.make(.planning, today: t), today: t), .departing(tripID: "sample-bali", inDays: 2))
        XCTAssertEqual(JourneyState.compute(trips: SampleTrips.make(.empty, today: t), today: t), .idle(next: nil))
    }
}
