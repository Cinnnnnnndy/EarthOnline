/** 地理底板的数学：一天的范围 → 局部平面坐标（x 向东、y 向南，单位与城市底板的「格」相当），以及沿真实折线的路线 */
import type { Day, Entry, PlaceEntry, TransportEntry, TransportMode } from "../spec/types.ts";
import type { Route, RouteSegment, RouteStop } from "./route.ts";
import { MODE_SPEED, modeName } from "./transport.ts";
import { t } from "../i18n/index.ts";

export interface GeoFrame { lat0: number; lng0: number; kmPerUnit: number; cols: number; rows: number; widthKm: number; heightKm: number; bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } }
export type LatLng = [number, number];

const KM_LAT = 110.574; const kmLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);
export const PLATE_COLS = 64, PLATE_ROWS = 44;

export function haversineKm(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function greatCircle(a: LatLng, b: LatLng, n = 48): LatLng[] {
  const r = Math.PI / 180; const v = (p: LatLng) => [Math.cos(p[0] * r) * Math.cos(p[1] * r), Math.cos(p[0] * r) * Math.sin(p[1] * r), Math.sin(p[0] * r)];
  const A = v(a), B = v(b); const d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  if (d < 1e-6) return [a, b];
  const out: LatLng[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
    out.push([Math.atan2(z, Math.hypot(x, y)) / r, Math.atan2(y, x) / r]);
  }
  return out;
}

export function project(f: GeoFrame, lat: number, lng: number): [number, number] {
  const dLng = ((((lng - f.lng0 + 180) % 360) + 360) % 360) - 180;   // 取经度差的短边：跨太平洋的航班从画的西边飞出去，而不是绕地球一圈从东边
  return [f.cols / 2 + (dLng * kmLng(f.lat0)) / f.kmPerUnit, f.rows / 2 - ((lat - f.lat0) * KM_LAT) / f.kmPerUnit];
}
export function unproject(f: GeoFrame, x: number, y: number): LatLng {
  return [f.lat0 - ((y - f.rows / 2) * f.kmPerUnit) / KM_LAT, f.lng0 + ((x - f.cols / 2) * f.kmPerUnit) / kmLng(f.lat0)];
}
export const inside = (f: GeoFrame, p: [number, number], m = 0) => p[0] >= m && p[0] <= f.cols - m && p[1] >= m && p[1] <= f.rows - m;

/** 线段 a→b 与底板矩形（内缩 m）的交点：从 a 出发，第一次离开矩形的点 */
function exitPoint(f: GeoFrame, a: [number, number], b: [number, number], m = 0.8): [number, number] {
  let t = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx > 0) t = Math.min(t, (f.cols - m - a[0]) / dx); if (dx < 0) t = Math.min(t, (m - a[0]) / dx);
  if (dy > 0) t = Math.min(t, (f.rows - m - a[1]) / dy); if (dy < 0) t = Math.min(t, (m - a[1]) / dy);
  t = Math.max(0, t); return [a[0] + dx * t, a[1] + dy * t];
}

/** 一天的「地面」范围：航班那一头不算（否则哥本哈根到卑尔根的一天会是 850 公里宽） */
function groundPlaces(day: Day): { place: PlaceEntry; before?: TransportEntry[]; after?: TransportEntry[] }[] {
  const out: { place: PlaceEntry; before: TransportEntry[]; after: TransportEntry[] }[] = [];
  let pending: TransportEntry[] = [];
  for (const e of day.entries) {
    if (e.type === "transport") { pending.push(e); continue; }
    if (e.type !== "place" || !e.geo) continue;
    if (out.length) out[out.length - 1].after = pending;
    out.push({ place: e, before: pending, after: [] }); pending = [];
  }
  return out;
}
const isFlight = (legs?: TransportEntry[]) => !!legs && legs.length > 0 && legs.every((l) => l.mode === "flight");

export function geoFrameOfDay(day: Day, aspect = PLATE_COLS / PLATE_ROWS): GeoFrame | null {
  const places = groundPlaces(day); if (!places.length) return null;
  const pts: LatLng[] = [];
  places.forEach((p, i) => {
    const onlyFlights = (i === 0 || isFlight(p.before)) && (i === places.length - 1 || isFlight(p.after));
    if (!onlyFlights || places.length === 1) pts.push([p.place.geo!.lat, p.place.geo!.lng]);
    for (const t of p.after ?? []) if (t.mode !== "flight" && t.polyline) for (const c of t.polyline) pts.push(c);
  });
  if (!pts.length) pts.push([places[0].place.geo!.lat, places[0].place.geo!.lng]);
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [a, b] of pts) { minLat = Math.min(minLat, a); maxLat = Math.max(maxLat, a); minLng = Math.min(minLng, b); maxLng = Math.max(maxLng, b); }
  const lat0 = (minLat + maxLat) / 2, lng0 = (minLng + maxLng) / 2;
  let w = (maxLng - minLng) * kmLng(lat0), h = (maxLat - minLat) * KM_LAT;
  const pad = Math.max(Math.max(w, h) * 0.14, 1.6); w += pad * 2; h += pad * 2;
  w = Math.max(w, 5); h = Math.max(h, 5 / aspect);
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const kmPerUnit = w / PLATE_COLS;
  const f: GeoFrame = { lat0, lng0, kmPerUnit, cols: PLATE_COLS, rows: PLATE_ROWS, widthKm: w, heightKm: h, bbox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 } };
  const [la1, ln1] = unproject(f, 0, 0), [la2, ln2] = unproject(f, f.cols, f.rows);
  f.bbox = { minLat: la2, maxLat: la1, minLng: ln1, maxLng: ln2 };
  return f;
}

