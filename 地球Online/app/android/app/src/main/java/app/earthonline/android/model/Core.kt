package app.earthonline.android.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * 公用的领域核心（D94，shared/core.ts）：安卓不移植算法，按名字经世界层调。
 * 这里是「一次核心调用」的接口（WorldController 实现：core-call → core-result）与带类型的薄包装；结果的形状照 core.ts 的返回值写。
 * 纯 Kotlin，不依赖 Android。
 */
interface CoreCaller {
    /** 调 shared/core.ts 的一个函数；出错（嵌入页回 error、超时、世界层没起来）抛 CoreException */
    suspend fun core(fn: String, args: List<JsonElement>, locale: String? = null): JsonElement
}

class CoreException(val fn: String, message: String) : Exception("core.$fn: $message")

// ---------------------------------------------------------------- 结果的形状

/** journey：旅行中 / 快出发 / 刚回来 / 平常日子（只回书的 id） */
@Serializable
data class Journey(
    val kind: String,
    val tripId: String? = null,
    val dayIndex: Int? = null,
    val inDays: Int? = null,
    val daysAgo: Int? = null,
    val next: JourneyNext? = null,
) {
    companion object { const val TRAVELING = "traveling"; const val DEPARTING = "departing"; const val BACK = "back"; const val IDLE = "idle" }
}

@Serializable
data class JourneyNext(val tripId: String, val inDays: Int)

@Serializable
data class TripStats(
    val days: Int,
    val places: Int,
    val visited: Int,
    val walkMinutes: Double,
    val transitMinutes: Double,
    val cities: List<String>,
    val lodgings: List<String>,
)

@Serializable
data class TimelineItem(val entryId: String, val type: String, val start: String, val end: String, val minutes: Double)

@Serializable
data class Timeline(
    val items: List<TimelineItem>,
    val walkMinutes: Double = 0.0,
    val transitMinutes: Double = 0.0,
    val stayMinutes: Double = 0.0,
    val firstStart: String = "",
    val lastEnd: String = "",
) {
    fun item(entryId: String): TimelineItem? = items.firstOrNull { it.entryId == entryId }
}

@Serializable
data class PlaceTodoNext(val todo: Todo, val due: String)

@Serializable
data class PlaceTodos(val open: Int, val next: PlaceTodoNext? = null)

@Serializable
data class Footprint(
    val id: String,
    val name: String,
    val lat: Double,
    val lng: Double,
    val date: String = "",
    /** trip / manual */
    val source: String,
    val trips: List<String> = emptyList(),
)

@Serializable
data class FootprintStats(val places: Int, val countries: List<String> = emptyList(), val farthestKm: Double = 0.0, val farthest: String? = null)

@Serializable
data class Footprints(val flags: List<Footprint>, val stats: FootprintStats)

/** 地名表里的一处（shared/geo/gazetteer.ts 的 Place） */
@Serializable
data class Place(val name: String, val aliases: List<String> = emptyList(), val lat: Double, val lng: Double, val kind: String)

@Serializable
data class PlannerMessage(val role: String, val text: String)

/** 规划一轮的结果（planner/protocol.ts 的 PlanResult） */
@Serializable
data class PlanResult(
    val reply: String,
    val question: String? = null,
    val draft: Trip? = null,
    val done: Boolean,
    val source: String? = null,
) {
    /** 写回对话历史的文本：reply 后面接追问（protocol.ts 的 assistantText） */
    val assistantText: String
        get() {
            val q = question?.trim().orEmpty()
            if (q.isEmpty()) return reply.trim()
            val r = reply.trim()
            return if (r.isNotEmpty()) "$r $q" else q
        }
}

/** 名额：unlimited 时 limit / left 为 null（Pro） */
@Serializable
data class Quota(val used: Int, val limit: Int? = null, val left: Int? = null, val unlimited: Boolean = false, val canCreate: Boolean)

/** 站点的景点类型（shared/world/place-kind.ts）：label / groupLabel 按调用时的语言给；group 是六组之一（culture / nature / leisure / life / stay / transit） */
@Serializable
data class KindInfo(
    val kind: String,
    val group: String,
    val icon: String = "",
    val label: String,
    val groupLabel: String = "",
    val tier: String? = null,
    val famous: Boolean = false,
)

// ---------------------------------------------------------------- 带类型的薄包装

class CoreApi(private val caller: CoreCaller, private val locale: () -> String) {
    private fun <T> enc(s: KSerializer<T>, v: T): JsonElement = EoJson.encodeToJsonElement(s, v)
    private fun <T> dec(s: KSerializer<T>, e: JsonElement): T = EoJson.decodeFromJsonElement(s, e)
    private fun str(s: String) = JsonPrimitive(s)
    private suspend fun call(fn: String, vararg args: JsonElement): JsonElement = caller.core(fn, args.toList(), locale())

    /** journey 只看日期、状态与天数：传瘦身的书（不带站点、折线），省得每次都把整本书过一遍桥 */
    suspend fun journey(trips: List<Trip>, today: String): Journey =
        dec(Journey.serializer(), call("journey", enc(ListSerializer(Trip.serializer()), trips.map { it.lite() }), str(today)))

    suspend fun tripStats(trip: Trip): TripStats = dec(TripStats.serializer(), call("tripStats", enc(Trip.serializer(), trip)))

    suspend fun timeline(day: Day): Timeline = dec(Timeline.serializer(), call("timeline", enc(Day.serializer(), day)))

    /** 某一天自动生成的日记（按当前界面语言写） */
    suspend fun diary(trip: Trip, dayIndex: Int): String =
        dec(String.serializer(), call("diary", enc(Trip.serializer(), trip), JsonPrimitive(dayIndex)))

