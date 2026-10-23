/** 导入「路径规划」类网页（如用户的 Claude artifact「冰岛 + 北欧 · 双方案路径规划」）：
 *  页面里的 `const routes = {...}`（JS 对象字面量：方案、天、站点、坐标、每段里程/用时）+ `const OSRM = {...}`（每段真实路线折线）
 *  → 每个方案一本书（spec 0.3，city="geo"）。不执行页面脚本，只做字面量解析。 */
import JSON5 from "json5";
import { SCHEMA_VERSION, type Trip, type Day, type Entry, type TransportMode, type PlaceEntry } from "../spec/types.ts";
import { parseDuration } from "../algo/duration.ts";
import { hashString } from "../algo/prng.ts";
import { COUNTRY_ZH } from "../geo/countries.ts";
import { t } from "../i18n/index.ts";

export interface PageStop { n: string | number; name: string; desc?: string; lat: number; lng: number; isHotel?: boolean; isAirport?: boolean; isFerry?: boolean; leg: { km: number; min: number | string } | null }
export interface PageRoute { color?: string; plan: number; day: number; date?: string; title: string; stops: PageStop[] }
export interface PageLeg { from: string; to: string; km?: number; min?: number | string; mode?: string; coords?: [number, number][] }
export interface ParsedPage { title: string; planLabels: Record<number, string>; routes: Record<string, PageRoute>; osrm: Record<string, PageLeg[]>; warnings: string[] }

/** 从源码里取出 `const NAME = {…}` 的字面量（跳过字符串与注释，按括号配对）；被截断则返回 null */
export function extractLiteral(src: string, name: string): string | null {
  const m = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(src); if (!m) return null;
  let i = m.index + m[0].length; const open = src[i]; if (open !== "{" && open !== "[") return null;
  let depth = 0; const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2); if (i < 0) return null; i++; continue; }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

export function parseRoutePage(html: string): ParsedPage {
  const warnings: string[] = [];
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "导入的行程").trim();
  const planLabels: Record<number, string> = {};
  for (const m of html.matchAll(/data-plan="(\d+)"[^>]*>([^<]*)<span[^>]*>([^<]*)<\/span>/g)) planLabels[+m[1]] = m[3].trim();
  const rl = extractLiteral(html, "routes");
  if (!rl) throw new Error(t("import.noRoutes"));
  const routes = JSON5.parse(rl) as Record<string, PageRoute>;
  let osrm: Record<string, PageLeg[]> = {};
  const ol = extractLiteral(html, "OSRM");
  if (ol) { try { osrm = JSON.parse(ol); } catch { warnings.push(t("import.osrmBroken")); } }
  else warnings.push(t("import.osrmMissing"));
  return { title, planLabels, routes, osrm, warnings };
}

const HHMM = /(\d{1,2}):(\d{2})/;
const FLIGHT_NO = /\b([A-Z][A-Z0-9]\d{2,4})\b/;
function stayOf(desc = ""): number | undefined { const m = desc.match(/停留\s*([\d.]+(?:-[\d.]+)?\s*(?:h|min|小时|分钟))/); return m ? parseDuration(m[1]) ?? undefined : undefined; }
function timeOf(desc = ""): string | undefined { const m = desc.match(HHMM); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined; }
function modeOf(leg: PageLeg | undefined): TransportMode {
  switch (leg?.mode) { case "ferry": return "ship"; case "flight": return "flight"; case "walk": return "walk"; default: return "car"; }
}
function labelOf(mode: TransportMode, prev: PageStop, cur: PageStop): string {
  if (mode === "flight") { const no = (prev.desc ?? "").match(FLIGHT_NO)?.[1] ?? (cur.desc ?? "").match(FLIGHT_NO)?.[1]; return no ? `航班 ${no}` : "航班"; }
  if (mode === "ship") return /hurtigruten|trollfjord/i.test(`${prev.desc} ${cur.desc}`) ? "Hurtigruten 邮轮" : "渡轮";
  if (mode === "walk") return "步行";
  return "自驾";
}

