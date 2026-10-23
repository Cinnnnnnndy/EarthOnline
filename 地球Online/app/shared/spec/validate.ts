/** 与 trip.schema.json 等价的手写校验（P0 不引入 Schema 库；两端各自实现，靠黄金用例保持一致） */
import type { Trip, Entry, Day } from "./types.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;
const CITIES = new Set(["osaka", "kyoto", "nara", "kobe", "geo"]);
const CATS = new Set(["sight", "food", "shop", "station", "airport", "port", "hotel", "other"]);
const MODES = new Set(["walk", "rail", "subway", "bus", "ship", "taxi", "car", "flight"]);
const STATUS = new Set(["planning", "traveling", "closed"]);

export function validateTrip(t: unknown): string[] {
  const errs: string[] = [];
  const o = t as Partial<Trip> | null;
  if (!o || typeof o !== "object") return ["trip: 不是对象"];
  if (o.schemaVersion !== "0.3") errs.push(`schemaVersion: 期望 0.3，实际 ${String(o.schemaVersion)}`);
  for (const k of ["id", "title", "destination", "theme", "createdAt", "updatedAt"] as const)
    if (typeof o[k] !== "string" || !(o[k] as string).length) errs.push(`${k}: 需要非空字符串`);
  if (typeof o.title === "string" && o.title.length > 40) errs.push("title: 超过 40 字");
  for (const k of ["startDate", "endDate"] as const) if (typeof o[k] !== "string" || !DATE.test(o[k] as string)) errs.push(`${k}: 需要 YYYY-MM-DD`);
  if (!Number.isInteger(o.seed) || (o.seed as number) < 0) errs.push("seed: 需要非负整数");
  if (!STATUS.has(o.status as string)) errs.push("status: 非法");
  if (o.plan !== undefined && (typeof o.plan.group !== "string" || !Number.isInteger(o.plan.index) || typeof o.plan.label !== "string")) errs.push("plan: 需要 {group, index, label}");
  if (!Array.isArray(o.days) || o.days.length < 1 || o.days.length > 30) errs.push("days: 需要 1–30 天");
  else o.days.forEach((d, i) => validateDay(d, i, errs));
  return errs;
}

function validateDay(d: Day, i: number, errs: string[]) {
  const p = `days[${i}]`;
  if (!d || typeof d !== "object") { errs.push(`${p}: 不是对象`); return; }
  if (!Number.isInteger(d.index) || d.index < 1) errs.push(`${p}.index: 需要 ≥1 的整数`);
  if (typeof d.date !== "string" || !DATE.test(d.date)) errs.push(`${p}.date: 需要 YYYY-MM-DD`);
  if (typeof d.title !== "string") errs.push(`${p}.title: 需要字符串`);
  if (!CITIES.has(d.city)) errs.push(`${p}.city: 不支持的城市 ${String(d.city)}`);
  if (d.lodging !== undefined && typeof d.lodging !== "string") errs.push(`${p}.lodging: 需要字符串`);
  if (d.diary !== undefined && typeof d.diary !== "string") errs.push(`${p}.diary: 需要字符串`);
  if (d.color !== undefined && typeof d.color !== "string") errs.push(`${p}.color: 需要字符串`);
  if (!Array.isArray(d.entries)) { errs.push(`${p}.entries: 需要数组`); return; }
  const ids = new Set<string>();
  d.entries.forEach((e, j) => {
    const q = `${p}.entries[${j}]`;
    validateEntry(e, q, errs);
    if (e && typeof e.id === "string") { if (ids.has(e.id)) errs.push(`${q}.id: 重复 ${e.id}`); ids.add(e.id); }
  });
}

function validateEntry(e: Entry, q: string, errs: string[]) {
  if (!e || typeof e !== "object") { errs.push(`${q}: 不是对象`); return; }
  if (typeof e.id !== "string" || !e.id) errs.push(`${q}.id: 需要非空字符串`);
  switch (e.type) {
    case "place":
      if (typeof e.name !== "string" || !e.name) errs.push(`${q}.name: 需要非空字符串`);
      if (!CATS.has(e.category)) errs.push(`${q}.category: 非法 ${String(e.category)}`);
      if (e.plannedStart !== undefined && !TIME.test(e.plannedStart)) errs.push(`${q}.plannedStart: 需要 HH:MM`);
      if (e.stayMinutes !== undefined && (!Number.isInteger(e.stayMinutes) || e.stayMinutes < 0)) errs.push(`${q}.stayMinutes: 需要非负整数`);
      if (e.geo !== undefined && (typeof e.geo.lat !== "number" || typeof e.geo.lng !== "number")) errs.push(`${q}.geo: 需要 {lat, lng}`);
      if (e.todos !== undefined) {
        if (!Array.isArray(e.todos)) errs.push(`${q}.todos: 需要数组`);
        else e.todos.forEach((td, k) => { if (!td || typeof td !== "object" || typeof td.id !== "string" || !td.id || typeof td.text !== "string" || !td.text) errs.push(`${q}.todos[${k}]: 需要 {id, text}`); else if (td.due !== undefined && !DATE.test(td.due)) errs.push(`${q}.todos[${k}].due: 需要 YYYY-MM-DD`); });
      }
      break;
    case "transport":
      if (!MODES.has(e.mode)) errs.push(`${q}.mode: 非法 ${String(e.mode)}`);
      if (typeof e.label !== "string") errs.push(`${q}.label: 需要字符串`);
      if (e.durationMinutes !== undefined && (!Number.isInteger(e.durationMinutes) || e.durationMinutes < 0)) errs.push(`${q}.durationMinutes: 需要非负整数`);
      if (e.distanceKm !== undefined && (typeof e.distanceKm !== "number" || e.distanceKm < 0)) errs.push(`${q}.distanceKm: 需要非负数`);
      if (e.polyline !== undefined && (!Array.isArray(e.polyline) || e.polyline.some((c) => !Array.isArray(c) || c.length !== 2 || typeof c[0] !== "number" || typeof c[1] !== "number"))) errs.push(`${q}.polyline: 需要 [lat, lng][]`);
      break;
    case "lodging":
      if (typeof e.name !== "string" || !e.name) errs.push(`${q}.name: 需要非空字符串`);
      break;
    default:
      errs.push(`${q}.type: 非法 ${String((e as { type?: unknown }).type)}`);
  }
}
