import Foundation

/// 「地球外的天色」：跟随手机 / 白天 / 夜晚（shared/world/daylight.ts 的 Appearance）
enum Appearance: String, Codable, CaseIterable, Sendable { case auto, light, dark }

struct AppSettings: Codable, Hashable, Sendable {
    var appearance: Appearance = .auto
    var palette: Palette = .sea
    var post: PostLevel = .high
    /// 规划服务地址（POST {endpoint}/v1/plan）；空 = 只用手机上的离线规划
    var plannerEndpoint: String = ""
    /// Pro：用云端规划
    var useRemotePlanner: Bool = false
    /// 语音回复（朗读规划助手的话）
    var speakReplies: Bool = true
    /// Pro：iCloud 同步
    var iCloudSync: Bool = false

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = AppSettings()
        appearance = (try? c.decodeIfPresent(Appearance.self, forKey: .appearance)) ?? d.appearance
        palette = (try? c.decodeIfPresent(Palette.self, forKey: .palette)) ?? d.palette
        post = (try? c.decodeIfPresent(PostLevel.self, forKey: .post)) ?? d.post
        plannerEndpoint = (try? c.decodeIfPresent(String.self, forKey: .plannerEndpoint)) ?? d.plannerEndpoint
        useRemotePlanner = (try? c.decodeIfPresent(Bool.self, forKey: .useRemotePlanner)) ?? d.useRemotePlanner
        speakReplies = (try? c.decodeIfPresent(Bool.self, forKey: .speakReplies)) ?? d.speakReplies
        iCloudSync = (try? c.decodeIfPresent(Bool.self, forKey: .iCloudSync)) ?? d.iCloudSync
    }

    /// 可用的规划服务地址（去掉空白与末尾斜杠；不是 http(s) 就当没填）
    var plannerURL: URL? {
        var s = plannerEndpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        while s.hasSuffix("/") { s.removeLast() }
        guard !s.isEmpty, let url = URL(string: s), let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http" else { return nil }
        return url
    }
}

/// 落盘的全部状态（Application Support/EarthOnline/state.json）。以后加字段一律可选或带默认值，旧文件照样读得进来。
struct PersistedState: Codable, Sendable {
    var trips: [Trip] = []
    var avatar = Avatar()
    var settings = AppSettings()
    var home: HomePlace?
    var pins: [ManualFlag] = []
    /// 已经播过插旗动画的足迹
    var planted: [String] = []
    /// 删掉的书（iCloud 同步时把远端那份也删掉）
    var deletedTripIDs: [String] = []
    /// 第一次启动的两本示例（冰岛 + 北欧、关西七日）装过了（D100）；删掉以后不再装回来
    var samplesInstalled = false
    /// 第一次打开问过「家在哪」了（D100）：放了、跳过、去地球上点，都只问这一次
    var homeAsked = false

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // 一本书坏了不连累其他书：逐本解码
        if let raw = try? c.decodeIfPresent([FailableTrip].self, forKey: .trips) {
            trips = raw.compactMap(\.trip)
        }
        avatar = (try? c.decodeIfPresent(Avatar.self, forKey: .avatar)) ?? Avatar()
        settings = (try? c.decodeIfPresent(AppSettings.self, forKey: .settings)) ?? AppSettings()
        home = try? c.decodeIfPresent(HomePlace.self, forKey: .home)
        pins = (try? c.decodeIfPresent([ManualFlag].self, forKey: .pins)) ?? []
        planted = (try? c.decodeIfPresent([String].self, forKey: .planted)) ?? []
        deletedTripIDs = (try? c.decodeIfPresent([String].self, forKey: .deletedTripIDs)) ?? []
        samplesInstalled = (try? c.decodeIfPresent(Bool.self, forKey: .samplesInstalled)) ?? false
        homeAsked = (try? c.decodeIfPresent(Bool.self, forKey: .homeAsked)) ?? false
    }
}

/// 解码失败时返回 nil 的包装
struct FailableTrip: Decodable, Sendable {
    let trip: Trip?
    init(from decoder: Decoder) throws {
        trip = try? Trip(from: decoder)
    }
}
