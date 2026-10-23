import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { layoutOf, layoutVars, worldInsets, type ScreenInfo, type Layout } from "./layout.ts";

interface Golden { cases: { name: string; input: ScreenInfo; expect: Partial<Layout> & { panes?: number } }[] }
const golden = JSON.parse(readFileSync(new URL("./layout.golden.json", import.meta.url), "utf8")) as Golden;

test("屏幕形态：黄金用例（三端共用）", () => {
  for (const c of golden.cases) {
    const l = layoutOf(c.input);
    assert.equal(l.state, c.expect.state, `${c.name}: state`);
    if (c.expect.device) assert.equal(l.device, c.expect.device, `${c.name}: device`);
    if (c.expect.panes !== undefined) assert.equal(l.panes.length, c.expect.panes, `${c.name}: panes`);
    if (c.expect.measured !== undefined) assert.equal(l.measured, c.expect.measured, `${c.name}: measured`);
    if (c.expect.creases) assert.deepEqual(l.creases, c.expect.creases, `${c.name}: creases`);
  }
});

test("分页：页不跨折痕、首尾页贴边、留白夹在折痕两侧", () => {
  const l = layoutOf({ width: 1360, height: 950, segments: [{ x: 0, y: 0, w: 450, h: 950 }, { x: 455, y: 0, w: 450, h: 950 }, { x: 910, y: 0, w: 450, h: 950 }] });
  assert.equal(l.panes[0].x, 0); assert.equal(l.panes[2].x + l.panes[2].w, 1360);
  for (let i = 0; i < l.creases.length; i++) { assert.ok(l.panes[i].x + l.panes[i].w <= l.creases[i] - l.gap / 2 + 1); assert.ok(l.panes[i + 1].x >= l.creases[i] + l.gap / 2 - 1); }
  assert.ok(l.gap >= 16 + 5);   // 真折痕 5 宽 + 16
  const est = layoutOf({ width: 1440, height: 900 });
  assert.deepEqual(est.creases, [480, 960]); assert.equal(est.gap, 24); assert.equal(est.panes[1].x, 492); assert.equal(est.panes[1].w, 456); assert.equal(est.panes[2].x + est.panes[2].w, 1440);
});

test("CSS 变量与世界的留白", () => {
  const two = layoutOf({ width: 861, height: 609 });
  const v = layoutVars(two); assert.equal(v["--pane-count"], "2"); assert.equal(v["--pane-2-x"], `${two.panes[1].x}px`); assert.equal(v["--crease-1"], "431px");
  assert.deepEqual(worldInsets(two), { left: two.panes[1].x, right: 0, top: 0, bottom: 0 });
  const three = layoutOf({ width: 1440, height: 900 }); const i3 = worldInsets(three);
  assert.equal(i3.left, three.panes[1].x); assert.ok(i3.right > 400 && i3.right < 500);
  const hv = layoutOf({ width: 861, height: 609, posture: "half" }); assert.ok(worldInsets(hv).bottom > 250);
  assert.deepEqual(worldInsets(layoutOf({ width: 390, height: 844 })), { left: 0, right: 0, top: 0, bottom: 0 });
});
