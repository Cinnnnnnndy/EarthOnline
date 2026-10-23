import { test } from "node:test";
import assert from "node:assert/strict";
import { caseGroups, searchCase, toggleEntry, gearHints, daysIn, GEAR_GROUPS, GEAR_ORDER, CASE_SCENES, inBoxCount, type CaseContext } from "./case-search.ts";
import { countriesIn, countryLabel, COUNTRY_NAMES, SOUVENIRS } from "../geo/souvenirs.ts";
import { EXTRA_KINDS } from "../planner/protocol.ts";
import { caseContents, frontRow, isCaseExtra, MAX_SOUVENIRS, MAX_FRONT } from "./suitcase.ts";
import { tripBrief, rulesExtras } from "./pack-extras.ts";
import { t } from "../i18n/index.ts";
import type { Trip, CaseEdits } from "../spec/types.ts";

const trip: Trip = {
  schemaVersion: "0.3", id: "t1", title: "关西七日", destination: "日本、关西", startDate: "2026-11-14", endDate: "2026-11-16", theme: "红叶古都", seed: 7, status: "closed", createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
  days: [
    { index: 1, date: "2026-11-14", title: "抵达", city: "osaka", entries: [{ id: "b", type: "place", name: "道顿堀", category: "food", visited: true }] },
    { index: 2, date: "2026-11-15", title: "京都", city: "kyoto", entries: [{ id: "d", type: "place", name: "清水寺", category: "sight", geo: { lat: 34.9949, lng: 135.785 } }] },
    { index: 3, date: "2026-11-16", title: "返程", city: "osaka", entries: [{ id: "e", type: "place", name: "大阪城", category: "sight" }] },
  ],
};
const ctx = (tr: Trip = trip): CaseContext => ({ trip: tr, extras: [{ kind: "camera", reason: "名胜多" }, { kind: "sketchbook", reason: "人文多" }], locale: "zh-Hans" });

test("清单：默认分组——这趟的名胜、当地特色、随身物件四组（20 样都在）、各地特色；在箱子里的标出来；64 国都有英日名", () => {
  const gs = caseGroups(ctx());
  assert.deepEqual(gs.map((g) => g.id), ["landmarks", "local", ...GEAR_ORDER, "world"]);
  assert.deepEqual(gs[0].entries.map((e) => [e.label, e.inBox, e.sub]), [["道顿堀", true, "第 1 天"], ["清水寺", true, "第 2 天"], ["大阪城", true, "第 3 天"]]);
  assert.deepEqual(gs[1].entries.map((e) => [e.id, e.inBox, e.sub]), [["daruma", true, "日本"], ["manekineko", true, "日本"], ["matchaTin", false, "日本"], ["omamori", false, "日本"]], "日本的四样都列出来，前两样在箱子里");
  const gear = gs.slice(2, 6).flatMap((g) => g.entries); assert.deepEqual([...gear.map((e) => e.id)].sort(), [...EXTRA_KINDS].sort(), "随身物件 20 样各在一组");
  assert.deepEqual(gear.filter((e) => e.inBox).map((e) => e.id), ["camera", "sketchbook"], "AI 加的两样在箱子里");
  assert.ok(gear.every((e) => !e.mine), "都不是自己挑的");
  assert.ok(gs[6].entries.length >= 70 && gs[6].entries.every((e) => e.country !== "日本"), "各地特色不含这趟的国家");
  assert.equal(inBoxCount(gs), 7);
  for (const k of Object.keys(SOUVENIRS)) assert.ok(COUNTRY_NAMES[k], `${k} 有英日名`);
  assert.equal(countryLabel("韩国", "en"), "Korea"); assert.equal(countryLabel("韩国", "ja"), "韓国"); assert.equal(countryLabel("韩国", "zh-Hans"), "韩国");
  assert.deepEqual(Object.values(GEAR_GROUPS).flat().length, 20); assert.equal(CASE_SCENES.length, 4);
  for (const l of ["zh-Hans", "en", "ja"] as const) for (const s of CASE_SCENES) assert.ok(gearHints(t(`case.scene.${s}`, undefined, l)).length, `场景标签「${s}」的 ${l} 文字认得出`);
});

