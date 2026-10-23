package app.earthonline.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.earthonline.android.gen.Tokens
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.ui.theme.Metrics
import app.earthonline.android.ui.theme.onInk

/**
 * 玻璃面（卡片、底部抽屉、图标按钮的底）：半透明的白（夜里是深蓝）+ 一道亮边。
 * 安卓拿不到 WebView 背后的实时模糊，所以默认用偏实的那档（glassFillStrong），保证字看得清。
 */
@Composable
fun Modifier.glassSurface(shape: Shape, strong: Boolean = true): Modifier {
    val p = LocalEo.current
    val fill = if (strong) p.glassFillStrong else p.glassFill
    return this.clip(shape).background(fill, shape).border(1.dp, p.glassRim, shape)
}

/** 贴内容的玻璃卡（最宽 420） */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    maxWidth: Dp = Metrics.cardMaxWidth,
    spacing: Dp = 8.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .widthIn(max = maxWidth)
            .glassSurface(RoundedCornerShape(Tokens.RadiusL))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(spacing),
        content = content,
    )
}

/** 玻璃圆图标按钮（44 的圆、48 的点击区），通用操作都用它；label 给读屏 */
@Composable
fun GlassIconButton(icon: ImageVector, label: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val p = LocalEo.current
    Box(
        modifier
            .size(Metrics.touch)
            .clip(CircleShape)
            .clickable(enabled = enabled, role = Role.Button, onClickLabel = label, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(44.dp).glassSurface(CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = if (enabled) p.ink else p.mist2, modifier = Modifier.size(22.dp))
        }
    }
}

/** 右上的一组玻璃图标 */
@Composable
fun GlassIconBar(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically, content = content)
}

/** 卡片里的图标按钮（无底，48 的点击区） */
@Composable
fun PlainIconButton(icon: ImageVector, label: String, modifier: Modifier = Modifier, tint: Color? = null, enabled: Boolean = true, onClick: () -> Unit) {
    val p = LocalEo.current
    Box(
        modifier
            .size(Metrics.touch)
            .clip(CircleShape)
            .clickable(enabled = enabled, role = Role.Button, onClickLabel = label, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = if (!enabled) p.mist2 else tint ?: p.ink, modifier = Modifier.size(22.dp))
    }
}

/** 主按钮：墨色小胶囊（一屏最多一个） */
@Composable
fun InkCapsuleButton(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, enabled: Boolean = true, onClick: () -> Unit) {
    val p = LocalEo.current
    Row(
        modifier
            .heightIn(min = Metrics.touch)
            .clip(CircleShape)
            .background(if (enabled) p.ink else p.fill, CircleShape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val fg = if (enabled) p.onInk else p.mist2
        if (icon != null) Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(20.dp))
        Text(text, style = EoType.title, color = fg, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** 次按钮：玻璃胶囊 */
@Composable
fun GlassCapsuleButton(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, enabled: Boolean = true, onClick: () -> Unit) {
    val p = LocalEo.current
    Row(
        modifier
            .heightIn(min = Metrics.touch)
            .glassSurface(CircleShape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val fg = if (enabled) p.ink else p.mist2
        if (icon != null) Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(20.dp))
        Text(text, style = EoType.title, color = fg, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** 文字按钮（第三级） */
@Composable
fun TextAction(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, onClick: () -> Unit) {
    val p = LocalEo.current
    Row(
        modifier
            .heightIn(min = Metrics.touch)
            .clip(RoundedCornerShape(Tokens.RadiusS))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = p.ink, modifier = Modifier.size(20.dp))
        Text(text, style = EoType.body, color = p.ink)
    }
}

/** 同一类信息的小标签（状态、D2、类型、到期日）：13 号；「现在」用晨色 */
@Composable
fun Tag(text: String, modifier: Modifier = Modifier, live: Boolean = false, icon: ImageVector? = null) {
    val p = LocalEo.current
    Row(
        modifier
            .defaultMinSize(minHeight = 22.dp)
            .clip(CircleShape)
            .background(if (live) p.dawnSoft else p.fill, CircleShape)
            .padding(horizontal = 8.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val fg = if (live) p.dawnInk else p.ink2
        if (icon != null) Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(12.dp))
        Text(text, style = EoType.subStrong, color = fg, maxLines = 1)
    }
}

/** 可选的小胶囊（主题、场景）：选中是墨底，未选是浅填充 */
@Composable
fun Chip(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val p = LocalEo.current
    Box(
        modifier
            .heightIn(min = Metrics.touch)
            .clip(CircleShape)
            .background(if (selected) p.ink else p.fill, CircleShape)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = if (selected) EoType.subStrong else EoType.sub, color = if (selected) p.onInk else p.ink, maxLines = 1)
    }
}

/** 分段控件：未选是浅填充，选中是白块（夜里是亮一档的玻璃） */
@Composable
fun <T> Segmented(options: List<Pair<T, String>>, selected: T, modifier: Modifier = Modifier, onSelect: (T) -> Unit) {
    val p = LocalEo.current
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Tokens.RadiusM))
            .background(p.fill, RoundedCornerShape(Tokens.RadiusM))
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEach { (value, label) ->
            val on = value == selected
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 42.dp)
                    .clip(RoundedCornerShape(Tokens.RadiusS))
                    .background(if (on) p.segOn else Color.Transparent, RoundedCornerShape(Tokens.RadiusS))
                    .clickable(role = Role.RadioButton, onClick = { onSelect(value) })
                    .semantics { contentDescription = label },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = if (on) EoType.subStrong else EoType.sub, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 6.dp))
            }
        }
    }
}

