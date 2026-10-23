import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGS, LOCALES, placeholders, resolveLocale, format, t, setLocale, getLocale, monthDay, dateRange, fullDate, fullDateRange, duration, km, days, stops, list, names, plain, latLng, type Locale } from "./index.ts";
import { ZH } from "./zh-Hans.ts";
import { formatDuration, parseDuration } from "../algo/duration.ts";
import { KINDS, GROUP_NAME, KIND_NAMES, kindName, groupName } from "../world/landmark-kinds.ts";
import { STYLES, styleName } from "../world/style.ts";
import { COUNTRY_ZH, countryName } from "../geo/countries.ts";
import { THEMES } from "../spec/types.ts";
import { themeName } from "../algo/world-spec.ts";
import { modeName } from "../algo/transport.ts";
import { generateDiary } from "../algo/diary.ts";
import { fontFamily, FONT_STACK, cssVars, detectPlatform } from "../world/tokens.ts";

const keys = Object.keys(ZH);

test("消息表：三种语言的键完全一致，没有空串", () => {
  for (const l of LOCALES) {
    assert.deepEqual(Object.keys(CATALOGS[l]).sort(), [...keys].sort(), l);
    for (const [k, v] of Object.entries(CATALOGS[l])) assert.ok(typeof v === "string" && v.length > 0, `${l} ${k} 是空的`);
  }
});

test("消息表：同一个键在各语言里的占位一致", () => {
  const bad: string[] = [];
  for (const k of keys as (keyof typeof ZH)[]) {
    const want = placeholders(ZH[k]).join(",");
    for (const l of LOCALES) { const got = placeholders(CATALOGS[l][k]).join(","); if (got !== want) bad.push(`${l} ${k}: {${got}} ≠ {${want}}`); }
  }
  assert.deepEqual(bad, []);
});

test("消息表：没有「A · B」式的中点串，英文不用中文标点", () => {
  for (const l of LOCALES) for (const [k, v] of Object.entries(CATALOGS[l])) assert.ok(!/ · |・/.test(v), `${l} ${k}: ${v}`);
  for (const [k, v] of Object.entries(CATALOGS.en)) if (!k.startsWith("lang.")) assert.ok(!/[，。、：；（）《》「」]/.test(v), `en ${k}: ${v}`);
});

test("resolveLocale：设置优先；跟随手机时按语言列表第一个认识的；繁体暂用简体", () => {
  assert.equal(resolveLocale("ja", ["en-US"]), "ja");
  assert.equal(resolveLocale("en", ["zh-CN"]), "en");
  assert.equal(resolveLocale("auto", ["zh-CN", "en"]), "zh-Hans");
  assert.equal(resolveLocale("auto", ["zh-TW"]), "zh-Hans");
  assert.equal(resolveLocale("auto", ["zh-HK", "en"]), "zh-Hans");
  assert.equal(resolveLocale("auto", ["zh-Hant-TW"]), "zh-Hans");
  assert.equal(resolveLocale("auto", ["ja-JP", "en-US"]), "ja");
  assert.equal(resolveLocale("auto", ["fr-FR", "ja"]), "ja");
  assert.equal(resolveLocale("auto", ["en-GB"]), "en");
  assert.equal(resolveLocale("auto", ["fr-FR", "de"]), "en");
  assert.equal(resolveLocale(undefined, []), "zh-Hans");
  assert.equal(resolveLocale("auto", []), "zh-Hans");
});

test("t：占位、单复数、按语言取；setLocale 切换当前语言", () => {
  assert.equal(format("{n} {n:day|days}", { n: 1 }), "1 day");
  assert.equal(format("{n} {n:day|days}", { n: 3 }), "3 days");
  assert.equal(format("缺 {x}", {}), "缺 {x}");
  assert.equal(t("home.nextTrip", { title: "冰岛", n: 3 }, "zh-Hans"), "下一段：冰岛，3 天后");
  assert.equal(t("home.nextTrip", { title: "冰岛", n: 1 }, "en"), "Next: 冰岛, in 1 day");
  assert.equal(t("home.nextTrip", { title: "冰岛", n: 3 }, "ja"), "次の旅：冰岛、3日後");
  const before = getLocale();
  try { setLocale("en"); assert.equal(t("home.newTrip"), "New trip"); setLocale("ja"); assert.equal(t("home.newTrip"), "新規旅行"); }
  finally { setLocale(before); }
  assert.equal(t("home.newTrip"), "新建旅程");
});

