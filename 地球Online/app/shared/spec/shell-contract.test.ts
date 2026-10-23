/** 三端契约（D97）：iOS、鸿蒙、安卓的源码里写死的消息种类、核心函数名、文案键，都得在共用的表里。
 *  原生壳在这台机器上编译不了（没有 Xcode / DevEco / Android SDK），拼错一个 kind 只会在真机上「什么都没发生」——
 *  这里用正则扫源码，把这类错拦在 npm test。扫的是写法固定的那几处（各壳的 WorldMessages、事件分发、CoreApi、I18n 调用），
 *  动态拼出来的键（"case.style." + s）不查。
 *
 *  查五件事：
 *   1. bridge.ts 里原生 → 世界层的每一种消息都在 channels.ts 的 CHANNEL_OF 里（反过来类型检查已经管了）；
 *   2. 各壳发出去的 kind 都是 bridge.ts 里有的，收进来分发的 kind 也都是世界层真会发的；
 *   3. 发了要回话的请求（core-call、export-long-image……），就得处理对应的回话；
 *   4. iOS 手写的频道（WorldChannel 与每条消息的 channel）和 channels.ts 一致（鸿蒙、安卓读的是生成的表，check:shared 管）；
 *   5. 各壳调的核心函数在 core.ts 里，用到的文案键在 zh-Hans 消息表里。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CHANNELS, CHANNEL_OF } from "./channels.ts";
import { CORE_FNS } from "../core.ts";
import { ZH } from "../i18n/zh-Hans.ts";

const APP = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(join(APP, rel), "utf8");
function files(rel: string, ext: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p); else if (name.endsWith(ext)) out.push(p);
    }
  };
  walk(join(APP, rel));
  return out;
}
const readAll = (rel: string, ext: string) => files(rel, ext).map((p) => readFileSync(p, "utf8")).join("\n");
const all = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m[1]);

/** marker 之后第一个 { 到与它配对的 }（数花括号；源码里字符串中的括号在这几处没有） */
function block(src: string, marker: string): string {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `找不到 ${marker}`);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${marker} 的花括号没配上`);
}

/** bridge.ts 的四组消息（按类型名） */
function bridgeKinds(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  let cur: Set<string> | null = null;
  for (const line of read("shared/spec/bridge.ts").split("\n")) {
    const head = line.match(/^export type (\w+) =\s*$/);
    if (head) { cur = out[head[1]] = new Set(); continue; }
    if (!cur) continue;
    if (!/^\s*(\||\/\/|\/\*|\*)/.test(line)) { cur = null; continue; }
    for (const k of all(line, /kind: "([a-z-]+)"/g)) cur.add(k);
  }
  return out;
}

const B = bridgeKinds();
const OUT = new Set([...B.NativeToWorld, ...B.ShellToEmbed]);
/** iOS 在页面一开头注入的探针发的 bridge-ready（WorldController.readyProbe），不是嵌入页的消息，三端都当 ready 认 */
const SHELL_INTERNAL = ["bridge-ready"];
const IN = new Set([...B.WorldToNative, ...B.EmbedToShell, ...SHELL_INTERNAL]);
/** 要回话的请求 → 回话 */
const REPLY_OF: Record<string, string> = {
  "core-call": "core-result", "import-page": "import-result", "export-long-image": "long-image",
  "export-suitcase": "suitcase-image", "case-search": "case-results", "case-toggle": "case-edits", "make-card": "card-made",
};

const missing = (used: Iterable<string>, known: Set<string> | readonly string[]) => {
  const k = known instanceof Set ? known : new Set(known);
  return [...new Set(used)].filter((x) => !k.has(x)).sort();
};

// 各壳：发出去的、收进来分发的
const KT = "android/app/src/main/java/app/earthonline/android";
const ETS = "harmony/entry/src/main/ets";
const SW = "ios/EarthOnline";
const whenArms = (src: string) => all(src, /^\s*((?:"[a-z-]+"\s*,\s*)*"[a-z-]+")\s*->/gm).flatMap((s) => all(s, /"([a-z-]+)"/g));
const swiftCases = (src: string) => all(src, /^\s*case ((?:"[a-z-]+"\s*,\s*)*"[a-z-]+")\s*:/gm).flatMap((s) => all(s, /"([a-z-]+)"/g));

const SHELLS: Record<string, { sent: string[]; handled: string[] }> = {
  android: {
    sent: all(readAll(KT, ".kt"), /\bmsg\("([a-z-]+)"/g),
    handled: [
      ...whenArms(block(read(`${KT}/app/AppModel.kt`), "when (e.kind)")),
      ...whenArms(block(read(`${KT}/world/WorldController.kt`), "when (kind)")),
      ...whenArms(block(read(`${KT}/world/SuitcaseBridge.kt`), 'when ((obj["kind"]')),
    ],
  },
  harmony: {
    sent: all(read(`${ETS}/world/WorldMessages.ets`), /super\('([a-z-]+)'\)/g),
    handled: [
      ...all(block(read(`${ETS}/model/AppModel.ets`), "switch (e.kind)"), /case '([a-z-]+)':/g),
      ...all(read(`${ETS}/world/WorldController.ets`) + read(`${ETS}/world/SuitcaseBridge.ets`), /e\.kind === '([a-z-]+)'/g),
    ],
  },
  ios: {
    sent: [
      ...all(read(`${SW}/World/WorldMessages.swift`), /var kind = "([a-z-]+)"/g),
      ...all(readAll(SW, ".swift"), /\\"kind\\":\s*\\"([a-z-]+)/g),
      ...all(readAll(SW, ".swift"), /"kind":\s*"([a-z-]+)"/g),
    ],
    handled: [
      ...swiftCases(block(read(`${SW}/World/WorldMessages.swift`), "static func parse")),
      ...swiftCases(block(read(`${SW}/Screens/Diary/SuitcaseWebView.swift`), "switch kind")),
    ],
  },
};

test("bridge.ts：原生发的每一种消息都在 CHANNEL_OF 里，四组都读到了", () => {
  for (const name of ["NativeToWorld", "WorldToNative", "ShellToEmbed", "EmbedToShell"]) assert.ok(B[name]?.size > 0, `bridge.ts 里没读到 ${name}`);
  assert.deepEqual([...OUT].sort(), Object.keys(CHANNEL_OF).sort());
  for (const k of OUT) assert.ok(!IN.has(k), `${k} 两个方向都有`);
});

for (const [shell, s] of Object.entries(SHELLS)) {
  test(`${shell}：发的 kind 都在 bridge.ts 里，分发的 kind 世界层都会发，要回话的都接了`, () => {
    assert.ok(s.sent.length >= 10, `${shell} 只扫到 ${s.sent.length} 种发出的消息，正则可能失效了`);
    assert.ok(s.handled.length >= 5, `${shell} 只扫到 ${s.handled.length} 种收进来的消息，正则可能失效了`);
    assert.deepEqual(missing(s.sent, OUT), [], `${shell} 发了 bridge.ts 里没有的消息`);
    assert.deepEqual(missing(s.handled, IN), [], `${shell} 在等世界层不会发的消息`);
    const handled = new Set(s.handled);
    const unanswered = [...new Set(s.sent)].filter((k) => REPLY_OF[k] && !handled.has(REPLY_OF[k])).map((k) => `${k} → ${REPLY_OF[k]}`);
    assert.deepEqual(unanswered, [], `${shell} 发了请求却没接回话`);
  });
}

test("iOS：手写的 WorldChannel 与每条消息的频道和 channels.ts 一致", () => {
  const src = read(`${SW}/World/WorldMessages.swift`);
  const decl = block(src, "enum WorldChannel");
  assert.deepEqual(all(decl, /case ([a-z, ]+)\n/g).join(",").split(",").map((x) => x.trim()).filter(Boolean), [...CHANNELS]);
  // 每个 struct：var kind = "x" 和它后面最近的 var channel: WorldChannel? { nil | .y }
  const pairs = [...src.matchAll(/var kind = "([a-z-]+)"[\s\S]*?var channel: WorldChannel\? \{ (nil|\.([a-z]+)) \}/g)];
  assert.ok(pairs.length >= 15);
  for (const m of pairs) {
    const kind = m[1] as keyof typeof CHANNEL_OF, ch = m[3] ?? null;
    assert.equal(ch, CHANNEL_OF[kind], `iOS 的 ${kind} 频道是 ${ch}，channels.ts 是 ${CHANNEL_OF[kind]}`);
  }
});

test("各壳调的核心函数都在 core.ts 里", () => {
  const used = {
    android: all(read(`${KT}/model/Core.kt`), /\bcall\("([a-zA-Z]+)"/g),
    harmony: all(readAll(ETS, ".ets"), /(?:CoreApi\.call|\.core)\('([a-zA-Z]+)'/g),
    ios: all(readAll(SW, ".swift"), /\bcore\(\s*(?:fn:\s*)?"([a-zA-Z]+)"/g),
  };
  assert.ok(used.android.length >= 10 && used.harmony.length >= 10, "核心调用没扫到，正则可能失效了");
  for (const [shell, fns] of Object.entries(used)) assert.deepEqual(missing(fns, CORE_FNS), [], `${shell} 调了 core.ts 里没有的函数`);
});

test("各壳用到的文案键都在消息表里（拼出来的键至少前缀对得上）", () => {
  const keys = Object.keys(ZH);
  const kt = readAll(KT, ".kt"), ets = readAll(ETS, ".ets");
  const used = {
    // 整键：引号后面紧跟 , 或 )；拼接的（"todo.lead$it"、'case.style.' + s）只查前缀
    android: { keys: all(kt, /\bi18n\.(?:t|tOr|has)\("([a-zA-Z0-9_.]+)"\s*[,)]/g), prefixes: all(kt, /\bi18n\.(?:t|tOr|has)\("([a-zA-Z0-9_.]+)\$/g) },
    harmony: { keys: all(ets, /\bI18n\.(?:t|t1|tn)\('([a-zA-Z0-9_.]+)'\s*[,)]/g), prefixes: all(ets, /\bI18n\.(?:t|t1|tn)\('([a-zA-Z0-9_.]+)'\s*\+/g) },
  };
  for (const [shell, u] of Object.entries(used)) {
    assert.ok(u.keys.length >= 100 && u.prefixes.length >= 1, `${shell} 的文案键没扫到，正则可能失效了`);
    assert.deepEqual(missing(u.keys, new Set(keys)), [], `${shell} 用了消息表里没有的键`);
    assert.deepEqual([...new Set(u.prefixes)].filter((p) => !keys.some((k) => k.startsWith(p) && k !== p)).sort(), [], `${shell} 拼的键没有一条对得上`);
  }
});
