# 地球Online · 鸿蒙

HarmonyOS NEXT（API 12+，Stage 模型，ArkTS / ArkUI）的原生壳。和 iOS 一样：地球、某一天的浮岛、3D 行李箱是网页构建的**世界层**
（`web/dist`，`embed.html`），装在一个常驻、铺满全屏的 `Web` 组件里；其余界面（卡、抽屉、浮层、按钮、列表）全是 ArkUI，浮在它上面。
原生和世界层之间只传 JSON（`shared/spec/bridge.ts`）。领域算法（旅程状态、统计、时间线、日记、待办、足迹、离线规划、地名、配额、导航链接、迁移）
**不移植**，一律经桥接调 `shared/core.ts`（`core-call` / `core-result`）。

> 这个仓库的云端环境没有 DevEco / HarmonyOS SDK，**这里的代码没有编译过**。写法挑的是有把握的 ArkTS 严格模式写法；拿不准的接口集中列在文末。

## 怎么构建

```bash
cd 地球Online/app
npm ci && npm run build          # 世界层 → web/dist
npm run sync:shells              # 导出共用的消息表 / 令牌 / 桥接表 / 布局用例，并把 web/dist 拷进 harmony/entry/src/main/resources/rawfile/world/
```

然后用 **DevEco Studio 5.0+** 打开 `harmony/`（第一次会装 hvigor 与 `@ohos/hypium`）：

1. **补图标**（二进制不进仓库）：`AppScope/resources/base/media/app_icon.png`（1024×1024）、
   `entry/src/main/resources/base/media/app_icon.png`（同一张）、`entry/src/main/resources/base/media/startIcon.png`（启动页，约 288×288 透明底）。
2. 签名：File → Project Structure → Signing Configs → 勾 *Automatically generate signature*（写进 `build-profile.json5`，不要提交）。
3. 运行 `entry`。`rawfile/world/` 不在时世界层是空白，界面照常（核心调用会在 10 秒后超时）。
4. 单元测试：右键 `entry/src/ohosTest` → Run（hypium）。`Layout.test.ets` 读 `rawfile/shared/layout.golden.json` 跑 22 条屏幕形态用例；
   `Bridge.test.ets` 测 `format()`、语言解析、JS 字面量转义、消息的 JSON 形状、URL → rawfile 路径。

`rawfile/shared/*`、`resources/*/element/string.json`、`ets/gen/Shared.ets` 都是 `tools/export-shared.ts` 生成的，**勿改**；改 `shared/` 再跑一遍。

## 结构

```
harmony/
  AppScope/app.json5                 bundleName app.earthonline.harmony
  build-profile.json5 hvigorfile.ts oh-package.json5 hvigor/hvigor-config.json5
  entry/src/main/
    module.json5                     phone / tablet / 2in1；INTERNET、MICROPHONE、APPROXIMATELY_LOCATION；auto_rotation_restricted
    ets/entryability/EntryAbility    上下文 → 本机数据 → AppModel.start → 载入 pages/Index → 量窗口、安全区、折叠
    ets/pages/Index                  唯一的一页：Stack { 世界层 Web ; ForEach([uiKey]) { 舞台浮层 / 点选提示 / 整页 / 浮层 / 提示 } }
    ets/world/
      WorldController                常驻 WebviewController、harmonyBridge 代理、状态频道 + 一次性队列、ready 重放、core() / importPage()
      WorldMessages                  每种消息一个类（字段 = JSON 键）、收到的 WorldEvent、jsLiteral / sendScript
      RawfileServer                  https://world.earthonline.local/<path> → rawfile/world/<path>（onInterceptRequest，带 MIME）
      CoreApi                        shared/core.ts 的类型化门面（journey、tripStats、timeline、diary、placeTodos、dueFromLead、footprints、
                                     searchPlaces、nearest、kindInfo、skyPhase、plan、buildTrip、quota、mapLink、migrate、validate）
      SuitcaseBridge                 日记页的第二个 Web（embed.html?mode=suitcase）：show-suitcase / export-suitcase / suitcase-image
    ets/model/
      Spec                           schema 0.3 的接口（Entry 是一个接口，按 type 取字段）+ 核心返回值的形状
      TripStore                      {trips, avatar, settings, home, pins, planted} → filesDir/state.json；写时复制、发 AppStorage、0.3 秒去抖写盘；
                                     第一次启动在世界层就绪后装两本示例（gen/Shared.ets 的 STARTER_SAMPLES，逐本 core('migrate')）
      AppModel                       舞台机 home | book(id) | day(id, i)、书页选中的那一天、浮层栈、整页栈、去抖的 pushWorldState、
                                     一天的「形状」签名（变了才 show-day）、世界层事件、点选、名额、提示
    ets/i18n/I18n                    读 rawfile/shared/i18n.<locale>.json；format() 移植；语言 = 设置或系统语言（LocalizationKit）；日期 / 时长 / 距离格式
    ets/layout/LayoutState           shared/spec/layout.ts 的移植（纯函数）+ 量窗口、折痕、姿态、安全区
    ets/theme/Theme                  白天 / 夜里两套令牌（gen/Shared.ets）、梦幻胶囊与票的固定色
    ets/components/                  GlassCard、IconButton、GlassIconButton、Tag、InkButton、GlassButton、Segmented、ListSection、NavRow、
                                     PageHeader、Field、Ticket（Canvas 画的纸票）、DreamyCapsule、StageScaffold、ItineraryList、Icons
    ets/screens/                     HomeOverlay、BookOverlay、DayOverlay、StopDetailSheet（+ 待办 / 备注 / 导航子浮层）、NewTripSheet、
                                     PaywallSheet、DiaryPage、SettingsPage、AvatarPage、FootprintsPage、ShelfPage、Hosts（浮层 / 整页 / 提示的宿主）
    resources/base/media/ic_*.svg    图标（全是填充路径：Image.fillColor 只换填充色，不换描边）
  entry/src/ohosTest/ets/test/       Layout.test、Bridge.test（hypium）
```

