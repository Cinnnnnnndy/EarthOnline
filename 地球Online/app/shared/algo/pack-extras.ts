/** 让 AI 装箱（第八轮末，D79）：行李箱装完名胜、特色物件、小人与日记之后，再按这趟和这个人的情况加几样东西——
 *  保温杯、墨镜、相机、登山鞋、游泳圈、纸地图、望远镜、围巾、折叠伞、小玩偶，每样一句为什么。
 *  这里是本机规则（离线、确定性）：从行程算一份摘要（tripBrief），再按摘要挑（rulesExtras）。
 *  远端的规划服务（server/planner 的 /v1/pack）拿同一份摘要让模型挑，服务没有或出错时就用这里的结果（shared/planner/pack.ts）。 */
import type { Trip, PlaceEntry } from "../spec/types.ts";
import { deriveWorldSpec } from "./world-spec.ts";
import { classifyPlace } from "../world/landmark-kinds.ts";
import { tierOf } from "../world/landmark-famous.ts";
import { t, type Locale, type MsgKey } from "../i18n/index.ts";
import { EXTRA_KINDS, PACK_LIMITS, type ExtraKind, type PackBrief, type PackProfile, type PackedExtra } from "../planner/protocol.ts";
import { gearHints } from "./case-search.ts";

/** 从一本书算摘要：季节、最北 / 最南的纬度、站点类型的个数、名胜数、交通段数；note 是这个人自己说的一句话（D84，清单的搜索框），最多 120 字 */
export function tripBrief(trip: Trip, note?: string): PackBrief {
  const kinds: Record<string, number> = {}, transports: Record<string, number> = {};
  let famous = 0, maxAbsLat: number | null = null;
  for (const d of trip.days) for (const e of d.entries) {
    if (e.type === "transport") { transports[e.mode] = (transports[e.mode] ?? 0) + 1; continue; }
    if (e.type !== "place") continue;
    const p: PlaceEntry = e; const tier = tierOf({ name: p.name, category: p.category, kind: p.kind, lat: p.geo?.lat, lng: p.geo?.lng }, classifyPlace);
    kinds[tier.kind] = (kinds[tier.kind] ?? 0) + 1; if (tier.tier === "famous") famous++;
    if (p.geo) maxAbsLat = Math.max(maxAbsLat ?? 0, Math.abs(p.geo.lat));
  }
  const n = note?.trim().slice(0, PACK_LIMITS.noteChars);
  return { title: trip.title, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, theme: trip.theme, days: trip.days.length, season: deriveWorldSpec(trip).season, maxAbsLat, kinds, famous, transports, ...(n ? { note: n } : {}) };
}

/** 本机规则：按摘要挑最多 3 样（先挑的优先），只挑 candidates 里有模型的 */
export function rulesExtras(brief: PackBrief, profile: PackProfile, locale: Locale, candidates: readonly ExtraKind[] = EXTRA_KINDS): PackedExtra[] {
  const out: PackedExtra[] = []; const has = new Set<ExtraKind>();
  const add = (kind: ExtraKind, why: MsgKey, vars?: Record<string, string | number>) => { if (has.has(kind) || !candidates.includes(kind)) return; has.add(kind); out.push({ kind, reason: t(why, vars, locale) }); };
  const n = (ids: string[]) => ids.reduce((s, id) => s + (brief.kinds[id] ?? 0), 0);
  const lat = brief.maxAbsLat ?? 0; const { season, theme } = brief;
  // 这个人自己说的一句话（D84）排在最前：「下雨天去京都逛三天」→ 折叠伞、速写本、相机
  if (brief.note) for (const k of gearHints(brief.note)) add(k, "case.why.asked");
  const aurora = theme === "极光冰原" || (lat > 63 && (season === "winter" || season === "autumn"));
  const cold = aurora || season === "winter" || (season === "autumn" && lat > 50) || theme === "温泉雪国";
  if (aurora) add("thermos", "case.why.aurora"); else if (cold) add("thermos", "case.why.cold");
  if (n(["beach", "hotspring"]) > 0 && season !== "winter") add("swimRing", "case.why.water");
  if (n(["trail", "mountain", "glacier", "volcano", "waterfall", "fjord"]) >= 2) add("boots", "case.why.hike");
  if (brief.famous >= 3) add("camera", "case.why.famous", { n: brief.famous });
  if (season === "summer" || theme === "离岛夏日" || theme === "海风港町" || n(["beach"]) > 0) add("sunglasses", "case.why.sunny");
  if ((brief.transports.car ?? 0) >= 3) add("roadmap", "case.why.drive");
  if (n(["viewpoint", "zoo", "fjord", "lake", "cablecar"]) >= 2) add("binoculars", "case.why.views");
  if (cold && lat > 45) add("scarf", "case.why.cold");
  if (theme === "樱花春日" || (season === "spring" && /日本|japan|京都|kyoto|东京|tokyo/i.test(brief.destination + brief.title))) add("umbrella", "case.why.rain");
  if (profile.tripsCount >= 3) add("plush", "case.why.veteran", { n: profile.tripsCount });
  // D80 新加的几样，排在后面：前面没挑满三样时才轮得到
  if (season === "summer" || theme === "离岛夏日" || n(["beach"]) > 0) { add("hat", "case.why.sunny"); add("sunscreen", "case.why.sunny"); }
  if (cold && lat > 55) add("mittens", "case.why.cold");
  if (n(["trail", "mountain", "glacier", "volcano", "waterfall", "fjord"]) >= 2) add("waterBottle", "case.why.hike");
  if (aurora || n(["cave"]) > 0) add("flashlight", "case.why.dark");
  if ((brief.transports.flight ?? 0) >= 2) add("neckPillow", "case.why.flight"); else if ((brief.transports.flight ?? 0) >= 1) add("headphones", "case.why.flight");
  if (n(["museum", "temple", "church", "castle", "oldtown", "ruins"]) >= 3) add("sketchbook", "case.why.culture");
  if ((brief.transports.rail ?? 0) >= 3) add("book", "case.why.rail");
  if (brief.days >= 5) add("powerbank", "case.why.long", { n: brief.days });
  return out.slice(0, PACK_LIMITS.extras);
}
