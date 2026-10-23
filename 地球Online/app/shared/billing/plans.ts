/** 套餐与权益（商业模式见 地球Online/06_商业模式.md）。
 *
 *  纯数据 + 纯函数：不碰 DOM、不碰存储、不联网。网页参考应用、iOS（StoreKit 2）、鸿蒙（IAP Kit）照同一张表判断「能不能用」，
 *  付款与验票在各端原生层做，验完把「正在生效的商品 id」交给 entitlementFrom()，其余判断都从这里出。
 *
 *  规则：
 *   - 免费版：同时最多 3 个没走完的行程（同一行程的几个方案算一个；走完的行程变成足迹，不占名额、永远免费）；
 *     每月 2 次 AI 规划；数据只在本机；普通长图与 JSON 导出。
 *   - Pro（按月 / 按年订阅）：行程不限，每月 20 次 AI 规划（够用上限），多设备同步，打印级导出，名胜包与服装包订阅期内可用。
 *   - 一次性购买（非消耗型，买了一直有）：名胜包、服装包、再加 3 个行程位。
 *
 *  价格是建议零售价（上架时按各商店的价格档取最近的一档）；真实 App 里显示的价格以 StoreKit / IAP Kit 返回的本地化价格为准。 */
import type { TripStatus } from "../spec/types.ts";

export type PlanId = "free" | "pro";
export type PackId = "landmarks" | "outfits";
export type Currency = "CNY" | "USD" | "JPY";

/** 商品 id（App Store Connect 与华为 AGC 用同一套，iOS 与鸿蒙的订阅在同一个订阅组里） */
export const PRODUCT = {
  proMonthly: "app.earthonline.pro.monthly",
  proYearly: "app.earthonline.pro.yearly",
  packLandmarks: "app.earthonline.pack.landmarks",
  packOutfits: "app.earthonline.pack.outfits",
  slotsPlus3: "app.earthonline.slots.plus3",
} as const;
export type ProductId = (typeof PRODUCT)[keyof typeof PRODUCT];

export interface Limits {
  /** 同时没走完的行程（planning / traveling）上限；Infinity = 不限 */
  maxTrips: number;
  /** 每个自然月可以发起的 AI 规划对话数（一次对话里追问、改几轮都算一次） */
  aiPlansPerMonth: number;
  /** 多设备同步（iCloud CloudKit 私有库 / 华为云空间），数据在用户自己的云账户里 */
  cloudSync: boolean;
  /** 打印级长图（3 倍图）与 PDF；普通长图、JSON 导出永远免费 */
  exportHiRes: boolean;
  /** 可用的内容包 */
  packs: readonly PackId[];
}

export const PLANS: Readonly<Record<PlanId, Readonly<Limits>>> = {
  free: { maxTrips: 3, aiPlansPerMonth: 2, cloudSync: false, exportHiRes: false, packs: [] },
  pro: { maxTrips: Infinity, aiPlansPerMonth: 20, cloudSync: true, exportHiRes: true, packs: ["landmarks", "outfits"] },
};

/** 一次性购买加的名额 */
export const SLOTS_PER_PURCHASE = 3;

export interface Product {
  id: ProductId;
  kind: "subscription" | "non-consumable";
  /** 订阅周期 */
  period?: "month" | "year";
  /** 首次订阅的免费试用天数（Apple / 华为的「推介促销」），没有就不写 */
  trialDays?: number;
  /** 建议零售价（含税标价）：人民币（中国大陆店面）、美元（美国及多数海外店面）、日元 */
  price: Readonly<Record<Currency, number>>;
}

export const PRODUCTS: Readonly<Record<ProductId, Readonly<Product>>> = {
  [PRODUCT.proMonthly]: { id: PRODUCT.proMonthly, kind: "subscription", period: "month", price: { CNY: 12, USD: 3.99, JPY: 480 } },
  [PRODUCT.proYearly]: { id: PRODUCT.proYearly, kind: "subscription", period: "year", trialDays: 7, price: { CNY: 88, USD: 24.99, JPY: 3000 } },
  [PRODUCT.packLandmarks]: { id: PRODUCT.packLandmarks, kind: "non-consumable", price: { CNY: 18, USD: 2.99, JPY: 500 } },
  [PRODUCT.packOutfits]: { id: PRODUCT.packOutfits, kind: "non-consumable", price: { CNY: 12, USD: 1.99, JPY: 300 } },
  [PRODUCT.slotsPlus3]: { id: PRODUCT.slotsPlus3, kind: "non-consumable", price: { CNY: 18, USD: 2.99, JPY: 500 } },
};

const PACK_PRODUCT: Record<PackId, ProductId> = { landmarks: PRODUCT.packLandmarks, outfits: PRODUCT.packOutfits };
const PRO_PRODUCTS: readonly ProductId[] = [PRODUCT.proMonthly, PRODUCT.proYearly];

/** 一个人的权益：套餐 + 买过的一次性商品 */
export interface Entitlement {
  plan: PlanId;
  owned?: readonly ProductId[];
}
/** 大多数调用只关心套餐，直接传 "free" / "pro" 也行 */
export type PlanLike = PlanId | Entitlement;