### 世界层与桥接

- 网页从虚拟的 `https://world.earthonline.local/` 供应：`onInterceptRequest` 把路径映射到 `rawfile/world/`，同步读
  `resourceManager.getRawFileContentSync`，按扩展名给 MIME（html、js、css、json、png、jpg、svg、ttf、wasm、glb、bin……）。
  ES module、fetch、Worker、IndexedDB 因此都是同源 https；不是这个源的请求一律 404（世界层不连外网）。
- 原生 → 世界：`runJavaScript("(function(){var w=window.EarthWorld; … w.send(<JSON.stringify(json)>) … })()")`；世界 → 原生：`javaScriptProxy`
  注册的 `harmonyBridge.postMessage(json)`（`web/src/embed.ts` 已经认这个名字）。
- 状态型消息（`gen/Shared.ets` 的 `CHANNEL_OF`）按频道只留最新一条；页面级的 `ready`（每次载入一次）之后按 `REPLAY_ORDER` 重放，
  同一次载入里再来一个 `ready` 不再重放。一次性消息（播放、打卡、`core-call`、`import-page`……）就绪前排队、就绪后按顺序发；
  `core()` / `importPage()` 的 10 秒超时从**真正发出去**那一刻算。底板建好发的是 `plate-loaded`（普通事件：面板进度清零、接着播、走到书页里点的那一站）。
- 渲染进程被回收（`onRenderExited`）→ 重新载入 → `ready` → 全部状态重放。换语言 → 带新的 `?lang=` 重新载入。

### 舞台与布局态

| 布局态 | 典型设备 | 舞台的卡 | 浮层（站点详情、新建旅程……） | set-insets |
|---|---|---|---|---|
| phone | 直板机、展开后竖持 | 底部抽屉：半开 42% / 全开，拖或点抓手切换 | 底部面板 + 遮罩 | 抽屉顶边以下 |
| outer | 折叠机外屏 | 同 phone，半开 55% | 同 phone | 同 phone |
| spread | 阔折叠 / 书式展开横持、横持平板 | 停在左页（≤ 400，避开书脊） | 浮在右页底部 | `left` = 第二页起点 |
| triple | 三折叠全开、宽屏 | 左页；图标在中页右上 | **停靠在右页**，不盖住世界 | `left` + `right` |
| hover | 半开悬停 | 下半屏 | 下半屏 | `bottom` = 下半屏 |

每次布局变化都发 `set-layout`（布局态、宽高、量到的折痕段、姿态）；`StageScaffold` 量好卡的位置发 `set-insets`。
量折叠用的接口（`@kit.ArkUI` 的 `display`）：`isFoldable`、`getFoldStatus`、`getFoldDisplayMode`、`getCurrentFoldCreaseRegion`（折痕矩形 → 窗口里的段）、
`on('foldStatusChange')`、`on('foldDisplayModeChange')`；窗口：`getWindowProperties().windowRect`、`on('windowSizeChange')`、
`getWindowAvoidArea`（SYSTEM / CUTOUT / NAVIGATION_INDICATOR）、`on('avoidAreaChange')`。px → vp 用 `getDefaultDisplaySync().densityPixels`。

### 界面约定（ios/README.md「设计要点」）

没有紫色；能点的是墨（夜里白）；高亮只有晨色（「现在」「去过」）；玻璃卡（半透明 + `backdropBlur`）；点击区 44；字号只有 17 / 13（票的地点名 22 是物件上的印字，与网页、iOS 一致）；
「新建旅程」梦幻胶囊是唯一带颜色的按钮；通用操作用图标按钮；每一趟旅程是一张票。所有界面文字都从消息表按键取（`I18n.t('home.newTrip')`），`.ets` 里没有中英文界面字面量。
语言或深浅一变，`eo.uiKey` 变，整层界面重建；世界层 `set-sky`：深色 = night，否则 day。

