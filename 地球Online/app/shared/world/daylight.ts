/** 地球外的天色：白天 / 晨昏 / 夜，由「手机当地时间」和「手机的深浅外观」一起决定。
 *  规则：
 *   1. 设置里选了「白天」或「夜晚」就固定；
 *   2. 「跟随手机」（默认）：手机是深色外观 → 夜；否则看当地太阳高度（家的经纬度；没设家就按时区推一个经度），
 *      高于 6° 是白天，-8°～6° 是晨昏（日出日落前后的粉橙），更低是夜。
 *  太阳高度用 NOAA 的简化公式（误差在 1° 以内，够分晨昏）。 */

export type SkyPhase = "day" | "dusk" | "night";
export type Appearance = "auto" | "light" | "dark";

const RAD = Math.PI / 180;

/** 太阳高度角（度）。lat/lng 为度，东经为正 */
export function sunAltitude(date: Date, lat: number, lng: number): number {
  const jd = date.getTime() / 86400000 + 2440587.5; const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360; const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; const eps = (23.439 - 0.0000004 * n) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;                 // 格林尼治恒星时（小时）
  const ha = ((gmst * 15 + lng) * RAD - ra);                                 // 时角
  const alt = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha));
  return alt / RAD;
}

export function phaseOfAltitude(alt: number): SkyPhase { return alt > 6 ? "day" : alt > -8 ? "dusk" : "night"; }

/** 没设家时，用时区推一个大概的位置：经度 = 时区偏移 × 15°，纬度取 30°N（覆盖大部分用户的日照节律） */
export function guessPlace(date: Date): { lat: number; lng: number } { return { lat: 30, lng: -date.getTimezoneOffset() / 4 }; }

export function resolvePhase(o: { appearance: Appearance; systemDark: boolean; now: Date; place?: { lat: number; lng: number } | null }): SkyPhase {
  if (o.appearance === "light") return "day";
  if (o.appearance === "dark") return "night";
  if (o.systemDark) return "night";
  const p = o.place ?? guessPlace(o.now);
  return phaseOfAltitude(sunAltitude(o.now, p.lat, p.lng));
}
