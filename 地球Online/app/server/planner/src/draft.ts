/** 模型的草稿 → spec 0.3 的 Trip（id、日期、seed、状态、时间戳由这里补），最后过 shared/spec/validate.ts。 */
import { SCHEMA_VERSION, THEMES, type Day, type Entry, type PlaceEntry, type TransportEntry, type Trip } from "../../../shared/spec/types.ts";
import { validateTrip } from "../../../shared/spec/validate.ts";
import { hashString } from "../../../shared/algo/prng.ts";
import { CATEGORIES, KIND_IDS, MODES, type ModelDraft, type ModelStop } from "./schema.ts";

export const MAX_DAYS = 30;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const clean = (s: string | null | undefined, max: number) => { const v = (s ?? "").replace(/\s+/g, " ").trim(); return v ? v.slice(0, max) : undefined; };
const validGeo = (lat: unknown, lng: unknown) => typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
/** 9:5 / 9:05 / 09:05 → 09:05；不像时间的丢掉 */
function hhmm(s: string | null | undefined): string | undefined {
  const m = (s ?? "").trim().match(/^(\d{1,2}):(\d{2})$/); if (!m) return undefined;
  const h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? `${String(h).padStart(2, "0")}:${m[2]}` : undefined;
}
const nonNegInt = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined);

export interface DraftResult { trip?: Trip; errors: string[] }

export function toTrip(d: ModelDraft, opts: { now: string }): DraftResult {
  const errors: string[] = [];
  if (!DATE.test(d.startDate ?? "") || Number.isNaN(Date.parse(d.startDate + "T00:00:00Z"))) return { errors: [`startDate: ${String(d.startDate)}`] };
  const modelDays = (d.days ?? []).slice(0, MAX_DAYS);
  if (!modelDays.length) return { errors: ["days: empty"] };
  const destination = clean(d.destination, 40) ?? "";
  const title = clean(d.title, 40) ?? `${destination}${modelDays.length}日`;
  const theme = (THEMES as readonly string[]).includes(d.theme) ? d.theme : THEMES[4];

  // 没有任何坐标的一天没法生成底板：借前后最近一天的最后一个坐标，写成当晚住处
  const anyGeo = modelDays.flatMap((x) => x.stops ?? []).find((s) => validGeo(s.lat, s.lng));
  if (!anyGeo) return { errors: ["draft has no valid coordinates"] };

  let lastGeo: { lat: number; lng: number } = { lat: anyGeo.lat, lng: anyGeo.lng };
  const days: Day[] = modelDays.map((md, i) => {
    const entries: Entry[] = []; let k = 0; const id = () => `d${i + 1}-e${k++}`;
    const stops = (md.stops ?? []).filter((s): s is ModelStop => !!s && typeof s.name === "string" && !!s.name.trim());
    stops.forEach((s, j) => {
      const geo = validGeo(s.lat, s.lng) ? { lat: Math.round(s.lat * 1e5) / 1e5, lng: Math.round(s.lng * 1e5) / 1e5 } : undefined;
      if (geo) lastGeo = geo;
      const e: PlaceEntry = { id: id(), type: "place", name: s.name.trim().slice(0, 60), category: (CATEGORIES as readonly string[]).includes(s.category) ? s.category : "sight" };
      const plannedStart = hhmm(s.plannedStart); if (plannedStart) e.plannedStart = plannedStart;
      const stay = nonNegInt(s.stayMinutes); if (stay !== undefined) e.stayMinutes = stay;
      const notes = clean(s.notes, 200); if (notes) e.notes = notes;
      if (geo) e.geo = geo;
      if (s.kind && KIND_IDS.includes(s.kind)) e.kind = s.kind;
      entries.push(e);
      const leg = s.next;
      if (leg && j < stops.length - 1 && (MODES as readonly string[]).includes(leg.mode)) {
        const t: TransportEntry = { id: id(), type: "transport", mode: leg.mode, label: clean(leg.label, 40) ?? "" };
        const dur = nonNegInt(leg.durationMinutes); if (dur !== undefined) t.durationMinutes = dur;
        if (typeof leg.distanceKm === "number" && Number.isFinite(leg.distanceKm) && leg.distanceKm >= 0) t.distanceKm = Math.round(leg.distanceKm * 10) / 10;
        entries.push(t);
      }
    });
    const lodging = clean(md.lodging, 40);
    if (!entries.some((e) => e.type === "place" && e.geo)) {
      entries.push({ id: id(), type: "place", name: lodging ?? destination ?? title, category: "hotel", geo: { ...lastGeo } });
      errors.push(`days[${i}]: no coordinates, used ${lastGeo.lat},${lastGeo.lng}`);
    }
    const day: Day = { index: i + 1, date: addDays(d.startDate, i), title: clean(md.title, 40) ?? `${i + 1}`, city: "geo", entries };
    if (lodging) day.lodging = lodging;
    return day;
  });

  const seed = hashString(`${title}|${d.startDate}|${opts.now}`);
  const trip: Trip = {
    schemaVersion: SCHEMA_VERSION, id: `trip-${seed.toString(36)}-${hashString(opts.now + title).toString(36)}`, title, destination: destination || title,
    startDate: d.startDate, endDate: addDays(d.startDate, days.length - 1), theme, seed, status: "planning", days, createdAt: opts.now, updatedAt: opts.now,
  };
  const invalid = validateTrip(trip);
  if (invalid.length) return { errors: [...errors, ...invalid] };
  return { trip, errors };
}
