/** 示例行程库（web/public/assets/samples/trips/）：十种类型的行程，用来压数据模型、时间线、地理路线和景点分级。
 *  断言：每本都能通过校验，每天的时间线、地理底板范围和路线都能建出来，每个站点都有类型。
 *  名胜命中、类型分布、底板宽度、时间线跨零点等只打诊断（ℹ 行），不做断言：名胜登记表还在填。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Trip, Day, PlaceEntry, TransportEntry } from "../spec/types.ts";
import { validateTrip } from "../spec/validate.ts";
import { migrateTrip } from "../spec/migrate.ts";
import { buildTimeline } from "../algo/timeline.ts";
import { geoFrameOfDay, buildGeoRoute, haversineKm } from "../algo/geo.ts";
import { minutesOf } from "../algo/duration.ts";
import { tripStats } from "../algo/stats.ts";
import { generateDiary } from "../algo/diary.ts";
import { footprints } from "../algo/footprints.ts";
import { classifyPlace, KIND } from "../world/landmark-kinds.ts";
import { tierOf } from "../world/landmark-famous.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, "../../web/public/assets/samples/trips");
const TODAY = "2026-09-30";
interface IndexItem { id: string; file: string; title: string; type: string; blurb: string }
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as IndexItem[];
const trips = index.map((it) => ({ it, trip: migrateTrip(JSON.parse(readFileSync(join(DIR, it.file), "utf8")), "2026-09-30T00:00:00Z") }));
const places = (d: Day) => d.entries.filter((e): e is PlaceEntry => e.type === "place");
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test("索引：十本，字段齐全，文件与索引一一对应", () => {
  assert.ok(Array.isArray(index) && index.length >= 10);
  for (const it of index) for (const k of ["id", "file", "title", "type", "blurb"] as const) assert.ok(typeof it[k] === "string" && it[k].length > 0, `${it.id}.${k}`);
  assert.equal(new Set(index.map((i) => i.id)).size, index.length, "id 重复");
  assert.equal(new Set(index.map((i) => i.type)).size, index.length, "每本一种类型");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
  assert.deepEqual(files, index.map((i) => i.file).sort(), "目录里的文件都要登记在 index.json");
  for (const { it, trip } of trips) { assert.equal(trip.id, it.id); assert.equal(trip.title, it.title); }
});

test("每本都通过校验（0.3，和 store.importTrip 同一道关）", () => {
  for (const { trip } of trips) {
    assert.equal(trip.schemaVersion, "0.3");
    assert.deepEqual(validateTrip(trip), [], trip.id);
    assert.equal(trip.days[0].date, trip.startDate, `${trip.id} 第一天日期`);
    assert.equal(trip.days.at(-1)!.date, trip.endDate, `${trip.id} 最后一天日期`);
    trip.days.forEach((d, i) => { assert.equal(d.index, i + 1, `${trip.id} 天序号`); assert.equal(d.date, addDays(trip.startDate, i), `${trip.id} D${d.index} 日期连续`); assert.equal(d.city, "geo"); });
  }
});

test("数据本身：坐标在范围内，交通都写了方式、名字、时长、里程；路程不短于两端直线距离", () => {
  for (const { trip } of trips) for (const d of trip.days) {
    let prev: PlaceEntry | null = null; let legs: TransportEntry[] = [];
    for (const e of d.entries) {
      if (e.type === "transport") {
        assert.ok(e.label && e.durationMinutes! > 0 && e.distanceKm! > 0, `${trip.id} D${d.index} ${e.id}`);
        if (e.mode === "walk") assert.ok(e.distanceKm! / (e.durationMinutes! / 60) <= 6.5, `${trip.id} D${d.index} ${e.label} 走得太快`);
        legs.push(e); continue;
      }
      if (e.type !== "place") continue;
      assert.ok(e.geo && Math.abs(e.geo.lat) <= 90 && Math.abs(e.geo.lng) <= 180, `${trip.id} ${e.name} 坐标`);
      if (prev && legs.length) {
        const straight = haversineKm([prev.geo!.lat, prev.geo!.lng], [e.geo!.lat, e.geo!.lng]); const km = legs.reduce((s, l) => s + l.distanceKm!, 0);
        assert.ok(km >= straight * 0.9 - 0.15, `${trip.id} D${d.index} ${prev.name} → ${e.name}：${km} km < 直线 ${straight.toFixed(1)} km`);
      }
      prev = e; legs = [];
    }
  }
});

test("文案：书名、目的地、天标题、站名、交通名、备注里都不用间隔号", () => {
  for (const { it, trip } of trips) {
    const texts = [it.title, it.blurb, trip.title, trip.destination, ...trip.days.flatMap((d) => [d.title, d.lodging ?? "", ...d.entries.flatMap((e) => (e.type === "transport" ? [e.label] : [e.name, e.notes ?? ""]))])];
    for (const s of texts) assert.ok(!/[·・]/.test(s), `${trip.id}：「${s}」`);
  }
});

test("时间线：每天都能排出来，每个条目一项，时刻都是 HH:MM", (t) => {
  for (const { trip } of trips) for (const d of trip.days) {
    const tl = buildTimeline(d);
    assert.equal(tl.items.length, d.entries.length, `${trip.id} D${d.index}`);
    for (const i of tl.items) assert.match(`${i.start} ${i.end}`, /^\d{2}:\d{2} \d{2}:\d{2}$/);
    // 诊断：计划时刻赶不上（时差、跨日期线、行程太满）与时钟跨过零点
    const late: string[] = []; const wrap: string[] = [];
    for (const i of tl.items) {
      const e = d.entries.find((x) => x.id === i.entryId)!;
      if (minutesOf(i.end) < minutesOf(i.start)) wrap.push(`${e.type === "transport" ? e.label : e.type === "place" ? e.name : "住宿"} ${i.start}→${i.end}`);
      if (e.type === "place" && e.plannedStart && minutesOf(i.start) > minutesOf(e.plannedStart)) late.push(`${e.name} 计划 ${e.plannedStart} 排成 ${i.start}`);
    }
    if (late.length || wrap.length) t.diagnostic(`时间线 ${trip.id} D${d.index} ${tl.firstStart}–${tl.lastEnd}${wrap.length ? "，跨零点：" + wrap.join("；") : ""}${late.length ? "，赶不上：" + late.join("；") : ""}`);
  }
});

test("地理底板：每个 geo 天都能定范围、建路线，站点全部落位", (t) => {
  for (const { trip } of trips) {
    const widths: string[] = [];
    for (const d of trip.days) {
      const f = geoFrameOfDay(d); assert.ok(f, `${trip.id} D${d.index} 没有范围`);
      const r = buildGeoRoute(d, f!);
      assert.deepEqual(r.unresolved, [], `${trip.id} D${d.index}`);
      assert.equal(r.stops.length, places(d).length, `${trip.id} D${d.index} 站点数`);
      assert.equal(r.segments.length, r.stops.length, `${trip.id} D${d.index} 段数`);
      assert.ok(r.path.length >= 1 && r.path.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), `${trip.id} D${d.index} 路径`);
      for (let i = 1; i < r.stops.length; i++) assert.ok(r.stops[i].arrive >= r.stops[i - 1].arrive, `${trip.id} D${d.index} 到站索引递增`);
      const used = new Set(r.segments.flatMap((s) => s.entryIds));
      const dropped = d.entries.filter((e) => e.type === "transport" && !used.has(e.id)).map((e) => (e as TransportEntry).label);
      const lodgings = d.entries.filter((e) => e.type === "lodging").length;
      const off = r.stops.filter((s) => s.offPlate).length;
      widths.push(`D${d.index} ${Math.round(f!.widthKm)}km${off ? ` 画外${off}` : ""}${dropped.length ? ` 丢掉末尾交通「${dropped.join("、")}」` : ""}${lodgings ? ` 住宿条目${lodgings}（底板上不显示）` : ""}${r.lodging ? "" : ""}`);
    }
    t.diagnostic(`底板 ${trip.id}：${widths.join("，")}`);
  }
});

test("跨太平洋航班：画外的那一头按经度差的短边投影（上海在旧金山的西边）", () => {
  const cal = trips.find((x) => x.trip.id === "sample-california-highway-1")!.trip;
  for (const di of [0, 6]) {
    const d = cal.days[di]; const f = geoFrameOfDay(d)!; const r = buildGeoRoute(d, f);
    const pvg = r.stops.find((s) => s.offPlate && s.name === "上海浦东国际机场")!;
    assert.ok(pvg.center[0] < f.cols / 2, `D${d.index} 浦东应从西边出画，实际 x=${pvg.center[0].toFixed(1)}`);
  }
});

test("景点分级：每个站点都有类型（名胜命中与类型分布只打诊断）", (t) => {
  for (const { trip } of trips) {
    const hist: Record<string, number> = {}; const famous: string[] = []; const fallback: string[] = [];
    for (const d of trip.days) for (const e of places(d)) {
      const k = classifyPlace({ name: e.name, category: e.category, kind: e.kind });
      assert.ok(KIND[k], `${trip.id} ${e.name} → ${k}`);
      const tier = tierOf({ name: e.name, category: e.category, kind: e.kind, lat: e.geo?.lat, lng: e.geo?.lng }, classifyPlace);
      assert.ok(KIND[tier.kind], `${trip.id} ${e.name} → ${tier.kind}（名胜登记的类型不在 KINDS 里）`);
      hist[tier.kind] = (hist[tier.kind] ?? 0) + 1;
      if (tier.famous) { if (!famous.includes(`${e.name}→${tier.famous.id}`)) famous.push(`${e.name}→${tier.famous.id}${tier.tier === "famous" ? "" : "（未建模）"}`); }
      else if (tier.kind === "sight" && !fallback.includes(e.name)) fallback.push(e.name);
    }
    t.diagnostic(`类型 ${trip.id}：${Object.entries(hist).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join("，")}`);
    t.diagnostic(`名胜 ${trip.id}：${famous.length ? famous.join("，") : "无"}`);
    if (fallback.length) t.diagnostic(`兜底 ${trip.id}：${fallback.join("、")}`);
  }
});

test("统计、日记、足迹都能算；状态与日期不一致只打诊断", (t) => {
  for (const { trip } of trips) {
    const st = tripStats(trip); assert.equal(st.days, trip.days.length);
    for (const d of trip.days) assert.ok(generateDiary(trip, d).length > 0);
    const derived = TODAY < trip.startDate ? "planning" : TODAY > trip.endDate ? "closed" : "traveling";
    t.diagnostic(`概况 ${trip.id}：${trip.startDate}–${trip.endDate}，${st.days} 天 ${st.places} 站，状态 ${trip.status}${derived !== trip.status ? `（按日期应为 ${derived}）` : ""}`);
  }
  const fps = footprints(trips.map((x) => x.trip as Trip), [], TODAY);
  assert.ok(fps.length > 0);
  t.diagnostic(`足迹：${fps.length} 面旗（到 ${TODAY} 为止去过的站点，住处和机场不算）`);
});
