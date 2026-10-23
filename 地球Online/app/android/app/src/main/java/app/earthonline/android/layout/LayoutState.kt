package app.earthonline.android.layout

import app.earthonline.android.gen.Shared
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max

/**
 * 屏幕形态（D90）：shared/spec/layout.ts 的 Kotlin 移植，规则、阈值、取整逐条对齐。
 * 输入只有几何（窗口宽高、折痕分出的段、折叠姿态、是不是外屏），输出布局态与每一页的范围；界面只认布局态与分页，不认机型。
 * 单位是 dp（与 CSS px / vp 同一个量级）。这个文件只用纯 Kotlin，JVM 单元测试（LayoutStateTest）直接跑 layout.golden.json。
 * 改规则先改 layout.ts，再同时改这里、鸿蒙 LayoutState.ets、iOS StageLayout.swift，并给黄金用例加一条。
 */

/** 布局态（types.ts 的 LayoutState）；wire 是发给嵌入页的名字 */
enum class LayoutState(val wire: String) {
    PHONE("phone"), OUTER("outer"), SPREAD("spread"), HOVER("hover"), TRIPLE("triple");

    /** 一页的两种：内容是底部抽屉 */
    val compact: Boolean get() = this == PHONE || this == OUTER

    companion object {
        fun of(wire: String): LayoutState? = entries.firstOrNull { it.wire == wire }
    }
}

/** 设备类（只供日志、截图、文档；界面不按它分支） */
enum class DeviceClass(val wire: String) {
    BAR("bar"), OUTER("outer"), BOOK("book"), WIDE("wide"), TRI("tri"), TABLET("tablet"), DESKTOP("desktop");

    companion object {
        fun of(wire: String): DeviceClass? = entries.firstOrNull { it.wire == wire }
    }
}

/** 折叠姿态：flat 展开、half 半开、closed 合上；拿不到就 unknown */
enum class FoldPosture(val wire: String) {
    FLAT("flat"), HALF("half"), CLOSED("closed"), UNKNOWN("unknown");

    companion object {
        fun of(wire: String?): FoldPosture = entries.firstOrNull { it.wire == wire } ?: UNKNOWN
    }
}

/** 折痕分出的一段（相对窗口左上角） */
data class Segment(val x: Double, val y: Double, val w: Double, val h: Double)

data class ScreenInfo(
    val width: Double,
    val height: Double,
    /** 两段并排 = 书式 / 阔折叠展开，三段并排 = 三折叠全开，两段上下 = 半开悬停；拿不到就 null */
    val segments: List<Segment>? = null,
    val posture: FoldPosture = FoldPosture.UNKNOWN,
    /** 合上时窗口在外屏（安卓：展开过、后来窗口变小且没有折痕） */
    val hasOuter: Boolean = false,
)

/** 一页的横向范围（hover 是纵向的：x = 顶边 y，w = 高） */
data class Pane(val x: Double, val w: Double)

data class Layout(
    val state: LayoutState,
    val device: DeviceClass,
    /** 1～3 页；hover 时是上下两页 */
    val panes: List<Pane>,
    /** 折痕中线（spread / triple 是 x，hover 是 y） */
    val creases: List<Double>,
    /** 折痕两侧总共留白 */
    val gap: Double,
    /** 折痕是真量到的还是按等分估的 */
    val measured: Boolean,
)

data class WorldInsets(val left: Double, val right: Double, val top: Double, val bottom: Double) {
    companion object { val Zero = WorldInsets(0.0, 0.0, 0.0, 0.0) }
}

// 阈值来自生成的 Shared.kt（Float）。0.8f.toDouble() 是 0.800000011…，先转成字符串再读回来，得到与 TS 完全相同的 Double。
private val PHONE_MAX = Shared.PHONE_MAX.toString().toDouble()
private val SPREAD_RATIO = Shared.SPREAD_RATIO.toString().toDouble()
private val TRIPLE_MIN = Shared.TRIPLE_MIN.toString().toDouble()
private val TRIPLE_RATIO = Shared.TRIPLE_RATIO.toString().toDouble()
private val FOLD_GAP = Shared.FOLD_GAP.toString().toDouble()

/** JS 的 Math.round（.5 往正无穷取整）；kotlin.math.round 是银行家取整，不能用 */
internal fun jsRound(x: Double): Double = floor(x + 0.5)

private fun sideBySide(s: List<Segment>): Boolean =
    s.size >= 2 && s.all { abs(it.y - s[0].y) < 2 && abs(it.h - s[0].h) < 2 }

private fun stacked(s: List<Segment>): Boolean =
    s.size == 2 && abs(s[0].x - s[1].x) < 2 && abs(s[0].w - s[1].w) < 2 && s[0].y != s[1].y

private class Cut(val panes: List<Pane>, val creases: List<Double>, val gap: Double)

