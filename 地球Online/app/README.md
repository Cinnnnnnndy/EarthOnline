# 地球Online · 应用框架（app/）

> 编写日期：2026-09-30。第三轮按「世界风 CG」搭了第一版框架；第四轮（讨论记录 D24–D28）改成**开屏大地球 → 书在地球上 → 潜入某一天**，一天是地球上切下来的一块漂浮的地，内置示例换成仓库主人的「冰岛 + 北欧」双方案行程，小人重做为一体圆润的 v3。视觉仍会继续细化。第五轮（D29–D40）：按手机 App 重排（底部抽屉、液态玻璃、四个字号两种字重、苹方 / 鸿蒙黑体），地球外的天色跟随手机（白天 / 晨昏 / 夜），外面是有纵深的宇宙，足迹小旗与家，小人往潮玩靠，景点分三级（名胜 / 类型 / 兜底）。第六轮（D41–D51）：首页按用户旅程的阶段给东西、全球名胜按大洲建模（116 处）、10 种示例行程、语音与 AI 规划、三种语言、嵌入层、iOS 工程、商业模式与套餐表。第七轮（D52–D55）：按钮只有三种、手机上用系统字体、每块只放最关键的一两行。第八轮（D56–D64）：强调色去色（墨 / 白）、弹层精简、付费墙接上、通用操作用图标按钮、行程列表按六组给图标、景点待办、暖色的「新建旅程」、同一类信息用标签。

## 目录

```
app/
├── shared/                 契约与共享代码（两端 + 网页共用）
│   ├── core.ts             公用的领域核心（D91）：原生经桥接 core-call 按名字调（旅程状态、统计、日记、待办、足迹、离线规划、配额……）
│   ├── spec/               types.ts · trip.schema.json（0.3）· validate.ts · migrate.ts（0.1 → 0.2 → 0.3）· bridge.ts（原生 ↔ 世界层消息）· channels.ts（状态 / 一次性、重放顺序）· layout.ts + layout.golden.json（屏幕形态，D90）· migrations.md
│   ├── rules/              cities/（关西四城手画底板）· gazetteer.json（地名表，104 个地点）· geo-features.json（冰岛冰川、湖泊的近似形状）
│   ├── algo/               prng · duration · transport · timeline · route（城市底板：锚定地标 + 路网 BFS）· geo（地理切块：投影、重采样、地理路线）· city · world-spec · stats · diary
│   ├── geo/                topo（Natural Earth 读取）· countries（经纬度 → 国家）· gazetteer（搜地方、定位）
│   ├── import/             route-page（路径规划页 → 书）+ 测试
│   ├── golden/             黄金用例：trips/（关西七日 0.1）、pages/（冰岛 + 北欧行程页）
│   └── world/              世界层
│       ├── globe.ts · earth-texture.ts        风格化地球（首页）
│       ├── geo-plate.ts · landmarks.ts        地理切块底板 + 地标（名胜专门模型 + 约 30 种类型通用模型 + 兜底）
│       ├── landmark-kinds.ts · landmark-famous.ts   景点分级：类型表与推断、名胜登记表（纯数据，带测试）
│       ├── tokens.ts · daylight.ts            设计令牌（色、字、玻璃，含夜间）· 天色（太阳高度 + 规则）
│       ├── fabric.ts · hero-shapes.ts · hero-mesh.ts · hero-worker.ts   小人 v4：绒面布料、部件形状、Worker 网格化
│       ├── plate.ts                           城市底板（关西四城）
│       ├── sdf.ts · hero.ts                   距离场建模 + 小人
│       └── world.ts · camera.ts · playback.ts · labels.ts · style.ts   某一天的世界（只走桥接消息）
├── web/                    参考应用（Vite + TypeScript，无框架）
│   ├── index.html          应用
│   ├── embed.html          嵌入模式：只有世界层，给鸿蒙 Web 组件 / iOS WKWebView 用（window.EarthWorld）
│   ├── hero-lab.html       小人实验页（?lm=kind / ?lm=famous 看全部地标模型）
│   └── public/assets/      geo/（Natural Earth 50m / 10m 陆地、国界）· samples/（内置示例行程页）· hero_face.png
├── tools/                  make_face.py（小人脸部贴图）· export-shared.ts（消息表、令牌、桥接表、布局用例导出给鸿蒙与安卓；--world 拷世界层）
├── ios/                    iOS（SwiftUI；此环境不编译）
├── harmony/                鸿蒙（ArkTS / ArkUI，第九轮的完整壳；此环境不编译）
├── android/                安卓（Kotlin / Compose，第九轮新建；此环境不编译）
└── server/planner/         规划服务（/v1/plan、/v1/pack）
```

