import { test } from "node:test";
import assert from "node:assert/strict";
import { sunAltitude, phaseOfAltitude, resolvePhase } from "./daylight.ts";

const BJ = { lat: 39.9, lng: 116.4 };

test("太阳高度：北京夏至正午约 73.5°，午夜在地平线下", () => {
  assert.ok(Math.abs(sunAltitude(new Date("2026-06-21T04:08:00Z"), BJ.lat, BJ.lng) - 73.5) < 1.2);
  assert.ok(sunAltitude(new Date("2026-06-21T16:00:00Z"), BJ.lat, BJ.lng) < -20);
});

test("雷克雅未克夏至午夜：太阳刚在地平线下，算晨昏", () => {
  const a = sunAltitude(new Date("2026-06-21T00:30:00Z"), 64.13, -21.9);
  assert.ok(a > -4 && a < 1, `alt ${a}`);
  assert.equal(phaseOfAltitude(a), "dusk");
});

test("外观：固定白天 / 夜晚优先；跟随手机时深色外观是夜，否则看当地时间", () => {
  const noon = new Date("2026-03-20T04:00:00Z"), night = new Date("2026-03-20T15:00:00Z");
  assert.equal(resolvePhase({ appearance: "light", systemDark: true, now: night, place: BJ }), "day");
  assert.equal(resolvePhase({ appearance: "dark", systemDark: false, now: noon, place: BJ }), "night");
  assert.equal(resolvePhase({ appearance: "auto", systemDark: true, now: noon, place: BJ }), "night");
  assert.equal(resolvePhase({ appearance: "auto", systemDark: false, now: noon, place: BJ }), "day");
  assert.equal(resolvePhase({ appearance: "auto", systemDark: false, now: night, place: BJ }), "night");
  assert.equal(resolvePhase({ appearance: "auto", systemDark: false, now: new Date("2026-03-20T10:10:00Z"), place: BJ }), "dusk");   // 北京 18:10，日落前后
});
