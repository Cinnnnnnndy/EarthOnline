# 黄金用例

输入放 `trips/`，期望结果由测试断言（`../algo/*.test.ts`、`../spec/*.test.ts`）。两端原生实现（ArkTS / Swift）跑同一组输入，输出必须逐字节一致：路径格序列、到站索引、时间线、日记文本、封面颜色。

- `trips/kansai-7d.v0.1.json`：示例数据（spec 0.1 格式，用来测迁移 + 七天全部能铺到底板上）。
- `pages/iceland-nordic.html`：仓库主人的「冰岛 + 北欧 · 双方案路径规划」行程页（删去了内嵌的陆地数据与 Leaflet 样式），导入器的输入；`../import/route-page.test.ts` 断言两个方案的天数、日期、目的地、黄金圈与邮轮路段、航班标签、地理路线的连续性。应用里的内置示例是同一份文件（`web/public/assets/samples/`）。
