import Foundation
import WebKit
import SwiftUI

/// 世界层（地球 + 某一天的微缩世界）常驻一个 WKWebView，切页面只是换模式，不销毁（技术选型 8.3）。
/// 原生 → 世界：`EarthWorld.send(json)`；世界 → 原生：`webkit.messageHandlers.world.postMessage(json)`。
/// 状态型消息（书、天色、家、足迹、留白、模式、相机……）按频道只留最新一条，页面重载 / 进程被系统回收后自动重放。
@MainActor
final class WorldController: ObservableObject {
    static let scheme = "earthworld"
    static let entryURL = URL(string: "earthworld://app/embed.html")

    /// 加载方式：自定义 scheme（默认，module 脚本与 fetch 都是同源）或 file://（loadFileURL(_:allowingReadAccessTo:)）
    enum LoadMode { case scheme, fileURL }
    static var loadMode: LoadMode = .scheme

    @Published private(set) var isReady = false
    /// 世界层当前模式（原生这边的记录）
    @Published private(set) var mode: String = "globe"

    var onEvent: ((WorldEvent) -> Void)?

    private var webViewStorage: WKWebView?
    private var queue: [String] = []
    private var sticky: [WorldChannel: String] = [:]
    private let messageProxy = WorldMessageProxy()
    private let navigationProxy = WorldNavigationProxy()
    private var schemeHandler: WorldSchemeHandler?
    private var pendingImports: [String: CheckedContinuation<ImportPageResult?, Never>] = [:]
    private var pendingCore: [String: CheckedContinuation<Data?, Never>] = [:]
    private var pendingLong: [String: CheckedContinuation<Data?, Never>] = [:]
    /// 长图的进度（嵌入页按天回的那句「正在渲染第 2 / 5 天」）
    @Published private(set) var longImageProgress: String?

    /// 世界层网页在 App 包里的目录（构建脚本从 web/dist 拷来）
    static var bundleRoot: URL? { Bundle.main.url(forResource: "World", withExtension: nil) }

    var webView: WKWebView {
        if let w = webViewStorage { return w }
        let w = makeWebView()
        webViewStorage = w
        return w
    }

    // MARK: - 发送

    func send<M: WorldCommand>(_ msg: M) {
        guard let data = try? JSONEncoder().encode(msg), let json = String(data: data, encoding: .utf8) else { return }
        if let ch = msg.channel {
            sticky[ch] = json
            if ch == .mode { mode = msg.kind == "show-day" ? "day" : "globe" }
        }
        guard isReady else {
            if msg.channel == nil { queue.append(json) }
            return
        }
        evaluate(json)
    }

    private func evaluate(_ json: String) {
        guard let literal = WorldController.jsStringLiteral(json) else { return }
        let js = "(function(){ try { if (window.EarthWorld && window.EarthWorld.send) { window.EarthWorld.send(\(literal)); } } catch (e) { console.error(e); } })();"
        webViewStorage?.evaluateJavaScript(js, completionHandler: nil)
    }

    /// 把 JSON 文本变成 JS 字符串字面量（JSONEncoder 编一个顶层字符串：转义完全、不会被截断）
    static func jsStringLiteral(_ s: String) -> String? {
        guard let d = try? JSONEncoder().encode(s) else { return nil }
        return String(data: d, encoding: .utf8)
    }

    // MARK: - 接收

    func receive(_ json: String) {
        guard let event = WorldEvent.parse(json) else { return }
        switch event {
        case .ready:
            isReady = true
            replay()
        case .importResult(let r):
            if let c = pendingImports.removeValue(forKey: r.requestID) { c.resume(returning: r) }
        case .coreResult(let id, let value, _):
            if let c = pendingCore.removeValue(forKey: id) { c.resume(returning: value?.data(using: .utf8)) }
        case .longImageProgress(let id, let text):
            if pendingLong[id] != nil { longImageProgress = text }
        case .longImage(let id, let dataURL, _):
            longImageProgress = nil
            if let c = pendingLong.removeValue(forKey: id) { c.resume(returning: dataURL.flatMap(WorldController.decodeDataURL)) }
        default:
            break
        }
        onEvent?(event)
    }

    private func replay() {
        for ch in WorldChannel.allCases {
            if let json = sticky[ch] { evaluate(json) }
        }
        let q = queue
        queue.removeAll()
        for json in q { evaluate(json) }
    }

