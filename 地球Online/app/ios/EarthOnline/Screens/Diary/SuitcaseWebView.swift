import SwiftUI
import WebKit

/// 行李箱（第八轮末，D75 / D78）：3D 的箱子在世界层（网页 three.js，shared/world/suitcase-scene.ts）里，与网页版同一只。
/// iOS 这边用一个独立的 WKWebView 装嵌入页（和世界层同一份 World/ 目录、同一个 scheme），
/// 发 `show-suitcase`（带这本书与小人的穿搭）显示，发 `export-suitcase` 让它渲染一张 1080 × 1350 的 PNG 回来（`suitcase-image`，dataUrl）。
/// 清单（D84）：发 `case-search`（一句话或一个词），嵌入页检索、分组、渲染类 emoji 的图标后回 `case-results`；
/// 点一格发 `case-toggle`，嵌入页按规则算出新的增减回 `case-edits`（原生存进书里再重新 show）。检索与规则都在网页那份（shared/algo/case-search.ts），原生只画。
@MainActor
final class SuitcaseBridge: NSObject, ObservableObject {
    weak var webView: WKWebView?
    /// 箱子里现在有什么（嵌入页装好后发来；id 是藏东西用的 id；图标渲染好后会再发一次带图的）
    @Published var items: [SuitcaseItem] = []
    /// 清单的检索结果（最近一次 case-search）
    @Published var groups: [CaseGroup] = []
    @Published var lastQuery = ""
    /// 点一格之后嵌入页算出的新增减：原生存进书里（DiaryView 接）
    var onEdits: ((CaseEdits?, String) -> Void)?
    private var ready = false
    private var pendingShow: String?
    private var exportContinuation: CheckedContinuation<Data?, Never>?
    private var pendingCards: [String: CheckedContinuation<SubjectLifter.Result?, Never>] = [:]

    struct SuitcaseItem: Identifiable, Hashable { let id: String; let type: String; let key: String; let label: String; let icon: UIImage? }
    struct CaseEntry: Identifiable, Hashable { var id: String { type + ":" + key }; let type: String; let key: String; let label: String; let sub: String; let inBox: Bool; let icon: UIImage? }
    struct CaseGroup: Identifiable, Hashable { let id: String; let label: String; let entries: [CaseEntry] }

    /// 显示这本书的箱子；照片卡的图（Application Support/EarthOnline/cards/<id>.png）一起传过去
    func show(trip: Trip, avatar: Avatar) {
        let tripJSON = String(decoding: TripImporter.encode(trip), as: UTF8.self)
        let avatarJSON = (try? JSONEncoder().encode(avatar)).map { String(decoding: $0, as: UTF8.self) } ?? "null"
        let cards = (trip.suitcase?.cards ?? []).compactMap { c -> [String: String]? in
            guard let url = CaseCardStore.dataURL(id: c.id) else { return nil }
            return ["id": c.id, "dataUrl": url]
        }
        let cardsJSON = (try? JSONSerialization.data(withJSONObject: cards)).map { String(decoding: $0, as: UTF8.self) } ?? "[]"
        let json = "{\"kind\":\"show-suitcase\",\"trip\":\(tripJSON),\"avatar\":\(avatarJSON),\"cards\":\(cardsJSON)}"
        pendingShow = json
        if ready { evaluate(json) }
    }

    /// 清单：打一句话或一个词（空的给默认分组）
    func search(_ query: String) {
        lastQuery = query
        guard ready, let q = try? JSONSerialization.data(withJSONObject: ["kind": "case-search", "query": query]) else { return }
        evaluate(String(decoding: q, as: UTF8.self))
    }

    /// 清单：点一格（放进去 / 拿出来），结果从 onEdits 回来
    func toggle(_ entry: CaseEntry) {
        guard ready, let q = try? JSONSerialization.data(withJSONObject: ["kind": "case-toggle", "type": entry.type, "id": entry.key]) else { return }
        evaluate(String(decoding: q, as: UTF8.self))
    }

