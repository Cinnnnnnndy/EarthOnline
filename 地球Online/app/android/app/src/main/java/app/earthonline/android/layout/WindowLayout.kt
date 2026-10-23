package app.earthonline.android.layout

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import androidx.window.layout.WindowMetricsCalculator

/** 这一刻的屏幕形态：布局态 + 量到的几何（发 set-layout 用，单位 dp） */
@Immutable
data class LayoutSnapshot(
    val layout: Layout,
    val widthDp: Double,
    val heightDp: Double,
    val segments: List<Segment>?,
    val posture: FoldPosture,
) {
    val state: LayoutState get() = layout.state
}

private fun Context.findActivity(): Activity? {
    var c: Context? = this
    while (c is ContextWrapper) {
        if (c is Activity) return c
        c = c.baseContext
    }
    return null
}

/**
 * 从 Jetpack WindowManager 量屏幕形态：窗口尺寸（WindowMetricsCalculator）、折痕（WindowInfoTracker 的 FoldingFeature：
 * bounds → 折痕分出的段，state FLAT / HALF_OPENED → 姿态，orientation 竖 / 横 → 并排 / 上下），换算成 dp 交给 layoutOf。
 * 合上（外屏）安卓没有直接的信号：展开过（量到过折痕）之后窗口变小且没有折痕，就当作在外屏（hasOuter）。
 * MainActivity 声明了 configChanges，折叠 / 旋转不重建 Activity，这里随 LocalConfiguration 重算。
 */
@Composable
fun rememberLayout(): LayoutSnapshot {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val density = LocalDensity.current.density
    val configuration = LocalConfiguration.current

    val info by produceState<WindowLayoutInfo?>(initialValue = null, activity) {
        val a = activity ?: return@produceState
        WindowInfoTracker.getOrCreate(a).windowLayoutInfo(a).collect { value = it }
    }

    // 窗口的像素尺寸（拿不到 Activity 时用 Configuration 的 dp 兜底，比如预览）
    val (wPx, hPx) = remember(configuration, info, activity) {
        val b = activity?.let { WindowMetricsCalculator.getOrCreate().computeCurrentWindowMetrics(it).bounds }
        if (b != null) b.width().toDouble() to b.height().toDouble()
        else configuration.screenWidthDp * density.toDouble() to configuration.screenHeightDp * density.toDouble()
    }
    val widthDp = wPx / density
    val heightDp = hPx / density

    val folds = info?.displayFeatures?.filterIsInstance<FoldingFeature>().orEmpty()
    var unfoldedWidth by remember { mutableStateOf<Double?>(null) }
    SideEffect { if (folds.isNotEmpty()) unfoldedWidth = widthDp }

    val segments = segmentsOf(folds, wPx, hPx)?.map { Segment(it.x / density, it.y / density, it.w / density, it.h / density) }
    val hasOuter = folds.isEmpty() && unfoldedWidth?.let { widthDp < it - 1 } == true
    val posture = when {
        folds.any { it.state == FoldingFeature.State.HALF_OPENED } -> FoldPosture.HALF
        folds.isNotEmpty() -> FoldPosture.FLAT
        hasOuter -> FoldPosture.CLOSED
        else -> FoldPosture.UNKNOWN
    }
    val layout = layoutOf(ScreenInfo(widthDp, heightDp, segments, posture, hasOuter))
    return LayoutSnapshot(layout, widthDp, heightDp, segments, posture)
}

/** 折痕 → 段（像素）：竖的折痕切出并排的段，横的切出上下两段；没有折痕返回 null */
private fun segmentsOf(folds: List<FoldingFeature>, w: Double, h: Double): List<Segment>? {
    val vertical = folds.filter { it.orientation == FoldingFeature.Orientation.VERTICAL }.sortedBy { it.bounds.left }
    if (vertical.isNotEmpty()) {
        val out = ArrayList<Segment>()
        var start = 0.0
        for (f in vertical) {
            out += Segment(start, 0.0, (f.bounds.left - start).coerceAtLeast(0.0), h)
            start = f.bounds.right.toDouble()
        }
        out += Segment(start, 0.0, (w - start).coerceAtLeast(0.0), h)
        return out
    }
    val horizontal = folds.filter { it.orientation == FoldingFeature.Orientation.HORIZONTAL }.sortedBy { it.bounds.top }
    if (horizontal.isNotEmpty()) {
        val out = ArrayList<Segment>()
        var start = 0.0
        for (f in horizontal) {
            out += Segment(0.0, start, w, (f.bounds.top - start).coerceAtLeast(0.0))
            start = f.bounds.bottom.toDouble()
        }
        out += Segment(0.0, start, w, (h - start).coerceAtLeast(0.0))
        return out
    }
    return null
}
