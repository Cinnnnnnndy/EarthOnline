/** 付费页：碰到免费版的限制时弹出的一张液态玻璃卡片（贴着内容长高，不是全屏）。
 *
 *    import { openPaywall } from "./paywall.ts";
 *    if (!canCreateTrip(plan, store.trips)) openPaywall("trips", { onUpgrade: (id) => native.buy(id) });
 *
 *  - reason：碰到的限制。认得的键（trips / ai / sync / export / pack.landmarks / pack.outfits）换成一句当前语言的说明；
 *    其他字符串原样显示（调用方自己写好的一句话）。
 *  - 第八轮精简：一句话说清楚碰到了什么 → 四行 Pro 权益（每行一句，和限制对应的那条排第一）→ 按月 / 按年二选一（默认按年）
 *    → 墨色小胶囊主按钮 → 一行小字 → 「以后再说」。没有蓝色填充。
 *  - 网页参考应用不收款：点主按钮只回调 onUpgrade(商品 id) 然后关掉；没给回调时提示一句「网页版不收款」。
 *    真实 App 里由 StoreKit 2 / 鸿蒙 IAP Kit 付款，价格用商店返回的本地化价格替换这里的建议价。
 *  - 用 ui.ts 的 sheet()（遮罩、关闭按钮、点遮罩关闭）；样式只在 paywall.css，颜色和字号都用 tokens.ts 注入的变量。
 *  - 文案在 shared/i18n 的 pay.* 键里（守门测试 no-hardcoded 已覆盖本文件）。 */
import "./paywall.css";
import { h, sheet, toast } from "./ui.ts";
import { icon } from "../../shared/world/icons.ts";
import { getLocale, t, type Locale, type MsgKey, type Vars } from "../../shared/i18n/index.ts";
import { PLANS, PRODUCT, PRODUCTS, yearlySaving, type Currency, type ProductId } from "../../shared/billing/plans.ts";

export type PaywallReason = "trips" | "ai" | "sync" | "export" | "pack.landmarks" | "pack.outfits";
type Benefit = "trips" | "ai" | "sync" | "extras";

const CURRENCY: Record<Locale, Currency> = { "zh-Hans": "CNY", en: "USD", ja: "JPY" };
const INTL: Record<Locale, string> = { "zh-Hans": "zh-CN", en: "en-US", ja: "ja-JP" };
const BENEFIT_ICON: Record<Benefit, string> = { trips: "book", ai: "mic", sync: "restart", extras: "star" };
const FIRST: Record<PaywallReason, Benefit> = { trips: "trips", ai: "ai", sync: "sync", export: "extras", "pack.landmarks": "extras", "pack.outfits": "extras" };

const isReason = (x: string): x is PaywallReason => Object.hasOwn(FIRST, x);
const tp = (k: string, vars?: Vars) => t(`pay.${k}` as MsgKey, vars);

