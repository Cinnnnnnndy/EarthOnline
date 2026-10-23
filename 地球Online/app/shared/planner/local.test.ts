/** 行程规划：本机规则（中英文各类说法、追问、改口、确定性）+ 远端客户端（超时、退回、草稿校验、中断） */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalRulePlanner, readSlots, cnNum, MSG } from "./local.ts";
import { RemotePlanner, planUrl, trimRequest } from "./remote.ts";
import { assistantText, checkPlanRequest, LIMITS, type PlannerContext, type PlannerMessage, type PlanRequest } from "./protocol.ts";
import { validateTrip } from "../spec/validate.ts";
import { THEMES } from "../spec/types.ts";

const TODAY = "2026-09-30";                                     // 周三
const NOW = "2026-09-30T08:00:00.000Z";
const planner = new LocalRulePlanner({ now: () => NOW });
const ctx = (locale: PlannerContext["locale"] = "zh-Hans", extra: Partial<PlannerContext> = {}): PlannerContext => ({ today: TODAY, locale, ...extra });
const one = (text: string, locale: PlannerContext["locale"] = "zh-Hans", extra: Partial<PlannerContext> = {}) => planner.planSync({ messages: [{ role: "user", text }], context: ctx(locale, extra) });
/** 按真实对话的样子接上：每轮的回复写回历史 */
function talk(lines: string[], locale: PlannerContext["locale"] = "zh-Hans") {
  const messages: PlannerMessage[] = []; let r = planner.planSync({ messages: [{ role: "user", text: lines[0] }], context: ctx(locale) });
  messages.push({ role: "user", text: lines[0] });
  for (const line of lines.slice(1)) { messages.push({ role: "assistant", text: assistantText(r) }, { role: "user", text: line }); r = planner.planSync({ messages: [...messages], context: ctx(locale) }); }
  return r;
}
function draftOf(r: ReturnType<typeof one>) { assert.ok(r.draft, `应当给出草稿：${r.reply} ${r.question ?? ""}`); assert.deepEqual(validateTrip(r.draft), []); return r.draft; }

// ---------------------------------------------------------------- 中文
test("下周五去京都玩三天：一句话齐了，给关西手画底板的书", () => {
  const r = one("下周五去京都玩三天"); const t = draftOf(r);
  assert.equal(r.done, true); assert.equal(r.question, undefined);
  assert.equal(t.destination, "京都"); assert.equal(t.startDate, "2026-10-09"); assert.equal(t.endDate, "2026-10-11");
  assert.deepEqual(t.days.map((d) => d.title), ["京都，抵达", "第 2 天", "京都，返程"]);
  assert.ok(t.days.every((d) => d.city === "kyoto" && d.entries.length === 0));
  assert.equal(t.title, "京都3日"); assert.equal(t.theme, "红叶古都"); assert.equal(t.status, "planning");
  assert.match(r.reply, /排好了/); assert.doesNotMatch(r.reply, /·/);
});

test("我想去冰岛看极光：有目的地没日期，只追问一句", () => {
  const r = one("我想去冰岛看极光");
  assert.equal(r.draft, undefined); assert.equal(r.done, false);
  assert.equal(r.question, MSG["zh-Hans"].ask.whenDays);
  assert.equal(readSlots({ messages: [{ role: "user", text: "我想去冰岛看极光" }], context: ctx() }).theme, "极光冰原");
});

test("10月3号出发，5天：有日期没目的地，问去哪儿，并复述听到的日期", () => {
  const r = one("10月3号出发，5天");
  assert.equal(r.question, MSG["zh-Hans"].ask.dest); assert.match(r.reply, /10月3日（周六）出发，玩5天/);
});

test("多轮：想去大阪 → 下个月，一周", () => {
  const t = draftOf(talk(["想去大阪", "下个月，一周"]));
  assert.equal(t.startDate, "2026-10-01"); assert.equal(t.days.length, 7); assert.equal(t.days[0].city, "osaka");
});

test("这个周末去杭州：周末默认两天，地理切块带住处坐标（与 createTrip 同形）", () => {
  const t = draftOf(one("这个周末去杭州"));
  assert.equal(t.startDate, "2026-10-03"); assert.equal(t.days.length, 2);
  for (const d of t.days) {
    assert.equal(d.city, "geo"); assert.equal(d.entries.length, 1);
    const e = d.entries[0]; assert.ok(e.type === "place" && e.category === "hotel" && e.geo && Math.abs(e.geo.lat - 30.27) < 0.2);
    assert.equal(e.id, `d${d.index}-e0`);
  }
});

test("国庆带爸妈去成都，轻松一点，五天四晚：节日、同行、节奏", () => {
  const r = one("国庆带爸妈去成都，轻松一点，五天四晚"); const t = draftOf(r);
  assert.equal(t.startDate, "2026-10-01"); assert.equal(t.days.length, 5);
  const s = readSlots({ messages: [{ role: "user", text: "国庆带爸妈去成都，轻松一点，五天四晚" }], context: ctx() });
  assert.equal(s.companions, "family"); assert.equal(s.pace, "relaxed");
  assert.match(r.reply, /和家人，节奏轻松/);
});

