/** 服务端测试：假的 Anthropic 客户端（不联网、不花钱），检查请求怎么组、回答怎么变成 Trip、HTTP 层的各种护栏。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import { ClaudePlanner, PlannerError, DEFAULT_MODEL, FALLBACK_BETA, type PlannerClient } from "./planner.ts";
import { createHandler, type HandlerOptions } from "./http.ts";
import { OUTPUT_SCHEMA, type ModelOutput, type ModelDraft } from "./schema.ts";
import { SYSTEM_PROMPT, contextBlock } from "./prompt.ts";
import { toTrip } from "./draft.ts";
import { ClaudePacker, RulesPacker, PACK_SCHEMA, PACK_SYSTEM } from "./pack.ts";
import { EXTRA_KINDS, type PackRequest } from "../../../shared/planner/protocol.ts";
import { validateTrip } from "../../../shared/spec/validate.ts";
import type { PlanRequest } from "../../../shared/planner/protocol.ts";

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Msg = Anthropic.Beta.Messages.BetaMessage;
const NOW = "2026-09-30T08:00:00.000Z";

/** 假客户端：记下每次的参数，按顺序吐出预设的回答 */
function fakeClient(answers: (Partial<Msg> | ((p: Params, signal?: AbortSignal) => Promise<Msg>))[]) {
  const calls: Params[] = [];
  const client: PlannerClient = {
    beta: { messages: { create: async (p, o) => {
      calls.push(p); const a = answers[Math.min(calls.length - 1, answers.length - 1)];
      if (typeof a === "function") return a(p, o?.signal);
      return { id: "msg_1", type: "message", role: "assistant", model: DEFAULT_MODEL, content: [], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 }, ...a } as unknown as Msg;
    } } },
  };
  return { client, calls };
}
const answer = (o: ModelOutput): Partial<Msg> => ({ content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text: JSON.stringify(o), citations: null }] as unknown as Msg["content"] });

const REQ: PlanRequest = { messages: [{ role: "user", text: "下周五去京都玩三天，想看红叶" }], context: { today: "2026-09-30", locale: "zh-Hans", home: { name: "上海", lat: 31.23, lng: 121.47 }, trips: [{ title: "冰岛", startDate: "2026-11-01", endDate: "2026-11-08" }] } };

const DRAFT: ModelDraft = {
  title: "京都红叶3日", destination: "京都", startDate: "2026-10-09", theme: "红叶古都",
  days: [
    { title: "抵达，东山", lodging: "四条河原町", stops: [
      { name: "京都站", category: "station", kind: "station", lat: 34.9858, lng: 135.7588, plannedStart: "10:00", stayMinutes: 20, notes: null, next: { mode: "bus", label: "市巴士 206", durationMinutes: 20, distanceKm: 4.5 } },
      { name: "清水寺", category: "sight", kind: "temple", lat: 34.9949, lng: 135.785, plannedStart: "10:40", stayMinutes: 90, notes: "早上人少", next: { mode: "walk", label: "步行", durationMinutes: 15, distanceKm: 1.2 } },
      { name: "祇园", category: "sight", kind: "oldtown", lat: 35.0037, lng: 135.7788, plannedStart: "9:5", stayMinutes: 60, notes: null, next: { mode: "walk", label: "步行", durationMinutes: 10, distanceKm: 0.8 } },
      { name: "四条河原町的酒店", category: "hotel", kind: "hotel", lat: 35.0036, lng: 135.7690, plannedStart: null, stayMinutes: null, notes: null, next: { mode: "walk", label: "多余的一段", durationMinutes: 1, distanceKm: 0 } },
    ] },
    { title: "岚山", lodging: "四条河原町", stops: [
      { name: "竹林小径", category: "sight", kind: "forest", lat: 35.0170, lng: 135.6717, plannedStart: "08:30", stayMinutes: 45, notes: null, next: null },
    ] },
    { title: "返程", lodging: null, stops: [
      { name: "不知道在哪", category: "sight", kind: "not-a-kind", lat: 999, lng: 0, plannedStart: "25:00", stayMinutes: -5, notes: "  ", next: null },
    ] },
  ],
};

