# 地球Online · 安卓

Kotlin + Jetpack Compose 的原生壳（minSdk 26，targetSdk 35，包名 `app.earthonline.android`）。
和 iOS、鸿蒙一样：地球、「某一天的微缩世界」、3D 行李箱是网页构建的世界层（`web/embed.html` → `web/dist`），
装在**一个常驻的 WebView** 里铺满整屏；其余界面全是 Compose 画在上面——首页的旅程票、书、某一天、站点详情、
新建旅程（说一句话 / 去一个地方 / 导入）、旅行日记与行李箱、设置、捏人、足迹与家、全部旅程、付费墙（占位）。

> 云端环境没有 Android SDK、拿不到 Google Maven，**没有用 AGP 编译过**。做过的校验见文末「已经校验过的」；
> 拿不准的 API 都列在「没验证过的」。

## 怎么构建

```bash
cd 地球Online/app
npm ci && npm run build && npm run sync:shells   # 世界层 → web/dist → android/app/src/main/assets/world/（不进版本库）
cd android
gradle wrapper                                    # 仓库里没有 gradle-wrapper.jar；生成一次（或直接用 Android Studio 打开 android/）
./gradlew assembleDebug testDebugUnitTest
```

- 没跑 `sync:shells` 也能编译，只是运行时 `assets/world/embed.html` 不存在，地球是空的。
- 路径里有中文（`地球Online`）：`gradle.properties` 里开了 `android.overridePathCheck`（Windows 上 AGP 会拒绝非 ASCII 路径）；
  Linux 上 JVM 要用 UTF-8 的 locale（`LANG=C.UTF-8`），否则读不到这个目录下的文件。
- CI：`.github/workflows/android.yml`，**只能手动触发**（workflow_dispatch）：构建世界层、同步、`assembleDebug` + `testDebugUnitTest`、上传 APK。

## 目录

```
android/
  settings.gradle.kts / build.gradle.kts / gradle.properties / gradle/libs.versions.toml（版本目录）
  app/build.gradle.kts            测试资源直接指向 ../../shared/spec（layout.golden.json）与 ../../web/public/assets/samples
  app/src/main/
    AndroidManifest.xml           configChanges 覆盖折叠 / 旋转 / 改尺寸 / 深浅色：Activity 不重建，WebView 不重载
    assets/shared/                生成的：i18n.{zh-Hans,en,ja}.json、bridge.json、tokens.json、layout(.golden).json（勿改）
    assets/world/                 sync:shells 拷来的 web/dist（不进版本库）
    res/values*/strings.xml       生成的：应用名、权限说明（勿改）；res/xml/file_paths.xml（FileProvider）
    java/app/earthonline/android/
      gen/Shared.kt               生成的：设计令牌、频道表、核心函数名、布局阈值、小人色块（勿改）
      MainActivity.kt             边到边，setContent { EarthApp(model) }
      app/AppModel.kt             舞台（home / book / day）、整页栈、弹层、提示、与世界层同步（iOS AppModel 的移植）
      world/WorldController.kt    常驻 WebView、状态频道与重放、一次性队列、core-call / import-page、渲染进程回收后重建
      world/WorldMessages.kt      原生 → 嵌入页的每一种消息（JsonObject）；JS 字符串字面量编码
      world/AssetWebViews.kt      WebViewAssetLoader、WebView 设置、window.androidBridge
      world/SuitcaseBridge.kt     日记页的第二个 WebView（embed.html?mode=suitcase）：show / export / 清单
      world/WorldHost.kt          把常驻 WebView 挂进 Compose
      model/Spec.kt               数据契约 0.3（kotlinx.serialization，Entry 按 type 区分）
      model/Core.kt               core-call 的接口与带类型的包装（journey、plan、buildTrip、footprints、nearest、kindInfo……）
      model/TripStore.kt          一个 JSON 文件（filesDir/state.json），StateFlow，去抖 + 原子写
      i18n/I18nFormat.kt, I18n.kt  format() / resolveLocale() / 日期时长距离的移植；读导出的消息表
      layout/LayoutState.kt       shared/spec/layout.ts 的移植（纯 Kotlin）；WindowLayout.kt 是 rememberLayout()
      ui/theme/Theme.kt           令牌 → Material3 主题（墨、晨、两档字号；没有紫色）
      ui/components/              玻璃卡、图标按钮、标签、票、梦幻胶囊、StageScaffold（五个布局态）、弹层、整页骨架
      ui/screens/                 首页、书、某一天、站点详情、新建旅程（+ 语音）、日记、设置、捏人、足迹、全部旅程、付费墙
      util/Share.kt               cache/exports + FileProvider 分享
  app/src/test/                   LayoutStateTest（黄金用例）、I18nFormatTest、SpecCodingTest（示例行程往返）
```

