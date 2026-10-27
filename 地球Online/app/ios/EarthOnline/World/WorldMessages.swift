import Foundation

/// 原生 → 世界层的消息（与 shared/spec/bridge.ts 的 NativeToWorld 一致，只传 JSON）。
/// 带「★」的是网页嵌入页（web/src/embed.ts）还没有、需要补上的消息，形状见 ios/README.md。
protocol WorldCommand: Encodable {
    var kind: String { get }
    /// 状态型消息的频道：同一频道只保留最新一条，世界层重载后按固定顺序重放；nil = 一次性动作
    var channel: WorldChannel? { get }
}

enum WorldChannel: String, CaseIterable {
    // 重放顺序即声明顺序
    case palette, sky, post, avatar, trips, home, footprints, insets, layout, mode, view, camera, pick
}

enum WorldMsg {
    // ---- 已有（bridge.ts）
    struct Play: WorldCommand { var kind = "play"; var channel: WorldChannel? { nil }; private enum CodingKeys: String, CodingKey { case kind } }
    struct Pause: WorldCommand { var kind = "pause"; var channel: WorldChannel? { nil }; private enum CodingKeys: String, CodingKey { case kind } }
    struct Restart: WorldCommand { var kind = "restart"; var channel: WorldChannel? { nil }; private enum CodingKeys: String, CodingKey { case kind } }

    struct GotoStop: WorldCommand {
        var kind = "goto-stop"
        var stopIndex: Int
        var channel: WorldChannel? { nil }
        private enum CodingKeys: String, CodingKey { case kind, stopIndex }
    }

    struct SetView: WorldCommand {
        var kind = "set-view"
        var pitch: Int?
        var follow: Bool?
        var channel: WorldChannel? { .view }
        private enum CodingKeys: String, CodingKey { case kind, pitch, follow }
    }

    struct SetAvatar: WorldCommand {
        var kind = "set-avatar"
        var avatar: Avatar
        var channel: WorldChannel? { .avatar }
        private enum CodingKeys: String, CodingKey { case kind, avatar }
    }

    struct SetPost: WorldCommand {
        var kind = "set-post"
        var level: PostLevel
        var channel: WorldChannel? { .post }
        private enum CodingKeys: String, CodingKey { case kind, level }
    }

    struct SetLayout: WorldCommand {
        var kind = "set-layout"
        var layout: String
        var width: Double
        var height: Double
        var channel: WorldChannel? { .layout }
        private enum CodingKeys: String, CodingKey { case kind, layout, width, height }
    }

    // ---- ★ 新增（需要网页嵌入页支持）

    /// ★ 切到地球
    struct ShowGlobe: WorldCommand {
        var kind = "show-globe"
        var channel: WorldChannel? { .mode }
        private enum CodingKeys: String, CodingKey { case kind }
    }

    /// ★ 切到某一天的微缩世界：嵌入页自己用 dayScene(trip, dayIndex) 建路线再 load-plate
    struct ShowDay: WorldCommand {
        var kind = "show-day"
        var trip: Trip
        var dayIndex: Int
        var channel: WorldChannel? { .mode }
        private enum CodingKeys: String, CodingKey { case kind, trip, dayIndex }
    }

    /// ★ 地球上的书：嵌入页用 tripToGlobe 转成 GlobeBook 再 setBooks
    struct SetTrips: WorldCommand {
        var kind = "set-trips"
        var trips: [Trip]
        var today: String
        var channel: WorldChannel? { .trips }
        private enum CodingKeys: String, CodingKey { case kind, trips, today }
    }

    /// ★ 回到家（平常日子）
    struct FocusHome: WorldCommand {
        var kind = "focus-home"
        var lat: Double
        var lng: Double
        var animate: Bool
        var channel: WorldChannel? { .camera }
        private enum CodingKeys: String, CodingKey { case kind, lat, lng, animate }
    }

