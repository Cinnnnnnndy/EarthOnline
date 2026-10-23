/** 界面上的景点类型：图标 + 简短说明（名胜 / 类型名），与世界层挑模型用同一套分级（shared/world/landmark-kinds.ts）。
 *  D94 起放在 shared：网页、原生壳（经 core-call 的 kindInfo）同一份。
 *  第八轮：icon 是六组之一的图标（交通一种、住宿一种、其余按人文 / 自然 / 休闲 / 吃喝购物），类型名仍是具体的（「教堂」「瀑布」） */
import type { PlaceEntry } from "../spec/types.ts";
import { classifyPlace, KIND, kindName, groupName, GROUP_ICON, type KindGroup } from "./landmark-kinds.ts";
import { tierOf, type Tier } from "./landmark-famous.ts";

export function placeKind(e: Pick<PlaceEntry, "name" | "category" | "kind" | "geo">): { kind: string; group: KindGroup; icon: string; label: string; groupLabel: string; tier: Tier; famous: boolean } {
  const t = tierOf({ name: e.name, category: e.category, kind: e.kind, lat: e.geo?.lat, lng: e.geo?.lng }, classifyPlace);
  const k = KIND[t.kind] ?? KIND.sight;
  return { kind: t.kind, group: k.group, icon: GROUP_ICON[k.group], label: kindName(k.id), groupLabel: groupName(k.group), tier: t.tier, famous: !!t.famous };
}
