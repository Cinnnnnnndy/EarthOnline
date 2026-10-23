/** 待办的界面（第八轮）：站点详情里的「待办」块（每行一件 + 添加行）。提示跟着站点走：书里的站点行、某一天的条目上有数量标签与最近一件。
 *  规则与排序在 shared/algo/todos.ts。每行：勾选（图标）、文字（做完划掉）、到期日标签、删除（图标）。 */
import { h, sheet } from "./ui.ts";
import { store } from "./store.ts";
import { icon } from "../../shared/world/icons.ts";
import { t, monthDay, type MsgKey } from "../../shared/i18n/index.ts";
import { allTodos, dueFromLead, LEAD_DAYS, type TodoRef } from "../../shared/algo/todos.ts";
import type { Trip } from "../../shared/spec/types.ts";

const ibtn = (ic: string, label: string, fn: () => void, cls = "plain") =>
  h("button", { type: "button", class: `ibtn ${cls}`, "aria-label": label, title: label, html: icon(ic, 18), onclick: fn });

/** 一行待办 */
export function todoRow(r: TodoRef, onChange: () => void): HTMLElement {
  const done = !!r.todo.done;
  return h("div", { class: "row todo-row", style: { cursor: "default" } },
    ibtn(done ? "checkCircle" : "circle", t("todo.done"), () => { store.setTodo(r.tripId, r.dayIndex, r.entryId, r.todo.id, { done: !done }); onChange(); }, done ? "plain on" : "plain"),
    h("span", { class: "main" }, h("span", { class: "tt" + (done ? " done" : "") }, r.todo.text)),
    h("span", { class: "tg num" }, t("todo.due", { date: monthDay(r.due) })),
    ibtn("close", t("todo.remove"), () => { store.removeTodo(r.tripId, r.dayIndex, r.entryId, r.todo.id); onChange(); }));
}

/** 站点的待办块：每行一件、最后一行是添加（文字 + 提前几天 + 加号）。放在自己的抽屉里（openPlaceTodos），站点详情只留一行入口 */
export function todoSection(trip: Trip, dayIndex: number, entryId: string, onChange: () => void): HTMLElement {
  const box = h("div", { class: "group", style: { margin: "0" } });
  const draw = () => {
    const cur = store.trip(trip.id) ?? trip;
    const rows = allTodos(cur).filter((r) => r.dayIndex === dayIndex && r.entryId === entryId);
    const input = h("input", { placeholder: t("todo.placeholder"), maxlength: 60, enterkeyhint: "done", "aria-label": t("todo.add") });
    const lead = h("select", { "aria-label": t("todo.add") }, LEAD_DAYS.map((d) => h("option", { value: String(d) }, t(`todo.lead${d}` as MsgKey))));
    const add = () => { const text = input.value.trim(); if (!text) return; store.addTodo(trip.id, dayIndex, entryId, { text, due: dueFromLead(cur.days[dayIndex].date, Number(lead.value)) }); draw(); onChange(); };
    input.onkeydown = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); add(); } };
    box.replaceChildren(
      h("div", { class: "list", style: { "--sep-left": "54px" } },
        rows.map((r) => todoRow(r, () => { draw(); onChange(); })),
        h("div", { class: "row todo-add", style: { cursor: "default" } }, input, lead, ibtn("plus", t("todo.add"), add, "fill"))));
  };
  draw(); return box;
}

/** 站点的待办抽屉（第八轮续：待办不默认摊在站点详情里，点那一行进来看）。关掉时回调一次，让入口行更新数量 */
export function openPlaceTodos(trip: Trip, dayIndex: number, entryId: string, onChange: () => void) {
  return sheet(t("todo.title"), h("div", { class: "col" }, todoSection(trip, dayIndex, entryId, onChange)), { onClose: onChange });
}
