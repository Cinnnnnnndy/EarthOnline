import Foundation
import WebKit

/// 从 App 包里的 World/ 目录供应世界层网页：earthworld://app/embed.html → Bundle/World/embed.html。
/// 用自定义 scheme 而不是 file://，是因为 Vite 打出来的是 ES module 脚本、还会 fetch 贴图与数据，
/// WebKit 对 file:// 上的 module / fetch 限制很多；自定义 scheme 下它们都是同源请求。
/// （若要改回 loadFileURL(_:allowingReadAccessTo:)，见 WorldController.loadMode。）
final class WorldSchemeHandler: NSObject, WKURLSchemeHandler {
    let root: URL

    init(root: URL) {
        self.root = root
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/embed.html" }
        let relative = String(path.drop { $0 == "/" })
        let fileURL = root.appendingPathComponent(relative).standardizedFileURL
        let rootPath = root.standardizedFileURL.path
        guard fileURL.path.hasPrefix(rootPath), let data = try? Data(contentsOf: fileURL) else {
            if let resp = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"]) {
                urlSchemeTask.didReceive(resp)
            }
            urlSchemeTask.didReceive(Data())
            urlSchemeTask.didFinish()
            return
        }
        let headers = [
            "Content-Type": WorldSchemeHandler.mimeType(fileURL.pathExtension),
            "Content-Length": String(data.count),
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
        ]
        guard let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) else {
            urlSchemeTask.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        urlSchemeTask.didReceive(resp)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}

    static func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "topojson", "geojson", "map": return "application/json"
        case "wasm": return "application/wasm"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "avif": return "image/avif"
        case "svg": return "image/svg+xml"
        case "ktx2": return "image/ktx2"
        case "glb": return "model/gltf-binary"
        case "gltf": return "model/gltf+json"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "txt", "md": return "text/plain; charset=utf-8"
        default: return "application/octet-stream"
        }
    }
}