test("日期：月日、区间、带年份", () => {
  assert.equal(monthDay("2026-10-03", "zh-Hans"), "10月3日");
  assert.equal(monthDay("2026-10-03", "en"), "Oct 3");
  assert.equal(monthDay("2026-10-03", "ja"), "10月3日");
  assert.equal(dateRange("2026-10-03", "2026-10-12", "zh-Hans"), "10月3日 – 12日");
  assert.equal(dateRange("2026-09-28", "2026-10-03", "zh-Hans"), "9月28日 – 10月3日");
  assert.equal(dateRange("2026-10-03", "2026-10-12", "en"), "Oct 3 – 12");
  assert.equal(dateRange("2026-09-28", "2026-10-03", "en"), "Sep 28 – Oct 3");
  assert.equal(dateRange("2026-10-03", "2026-10-12", "ja"), "10月3日 – 12日");
  assert.equal(fullDate("2026-10-03", "zh-Hans"), "2026.10.03");
  assert.equal(fullDate("2026-10-03", "en"), "Oct 3, 2026");
  assert.equal(fullDateRange("2026-10-03", "2026-10-12", "zh-Hans"), "2026.10.03 – 10.12");
  assert.equal(fullDateRange("2026-12-28", "2027-01-03", "ja"), "2026.12.28 – 2027.01.03");
  assert.equal(fullDateRange("2026-10-03", "2026-10-12", "en"), "Oct 3 – 12, 2026");
  assert.equal(fullDateRange("2026-12-28", "2027-01-03", "en"), "Dec 28, 2026 – Jan 3, 2027");
});

test("时长、距离、数量、坐标、并列", () => {
  assert.equal(duration(87, "zh-Hans"), "1 小时 27 分钟");
  assert.equal(duration(87, "en"), "1 h 27 min");
  assert.equal(duration(87, "ja"), "1時間27分");
  assert.equal(duration(60, "en"), "1 h"); assert.equal(duration(5, "ja"), "5分"); assert.equal(duration(null, "en"), "");
  assert.equal(formatDuration(80), "1 小时 20 分钟");                     // 旧接口：跟当前语言走，默认简体
  assert.equal(km(12.34, "zh-Hans"), "12.3 公里");
  assert.equal(km(12.34, "en"), "12.3 km");
  assert.equal(km(1234.5, "en"), "1,235 km");
  assert.equal(km(1234.5, "ja"), "1,235 km");
  assert.equal(days(1, "en"), "1 day"); assert.equal(days(5, "en"), "5 days"); assert.equal(days(5, "zh-Hans"), "5 天"); assert.equal(days(5, "ja"), "5日間");
  assert.equal(stops(1, "en"), "1 stop"); assert.equal(stops(12, "ja"), "12か所");
  assert.equal(latLng(64.14, -21.93, "zh-Hans"), "北纬 64.1°，西经 21.9°");
  assert.equal(latLng(64.14, -21.93, "en"), "64.1° N, 21.9° W");
  assert.equal(latLng(-33.9, 151.2, "ja"), "南緯 33.9°、東経 151.2°");
  assert.equal(list(["5 天", "", null, "12 站"], "zh-Hans"), "5 天，12 站");
  assert.equal(list(["5 days", "12 stops"], "en"), "5 days, 12 stops");
  assert.equal(names(["冰岛", "挪威"], "ja"), "冰岛、挪威");
  assert.equal(plain("冰岛 · 北欧", "en"), "冰岛, 北欧");
});

test("时长解析认三种语言的写法", () => {
  assert.equal(parseDuration("1 小时 20 分"), 80);
  assert.equal(parseDuration("1 h 20 min"), 80);
  assert.equal(parseDuration("1時間20分"), 80);
  assert.equal(parseDuration("45 min"), 45);
  assert.equal(parseDuration("2時間"), 120);
});

