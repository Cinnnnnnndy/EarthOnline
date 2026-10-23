/** 小而够用的 DOM 工具 */
import { t, format, fullDate, fullDateRange, getLocale, CATALOGS, type MsgKey, type Vars } from "../../shared/i18n/index.ts";
import { icon } from "../../shared/world/icons.ts";

type Child = Node | string | null | undefined | false | Child[];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = String(v); else if (k === "html") el.innerHTML = String(v);
    else if (k === "value") (el as HTMLInputElement).value = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v); else if (k in el && typeof v !== "string") (el as unknown as Record<string, unknown>)[k] = v; else el.setAttribute(k, String(v));
  }
  const push = (c: Child) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(push); else el.append(c as Node | string); };
  children.forEach(push); return el;
}
export function toast(text: string, action?: { label: string; onClick: () => void }, ms = 2600) {
  let host = document.getElementById("toast-host"); if (!host) { host = h("div", { id: "toast-host", class: "toast-host", role: "status", "aria-live": "polite" }); document.body.appendChild(host); }
  const el = h("div", { class: "toast" }, h("span", {}, text), action ? h("button", { type: "button", class: "link", onclick: () => { action.onClick(); el.remove(); } }, action.label) : null);
  host.appendChild(el); setTimeout(() => el.classList.add("show"), 10); setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, ms);
}
export function sheet(title: string, body: HTMLElement, opts: { onClose?: () => void; wide?: boolean } = {}) {
  const close = () => { wrap.classList.add("closing"); setTimeout(() => wrap.remove(), 200); opts.onClose?.(); };
  const wrap = h("div", { class: "sheet-wrap", onclick: (e: Event) => { if (e.target === wrap) close(); } },
    h("div", { class: "sheet" + (opts.wide ? " wide" : ""), role: "dialog", "aria-label": title },
      h("header", {}, h("h3", {}, title), h("button", { type: "button", class: "icon", "aria-label": t("common.close"), onclick: close, html: icon("close", 16) })), body));
  document.body.appendChild(wrap); wrap.classList.add("show");
  return { close, el: wrap };
}
export function field(label: string, input: HTMLElement, hint?: string) { return h("label", { class: "field" }, h("span", { class: "lbl" }, label), input, hint ? h("span", { class: "hint" }, hint) : null); }
export function select(options: { value: string; label: string }[], value: string, onChange: (v: string) => void) {
  const s = h("select", { onchange: () => onChange(s.value) }, options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label))); return s;
}
/** 带年份的日期与区间，按界面语言（2026.10.03 / Oct 3, 2026） */
export function fmtDate(iso: string) { return fullDate(iso); }
export function dateRange(a: string, b: string) { return fullDateRange(a, b); }
/** t() 的一句话拆成节点，{var} 的值加粗：「<b>3</b> 个地方」/「<b>3</b> places」——数字加粗、量词跟着语言走 */
export function tBold(key: MsgKey, vars: Vars): (Node | string)[] {
  return CATALOGS[getLocale()][key].split(/(\{\w+\})/).filter(Boolean).map((part) => { const m = part.match(/^\{(\w+)\}$/); return m && m[1] in vars ? h("b", {}, String(vars[m[1]])) : format(part, vars); });
}