## 运行

```bash
cd 地球Online/app
npm install
npm run dev        # http://localhost:5173  （开发）
npm run check      # 类型检查 + 测试（148 个，含三端契约 D97）+ 两端生成文件是否过期 + 构建
npm run export:shared   # 消息表、令牌、桥接表、布局用例 → 鸿蒙 rawfile/shared、安卓 assets/shared（D91）
npm run sync:shells     # 上面那些 + 把 web/dist 拷进两端（先 npm run build）
npm run check:shared    # 只比对不写：改了 shared/ 忘了导出就失败（check 里已含）
npm run preview    # 预览构建产物 web/dist/
```

数据只存在浏览器 localStorage（键 `earth-online:v2`）。首次打开自动导入内置示例：「冰岛 + 北欧」行程页的方案二 +「关西七日」；设置里还有 10 种类型的示例行程可以加。

调试参数（都写在 URL 上）：`?today=2026-10-20`（当成今天）、`?sky=day|dusk|night`（天色）、`?lang=zh-Hans|en|ja`（语言）、`?platform=apple|harmony|other`（字体栈）、`?plan=pro|free`（套餐）、`?fold=closed|2|3|half`（模拟折叠外屏、两段、三段、半开悬停，D90）。

## 关键旅程（都已能走通）

| 旅程 | 页面 / 路由 | 做了什么 |
|---|---|---|
| 开屏 | `#/` | 一颗铺满屏的地球，拖动转、滚轮缩放；每本书是地球上的一簇路线 + 书签（「旅行中 · 今天 D6」「还有 45 天」）；底部一排书卡 + 新建 / 导入 |
| 打开书 | `#/book/:id` | 镜头飞过去 zoom in；书面板：同组方案切换、统计（天 / 站 / 公里 / 自驾时长）、序言与世界设定、「今天 · D6」；底部一排天 |
| 看某一天 | 书面板里点天 | 当天路线高亮、其他天变淡；当天卡片列出站点、每段交通（方式 · 公里 · 时长）、停留、住宿；「潜入这一天 ▶」 |
| 潜入 | `#/book/:id/day/:n` | 地球俯冲 + 穿云转场 → 当天那块地（真实海岸线、真实路形、地形、地标）；手机的天色是夜时整块地换一套夜色并亮灯（D85：月光、青蓝的叶、暖黄的路、站点的灯、民居的窗、萤火、发光的蘑菇、住处门前的篝火，D94 起角色手边还提着一盏纸灯（`shared/world/lantern.ts`）；`shared/world/night.ts`，`?sky=night` 可看）；小人沿路走，按交通方式换小车 / 小船 / 小飞机；进场从高空落下 |
| 沉浸式某一天 | 同上 | 顶部天芯片（🌍 回地球）、右上下一站卡、底部时间轴（站点、时间、每段公里）、右下图标控制；**点空白处隐藏全部 UI**；拖动转视角、滚轮缩放；行程面板、站点详情、打卡、捏人、导出与第三轮相同 |
| 新建旅程 | 首页「新建旅程」 | 搜一个地方（地名表）→ 地球转过去 → 填书名、日期、天数、主题 → zoom in 进新书。关西四城用手画底板，其他地方用地理切块 |
| 导入行程页 | 首页「导入行程页」 | 选文件或粘贴：路径规划页 HTML（带 `routes` / `OSRM`）或本应用导出的 JSON；一页几个方案就生成几本同组的书 |
| 合上书 | `#/book/:id/end` | 统计、每天日记、导出长图（每天一张渲染图 + 标牌 + 条目 + 日记；没有计划时间的站点按时间线估算；三个原生壳经嵌入页 `export-long-image` 出同一张图，D96）、复制 JSON |
| 列表视图 | `#/shelf` | 不带地球的书架（低配机 / 无障碍） |
| 说一句话做行程 | 新建旅程 → 第一行 | 语音识别（打字兜底）→ 本机规则或规划服务（`server/planner`）→ 草稿小卡 → 「生成这本书」；只有远端草稿计 AI 次数 |
| 示例行程库 | 设置 → 示例行程 | 10 种类型，点一本加进来；每本都占一个名额 |
| 付费页 | 新建 / 导入 / 加示例超过免费版名额时；设置 → 地球Online Pro | 一句话、四行权益、按月 / 按年、墨色小胶囊；网页版不收款（`?plan=pro` 按 Pro 看） |
| 足迹与家 | 首页右上的小旗 | 家一行 + 搜索 + 两个玻璃小胶囊；去过的地方按国家分组 |
| 行李箱 | 旅行日记页顶上 | 世界层里的 3D 箱子（`shared/world/suitcase-scene.ts`）：下半每天一座名胜小模型，上半站着这趟穿搭的小人（或捏人面板里选的形态：十一只 Q 版动物、三只自建 IP，`shared/world/mascot.ts`，D86 / D89b）、目的地的特色物件（`souvenir-models.ts` + `souvenir-models-more.ts`，109 样、64 国，同一国家的第二段拿第二样）与一本厚日记；物件都过一道潮玩质感的上色工序（`shared/world/look.ts`：哑光、上下渐变、透射玻璃、清漆亮球）；四款样式可选（存在小人的档案里）；东西可以自己加减——增减面板是一格一格类 emoji 的物件图标（`shared/world/item-icons.ts`：库里的模型从一个固定的好角度离屏渲染，透明底、脚下一圈影子），「清单」弹层像打包清单：搜索框打一句话或一个词（`shared/algo/case-search.ts`：认国家、场景词、名字，中英日）、场景标签、按组一格一格地放进去或拿出来（后排最多 4、前排最多 3），放一张照片进去抠成立牌（`case-cards.ts`，书里的 `suitcase` 字段：`hidden` / `picks` / `gear` / `cards`）；不放票、登机牌、明信片；「让 AI 装箱」再加最多三样小东西（本机规则 `shared/algo/pack-extras.ts`，有规划服务就问 `/v1/pack`）；拖一下可以转着看；导出 1080 × 1350 的 PNG；iOS 通过嵌入页（`?mode=suitcase`）用同一只（视觉文档 15.15） |
| 景点待办 | 某一天 → 点一个站点 → 「待办」一行 | 站点详情里只有一行入口（数量标签 + 最近一件），点开是待办的抽屉：一行一件（勾选、文字、到期日标签、删除），添加时选提前 1 个月 / 2 周 / 1 周 / 1 天 / 当天；提示跟着站点：书里一天的站点行与某一天的站点条，名字旁一个带勾的数量标签，第二行是最近要做的一件。备注同样是一行入口（「添加备注」） |
| 设置 | `#/settings` | 天色、色调、画质、语言（分段控件）；小人（捏人面板最上面是「形态」：十五格小图加名字，D94）、足迹与家、只看列表；导出、示例、Pro、色卡、重置 |
| 小人实验页 | `hero-lab.html` | URL 参数：`form=xiaowang|xiaowu|fugui|fox|cat|shiba|bear|rabbit|penguin|panda|duck|seal|otter|capybara|bean|cloud|pebble`（D86 / D89b 的形态，不给是小人）、`lm=forms`（全部形态排一排）、`view=front|side|back|three`、`outfit=puffer|dress`、`hat=cap|straw|none`（cap 是毛线帽）、`hair=bun|long|short`、`color=0..5`、`vehicle=car|boat|plane`、`walk=1` |