/** 按折痕（或等分）切出 n 页 */
private fun cut(total: Double, n: Int, segs: List<Segment>?, vertical: Boolean): Cut {
    if (segs != null && segs.size == n) {
        val sorted = if (vertical) segs.sortedBy { it.y } else segs.sortedBy { it.x }
        val creases = ArrayList<Double>()
        val gaps = ArrayList<Double>()
        for (i in 0 until n - 1) {
            val a = sorted[i]
            val b = sorted[i + 1]
            val aEnd = if (vertical) a.y + a.h else a.x + a.w
            val bStart = if (vertical) b.y else b.x
            creases += floor((aEnd + bStart) / 2)
            gaps += max(0.0, bStart - aEnd) + 16
        }
        val gap = max(FOLD_GAP, gaps.maxOrNull() ?: FOLD_GAP)
        val panes = sorted.indices.map { i ->
            val start = if (i == 0) 0.0 else creases[i - 1] + gap / 2
            val end = if (i == n - 1) total else creases[i] - gap / 2
            val xs = jsRound(start)
            val xe = jsRound(end)
            Pane(xs, max(0.0, xe - xs))   // 先取整两端再算宽：末页正好贴到边
        }
        return Cut(panes, creases, gap)
    }
    val creases = (1 until n).map { jsRound(total * it / n) }
    val panes = (0 until n).map { i ->
        val start = if (i == 0) 0.0 else creases[i - 1] + FOLD_GAP / 2
        val end = if (i == n - 1) total else creases[i] - FOLD_GAP / 2
        val xs = jsRound(start)
        val xe = jsRound(end)
        Pane(xs, xe - xs)
    }
    return Cut(panes, creases, FOLD_GAP)
}

/** 几何 → 布局态。纯函数；与 layout.ts 的 layoutOf 同一套规则 */
fun layoutOf(info: ScreenInfo): Layout {
    val w = max(1.0, info.width)
    val h = max(1.0, info.height)
    val ratio = w / h
    val segs = info.segments?.takeIf { it.size >= 2 }?.sortedBy { it.x }   // sortedBy 是稳定排序，与 JS 的 sort 一致
    val posture = info.posture
    val isStacked = segs != null && stacked(segs)

    // 半开悬停：横放桌面，上下两段（真量到的），或姿态是半开且横着
    if (isStacked || (posture == FoldPosture.HALF && ratio >= 1)) {
        val c = cut(h, 2, if (isStacked) segs else null, vertical = true)
        val device = if (segs != null && segs.size == 3) DeviceClass.TRI else DeviceClass.BOOK
        return Layout(LayoutState.HOVER, device, c.panes, c.creases, c.gap, measured = isStacked)
    }
    // 三折叠全开：三段并排
    if (segs != null && segs.size == 3 && sideBySide(segs)) {
        val c = cut(w, 3, segs, vertical = false)
        return Layout(LayoutState.TRIPLE, DeviceClass.TRI, c.panes, c.creases, c.gap, measured = true)
    }
    // 书式 / 阔折叠展开：两段并排（竖持时不算——那是展开后竖持，单页放大）
    if (segs != null && segs.size == 2 && sideBySide(segs) && ratio >= SPREAD_RATIO) {
        val c = cut(w, 2, segs, vertical = false)
        val device = if (ratio >= 1.15) DeviceClass.WIDE else DeviceClass.BOOK
        return Layout(LayoutState.SPREAD, device, c.panes, c.creases, c.gap, measured = true)
    }
    // 没有折痕信息：按宽高估
    val one = listOf(Pane(0.0, w))
    if (w < PHONE_MAX) {
        val outer = posture == FoldPosture.CLOSED || info.hasOuter
        return Layout(
            if (outer) LayoutState.OUTER else LayoutState.PHONE,
            if (outer) DeviceClass.OUTER else DeviceClass.BAR,
            one, emptyList(), 0.0, false,
        )
    }
    if (w >= TRIPLE_MIN && ratio >= TRIPLE_RATIO) {
        val c = cut(w, 3, null, vertical = false)
        return Layout(LayoutState.TRIPLE, if (w >= 1400) DeviceClass.DESKTOP else DeviceClass.TABLET, c.panes, c.creases, c.gap, false)
    }
    if (ratio >= SPREAD_RATIO) {
        val c = cut(w, 2, null, vertical = false)
        val device = if (w >= 900) DeviceClass.TABLET else if (ratio >= 1.15) DeviceClass.WIDE else DeviceClass.BOOK
        return Layout(LayoutState.SPREAD, device, c.panes, c.creases, c.gap, false)
    }
    return Layout(LayoutState.PHONE, if (w >= 900) DeviceClass.TABLET else DeviceClass.BOOK, one, emptyList(), 0.0, false)   // 展开后竖持：单页放大
}

/** 世界该让出来的边：spread 让出左页，triple 让出左右两页，hover 让出下半屏；phone / outer 由抽屉高度决定（这里给 0） */
fun worldInsets(l: Layout): WorldInsets = when (l.state) {
    LayoutState.SPREAD -> WorldInsets(left = l.panes[1].x, right = 0.0, top = 0.0, bottom = 0.0)
    LayoutState.TRIPLE -> WorldInsets(left = l.panes[1].x, right = max(0.0, l.panes[2].w + l.gap / 2), top = 0.0, bottom = 0.0)
    LayoutState.HOVER -> WorldInsets(left = 0.0, right = 0.0, top = 0.0, bottom = l.panes[1].w + l.gap / 2)
    else -> WorldInsets.Zero
}
