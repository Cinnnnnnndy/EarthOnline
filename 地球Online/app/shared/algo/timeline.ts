/** 一天的时间线：按条目顺序推算到达 / 离开时刻，交通累加时长，站点按计划时间校准 */
import type { Day, Entry, PlaceEntry } from "../spec/types.ts";
import { addMinutes, minutesOf } from "./duration.ts";

export interface TimelineItem { entryId: string; type: Entry["type"]; start: string; end: string; minutes: number }
export interface Timeline { items: TimelineItem[]; walkMinutes: number; transitMinutes: number; stayMinutes: number; firstStart: string; lastEnd: string }

const DEFAULT_STAY = 75, DEFAULT_START = "09:00";

export function buildTimeline(day: Day): Timeline {
  const items: TimelineItem[] = []; let walk = 0, transit = 0, stay = 0;
  const firstPlanned = day.entries.find((e): e is PlaceEntry => e.type === "place" && !!e.plannedStart);
  let clock = firstPlanned?.plannedStart ?? DEFAULT_START;
  // 第一个有计划时间的站点之前的交通：从它倒推
  let pre = 0;
  for (const e of day.entries) { if (e === firstPlanned) break; if (e.type === "transport") pre += e.durationMinutes ?? 0; }
  clock = addMinutes(clock, -pre);
  for (let i = 0; i < day.entries.length; i++) {
    const e = day.entries[i];
    if (e.type === "transport") {
      const m = e.durationMinutes ?? 0; items.push({ entryId: e.id, type: e.type, start: clock, end: addMinutes(clock, m), minutes: m });
      if (e.mode === "walk") walk += m; else transit += m; clock = addMinutes(clock, m);
    } else if (e.type === "place") {
      if (e.plannedStart && minutesOf(e.plannedStart) > minutesOf(clock)) clock = e.plannedStart;
      let m = e.stayMinutes ?? 0;
      if (!e.stayMinutes) {
        // 下一个有计划时间的站点减去途中交通，得到停留；没有就用默认
        let travel = 0, next: PlaceEntry | undefined;
        for (let j = i + 1; j < day.entries.length; j++) { const f = day.entries[j]; if (f.type === "transport") travel += f.durationMinutes ?? 0; if (f.type === "place") { next = f; break; } }
        m = next?.plannedStart ? Math.max(20, minutesOf(next.plannedStart) - minutesOf(clock) - travel) : DEFAULT_STAY;
      }
      items.push({ entryId: e.id, type: e.type, start: clock, end: addMinutes(clock, m), minutes: m }); stay += m; clock = addMinutes(clock, m);
    } else {
      items.push({ entryId: e.id, type: e.type, start: clock, end: clock, minutes: 0 });
    }
  }
  return { items, walkMinutes: walk, transitMinutes: transit, stayMinutes: stay, firstStart: items[0]?.start ?? DEFAULT_START, lastEnd: items.at(-1)?.end ?? DEFAULT_START };
}

export function itemOf(tl: Timeline, entryId: string): TimelineItem | undefined { return tl.items.find((i) => i.entryId === entryId); }
