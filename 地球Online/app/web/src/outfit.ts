/** 小人穿什么：秋冬或高纬度 → 羽绒服；春夏 → 连衣裙（捏人里可以覆盖，P1） */
import type { Trip } from "../../shared/spec/types.ts";
import type { Outfit } from "../../shared/world/hero.ts";
import { deriveWorldSpec } from "../../shared/algo/world-spec.ts";
export function outfitFor(trip?: Trip): Outfit {
  if (!trip) return "puffer";
  const cold = trip.days.some((d) => d.entries.some((e) => e.type === "place" && e.geo && Math.abs(e.geo.lat) > 55));
  const season = deriveWorldSpec(trip).season;
  return cold || season === "autumn" || season === "winter" ? "puffer" : "dress";
}
