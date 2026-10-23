import { test } from "node:test";
import assert from "node:assert/strict";
import { journeyState, departLabel } from "./journey.ts";
import type { Trip } from "../spec/types.ts";

const trip = (id: string, startDate: string, endDate: string, status: Trip["status"] = "planning"): Trip =>
  ({ schemaVersion: "0.3", id, title: id, destination: "x", theme: "x", startDate, endDate, status, days: [{ index: 1, date: startDate, city: "geo", title: "d1", entries: [] }, { index: 2, date: endDate, city: "geo", title: "d2", entries: [] }], seed: 1 } as unknown as Trip);

test("旅行中优先：今天落在日期内", () => {
  const j = journeyState([trip("a", "2026-09-26", "2026-10-06"), trip("b", "2026-10-01", "2026-10-03")], "2026-09-30");
  assert.equal(j.kind, "traveling"); if (j.kind === "traveling") { assert.equal(j.trip.id, "a"); assert.equal(j.dayIndex, 1); }
});
test("即将出发（3 天内）胜过刚回来", () => {
  const j = journeyState([trip("past", "2026-09-20", "2026-09-27"), trip("soon", "2026-10-02", "2026-10-05")], "2026-09-30");
  assert.equal(j.kind, "departing"); if (j.kind === "departing") assert.equal(j.inDays, 2);
  assert.equal(departLabel(2), "后天出发"); assert.equal(departLabel(0), "今天出发"); assert.equal(departLabel(5), "5 天后出发");
});
test("刚回来（7 天内结束）；更早的不算", () => {
  assert.equal(journeyState([trip("past", "2026-09-20", "2026-09-27")], "2026-09-30").kind, "back");
  assert.equal(journeyState([trip("old", "2026-08-01", "2026-08-05")], "2026-09-30").kind, "idle");
});
test("空闲：带上最近的一段以后的行程；合上的书不算旅行中", () => {
  const j = journeyState([trip("far", "2026-11-14", "2026-11-20"), trip("closed", "2026-09-29", "2026-10-02", "closed")], "2026-09-30");
  assert.equal(j.kind, "idle"); if (j.kind === "idle") assert.equal(j.next?.trip.id, "far");
  assert.equal(journeyState([], "2026-09-30").kind, "idle");
});
