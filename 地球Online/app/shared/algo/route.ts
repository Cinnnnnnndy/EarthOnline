/** 把一天的条目铺到城市底板上：站点按名字锚定地标 → 找到地标门口的路格 → 路网 BFS 连成一条路径 */
import type { Day, TransportMode } from "../spec/types.ts";
import type { CityPlate } from "./city.ts";
import { modeName } from "./transport.ts";

export interface RouteStop {
  entryId: string; name: string; short: string; landmark: string; cell: [number, number]; center: [number, number]; arrive: number; time?: string; visited: boolean;
  /** 地理底板：点在画外（航班另一端），标到画边 */
  offPlate?: boolean; category?: string; desc?: string;
}
export interface RouteSegment {
  start: number; end: number; mode: TransportMode; label: string; durationMinutes: number; entryIds: string[];
  distanceKm?: number;
  /** 播放速度倍率：长路段压缩到十秒上下 */
  speedScale?: number;
  /** 航班：起飞（out，飞出画边）/ 降落（in，从画边飞入） */
  arc?: "out" | "in" | "both";
}
export interface RouteLodging { name: string; landmark?: string; cell?: [number, number]; center?: [number, number]; offPlate: boolean; arrive: number }
/** kind：grid = 城市底板（格坐标，取格心）；geo = 地理底板（连续坐标） */
export interface Route { kind?: "grid" | "geo"; city: string; path: [number, number][]; stops: RouteStop[]; segments: RouteSegment[]; lodging?: RouteLodging; unresolved: string[] }

/** 地标里没有的地名：手工锚点（底板生成器接上 OSM 之后这张表会消失） */
const FALLBACK: Record<string, Record<string, [number, number]>> = {
  kyoto: { "岚山": [4, 12], "渡月桥": [4, 12], "竹林": [4, 12], "鸭川": [26, 12] },
  osaka: { "新世界": [23, 19], "难波": [16, 17], "梅田": [17, 3] },
  nara: { "奈良公园": [20, 12] },
  kobe: { "美利坚公园": [19, 19], "元町": [15, 13] },
};

const norm = (s: string) => s.replace(/\s+/g, "").replace(/[·・]/g, "").replace(/(酒店|checkin|check-in|寄存行李|✈)/gi, "");

export function anchorOf(plate: CityPlate, name: string, roles: readonly (string | null)[] = ["place", "airport"]): { landmark: string; center: [number, number] } | null {
  const n = norm(name);
  for (const lm of plate.landmarks) {
    if (!lm.name || !roles.includes(lm.role)) continue;
    const l = norm(lm.name);
    if (n.includes(l) || l.includes(n)) return { landmark: lm.name, center: [lm.x + 0.5, lm.y + 0.5] };
  }
  for (const lm of plate.landmarks) {
    if (!lm.name) continue; const l = norm(lm.name);
    if (n.includes(l) || l.includes(n)) return { landmark: lm.name, center: [lm.x + 0.5, lm.y + 0.5] };
  }
  const fb = FALLBACK[plate.id] ?? {};
  for (const k in fb) if (n.includes(k)) return { landmark: k, center: [fb[k][0] + 0.5, fb[k][1] + 0.5] };
  return null;
}

/** 离地标最近的可走格（门口） */
export function entranceOf(plate: CityPlate, center: [number, number]): [number, number] {
  let best: [number, number] = [Math.floor(center[0]), Math.floor(center[1])], bd = Infinity;
  for (const c of plate.walkable) {
    const d = (c[0] + 0.5 - center[0]) ** 2 + (c[1] + 0.5 - center[1]) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function bfs(plate: CityPlate, from: [number, number], to: [number, number]): [number, number][] {
  const key = (x: number, y: number) => y * plate.cols + x;
  if (from[0] === to[0] && from[1] === to[1]) return [from];
  const prev = new Map<number, number>(); const q: [number, number][] = [from]; prev.set(key(from[0], from[1]), -1);
  const W = plate.walkableSet;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= plate.cols || ny >= plate.rows) continue;
      const k = key(nx, ny); if (prev.has(k) || !W.has(k)) continue;
      prev.set(k, key(x, y)); if (nx === to[0] && ny === to[1]) { q.length = 0; break; } q.push([nx, ny]);
    }
  }
  const out: [number, number][] = []; let k: number | undefined = key(to[0], to[1]);
  if (!prev.has(k)) return [from, to];                       // 不连通：直线跳过去（不该发生，但别崩）
  while (k !== undefined && k !== -1) { out.push([k % plate.cols, Math.floor(k / plate.cols)]); k = prev.get(k); }
  return out.reverse();
}

export function buildRoute(plate: CityPlate, day: Day, startCell?: [number, number]): Route {
  const path: [number, number][] = []; const stops: RouteStop[] = []; const segments: RouteSegment[] = []; const unresolved: string[] = [];
  const append = (seg: [number, number][]) => { for (const c of seg) if (!path.length || path.at(-1)![0] !== c[0] || path.at(-1)![1] !== c[1]) path.push(c); };
  let pending: { mode: TransportMode; label: string; minutes: number; id: string }[] = [];
  let cur: [number, number] | undefined = startCell;
  let lodgingEntry: { name: string } | undefined;
  for (const e of day.entries) {
    if (e.type === "transport") { pending.push({ mode: e.mode, label: e.label, minutes: e.durationMinutes ?? 0, id: e.id }); continue; }
    if (e.type === "lodging") { lodgingEntry = { name: e.name }; continue; }
    const a = anchorOf(plate, e.name);
    if (!a) { unresolved.push(e.name); continue; }
    const cell = entranceOf(plate, a.center);
    const segStart = path.length ? path.length - 1 : 0;
    if (!cur) { append([cell]); cur = cell; }
    else append(bfs(plate, cur, cell));
    const arrive = path.length - 1;
    const first = pending[0];
    segments.push({ start: segStart, end: arrive, mode: first?.mode ?? "walk", label: pending.map((p) => p.label).join(" + ") || modeName("walk"), durationMinutes: pending.reduce((s, p) => s + p.minutes, 0), entryIds: pending.map((p) => p.id) });
    stops.push({ entryId: e.id, name: e.name, short: a.landmark, landmark: a.landmark, cell, center: a.center, arrive, time: e.plannedStart, visited: !!e.visited });
    cur = cell; pending = [];
  }
  let lodging: RouteLodging | undefined;
  const lodgingName = lodgingEntry?.name ?? day.lodging;
  if (lodgingName) {
    const a = anchorOf(plate, lodgingName, ["lodging"]);
    if (a && cur) {
      const cell = entranceOf(plate, a.center); const segStart = path.length - 1; append(bfs(plate, cur, cell));
      const first = pending[0];
      segments.push({ start: segStart, end: path.length - 1, mode: first?.mode ?? "walk", label: pending.map((p) => p.label).join(" + ") || modeName("walk"), durationMinutes: pending.reduce((s, p) => s + p.minutes, 0), entryIds: pending.map((p) => p.id) });
      lodging = { name: lodgingName, landmark: a.landmark, cell, center: a.center, offPlate: false, arrive: path.length - 1 };
    } else lodging = { name: lodgingName, offPlate: true, arrive: Math.max(0, path.length - 1) };
  }
  return { kind: "grid", city: plate.id, path, stops, segments, lodging, unresolved };
}