export interface ImportOptions { year?: number; now?: Date; countryOf?: (lat: number, lng: number) => string | null }

export function routePageToTrips(page: ParsedPage, opts: ImportOptions = {}): Trip[] {
  const now = opts.now ?? new Date(); const year = opts.year ?? now.getFullYear(); const iso = now.toISOString();
  const byPlan = new Map<number, [string, PageRoute][]>();
  for (const [key, r] of Object.entries(page.routes)) (byPlan.get(r.plan) ?? byPlan.set(r.plan, []).get(r.plan)!).push([key, r]);
  const group = `page-${hashString(page.title).toString(36)}`;
  const trips: Trip[] = [];
  for (const [plan, list] of [...byPlan.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a[1].day - b[1].day);
    const days: Day[] = list.map(([key, r]) => {
      const legs = page.osrm[key] ?? [];
      const entries: Entry[] = []; let n = 0; const id = () => `d${r.day}-e${n++}`;
      r.stops.forEach((s, i) => {
        if (i > 0 && s.leg) {
          const leg = legs[i - 1]; const mode = modeOf(leg); const prev = r.stops[i - 1];
          const minutes = typeof s.leg.min === "number" ? s.leg.min : parseDuration(String(s.leg.min)) ?? undefined;
          const coords = leg?.coords && leg.coords.length >= 2 ? leg.coords.map(([a, b]) => [a, b] as [number, number]) : undefined;
          entries.push({ id: id(), type: "transport", mode, label: labelOf(mode, prev, s), durationMinutes: minutes, distanceKm: s.leg.km, polyline: coords });
        }
        const category: PlaceEntry["category"] = s.isHotel ? "hotel" : s.isAirport ? "airport" : s.isFerry ? "port" : "sight";
        entries.push({ id: id(), type: "place", name: s.name, category, plannedStart: timeOf(s.desc), stayMinutes: stayOf(s.desc), notes: s.desc, geo: { lat: s.lat, lng: s.lng } });
      });
      const [mm, dd] = (r.date ?? "1/1").split("/").map((x) => parseInt(x, 10));
      const last = r.stops.at(-1);
      const lodging = last?.isHotel ? last.name : last?.isFerry ? "邮轮上" : undefined;
      return { index: r.day, date: `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`, title: r.title, city: "geo", entries, lodging, color: r.color };
    });
    // 跨年（12 月 → 1 月）
    for (let i = 1; i < days.length; i++) if (days[i].date < days[i - 1].date) days[i].date = `${year + 1}${days[i].date.slice(4)}`;
    const label = page.planLabels[plan] ?? `方案 ${plan}`;
    const title = label.replace(/\s*\(.*\)\s*$/, "").trim() || page.title;
    const countries: string[] = [];
    if (opts.countryOf) for (const d of days) for (const e of d.entries) if (e.type === "place" && e.geo) { const c = opts.countryOf(e.geo.lat, e.geo.lng); const zh = c ? COUNTRY_ZH[c] ?? c : null; if (zh && !countries.includes(zh)) countries.push(zh); }
    const startDate = days[0].date, endDate = days.at(-1)!.date; const today = iso.slice(0, 10);
    trips.push({
      schemaVersion: SCHEMA_VERSION, id: `${group}-p${plan}`, title, destination: countries.join(" · ") || title, startDate, endDate, theme: "极光冰原",
      seed: hashString(`${page.title}|${plan}`), status: today < startDate ? "planning" : today > endDate ? "closed" : "traveling",
      plan: { group, index: plan, label: `方案 ${plan}` }, days, createdAt: iso, updatedAt: iso,
    });
  }
  return trips;
}

export function importRoutePage(html: string, opts: ImportOptions = {}): { trips: Trip[]; warnings: string[] } {
  const page = parseRoutePage(html); return { trips: routePageToTrips(page, opts), warnings: page.warnings };
}
