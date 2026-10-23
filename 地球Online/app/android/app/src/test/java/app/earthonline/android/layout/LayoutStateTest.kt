package app.earthonline.android.layout

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 屏幕形态的黄金用例（shared/spec/layout.golden.json，三端共用；Gradle 把 ../../shared/spec 设成测试资源目录，直接读源头那份）。
 * 与 shared/spec/layout.test.ts 的三组断言一一对应。
 */
class LayoutStateTest {
    private fun golden(): JsonArray {
        val text = javaClass.classLoader!!.getResourceAsStream("layout.golden.json")!!.bufferedReader(Charsets.UTF_8).use { it.readText() }
        return Json.parseToJsonElement(text).jsonObject["cases"]!!.jsonArray
    }

    private fun info(o: JsonObject): ScreenInfo = ScreenInfo(
        width = o["width"]!!.jsonPrimitive.double,
        height = o["height"]!!.jsonPrimitive.double,
        segments = (o["segments"] as? JsonArray)?.map { s ->
            val g = s.jsonObject
            Segment(g["x"]!!.jsonPrimitive.double, g["y"]!!.jsonPrimitive.double, g["w"]!!.jsonPrimitive.double, g["h"]!!.jsonPrimitive.double)
        },
        posture = FoldPosture.of(o["posture"]?.jsonPrimitive?.content),
        hasOuter = o["hasOuter"]?.jsonPrimitive?.booleanOrNull ?: false,
    )

    @Test
    fun goldenCases() {
        val cases = golden()
        assertTrue("至少有 20 条用例", cases.size >= 20)
        for (c in cases) {
            val o = c.jsonObject
            val name = o["name"]!!.jsonPrimitive.content
            val expect = o["expect"]!!.jsonObject
            val l = layoutOf(info(o["input"]!!.jsonObject))
            assertEquals("$name: state", expect["state"]!!.jsonPrimitive.content, l.state.wire)
            expect["device"]?.let { assertEquals("$name: device", it.jsonPrimitive.content, l.device.wire) }
            expect["panes"]?.let { assertEquals("$name: panes", it.jsonPrimitive.int, l.panes.size) }
            expect["measured"]?.let { assertEquals("$name: measured", it.jsonPrimitive.boolean, l.measured) }
            expect["creases"]?.let { arr ->
                assertEquals("$name: creases", arr.jsonArray.map { it.jsonPrimitive.double }, l.creases)
            }
        }
    }

    @Test
    fun panesNeverCrossCreases() {
        val l = layoutOf(ScreenInfo(1360.0, 950.0, listOf(Segment(0.0, 0.0, 450.0, 950.0), Segment(455.0, 0.0, 450.0, 950.0), Segment(910.0, 0.0, 450.0, 950.0))))
        assertEquals(0.0, l.panes[0].x, 0.0)
        assertEquals(1360.0, l.panes[2].x + l.panes[2].w, 0.0)
        for (i in l.creases.indices) {
            assertTrue(l.panes[i].x + l.panes[i].w <= l.creases[i] - l.gap / 2 + 1)
            assertTrue(l.panes[i + 1].x >= l.creases[i] + l.gap / 2 - 1)
        }
        assertTrue(l.gap >= 16 + 5)   // 真折痕 5 宽 + 16
        val est = layoutOf(ScreenInfo(1440.0, 900.0))
        assertEquals(listOf(480.0, 960.0), est.creases)
        assertEquals(24.0, est.gap, 0.0)
        assertEquals(492.0, est.panes[1].x, 0.0)
        assertEquals(456.0, est.panes[1].w, 0.0)
        assertEquals(1440.0, est.panes[2].x + est.panes[2].w, 0.0)
    }

    @Test
    fun worldInsetsPerState() {
        val two = layoutOf(ScreenInfo(861.0, 609.0))
        assertEquals(listOf(431.0), two.creases)
        assertEquals(WorldInsets(left = two.panes[1].x, right = 0.0, top = 0.0, bottom = 0.0), worldInsets(two))
        val three = layoutOf(ScreenInfo(1440.0, 900.0))
        val i3 = worldInsets(three)
        assertEquals(three.panes[1].x, i3.left, 0.0)
        assertTrue(i3.right > 400 && i3.right < 500)
        val hover = layoutOf(ScreenInfo(861.0, 609.0, posture = FoldPosture.HALF))
        assertTrue(worldInsets(hover).bottom > 250)
        assertEquals(WorldInsets.Zero, worldInsets(layoutOf(ScreenInfo(390.0, 844.0))))
    }

    @Test
    fun jsRoundIsHalfUp() {
        assertEquals(3.0, jsRound(2.5), 0.0)
        assertEquals(-2.0, jsRound(-2.5), 0.0)
        assertEquals(287.0, jsRound(286.5), 0.0)
    }
}