## 架构

**世界层（一个 WebView）。** `WorldController` 用 Application 的 context 建一次 WebView，由 `AppModel`（ViewModel）持有，
跨重组、跨配置变化都是同一个。页面由 `WebViewAssetLoader` 从 `https://appassets.androidplatform.net/assets/world/embed.html?lang=<界面语言>`
供应（同源 https，ES module 与 fetch 都能用；不开 file:// 访问；猜不出类型的 `.js` 等补上 MIME）。
- 原生 → 页面：`evaluateJavascript("EarthWorld.send(<JSON 字符串字面量>)")`，字面量由 kotlinx 编码（另把 U+2028/2029 转义）。
- 页面 → 原生：`addJavascriptInterface(WorldJsBridge, "androidBridge")`，`postMessage(json)` 在 JS 线程上调用，转回主线程。
- 频道（`shared/spec/channels.ts` → 生成的 `Shared.CHANNEL_OF` / `REPLAY_ORDER`）：状态型消息每个频道只留最新一条，
  页面（重新）加载后收到页面级的 `ready` 就按 REPLAY_ORDER 重放一遍；一次性动作在就绪前排队，就绪后按顺序发一次。
  每次加载只重放一次（万一再收到 `ready` 只确认就绪）；某一天的底板建好时世界层发的是 `plate-loaded`，只是普通事件，绝不当 ready。
- `onRenderProcessGone`：返回 true，销毁旧 WebView、建新的，`WorldHost` 按新实例重新挂上，就绪后状态自动重放。

**领域核心（core-call）。** 安卓不移植算法：旅程状态、统计、时间线、日记、待办、足迹、地名搜索 / 反查、离线规划、生成书、名额、导航链接、
迁移与校验都经 `{kind:"core-call", requestId, fn, args, locale}` 调 `shared/core.ts`，收 `core-result`
（`CoreApi`：先等世界层就绪最多 30 秒，再等结果 10 秒；页面重载时正在等的调用直接作废）。
Kotlin 里只留了界面层面的小事：选一句文字（departLabel）、日期加减、某一天的「形状」签名（决定要不要重建底板，和 iOS 一样）。

**生成的公用文件。** `npm run export:shared` 产出消息表、桥接表、令牌、布局用例、`gen/Shared.kt`、`res/values*/strings.xml`；
界面文字一律 `i18n.t("键")`，Kotlin 里不写界面文字。

**数据。** `TripStore` 把 `{trips, avatar, settings, home, pins, planted}` 存成一个 JSON 文件（写临时文件再原子改名，去抖 0.3 秒，
回到后台立即写）；一本书坏了不连累其他书。第一次启动（没有存档）在世界层就绪后读
`assets/world/assets/samples/trips/index.json` 与各文件，经 `core("migrate")` 装进示例行程。示例行程不占免费版名额。

## 界面

- **舞台**：首页（按 journey 浮一张票：旅行中 / 快出发 / 刚回来 / 平常日子 + 梦幻的「新建旅程」胶囊）→ 书（票 + 天的列表；点某一天预览站点）
  → 某一天（暂停、视角、重走；下一站；站点列表，点站点 = 小人走过去 + 站点详情）。
- **弹层**：站点详情（打卡 → `mark-visited`、待办与提前多久 → `core dueFromLead`、备注、导航 → `core mapLink` + ACTION_VIEW）、
  新建旅程（说一句话 → `core plan` 一轮一轮对话 → 草稿卡 → 生成；去一个地方 → `core searchPlaces` + `core buildTrip`；导入 JSON / 行程页 HTML）、付费墙（占位）。
- **整页**：旅行日记（`core tripStats`、行李箱 WebView + 导出 PNG 分享、清单、每天的日记 `core diary` 可改）、设置（天色 / 色调 / 画质 / 语言 / 示例 / Pro / 导出 / 重置）、
  捏人（形态、发型、帽子、色块、箱子样式 → `set-avatar`）、足迹与家（`core footprints`、`core nearest` 起名、在地球上点 `pick-point` / `point-picked`）、全部旅程（一摞小票，长按删除）。
- 天色：手机是深色外观或设置固定夜晚 → `set-sky night`，否则 `day`。

## 折叠屏