// ---------------------------------------------------------------- 请求怎么组
test("请求：模型、结构化输出、effort、缓存断点、拒答回退；不关思考、不强制工具", async () => {
  const { client, calls } = fakeClient([answer({ reply: "好", question: null, done: true, draft: DRAFT })]);
  await new ClaudePlanner({ client, now: () => NOW }).plan(REQ);
  const p = calls[0];
  assert.equal(p.model, "claude-opus-5-5");
  assert.equal(p.max_tokens, 16000);
  assert.deepEqual(p.output_config?.format, { type: "json_schema", schema: OUTPUT_SCHEMA });
  assert.equal(p.output_config?.effort, "medium");
  assert.equal(p.fallbacks, "default"); assert.deepEqual(p.betas, [FALLBACK_BETA]);
  assert.equal(p.thinking, undefined); assert.equal(p.tool_choice, undefined); assert.equal(p.tools, undefined);
  assert.ok(Array.isArray(p.system)); const sys = p.system as Anthropic.Beta.Messages.BetaTextBlockParam[];
  assert.equal(sys.length, 1); assert.equal(sys[0].text, SYSTEM_PROMPT); assert.deepEqual(sys[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(p.cache_control, { type: "ephemeral" });
  assert.equal(p.messages[0].role, "user");
  const first = p.messages[0].content as Anthropic.Beta.Messages.BetaTextBlockParam[];
  assert.equal(first[0].text, contextBlock(REQ.context)); assert.match(first[0].text, /"today":"2026-09-30"/); assert.match(first[0].text, /"weekday":"Wednesday"/); assert.match(first[0].text, /existingTrips/);
  assert.equal(first[1].text, REQ.messages[0].text);
});

test("系统提示词是固定前缀：不含今天的日期，带 Trip 的 JSON Schema 与全部主题", () => {
  assert.doesNotMatch(SYSTEM_PROMPT, /2026-09-30/);
  assert.match(SYSTEM_PROMPT, /"schemaVersion": \{ "const": "0.3" \}/);
  for (const t of ["红叶古都", "极光冰原", "海风港町", "温泉雪国", "都市霓虹", "樱花春日", "离岛夏日"]) assert.ok(SYSTEM_PROMPT.includes(t));
  assert.ok(SYSTEM_PROMPT.length > 2000);                              // 超过 Opus 5.5 的最小缓存长度（512 token）
});

test("多轮：开头的 assistant 开场白丢掉，后面的轮次原样接上", () => {
  const { client } = fakeClient([]);
  const p = new ClaudePlanner({ client }).buildParams({ messages: [{ role: "assistant", text: "说说你想去哪儿" }, { role: "user", text: "京都" }, { role: "assistant", text: "去京都。打算哪天出发，玩几天？" }, { role: "user", text: "下周五，三天" }], context: REQ.context });
  assert.deepEqual(p.messages.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(p.messages[2].content, "下周五，三天");
});

test("结构化输出的 schema：每个对象都 additionalProperties:false 且字段全 required，不用不支持的约束", () => {
  const walk = (s: unknown, path: string) => {
    if (!s || typeof s !== "object") return;
    const o = s as Record<string, unknown>;
    for (const k of ["minimum", "maximum", "minLength", "maxLength", "pattern", "minItems", "maxItems", "oneOf", "$ref"]) assert.ok(!(k in o), `${path} 用了 ${k}`);
    if (o.type === "object") {
      assert.equal(o.additionalProperties, false, `${path}.additionalProperties`);
      assert.deepEqual([...(o.required as string[])].sort(), Object.keys(o.properties as object).sort(), `${path}.required`);
    }
    for (const [k, v] of Object.entries(o)) if (typeof v === "object") walk(v, `${path}.${k}`);
  };
  walk(OUTPUT_SCHEMA, "$");
});

// ---------------------------------------------------------------- 回答怎么变成 Trip
test("草稿 → spec 0.3 的 Trip：日期、站点 + 交通、坐标、类型、住处；过 validateTrip", async () => {
  const { client } = fakeClient([answer({ reply: "排好了，三天。", question: null, done: true, draft: DRAFT })]);
  const r = await new ClaudePlanner({ client, now: () => NOW }).plan(REQ);
  assert.equal(r.reply, "排好了，三天。"); assert.equal(r.done, true); assert.equal(r.question, undefined);
  const t = r.draft!; assert.deepEqual(validateTrip(t), []);
  assert.equal(t.schemaVersion, "0.3"); assert.equal(t.status, "planning"); assert.equal(t.createdAt, NOW);
  assert.equal(t.startDate, "2026-10-09"); assert.equal(t.endDate, "2026-10-11");
  assert.deepEqual(t.days.map((d) => d.date), ["2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.ok(t.days.every((d) => d.city === "geo"));
  const d1 = t.days[0];
  assert.deepEqual(d1.entries.map((e) => e.type), ["place", "transport", "place", "transport", "place", "transport", "place"]);   // 最后一站的 next 不要
  assert.deepEqual(d1.entries.map((e) => e.id), ["d1-e0", "d1-e1", "d1-e2", "d1-e3", "d1-e4", "d1-e5", "d1-e6"]);
  const kiyo = d1.entries[2]; assert.ok(kiyo.type === "place" && kiyo.kind === "temple" && kiyo.geo?.lat === 34.9949 && kiyo.notes === "早上人少");
  const gion = d1.entries[4]; assert.ok(gion.type === "place" && gion.plannedStart === undefined);                       // 9:5 不像时间
  const bus = d1.entries[1]; assert.ok(bus.type === "transport" && bus.mode === "bus" && bus.durationMinutes === 20 && bus.distanceKm === 4.5);
  assert.equal(d1.lodging, "四条河原町");
  // 第三天的坐标不合法：借前一天的最后一个坐标补一个住处，保证能生成底板
  const d3 = t.days[2]; const bad = d3.entries[0];
  assert.ok(bad.type === "place" && bad.geo === undefined && bad.kind === undefined && bad.plannedStart === undefined && bad.stayMinutes === undefined && bad.notes === undefined);
  const filler = d3.entries[1]; assert.ok(filler.type === "place" && filler.category === "hotel" && filler.geo?.lat === 35.017);
});

test("追问：没有草稿时 done 一定是 false", async () => {
  const { client } = fakeClient([answer({ reply: "去京都。", question: "打算哪天出发，玩几天？", done: true, draft: null })]);
  const r = await new ClaudePlanner({ client }).plan({ ...REQ, messages: [{ role: "user", text: "想去京都" }] });
  assert.deepEqual(r, { reply: "去京都。", question: "打算哪天出发，玩几天？", done: false });
});

test("草稿没法用（没有一个有效坐标）：丢掉草稿，只回话", async () => {
  const broken: ModelDraft = { ...DRAFT, days: [{ title: "x", lodging: null, stops: [{ ...DRAFT.days[2].stops[0] }] }] };
  const { client } = fakeClient([answer({ reply: "好", question: null, done: true, draft: broken })]);
  const r = await new ClaudePlanner({ client }).plan(REQ);
  assert.equal(r.draft, undefined); assert.equal(r.done, false);
  assert.deepEqual(toTrip({ ...DRAFT, startDate: "10月9日" }, { now: NOW }).errors, ["startDate: 10月9日"]);
  assert.equal(toTrip({ ...DRAFT, days: Array.from({ length: 40 }, () => DRAFT.days[1]) }, { now: NOW }).trip!.days.length, 30);
});

test("拒答、截断、看不懂的输出、上游报错都变成带状态码的错误", async () => {
  const cases: [Partial<Msg> | (() => Promise<Msg>), number][] = [
    [{ stop_reason: "refusal" }, 422],
    [{ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"reply\":", citations: null }] as unknown as Msg["content"] }, 502],
    [{ content: [{ type: "text", text: "not json", citations: null }] as unknown as Msg["content"] }, 502],
    [async () => { throw new Error("boom"); }, 500],
  ];
  for (const [a, status] of cases) {
    const { client } = fakeClient([a]);
    await assert.rejects(new ClaudePlanner({ client }).plan(REQ), (e: unknown) => e instanceof PlannerError && e.status === status);
  }
});

// ---------------------------------------------------------------- HTTP
async function withServer(opts: Partial<HandlerOptions> & Pick<HandlerOptions, "planner">, fn: (base: string) => Promise<void>) {
  const handler = createHandler({ allowedOrigins: ["http://localhost:5173"], ...opts });
  const server: Server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try { await fn(base); } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
}
const post = (base: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + "/v1/plan", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("HTTP：正常一轮、CORS（允许的来源、预检、没有 Origin 的原生请求）", async () => {
  const { client } = fakeClient([answer({ reply: "好", question: null, done: true, draft: DRAFT })]);
  await withServer({ planner: new ClaudePlanner({ client, now: () => NOW }) }, async (base) => {
    const r = await post(base, REQ, { origin: "http://localhost:5173" });
    assert.equal(r.status, 200); assert.equal(r.headers.get("access-control-allow-origin"), "http://localhost:5173");
    const body = await r.json() as { draft: unknown; done: boolean };
    assert.equal(body.done, true); assert.deepEqual(validateTrip(body.draft), []);

    const pre = await fetch(base + "/v1/plan", { method: "OPTIONS", headers: { origin: "http://localhost:5173", "access-control-request-method": "POST" } });
    assert.equal(pre.status, 204); assert.match(pre.headers.get("access-control-allow-methods") ?? "", /POST/);

    const bad = await post(base, REQ, { origin: "https://evil.example" });
    assert.equal(bad.status, 403); assert.deepEqual(await bad.json(), { error: "origin not allowed" });

    assert.equal((await post(base, REQ)).status, 200);                    // 原生 App：没有 Origin
    assert.equal((await fetch(base + "/healthz")).status, 200);
  });
});

test("HTTP：尺寸、格式、路由的护栏", async () => {
  const { client } = fakeClient([answer({ reply: "好", question: null, done: false, draft: null })]);
  await withServer({ planner: new ClaudePlanner({ client }), burst: 50, perMinute: 600 }, async (base) => {
    assert.equal((await post(base, "{not json")).status, 400);
    assert.equal((await post(base, { messages: [], context: REQ.context })).status, 400);
    assert.equal((await post(base, { ...REQ, messages: [{ role: "user", text: "x".repeat(70 * 1024) }] })).status, 413);
    assert.equal((await fetch(base + "/v1/plan", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })).status, 415);
    assert.equal((await fetch(base + "/v1/plan")).status, 405);
    assert.equal((await fetch(base + "/nope")).status, 404);
  });
});

test("HTTP：每个 IP 限频（令牌桶），超了回 429 带 Retry-After", async () => {
  const { client } = fakeClient([answer({ reply: "好", question: null, done: false, draft: null })]);
  let now = 0;
  await withServer({ planner: new ClaudePlanner({ client }), burst: 2, perMinute: 6, clock: () => now }, async (base) => {
    assert.equal((await post(base, REQ)).status, 200);
    assert.equal((await post(base, REQ)).status, 200);
    const r = await post(base, REQ); assert.equal(r.status, 429); assert.equal(r.headers.get("retry-after"), "10");
    now += 10_000;                                                         // 过 10 秒补回一个
    assert.equal((await post(base, REQ)).status, 200);
  });
});

const okMsg = () => ({ ...answer({ reply: "好", question: null, done: false, draft: null }), id: "m", type: "message", role: "assistant", model: DEFAULT_MODEL, stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }) as unknown as Msg;
const abortable = (signal: AbortSignal | undefined, onAbort: () => void) => new Promise<Msg>((_, reject) =>
  signal?.addEventListener("abort", () => { onAbort(); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); }));

test("HTTP：并发上限，满了回 503", async () => {
  let release: () => void = () => {}; const gate = new Promise<void>((r) => { release = r; });
  const { client } = fakeClient([async () => { await gate; return okMsg(); }]);
  await withServer({ planner: new ClaudePlanner({ client }), maxConcurrent: 1, burst: 10 }, async (base) => {
    const first = post(base, REQ);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal((await post(base, REQ)).status, 503);
    release(); assert.equal((await first).status, 200);
  });
});

test("HTTP：客户端断开时取消上游请求", async () => {
  let sawAbort = false;
  const { client } = fakeClient([(_p, signal) => abortable(signal, () => { sawAbort = true; })]);
  await withServer({ planner: new ClaudePlanner({ client }) }, async (base) => {
    const ctl = new AbortController();
    const p = fetch(base + "/v1/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(REQ), signal: ctl.signal }).catch(() => null);
    await new Promise((r) => setTimeout(r, 80)); ctl.abort(); await p;
    for (let i = 0; i < 20 && !sawAbort; i++) await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(sawAbort, true);
});

// ---------------------------------------------------------------- 让 AI 装箱（/v1/pack）
const PACK_REQ: PackRequest = {
  brief: { title: "冰岛环岛", destination: "冰岛", startDate: "2026-10-01", endDate: "2026-10-04", theme: "极光冰原", days: 4, season: "autumn", maxAbsLat: 64.1, kinds: { church: 1, hotspring: 1, waterfall: 2, beach: 2 }, famous: 5, transports: { car: 3 } },
  context: { locale: "zh-Hans", profile: { tripsCount: 4, visitedTotal: 12 }, candidates: [...EXTRA_KINDS] },
};
const packAnswer = (extras: unknown): Partial<Msg> => ({ content: [{ type: "text", text: JSON.stringify({ extras }), citations: null }] as unknown as Msg["content"] });

test("装箱：请求用结构化输出、低 effort；回答只留候选里的、去重、最多三样、理由截短", async () => {
  const { client, calls } = fakeClient([packAnswer([{ kind: "thermos", reason: "十月的冰岛夜里冷" }, { kind: "thermos", reason: "重复" }, { kind: "jetpack", reason: "不在候选里" }, { kind: "camera", reason: "名".repeat(80) }, { kind: "plush", reason: "第四趟了" }, { kind: "boots", reason: "多出来的第四样" }])]);
  const out = await new ClaudePacker({ client }).pack(PACK_REQ);
  const p = calls[0];
  assert.equal(p.model, "claude-opus-5-5"); assert.equal(p.max_tokens, 1500);
  assert.deepEqual(p.output_config, { effort: "low", format: { type: "json_schema", schema: PACK_SCHEMA } });
  assert.deepEqual(p.system, [{ type: "text", text: PACK_SYSTEM, cache_control: { type: "ephemeral" } }]);
  assert.deepEqual(out.extras.map((e) => e.kind), ["thermos", "camera", "plush"]);
  assert.equal(out.extras[1].reason.length, 60);
});

test("装箱：模型拒答、输出不可用或一样没挑 → 本机规则", async () => {
  const refuse = fakeClient([{ stop_reason: "refusal" } as Partial<Msg>]);
  const a = await new ClaudePacker({ client: refuse.client }).pack(PACK_REQ);
  const rules = await new RulesPacker().pack(PACK_REQ);
  assert.deepEqual(a, rules); assert.ok(rules.extras.length > 0 && rules.extras[0].kind === "thermos");
  const garbage = fakeClient([{ content: [{ type: "text", text: "not json", citations: null }] as unknown as Msg["content"] }]);
  assert.deepEqual(await new ClaudePacker({ client: garbage.client }).pack(PACK_REQ), rules);
  const empty = fakeClient([packAnswer([])]);
  assert.deepEqual(await new ClaudePacker({ client: empty.client }).pack(PACK_REQ), rules);
});

test("HTTP：/v1/pack 走同一套护栏；没配 packer 时 404", async () => {
  const { client } = fakeClient([packAnswer([{ kind: "camera", reason: "名胜多" }])]);
  await withServer({ planner: new ClaudePlanner({ client }), packer: new ClaudePacker({ client }) }, async (base) => {
    const r = await fetch(base + "/v1/pack", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:5173" }, body: JSON.stringify(PACK_REQ) });
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { extras: [{ kind: "camera", reason: "名胜多" }] });
    const bad = await fetch(base + "/v1/pack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...PACK_REQ, brief: { ...PACK_REQ.brief, season: "monsoon" } }) });
    assert.equal(bad.status, 400);
  });
  await withServer({ planner: new ClaudePlanner({ client }) }, async (base) => {
    assert.equal((await fetch(base + "/v1/pack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(PACK_REQ) })).status, 404);
  });
});
