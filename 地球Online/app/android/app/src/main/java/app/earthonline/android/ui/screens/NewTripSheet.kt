package app.earthonline.android.ui.screens

import android.Manifest
import android.app.DatePickerDialog
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.NewTripTab
import app.earthonline.android.gen.Tokens
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Place
import app.earthonline.android.model.PlannerMessage
import app.earthonline.android.model.Themes
import app.earthonline.android.model.Trip
import app.earthonline.android.ui.components.EoTextField
import app.earthonline.android.ui.components.GlassCapsuleButton
import app.earthonline.android.ui.components.InkCapsuleButton
import app.earthonline.android.ui.components.ListRow
import app.earthonline.android.ui.components.PlainIconButton
import app.earthonline.android.ui.components.SectionHeader
import app.earthonline.android.ui.components.Segmented
import app.earthonline.android.ui.components.Tag
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.ui.theme.onInk
import app.earthonline.android.ui.components.Chip
import app.earthonline.android.world.WorldMessages
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

/** 新建旅程：说一句话（规划助手，core plan）/ 去一个地方（地名搜索 + core buildTrip）/ 导入（JSON 或行程页 HTML） */
@Composable
fun NewTripSheet(model: AppModel, state: PersistedState, initialTab: NewTripTab) {
    val i18n = LocalI18n.current
    var tab by remember(initialTab) { mutableStateOf(initialTab) }
    Segmented(
        listOf(NewTripTab.VOICE to i18n.t("voice.title"), NewTripTab.DESTINATION to i18n.t("new.tabDest"), NewTripTab.IMPORT to i18n.t("new.tabImport")),
        tab,
    ) { tab = it }
    when (tab) {
        NewTripTab.VOICE -> VoiceComposer(model, state)
        NewTripTab.DESTINATION -> DestinationForm(model)
        NewTripTab.IMPORT -> ImportPane(model)
    }
}

/** 一句对话气泡：用户的靠右（墨底），助手的靠左（浅填充） */
@Composable
private fun Bubble(text: String, mine: Boolean) {
    val p = LocalEo.current
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
        Text(
            text,
            style = EoType.body,
            color = if (mine) p.onInk else p.ink,
            modifier = Modifier
                .widthIn(max = 320.dp)
                .background(if (mine) p.ink else p.fill, RoundedCornerShape(Tokens.RadiusL))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        )
    }
}

/**
 * 说一句话：一小段对话，离线规划（core plan，与网页、服务端同一套规则）给出草稿后，看一眼再点「生成这本书」。
 * 语音（系统识别）只是输入方式之一，识别出的文字和打字走同一条路。
 */
@Composable
private fun VoiceComposer(model: AppModel, state: PersistedState) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf(listOf<PlannerMessage>()) }
    var draft by remember { mutableStateOf<Trip?>(null) }
    var typed by remember { mutableStateOf("") }
    var thinking by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<String?>(null) }
    var listening by remember { mutableStateOf(false) }
    var live by remember { mutableStateOf("") }

    fun send(raw: String) {
        val text = raw.trim()
        if (text.isEmpty() || thinking) return
        val next = messages + PlannerMessage("user", text)
        messages = next
        typed = ""
        live = ""
        note = null
        thinking = true
        scope.launch {
            val now = model.store.state.value   // 读最新的家与书（这个函数可能是语音回调里调的）
            val r = runCatching { model.core.plan(next, model.today, now.home, now.trips) }
            thinking = false
            r.onSuccess { res ->
                messages = messages + PlannerMessage("assistant", res.assistantText)
                if (res.draft != null) draft = res.draft
            }.onFailure { note = i18n.t("voice.error") }
        }
    }

    val voice = remember(i18n.speechTag) {
        VoiceInput(
            context.applicationContext, i18n.speechTag,
            onPartial = { live = it },
            onFinal = { send(it) },
            onFailure = { key -> note = i18n.t(key) },
            onListening = { listening = it },
        )
    }
    DisposableEffect(voice) { onDispose { voice.stop() } }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) voice.start() else note = i18n.t("voice.micDenied")
    }

    Bubble(i18n.t("voice.title") + "\n" + i18n.t("voice.hint"), mine = false)
    messages.forEach { m -> Bubble(m.text, mine = m.role == "user") }
    if (listening || live.isNotEmpty()) Bubble(live.ifEmpty { i18n.t("voice.listening") }, mine = true)
    if (thinking) Text(i18n.t("voice.thinking"), style = EoType.sub, color = p.mist)
    note?.let { Text(it, style = EoType.sub, color = p.mist) }
    draft?.let { d ->
        DraftCard(d, onChange = { draft = it }) { t -> scope.launch { model.createTrips(listOf(t)) } }
    }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        EoTextField(
            typed, { typed = it }, i18n.t("voice.placeholder"),
            modifier = Modifier.weight(1f), imeAction = ImeAction.Send, onSubmit = { send(typed) },
        )
        if (typed.isNotBlank()) PlainIconButton(Icons.AutoMirrored.Filled.Send, i18n.t("voice.send")) { send(typed) }
        if (voice.available) {
            PlainIconButton(Icons.Filled.Mic, i18n.t(if (listening) "voice.micStop" else "voice.micStart"), tint = if (listening) p.dawnInk else p.ink) {
                when {
                    listening -> voice.stopListening()
                    ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED -> voice.start()
                    else -> micPermission.launch(Manifest.permission.RECORD_AUDIO)
                }
            }
        }
    }
}

