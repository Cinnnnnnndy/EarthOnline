package app.earthonline.android.ui.screens

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.NewTripTab
import app.earthonline.android.app.Page
import app.earthonline.android.app.Sheet
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.layout.LayoutSnapshot
import app.earthonline.android.model.Journey
import app.earthonline.android.model.PersistedState
import app.earthonline.android.ui.components.DreamyCapsule
import app.earthonline.android.ui.components.GlassIconBar
import app.earthonline.android.ui.components.GlassIconButton
import app.earthonline.android.ui.components.StageScaffold
import app.earthonline.android.ui.components.Ticket

/**
 * 首页：按用户旅程的哪一步决定地球上浮什么（core journey，与网页、iOS 同一套判断）。
 *  - 旅行中：一张大票（D8 / 今天的标题），撕票根进入今天；新建旅程缩成右上的加号
 *  - 快出发：新建胶囊 + 一张票（后天出发 / 第一天），撕票根查看
 *  - 刚回来：新建胶囊 + 一张票（欢迎回家），撕票根写日记
 *  - 平常日子：地球回到家；有将来的书时一张小票，然后是新建胶囊
 */
@Composable
fun HomeOverlay(model: AppModel, layout: LayoutSnapshot, state: PersistedState) {
    val i18n = LocalI18n.current
    val j = model.journey
    fun trip(id: String?) = id?.let { i -> state.trips.firstOrNull { it.id == i } }
    val traveling = j?.kind == Journey.TRAVELING

    StageScaffold(
        layout = layout,
        onObstruction = model::onObstruction,
        trailing = {
            GlassIconBar {
                if (traveling) GlassIconButton(Icons.Filled.Add, i18n.t("home.newTrip")) { model.sheet = Sheet.NewTrip(NewTripTab.VOICE) }
                GlassIconButton(Icons.AutoMirrored.Filled.List, i18n.t("home.allTrips")) { model.show(Page.Shelf) }
                GlassIconButton(Icons.Filled.FileDownload, i18n.t("home.importTrip")) { model.sheet = Sheet.NewTrip(NewTripTab.IMPORT) }
                GlassIconButton(Icons.Filled.Flag, i18n.t("home.footprints")) { model.show(Page.Footprints) }
                GlassIconButton(Icons.Filled.Settings, i18n.t("common.settings")) { model.show(Page.Settings) }
            }
        },
        floating = {
            val newTrip: @Composable () -> Unit = {
                DreamyCapsule(i18n.t("home.newTrip")) { model.sheet = Sheet.NewTrip(NewTripTab.VOICE) }
            }
            when (j?.kind) {
                Journey.TRAVELING -> trip(j?.tripId)?.let { t ->
                    val di = (j?.dayIndex ?: 0).coerceIn(0, (t.days.size - 1).coerceAtLeast(0))
                    val d = t.days.getOrNull(di)
                    Ticket(
                        t,
                        status = i18n.dayTag(d?.index ?: 1),
                        live = true,
                        lines = listOfNotNull(d?.let { i18n.dayTag(it.index) + " · " + i18n.plain(it.title) }),
                        onFace = { model.openBook(t.id) },
                        onStub = { model.openDay(t.id, di) },
                    )
                }
                Journey.DEPARTING -> {
                    newTrip()
                    trip(j?.tripId)?.let { t ->
                        Ticket(
                            t,
                            status = i18n.departLabel(j?.inDays ?: 0),
                            lines = listOfNotNull(t.days.firstOrNull()?.let { i18n.dayTag(it.index) + " · " + i18n.plain(it.title) }),
                            stubLabel = i18n.t("home.view"),
                            onFace = { model.openBook(t.id) },
                            onStub = { model.openBook(t.id) },
                        )
                    }
                }
                Journey.BACK -> {
                    newTrip()
                    trip(j?.tripId)?.let { t ->
                        val ago = j?.daysAgo ?: 0
                        Ticket(
                            t,
                            status = if (ago <= 1) i18n.t("home.welcomeBack") else i18n.t("home.backDaysAgo", "n" to ago),
                            stubLabel = i18n.t("home.diary"),
                            onFace = { model.openBook(t.id) },
                            onStub = { model.openDiary(t.id) },
                        )
                    }
                }
                else -> {
                    val next = j?.next
                    trip(next?.tripId)?.let { t ->
                        Ticket(t, compact = true, status = i18n.departLabel(next?.inDays ?: 0), onFace = { model.openBook(t.id) })
                    }
                    newTrip()
                }
            }
        },
    )
}
