package app.earthonline.android.world

import app.earthonline.android.model.Avatar
import app.earthonline.android.model.EoJson
import app.earthonline.android.model.HomePlace
import app.earthonline.android.model.Trip
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * 原生 → 嵌入页的消息（shared/spec/bridge.ts 的 NativeToWorld + ShellToEmbed），每种一个构造函数，产出 JsonObject。
 * 哪些是状态（按频道只留最新一条）、哪些是一次性动作，由 WorldController 按生成的 Shared.CHANNEL_OF 决定，这里不管。
 * 纯 Kotlin，不依赖 Android。
 */
object WorldMessages {
    private fun msg(kind: String, body: JsonObjectBuilder.() -> Unit = {}): JsonObject =
        buildJsonObject { put("kind", kind); body() }

    private fun trip(t: Trip): JsonElement = EoJson.encodeToJsonElement(Trip.serializer(), t)

    // ---------------- 世界层（某一天）
    fun play() = msg("play")
    fun pause() = msg("pause")
    fun restart() = msg("restart")
    fun gotoStop(stopIndex: Int) = msg("goto-stop") { put("stopIndex", stopIndex) }
    fun setAvatar(a: Avatar) = msg("set-avatar") { put("avatar", EoJson.encodeToJsonElement(Avatar.serializer(), a)) }
    /** pitch 只能是 30（带角度）或 90（俯视） */
    fun setView(pitch: Int? = null, follow: Boolean? = null) = msg("set-view") {
        if (pitch != null) put("pitch", pitch)
        if (follow != null) put("follow", follow)
    }
    fun setPost(level: String) = msg("set-post") { put("level", level) }

    /** 布局态（D90）：segments / posture 是量到的折痕段与姿态（dp） */
    fun setLayout(layout: String, width: Double, height: Double, segments: List<SegmentDp>?, posture: String?) = msg("set-layout") {
        put("layout", layout)
        put("width", width)
        put("height", height)
        if (!segments.isNullOrEmpty()) put("segments", buildJsonArray {
            segments.forEach { s -> add(buildJsonObject { put("x", s.x); put("y", s.y); put("w", s.w); put("h", s.h) }) }
        })
        if (posture != null) put("posture", posture)
    }

    // ---------------- 嵌入页（地球、某一天、行李箱、核心）
    fun showGlobe() = msg("show-globe")
    fun showDay(t: Trip, dayIndex: Int) = msg("show-day") { put("trip", trip(t)); put("dayIndex", dayIndex) }
    fun setTrips(trips: List<Trip>, today: String) = msg("set-trips") {
        put("trips", EoJson.encodeToJsonElement(ListSerializer(Trip.serializer()), trips))
        put("today", today)
    }
    fun focusHome(lat: Double, lng: Double, animate: Boolean) = msg("focus-home") { put("lat", lat); put("lng", lng); put("animate", animate) }
    fun focusBook(id: String, animate: Boolean) = msg("focus-book") { put("id", id); put("animate", animate) }
    fun focusDay(id: String, dayIndex: Int, animate: Boolean) = msg("focus-day") { put("id", id); put("dayIndex", dayIndex); put("animate", animate) }
    fun flyTo(lat: Double, lng: Double, alt: Double) = msg("fly-to") { put("lat", lat); put("lng", lng); put("alt", alt) }
    /** 没有家时显式写 null（嵌入页据此拿掉家的标记） */
    fun setHome(home: HomePlace?) = msg("set-home") {
        put("home", home?.let { EoJson.encodeToJsonElement(HomePlace.serializer(), it) } ?: JsonNull)
    }
    data class Flag(val id: String, val name: String, val lat: Double, val lng: Double)
    fun setFootprints(flags: List<Flag>, fresh: List<String>) = msg("set-footprints") {
        put("flags", buildJsonArray { flags.forEach { f -> add(buildJsonObject { put("id", f.id); put("name", f.name); put("lat", f.lat); put("lng", f.lng) }) } })
        put("fresh", JsonArray(fresh.map { JsonPrimitive(it) }))
    }
    /** 被原生面板挡住的区域（dp = CSS px），地球 / 浮岛把视觉中心挪到露出来的那块 */
    fun setInsets(left: Double, bottom: Double, top: Double, right: Double) = msg("set-insets") {
        put("left", left); put("bottom", bottom); put("top", top); put("right", right)
    }
    /** day / dusk / night */
    fun setSky(phase: String) = msg("set-sky") { put("phase", phase) }
    /** sea / warm / dusk */
    fun setPalette(palette: String) = msg("set-palette") { put("palette", palette) }
    fun markVisited(entryId: String, visited: Boolean) = msg("mark-visited") { put("entryId", entryId); put("visited", visited) }
    fun pickPoint(on: Boolean) = msg("pick-point") { put("on", on) }
    fun importPage(requestId: String, html: String) = msg("import-page") { put("requestId", requestId); put("html", html) }
    /** cards：照片小卡的图（id → data URL），书里 suitcase.cards 记着的那几张 */
    fun showSuitcase(t: Trip, avatar: Avatar?, style: String?, cards: List<Pair<String, String>> = emptyList()) = msg("show-suitcase") {
        put("trip", trip(t))
        if (avatar != null) put("avatar", EoJson.encodeToJsonElement(Avatar.serializer(), avatar))
        if (style != null) put("style", style)
        if (cards.isNotEmpty()) put("cards", buildJsonArray { cards.forEach { (id, url) -> add(buildJsonObject { put("id", id); put("dataUrl", url) }) } })
    }
    /** 照片小卡（D99）：嵌入页用网页那套本机抠图做成立牌 / 拍立得，回 card-made */
    fun makeCard(requestId: String, dataUrl: String) = msg("make-card") { put("requestId", requestId); put("dataUrl", dataUrl) }
    fun exportSuitcase() = msg("export-suitcase")
    fun caseSearch(query: String) = msg("case-search") { put("query", query) }
    /** type 是 souvenir / extra / landmark */
    fun caseToggle(type: String, id: String) = msg("case-toggle") { put("type", type); put("id", id) }
    /** 长图（D96）：嵌入页借世界层逐天渲染、按网页同一份排版拼好，回 long-image（data URL） */
    fun exportLongImage(requestId: String, t: Trip) = msg("export-long-image") { put("requestId", requestId); put("trip", trip(t)) }
    fun coreCall(requestId: String, fn: String, args: List<JsonElement>, locale: String?) = msg("core-call") {
        put("requestId", requestId)
        put("fn", fn)
        put("args", JsonArray(args))
        if (locale != null) put("locale", locale)
    }
}

/** data:image/png;base64,… → 字节；不是 base64 的 data URL 返回 null（纯 Kotlin，单测里也能跑） */
fun decodeDataUrl(url: String): ByteArray? {
    val comma = url.indexOf(',')
    if (!url.startsWith("data:") || comma < 0 || !url.substring(0, comma).endsWith(";base64")) return null
    return runCatching { java.util.Base64.getDecoder().decode(url.substring(comma + 1)) }.getOrNull()?.takeIf { it.isNotEmpty() }
}

/** 发给嵌入页的折痕段（dp，相对窗口左上角） */
data class SegmentDp(val x: Double, val y: Double, val w: Double, val h: Double)

/**
 * 把 JSON 文本变成 JS 字符串字面量：交给 kotlinx 编一个顶层字符串（引号、反斜杠、控制字符都转义），
 * 再把 U+2028 / U+2029 也转义掉（老的 JS 引擎里它们不能出现在字符串字面量里）。
 */
fun jsStringLiteral(json: String): String =
    EoJson.encodeToString(String.serializer(), json)
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
