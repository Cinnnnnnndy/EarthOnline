import Foundation

/// 免费下载；免费版：最多 3 本书、只存本机、手机上的语音与离线规划。
/// 地球Online Pro（订阅）：不限本数、云端 AI 规划、iCloud 同步、高清长图导出、扩展包（名胜、装扮）。
/// 名胜扩展包也可以单独买。
enum ProFeature: String, Identifiable, CaseIterable, Sendable {
    case unlimitedTrips, remotePlanner, iCloudSync, hdExport, landmarkPack, outfitPack

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .unlimitedTrips: return "books.vertical"
        case .remotePlanner: return "sparkles"
        case .iCloudSync: return "icloud"
        case .hdExport: return "photo"
        case .landmarkPack: return "building.columns"
        case .outfitPack: return "tshirt"
        }
    }

    var title: String {
        switch self {
        case .unlimitedTrips: return String(localized: "不限数量的旅程")
        case .remotePlanner: return String(localized: "云端 AI 规划")
        case .iCloudSync: return String(localized: "iCloud 同步")
        case .hdExport: return String(localized: "高清长图导出")
        case .landmarkPack: return String(localized: "名胜扩展包")
        case .outfitPack: return String(localized: "小人装扮包")
        }
    }

    /// 触发付费墙时的一句说明
    var reason: String {
        switch self {
        case .unlimitedTrips:
            let nLimit = Entitlements.freeTripLimit
            return String(localized: "免费版最多 \(nLimit) 本旅程。")
        case .remotePlanner: return String(localized: "云端规划会结合更多地点与路线。")
        case .iCloudSync: return String(localized: "在你的每台设备上看到同样的旅程。")
        case .hdExport: return String(localized: "导出两倍清晰度的长图。")
        case .landmarkPack: return String(localized: "更多名胜有了专门的模型。")
        case .outfitPack: return String(localized: "给小人换上更多衣服和帽子。")
        }
    }
}

struct Entitlements: Equatable, Sendable {
    var isPro: Bool
    /// 单独买的扩展包（产品 ID）
    var packs: Set<String>

    static let free = Entitlements(isPro: false, packs: [])
    static let freeTripLimit = 3

    func canAddTrip(currentCount: Int) -> Bool { isPro || currentCount < Entitlements.freeTripLimit }

    func allows(_ f: ProFeature) -> Bool {
        switch f {
        case .unlimitedTrips, .remotePlanner, .iCloudSync, .hdExport, .outfitPack: return isPro
        case .landmarkPack: return isPro || packs.contains(ProductIDs.landmarkPack)
        }
    }
}
