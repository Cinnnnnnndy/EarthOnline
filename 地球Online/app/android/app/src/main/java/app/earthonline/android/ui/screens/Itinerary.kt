package app.earthonline.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.Day
import app.earthonline.android.model.KindInfo
import app.earthonline.android.model.LodgingEntry
import app.earthonline.android.model.PlaceEntry
import app.earthonline.android.model.PlaceTodos
import app.earthonline.android.model.Timeline
import app.earthonline.android.model.TransportEntry
import app.earthonline.android.model.Trip
import app.earthonline.android.ui.components.Tag
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.ui.theme.Metrics
import app.earthonline.android.ui.theme.onInk

/** 书页里的一天：「D2」+ 标题 + 日期（今天用晨色） */
@Composable
fun DayRow(day: Day, isToday: Boolean, onClick: () -> Unit) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Metrics.touch)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.width(44.dp)) { Tag(i18n.dayTag(day.index), live = isToday) }
        Column(Modifier.weight(1f)) {
            Text(i18n.plain(day.title), style = EoType.body, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val date = i18n.monthDay(day.date)
            Text(
                if (isToday) i18n.t("home.todayDate", "date" to date) else date,
                style = EoType.sub, color = if (isToday) p.dawnInk else p.mist, maxLines = 1,
            )
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = p.mist2, modifier = Modifier.size(20.dp))
    }
}

/** 某一天的时间线（core timeline）；没就绪时是 null */
@Composable
fun rememberTimeline(model: AppModel, day: Day): Timeline? {
    val tl by produceState<Timeline?>(null, day) { value = runCatching { model.core.timeline(day) }.getOrNull() }
    return tl
}

/** 一个站点自己的待办（core placeTodos）；没有待办就不问 */
@Composable
fun rememberPlaceTodos(model: AppModel, place: PlaceEntry, fallbackDue: String): PlaceTodos? {
    val today = model.today
    val r by produceState<PlaceTodos?>(null, place.todos, fallbackDue, today) {
        value = if (place.todos.isNullOrEmpty()) PlaceTodos(0) else runCatching { model.core.placeTodos(place, fallbackDue, today) }.getOrNull()
    }
    return r
}

/** 站点的景点类型（core kindInfo：类型、所属的组、按当前语言的名字） */
@Composable
fun rememberKindInfo(model: AppModel, place: PlaceEntry): KindInfo? {
    val locale = LocalI18n.current.locale
    val r by produceState<KindInfo?>(null, place.name, place.category, place.kind, place.geo, locale) {
        value = runCatching { model.core.kindInfo(place) }.getOrNull()
    }
    return r
}

/** 站点行：左边是序号（墨底白字，去过的用晨色），名字前是类别图标，名字旁是待办数量，下面一行是最近一件待办；右边是时间 */
@Composable
fun StopRow(model: AppModel, trip: Trip, place: PlaceEntry, index: Int, time: String?, onClick: (() -> Unit)?) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val visited = place.visited == true
    val td = rememberPlaceTodos(model, place, trip.startDate)
    val kind = rememberKindInfo(model, place)
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Metrics.touch)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
            Box(
                Modifier.size(22.dp).background(if (visited) p.dawn else p.ink, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(index.toString(), style = EoType.subStrong, color = if (visited) p.dawnInk else p.onInk, maxLines = 1)
            }
        }
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    kind?.group?.let(::groupIcon) ?: categoryIcon(place.category),
                    contentDescription = kind?.label ?: i18n.tOr("cat.${place.category}", "cat.other"),
                    tint = p.mist, modifier = Modifier.size(16.dp),
                )
                Text(place.name, style = EoType.body, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if ((td?.open ?: 0) > 0) Tag(td!!.open.toString(), icon = Icons.Filled.Check)
            }
            val next = td?.next
            if (next != null) {
                Text(
                    i18n.t("todo.next", "text" to next.todo.text, "date" to i18n.monthDay(next.due)),
                    style = EoType.sub, color = p.mist, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            } else if (place.geo == null) {
                Text(i18n.t("home.noCoords"), style = EoType.sub, color = p.mist, maxLines = 1)
            }
        }
        if (time != null) Text(time, style = EoType.sub, color = p.mist, maxLines = 1)
    }
}

/** 两站之间的交通：一行次要文字（有用时写用时，否则写方式） */
@Composable
fun LegRow(legs: List<TransportEntry>) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val minutes = legs.sumOf { it.durationMinutes ?: 0 }
    val text = if (minutes > 0) i18n.duration(minutes) else i18n.t("mode.${legs.first().mode}")
    Row(
        Modifier.fillMaxWidth().heightIn(min = 28.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
            Icon(modeIcon(legs.first().mode), contentDescription = null, tint = p.mist, modifier = Modifier.size(16.dp))
        }
        Text(text, style = EoType.sub, color = p.mist, maxLines = 1)
        Spacer(Modifier.weight(1f))
    }
}

/** 一天的行程列表：站点行之间插交通行；从上往下编号（和浮岛上的针一致） */
@Composable
fun ItineraryList(model: AppModel, trip: Trip, day: Day, onTapPlace: ((PlaceEntry, Int) -> Unit)? = null) {
    val tl = rememberTimeline(model, day)
    Column(Modifier.fillMaxWidth()) {
        var pending = ArrayList<TransportEntry>()
        var n = 0
        for (e in day.entries) {
            when (e) {
                is TransportEntry -> pending.add(e)
                is PlaceEntry -> {
                    if (pending.isNotEmpty()) LegRow(pending)
                    val i = n
                    val time = e.plannedStart ?: tl?.item(e.id)?.start
                    StopRow(model, trip, e, i + 1, time, onTapPlace?.let { f -> { f(e, i) } })
                    n += 1
                    pending = ArrayList()
                }
                is LodgingEntry -> Unit
            }
        }
        if (pending.isNotEmpty()) LegRow(pending)
    }
}

/** 两列统计：数值 SemiBold、说明 Normal 次要色，同一字号 */
@Composable
fun StatGrid(items: List<Pair<String, String>>) {
    val p = LocalEo.current
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { (value, label) ->
                    Column(Modifier.weight(1f)) {
                        Text(value, style = EoType.title, color = p.ink)
                        Text(label, style = EoType.body, color = p.mist)
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}
