package app.earthonline.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.gen.Shared
import app.earthonline.android.gen.Tokens
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.Avatar
import app.earthonline.android.model.PersistedState
import app.earthonline.android.ui.components.Chip
import app.earthonline.android.ui.components.EoTextField
import app.earthonline.android.ui.components.PageScaffold
import app.earthonline.android.ui.components.SectionHeader
import app.earthonline.android.ui.components.Segmented
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.ui.theme.Metrics

/** 捏人：名字、形态（AVATAR_FORMS）、发型、帽子、五排色块（Tokens.SkinColors … ShoesColors，与 shared/world/hero.ts 同一份）、行李箱的样式。世界里的小人实时变（set-avatar） */
@Composable
fun AvatarScreen(model: AppModel, state: PersistedState) {
    val i18n = LocalI18n.current
    val a = state.avatar ?: model.avatar
    var name by remember { mutableStateOf(a.name) }
    fun save(next: Avatar) = model.updateAvatar(next)

    PageScaffold(i18n.t("avatar.title"), onBack = { model.back() }) {
        SectionHeader(i18n.t("avatar.name"))
        EoTextField(name, { v ->
            name = v.take(12)
            save(a.copy(name = name.trim().ifEmpty { i18n.t("avatar.defaultName") }))
        }, i18n.t("avatar.name"), modifier = Modifier.fillMaxWidth())

        SectionHeader(i18n.t("avatar.form"))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Shared.AVATAR_FORMS.forEach { f ->
                Chip(i18n.t("avatar.form.$f"), selected = (a.form ?: "human") == f) {
                    save(a.copy(form = f.takeIf { it != "human" }))
                }
            }
        }

        SectionHeader(i18n.t("avatar.hair"))
        Segmented(listOf("bun" to i18n.t("avatar.hairBun"), "long" to i18n.t("avatar.hairLong"), "short" to i18n.t("avatar.hairShort")), a.hair) {
            save(a.copy(hair = it))
        }
        SectionHeader(i18n.t("avatar.hat"))
        Segmented(listOf("straw" to i18n.t("avatar.hatStraw"), "cap" to i18n.t("avatar.hatCap"), "none" to i18n.t("avatar.hatNone")), a.hat) {
            save(a.copy(hat = it))
        }

        SwatchRow(i18n.t("avatar.skin"), Tokens.SkinColors, a.skin) { save(a.copy(skin = it)) }
        SwatchRow(i18n.t("avatar.hairColor"), Tokens.HairColors, a.hairColor) { save(a.copy(hairColor = it)) }
        SwatchRow(i18n.t("avatar.dress"), Tokens.DressColors, a.dress) { save(a.copy(dress = it)) }
        SwatchRow(i18n.t("avatar.hatColor"), Tokens.HatColors, a.hatColor) { save(a.copy(hatColor = it)) }
        SwatchRow(i18n.t("avatar.shoes"), Tokens.ShoesColors, a.shoes) { save(a.copy(shoes = it)) }

        SectionHeader(i18n.t("case.styleLabel"))
        Segmented(Shared.SUITCASE_STYLES.map { it to i18n.t("case.style.$it") }, a.suitcase ?: "sand") {
            save(a.copy(suitcase = it))
        }
    }
}

@Composable
private fun SwatchRow(part: String, colors: List<Color>, selected: Int, onPick: (Int) -> Unit) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    SectionHeader(part)
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        colors.forEachIndexed { i, c ->
            val on = i == selected
            val label = i18n.t("avatar.swatch", "part" to part, "n" to i + 1)
            Box(
                Modifier
                    .size(Metrics.touch)
                    .clip(CircleShape)
                    .clickable(role = Role.RadioButton, onClick = { onPick(i) })
                    .semantics { contentDescription = label; this.selected = on },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier.size(36.dp).background(c, CircleShape).border(if (on) 2.dp else 1.dp, if (on) p.ink else p.line, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (on) Icon(Icons.Filled.Check, contentDescription = null, tint = if (c.lum() > 0.5f) p.ink else Color.White, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

private fun Color.lum(): Float = 0.2126f * red + 0.7152f * green + 0.0722f * blue
