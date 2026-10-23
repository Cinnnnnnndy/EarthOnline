package app.earthonline.android.ui.screens

import app.earthonline.android.gen.Shared
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.Sheet
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.Geo
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.PlaceEntry
import app.earthonline.android.model.Todo
import app.earthonline.android.model.TransportEntry
import app.earthonline.android.ui.components.EoTextField
import app.earthonline.android.ui.components.GlassCapsuleButton
import app.earthonline.android.ui.components.Hairline
import app.earthonline.android.ui.components.InkCapsuleButton
import app.earthonline.android.ui.components.ListRow
import app.earthonline.android.ui.components.PlainIconButton
import app.earthonline.android.ui.components.Segmented
import app.earthonline.android.ui.components.Tag
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import kotlinx.coroutines.launch

/** 弹层的标题（站点名是数据） */
fun stopTitle(state: PersistedState, s: Sheet.Stop): String? =
    state.trips.firstOrNull { it.id == s.tripId }?.days?.getOrNull(s.day)?.entries?.firstOrNull { it.id == s.entryId }?.let { (it as? PlaceEntry)?.name }

/** 添加待办时可选的「提前几天」（shared/algo/todos.ts 的 LEAD_DAYS） */
private val LEAD_DAYS = Shared.LEAD_DAYS   // 导出的（shared/algo/todos.ts、shared/geo/maplinks.ts）
private val MAP_APPS = Shared.MAP_APPS

/**
 * 站点详情：类别、时间、打卡（晨色）、待办（提前多久，core dueFromLead）、备注、导航（core mapLink → 地图 App）。
 * 待办与备注各占一行，点开再看。
 */
