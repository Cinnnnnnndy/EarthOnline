# spec 迁移记录

| 版本 | 变化 | 迁移 |
|---|---|---|
| 0.1 | 示例数据 `示例数据/关西七日.json` 的格式：条目带 `order`，交通条目用 `mode` 存名字、`durationText` 存中文时长，没有 id、seed、status 时间戳 | — |
| 0.2 | 条目加 `id`；交通条目拆成 `mode`（枚举）+ `label`（名字）+ `durationMinutes`；旅程加 `id / seed / status / createdAt / updatedAt`；城市 id 限定四座 | `migrate.ts`：按 `d{天}-e{序}` 生成 id，用 `classifyTransport` 归类交通方式，用 `parseDuration` 解析时长，seed 由标题与日期哈希 |

| 0.3 | 站点加可选 `geo {lat,lng}`；交通加可选 `distanceKm`、`polyline`（真实路线折线）与新方式 `car`（自驾）；类别加 `port`、`hotel`；`day.city` 允许 `"geo"`（按坐标生成底板）；天加 `color`；旅程加 `plan {group,index,label}`（多方案对照） | 只增字段，`from02` 改版本号 |

规则：只增不改。旧版本导入时逐级迁移；两端 App 大版本与 spec 版本绑定。
