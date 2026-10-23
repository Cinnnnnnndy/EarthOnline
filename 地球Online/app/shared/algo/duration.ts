/** 时长文本 ↔ 分钟。"50 分钟" / "1 小时 20 分" / "1.5 小时" / "45min" / "1h20m" / "1 h 20 min" / "1時間20分" */
import { duration } from "../i18n/index.ts";

export function parseDuration(text: string): number | null {
  const s = text.replace(/\s+/g, "").toLowerCase();
  if (!s) return null;
  const hm = s.match(/^(\d+)h(\d{1,2})$/); if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);   // 1h58、17h00
  const rng = s.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(小时|時間|h|分钟|分|min)/);                         // 2-3h → 取中间
  if (rng) { const mid = (parseFloat(rng[1]) + parseFloat(rng[2])) / 2; return Math.round(/小时|時間|h/.test(rng[3]) ? mid * 60 : mid); }
  let total = 0, hit = false;
  const h = s.match(/(\d+(?:\.\d+)?)(?:小时|時間|h|hr|hours?)/); if (h) { total += parseFloat(h[1]) * 60; hit = true; }
  const m = s.match(/(\d+)(?:分钟|分|min|m(?![a-z]))/); if (m) { total += parseInt(m[1], 10); hit = true; }
  if (!hit) { const n = s.match(/^(\d+)$/); if (n) return parseInt(n[1], 10); return null; }
  return Math.round(total);
}
/** 分钟 → 「1 小时 20 分钟」/ "1 h 20 min" / 「1時間20分」，跟当前界面语言走（见 shared/i18n） */
export function formatDuration(min: number | undefined | null): string { return duration(min); }
export function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number); const t = ((h * 60 + m + Math.round(min)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
export function minutesOf(hhmm: string): number { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
