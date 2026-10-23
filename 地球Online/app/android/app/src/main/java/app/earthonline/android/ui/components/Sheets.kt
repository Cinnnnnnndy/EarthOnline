package app.earthonline.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import app.earthonline.android.gen.Tokens
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.layout.LayoutSnapshot
import app.earthonline.android.layout.LayoutState
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.ui.theme.Metrics

/**
 * 弹层（站点详情、新建旅程、付费墙）放在哪：
 *  - triple：第三页（不再盖在世界上，也不加遮罩）；
 *  - spread：第一页的底部；
 *  - hover：下半屏；
 *  - phone / outer：底部弹出，贴内容高度，最多 90%。
 * 返回键由 EarthApp 统一处理（先关弹层）。
 */
@Composable
fun SheetHost(layout: LayoutSnapshot, title: String?, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val panes = layout.layout.panes
    when (layout.state) {
        LayoutState.TRIPLE -> {
            val third = panes.getOrElse(2) { panes.last() }
            Box(
                Modifier
                    .offset(x = third.x.dp)
                    .width(third.w.dp)
                    .fillMaxHeight()
                    .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Vertical + WindowInsetsSides.End))
                    .padding(12.dp)
                    .imePadding(),
            ) {
                SheetPanel(title, onDismiss, RoundedCornerShape(Tokens.RadiusL), Modifier.fillMaxSize(), content)
            }
        }
        else -> {
            Scrim(onDismiss)
            BoxWithConstraints(Modifier.fillMaxSize().imePadding()) {
                val maxH = maxHeight * 0.9f
                when (layout.state) {
                    LayoutState.SPREAD -> {
                        val first = panes[0]
                        Box(
                            Modifier
                                .offset(x = first.x.dp)
                                .width(min(first.w.dp, 480.dp))
                                .fillMaxHeight()
                                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Start)),
                            contentAlignment = Alignment.BottomCenter,
                        ) {
                            SheetPanel(title, onDismiss, TopRounded, Modifier.fillMaxWidth().heightIn(max = maxH), content, bottomInset = true)
                        }
                    }
                    LayoutState.HOVER -> {
                        val lower = panes.getOrElse(1) { panes[0] }
                        Box(
                            Modifier.offset(y = lower.x.dp).fillMaxWidth().heightIn(max = lower.w.dp).fillMaxHeight(),
                            contentAlignment = Alignment.BottomCenter,
                        ) {
                            SheetPanel(title, onDismiss, TopRounded, Modifier.widthIn(max = 560.dp).fillMaxWidth(), content, bottomInset = true)
                        }
                    }
                    else -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
                            SheetPanel(title, onDismiss, TopRounded, Modifier.widthIn(max = 560.dp).fillMaxWidth().heightIn(max = maxH), content, bottomInset = true)
                        }
                    }
                }
            }
        }
    }
}

private val TopRounded = RoundedCornerShape(topStart = Tokens.RadiusSheet, topEnd = Tokens.RadiusSheet)

@Composable
private fun Scrim(onDismiss: () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.28f))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss),
    )
}

@Composable
private fun SheetPanel(
    title: String?,
    onDismiss: () -> Unit,
    shape: androidx.compose.ui.graphics.Shape,
    modifier: Modifier,
    content: @Composable ColumnScope.() -> Unit,
    bottomInset: Boolean = false,
) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    Column(
        modifier
            .glassSurface(shape)
            // 弹层的底比卡片实一点：叠在玻璃抽屉上也看得清
            .background(p.sheet)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = {}),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 4.dp, top = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                title.orEmpty(), style = EoType.title, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            PlainIconButton(Icons.Filled.Close, i18n.t("common.close"), onClick = onDismiss)
        }
        Column(
            Modifier
                .weight(1f, fill = false)
                .verticalScroll(rememberScrollState())
                .padding(start = 20.dp, end = 20.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = content,
        )
        if (bottomInset) Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.navigationBars))
    }
}

/** 压栈的整页（设置、日记、足迹、全部旅程、小人）：不透明的纸底，左上返回，标题；内容自己滚动 */
@Composable
fun PageScaffold(title: String, onBack: () -> Unit, actions: @Composable () -> Unit = {}, content: @Composable ColumnScope.() -> Unit) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    Column(
        Modifier
            .fillMaxSize()
            .background(p.paper)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = {}),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
                .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlainIconButton(Icons.AutoMirrored.Filled.ArrowBack, i18n.t("common.close"), onClick = onBack)
            Text(title, style = EoType.title, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).semantics { heading() })
            actions()
        }
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal))
                .imePadding()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            content = content,
        )
    }
}

/** 一组设置 / 列表：白底圆角块（夜里是浅一档的玻璃） */
@Composable
fun Group(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalEo.current
    Column(
        modifier
            .fillMaxWidth()
            .background(p.listStrong, RoundedCornerShape(Tokens.RadiusM))
            .padding(horizontal = 16.dp, vertical = 4.dp),
        content = content,
    )
}

/** 顶部的提示条（2.6 秒后消失，由 AppModel 控制） */
@Composable
fun Toast(text: String, modifier: Modifier = Modifier) {
    val p = LocalEo.current
    Box(
        modifier
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top))
            .padding(top = 8.dp, start = Metrics.gutter, end = Metrics.gutter)
            .glassSurface(CircleShape)
            .padding(horizontal = 18.dp, vertical = 10.dp),
    ) {
        Text(text, style = EoType.body, color = p.ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** 在地球上点选时顶部的提示条：说明 + 取消 */
@Composable
fun PickBar(text: String, cancel: String, onCancel: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalEo.current
    Row(
        modifier
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top))
            .padding(top = 8.dp, start = Metrics.gutter, end = Metrics.gutter)
            .glassSurface(CircleShape)
            .padding(start = 18.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(text, style = EoType.body, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        TextAction(cancel, onClick = onCancel)
    }
}
