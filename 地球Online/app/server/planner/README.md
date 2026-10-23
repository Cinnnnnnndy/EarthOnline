# 行程规划服务（server/planner）

「做行程的时候要有语音输入和语音沟通」的服务端一半：网页和 iOS 把一段对话发过来，这里用 Claude 回一句话、最多追问一句，信息够了就给一本行程草稿（spec 0.3 的 Trip，站点带真实坐标和景点类型）。

客户端一半在 `shared/planner/`（协议、本机规则、远端客户端）和 `web/src/voice/`（语音识别与朗读、底部面板）。服务连不上时，客户端自动退回本机规则，对话不会断。

## 跑起来

需要 Node 22.6 以上（直接跑 TypeScript，不用编译）。

```bash
cd 地球Online/app/server/planner
npm install
export ANTHROPIC_API_KEY=sk-ant-...        # 只从这个环境变量读
npm start                                  # http://127.0.0.1:8787
```

没有 key 时可以先用本机规则联调网页：

```bash
npm run offline
```

让网页用这个服务：在浏览器控制台执行

```js
localStorage.setItem("earth-online:planner-endpoint", "http://127.0.0.1:8787")
```

清空这个键就回到纯离线（只用本机规则）。

检查与测试（不联网、不调模型）：

```bash
npm run typecheck
npm test
```

## 协议

`POST /v1/plan`，JSON：

```json
{
  "messages": [
    { "role": "user", "text": "想去京都" },
    { "role": "assistant", "text": "去京都。打算哪天出发，玩几天？" },
    { "role": "user", "text": "下周五，三天，想看红叶" }
  ],
  "context": {
    "today": "2026-09-30",
    "locale": "zh-Hans",
    "home": { "name": "上海", "lat": 31.23, "lng": 121.47 },
    "trips": [{ "title": "冰岛", "startDate": "2026-11-01", "endDate": "2026-11-08" }]
  }
}
```

成功返回 200：

```json
{ "reply": "排好了，三天在东山和岚山，第二天早点去竹林。", "draft": { "schemaVersion": "0.3", "...": "..." }, "done": true }
```

- `reply`：这一轮要说的话，会被念出来，所以短，不带列表和符号。
- `question`：唯一的一句追问，只在缺目的地或日期时出现。
- `draft`：完整的 Trip，已经过 `shared/spec/validate.ts`。每个站点是一条 place（带 `geo`、`kind`），站点之间是 transport（方式、分钟、公里），每天 `city` 都是 `"geo"`。
- `done`：信息够了、可以直接生成书时为 true。

出错时返回非 200 和 `{ "error": "..." }`：

| 状态 | 什么时候 |
|---|---|
| 400 | 不是 JSON，或字段不对（`shared/planner/protocol.ts` 的 `checkPlanRequest`） |
| 403 | 网页来源不在允许列表里 |
| 413 | 请求体超过 64 KB |
| 415 | Content-Type 不是 application/json |
| 422 | 模型拒绝了这个请求（已经按类别换模型重试过） |
| 429 | 这个 IP 请求太频繁，看 `Retry-After` |
| 502 / 503 / 504 | 模型出错、太忙、超时 |

服务不存会话，每次都带完整对话。assistant 那一条写上一轮的 reply，有追问就接在后面（`assistantText()`）。

### 让 AI 装箱：`POST /v1/pack`（D79）

行李箱（视觉文档 15.15）装完名胜、特色物件、小人与日记之后，再让模型按这趟和这个人的情况加最多三样小东西，每样一句为什么。请求是客户端算好的摘要，不传整本书：

```json
{
  "brief": { "title": "冰岛环岛", "destination": "冰岛", "startDate": "2026-10-01", "endDate": "2026-10-04", "theme": "极光冰原", "days": 4,
             "season": "autumn", "maxAbsLat": 64.1, "kinds": { "waterfall": 2, "beach": 2, "hotspring": 1 }, "famous": 5, "transports": { "car": 3 } },
  "context": { "locale": "zh-Hans", "profile": { "tripsCount": 4, "visitedTotal": 12 }, "candidates": ["thermos", "sunglasses", "camera", "boots", "swimRing", "roadmap", "binoculars", "scarf", "umbrella", "plush"] }
}
```

`brief` 里可以多一句 `note`（D84，清单的搜索框里这个人自己打的那句话，120 字内，如「下雨天去京都逛三天」）：提示词让模型先按它挑，理由跟着它写；本机规则也先按它挑（场景词表在 `shared/algo/case-search.ts`）。返回 `{ "extras": [{ "kind": "thermos", "reason": "十月的冰岛夜里冷" }, ...] }`：`kind` 只会是 `candidates` 里的（客户端画得出来的那几种），最多三样，理由不超过 60 字。模型拒答、输出不可用或一样没挑时服务端直接退回本机规则（`shared/algo/pack-extras.ts`）；客户端拿不到服务也用同一套规则，所以箱子不会空着。护栏（来源、尺寸、限频、并发）与 `/v1/plan` 同一套；`--offline` 时只用规则。

## 用的模型和原因