export type Feature = "cloudSync" | "exportHiRes" | "aiPlan" | `pack.${PackId}`;
export interface Usage {
  /** 本月已经用掉的 AI 规划次数 */
  aiPlansThisMonth?: number;
}

/** 行程里判断名额要用到的字段（Trip 的子集，方便原生壳与测试直接传） */
export interface TripLike {
  status: TripStatus;
  endDate?: string;
  plan?: { group: string } | undefined;
  id?: string;
}

const isPlanId = (x: unknown): x is PlanId => x === "free" || x === "pro";
const isProductId = (x: unknown): x is ProductId => typeof x === "string" && x in PRODUCTS;

function normalize(p: PlanLike | null | undefined): Required<Entitlement> {
  if (typeof p === "string") return { plan: isPlanId(p) ? p : "free", owned: [] };
  if (p && typeof p === "object") return { plan: isPlanId(p.plan) ? p.plan : "free", owned: (p.owned ?? []).filter(isProductId) };
  return { plan: "free", owned: [] };                                    // 读坏的存储、没登录：一律按免费版，永远不会多给
}

/** 原生层验完票后的「正在生效的商品 id」→ 权益。订阅过期与否由 StoreKit / IAP Kit 判断，这里只认传进来的。 */
export function entitlementFrom(activeProductIds: readonly string[]): Entitlement {
  const owned = [...new Set(activeProductIds.filter(isProductId))];
  return { plan: owned.some((id) => PRO_PRODUCTS.includes(id)) ? "pro" : "free", owned: owned.filter((id) => !PRO_PRODUCTS.includes(id)) };
}

/** 这个人现在的额度（返回新对象，改它不会影响 PLANS） */
export function limitsFor(plan: PlanLike): Limits {
  const e = normalize(plan); const base = PLANS[e.plan];
  const extraSlots = e.owned.includes(PRODUCT.slotsPlus3) ? SLOTS_PER_PURCHASE : 0;
  const packs = new Set<PackId>(base.packs);
  for (const [pack, id] of Object.entries(PACK_PRODUCT) as [PackId, ProductId][]) if (e.owned.includes(id)) packs.add(pack);
  return { ...base, maxTrips: base.maxTrips + extraSlots, packs: [...packs].sort() };
}

/** 占名额的行程：没走完的（planning / traveling，且结束日不早于今天），同一 plan.group 的几个方案只算一个 */
export function tripsInUse(trips: readonly TripLike[], today?: string): number {
  const keys = new Set<string>(); let solo = 0;
  for (const t of trips) {
    if (t.status === "closed") continue;
    if (today && t.endDate && t.endDate < today) continue;                // 日期已过、状态还没刷新的，也按走完算
    if (t.plan?.group) keys.add(t.plan.group); else solo++;
  }
  return keys.size + solo;
}

/** 名额明细：用了几个、上限、还剩几个（给提示文字用） */
export function tripQuota(plan: PlanLike, trips: readonly TripLike[] | number, today?: string): { used: number; limit: number; left: number } {
  const used = typeof trips === "number" ? Math.max(0, trips) : tripsInUse(trips, today);
  const limit = limitsFor(plan).maxTrips;
  return { used, limit, left: Math.max(0, limit - used) };
}

/** 能不能再建一个新行程。trips 可以传行程列表，也可以直接传「已占用的名额数」。
 *  给已有行程加一个方案（同一 plan.group）不占新名额，不需要问这个函数。 */
export function canCreateTrip(plan: PlanLike, trips: readonly TripLike[] | number, today?: string): boolean {
  return tripQuota(plan, trips, today).left > 0;
}

/** 本月还剩几次 AI 规划 */
export function aiPlansLeft(plan: PlanLike, usedThisMonth: number): number {
  return Math.max(0, limitsFor(plan).aiPlansPerMonth - Math.max(0, usedThisMonth));
}

/** 能不能用某个功能。aiPlan 要带上本月用量（不带按 0 算）。 */
export function canUse(plan: PlanLike, feature: Feature, usage: Usage = {}): boolean {
  const l = limitsFor(plan);
  switch (feature) {
    case "cloudSync": return l.cloudSync;
    case "exportHiRes": return l.exportHiRes;
    case "aiPlan": return aiPlansLeft(plan, usage.aiPlansThisMonth ?? 0) > 0;
    default: {
      const pack = feature.slice("pack.".length) as PackId;
      return l.packs.includes(pack);
    }
  }
}

/** 按年比按月 × 12 省多少（0–1），给付费页显示「省 39%」 */
export function yearlySaving(currency: Currency): number {
  const m = PRODUCTS[PRODUCT.proMonthly].price[currency] * 12, y = PRODUCTS[PRODUCT.proYearly].price[currency];
  return m > 0 ? 1 - y / m : 0;
}

/** AI 规划次数按自然月计：给一个 ISO 时间，返回计数用的月份键 "2026-09" */
export const usageMonth = (iso: string): string => iso.slice(0, 7);
