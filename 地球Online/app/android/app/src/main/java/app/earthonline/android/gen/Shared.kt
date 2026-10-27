// 自动生成（tools/export-shared.ts），勿改；改源头（shared/）再跑 npm run export:shared
package app.earthonline.android.gen

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object Shared {
    const val SCHEMA_VERSION = "0.3"
    val AVATAR_FORMS = listOf("human", "fox", "cat", "shiba", "bear", "rabbit", "penguin", "panda", "duck", "seal", "otter", "capybara", "bean", "cloud", "pebble", "persian")
    val SUITCASE_STYLES = listOf("sand", "ink", "canvas", "trunk")
    /** 状态型消息的频道与重放顺序（shared/spec/channels.ts） */
    val REPLAY_ORDER = listOf("palette", "sky", "post", "avatar", "trips", "home", "footprints", "insets", "layout", "mode", "view", "camera", "pick")
    val CHANNEL_OF: Map<String, String> = mapOf(
        "load-plate" to "mode",
        "set-avatar" to "avatar",
        "set-view" to "view",
        "set-post" to "post",
        "set-layout" to "layout",
        "show-globe" to "mode",
        "show-day" to "mode",
        "set-trips" to "trips",
        "focus-home" to "camera",
        "focus-book" to "camera",
        "focus-day" to "camera",
        "fly-to" to "camera",
        "set-home" to "home",
        "set-footprints" to "footprints",
        "set-insets" to "insets",
        "set-sky" to "sky",
        "set-palette" to "palette",
        "pick-point" to "pick"
    )
    /** 领域核心能调的函数（shared/core.ts） */
    val CORE_FNS = listOf("journey", "tripStats", "timeline", "diary", "todos", "placeTodos", "dueFromLead", "footprints", "searchPlaces", "locate", "nearest", "kindInfo", "plan", "buildTrip", "worldSpec", "quota", "canUse", "aiPlansLeft", "entitlement", "mapLink", "migrate", "validate", "skyPhase", "layout", "t")
    /** 待办「提前几天」的选项、导航的四家地图、第一次启动装的示例 */
    val LEAD_DAYS = listOf(30, 14, 7, 1, 0)
    val MAP_APPS = listOf("apple", "google", "amap", "baidu")
    val STARTER_SAMPLES = listOf("sample-beijing-classic-4d", "sample-paris-weekend")
    /** 屏幕形态的阈值（shared/spec/layout.ts） */
    const val PHONE_MAX = 600f
    const val SPREAD_RATIO = 0.8f
    const val TRIPLE_MIN = 1100f
    const val TRIPLE_RATIO = 1.3f
    const val FOLD_GAP = 24f
}

/** 设计令牌（shared/world/tokens.ts）：白天 / 夜里两套 */
data class EoPalette(
    val ink: Color,
    val ink2: Color,
    val mist: Color,
    val mist2: Color,
    val line: Color,
    val paper: Color,
    val white: Color,
    val lake: Color,
    val lakeSoft: Color,
    val lakeDeep: Color,
    val dawn: Color,
    val dawnInk: Color,
    val dawnSoft: Color,
    val danger: Color,
    val list: Color,
    val listStrong: Color,
    val fill: Color,
    val press: Color,
    val grab: Color,
    val field: Color,
    val sheet: Color,
    val label: Color,
    val segOn: Color,
    val glassFill: Color,
    val glassFillStrong: Color,
    val glassRim: Color,
)

