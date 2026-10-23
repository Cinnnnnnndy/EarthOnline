/** 启动：node --experimental-strip-types src/main.ts [--offline]
 *
 *  环境变量：
 *   ANTHROPIC_API_KEY        必填（--offline 时不需要）。只从这里读，不写进代码、不落盘
 *   PORT                     默认 8787
 *   HOST                     默认 127.0.0.1（手机连电脑调试时设 0.0.0.0）
 *   PLANNER_ALLOWED_ORIGINS  允许的网页来源，逗号分隔；默认本机 Vite 的 5173 / 4173 端口
 *   PLANNER_MODEL            默认 claude-opus-5-5
 *   PLANNER_EFFORT           low / medium / high / xhigh / max，默认 medium
 *   PLANNER_MAX_TOKENS       默认 16000
 *   PLANNER_RATE_PER_MIN     每个 IP 每分钟请求数，默认 12；PLANNER_BURST 默认 6
 *   PLANNER_MAX_CONCURRENT   同时在跑的请求上限，默认 8
 *   TRUST_PROXY=1            在反向代理后面时按 X-Forwarded-For 认 IP
 *
 *  --offline：不调模型，用本机规则（shared/planner/local.ts）回答，方便没有 key 时联调网页。
 *  /v1/pack（让 AI 装箱，D79）与 /v1/plan 同一个模型；--offline 时用 shared/algo/pack-extras.ts 的规则。 */
import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { ClaudePlanner, DEFAULT_MODEL, type Effort } from "./planner.ts";
import { createHandler, type PlanBackend } from "./http.ts";
import { ClaudePacker, RulesPacker, type PackBackend } from "./pack.ts";
import { LocalRulePlanner } from "../../../shared/planner/local.ts";

const env = process.env;
const offline = process.argv.includes("--offline");
const log = (event: string, data: Record<string, unknown>) => console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

let planner: PlanBackend; let packer: PackBackend;
if (offline) {
  const local = new LocalRulePlanner();
  planner = { plan: async (req) => { const { source: _s, fallbackReason: _f, ...r } = await local.plan(req); return r; } };
  packer = new RulesPacker();
} else {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("缺少 ANTHROPIC_API_KEY。设置后再启动，或者用 --offline 先跑本机规则。"); process.exit(1); }
  // 只用 API key：显式传入，并把 authToken 置空，免得环境里别的凭据被一起带上
  const client = new Anthropic({ apiKey, authToken: null, timeout: 45_000, maxRetries: 1 });
  const effort = EFFORTS.includes(env.PLANNER_EFFORT as Effort) ? (env.PLANNER_EFFORT as Effort) : "medium";
  planner = new ClaudePlanner({ client, model: env.PLANNER_MODEL || DEFAULT_MODEL, effort, maxTokens: num(env.PLANNER_MAX_TOKENS, 16000), log });
  packer = new ClaudePacker({ client, model: env.PLANNER_MODEL || DEFAULT_MODEL, log });
}

const origins = (env.PLANNER_ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",").map((s) => s.trim()).filter(Boolean);
const handler = createHandler({
  planner, packer, allowedOrigins: origins, perMinute: num(env.PLANNER_RATE_PER_MIN, 12), burst: num(env.PLANNER_BURST, 6),
  maxConcurrent: num(env.PLANNER_MAX_CONCURRENT, 8), trustProxy: env.TRUST_PROXY === "1", log,
});
const server = createServer((req, res) => { void handler(req, res); });
server.requestTimeout = 120_000; server.headersTimeout = 20_000;
const port = num(env.PORT, 8787), host = env.HOST || "127.0.0.1";
server.listen(port, host, () => log("listening", { url: `http://${host}:${port}`, offline, origins }));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