## 导入你自己的行程

导入器认的是「路径规划页」这一类 HTML：页面脚本里有一个 `routes` 对象字面量（每个方案、每一天的站点：名字、经纬度、描述、是否酒店 / 机场 / 码头、到下一站的方式）和一个 `OSRM` 对象（每段的折线、公里、分钟）。导入时：

- 每个方案一本书，同一页的方案在书面板里可切换；书的 id 是「页面组 + 方案号」，重复导入会覆盖同一本书。
- 站点描述里的「停留 1.5h」「08:00 出发」「18:30 前返回」会读成停留时长与计划时间；航班号会写进交通标签。
- 国家按经纬度判定；年份默认今年；状态按今天的日期判断（未出发 / 旅行中 / 已结束）。

## 架构上的三个决定（不变）

1. **契约先行**：`shared/spec` 的 TS 类型 + JSON Schema 是唯一事实；0.3 新增的字段都是可选的，旧数据自动迁移。
2. **世界层引擎无关**：`world.ts` 与 `globe.ts` 对外只有桥接消息与少量方法；第一版后端是 three.js，技术选型 8.1 节的 Cocos 是 P1 的升级路线。
3. **世界层常驻**：地球和某一天的世界各只建一次，切页面只是显示 / 隐藏。
4. **公用的只有一份**（第九轮，D91）：世界层（`web/dist`）、领域核心（`shared/core.ts`，原生经 `core-call` 调）、消息表（`shared/i18n`）、桥接表（`bridge.ts` + `channels.ts`）、屏幕形态（`layout.ts` + 22 条用例）、令牌（`tokens.ts`）；iOS、鸿蒙、安卓三个壳只写各自的界面与平台能力。

