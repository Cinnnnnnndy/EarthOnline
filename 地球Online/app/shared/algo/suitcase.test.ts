import { test } from "node:test";
import assert from "node:assert/strict";
import { caseContents, layout, splitDestination, CASE, MAX_LANDMARKS, SUITCASE_STYLE, hiddenId } from "./suitcase.ts";
import { SUITCASE_STYLES } from "../spec/types.ts";
import { souvenirOf, souvenirKey, souvenirName, ALL_SOUVENIRS } from "../geo/souvenirs.ts";
import { SOUVENIR_MODEL_IDS } from "../world/souvenir-models.ts";
import type { Trip } from "../spec/types.ts";

const trip: Trip = {
  schemaVersion: "0.3", id: "t1", title: "关西七日", destination: "日本、关西", startDate: "2026-11-14", endDate: "2026-11-16", theme: "红叶古都", seed: 7, status: "closed", createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
  days: [
    { index: 1, date: "2026-11-14", title: "抵达", city: "osaka", diary: "到了。", entries: [
      { id: "a", type: "place", name: "关西机场", category: "sight" }, { id: "t1", type: "transport", mode: "rail", label: "JR", durationMinutes: 60 },
      { id: "b", type: "place", name: "道顿堀", category: "food", visited: true }] },
    { index: 2, date: "2026-11-15", title: "京都", city: "kyoto", entries: [
      { id: "c", type: "place", name: "锦市场", category: "food" }, { id: "d", type: "place", name: "清水寺", category: "sight", geo: { lat: 34.9949, lng: 135.785 } }] },
    { index: 3, date: "2026-11-16", title: "返程", city: "osaka", entries: [{ id: "e", type: "place", name: "大阪城", category: "sight" }] },
  ],
};

test("行李箱：每天挑一座名胜（名胜优先），目的地每段一样特色物件，不再有票 / 登机牌 / 明信片", () => {
  const c = caseContents(trip);
  assert.deepEqual(c.landmarks.map((l) => [l.name, l.day]), [["道顿堀", 1], ["清水寺", 2], ["大阪城", 3]], "类别写成景点的机场也不要");
  assert.ok(c.landmarks[1].famous, "清水寺是登记在册的名胜");
  assert.equal(c.landmarks[1].kind, "temple");
  assert.deepEqual(c.souvenirs, [{ place: "日本", key: "日本", item: "daruma" }, { place: "关西", key: "日本", item: "manekineko" }], "同一个国家的第二段拿第二样");
  assert.equal(c.diaryEntries, 1); assert.equal(c.visited, 1);
  assert.deepEqual(splitDestination("冰岛 + 北欧"), ["冰岛", "北欧"]);
  assert.equal(souvenirOf("日本", "zh-Hans"), "达摩"); assert.equal(souvenirOf("Japan", "en"), "Daruma"); assert.equal(souvenirKey("Iceland"), "冰岛"); assert.equal(souvenirKey("京都"), "日本"); assert.equal(souvenirOf("北欧", "zh-Hans"), null);
  assert.equal(souvenirName("manekineko", "ja"), "招き猫");
  const missing = ALL_SOUVENIRS.filter((x) => !SOUVENIR_MODEL_IDS.includes(x.item.id)).map((x) => x.item.id); assert.deepEqual(missing, [], "每样东西都有模型");
  assert.ok(ALL_SOUVENIRS.length >= 75, `库里有 ${ALL_SOUVENIRS.length} 样`);
  for (const id of SUITCASE_STYLES) { const d = SUITCASE_STYLE[id]; assert.ok(d && d.shell.length === 3 && d.lining.length === 3, `样式 ${id} 有颜色`); }
});

test("行李箱：名胜最多 6 座，超了先留名胜再按天；每样东西的位置都在各自那半箱里、互不重叠", () => {
  const many: Trip = { ...trip, days: Array.from({ length: 9 }, (_, i) => ({ index: i + 1, date: `2026-11-${14 + i}`, title: `D${i + 1}`, city: "kyoto", entries: [{ id: `p${i}`, type: "place" as const, name: i === 7 ? "清水寺" : `地点${i}`, category: "sight" as const }] })) };
  const c = caseContents(many);
  assert.equal(c.landmarks.length, MAX_LANDMARKS);
  assert.ok(c.landmarks.some((l) => l.name === "清水寺"), "第 8 天的名胜要留下");
  assert.deepEqual(c.landmarks.map((l) => l.day), [...c.landmarks.map((l) => l.day)].sort((a, b) => a - b), "展示顺序按天");
  for (const [n, m, k] of [[1, 1, 0], [3, 2, 1], [4, 3, 2], [6, 4, 3]] as const) {
    const L = layout(n, m, k);
    assert.equal(L.landmarks.length, n); assert.equal(L.souvenirs.length, m); assert.equal(L.front.length, k);
    for (const s of L.landmarks) { assert.ok(s.z > CASE.GAP / 2 && s.z < CASE.GAP / 2 + CASE.D, "名胜在下半"); assert.ok(Math.abs(s.x) <= CASE.W / 2); }
    for (const s of [L.hero, L.diary, ...L.souvenirs, ...L.front]) { assert.ok(s.z < -CASE.GAP / 2 && s.z > -CASE.GAP / 2 - CASE.D, "小人、物件、日记在上半"); assert.ok(Math.abs(s.x) <= CASE.W / 2); }
    const boxes = [L.hero, L.diary, ...L.souvenirs, ...L.front, ...L.landmarks].map((s) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; const overlap = a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6 && a.z0 < b.z1 - 1e-6 && b.z0 < a.z1 - 1e-6; assert.ok(!overlap, `${i} 与 ${j} 重叠`); }
  }
});

test("行李箱的增减（D82）：藏起来的直接拿掉不补位，从库里挑的接在特色物件后面，照片卡最多三张", () => {
  const edited: Trip = { ...trip, suitcase: { hidden: [hiddenId.landmark("清水寺"), hiddenId.souvenir("daruma", "日本"), hiddenId.extra("camera")], picks: ["alpaca", "panda", "troll"], cards: [{ id: "c1", kind: "cutout", w: 300, h: 400 }, { id: "c2", kind: "polaroid", w: 400, h: 300 }, { id: "c3", kind: "cutout", w: 1, h: 1 }, { id: "c4", kind: "cutout", w: 1, h: 1 }] } };
  const c = caseContents(edited);
  assert.deepEqual(c.landmarks.map((l) => l.name), ["道顿堀", "大阪城"], "第二天的名胜拿掉了，不用锦市场补");
  assert.deepEqual(c.souvenirs.map((s) => s.item), ["manekineko", "alpaca", "panda", "troll"], "达摩藏起来；挑的三样接在后面；一共最多 4");
  assert.deepEqual(c.cards.map((x) => x.id), ["c1", "c2", "c3"]);
  assert.ok(c.hidden.has("ex:camera"));
});
