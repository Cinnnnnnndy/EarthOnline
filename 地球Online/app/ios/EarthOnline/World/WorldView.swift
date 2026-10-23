import SwiftUI
import WebKit

/// 世界层铺满整屏（P1 换 Cocos 时只换这里的 UIView，消息不变）
struct WorldView: UIViewRepresentable {
    let controller: WorldController

    func makeUIView(context: Context) -> WorldHostView {
        let host = WorldHostView()
        host.attach(controller.webView)
        return host
    }

    func updateUIView(_ uiView: WorldHostView, context: Context) {
        uiView.attach(controller.webView)
    }
}

/// 包一层容器：同一个 WKWebView 在视图重建时可以挪到新的容器里，不用重新加载
final class WorldHostView: UIView {
    func attach(_ web: WKWebView) {
        guard web.superview !== self else { return }
        web.removeFromSuperview()
        web.translatesAutoresizingMaskIntoConstraints = true
        web.frame = bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(web)
        backgroundColor = .clear
    }
}
