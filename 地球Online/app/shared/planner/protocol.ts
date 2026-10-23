/** 行程规划对话协议（网页、iOS、服务端共用，改这里要同步 server/planner/README.md 与 iOS 端）。
 *
 *  POST {endpoint}/v1/plan
 *    请求 { messages: [{ role: "user" | "assistant", text }], context: { today, locale, home?, trips? } }
 *    200  { reply, question?, draft?, done }
 *    其他 { error }
 *
 *  - 服务端不存会话：每次都带上完整对话。assistant 那一条写上次的 reply（有追问就把 question 接在后面）。
 *  - reply 是这一轮要说给用户听的话（会被念出来，所以短、不带列表和符号），不含追问；
 *    question 是唯一的一句追问（缺目的地或日期时才有）。
 *  - draft 是 spec 0.3 的 Trip（shared/spec/types.ts），拿到后先过 validateTrip 再用；
 *    地点条目可以带 geo（真实坐标）与 kind（shared/world/landmark-kinds.ts 的类型）。
 *  - done 为 true 表示信息够了、草稿可以直接生成书；用户还可以接着改（再说一句就是新的一轮）。 */
import type { Locale } from "../i18n/index.ts";
import type { Trip } from "../spec/types.ts";

export const PLAN_PATH = "/v1/plan";

export type PlannerRole = "user" | "assistant";
export interface PlannerMessage { role: PlannerRole; text: string }

export interface PlannerHome { name: string; lat: number; lng: number }
export interface PlannerTripRef { title: string; startDate: string; endDate: string }
export interface PlannerContext {
  /** 用户所在地的今天 YYYY-MM-DD（「下周五」「10月3号」都按它算） */
  today: string;
  /** 回复用的语言 */
  locale: Locale;
  /** 家（出发地），可选 */
  home?: PlannerHome;
  /** 已有的行程（避开重叠日期），可选 */
  trips?: PlannerTripRef[];
}

export interface PlanRequest { messages: PlannerMessage[]; context: PlannerContext }
export interface PlanResponse {
  reply: string;
  question?: string;
  draft?: Trip;
  done: boolean;
}
export interface PlanErrorBody { error: string }

/** 客户端拿到的结果：多一个来源标记（远端 / 本机规则），界面可以据此提示「离线规划」 */
export interface PlanResult extends PlanResponse {
  source: "remote" | "local";
  /** 远端失败、退回本机规则时的原因（给开发者看） */
  fallbackReason?: string;
}

export interface Planner {
  plan(req: PlanRequest, opts?: { signal?: AbortSignal }): Promise<PlanResult>;
}