test("领域名字：景点类型、分组、色调、国家、主题、交通方式都有三种语言", () => {
  for (const l of LOCALES) {
    for (const k of KINDS) assert.ok(l === "zh-Hans" ? kindName(k.id, l) === k.name : KIND_NAMES[l][k.id], `${l} ${k.id} 没有名字`);
    for (const g of Object.keys(GROUP_NAME) as (keyof typeof GROUP_NAME)[]) assert.ok(groupName(g, l), `${l} ${g}`);
    for (const p of Object.keys(STYLES) as (keyof typeof STYLES)[]) assert.ok(styleName(p, l), `${l} ${p}`);
    for (const c of Object.keys(COUNTRY_ZH)) assert.ok(countryName(c, l), `${l} ${c}`);
    for (const th of THEMES) assert.ok(themeName(th, l) && (l === "zh-Hans" ? themeName(th, l) === th : themeName(th, l) !== th), `${l} ${th}`);
  }
  assert.equal(kindName("waterfall", "en"), "Waterfall"); assert.equal(kindName("waterfall", "ja"), "滝"); assert.equal(kindName("waterfall", "zh-Hans"), "瀑布");
  assert.equal(kindName("没有这种", "en"), kindName("sight", "en"));
  assert.equal(countryName("Iceland", "zh-Hans"), "冰岛"); assert.equal(countryName("Iceland", "ja"), "アイスランド"); assert.equal(countryName("United States of America", "en"), "United States");
  assert.equal(themeName("自定义主题", "en"), "自定义主题");                   // 不认识的主题（用户数据）原样显示
  assert.equal(modeName("flight", "en"), "Flight"); assert.equal(modeName("walk", "ja"), "徒歩");
});

test("自动日记：三种语言各自成句，同一天同一 seed 结果稳定", () => {
  const day = { index: 1, date: "2026-10-03", title: "D1", city: "kyoto", lodging: "京都站", entries: [
    { id: "a", type: "place", name: "伏见稻荷", category: "sight", visited: true },
    { id: "b", type: "transport", mode: "rail", label: "JR 奈良线", durationMinutes: 20 },
    { id: "c", type: "place", name: "清水寺", category: "sight", notes: "早点去 · 人少" },
  ] } as const;
  const trip = { seed: 7 };
  for (const l of LOCALES as readonly Locale[]) {
    const s = generateDiary(trip, day as never, l);
    assert.equal(s, generateDiary(trip, day as never, l));
    assert.ok(s.includes("伏见稻荷") && s.includes("清水寺") && s.includes("京都站"), `${l}: ${s}`);
    assert.ok(!s.includes(" · ") && !/\{\w+\}/.test(s), `${l}: ${s}`);
  }
  assert.ok(/[.]$/.test(generateDiary(trip, day as never, "en")) && /。$/.test(generateDiary(trip, day as never, "ja")));
  assert.ok(generateDiary(trip, day as never, "en").includes("20 min"));
});

test("字体：每种语言一套字体栈，日文先用冬青黑体，英文先用系统字体", () => {
  for (const l of LOCALES) assert.ok(fontFamily(l).includes("App Sans"), l);
  assert.ok(FONT_STACK.ja.startsWith(`"Hiragino Sans"`));
  assert.ok(FONT_STACK.en.startsWith("-apple-system"));
  assert.ok(FONT_STACK["zh-Hans"].startsWith(`"PingFang SC"`));
  assert.equal(cssVars(false, "ja")["--font"], FONT_STACK.ja);
});

test("字体：手机上用系统字体，和系统 App 一致（苹果 SF + 苹方，鸿蒙 HarmonyOS Sans），不下载随包字体", () => {
  assert.equal(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15"), "apple");
  assert.equal(detectPlatform("Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 ArkWeb/4.1.6.1 Mobile"), "harmony");
  assert.equal(detectPlatform("Mozilla/5.0 (Linux; Android 12; HUAWEI P50) AppleWebKit/537.36"), "harmony");
  assert.equal(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "other");
  for (const l of LOCALES) {
    assert.ok(fontFamily(l, "apple").startsWith("-apple-system"), l);
    assert.ok(fontFamily(l, "harmony").startsWith(`"HarmonyOS Sans`), l);
    assert.ok(!fontFamily(l, "apple").includes("App Sans") && !fontFamily(l, "harmony").includes("App Sans"), l);
  }
  assert.ok(fontFamily("zh-Hans", "apple").includes(`"PingFang SC"`));
  assert.equal(cssVars(false, "zh-Hans", "harmony")["--font"], fontFamily("zh-Hans", "harmony"));
});
