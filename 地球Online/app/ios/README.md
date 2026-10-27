# 地球Online · iOS

原生 SwiftUI 应用（iOS 26 起，Liquid Glass；为 iOS 27.1 的折叠屏 iPhone Duo 留好了接口）。
地球与「某一天的微缩世界」是网页构建的世界层（`web/embed.html` → `web/dist`），装在一个常驻的 `WKWebView` 里；
其余界面全是原生：首页的旅程状态、书、某一天、站点详情、旅行日记与导出、设置、足迹与家、新建旅程（语音 + 规划助手 / 选目的地 / 导入）、付费墙。

> 这个仓库的云端环境没有 Xcode，**这里的代码没有编译过**。用到的 API 都挑了有把握的写法；拿不准的都隔离了，清单见文末。

## 怎么构建

```bash
cd 地球Online/app
npm ci && npm run build          # 世界层 → web/dist（没构建也能跑，只是地球换成占位页）
cd ios
brew install xcodegen            # 一次
xcodegen generate                # 由 project.yml 生成 EarthOnline.xcodeproj（不进版本库）
open EarthOnline.xcodeproj
```

- 目标 `EarthOnline`：iPhone，iOS 26.0，Bundle ID `app.earthonline.ios`，Swift 5 语言模式（`SWIFT_STRICT_CONCURRENCY=minimal`）。
- 构建脚本「Bundle World」把 `../web/dist` 拷进 App 包的 `World/`；没有 `web/dist/embed.html` 时拷 `Support/placeholder-embed.html` 并给出警告。
- 单元测试 `EarthOnlineTests`（⌘U）。
- Scheme 的 Run 已经挂上 `EarthOnline.storekit`（本地测购买）；启动参数里有几条默认关闭的：
  `-screenshotState traveling|planning|empty`（内存里造示例旅程，不写盘）、`-proUnlocked YES`（直接当 Pro）。
- CI：`.github/workflows/ios.yml`，**只能手动触发**（workflow_dispatch）。构建、测试、在模拟器里按三种状态 + 深色 + 英文 + 日文截图；有 iPhone Duo 模拟器时再拍 Duo。

## 目录

```
ios/
  project.yml                 XcodeGen 工程描述
  EarthOnline.storekit        StoreKit 本地测试配置（Pro 月 / 年、名胜扩展包）
  Support/                    占位世界页、地名表生成脚本
  EarthOnline/
    App/        EarthOnlineApp、AppModel（导航、面板、提示、与世界层同步）
    Model/      Spec（shared/spec/types.ts 的 Codable 版）、TripStore（本机 JSON 存储）、导入与迁移、新建、示例旅程
    Domain/     天色（daylight.ts）、景点类型（landmark-kinds.ts）、时间线、日记（逐字对齐 TS）、统计、足迹、旅程状态、地名表、日期格式
    Design/     设计令牌（墨 / 晨、四个字号两种字重）、玻璃卡片与图标按钮、墨色小胶囊按钮、梦幻沙画胶囊（去色版）
    Layout/     StageLayout（compact / spread）、DuoLayout（iOS 27.1 API 全部隔离在这里）
    World/      WorldController（WKWebView、消息队列与重放）、消息定义、自定义 scheme 供应 App 包里的网页
    Screens/    首页、书、某一天、站点详情 / 编辑、日记与长图、设置、足迹、全部旅程、新建旅程（语音）、付费墙
    Voice/      SpeechService（本机识别）、SpeechVoice（朗读）
    Planner/    TripPlanner 协议、LocalRulePlanner（离线）、RemotePlanner（云端）
    Commerce/   Entitlements、StoreService（StoreKit 2）
    Sync/       CloudSyncService（CloudKit 私有库，按 updatedAt 合并）
    Resources/  Assets.xcassets（强调（已去色）/ 晨的 Any·Dark、图标）、Localizable.xcstrings（zh-Hans 源、en、ja）、各语言 InfoPlist.strings
  EarthOnlineTests/           天色、景点类型、旅程状态、数据契约、离线规划、与 TS 逐字一致的 PRNG / 日记 / 时间线、付费门槛与同步合并
```

