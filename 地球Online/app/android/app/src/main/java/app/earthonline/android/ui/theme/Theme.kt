package app.earthonline.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.earthonline.android.gen.EoPalette
import app.earthonline.android.gen.Tokens

/**
 * 设计令牌 → Compose 主题（视觉风格 §15、ios/README「设计要点」）：
 *  - 没有紫色、没有蓝紫强调色：能点的、选中的都是墨（白天 #1D1E23、夜里白）；
 *  - 高亮色只有晨（#F0B03A）：只用于「现在」和「去过」；
 *  - 字号只有两档 17 / 13，标题与按钮 SemiBold，正文 Normal。
 * Material3 的组件（输入框、开关、菜单、对话框）全部换成这套颜色，避免露出默认的紫色。
 */
val LocalEo = staticCompositionLocalOf { Tokens.Day }
val LocalNight = staticCompositionLocalOf { false }

object EoType {
    val title = TextStyle(fontSize = Tokens.FontBody, fontWeight = FontWeight.SemiBold, lineHeight = 24.sp)
    val body = TextStyle(fontSize = Tokens.FontBody, fontWeight = FontWeight.Normal, lineHeight = 24.sp)
    val sub = TextStyle(fontSize = Tokens.FontSub, fontWeight = FontWeight.Normal, lineHeight = 18.sp)
    val subStrong = TextStyle(fontSize = Tokens.FontSub, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp)
}

/** 布局常量（与 iOS Metrics 一致；触控目标按安卓的 48dp） */
object Metrics {
    val gutter = 16.dp
    val touch = 48.dp
    val cardMaxWidth = 420.dp
    /** 两页 / 三页时停靠在左页的内容最宽 400 */
    val paneMaxWidth = 400.dp
    val capsuleHeight = 48.dp
}

/** 票与梦幻胶囊上的固定色（票在夜里也是白纸墨字；胶囊的渐变在 Tokens.DreamDay / DreamNight，字是固定的深墨） */
object Fixed {
    val ticketInk = Tokens.Day.ink
    val ticketInk2 = Tokens.Day.ink2
    val dreamInk = Color(0xFF1E2640)
}

/** 墨色按钮上的字：白天白字，夜里（墨是白）用深色纸 */
val EoPalette.onInk: Color get() = if (ink.luminanceApprox() > 0.5f) Tokens.Night.paper else Tokens.Day.white

private fun Color.luminanceApprox(): Float = 0.2126f * red + 0.7152f * green + 0.0722f * blue

@Composable
fun EoTheme(night: Boolean, content: @Composable () -> Unit) {
    val p = if (night) Tokens.Night else Tokens.Day
    val scheme = if (night) {
        darkColorScheme(
            primary = p.ink, onPrimary = p.onInk, primaryContainer = p.fill, onPrimaryContainer = p.ink,
            secondary = p.ink2, onSecondary = p.onInk, secondaryContainer = p.fill, onSecondaryContainer = p.ink,
            tertiary = p.dawn, onTertiary = Tokens.Day.ink, tertiaryContainer = p.dawnSoft, onTertiaryContainer = p.dawnInk,
            background = p.paper, onBackground = p.ink, surface = p.paper, onSurface = p.ink,
            surfaceVariant = p.fill, onSurfaceVariant = p.mist, surfaceTint = Color.Transparent,
            surfaceContainer = p.sheet, surfaceContainerHigh = p.sheet, surfaceContainerHighest = p.sheet,
            surfaceContainerLow = p.sheet, surfaceContainerLowest = p.paper,
            outline = p.line, outlineVariant = p.line, error = p.danger, onError = Tokens.Day.white,
            inverseSurface = p.ink, inverseOnSurface = p.paper, inversePrimary = p.ink2, scrim = Color.Black,
        )
    } else {
        lightColorScheme(
            primary = p.ink, onPrimary = p.onInk, primaryContainer = p.fill, onPrimaryContainer = p.ink,
            secondary = p.ink2, onSecondary = p.onInk, secondaryContainer = p.fill, onSecondaryContainer = p.ink,
            tertiary = p.dawn, onTertiary = p.ink, tertiaryContainer = p.dawnSoft, onTertiaryContainer = p.dawnInk,
            background = p.paper, onBackground = p.ink, surface = p.paper, onSurface = p.ink,
            surfaceVariant = p.fill, onSurfaceVariant = p.mist, surfaceTint = Color.Transparent,
            surfaceContainer = p.white, surfaceContainerHigh = p.white, surfaceContainerHighest = p.white,
            surfaceContainerLow = p.paper, surfaceContainerLowest = p.white,
            outline = p.line, outlineVariant = p.line, error = p.danger, onError = Tokens.Day.white,
            inverseSurface = p.ink, inverseOnSurface = p.paper, inversePrimary = p.ink2, scrim = Color.Black,
        )
    }
    val typography = Typography(
        displayLarge = EoType.title, displayMedium = EoType.title, displaySmall = EoType.title,
        headlineLarge = EoType.title, headlineMedium = EoType.title, headlineSmall = EoType.title,
        titleLarge = EoType.title, titleMedium = EoType.title, titleSmall = EoType.title,
        bodyLarge = EoType.body, bodyMedium = EoType.body, bodySmall = EoType.sub,
        labelLarge = EoType.title, labelMedium = EoType.sub, labelSmall = EoType.sub,
    )
    CompositionLocalProvider(LocalEo provides p, LocalNight provides night) {
        MaterialTheme(colorScheme = scheme, typography = typography, content = content)
    }
}