@Composable
fun StopDetailSheet(model: AppModel, state: PersistedState, s: Sheet.Stop) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val trip = state.trips.firstOrNull { it.id == s.tripId }
    val day = trip?.days?.getOrNull(s.day)
    val idx = day?.entries?.indexOfFirst { it.id == s.entryId } ?: -1
    val place = day?.entries?.getOrNull(idx) as? PlaceEntry
    if (trip == null || day == null || place == null) {
        LaunchedEffect(s) { model.sheet = null }
        return
    }
    val visited = place.visited == true
    val tl = rememberTimeline(model, day)
    var showTodos by remember(s) { mutableStateOf(false) }
    var showNotes by remember(s) { mutableStateOf(false) }
    var noteDraft by remember(s) { mutableStateOf(place.notes.orEmpty()) }
    var navMenu by remember { mutableStateOf(false) }
    // 到这一站的交通方式（导航方式按它选：步行 / 驾车 / 公交）
    val mode = (day.entries.getOrNull(idx - 1) as? TransportEntry)?.mode
    // 坐标：有就用，没有就按名字在地名表里找（core locate）
    val geo by produceState<Geo?>(place.geo, place.name, place.geo) {
        if (value == null) value = runCatching { model.core.locate(place.name) }.getOrNull()?.let { Geo(it.lat, it.lng) }
    }

    // 景点类型（core kindInfo，按当前语言）：组图标 + 类型名
    val kind = rememberKindInfo(model, place)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(kind?.group?.let(::groupIcon) ?: categoryIcon(place.category), contentDescription = null, tint = p.mist, modifier = Modifier.size(20.dp))
        Tag(kind?.label ?: i18n.tOr("cat.${place.category}", "cat.other"))
    }
    tl?.item(place.id)?.let { item ->
        Text("${item.start} – ${item.end}", style = EoType.sub, color = p.mist)
    }
    if (visited) {
        Text(
            i18n.list(listOf(i18n.t("day.checkedIn"), place.visitedAt?.take(10)?.let { i18n.monthDay(it) })),
            style = EoType.sub, color = p.dawnInk,
        )
    }

    // 待办：一行入口（数量 + 最近一件）
    val td = rememberPlaceTodos(model, place, trip.startDate)
    val open = td?.open ?: 0
    ListRow(
        title = if (open > 0) i18n.t("todo.count", "n" to open) else i18n.t("todo.title"),
        icon = Icons.Filled.CheckCircle,
        subtitle = td?.next?.let { i18n.t("todo.next", "text" to it.todo.text, "date" to i18n.monthDay(it.due)) },
        onClick = { showTodos = !showTodos },
    )
    if (showTodos) TodoSection(model, s, day.date, place.todos.orEmpty())
    Hairline()
    // 备注：一行入口，点开是输入框（边打边存）
    ListRow(
        title = place.notes?.let { i18n.plain(it) } ?: i18n.t("day.addNote"),
        icon = Icons.Filled.Edit,
        onClick = { noteDraft = place.notes.orEmpty(); showNotes = !showNotes },
    )
    if (showNotes) {
        EoTextField(
            value = noteDraft,
            onValueChange = { v -> noteDraft = v; model.store.setNotes(trip.id, s.day, place.id, v) },
            placeholder = i18n.t("day.notesPlaceholder"),
            singleLine = false,
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
    }

    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        InkCapsuleButton(
            if (visited) i18n.t("day.checkedIn") else i18n.t("day.checkIn"),
            icon = Icons.Filled.Check,
        ) { model.setVisited(trip.id, s.day, place.id, !visited) }
        val g = geo
        if (g != null) {
            Box {
                GlassCapsuleButton(i18n.t("nav.go"), icon = Icons.Filled.Map) { navMenu = true }
                DropdownMenu(expanded = navMenu, onDismissRequest = { navMenu = false }) {
                    Text(i18n.t("nav.title"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
                    MAP_APPS.forEach { app ->
                        DropdownMenuItem(
                            text = { Text(i18n.t("nav.$app"), style = EoType.body) },
                            onClick = {
                                navMenu = false
                                scope.launch {
                                    val url = runCatching { model.core.mapLink(app, place.name, g.lat, g.lng, mode) }.getOrNull() ?: return@launch
                                    try {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                    } catch (_: ActivityNotFoundException) {
                                        // 没有能打开链接的应用：什么都不做
                                    }
                                }
                            },
                        )
                    }
                }
            }
        }
        Spacer(Modifier.weight(1f))
    }
}

/** 站点的待办：每行勾选、文字（做完划掉）、到期日标签、删除；最后一行添加（文字 + 提前多久 + 加号） */
@Composable
private fun TodoSection(model: AppModel, s: Sheet.Stop, dayDate: String, todos: List<Todo>) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var lead by remember { mutableIntStateOf(30) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        todos.forEach { td ->
            val done = td.done == true
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                PlainIconButton(if (done) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, i18n.t("todo.done"), tint = if (done) p.dawnInk else p.ink) {
                    model.store.setTodoDone(s.tripId, s.day, s.entryId, td.id, !done)
                }
                Text(
                    td.text, style = EoType.body, color = if (done) p.mist else p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    textDecoration = if (done) TextDecoration.LineThrough else null, modifier = Modifier.weight(1f),
                )
                Tag(i18n.t("todo.due", "date" to i18n.monthDay(td.due ?: dayDate)))
                PlainIconButton(Icons.Filled.Close, i18n.t("todo.remove"), tint = p.mist) {
                    model.store.removeTodo(s.tripId, s.day, s.entryId, td.id)
                }
            }
        }
        val add: () -> Unit = {
            val t = text.trim()
            if (t.isNotEmpty()) {
                scope.launch {
                    val due = runCatching { model.core.dueFromLead(dayDate, lead) }.getOrNull()
                    model.store.addTodo(s.tripId, s.day, s.entryId, t, due)
                    text = ""
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            EoTextField(text, { text = it }, i18n.t("todo.placeholder"), modifier = Modifier.weight(1f), onSubmit = add)
            PlainIconButton(Icons.Filled.Add, i18n.t("todo.add"), onClick = add)
        }
        Row(Modifier.horizontalScroll(rememberScrollState())) {
            Segmented(LEAD_DAYS.map { it to i18n.t("todo.lead$it") }, lead, modifier = Modifier.padding(end = 4.dp).size(width = 460.dp, height = 48.dp)) { lead = it }
        }
    }
}
