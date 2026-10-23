/** 守门测试：web/src 里的界面文字必须走 t()。
 *  扫 web/src/**\/*.ts 的字符串 / 模板字面量（跳过注释、正则字面量），里面出现中日文字符就报「文件:行」。
 *  不扫：hero-lab.ts（实验页）。voice/ 与 paywall.ts 第八轮起也走 t()。
 *  确实是数据而不是界面文字的（比如用地名匹配行程数据），在那一行末尾写 `// i18n-ok` 放行。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SRC = join(ROOT, "web/src");
const SKIP = [/^hero-lab\.ts$/];
/** 中日文字（汉字、假名）与中日文标点（、。「」，：（）＋ 等全角符号）——标点也要跟着语言走，所以一并拦下 */
const CJK = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff01-\uff9f]/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".d.ts") ? [p] : []; });
}

/** 极简词法：只分出注释、字符串、模板、正则，返回字面量里带中日文的行号 */
export function literalHits(src: string): number[] {
  const hits = new Set<number>(); let line = 1; let i = 0; const n = src.length;
  const lines = src.split("\n"); const allowed = (ln: number) => /\/\/\s*i18n-ok\b/.test(lines[ln - 1] ?? "");
  let prev = "";                                   // 上一个有意义的字符，用来判断 / 是除号还是正则
  const tpl: number[] = [];                        // 模板里 ${ 的大括号深度栈
  let depth = 0;
  const mark = (ch: string) => { if (CJK.test(ch) && !allowed(line)) hits.add(line); };
  const readQuoted = (q: string) => { i++; while (i < n && src[i] !== q) { if (src[i] === "\\") i++; else if (src[i] === "\n") line++; else mark(src[i]); i++; } i++; };
  const readTemplate = (): boolean => {            // 读到 ` 结束返回 false；读到 ${ 返回 true
    while (i < n) {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { i++; return false; }
      if (c === "$" && src[i + 1] === "{") { i += 2; return true; }
      if (c === "\n") line++; else mark(c);
      i++;
    }
    return false;
  };
  const regexAllowed = () => prev === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(return|typeof|case|in|of|delete|void|throw|new)$/.test(src.slice(Math.max(0, i - 8), i).trimEnd());
  while (i < n) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
    if (c === "'" || c === '"') { readQuoted(c); prev = "a"; continue; }
    if (c === "`") { i++; if (readTemplate()) { tpl.push(depth); depth++; prev = "{"; } else prev = "a"; continue; }
    if (c === "/" && regexAllowed()) {             // 正则字面量：跳过（是匹配数据用的，不是界面文字）
      i++; let cls = false;
      while (i < n && src[i] !== "\n") { const d = src[i]; if (d === "\\") { i += 2; continue; } if (d === "[") cls = true; else if (d === "]") cls = false; else if (d === "/" && !cls) break; i++; }
      i++; while (i < n && /[a-z]/.test(src[i])) i++; prev = "a"; continue;
    }
    if (c === "{") { depth++; prev = c; i++; continue; }
    if (c === "}") {
      depth--; i++;
      if (tpl.length && depth === tpl[tpl.length - 1]) { tpl.pop(); if (readTemplate()) { tpl.push(depth); depth++; prev = "{"; } else prev = "a"; continue; }
      prev = "}"; continue;
    }
    prev = /[A-Za-z0-9_$)\].]/.test(c) ? "a" : c; i++;
  }
  return [...hits].sort((a, b) => a - b);
}

test("词法器自检：注释、正则不算，字符串、模板算", () => {
  assert.deepEqual(literalHits(`// 注释\nconst a = "x"; /* 块\n注释 */\nconst r = /邮轮/.test(s);\nconst b = "中文";\nconst c = \`\${x ? "好" : \`y\${"z"}\`}\`;\nconst d = 1 / 2; const e = "ok"; // 说明`), [5, 6]);
  assert.deepEqual(literalHits(`const t = \`a\${ {k: 1}.k }b\`; const u = "日本語"; // i18n-ok`), []);
  assert.deepEqual(literalHits(`const s = parts.join("，");\nconst k = t("a.b");`), [1]);                   // 中文标点也算
});

test("web/src 的字符串里没有写死的中日文（界面文字都走 t()）", () => {
  const bad: string[] = [];
  for (const f of walk(SRC)) {
    const rel = relative(SRC, f).split("\\").join("/");
    if (SKIP.some((r) => r.test(rel))) continue;
    for (const ln of literalHits(readFileSync(f, "utf8"))) bad.push(`web/src/${rel}:${ln}`);
  }
  assert.deepEqual(bad, [], `这些行的字符串里有写死的中日文，请改用 t("key")：\n${bad.join("\n")}`);
});