## 还没做的（明确标了 TODO）

- **付费**：`PaywallSheet` 只说明、不收款。接 IAP Kit 后把生效的商品 id 交给 `core('entitlement')`，用 `core('quota')` / `core('canUse')` 判断；现在一律按免费版。
- **语音**：新建旅程只有打字（规划照常走 `core('plan')`）；接 `@kit.CoreSpeechKit` 的 `speechRecognizer` 后把转写交给 `send()`。
- **云同步**、站点编辑器（增删改条目）。
- （已做，D99）照片小卡：清单里「放一张照片进去」→ `Photos.pickOne`（`PhotoViewPicker`，不要相册权限）→ `Photos.dataUrl` 缩到长边 1280、按 EXIF 转 →
  `SuitcaseBridge.makeCard`（嵌入页 `make-card`）→ `filesDir/cards/<id>.img` → 书里最多 3 张。没验证过：`getImageProperty(ORIENTATION)` 回的字串、`createPixelMap` 是否已自动转正（若已转正，`Photos.degrees` 会多转一次）。
- （已做，D98）行李箱的清单：日记页箱子旁的编辑钮打开——搜索框（停 0.2 秒再搜）、四个场景标签、「箱子里的」一排（点了拿出来，照片卡直接删）、按组的图标格（嵌入页渲染的类 emoji 小图，点一格放进去 / 拿出来）、恢复默认；`SuitcaseBridge` 收发 `case-search` / `case-results`、`case-toggle` / `case-edits`、`suitcase-contents`。
- （已做，D96）长图：日记页书名旁的导出钮 → `WorldController.exportLongImage(trip)`（嵌入页 `export-long-image`，和网页、iOS、安卓同一张图），写进 `files/exports/` 再分享；进度在 AppStorage `eo.longProgress`。

## 没验证过的接口（第一次在 DevEco 里构建时先看这些）

- `Web.onInterceptRequest` 的回调参数：API 12 是 `OnInterceptRequestEvent`，旧版是可选的 `{ request }`；这里写成 `(event) => … event ? … : ''` 两边都能过。
  主文档（`embed.html`）的请求也会经过它——按文档如此，未在真机确认。`WebResourceResponse.setResponseData(ArrayBuffer)`（API 11+）、`setResponseHeader`。
- `javaScriptProxy` 注入对象的方法里 `this` 的绑定：没依赖它（方法里直接找单例）。注入时机：假定页面脚本执行时 `window.harmonyBridge` 已在（嵌入页的 `ready` 在模块脚本末尾发）。
- `runJavaScript(script): Promise<string>` 的结果格式（字符串结果是否带引号）：只用 `indexOf('ok' / 'no')` 判断。
- `Image.fillColor` 对 SVG：按「只换填充」处理，所以图标全是填充路径。
- `backdropBlur` 能否模糊到下面的 `Web`（同层渲染）。不行的话玻璃卡退化成半透明白，功能不受影响。
- `HitTestMode.Transparent`：浮层容器靠它把空白处的触摸让给世界层；自定义组件节点本身是否参与命中测试未确认。
- `@Builder export function` 导出全局构建函数（`components/Controls.ets` 的 `emptyBuilder`）；`@BuilderParam` 用箭头函数传父组件的 `@Builder` 以保留 `this`。
- `display.getFoldDisplayMode()` 的 MAIN / SUB 哪个是外屏、三折叠组合 `FoldStatus` 的取值（`LayoutState.postureOf`）。
- `ApplicationContext.setColorMode`（API 11+）、`UIContext.showDatePickerDialog`、`UIContext.getPromptAction().showDialog`、`UIContext.animateTo`。
- `systemShare.SharedData` / `ShareController.show`（ShareKit）与 `uniformTypeDescriptor.UniformDataType.PNG / FILE`；`picker.DocumentViewPicker(context).select` 的 `fileSuffixFilters`。
- `util.TextDecoder.decodeWithStream`（API 12 标了废弃，换 `decodeToString` 也行）；`context.createModuleContext('entry')`（测试里读 entry 的 rawfile 的退路）。
- `geoLocationManager.getCurrentLocation({ priority: FIRST_FIX, timeoutMs })` 与只申请 `APPROXIMATELY_LOCATION`。
- `Want` 用 `action: 'ohos.want.action.viewData'` + `entities: ['entity.system.browsable']` 拉起浏览器（导航链接）。
- AppScope 与 entry 都有 `app_name`：按「模块资源覆盖应用资源」处理。
- `webview.WebviewController.initializeWebEngine()` 放在 `onCreate`（失败不影响，首次建 Web 时也会初始化）。
