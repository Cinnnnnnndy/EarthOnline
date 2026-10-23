package app.earthonline.android.i18n

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** shared/i18n/index.ts 的 format() / resolveLocale() 与几个格式函数的移植（对照 shared/i18n/i18n.test.ts 的写法） */
class I18nFormatTest {
    @Test
    fun placeholders() {
        assertEquals("下一段：京都，3 天后", I18nFormat.format("下一段：{title}，{n} 天后", mapOf("title" to "京都", "n" to 3)))
        assertEquals("1 day", I18nFormat.format("{n} {n:day|days}", mapOf("n" to 1)))
        assertEquals("5 days", I18nFormat.format("{n} {n:day|days}", mapOf("n" to 5)))
        assertEquals("0 days", I18nFormat.format("{n} {n:day|days}", mapOf("n" to 0)))
        // 没给的占位原样留着
        assertEquals("{title} 2", I18nFormat.format("{title} {n}", mapOf("n" to 2)))
        // 整数值的 Double 不带 .0（与 JS 的 String(x) 一样）
        assertEquals("12", I18nFormat.format("{n}", mapOf("n" to 12.0)))
        assertEquals("12.5", I18nFormat.format("{n}", mapOf("n" to 12.5)))
    }

    @Test
    fun resolveLocale() {
        assertEquals("ja", I18nFormat.resolveLocale("ja", listOf("en-US")))
        assertEquals("zh-Hans", I18nFormat.resolveLocale("auto", listOf("zh-Hant-TW", "en")))
        assertEquals("zh-Hans", I18nFormat.resolveLocale(null, listOf("zh_CN")))
        assertEquals("ja", I18nFormat.resolveLocale("auto", listOf("fr-FR", "ja-JP")))
        assertEquals("en", I18nFormat.resolveLocale("auto", listOf("fr-FR")))
        assertEquals("zh-Hans", I18nFormat.resolveLocale("auto", emptyList()))
    }

    private fun texts(locale: String, map: Map<String, String>) = Texts(locale) { map[it] }

    @Test
    fun datesAndUnits() {
        val zh = texts("zh-Hans", mapOf("unit.hm" to "{h} 小时 {m} 分钟", "unit.h" to "{h} 小时", "unit.m" to "{m} 分钟", "unit.km" to "{n} 公里", "punct.list" to "，"))
        val en = texts("en", mapOf("unit.km" to "{n} km", "punct.list" to ", "))
        assertEquals("10月3日", zh.monthDay("2026-10-03"))
        assertEquals("Oct 3", en.monthDay("2026-10-03"))
        assertEquals("10月3日 – 12日", zh.dateRange("2026-10-03", "2026-10-12"))
        assertEquals("Sep 28 – Oct 3", en.dateRange("2026-09-28", "2026-10-03"))
        assertEquals("2026.10.03 – 10.12", zh.fullDateRange("2026-10-03", "2026-10-12"))
        assertEquals("Oct 3 – 12, 2026", en.fullDateRange("2026-10-03", "2026-10-12"))
        assertEquals("1 小时 27 分钟", zh.duration(87))
        assertEquals("2 小时", zh.duration(120))
        assertEquals("", zh.duration(null))
        assertEquals("12.3 公里", zh.km(12.34))
        assertEquals("1,235 km", en.km(1234.5))
        assertEquals("冰岛，挪威", zh.plain("冰岛 · 挪威"))
    }

    /** 三份导出的消息表键一致（单元测试的工作目录是 app/，直接读 src/main/assets/shared） */
    @Test
    fun catalogsHaveTheSameKeys() {
        val dir = File("src/main/assets/shared")
        assumeTrue(dir.isDirectory)
        val keys = I18nFormat.LOCALES.map { l ->
            Json.parseToJsonElement(File(dir, "i18n.$l.json").readText()).jsonObject.keys
        }
        assertEquals(keys[0], keys[1])
        assertEquals(keys[0], keys[2])
        val zh = Json.parseToJsonElement(File(dir, "i18n.zh-Hans.json").readText()).jsonObject
        val t = Texts("zh-Hans") { zh[it]?.jsonPrimitive?.content }
        assertEquals("新建旅程", t.t("home.newTrip"))
        assertEquals("3 天后出发", t.t("journey.departIn", "n" to 3))
    }
}
