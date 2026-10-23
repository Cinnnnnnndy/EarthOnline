package app.earthonline.android.world

import android.content.Context
import android.util.Base64
import android.view.ViewGroup
import android.webkit.WebView
import app.earthonline.android.model.Avatar
import app.earthonline.android.model.CaseEdits
import app.earthonline.android.model.EoJson
import app.earthonline.android.model.Trip
import app.earthonline.android.util.CaseCards
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject

/** 箱子里的一样（suitcase-contents）：id 是藏东西用的 id；icon 是渲染好的 PNG dataUrl */
@Serializable
data class CaseItem(val id: String, val type: String, val key: String, val label: String, val icon: String? = null)

/** 清单里的一格（bridge.ts 的 CaseEntryMsg） */
@Serializable
data class CaseEntry(
    val type: String,
    val id: String,
    val boxId: String = "",
    val label: String,
    val sub: String = "",
    val inBox: Boolean = false,
    val mine: Boolean? = null,
    val icon: String? = null,
)

@Serializable
data class CaseGroup(val id: String, val label: String, val entries: List<CaseEntry>)

/** 点一格之后嵌入页算出的新增减；result 是 added / removed / frontFull / backFull */
data class CaseEditResult(val suitcase: CaseEdits?, val result: String)

/** 做好的照片小卡（card-made）：kind 是 cutout（PNG 带透明）/ polaroid（整张 JPEG） */
class MadeCard(val kind: String, val w: Int, val h: Int, val bytes: ByteArray)

/**
 * 行李箱（D75 / D78 / D84）：3D 的箱子在世界层里（shared/world/suitcase-scene.ts），安卓不自己画。
 * 日记页用一个独立的 WebView 装 `embed.html?mode=suitcase`（只建箱子），发 show-suitcase 显示、export-suitcase 导出 PNG；
 * 清单：发 case-search / case-toggle，收 case-results / case-edits（检索、分组、规则、图标都在网页那份，原生只画）。
 * 和 iOS 的 SuitcaseBridge 一样；页面只在用到时建，离开日记页就 destroy()。
 */
class SuitcaseBridge(context: Context, private val locale: String) {
    private val app = context.applicationContext
    private val loader = AssetWebViews.loader(app)

    private val _webView = MutableStateFlow<WebView?>(null)
    val webView: StateFlow<WebView?> = _webView.asStateFlow()

    private val _items = MutableStateFlow<List<CaseItem>>(emptyList())
    val items: StateFlow<List<CaseItem>> = _items.asStateFlow()
    private val _groups = MutableStateFlow<List<CaseGroup>>(emptyList())
    val groups: StateFlow<List<CaseGroup>> = _groups.asStateFlow()
    private val _edits = MutableSharedFlow<CaseEditResult>(extraBufferCapacity = 8)
    val edits: SharedFlow<CaseEditResult> = _edits.asSharedFlow()

    var lastQuery: String = ""
        private set

    private var ready = false
    private var pendingShow: String? = null
    private var exportWaiter: CompletableDeferred<ByteArray?>? = null
    private val pendingCards = HashMap<String, CompletableDeferred<JsonObject>>()
    private var cardSeq = 0

    fun start() {
        if (_webView.value != null) return
        _webView.value = create()
    }

    private fun create(): WebView {
        val client = AssetWebViews.Client(loader, onStarted = ::onPageStarted, onGone = ::onRenderGone)
        val w = AssetWebViews.create(app, WorldJsBridge(::receive), client)
        w.loadUrl(AssetWebViews.entryUrl(locale, mode = "suitcase"))
        return w
    }

    /** 页面（重新）开始加载：等下一个 ready；正在抠的卡新页面不会回了，直接作废 */
    private fun onPageStarted() {
        ready = false
        val gone = JsonObject(mapOf("error" to JsonPrimitive("reloaded")))
        pendingCards.values.forEach { it.complete(gone) }
        pendingCards.clear()
    }

    private fun onRenderGone(view: WebView) {
        if (view !== _webView.value) return
        (view.parent as? ViewGroup)?.removeView(view)
        view.destroy()
        ready = false
        _webView.value = create()
    }

    /** 显示这本书的箱子（style 没给就用小人档案里的那款） */
    suspend fun show(trip: Trip, avatar: Avatar) {
        // 照片小卡的图从 files/cards/ 读出来一起带上（读不到的那张跳过，箱子里就不放它）
        val cards = withContext(Dispatchers.IO) { trip.suitcase?.cards.orEmpty().mapNotNull { c -> CaseCards.dataUrl(app, c.id)?.let { c.id to it } } }
        val json = WorldMessages.showSuitcase(trip, avatar, avatar.suitcase, cards).toString()
        pendingShow = json
        if (ready) evaluate(json)
    }

