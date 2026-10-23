/** 说一句话做行程：贴着内容长高的液态玻璃底部面板。
 *  标题「说说你想去哪儿」→ 大的圆形话筒（听的时候外圈一圈圈扩散；点一下开始、再点一下停）→ 边说边出字 →
 *  短对话（助手的回复会念出来，可静音）→ 文字输入兜底 → 有草稿时出一张小卡（书名、日期、每天的标题）和主按钮「生成这本书」。
 *
 *  用法（由页面接入，这里不碰页面）：
 *    import { openVoiceComposer, buildPlannerContext } from "./voice/composer.ts";
 *    openVoiceComposer({ context: buildPlannerContext({ locale: getLocale(), home: store.home, trips: store.trips }),
 *                        onCreate: (trip) => { const t = store.importTrip(trip); router.go(`#/book/${t.id}`); } });
 *  onCreate 收到的 trip 已过 validateTrip（spec 0.3），可以直接 store.importTrip。
 *  规划服务地址：opts.endpoint，没给就读 localStorage「earth-online:planner-endpoint」；为空时只用本机规则（离线）。
 *  界面文字按 context.locale（简中 / 英 / 日）从 shared/i18n 取（voice.* 键）。第八轮：标题 17、空闲时没有状态行、话筒小一号。 */
import "./voice.css";
import type { Trip } from "../../../shared/spec/types.ts";
import type { Locale } from "../../../shared/i18n/index.ts";
import { dateRange, days as dayCount, list, t, isLocale, type MsgKey, type Vars } from "../../../shared/i18n/index.ts";
import { assistantText, type Planner, type PlannerContext, type PlannerMessage, type PlanResult } from "../../../shared/planner/protocol.ts";
import { createPlanner } from "../../../shared/planner/remote.ts";
import { createRecognizer, speechLang, speechSupport, Speaker, type Recognizer, type RecognizerError } from "./speech.ts";

export type { PlannerContext, Planner, PlanResult } from "../../../shared/planner/protocol.ts";
export { LocalRulePlanner } from "../../../shared/planner/local.ts";
export { RemotePlanner, createPlanner } from "../../../shared/planner/remote.ts";
export { speechSupport, Speaker, createRecognizer } from "./speech.ts";

// ---------------------------------------------------------------- 规划服务地址
export const PLANNER_ENDPOINT_KEY = "earth-online:planner-endpoint";
export function getPlannerEndpoint(): string { try { return (localStorage.getItem(PLANNER_ENDPOINT_KEY) ?? "").trim(); } catch { return ""; } }
export function setPlannerEndpoint(url: string): void { try { if (url.trim()) localStorage.setItem(PLANNER_ENDPOINT_KEY, url.trim()); else localStorage.removeItem(PLANNER_ENDPOINT_KEY); } catch { /* 隐私模式 */ } }

/** 今天（本地时区）的 YYYY-MM-DD */
export function localToday(d = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
/** 由应用里现成的数据拼出规划上下文（已有的书只带标题和日期） */
export function buildPlannerContext(x: { locale: Locale; home?: { name: string; lat: number; lng: number } | null; trips?: Pick<Trip, "title" | "startDate" | "endDate">[]; today?: string }): PlannerContext {
  const ctx: PlannerContext = { today: x.today ?? localToday(), locale: x.locale };
  if (x.home) ctx.home = { name: x.home.name, lat: x.home.lat, lng: x.home.lng };
  if (x.trips?.length) ctx.trips = x.trips.slice(0, 50).map((t) => ({ title: t.title.slice(0, 80), startDate: t.startDate, endDate: t.endDate }));
  return ctx;
}

// ---------------------------------------------------------------- 文字（shared/i18n 的 voice.* 键）
type TextKey = "title" | "hint" | "hintNoMic" | "listening" | "thinking" | "placeholder" | "send" | "micStart" | "micStop" | "mute" | "unmute" | "create" | "moreDays" | "offline" | "error" | "micDenied" | "noSpeech" | "network" | "noMic";

// ---------------------------------------------------------------- 图标（线性、currentColor）
const svg = (d: string, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  send: '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  muted: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5m0-5-5 5"/>',
};

type Attrs = Record<string, string | boolean | undefined>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | false)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v === undefined || v === false) continue; if (k === "html") e.innerHTML = String(v); else e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids) if (c) e.append(c);
  return e;
}

