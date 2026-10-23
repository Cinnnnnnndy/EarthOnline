/** 旧版本 Trip → 当前版本。只增不改；每一级迁移是纯函数 */
import { SCHEMA_VERSION, type Trip, type Day, type Entry } from "./types.ts";
import { classifyTransport } from "../algo/transport.ts";
import { parseDuration } from "../algo/duration.ts";
import { hashString } from "../algo/prng.ts";

interface LegacyEntry01 { type: string; order?: number; name?: string; category?: string; plannedStart?: string; mode?: string; durationText?: string }
interface LegacyDay01 { index: number; date: string; title: string; city: string; entries: LegacyEntry01[]; lodging?: string }
export interface LegacyTrip01 { schemaVersion: "0.1"; title: string; destination: string | { country?: string; region?: string }; startDate: string; endDate: string; theme: string; seed?: number | string; status?: string; days: LegacyDay01[] }

export function migrateTrip(raw: unknown, now = new Date().toISOString()): Trip {
  const v = (raw as { schemaVersion?: string })?.schemaVersion;
  if (v === "0.1") return from02(from01(raw as LegacyTrip01, now));
  if (v === "0.2") return from02(raw as Trip);
  if (v === SCHEMA_VERSION) return raw as Trip;
  throw new Error(`不认识的 schemaVersion: ${String(v)}`);
}

/** 0.2 → 0.3：只有新增的可选字段（geo、distanceKm、polyline、car、port/hotel、city="geo"），改版本号即可 */
function from02(t: Trip): Trip { return { ...t, schemaVersion: SCHEMA_VERSION }; }

function from01(t: LegacyTrip01, now: string): Trip {
  const days: Day[] = t.days.map((d, di) => ({
    index: d.index ?? di + 1,
    date: d.date,
    title: d.title,
    city: d.city,
    lodging: d.lodging ?? undefined,
    entries: d.entries.map((e, ei): Entry => {
      const id = `d${di + 1}-e${ei}`;
      if (e.type === "transport") {
        const label = e.mode ?? "步行";
        return { id, type: "transport", mode: classifyTransport(label), label, durationMinutes: parseDuration(e.durationText ?? "") ?? undefined };
      }
      if (e.type === "lodging") return { id, type: "lodging", name: e.name ?? "住宿" };
      const cat = (["sight", "food", "shop", "station", "airport", "other"] as const).find((c) => c === e.category) ?? "sight";
      return { id, type: "place", name: e.name ?? "", category: cat, plannedStart: e.plannedStart };
    }),
  }));
  const destination = typeof t.destination === "string" ? t.destination : [t.destination?.country, t.destination?.region].filter(Boolean).join(" · ") || "未知目的地";
  const seed = typeof t.seed === "number" ? t.seed : hashString(typeof t.seed === "string" ? t.seed : `${t.title}|${t.startDate}|${destination}`);
  return {
    schemaVersion: "0.3",
    id: `trip-${hashString(t.title + t.startDate).toString(36)}`,
    title: t.title, destination, startDate: t.startDate, endDate: t.endDate, theme: t.theme,
    seed, status: (t.status as Trip["status"]) ?? "planning", days, createdAt: now, updatedAt: now,
  };
}
