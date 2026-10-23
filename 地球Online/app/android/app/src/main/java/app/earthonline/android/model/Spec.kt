package app.earthonline.android.model

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * 数据契约 0.3（shared/spec/types.ts + trip.schema.json）的 Kotlin 版。
 * 规则：schema 里必填的字段不给默认值（编码时一定写出来）；可选字段一律可空、默认 null（编码时省略）。
 * 这样配合 EoJson（encodeDefaults = false、explicitNulls = false、ignoreUnknownKeys）读进来再写出去不会凭空多出字段。
 * 枚举类的字段（status、category、mode……）存字符串：新版本多一个值时旧客户端照样读得进来；取值见各 object 的常量。
 */

@OptIn(ExperimentalSerializationApi::class)
val EoJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = false
    classDiscriminator = "type"   // Entry 按 type 区分 place / transport / lodging
}

const val SCHEMA_VERSION = "0.3"

object TripStatus { const val PLANNING = "planning"; const val TRAVELING = "traveling"; const val CLOSED = "closed" }
object PlaceCategory { val ALL = listOf("sight", "food", "shop", "station", "airport", "port", "hotel", "other") }
object TransportMode { val ALL = listOf("walk", "rail", "subway", "bus", "ship", "taxi", "car", "flight") }

@Serializable
data class Geo(val lat: Double, val lng: Double)

/** 一件待办：文字、该做完的日期（没有就按出发日）、做完了没有 */
@Serializable
data class Todo(val id: String, val text: String, val due: String? = null, val done: Boolean? = null)

@Serializable
sealed class Entry {
    abstract val id: String
}

@Serializable
@SerialName("place")
data class PlaceEntry(
    override val id: String,
    val name: String,
    val category: String,
    /** 计划到达 "HH:MM" */
    val plannedStart: String? = null,
    val stayMinutes: Int? = null,
    val notes: String? = null,
    val visited: Boolean? = null,
    val visitedAt: String? = null,
    val geo: Geo? = null,
    val kind: String? = null,
    val todos: List<Todo>? = null,
) : Entry()

@Serializable
@SerialName("transport")
data class TransportEntry(
    override val id: String,
    val mode: String,
    val label: String,
    val durationMinutes: Int? = null,
    val distanceKm: Double? = null,
    /** 真实路线折线 [lat, lng][] */
    val polyline: List<List<Double>>? = null,
) : Entry()

@Serializable
@SerialName("lodging")
data class LodgingEntry(
    override val id: String,
    val name: String,
    val notes: String? = null,
) : Entry()

@Serializable
data class Day(
    val index: Int,
    val date: String,
    val title: String,
    /** rules/cities 里的城市 id，或 "geo" */
    val city: String,
    val entries: List<Entry>,
    val lodging: String? = null,
    val diary: String? = null,
    val color: String? = null,
) {
    val places: List<PlaceEntry> get() = entries.filterIsInstance<PlaceEntry>()
}

@Serializable
data class TripPlanRef(val group: String, val index: Int, val label: String)

@Serializable
data class CaseCard(val id: String, val kind: String, val w: Int, val h: Int, val label: String? = null)

/** 行李箱的增减：藏起来的、从库里挑的、自己挑的随身物件、照片卡 */
@Serializable
data class CaseEdits(
    val hidden: List<String>? = null,
    val picks: List<String>? = null,
    val gear: List<String>? = null,
    val cards: List<CaseCard>? = null,
) {
    val isEmpty: Boolean get() = hidden.isNullOrEmpty() && picks.isNullOrEmpty() && gear.isNullOrEmpty() && cards.isNullOrEmpty()
}

@Serializable
data class Trip(
    val schemaVersion: String,
    val id: String,
    val title: String,
    val destination: String,
    val startDate: String,
    val endDate: String,
    val theme: String,
    /** 世界生成种子（可能超过 Int 的范围） */
    val seed: Long,
    val status: String,
    val plan: TripPlanRef? = null,
    val days: List<Day>,
    val createdAt: String,
    val updatedAt: String,
    val suitcase: CaseEdits? = null,
) {
    /** 今天是这本书的第几天（下标）；不在旅程里返回 -1（与网页 globe-data.ts 的 todayIndex 一样按日期找） */
    fun todayIndex(today: String): Int = days.indexOfFirst { it.date == today }
}

/** 小人。字段全部必填（set-avatar 要整份发给世界层）；默认值见 DEFAULT（shared/world/hero.ts 的 DEFAULT_AVATAR） */
@Serializable
data class Avatar(
    val skin: Int,
    val hair: String,
    val hairColor: Int,
    val dress: Int,
    val hat: String,
    val hatColor: Int,
    val shoes: Int,
    val name: String,
    /** sand / ink / canvas / trunk；没写 = 沙色硬壳 */
    val suitcase: String? = null,
    /** human / fox / …（Shared.AVATAR_FORMS）；没写 = 小人 */
    val form: String? = null,
) {
    companion object {
        fun default(name: String) = Avatar(skin = 0, hair = "short", hairColor = 0, dress = 0, hat = "cap", hatColor = 0, shoes = 0, name = name)
    }
}

/** 应用设置（types.ts 的 Settings）：浮岛色调、画质、天色（auto / light / dark）、语言（缺省 = auto） */
@Serializable
data class Settings(
    val palette: String,
    val post: String,
    val theme: String,
    val lang: String? = null,
) {
    companion object { val DEFAULT = Settings(palette = "sea", post = "high", theme = "auto") }
}

@Serializable
data class HomePlace(val name: String, val lat: Double, val lng: Double)

/** 手动补的一面旗（shared/algo/footprints.ts 的 ManualFlag） */
@Serializable
data class ManualFlag(val id: String, val name: String, val lat: Double, val lng: Double, val date: String? = null)

/** 世界生成主题（types.ts 的 THEMES 是数据 id，显示名走 i18n 的 theme.*） */
object Themes {
    val KEYS: Map<String, String> = linkedMapOf(
        "红叶古都" to "theme.autumnTown", "极光冰原" to "theme.aurora", "海风港町" to "theme.harbor", "温泉雪国" to "theme.snowOnsen",
        "都市霓虹" to "theme.neon", "樱花春日" to "theme.sakura", "离岛夏日" to "theme.island",
    )
    val ALL: List<String> get() = KEYS.keys.toList()
}

/** 某一天的「形状」（条目、顺序、名字、坐标、城市）：只有形状变了才让世界层重建底板；打卡只发 mark-visited（与 iOS AppModel.signature 一致） */
fun daySignature(d: Day): String = d.entries.joinToString(";") { e ->
    when (e) {
        is PlaceEntry -> "p|${e.id}|${e.name}|${e.category}|${e.kind ?: ""}|${e.geo?.lat ?: 0.0},${e.geo?.lng ?: 0.0}|${e.plannedStart ?: ""}"
        is TransportEntry -> "t|${e.id}|${e.mode}|${e.label}|${e.durationMinutes ?: 0}|${e.polyline?.size ?: 0}"
        is LodgingEntry -> "l|${e.id}|${e.name}"
    }
} + "#" + d.city
