/** 把书（Trip）变成地球上的数据：每天的站点、路段（真实折线 / 直线 / 航班弧）、中心与范围、小人所在 */
import type { Trip, PlaceEntry, TransportEntry } from "../../shared/spec/types.ts";
import type { GlobeBook, GlobeDay, GlobeLeg, GlobeStop } from "../../shared/world/globe.ts";
import { locate } from "../../shared/geo/gazetteer.ts";
import { haversineKm, geoFrameOfDay, type LatLng } from "../../shared/algo/geo.ts";
import { t, duration, km as fmtKm, list, plain, days as nDays } from "../../shared/i18n/index.ts";
import { tripStats } from "../../shared/algo/stats.ts";

/** 界面只用一个强调色（靛蓝）+ 一个高亮色（金：今天 / 去过）；路线不再按天换颜色，靠「D2」这样的标签区分 */
export const GOLD = "#f0b43c", INK = "#1d2842";
/** 地球上路线与站点针的颜色（第八轮去色）：白天墨、夜里白；换天色后 home.ts 会重新 setBooks */
export const ACCENT_DAY = "#1E2640", ACCENT_NIGHT = "#EEF0FA";
export const accent = (): string => (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? ACCENT_NIGHT : ACCENT_DAY);
/** 手机当地的今天（YYYY-MM-DD）。以前用 toISOString 取的是 UTC 日期，东八区早上 8 点前会差一天；
 *  首页的阶段判断、地球上的书签、足迹、名额都用这一个。截图与调试：?today=2026-10-20 */
export const today = (): string => {
  const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("today") : null;
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const todayIndex = (t: Trip) => t.days.findIndex((d) => d.date === today());

export function geoOf(e: PlaceEntry): LatLng | null { if (e.geo) return [e.geo.lat, e.geo.lng]; const p = locate(e.name); return p ? [p.lat, p.lng] : null; }
const kindOf = (e: PlaceEntry): GlobeStop["kind"] => (e.category === "hotel" ? "hotel" : e.category === "airport" ? "airport" : e.category === "port" ? "port" : "sight");
const mean = (pts: LatLng[]): LatLng => { if (!pts.length) return [30, 60]; let x = 0, y = 0, z = 0; for (const [a, b] of pts) { const r = Math.PI / 180; x += Math.cos(a * r) * Math.cos(b * r); y += Math.cos(a * r) * Math.sin(b * r); z += Math.sin(a * r); } const r = 180 / Math.PI; return [Math.atan2(z, Math.hypot(x, y)) * r, Math.atan2(y, x) * r]; };

export function legLabel(t: TransportEntry[]): string {
  const km = t.reduce((s, x) => s + (x.distanceKm ?? 0), 0), min = t.reduce((s, x) => s + (x.durationMinutes ?? 0), 0);
  return list([km ? fmtKm(km) : "", min ? duration(min) : ""]);
}

export function tripToGlobe(trip: Trip): GlobeBook {
  const all: LatLng[] = [];
  const days: GlobeDay[] = trip.days.map((d) => {
    const stops: GlobeStop[] = []; const legs: GlobeLeg[] = []; let pending: TransportEntry[] = []; let prev: LatLng | null = null; let n = 0;
    for (const e of d.entries) {
      if (e.type === "transport") { pending.push(e); continue; }
      if (e.type !== "place") continue;
      const g = geoOf(e); if (!g) continue;
      const kind = kindOf(e); const label = kind === "sight" ? String(++n) : kind;
      stops.push({ name: e.name, lat: g[0], lng: g[1], kind, n: label }); all.push(g);
      if (prev) {
        const flight = pending.length > 0 && pending.every((t) => t.mode === "flight"); const poly = pending.flatMap((t) => (t.mode !== "flight" && t.polyline ? t.polyline : []));
        legs.push({ mode: flight ? "flight" : pending.find((t) => t.mode !== "walk")?.mode ?? pending[0]?.mode ?? "walk", coords: poly.length > 1 ? poly : [prev, g], label: legLabel(pending) || undefined });
      }
      prev = g; pending = [];
    }
    const f = d.city === "geo" ? geoFrameOfDay(d) : null;
    const center: LatLng = f ? [f.lat0, f.lng0] : mean(stops.map((s) => [s.lat, s.lng] as LatLng));
    const radiusKm = f ? Math.max(f.widthKm, f.heightKm) / 2 : Math.max(6, ...stops.map((s) => haversineKm(center, [s.lat, s.lng])));
    return { index: d.index, label: `D${d.index}`, title: plain(d.title), color: accent(), legs, stops, center, radiusKm };
  });
  const center = mean(all.length ? all : [[30, 60]]);
  const radiusKm = Math.max(40, ...all.map((p) => haversineKm(center, p)));
  const ti = todayIndex(trip); const heroDay = days[ti >= 0 ? ti : 0]; const heroAt = heroDay?.stops[0] ? ([heroDay.stops[0].lat, heroDay.stops[0].lng] as LatLng) : center;
  const st = tripStats(trip);
  const badgeKind: GlobeBook["badgeKind"] = trip.status === "closed" ? "done" : ti >= 0 ? "live" : trip.startDate > today() ? "soon" : "plan";
  const badge = trip.status === "closed" ? t("globe.badgeDone") : ti >= 0 ? t("globe.badgeLive", { n: trip.days[ti].index }) : trip.startDate > today() ? t("globe.badgeSoon", { n: Math.ceil((+new Date(trip.startDate) - +new Date(today())) / 864e5) }) : t("globe.badgePlan");
  return { id: trip.id, title: plain(trip.title), subtitle: nDays(st.days), badge, center, radiusKm, color: accent(), badgeKind, days, heroAt };
}
