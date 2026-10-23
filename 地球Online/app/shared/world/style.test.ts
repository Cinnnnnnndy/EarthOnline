import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLES, nightOf, nightTone, toneOf, LANTERN } from "./style.ts";

const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test("夜里的那一套（D85）：从白天推出来——更暗、偏蓝；绿的偏青；路是暖黄；键一个不少", () => {
  for (const key of ["sea", "warm", "dusk"] as const) {
    const d = STYLES[key], n = nightOf(d);
    assert.ok(n.night && !d.night, "白天的那套不会被改");
    assert.deepEqual(Object.keys(n).filter((k) => k !== "night").sort(), Object.keys(d).sort(), `${key}：键一样`);
    assert.ok(lum(n.skyTop) < 40 && lum(n.base) < lum(d.base) * 0.6 && lum(n.water) < lum(d.water) * 0.6, `${key}：天、台座、水都暗下来`);
    assert.ok(n.skyTop[2] > n.skyTop[0] && n.base[2] >= n.base[0], `${key}：偏蓝`);
    for (const c of n.canopy) assert.ok(c[1] >= c[0] && c[2] > c[0], `${key}：叶子偏青（${c}）`);
    assert.ok(n.sunIntensity < d.sunIntensity && n.hemiIntensity < d.hemiIntensity, "月光比太阳弱");
    assert.ok(n.pathRibbon[0] > 240 && n.pathRibbon[2] < 140, "路是暖黄");
    assert.equal(n.accent, d.accent, "墨色不动（图钉夜里另换 LANTERN）");
    for (const k in d.ground) assert.ok(lum(n.ground[k]) < lum(d.ground[k]), `${key}：地面 ${k} 暗下来`);
  }
  assert.deepEqual(toneOf(STYLES.sea)([200, 100, 100]), [200, 100, 100], "白天原样");
  const g = nightTone([100, 200, 90]); assert.ok(g[2] > g[0] && g[1] > g[0], "绿的夜里偏青");
  const w = nightTone([240, 240, 240]); assert.ok(lum(w) < 120 && w[2] > w[0], "白的夜里是深蓝灰");
  assert.ok(LANTERN[0] > 240 && LANTERN[2] < 170);
});
