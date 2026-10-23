package app.earthonline.android.world

import android.content.Context
import android.view.ViewGroup
import android.webkit.WebView
import app.earthonline.android.gen.Shared
import app.earthonline.android.model.CoreCaller
import app.earthonline.android.model.CoreException
import app.earthonline.android.model.Trip
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

/** 世界层 → 原生的一条消息（WorldToNative + EmbedToShell）：kind 加原样的 JSON */
data class WorldEvent(val kind: String, val body: JsonObject) {
    fun str(key: String): String = (body[key] as? JsonPrimitive)?.contentOrNull.orEmpty()
    fun int(key: String): Int = (body[key] as? JsonPrimitive)?.intOrNull ?: 0
    fun dbl(key: String): Double = (body[key] as? JsonPrimitive)?.doubleOrNull ?: 0.0
    fun strings(key: String): List<String> = (body[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty()
}

/** 长图没导出来：reason 是给人看的原因（busy / timeout / world reloaded / 嵌入页的报错） */
class LongImageException(val reason: String) : Exception("long image: $reason")

/** 用网页的导入器解析行程页 HTML 的结果（import-result）；trips 是 0.3 的 Trip JSON */
data class ImportPageResult(val trips: List<JsonElement>, val warnings: List<String>, val error: String?)

/**
 * 世界层（地球 + 某一天的微缩世界）常驻一个 WebView：用 Application 的 context 建一次，切舞台只换模式和相机，不销毁（技术选型 8.3）。
 * 原生 → 世界：evaluateJavascript("EarthWorld.send(<JSON 字符串字面量>)")；世界 → 原生：window.androidBridge.postMessage(json)。
 *
 * 消息频道（shared/spec/channels.ts，生成的 Shared.CHANNEL_OF / REPLAY_ORDER）：
 *  - 状态型消息按频道只留最新一条；页面（重新）加载后收到 ready，按 REPLAY_ORDER 重放一遍；
 *  - 一次性动作在页面没就绪时排队，就绪后按发出的顺序发一次；
 *  - 只有页面级的 ready（每次加载一次，window.EarthWorld 已经在了）才重放；万一收到第二次也只确认就绪，不再重放。
 *    某一天的底板建好后世界层发的是 plate-loaded（普通事件，交给 AppModel），绝不拿它当 ready——否则重放 show-day 会无限重载。
 * 所有方法都在主线程调（WebView 的要求）；core() 自己切到主线程。
 */
class WorldController(context: Context) : CoreCaller {
    private val app = context.applicationContext
    private val loader = AssetWebViews.loader(app)

    private val _webView = MutableStateFlow<WebView?>(null)
    /** 当前的 WebView（渲染进程被回收后会换成新的，界面按它重新挂上） */
    val webView: StateFlow<WebView?> = _webView.asStateFlow()

    private val _ready = MutableStateFlow(false)
    val ready: StateFlow<Boolean> = _ready.asStateFlow()

    private val _events = MutableSharedFlow<WorldEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<WorldEvent> = _events.asSharedFlow()

    /** 世界层当前模式（原生这边的记录）：globe / day */
    var mode: String = "globe"
        private set

    private val sticky = HashMap<String, String>()
    private val queue = ArrayList<String>()
    private var replayedThisLoad = false
    private val pendingCore = HashMap<String, CompletableDeferred<JsonObject>>()
    private val pendingImports = HashMap<String, CompletableDeferred<JsonObject>>()
    private val pendingLong = HashMap<String, CompletableDeferred<JsonObject>>()
    private val _longProgress = MutableStateFlow<String?>(null)
    /** 长图导出的进度（「渲染第 1 / 3 天」「拼图」，嵌入页按当前语言给）；没在导出时是 null */
    val longImageProgress: StateFlow<String?> = _longProgress.asStateFlow()
    private var seq = 0L
    private var locale = "zh-Hans"

    /** 建 WebView 并加载嵌入页（只建一次） */
    fun start(locale: String) {
        this.locale = locale
        if (_webView.value == null) _webView.value = create()
    }

    /** 换界面语言：带新的 ?lang= 重新加载，状态在 ready 后重放 */
    fun setLocale(locale: String) {
        if (locale == this.locale) return
        this.locale = locale
        _webView.value?.loadUrl(AssetWebViews.entryUrl(locale))
    }

    // ---------------------------------------------------------------- 发送

    fun send(msg: JsonObject) {
        val kind = (msg["kind"] as? JsonPrimitive)?.contentOrNull ?: return
        val json = msg.toString()
        val channel = Shared.CHANNEL_OF[kind]
        if (channel != null) {
            sticky[channel] = json
            if (channel == "mode") mode = if (kind == "show-day" || kind == "load-plate") "day" else "globe"
        }
        if (!_ready.value) {
            if (channel == null) queue += json
            return
        }
        evaluate(json)
    }

    private fun evaluate(json: String) {
        val literal = jsStringLiteral(json)
        val js = "(function(){try{if(window.EarthWorld&&window.EarthWorld.send){window.EarthWorld.send($literal);}}catch(e){console.error(e);}})();"
        _webView.value?.evaluateJavascript(js, null)
    }

    // ---------------------------------------------------------------- 接收

    private fun receive(text: String) {
        val obj = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        val kind = (obj["kind"] as? JsonPrimitive)?.contentOrNull ?: return
        when (kind) {
            "ready", "bridge-ready" -> onReady()
            "core-result" -> {
                val id = (obj["requestId"] as? JsonPrimitive)?.contentOrNull
                if (id != null) pendingCore.remove(id)?.complete(obj)
                return   // 核心调用的结果只给等它的那一处
            }
            "import-result" -> {
                val id = (obj["requestId"] as? JsonPrimitive)?.contentOrNull
                if (id != null) pendingImports.remove(id)?.complete(obj)
            }
            "long-image-progress" -> {
                val id = (obj["requestId"] as? JsonPrimitive)?.contentOrNull
                if (id != null && pendingLong.containsKey(id)) _longProgress.value = (obj["text"] as? JsonPrimitive)?.contentOrNull
                return
            }
            "long-image" -> {
                val id = (obj["requestId"] as? JsonPrimitive)?.contentOrNull
                if (id != null) pendingLong.remove(id)?.complete(obj)
                return   // 好几 MB 的 data URL，只给等它的那一处
            }
        }
        _events.tryEmit(WorldEvent(kind, obj))
    }

    private fun onReady() {
        if (!replayedThisLoad) {
            replayedThisLoad = true
            for (ch in Shared.REPLAY_ORDER) sticky[ch]?.let(::evaluate)
            val q = queue.toList()
            queue.clear()
            q.forEach(::evaluate)
        }
        _ready.value = true
    }

    /** 页面开始（重新）加载：还没就绪；正在等的核心调用作废（新页面不会回它们） */
    private fun onPageStarted() {
        _ready.value = false
        replayedThisLoad = false
        val reloaded = buildJsonObject { put("error", "world reloaded") }
        pendingCore.values.forEach { it.complete(reloaded) }
        pendingCore.clear()
        pendingImports.values.forEach { it.complete(reloaded) }
        pendingImports.clear()
        pendingLong.values.forEach { it.complete(reloaded) }
        pendingLong.clear()
    }

    // ---------------------------------------------------------------- 核心调用与导入

    /** 调 shared/core.ts 的一个函数：先等世界层就绪（最多 30 秒），再等结果（10 秒） */
    override suspend fun core(fn: String, args: List<JsonElement>, locale: String?): JsonElement = withContext(Dispatchers.Main.immediate) {
        withTimeoutOrNull(30_000) { ready.first { it } } ?: throw CoreException(fn, "world not ready")
        val id = "core-${++seq}"
        val reply = CompletableDeferred<JsonObject>()
        pendingCore[id] = reply
        try {
            send(WorldMessages.coreCall(id, fn, args, locale ?: this@WorldController.locale))
            val res = withTimeoutOrNull(10_000) { reply.await() } ?: throw CoreException(fn, "timeout")
            (res["error"] as? JsonPrimitive)?.contentOrNull?.let { throw CoreException(fn, it) }
            res["value"] ?: JsonNull
        } finally {
            pendingCore.remove(id)
        }
    }

    /** 用网页的导入器（shared/import/route-page.ts）解析行程页 HTML；10 秒没回返回 null */
    suspend fun importPage(html: String): ImportPageResult? = withContext(Dispatchers.Main.immediate) {
        withTimeoutOrNull(30_000) { ready.first { it } } ?: return@withContext null
        val id = "import-${++seq}"
        val reply = CompletableDeferred<JsonObject>()
        pendingImports[id] = reply
        try {
            send(WorldMessages.importPage(id, html))
            val res = withTimeoutOrNull(10_000) { reply.await() } ?: return@withContext null
            ImportPageResult(
                trips = (res["trips"] as? JsonArray)?.toList().orEmpty(),
                warnings = (res["warnings"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty(),
                error = (res["error"] as? JsonPrimitive)?.contentOrNull,
            )
        } finally {
            pendingImports.remove(id)
        }
    }

    /**
     * 导出长图（D96）：嵌入页借这个常驻的世界层逐天建底板、拍一张，用网页同一份排版（web/src/export.ts）拼成 PNG。
     * 三端同一张图——不再各画一份。时限按天数给（一天 30 秒，模拟器和低端机也够）；进度在 longImageProgress。
     * 嵌入页拍完会把原来那一天建回来；同一时刻只做一张（第二次请求回 busy）。
     */
    suspend fun exportLongImage(trip: Trip): ByteArray = withContext(Dispatchers.Main.immediate) {
        withTimeoutOrNull(30_000) { ready.first { it } } ?: throw LongImageException("world not ready")
        val id = "long-${++seq}"
        val reply = CompletableDeferred<JsonObject>()
        pendingLong[id] = reply
        try {
            send(WorldMessages.exportLongImage(id, trip))
            val res = withTimeoutOrNull(60_000L + 30_000L * trip.days.size) { reply.await() } ?: throw LongImageException("timeout")
            (res["error"] as? JsonPrimitive)?.contentOrNull?.let { throw LongImageException(it) }
            val url = (res["dataUrl"] as? JsonPrimitive)?.contentOrNull ?: throw LongImageException("empty")
            decodeDataUrl(url) ?: throw LongImageException("bad image")
        } finally {
            pendingLong.remove(id)
            _longProgress.value = null
        }
    }

    // ---------------------------------------------------------------- 生命周期

    private fun create(): WebView {
        val client = AssetWebViews.Client(loader, onStarted = ::onPageStarted, onGone = ::onRenderGone)
        val w = AssetWebViews.create(app, WorldJsBridge(::receive), client)
        w.loadUrl(AssetWebViews.entryUrl(locale))
        return w
    }

    /** 渲染进程没了：旧 WebView 不能再用，销毁、换新的；界面（WorldHost）按 webView 重新挂上，就绪后状态自动重放 */
    private fun onRenderGone(view: WebView) {
        if (view !== _webView.value) return
        (view.parent as? ViewGroup)?.removeView(view)
        view.destroy()
        _ready.value = false
        replayedThisLoad = false
        _webView.value = create()
    }

    /** 回到后台 / 前台：暂停或恢复网页里的动画 */
    fun setForeground(on: Boolean) {
        val w = _webView.value ?: return
        if (on) w.onResume() else w.onPause()
    }

    fun destroy() {
        val w = _webView.value ?: return
        _webView.value = null
        (w.parent as? ViewGroup)?.removeView(w)
        w.destroy()
    }
}
