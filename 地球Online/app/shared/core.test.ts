/** 公用的领域核心（shared/core.ts）：每个函数都能用示例行程调通、结果是纯 JSON（能原样过 JSON.stringify / parse），语言参数生效且调完切回。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CORE, CORE_FNS, callCore, isCoreFn } from "./core.ts";
import { migrateTrip } from "./spec/migrate.ts";
import { getLocale } from "./i18n/index.ts";
import { STARTER_SAMPLES } from "./spec/samples.ts";
import type { Trip, PlaceEntry } from "./spec/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, "../web/public/assets/samples/trips");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { file: string }[];
const trips: Trip[] = index.slice(0, 4).map((it) => migrateTrip(JSON.parse(readFileSync(join(DIR, it.file), "utf8")), "2026-09-30T00:00:00Z"));
const T = trips[0]; const place = T.days[0].entries.find((e): e is PlaceEntry => e.type === "place")!;
const roundTrip = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));

/** 每个函数一组示例参数（加了新函数这里也要加，否则测试报「没有示例」） */
const SAMPLE: Record<string, unknown[]> = {
  journey: [trips, T.startDate], tripStats: [T], timeline: [T.days[0]], diary: [T, 0], todos: [T, "2026-09-30"],
  placeTodos: [place, T.days[0].date, "2026-09-30"], dueFromLead: ["2026-10-20", 14],
  footprints: [trips, [], "2027-12-31", { name: "上海", lat: 31.23, lng: 121.47 }], searchPlaces: ["京都", 3], locate: ["冰岛"], nearest: [35.01, 135.77], kindInfo: [place],
  plan: [{ messages: [{ role: "user", text: "下个月去京都玩五天" }], context: { today: "2026-09-30", locale: "zh-Hans" } }],
  buildTrip: [{ destination: { name: "京都", place: { name: "京都", aliases: [], lat: 35.01, lng: 135.77, kind: "city" } }, startDate: "2026-11-01", days: 3, theme: "红叶古都", locale: "zh-Hans", today: "2026-09-30", now: "2026-09-30T00:00:00Z" }],
  worldSpec: [T], quota: ["free", trips, "2026-09-30"], canUse: ["pro", "aiPlan", { aiPlansThisMonth: 1 }], aiPlansLeft: ["free", 0], entitlement: [["app.earthonline.pro.monthly"]],
  mapLink: ["amap", { name: "清水寺", lat: 34.9949, lng: 135.785 }, "rail"], migrate: [JSON.parse(readFileSync(join(here, "golden/trips/kansai-7d.v0.1.json"), "utf8"))], validate: [T],
  layout: [{ width: 861, height: 609 }], t: ["home.newTrip"], skyPhase: ["auto", false, "2026-10-09T12:00:00+08:00", { lat: 31.23, lng: 121.47 }],
};

test("核心：每个函数都有示例、能调通、结果是纯 JSON", () => {
  for (const fn of CORE_FNS) {
    assert.ok(fn in SAMPLE, `${fn}: 没有示例参数`);
    const v = callCore(fn, SAMPLE[fn]);
    assert.deepEqual(roundTrip(v), roundTrip(v), `${fn}: 结果过不了 JSON`);
  }
  assert.ok(!isCoreFn("toString") && !isCoreFn("__proto__") && isCoreFn("journey"));
  assert.throws(() => callCore("nope", []), /unknown core fn/);
});

test("核心：几项结果对得上", () => {
  const j = callCore("journey", [trips, T.startDate]) as { kind: string; tripId?: string };
  assert.equal(j.kind, "traveling"); assert.equal(j.tripId, T.id);
  const p = callCore("plan", SAMPLE.plan) as { done: boolean; draft?: { destination?: string } };
  assert.equal(typeof p.done, "boolean");
  assert.ok((callCore("searchPlaces", ["京都", 3]) as unknown[]).length >= 1);
  const l = callCore("layout", [{ width: 1360, height: 950 }]) as { state: string; insets: { left: number; right: number } };
  assert.equal(l.state, "triple"); assert.ok(l.insets.left > 0 && l.insets.right > 0);
  assert.equal(typeof CORE.t("home.newTrip"), "string");
  assert.equal(callCore("skyPhase", ["auto", false, "2026-10-09T04:00:00Z", { lat: 31.23, lng: 121.47 }]), "day");   // 上海正午
  assert.equal(callCore("skyPhase", ["auto", false, "2026-10-09T16:00:00Z", { lat: 31.23, lng: 121.47 }]), "night");   // 上海午夜
  assert.equal(callCore("skyPhase", ["dark", false, "2026-10-09T04:00:00Z", null]), "night");
  const pro = callCore("quota", ["pro", trips, "2026-09-30"]) as { unlimited: boolean; limit: number | null }; assert.equal(pro.unlimited, true); assert.equal(pro.limit, null);
  const free = callCore("quota", ["free", trips, "2026-09-30"]) as { unlimited: boolean; limit: number | null }; assert.equal(free.unlimited, false); assert.ok(typeof free.limit === "number");
  assert.equal((callCore("nearest", [35.01, 135.77]) as { name: string } | null)?.name !== undefined, true);
  assert.equal(typeof (callCore("kindInfo", [{ name: "清水寺", category: "sight" }]) as { label: string }).label, "string");
});

test("首次启动的示例：都在示例库的索引里", () => {
  const ids = new Set((JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { id: string }[]).map((x) => x.id));
  for (const id of STARTER_SAMPLES) assert.ok(ids.has(id), id);
});

test("核心：locale 只在这一次调用里生效", () => {
  const before = getLocale();
  const en = callCore("t", ["home.newTrip"], "en") as string, ja = callCore("t", ["home.newTrip"], "ja") as string, zh = callCore("t", ["home.newTrip"], "zh-Hans") as string;
  assert.notEqual(en, zh); assert.notEqual(ja, zh); assert.equal(getLocale(), before);
  const d = callCore("diary", [T, 0], "en") as string; assert.ok(/[A-Za-z]/.test(d));
});
