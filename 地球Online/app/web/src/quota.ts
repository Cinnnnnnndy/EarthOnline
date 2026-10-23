/** 免费版的名额（商业模式第 3 节；规则在 shared/billing/plans.ts，这里只是把 store 接上去）。
 *  - 新建、导入、语音生成、加示例都要占一个「没走完的行程」名额：先过 withTripSlot()，有名额就做，没有就弹付费页。
 *  - AI 规划按月计次：只有走规划服务（远端）出的草稿才算，离线规则不算；没额度时弹付费页。
 *  碰到限制只弹一次付费页（paywall.ts 同时只开一张），不连弹。 */
import { store } from "./store.ts";
import { canCreateTrip, canUse, tripQuota } from "../../shared/billing/plans.ts";
import { openPaywall } from "./paywall.ts";
import { today } from "./globe-data.ts";

/** 名额明细：用了几个、上限、还剩几个（设置页显示「行程 2 / 3」用） */
export const tripSlots = () => tripQuota(store.entitlement, store.trips, today());
export const canAddTrip = (): boolean => canCreateTrip(store.entitlement, store.trips, today());
/** 要占一个新名额的操作先过这里：有名额返回 true 并执行；没有名额弹付费页，返回 false */
export function withTripSlot(fn: () => void): boolean {
  if (canAddTrip()) { fn(); return true; }
  openPaywall("trips"); return false;
}
export const canAiPlan = (): boolean => canUse(store.entitlement, "aiPlan", { aiPlansThisMonth: store.aiPlansThisMonth });
export function withAiPlan(fn: () => void): boolean {
  if (canAiPlan()) { fn(); return true; }
  openPaywall("ai"); return false;
}
