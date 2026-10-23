package app.earthonline.android.i18n

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor

/**
 * shared/i18n/index.ts 的纯函数部分：占位替换 format()、语言解析 resolveLocale()、日期 / 时长 / 距离的格式。
 * 只依赖一个「键 → 模板」的查表函数，不碰 Android，JVM 单元测试直接跑（I18nFormatTest）。
 */
object I18nFormat {
    val LOCALES = listOf("zh-Hans", "en", "ja")
    fun isLocale(x: String?): Boolean = x != null && x in LOCALES

    private val PLACEHOLDER = Regex("""\{(\w+)(?::([^{}|]*)\|([^{}]*))?\}""")

    /** 占位替换：{var} → 值；{var:单数|复数} → var 为 1 时取单数，否则取复数。没给的占位原样留着（方便发现漏传） */
    fun format(template: String, vars: Map<String, Any?> = emptyMap()): String =
        PLACEHOLDER.replace(template) { m ->
            val k = m.groupValues[1]
            if (!vars.containsKey(k)) return@replace m.value
            val one = m.groups[2]?.value
            if (one != null) {
                val n = jsString(vars[k]).toDoubleOrNull()
                if (n == 1.0) one else m.groups[3]?.value ?: ""
            } else {
                jsString(vars[k])
            }
        }

    /** JS 的 String(x)：整数值的 Double 不带「.0」 */
    fun jsString(v: Any?): String = when (v) {
        null -> "null"
        is Double -> if (v == floor(v) && !v.isInfinite() && abs(v) < 1e15) v.toLong().toString() else v.toString()
        is Float -> jsString(v.toDouble())
        else -> v.toString()
    }

    /** 设置 + 手机的语言列表 → 界面语言。繁体也用简体；一个都不认识用英文；列表为空用简体中文 */
    fun resolveLocale(setting: String?, langs: List<String>): String {
        if (setting != null && setting != "auto" && isLocale(setting)) return setting
        for (raw in langs) {
            val l = raw.lowercase(Locale.ROOT)
            if (l == "zh" || l.startsWith("zh-") || l.startsWith("zh_")) return "zh-Hans"
            if (l == "ja" || l.startsWith("ja-") || l.startsWith("ja_")) return "ja"
            if (l == "en" || l.startsWith("en-") || l.startsWith("en_")) return "en"
        }
        return if (langs.isNotEmpty()) "en" else "zh-Hans"
    }
}

/**
 * 一种语言的文字与格式（index.ts 里 t / list / names / plain / monthDay / dateRange / duration / km … 的移植）。
 * lookup 找不到键时返回 null（I18n 会退回简体中文，再退回键本身）。
 */
open class Texts(val locale: String, private val lookup: (String) -> String?) {
    fun has(key: String): Boolean = lookup(key) != null

    fun t(key: String, vararg vars: Pair<String, Any?>): String =
        I18nFormat.format(lookup(key) ?: key, vars.toMap())

    /** 键可能不存在（比如 cat.port）：退回另一个键 */
    fun tOr(key: String, fallbackKey: String, vararg vars: Pair<String, Any?>): String =
        if (has(key)) t(key, *vars) else t(fallbackKey, *vars)

    // ---------------- 并列与分隔（不用「A · B · C」）
    private fun clean(parts: List<String?>) = parts.filter { !it.isNullOrEmpty() }.map { it!! }
    /** 并列的短语：中文「，」、英文「, 」、日文「、」 */
    fun list(parts: List<String?>): String = clean(parts).joinToString(t("punct.list"))
    /** 并列的名字：中文「、」 */
    fun names(parts: List<String?>): String = clean(parts).joinToString(t("punct.names"))
    /** 行程数据里的「A · B」显示时换成当前语言的逗号（数据不改） */
    fun plain(text: String): String = text.replace(" · ", t("punct.list"))
    fun plainNames(text: String): String = text.replace(" · ", t("punct.names"))

    // ---------------- 日期（输入都是 YYYY-MM-DD）
    private fun ymd(iso: String): Triple<Int, Int, Int> =
        Triple(iso.take(4).toIntOrNull() ?: 0, iso.drop(5).take(2).toIntOrNull() ?: 1, iso.drop(8).take(2).toIntOrNull() ?: 1)
    private fun dotted(iso: String) = iso.take(10).replace("-", ".")

    /** 10月3日 / Oct 3 */
    fun monthDay(iso: String): String {
        val (_, m, d) = ymd(iso)
        return if (locale == "en") "${MON[(m - 1).coerceIn(0, 11)]} $d" else "${m}月${d}日"
    }

    /** 同月：10月3日 – 12日 / Oct 3 – 12；跨月：9月28日 – 10月3日 */
    fun dateRange(a: String, b: String): String {
        val (ya, ma, _) = ymd(a)
        val (yb, mb, db) = ymd(b)
        val sameMonth = ya == yb && ma == mb
        if (locale == "en") return "${monthDay(a)} – ${if (sameMonth) db.toString() else monthDay(b)}"
        return "${monthDay(a)} – ${if (sameMonth) "${db}日" else monthDay(b)}"
    }

    /** 带年份：2026.10.03 / Oct 3, 2026 */
    fun fullDate(iso: String): String = if (locale == "en") "${monthDay(iso)}, ${ymd(iso).first}" else dotted(iso)

    /** 带年份的区间：2026.10.03 – 10.12 / Oct 3 – 12, 2026；跨年两头都写年份 */
    fun fullDateRange(a: String, b: String): String {
        val ya = ymd(a).first
        val yb = ymd(b).first
        if (locale == "en") return if (ya == yb) "${dateRange(a, b)}, $ya" else "${fullDate(a)} – ${fullDate(b)}"
        return if (ya == yb) "${dotted(a)} – ${dotted(b).drop(5)}" else "${dotted(a)} – ${dotted(b)}"
    }

    // ---------------- 时长、距离、数量
    /** 87 → 1 小时 27 分钟；空值 → "" */
    fun duration(minutes: Number?): String {
        if (minutes == null) return ""
        val min = floor(minutes.toDouble() + 0.5).toLong()
        val h = min / 60
        val m = min % 60
        if (h != 0L && m != 0L) return t("unit.hm", "h" to h, "m" to m)
        if (h != 0L) return t("unit.h", "h" to h)
        return t("unit.m", "m" to m)
    }

    /** 数字按语言分组（1,234.5）；最多一位小数 */
    fun num(n: Number): String {
        val f = NumberFormat.getNumberInstance(Locale.forLanguageTag(locale))
        f.maximumFractionDigits = 1
        return f.format(n.toDouble())
    }

    /** 12.34 → 12.3 公里；100 以上取整 */
    fun km(n: Double): String {
        val v = if (n >= 100) floor(n + 0.5) else floor(n * 10 + 0.5) / 10
        return t("unit.km", "n" to num(v))
    }

    fun days(n: Int): String = t("count.day", "n" to n)
    fun stops(n: Int): String = t("count.stop", "n" to n)

    /** 北纬 64.1°，西经 21.9° */
    fun latLng(lat: Double, lng: Double): String {
        fun v(x: Double) = String.format(Locale.ROOT, "%.1f", abs(x))
        return list(listOf(
            t(if (lat >= 0) "geo.n" else "geo.s", "v" to v(lat)),
            t(if (lng >= 0) "geo.e" else "geo.w", "v" to v(lng)),
        ))
    }

    companion object {
        private val MON = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    }
}
