/** 待办（第八轮）：规划时给站点记一件要提前做的事，比如「提前一个月买门票」。
 *  待办挂在站点上（PlaceEntry.todos）；due 是该做完的日期，没有 due 的按出发日算。
 *  这里只有纯函数：按「提前几天」算日期、列出整本书的待办、找最近要做的一件。网页与 iOS（Todos.swift）照同一套。 */
import type { Trip, Todo, PlaceEntry } from "../spec/types.ts";

/** 添加时可选的「提前几天」：一个月、两周、一周、一天、当天 */
export const LEAD_DAYS = [30, 14, 7, 1, 0] as const;
export type LeadDays = (typeof LEAD_DAYS)[number];

export function shiftDate(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
/** 到期日 = 那一天的日期往前推 lead 天 */
export const dueFromLead = (dayDate: string, lead: number): string => shiftDate(dayDate, -lead);

export interface TodoRef { tripId: string; dayIndex: number; dayDate: string; entryId: string; placeName: string; todo: Todo; due: string }

/** 整本书的待办，按到期日、再按天排序 */
export function allTodos(trip: Trip): TodoRef[] {
  const out: TodoRef[] = [];
  trip.days.forEach((d, dayIndex) => {
    for (const e of d.entries) {
      if (e.type !== "place" || !e.todos?.length) continue;
      for (const todo of e.todos) out.push({ tripId: trip.id, dayIndex, dayDate: d.date, entryId: e.id, placeName: e.name, todo, due: todo.due ?? trip.startDate });
    }
  });
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.dayIndex - b.dayIndex));
}
export const openTodos = (trip: Trip): TodoRef[] => allTodos(trip).filter((r) => !r.todo.done);
/** 最近要做的一件：今天起最早到期的；都已经过期就是最早那件（提醒它漏了） */
export function nextTodo(trip: Trip, today?: string): TodoRef | undefined {
  const open = openTodos(trip);
  return (today ? open.find((r) => r.due >= today) : undefined) ?? open[0];
}
export function todoCounts(trip: Trip): { open: number; done: number; total: number } {
  const all = allTodos(trip); const done = all.filter((r) => r.todo.done).length;
  return { open: all.length - done, done, total: all.length };
}

/** 一个站点自己的待办（提示跟着站点走，不汇总到整个行程）：没做完的数量，以及最近要做的一件 */
export function placeTodos(e: Pick<PlaceEntry, "todos">, fallbackDue: string, today?: string): { open: number; next?: { todo: Todo; due: string } } {
  const open = (e.todos ?? []).filter((td) => !td.done).map((todo) => ({ todo, due: todo.due ?? fallbackDue })).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return { open: open.length, next: (today ? open.find((r) => r.due >= today) : undefined) ?? open[0] };
}
