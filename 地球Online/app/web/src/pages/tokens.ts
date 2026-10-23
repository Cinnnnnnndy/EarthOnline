/** 色卡与字阶（#/tokens）：设计令牌的活页。颜色、字阶、间距、玻璃都从 shared/world/tokens.ts 读，改一处全局跟着变。
 *  颜色的名字与用途、字阶的说明都在消息表里（color.* / role.* / tokens.*），字体说明跟着界面语言的字体栈走。 */
import { h } from "../ui.ts";
import { go } from "../router.ts";
import { COLOR, WORLD, HERO, TYPE, SPACE, RADIUS } from "../../../shared/world/tokens.ts";
import { t, CATALOGS, type MsgKey } from "../../../shared/i18n/index.ts";

const has = (k: string): k is MsgKey => k in CATALOGS["zh-Hans"];
const colorName = (k: string) => (has(`color.${k}`) ? t(`color.${k}` as MsgKey) : k);
const colorRole = (k: string) => (has(`role.${k}`) ? t(`role.${k}` as MsgKey) : "");

export function TokensPage(_p: Record<string, string>, root: HTMLElement) {
  const sw = (hex: string, name: string, role: string) => h("div", { class: "tk-sw" }, h("i", { style: { background: hex } }), h("div", {}, h("b", {}, name), h("span", { class: "t-caption num" }, hex), h("span", { class: "t-caption" }, role)));
  const rgb = (c: readonly number[]) => `rgb(${c.join(",")})`;
  const page = h("div", { class: "tk" },
    h("div", { class: "tk-nav" }, h("button", { type: "button", class: "tbtn", onclick: () => go("/settings") }, `‹ ${t("common.settings")}`), h("h1", { class: "t-headline" }, t("settings.tokens"))),
    h("section", {}, h("h2", { class: "t-title" }, t("tokens.ui")), h("p", { class: "t-sub" }, t("tokens.uiNote")),
      h("div", { class: "tk-grid" }, Object.entries(COLOR).map(([k, v]) => sw(v, colorName(k), colorRole(k))))),
    h("section", {}, h("h2", { class: "t-title" }, t("tokens.world")), h("p", { class: "t-sub" }, t("tokens.worldNote")),
      h("div", { class: "tk-grid" }, Object.entries(WORLD).map(([k, v]) => sw(v, k, "")), Object.entries(HERO).map(([k, v]) => sw(rgb(v), t("tokens.hero", { k }), "")))),
    h("section", {}, h("h2", { class: "t-title" }, t("tokens.type")), h("p", { class: "t-sub" }, t("tokens.typeNote")),
      h("div", { class: "list" }, ([["title", "tokens.tTitle"], ["headline", "tokens.tHeadline"], ["body", "tokens.tBody"], ["sub", "tokens.tSub"], ["caption", "tokens.tCaption"]] as const).map(([k, key]) => { const [s, l, w] = TYPE[k];
        return h("div", { class: "row", style: { cursor: "default" } }, h("span", { class: "main" }, h("span", { style: { fontSize: `${s}px`, lineHeight: `${l}px`, fontWeight: String(w) } }, t("tokens.sample"))), h("span", { class: "trail num" }, `${t(key)} ${s}/${w}`)); }))),
    h("section", {}, h("h2", { class: "t-title" }, t("tokens.spacing")), h("p", { class: "t-sub num" }, t("tokens.spacingValue", { space: Object.values(SPACE).join(" / "), touch: SPACE.touch, radius: Object.values(RADIUS).filter((x) => x < 100).join(" / ") }))),
    h("section", {}, h("h2", { class: "t-title" }, t("tokens.material")), h("div", { class: "tk-glass" }, h("div", { class: "lg strong tk-card" }, h("b", { class: "t-headline" }, t("tokens.glass")), h("span", { class: "t-sub" }, t("tokens.glassNote"))))));
  root.append(page);
  return { leave: () => {} };
}