test("三天后从上海出发去东京，一个星期：出发地不算目的地", () => {
  const t = draftOf(one("三天后从上海出发去东京，一个星期"));
  assert.equal(t.destination, "东京"); assert.equal(t.startDate, "2026-10-03"); assert.equal(t.days.length, 7);
});

test("改口：不去京都了，改去奈良；多玩一天", () => {
  const t = draftOf(talk(["下周五去京都玩三天", "不去京都了，改去奈良", "再多玩一天"]));
  assert.equal(t.destination, "奈良"); assert.equal(t.days.length, 4); assert.equal(t.startDate, "2026-10-09");
});

test("去三亚，随便哪天都行：按默认日期排，并说明是默认的", () => {
  const r = one("去三亚，随便哪天都行"); const t = draftOf(r);
  assert.equal(t.startDate, "2026-10-10"); assert.equal(t.days.length, 3); assert.equal(t.theme, "离岛夏日");
  assert.match(r.reply, /日期没定/);
});

test("景点落到最近的城市：想去清水寺 → 京都", () => {
  const r = one("想去清水寺"); assert.match(r.reply, /去京都/); assert.equal(r.question, MSG["zh-Hans"].ask.whenDays);
});

test("泡温泉看雪，去札幌，12月20号出发，4天：主题读温泉雪国", () => {
  const t = draftOf(one("我想去泡温泉看雪，去札幌，12月20号出发，4天"));
  assert.equal(t.theme, "温泉雪国"); assert.equal(t.startDate, "2026-12-20"); assert.equal(t.days.length, 4);
});

test("你好：什么都没说，问去哪儿", () => {
  const r = one("你好"); assert.equal(r.question, MSG["zh-Hans"].ask.dest); assert.equal(r.done, false);
});

test("去巴黎玩四十天，下个月5号走：超过 30 天截断并说明", () => {
  const r = one("去巴黎玩四十天，下个月5号走"); const t = draftOf(r);
  assert.equal(t.days.length, 30); assert.equal(t.startDate, "2026-10-05"); assert.match(r.reply, /最多 30 天/);
});

test("「第一天」不是天数、「至少三天」不是减三天", () => {
  const s = readSlots({ messages: [{ role: "user", text: "第一天想去清水寺，至少三天" }], context: ctx() });
  assert.equal(s.days, 3); assert.equal(s.destination?.name, "京都");
});

test("回答「玩几天？」只说一个数也认", () => {
  const t = draftOf(talk(["去西安", "3", "下周六"]));
  assert.equal(t.days.length, 3); assert.equal(t.startDate, "2026-10-10");
});

test("日期和已有的书重叠时提醒", () => {
  const r = one("下周五去京都玩三天", "zh-Hans", { trips: [{ title: "关西七日", startDate: "2026-10-08", endDate: "2026-10-14" }] });
  assert.match(r.reply, /和「关西七日」重叠了/);
});

// ---------------------------------------------------------------- English
test("en: Kyoto next Friday for 3 days", () => {
  const r = one("Kyoto next Friday for 3 days", "en"); const t = draftOf(r);
  assert.equal(t.destination, "Kyoto"); assert.equal(t.startDate, "2026-10-09"); assert.equal(t.days.length, 3);
  assert.deepEqual(t.days.map((d) => d.title), ["Arrive in Kyoto", "Day 2", "Leave Kyoto"]);
  assert.match(r.reply, /^Planned: /);
});

test("en: Paris for a week → asks only when", () => {
  const r = one("I want to go to Paris for a week", "en");
  assert.equal(r.question, MSG.en.ask.when); assert.match(r.reply, /Paris for 7 days/);
});

test("en: Iceland on October 3rd, 5 days, northern lights", () => {
  const t = draftOf(one("Take me to Iceland on October 3rd, 5 days, to see the northern lights", "en"));
  assert.equal(t.destination, "Iceland"); assert.equal(t.startDate, "2026-10-03"); assert.equal(t.days.length, 5); assert.equal(t.theme, "极光冰原");
});

test("en: this weekend in Tokyo with my kids", () => {
  const r = one("this weekend in Tokyo with my kids", "en"); const t = draftOf(r);
  assert.equal(t.startDate, "2026-10-03"); assert.equal(t.days.length, 2); assert.match(r.reply, /with kids/);
});

test("en: in 10 days, Bangkok, 4 nights", () => {
  const t = draftOf(one("in 10 days, Bangkok, 4 nights", "en"));
  assert.equal(t.startDate, "2026-10-10"); assert.equal(t.days.length, 5); assert.equal(t.destination, "Bangkok");
});

test("en: next month with no destination asks where", () => {
  const r = one("next month", "en"); assert.equal(r.question, MSG.en.ask.dest); assert.match(r.reply, /Oct 1/);
});

test("en: skip Kyoto, go to Nara instead; one more day", () => {
  const t = draftOf(talk(["Kyoto next Friday for 3 days", "not Kyoto, Nara instead", "one more day"], "en"));
  assert.equal(t.destination, "Nara"); assert.equal(t.days.length, 4);
});

