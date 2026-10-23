package app.earthonline.android.ui.screens

import android.graphics.BitmapFactory
import android.util.Base64
import android.view.ViewGroup
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import app.earthonline.android.app.AppModel
import app.earthonline.android.gen.Shared
import app.earthonline.android.gen.Tokens
import app.earthonline.android.i18n.LocalI18n
import app.earthonline.android.model.CaseCard
import app.earthonline.android.model.CaseEdits
import app.earthonline.android.model.PersistedState
import app.earthonline.android.model.Trip
import app.earthonline.android.model.TripStats
import app.earthonline.android.model.TripStatus
import app.earthonline.android.ui.components.Chip
import app.earthonline.android.ui.components.EoTextField
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
import app.earthonline.android.util.CaseCards
import app.earthonline.android.util.Share
import app.earthonline.android.world.CaseItem
import app.earthonline.android.world.LongImageException
import app.earthonline.android.world.SuitcaseBridge
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 封底 = 旅行日记：统计（core tripStats）、这一趟的行李箱（第二个 WebView 装 embed.html?mode=suitcase）、
 * 每天的日记（core diary 生成，改过的以用户的为准）、复制行程数据、合上 / 重新翻开这本书。
 * 右上角导出长图（D96）：交给世界层的嵌入页逐天渲染、按网页同一份排版拼好（WorldController.exportLongImage），三端同一张图。
 * TODO：照片卡（抠主体）还没做。
 */
@Composable
fun DiaryScreen(model: AppModel, state: PersistedState, tripId: String) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val trip = state.trips.firstOrNull { it.id == tripId }
    if (trip == null) {
        LaunchedEffect(tripId) { model.back() }
        return
    }
    val avatar = state.avatar ?: model.avatar
    val bridge = remember(i18n.locale) { SuitcaseBridge(context, i18n.locale).also { it.start() } }
    DisposableEffect(bridge) { onDispose { bridge.destroy() } }
    // 箱子只在增减或小人变了时重装（不跟着日记的每一次按键重渲染）
    LaunchedEffect(bridge, trip.id, trip.suitcase, avatar) { bridge.show(trip, avatar) }
    // 清单里点一格之后：存进书里、重新显示、刷新检索
    LaunchedEffect(bridge) {
        bridge.edits.collect { r ->
            when (r.result) {
                "frontFull" -> model.showToast(i18n.t("case.frontFull"))
                "backFull" -> model.showToast(i18n.t("case.backFull"))
                else -> {
                    model.store.setSuitcaseEdits(trip.id, r.suitcase)
                    bridge.search(bridge.lastQuery)
                }
            }
        }
    }
    var editingCase by remember { mutableStateOf(false) }
    val stats by produceState<TripStats?>(null, trip.days) { value = runCatching { model.core.tripStats(trip) }.getOrNull() }
    var exporting by remember { mutableStateOf(false) }
    val progress by model.world.longImageProgress.collectAsState()

    PageScaffold(i18n.t("epi.title"), onBack = { model.back() }, actions = {
        PlainIconButton(Icons.Filled.IosShare, i18n.t("epi.export"), enabled = !exporting) {
            exporting = true
            scope.launch {
                try {
                    val png = model.world.exportLongImage(trip)
                    Share.file(context, i18n.t("epi.fileName", "title" to trip.title), png, "image/png")
                } catch (e: LongImageException) {
                    model.showToast(i18n.t("epi.exportFailed", "reason" to e.reason))
                } finally {
                    exporting = false
                }
            }
        }
    }) {
        Text(i18n.plain(trip.title), style = EoType.title, color = p.ink)
        Text(i18n.fullDateRange(trip.startDate, trip.endDate), style = EoType.sub, color = p.mist)
        if (exporting) Text(progress ?: i18n.t("epi.export"), style = EoType.sub, color = p.mist)
        Spacer(Modifier.padding(top = 8.dp))
        stats?.let { s ->
            StatGrid(listOf(
                i18n.num(s.days) to i18n.t("epi.statDays"),
                i18n.num(s.places) to i18n.t("epi.statStops"),
                i18n.num(s.visited) to i18n.t("epi.statVisited"),
                i18n.num(s.cities.size) to i18n.t("epi.statDestinations"),
                i18n.duration(s.walkMinutes) to i18n.t("epi.statWalk"),
                i18n.duration(s.transitMinutes) to i18n.t("epi.statTransit"),
            ))
        }

        // ---- 这一趟的行李箱（3D 在世界层里）
        SectionHeader(i18n.t("case.title"))
        val webView by bridge.webView.collectAsState()
        webView?.let { wv ->
            key(wv) {
                AndroidView(
                    factory = { (wv.parent as? ViewGroup)?.removeView(wv); wv },
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 5f)
                        .clip(RoundedCornerShape(Tokens.RadiusL))
                        .background(p.list)
                        .semantics { contentDescription = i18n.t("case.title") },
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(i18n.t("case.styleLabel"), style = EoType.sub, color = p.mist, modifier = Modifier.weight(1f))
            PlainIconButton(Icons.Filled.Tune, i18n.t("case.edit")) { editingCase = !editingCase; if (editingCase) bridge.search(bridge.lastQuery) }
            PlainIconButton(Icons.Filled.Share, i18n.t("case.export")) {
                scope.launch {
                    val png = bridge.export()
                    if (png == null) model.showToast(i18n.t("epi.exportFailed", "reason" to "timeout"))
                    else Share.file(context, i18n.t("case.fileName", "title" to trip.title), png, "image/png")
                }
            }
        }
        Segmented(Shared.SUITCASE_STYLES.map { it to i18n.t("case.style.$it") }, avatar.suitcase ?: "sand") {
            model.updateAvatar(avatar.copy(suitcase = it))
        }
        if (editingCase) CaseList(model, bridge, trip)

        // ---- 每天的日记
        SectionHeader(i18n.t("epi.diaries"))
        Text(i18n.t("epi.diaryNote"), style = EoType.sub, color = p.mist)
        trip.days.forEachIndexed { i, _ -> DiaryDayEditor(model, trip, i) }

        // ---- 数据与合上
        SectionHeader("")
        Group {
            ListRow(i18n.t("epi.copyData"), icon = Icons.Filled.ContentCopy, onClick = {
                model.tripJson(trip.id)?.let { clipboard.setText(AnnotatedString(it)) }
                model.showToast(i18n.t("epi.copied"))
            })
            Hairline(inset = 34.dp)
            val closed = trip.status == TripStatus.CLOSED
            ListRow(i18n.t(if (closed) "epi.reopen" else "epi.close"), icon = Icons.Filled.Book, onClick = {
                model.store.setStatus(trip.id, if (closed) TripStatus.PLANNING else TripStatus.CLOSED)
                model.showToast(i18n.t(if (closed) "epi.reopened" else "epi.closedToast"))
                model.goHome()
            })
        }
        Spacer(Modifier.padding(bottom = 24.dp))
    }
}