    suspend fun placeTodos(entry: PlaceEntry, fallbackDue: String, today: String): PlaceTodos =
        dec(PlaceTodos.serializer(), call("placeTodos", enc(PlaceEntry.serializer(), entry), str(fallbackDue), str(today)))

    suspend fun dueFromLead(dayDate: String, lead: Int): String =
        dec(String.serializer(), call("dueFromLead", str(dayDate), JsonPrimitive(lead)))

    suspend fun footprints(trips: List<Trip>, manual: List<ManualFlag>, today: String, home: HomePlace?): Footprints =
        dec(Footprints.serializer(), call(
            "footprints",
            enc(ListSerializer(Trip.serializer()), trips),
            enc(ListSerializer(ManualFlag.serializer()), manual),
            str(today),
            home?.let { enc(HomePlace.serializer(), it) } ?: JsonNull,
        ))

    suspend fun searchPlaces(q: String, limit: Int = 8): List<Place> =
        dec(ListSerializer(Place.serializer()), call("searchPlaces", str(q), JsonPrimitive(limit)))

    /** 坐标 → 最近的地名（maxKm 以内，默认 80）；点地球放家、补旗、用当前位置时起名 */
    suspend fun nearest(lat: Double, lng: Double, maxKm: Double? = null): Place? {
        val r = call("nearest", JsonPrimitive(lat), JsonPrimitive(lng), maxKm?.let { JsonPrimitive(it) } ?: JsonNull)
        return if (r is JsonNull) null else dec(Place.serializer(), r)
    }

    /** 天色（day / dusk / night）：外观设置、系统深浅、此刻、家的位置——和网页、iOS 同一套（shared/world/daylight.ts） */
    suspend fun skyPhase(appearance: String, systemDark: Boolean, nowIso: String, home: HomePlace?): String {
        val r = call("skyPhase", str(appearance), JsonPrimitive(systemDark), str(nowIso), home?.let { enc(HomePlace.serializer(), it) } ?: JsonNull)
        return (r as? JsonPrimitive)?.content ?: if (systemDark) "night" else "day"
    }

    /** 站点的景点类型与本地化的名字 */
    suspend fun kindInfo(entry: PlaceEntry): KindInfo = dec(KindInfo.serializer(), call("kindInfo", enc(PlaceEntry.serializer(), entry)))

    suspend fun locate(name: String): Place? {
        val r = call("locate", str(name))
        return if (r is JsonNull) null else dec(Place.serializer(), r)
    }

    /** 离线规划一轮（与网页、服务端同一套规则） */
    suspend fun plan(messages: List<PlannerMessage>, today: String, home: HomePlace?, trips: List<Trip>): PlanResult {
        val req = buildJsonObject {
            put("messages", enc(ListSerializer(PlannerMessage.serializer()), messages))
            put("context", buildJsonObject {
                put("today", today)
                put("locale", locale())
                if (home != null) put("home", enc(HomePlace.serializer(), home))
                put("trips", buildJsonArray {
                    trips.take(50).forEach { t -> add(buildJsonObject { put("title", t.title.take(80)); put("startDate", t.startDate); put("endDate", t.endDate) }) }
                })
            })
        }
        return dec(PlanResult.serializer(), call("plan", req))
    }

    /** 由目的地、日期、天数、主题生成一本书（planner/local.ts 的 buildTrip） */
    suspend fun buildTrip(place: Place, startDate: String, days: Int, theme: String, today: String, now: String): Trip {
        val input = buildJsonObject {
            put("destination", buildJsonObject { put("name", place.name); put("place", enc(Place.serializer(), place)) })
            put("startDate", startDate)
            put("days", days)
            put("theme", theme)
            put("locale", locale())
            put("today", today)
            put("now", now)
        }
        return dec(Trip.serializer(), call("buildTrip", input))
    }

    /** 名额：plan 是 "free" / "pro"（或 entitlement 对象） */
    suspend fun quota(plan: String, trips: List<Trip>, today: String): Quota =
        dec(Quota.serializer(), call("quota", str(plan), enc(ListSerializer(Trip.serializer()), trips.map { it.lite() }), str(today)))

    /** 本月还剩几次 AI 规划（plan 是 "free" / "pro"）；付费墙拿它显示免费版 / Pro 的次数 */
    suspend fun aiPlansLeft(plan: String, usedThisMonth: Int): Int =
        dec(Int.serializer(), call("aiPlansLeft", str(plan), JsonPrimitive(usedThisMonth)))

    /** 导航链接：app 是 apple / google / amap / baidu；mode 是到这一站的交通方式（可空） */
    suspend fun mapLink(app: String, name: String, lat: Double, lng: Double, mode: String?): String =
        dec(String.serializer(), call(
            "mapLink", str(app),
            buildJsonObject { put("name", name); put("lat", lat); put("lng", lng) },
            mode?.let { str(it) } ?: JsonNull,
        ))

    /** 任意旧版本的行程 JSON → 当前版本 */
    suspend fun migrate(raw: JsonElement): Trip = dec(Trip.serializer(), call("migrate", raw))

    /** 校验：返回问题列表（空 = 通过） */
    suspend fun validate(trip: JsonElement): List<String> = dec(ListSerializer(String.serializer()), call("validate", trip))
}

/** 只留日期、状态、天数（站点清空）：journey / quota 用 */
fun Trip.lite(): Trip = copy(days = days.map { it.copy(entries = emptyList(), diary = null) }, suitcase = null)
