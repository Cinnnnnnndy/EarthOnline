import XCTest
@testable import EarthOnline

/// 屏幕形态（D90）：跑三端共用的 shared/spec/layout.golden.json。
/// iOS 只有几何兜底（StageLayout.fallback：没有折痕段、没有姿态），所以只跑「只给了宽高」的用例；
/// phone / outer 在 iOS 上都是 compact，hover 不支持（iOS 暂无半开状态的 API）。
final class LayoutGoldenTests: XCTestCase {
    private struct Golden: Decodable { let cases: [Case] }
    private struct Case: Decodable { let name: String; let input: Input; let expect: Expect }
    private struct Input: Decodable { let width: Double; let height: Double; let segments: [Seg]?; let posture: String?; let hasOuter: Bool? }
    private struct Seg: Decodable { let x: Double; let y: Double; let w: Double; let h: Double }
    private struct Expect: Decodable { let state: String; let panes: Int? }

    func testGeometryOnlyCases() throws {
        let url = try XCTUnwrap(Bundle(for: LayoutGoldenTests.self).url(forResource: "layout.golden", withExtension: "json"), "测试包里没有 layout.golden.json（project.yml 的 resources）")
        let golden = try JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
        var ran = 0
        for c in golden.cases where c.input.segments == nil && c.input.posture == nil && c.input.hasOuter == nil {
            let l = StageLayout.fallback(size: CGSize(width: c.input.width, height: c.input.height))
            let want = c.expect.state == "outer" ? "phone" : c.expect.state
            XCTAssertEqual(l.bridgeName, want, c.name)
            if let n = c.expect.panes { XCTAssertEqual(l.panes, n, c.name) }
            ran += 1
        }
        XCTAssertGreaterThanOrEqual(ran, 8, "只给了宽高的用例太少")
    }

    func testTripleCreasesAreThirds() {
        guard case .triple(let creases, let gap) = StageLayout.fallback(size: CGSize(width: 1440, height: 900)) else { return XCTFail("应是三页") }
        XCTAssertEqual(creases, [480, 960]); XCTAssertEqual(gap, Metrics.foldGap)
    }
}
