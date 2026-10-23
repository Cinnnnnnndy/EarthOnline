/** HTTP 层：路由、CORS、尺寸与频率限制、并发上限、客户端断开时取消上游请求。不依赖框架，Node 22 自带的 http 就够。 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { LIMITS, PLAN_PATH, PACK_PATH, checkPlanRequest, checkPackRequest, type PlanRequest, type PlanResponse, type PackRequest } from "../../../shared/planner/protocol.ts";
import { PlannerError } from "./planner.ts";
import type { PackBackend } from "./pack.ts";

export interface PlanBackend { plan(req: PlanRequest, signal?: AbortSignal): Promise<PlanResponse> }

export interface HandlerOptions {
  planner: PlanBackend;
  /** /v1/pack（让 AI 装箱）；不给就 404 */
  packer?: PackBackend;
  /** 允许的网页来源（Origin），"*" 表示都允许。没有 Origin 头的请求（原生 App、curl）不受限 */
  allowedOrigins: string[];
  /** 每个 IP 每分钟的请求数（令牌桶的补充速度），默认 12 */
  perMinute?: number;
  /** 令牌桶容量（允许的突发），默认 6 */
  burst?: number;
  /** 同时在跑的规划请求上限，默认 8 */
  maxConcurrent?: number;
  /** 在反向代理后面时用 X-Forwarded-For 的第一个地址当客户端 IP */
  trustProxy?: boolean;
  log?: (event: string, data: Record<string, unknown>) => void;
  /** 测试用的时钟（毫秒） */
  clock?: () => number;
}

export function createHandler(opts: HandlerOptions) {
  const perMinute = opts.perMinute ?? 12, burst = opts.burst ?? 6, maxConcurrent = opts.maxConcurrent ?? 8;
  const clock = opts.clock ?? Date.now; const allowAll = opts.allowedOrigins.includes("*"); const allowed = new Set(opts.allowedOrigins);
  const buckets = new Map<string, { tokens: number; at: number }>();
  let inFlight = 0;

  /** 令牌桶：够就扣一个返回 0，不够返回还要等几秒 */
  function take(ip: string): number {
    const now = clock(); const rate = perMinute / 60000;
    if (buckets.size > 10000) for (const [k, b] of buckets) if (now - b.at > 10 * 60000) buckets.delete(k);
    const b = buckets.get(ip) ?? { tokens: burst, at: now };
    b.tokens = Math.min(burst, b.tokens + (now - b.at) * rate); b.at = now; buckets.set(ip, b);
    if (b.tokens >= 1) { b.tokens -= 1; return 0; }
    return Math.max(1, Math.ceil((1 - b.tokens) / rate / 1000));
  }

  const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    if (res.headersSent) { res.end(); return; }
    const data = status === 204 ? "" : JSON.stringify(body);
    res.writeHead(status, { ...(status === 204 ? {} : { "content-type": "application/json; charset=utf-8" }), "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
    res.end(data);
  };
  const fail = (res: ServerResponse, status: number, error: string, headers?: Record<string, string>) => send(res, status, { error }, headers);

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://local"); const origin = req.headers.origin;
    // ---- CORS
    if (origin) {
      if (!allowAll && !allowed.has(origin)) { fail(res, 403, "origin not allowed"); return; }
      res.setHeader("access-control-allow-origin", allowAll ? "*" : origin);
      res.setHeader("vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      send(res, 204, null, { "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600" }); return;
    }
    if (url.pathname === "/healthz") { if (req.method === "GET") send(res, 200, { ok: true }); else fail(res, 405, "method not allowed", { allow: "GET" }); return; }
    const route = url.pathname === PLAN_PATH ? "plan" : url.pathname === PACK_PATH && opts.packer ? "pack" : null;
    if (!route) { fail(res, 404, "not found"); return; }
    if (req.method !== "POST") { fail(res, 405, "method not allowed", { allow: "POST, OPTIONS" }); return; }
    if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) { fail(res, 415, "content-type must be application/json"); return; }
    const len = Number(req.headers["content-length"] ?? "0");
    if (len > LIMITS.bodyBytes) { fail(res, 413, `body larger than ${LIMITS.bodyBytes} bytes`); req.resume(); return; }

    // ---- 频率与并发
    const fwd = opts.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() : "";
    const ip = fwd || req.socket.remoteAddress || "unknown";
    const wait = take(ip);
    if (wait) { fail(res, 429, "too many requests", { "retry-after": String(wait) }); req.resume(); return; }
    if (inFlight >= maxConcurrent) { fail(res, 503, "the planner is busy, try again shortly", { "retry-after": "5" }); req.resume(); return; }

    // ---- 读 body（边读边数，超过上限就停）
    let body: unknown;
    try {
      const raw = await readBody(req, LIMITS.bodyBytes);
      if (raw === null) { fail(res, 413, `body larger than ${LIMITS.bodyBytes} bytes`); return; }
      body = JSON.parse(raw);
    } catch { fail(res, 400, "body is not valid JSON"); return; }
    const errs = route === "plan" ? checkPlanRequest(body) : checkPackRequest(body);
    if (errs.length) { fail(res, 400, `invalid request: ${errs.slice(0, 3).join("; ")}`); return; }

    // ---- 规划（客户端断开就取消上游请求）
    const ctl = new AbortController();
    const onClose = () => { if (!res.writableFinished) ctl.abort(); };
    res.on("close", onClose);
    inFlight++; const t0 = clock();
    try {
      if (route === "pack") {
        const out = await opts.packer!.pack(body as PackRequest, ctl.signal);
        send(res, 200, out);
        opts.log?.("pack", { ip, ms: clock() - t0, extras: out.extras.map((e) => e.kind) });
      } else {
        const out = await opts.planner.plan(body as PlanRequest, ctl.signal);
        send(res, 200, out);
        opts.log?.("plan", { ip, ms: clock() - t0, turns: (body as PlanRequest).messages.length, draft: !!out.draft, done: out.done });
      }
    } catch (e) {
      const err = e instanceof PlannerError ? e : new PlannerError(500, "internal error");
      opts.log?.(route + "_error", { ip, ms: clock() - t0, status: err.status, error: e instanceof Error ? e.message : String(e) });
      if (!ctl.signal.aborted) fail(res, err.status, err.message);
      else res.end();
    } finally {
      inFlight--; res.off("close", onClose);
    }
  };
}

function readBody(req: IncomingMessage, max: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0; let over = false;
    req.on("data", (c: Buffer) => { if (over) return; size += c.length; if (size > max) { over = true; chunks.length = 0; resolve(null); req.resume(); return; } chunks.push(c); });
    req.on("end", () => { if (!over) resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}