    /// 用网页的导入器解析行程页 HTML；嵌入页不支持时 10 秒后返回 nil
    func importPage(html: String) async -> ImportPageResult? {
        let id = UUID().uuidString
        return await withCheckedContinuation { (cont: CheckedContinuation<ImportPageResult?, Never>) in
            pendingImports[id] = cont
            send(WorldMsg.ImportPage(requestId: id, html: html))
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(10))
                if let c = self?.pendingImports.removeValue(forKey: id) { c.resume(returning: nil) }
            }
        }
    }

    /// 调公用的领域核心（D91，shared/core.ts）：fn 是函数名，argsJSON 是参数数组的 JSON 文本（如 `[trips, "2026-10-09"]`），
    /// 返回结果的 JSON（出错、超时 10 秒或世界层还没就绪都返回 nil）。一次性消息：没就绪时排队，就绪后发。
    /// 现有的 Swift 移植（Domain/）照旧用；以后新加的领域逻辑走这里，不再移植。
    func core(_ fn: String, argsJSON: String, locale: String? = nil) async -> Data? {
        let id = UUID().uuidString
        guard let fnLit = WorldController.jsStringLiteral(fn), let idLit = WorldController.jsStringLiteral(id) else { return nil }
        var json = "{\"kind\":\"core-call\",\"requestId\":\(idLit),\"fn\":\(fnLit),\"args\":\(argsJSON)"
        if let locale, let l = WorldController.jsStringLiteral(locale) { json += ",\"locale\":\(l)" }
        json += "}"
        return await withCheckedContinuation { (cont: CheckedContinuation<Data?, Never>) in
            pendingCore[id] = cont
            if isReady { evaluate(json) } else { queue.append(json) }
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(10))
                if let c = self?.pendingCore.removeValue(forKey: id) { c.resume(returning: nil) }
            }
        }
    }

    /// 长图（D96）：嵌入页借世界层逐天渲染、按网页的排版拼好，回 PNG；世界层不在、出错或 5 分钟没回返回 nil（调用方退回原生的文字版）
    func exportLongImage(trip: Trip) async -> Data? {
        let id = UUID().uuidString
        guard let tripData = try? JSONEncoder().encode(trip), let tripJSON = String(data: tripData, encoding: .utf8),
              let idLit = WorldController.jsStringLiteral(id) else { return nil }
        let json = "{\"kind\":\"export-long-image\",\"requestId\":\(idLit),\"trip\":\(tripJSON)}"
        return await withCheckedContinuation { (cont: CheckedContinuation<Data?, Never>) in
            pendingLong[id] = cont
            if isReady { evaluate(json) } else { queue.append(json) }
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(300))
                if let c = self?.pendingLong.removeValue(forKey: id) { self?.longImageProgress = nil; c.resume(returning: nil) }
            }
        }
    }

    /// data:image/png;base64,… → Data
    static func decodeDataURL(_ s: String) -> Data? {
        guard let comma = s.firstIndex(of: ",") else { return nil }
        return Data(base64Encoded: String(s[s.index(after: comma)...]))
    }

    // MARK: - 生命周期

    func reloadAfterCrash() {
        isReady = false
        // 正在做的长图新页面不会回了：直接告诉等它的地方（日记页退回原生的文字版）
        let longs = pendingLong; pendingLong.removeAll(); longImageProgress = nil
        longs.values.forEach { $0.resume(returning: nil) }
        guard let w = webViewStorage else { return }
        load(into: w)
    }

    private func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        let content = WKUserContentController()
        messageProxy.controller = self
        content.add(messageProxy, name: "world")
        content.addUserScript(WKUserScript(source: WorldController.readyProbe, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = content
        if WorldController.loadMode == .scheme, let root = WorldController.bundleRoot {
            let handler = WorldSchemeHandler(root: root)
            config.setURLSchemeHandler(handler, forURLScheme: WorldController.scheme)
            schemeHandler = handler
        }
        config.allowsInlineMediaPlayback = true
        config.suppressesIncrementalRendering = false

        let w = WKWebView(frame: .zero, configuration: config)
        w.isOpaque = false
        w.backgroundColor = .clear
        w.scrollView.backgroundColor = .clear
        w.scrollView.isScrollEnabled = false
        w.scrollView.bounces = false
        w.scrollView.contentInsetAdjustmentBehavior = .never
        w.allowsLinkPreview = false
        w.allowsBackForwardNavigationGestures = false
        #if DEBUG
        w.isInspectable = true
        #endif
        navigationProxy.controller = self
        w.navigationDelegate = navigationProxy
        load(into: w)
        return w
    }

    private func load(into w: WKWebView) {
        guard let root = WorldController.bundleRoot else {
            w.loadHTMLString(WorldController.fallbackHTML, baseURL: nil)
            return
        }
        switch WorldController.loadMode {
        case .scheme:
            if let url = WorldController.entryURL { w.load(URLRequest(url: url)) }
        case .fileURL:
            w.loadFileURL(root.appendingPathComponent("embed.html"), allowingReadAccessTo: root)
        }
    }

    /// 嵌入页的 World 在构造时就发了 ready（那时还没有监听者），所以原生自己探测 window.EarthWorld 出现
    static let readyProbe = """
    (function(){
      var n = 0;
      var t = setInterval(function(){
        n++;
        if (window.EarthWorld && window.EarthWorld.send) {
          clearInterval(t);
          try { window.webkit.messageHandlers.world.postMessage(JSON.stringify({ kind: "bridge-ready" })); } catch (e) {}
        } else if (n > 600) { clearInterval(t); }
      }, 50);
    })();
    """

    /// App 包里连占位世界都没有时（理论上不会发生）
    static let fallbackHTML = """
    <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <style>html,body{margin:0;height:100%;background:transparent}</style></head>
    <body><script>window.EarthWorld={send:function(){}};</script></body></html>
    """
}

/// WKScriptMessageHandler 的中转（WKUserContentController 会强引用它；它只弱引用控制器）
final class WorldMessageProxy: NSObject, WKScriptMessageHandler {
    weak var controller: WorldController?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        var text: String?
        if let s = message.body as? String {
            text = s
        } else if let obj = message.body as? [String: Any], let d = try? JSONSerialization.data(withJSONObject: obj) {
            text = String(data: d, encoding: .utf8)
        }
        guard let json = text else { return }
        let target = controller
        Task { @MainActor in target?.receive(json) }
    }
}

/// 网页进程被系统回收时重载并重放状态
final class WorldNavigationProxy: NSObject, WKNavigationDelegate {
    weak var controller: WorldController?

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        let target = controller
        Task { @MainActor in target?.reloadAfterCrash() }
    }
}
