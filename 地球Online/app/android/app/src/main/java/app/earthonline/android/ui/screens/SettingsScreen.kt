package app.earthonline.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.Page
import app.earthonline.android.app.SampleRef
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Settings
import app.earthonline.android.ui.components.GlassCapsuleButton
import app.earthonline.android.ui.components.Group
import app.earthonline.android.ui.components.Hairline
import app.earthonline.android.ui.components.ListRow
import app.earthonline.android.ui.components.PageScaffold
import app.earthonline.android.ui.components.PlainIconButton
import app.earthonline.android.ui.components.SectionHeader
import app.earthonline.android.ui.components.Segmented
import app.earthonline.android.ui.components.Tag
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import app.earthonline.android.ui.theme.LocalNight
import app.earthonline.android.util.Share
import kotlinx.coroutines.launch

/** 设置：外观（天色 / 色调 / 画质）、语言、小人 / 足迹 / 全部旅程、示例行程、Pro、导出与重置 */
@Composable
fun SettingsScreen(model: AppModel, state: PersistedState) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val s = state.settings ?: Settings.DEFAULT
    var showSamples by remember { mutableStateOf(false) }
    var confirmReset by remember { mutableStateOf(false) }
    val night = LocalNight.current

    PageScaffold(i18n.t("common.settings"), onBack = { model.back() }) {
        // ---- 地球外的天色（驱动世界层的 set-sky）
        SectionHeader(i18n.t("settings.sky"))
        Segmented(
            listOf("auto" to i18n.t("settings.auto"), "light" to i18n.t("settings.day"), "dark" to i18n.t("settings.night")),
            s.theme,
        ) { model.updateSettings(s.copy(theme = it)) }
        Text(
            when (s.theme) {
                "light" -> i18n.t("settings.skyLight")
                "dark" -> i18n.t("settings.skyDark")
                else -> i18n.t("settings.skyAuto", "phase" to i18n.t(if (night) "phase.night" else "phase.day"))
            },
            style = EoType.sub, color = p.mist, modifier = Modifier.padding(top = 6.dp),
        )

        SectionHeader(i18n.t("settings.palette"))
        Segmented(
            listOf("sea" to i18n.t("settings.palSea"), "warm" to i18n.t("settings.palWarm"), "dusk" to i18n.t("settings.palDusk")),
            s.palette,
        ) { model.updateSettings(s.copy(palette = it)) }

        SectionHeader(i18n.t("settings.quality"))
        Segmented(
            listOf("high" to i18n.t("post.high"), "medium" to i18n.t("post.medium"), "low" to i18n.t("settings.qLow")),
            s.post,
        ) { model.updateSettings(s.copy(post = it)) }
        Text(
            i18n.t(when (s.post) { "medium" -> "settings.qMediumNote"; "low" -> "settings.qLowNote"; else -> "settings.qHighNote" }),
            style = EoType.sub, color = p.mist, modifier = Modifier.padding(top = 6.dp),
        )

        SectionHeader(i18n.t("settings.language"))
        Segmented(
            listOf("auto" to i18n.t("settings.auto"), "zh-Hans" to i18n.t("lang.zh-Hans"), "en" to i18n.t("lang.en"), "ja" to i18n.t("lang.ja")),
            s.lang ?: "auto",
        ) { model.updateSettings(s.copy(lang = it.takeIf { v -> v != "auto" })) }
        Text(i18n.t("settings.langNote"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(top = 6.dp))

        SectionHeader("")
        Group {
            ListRow(i18n.t("settings.avatar"), icon = Icons.Filled.Person, trailing = model.avatar.name, onClick = { model.show(Page.Avatar) })
            Hairline(inset = 34.dp)
            ListRow(i18n.t("home.footprints"), icon = Icons.Filled.Flag, trailing = state.home?.name ?: i18n.t("settings.notSet"), onClick = { model.show(Page.Footprints) })
            Hairline(inset = 34.dp)
            ListRow(i18n.t("home.allTrips"), icon = Icons.AutoMirrored.Filled.List, trailing = i18n.num(state.trips.size), onClick = { model.show(Page.Shelf) })
        }

        // ---- 示例行程库：点一本加进来
        SectionHeader(i18n.t("settings.samples"))
        Group {
            ListRow(i18n.t("settings.samples"), icon = Icons.Filled.AutoAwesome, trailing = i18n.t("settings.samplesTrail"), onClick = { showSamples = !showSamples })
            if (showSamples) Samples(model, state)
        }

        // ---- Pro（Play 结算还没接：显示名额，点开是付费墙占位）
        SectionHeader(i18n.t("settings.pro"))
        val quota by produceState<String?>(null, state.trips, model.today) {
            value = runCatching {
                val q = model.core.quota(model.plan, state.trips, model.today)
                if (q.unlimited || q.limit == null) i18n.t("settings.proOn") else i18n.t("settings.proTrips", "used" to q.used, "limit" to q.limit)
            }.getOrNull()
        }
        Group {
            ListRow(i18n.t("settings.pro"), icon = Icons.Filled.Star, trailing = quota ?: i18n.t("settings.proLearn"), onClick = { model.requestPaywall("trips") })
        }

        // ---- 数据
        SectionHeader("")
        Group {
            ListRow(i18n.t("settings.exportAll"), icon = Icons.Filled.Share, onClick = {
                Share.file(context, i18n.t("settings.exportFile"), model.allTripsJson().toByteArray(Charsets.UTF_8), "application/json")
            })
            Hairline(inset = 34.dp)
            ListRow(i18n.t("settings.reset"), icon = Icons.Filled.Restore, onClick = { confirmReset = true })
        }
        Text(i18n.t("settings.localOnly"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
    }

    if (confirmReset) {
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text(i18n.t("settings.reset"), style = EoType.title) },
            text = { Text(i18n.t("settings.resetConfirm"), style = EoType.body) },
            confirmButton = {
                TextButton(onClick = { confirmReset = false; scope.launch { model.resetToSamples() } }) { Text(i18n.t("settings.reset"), color = p.danger) }
            },
            dismissButton = { TextButton(onClick = { confirmReset = false }) { Text(i18n.t("common.cancel")) } },
        )
    }
}

/** 示例行程库：每本一行（书名是数据、类型标签、已添加 / 加号），最后「全部添加」 */
@Composable
private fun Samples(model: AppModel, state: PersistedState) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val scope = rememberCoroutineScope()
    val index by produceState(emptyList<SampleRef>()) { value = model.sampleIndex() }
    Text(i18n.t("settings.samplesNote"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(vertical = 4.dp))
    Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
        index.forEach { ref ->
            val has = state.trips.any { it.id == ref.id }
            ListRow(
                title = ref.title,
                subtitle = null,
                onClick = if (has) null else ({ scope.launch { model.addSample(ref) } }),
            ) {
                val typeKey = "sample.type.${ref.type}"
                if (i18n.has(typeKey)) Tag(i18n.t(typeKey))
                if (has) Text(i18n.t("settings.sampleAdded"), style = EoType.sub, color = p.mist)
                else PlainIconButton(Icons.Filled.Add, i18n.t("common.add")) { scope.launch { model.addSample(ref) } }
            }
        }
    }
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        GlassCapsuleButton(i18n.t("settings.sampleAddAll"), icon = Icons.Filled.Check, modifier = Modifier.fillMaxWidth()) {
            scope.launch { index.forEach { model.addSample(it) } }
        }
    }
}
