package app.earthonline.android.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import app.earthonline.android.app.AppModel
import app.earthonline.android.app.PickPurpose
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.HomePlace
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Place
import app.earthonline.android.ui.components.EoTextField
import app.earthonline.android.ui.components.Group
import app.earthonline.android.ui.components.Hairline
import app.earthonline.android.ui.components.ListRow
import app.earthonline.android.ui.components.PageScaffold
import app.earthonline.android.ui.components.PlainIconButton
import app.earthonline.android.ui.components.SectionHeader
import app.earthonline.android.ui.theme.EoType
import app.earthonline.android.ui.theme.LocalEo
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 足迹与家：去过几个地方、离家最远；放家（搜城市 / 当前位置 / 在地球上点）；去过的地方；补一面旗。数据来自 core footprints */
@Composable
fun FootprintsScreen(model: AppModel, state: PersistedState) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val fp = model.footprints
    val home = state.home

    fun useLocation() {
        val loc = lastKnownLocation(context)
        if (loc == null) model.showToast(i18n.t("fp.geoFailed"))
        else scope.launch { model.setHomeAt(loc.latitude, loc.longitude) }   // 名字取最近的城市（core nearest）
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) useLocation() else model.showToast(i18n.t("fp.noGeo"))
    }

    PageScaffold(i18n.t("home.footprints"), onBack = { model.back() }) {
        StatGrid(listOf(
            i18n.num(fp?.stats?.places ?: 0) to i18n.t("fp.statPlaces"),
            (if (home != null && (fp?.stats?.farthestKm ?: 0.0) > 0) i18n.km(fp!!.stats.farthestKm) else "—") to
                (fp?.stats?.farthest?.takeIf { home != null }?.let { i18n.t("fp.farthest", "name" to it) } ?: i18n.t("fp.farthestLabel")),
        ))

        // ---- 家
        SectionHeader(i18n.t("fp.home"))
        Group {
            if (home != null) {
                ListRow(home.name, icon = Icons.Filled.Home, subtitle = i18n.latLng(home.lat, home.lng)) {
                    PlainIconButton(Icons.Filled.Close, i18n.t("common.clear"), tint = p.mist) { model.store.setHome(null) }
                }
            } else {
                Text(i18n.t("fp.noHome"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(vertical = 10.dp))
            }
            Hairline()
            PlaceSearch(model, i18n.t("fp.searchCity")) { pl ->
                model.store.setHome(HomePlace(pl.name, pl.lat, pl.lng))
                model.showToast(i18n.t("fp.homeSet", "name" to pl.name))
            }
            ListRow(i18n.t("fp.useLocation"), icon = Icons.Filled.MyLocation, onClick = {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) useLocation()
                else permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
            })
            ListRow(i18n.t("fp.pickOnGlobe"), icon = Icons.Filled.TouchApp, onClick = { model.startPick(PickPurpose.HOME) })
        }

        // ---- 去过的地方（手动补的可以拔掉）
        SectionHeader(i18n.t("fp.visited"))
        Group {
            val flags = fp?.flags.orEmpty()
            if (flags.isEmpty()) Text(i18n.t("fp.noneVisited"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(vertical = 10.dp))
            flags.forEach { f ->
                val tripTitle = f.trips.firstNotNullOfOrNull { id -> state.trips.firstOrNull { it.id == id }?.title }
                val meta = i18n.list(listOf(
                    f.date.takeIf { it.isNotEmpty() }?.let { i18n.fullDate(it) },
                    if (f.source == "manual") i18n.t("fp.manual") else tripTitle?.let { i18n.plain(it) },
                ))
                ListRow(f.name, icon = Icons.Filled.Flag, iconTint = p.dawn, subtitle = meta) {
                    if (f.source == "manual") PlainIconButton(Icons.Filled.Delete, i18n.t("fp.removeFlag"), tint = p.mist) { model.store.removePin(f.id) }
                }
            }
        }

        // ---- 补一面旗
        SectionHeader(i18n.t("fp.addPlace"))
        Group {
            PlaceSearch(model, i18n.t("fp.searchPlace")) { pl ->
                model.store.addPin(pl.name, pl.lat, pl.lng)
                model.showToast(i18n.t("fp.added", "name" to pl.name))
            }
            ListRow(i18n.t("fp.pickOnGlobe"), icon = Icons.Filled.TouchApp, onClick = { model.startPick(PickPurpose.PIN) })
        }
        Text(i18n.t("settings.localOnly"), style = EoType.sub, color = p.mist, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
    }
}

/** 地名搜索框 + 建议（core searchPlaces，离线地名表） */
@Composable
fun PlaceSearch(model: AppModel, placeholder: String, onPick: (Place) -> Unit) {
    var q by remember { mutableStateOf("") }
    var results by remember { mutableStateOf(listOf<Place>()) }
    LaunchedEffect(q) {
        if (q.isBlank()) { results = emptyList(); return@LaunchedEffect }
        delay(200)
        results = runCatching { model.core.searchPlaces(q, 5) }.getOrDefault(emptyList())
    }
    EoTextField(q, { q = it }, placeholder, leading = Icons.Filled.Search, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp))
    results.forEach { pl ->
        ListRow(pl.name, icon = Icons.Filled.Place, onClick = { onPick(pl); q = ""; results = emptyList() })
    }
}

/** 最近一次的位置（网络 / GPS / 被动），拿不到返回 null；只在用户点「用当前位置」时调 */
@SuppressLint("MissingPermission")
private fun lastKnownLocation(context: Context): Location? {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    return listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        .mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
        .maxByOrNull { it.time }
}