/** 等距重采样（步长 step 个单位），保持首尾 */
export function resample(pts: [number, number][], step = 0.35): [number, number][] {
  if (pts.length < 2) return pts.slice();
  const out: [number, number][] = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) continue;
    let d = step - carry;
    while (d <= L) { out.push([a[0] + ((b[0] - a[0]) * d) / L, a[1] + ((b[1] - a[1]) * d) / L]); d += step; }
    carry = L - (d - step);
  }
  const last = pts[pts.length - 1]; const pl = out[out.length - 1];
  if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > 1e-6) out.push(last);
  return out;
}

export function buildGeoRoute(day: Day, f: GeoFrame, step = 0.35): Route {
  const path: [number, number][] = []; const stops: RouteStop[] = []; const segments: RouteSegment[] = []; const unresolved: string[] = [];
  let pending: TransportEntry[] = []; let cur: [number, number] | null = null;
  const push = (pts: [number, number][]) => { for (const p of pts) { const l = path[path.length - 1]; if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-6) path.push(p); } };
  for (const e of day.entries as Entry[]) {
    if (e.type === "transport") { pending.push(e); continue; }
    if (e.type !== "place") continue;
    if (!e.geo) { unresolved.push(e.name); continue; }
    let p = project(f, e.geo.lat, e.geo.lng); const off = !inside(f, p, 0.8);
    const flight = pending.length > 0 && pending.every((t) => t.mode === "flight");
    let arc: RouteSegment["arc"];
    if (off) { const from = cur ?? [f.cols / 2, f.rows / 2]; p = exitPoint(f, from, p); if (flight) arc = "out"; }
    if (!cur) { push([p]); segments.push({ start: 0, end: 0, mode: pending[0]?.mode ?? "walk", label: pending.map((t) => t.label).join(" + ") || t("route.depart"), durationMinutes: 0, entryIds: pending.map((t) => t.id), speedScale: 1 }); }
    else {
      let raw: [number, number][] = [];
      if (flight && inside(f, cur, 0.9) === false && !off) {           // 从画外飞进来：起点换成画边
        arc = "in";
      }
      if (!flight) for (const t of pending) if (t.polyline) raw.push(...t.polyline.map(([a, b]) => project(f, a, b)));
      raw = [cur, ...raw.filter((q) => inside(f, q, -2)).map((q) => [Math.min(f.cols, Math.max(0, q[0])), Math.min(f.rows, Math.max(0, q[1]))] as [number, number]), p];
      const seg = resample(raw, step); const start = path.length - 1; push(seg.slice(1));
      const main = pending.find((t) => t.mode !== "walk") ?? pending[0];
      const mode: TransportMode = main?.mode ?? "walk";
      const steps = Math.max(1, path.length - 1 - start); const base = MODE_SPEED[mode];
      const target = flight ? 5 : Math.min(11, Math.max(3.5, 2.5 + steps * 0.035));
      segments.push({ start, end: path.length - 1, mode, label: pending.map((t) => t.label).join(" + ") || modeName("walk"), durationMinutes: pending.reduce((s, t) => s + (t.durationMinutes ?? 0), 0),
        distanceKm: pending.reduce((s, t) => s + (t.distanceKm ?? 0), 0) || undefined, entryIds: pending.map((t) => t.id), speedScale: Math.max(0.3, steps / (base * target)), arc });
    }
    const cell: [number, number] = [Math.floor(p[0]), Math.floor(p[1])];
    stops.push({ entryId: e.id, name: e.name, short: e.name, landmark: e.name, cell, center: p, arrive: path.length - 1, time: e.plannedStart, visited: !!e.visited, offPlate: off, category: e.category, desc: e.notes });
    cur = p; pending = [];
  }
  // 起点在画外（清晨从哥本哈根飞来）：把第一段真实路段标成降落（segments[i] = 到达 stops[i] 的那段，segments[0] 是出发占位）
  if (stops[0]?.offPlate && segments[1]) segments[1].arc = segments[1].arc === "out" ? "both" : "in";
  return { kind: "geo", city: "geo", path, stops, segments, unresolved };
}