    /// ★ 聚焦一本书
    struct FocusBook: WorldCommand {
        var kind = "focus-book"
        var id: String
        var animate: Bool
        var channel: WorldChannel? { .camera }
        private enum CodingKeys: String, CodingKey { case kind, id, animate }
    }

    /// ★ 聚焦一本书的某一天
    struct FocusDay: WorldCommand {
        var kind = "focus-day"
        var id: String
        var dayIndex: Int
        var animate: Bool
        var channel: WorldChannel? { .camera }
        private enum CodingKeys: String, CodingKey { case kind, id, dayIndex, animate }
    }

    /// ★ 相机飞到某处（新建旅程时预览目的地）
    /// D108：回正——target 为 nil 时回家（没家回默认取景），给书的 id 飞到那趟旅行
    struct Recenter: WorldCommand {
        var kind = "recenter"
        var target: String?
        var channel: WorldChannel? { nil }   // 一次性：不重放
        private enum CodingKeys: String, CodingKey { case kind, target }
    }

    struct FlyTo: WorldCommand {
        var kind = "fly-to"
        var lat: Double
        var lng: Double
        var alt: Double
        var channel: WorldChannel? { .camera }
        private enum CodingKeys: String, CodingKey { case kind, lat, lng, alt }
    }

    /// ★ 家
    struct SetHome: WorldCommand {
        var kind = "set-home"
        var home: HomePlace?
        var channel: WorldChannel? { .home }
        private enum CodingKeys: String, CodingKey { case kind, home }
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(kind, forKey: .kind)
            try c.encode(home, forKey: .home)   // 没有家时显式写 null
        }
    }

    /// ★ 足迹旗；fresh = 还没播过插旗动画的
    struct SetFootprints: WorldCommand {
        struct Flag: Encodable { var id: String; var name: String; var lat: Double; var lng: Double }
        var kind = "set-footprints"
        var flags: [Flag]
        var fresh: [String]
        var channel: WorldChannel? { .footprints }
        private enum CodingKeys: String, CodingKey { case kind, flags, fresh }
    }

    /// ★ 被原生面板挡住的区域（pt = CSS px），地球 / 浮岛把视觉中心挪到露出来的那块
    struct SetInsets: WorldCommand {
        var kind = "set-insets"
        var left: Double
        var bottom: Double
        var top: Double
        var right: Double
        /// D105：整颗地球填满让出边之后那块的多少（展开的大屏首页用）；nil = 原来的大小
        var fill: Double? = nil
        var channel: WorldChannel? { .insets }
        private enum CodingKeys: String, CodingKey { case kind, left, bottom, top, right, fill }
    }

    /// ★ 地球外的天色
    struct SetSky: WorldCommand {
        var kind = "set-sky"
        var phase: SkyPhase
        var channel: WorldChannel? { .sky }
        private enum CodingKeys: String, CodingKey { case kind, phase }
    }

    /// ★ 浮岛色调（现在是 EarthWorld.setPalette 函数，建议也收进 send）
    struct SetPalette: WorldCommand {
        var kind = "set-palette"
        var palette: Palette
        var channel: WorldChannel? { .palette }
        private enum CodingKeys: String, CodingKey { case kind, palette }
    }

    /// ★ 在地球上点一个位置（放家 / 补旗）；on=false 取消
    struct PickPoint: WorldCommand {
        var kind = "pick-point"
        var on: Bool
        var channel: WorldChannel? { .pick }
        private enum CodingKeys: String, CodingKey { case kind, on }
    }

    /// ★ 打卡（现在是 EarthWorld.markVisited 函数，建议也收进 send）
    struct MarkVisited: WorldCommand {
        var kind = "mark-visited"
        var entryId: String
        var visited: Bool
        var channel: WorldChannel? { nil }
        private enum CodingKeys: String, CodingKey { case kind, entryId, visited }
    }

    /// ★ 用网页的导入器解析行程页 HTML
    struct ImportPage: WorldCommand {
        var kind = "import-page"
        var requestId: String
        var html: String
        var channel: WorldChannel? { nil }
        private enum CodingKeys: String, CodingKey { case kind, requestId, html }
    }
}

