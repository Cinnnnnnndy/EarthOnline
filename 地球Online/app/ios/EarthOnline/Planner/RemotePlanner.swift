import Foundation

/// 云端规划（Pro）：POST {endpoint}/v1/plan。App 里不放任何密钥——鉴权由服务端按自己的方式做（例如 App Attest / 登录态），
/// 地址在设置里填，空着就只用离线规划。
///
/// 请求：{ "messages": [{"role":"user"|"assistant","text": string}],
///         "context": { "today": "YYYY-MM-DD", "locale": "zh-Hans"|"en"|"ja",
///                      "home"?: {"name","lat","lng"}, "trips"?: [{"title","startDate","endDate"}] } }
/// 回复 200：{ "reply": string, "question"?: string, "draft"?: Trip（spec 0.3）, "done": boolean }
/// 出错：非 200，{ "error": string }
struct RemotePlanner: TripPlanner {
    let endpoint: URL
    var session: URLSession = .shared
    var timeout: TimeInterval = 30

    struct Request: Encodable {
        var messages: [PlannerMessage]
        var context: PlannerContext
    }

    struct ErrorBody: Decodable { var error: String? }

    var planURL: URL { endpoint.appending(path: "v1").appending(path: "plan") }

    func plan(conversation: [PlannerMessage], context: PlannerContext) async throws -> PlannerReply {
        var req = URLRequest(url: planURL)
        req.httpMethod = "POST"
        req.timeoutInterval = timeout
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.httpBody = try JSONEncoder().encode(Request(messages: conversation, context: context))
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw PlannerError.badResponse }
        guard http.statusCode == 200 else {
            let msg = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw PlannerError.server(status: http.statusCode, message: msg)
        }
        guard var reply = try? JSONDecoder().decode(PlannerReply.self, from: data) else { throw PlannerError.badResponse }
        if let d = reply.draft {
            var t = d
            t.schemaVersion = Spec.schemaVersion
            reply.draft = (try? TripImporter.validate(t))
        }
        return reply
    }
}
