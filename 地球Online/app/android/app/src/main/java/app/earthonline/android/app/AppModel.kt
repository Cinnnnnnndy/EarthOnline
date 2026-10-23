package app.earthonline.android.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.earthonline.android.gen.Shared
import app.earthonline.android.i18n.I18n
import app.earthonline.android.layout.LayoutSnapshot
import app.earthonline.android.layout.WorldInsets
import app.earthonline.android.layout.worldInsets
import app.earthonline.android.model.Avatar
import app.earthonline.android.model.CoreApi
import app.earthonline.android.model.EoJson
import app.earthonline.android.model.Footprints
import app.earthonline.android.model.HomePlace
import app.earthonline.android.model.Journey
import app.earthonline.android.model.Settings
import app.earthonline.android.model.Trip
import app.earthonline.android.model.TripStore
import app.earthonline.android.model.daySignature
import app.earthonline.android.world.SegmentDp
import app.earthonline.android.world.WorldController
import app.earthonline.android.world.WorldEvent
import app.earthonline.android.world.WorldMessages
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.time.Instant
import java.time.LocalDate
import java.util.TimeZone

/** 地球上的三种「舞台」：首页 → 一本书 → 某一天（潜入微缩世界）。世界层常驻，舞台切换只换模式和相机。 */
sealed interface Stage {
    data object Home : Stage
    data class Book(val id: String) : Stage
    data class Day(val id: String, val index: Int) : Stage
}

/** 压栈的整页（不显示地球的列表页） */
sealed interface Page {
    data object Settings : Page
    data class Diary(val id: String) : Page
    data object Footprints : Page
    data object Shelf : Page
    data object Avatar : Page
}

enum class NewTripTab { VOICE, DESTINATION, IMPORT }

/** 弹层 */
sealed interface Sheet {
    data class NewTrip(val tab: NewTripTab) : Sheet
    /** reason：trips / ai / sync / export / pack.landmarks / pack.outfits（i18n 的 pay.reason.*） */
    data class Paywall(val reason: String) : Sheet
    data class Stop(val tripId: String, val day: Int, val entryId: String) : Sheet
}

/** 在地球上点选的用途 */
enum class PickPurpose { HOME, PIN }

/** 示例行程库（web/public/assets/samples/trips/index.json） */
@Serializable
data class SampleRef(val id: String, val file: String, val title: String, val type: String = "", val blurb: String = "")

/**
 * 应用的协调者（iOS AppModel 的移植）：舞台与导航、弹层、提示、与世界层的同步。
 *  - 书、家、足迹、色调有变化时推给世界层（去抖 0.4 秒）；某一天的条目「形状」变了才让世界层重建底板，打卡只发 mark-visited；
 *  - 首页的旅程状态、足迹、规划、统计……都经 core-call 调 shared/core.ts，不在 Kotlin 里重写算法；
 *  - 界面状态用 Compose 的 snapshot state（在主线程改），存储用 TripStore 的 StateFlow。
 */
@OptIn(FlowPreview::class)
class AppModel(application: Application) : AndroidViewModel(application) {
    private val app = application

    val world = WorldController(app)
    val store = TripStore(app, viewModelScope)

    var i18n: I18n by mutableStateOf(I18n.load(app, I18n.resolve(store.state.value.settings?.lang)))
        private set
    val core = CoreApi(world) { i18n.locale }

    var stage: Stage by mutableStateOf(Stage.Home)
        private set
    val pages = mutableStateListOf<Page>()
    var sheet: Sheet? by mutableStateOf(null)
    /** 书页里选中的那一天（地球上点了某一天也会设置它） */
    var bookDay: Int? by mutableStateOf(null)
        private set
    var picking: PickPurpose? by mutableStateOf(null)
        private set
    var toast: String? by mutableStateOf(null)
        private set
    /** 今天（每分钟看一次） */
    var today: String by mutableStateOf(todayIso())
        private set
    /** 首页的旅程状态（core journey；世界层就绪前是 null） */
    var journey: Journey? by mutableStateOf(null)
        private set
    var footprints: Footprints? by mutableStateOf(null)
        private set
    /** 某一天的世界里：小人到过的最后一站、今天走完了没有、在不在走、俯视 */
    var heroStop: Int? by mutableStateOf(null)
    var dayFinished: Boolean by mutableStateOf(false)
    var playing: Boolean by mutableStateOf(true)
    var topView: Boolean by mutableStateOf(false)

