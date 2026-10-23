/** 票（第八轮末，判断 D74）：每一趟旅程都是一张票。白底黑字的纸票：四角与撕线的上下各有一个缺口，右边一截票根隔着一条虚线。
 *  票面（文字要少）：一行印章式的小字「地球ONLINE · No. 0007」加状态标签；大标题是地点，加粗；底下一行小字是书名与日期（旅行中换成今天）；
 *  票根竖着印一行（凭票进入 / 7 天），底下一个很淡的年份水印。
 *  点票面 = 翻开这本书；撕票根 = 进入这一刻该去的地方（tearAndGo 先放撕的动画再走）。iOS 的 TicketView 是同一张票。
 *  票是物件，不是界面：票号、日期这类数字与拉丁用等宽、大写、字距，这些在界面文案里仍然不用；汉字一律还是正文字体，不拿英文字体配汉字。 */
import { h } from "./ui.ts";
import { paintTicket } from "./backdrop-paint.ts";
import { t, days, plain, plainNames, fullDateRange as span } from "../../shared/i18n/index.ts";
import type { Trip } from "../../shared/spec/types.ts";

export interface TicketOpts {
  /** 状态标签（旅行中第 8 天 / 后天出发 / 计划中） */
  status?: { text: string; live?: boolean };
  /** 大标题下面的一行；默认「书名 · 日期」 */
  lines?: (string | HTMLElement | null)[];
  /** 列表里的小票：矮一截，票根印天数 */
  compact?: boolean;
  /** 票根上竖着印的字；默认「凭票进入」，小票默认天数 */
  stubLabel?: string;
  onFace?: () => void;
  onStub?: () => void;
}

/** 两段文字算不算重复：去掉标点后一个包含另一个，或共用任意一个 2 字以上的词（按标点与空格切） */
export function dup(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[\s·、，,+＋\-–—/／()（）]/g, "");
  const na = norm(a), nb = norm(b); if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const words = (s: string) => s.split(/[\s·、，,+＋\-–—/／()（）]+/).filter((w) => w.length >= 2);
  const wb = new Set(words(b)); return words(a).some((w) => wb.has(w));
}
export const serial = (trip: Trip) => t("ticket.serial", { n: String(Math.abs(trip.seed) % 10000).padStart(4, "0") });

export function ticket(trip: Trip, o: TicketOpts = {}): HTMLElement {
  const nDays = trip.days.length;
  const place = plainNames(trip.destination) || plain(trip.title);
  // 书名和地点重复（「冰岛 + 北欧」对「冰岛、丹麦、挪威」）就只写日期；不重复才把书名写在前面
  const lines = o.lines ?? [[dup(plain(trip.title), place) ? "" : plain(trip.title), span(trip.startDate, trip.endDate)].filter(Boolean).join(" · ")];
  const face = h("button", { type: "button", class: "tk-face", onclick: () => o.onFace?.(), "aria-label": t("ticket.open", { title: plain(trip.title) }) },
    // 印章行：品牌用正文字体（汉字），票号用等宽；大票带状态标签时只印票号（一行放不下两样）
    h("span", { class: "tk-stamp" }, h("span", { class: "tk-id" }, o.status && !o.compact ? null : h("span", { class: "tk-brand" }, t("app.name")), h("span", { class: "tk-mono" }, serial(trip))),
      o.status ? h("span", { class: "tg" + (o.status.live ? " live" : "") }, o.status.text) : null),
    h("span", { class: "tk-title" }, place),
    ...lines.filter(Boolean).map((l) => h("span", { class: "tk-line" }, l as string | HTMLElement)));
  const stubText = o.stubLabel ?? (o.compact ? days(nDays) : t("ticket.admit"));
  const stub = h("button", { type: "button", class: "tk-stub", "aria-label": stubText, onclick: () => o.onStub?.() },
    h("span", { class: "tk-stub-in" }, h("span", { class: "tk-wm", "aria-hidden": "true" }, trip.startDate.slice(0, 4)), h("span", { class: "tk-vert" }, stubText)));
  if (!o.onStub) { stub.disabled = true; stub.removeAttribute("aria-label"); stub.setAttribute("aria-hidden", "true"); }
  const paper = h("div", { class: "tk-paper" }, face, stub);
  paper.style.backgroundImage = `url(${paintTicket(trip.seed)})`;
  return h("section", { class: "ticket" + (o.compact ? " compact" : ""), "data-trip": trip.id }, paper);
}

/** 撕票根：先放动画（尊重「减弱动态效果」），再做事 */
export function tearAndGo(el: HTMLElement, fn: () => void) {
  const tk = el.closest(".ticket") ?? el;
  if (tk.classList.contains("tear")) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { fn(); return; }
  tk.classList.add("tear"); setTimeout(fn, 420);
}