/** 规划器给出的草稿：书名可改、出发日期可挪（整本书的日期一起挪），看一眼每天的标题，点「生成这本书」 */
@Composable
private fun DraftCard(trip: Trip, onChange: (Trip) -> Unit, onCreate: (Trip) -> Unit) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    Column(
        Modifier
            .fillMaxWidth()
            .background(p.listStrong, RoundedCornerShape(Tokens.RadiusL))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        EoTextField(trip.title, { onChange(trip.copy(title = it.take(40))) }, i18n.t("new.bookTitle"), modifier = Modifier.fillMaxWidth())
        Text(
            i18n.list(listOf(i18n.plainNames(trip.destination), i18n.days(trip.days.size), i18n.themeName(trip.theme))),
            style = EoType.sub, color = p.mist,
        )
        ListRow(
            title = i18n.t("new.start"), icon = Icons.Filled.DateRange, trailing = i18n.fullDate(trip.startDate),
            onClick = { pickDate(context, trip.startDate) { onChange(shiftTrip(trip, it)) } },
        )
        trip.days.take(6).forEach { d ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Tag(i18n.dayTag(d.index))
                Text(i18n.plain(d.title), style = EoType.sub, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (d.places.isNotEmpty()) Text(i18n.stops(d.places.size), style = EoType.sub, color = p.mist)
            }
        }
        if (trip.days.size > 6) Text(i18n.t("voice.moreDays", "n" to trip.days.size - 6), style = EoType.sub, color = p.mist)
        InkCapsuleButton(i18n.t("voice.create"), modifier = Modifier.fillMaxWidth()) { onCreate(trip) }
    }
}

/** 整本书的日期一起挪到新的出发日 */
private fun shiftTrip(t: Trip, newStart: String): Trip {
    val shift = daysBetween(t.startDate, newStart)
    if (shift == 0L) return t
    fun add(iso: String) = runCatching { LocalDate.parse(iso.take(10)).plusDays(shift).toString() }.getOrDefault(iso)
    return t.copy(startDate = add(t.startDate), endDate = add(t.endDate), days = t.days.map { it.copy(date = add(it.date)) })
}

/** 系统的日期选择器（按钮文字由系统按手机语言给） */
private fun pickDate(context: android.content.Context, current: String, onPick: (String) -> Unit) {
    val d = runCatching { LocalDate.parse(current.take(10)) }.getOrDefault(LocalDate.now())
    DatePickerDialog(context, { _, y, m, day -> onPick(LocalDate.of(y, m + 1, day).toString()) }, d.year, d.monthValue - 1, d.dayOfMonth).show()
}

