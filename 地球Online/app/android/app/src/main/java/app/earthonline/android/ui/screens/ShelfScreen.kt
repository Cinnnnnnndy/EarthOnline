package app.earthonline.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.NewTripTab
import app.earthonline.android.app.Sheet
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Trip
import app.earthonline.android.model.TripStatus
import app.earthonline.android.ui.components.PageScaffold
import app.earthonline.android.ui.components.PlainIconButton
import app.earthonline.android.ui.components.Ticket
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo

/** 全部旅程（只看列表，不显示地球）：一摞小票；点票面翻开，长按删除 */
@Composable
fun ShelfScreen(model: AppModel, state: PersistedState) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    var pendingDelete by remember { mutableStateOf<Trip?>(null) }
    val trips = state.trips.sortedByDescending { it.startDate }

    PageScaffold(
        i18n.t("home.allTrips"),
        onBack = { model.back() },
        actions = { PlainIconButton(Icons.Filled.FileDownload, i18n.t("common.import")) { model.sheet = Sheet.NewTrip(NewTripTab.IMPORT) } },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 4.dp)) {
            trips.forEach { t ->
                Ticket(
                    t,
                    compact = true,
                    status = i18n.t("shelf.${t.status}"),
                    live = t.status == TripStatus.TRAVELING,
                    onFace = { model.openBook(t.id) },
                    onLongPress = { pendingDelete = t },
                )
            }
        }
        Text(i18n.t("shelf.hint"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(top = 16.dp, bottom = 24.dp))
    }

    pendingDelete?.let { t ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text(i18n.t("shelf.deleteConfirm", "title" to i18n.plain(t.title)), style = EoType.title) },
            confirmButton = {
                TextButton(onClick = {
                    pendingDelete = null
                    model.store.delete(t.id)
                    model.showToast(i18n.t("shelf.deleted"))
                    if ((model.stage as? app.earthonline.android.app.Stage.Book)?.id == t.id || (model.stage as? app.earthonline.android.app.Stage.Day)?.id == t.id) model.goHome()
                }) { Text(i18n.t("common.delete"), color = p.danger) }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text(i18n.t("common.cancel")) } },
        )
    }
}
