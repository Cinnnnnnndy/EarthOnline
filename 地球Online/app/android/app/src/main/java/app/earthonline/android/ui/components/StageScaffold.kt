package app.earthonline.android.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import app.earthonline.android.gen.Tokens
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.layout.LayoutSnapshot
import app.earthonline.android.layout.LayoutState
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.ui.theme.Metrics
import kotlinx.coroutines.launch
import kotlin.math.min

/**
 * 舞台的布局骨架（五个布局态，shared/spec/layout.ts）：世界层铺满整屏，界面浮在上面。
 *  - phone：左上返回 / 右上图标；底部是浮着的东西（票、新建胶囊）加一张可拖的抽屉（半开 / 全开）；
 *  - outer：同 phone，屏幕矮，抽屉的半开高一点；
 *  - spread：内容停靠在第一页（≤ 400），世界在第二页，图标在第二页右上；
 *  - triple：同 spread；第三页留给弹层（SheetHost），世界在中页；
 *  - hover：上半屏世界与图标，下半屏是内容。
 * phone / outer 时把「底部挡住了多高」报给 onObstruction（dp，世界据此挪视觉中心）；其余布局态的留白由 worldInsets 算。
 */
@Composable
fun StageScaffold(
    layout: LayoutSnapshot,
    onObstruction: (Double) -> Unit,
    leading: @Composable RowScope.() -> Unit = {},
    trailing: @Composable RowScope.() -> Unit = {},
    floating: (@Composable ColumnScope.() -> Unit)? = null,
    sheetKey: Any? = null,
    sheet: (@Composable ColumnScope.() -> Unit)? = null,
) {
    when (layout.state) {
        LayoutState.PHONE, LayoutState.OUTER -> CompactStage(layout.state == LayoutState.OUTER, onObstruction, leading, trailing, floating, sheetKey, sheet)
        LayoutState.SPREAD, LayoutState.TRIPLE -> PanedStage(layout, leading, trailing, floating, sheet)
        LayoutState.HOVER -> HoverStage(layout, leading, trailing, floating, sheet)
    }
}

@Composable
private fun TopBar(modifier: Modifier, leading: @Composable RowScope.() -> Unit, trailing: @Composable RowScope.() -> Unit) {
    Row(modifier, verticalAlignment = Alignment.Top) {
        leading()
        Spacer(Modifier.weight(1f))
        trailing()
    }
}

@Composable
private fun CompactStage(
    outer: Boolean,
    onObstruction: (Double) -> Unit,
    leading: @Composable RowScope.() -> Unit,
    trailing: @Composable RowScope.() -> Unit,
    floating: (@Composable ColumnScope.() -> Unit)?,
    sheetKey: Any?,
    sheet: (@Composable ColumnScope.() -> Unit)?,
) {
    val density = LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val totalPx = constraints.maxHeight.toFloat()
        val totalH = maxHeight
        TopBar(
            Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
                .padding(horizontal = 12.dp, vertical = 4.dp),
            leading, trailing,
        )
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .widthIn(max = 560.dp)
                .fillMaxWidth()
                .onGloballyPositioned { c ->
                    val top = c.positionInParent().y
                    onObstruction(((totalPx - top) / density.density + 8.0).coerceAtLeast(0.0))
                },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (floating != null) {
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = Metrics.gutter).padding(bottom = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    content = floating,
                )
            }
            if (sheet != null) {
                // 外屏矮：半开要高一点
                BottomSheetPanel(peek = totalH * (if (outer) 0.46f else 0.36f), max = totalH * 0.86f, resetKey = sheetKey, content = sheet)
            } else {
                Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.navigationBars))
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

