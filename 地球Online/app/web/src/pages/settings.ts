/** 设置：iOS「设置」式的分组列表。外观（天色 / 色调 / 画质）与语言用分段控件，其余是带箭头的行。
 *  换语言：存下设置后重新载入页面（界面文字、字体栈、<html lang> 都在启动时按语言定）。 */
import { h, toast, sheet } from "../ui.ts";
import { store } from "../store.ts";
import { go } from "../router.ts";
import { openAvatarSheet } from "../avatar-sheet.ts";
import { openFootprints } from "../footprints-ui.ts";
import { applyTheme } from "../theme.ts";
import { icon } from "../../../shared/world/icons.ts";
import type { Palette, PostLevel, Settings } from "../../../shared/spec/types.ts";
import { t, CATALOGS, type MsgKey } from "../../../shared/i18n/index.ts";
import { canAddTrip, tripSlots } from "../quota.ts";
import { openPaywall } from "../paywall.ts";

export function SettingsPage(_p: Record<string, string>, root: HTMLElement) {
  const seg = <T extends string>(opts: [T, string][], cur: T, set: (v: T) => void) => {
    const el = h("div", { class: "seg", role: "radiogroup" }, opts.map(([v, label]) => h("button", { type: "button", role: "radio", "aria-checked": String(v === cur), class: v === cur ? "on" : "", onclick: () => { set(v); render(); } }, label)));
    return el;
  };
  const row = (lead: string, title: string, trail: string | HTMLElement, onclick: () => void, cls = "") =>
    h("button", { type: "button", class: `row ${cls}`, onclick }, h("span", { class: `lead${cls === "danger" ? " warn" : ""}`, html: icon(lead, 16) }), h("span", { class: "main" }, h("span", { class: "tt" }, title)), h("span", { class: "trail" }, trail, cls === "danger" ? "" : h("span", { html: icon("chev", 14, "chev") })));
  /** 示例行程库（web/public/assets/samples/trips）：各种类型的行程，点一本加进来 */
  async function openSamples() {
    const base = import.meta.env.BASE_URL + "assets/samples/trips/";
    const index = (await fetch(base + "index.json").then((r) => r.json()).catch(() => [])) as { id: string; file: string; title: string; blurb: string; type: string }[];
    const typeTag = (ty: string) => { const k = `sample.type.${ty}`; return k in CATALOGS["zh-Hans"] ? h("span", { class: "tg" }, t(k as MsgKey)) : null; };
    const has = (id: string) => store.trips.some((x) => x.id === id);
    const add = async (it: { file: string }) => { const raw = await fetch(base + it.file).then((r) => r.json()); return store.importTrip(raw); };
    const list = h("div", { class: "list" });
    const draw = () => list.replaceChildren(...index.map((it) => h("button", { type: "button", class: "row", disabled: has(it.id), onclick: async () => { if (!canAddTrip()) return openPaywall("trips"); await add(it); toast(t("settings.sampleAdded")); draw(); } },
      h("span", { class: "main" }, h("span", { class: "tt" }, it.title), h("span", { class: "tgs", style: { marginTop: "2px" } }, typeTag(it.type))),   // i18n-ok：示例内容是数据；类型用标签
      h("span", { class: "trail" }, has(it.id) ? t("settings.sampleAdded") : h("span", { class: "icw", html: icon("plus", 18) })))));
    draw();
    const all = h("button", { type: "button", class: "btn glass", onclick: async () => { for (const it of index) { if (has(it.id)) continue; if (!canAddTrip()) { draw(); return openPaywall("trips"); } await add(it); } toast(t("settings.sampleAdded")); draw(); } }, t("settings.sampleAddAll"));
    sheet(t("settings.samples"), h("div", { class: "col" }, list, h("div", { class: "btn-row" }, all)));
  }
  function render() {
    const s = store.settings;
    const lang = s.lang ?? "auto";
    const setLang = (v: NonNullable<Settings["lang"]>) => { if (v === lang) return; store.setSettings({ lang: v }); location.reload(); };
    root.replaceChildren(h("div", { class: "spg" },
      h("header", { class: "navbar" }, h("button", { type: "button", class: "tbtn", onclick: () => go("/") }, h("span", { html: icon("back", 18) }), t("settings.globe")), h("h1", { class: "t-headline" }, t("common.settings")), h("span", {})),
      h("section", { class: "group" }, h("div", { class: "gh" }, t("settings.sky")),
        h("div", { class: "list pad" }, seg([["auto", t("settings.auto")], ["light", t("settings.day")], ["dark", t("settings.night")]], s.theme, (v) => { store.setSettings({ theme: v }); applyTheme(); }))),
      h("section", { class: "group" }, h("div", { class: "gh" }, t("settings.palette")),
        h("div", { class: "list pad" }, seg<Palette>([["sea", t("settings.palSea")], ["warm", t("settings.palWarm")], ["dusk", t("settings.palDusk")]], s.palette, (v) => { store.setSettings({ palette: v }); applyTheme(); }))),
      h("section", { class: "group" }, h("div", { class: "gh" }, t("settings.quality")),
        h("div", { class: "list pad" }, seg<PostLevel>([["high", t("post.high")], ["medium", t("post.medium")], ["low", t("settings.qLow")]], s.post, (v) => store.setSettings({ post: v })))),
      // 语言：语言名用各自的写法（简体中文 / English / 日本語），不随界面语言翻译
      h("section", { class: "group" }, h("div", { class: "gh" }, t("settings.language")),
        h("div", { class: "list pad" }, seg<NonNullable<Settings["lang"]>>([["auto", t("settings.auto")], ["zh-Hans", t("lang.zh-Hans")], ["en", t("lang.en")], ["ja", t("lang.ja")]], lang, setLang))),
      h("section", { class: "group" },
        h("div", { class: "list" },
          row("person", t("settings.avatar"), store.avatar.name, () => openAvatarSheet()),
          row("flag", t("home.footprints"), store.home?.name ?? t("settings.notSet"), () => openFootprints(render, "home")),
          row("book", t("settings.listOnly"), t("settings.noGlobe"), () => go("/shelf")))),
      h("section", { class: "group" },
        h("div", { class: "list" },
          row("import", t("settings.exportAll"), "JSON", () => { const blob = new Blob([JSON.stringify(store.trips, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = t("settings.exportFile"); a.click(); }),
          row("sparkle", t("settings.samples"), t("settings.samplesTrail"), () => openSamples()),
          // 套餐：免费版显示「行程 2 / 3」，点开付费页看 Pro 有什么（网页版不收款）
          row("star", t("settings.pro"), h("span", { class: "tg" }, store.entitlement.plan === "pro" ? t("settings.proOn") : t("settings.proTrips", { used: tripSlots().used, limit: tripSlots().limit })), () => { if (store.entitlement.plan !== "pro") openPaywall("trips"); }),
          row("palette", t("settings.tokens"), "", () => go("/tokens")),
          row("trash", t("settings.reset"), "", () => { if (confirm(t("settings.resetConfirm"))) { store.resetToSample(); toast(t("settings.resetDone")); render(); } }, "danger"))),
      h("p", { class: "gf center" }, t("settings.localOnly"))));
  }
  render();
  return { leave: () => {} };
}
