/** 用户旅程的阶段：首页该给什么，由「今天」与各本书的日期决定（iOS / 鸿蒙照同一套规则）。
 *  优先级：旅行中 > 即将出发（3 天内）> 刚回来（7 天内结束）> 空闲（可能有以后的行程）。 */
import type { Trip } from "../spec/types.ts";
import { t } from "../i18n/index.ts";

export type Journey =
  | { kind: "traveling"; trip: Trip; dayIndex: number }
  | { kind: "departing"; trip: Trip; inDays: number }
  | { kind: "back"; trip: Trip; daysAgo: number }
  | { kind: "idle"; next?: { trip: Trip; inDays: number } };

const DAY = 86400000;
const dayNo = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / DAY);

export function journeyState(trips: Trip[], today: string): Journey {
  const t0 = dayNo(today);
  const live = trips.filter((t) => t.status !== "closed");
  const traveling = live.filter((t) => dayNo(t.startDate) <= t0 && t0 <= dayNo(t.endDate)).sort((a, b) => dayNo(a.startDate) - dayNo(b.startDate))[0];
  if (traveling) return { kind: "traveling", trip: traveling, dayIndex: Math.min(traveling.days.length - 1, t0 - dayNo(traveling.startDate)) };
  const upcoming = live.filter((t) => dayNo(t.startDate) > t0).sort((a, b) => dayNo(a.startDate) - dayNo(b.startDate));
  if (upcoming[0] && dayNo(upcoming[0].startDate) - t0 <= 3) return { kind: "departing", trip: upcoming[0], inDays: dayNo(upcoming[0].startDate) - t0 };
  const back = trips.filter((t) => dayNo(t.endDate) < t0 && t0 - dayNo(t.endDate) <= 7).sort((a, b) => dayNo(b.endDate) - dayNo(a.endDate))[0];
  if (back) return { kind: "back", trip: back, daysAgo: t0 - dayNo(back.endDate) };
  return { kind: "idle", next: upcoming[0] ? { trip: upcoming[0], inDays: dayNo(upcoming[0].startDate) - t0 } : undefined };
}

/** 「今天出发 / 明天出发 / 后天出发 / 3 天后出发」 */
export function departLabel(inDays: number): string { return inDays <= 0 ? t("journey.departToday") : inDays === 1 ? t("journey.departTomorrow") : inDays === 2 ? t("journey.departDayAfter") : t("journey.departIn", { n: inDays }); }
