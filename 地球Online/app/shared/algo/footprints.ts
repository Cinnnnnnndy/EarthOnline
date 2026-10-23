/** 足迹：去过的地方在地球上插一面小旗。
 *  算「去过」的规则（与平台无关，两端照抄）：
 *   1. 打过卡的站点（visited）一定算；
 *   2. 书已合上（closed）→ 这本书的所有站点都算；
 *   3. 日期早于今天的那几天 → 当天的站点都算（今天和以后的只算打过卡的）；
 *   4. 住处和机场不插旗（路过，不是「去过」）；
 *   5. 同名或相距 2 km 以内的算同一个地方（两个方案里重复的站只插一面）；
 *   6. 用户手动补的旗（以前去过、不在任何一本书里）照样插。 */
import type { Trip, PlaceEntry } from "../spec/types.ts";
import { haversineKm, type LatLng } from "./geo.ts";

export interface ManualFlag { id: string; name: string; lat: number; lng: number; date?: string }
export interface HomePlace { name: string; lat: number; lng: number }
export interface Footprint { id: string; name: string; lat: number; lng: number; date: string; source: "trip" | "manual"; trips: string[] }

const SKIP = new Set<PlaceEntry["category"]>(["hotel", "airport"]);

export function footprints(trips: Trip[], manual: ManualFlag[], today: string, locate?: (name: string) => { lat: number; lng: number } | null): Footprint[] {
  const out: Footprint[] = [];
  const merge = (f: Footprint) => {
    const hit = out.find((x) => x.name === f.name || haversineKm([x.lat, x.lng], [f.lat, f.lng]) < 2);
    if (!hit) { out.push(f); return; }
    if (f.date < hit.date) hit.date = f.date;
    for (const t of f.trips) if (!hit.trips.includes(t)) hit.trips.push(t);
    if (f.source === "manual" && hit.source === "trip") { /* 书里已经有了：保留书里的名字 */ }
  };
  for (const t of trips) {
    for (const d of t.days) {
      const past = t.status === "closed" || d.date < today;
      for (const e of d.entries) {
        if (e.type !== "place" || SKIP.has(e.category)) continue;
        if (!(e.visited || past)) continue;
        const g = e.geo ?? locate?.(e.name) ?? null; if (!g) continue;
        merge({ id: `trip:${e.name}`, name: e.name, lat: g.lat, lng: g.lng, date: e.visitedAt?.slice(0, 10) ?? d.date, source: "trip", trips: [t.id] });
      }
    }
  }
  for (const m of manual) merge({ id: m.id, name: m.name, lat: m.lat, lng: m.lng, date: m.date ?? "", source: "manual", trips: [] });
  return out.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.name.localeCompare(b.name));
}

export interface FootprintStats { places: number; countries: string[]; farthestKm: number; farthest?: string }
export function footprintStats(fps: Footprint[], home?: HomePlace | null, countryOf?: (lat: number, lng: number) => string | null): FootprintStats {
  const countries = countryOf ? [...new Set(fps.map((f) => countryOf(f.lat, f.lng)).filter((c): c is string => !!c))] : [];
  let farthestKm = 0, farthest: string | undefined;
  if (home) for (const f of fps) { const k = haversineKm([home.lat, home.lng] as LatLng, [f.lat, f.lng]); if (k > farthestKm) { farthestKm = k; farthest = f.name; } }
  return { places: fps.length, countries, farthestKm: Math.round(farthestKm), farthest };
}

/** 按角距离（度）贪心聚合：缩放越远，阈值越大，一簇只插一面旗、角标写数量 */
export interface FlagCluster { id: string; lat: number; lng: number; name: string; count: number; members: string[] }
export function clusterFlags(fps: { id: string; name: string; lat: number; lng: number }[], thresholdDeg: number): FlagCluster[] {
  const out: FlagCluster[] = []; const km = thresholdDeg * 111.2;
  for (const f of fps) {
    const c = out.find((x) => haversineKm([x.lat, x.lng], [f.lat, f.lng]) < km);
    if (c) { c.count++; c.members.push(f.id); } else out.push({ id: f.id, lat: f.lat, lng: f.lng, name: f.name, count: 1, members: [f.id] });
  }
  return out;
}
