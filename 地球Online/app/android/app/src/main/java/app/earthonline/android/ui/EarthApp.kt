package app.earthonline.android.ui

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.Page
import app.earthonline.android.app.PickPurpose
import app.earthonline.android.app.Sheet
import app.earthonline.android.app.Stage
import app.earthonline.android.gen.Tokens
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.layout.LayoutSnapshot
import app.earthonline.android.layout.rememberLayout
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Settings
import app.earthonline.android.ui.components.PickBar
import app.earthonline.android.ui.components.SheetHost
import app.earthonline.android.ui.components.Toast
import app.earthonline.android.ui.screens.AvatarScreen
import app.earthonline.android.ui.screens.BookOverlay
import app.earthonline.android.ui.screens.DayOverlay
import app.earthonline.android.ui.screens.DiaryScreen
import app.earthonline.android.ui.screens.FootprintsScreen
import app.earthonline.android.ui.screens.HomeOverlay
import app.earthonline.android.ui.screens.NewTripSheet
import app.earthonline.android.ui.screens.PaywallSheet
import app.earthonline.android.ui.screens.SettingsScreen
import app.earthonline.android.ui.screens.ShelfScreen
import app.earthonline.android.ui.screens.StopDetailSheet
import app.earthonline.android.ui.screens.stopTitle
import app.earthonline.android.ui.theme.EoTheme
import app.earthonline.android.world.WorldHost

/**
 * 根：世界层铺满整屏（主画面）+ 舞台上的界面（首页 / 书 / 某一天）或压栈的整页 + 弹层 + 顶部提示。
 * 每次屏幕形态变化都发 set-layout；一页时由抽屉的顶边、其余由分页算出的留白发 set-insets（AppModel 去抖）。
 * 天色：core 的 skyPhase（外观设置、系统深浅、此刻、家的位置）→ set-sky day / dusk / night。
 */
@Composable
fun EarthApp(model: AppModel) {
    val state by model.store.state.collectAsStateWithLifecycle()
    val settings = state.settings ?: Settings.DEFAULT
    val systemDark = isSystemInDarkTheme()
    val night = when (settings.theme) { "dark" -> true; "light" -> false; else -> systemDark }
    LaunchedEffect(settings.theme, systemDark) { model.refreshSky(settings.theme, systemDark) }   // 天色按 core 的 skyPhase（含晨昏）

    // 状态栏的字：夜里白、白天墨（天色背景是固定的两套）
    val view = LocalView.current
    SideEffect {
        val window = (view.context as? Activity)?.window ?: return@SideEffect
        val c = WindowCompat.getInsetsController(window, view)
        c.isAppearanceLightStatusBars = !night
        c.isAppearanceLightNavigationBars = !night
    }

    val layout = rememberLayout()
    LaunchedEffect(layout) { model.onLayout(layout) }
    BackHandler(enabled = model.canGoBack) { model.back() }

    EoTheme(night) {
        CompositionLocalProvider(LocalI18n provides model.i18n) {
            Box(Modifier.fillMaxSize().background(Tokens.SpaceBg[if (night) "night" else "day"] ?: Color.Black)) {
                WorldHost(model.world, Modifier.fillMaxSize())
                val page = model.pages.lastOrNull()
                if (page == null) {
                    if (model.picking == null) StageOverlay(model, layout, state)
                } else {
                    PageHost(model, page, state)
                }
                model.sheet?.let { s -> SheetLayer(model, layout, state, s) }
                model.picking?.let { purpose ->
                    val i18n = model.i18n
                    PickBar(
                        text = i18n.t(if (purpose == PickPurpose.HOME) "fp.pickHome" else "fp.pickVisited"),
                        cancel = i18n.t("common.cancel"),
                        onCancel = { model.cancelPick() },
                        modifier = Modifier.align(Alignment.TopCenter),
                    )
                }
                model.toast?.let { Toast(it, Modifier.align(Alignment.TopCenter)) }
            }
        }
    }
}

@Composable
private fun StageOverlay(model: AppModel, layout: LayoutSnapshot, state: PersistedState) {
    when (val s = model.stage) {
        Stage.Home -> HomeOverlay(model, layout, state)
        is Stage.Book -> BookOverlay(model, layout, state, s.id)
        is Stage.Day -> DayOverlay(model, layout, state, s.id, s.index)
    }
}

@Composable
private fun PageHost(model: AppModel, page: Page, state: PersistedState) {
    when (page) {
        Page.Settings -> SettingsScreen(model, state)
        is Page.Diary -> DiaryScreen(model, state, page.id)
        Page.Footprints -> FootprintsScreen(model, state)
        Page.Shelf -> ShelfScreen(model, state)
        Page.Avatar -> AvatarScreen(model, state)
    }
}

@Composable
private fun SheetLayer(model: AppModel, layout: LayoutSnapshot, state: PersistedState, s: Sheet) {
    val i18n = model.i18n
    val title = when (s) {
        is Sheet.NewTrip -> i18n.t("home.newTrip")
        is Sheet.Paywall -> i18n.t("pay.title")
        is Sheet.Stop -> stopTitle(state, s)
    }
    SheetHost(layout, title, onDismiss = { model.sheet = null }) {
        when (s) {
            is Sheet.NewTrip -> NewTripSheet(model, state, s.tab)
            is Sheet.Paywall -> PaywallSheet(model, s.reason)
            is Sheet.Stop -> StopDetailSheet(model, state, s)
        }
    }
}