    /** 付费方案：Play 结算还没接（TODO），一律按免费版；名额由 core quota 判断 */
    val plan: String = "free"

    private var lastDaySignature: String? = null
    private var toastJob: Job? = null
    private var focusKey: String? = null
    private var seeding = false
    private var lastLayout: LayoutSnapshot? = null
    private var obstruction = 0.0
    private val insets = MutableStateFlow<WorldInsets?>(null)

    val avatar: Avatar get() = store.state.value.avatar ?: Avatar.default(i18n.t("avatar.defaultName"))
    val settings: Settings get() = store.state.value.settings ?: Settings.DEFAULT

    init {
        world.start(i18n.locale)
        viewModelScope.launch { world.events.collect { handle(it) } }
        viewModelScope.launch { world.ready.filter { it }.collect { onWorldReady() } }
        // 书、家、足迹、设置有变化：去抖后推给世界层，并重算首页的旅程状态
        viewModelScope.launch {
            store.state.drop(1).debounce(400).collect {
                pushWorldState()
                refreshJourney()
            }
        }
        // 每分钟走一次的钟（今天变了就重算）
        viewModelScope.launch {
            while (true) {
                delay(60_000)
                val t = todayIso()
                if (t != today) { today = t; pushWorldState(); refreshJourney() }
            }
        }
        // 留白：抽屉拖动时会连着变，去抖再发
        viewModelScope.launch {
            insets.filterNotNull().distinctUntilChanged().debounce(80).collect { i ->
                world.send(WorldMessages.setInsets(left = i.left, bottom = i.bottom, top = i.top, right = i.right))
            }
        }
        pushWorldState()
        enterStage(Stage.Home, animate = false)
    }

    override fun onCleared() {
        store.flush()
        world.destroy()
    }

    // ---------------------------------------------------------------- 舞台

    fun goHome() {
        bookDay = null
        pages.clear()
        enterStage(Stage.Home, animate = true)
    }

    fun openBook(id: String, day: Int? = null) {
        if (store.trip(id) == null) return
        pages.clear()
        bookDay = day
        enterStage(Stage.Book(id), animate = true)
    }

    fun openDay(id: String, index: Int) {
        val t = store.trip(id) ?: return
        if (index !in t.days.indices) return
        pages.clear()
        enterStage(Stage.Day(id, index), animate = true)
    }

    fun openDiary(id: String) {
        pages.clear()
        pages.add(Page.Diary(id))
    }

    fun show(page: Page) { pages.add(page) }

    fun selectBookDay(day: Int?) {
        val s = stage as? Stage.Book ?: return
        bookDay = day
        if (day != null) world.send(WorldMessages.focusDay(s.id, day, animate = true))
        else world.send(WorldMessages.focusBook(s.id, animate = true))
    }

    private fun enterStage(s: Stage, animate: Boolean) {
        stage = s
        when (s) {
            Stage.Home -> {
                world.send(WorldMessages.showGlobe())
                focusKey = null
                focusHome(animate)
            }
            is Stage.Book -> {
                world.send(WorldMessages.showGlobe())
                val d = bookDay
                if (d != null) world.send(WorldMessages.focusDay(s.id, d, animate)) else world.send(WorldMessages.focusBook(s.id, animate))
            }
            is Stage.Day -> {
                val t = store.trip(s.id) ?: return
                heroStop = null
                dayFinished = false
                playing = true
                topView = false
                lastDaySignature = daySignature(t.days[s.index])
                world.send(WorldMessages.setAvatar(avatar))
                world.send(WorldMessages.setPost(settings.post))
                world.send(WorldMessages.showDay(t, s.index))
                world.send(WorldMessages.setView(pitch = 30, follow = true))
                world.send(WorldMessages.play())
            }
        }
    }

    /** 首页相机：有「现在」的书（旅行中 / 快出发 / 刚回来）就聚焦它，平常日子回到家 */
    private fun focusHome(animate: Boolean) {
        val j = journey
        val id = j?.tripId?.takeIf { j.kind != Journey.IDLE }
        val key = id ?: "home"
        if (key == focusKey) return
        focusKey = key
        if (id != null) {
            world.send(WorldMessages.focusBook(id, animate))
        } else {
            val (lat, lng) = homePoint()
            world.send(WorldMessages.focusHome(lat, lng, animate))
        }
    }

    /** 家；没设家时：时区推出的经度、纬度 30°（shared/world/daylight.ts 的 guessPlace） */
    fun homePoint(): Pair<Double, Double> {
        store.state.value.home?.let { return it.lat to it.lng }
        val offsetMin = TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60_000.0
        return 30.0 to offsetMin / 4
    }

