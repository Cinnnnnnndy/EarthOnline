package app.earthonline.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.layout.LayoutSnapshot
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Trip
import app.earthonline.android.ui.components.GlassIconBar
import app.earthonline.android.ui.components.GlassIconButton
import app.earthonline.android.ui.components.InkCapsuleButton
import app.earthonline.android.ui.components.StageScaffold
import app.earthonline.android.ui.components.Tag
import app.earthonline.android.ui.components.TextAction
import app.earthonline.android.ui.components.Ticket
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo

/**
 * 一本书：地球聚焦这本书；这趟的票浮在抽屉上方（撕票根 = 进入今天 / 从 D1 开始 / 写旅行日记），抽屉里是天的列表。
 * 点某一天 → 地球聚焦那天，抽屉换成那天的站点预览 +「进入这一天」。
 */
@Composable
fun BookOverlay(model: AppModel, layout: LayoutSnapshot, state: PersistedState, tripId: String) {
    val i18n = LocalI18n.current
    val trip = state.trips.firstOrNull { it.id == tripId }
    if (trip == null) {
        LaunchedEffect(tripId) { model.goHome() }
        return
    }
    val today = model.today
    val ti = trip.todayIndex(today)
    val bookDay = model.bookDay?.takeIf { it in trip.days.indices }
    var menu by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current

    val floating: (@Composable ColumnScope.() -> Unit)? = if (bookDay == null) {
        { BookTicket(model, trip, today) }
    } else null

    StageScaffold(
        layout = layout,
        onObstruction = model::onObstruction,
        leading = { GlassIconButton(Icons.AutoMirrored.Filled.ArrowBack, i18n.t("home.backToGlobe")) { model.goHome() } },
        trailing = {
            GlassIconBar {
                GlassIconButton(Icons.Filled.Book, i18n.t("home.diaryExport")) { model.openDiary(trip.id) }
                Box {
                    GlassIconButton(Icons.Filled.MoreVert, i18n.t("common.more")) { menu = true }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(
                            text = { Text(i18n.t("epi.copyData"), style = EoType.body) },
                            leadingIcon = { Icon(Icons.Filled.ContentCopy, contentDescription = null) },
                            onClick = {
                                menu = false
                                model.tripJson(trip.id)?.let { clipboard.setText(AnnotatedString(it)) }
                                model.showToast(i18n.t("epi.copied"))
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(i18n.t("common.delete"), style = EoType.body, color = LocalEo.current.danger) },
                            leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = null, tint = LocalEo.current.danger) },
                            onClick = { menu = false; confirmDelete = true },
                        )
                    }
                }
            }
        },
        floating = floating,
        sheetKey = bookDay,
        sheet = {
            if (bookDay == null) {
                trip.days.forEachIndexed { i, d -> DayRow(d, isToday = i == ti) { model.selectBookDay(i) } }
            } else {
                DayPreview(model, trip, bookDay)
            }
        },
    )

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(i18n.t("shelf.deleteConfirm", "title" to i18n.plain(trip.title)), style = EoType.title) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    model.store.delete(trip.id)
                    model.showToast(i18n.t("shelf.deleted"))
                    model.goHome()
                }) { Text(i18n.t("common.delete"), color = LocalEo.current.danger) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text(i18n.t("common.cancel")) } },
        )
    }
}

/** 这趟旅程的票：撕票根做这一刻最要紧的事 */
@Composable
private fun BookTicket(model: AppModel, trip: Trip, today: String) {
    val i18n = LocalI18n.current
    val (status, live) = i18n.tripStatus(trip, today)
    when (val phase = trip.phase(today)) {
        is TripPhase.Traveling -> Ticket(trip, status = status, live = live, stubLabel = i18n.t("home.enterToday"), onStub = { model.openDay(trip.id, phase.dayIndex) })
        is TripPhase.Upcoming -> Ticket(trip, status = status, stubLabel = i18n.t("home.startFromD", "n" to (trip.days.firstOrNull()?.index ?: 1)), onStub = { model.openDay(trip.id, 0) })
        TripPhase.Ended -> Ticket(trip, status = status, stubLabel = i18n.t("home.writeDiary"), onStub = { model.openDiary(trip.id) })
    }
}

/** 某一天的预览（仍在地球上）：全部天、D2 标题、日期、站点、进入这一天 */
@Composable
private fun DayPreview(model: AppModel, trip: Trip, dayIndex: Int) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val d = trip.days[dayIndex]
    TextAction(i18n.t("home.allDays"), icon = Icons.AutoMirrored.Filled.KeyboardArrowLeft) { model.selectBookDay(null) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Tag(i18n.dayTag(d.index))
        Text(i18n.plain(d.title), style = EoType.title, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
    Text(i18n.monthDay(d.date), style = EoType.sub, color = p.mist)
    if (d.places.isEmpty()) {
        Text(i18n.t("day.noStops"), style = EoType.body, color = p.mist)
    } else {
        ItineraryList(model, trip, d)
    }
    InkCapsuleButton(i18n.t("home.enterDay"), modifier = Modifier.fillMaxWidth()) { model.openDay(trip.id, dayIndex) }
}
