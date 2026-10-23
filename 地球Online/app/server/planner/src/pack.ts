/** /v1/pack（第八轮末，D79）：让模型按这趟的摘要和这个人的情况，往行李箱里再加最多三样东西，每样一句为什么。
 *  候选只能是客户端画得出来的那几种（candidates）；模型拒答、输出不可用或一样都没挑时，退回本机规则（shared/algo/pack-extras.ts）——
 *  装箱是锦上添花，不该因为模型出错而空着。
 *  模型参数：和 /v1/plan 同一个模型；effort 默认 low（挑三样东西不需要深想）；结构化输出；提示词缓存；拒答回退。 */
import type Anthropic from "@anthropic-ai/sdk";
import { PACK_LIMITS, EXTRA_KINDS, type PackRequest, type PackResponse, type PackedExtra, type ExtraKind } from "../../../shared/planner/protocol.ts";
import { rulesExtras } from "../../../shared/algo/pack-extras.ts";
import { DEFAULT_MODEL, FALLBACK_BETA, mapError, type PlannerClient, type Effort } from "./planner.ts";

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

export interface PackBackend { pack(req: PackRequest, signal?: AbortSignal): Promise<PackResponse> }

export const PACK_SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false, required: ["extras"],
  properties: { extras: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "reason"], properties: { kind: { type: "string", enum: [...EXTRA_KINDS] }, reason: { type: "string" } } } } },
};

export const PACK_SYSTEM = `You pack the last few items into a traveler's suitcase in 地球Online, a travel diary app. The suitcase already holds miniature models of the trip's landmarks, a local souvenir per destination, the traveler's own figure and a diary. You add at most 3 small extra items.

You receive JSON: brief (the trip: title, destination, dates, theme, season, the farthest latitude, counts of stop kinds, number of famous sights, counts of transport legs, and sometimes note), profile (how many trips this person has taken, how many places they checked in) and candidates (the only item kinds you may pick).

Rules:
- brief.note, when present, is what the traveler typed about this trip or what they want packed ("three rainy days in Kyoto", "beach, then a long flight"). Weigh it first: if it names a situation or an item, pick the matching candidates before anything else, and let the reason echo it.
- Pick 0 to 3 kinds, only from candidates, no duplicates. Fewer is fine; pick only what this trip really calls for.
- Each reason is one short, concrete phrase in the user's locale (zh-Hans / en / ja): under 20 characters for Chinese or Japanese, under 8 words for English. Name the specific thing in this trip that calls for the item (the season, a kind of place, the road trip, the aurora, the person's trip count). No emoji, no exclamation marks, no lists.
- Think of a thoughtful friend helping pack, not a checklist.`;

export class RulesPacker implements PackBackend {
  async pack(req: PackRequest): Promise<PackResponse> { return { extras: rulesExtras(req.brief, req.context.profile, req.context.locale, req.context.candidates) }; }
}

export interface ClaudePackerOptions { client: PlannerClient; model?: string; effort?: Effort; maxTokens?: number; log?: (event: string, data: Record<string, unknown>) => void }

export class ClaudePacker implements PackBackend {
  private o: Required<Omit<ClaudePackerOptions, "log">> & Pick<ClaudePackerOptions, "log">;
  constructor(opts: ClaudePackerOptions) { this.o = { model: DEFAULT_MODEL, effort: "low", maxTokens: 1500, ...opts }; }

  buildParams(req: PackRequest): CreateParams {
    return {
      model: this.o.model, max_tokens: this.o.maxTokens,
      system: [{ type: "text", text: PACK_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify({ brief: req.brief, locale: req.context.locale, profile: req.context.profile, candidates: req.context.candidates }) }],
      output_config: { effort: this.o.effort, format: { type: "json_schema", schema: PACK_SCHEMA } },
      betas: [FALLBACK_BETA], fallbacks: "default",
    };
  }

  async pack(req: PackRequest, signal?: AbortSignal): Promise<PackResponse> {
    const rules = () => ({ extras: rulesExtras(req.brief, req.context.profile, req.context.locale, req.context.candidates) });
    let msg: Anthropic.Beta.Messages.BetaMessage;
    try { msg = await this.o.client.beta.messages.create(this.buildParams(req), { signal }); } catch (e) { throw mapError(e); }
    const u = msg.usage; this.o.log?.("pack_usage", { model: msg.model, stop: msg.stop_reason, input: u?.input_tokens, output: u?.output_tokens, cacheRead: u?.cache_read_input_tokens });
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") { this.o.log?.("pack_fallback", { reason: msg.stop_reason }); return rules(); }
    const text = msg.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    let extras: PackedExtra[];
    try {
      const o = JSON.parse(text) as { extras?: unknown };
      if (!Array.isArray(o.extras)) throw new Error("no extras");
      const allowed = new Set<ExtraKind>(req.context.candidates); const seen = new Set<ExtraKind>();
      extras = o.extras.flatMap((e): PackedExtra[] => {
        if (!e || typeof e !== "object") return []; const { kind, reason } = e as { kind?: unknown; reason?: unknown };
        if (typeof kind !== "string" || typeof reason !== "string" || !allowed.has(kind as ExtraKind) || seen.has(kind as ExtraKind)) return [];
        seen.add(kind as ExtraKind); return [{ kind: kind as ExtraKind, reason: reason.trim().slice(0, PACK_LIMITS.reasonChars) }];
      }).slice(0, PACK_LIMITS.extras);
    } catch (e) { this.o.log?.("pack_bad_output", { error: String(e), head: text.slice(0, 200) }); return rules(); }
    return extras.length ? { extras } : rules();
  }
}
