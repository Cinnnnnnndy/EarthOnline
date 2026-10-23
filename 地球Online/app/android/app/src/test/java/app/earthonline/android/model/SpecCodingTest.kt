package app.earthonline.android.model

import app.earthonline.android.world.WorldMessages
import app.earthonline.android.world.jsStringLiteral
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * 数据契约 0.3 的 Kotlin 版：示例行程（web/public/assets/samples/trips，测试资源目录）读进来再写出去，
 * JSON 结构不变（不凭空多字段、不丢字段、Entry 按 type 区分）；数字按数值比（Kotlin 的 Double 会写成 12.0）。
 */
class SpecCodingTest {
    private fun resource(path: String): String =
        javaClass.classLoader!!.getResourceAsStream(path)!!.bufferedReader(Charsets.UTF_8).use { it.readText() }

    private fun sameJson(path: String, a: JsonElement, b: JsonElement) {
        when {
            a is JsonObject && b is JsonObject -> {
                assertEquals("$path: keys", a.keys, b.keys)
                a.keys.forEach { sameJson("$path.$it", a[it]!!, b[it]!!) }
            }
            a is JsonArray && b is JsonArray -> {
                assertEquals("$path: size", a.size, b.size)
                a.indices.forEach { sameJson("$path[$it]", a[it], b[it]) }
            }
            a is JsonPrimitive && b is JsonPrimitive -> {
                if (a.isString || b.isString || a is JsonNull || b is JsonNull) assertEquals(path, a, b)
                else {
                    val x = a.content.toDoubleOrNull()
                    val y = b.content.toDoubleOrNull()
                    if (x != null && y != null) assertEquals(path, x, y, 1e-9) else assertEquals(path, a.content, b.content)
                }
            }
            else -> fail("$path: $a vs $b")
        }
    }

    @Test
    fun samplesRoundTrip() {
        val index = Json.parseToJsonElement(resource("trips/index.json")).jsonArray
        assertTrue(index.isNotEmpty())
        for (ref in index) {
            val file = ref.jsonObject["file"]!!.jsonPrimitive.content
            val raw = Json.parseToJsonElement(resource("trips/$file"))
            val trip = EoJson.decodeFromJsonElement(Trip.serializer(), raw)
            assertEquals(SCHEMA_VERSION, trip.schemaVersion)
            assertTrue("$file: 有天", trip.days.isNotEmpty())
            val back = EoJson.encodeToJsonElement(Trip.serializer(), trip)
            sameJson(file, raw, back)
        }
    }

    @Test
    fun entryDiscriminatorAndOptionalFields() {
        val day = Day(
            index = 1, date = "2026-10-03", title = "t", city = "geo",
            entries = listOf(
                PlaceEntry(id = "d1-e0", name = "A", category = "sight"),
                TransportEntry(id = "d1-e1", mode = "walk", label = "步行", durationMinutes = 12),
                LodgingEntry(id = "d1-e2", name = "H"),
            ),
        )
        val json = EoJson.encodeToJsonElement(Day.serializer(), day).jsonObject
        val entries = json["entries"]!!.jsonArray.map { it.jsonObject }
        assertEquals(listOf("place", "transport", "lodging"), entries.map { it["type"]!!.jsonPrimitive.content })
        assertFalse("可选字段为空时不写", entries[0].containsKey("visited"))
        assertFalse(json.containsKey("diary"))
        assertEquals(day, EoJson.decodeFromJsonElement(Day.serializer(), json))
        // 不认识的字段读的时候忽略
        val extra = JsonObject(json + ("future" to JsonPrimitive(1)))
        assertEquals(day, EoJson.decodeFromJsonElement(Day.serializer(), extra))
    }

    @Test
    fun avatarAlwaysWritesEveryField() {
        val a = Avatar.default("小旅")
        val json = EoJson.encodeToJsonElement(Avatar.serializer(), a).jsonObject
        assertEquals(setOf("skin", "hair", "hairColor", "dress", "hat", "hatColor", "shoes", "name"), json.keys)
    }

    @Test
    fun messagesAndJsLiterals() {
        val m = WorldMessages.setHome(null)
        assertEquals("""{"kind":"set-home","home":null}""", m.toString())
        val call = WorldMessages.coreCall("core-1", "journey", listOf(JsonArray(emptyList()), JsonPrimitive("2026-10-09")), "en")
        assertEquals("core-call", call["kind"]!!.jsonPrimitive.content)
        assertEquals(2, call["args"]!!.jsonArray.size)
        // 字符串字面量：引号、反斜杠、换行、U+2028 都转义，能原样放进 JS
        val lit = jsStringLiteral("{\"a\":\"x\\\"y\\n\u2028\"}")
        assertTrue(lit.startsWith("\"") && lit.endsWith("\""))
        assertFalse(lit.contains("\u2028"))
        assertFalse(lit.contains("\n"))
        assertEquals("{\"a\":\"x\\\"y\\n\u2028\"}", Json.decodeFromString(String.serializer(), lit))
    }

    @Test
    fun daySignatureIgnoresVisited() {
        val p = PlaceEntry(id = "a", name = "A", category = "sight", geo = Geo(1.0, 2.0))
        val d1 = Day(1, "2026-10-03", "t", "geo", listOf(p))
        val d2 = d1.copy(entries = listOf(p.copy(visited = true, notes = "n")))
        val d3 = d1.copy(entries = listOf(p.copy(name = "B")))
        assertEquals(daySignature(d1), daySignature(d2))
        assertTrue(daySignature(d1) != daySignature(d3))
    }
}