test("清单：一句话——认国家、场景词、天数（中英日）", () => {
  assert.deepEqual(countriesIn("国庆去韩国玩7天"), ["韩国"]);
  assert.deepEqual(countriesIn("Chase the aurora in Iceland, then Tokyo"), ["冰岛", "日本"]);
  assert.deepEqual(countriesIn("印度尼西亚的巴厘岛"), ["印度尼西亚"], "「印度尼西亚」里的「印度」不算");
  assert.deepEqual(countriesIn("ukulele rocks"), [], "拉丁字母按整词：ukulele 不是 uk");
  assert.deepEqual(gearHints("国庆去韩国玩7天"), ["powerbank", "book"]);
  assert.deepEqual(gearHints("下雨天去京都逛三天"), ["umbrella", "sketchbook", "camera"]);
  assert.deepEqual(gearHints("追极光"), ["scarf", "mittens", "thermos"]);
  assert.deepEqual(gearHints("Beach day"), ["swimRing", "sunscreen", "hat", "sunglasses"]);
  assert.deepEqual(gearHints("ビーチでのんびり"), ["swimRing", "sunscreen", "hat", "sunglasses", "book"]);
  assert.equal(daysIn("三天"), 3); assert.equal(daysIn("一周"), 7); assert.equal(daysIn("5 days"), 5); assert.equal(daysIn("十二日"), 12); assert.equal(daysIn("走走"), null);
  // 搜索结果的分组
  const r = searchCase("国庆去韩国玩7天", ctx());
  assert.deepEqual(r.map((g) => [g.id, g.label]), [["country:韩国", "韩国的特色"], ["gear", "随身物件"]]);
  assert.deepEqual(r[0].entries.map((e) => e.id), ["seaweed", "hahoeMask", "gochujang"]); assert.deepEqual(r[1].entries.map((e) => e.id), ["powerbank", "book"]);
  const en = searchCase("three rainy days strolling in Kyoto", { ...ctx(), locale: "en" });
  assert.deepEqual(en.map((g) => g.label), ["From Japan", "Gear"]); assert.deepEqual(en[1].entries.map((e) => e.id), ["umbrella", "sketchbook", "camera"]);
  // 按名字找：中英日、名胜；找不到为空
  assert.deepEqual(searchCase("相机", ctx()).flatMap((g) => g.entries.map((e) => e.id)), ["camera"]);
  assert.deepEqual(searchCase("camera", ctx()).flatMap((g) => g.entries.map((e) => e.id)), ["camera"]);
  assert.deepEqual(searchCase("达摩", ctx()).map((g) => [g.id, g.entries.map((e) => e.id)]), [["world", ["daruma"]]]);
  assert.deepEqual(searchCase("寺", ctx()).map((g) => g.id), ["landmarks", "gear"], "「寺」既是清水寺也是逛人文");
  assert.deepEqual(searchCase("火星", ctx()), []);
  // 一句话也进装箱规则（note 排最前）
  const b = tripBrief(trip, "  下雨天去京都逛三天  "); assert.equal(b.note, "下雨天去京都逛三天");
  assert.deepEqual(rulesExtras(b, { tripsCount: 1, visitedTotal: 0 }, "zh-Hans").map((e) => [e.kind, e.reason]), [["umbrella", "你说的"], ["sketchbook", "你说的"], ["camera", "你说的"]]);
  assert.equal(tripBrief(trip).note, undefined); assert.equal(tripBrief(trip, "x".repeat(200)).note?.length, 120);
});

test("清单：放进去 / 拿出来——自己挑的从 picks / gear 删，目的地给的与 AI 加的记进 hidden；后排最多 4、前排最多 3", () => {
  let tr = trip; const ed = (): CaseEdits | undefined => tr.suitcase;   // 经过函数拿，免得 deepEqual 把 tr.suitcase 的类型收窄
  const run = (type: "souvenir" | "extra" | "landmark", id: string) => {
    const e = caseGroups(ctx(tr)).flatMap((g) => g.entries).find((x) => x.type === type && x.id === id)!; const r = toggleEntry(e, ctx(tr)); tr = { ...tr, suitcase: r.edits }; return r.result;
  };
  assert.equal(run("souvenir", "matchaTin"), "added"); assert.deepEqual(ed(), { picks: ["matchaTin"] });
  assert.equal(run("souvenir", "puffin"), "added"); assert.equal(caseContents(tr).souvenirs.length, MAX_SOUVENIRS);
  assert.equal(run("souvenir", "troll"), "backFull"); assert.deepEqual(ed()?.picks, ["matchaTin", "puffin"]);
  assert.equal(run("souvenir", "daruma"), "removed"); assert.deepEqual(ed()?.hidden, ["sv:daruma"], "目的地给的拿出来是藏起来");
  assert.equal(run("souvenir", "daruma"), "added"); assert.equal(ed()?.hidden, undefined, "再点一下放回去");
  assert.equal(run("souvenir", "puffin"), "removed"); assert.deepEqual(ed()?.picks, ["matchaTin"], "自己挑的拿出来是从 picks 删");
  // 随身物件：AI 加的 camera 在箱子里 → 拿出来是藏；放回去算自己挑的；前排最多 3
  assert.equal(run("extra", "camera"), "removed"); assert.deepEqual(ed()?.hidden, ["ex:camera"]);
  assert.equal(run("extra", "camera"), "added"); assert.deepEqual([ed()?.hidden, ed()?.gear], [undefined, ["camera"]]);
  assert.equal(run("extra", "thermos"), "added"); assert.equal(run("extra", "umbrella"), "added");
  assert.equal(run("extra", "hat"), "frontFull"); assert.deepEqual(ed()?.gear, ["camera", "thermos", "umbrella"]);
  const front = frontRow(caseContents(tr), ctx().extras); assert.equal(front.length, MAX_FRONT); assert.ok(front.every((x) => isCaseExtra(x) && x.mine), "前排三样都是自己挑的，AI 的挤出去了");
  const gs = caseGroups(ctx(tr)); assert.deepEqual(gs.slice(2, 6).flatMap((g) => g.entries).filter((e) => e.inBox).map((e) => [e.id, e.mine]), [["camera", true], ["thermos", true], ["umbrella", true]]);
  assert.equal(run("extra", "thermos"), "removed"); assert.deepEqual(ed()?.gear, ["camera", "umbrella"]);
  // 名胜
  assert.equal(run("landmark", "清水寺"), "removed"); assert.deepEqual(ed()?.hidden, ["lm:清水寺"]); assert.equal(caseContents(tr).landmarks.length, 2);
  assert.equal(run("landmark", "清水寺"), "added"); assert.equal(caseContents(tr).landmarks.length, 3);
});
