import XCTest
@testable import EarthOnline

/// 与 shared/world/landmark-kinds.test.ts 同一组用例
final class LandmarkKindsTests: XCTestCase {
    func testKindsFromNameKeywords() {
        let cases: [(String, String)] = [
            ("古佛斯瀑布", "waterfall"), ("Stjórnarfoss", "waterfall"), ("索尔黑马冰川", "glacier"), ("鱼市 Fisketorget", "market"),
            ("Fløibanen 缆车", "cablecar"), ("Aker Brygge 海滨", "beach"), ("Haukland + Mannen徒步", "trail"), ("清水寺三重塔", "temple"),
            ("东京塔", "tower"), ("大英博物馆", "museum"), ("天空树展望台", "viewpoint"), ("蓝湖温泉", "hotspring"), ("苏丹艾哈迈德清真寺", "mosque"),
            ("嵐山竹林", "forest"), ("某个没见过的地方", "sight"),
        ]
        for (name, kind) in cases {
            XCTAssertEqual(LandmarkKinds.classify(name: name, category: .sight), kind, name)
        }
    }

    func testCategoryTagsAndExplicitKind() {
        XCTAssertEqual(LandmarkKinds.classify(name: "哈尔格林姆教堂大本营", category: .hotel), "hotel")
        XCTAssertEqual(LandmarkKinds.classify(name: "京都站前酒店", category: .hotel), "hotel")
        XCTAssertEqual(LandmarkKinds.classify(name: "Svolvær 机场 SVJ", category: .airport), "airport")
        XCTAssertEqual(LandmarkKinds.classify(name: "Old Mill", category: .sight, tags: ["tourism": "museum"]), "museum")
        XCTAssertEqual(LandmarkKinds.classify(name: "古佛斯瀑布", category: .sight, kind: "lake"), "lake")
        XCTAssertEqual(LandmarkKinds.classify(name: "拉面一兰", category: .food), "food")
    }

    func testJSWordBoundaryAroundCJK() {
        // JS 的 \b 把汉字当非单词字符：「Central Park公园」里 park 后面是边界
        XCTAssertEqual(LandmarkKinds.classify(name: "Central Park", category: .sight), "forest")
        XCTAssertEqual(LandmarkKinds.classify(name: "Fisketorget", category: .sight), "market")
    }

    func testEveryKindHasSymbolAndName() {
        for k in LandmarkKinds.kinds {
            XCTAssertFalse(LandmarkKinds.symbol(forKind: k.id).isEmpty, k.id)
            XCTAssertFalse(LandmarkKinds.localizedName(k.id).isEmpty, k.id)
        }
        XCTAssertEqual(LandmarkKinds.symbol(forKind: "unknown-kind"), "mappin")
    }

    func testTransportClassifier() {
        XCTAssertEqual(TransportClassifier.classify("JR 关空快速"), .rail)
        XCTAssertEqual(TransportClassifier.classify("地铁 2 号线"), .subway)
        XCTAssertEqual(TransportClassifier.classify("巴士 205 路"), .bus)
        XCTAssertEqual(TransportClassifier.classify("渡轮"), .ship)
        XCTAssertEqual(TransportClassifier.classify("租车自驾"), .car)
        XCTAssertEqual(TransportClassifier.classify("航班 FI 454"), .flight)
        XCTAssertEqual(TransportClassifier.classify("散步"), .walk)
    }
}
