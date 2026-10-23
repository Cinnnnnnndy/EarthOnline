/** 坐标 → 国家（点在多边形里），用 world-atlas 的 countries TopoJSON。浏览器与 Node 都能跑（数据由调用方给） */
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { getLocale, type Locale } from "../i18n/index.ts";

type Ring = [number, number][];
interface Poly { rings: Ring[]; bbox: [number, number, number, number]; wrap: boolean }
interface Country { name: string; polys: Poly[]; bbox: [number, number, number, number] }

export const COUNTRY_ZH: Record<string, string> = {
  Iceland: "冰岛", Norway: "挪威", Denmark: "丹麦", Sweden: "瑞典", Finland: "芬兰", Japan: "日本", China: "中国", "United Kingdom": "英国",
  France: "法国", Germany: "德国", Italy: "意大利", Spain: "西班牙", "United States of America": "美国", Canada: "加拿大", Australia: "澳大利亚",
  "New Zealand": "新西兰", Switzerland: "瑞士", Austria: "奥地利", Netherlands: "荷兰", Greenland: "格陵兰", "United Arab Emirates": "阿联酋",
  Thailand: "泰国", Singapore: "新加坡", Malaysia: "马来西亚", Indonesia: "印度尼西亚", "South Korea": "韩国", Vietnam: "越南", Portugal: "葡萄牙", Greece: "希腊", Turkey: "土耳其", Egypt: "埃及",
};
export const COUNTRY_JA: Record<string, string> = {
  Iceland: "アイスランド", Norway: "ノルウェー", Denmark: "デンマーク", Sweden: "スウェーデン", Finland: "フィンランド", Japan: "日本", China: "中国", "United Kingdom": "イギリス",
  France: "フランス", Germany: "ドイツ", Italy: "イタリア", Spain: "スペイン", "United States of America": "アメリカ", Canada: "カナダ", Australia: "オーストラリア",
  "New Zealand": "ニュージーランド", Switzerland: "スイス", Austria: "オーストリア", Netherlands: "オランダ", Greenland: "グリーンランド", "United Arab Emirates": "アラブ首長国連邦",
  Thailand: "タイ", Singapore: "シンガポール", Malaysia: "マレーシア", Indonesia: "インドネシア", "South Korea": "韓国", Vietnam: "ベトナム", Portugal: "ポルトガル", Greece: "ギリシャ", Turkey: "トルコ", Egypt: "エジプト",
};
const COUNTRY_EN: Record<string, string> = { "United States of America": "United States", "United Arab Emirates": "UAE" };
/** 国界数据里的英文国名 → 界面语言的国名（表里没有的原样用英文名） */
export function countryName(en: string, locale: Locale = getLocale()): string {
  return locale === "zh-Hans" ? COUNTRY_ZH[en] ?? en : locale === "ja" ? COUNTRY_JA[en] ?? en : COUNTRY_EN[en] ?? en;
}

export function makeCountryLookup(topology: unknown): (lat: number, lng: number) => string | null {
  const topo = topology as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const fc = feature(topo, topo.objects.countries) as unknown as { features: { properties: { name: string }; geometry: { type: string; coordinates: unknown } | null }[] };
  const list: Country[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const raw = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
    let X0 = 180, Y0 = 90, X1 = -180, Y1 = -90;
    const polys: Poly[] = raw.map((rings) => {
      // 跨 180° 经线的环（阿拉斯加、楚科奇、斐济）：经度挪到 0–360 再判断
      let wrap = false; const r0 = rings[0];
      for (let i = 1; i < r0.length; i++) if (Math.abs(r0[i][0] - r0[i - 1][0]) > 180) { wrap = true; break; }
      const rr = wrap ? rings.map((r) => r.map(([x, y]) => [x < 0 ? x + 360 : x, y] as [number, number])) : rings;
      let x0 = 1e9, y0 = 90, x1 = -1e9, y1 = -90;
      for (const [x, y] of rr[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      X0 = Math.min(X0, x0); X1 = Math.max(X1, x1); Y0 = Math.min(Y0, y0); Y1 = Math.max(Y1, y1);
      return { rings: rr, bbox: [x0, y0, x1, y1] as [number, number, number, number], wrap };
    });
    list.push({ name: f.properties.name, polys, bbox: [X0, Y0, X1, Y1] });
  }
  const inRing = (x: number, y: number, r: Ring) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  return (lat, lng) => {
    let best: string | null = null;
    for (const c of list) for (const p of c.polys) {
      const x = p.wrap && lng < 0 ? lng + 360 : lng;
      if (x < p.bbox[0] || x > p.bbox[2] || lat < p.bbox[1] || lat > p.bbox[3]) continue;
      if (inRing(x, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(x, lat, h))) return c.name;
    }
    // 海上 / 岸边的点（码头、海滩）：找 0.3° 内最近的国家边界框中心
    let bd = 0.3;
    for (const c of list) for (const p of c.polys) {
      if (p.wrap) continue;
      for (const [x, y] of p.rings[0]) { const d = Math.hypot(x - lng, y - lat); if (d < bd) { bd = d; best = c.name; } }
    }
    return best;
  };
}