`layout/WindowLayout.kt` 的 `rememberLayout()`：窗口尺寸来自 `WindowMetricsCalculator`，折痕来自 `WindowInfoTracker.windowLayoutInfo(activity)`
的 `FoldingFeature`（bounds → 折痕分出的段：竖折痕切出并排的段、横折痕切出上下两段；`state` FLAT / HALF_OPENED → 姿态），换算成 dp 后交给
`layoutOf()`（`shared/spec/layout.ts` 的逐条移植：同样的阈值、`floor` 的折痕中线、`max(24, 缝宽 + 16)` 的留白、两端先取整再算宽）。
安卓没有「合上」的直接信号：量到过折痕之后窗口变小且没有折痕，就记成外屏（`hasOuter`）。

五个布局态（`StageScaffold`）：phone = 底部抽屉（半开 / 全开）；outer = 同 phone、半开更高；spread = 内容停在第一页（≤ 400dp）、世界在第二页；
triple = 第一页内容、第三页放弹层（不盖住世界）；hover = 下半屏内容。每次变化发 `set-layout`（带段与姿态）和 `set-insets`
（phone / outer 取抽屉顶边，其余取 `worldInsets()`）。`LayoutStateTest` 跑三端共用的 `layout.golden.json` 全部用例。

## 已经校验过的（云端）

- 纯 Kotlin 部分（布局、i18n 格式、数据契约、消息、核心包装）在 JVM 上编译并跑过三组单元测试：黄金用例 22 条全过、10 本示例行程读进写出结构不变、三份消息表键一致。
- 整个 `app/src/main/java` 用 Compose Multiplatform 1.7.3（desktop，和 Jetpack Compose 1.7 同一套公共 API）+ Robolectric 的 android-all（API 34）做过类型检查，
  零错误零警告；只有安卓独有的 androidx（activity、webkit、window、core、lifecycle、AndroidView、LocalContext）是按真实签名写的桩。

## 没验证过的（第一次在 Android Studio 里构建时先看这些）

- **版本**：AGP 8.7.3、Kotlin 2.1.0（compose 编译器插件）、Gradle 8.11.1、Compose BOM 2024.12.01、activity-compose 1.9.3、lifecycle 2.8.7、
  webkit 1.12.0、window 1.3.0、core-ktx 1.15.0、kotlinx-serialization 1.7.3、coroutines 1.9.0 —— 都没实际从 Google Maven 解析过。
- **WebViewAssetLoader** 给 `.js` 的 MIME：老版本可能是 `application/octet-stream`，`AssetWebViews.fixMime` 会改成 `text/javascript`；没在真机看过 module 脚本是否都能执行。
- **addJavascriptInterface** 只注入一次：页面跳转后仍可用（理论上如此）；只允许 appassets 域名的导航。
- **WindowManager**：`FoldingFeature.bounds` 按窗口坐标（文档如此）；三折叠（两条折痕）只在逻辑上处理过，没有真机；外屏判断是启发式。
- **material-icons-extended** 的个别图标名（`_3dRotation`、`LocalActivity`、`AccountBalance`……）按 desktop 版核对过，安卓同一份。
- `enableEdgeToEdge()` + `WindowCompat.getInsetsController` 控制状态栏字色；`android:enableOnBackInvokedCallback` 与 `BackHandler` 的配合。
- `SpeechRecognizer`（可选）：没有识别服务的设备上不显示麦克风；需要 `<queries>` 里的 RecognitionService。
- 位置只取 `getLastKnownLocation`（网络 / GPS / 被动），拿不到就提示改用搜索或点地球。

## TODO

- Google Play 结算（付费墙现在只显示 `pay.nativePending`）、云同步、行程编辑器（增删站点）。
- （已做，D99）照片小卡：清单里「放一张照片进去」→ `PickVisualMedia`（不要存储权限）→ `CaseCards.photoDataUrl` 缩到长边 1280 →
  `SuitcaseBridge.makeCard`（嵌入页 `make-card`，网页那套本机抠图）→ `files/cards/<id>.img` → 书里最多 3 张。以后想更准可以换 ML Kit 的主体分割（要 Play 服务），接口不变。
- （已做，D96）长图：日记页右上角的导出钮 → `WorldController.exportLongImage(trip)`（嵌入页 `export-long-image`，和网页、iOS、鸿蒙同一张图），写进 `cache/exports/` 经 FileProvider 分享；进度在 `longImageProgress`。
- 正式的启动图标（现在是占位矢量图）、HarmonyOS Sans 字体（现在用系统字体）。
