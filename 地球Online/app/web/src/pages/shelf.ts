/** 全部旅程（只看列表，不显示地球）：给低配手机与读屏用；新建旅程在地球上做 */
import { h, toast, dateRange } from "../ui.ts";
import { store } from "../store.ts";
import { go } from "../router.ts";
import { deriveWorldSpec, coverColors } from "../../../shared/algo/world-spec.ts";
import type { Trip } from "../../../shared/spec/types.ts";
import { icon } from "../../../shared/world/icons.ts";
import { t } from "../../../shared/i18n/index.ts";
import { withTripSlot } from "../quota.ts";
import { ticket } from "../ticket.ts";

export function coverStyle(trip: Trip) { const c = coverColors(deriveWorldSpec(trip)); return { "--cover-a": c.a, "--cover-b": c.b, "--cover-c": c.c, "--cover-title": c.title, "--cover-sub": c.sub } as Record<string, string>; }
const statusName = (s: Trip["status"]) => t(`shelf.${s}`);

export function ShelfPage(_p: Record<string, string>, root: HTMLElement) {
  const render = () => {
    const trips = store.trips;
    root.replaceChildren(h("div", { class: "spg" },
      h("header", { class: "navbar" }, h("button", { type: "button", class: "tbtn", onclick: () => go("/settings") }, h("span", { html: icon("back", 18) }), t("common.settings")), h("h1", { class: "t-headline" }, t("home.allTrips")),
        h("button", { type: "button", class: "ibtn", "aria-label": t("common.import"), title: t("common.import"), html: icon("import", 16), onclick: () => importFile() })),
      // 每一趟旅程都是一张票（D74）：一摞小票；长按（右键）删除
      h("div", { class: "tk-stack" }, trips.map((x) => { const tk = ticket(x, { compact: true, status: { text: statusName(x.status), live: x.status === "traveling" }, onFace: () => go(`/book/${x.id}`) });
        tk.oncontextmenu = (e: Event) => { e.preventDefault(); menu(x); }; return tk; })),
    ));
  };
  const menu = (x: Trip) => { if (confirm(t("shelf.deleteConfirm", { title: x.title }))) { store.deleteTrip(x.id); toast(t("shelf.deleted")); } };
  const importFile = () => { const inp = h("input", { type: "file", accept: "application/json" }); inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; try { let raw: unknown; try { raw = JSON.parse(await f.text()); } catch { throw new Error(t("common.importInvalid")); } withTripSlot(() => { const nt = store.importTrip(raw); toast(t("shelf.imported", { title: nt.title })); }); } catch (e) { toast(t("common.importFailed", { reason: (e as Error).message })); } }; inp.click(); };
  render(); const off = store.subscribe(render); return { leave: off };
}
