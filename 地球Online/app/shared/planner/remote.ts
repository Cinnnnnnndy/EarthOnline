/** 远端规划（server/planner）：fetch + 超时 + 可中断；回来的草稿过 validateTrip。
 *  出任何问题（网络、超时、非 200、格式不对、草稿不合规）都退回本机规则（LocalRulePlanner），对话不断；
 *  只有调用方主动中断（关掉面板）才会抛出 AbortError。 */
import { validateTrip } from "../spec/validate.ts";
import type { Trip } from "../spec/types.ts";
import { PLAN_PATH, LIMITS, checkPlanResponse, type Planner, type PlanRequest, type PlanResult, type PlanResponse } from "./protocol.ts";
import { LocalRulePlanner } from "./local.ts";

export interface RemotePlannerOptions {
  /** 服务地址，如 https://planner.example.com（末尾的 / 与 /v1/plan 都可以省） */
  endpoint: string;
  /** 单次请求的超时（毫秒），默认 60 秒：模型要想、要排整本书 */
  timeoutMs?: number;
  /** 出错时的后备，默认本机规则 */
  fallback?: Planner;
  /** 测试或原生壳注入的 fetch */
  fetch?: typeof fetch;
  /** 退回本机规则时回调（打日志 / 提示用） */
  onFallback?: (reason: string) => void;
}

export class PlannerHttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.name = "PlannerHttpError"; this.status = status; }
}

/** 规范化服务地址：去掉末尾的 / 与 /v1/plan */
export function planUrl(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, "").replace(/\/v1\/plan$/, "");
  return base + PLAN_PATH;
}

/** 超出上限的请求先裁掉最早的几轮（保留第一句：多半是目的地），免得服务端直接拒绝 */
export function trimRequest(req: PlanRequest): PlanRequest {
  const clip = (s: string) => (s.length > LIMITS.textChars ? s.slice(0, LIMITS.textChars) : s);
  let messages = req.messages.map((m) => ({ role: m.role, text: clip(m.text) }));
  const total = () => messages.reduce((n, m) => n + m.text.length, 0);
  while (messages.length > 2 && (messages.length > LIMITS.messages || total() > LIMITS.totalChars)) messages = [messages[0], ...messages.slice(2)];
  const trips = req.context.trips?.slice(0, LIMITS.trips);
  return { messages, context: { ...req.context, ...(trips ? { trips } : {}) } };
}

export class RemotePlanner implements Planner {
  private url: string; private timeoutMs: number; private fallback: Planner; private fetchImpl: typeof fetch; private onFallback?: (reason: string) => void;
  constructor(opts: RemotePlannerOptions) {
    this.url = planUrl(opts.endpoint); this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fallback = opts.fallback ?? new LocalRulePlanner();
    this.fetchImpl = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    this.onFallback = opts.onFallback;
  }

  async plan(req: PlanRequest, opts: { signal?: AbortSignal } = {}): Promise<PlanResult> {
    try {
      return { ...(await this.request(req, opts.signal)), source: "remote" };
    } catch (e) {
      if (opts.signal?.aborted) throw e;                                  // 用户关掉了：不再退回
      const reason = e instanceof Error ? e.message : String(e);
      this.onFallback?.(reason);
      const r = await this.fallback.plan(req, opts);
      return { ...r, source: "local", fallbackReason: reason };
    }
  }

  /** 只走远端，不退回（出错就抛）。测试与需要区分来源的调用方用 */
  async request(req: PlanRequest, signal?: AbortSignal): Promise<PlanResponse> {
    const ctl = new AbortController(); let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, this.timeoutMs);
    const onAbort = () => ctl.abort();
    if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener("abort", onAbort, { once: true }); }
    try {
      let res: Response;
      try {
        res = await this.fetchImpl(this.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(trimRequest(req)), signal: ctl.signal });
      } catch (e) {
        if (timedOut) throw new Error(`timeout after ${this.timeoutMs} ms`);
        throw e;
      }
      let body: unknown;
      try { body = await res.json(); } catch { throw new PlannerHttpError(`HTTP ${res.status}: body is not JSON`, res.status); }
      if (!res.ok) {
        const msg = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "unknown error";
        throw new PlannerHttpError(`HTTP ${res.status}: ${msg}`, res.status);
      }
      const errs = checkPlanResponse(body);
      if (errs.length) throw new Error(`bad response: ${errs.join("; ")}`);
      const b = body as { reply: string; question?: string | null; draft?: Trip | null; done: boolean };
      if (b.draft) { const de = validateTrip(b.draft); if (de.length) throw new Error(`invalid draft: ${de.slice(0, 3).join("; ")}`); }
      return { reply: b.reply, ...(b.question ? { question: b.question } : {}), ...(b.draft ? { draft: b.draft } : {}), done: b.done };
    } finally {
      clearTimeout(timer); signal?.removeEventListener("abort", onAbort);
    }
  }
}

/** 有地址就走远端（出错退回本机规则），没有就只用本机规则 */
export function createPlanner(endpoint?: string, opts: Omit<RemotePlannerOptions, "endpoint"> = {}): Planner {
  return endpoint && endpoint.trim() ? new RemotePlanner({ endpoint, ...opts }) : new LocalRulePlanner();
}
