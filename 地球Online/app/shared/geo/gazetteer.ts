/** 小地名表（离线）：新建旅程搜目的地、给没有坐标的站点（如关西示例）落到地球上。正式版接 POI 搜索（P1） */
import data from "../rules/gazetteer.json" with { type: "json" };
export interface Place { name: string; aliases: string[]; lat: number; lng: number; kind: "city" | "poi" | "region" }
export const PLACES = data as Place[];
const norm = (s: string) => s.toLowerCase().replace(/[\s·・]/g, "");
export function searchPlaces(q: string, limit = 8): Place[] {
  const n = norm(q); if (!n) return PLACES.filter((p) => p.kind === "city").slice(0, limit);
  const score = (p: Place) => { const names = [p.name, ...p.aliases].map(norm); if (names.some((x) => x === n)) return 0; if (names.some((x) => x.startsWith(n))) return 1; if (names.some((x) => x.includes(n))) return 2; if (names.some((x) => n.includes(x))) return 3; return 9; };
  return PLACES.map((p) => [p, score(p)] as const).filter(([, s]) => s < 9).sort((a, b) => a[1] - b[1] || (a[0].kind === "city" ? -1 : 1)).slice(0, limit).map(([p]) => p);
}
/** 站点名 → 坐标（名字互相包含即可；取最长匹配） */
export function locate(name: string): Place | null {
  const n = norm(name); let best: Place | null = null; let bl = 0;
  for (const p of PLACES) for (const x of [p.name, ...p.aliases]) { const k = norm(x); if (k.length >= 2 && (n.includes(k) || k.includes(n)) && k.length > bl) { best = p; bl = k.length; } }
  return best;
}
/** 反查：离这个坐标最近的城市（maxKm 以内），用来给「点地球放家 / 补旗」起名 */
export function nearestPlace(lat: number, lng: number, maxKm = 80, kinds: Place["kind"][] = ["city"]): Place | null {
  const r = Math.PI / 180; let best: Place | null = null, bd = maxKm;
  for (const p of PLACES) { if (!kinds.includes(p.kind)) continue; const a = Math.sin(((p.lat - lat) * r) / 2) ** 2 + Math.cos(lat * r) * Math.cos(p.lat * r) * Math.sin(((p.lng - lng) * r) / 2) ** 2; const d = 12742 * Math.asin(Math.min(1, Math.sqrt(a))); if (d < bd) { bd = d; best = p; } }
  return best;
}
