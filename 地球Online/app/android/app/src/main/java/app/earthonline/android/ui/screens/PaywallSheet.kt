package app.earthonline.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.ui.components.GlassCapsuleButton
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo

/**
 * 付费墙（占位）：碰到了什么限制（pay.reason.*）→ 四行 Pro 权益（和这次限制对应的排第一）→「以后再说」。
 * TODO(billing)：Google Play 结算（BillingClient）还没接：没有价格、没有购买按钮（显示 pay.nativePending）；接好后照网页 paywall.ts 补按月 / 按年、
 * 价格用 Play 返回的本地化价格，权益用 core entitlement(activeProductIds) 算。
 * 免费版的额度（3 本、每月 2 次 AI 规划）与 Pro 的 AI 次数都从 core 拿，不在这里写死。
 */
@Composable
fun PaywallSheet(model: AppModel, reason: String) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val freeTrips by produceState<Int?>(null) { value = runCatching { model.core.quota("free", emptyList(), model.today).limit }.getOrNull() }
    val freeAi by produceState<Int?>(null) { value = runCatching { model.core.aiPlansLeft("free", 0) }.getOrNull() }
    val proAi by produceState<Int?>(null) { value = runCatching { model.core.aiPlansLeft("pro", 0) }.getOrNull() }

    val n = if (reason == "ai") freeAi else freeTrips
    val why = if (i18n.has("pay.reason.$reason")) i18n.t("pay.reason.$reason", "n" to (n ?: "")) else reason
    Text(why, style = EoType.body, color = p.mist)

    val first = when (reason) { "ai" -> "ai"; "sync" -> "sync"; "trips" -> "trips"; else -> "extras" }
    val order = listOf("trips", "ai", "sync", "extras").sortedBy { if (it == first) 0 else 1 }
    order.forEach { k ->
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(
                when (k) { "trips" -> Icons.Filled.Book; "ai" -> Icons.Filled.Mic; "sync" -> Icons.Filled.Refresh; else -> Icons.Filled.Star },
                contentDescription = null, tint = if (k == first) p.dawnInk else p.mist, modifier = Modifier.size(20.dp),
            )
            Text(i18n.t("pay.benefit.$k", "n" to (proAi ?: "")), style = if (k == first) EoType.title else EoType.body, color = p.ink)
        }
    }
    // 应用内购买还没接上：一句说明，代替价格与购买按钮
    Text(i18n.t("pay.nativePending"), style = EoType.sub, color = p.mist)
    GlassCapsuleButton(i18n.t("pay.later"), modifier = Modifier.fillMaxWidth()) { model.sheet = null }
}
