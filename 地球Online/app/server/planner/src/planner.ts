/** 用 Claude 实现 /v1/plan 的一轮：对话 → {reply, question, draft, done}。
 *
 *  模型与参数（按 claude-api skill）：
 *   - claude-opus-5-5：当前默认模型。排一本书要同时顾到真实坐标、开放时间、路程与季节，这是需要推理的活。
 *   - 思考不能关（Opus 5.5 恒为自适应思考），用 output_config.effort 控制深浅与延迟：默认 medium（它的默认值，这里写明），
 *     语音场景想更快可设 PLANNER_EFFORT=low。
 *   - 结构化输出（output_config.format = json_schema）拿 {reply, question, done, draft}；Opus 5.5 不支持强制 tool_choice，
 *     所以不用「强制调用工具」这条路。
 *   - 提示词缓存：系统提示词（含 Trip 的 JSON Schema）是固定前缀，打一个显式断点；再加顶层自动缓存，多轮对话逐轮复用。
 *   - 拒答回退：fallbacks: "default"（beta server-side-fallback-2026-07-01），被分类器拒绝时服务端按类别换模型重跑。
 *   - 非流式，max_tokens 16000（skill 对非流式请求的建议值，思考也算在里面）。 */
import Anthropic from "@anthropic-ai/sdk";
import type { PlanRequest, PlanResponse } from "../../../shared/planner/protocol.ts";
import { OUTPUT_SCHEMA, parseModelOutput } from "./schema.ts";
import { SYSTEM_PROMPT, contextBlock } from "./prompt.ts";
import { toTrip } from "./draft.ts";

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** 只用到 SDK 客户端的这一个方法；测试里换成假的 */
export interface PlannerClient {
  beta: { messages: { create(body: CreateParams, options?: { signal?: AbortSignal }): PromiseLike<BetaMessage> } };
}

export const DEFAULT_MODEL = "claude-opus-5-5";
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** 带 HTTP 状态码的错误：http.ts 原样回给客户端（message 不含内部细节） */
export class PlannerError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.name = "PlannerError"; this.status = status; }
}

export interface ClaudePlannerOptions {
  client: PlannerClient;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
  now?: () => string;
  log?: (event: string, data: Record<string, unknown>) => void;
}

export class ClaudePlanner {
  private o: Required<Omit<ClaudePlannerOptions, "log">> & Pick<ClaudePlannerOptions, "log">;
  constructor(opts: ClaudePlannerOptions) {
    this.o = { model: DEFAULT_MODEL, effort: "medium", maxTokens: 16000, now: () => new Date().toISOString(), ...opts };
  }

  /** 组请求（单独导出给测试看）：tools → system → messages 的前缀里，只有 messages 会变 */
  buildParams(req: PlanRequest): CreateParams {
    const turns = req.messages.slice(req.messages.findIndex((m) => m.role === "user"));   // 第一条必须是 user（开场白之类的 assistant 消息丢掉）
    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = turns.map((m, i) =>
      i === 0 ? { role: "user", content: [{ type: "text", text: contextBlock(req.context) }, { type: "text", text: m.text }] } : { role: m.role, content: m.text });
    return {
      model: this.o.model,
      max_tokens: this.o.maxTokens,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
      cache_control: { type: "ephemeral" },
      output_config: { effort: this.o.effort, format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    };
  }

  async plan(req: PlanRequest, signal?: AbortSignal): Promise<PlanResponse> {
    const params = this.buildParams(req);
    let msg: BetaMessage;
    try {
      msg = await this.o.client.beta.messages.create(params, { signal });
    } catch (e) {
      throw mapError(e);
    }
    const u = msg.usage;
    this.o.log?.("usage", { model: msg.model, stop: msg.stop_reason, input: u?.input_tokens, output: u?.output_tokens, cacheRead: u?.cache_read_input_tokens, cacheWrite: u?.cache_creation_input_tokens });

    if (msg.stop_reason === "refusal") throw new PlannerError(422, "the model declined this request");
    if (msg.stop_reason === "max_tokens") throw new PlannerError(502, "the plan was too long to finish; try fewer days");
    const text = msg.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    let out;
    try { out = parseModelOutput(text); } catch (e) {
      this.o.log?.("bad_output", { error: String(e), head: text.slice(0, 200) });
      throw new PlannerError(502, "the model returned an unreadable answer");
    }

    const res: PlanResponse = { reply: out.reply.trim(), done: out.done };
    if (out.question && out.question.trim()) res.question = out.question.trim();
    if (out.draft) {
      const r = toTrip(out.draft, { now: this.o.now() });
      if (r.errors.length) this.o.log?.("draft_issues", { errors: r.errors.slice(0, 5) });
      if (r.trip) res.draft = r.trip; else res.done = false;              // 草稿不合规：这一轮只回话
    }
    if (res.done && !res.draft) res.done = false;
    return res;
  }
}

/** SDK 的错误 → 给客户端看的状态码（从具体到宽泛；不把上游细节回给客户端） */
export function mapError(e: unknown): PlannerError {
  if (e instanceof PlannerError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new PlannerError(499, "request cancelled");
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new PlannerError(504, "the planner timed out");
  if (e instanceof Anthropic.APIConnectionError) return new PlannerError(502, "could not reach the model");
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new PlannerError(500, "the planner is not configured");
  if (e instanceof Anthropic.RateLimitError) return new PlannerError(503, "the planner is busy, try again shortly");
  if (e instanceof Anthropic.BadRequestError) return new PlannerError(502, "the model rejected the request");
  if (e instanceof Anthropic.InternalServerError) return new PlannerError(503, "the model is temporarily unavailable");
  if (e instanceof Anthropic.APIError) return new PlannerError(502, "model error");
  if (e instanceof Error && e.name === "AbortError") return new PlannerError(499, "request cancelled");
  return new PlannerError(500, "internal error");
}
