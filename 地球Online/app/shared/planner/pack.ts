/** 让 AI 装箱的客户端（第八轮末，D79）：有服务地址就 POST /v1/pack，超时、非 200、格式不对都退回本机规则；没有地址直接用规则。
 *  规则与摘要在 shared/algo/pack-extras.ts。 */
import { tripBrief, rulesExtras } from "../algo/pack-extras.ts";
import type { Trip } from "../spec/types.ts";
import type { Locale } from "../i18n/index.ts";
import { PACK_PATH, PACK_LIMITS, EXTRA_KINDS, checkPackResponse, type ExtraKind, type PackProfile, type PackRequest, type PackResult, type PackedExtra } from "./protocol.ts";

export interface PackOptions {
  /** 服务地址（与规划服务同一个），空 = 只用本机规则 */
  endpoint?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  candidates?: readonly ExtraKind[];
  signal?: AbortSignal;
  /** 这个人自己说的一句话（D84，清单的搜索框），随摘要一起给模型 */
  note?: string;
}

export function packUrl(endpoint: string): string { return endpoint.trim().replace(/\/+$/, "").replace(/\/v1\/(plan|pack)$/, "") + PACK_PATH; }

/** 先给规则的结果（同步、立刻能画），再去问服务 */
export function packLocal(trip: Trip, profile: PackProfile, locale: Locale, candidates: readonly ExtraKind[] = EXTRA_KINDS, note?: string): PackedExtra[] {
  return rulesExtras(tripBrief(trip, note), profile, locale, candidates);
}

export async function packExtras(trip: Trip, profile: PackProfile, locale: Locale, opts: PackOptions = {}): Promise<PackResult> {
  const candidates = opts.candidates ?? EXTRA_KINDS; const brief = tripBrief(trip, opts.note);
  const local = (): PackedExtra[] => rulesExtras(brief, profile, locale, candidates);
  if (!opts.endpoint?.trim()) return { extras: local(), source: "local" };
  const req: PackRequest = { brief, context: { locale, profile, candidates: [...candidates] } };
  const ctl = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, opts.timeoutMs ?? 20_000);
  const onAbort = () => ctl.abort(); opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const f = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    const res = await f(packUrl(opts.endpoint), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req), signal: ctl.signal });
    const body: unknown = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(body as { error?: string })?.error ?? "unknown error"}`);
    const errs = checkPackResponse(body); if (errs.length) throw new Error(`bad response: ${errs.join("; ")}`);
    const extras = (body as { extras: PackedExtra[] }).extras.filter((e) => candidates.includes(e.kind)).map((e) => ({ kind: e.kind, reason: e.reason.trim().slice(0, PACK_LIMITS.reasonChars) })).slice(0, PACK_LIMITS.extras);
    return { extras, source: "remote" };
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    return { extras: local(), source: "local", fallbackReason: timedOut ? `timeout after ${opts.timeoutMs ?? 20_000} ms` : e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer); opts.signal?.removeEventListener("abort", onAbort);
  }
}
