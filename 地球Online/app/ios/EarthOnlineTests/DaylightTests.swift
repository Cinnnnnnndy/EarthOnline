import XCTest
@testable import EarthOnline

/// 与 shared/world/daylight.test.ts 同一组用例
final class DaylightTests: XCTestCase {
    private let bj = (lat: 39.9, lng: 116.4)

    private func date(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)!
    }

    func testBeijingSummerSolsticeNoonAndMidnight() {
        let noon = Daylight.sunAltitude(date: date("2026-06-21T04:08:00Z"), lat: bj.lat, lng: bj.lng)
        XCTAssertLessThan(abs(noon - 73.5), 1.2)
        // 与 TypeScript 参考实现逐位一致（node 算出 73.44519566039749）
        XCTAssertEqual(noon, 73.44519566039749, accuracy: 1e-9)
        XCTAssertLessThan(Daylight.sunAltitude(date: date("2026-06-21T16:00:00Z"), lat: bj.lat, lng: bj.lng), -20)
    }

    func testReykjavikSolsticeMidnightIsDusk() {
        let a = Daylight.sunAltitude(date: date("2026-06-21T00:30:00Z"), lat: 64.13, lng: -21.9)
        XCTAssertGreaterThan(a, -4)
        XCTAssertLessThan(a, 1)
        XCTAssertEqual(Daylight.phase(ofAltitude: a), .dusk)
    }

    func testAppearanceRules() {
        let noon = date("2026-03-20T04:00:00Z"), night = date("2026-03-20T15:00:00Z")
        let place = (lat: bj.lat, lng: bj.lng)
        XCTAssertEqual(Daylight.resolvePhase(appearance: .light, systemDark: true, now: night, place: place), .day)
        XCTAssertEqual(Daylight.resolvePhase(appearance: .dark, systemDark: false, now: noon, place: place), .night)
        XCTAssertEqual(Daylight.resolvePhase(appearance: .auto, systemDark: true, now: noon, place: place), .night)
        XCTAssertEqual(Daylight.resolvePhase(appearance: .auto, systemDark: false, now: noon, place: place), .day)
        XCTAssertEqual(Daylight.resolvePhase(appearance: .auto, systemDark: false, now: night, place: place), .night)
        // 北京 18:10，日落前后
        XCTAssertEqual(Daylight.resolvePhase(appearance: .auto, systemDark: false, now: date("2026-03-20T10:10:00Z"), place: place), .dusk)
    }

    func testGuessPlaceFromTimeZone() {
        let tz = TimeZone(secondsFromGMT: 8 * 3600)!
        let p = Daylight.guessPlace(date: Date(), timeZone: tz)
        XCTAssertEqual(p.lat, 30)
        XCTAssertEqual(p.lng, 120)
    }

    func testPhaseThresholds() {
        XCTAssertEqual(Daylight.phase(ofAltitude: 6.1), .day)
        XCTAssertEqual(Daylight.phase(ofAltitude: 6), .dusk)
        XCTAssertEqual(Daylight.phase(ofAltitude: -7.9), .dusk)
        XCTAssertEqual(Daylight.phase(ofAltitude: -8), .night)
    }
}