/** 建议价的显示（真实 App 用商店返回的 displayPrice）。整数价不带小数；折算的月价：日元取整、人民币一位小数（¥7.3）、美元两位（$2.08） */
function money(amount: number, locale: Locale): string {
  const currency = CURRENCY[locale];
  const digits = currency === "JPY" || Number.isInteger(amount) ? 0 : currency === "CNY" ? 1 : 2;
  return new Intl.NumberFormat(INTL[locale], { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
}

/** 中文、日文按逗号句号分成小句，每句不从中间断行（「现在已 / 经满了」这种断法不好读）；英文按空格自然换行 */
const clauses = (text: string, locale: Locale): string[] => (locale === "en" ? [text] : text.split(/(?<=[，。、；])/).filter(Boolean));

let current: { close(): void } | null = null;

/** 打开付费页，返回 { close }。同时只开一张：再次打开会先关掉上一张 */
export function openPaywall(reason: string, opts: { onUpgrade?(productId: ProductId): void; onClose?(): void } = {}) {
  current?.close();

  const locale = getLocale(); const cur = CURRENCY[locale];
  const free = PLANS.free, pro = PLANS.pro;
  const monthly = PRODUCTS[PRODUCT.proMonthly], yearly = PRODUCTS[PRODUCT.proYearly];
  const pM = money(monthly.price[cur], locale), pY = money(yearly.price[cur], locale), pYm = money(yearly.price[cur] / 12, locale);
  const pct = Math.round(yearlySaving(cur) * 100);

  // 一句话：碰到了什么限制
  const whyText = isReason(reason) ? tp(`reason.${reason}`, { n: reason === "ai" ? free.aiPlansPerMonth : free.maxTrips }) : reason;
  const whyId = `pw-why-${Date.now().toString(36)}`;

  // 四行权益（每行一句）：和这次限制对应的那条排第一
  const order: Benefit[] = ["trips", "ai", "sync", "extras"];
  if (isReason(reason)) order.sort((a, b) => Number(b === FIRST[reason]) - Number(a === FIRST[reason]));
  const rows = order.map((k) => h("div", { class: "pw-row" + (isReason(reason) && FIRST[reason] === k ? " hit" : "") },
    h("span", { class: "pw-ic", html: icon(BENEFIT_ICON[k], 17) }),
    h("span", { class: "pw-tt" }, tp(`benefit.${k}`, { n: pro.aiPlansPerMonth }))));

  // 按月 / 按年：默认按年（有试用、更划算）
  let pick: ProductId = PRODUCT.proYearly;
  const opt = (id: ProductId, label: string, price: string, hint: string, tag?: string) =>
    h("button", { type: "button", class: "pw-opt", role: "radio", "data-id": id, onclick: () => choose(id) },
      h("span", { class: "k" }, label, tag ? h("span", { class: "tg live" }, tag) : null), h("span", { class: "p num" }, price), h("span", { class: "x num" }, hint));
  const optYear = opt(PRODUCT.proYearly, tp("year"), tp("perYear", { p: pY }), tp("yearHint", { p: pYm }), tp("save", { pct }));
  const optMonth = opt(PRODUCT.proMonthly, tp("month"), tp("perMonth", { p: pM }), tp("monthHint"));
  const seg = h("div", { class: "pw-seg", role: "radiogroup", "aria-label": tp("title"), onkeydown: (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); choose(pick === PRODUCT.proYearly ? PRODUCT.proMonthly : PRODUCT.proYearly); (pick === PRODUCT.proYearly ? optYear : optMonth).focus(); }
  } }, optYear, optMonth);

  const cta = h("button", { type: "button", class: "btn primary pw-cta", onclick: () => upgrade() });
  const fine = h("p", { class: "pw-fine" });
  const later = h("button", { type: "button", class: "pw-later", onclick: () => handle.close() }, tp("later"));

  function choose(id: ProductId) {
    pick = id;
    for (const b of [optYear, optMonth]) { const on = b.dataset.id === id; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; }
    const isYear = id === PRODUCT.proYearly;
    cta.textContent = isYear ? tp("ctaYear", { d: yearly.trialDays ?? 0 }) : tp("ctaMonth", { p: pM });
    fine.textContent = tp(isYear ? "fineYear" : "fineMonth", { p: isYear ? pY : pM });
  }
  function upgrade() {
    const id = pick; handle.close();
    if (opts.onUpgrade) opts.onUpgrade(id); else toast(tp("webOnly"));
  }
  choose(pick);

  const body = h("div", { class: "pw-body" },
    h("p", { class: "pw-why", id: whyId }, clauses(whyText, locale).map((x) => h("span", { class: "cl" }, x))),
    h("div", { class: "pw-list" }, rows),
    seg, cta, fine, later);

  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handle.close(); };
  let closed = false;
  const s = sheet(tp("title"), body, { onClose: () => { closed = true; removeEventListener("keydown", onKey); if (current === handle) current = null; opts.onClose?.(); } });
  const handle = { close: () => { if (!closed) s.close(); } };
  const card = s.el.querySelector<HTMLElement>(".sheet");
  card?.classList.add("pw", "lg", "strong"); card?.setAttribute("aria-describedby", whyId); card?.setAttribute("aria-modal", "true");
  if (card) card.tabIndex = -1;
  addEventListener("keydown", onKey);
  requestAnimationFrame(() => card?.focus({ preventScroll: true }));      // 焦点放进卡片（读屏先读标题与那句说明），不直接落在付款按钮上
  current = handle;
  return handle;
}