    /** 返回键：先关弹层、取消点选、退整页，再一级一级退舞台；首页返回 false（交给系统） */
    fun back(): Boolean {
        when {
            sheet != null -> sheet = null
            picking != null -> cancelPick()
            pages.isNotEmpty() -> pages.removeAt(pages.lastIndex)
            else -> when (val s = stage) {
                is Stage.Day -> openBook(s.id, s.index)
                is Stage.Book -> if (bookDay != null) selectBookDay(null) else goHome()
                Stage.Home -> return false
            }
        }
        return true
    }

    val canGoBack: Boolean get() = sheet != null || picking != null || pages.isNotEmpty() || stage != Stage.Home

    // ---------------------------------------------------------------- 世界层同步

    private fun onWorldReady() {
        refreshJourney()
        if (store.isFirstLaunch && !seeding && store.trips.isEmpty()) {
            seeding = true
            viewModelScope.launch {
                val trips = loadSamples(Shared.STARTER_SAMPLES)   // 第一次启动只装两本（shared/spec/samples.ts），其余在设置 → 示例行程里加
                if (store.trips.isEmpty() && trips.isNotEmpty()) store.replaceAllTrips(trips)
            }
        }
    }

    /** 书、家、足迹、色调、画质、小人 → 世界层；某一天的形状变了才重建底板 */
    fun pushWorldState() {
        val s = store.state.value
        world.send(WorldMessages.setPalette(settings.palette))
        world.send(WorldMessages.setPost(settings.post))
        world.send(WorldMessages.setAvatar(avatar))
        world.send(WorldMessages.setTrips(s.trips, today))
        world.send(WorldMessages.setHome(s.home))
        refreshFootprints()
        val st = stage
        if (st is Stage.Day) {
            val t = store.trip(st.id)
            if (t != null && st.index in t.days.indices) {
                val sig = daySignature(t.days[st.index])
                if (sig != lastDaySignature) {
                    lastDaySignature = sig
                    world.send(WorldMessages.showDay(t, st.index))
                }
            }
        }
    }

    private fun refreshJourney() {
        viewModelScope.launch {
            journey = runCatching { core.journey(store.trips, today) }.getOrNull()
            if (stage == Stage.Home) focusHome(animate = true)
        }
    }

    private fun refreshFootprints() {
        viewModelScope.launch {
            val s = store.state.value
            val fp = runCatching { core.footprints(s.trips, s.pins, today, s.home) }.getOrNull() ?: return@launch
            footprints = fp
            val planted = s.planted.toSet()
            world.send(WorldMessages.setFootprints(
                fp.flags.map { WorldMessages.Flag(it.id, it.name, it.lat, it.lng) },
                fresh = fp.flags.map { it.id }.filterNot { it in planted },
            ))
        }
    }

    private fun handle(e: WorldEvent) {
        when (e.kind) {
            // 某一天的底板（重新）建好了：小人从头走，「下一站」与「走完了」跟着复位。只是普通事件，不重放状态（重放只认页面级的 ready）
            "plate-loaded" -> if (stage is Stage.Day) { heroStop = null; dayFinished = false }
            "hero-arrived" -> heroStop = e.int("stopIndex")
            "day-finished" -> dayFinished = true
            "book-tapped" -> if (stage !is Stage.Day) openBook(e.str("id"))
            "day-tapped" -> {
                val id = e.str("id")
                val d = e.int("dayIndex")
                val s = stage
                if (s is Stage.Book && s.id == id) selectBookDay(d) else if (s !is Stage.Day) openBook(id, d)
            }
            "point-picked" -> finishPick(e.dbl("lat"), e.dbl("lng"))
            "flags-planted" -> {
                val ids = e.strings("ids")
                store.markPlanted(ids)
                if (stage == Stage.Home && ids.isNotEmpty()) showToast(i18n.t("home.planted", "n" to ids.size))
            }
        }
    }

    /** 屏幕形态变了：发 set-layout；两页 / 三页 / 悬停的留白直接按 worldInsets 算 */
    fun onLayout(l: LayoutSnapshot) {
        if (l == lastLayout) return
        lastLayout = l
        world.send(WorldMessages.setLayout(
            l.state.wire, l.widthDp, l.heightDp,
            l.segments?.map { SegmentDp(it.x, it.y, it.w, it.h) },
            l.posture.wire,
        ))
        updateInsets()
    }

