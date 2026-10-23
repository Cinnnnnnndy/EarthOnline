import { test } from "node:test";
import assert from "node:assert/strict";
import { dueFromLead, shiftDate, allTodos, openTodos, nextTodo, todoCounts, placeTodos } from "./todos.ts";
import { validateTrip } from "../spec/validate.ts";
import type { Trip } from "../spec/types.ts";

const trip: Trip = {
  schemaVersion: "0.3", id: "t1", title: "京都三日", destination: "京都", startDate: "2026-11-10", endDate: "2026-11-12", theme: "红叶古都", seed: 7, status: "planning", createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
  days: [
    { index: 1, date: "2026-11-10", title: "抵达", city: "kyoto", entries: [
      { id: "d1-e0", type: "place", name: "清水寺", category: "sight", todos: [{ id: "a", text: "买门票", due: "2026-10-11" }, { id: "b", text: "订和服", due: "2026-11-03", done: true }] }] },
    { index: 2, date: "2026-11-11", title: "岚山", city: "kyoto", entries: [
      { id: "d2-e0", type: "place", name: "岚山小火车", category: "sight", todos: [{ id: "c", text: "买车票" }] },
      { id: "d2-e1", type: "place", name: "天龙寺", category: "sight" }] },
    { index: 3, date: "2026-11-12", title: "返程", city: "kyoto", entries: [] },
  ],
};

test("待办：提前几天 → 到期日；跨月、跨年都对", () => {
  assert.equal(dueFromLead("2026-11-10", 30), "2026-10-11");
  assert.equal(dueFromLead("2026-01-03", 7), "2025-12-27");
  assert.equal(dueFromLead("2026-11-10", 0), "2026-11-10");
  assert.equal(shiftDate("2026-02-27", 2), "2026-03-01");
});

test("待办：整本书按到期日排序，没写日期的按出发日；最近一件按今天取", () => {
  const all = allTodos(trip);
  assert.deepEqual(all.map((r) => r.todo.id), ["a", "b", "c"]);     // 10-11、11-03、11-10（出发日）
  assert.equal(all[2].due, "2026-11-10");
  assert.deepEqual(openTodos(trip).map((r) => r.todo.id), ["a", "c"]);
  assert.equal(nextTodo(trip, "2026-10-01")?.todo.id, "a");
  assert.equal(nextTodo(trip, "2026-10-20")?.todo.id, "c");          // a 已过期，取今天之后最早的
  assert.equal(nextTodo(trip, "2026-12-01")?.todo.id, "a");          // 全过期：提醒最早那件
  assert.deepEqual(todoCounts(trip), { open: 2, done: 1, total: 3 });
});

test("待办：契约校验接受合法的，拒绝缺文字或日期格式错的", () => {
  assert.deepEqual(validateTrip(trip), []);
  const bad = structuredClone(trip) as Trip;
  (bad.days[0].entries[0] as { todos: unknown[] }).todos = [{ id: "x", text: "" }, { id: "y", text: "ok", due: "11/03" }];
  const errs = validateTrip(bad);
  assert.ok(errs.some((e) => e.includes("todos[0]")) && errs.some((e) => e.includes("todos[1].due")), errs.join("; "));
});

test("待办：一个站点自己的数量与最近一件（提示跟着站点走）", () => {
  const kiyomizu = trip.days[0].entries[0] as { todos: unknown[] } & Parameters<typeof placeTodos>[0];
  assert.deepEqual(placeTodos(kiyomizu, trip.startDate).open, 1);                       // b 已做完
  assert.equal(placeTodos(kiyomizu, trip.startDate).next?.todo.id, "a");
  assert.equal(placeTodos({ todos: undefined }, trip.startDate).open, 0);
  assert.equal(placeTodos({ todos: undefined }, trip.startDate).next, undefined);
});