## 还没做的 / 已知粗糙处

- 新建旅程里加的站点没有真实路形：按地名表定位，路段画直线（导入的行程有 OSRM 折线）。
- Natural Earth 10m 海岸线在峡湾尺度不够细（卑尔根、罗弗敦）；正式版走 OSM 流水线。
- 地球上聚焦时的高清补丁比底图略淡。
- 某一天的浮岛还不跟随天色（只做了地球外）；无头环境首帧慢（约 70 秒），真机性能要实测。
- iOS 工程（`ios/`）没有编译过，要在 Actions 上手动跑；鸿蒙壳（`harmony/`）与安卓壳（`android/`）同样没编译过（见各自的 README）。
- 地球外白天的天色还是长春花蓝到淡丁香（第八轮只去了界面的强调色）。
- 第八轮末：每一趟旅程都是一张白底黑字的纸票（视觉文档 15.14）：首页、书的页面（票浮在抽屉上方，不放在卡片上）、全部旅程都是票，点票面翻开这本书，撕票根进入。截图容器里把苹果的字体名指向随包的 HarmonyOS Sans SC，真机字体栈没动。
- 第八轮末：「新建旅程」改成只有晨色一个色相（视觉文档 15.7）；行程列表从上往下编号、站点详情里待办与备注收成入口行（15.10）；字号只有两档 17 / 13（15.11）；某一天的抽屉只剩「下一站」与行程列表，编辑态开关 + 添加三选一（15.13）；「走过去」改成「导航」，跳 Apple / Google / 高德 / 百度地图（D72）。
- 第八轮末做了一次校准（视觉文档 15.9）：白天的雾、墨 · 次、晨字、删除色按「叠在玻璃上 ≥ 4.5」重定；焦点环统一墨色 2px；28 / 32 的小控件点击区补到 44；提示条是读屏的 status 区。
- 第三轮就没做的：拖拽排序、POI 搜索、多人协作、搭建模式、昼夜天气、PDF 导出、服务端同步、真机编译打包。