/** 请求的尺寸上限（服务端据此拒绝，客户端据此裁剪） */
export const LIMITS = {
  messages: 40,
  textChars: 2000,
  totalChars: 16000,
  trips: 50,
  bodyBytes: 64 * 1024,
} as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCALES = new Set(["zh-Hans", "en", "ja"]);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** 请求体检查：返回问题列表（空 = 通过）。字段路径是给开发者看的 */
export function checkPlanRequest(body: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(body)) return ["body: 需要 JSON 对象"];
  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length < 1) errs.push("messages: 需要至少一条");
  else {
    if (messages.length > LIMITS.messages) errs.push(`messages: 最多 ${LIMITS.messages} 条`);
    let total = 0;
    messages.forEach((m, i) => {
      if (!isObj(m)) { errs.push(`messages[${i}]: 不是对象`); return; }
      if (m.role !== "user" && m.role !== "assistant") errs.push(`messages[${i}].role: 只能是 user 或 assistant`);
      if (typeof m.text !== "string") errs.push(`messages[${i}].text: 需要字符串`);
      else { total += m.text.length; if (m.text.length > LIMITS.textChars) errs.push(`messages[${i}].text: 超过 ${LIMITS.textChars} 字`); }
    });
    if (total > LIMITS.totalChars) errs.push(`messages: 总字数超过 ${LIMITS.totalChars}`);
    const last = messages[messages.length - 1];
    if (isObj(last) && last.role !== "user") errs.push("messages: 最后一条需要是 user");
    if (isObj(last) && typeof last.text === "string" && !last.text.trim()) errs.push("messages: 最后一条是空的");
  }
  if (!isObj(context)) errs.push("context: 需要对象");
  else {
    if (typeof context.today !== "string" || !DATE.test(context.today)) errs.push("context.today: 需要 YYYY-MM-DD");
    if (!LOCALES.has(context.locale as string)) errs.push("context.locale: 只能是 zh-Hans / en / ja");
    if (context.home !== undefined) {
      const h = context.home;
      if (!isObj(h) || typeof h.name !== "string" || !isNum(h.lat) || !isNum(h.lng)) errs.push("context.home: 需要 {name, lat, lng}");
    }
    if (context.trips !== undefined) {
      if (!Array.isArray(context.trips)) errs.push("context.trips: 需要数组");
      else {
        if (context.trips.length > LIMITS.trips) errs.push(`context.trips: 最多 ${LIMITS.trips} 条`);
        context.trips.forEach((t, i) => {
          if (!isObj(t) || typeof t.title !== "string" || t.title.length > 80 || typeof t.startDate !== "string" || !DATE.test(t.startDate) || typeof t.endDate !== "string" || !DATE.test(t.endDate))
            errs.push(`context.trips[${i}]: 需要 {title, startDate, endDate}`);
        });
      }
    }
  }
  return errs;
}

/** 响应体检查（不含 draft 的内容校验，那个交给 shared/spec/validate.ts） */
export function checkPlanResponse(body: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(body)) return ["body: 需要 JSON 对象"];
  if (typeof body.reply !== "string") errs.push("reply: 需要字符串");
  if (body.question !== undefined && body.question !== null && typeof body.question !== "string") errs.push("question: 需要字符串");
  if (typeof body.done !== "boolean") errs.push("done: 需要布尔值");
  if (body.draft !== undefined && body.draft !== null && !isObj(body.draft)) errs.push("draft: 需要对象");
  return errs;
}

/** 把一轮的回复写回对话历史时用的文本：reply 后面接追问 */
export function assistantText(r: Pick<PlanResponse, "reply" | "question">): string {
  const q = r.question?.trim();
  if (!q) return r.reply.trim();
  const reply = r.reply.trim();
  return reply ? `${reply} ${q}` : q;
}

// ---------------------------------------------------------------- 让 AI 装箱（第八轮末，D79）
/** POST {endpoint}/v1/pack
 *    请求 { brief: PackBrief, context: { locale, profile, candidates } }
 *    200  { extras: [{ kind, reason }] }（最多 3 样，kind 只能是 candidates 里的）
 *  行李箱（shared/algo/suitcase.ts）装完名胜、特色物件、小人与日记后，规划服务按它对这趟和这个人的了解再加几样——
 *  保温杯、墨镜、相机、登山鞋……每样一句为什么。没有服务或服务出错时用本机规则（shared/algo/pack-extras.ts）。
 *  brief 是客户端从 Trip 里算好的摘要（季节、最北的纬度、站点类型的个数、名胜数、交通段数），不传整本书。 */
export const PACK_PATH = "/v1/pack";
export const EXTRA_KINDS = ["thermos", "sunglasses", "camera", "boots", "swimRing", "roadmap", "binoculars", "scarf", "umbrella", "plush",
  "hat", "mittens", "powerbank", "headphones", "book", "sketchbook", "neckPillow", "sunscreen", "flashlight", "waterBottle"] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];
