# 随包字体

| 文件 | 字体 | 来源 | 许可 |
|---|---|---|---|
| `HarmonyOS_Sans_SC_Regular.ttf`、`HarmonyOS_Sans_SC_Medium.ttf` | HarmonyOS Sans SC（华为终端有限公司，汉仪字库制作） | 原版文件，未改动（取自 npm 包 `@fontpkg/harmony-os-sans-sc` 1.0.3） | 《HarmonyOS Sans 字体软件许可协议》：免费商用，允许使用、复制、嵌入软件 / App、捆绑与再分发**未修改**的副本；不允许单独售卖字库、不允许修改或制作衍生版本。以华为开发者联盟设计资源页的协议原文为准。 |

用法见 `shared/world/tokens.ts` 的 `TYPE.family`：苹果设备用系统苹方，鸿蒙用系统 HarmonyOS Sans，两者都没有时浏览器才会下载这两份文件（Regular 给 100–499 字重，Medium 给 500–900）。
因为许可不允许修改，这里不做子集化；原生壳里鸿蒙与 iOS 都用系统字体，不需要带这两份文件。
