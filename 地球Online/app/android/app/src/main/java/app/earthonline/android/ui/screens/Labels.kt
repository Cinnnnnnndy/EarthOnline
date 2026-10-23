package app.earthonline.android.ui.screens

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.DirectionsBoat
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.LocalActivity
import androidx.compose.material.icons.filled.LocalMall
import androidx.compose.material.icons.filled.LocalTaxi
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Subway
import androidx.compose.material.icons.filled.Train
import androidx.compose.ui.graphics.vector.ImageVector
import app.earthonline.android.i18n.Texts
import app.earthonline.android.model.Themes
import app.earthonline.android.model.Trip
import app.earthonline.android.model.TripStatus
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** 两个 YYYY-MM-DD 之间差几天（b - a） */
fun daysBetween(a: String, b: String): Long =
    runCatching { ChronoUnit.DAYS.between(LocalDate.parse(a.take(10)), LocalDate.parse(b.take(10))) }.getOrDefault(0L)

/** 「今天出发 / 明天出发 / 后天出发 / 3 天后出发」（shared/algo/journey.ts 的 departLabel，只是选一句文字） */
fun Texts.departLabel(inDays: Int): String = when {
    inDays <= 0 -> t("journey.departToday")
    inDays == 1 -> t("journey.departTomorrow")
    inDays == 2 -> t("journey.departDayAfter")
    else -> t("journey.departIn", "n" to inDays)
}

/** 主题的显示名（不认识的主题是用户数据，原样显示） */
fun Texts.themeName(theme: String): String = Themes.KEYS[theme]?.let { t(it) } ?: theme

/** 「D3」这类天数标签 */
fun Texts.dayTag(index: Int): String = t("home.travelingDay", "n" to index)

/** 书的阶段：旅行中（今天是第几天）/ 还没出发（几天后）/ 已结束 */
sealed interface TripPhase {
    data class Traveling(val dayIndex: Int) : TripPhase
    data class Upcoming(val inDays: Int) : TripPhase
    data object Ended : TripPhase
}

fun Trip.phase(today: String): TripPhase {
    if (status == TripStatus.CLOSED) return TripPhase.Ended
    val ti = todayIndex(today)
    if (ti >= 0) return TripPhase.Traveling(ti)
    val inDays = daysBetween(today, startDate)
    return if (inDays > 0) TripPhase.Upcoming(inDays.toInt()) else TripPhase.Ended
}

/** 书的状态标签（文字、是不是「现在」） */
fun Texts.tripStatus(trip: Trip, today: String): Pair<String, Boolean> = when (val p = trip.phase(today)) {
    is TripPhase.Traveling -> t("home.statusToday", "n" to trip.days[p.dayIndex].index) to true
    is TripPhase.Upcoming -> departLabel(p.inDays) to false
    TripPhase.Ended -> t("home.statusEnded") to false
}

/** 站点类别的图标（六组：人文 / 自然、吃、买、交通枢纽、住、其他） */
fun categoryIcon(category: String): ImageVector = when (category) {
    "sight" -> Icons.Filled.Landscape
    "food" -> Icons.Filled.Restaurant
    "shop" -> Icons.Filled.LocalMall
    "station" -> Icons.Filled.Train
    "airport" -> Icons.Filled.Flight
    "port" -> Icons.Filled.DirectionsBoat
    "hotel" -> Icons.Filled.Hotel
    else -> Icons.Filled.Place
}

/** 景点类型的六组（core kindInfo 的 group）各一个图标：人文、自然、休闲、吃喝购物、住、交通（与 iOS groupSymbol 一致） */
fun groupIcon(group: String): ImageVector? = when (group) {
    "culture" -> Icons.Filled.AccountBalance
    "nature" -> Icons.Filled.Landscape
    "leisure" -> Icons.Filled.LocalActivity
    "life" -> Icons.Filled.Restaurant
    "stay" -> Icons.Filled.Hotel
    "transit" -> Icons.Filled.Train
    else -> null
}

@Suppress("DEPRECATION")   // DirectionsWalk 有 AutoMirrored 版；这里用旧名，少一个版本依赖
fun modeIcon(mode: String): ImageVector = when (mode) {
    "walk" -> Icons.Filled.DirectionsWalk
    "rail" -> Icons.Filled.Train
    "subway" -> Icons.Filled.Subway
    "bus" -> Icons.Filled.DirectionsBus
    "ship" -> Icons.Filled.DirectionsBoat
    "taxi" -> Icons.Filled.LocalTaxi
    "car" -> Icons.Filled.DirectionsCar
    "flight" -> Icons.Filled.Flight
    else -> Icons.Filled.Train
}
