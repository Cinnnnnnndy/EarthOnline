import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importRoutePage } from "../import/route-page.ts";
import { footprints, footprintStats, clusterFlags } from "./footprints.ts";

const html = readFileSync(new URL("../golden/pages/iceland-nordic.html", import.meta.url), "utf8");
const { trips } = importRoutePage(html, { now: new Date("2026-09-30T09:00:00Z"), year: 2026 });

test("出发前一面旗都没有；打过卡的站点例外", () => {
  assert.equal(footprints(trips, [], "2026-09-01").length, 0);
  const t = structuredClone(trips[0]); const e = t.days[0].entries.find((x) => x.type === "place" && x.category !== "hotel")!;
  if (e.type === "place") e.visited = true;
  const f = footprints([t], [], "2026-09-01"); assert.equal(f.length, 1); assert.equal(f[0].name, (e as { name: string }).name);
});

test("旅行到第六天：前四天的站点插旗，两个方案重复的站只插一面，住处 / 机场不插", () => {
  const f = footprints(trips, [], "2026-09-30");
  assert.ok(f.length >= 10, `只有 ${f.length} 面`);
  assert.equal(new Set(f.map((x) => x.name)).size, f.length);
  assert.ok(f.every((x) => x.date < "2026-09-30"));
  assert.ok(!f.some((x) => /机场|酒店|大本营/.test(x.name)), f.map((x) => x.name).join("、"));
  assert.ok(f.some((x) => x.trips.length === 2), "前几天两个方案相同，应合并成同一面旗");
  const s = footprintStats(f, { name: "上海", lat: 31.23, lng: 121.47 });
  assert.ok(s.farthestKm > 7000 && s.farthestKm < 10000, String(s.farthestKm));
});

test("手动补旗与聚合", () => {
  const f = footprints([], [{ id: "m1", name: "巴黎", lat: 48.857, lng: 2.352, date: "2019-05-01" }, { id: "m2", name: "凡尔赛", lat: 48.805, lng: 2.12 }], "2026-09-30");
  assert.equal(f.length, 2); assert.equal(f[0].name, "巴黎");
  assert.equal(clusterFlags(f, 0.05).length, 2); assert.equal(clusterFlags(f, 1).length, 1); assert.equal(clusterFlags(f, 1)[0].count, 2);
});