    /** 一页（phone / outer）时底部被抽屉、票、胶囊挡住的高度（dp） */
    fun onObstruction(bottomDp: Double) {
        obstruction = Math.round(bottomDp).toDouble()
        updateInsets()
    }

    private fun updateInsets() {
        val l = lastLayout ?: return
        insets.value = if (l.state.compact) WorldInsets(left = 0.0, right = 0.0, top = 0.0, bottom = obstruction)
        else worldInsets(l.layout)
    }

    /** 地球外与某一天的天色：按 core 的 skyPhase（外观设置、系统深浅、此刻、家的位置）发 day / dusk / night；
     *  外观或系统深浅变了马上算一次，之后每 10 分钟再算（晨昏是慢慢过去的）。core 还没就绪时先按深浅给 day / night */
    private var skyArgs: Pair<String, Boolean>? = null
    private var skyTicker: Job? = null
    fun refreshSky(appearance: String, systemDark: Boolean) {
        skyArgs = appearance to systemDark
        world.send(WorldMessages.setSky(if (appearance == "dark" || (appearance == "auto" && systemDark)) "night" else "day"))
        viewModelScope.launch { sendSkyPhase() }
        if (skyTicker == null) skyTicker = viewModelScope.launch { while (true) { delay(10 * 60_000L); sendSkyPhase() } }
    }
    private suspend fun sendSkyPhase() {
        val (appearance, dark) = skyArgs ?: return
        val phase = runCatching { core.skyPhase(appearance, dark, java.time.Instant.now().toString(), store.state.value.home) }.getOrNull() ?: return
        world.send(WorldMessages.setSky(phase))
    }

    fun setForeground(on: Boolean) {
        world.setForeground(on)
        if (!on) store.flush()
    }

    // ---------------------------------------------------------------- 设置、小人

    fun updateSettings(s: Settings) {
        val old = settings
        store.setSettings(s)
        if (s.palette != old.palette) world.send(WorldMessages.setPalette(s.palette))
        if (s.post != old.post) world.send(WorldMessages.setPost(s.post))
        if (s.lang != old.lang) {
            i18n = I18n.load(app, I18n.resolve(s.lang))
            world.setLocale(i18n.locale)
        }
    }

    fun updateAvatar(a: Avatar) {
        store.setAvatar(a)
        world.send(WorldMessages.setAvatar(a))
    }

    // ---------------------------------------------------------------- 打卡、点选

    fun setVisited(tripId: String, day: Int, entryId: String, visited: Boolean) {
        store.setVisited(tripId, day, entryId, visited)
        world.send(WorldMessages.markVisited(entryId, visited))
        showToast(i18n.t(if (visited) "day.checkedInToast" else "day.uncheckedToast"))
    }

    fun startPick(p: PickPurpose) {
        pages.clear()
        sheet = null
        if (stage is Stage.Day) enterStage(Stage.Home, animate = true)
        picking = p
        onObstruction(0.0)   // 点选时界面收起，地球居中
        world.send(WorldMessages.pickPoint(true))
    }

    fun cancelPick() {
        picking = null
        world.send(WorldMessages.pickPoint(false))
    }

    private fun finishPick(lat: Double, lng: Double) {
        val p = picking ?: return
        picking = null
        world.send(WorldMessages.pickPoint(false))
        world.send(WorldMessages.flyTo(lat - 6, lng, 1.3))
        viewModelScope.launch {
            // 起名：最近的地名（core nearest，地名表）；家找不到就叫「我的家」，旗找不到就写经纬度
            when (p) {
                PickPurpose.HOME -> setHomeAt(lat, lng)
                PickPurpose.PIN -> {
                    val name = runCatching { core.nearest(lat, lng, 60.0) }.getOrNull()?.name ?: i18n.latLng(lat, lng)
                    store.addPin(name, lat, lng)
                    showToast(i18n.t("fp.added", "name" to name))
                }
            }
        }
    }

    /** 把家放在这个坐标（点地球、用当前位置）：名字取最近的城市 */
    suspend fun setHomeAt(lat: Double, lng: Double) {
        val name = runCatching { core.nearest(lat, lng) }.getOrNull()?.name ?: i18n.t("fp.myHome")
        store.setHome(HomePlace(name, lat, lng))
        showToast(i18n.t("fp.homeSet", "name" to name))
    }

    // ---------------------------------------------------------------- 新建、导入、付费墙

    fun requestPaywall(reason: String) { sheet = Sheet.Paywall(reason) }