`claude-opus-5-5`（Claude Opus 5.5），按仓库里的 claude-api skill 选的默认模型。排一本书要同时考虑真实坐标、开放时间、路程和季节（北方的日照、雨季、封路），需要推理，不适合降级到小模型。

参数都在 `src/planner.ts`：

- 思考：Opus 5.5 的思考一直开着、不能关，用 `output_config.effort` 控制深浅和延迟。默认 `medium`（这个模型的默认值，代码里写明）。语音对话嫌慢时设 `PLANNER_EFFORT=low`。
- 结构化输出：`output_config.format` 给一份 JSON Schema（`src/schema.ts`），模型必须按 `{reply, question, done, draft}` 回。Opus 5.5 不支持强制指定工具（`tool_choice` 为 any / tool 会报 400），所以不用工具调用这条路。
- 草稿的形状比 Trip 简单：id、每天的日期、seed、状态、时间戳由服务端补（`src/draft.ts`），模型只管内容；补完再过一遍 `validateTrip`，不合规就丢掉草稿、只回话。
- 提示词缓存：系统提示词（规则 + `shared/spec/trip.schema.json` 原文）是固定前缀，打一个缓存断点；今天的日期、语言、家、已有行程放在第一条 user 消息里，不放进系统提示词，免得每天、每个人都让缓存失效。再加顶层自动缓存，多轮对话每轮复用前面的部分。日志里的 `cacheRead` 可以确认命中。
- 拒答回退：`fallbacks: "default"`（beta `server-side-fallback-2026-07-01`），分类器误拒时由服务端按类别换模型重跑。
- 非流式，`max_tokens` 16000（思考也算在里面）。超过十天的行程，提示词要求每天最多三站、备注写短，免得被截断。
- SDK 超时 45 秒，失败重试 1 次；客户端（`RemotePlanner`）默认等 60 秒，超时就退回本机规则。

## 护栏

- API key 只从 `ANTHROPIC_API_KEY` 读，构造客户端时把 `authToken` 置空，环境里的其他凭据不会被带上。没设 key 直接退出。
- CORS：只允许 `PLANNER_ALLOWED_ORIGINS` 里的网页来源。没有 Origin 头的请求（原生 App、curl）不受限。
- 尺寸：请求体 64 KB；最多 40 条消息，每条 2000 字，总共 16000 字；已有行程最多 50 本。客户端会先裁掉较早的几轮再发。
- 频率：每个 IP 一个令牌桶，默认每分钟 12 次、允许连发 6 次；同时在跑的请求最多 8 个。在反向代理后面时设 `TRUST_PROXY=1`，按 `X-Forwarded-For` 认 IP。
- 客户端断开时，上游的模型请求一起取消，不白花钱。
- 回给客户端的错误信息不带上游细节，详细原因只进服务端日志（每行一个 JSON）。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 无 | 必填（`--offline` 时不需要） |
| `PORT` | 8787 | |
| `HOST` | 127.0.0.1 | 手机连电脑调试时设 `0.0.0.0` |
| `PLANNER_ALLOWED_ORIGINS` | 本机的 5173、4173 端口 | 逗号分隔；`*` 表示都允许 |
| `PLANNER_MODEL` | claude-opus-5-5 | |
| `PLANNER_EFFORT` | medium | low / medium / high / xhigh / max |
| `PLANNER_MAX_TOKENS` | 16000 | |
| `PLANNER_RATE_PER_MIN` | 12 | 每个 IP 每分钟 |
| `PLANNER_BURST` | 6 | 每个 IP 允许连发 |
| `PLANNER_MAX_CONCURRENT` | 8 | |
| `TRUST_PROXY` | 不设 | 设为 1 时按 X-Forwarded-For 认 IP |

## 文件

```
server/planner/
├── src/main.ts          启动、读环境变量（--offline 用本机规则）
├── src/http.ts          路由、CORS、尺寸与频率限制、并发上限、断开取消
├── src/planner.ts       组请求、调 Claude、处理拒答与截断、错误映射
├── src/prompt.ts        系统提示词（固定）与上下文块
├── src/schema.ts        结构化输出的 JSON Schema 与类型
├── src/draft.ts         模型草稿 → spec 0.3 的 Trip，再过 validateTrip
├── src/pack.ts          /v1/pack：让 AI 装箱（结构化输出、低 effort、出错退回规则）
└── src/planner.test.ts  假的 Anthropic 客户端，16 个测试
```

## 还没做的

- 没有流式输出：一轮要等模型写完整本书才回，effort 为 medium 时七天左右的行程大约要十几秒到半分钟（没有实测，以真实调用为准）。下一步可以先流出 `reply` 让它先念，草稿随后到。
- 站点坐标靠模型自己的知识，服务端只检查范围是否合法，没有用地图服务核对。
- 限频和并发计数存在进程内存里，多实例部署要换成共享存储。
- 草稿里每天都是地理切块（`city: "geo"`），关西四城不走手画底板。
- 没有鉴权：部署到公网前要在前面加一层（App 的登录态或网关的 key），否则任何人都能花你的额度。
