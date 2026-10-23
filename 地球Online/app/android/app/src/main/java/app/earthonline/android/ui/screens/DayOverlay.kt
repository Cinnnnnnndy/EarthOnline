package app.earthonline.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled._3dRotation
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.Sheet
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.layout.LayoutSnapshot
import app.earthonline.android.model.Day
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Trip
import app.earthonline.android.ui.components.GlassIconBar
import app.earthonline.android.ui.components.GlassIconButton
import app.earthonline.android.ui.components.Hairline
import app.earthonline.android.ui.components.InkCapsuleButton
import app.earthonline.android.ui.components.PlainIconButton
import app.earthonline.android.ui.components.Tag
import app.earthonline.android.ui.components.StageScaffold
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.world.WorldMessages

/**
 * 某一天 = 潜入微缩世界：世界铺满整屏，左上返回，右上一小组控制（暂停、视角、重走），
 * 抽屉里是这一天、下一站、当天的站点列表。点站点 → 小人走过去 + 站点详情。
 */
@Composable
fun DayOverlay(model: AppModel, layout: LayoutSnapshot, state: PersistedState, tripId: String, dayIndex: Int) {
    val i18n = LocalI18n.current
    val trip = state.trips.firstOrNull { it.id == tripId }
    if (trip == null || dayIndex !in trip.days.indices) {
        LaunchedEffect(tripId, dayIndex) { model.goHome() }
        return
    }
    val day = trip.days[dayIndex]
    StageScaffold(
        layout = layout,
        onObstruction = model::onObstruction,
        leading = { GlassIconButton(Icons.AutoMirrored.Filled.ArrowBack, i18n.t("day.backToBook")) { model.openBook(trip.id, dayIndex) } },
        trailing = {
            GlassIconBar {
                GlassIconButton(if (model.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, i18n.t("day.pauseResume")) {
                    model.playing = !model.playing
                    model.world.send(if (model.playing) WorldMessages.play() else WorldMessages.pause())
                }
                GlassIconButton(if (model.topView) Icons.Filled._3dRotation else Icons.Filled.Layers, i18n.t("day.viewAngle")) {
                    model.topView = !model.topView
                    model.world.send(WorldMessages.setView(pitch = if (model.topView) 90 else 30))
                }
                GlassIconButton(Icons.Filled.Replay, i18n.t("day.replay")) {
                    model.heroStop = null
                    model.dayFinished = false
                    model.playing = true
                    model.world.send(WorldMessages.restart())
                    model.world.send(WorldMessages.play())
                }
            }
        },
        sheetKey = dayIndex,
        sheet = { DayCard(model, trip, day, dayIndex) },
    )
}

@Composable
private fun DayCard(model: AppModel, trip: Trip, day: Day, dayIndex: Int) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val isToday = trip.todayIndex(model.today) == dayIndex
    val tl = rememberTimeline(model, day)

    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Tag(i18n.dayTag(day.index), live = isToday)
                Text(i18n.plain(day.title), style = EoType.title, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            val date = i18n.monthDay(day.date)
            Text(if (isToday) i18n.t("home.todayDate", "date" to date) else date, style = EoType.sub, color = if (isToday) p.dawnInk else p.mist)
        }
        PlainIconButton(Icons.AutoMirrored.Filled.KeyboardArrowLeft, i18n.t("day.prevDay"), enabled = dayIndex > 0) { model.openDay(trip.id, dayIndex - 1) }
        PlainIconButton(Icons.AutoMirrored.Filled.KeyboardArrowRight, i18n.t("day.nextDay"), enabled = dayIndex < trip.days.size - 1) { model.openDay(trip.id, dayIndex + 1) }
    }

    // 下一站：一行（类别图标、名字、时间）
    val places = day.places
    when {
        places.isEmpty() -> Text(i18n.t("day.noStops"), style = EoType.sub, color = p.mist)
        model.dayFinished -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.Flag, contentDescription = null, tint = p.dawnInk, modifier = Modifier.size(20.dp))
            Text(i18n.t("day.dayDone"), style = EoType.title, color = p.dawnInk)
        }
        else -> {
            val next = places[minOf(places.size - 1, (model.heroStop ?: -1) + 1)]
            val time = next.plannedStart ?: tl?.item(next.id)?.start
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(categoryIcon(next.category), contentDescription = null, tint = p.mist, modifier = Modifier.size(20.dp))
                Text(i18n.t("day.nextStop"), style = EoType.sub, color = p.mist)
                Text(next.name, style = EoType.title, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (time != null) Text(time, style = EoType.sub, color = p.mist)
            }
        }
    }

    if (day.entries.isNotEmpty()) {
        Hairline()
        ItineraryList(model, trip, day) { place, i ->
            model.world.send(WorldMessages.gotoStop(i))
            model.sheet = Sheet.Stop(trip.id, dayIndex, place.id)
        }
    }

    if (model.dayFinished) {
        if (dayIndex < trip.days.size - 1) {
            InkCapsuleButton(i18n.t("day.turnNext"), modifier = Modifier.fillMaxWidth()) { model.openDay(trip.id, dayIndex + 1) }
        } else {
            InkCapsuleButton(i18n.t("home.writeDiary"), modifier = Modifier.fillMaxWidth()) { model.openDiary(trip.id) }
        }
    }
}