    /** 加入新书；免费版名额满了就停下（调用方弹付费墙）。每本都占名额（示例也占，和网页一致；第一次启动只装两本，见 Shared.STARTER_SAMPLES） */
    suspend fun addTrips(trips: List<Trip>): List<Trip> {
        val added = ArrayList<Trip>()
        for (t in trips) {
            val q = runCatching { core.quota(plan, store.trips, today) }.getOrNull()
            if (q != null && !q.canCreate) break
            added += store.insert(t)
        }
        return added
    }

    /** 新建或导入完成：关面板、翻开第一本；没加全的弹付费墙 */
    suspend fun createTrips(trips: List<Trip>) {
        if (trips.isEmpty()) return
        val added = addTrips(trips)
        if (added.isEmpty()) { requestPaywall("trips"); return }
        sheet = null
        if (added.size > 1) showToast(i18n.t("new.imported", "n" to added.size))
        openBook(added.first().id)
        if (added.size < trips.size) requestPaywall("trips")
    }

    /** 导入一段文字：JSON（本应用 / 网页版导出的，一本或多本）或行程页 HTML（交给世界层的导入器）。返回错误文字，成功返回 null */
    suspend fun importText(raw: String): String? {
        val text = raw.trim()
        if (text.isEmpty()) return i18n.t("new.needInput")
        val items: List<JsonElement> = if (text.startsWith("{") || text.startsWith("[")) {
            val el = runCatching { Json.parseToJsonElement(text) }.getOrNull() ?: return i18n.t("common.importInvalid")
            when {
                el is JsonArray -> el.toList()
                el is JsonObject && el["trips"] is JsonArray -> (el["trips"] as JsonArray).toList()
                else -> listOf(el)
            }
        } else {
            val r = world.importPage(text) ?: return i18n.t("common.importFailed", "reason" to "timeout")
            if (r.error != null) return i18n.t("common.importFailed", "reason" to r.error)
            if (r.trips.isEmpty()) return i18n.t("import.noRoutes")
            r.trips
        }
        val trips = items.mapNotNull { runCatching { core.migrate(it) }.getOrNull() }
        if (trips.isEmpty()) return i18n.t("common.importInvalid")
        createTrips(trips)
        return null
    }

    // ---------------------------------------------------------------- 示例行程

    suspend fun sampleIndex(): List<SampleRef> = withContext(Dispatchers.IO) {
        runCatching {
            val text = app.assets.open("world/assets/samples/trips/index.json").bufferedReader().use { it.readText() }
            EoJson.decodeFromString(ListSerializer(SampleRef.serializer()), text)
        }.getOrDefault(emptyList())
    }

    /** 读一本示例（原始 JSON，经 core migrate 迁到当前版本） */
    suspend fun loadSample(ref: SampleRef): Trip? {
        val raw = withContext(Dispatchers.IO) {
            runCatching { app.assets.open("world/assets/samples/trips/" + ref.file).bufferedReader().use { it.readText() } }.getOrNull()
        } ?: return null
        val el = runCatching { Json.parseToJsonElement(raw).jsonObject }.getOrNull() ?: return null
        return runCatching { core.migrate(el) }.getOrNull()
    }

    private suspend fun loadSamples(only: List<String>? = null): List<Trip> = sampleIndex().filter { only == null || it.id in only }.mapNotNull { loadSample(it) }

    suspend fun addSample(ref: SampleRef) {
        if (store.trip(ref.id) != null) return
        val t = loadSample(ref) ?: return
        store.insert(t)
        showToast(i18n.t("settings.sampleAdded"))
    }

    suspend fun resetToSamples() {
        val trips = loadSamples()
        if (trips.isEmpty()) return
        store.replaceAllTrips(trips)
        showToast(i18n.t("settings.resetDone"))
        goHome()
    }

    /** 全部旅程的 JSON（设置里「导出全部旅程」） */
    fun allTripsJson(): String = EoJson.encodeToString(ListSerializer(Trip.serializer()), store.trips)

    fun tripJson(id: String): String? = store.trip(id)?.let { EoJson.encodeToString(Trip.serializer(), it) }

    // ---------------------------------------------------------------- 提示

    fun showToast(text: String) {
        toast = text
        toastJob?.cancel()
        toastJob = viewModelScope.launch {
            delay(2600)
            toast = null
        }
    }

    companion object {
        fun todayIso(): String = LocalDate.now().toString()
        fun nowIso(): String = Instant.now().toString()
    }
}