    /** 照片小卡（D99）：把一张照片（data URL，长边 ≤ 1280）交给嵌入页抠图；没就绪或 20 秒没回返回 null */
    suspend fun makeCard(photoDataUrl: String): MadeCard? {
        if (!ready) return null
        val id = "card-${++cardSeq}"
        val reply = CompletableDeferred<JsonObject>()
        pendingCards[id] = reply
        try {
            evaluate(WorldMessages.makeCard(id, photoDataUrl).toString())
            val res = withTimeoutOrNull(20_000) { reply.await() } ?: return null
            if ((res["error"] as? JsonPrimitive)?.contentOrNull != null) return null
            val card = res["card"] as? JsonObject ?: return null
            val bytes = decodeDataUrl((res["dataUrl"] as? JsonPrimitive)?.contentOrNull.orEmpty()) ?: return null
            return MadeCard(
                kind = (card["kind"] as? JsonPrimitive)?.contentOrNull ?: "polaroid",
                w = (card["w"] as? JsonPrimitive)?.contentOrNull?.toIntOrNull() ?: 0,
                h = (card["h"] as? JsonPrimitive)?.contentOrNull?.toIntOrNull() ?: 0,
                bytes = bytes,
            )
        } finally {
            pendingCards.remove(id)
        }
    }

    /** 清单：打一句话或一个词（空的给默认分组） */
    fun search(query: String) {
        lastQuery = query
        if (ready) evaluate(WorldMessages.caseSearch(query).toString())
    }

    /** 清单：点一格（放进去 / 拿出来），结果从 edits 回来 */
    fun toggle(type: String, id: String) {
        if (ready) evaluate(WorldMessages.caseToggle(type, id).toString())
    }

    /** 让嵌入页渲染一张 PNG；没就绪或 8 秒没回返回 null */
    suspend fun export(): ByteArray? {
        if (!ready || exportWaiter != null) return null
        val waiter = CompletableDeferred<ByteArray?>()
        exportWaiter = waiter
        evaluate(WorldMessages.exportSuitcase().toString())
        return try { withTimeoutOrNull(8_000) { waiter.await() } } finally { exportWaiter = null }
    }

    private fun evaluate(json: String) {
        val js = "(function(){try{if(window.EarthWorld&&window.EarthWorld.send){window.EarthWorld.send(${jsStringLiteral(json)});}}catch(e){console.error(e);}})();"
        _webView.value?.evaluateJavascript(js, null)
    }

    private fun receive(text: String) {
        val obj: JsonObject = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        when ((obj["kind"] as? JsonPrimitive)?.contentOrNull) {
            "ready", "bridge-ready" -> {
                ready = true   // 再收到一次 ready 也只是把最新的箱子再显示一遍（幂等）
                pendingShow?.let(::evaluate)
                if (lastQuery.isNotEmpty()) search(lastQuery)
            }
            "suitcase-image" -> {
                val url = (obj["dataUrl"] as? JsonPrimitive)?.contentOrNull.orEmpty()
                val bytes = runCatching { Base64.decode(url.substringAfter(','), Base64.DEFAULT) }.getOrNull()
                exportWaiter?.complete(bytes)
            }
            "suitcase-contents" -> obj["items"]?.let { el ->
                runCatching { EoJson.decodeFromJsonElement(ListSerializer(CaseItem.serializer()), el) }.onSuccess { _items.value = it }
            }
            "case-results" -> {
                // 打得快时旧的结果不要
                if ((obj["query"] as? JsonPrimitive)?.contentOrNull.orEmpty() != lastQuery) return
                obj["groups"]?.let { el ->
                    runCatching { EoJson.decodeFromJsonElement(ListSerializer(CaseGroup.serializer()), el) }.onSuccess { _groups.value = it }
                }
            }
            "card-made" -> {
                val id = (obj["requestId"] as? JsonPrimitive)?.contentOrNull
                if (id != null) pendingCards.remove(id)?.complete(obj)
            }
            "case-edits" -> {
                val edits = obj["suitcase"]?.let { el -> runCatching { EoJson.decodeFromJsonElement(CaseEdits.serializer(), el) }.getOrNull() }
                _edits.tryEmit(CaseEditResult(edits, (obj["result"] as? JsonPrimitive)?.contentOrNull.orEmpty()))
            }
        }
    }

    fun destroy() {
        val w = _webView.value ?: return
        _webView.value = null
        (w.parent as? ViewGroup)?.removeView(w)
        w.destroy()
    }
}
