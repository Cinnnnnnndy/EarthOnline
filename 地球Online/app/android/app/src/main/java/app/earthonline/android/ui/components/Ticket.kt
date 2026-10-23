package app.earthonline.android.ui.components

import android.animation.ValueAnimator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.earthonline.android.gen.Tokens
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.Trip
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.Fixed
import kotlinx.coroutines.launch
import kotlin.math.abs

/** 票的形状（D74）：四角各一个缺口，撕线的上下各一个小缺口，右边一截票根 */
class TicketShape(private val notch: Dp = 10.dp, private val stub: Dp = 76.dp, private val perf: Dp = 7.dp) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val n = with(density) { notch.toPx() }
        val s = with(density) { stub.toPx() }
        val f = with(density) { perf.toPx() }
        var path = Path().apply { addRect(Rect(Offset.Zero, size)) }
        fun cutCircle(cx: Float, cy: Float, r: Float) {
            val hole = Path().apply { addOval(Rect(Offset(cx - r, cy - r), Size(r * 2, r * 2))) }
            val out = Path()
            out.op(path, hole, PathOperation.Difference)
            path = out
        }
        for ((x, y) in listOf(0f to 0f, size.width to 0f, 0f to size.height, size.width to size.height)) cutCircle(x, y, n)
        val sx = size.width - s
        cutCircle(sx, 0f, f)
        cutCircle(sx, size.height, f)
        return Outline.Generic(path)
    }
}

/** 票号：种子取后四位（与网页 ticket.ts 的 serial 同一个数） */
fun ticketSerial(trip: Trip): String = (abs(trip.seed) % 10000).toString().padStart(4, '0')

/** 两段文字算不算重复：去掉标点后一个包含另一个，或共用任意一个 2 字以上的词（与网页 ticket.ts 的 dup 同一套） */
fun ticketDup(a: String, b: String): Boolean {
    val seps = Regex("""[\s·、，,+＋\-–—/／()（）]+""")
    val na = a.replace(seps, "")
    val nb = b.replace(seps, "")
    if (na.isEmpty() || nb.isEmpty()) return false
    if (na.contains(nb) || nb.contains(na)) return true
    val wb = b.split(seps).filter { it.length >= 2 }.toSet()
    return a.split(seps).filter { it.length >= 2 }.any { it in wb }
}

/**
 * 票（D74）：每一趟旅程都是一张白底墨字的纸票（夜里也是），与网页 ticket.ts、iOS TicketView 是同一张。
 * 票面：一行印章小字（地球Online · No. 0007）加状态标签；大字是地点；底下一行小字（书名与日期，或调用方给的要点）。
 * 票根竖着印一行（凭票进入 / 天数），一个很淡的年份水印。点票面 = 翻开这本书；撕票根 = 做这一刻最要紧的事（先放撕的动画）。
 * 票是物件不是界面：票号、年份用等宽；字号仍只用 17 / 13 两档。
 */
