import type { Trip } from "../spec/types.ts";
import { buildTimeline } from "./timeline.ts";
export interface TripStats { days: number; places: number; visited: number; walkMinutes: number; transitMinutes: number; cities: string[]; lodgings: string[] }
export function tripStats(trip: Trip): TripStats {
  let places = 0, visited = 0, walk = 0, transit = 0; const cities = new Set<string>(); const lodgings = new Set<string>();
  for (const d of trip.days) {
    cities.add(d.city); if (d.lodging) lodgings.add(d.lodging);
    for (const e of d.entries) if (e.type === "place") { places++; if (e.visited) visited++; }
    const tl = buildTimeline(d); walk += tl.walkMinutes; transit += tl.transitMinutes;
  }
  return { days: trip.days.length, places, visited, walkMinutes: walk, transitMinutes: transit, cities: [...cities], lodgings: [...lodgings] };
}