/// 世界层 → 原生（WorldToNative；★ 为新增）
enum WorldEvent {
    case ready
    case heroArrived(stopIndex: Int, entryID: String)
    case dayFinished
    case buildingTapped(landmark: String)
    case emptyTapped
    case segmentStarted(index: Int, mode: String, label: String)
    case snapshotDone(dataURL: String)
    case bookTapped(id: String)              // ★
    case dayTapped(id: String, dayIndex: Int) // ★
    case pointPicked(lat: Double, lng: Double) // ★
    case flagsPlanted(ids: [String])          // ★
    case importResult(ImportPageResult)       // ★
    /// 公用的领域核心（D91，shared/core.ts）的回答：value 是原样的 JSON 文本（没有值时 nil）
    case coreResult(requestID: String, valueJSON: String?, error: String?)
    /// 长图（D96，和网页同一份排版）：途中的进度文字、最后的 PNG（dataUrl）
    case longImageProgress(requestID: String, text: String)
    case longImage(requestID: String, dataURL: String?, error: String?)
    case unknown(kind: String)

    static func parse(_ json: String) -> WorldEvent? {
        guard let data = json.data(using: .utf8),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let kind = obj["kind"] as? String else { return nil }
        func int(_ k: String) -> Int { (obj[k] as? NSNumber)?.intValue ?? 0 }
        func dbl(_ k: String) -> Double { (obj[k] as? NSNumber)?.doubleValue ?? 0 }
        func str(_ k: String) -> String { obj[k] as? String ?? "" }
        switch kind {
        case "ready", "bridge-ready": return .ready
        case "hero-arrived": return .heroArrived(stopIndex: int("stopIndex"), entryID: str("entryId"))
        case "day-finished": return .dayFinished
        case "building-tapped": return .buildingTapped(landmark: str("landmark"))
        case "empty-tapped": return .emptyTapped
        case "segment-started": return .segmentStarted(index: int("segmentIndex"), mode: str("mode"), label: str("label"))
        case "snapshot-done": return .snapshotDone(dataURL: str("dataUrl"))
        case "book-tapped": return .bookTapped(id: str("id"))
        case "day-tapped": return .dayTapped(id: str("id"), dayIndex: int("dayIndex"))
        case "point-picked": return .pointPicked(lat: dbl("lat"), lng: dbl("lng"))
        case "flags-planted": return .flagsPlanted(ids: obj["ids"] as? [String] ?? [])
        case "import-result":
            var trips: [Trip] = []
            if let raw = obj["trips"] as? [Any] {
                for t in raw {
                    if let dict = t as? [String: Any], let trip = try? TripImporter.migrate(dict) { trips.append(trip) }
                }
            }
            return .importResult(ImportPageResult(requestID: str("requestId"), trips: trips,
                                                  warnings: obj["warnings"] as? [String] ?? [],
                                                  error: obj["error"] as? String))
        case "core-result":
            var value: String?
            if let v = obj["value"], !(v is NSNull), let d = try? JSONSerialization.data(withJSONObject: v, options: [.fragmentsAllowed]) { value = String(data: d, encoding: .utf8) }
            return .coreResult(requestID: str("requestId"), valueJSON: value, error: obj["error"] as? String)
        case "long-image-progress": return .longImageProgress(requestID: str("requestId"), text: str("text"))
        case "long-image": return .longImage(requestID: str("requestId"), dataURL: obj["dataUrl"] as? String, error: obj["error"] as? String)
        default: return .unknown(kind: kind)
        }
    }
}

struct ImportPageResult {
    var requestID: String
    var trips: [Trip]
    var warnings: [String]
    var error: String?
}