/** 去一个地方：搜地名（core searchPlaces，离线）、书名、出发日期、天数、主题 → core buildTrip */
@Composable
private fun DestinationForm(model: AppModel) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf(listOf<Place>()) }
    var place by remember { mutableStateOf<Place?>(null) }
    var title by remember { mutableStateOf("") }
    var start by remember { mutableStateOf(LocalDate.now().plusDays(30).toString()) }
    var days by remember { mutableIntStateOf(5) }
    var theme by remember { mutableStateOf(Themes.ALL.first()) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(query) {
        if (query.isBlank() || query == place?.name) { results = emptyList(); return@LaunchedEffect }
        delay(200)
        results = runCatching { model.core.searchPlaces(query, 5) }.getOrDefault(emptyList())
    }

    SectionHeader(i18n.t("new.destination"))
    EoTextField(query, { query = it; if (it != place?.name) place = null }, i18n.t("new.searchPlaceholder"), leading = Icons.Filled.Search, modifier = Modifier.fillMaxWidth())
    results.forEach { pl ->
        ListRow(title = pl.name, icon = Icons.Filled.Place, onClick = {
            place = pl
            query = pl.name
            results = emptyList()
            model.world.send(WorldMessages.flyTo(pl.lat - 4, pl.lng, 0.55))
        })
    }
    EoTextField(title, { title = it.take(40) }, i18n.t("new.titlePlaceholder"), modifier = Modifier.fillMaxWidth())
    ListRow(title = i18n.t("new.start"), icon = Icons.Filled.DateRange, trailing = i18n.fullDate(start), onClick = { pickDate(context, start) { start = it } })
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(i18n.t("new.days"), style = EoType.body, color = p.ink, modifier = Modifier.weight(1f))
        PlainIconButton(Icons.Filled.Remove, i18n.t("new.days"), enabled = days > 1) { days -= 1 }
        Text(i18n.days(days), style = EoType.title, color = p.ink)
        PlainIconButton(Icons.Filled.Add, i18n.t("new.days"), enabled = days < 21) { days += 1 }
    }
    SectionHeader(i18n.t("new.theme"))
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Themes.ALL.forEach { th -> Chip(i18n.themeName(th), selected = th == theme) { theme = th } }
    }
    Spacer(Modifier.padding(top = 4.dp))
    InkCapsuleButton(i18n.t("common.create"), modifier = Modifier.fillMaxWidth(), enabled = !busy) {
        val pl = place
        if (pl == null) { model.showToast(i18n.t("new.pickFirst")); return@InkCapsuleButton }
        busy = true
        scope.launch {
            val trip = runCatching { model.core.buildTrip(pl, start, days, theme, model.today, AppModel.nowIso()) }.getOrNull()
            busy = false
            if (trip != null) model.createTrips(listOf(if (title.isNotBlank()) trip.copy(title = title.trim()) else trip))
        }
    }
}

/** 导入：选文件（本应用 / 网页版导出的 JSON；行程页 HTML 交给世界层的导入器）或粘贴 */
@Composable
private fun ImportPane(model: AppModel) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pasted by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun doImport(text: String) {
        busy = true
        error = null
        scope.launch {
            error = model.importText(text)
            busy = false
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) scope.launch {
            val text = withContext(Dispatchers.IO) {
                runCatching { context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } }.getOrNull()
            }
            if (text == null) error = i18n.t("common.importInvalid") else doImport(text)
        }
    }

    Text(i18n.t("new.importHint"), style = EoType.sub, color = p.mist)
    GlassCapsuleButton(i18n.t("new.chooseFile"), icon = Icons.Filled.Description) {
        picker.launch(arrayOf("application/json", "text/html", "text/plain", "application/octet-stream"))
    }
    EoTextField(pasted, { pasted = it }, i18n.t("new.pastePlaceholder"), singleLine = false, minLines = 4, modifier = Modifier.fillMaxWidth())
    InkCapsuleButton(i18n.t("common.import"), modifier = Modifier.fillMaxWidth(), enabled = !busy && pasted.isNotBlank()) { doImport(pasted) }
    error?.let { Text(it, style = EoType.sub, color = p.danger) }
}
