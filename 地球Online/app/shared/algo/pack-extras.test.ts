import { test } from "node:test";
import assert from "node:assert/strict";
import { tripBrief, rulesExtras } from "./pack-extras.ts";
import { checkPackRequest, checkPackResponse, EXTRA_KINDS } from "../planner/protocol.ts";
import type { Trip } from "../spec/types.ts";

const iceland: Trip = {
  schemaVersion: "0.3", id: "i", title: "冰岛环岛", destination: "冰岛", startDate: "2026-10-01", endDate: "2026-10-04", theme: "极光冰原", seed: 3, status: "closed", createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
  days: [
    { index: 1, date: "2026-10-01", title: "D1", city: "geo", entries: [
      { id: "a", type: "place", name: "哈尔格林姆教堂", category: "sight", geo: { lat: 64.1417, lng: -21.9266 } }, { id: "t1", type: "transport", mode: "car", label: "自驾", durationMinutes: 50 },
      { id: "b", type: "place", name: "蓝湖", category: "sight", geo: { lat: 63.88, lng: -22.45 } }] },
    { index: 2, date: "2026-10-02", title: "D2", city: "geo", entries: [
      { id: "c", type: "place", name: "塞里雅兰瀑布", category: "sight" }, { id: "t2", type: "transport", mode: "car", label: "自驾", durationMinutes: 30 },
      { id: "d", type: "place", name: "斯科加瀑布", category: "sight" }, { id: "t3", type: "transport", mode: "car", label: "自驾", durationMinutes: 40 }, { id: "e", type: "place", name: "黑沙滩", category: "sight" }] },
    { index: 3, date: "2026-10-03", title: "D3", city: "geo", entries: [{ id: "f", type: "place", name: "冰河湖", category: "sight" }, { id: "g", type: "place", name: "钻石冰沙滩", category: "sight" }] },
  ],
};

test("装箱规则：摘要算对（季节、纬度、类型、名胜、交通），冰岛十月自驾 → 保温杯、游泳圈、登山鞋（最多三样）", () => {
  const b = tripBrief(iceland);
  assert.equal(b.season, "autumn");                          // 主题「极光冰原」的季节表给的是秋
  assert.equal(b.maxAbsLat, 64.1417); assert.equal(b.days, 3);
  assert.equal(b.transports.car, 3); assert.ok(b.famous >= 4, `名胜 ${b.famous}`);
  assert.ok((b.kinds.waterfall ?? 0) >= 2 && (b.kinds.beach ?? 0) >= 2, JSON.stringify(b.kinds));
  const ex = rulesExtras(b, { tripsCount: 1, visitedTotal: 0 }, "zh-Hans");
  assert.deepEqual(ex.map((e) => e.kind), ["thermos", "swimRing", "boots"]);
  assert.equal(ex[0].reason, "追极光的夜里冷");
  assert.equal(rulesExtras(b, { tripsCount: 1, visitedTotal: 0 }, "en")[0].reason, "Aurora nights are cold");
  // 只能挑有模型的
  assert.deepEqual(rulesExtras(b, { tripsCount: 5, visitedTotal: 9 }, "ja", ["camera", "plush"]).map((e) => e.kind), ["camera", "plush"]);
  assert.equal(rulesExtras(b, { tripsCount: 5, visitedTotal: 9 }, "ja", ["plush"])[0].reason, "5 回目の旅、相棒も一緒に");
});

test("装箱规则：夏天海岛 → 墨镜与游泳圈；樱花季的日本 → 折叠伞", () => {
  const island: Trip = { ...iceland, title: "巴厘岛", destination: "印度尼西亚", startDate: "2026-07-10", endDate: "2026-07-14", theme: "离岛夏日", days: [{ index: 1, date: "2026-07-10", title: "D1", city: "geo", entries: [{ id: "a", type: "place", name: "金巴兰海滩", category: "sight" }] }] };
  assert.deepEqual(rulesExtras(tripBrief(island), { tripsCount: 1, visitedTotal: 0 }, "zh-Hans").map((e) => e.kind), ["swimRing", "sunglasses", "hat"]);
  assert.deepEqual(rulesExtras(tripBrief(island), { tripsCount: 1, visitedTotal: 0 }, "zh-Hans", ["sunscreen", "powerbank", "book"]).map((e) => e.kind), ["sunscreen"], "只剩候选里的");
  const kyoto: Trip = { ...iceland, title: "京都", destination: "日本", startDate: "2026-04-02", endDate: "2026-04-05", theme: "樱花春日", days: [{ index: 1, date: "2026-04-02", title: "D1", city: "geo", entries: [{ id: "a", type: "place", name: "清水寺", category: "sight" }] }] };
  assert.ok(rulesExtras(tripBrief(kyoto), { tripsCount: 1, visitedTotal: 0 }, "zh-Hans").some((e) => e.kind === "umbrella"));
});

test("装箱协议：请求与回答的检查", () => {
  const req = { brief: tripBrief(iceland), context: { locale: "zh-Hans", profile: { tripsCount: 1, visitedTotal: 0 }, candidates: [...EXTRA_KINDS] } };
  assert.deepEqual(checkPackRequest(req), []);
  assert.ok(checkPackRequest({ ...req, brief: { ...req.brief, season: "monsoon" } }).some((e) => e.includes("season")));
  assert.ok(checkPackRequest({ ...req, context: { ...req.context, candidates: ["jetpack"] } }).some((e) => e.includes("candidates")));
  assert.deepEqual(checkPackRequest({ ...req, brief: { ...req.brief, note: "下雨天去京都逛三天" } }), [], "一句话（D84）可以带");
  assert.ok(checkPackRequest({ ...req, brief: { ...req.brief, note: "x".repeat(121) } }).some((e) => e.includes("note")));
  assert.deepEqual(checkPackResponse({ extras: [{ kind: "camera", reason: "名胜多" }] }), []);
  assert.ok(checkPackResponse({ extras: [{ kind: "jetpack", reason: "" }] }).length > 0);
});
