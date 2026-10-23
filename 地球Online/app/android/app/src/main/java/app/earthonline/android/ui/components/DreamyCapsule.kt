package app.earthonline.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.earthonline.android.gen.Tokens
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.Fixed
import app.earthonline.android.ui.theme.LocalNight
import app.earthonline.android.ui.theme.Metrics

/**
 * 「新建旅程」：浮在地球上的胶囊，全应用唯一带颜色的按钮（iOS DreamyCapsuleButton 的移植）。
 * 蜜 → 晨 → 琥珀，只有晨色一个色相；白色四角星光；墨色字；夜里底深一档；一道白色渐变的玻璃边。
 * 颗粒噪点（iOS 的 GrainTexture）这一版没做。
 */
@Composable
fun DreamyCapsule(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val night = LocalNight.current
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val colors = if (night) Tokens.DreamNight else Tokens.DreamDay   // 蜜 → 晨 → 琥珀（shared/world/tokens.ts）
    Box(
        modifier
            .scale(if (pressed) 0.97f else 1f)
            .shadow(16.dp, CircleShape, clip = false, ambientColor = if (night) Color.Black else colors.last(), spotColor = if (night) Color.Black else colors.last())
            .clip(CircleShape)
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick)
            .height(Metrics.capsuleHeight),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.matchParentSize()) {
            drawRect(Brush.horizontalGradient(colors))
            // 沙画的笔触：一道很淡的斜向晕染
            drawRect(Brush.linearGradient(listOf(Color.White.copy(alpha = 0f), Color.White.copy(alpha = 0.10f), Color.White.copy(alpha = 0f)), Offset.Zero, Offset(size.width, size.height)))
            // 5 颗四角星光（位置固定）
            for ((fx, fy, r, o) in STARS) {
                val c = Offset(fx * size.width, fy * size.height)
                val rr = r * density
                val k = rr * 0.28f
                val p = Path().apply {
                    moveTo(c.x, c.y - rr * 1.6f); lineTo(c.x + k, c.y - k); lineTo(c.x + rr * 1.6f, c.y); lineTo(c.x + k, c.y + k)
                    lineTo(c.x, c.y + rr * 1.6f); lineTo(c.x - k, c.y + k); lineTo(c.x - rr * 1.6f, c.y); lineTo(c.x - k, c.y - k); close()
                }
                drawPath(p, Color.White.copy(alpha = o))
            }
        }
        Box(
            Modifier
                .matchParentSize()
                .border(1.2.dp, Brush.linearGradient(listOf(Color.White.copy(alpha = 0.95f), Color.White.copy(alpha = 0.2f), Color.White.copy(alpha = 0.7f))), CircleShape),
        )
        Row(
            Modifier.padding(horizontal = 22.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = Fixed.dreamInk, modifier = Modifier.size(20.dp))
            Text(text, style = EoType.title, color = Fixed.dreamInk, maxLines = 1)
        }
    }
}

private data class Star(val x: Float, val y: Float, val r: Float, val o: Float)

private val STARS = listOf(
    Star(0.08f, 0.30f, 2.4f, 0.9f), Star(0.22f, 0.74f, 1.6f, 0.7f), Star(0.47f, 0.18f, 1.8f, 0.8f),
    Star(0.71f, 0.70f, 2.2f, 0.85f), Star(0.90f, 0.28f, 1.5f, 0.7f),
)
