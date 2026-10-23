import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLANS, PRODUCT, PRODUCTS, limitsFor, canCreateTrip, canUse, tripsInUse, tripQuota, aiPlansLeft, entitlementFrom, yearlySaving, usageMonth,
  type TripLike, type Currency,
} from "./plans.ts";

const trip = (status: TripLike["status"], extra: Partial<TripLike> = {}): TripLike => ({ status, ...extra });

test("商品 id 固定（App Store Connect / 华为 AGC 里建的就是这几个）", () => {
  assert.equal(PRODUCT.proMonthly, "app.earthonline.pro.monthly");
  assert.equal(PRODUCT.proYearly, "app.earthonline.pro.yearly");
  assert.equal(PRODUCT.packLandmarks, "app.earthonline.pack.landmarks");
  for (const [id, p] of Object.entries(PRODUCTS)) {
    assert.equal(p.id, id);
    assert.ok(/^app\.earthonline\.[a-z]+\.[a-z0-9]+$/.test(id), id);
    for (const c of ["CNY", "USD", "JPY"] as Currency[]) assert.ok(p.price[c] > 0, `${id} 缺 ${c} 价格`);
    assert.equal(p.kind === "subscription", !!p.period, `${id}：订阅才有周期`);
  }
});

test("按年比按月便宜，三种货币都省三成以上", () => {
  for (const c of ["CNY", "USD", "JPY"] as Currency[]) {
    const s = yearlySaving(c);
    assert.ok(s > 0.3 && s < 0.6, `${c} 省 ${Math.round(s * 100)}%`);
  }
  assert.equal(Math.round(yearlySaving("CNY") * 100), 39);
});

test("免费版与 Pro 的额度", () => {
  assert.deepEqual(limitsFor("free"), { maxTrips: 3, aiPlansPerMonth: 2, cloudSync: false, exportHiRes: false, packs: [] });
  const pro = limitsFor("pro");
  assert.equal(pro.maxTrips, Infinity);
  assert.equal(pro.aiPlansPerMonth, 20);
  assert.ok(pro.cloudSync && pro.exportHiRes);
  assert.deepEqual(pro.packs, ["landmarks", "outfits"]);
});

test("limitsFor 返回副本，改了不影响套餐表", () => {
  const l = limitsFor("free"); l.maxTrips = 99; (l.packs as string[]).push("landmarks");
  assert.equal(PLANS.free.maxTrips, 3);
  assert.deepEqual(limitsFor("free").packs, []);
});

test("认不出的套餐按免费版（读坏的存储不会多给权益）", () => {
  assert.deepEqual(limitsFor("gold" as never), limitsFor("free"));
  assert.deepEqual(limitsFor({ plan: "vip" as never, owned: ["nope" as never] }), limitsFor("free"));
  assert.equal(canUse(null as never, "cloudSync"), false);
});

test("名额：走完的行程不占，同一行程的几个方案算一个", () => {
  const trips = [
    trip("planning", { plan: { group: "iceland" } }), trip("planning", { plan: { group: "iceland" } }),   // 冰岛两个方案
    trip("traveling"),
    trip("closed"), trip("closed"), trip("closed"), trip("closed"),                                           // 足迹，永远免费
  ];
  assert.equal(tripsInUse(trips), 2);
  assert.equal(canCreateTrip("free", trips), true);
  assert.equal(canCreateTrip("free", [...trips, trip("planning")]), false);
  assert.deepEqual(tripQuota("free", [...trips, trip("planning")]), { used: 3, limit: 3, left: 0 });
});

test("结束日已过、状态还没刷新的行程按走完算", () => {
  const trips = [trip("planning", { endDate: "2026-08-01" }), trip("planning", { endDate: "2026-10-12" }), trip("traveling", { endDate: "2026-09-30" })];
  assert.equal(tripsInUse(trips), 3);
  assert.equal(tripsInUse(trips, "2026-09-30"), 2);
  assert.equal(canCreateTrip("free", trips, "2026-09-30"), true);
});

test("也可以直接传已占用的名额数", () => {
  assert.equal(canCreateTrip("free", 2), true);
  assert.equal(canCreateTrip("free", 3), false);
  assert.equal(canCreateTrip("pro", 500), true);
  assert.equal(canCreateTrip("free", -1), true);
});

test("买了「再加 3 个行程位」：免费版上限变 6，Pro 仍不限", () => {
  const e = { plan: "free" as const, owned: [PRODUCT.slotsPlus3] };
  assert.equal(limitsFor(e).maxTrips, 6);
  assert.equal(canCreateTrip(e, 5), true);
  assert.equal(canCreateTrip(e, 6), false);
  assert.equal(limitsFor({ plan: "pro", owned: [PRODUCT.slotsPlus3] }).maxTrips, Infinity);
});

test("功能：同步与高清导出只在 Pro；内容包可以单买", () => {
  assert.equal(canUse("free", "cloudSync"), false);
  assert.equal(canUse("pro", "cloudSync"), true);
  assert.equal(canUse("free", "exportHiRes"), false);
  assert.equal(canUse("free", "pack.landmarks"), false);
  assert.equal(canUse({ plan: "free", owned: [PRODUCT.packLandmarks] }, "pack.landmarks"), true);
  assert.equal(canUse({ plan: "free", owned: [PRODUCT.packLandmarks] }, "pack.outfits"), false);
  assert.equal(canUse("pro", "pack.outfits"), true);
});

test("AI 规划按月计次", () => {
  assert.equal(canUse("free", "aiPlan"), true);
  assert.equal(canUse("free", "aiPlan", { aiPlansThisMonth: 1 }), true);
  assert.equal(canUse("free", "aiPlan", { aiPlansThisMonth: 2 }), false);
  assert.equal(aiPlansLeft("free", 5), 0);
  assert.equal(aiPlansLeft("pro", 5), 15);
  assert.equal(canUse("pro", "aiPlan", { aiPlansThisMonth: 20 }), false);   // Pro 也有够用上限，防滥用
  assert.equal(usageMonth("2026-09-30T23:59:00+08:00"), "2026-09");
});

test("验票结果 → 权益：订阅任一档就是 Pro，一次性购买单独记着", () => {
  assert.deepEqual(entitlementFrom([]), { plan: "free", owned: [] });
  assert.deepEqual(entitlementFrom([PRODUCT.proYearly]), { plan: "pro", owned: [] });
  assert.deepEqual(entitlementFrom([PRODUCT.packOutfits, PRODUCT.proMonthly, "com.other.thing", PRODUCT.packOutfits]), { plan: "pro", owned: [PRODUCT.packOutfits] });
  const lapsed = entitlementFrom([PRODUCT.packLandmarks]);                  // 订阅过期：回到免费版，单买的包还在
  assert.equal(lapsed.plan, "free");
  assert.equal(canUse(lapsed, "pack.landmarks"), true);
  assert.equal(canUse(lapsed, "cloudSync"), false);
});