export interface PackedExtra { kind: ExtraKind; reason: string }
export interface PackBrief {
  title: string; destination: string; startDate: string; endDate: string; theme: string; days: number;
  season: "spring" | "summer" | "autumn" | "winter";
  /** 站点里离赤道最远的纬度（绝对值）；没有坐标就是 null */
  maxAbsLat: number | null;
  /** 站点类型（shared/world/landmark-kinds.ts 的 id）→ 个数 */
  kinds: Record<string, number>;
  /** 登记在册的名胜数 */
  famous: number;
  /** 交通方式 → 段数 */
  transports: Record<string, number>;
  /** 这个人自己说的一句话（D84，清单的搜索框里打的：「下雨天去京都逛三天」），最多 120 字；没有就不传 */
  note?: string;
}
export interface PackProfile { tripsCount: number; visitedTotal: number }
export interface PackRequest { brief: PackBrief; context: { locale: Locale; profile: PackProfile; candidates: ExtraKind[] } }
export interface PackResponse { extras: PackedExtra[] }
export interface PackResult extends PackResponse { source: "remote" | "local"; fallbackReason?: string }
export const PACK_LIMITS = { extras: 3, reasonChars: 60, briefChars: 4000, noteChars: 120 } as const;

const isCount = (x: unknown) => isObj(x) && Object.values(x).every((n) => isNum(n) && n >= 0);
export function checkPackRequest(body: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(body)) return ["body: 需要 JSON 对象"];
  const { brief, context } = body;
  if (!isObj(brief)) errs.push("brief: 需要对象");
  else {
    for (const k of ["title", "destination", "startDate", "endDate", "theme", "season"] as const) if (typeof brief[k] !== "string") errs.push(`brief.${k}: 需要字符串`);
    if (typeof brief.startDate === "string" && !DATE.test(brief.startDate)) errs.push("brief.startDate: 不是 YYYY-MM-DD");
    if (!["spring", "summer", "autumn", "winter"].includes(brief.season as string)) errs.push("brief.season: 不认识");
    if (!isNum(brief.days) || brief.days < 1) errs.push("brief.days: 需要正数");
    if (brief.maxAbsLat !== null && !(isNum(brief.maxAbsLat) && brief.maxAbsLat >= 0 && brief.maxAbsLat <= 90)) errs.push("brief.maxAbsLat: 0–90 或 null");
    if (!isCount(brief.kinds)) errs.push("brief.kinds: 需要 { 类型: 个数 }");
    if (!isNum(brief.famous) || brief.famous < 0) errs.push("brief.famous: 需要数字");
    if (!isCount(brief.transports)) errs.push("brief.transports: 需要 { 方式: 段数 }");
    if (brief.note !== undefined && (typeof brief.note !== "string" || brief.note.length > PACK_LIMITS.noteChars)) errs.push(`brief.note: 字符串，不超过 ${PACK_LIMITS.noteChars} 字`);
    if (JSON.stringify(brief).length > PACK_LIMITS.briefChars) errs.push(`brief: 超过 ${PACK_LIMITS.briefChars} 字符`);
  }
  if (!isObj(context)) errs.push("context: 需要对象");
  else {
    if (!LOCALES.has(context.locale as string)) errs.push("context.locale: 只能是 zh-Hans / en / ja");
    if (!isObj(context.profile) || !isNum(context.profile.tripsCount) || !isNum(context.profile.visitedTotal)) errs.push("context.profile: 需要 { tripsCount, visitedTotal }");
    if (!Array.isArray(context.candidates) || !context.candidates.every((c) => (EXTRA_KINDS as readonly string[]).includes(c as string))) errs.push("context.candidates: 只能是 EXTRA_KINDS 里的");
  }
  return errs;
}
export function checkPackResponse(body: unknown): string[] {
  if (!isObj(body) || !Array.isArray(body.extras)) return ["extras: 需要数组"];
  const errs: string[] = [];
  body.extras.forEach((e, i) => {
    if (!isObj(e) || !(EXTRA_KINDS as readonly string[]).includes(e.kind as string)) errs.push(`extras[${i}].kind: 不认识`);
    if (!isObj(e) || typeof e.reason !== "string") errs.push(`extras[${i}].reason: 需要字符串`);
  });
  return errs;
}
