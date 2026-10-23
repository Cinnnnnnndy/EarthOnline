import Foundation

/// 规划对话里的一句话
struct PlannerMessage: Codable, Hashable, Identifiable, Sendable {
    enum Role: String, Codable, Sendable { case user, assistant }
    var id = UUID()
    var role: Role
    var text: String

    init(role: Role, text: String) {
        self.role = role
        self.text = text
    }

    private enum CodingKeys: String, CodingKey { case role, text }
}

/// 规划的上下文（与网页版同一协议）
struct PlannerContext: Codable, Sendable {
    struct TripSummary: Codable, Sendable {
        var title: String
        var startDate: String
        var endDate: String
    }
    /// "YYYY-MM-DD"
    var today: String
    /// "zh-Hans" | "en" | "ja"
    var locale: String
    var home: HomePlace?
    var trips: [TripSummary]?
}

/// 规划的回复：一句话，可能带一个追问，可能带一本草稿
struct PlannerReply: Codable, Sendable {
    var reply: String
    var question: String?
    var draft: Trip?
    var done: Bool

    init(reply: String, question: String? = nil, draft: Trip? = nil, done: Bool = false) {
        self.reply = reply
        self.question = question
        self.draft = draft
        self.done = done
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        reply = try c.decodeIfPresent(String.self, forKey: .reply) ?? ""
        question = try c.decodeIfPresent(String.self, forKey: .question)
        draft = try? c.decodeIfPresent(Trip.self, forKey: .draft)
        done = try c.decodeIfPresent(Bool.self, forKey: .done) ?? (draft != nil)
    }
}

/// 规划器：离线规则（LocalRulePlanner）或云端服务（RemotePlanner）。
protocol TripPlanner: Sendable {
    func plan(conversation: [PlannerMessage], context: PlannerContext) async throws -> PlannerReply
}

enum PlannerError: LocalizedError {
    case badResponse
    case server(status: Int, message: String?)
    case offline

    var errorDescription: String? {
        switch self {
        case .badResponse: return String(localized: "规划服务的回复看不懂。")
        case .server(let status, let message):
            let nStatus = status
            return message ?? String(localized: "规划服务出错（\(nStatus)）。")
        case .offline: return String(localized: "连不上规划服务，先用手机上的离线规划。")
        }
    }
}

enum PlannerFactory {
    /// Pro 且填了地址且打开了开关 → 云端（失败时退回离线）；否则离线
    static func make(settings: AppSettings, entitlements: Entitlements) -> TripPlanner {
        if entitlements.allows(.remotePlanner), settings.useRemotePlanner, let url = settings.plannerURL {
            return FallbackPlanner(primary: RemotePlanner(endpoint: url), fallback: LocalRulePlanner())
        }
        return LocalRulePlanner()
    }
}

/// 云端出错时退回离线规划，并在回复前说明一句
struct FallbackPlanner: TripPlanner {
    let primary: TripPlanner
    let fallback: TripPlanner

    func plan(conversation: [PlannerMessage], context: PlannerContext) async throws -> PlannerReply {
        do {
            return try await primary.plan(conversation: conversation, context: context)
        } catch {
            var r = try await fallback.plan(conversation: conversation, context: context)
            r.reply = String(localized: "云端规划暂时连不上，我先用手机上的规则帮你排。") + " " + r.reply
            return r
        }
    }
}
