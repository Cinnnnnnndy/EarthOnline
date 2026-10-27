/** 捏人（第八轮精简）：名字、发型与帽子用分段控件、五排色块；没有说明段。世界里的小人实时变 */
import { h, sheet, field } from "./ui.ts";
import { store } from "./store.ts";
import { SKIN_COLORS, HAIR_COLORS, DRESS_COLORS, HAT_COLORS, SHOE_COLORS } from "../../shared/world/hero.ts";
import { hex, type RGB } from "../../shared/world/style.ts";
import { AVATAR_FORMS, type Avatar } from "../../shared/spec/types.ts";
import { t, type MsgKey } from "../../shared/i18n/index.ts";
import { icon } from "../../shared/world/icons.ts";
import { ItemIcons } from "../../shared/world/item-icons.ts";
import { isMascotForm } from "../../shared/world/mascot.ts";
import { AVATAR_PRESETS, applyPreset } from "../../shared/world/avatar-presets.ts";

/** 形态格子的图标渲染器（第一次打开捏人面板时才建；内存与 IndexedDB 都缓存） */
let _formIcons: ItemIcons | null = null;
const formIcons = () => (_formIcons ??= new ItemIcons({ size: 72, pixelRatio: 2 }));

export function openAvatarSheet(onChange?: (a: Avatar) => void) {
  const apply = (p: Partial<Avatar>) => { store.setAvatar(p); onChange?.(store.avatar); };
  const swatches = (colors: RGB[], key: keyof Avatar, part: string) => {
    const box = h("div", { class: "swatches" });
    colors.forEach((c, i) => box.appendChild(h("button", { type: "button", class: "swatch" + (store.avatar[key] === i ? " on" : ""), style: { background: hex(c) }, "aria-label": t("avatar.swatch", { part, n: i + 1 }), onclick: () => { apply({ [key]: i } as Partial<Avatar>); box.querySelectorAll(".swatch").forEach((b, j) => b.classList.toggle("on", j === i)); } })));
    return box;
  };
  /** 分段控件（和设置页同一种）：未选是浅填充，选中是白块 */
  const seg = <T extends string>(opts: [T, string][], cur: T, set: (v: T) => void) => {
    const el = h("div", { class: "seg", role: "radiogroup" });
    const draw = () => el.replaceChildren(...opts.map(([v, label]) => h("button", { type: "button", role: "radio", "aria-checked": String(v === cur), class: v === cur ? "on" : "", onclick: () => { cur = v; set(v); draw(); } }, label)));
    draw(); return el;
  };
  const name = h("input", { value: store.avatar.name, maxlength: 12, placeholder: t("avatar.name"), "aria-label": t("avatar.name"), oninput: () => apply({ name: name.value.trim() || t("avatar.defaultName") }) });
  const sw = (label: string, colors: RGB[], key: keyof Avatar) => field(label, swatches(colors, key, label));
  // 形态（D86 / D94）：一格一格的小图（物件图标同一套渲染：离屏、好角度、透明底、脚下影子），下面是名字；小人用图标
  const forms = () => {
    const el = h("div", { class: "form-grid", role: "radiogroup", "aria-label": t("avatar.form") });
    const tiles = new Map<string, HTMLElement>();
    const cur = () => store.avatar.form ?? "human";
    for (const f of AVATAR_FORMS) {
      const pic = h("span", { class: "pic", html: f === "human" ? icon("person", 26) : "" });
      const b = h("button", { type: "button", role: "radio", class: "form-tile" + (cur() === f ? " on" : ""), "aria-checked": String(cur() === f), onclick: () => { apply({ form: f }); for (const [k, x] of tiles) { x.classList.toggle("on", k === f); x.setAttribute("aria-checked", String(k === f)); } } },
        pic, h("span", { class: "nm" }, t(`avatar.form.${f}` as MsgKey)));
      tiles.set(f, b); el.append(b);
      if (f !== "human" && isMascotForm(f)) { const ref = { type: "form" as const, form: f }; const hit = formIcons().peek(ref); if (hit) pic.append(h("img", { src: hit, alt: "" })); else void formIcons().get(ref).then((u) => pic.replaceChildren(h("img", { src: u, alt: "" }))).catch(() => undefined); }
    }
    return el;
  };
  // 默认形象（D101）：小王、小伍、福贵；点一下整套换上，再把下面的控件按新值重画
  const presets = () => h("div", { class: "form-grid", role: "group", "aria-label": t("avatar.presets") }, ...AVATAR_PRESETS.map((p) => {
    const pic = h("span", { class: "pic", html: p.avatar.form ? "" : icon("person", 26) });
    if (p.avatar.form && isMascotForm(p.avatar.form)) { const ref = { type: "form" as const, form: p.avatar.form }; const hit = formIcons().peek(ref); if (hit) pic.append(h("img", { src: hit, alt: "" })); else void formIcons().get(ref).then((u) => pic.replaceChildren(h("img", { src: u, alt: "" }))).catch(() => undefined); }
    return h("button", { type: "button", class: "form-tile", onclick: () => { apply(applyPreset(store.avatar, p)); name.value = store.avatar.name; render(); } }, pic, h("span", { class: "nm" }, p.avatar.name));
  }));
  const body = h("div", { class: "col" });
  const render = () => body.replaceChildren(
    name,
    field(t("avatar.presets"), presets()),
    field(t("avatar.form"), forms()),
    field(t("avatar.hair"), seg<Avatar["hair"]>([["bun", t("avatar.hairBun")], ["long", t("avatar.hairLong")], ["short", t("avatar.hairShort")]], store.avatar.hair, (v) => apply({ hair: v }))),
    field(t("avatar.hat"), seg<Avatar["hat"]>([["straw", t("avatar.hatStraw")], ["cap", t("avatar.hatCap")], ["none", t("avatar.hatNone")]], store.avatar.hat, (v) => apply({ hat: v }))),
    sw(t("avatar.skin"), SKIN_COLORS, "skin"), sw(t("avatar.hairColor"), HAIR_COLORS, "hairColor"), sw(t("avatar.dress"), DRESS_COLORS, "dress"),
    sw(t("avatar.hatColor"), HAT_COLORS, "hatColor"), sw(t("avatar.shoes"), SHOE_COLORS, "shoes"),
    field(t("avatar.glasses"), seg<"off" | "on">([["off", t("avatar.hatNone")], ["on", t("avatar.glassesOn")]], store.avatar.glasses ? "on" : "off", (v) => apply({ glasses: v === "on" }))));
  render();
  return sheet(t("avatar.title"), body);
}