## 设计要点（照产品负责人的方向）

- 地球是主画面，其余界面尽量少：右上一组 44pt 玻璃圆按钮（`GlassEffectContainer`），底部一张贴内容高度、贴内容宽度（最宽 420）的玻璃卡。
- 每一趟旅程都是一张票（第八轮末，D74）：`Design/Ticket.swift` 的 `TicketView`（`TicketShape` 用 `Path.subtracting` 挖四角与撕线的缺口；白纸 + `GrainTexture` 颗粒；票根竖排印字；撕票根的动画尊重「减弱动态效果」），用在 `HomeOverlay`（三种大票与空闲时的小票）、`BookOverlay` 的抽屉头、`ShelfView`。票面印字用等宽、大写、字距，只许出现在票上。
- 行李箱（第八轮末，D75 / D78）：3D 的箱子在世界层（网页 three.js，`shared/world/suitcase-scene.ts`）里，iOS 不自己画。`Screens/Diary/SuitcaseWebView.swift` 用一个独立的 WKWebView 装嵌入页 `embed.html?mode=suitcase`（只建箱子，不建地球与某一天的世界；`WorldSchemeHandler` 同一份 World/ 目录），`SuitcaseBridge` 等 `bridge-ready` 后发 `show-suitcase`（带这本书的 JSON 与小人的穿搭），导出发 `export-suitcase`、收 `suitcase-image`（dataUrl）存成 PNG 给分享面板；`DiaryView` 顶上就是它。「AI 加的」那几样目前由嵌入页按本机规则挑；原生以后可以自己问 `/v1/pack` 再随 `show-suitcase` 的 `extras` 传进去。箱子的样式是 `Avatar.suitcase`（日记页一个分段选择器）。增减（D82）：`Screens/Diary/CaseCards.swift` 用 Vision 的 `VNGenerateForegroundInstanceMaskRequest` 抠主体（抠不出来整张做成拍立得），图存 Application Support/EarthOnline/cards，书里记 `suitcase.cards`；`SuitcaseEditSheet` 是清单（D84）：搜索框（打一句话或一个词）、四枚场景标签、按组一格一格类 emoji 的图标（`LazyVGrid`），点一格放进去或拿出来；检索、分组、规则、图标都在嵌入页那份（`shared/algo/case-search.ts`、`shared/world/item-icons.ts`），原生只画——发 `case-search` 收 `case-results`（带图标的 dataUrl），发 `case-toggle` 收 `case-edits`（新的 `CaseEdits`，存进书里再重新 `show`），`suitcase-contents` 也带图标；「箱子里的」那一排点叉拿出来；`PhotosPicker` 放照片，恢复默认。书里的 `CaseEdits` 多一项 `gear`（自己挑的随身物件）。人物形态（D86 / D89b）：`Avatar.form`（human / xiaowang / xiaowu / fugui / fox / cat / shiba / bear / rabbit / penguin / panda / duck / seal / otter / capybara / bean / cloud / pebble，nil = 小人），捏人页一个「形态」选择器，嵌入页按它建角色，原生不画。夜里的浮岛（D85）不用改原生：嵌入页收 `set-sky` 时一并把某一天的世界切成夜色、亮灯。没编译过。
- 「新建旅程」是浮在地球上的胶囊（44pt），全应用唯一带颜色的按钮：蜜 → 晨 → 琥珀，只有晨色一个色相（`dreamHoney / dreamDawn / dreamAmber`；第一版的珊瑚端和天空打架，去掉了），白星，墨色字；深色外观下底深一档。仍是平涂渐变 + 代码生成的颗粒 + 5 颗星光 + 白色渐变玻璃边。旅行中时它缩成右上的加号。
- 通用操作（编辑、删除、清除、重写、勾选）是 `IconButton`（32pt 圆，点击区 44，带无障碍标签）；同一类信息（状态、D2、类型、到期日）用 `TagView`（12 号、高 20 的小胶囊，「现在」用晨色）。
- 行程列表的图标按六组给（`LandmarkKinds.groupSymbol`）：交通一种（`transportSymbol`）、住宿一种（床）、其余按人文 / 自然 / 休闲 / 吃喝购物；类型级图标只在选类型时用。
- 景点待办：`PlaceEntry.todos`，`Domain/Todos.swift` 与网页 `shared/algo/todos.ts` 同一套；站点详情里只留一行入口（数量标签 + 最近一件），点开的 sheet 里是 `TodoSection`（添加时选提前 1 个月 / 2 周 / 1 周 / 1 天 / 当天）；备注同样是一行入口（「添加备注」→ `TextEditor` 的 sheet，`TripStore.setNotes`）。行程列表（`ItineraryList`）从上往下编号：`StopRow(index:)` 左边是墨底白字的序号，组图标在名字前，一条细线把序号串起来。提示跟着站点：`StopRow` 名字旁的数量标签与最近一件（`Todos.ofPlace`），书与首页不再汇总。
- 字阶只有两档（第八轮末，D69）：`.body` 17（标题与按钮用 semibold）与 `.footnote` 13（次要、标签）；令牌名 `eoTitle / eoSub / eoCaption` 保留。站点详情的「导航」用 `confirmationDialog` 四选一（`MapsLink.App`），链接与网页 `shared/geo/maplinks.ts` 同一套。不用字间距、全大写和「A · B」的中点串；导入数据里的「 · 」显示时换成当前语言的逗号。
- 颜色（第八轮去色）：没有蓝紫色的强调色了，能点的、选中的、路线都是墨（深色外观下是白；`Lake` / `AccentColor` 色集的值与墨相同）；高亮色只有晨 #F0B03A（夜 #F5BE4E），只用于「现在」和「去过」。其余是系统墨色层级。 第八轮校准（视觉文档 15.9）：`DawnInk` 白天 `#754A00`；标签文字用新加的 `Ink2`（`#444C6A` / 深色 `#C9CDE0`），`TagView` 改成 `minHeight: 20` 随动态字体长高；语音按钮的涟漪与缩放尊重「减弱动态效果」。
- 按钮：主按钮是墨色小胶囊 `InkCapsuleButtonStyle`（高 36，随内容宽，一屏最多一个）；次按钮 `.glass`；再次是文字。首页卡片是左文右钮三行；书、某一天、站点行、路段行的文字按网页第七 / 八轮精简。
- 首页状态机（`JourneyState`，与网页一致）：旅行中 → 快出发（3 天内）→ 刚回来（7 天内）→ 平常日子（地球回到家；家没设时用时区推经度、纬度 30°）。
- 折叠屏（D90，与 `shared/spec/layout.ts` 同一套规则）：宽 < 600 → compact（手机、折叠外屏、展开后竖持）；宽 ≥ 1100 且宽高比 ≥ 1.3 → triple（三折叠全开 / 宽桌面：左页卡片、中页地球、右页弹层）；宽高比 ≥ 0.8 → spread（卡片停在左页、避开 24pt 的书脊，地球居中在右页）；否则 compact。半开悬停 hover 留了状态位（iOS 暂无 API）。三页宽时（`RootView`）站点详情、新建旅程这些弹层改用右边的检查器栏（`.inspector`），不盖住中页的地球。`StageLayout.swift` 是移植；`EarthOnlineTests/LayoutGoldenTests.swift` 跑 `layout.golden.json` 里只给了宽高的那 9 条（iOS 没有折痕段与姿态的输入）。