test("中文界面里说英文地名：写成中文名", () => {
  const t = draftOf(one("Paris, next Friday, 3 days"));
  assert.equal(t.destination, "巴黎"); assert.equal(t.title, "巴黎3日");
});

// ---------------------------------------------------------------- 通用
test("确定性：同一段对话、同一个时钟，结果完全一样；每本书都合规、主题在 THEMES 里", () => {
  const req: PlanRequest = { messages: [{ role: "user", text: "下周五去京都玩三天" }], context: ctx() };
  assert.deepEqual(planner.planSync(req), planner.planSync(req));
  for (const text of ["下周五去京都玩三天", "这个周末去杭州", "去三亚，随便哪天都行", "国庆带爸妈去成都，五天四晚"]) {
    const t = draftOf(one(text)); assert.ok((THEMES as readonly string[]).includes(t.theme)); assert.ok(t.title.length <= 40);
  }
});

test("中文数字", () => {
  assert.equal(cnNum("三"), 3); assert.equal(cnNum("十"), 10); assert.equal(cnNum("十二"), 12); assert.equal(cnNum("二十五"), 25); assert.equal(cnNum("两"), 2); assert.equal(cnNum("三四"), 4); assert.equal(cnNum("12"), 12);
});

test("协议：请求检查", () => {
  assert.deepEqual(checkPlanRequest({ messages: [{ role: "user", text: "去京都" }], context: ctx() }), []);
  assert.ok(checkPlanRequest({ messages: [], context: ctx() }).length);
  assert.ok(checkPlanRequest({ messages: [{ role: "system", text: "x" }], context: ctx() }).length);
  assert.ok(checkPlanRequest({ messages: [{ role: "user", text: "x".repeat(LIMITS.textChars + 1) }], context: ctx() }).length);
  assert.ok(checkPlanRequest({ messages: [{ role: "user", text: "去京都" }], context: { today: "明天", locale: "zh-Hans" } }).length);
  assert.ok(checkPlanRequest({ messages: [{ role: "user", text: "去京都" }, { role: "assistant", text: "好" }], context: ctx() }).length);
});

// ---------------------------------------------------------------- 远端客户端
const REQ: PlanRequest = { messages: [{ role: "user", text: "下周五去京都玩三天" }], context: ctx() };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("远端：地址规范化、成功时原样返回并标来源", async () => {
  assert.equal(planUrl("https://x.dev/"), "https://x.dev/v1/plan"); assert.equal(planUrl("https://x.dev/v1/plan"), "https://x.dev/v1/plan");
  const draft = planner.planSync(REQ).draft!;
  let sent: unknown = null;
  const rp = new RemotePlanner({ endpoint: "https://x.dev", fetch: async (_u, init) => { sent = JSON.parse(String(init?.body)); return json(200, { reply: "好", question: null, draft, done: true }); } });
  const r = await rp.plan(REQ);
  assert.equal(r.source, "remote"); assert.equal(r.reply, "好"); assert.equal(r.question, undefined); assert.deepEqual(r.draft, draft);
  assert.deepEqual(sent, REQ);
});

test("远端：非 200、草稿不合规、超时都退回本机规则", async () => {
  const reasons: string[] = [];
  const bad = new RemotePlanner({ endpoint: "https://x.dev", onFallback: (r) => reasons.push(r), fetch: async () => json(503, { error: "busy" }) });
  const r1 = await bad.plan(REQ); assert.equal(r1.source, "local"); assert.ok(r1.draft); assert.match(r1.fallbackReason!, /503: busy/);

  const invalid = new RemotePlanner({ endpoint: "https://x.dev", fetch: async () => json(200, { reply: "好", draft: { title: "x" }, done: true }) });
  const r2 = await invalid.plan(REQ); assert.equal(r2.source, "local"); assert.match(r2.fallbackReason!, /invalid draft/);

  const slow = new RemotePlanner({ endpoint: "https://x.dev", timeoutMs: 30, fetch: (_u, init) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))) });
  const r3 = await slow.plan(REQ); assert.equal(r3.source, "local"); assert.match(r3.fallbackReason!, /timeout/);
  assert.equal(reasons.length, 1);
});

test("远端：调用方中断时直接抛出，不退回", async () => {
  const ctl = new AbortController();
  const rp = new RemotePlanner({ endpoint: "https://x.dev", fetch: (_u, init) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))) });
  const p = rp.plan(REQ, { signal: ctl.signal }); ctl.abort();
  await assert.rejects(p);
});

test("远端：超长对话先裁掉早的几轮", () => {
  const messages: PlannerMessage[] = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `第${i}句` }));
  messages.push({ role: "user", text: "最后" });
  const r = trimRequest({ messages, context: ctx() });
  assert.ok(r.messages.length <= LIMITS.messages); assert.equal(r.messages[0].text, "第0句"); assert.equal(r.messages.at(-1)!.text, "最后");
  assert.deepEqual(checkPlanRequest(r), []);
});