/** 一天的日记：D2 + 标题 + 日期、可改的正文（没改过时是 core diary 生成的那一版）、「重写」 */
@Composable
private fun DiaryDayEditor(model: AppModel, trip: Trip, dayIndex: Int) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val d = trip.days[dayIndex]
    val generated by produceState<String?>(null, trip.seed, d.entries, i18n.locale) {
        value = runCatching { model.core.diary(trip, dayIndex) }.getOrNull()
    }
    var text by remember(trip.id, dayIndex) { mutableStateOf<String?>(null) }
    val shown = text ?: d.diary ?: generated.orEmpty()
    Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Tag(i18n.dayTag(d.index))
            Text(i18n.plain(d.title), style = EoType.title, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            PlainIconButton(Icons.Filled.Refresh, i18n.t("epi.rewrite"), tint = p.mist) {
                model.store.setDiary(trip.id, dayIndex, null)
                text = null
                model.showToast(i18n.t("epi.restored"))
            }
        }
        Text(i18n.monthDay(d.date), style = EoType.sub, color = p.mist)
        EoTextField(
            value = shown,
            onValueChange = { v ->
                text = v
                // 和生成的一样、又没改过：不存（以后换语言还能跟着换）
                if (!(d.diary == null && v == generated)) model.store.setDiary(trip.id, dayIndex, v)
            },
            placeholder = i18n.t("epi.diaryNote"),
            singleLine = false,
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/**
 * 清单（D84）：搜索框（一句话或一个词）、四枚场景标签、「箱子里的」一排、按组一格一格的东西；点一格放进去或拿出来。
 * 检索、分组、规则、图标都在嵌入页那份（case-search / case-toggle），这里只画。
 */
@Composable
private fun CaseList(model: AppModel, bridge: SuitcaseBridge, trip: Trip) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var making by remember { mutableStateOf(false) }
    // 放一张照片进去（D82 / D99）：系统的照片选择器（不要存储权限）→ 缩小 → 嵌入页抠图 → 存进 files/cards/ → 记进书里（最多 3 张，挤掉最早的）
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        making = true
        scope.launch {
            try {
                val photo = withContext(Dispatchers.IO) { CaseCards.photoDataUrl(context, uri) }
                val made = photo?.let { bridge.makeCard(it) }
                if (made == null) { model.showToast(i18n.t("case.photoFailed")); return@launch }
                val id = "card-" + System.currentTimeMillis().toString(36)
                withContext(Dispatchers.IO) { CaseCards.save(context, id, made.bytes) }
                val latest = model.store.state.value.trips.firstOrNull { it.id == trip.id } ?: trip
                val e = latest.suitcase ?: CaseEdits()
                val all = e.cards.orEmpty() + CaseCard(id = id, kind = made.kind, w = made.w, h = made.h)
                all.dropLast(3).forEach { CaseCards.delete(context, it.id) }   // 挤掉的那张连图一起删
                model.store.setSuitcaseEdits(trip.id, e.copy(cards = all.takeLast(3)))
                model.showToast(i18n.t(if (made.kind == "cutout") "case.photoCut" else "case.photoFull"))
            } finally {
                making = false
            }
        }
    }
    var query by remember { mutableStateOf(bridge.lastQuery) }
    val items by bridge.items.collectAsState()
    val groups by bridge.groups.collectAsState()
    LaunchedEffect(query) {
        kotlinx.coroutines.delay(200)
        bridge.search(query)
    }
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .background(p.listStrong, RoundedCornerShape(Tokens.RadiusM))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(i18n.t("case.list"), style = EoType.title, color = p.ink)
        EoTextField(query, { query = it }, i18n.t("case.searchPlaceholder"), leading = Icons.Filled.Search, modifier = Modifier.fillMaxWidth())
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("aurora", "beach", "stroll", "trail").forEach { k ->
                val label = i18n.t("case.scene.$k")
                Chip(label, selected = query == label) { query = label }
            }
        }
        if (query.isEmpty() && items.isNotEmpty()) {
            Text(i18n.t("case.inBoxCount", "n" to items.size), style = EoType.sub, color = p.mist)
            TileGrid(items.map { Tile(it.label, null, it.icon, inBox = true, remove = true) { removeFromBox(model, bridge, trip, it, context) } })
        }
        if (groups.isEmpty() && query.isNotEmpty()) Text(i18n.t("case.noMatch"), style = EoType.sub, color = p.mist)
        groups.forEach { g ->
            Text(g.label, style = EoType.sub, color = p.mist)
            TileGrid(g.entries.map { e -> Tile(e.label, e.sub, e.icon, e.inBox, remove = false) { bridge.toggle(e.type, e.id) } })
        }
        ListRow(i18n.t("case.addPhoto"), icon = Icons.Filled.AddPhotoAlternate, onClick = {
            if (!making) pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        })
        val edits = trip.suitcase
        if (edits != null && !(edits.hidden.isNullOrEmpty() && edits.picks.isNullOrEmpty() && edits.gear.isNullOrEmpty())) {
            ListRow(i18n.t("case.restore"), icon = Icons.Filled.Restore, onClick = {
                model.store.setSuitcaseEdits(trip.id, CaseEdits(cards = edits.cards))
                bridge.search(bridge.lastQuery)
            })
        }
    }
}

