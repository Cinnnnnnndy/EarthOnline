/** 读取 world-atlas TopoJSON（浏览器按需 fetch，Node 测试直接给对象）并转成多边形环 */
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

export type Ring = [number, number][];   // [lng, lat]
export interface GeoData { land50?: Ring[][]; land10?: Ring[][]; borders50?: Ring[] }

export function polygonsOf(topology: unknown, object: string): Ring[][] {
  const topo = topology as Topology<Record<string, GeometryCollection>>;
  const f = feature(topo, topo.objects[object]) as unknown as { type: string; features?: { geometry: { type: string; coordinates: unknown } | null }[]; geometry?: { type: string; coordinates: unknown } };
  const geoms = f.type === "FeatureCollection" ? f.features!.map((x) => x.geometry) : [f.geometry!];
  const out: Ring[][] = [];
  for (const g of geoms) { if (!g) continue; if (g.type === "Polygon") out.push(g.coordinates as Ring[]); else if (g.type === "MultiPolygon") out.push(...(g.coordinates as Ring[][])); }
  return out;
}
export function bordersOf(topology: unknown): Ring[] {
  const topo = topology as Topology<{ countries: GeometryCollection }>;
  const m = mesh(topo, topo.objects.countries, (a, b) => a !== b) as unknown as { coordinates: Ring[] };
  return m.coordinates;
}

const cache: Record<string, Promise<unknown>> = {};
export function fetchJson(url: string): Promise<unknown> { return (cache[url] ??= fetch(url).then((r) => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); })); }
let geo: Promise<GeoData> | null = null; let land10: Promise<Ring[][]> | null = null;
export function loadGlobeGeo(base: string): Promise<GeoData> {
  return (geo ??= Promise.all([fetchJson(base + "assets/geo/land-50m.json"), fetchJson(base + "assets/geo/countries-50m.json")]).then(([l, c]) => ({ land50: polygonsOf(l, "land"), borders50: bordersOf(c) })));
}
export function loadLand10(base: string): Promise<Ring[][]> { return (land10 ??= fetchJson(base + "assets/geo/land-10m.json").then((l) => polygonsOf(l, "land"))); }
export function loadCountries(base: string): Promise<unknown> { return fetchJson(base + "assets/geo/countries-50m.json"); }