/** 底部抽屉：半开（peek）/ 全开（贴内容，最多 max）；拖把手或点把手切换，内容在全开时滚动 */
@Composable
fun BottomSheetPanel(peek: Dp, max: Dp, resetKey: Any?, content: @Composable ColumnScope.() -> Unit) {
    val density = LocalDensity.current
    val p = LocalEo.current
    val i18n = LocalI18n.current
    val scope = rememberCoroutineScope()
    val handle = 28.dp
    val navBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    var contentPx by remember { mutableIntStateOf(0) }
    val maxPx = with(density) { max.toPx() }
    val fullPx = min(contentPx + with(density) { (handle + navBottom).toPx() }, maxPx)
    val peekPx = min(with(density) { peek.toPx() }, fullPx)
    var expanded by remember(resetKey) { mutableStateOf(false) }
    val height = remember { Animatable(with(density) { peek.toPx() }) }

    LaunchedEffect(fullPx, peekPx, expanded) {
        if (fullPx <= 0f) return@LaunchedEffect
        height.animateTo(if (expanded) fullPx else peekPx, spring(stiffness = 600f))
    }
    val drag = rememberDraggableState { delta ->
        scope.launch { height.snapTo((height.value - delta).coerceIn(peekPx, maxOf(peekPx, fullPx))) }
    }
    val scroll = rememberScrollState()
    val shape = RoundedCornerShape(topStart = Tokens.RadiusSheet, topEnd = Tokens.RadiusSheet)
    Column(
        Modifier
            .fillMaxWidth()
            .height(with(density) { height.value.toDp() })
            .glassSurface(shape)
            .draggable(drag, Orientation.Vertical, onDragStopped = { v ->
                val mid = (peekPx + fullPx) / 2
                expanded = when {
                    v < -900f -> true
                    v > 900f -> false
                    else -> height.value > mid
                }
                height.animateTo(if (expanded) fullPx else peekPx, spring(stiffness = 600f))
            }),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(handle)
                .clickable(role = Role.Button, onClickLabel = i18n.t("sheet.toggle")) { expanded = !expanded },
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(36.dp, 5.dp).clip(CircleShape).background(p.grab))
        }
        Column(Modifier.weight(1f).verticalScroll(scroll, enabled = expanded || fullPx <= peekPx + 1f)) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .onSizeChanged { contentPx = it.height }
                    .padding(start = Metrics.gutter, end = Metrics.gutter, bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                content = content,
            )
            Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.navigationBars))
        }
    }
}

/** 两页 / 三页：内容停在第一页，图标在世界那一页的右上 */
@Composable
private fun PanedStage(
    layout: LayoutSnapshot,
    leading: @Composable RowScope.() -> Unit,
    trailing: @Composable RowScope.() -> Unit,
    floating: (@Composable ColumnScope.() -> Unit)?,
    sheet: (@Composable ColumnScope.() -> Unit)?,
) {
    val panes = layout.layout.panes
    val first = panes[0]
    val world = panes.getOrElse(1) { first }
    Box(Modifier.fillMaxSize()) {
        // 第一页：左上返回，内容贴底（太高就滚动）
        Box(
            Modifier
                .offset(x = first.x.dp)
                .width(min(first.w.dp, Metrics.paneMaxWidth + Metrics.gutter * 2))
                .fillMaxHeight()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Vertical + WindowInsetsSides.Start))
                .padding(horizontal = Metrics.gutter, vertical = 8.dp),
        ) {
            Row(Modifier.align(Alignment.TopStart), content = leading)
            PaneContent(Modifier.padding(top = Metrics.touch + 8.dp), floating, sheet)
        }
        // 世界那一页的右上：图标
        Row(
            Modifier
                .offset(x = world.x.dp)
                .width(world.w.dp)
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.End))
                .padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.End,
        ) { trailing() }
    }
}

/** 半开悬停：上半屏世界与图标，下半屏内容（正好在折痕下面） */
@Composable
private fun HoverStage(
    layout: LayoutSnapshot,
    leading: @Composable RowScope.() -> Unit,
    trailing: @Composable RowScope.() -> Unit,
    floating: (@Composable ColumnScope.() -> Unit)?,
    sheet: (@Composable ColumnScope.() -> Unit)?,
) {
    val panes = layout.layout.panes
    val lower = panes.getOrElse(1) { panes[0] }   // hover 的 Pane：x 是顶边 y，w 是高
    Box(Modifier.fillMaxSize()) {
        TopBar(
            Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
                .padding(horizontal = 12.dp, vertical = 4.dp),
            leading, trailing,
        )
        Box(
            Modifier
                .offset(y = lower.x.dp)
                .height(lower.w.dp)
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal))
                .padding(horizontal = Metrics.gutter, vertical = 8.dp),
            contentAlignment = Alignment.BottomCenter,
        ) {
            PaneContent(Modifier.widthIn(max = 560.dp), floating, sheet)
        }
    }
}

/** 停靠在一页里的内容：浮着的东西 + 一张玻璃卡（太高就在卡里滚动） */
@Composable
private fun PaneContent(modifier: Modifier, floating: (@Composable ColumnScope.() -> Unit)?, sheet: (@Composable ColumnScope.() -> Unit)?) {
    Column(
        modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.Bottom),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (floating != null) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), content = floating)
        }
        if (sheet != null) {
            Column(
                Modifier
                    .weight(1f, fill = false)
                    .fillMaxWidth()
                    .glassSurface(RoundedCornerShape(Tokens.RadiusL))
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                content = sheet,
            )
        }
    }
}