## 多语言

String Catalog `Resources/Localizable.xcstrings`：简体中文是源语言（键就是中文原文），英文、日文全部译好（英文的数量词带单复数）。
界面文字一律走 `LocalizedStringKey` / `String(localized:)`；日期、时长、距离用 `FormatStyle` 按当前语言格式化。
语音识别与朗读的语言跟随界面（zh-CN / en-US / ja-JP）。行程内容（书名、地名、交通名）是数据，不翻译。
加新文字后运行 `python3 Support/check_strings.py` 核对：它扫描代码里的界面文字，报告目录里缺的键或缺的译文（键里整数插值写成 `%lld`，变量名用 `n` 或 `nXxx`；其余插值写成 `%@`）。

## 语音与规划

新建旅程的「说一说」：大麦克风（玻璃圆，听的时候墨色、随音量呼吸）、实时转写、一小段对话；给出草稿后点「生成这本书」。
规划走 `TripPlanner` 协议：

- `LocalRulePlanner`（离线，免费）：从内置地名表认目的地，认「五天 / 5天 / 5 days / 3日間 / 2泊3日 / 一周 / 周末」、
  「下个月 / 10月3号 / 下周 / 明天 / next month / Oct 12 / 来月」、主题关键词和旅程类型（自驾、海岛、徒步、铁路、亲子乐园、出差），缺什么追问什么。
