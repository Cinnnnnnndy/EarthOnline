/** 导航到站点（第八轮末，判断 D72）：不自己做导航，跳到手机上的地图 App——Apple 地图、Google 地图、高德、百度。
 *  四家都走各自的网页跳转链接：装了 App 就拉起，没装就开网页，所以不用在 App 里登记 URL scheme。
 *  坐标一律传 WGS-84：高德用 coordinate=wgs84、百度用 coord_type=wgs84 让对方换算；苹果、Google 本来就是 WGS-84。
 *  iOS（StopDetailSheet.swift 的 MapsLink）照同一套。 */
import type { TransportMode } from "../spec/types.ts";

export type MapApp = "apple" | "google" | "amap" | "baidu";
export const MAP_APPS: readonly MapApp[] = ["apple", "google", "amap", "baidu"];
export type NavMode = "walk" | "drive" | "transit";

/** 到这一站的交通方式 → 导航方式：步行；自驾 / 打车 → 驾车；其余（地铁、火车、巴士、船、飞机）→ 公交 */
export const navMode = (m?: TransportMode): NavMode => (!m || m === "walk" ? "walk" : m === "car" || m === "taxi" ? "drive" : "transit");

export function mapLink(app: MapApp, p: { name: string; lat: number; lng: number }, mode: NavMode = "walk"): string {
  const lat = p.lat.toFixed(6), lng = p.lng.toFixed(6), name = encodeURIComponent(p.name);
  switch (app) {
    case "apple": return `https://maps.apple.com/?daddr=${lat},${lng}&q=${name}&dirflg=${{ walk: "w", drive: "d", transit: "r" }[mode]}`;
    case "google": return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${{ walk: "walking", drive: "driving", transit: "transit" }[mode]}`;
    case "amap": return `https://uri.amap.com/navigation?to=${lng},${lat},${name}&mode=${{ walk: "walk", drive: "car", transit: "bus" }[mode]}&coordinate=wgs84&callnative=1&src=earth-online`;
    case "baidu": return `https://api.map.baidu.com/direction?destination=latlng:${lat},${lng}%7Cname:${name}&coord_type=wgs84&mode=${{ walk: "walking", drive: "driving", transit: "transit" }[mode]}&output=html&src=earth-online`;
  }
}