@Composable
fun Ticket(
    trip: Trip,
    modifier: Modifier = Modifier,
    status: String? = null,
    live: Boolean = false,
    lines: List<String> = emptyList(),
    compact: Boolean = false,
    stubLabel: String? = null,
    onFace: (() -> Unit)? = null,
    onLongPress: (() -> Unit)? = null,
    onStub: (() -> Unit)? = null,
) {
    val i18n = LocalI18n.current
    val stubWidth = if (compact) 56.dp else 76.dp
    val place = i18n.plainNames(trip.destination).ifEmpty { i18n.plain(trip.title) }
    val bodyLines = lines.ifEmpty {
        val name = if (ticketDup(i18n.plain(trip.title), place)) "" else i18n.plain(trip.title)
        listOf(listOf(name, i18n.fullDateRange(trip.startDate, trip.endDate)).filter { it.isNotEmpty() }.joinToString(" · "))
    }
    val stubText = stubLabel ?: if (compact) i18n.days(trip.days.size) else i18n.t("ticket.admit")
    val showBrand = !(status != null && !compact)
    val openLabel = i18n.t("ticket.open", "title" to i18n.plain(trip.title))
    val scope = rememberCoroutineScope()
    val tear = remember { Animatable(0f) }
    val shape = remember(stubWidth) { TicketShape(stub = stubWidth) }

    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = if (compact) 88.dp else 124.dp)
            .shadow(if (compact) 6.dp else 10.dp, shape, clip = false, ambientColor = Fixed.ticketInk, spotColor = Fixed.ticketInk)
            .background(Tokens.Day.white, shape),
    ) {
        // 票面
        Column(
            Modifier
                .weight(1f)
                .then(
                    if (onFace != null || onLongPress != null) Modifier
                        .pointerInput(onFace, onLongPress) {
                            detectTapGestures(onTap = { onFace?.invoke() }, onLongPress = onLongPress?.let { f -> { _: Offset -> f() } })
                        }
                        .semantics {
                            role = Role.Button
                            contentDescription = openLabel
                            if (onFace != null) onClick(label = openLabel) { onFace(); true }
                            if (onLongPress != null) onLongClick { onLongPress(); true }
                        }
                    else Modifier,
                )
                .padding(start = if (compact) 16.dp else 18.dp, end = 12.dp, top = if (compact) 10.dp else 14.dp, bottom = if (compact) 10.dp else 14.dp),
            verticalArrangement = Arrangement.spacedBy(if (compact) 2.dp else 6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (showBrand) Text(i18n.t("app.name"), style = EoType.subStrong, color = Fixed.ticketInk2, maxLines = 1)
                Text(
                    i18n.t("ticket.serial", "n" to ticketSerial(trip)),
                    style = EoType.sub.copy(fontFamily = FontFamily.Monospace, letterSpacing = 0.8.sp),
                    color = Fixed.ticketInk2, maxLines = 1,
                )
                Spacer(Modifier.weight(1f))
                if (status != null) Tag(status, live = live)
            }
            Text(place, style = EoType.title.copy(fontWeight = FontWeight.Bold), color = Fixed.ticketInk, maxLines = 1, overflow = TextOverflow.Ellipsis)
            bodyLines.forEach { l ->
                Text(l, style = EoType.sub, color = Fixed.ticketInk2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        // 票根：虚线撕线 + 竖着的印字 + 年份水印
        Box(
            Modifier
                .width(stubWidth)
                .fillMaxHeight()
                .graphicsLayer {
                    val t = tear.value
                    rotationZ = 14f * t
                    translationX = 30.dp.toPx() * t
                    translationY = 16.dp.toPx() * t
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 1f)
                }
                .alpha(1f - tear.value)
                .then(
                    if (onStub != null) Modifier
                        .pointerInput(onStub) {
                            detectTapGestures(onTap = {
                                if (tear.value > 0f) return@detectTapGestures
                                if (!ValueAnimator.areAnimatorsEnabled()) { onStub(); return@detectTapGestures }   // 关了动画：直接走
                                scope.launch {
                                    tear.animateTo(1f, tween(420))
                                    onStub()
                                    tear.snapTo(0f)
                                }
                            })
                        }
                        .semantics { role = Role.Button; contentDescription = stubText; onClick(label = stubText) { onStub(); true } }
                    else Modifier,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(Modifier.fillMaxHeight().width(2.dp).align(Alignment.CenterStart)) {
                drawLine(
                    color = Fixed.ticketInk.copy(alpha = 0.22f),
                    start = Offset(size.width / 2, 0f), end = Offset(size.width / 2, size.height),
                    strokeWidth = size.width, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())),
                )
            }
            Text(
                trip.startDate.take(4),
                style = EoType.title.copy(fontFamily = FontFamily.Monospace),
                color = Fixed.ticketInk.copy(alpha = 0.07f),
                maxLines = 1, softWrap = false,
                modifier = Modifier.wrapContentSize(unbounded = true).rotate(90f),
            )
            Text(
                stubText,
                style = EoType.subStrong.copy(letterSpacing = 1.2.sp),
                color = Fixed.ticketInk,
                maxLines = 1, softWrap = false,
                modifier = Modifier.wrapContentSize(unbounded = true).rotate(90f),
            )
        }
    }
}