/** 输入框：浅填充的圆角框，墨色光标；placeholder 是 13 号雾色 */
@Composable
fun EoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    minLines: Int = 1,
    leading: ImageVector? = null,
    imeAction: ImeAction = ImeAction.Done,
    onSubmit: (() -> Unit)? = null,
) {
    val p = LocalEo.current
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = singleLine,
        minLines = if (singleLine) 1 else minLines,
        textStyle = EoType.body.copy(color = p.ink),
        cursorBrush = SolidColor(p.ink),
        keyboardOptions = KeyboardOptions(imeAction = imeAction),
        keyboardActions = KeyboardActions(onAny = { onSubmit?.invoke() }),
        modifier = modifier.semantics { contentDescription = placeholder },
        decorationBox = { inner ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Metrics.touch)
                    .clip(RoundedCornerShape(Tokens.RadiusM))
                    .background(p.field, RoundedCornerShape(Tokens.RadiusM))
                    .border(1.dp, p.line, RoundedCornerShape(Tokens.RadiusM))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (leading != null) Icon(leading, contentDescription = null, tint = p.mist, modifier = Modifier.size(20.dp))
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, style = EoType.body, color = p.mist2, maxLines = if (singleLine) 1 else 3, overflow = TextOverflow.Ellipsis)
                    inner()
                }
            }
        },
    )
}

/** 分组的小标题（13 号次要色） */
@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(text, style = EoType.sub, color = LocalEo.current.mist, modifier = modifier.padding(top = 12.dp, bottom = 4.dp))
}

/** 列表行：图标、标题、右边的说明或箭头；整行可点，高 ≥ 48 */
@Composable
fun ListRow(
    title: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    iconTint: Color? = null,
    subtitle: String? = null,
    trailing: String? = null,
    onClick: (() -> Unit)? = null,
    end: (@Composable RowScope.() -> Unit)? = null,
) {
    val p = LocalEo.current
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = Metrics.touch)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = iconTint ?: p.mist, modifier = Modifier.size(22.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = EoType.body, color = p.ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (!subtitle.isNullOrEmpty()) Text(subtitle, style = EoType.sub, color = p.mist, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        if (!trailing.isNullOrEmpty()) Text(trailing, style = EoType.body, color = p.mist, maxLines = 1)
        end?.invoke(this)
    }
}

/** 细分隔线 */
@Composable
fun Hairline(modifier: Modifier = Modifier, inset: Dp = 0.dp) {
    Box(modifier.padding(start = inset).fillMaxWidth().heightIn(min = 1.dp, max = 1.dp).background(LocalEo.current.line))
}

@Composable
fun VSpace(h: Dp) = Spacer(Modifier.heightIn(min = h, max = h))
