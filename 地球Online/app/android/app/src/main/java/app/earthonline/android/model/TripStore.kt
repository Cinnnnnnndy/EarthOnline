package app.earthonline.android.model

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.time.Instant

/** 落盘的全部状态（filesDir/state.json）。以后加字段一律可空或带默认值，旧文件照样读得进来。 */
@Serializable
data class PersistedState(
    val trips: List<Trip> = emptyList(),
    val avatar: Avatar? = null,
    val settings: Settings? = null,
    val home: HomePlace? = null,
    val pins: List<ManualFlag> = emptyList(),
    /** 已经播过插旗动画的足迹 */
    val planted: List<String> = emptyList(),
)

/**
 * 本机存储：一个 JSON 文件，改完立即更新 StateFlow，写盘去抖 0.3 秒，写临时文件再原子改名。
 * 一本书坏了不连累其他书：trips 逐本解码。第一次启动（文件不存在）isFirstLaunch = true，由 AppModel 在世界层就绪后装示例行程。
 * 所有修改都走这里的方法；在主线程调。
 */
class TripStore(context: Context, private val scope: CoroutineScope) {
    private val file = File(context.filesDir, "state.json")
    private val writeLock = Mutex()
    private var saveJob: Job? = null

    /** 第一次启动：还没有存档 */
    val isFirstLaunch: Boolean = !file.exists()

    private val _state = MutableStateFlow(load())
    val state: StateFlow<PersistedState> = _state.asStateFlow()

    val trips: List<Trip> get() = _state.value.trips
    fun trip(id: String): Trip? = _state.value.trips.firstOrNull { it.id == id }

    // ---------------------------------------------------------------- 读写盘

    private fun load(): PersistedState {
        if (!file.exists()) return PersistedState()
        return try {
            val root = Json.parseToJsonElement(file.readText(Charsets.UTF_8)).jsonObject
            val trips = (root["trips"] as? JsonArray).orEmpty().mapNotNull { el ->
                runCatching { EoJson.decodeFromJsonElement(Trip.serializer(), el) }
                    .onFailure { Log.w(TAG, "skip a broken trip: ${it.message}") }
                    .getOrNull()
            }
            val rest = JsonObject(root.filterKeys { it != "trips" })
            EoJson.decodeFromJsonElement(PersistedState.serializer(), rest).copy(trips = trips)
        } catch (e: Exception) {
            Log.w(TAG, "state.json unreadable, starting empty", e)
            PersistedState()
        }
    }

