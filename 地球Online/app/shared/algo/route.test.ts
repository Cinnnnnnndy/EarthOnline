import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CityPlate, type CityJson } from "./city.ts";
import { buildRoute } from "./route.ts";
import { migrateTrip } from "../spec/migrate.ts";
import { validateTrip } from "../spec/validate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const load = (p: string) => JSON.parse(readFileSync(join(here, p), "utf8"));
const plates: Record<string, CityPlate> = {};
for (const id of ["osaka", "kyoto", "nara", "kobe"]) plates[id] = new CityPlate(load(`../rules/cities/${id}.json`) as CityJson);
const trip = migrateTrip(load("../golden/trips/kansai-7d.v0.1.json"), "2026-09-30T00:00:00Z");

test("迁移后的示例旅程通过校验", () => { assert.deepEqual(validateTrip(trip), []); assert.equal(trip.days.length, 7); });

test("七天都能铺到底板上：每个站点锚定到地标，路径连续，到站索引递增", () => {
  let prevCell: [number, number] | undefined; let prevCity = "";
  for (const day of trip.days) {
    const plate = plates[day.city];
    const r = buildRoute(plate, day, prevCity === day.city ? prevCell : undefined);
    assert.deepEqual(r.unresolved, [], `第 ${day.index} 天有未锚定站点`);
    const places = day.entries.filter((e) => e.type === "place").length;
    assert.equal(r.stops.length, places, `第 ${day.index} 天站点数`);
    for (let i = 1; i < r.path.length; i++) {
      const [a, b] = [r.path[i - 1], r.path[i]];
      assert.ok(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1, `第 ${day.index} 天路径第 ${i} 步不相邻: ${a} → ${b}`);
    }
    for (let i = 1; i < r.stops.length; i++) assert.ok(r.stops[i].arrive >= r.stops[i - 1].arrive, "到站索引递增");
    assert.equal(r.segments.length, r.stops.length + (r.lodging && !r.lodging.offPlate ? 1 : 0));
    if (r.lodging && !r.lodging.offPlate) { prevCell = r.lodging.cell; prevCity = day.city; } else { prevCell = undefined; prevCity = ""; }
  }
});

test("奈良一日往返：住处在别的城，标记为 offPlate", () => {
  const nara = trip.days[4]; const r = buildRoute(plates.nara, nara);
  assert.equal(r.lodging?.offPlate, true);
});

test("路线是确定性的（同输入同输出）", () => {
  const a = JSON.stringify(buildRoute(plates.kyoto, trip.days[2])); const b = JSON.stringify(buildRoute(plates.kyoto, trip.days[2]));
  assert.equal(a, b);
});
