import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPlace } from "./landmark-kinds.ts";
import { famousFor, tierOf } from "./landmark-famous.ts";

test("类型：按名字的关键词（中 / 英 / 北欧 / 日文）", () => {
  const cases: [string, string][] = [
    ["古佛斯瀑布", "waterfall"], ["Stjórnarfoss", "waterfall"], ["索尔黑马冰川", "glacier"], ["鱼市 Fisketorget", "market"],
    ["Fløibanen 缆车", "cablecar"], ["Aker Brygge 海滨", "beach"], ["Haukland + Mannen徒步", "trail"], ["清水寺三重塔", "temple"],
    ["东京塔", "tower"], ["大英博物馆", "museum"], ["天空树展望台", "viewpoint"], ["蓝湖温泉", "hotspring"], ["苏丹艾哈迈德清真寺", "mosque"],
    ["嵐山竹林", "forest"], ["某个没见过的地方", "sight"],
  ];
  for (const [name, kind] of cases) assert.equal(classifyPlace({ name, category: "sight" }), kind, name);
});

test("类型：住处、机场以类别为准；地图标签优先于名字；写明的 kind 最优先", () => {
  assert.equal(classifyPlace({ name: "哈尔格林姆教堂大本营", category: "hotel" }), "hotel");
  assert.equal(classifyPlace({ name: "京都站前酒店", category: "hotel" }), "hotel");
  assert.equal(classifyPlace({ name: "Svolvær 机场 SVJ", category: "airport" }), "airport");
  assert.equal(classifyPlace({ name: "Old Mill", category: "sight", tags: { tourism: "museum" } }), "museum");
  assert.equal(classifyPlace({ name: "古佛斯瀑布", category: "sight", kind: "lake" }), "lake");
  assert.equal(classifyPlace({ name: "拉面一兰", category: "food" }), "food");
});

test("名胜：按名字或坐标认出；住处不算；没做模型的先用类型模型", () => {
  assert.equal(famousFor({ name: "北极大教堂", category: "sight" })?.model, "arcticCathedral");
  assert.equal(famousFor({ name: "教堂（导入时没写全名）", category: "sight", lat: 64.1419, lng: -21.9262 })?.id, "hallgrimskirkja");
  assert.equal(famousFor({ name: "哈尔格林姆教堂大本营", category: "hotel", lat: 64.1418, lng: -21.9266 }), null);
  assert.equal(tierOf({ name: "某某寺", category: "sight" }, classifyPlace).kind, "temple");
  assert.equal(tierOf({ name: "小美人鱼铜像", category: "sight" }, classifyPlace).tier, "famous");
  assert.equal(tierOf({ name: "某个没见过的地方", category: "sight" }, classifyPlace).tier, "fallback");
});