object Tokens {
    val Day = EoPalette(
        ink = Color(0xFF1D1E23),
        ink2 = Color(0xFF45464D),
        mist = Color(0xFF5B5C65),
        mist2 = Color(0xFFA3A4AC),
        line = Color(30, 38, 64, 26),
        paper = Color(0xFFF7F8FB),
        white = Color(0xFFFFFFFF),
        lake = Color(0xFF1D1E23),
        lakeSoft = Color(30, 38, 64, 26),
        lakeDeep = Color(0xFF101115),
        dawn = Color(0xFFF0B03A),
        dawnInk = Color(0xFF754A00),
        dawnSoft = Color(240, 176, 58, 46),
        danger = Color(0xFFBE3A52),
        list = Color(255, 255, 255, 158),
        listStrong = Color(255, 255, 255, 191),
        fill = Color(30, 38, 64, 20),
        press = Color(30, 38, 64, 13),
        grab = Color(30, 38, 64, 64),
        field = Color(0xFFFFFFFF),
        sheet = Color(247, 248, 251, 230),
        label = Color(255, 255, 255, 204),
        segOn = Color(0xFFFFFFFF),
        glassFill = Color(255, 255, 255, 117), glassFillStrong = Color(255, 255, 255, 173), glassRim = Color(255, 255, 255, 191),
    )
    val Night = EoPalette(
        ink = Color(0xFFF1F1F4),
        ink2 = Color(0xFFCACBD1),
        mist = Color(0xFF9C9DA5),
        mist2 = Color(0xFF686971),
        line = Color(255, 255, 255, 31),
        paper = Color(0xFF141836),
        white = Color(0xFFFFFFFF),
        lake = Color(0xFFF1F1F4),
        lakeSoft = Color(255, 255, 255, 36),
        lakeDeep = Color(0xFFFFFFFF),
        dawn = Color(0xFFF5BE4E),
        dawnInk = Color(0xFFF5C766),
        dawnSoft = Color(245, 190, 78, 51),
        danger = Color(0xFFF07083),
        list = Color(255, 255, 255, 18),
        listStrong = Color(255, 255, 255, 23),
        fill = Color(255, 255, 255, 31),
        press = Color(255, 255, 255, 15),
        grab = Color(255, 255, 255, 77),
        field = Color(255, 255, 255, 20),
        sheet = Color(22, 26, 56, 230),
        label = Color(22, 26, 56, 184),
        segOn = Color(255, 255, 255, 51),
        glassFill = Color(26, 30, 64, 128), glassFillStrong = Color(22, 26, 56, 184), glassRim = Color(255, 255, 255, 87),
    )
    /** 「新建旅程」梦幻胶囊的渐变（白天 / 夜里） */
    val DreamDay = listOf(Color(0xFFF6D58C), Color(0xFFF0B84A), Color(0xFFE6A032))
    val DreamNight = listOf(Color(0xFFEBC25E), Color(0xFFDFA53C), Color(0xFFCF8E2C))
    /** 捏人面板的色块，下标就是 Avatar 里存的数 */
    val SkinColors = listOf(Color(0xFFF8D2BA), Color(0xFFECBEA0), Color(0xFFCE9C78), Color(0xFF96684C))
    val HairColors = listOf(Color(0xFF422A22), Color(0xFF1E1A1E), Color(0xFF8C5C3A), Color(0xFFCEA062), Color(0xFF683A52))
    val DressColors = listOf(Color(0xFFDAA856), Color(0xFF4A5FB0), Color(0xFFEEE8DC), Color(0xFF86A08A), Color(0xFFD48490), Color(0xFF3A4260), Color(0xFFCC9C70))
    val HatColors = listOf(Color(0xFFF2ECE0), Color(0xFF4A5FB0), Color(0xFFE2AC46), Color(0xFF3A4260))
    val ShoesColors = listOf(Color(0xFF70503E), Color(0xFF303240), Color(0xFFECE6DA), Color(0xFF883E48))
    val SpaceBg = mapOf("day" to Color(0xFF9CB4F0), "dusk" to Color(0xFF6A5A9E), "night" to Color(0xFF141A4A))
    val SpaceS = 8.dp; val SpaceM = 12.dp; val SpaceL = 16.dp; val SpaceXl = 24.dp; val Touch = 44.dp
    val RadiusS = 10.dp; val RadiusM = 14.dp; val RadiusL = 22.dp; val RadiusSheet = 26.dp
    /** 字号只有两档：17 与 13；字重 600 / 400 */
    val FontBody = 17.sp; val FontSub = 13.sp
}