- `RemotePlanner`（Pro，地址在设置里填，默认空 = 不用；App 里不放任何密钥）：

```
POST {endpoint}/v1/plan
{ "messages": [{"role":"user"|"assistant","text": string}],
  "context": { "today": "YYYY-MM-DD", "locale": "zh-Hans"|"en"|"ja",
               "home"?: {"name":string,"lat":number,"lng":number},
               "trips"?: [{"title":string,"startDate":string,"endDate":string}] } }
200 → { "reply": string, "question"?: string, "draft"?: Trip (spec 0.3), "done": boolean }
非 200 → { "error": string }
```

云端出错时自动退回离线规划并说明一句。

## 付费结构

免费下载。免费版：最多 3 本书、只存本机、本机语音与离线规划。地球Online Pro（`app.earthonline.pro.monthly` / `.yearly`）：
不限本数、云端规划、iCloud 同步、高清长图（2160px，免费版 1080px）、名胜与装扮扩展包；名胜包也可单买（`app.earthonline.pack.landmarks`）。
免费用户建第 4 本、或点 Pro 功能时弹出贴内容高度的玻璃付费墙。

iCloud 同步：CloudKit 私有库，每本书一条 `Trip` 记录（`json`、`updatedAt`、`title`），同 id 按 `updatedAt` 取新，本地删掉的书在远端也删。
**默认不开**：没开通 iCloud 能力时碰 `CKContainer` 会崩溃，所以只有 Info.plist 的 `EOCloudKitContainerID` 填了容器 ID 才会建容器。
开通：Signing & Capabilities 加 iCloud → CloudKit、选容器 → 在 `project.yml` 的 `EOCloudKitContainerID` 填同一个 ID → 在 CloudKit 控制台给 `Trip` 的 `recordName` 建 Queryable 索引。

## 世界层桥接

原生 → 世界：`EarthWorld.send(json)`；世界 → 原生：`webkit.messageHandlers.world.postMessage(json)`。
页面用自定义 scheme `earthworld://app/embed.html` 从 App 包的 `World/` 供应（ES module 与 fetch 在 file:// 下限制多）；
`WorldController.loadMode = .fileURL` 可切回 `loadFileURL(_:allowingReadAccessTo:)`。
嵌入页的 `World` 在构造时就发 `ready`（那时还没有监听者），所以原生注入一段脚本，等 `window.EarthWorld` 出现后自己发 `bridge-ready`。
状态型消息（书、天色、家、足迹、留白、模式、相机……）按频道只保留最新一条，页面重载或网页进程被系统回收后自动重放。

嵌入页还需要补的消息（现在的 `web/src/embed.ts` 只有某一天的世界）：