## 第八轮截图（手机 390 × 844，中文界面）

| 旅行中的首页（这趟旅程的票） | 空闲的首页（下一趟的小票 + 新建按钮） | 夜里 |
|---|---|---|
| ![旅行中](docs/r8_home_traveling.jpg) | ![空闲](docs/r8_home_idle.jpg) | ![夜](docs/r8_home_night_idle.jpg) |

| 要出发（票根是「查看」） | 书里的一天（序号、站点上的待办标签） | 某一天（序号、站点条上的待办数） |
|---|---|---|
| ![要出发](docs/r8_home_departing.jpg) | ![书里的一天](docs/r8_book_todos.jpg) | ![某一天](docs/r8_day_page_todos.jpg) |

| 书里的一天（序号 + 组图标） | 某一天（同一个行程列表） | 站点详情（类型标签，待办与备注是入口行，导航） |
|---|---|---|
| ![一天](docs/r8_day_list.jpg) | ![某一天](docs/r8_day_page.jpg) | ![站点详情](docs/r8_stop_detail.jpg) |

| 足迹与家 | 新建旅程 | 说一句话 |
|---|---|---|
| ![足迹](docs/r8_footprints.jpg) | ![新建](docs/r8_new_trip.jpg) | ![语音](docs/r8_voice.jpg) |

| 付费页（省多少是标签） | 示例行程（类型标签） | 旅行日记（第 n 天标签、图标按钮） |
|---|---|---|
| ![付费页](docs/r8_paywall.jpg) | ![示例](docs/r8_samples.jpg) | ![日记](docs/r8_diary.jpg) |

| 行李箱（冰岛 + 北欧，3D） | 行李箱（关西七日，3D） | 撕票根的一瞬（票根已撕掉，书正翻开） |
|---|---|---|
| ![行李箱](docs/r8_suitcase.jpg) | ![行李箱](docs/r8_suitcase_kansai.jpg) | ![撕票](docs/r8_ticket_tear.jpg) |

| 墨色硬壳 | 帆布箱 | 复古木箱 |
|---|---|---|
| ![墨色硬壳](docs/r8_suitcase_ink.jpg) | ![帆布箱](docs/r8_suitcase_canvas.jpg) | ![复古木箱](docs/r8_suitcase_trunk.jpg) |

| 放了一张照片（抠成立牌） | 增减面板（类 emoji 的图标格） | 物件库全家福 |
|---|---|---|
| ![照片卡](docs/r8_suitcase_card.jpg) | ![增减](docs/r8_suitcase_edit.jpg) | ![物件库](docs/r8_case_items.jpg) |

| 清单弹层（默认分组） | 清单：一句话「国庆去韩国玩7天」 | 类 emoji 的物件图标全家福（`?lm=icons`） |
|---|---|---|
| ![清单](docs/r8_case_list.jpg) | ![一句话](docs/r8_case_list_q.jpg) | ![图标](docs/r8_case_icons.jpg) |

| 夜里的浮岛：关西（城市底板，窗与灯） | 夜里的浮岛：冰岛（看整天：灯、萤火、蘑菇、篝火） | 夜里的浮岛：冰岛（跟着小人） |
|---|---|---|
| ![夜·关西](docs/r8_day_night_kansai.jpg) | ![夜·冰岛](docs/r8_day_night_iceland.jpg) | ![夜·小人](docs/r8_day_night_iceland_near.jpg) |

