package app.earthonline.android.i18n

import android.content.Context
import android.os.LocaleList
import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

/**
 * 界面文字：读 tools/export-shared.ts 导出的 assets/shared/i18n.{zh-Hans,en,ja}.json（键与网页、鸿蒙同一份），
 * 找不到的键退回简体中文（源语言），再退回键本身。Kotlin 代码里不写界面文字，一律 i18n.t("home.newTrip")。
 */
class I18n private constructor(
    locale: String,
    private val catalog: Map<String, String>,
    private val fallback: Map<String, String>,
) : Texts(locale, { key -> catalog[key] ?: fallback[key] }) {

    /** 语音识别用的 BCP-47 标签 */
    val speechTag: String get() = when (locale) { "en" -> "en-US"; "ja" -> "ja-JP"; else -> "zh-CN" }

    companion object {
        private val cache = HashMap<String, Map<String, String>>()

        private fun catalog(context: Context, locale: String): Map<String, String> = synchronized(cache) {
            cache.getOrPut(locale) {
                runCatching {
                    val text = context.assets.open("shared/i18n.$locale.json").bufferedReader(Charsets.UTF_8).use { it.readText() }
                    Json.parseToJsonElement(text).jsonObject.toStringMap()
                }.getOrDefault(emptyMap())
            }
        }

        private fun JsonObject.toStringMap(): Map<String, String> =
            entries.mapNotNull { (k, v) -> (v as? JsonPrimitive)?.takeIf { it.isString }?.let { k to it.content } }.toMap()

        /** 设置里的语言（"auto" / 缺省 = 跟随手机）+ 手机的语言列表 → 界面语言 */
        fun resolve(setting: String?): String {
            val list = LocaleList.getDefault()
            val tags = (0 until list.size()).map { list.get(it).toLanguageTag() }
            return I18nFormat.resolveLocale(setting ?: "auto", tags)
        }

        fun load(context: Context, locale: String): I18n {
            val app = context.applicationContext
            val loc = if (I18nFormat.isLocale(locale)) locale else "zh-Hans"
            return I18n(loc, catalog(app, loc), catalog(app, "zh-Hans"))
        }
    }
}

val LocalI18n = staticCompositionLocalOf<I18n> { error("I18n 没有提供：EarthApp 里用 CompositionLocalProvider(LocalI18n provides …)") }