/** 「箱子里的」那一排点一格：照片卡直接从书里删（连 files/cards/ 里的图），其余和清单里点一格一样走嵌入页的规则 */
private fun removeFromBox(model: AppModel, bridge: SuitcaseBridge, trip: Trip, item: CaseItem, context: android.content.Context) {
    if (item.type == "card") {
        val e = trip.suitcase ?: return
        CaseCards.delete(context, item.key)
        model.store.setSuitcaseEdits(trip.id, e.copy(cards = e.cards?.filterNot { it.id == item.key }?.takeIf { it.isNotEmpty() }))
    } else {
        bridge.toggle(item.type, item.key)
    }
}

private class Tile(val label: String, val sub: String?, val icon: String?, val inBox: Boolean, val remove: Boolean, val onClick: () -> Unit)

/** 一格一格（每行 4 格）：类 emoji 的图标（嵌入页渲染的 PNG）+ 名字；在箱子里的右上角一个勾，「箱子里的」那排是叉 */
@Composable
private fun TileGrid(tiles: List<Tile>) {
    val i18n = LocalI18n.current
    val p = LocalEo.current
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        tiles.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { t ->
                    val label = if (t.inBox) i18n.t("case.removeItem", "name" to t.label) else i18n.t("case.putIn", "name" to t.label)
                    Column(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Tokens.RadiusS))
                            .clickable(role = Role.Button, onClickLabel = label, onClick = t.onClick)
                            .semantics { contentDescription = label }
                            .padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(Modifier.size(56.dp), contentAlignment = Alignment.TopEnd) {
                            val bmp = rememberDataUrlImage(t.icon)
                            if (bmp != null) Image(bmp, contentDescription = null, modifier = Modifier.size(56.dp))
                            else Box(Modifier.size(44.dp).align(Alignment.Center).background(p.fill, RoundedCornerShape(Tokens.RadiusM)))
                            if (t.inBox) {
                                Box(
                                    Modifier.size(18.dp).background(if (t.remove) p.fill else p.ink, CircleShape),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(if (t.remove) Icons.Filled.Close else Icons.Filled.Check, contentDescription = null, tint = if (t.remove) p.mist else p.paper, modifier = Modifier.size(12.dp))
                                }
                            }
                        }
                        Text(t.label, style = EoType.sub, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.width(72.dp))
                        if (!t.sub.isNullOrEmpty()) Text(t.sub, style = EoType.sub, color = p.mist, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.width(72.dp))
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** dataUrl（data:image/png;base64,…）→ ImageBitmap */
@Composable
private fun rememberDataUrlImage(dataUrl: String?): ImageBitmap? = remember(dataUrl) {
    if (dataUrl == null) return@remember null
    runCatching {
        val bytes = Base64.decode(dataUrl.substringAfter(','), Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
    }.getOrNull()
}