// ---------------------------------------------------------------- 面板
export interface VoiceComposerOptions {
  onCreate(trip: Trip): void;
  context: PlannerContext;
  /** 规划服务地址；不给就读 localStorage「earth-online:planner-endpoint」，为空只用本机规则 */
  endpoint?: string;
  /** 直接给一个规划器（测试、原生壳注入），优先于 endpoint */
  planner?: Planner;
  /** 打开就开始听（入口本身是一次点按时可以用；默认 false） */
  listenOnOpen?: boolean;
  onClose?(): void;
  /** 每次拿到草稿时回调（页面用它计 AI 规划次数：r.source 是 "local" 的离线规则不计） */
  onDraft?(r: PlanResult): void;
  /** 挂到哪里，默认 document.body */
  parent?: HTMLElement;
}
export interface VoiceComposerHandle {
  close(): void;
  /** 当成用户打了一句话发出去（测试、快捷入口用） */
  send(text: string): Promise<void>;
  readonly el: HTMLElement;
}

export function openVoiceComposer(opts: VoiceComposerOptions): VoiceComposerHandle {
  const locale: Locale = isLocale(opts.context.locale) ? opts.context.locale : "zh-Hans";
  const T = (k: TextKey, v?: Vars) => t(`voice.${k}` as MsgKey, v, locale);
  // 识别跟着页面语言（<html lang>，没有就用浏览器语言）；朗读跟着回复的语言
  const recLang = speechLang(), ttsLang = speechLang(locale);
  const planner = opts.planner ?? createPlanner(opts.endpoint ?? getPlannerEndpoint());
  const support = speechSupport(); const speaker = new Speaker();
  const st = { messages: [] as PlannerMessage[], draft: null as Trip | null, busy: false, via: "text" as "voice" | "text", closed: false, notedOffline: false, micBroken: false };
  let inflight: AbortController | null = null;
  const prevFocus = document.activeElement as HTMLElement | null;

  // ---- 结构
  const title = el("h2", { class: "vc-title", id: "vc-title" }, T("title"));
  const muteBtn = support.synthesis ? el("button", { type: "button", class: "vc-icon" }) : null;
  const closeBtn = el("button", { type: "button", class: "vc-icon", "aria-label": t("common.close", undefined, locale), html: svg(ICON.close, 20) });
  const head = el("header", { class: "vc-head" }, title, el("div", { class: "vc-tools" }, muteBtn, closeBtn));
  const thread = el("div", { class: "vc-thread", "aria-live": "polite", hidden: true });
  const draftBox = el("div", { class: "vc-draft", hidden: true });
  const live = el("p", { class: "vc-live" }, support.recognition ? T("hint") : T("hintNoMic"));
  const mic = support.recognition ? el("button", { type: "button", class: "vc-mic", "aria-pressed": "false", "aria-label": T("micStart"), html: `<span class="vc-ring"></span><span class="vc-ring vc-ring2"></span><span class="vc-mic-ic">${svg(ICON.mic, 34)}</span>` }) : null;
  const status = el("p", { class: "vc-status" });
  const voice = el("div", { class: "vc-voice" + (support.recognition ? "" : " no-mic") }, live, mic, mic ? status : null);
  const input = el("input", { class: "vc-input", type: "text", enterkeyhint: "send", autocomplete: "off", placeholder: T("placeholder"), "aria-label": T("placeholder"), maxlength: "500" });
  const sendBtn = el("button", { type: "submit", class: "vc-send", "aria-label": T("send"), disabled: true, html: svg(ICON.send, 20) });
  const form = el("form", { class: "vc-text" }, input, sendBtn);
  const note = el("p", { class: "vc-note", hidden: true });
  const sheet = el("section", { class: "vc lg strong", role: "dialog", "aria-modal": "true", "aria-labelledby": "vc-title", tabindex: "-1" }, el("div", { class: "vc-grab", "aria-hidden": "true" }), head, thread, draftBox, voice, form, note);
  const wrap = el("div", { class: "vc-wrap" }, sheet);
  (opts.parent ?? document.body).appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("in"));

  // ---- 静音
  const paintMute = () => { if (!muteBtn) return; const m = speaker.muted; muteBtn.innerHTML = svg(m ? ICON.muted : ICON.speaker, 20); muteBtn.setAttribute("aria-pressed", String(!m)); muteBtn.setAttribute("aria-label", m ? T("unmute") : T("mute")); muteBtn.classList.toggle("off", m); };
  muteBtn?.addEventListener("click", () => { speaker.setMuted(!speaker.muted); paintMute(); });
  paintMute();

  // ---- 对话
  const scrollThread = () => { thread.scrollTop = thread.scrollHeight; };
  function bubble(role: "user" | "assistant", text: string, extra?: string): HTMLElement {
    thread.hidden = false;
    const b = el("div", { class: `vc-msg ${role === "user" ? "me" : "bot"}` }, text);
    if (extra) b.append(el("span", { class: "vc-q" }, extra));
    thread.append(b); scrollThread(); return b;
  }
  function typing(on: boolean) {
    thread.querySelector(".vc-typing")?.remove();
    if (on) { thread.hidden = false; thread.append(el("div", { class: "vc-msg bot vc-typing", "aria-label": T("thinking") }, el("i"), el("i"), el("i"))); scrollThread(); }
  }
  function setStatus(key: TextKey | "") { status.textContent = key ? T(key) : ""; }
  function setBusy(b: boolean) {
    st.busy = b; sheet.classList.toggle("busy", b);
    if (mic) mic.disabled = b || st.micBroken; sendBtn.disabled = b || !input.value.trim();
    if (b) setStatus("thinking"); else if (mic && !rec?.listening) setStatus("");
  }

  function renderDraft() {
    const t = st.draft; draftBox.replaceChildren(); draftBox.hidden = !t; if (!t) return;
    const max = 5; const shown = t.days.slice(0, t.days.length > max + 1 ? max : t.days.length);
    const days = el("ol", { class: "vc-days" }, ...shown.map((d) => el("li", {}, el("span", { class: "vc-dn" }, String(d.index)), el("span", { class: "vc-dt" }, d.title))));
    const more = t.days.length > shown.length ? el("p", { class: "vc-more" }, T("moreDays", { n: t.days.length - shown.length })) : null;
    const create = el("button", { type: "button", class: "vc-primary" }, T("create"));
    create.addEventListener("click", () => { const trip = st.draft; if (!trip) return; close(); opts.onCreate(trip); });
    draftBox.append(
      el("div", { class: "vc-draft-card" },
        el("p", { class: "vc-draft-title" }, t.title),
        el("p", { class: "vc-draft-meta" }, list([dateRange(t.startDate, t.endDate, locale), dayCount(t.days.length, locale)], locale)),
        days, more),
      create);
  }

  async function send(raw: string): Promise<void> {
    const text = raw.trim(); if (!text || st.busy || st.closed) return;
    rec?.abort(); speaker.cancel();
    st.messages.push({ role: "user", text }); bubble("user", text);
    live.textContent = ""; live.classList.remove("on");
    setBusy(true); typing(true);
    const ctl = new AbortController(); inflight = ctl;
    let r: PlanResult;
    try {
      r = await planner.plan({ messages: [...st.messages], context: opts.context }, { signal: ctl.signal });
    } catch {
      if (st.closed || ctl.signal.aborted) return;
      typing(false); bubble("assistant", T("error")); setBusy(false); return;
    } finally { if (inflight === ctl) inflight = null; }
    if (st.closed) return;
    typing(false);
    const said = assistantText(r); st.messages.push({ role: "assistant", text: said });
    bubble("assistant", r.reply.trim() || (r.question ?? ""), r.reply.trim() && r.question ? r.question : undefined);
    if (r.draft) { st.draft = r.draft; renderDraft(); requestAnimationFrame(scrollThread); opts.onDraft?.(r); }
    if (r.source === "local" && r.fallbackReason && !st.notedOffline) { st.notedOffline = true; note.textContent = T("offline"); note.hidden = false; }
    setBusy(false);
    // 念出来；是用嘴说的、又有追问时，念完接着听（语音来回对话）
    const spoken = await speaker.speak(said, ttsLang);
    if (spoken && !st.closed && st.via === "voice" && r.question && rec && !st.micBroken && !st.busy) rec.start();
  }

  // ---- 听
  const micError: Partial<Record<RecognizerError, TextKey>> = { "not-allowed": "micDenied", "service-not-allowed": "micDenied", "audio-capture": "noMic", network: "network", "no-speech": "noSpeech", "language-not-supported": "hintNoMic", "start-failed": "micDenied" };
  const rec: Recognizer | null = mic ? createRecognizer({
    onState(on) {
      if (!mic) return;
      mic.classList.toggle("on", on); mic.setAttribute("aria-pressed", String(on)); mic.setAttribute("aria-label", on ? T("micStop") : T("micStart"));
      mic.querySelector(".vc-mic-ic")!.innerHTML = svg(on ? ICON.stop : ICON.mic, 34);
      live.classList.toggle("on", on); if (on) { live.textContent = ""; setStatus("listening"); } else if (!st.busy) setStatus("");
    },
    onInterim(text) { live.textContent = text; },
    onEnd(text) { if (text.trim()) { st.via = "voice"; void send(text); } else if (!st.messages.length && !live.textContent) live.textContent = T("hint"); },
    onError(code) {
      const k = micError[code]; if (!k) return;
      if (k !== "noSpeech") { st.micBroken = true; if (mic) mic.disabled = true; voice.classList.add("mic-off"); input.focus(); }
      setStatus(""); live.classList.remove("on"); live.textContent = T(k);
    },
  }, { lang: recLang }) : null;
  mic?.addEventListener("click", () => {
    if (!rec || st.busy) return;
    if (rec.listening) { rec.stop(); return; }
    speaker.cancel(); rec.start();
  });

  // ---- 打字
  input.addEventListener("input", () => { sendBtn.disabled = st.busy || !input.value.trim(); });
  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; if (!v.trim() || st.busy) return; input.value = ""; sendBtn.disabled = true; st.via = "text"; void send(v); });

  // ---- 键盘弹起时把面板托上去（iOS Safari 的 fixed 不跟可视区域走）
  const vv = window.visualViewport;
  const onViewport = () => { if (!vv) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); wrap.style.setProperty("--vc-kb", `${Math.round(kb)}px`); };
  vv?.addEventListener("resize", onViewport); vv?.addEventListener("scroll", onViewport);

  // ---- 关闭
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  closeBtn.addEventListener("click", () => close());
  function close() {
    if (st.closed) return; st.closed = true;
    inflight?.abort(); rec?.abort(); speaker.cancel();
    document.removeEventListener("keydown", onKey); vv?.removeEventListener("resize", onViewport); vv?.removeEventListener("scroll", onViewport);
    wrap.classList.remove("in"); wrap.classList.add("out");
    const done = () => wrap.remove();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done(); else setTimeout(done, 220);
    try { prevFocus?.focus?.(); } catch { /* 元素可能已经不在了 */ }
    opts.onClose?.();
  }

  // ---- 开场
  // 焦点给面板本身（读屏会念标题）；不直接给话筒，免得点开时就画出焦点框
  sheet.focus({ preventScroll: true });
  if (opts.listenOnOpen && rec) rec.start();

  return { close, send: (t: string) => { st.via = "text"; return send(t); }, el: wrap };
}
