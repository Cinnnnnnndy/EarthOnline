/** 语音：听（Web Speech API 的 SpeechRecognition / webkitSpeechRecognition，边说边出字）+ 说（speechSynthesis 念回复，可静音）。
 *  两样都先做特性检测；不支持、没权限、没联网时，调用方退回文字输入（composer.ts）。
 *  识别语言取 <html lang>，没有就取浏览器语言；应用里的 zh-Hans / en / ja 换成识别引擎认的 zh-CN / en-US / ja-JP。 */

// ---- Web Speech 的最小类型（lib.dom 里没有 SpeechRecognition，这里只声明用到的部分）
interface SRAlternative { transcript: string; confidence: number }
interface SRResult { readonly isFinal: boolean; readonly length: number; [i: number]: SRAlternative }
interface SRResultList { readonly length: number; [i: number]: SRResult }
interface SREvent extends Event { readonly resultIndex: number; readonly results: SRResultList }
interface SRErrorEvent extends Event { readonly error: string; readonly message?: string }
interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null; onstart: (() => void) | null;
}
type SRCtor = new () => SRInstance;

function recognitionCtor(): SRCtor | null {
  const w = globalThis as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechSupport { recognition: boolean; synthesis: boolean }
export function speechSupport(): SpeechSupport {
  return {
    recognition: !!recognitionCtor(),
    synthesis: typeof globalThis.speechSynthesis !== "undefined" && typeof globalThis.SpeechSynthesisUtterance !== "undefined",
  };
}

/** 识别与朗读用的语言标签 */
export function speechLang(raw: string = (typeof document !== "undefined" && document.documentElement.lang) || (typeof navigator !== "undefined" && navigator.language) || "zh-CN"): string {
  const l = raw.trim().toLowerCase();
  if (l === "zh" || l === "zh-hans" || l.startsWith("zh-hans-") || l === "zh-cn" || l === "zh-sg") return "zh-CN";
  if (l === "zh-hant" || l.startsWith("zh-hant-") || l === "zh-tw") return "zh-TW";
  if (l === "zh-hk" || l === "zh-mo") return "zh-HK";
  if (l === "ja") return "ja-JP";
  if (l === "en") return "en-US";
  return raw.trim() || "zh-CN";
}

// ---------------------------------------------------------------- 听
/** 识别引擎的错误码（Web Speech 规范里的 + 我们自己的 unsupported / start-failed） */
export type RecognizerError = "not-allowed" | "service-not-allowed" | "no-speech" | "audio-capture" | "network" | "aborted" | "language-not-supported" | "bad-grammar" | "unsupported" | "start-failed" | (string & {});

export interface RecognizerHandlers {
  /** 边说边出：已确定的部分 + 正在识别的部分 */
  onInterim?(text: string): void;
  /** 开始 / 停止听 */
  onState?(listening: boolean): void;
  /** 这一次听完了（点了停止、或说完停顿了一会儿）。text 是整句定稿，可能为空 */
  onEnd?(text: string): void;
  onError?(code: RecognizerError): void;
}
export interface Recognizer {
  /** 开始听；已经在听或启动失败返回 false */
  start(): boolean;
  /** 停止并把已听到的交出去（onEnd） */
  stop(): void;
  /** 丢掉这一次（不触发 onEnd 的文字，text 为空） */
  abort(): void;
  readonly listening: boolean;
  lang: string;
}

/** 不支持语音识别时返回 null。silenceMs：说完停顿多久自动结束（0 = 只靠点按停止） */
export function createRecognizer(h: RecognizerHandlers, opts: { lang?: string; silenceMs?: number } = {}): Recognizer | null {
  const Ctor = recognitionCtor(); if (!Ctor) return null;
  const silenceMs = opts.silenceMs ?? 2200;
  let sr: SRInstance | null = null; let listening = false; let finalText = ""; let interim = ""; let discard = false;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  const clearSilence = () => { if (silenceTimer) clearTimeout(silenceTimer); silenceTimer = undefined; };
  const armSilence = () => { clearSilence(); if (silenceMs > 0) silenceTimer = setTimeout(() => { if ((finalText + interim).trim()) sr?.stop(); }, silenceMs); };
  const joined = () => (finalText + interim).replace(/\s+/g, " ").trim();

  const api: Recognizer = {
    lang: opts.lang ?? speechLang(),
    get listening() { return listening; },
    start() {
      if (listening) return false;
      // 每次新建一个实例：有的浏览器（Safari）同一个实例反复 start 会失效
      const r = new Ctor(); sr = r; finalText = ""; interim = ""; discard = false;
      r.lang = api.lang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => {
        interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]; const txt = res[0]?.transcript ?? "";
          if (res.isFinal) finalText += txt; else interim += txt;
        }
        h.onInterim?.(joined()); armSilence();
      };
      r.onerror = (e) => { if (e.error !== "aborted" || !discard) h.onError?.(e.error); };
      r.onend = () => {
        clearSilence(); const was = listening; listening = false; if (sr === r) sr = null;
        if (was) h.onState?.(false);
        h.onEnd?.(discard ? "" : joined());
      };
      try { r.start(); listening = true; h.onState?.(true); return true; }
      catch { sr = null; listening = false; h.onError?.("start-failed"); return false; }
    },
    stop() { clearSilence(); if (sr) { try { sr.stop(); } catch { /* 已经停了 */ } } },
    abort() { clearSilence(); discard = true; if (sr) { try { sr.abort(); } catch { /* 已经停了 */ } } },
  };
  return api;
}

// ---------------------------------------------------------------- 说
const MUTE_KEY = "earth-online:voice-muted";

/** 念回复。静音状态记在本机（localStorage），下次打开还是静音 */
export class Speaker {
  private mutedFlag: boolean;
  private current: SpeechSynthesisUtterance | null = null;
  readonly supported: boolean;
  constructor() {
    this.supported = speechSupport().synthesis;
    let m = false; try { m = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* 隐私模式 */ }
    this.mutedFlag = m;
  }
  get muted(): boolean { return this.mutedFlag || !this.supported; }
  setMuted(m: boolean) {
    this.mutedFlag = m; try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* 隐私模式 */ }
    if (m) this.cancel();
  }
  get speaking(): boolean { return !!this.current; }

  /** 念完（或被打断、出错、静音）时 resolve；true 表示完整念完了 */
  speak(text: string, lang: string = speechLang()): Promise<boolean> {
    const t = text.replace(/[「」“”"]/g, "").trim();
    if (this.muted || !t) return Promise.resolve(false);
    const synth = globalThis.speechSynthesis;
    this.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(t); u.lang = lang;
      const v = pickVoice(synth.getVoices(), lang); if (v) u.voice = v;
      let settled = false; const done = (ok: boolean) => { if (settled) return; settled = true; if (this.current === u) this.current = null; resolve(ok); };
      u.onend = () => done(true); u.onerror = () => done(false);
      this.current = u;
      // Chrome 偶尔不回 onend：按字数给一个上限
      setTimeout(() => done(false), 4000 + t.length * 260);
      try { synth.speak(u); } catch { done(false); }
    });
  }
  cancel() { if (!this.supported) return; this.current = null; try { globalThis.speechSynthesis.cancel(); } catch { /* 忽略 */ } }
}

/** 同语言里优先本机语音（离线、延迟低），再按地区完全匹配 */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const l = lang.toLowerCase(), base = l.split("-")[0];
  const same = voices.filter((v) => v.lang.toLowerCase().replace("_", "-") === l);
  const near = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  return same.find((v) => v.localService) ?? same[0] ?? near.find((v) => v.localService) ?? near[0] ?? null;
}
