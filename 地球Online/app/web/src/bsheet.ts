/** 底部抽屉（像「地图」App 的卡片）：抓手 + 标题区 + 可滚动内容 + 底部固定按钮区。
 *  紧凑形态（手机 / 折叠外屏）贴底，有「半开 / 全开」两档，拖抓手或标题区切换；展开形态（阔折叠内屏）停靠成左页。
 *  onLayout 告诉世界层「被挡住了多少」，地球 / 浮岛把视觉中心挪到露出来的那块。 */
import { h } from "./ui.ts";
import { shape, onShape, layout, paneInsets } from "./shape.ts";
import { t } from "../../shared/i18n/index.ts";

export type Detent = "peek" | "full";
export interface Insets { left: number; bottom: number; right?: number; top?: number }
export interface BSheet { el: HTMLElement; head: HTMLElement; body: HTMLElement; foot: HTMLElement; detent: Detent; set(d: Detent): void; relayout(): void; refit(): void; destroy(): void }

/** fit = 抽屉按内容定高（不超过半开 / 全开的上限）：内容少就矮，只有内容放不下时才能拖到全开 */
export function bottomSheet(o: { peek?: number; fit?: boolean; onLayout?: (i: Insets) => void; onDetent?: (d: Detent) => void } = {}): BSheet {
  const grab = h("button", { type: "button", class: "grab", "aria-label": t("sheet.toggle") });
  const head = h("div", { class: "sh-head" }); const body = h("div", { class: "sh-body" }); const foot = h("div", { class: "sh-foot" });
  const el = h("section", { class: "bsheet lg strong" + (o.fit ? " fit" : ""), role: "region" }, grab, head, body, foot);
  const safeTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat") || "0") || 0;
  const natural = () => grab.offsetHeight + head.offsetHeight + body.scrollHeight + foot.offsetHeight + 2;
  const heights = () => {
    if (shape() === "hover") { const l = layout(); const hh = l.panes[1].w - 16; return { peek: hh, full: hh }; }   // 悬停：抽屉就是下半屏
    const H = innerHeight; const short = H < 700;                     // 折叠外屏 / 横持手机：半开要高一点才放得下标题与一行内容
    const peek = Math.round(H * (o.peek ?? (short ? 0.46 : 0.4))), full = Math.round(H - safeTop() - 64);
    if (!o.fit) return { peek, full };
    const n = natural(); return { peek: Math.min(n, peek), full: Math.min(n, full) };
  };
  const api: BSheet = {
    el, head, body, foot, detent: "peek",
    set(d) { api.detent = d; el.dataset.detent = d; if (shape() === "compact" || shape() === "hover") el.style.setProperty("--sheet-h", `${heights()[d]}px`); o.onDetent?.(d); setTimeout(report, 360); },
    relayout() { if (shape() === "compact" || shape() === "hover") el.style.setProperty("--sheet-h", `${heights()[api.detent]}px`); else el.style.removeProperty("--sheet-h"); report(); },
    refit() { if (o.fit) requestAnimationFrame(() => api.relayout()); },
    destroy() { off(); removeEventListener("resize", onResize); el.remove(); },
  };
  function report() {
    if (!el.isConnected || el.hidden) return; const r = el.getBoundingClientRect();
    const s = shape();
    if (s === "spread" || s === "triple") { const p = paneInsets(); o.onLayout?.({ ...p, left: Math.max(r.right + 8, p.left) }); }   // 两页：世界在右页；三页：世界在中页（左右都让）
    else o.onLayout?.({ left: 0, bottom: Math.max(0, innerHeight - r.top) });   // 一页 / 悬停：抽屉顶边以下都算挡住
  }
  // 拖动：抓手与标题区都能拖；轻点抓手在两档之间切换
  let y0 = 0, h0 = 0, moved = 0, t0 = 0;
  const down = (e: PointerEvent) => {
    if (shape() !== "compact" || (e.target as HTMLElement).closest("button:not(.grab),input,a")) return;
    y0 = e.clientY; h0 = el.getBoundingClientRect().height; moved = 0; t0 = performance.now(); el.classList.add("dragging"); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => { if (!el.classList.contains("dragging")) return; const dy = e.clientY - y0; moved = Math.max(moved, Math.abs(dy)); const { peek, full } = heights(); el.style.setProperty("--sheet-h", `${Math.max(peek * 0.6, Math.min(full, h0 - dy))}px`); };
  const up = (e: PointerEvent) => {
    if (!el.classList.contains("dragging")) return; el.classList.remove("dragging");
    const dy = e.clientY - y0; const v = dy / Math.max(1, performance.now() - t0);
    if (moved < 6) { if ((e.target as HTMLElement).closest(".grab")) api.set(api.detent === "peek" ? "full" : "peek"); else api.set(api.detent); return; }
    const { peek, full } = heights(); const hNow = h0 - dy;
    api.set(v < -0.4 ? "full" : v > 0.4 ? "peek" : hNow > (peek + full) / 2 ? "full" : "peek");
  };
  for (const t of [grab, head]) { t.addEventListener("pointerdown", down as EventListener); t.addEventListener("pointermove", move as EventListener); t.addEventListener("pointerup", up as EventListener); t.addEventListener("pointercancel", up as EventListener); }
  const onResize = () => api.relayout(); addEventListener("resize", onResize);
  const off = onShape(() => api.relayout());
  requestAnimationFrame(() => { api.set("peek"); });
  return api;
}