    private fun scheduleSave() {
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(300)
            write(_state.value)
        }
    }

    /** 立即写盘（回到后台时调） */
    fun flush() {
        saveJob?.cancel()
        val snapshot = _state.value
        scope.launch { withContext(NonCancellable) { write(snapshot) } }
    }

    private suspend fun write(s: PersistedState) {
        withContext(Dispatchers.IO) {
            writeLock.withLock {
                try {
                    val tmp = File(file.parentFile, file.name + ".tmp")
                    tmp.writeText(EoJson.encodeToString(PersistedState.serializer(), s), Charsets.UTF_8)
                    Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
                } catch (e: Exception) {
                    Log.e(TAG, "save failed", e)
                }
            }
        }
    }

    private fun mutate(body: (PersistedState) -> PersistedState) {
        _state.update(body)
        scheduleSave()
    }

    private fun now(): String = Instant.now().toString()

    // ---------------------------------------------------------------- 书

    /** 加一本（id 撞了就加后缀），插到最前；返回实际存下的那本 */
    fun insert(trip: Trip): Trip {
        var t = trip
        if (_state.value.trips.any { it.id == t.id }) t = t.copy(id = t.id + "-" + System.currentTimeMillis().toString(36))
        mutate { it.copy(trips = listOf(t) + it.trips) }
        return t
    }

    fun replaceAllTrips(trips: List<Trip>) = mutate { it.copy(trips = trips) }

    fun delete(id: String) = mutate { it.copy(trips = it.trips.filterNot { t -> t.id == id }) }

    /** 改一本书；改过就记 updatedAt */
    fun updateTrip(id: String, body: (Trip) -> Trip) = mutate { s ->
        s.copy(trips = s.trips.map { t -> if (t.id == id) body(t).copy(updatedAt = now()) else t })
    }

    private fun updateDay(tripId: String, dayIndex: Int, body: (Day) -> Day) = updateTrip(tripId) { t ->
        if (dayIndex !in t.days.indices) t else t.copy(days = t.days.mapIndexed { i, d -> if (i == dayIndex) body(d) else d })
    }

    private fun updatePlace(tripId: String, dayIndex: Int, entryId: String, body: (PlaceEntry) -> PlaceEntry) = updateDay(tripId, dayIndex) { d ->
        d.copy(entries = d.entries.map { e -> if (e is PlaceEntry && e.id == entryId) body(e) else e })
    }

    fun setStatus(tripId: String, status: String) = updateTrip(tripId) { it.copy(status = status) }

    /** 日记：null = 换回自动生成的 */
    fun setDiary(tripId: String, dayIndex: Int, text: String?) = updateDay(tripId, dayIndex) { it.copy(diary = text) }

    fun setVisited(tripId: String, dayIndex: Int, entryId: String, visited: Boolean) = updatePlace(tripId, dayIndex, entryId) {
        it.copy(visited = if (visited) true else null, visitedAt = if (visited) now() else null)
    }

    /** 备注：空字符串当作没有 */
    fun setNotes(tripId: String, dayIndex: Int, entryId: String, notes: String?) = updatePlace(tripId, dayIndex, entryId) {
        it.copy(notes = notes?.takeIf { n -> n.isNotEmpty() })
    }

    fun addTodo(tripId: String, dayIndex: Int, entryId: String, text: String, due: String?) = updatePlace(tripId, dayIndex, entryId) { p ->
        val list = p.todos.orEmpty()
        p.copy(todos = list + Todo(id = "td-${System.currentTimeMillis() / 1000}-${list.size}", text = text, due = due))
    }

    fun setTodoDone(tripId: String, dayIndex: Int, entryId: String, todoId: String, done: Boolean) = updatePlace(tripId, dayIndex, entryId) { p ->
        p.copy(todos = p.todos?.map { if (it.id == todoId) it.copy(done = if (done) true else null) else it })
    }

    fun removeTodo(tripId: String, dayIndex: Int, entryId: String, todoId: String) = updatePlace(tripId, dayIndex, entryId) { p ->
        p.copy(todos = p.todos?.filterNot { it.id == todoId }?.takeIf { it.isNotEmpty() })
    }

    /** 行李箱的增减：全空时整个拿掉 */
    fun setSuitcaseEdits(tripId: String, edits: CaseEdits?) = updateTrip(tripId) { t ->
        t.copy(suitcase = edits?.takeIf { !it.isEmpty })
    }

    // ---------------------------------------------------------------- 小人、设置、家与足迹

    fun setAvatar(a: Avatar) = mutate { it.copy(avatar = a) }
    fun setSettings(s: Settings) = mutate { it.copy(settings = s) }
    fun setHome(h: HomePlace?) = mutate { it.copy(home = h) }

    fun addPin(name: String, lat: Double, lng: Double): ManualFlag {
        val f = ManualFlag(id = "pin-" + System.currentTimeMillis().toString(36), name = name, lat = lat, lng = lng, date = Instant.now().toString().take(10))
        mutate { it.copy(pins = it.pins + f) }
        return f
    }

    fun removePin(id: String) = mutate { it.copy(pins = it.pins.filterNot { p -> p.id == id }) }

    fun markPlanted(ids: List<String>) {
        if (ids.isEmpty()) return
        mutate { it.copy(planted = (it.planted + ids).distinct()) }
    }

    companion object {
        private const val TAG = "TripStore"
        /** 解码一份任意来源的 JSON（导入、示例）：已经是 0.3 的直接读 */
        fun decodeTrip(el: JsonElement): Trip = EoJson.decodeFromJsonElement(Trip.serializer(), el)
    }
}