```ts
// 原生 → 世界
| { kind: "show-globe" }
| { kind: "show-day"; trip: Trip; dayIndex: number }            // 嵌入页用 dayScene(trip, dayIndex) 建路线再 load-plate
| { kind: "set-trips"; trips: Trip[]; today: string }           // tripToGlobe → GlobeView.setBooks
| { kind: "focus-home"; lat: number; lng: number; animate: boolean }
| { kind: "focus-book"; id: string; animate: boolean }
| { kind: "focus-day"; id: string; dayIndex: number; animate: boolean }
| { kind: "fly-to"; lat: number; lng: number; alt: number }
| { kind: "set-home"; home: { name: string; lat: number; lng: number } | null }
| { kind: "set-footprints"; flags: { id: string; name: string; lat: number; lng: number }[]; fresh: string[] }
| { kind: "set-insets"; left: number; bottom: number; top: number; right: number }   // pt = CSS px
| { kind: "set-sky"; phase: "day" | "dusk" | "night" }
| { kind: "set-palette"; palette: Palette }
| { kind: "mark-visited"; entryId: string; visited: boolean }
| { kind: "pick-point"; on: boolean }
| { kind: "import-page"; requestId: string; html: string }      // 用 importRoutePage 解析行程页
// 世界 → 原生
| { kind: "ready" }                                             // 建议在 world.on(post) 之后再发一次
| { kind: "book-tapped"; id: string }
| { kind: "day-tapped"; id: string; dayIndex: number }
| { kind: "point-picked"; lat: number; lng: number }
| { kind: "flags-planted"; ids: string[] }
| { kind: "import-result"; requestId: string; trips: Trip[]; warnings: string[]; error?: string }
```

## 没验证过、以及怎么隔离的

- **没编译过**：云端没有 Xcode / Swift 工具链。第一次在 Mac 上构建时请先看编译错误；代码按 Swift 5 语言模式写，并发检查设为 minimal。
- iOS 27.1 的 `ArrangementView`、`GeometryProxy.reservedRegions`、`.onHingeChange`：全部在 `Layout/DuoLayout.swift` 的 `#if IPHONE_DUO_SDK`（默认不定义）+ `if #available(iOS 27.1, *)` 里；
  默认只用几何兜底。拿到正式 SDK 后在 `OTHER_SWIFT_FLAGS` 加 `-D IPHONE_DUO_SDK` 并对照真实签名改那一段。`ArrangementView` 暂未使用（舞台自己的 compact / spread 已经覆盖同样的布局）。
- Liquid Glass（`glassEffect`、`GlassEffectContainer`、`.glass` / `.glassProminent`）按 iOS 26 公开 API 写；玻璃样式的分支用 if/else 写而不是三元表达式，少依赖类型推断。
- WebKit 代理类（消息、导航、scheme）不标 actor，让它随 SDK 里协议的隔离走；回调里一律 `Task { @MainActor in … }` 转回主线程。
- 语音：`SFSpeechRecognizer`（支持时 `requiresOnDeviceRecognition`）+ `AVAudioApplication.requestRecordPermission()`；音频回调在非隔离的静态函数里造，避免被推断成主线程闭包。
- StoreKit 配置文件按 Xcode 的 JSON 格式手写，若 Xcode 打开时报格式问题，用 Xcode 新建一份再按同样的商品 ID 填。
- SF Symbols 名字按常见符号挑的（如 `ferriswheel`、`beach.umbrella`、`mountain.2`）；名字不存在时只是不显示图标，不会崩溃。
- 照片小卡（D99）：先 Vision（`SubjectLifter`）；它没抠出主体时再请嵌入页的本机抠图试一次（`SuitcaseBridge.makeCard` → `make-card`），还不行才整张做成拍立得。
- 长图（D96）：日记页先请嵌入页出图（`WorldController.exportLongImage(trip:)` → `export-long-image`，每天一张世界层渲染图，和网页同一份排版），世界层不在、出错或 5 分钟没回才退回 `LongImageExporter` 的原生文字版。
- 足迹的「去过几个国家」需要国界数据，原生这版只统计地方数和离家最远。
