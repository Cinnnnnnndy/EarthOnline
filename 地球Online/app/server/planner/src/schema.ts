/** 模型的输出格式（structured outputs 的 JSON Schema）与对应的 TS 类型。
 *
 *  模型不直接写 Trip：id、每天的日期、seed、status、时间戳这些由服务端补（draft.ts），
 *  模型只管「说什么、问什么、排什么」。字段都是 required，可选的用 null 表示——这样 schema 满足 structured outputs 的限制
 *  （每个对象 additionalProperties: false；不用 minimum / maxLength / pattern 这类约束，范围在 draft.ts 里再查）。 */
import { THEMES } from "../../../shared/spec/types.ts";
import { KINDS } from "../../../shared/world/landmark-kinds.ts";

export const CATEGORIES = ["sight", "food", "shop", "station", "airport", "port", "hotel", "other"] as const;
export const MODES = ["walk", "rail", "subway", "bus", "ship", "taxi", "car", "flight"] as const;
export const KIND_IDS: readonly string[] = KINDS.map((k) => k.id);

export type Category = (typeof CATEGORIES)[number];
export type Mode = (typeof MODES)[number];
export interface ModelLeg { mode: Mode; label: string; durationMinutes: number | null; distanceKm: number | null }
export interface ModelStop {
  name: string; category: Category; kind: string | null; lat: number; lng: number;
  plannedStart: string | null; stayMinutes: number | null; notes: string | null; next: ModelLeg | null;
}
export interface ModelDay { title: string; lodging: string | null; stops: ModelStop[] }
export interface ModelDraft { title: string; destination: string; startDate: string; theme: string; days: ModelDay[] }
export interface ModelOutput { reply: string; question: string | null; done: boolean; draft: ModelDraft | null }

const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: "null" }] });
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const LEG = obj({
  mode: { type: "string", enum: [...MODES] },
  label: { type: "string", description: "交通的名字，如「JR 特急 はるか」「步行」「出租车」" },
  durationMinutes: nullable({ type: "integer" }),
  distanceKm: nullable({ type: "number" }),
});
const STOP = obj({
  name: { type: "string" },
  category: { type: "string", enum: [...CATEGORIES] },
  kind: nullable({ type: "string", enum: [...KIND_IDS] }),
  lat: { type: "number" },
  lng: { type: "number" },
  plannedStart: nullable({ type: "string", description: "HH:MM，24 小时制" }),
  stayMinutes: nullable({ type: "integer" }),
  notes: nullable({ type: "string" }),
  next: nullable(LEG),
});
const DAY = obj({
  title: { type: "string" },
  lodging: nullable({ type: "string" }),
  stops: { type: "array", items: STOP },
});
const DRAFT = obj({
  title: { type: "string" },
  destination: { type: "string" },
  startDate: { type: "string", format: "date" },
  theme: { type: "string", enum: [...THEMES] },
  days: { type: "array", items: DAY },
});

export const OUTPUT_SCHEMA: Record<string, unknown> = obj({
  reply: { type: "string" },
  question: nullable({ type: "string" }),
  done: { type: "boolean" },
  draft: nullable(DRAFT),
});

/** 解析模型的文本输出。structured outputs 已经保证了形状，这里只做防御性的检查，出错就抛 */
export function parseModelOutput(text: string): ModelOutput {
  const o = JSON.parse(text) as Partial<ModelOutput>;
  if (!o || typeof o !== "object") throw new Error("output is not an object");
  if (typeof o.reply !== "string") throw new Error("output.reply is not a string");
  if (typeof o.done !== "boolean") throw new Error("output.done is not a boolean");
  if (o.question !== null && o.question !== undefined && typeof o.question !== "string") throw new Error("output.question is not a string");
  if (o.draft !== null && o.draft !== undefined && (typeof o.draft !== "object" || !Array.isArray(o.draft.days))) throw new Error("output.draft has no days");
  return { reply: o.reply, question: o.question ?? null, done: o.done, draft: o.draft ?? null };
}
