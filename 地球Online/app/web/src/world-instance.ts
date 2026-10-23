/** 世界层常驻一个实例：切页面时只是挪走 / 藏起来，不销毁（技术选型 8.3） */
import { World } from "../../shared/world/world.ts";
import { CITY_JSON, plateOf } from "./cities.ts";
import { store } from "./store.ts";
import { buildRoute, type Route } from "../../shared/algo/route.ts";
import { geoFrameOfDay, buildGeoRoute, type GeoFrame } from "../../shared/algo/geo.ts";
import type { Trip } from "../../shared/spec/types.ts";
import { mountBackdrop, type Backdrop } from "./backdrop.ts";
import { skyPhase, onPhase } from "./theme.ts";

let world: World | null = null; let bd: Backdrop | null = null;
export function worldBackdrop(): Backdrop { worldInstance(); return bd!; }
export function worldHost(): HTMLElement { return document.getElementById("world-host")!; }
export function worldInstance(): World {
  if (!world) {
    // 天色跟着手机（D85）：夜里浮岛换夜色、亮灯；天空的底也换
    bd = mountBackdrop(worldHost(), store.settings.palette, skyPhase()); world = new World(worldHost(), { assetBase: import.meta.env.BASE_URL, palette: store.settings.palette, cities: CITY_JSON, transparent: true });
    world.setPhase(skyPhase()); onPhase((p) => { world?.setPhase(p); bd?.setPhase(p); });
  }
  return world;
}
/** 某一天的路线：起点接上前一天的住处（同城时） */
export function routeOfDay(trip: Trip, dayIndex: number): Route { return dayScene(trip, dayIndex).route; }
/** 某一天的场景：城市底板（格）或地理底板（真实坐标） */
export function dayScene(trip: Trip, dayIndex: number): { route: Route; geo?: { frame: GeoFrame; day: Trip["days"][number] } } {
  const day = trip.days[dayIndex];
  if (day.city === "geo") { const frame = geoFrameOfDay(day); if (frame) return { route: buildGeoRoute(day, frame), geo: { frame, day } }; }
  return { route: cityRoute(trip, dayIndex) };
}
function cityRoute(trip: Trip, dayIndex: number): Route {
  const day = trip.days[dayIndex]; const plate = plateOf(day.city === "geo" ? "osaka" : day.city);
  let start: [number, number] | undefined;
  const prev = trip.days[dayIndex - 1];
  if (prev && prev.city === day.city) { const pr = buildRoute(plateOf(prev.city), prev); if (pr.lodging && !pr.lodging.offPlate) start = pr.lodging.cell; }
  return buildRoute(plate, day, start);
}