| 形态：小人、十一只动物、三只自建 IP（`?lm=forms`） | 一只狐狸走某一天 | 一只企鹅在箱子里 |
|---|---|---|
| ![形态](docs/r8_forms.jpg) | ![狐狸](docs/r8_day_fox.jpg) | ![企鹅](docs/r8_suitcase_penguin.jpg) |

| 全部旅程（一摞小票） | 设置 | 头像 |
|---|---|---|
| ![全部旅程](docs/r8_shelf.jpg) | ![设置](docs/r8_settings.jpg) | ![头像](docs/r8_avatar.jpg) |

| 某一天的编辑态（上移 / 下移 / 编辑 / 删除） | 站点详情 → 导航（Apple / Google / 高德 / 百度） | 全部旅程的弹层（一摞小票） |
|---|---|---|
| ![编辑态](docs/r8_day_page_edit.jpg) | ![导航](docs/r8_stop_nav.jpg) | ![全部旅程](docs/r8_all_trips.jpg) |

行李箱里能放的所有东西（`hero-lab.html?lm=case`）：`docs/r8_case_items.jpg`；同一批东西按类 emoji 的图标排（`hero-lab.html?lm=icons`）：`docs/r8_case_icons.jpg`。各大洲名胜并排（`hero-lab.html?lm=famous&region=…`）：`docs/r8_landmarks_asia.jpg`、`r8_landmarks_europe.jpg`、`r8_landmarks_americas.jpg`、`r8_landmarks_africa.jpg`、`r8_landmarks_oceania.jpg`、`r8_landmarks_nordic.jpg`。

## 第五轮截图（手机 390 × 844、折叠外屏 421 × 616、展开 861 × 609）

| 夜 | 晨昏 | 白天 |
|---|---|---|
| ![夜](docs/r5_phone_night.jpg) | ![晨昏](docs/r5_phone_dusk.jpg) | ![白天](docs/r5_phone_day.jpg) |

| 打开书 | 设置（夜） | 色卡与字阶 |
|---|---|---|
| ![书](docs/r5_phone_book.jpg) | ![设置](docs/r5_phone_settings.jpg) | ![色卡](docs/r5_phone_tokens.jpg) |

| 书里的一天：类型图标与说明 | 旅行日记 | 只看列表 |
|---|---|---|
| ![一天](docs/r5_phone_bookday.jpg) | ![日记](docs/r5_phone_end.jpg) | ![列表](docs/r5_phone_shelf.jpg) |

| 折叠外屏 | 展开：抽屉停靠成左页 |
|---|---|
| ![外屏](docs/r5_fold.jpg) | ![展开](docs/r5_unfold.jpg) |

| 小人 v4 | 地标：类型通用模型（左）与名胜（右） |
|---|---|
| ![小人](docs/r5_hero.jpg) | ![地标](docs/r5_landmarks.jpg) |

## 第四轮截图（无头 Chromium，2026-09-30）

| 开屏：大地球 | 打开书：方案 2 的路线 | 某一天的卡片 |
|---|---|---|
| ![地球](docs/screen_home_globe.jpg) | ![书](docs/screen_book.jpg) | ![当天卡片](docs/screen_daycard.jpg) |

| 潜入：黄金圈一天 | 隐藏 UI 的沉浸视角（罗弗敦） | 关西城市底板 |
|---|---|---|
| ![地理切块](docs/screen_day_geo.jpg) | ![沉浸](docs/screen_day_immersive.jpg) | ![关西](docs/screen_day_kansai.jpg) |

| 小人 v3 | 导出长图（开头） | 原生壳经嵌入页出的长图（D96，杭州西湖两日，无头软件渲染） |
|---|---|---|
| ![小人](docs/hero_v3_sheet.jpg) | ![长图](docs/screen_export.jpg) | ![嵌入页长图](docs/r8t_long_embed.jpg) |

| 照片小卡（D99）：原图 → 嵌入页抠出的立牌 → 清单里的小图 → 放进箱子 |
|---|
| ![照片小卡](docs/r8t_card_embed.jpg) |