    /// 照片小卡（D99）：Vision 没抠出主体时，再请嵌入页用网页那套本机抠图试一次（纯色、渐变的背景它能漫过去）；
    /// 它也抠不出来会回一张拍立得。页面没就绪或 20 秒没回返回 nil
    func makeCard(jpeg: Data) async -> SubjectLifter.Result? {
        guard ready else { return nil }
        let id = "card-" + UUID().uuidString
        guard let q = try? JSONSerialization.data(withJSONObject: ["kind": "make-card", "requestId": id, "dataUrl": "data:image/jpeg;base64," + jpeg.base64EncodedString()]) else { return nil }
        return await withCheckedContinuation { (cont: CheckedContinuation<SubjectLifter.Result?, Never>) in
            pendingCards[id] = cont
            evaluate(String(decoding: q, as: UTF8.self))
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(20))
                if let c = self?.pendingCards.removeValue(forKey: id) { c.resume(returning: nil) }
            }
        }
    }

    /// 让嵌入页渲染一张 PNG；页面没就绪或 8 秒没回就返回 nil
    func export() async -> Data? {
        guard ready, exportContinuation == nil else { return nil }
        return await withCheckedContinuation { (cont: CheckedContinuation<Data?, Never>) in
            exportContinuation = cont
            evaluate("{\"kind\":\"export-suitcase\"}")
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(8))
                if let c = self?.exportContinuation { self?.exportContinuation = nil; c.resume(returning: nil) }
            }
        }
    }

    private func evaluate(_ json: String) {
        guard let literal = WorldController.jsStringLiteral(json) else { return }
        let js = "(function(){ try { if (window.EarthWorld && window.EarthWorld.send) { window.EarthWorld.send(\(literal)); } } catch (e) { console.error(e); } })();"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    fileprivate func receive(_ json: String) {
        guard let data = json.data(using: .utf8), let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let kind = obj["kind"] as? String else { return }
        switch kind {
        case "bridge-ready":
            ready = true
            if let j = pendingShow { evaluate(j) }
        case "suitcase-image":
            let url = obj["dataUrl"] as? String ?? ""
            let base64 = url.components(separatedBy: ",").last ?? ""
            exportContinuation?.resume(returning: Data(base64Encoded: base64))
            exportContinuation = nil
        case "suitcase-contents":
            let raw = obj["items"] as? [[String: Any]] ?? []
            items = raw.compactMap { d in
                guard let id = d["id"] as? String, let label = d["label"] as? String else { return nil }
                return SuitcaseItem(id: id, type: d["type"] as? String ?? "", key: d["key"] as? String ?? "", label: label, icon: Self.image(d["icon"] as? String))
            }
        case "case-results":
            guard (obj["query"] as? String ?? "") == lastQuery else { return }   // 打得快，旧的结果不要
            let raw = obj["groups"] as? [[String: Any]] ?? []
            groups = raw.compactMap { g in
                guard let id = g["id"] as? String, let label = g["label"] as? String else { return nil }
                let entries = (g["entries"] as? [[String: Any]] ?? []).compactMap { e -> CaseEntry? in
                    guard let type = e["type"] as? String, let key = e["id"] as? String, let label = e["label"] as? String else { return nil }
                    return CaseEntry(type: type, key: key, label: label, sub: e["sub"] as? String ?? "", inBox: e["inBox"] as? Bool ?? false, icon: Self.image(e["icon"] as? String))
                }
                return CaseGroup(id: id, label: label, entries: entries)
            }
        case "card-made":
            guard let id = obj["requestId"] as? String, let cont = pendingCards.removeValue(forKey: id) else { return }
            guard obj["error"] == nil, let card = obj["card"] as? [String: Any], let url = obj["dataUrl"] as? String,
                  let comma = url.firstIndex(of: ","), let data = Data(base64Encoded: String(url[url.index(after: comma)...])) else { cont.resume(returning: nil); return }
            cont.resume(returning: SubjectLifter.Result(data: data, kind: card["kind"] as? String ?? "polaroid", w: card["w"] as? Int ?? 0, h: card["h"] as? Int ?? 0))
        case "case-edits":
            let result = obj["result"] as? String ?? ""
            var edits: CaseEdits?
            if let raw = obj["suitcase"] as? [String: Any], let data = try? JSONSerialization.data(withJSONObject: raw) { edits = try? JSONDecoder().decode(CaseEdits.self, from: data) }
            onEdits?(edits, result)
        default:
            break
        }
    }
}

extension SuitcaseBridge {
    /// dataUrl（data:image/png;base64,…）→ UIImage
    static func image(_ dataUrl: String?) -> UIImage? {
        guard let url = dataUrl, let comma = url.firstIndex(of: ","), let data = Data(base64Encoded: String(url[url.index(after: comma)...])) else { return nil }
        return UIImage(data: data, scale: 2)
    }
}

/// WKScriptMessageHandler 的中转（WKUserContentController 会强引用它；它只弱引用桥）
final class SuitcaseMessageProxy: NSObject, WKScriptMessageHandler {
    weak var bridge: SuitcaseBridge?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        var text: String?
        if let s = message.body as? String {
            text = s
        } else if let obj = message.body as? [String: Any], let d = try? JSONSerialization.data(withJSONObject: obj) {
            text = String(data: d, encoding: .utf8)
        }
        guard let json = text else { return }
        let target = bridge
        Task { @MainActor in target?.receive(json) }
    }
}

struct SuitcaseWebView: UIViewRepresentable {
    let trip: Trip
    let avatar: Avatar
    @ObservedObject var bridge: SuitcaseBridge

    func makeCoordinator() -> SuitcaseMessageProxy {
        let p = SuitcaseMessageProxy()
        p.bridge = bridge
        return p
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let content = WKUserContentController()
        content.add(context.coordinator, name: "world")
        content.addUserScript(WKUserScript(source: WorldController.readyProbe, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = content
        if WorldController.loadMode == .scheme, let root = WorldController.bundleRoot {
            config.setURLSchemeHandler(WorldSchemeHandler(root: root), forURLScheme: WorldController.scheme)
        }
        let w = WKWebView(frame: .zero, configuration: config)
        w.isOpaque = false
        w.backgroundColor = .clear
        w.scrollView.backgroundColor = .clear
        w.scrollView.isScrollEnabled = false
        w.scrollView.bounces = false
        w.scrollView.contentInsetAdjustmentBehavior = .never
        w.allowsLinkPreview = false
        bridge.webView = w
        if let root = WorldController.bundleRoot {
            switch WorldController.loadMode {
            case .scheme:
                // ?mode=suitcase：嵌入页只建箱子，不建地球与某一天的世界
                if let url = URL(string: "\(WorldController.scheme)://app/embed.html?mode=suitcase") { w.load(URLRequest(url: url)) }
            case .fileURL:
                w.loadFileURL(root.appendingPathComponent("embed.html"), allowingReadAccessTo: root)
            }
        } else {
            w.loadHTMLString(WorldController.fallbackHTML, baseURL: nil)
        }
        bridge.show(trip: trip, avatar: avatar)
        return w
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
