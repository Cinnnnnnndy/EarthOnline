import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importRoutePage, extractLiteral } from "./route-page.ts";
import { validateTrip } from "../spec/validate.ts";
import { makeCountryLookup } from "../geo/countries.ts";
import { geoFrameOfDay, buildGeoRoute, inside } from "../algo/geo.ts";
import { parseDuration } from "../algo/duration.ts";
import { buildTimeline } from "../algo/timeline.ts";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "../golden/pages/iceland-nordic.html"), "utf8");
const countryOf = makeCountryLookup(JSON.parse(readFileSync(join(here, "../../node_modules/world-atlas/countries-50m.json"), "utf8")));
const { trips, warnings } = importRoutePage(html, { now: new Date("2026-09-30T08:00:00Z"), countryOf });

test("字面量提取：跳过字符串里的括号，截断返回 null", () => {
  assert.equal(extractLiteral('const a = {"x":"}{", b:[1,{c:2}]}; rest', "a"), '{"x":"}{", b:[1,{c:2}]}');
  assert.equal(extractLiteral("const a = {x:[1,2", "a"), null);
});

test("时长：1h58、17h00、2-3h", () => {
  assert.equal(parseDuration("1h58"), 118); assert.equal(parseDuration("17h00"), 1020); assert.equal(parseDuration("2-3h"), 150); assert.equal(parseDuration("1.5h"), 90); assert.equal(parseDuration("30min"), 30);
});

test("用户的双方案页：两本书，天数与日期对得上，校验通过", () => {
  assert.deepEqual(warnings, []);
  assert.equal(trips.length, 2);
  const [p1, p2] = trips;
  assert.equal(p1.title, "冰岛 + 邮轮"); assert.equal(p2.title, "冰岛 + 北欧");
  assert.equal(p1.days.length, 7); assert.equal(p2.days.length, 11);
  assert.deepEqual([p1.startDate, p1.endDate, p2.endDate], ["2026-09-26", "2026-10-02", "2026-10-06"]);
  assert.equal(p1.days[0].index, 2); assert.equal(p1.days[0].color, "#e67e22");
  assert.equal(p1.plan?.group, p2.plan?.group); assert.deepEqual([p1.plan?.index, p2.plan?.index], [1, 2]);
  assert.equal(p1.destination, "冰岛 · 挪威"); assert.equal(p2.destination, "冰岛 · 丹麦 · 挪威");
  assert.equal(p1.status, "traveling");
  for (const t of trips) assert.deepEqual(validateTrip(t), [], t.title);
});

test("黄金圈一天：6 站 5 段，真实折线与里程用时", () => {
  const d = trips[0].days[0];
  const places = d.entries.filter((e) => e.type === "place"), legs = d.entries.filter((e) => e.type === "transport");
  assert.equal(places.length, 6); assert.equal(legs.length, 5);
  const first = legs[0]; assert.ok(first.type === "transport");
  if (first.type === "transport") { assert.equal(first.mode, "car"); assert.equal(first.distanceKm, 46.9); assert.equal(first.durationMinutes, 48); assert.equal(first.polyline?.length, 323); }
  const last = legs[4]; if (last.type === "transport") assert.equal(last.durationMinutes, 63);
  const p0 = places[0]; if (p0.type === "place") { assert.equal(p0.category, "hotel"); assert.equal(p0.plannedStart, "08:00"); }
  const p1 = places[1]; if (p1.type === "place") assert.equal(p1.stayMinutes, 90);
  assert.equal(d.lodging, "哈尔格林姆教堂大本营");
  const tl = buildTimeline(d); assert.equal(tl.items[0].start, "08:00");
});

test("交通方式：邮轮、航班（带航班号）、步行", () => {
  const cruise = trips[0].days[5].entries.find((e) => e.type === "transport");
  assert.ok(cruise && cruise.type === "transport" && cruise.mode === "ship" && cruise.label === "Hurtigruten 邮轮" && cruise.durationMinutes === 1020);
  const bergen = trips[1].days[5].entries.filter((e) => e.type === "transport");
  assert.deepEqual(bergen.map((e) => e.type === "transport" && e.mode), ["flight", "car", "walk", "walk", "car", "flight"]);
  assert.ok(bergen[0].type === "transport" && bergen[0].label === "航班 SK2862");
});

test("每一天都能铺成地理底板：路径连续、到站递增、航班那头在画外", () => {
  for (const trip of trips) for (const d of trip.days) {
    const f = geoFrameOfDay(d); assert.ok(f, `${trip.title} D${d.index} 没有范围`);
    const r = buildGeoRoute(d, f!);
    assert.equal(r.stops.length, d.entries.filter((e) => e.type === "place").length, `D${d.index} 站点数`);
    for (let i = 1; i < r.path.length; i++) { const a = r.path[i - 1], b = r.path[i]; assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) <= 0.3501, `${trip.title} D${d.index} 第 ${i} 步跳变`); }
    for (let i = 1; i < r.stops.length; i++) assert.ok(r.stops[i].arrive >= r.stops[i - 1].arrive);
    for (const s of r.stops) assert.ok(inside(f!, s.center, 0), `${s.name} 应在画内（画外的点贴到画边）`);
  }
  const bergen = trips[1].days[5]; const r = buildGeoRoute(bergen, geoFrameOfDay(bergen)!);
  assert.deepEqual(r.stops.map((s) => !!s.offPlate), [true, false, false, false, false, false, true]);
  assert.equal(r.segments.length, r.stops.length, "segments[i] 对应到达 stops[i]"); assert.equal(r.segments[1].arc, "in"); assert.equal(r.segments.at(-1)!.arc, "out");
  assert.ok(geoFrameOfDay(bergen)!.widthKm < 60, "卑尔根这一天的底板不该被航班撑大");
});
