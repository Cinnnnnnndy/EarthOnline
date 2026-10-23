import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDuration, formatDuration, addMinutes } from "./duration.ts";
import { classifyTransport } from "./transport.ts";
import { buildTimeline } from "./timeline.ts";
import { generateDiary } from "./diary.ts";
import { deriveWorldSpec, coverColors } from "./world-spec.ts";
import type { Day } from "../spec/types.ts";

test("时长解析", () => {
  assert.equal(parseDuration("50 分钟"), 50); assert.equal(parseDuration("1 小时 20 分钟"), 80); assert.equal(parseDuration("1.5 小时"), 90);
  assert.equal(parseDuration("45min"), 45); assert.equal(parseDuration("1h20m"), 80); assert.equal(parseDuration("穿过奈良公园 · 25 分钟"), 25); assert.equal(parseDuration(""), null);
  assert.equal(formatDuration(80), "1 小时 20 分钟"); assert.equal(formatDuration(60), "1 小时"); assert.equal(formatDuration(5), "5 分钟");
  assert.equal(addMinutes("23:50", 20), "00:10"); assert.equal(addMinutes("09:00", -30), "08:30");
});

test("交通方式归类", () => {
  assert.equal(classifyTransport("JR 关空快速"), "rail"); assert.equal(classifyTransport("地铁御堂筋线"), "subway"); assert.equal(classifyTransport("巴士 205 路"), "bus");
  assert.equal(classifyTransport("步行上坡"), "walk"); assert.equal(classifyTransport("近铁京都线"), "rail"); assert.equal(classifyTransport("渡轮"), "ship");
});

const day: Day = { index: 1, date: "2026-11-14", title: "测试", city: "osaka", lodging: "难波", entries: [
  { id: "a", type: "place", name: "关西机场", category: "airport", plannedStart: "13:30" },
  { id: "b", type: "transport", mode: "rail", label: "JR 关空快速", durationMinutes: 50 },
  { id: "c", type: "lodging", name: "难波 · 酒店" },
  { id: "d", type: "transport", mode: "walk", label: "步行", durationMinutes: 8 },
  { id: "e", type: "place", name: "道顿堀", category: "sight", plannedStart: "17:00", visited: true },
  { id: "f", type: "transport", mode: "walk", label: "步行", durationMinutes: 10 },
  { id: "g", type: "place", name: "心斋桥", category: "shop", plannedStart: "18:30" },
] };

test("时间线：计划时间校准、停留倒推、交通累加", () => {
  const tl = buildTimeline(day);
  const by = Object.fromEntries(tl.items.map((i) => [i.entryId, i]));
  assert.equal(by.a.start, "13:30"); assert.equal(by.a.minutes, 17 * 60 - (13 * 60 + 30) - 58);  // 停留 = 17:00 − 13:30 − 途中 58 分钟
  assert.equal(by.e.start, "17:00"); assert.equal(by.e.minutes, 80); assert.equal(by.g.start, "18:30"); assert.equal(by.g.minutes, 75);
  assert.equal(tl.walkMinutes, 18); assert.equal(tl.transitMinutes, 50);
});

test("日记与世界设定是确定性的", () => {
  const t = { seed: 42, theme: "红叶古都", startDate: "2026-11-14" };
  assert.equal(generateDiary(t, day), generateDiary(t, day));
  assert.ok(generateDiary(t, day).includes("道顿堀"));
  const spec = deriveWorldSpec(t); assert.equal(spec.season, "autumn"); assert.equal(spec.palette, "sea");
  assert.deepEqual(coverColors(spec), coverColors(deriveWorldSpec(t)));
});
