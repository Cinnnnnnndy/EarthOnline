package app.earthonline.android.world

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * 装世界层网页的 WebView（常驻的那一个，和日记页行李箱的那一个）共用的设置。
 * 网页是 `npm run sync:shells` 拷进 assets/world/ 的 web/dist，用 WebViewAssetLoader 从
 * https://appassets.androidplatform.net/assets/world/embed.html 供应：同源的 https，ES module 与 fetch 都能用，不开 file:// 访问。
 */
object AssetWebViews {
    const val HOST = "appassets.androidplatform.net"
    private const val TAG = "EarthWorld"

    /** 嵌入页地址；lang 给世界层里的标签、日记措辞定语言；mode=suitcase 只建行李箱 */
    fun entryUrl(locale: String, mode: String? = null): String =
        "https://$HOST/assets/world/embed.html?lang=" + Uri.encode(locale) + (mode?.let { "&mode=" + Uri.encode(it) } ?: "")

    fun loader(context: Context): WebViewAssetLoader = WebViewAssetLoader.Builder()
        .setDomain(HOST)
        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
        .build()

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    fun create(context: Context, bridge: WorldJsBridge, client: WebViewClient): WebView {
        val debuggable = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)
        return WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true          // 物件图标缓存用 IndexedDB / localStorage
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mediaPlaybackRequiresUserGesture = true
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.textZoom = 100                    // 世界里的标签按 CSS px 排，不跟系统字号再放大一次
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            setBackgroundColor(Color.TRANSPARENT)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            webViewClient = client
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                    if (debuggable) Log.d(TAG, "${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                    return true
                }
            }
            // 世界 → 原生：嵌入页的 post() 调 window.androidBridge.postMessage(json)（web/src/embed.ts）
            addJavascriptInterface(bridge, "androidBridge")
        }
    }

    /** AssetsPathHandler 猜不出类型时补上（module 脚本必须是 JS 的 MIME，否则 Chromium 拒绝执行） */
    private val MIME = mapOf(
        "js" to "text/javascript", "mjs" to "text/javascript", "css" to "text/css", "html" to "text/html",
        "json" to "application/json", "wasm" to "application/wasm", "svg" to "image/svg+xml",
        "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "webp" to "image/webp",
        "ttf" to "font/ttf", "otf" to "font/otf", "woff" to "font/woff", "woff2" to "font/woff2",
        "glb" to "model/gltf-binary", "gltf" to "model/gltf+json", "bin" to "application/octet-stream",
    )

    internal fun fixMime(url: Uri, response: WebResourceResponse) {
        val ext = url.lastPathSegment?.substringAfterLast('.', "")?.lowercase().orEmpty()
        val want = MIME[ext] ?: return
        val have = response.mimeType
        if (have.isNullOrEmpty() || have == "application/octet-stream" || have == "text/plain" || (ext == "js" && have != want)) {
            response.mimeType = want
        }
        if (response.encoding == null && (want.startsWith("text/") || want == "application/json")) response.encoding = "utf-8"
    }

    /** 公共的 WebViewClient：资源走 asset loader、不许跳到别的站、进程被系统回收时交给 onGone */
    open class Client(
        private val loader: WebViewAssetLoader,
        private val onStarted: () -> Unit,
        private val onGone: (WebView) -> Unit,
    ) : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            loader.shouldInterceptRequest(request.url)?.also { fixMime(request.url, it) }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            request.url.host != HOST

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            super.onPageStarted(view, url, favicon)
            onStarted()
        }

        /** 渲染进程崩了或被回收：这个 WebView 不能再用，返回 true 让应用活着，由 onGone 换一个新的 */
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            Log.w(TAG, "render process gone (crash=${detail.didCrash()})")
            onGone(view)
            return true
        }
    }
}

/** 注入网页的 window.androidBridge：JS 线程上调用，转回主线程再处理 */
class WorldJsBridge(private val onMessage: (String) -> Unit) {
    private val main = android.os.Handler(android.os.Looper.getMainLooper())

    @JavascriptInterface
    fun postMessage(json: String) {
        main.post { onMessage(json) }
    }
}
