/** 清单（第八轮末，D84）：仓库主人发来「jev」那条视频里的清单——一个搜索框（「国庆去韩国玩7天」）、几枚场景标签（冰岛追极光 / 三亚躺一躺 / 京都慢慢逛）、
 *  下面一格一格 emoji 样的东西：「尝试使用 jev 在我们的这些检索组织中」。
 *  我们的清单就按这个来：打一句话或一个词，库里的东西按组排出来，点一下放进箱子或拿出来。这里是纯函数：
 *  - caseGroups：默认的组织——这趟的名胜、当地特色、随身物件（穿戴 / 电子 / 路上 / 闲时）、各地特色，每样标着在不在箱子里；
 *  - searchCase：检索——从一句话里认出国家（countriesIn）、场景（gearHints：雨 → 折叠伞，极光 → 围巾手套保温杯……）、按名字找（中英日都认）；
 *  - toggleEntry：放进去 / 拿出来的规则（后排最多 4 样特色物件、前排最多 3 样）；
 *  - CASE_SCENES：场景标签，点一下等于把那句话填进搜索框。
 *  画成一格一格的类 emoji 图标是 shared/world/item-icons.ts 的事；界面在 web/src/pages/epilogue.ts，iOS 通过嵌入页的 case-search / case-toggle 消息用同一套。 */
import { t, LOCALES, type Locale } from "../i18n/index.ts";
import type { MsgKey } from "../i18n/index.ts";
import { ALL_SOUVENIRS, souvenirKey, souvenirName, souvenirItems, countriesIn, countryLabel, type Souvenir } from "../geo/souvenirs.ts";
import { EXTRA_KINDS, type ExtraKind, type PackedExtra } from "../planner/protocol.ts";
import type { Trip, CaseEdits } from "../spec/types.ts";
import { caseContents, frontRow, isCaseExtra, hiddenId, splitDestination, MAX_SOUVENIRS, MAX_FRONT, type CaseLandmark } from "./suitcase.ts";

export type GearGroup = "wear" | "gadgets" | "road" | "leisure";
export const GEAR_ORDER: readonly GearGroup[] = ["wear", "gadgets", "road", "leisure"];
/** 随身物件的四组（20 样都在） */
export const GEAR_GROUPS: Record<GearGroup, ExtraKind[]> = {
  wear: ["hat", "scarf", "mittens", "boots", "sunglasses"],
  gadgets: ["camera", "powerbank", "headphones", "flashlight"],
  road: ["thermos", "waterBottle", "umbrella", "roadmap", "binoculars", "neckPillow", "sunscreen"],
  leisure: ["book", "sketchbook", "plush", "swimRing"],
};
export const gearGroupOf = (k: ExtraKind): GearGroup => GEAR_ORDER.find((g) => GEAR_GROUPS[g].includes(k)) ?? "road";

/** 场景标签：点一下把这句话填进搜索框（文字在 case.scene.*，关键词表三种语言都认） */
export const CASE_SCENES = ["aurora", "beach", "stroll", "trail"] as const;
export type CaseScene = (typeof CASE_SCENES)[number];

/** 清单里的一格：type + id 定一样东西（特色物件的 id / 随身物件的种类 / 名胜的名字），boxId 是藏东西用的 id */
export interface CaseEntry {
  type: "souvenir" | "extra" | "landmark";
  id: string;
  boxId: string;
  label: string;
  /** 副标题：国家 / 哪一组 / 第几天 */
  sub: string;
  inBox: boolean;
  /** 随身物件：是自己挑的（不是 AI 加的） */
  mine?: boolean;
  /** 特色物件：国家（表里的键） */
  country?: string;
  /** 名胜：画图标用的站点与种子 */
  ref?: CaseLandmark["ref"];
  seed?: number;
}
export interface CaseGroup { id: string; label: string; entries: CaseEntry[] }
export interface CaseContext { trip: Trip; /** 「AI 加的」候选（服务或规则给的，还没按 hidden 过滤） */ extras: PackedExtra[]; locale: Locale }

const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)];
const extraNames = (k: ExtraKind): string[] => LOCALES.map((l) => t(`case.extra.${k}` as MsgKey, undefined, l));
const extraName = (k: ExtraKind, locale: Locale) => t(`case.extra.${k}` as MsgKey, undefined, locale);

// ---------------------------------------------------------------- 关键词 → 随身物件
/** 一句话里的场景词（中英日）→ 该带什么；一条里先写的先挑 */
const WORDS: [RegExp, ExtraKind[]][] = [
  [/雨|伞|傘|rain|wet|drizzle|つゆ|梅雨|樱花|桜|sakura|cherry blossom/i, ["umbrella"]],
  [/冷|寒|雪|冬|冰|极光|極光|オーロラ|aurora|northern lights|snow|cold|winter|ski|滑雪|スキー|圣诞|聖誕|christmas|クリスマス|跨年|年末|new year/i, ["scarf", "mittens", "thermos"]],
  [/海|沙滩|沙灘|岛|島|潜水|浮潜|泳|beach|sea|island|snorkel|dive|swim|ビーチ|海辺|海水浴/i, ["swimRing", "sunscreen", "hat", "sunglasses"]],
  [/晒|太阳|夏|热|暑|sun|summer|hot|tropic|日差し|真夏/i, ["sunglasses", "sunscreen", "hat"]],
  [/山|徒步|登山|步道|hik(e|ing)|trek|trail|mountain|climb|ハイキング|トレッキング|縦走/i, ["boots", "waterBottle"]],
  [/飞|航班|长途|flight|fly|plane|red-eye|長距離|飛行機|フライト|長時間/i, ["neckPillow", "headphones"]],
  [/火车|铁路|高铁|新干线|train|rail|新幹線|電車|列車/i, ["book", "headphones"]],
  [/自驾|开车|公路|drive|driving|road ?trip|ドライブ|レンタカー/i, ["roadmap", "thermos"]],
  [/拍|相机|照片|photo|camera|打卡|写真|カメラ|撮/i, ["camera"]],
  [/夜|洞|露营|night|cave|camp|stargaz|星空|夜景|キャンプ|洞窟/i, ["flashlight"]],
  [/博物馆|美术馆|寺|庙|神社|教堂|古城|老城|逛|散步|慢慢|museum|gallery|temple|shrine|church|old town|stroll|wander|slow|散歩|ぶらぶら|ゆっくり|美術館|博物館|お寺/i, ["sketchbook", "camera"]],
  [/躺|度假|休息|放松|发呆|relax|lazy|chill|rest|resort|のんびり|リゾート|休む|ゆったり/i, ["book", "sunglasses"]],
  [/观鸟|看鸟|观鲸|动物|野生|safari|whale|bird|wildlife|zoo|penguin|企鹅|ペンギン|クジラ|動物/i, ["binoculars"]],
];
/** 一句话里说了几天：「7天」「三天」「5 days」「3泊」「一周」 */
export function daysIn(text: string): number | null {
  const m = /(\d+|[一二两三四五六七八九十]+)\s*(天|日|days?|泊|週|周|weeks?)/i.exec(text); if (!m) return null;
  const num = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : cjkNumber(m[1]); if (!num) return null;
  return /週|周|week/i.test(m[2]) ? num * 7 : num;
}
function cjkNumber(s: string): number {
  const d: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (s === "十") return 10; const i = s.indexOf("十");
  if (i < 0) return d[s] ?? 0; const tens = i === 0 ? 1 : d[s[0]] ?? 0; return tens * 10 + (d[s[i + 1]] ?? 0);
}
/** 从一句话里挑随身物件（去重，按先后）：场景词 + 天数（5 天以上充电宝，7 天以上再加一本书） */
export function gearHints(text: string): ExtraKind[] {
  const out: ExtraKind[] = [];
  for (const [re, kinds] of WORDS) if (re.test(text)) out.push(...kinds);
  const days = daysIn(text); if (days !== null && days >= 5) out.push("powerbank"); if (days !== null && days >= 7) out.push("book");
  return uniq(out);
}

// ---------------------------------------------------------------- 按名字找
/** 拆词：空格与标点分开；拉丁字母的词至少 3 个字母，中日文的一个字也算 */
const tokensOf = (q: string): string[] => q.toLowerCase().split(/[\s,，、。．.;；!！?？:：/／()（）「」『』"'…·]+/).filter((tk) => tk && (!/^[a-z0-9'-]+$/.test(tk) || tk.length >= 3));
const nameHit = (tokens: string[], name: string | null | undefined): boolean => { if (!name) return false; const n = name.toLowerCase(); return tokens.some((tk) => n.includes(tk) || (n.length >= 2 && tk.includes(n))); };

// ---------------------------------------------------------------- 默认的组织
function svEntry(country: string, it: Souvenir, inBox: Set<string | null>, locale: Locale): CaseEntry {
  return { type: "souvenir", id: it.id, boxId: hiddenId.souvenir(it.id, country), label: souvenirName(it.id, locale) ?? it.zh, sub: countryLabel(country, locale), inBox: inBox.has(it.id), country };
}
export function caseGroups(ctx: CaseContext): CaseGroup[] {
  const { trip, locale } = ctx; const c = caseContents(trip);
  // 藏起来的也要列出来（点一下放回去）：按「没藏任何东西」再算一遍
  const all = caseContents({ ...trip, suitcase: { ...(trip.suitcase ?? {}), hidden: undefined } });
  const shown = new Set(frontRow(c, ctx.extras).filter(isCaseExtra).map((e) => e.kind));
  const inBoxSv = new Set(c.souvenirs.map((s) => s.item));
  const groups: CaseGroup[] = [];
  const lm = all.landmarks.map((l, i): CaseEntry => ({ type: "landmark", id: l.name, boxId: hiddenId.landmark(l.name), label: l.name, sub: t("new.dayN", { n: l.day }, locale), inBox: !c.hidden.has(hiddenId.landmark(l.name)), ref: l.ref, seed: trip.seed + i }));
  if (lm.length) groups.push({ id: "landmarks", label: t("case.group.landmarks", undefined, locale), entries: lm });
  const countries = uniq(splitDestination(trip.destination).map(souvenirKey).filter((k): k is string => !!k));
  const local = countries.flatMap((k) => souvenirItems(k).map((it) => svEntry(k, it, inBoxSv, locale)));
  // 从库里挑的（不是目的地那几国的）也算当地特色那一组后面
  const picked = (trip.suitcase?.picks ?? []).filter((id) => !local.some((e) => e.id === id)).map((id) => ALL_SOUVENIRS.find((x) => x.item.id === id)).filter((x): x is (typeof ALL_SOUVENIRS)[number] => !!x).map((x) => svEntry(x.country, x.item, inBoxSv, locale));
  if (local.length + picked.length) groups.push({ id: "local", label: t("case.group.local", undefined, locale), entries: [...local, ...picked] });
  for (const g of GEAR_ORDER) groups.push({ id: g, label: t(`case.group.${g}` as MsgKey, undefined, locale), entries: GEAR_GROUPS[g].map((k) => exEntry(k, shown, c.gear, locale)) });
  const rest = ALL_SOUVENIRS.filter((x) => !countries.includes(x.country) && !picked.some((p) => p.id === x.item.id)).map((x) => svEntry(x.country, x.item, inBoxSv, locale));
  groups.push({ id: "world", label: t("case.group.world", undefined, locale), entries: rest });
  return groups;
}
function exEntry(k: ExtraKind, shown: Set<ExtraKind>, gear: ExtraKind[], locale: Locale): CaseEntry {
  return { type: "extra", id: k, boxId: hiddenId.extra(k), label: extraName(k, locale), sub: t(`case.group.${gearGroupOf(k)}` as MsgKey, undefined, locale), inBox: shown.has(k), mine: gear.includes(k) };
}

// ---------------------------------------------------------------- 检索
/** 打一句话或一个词：空的给默认分组；否则按「这句里的国家 → 随身物件（场景词 + 名字）→ 名字对上的各地特色 → 名字对上的名胜」分组；什么都没对上返回空数组 */
export function searchCase(query: string, ctx: CaseContext): CaseGroup[] {
  const q = query.trim(); if (!q) return caseGroups(ctx);
  const { locale } = ctx; const base = caseGroups(ctx);
  const by = new Map<string, CaseEntry>(); for (const g of base) for (const e of g.entries) by.set(`${e.type}:${e.id}`, e);
  const find = (type: CaseEntry["type"], id: string) => by.get(`${type}:${id}`);
  const tokens = tokensOf(q); const groups: CaseGroup[] = []; const used = new Set<string>();
  for (const k of countriesIn(q)) {
    const entries = souvenirItems(k).map((it) => find("souvenir", it.id)).filter((e): e is CaseEntry => !!e);
    if (!entries.length) continue; entries.forEach((e) => used.add(e.id));
    groups.push({ id: `country:${k}`, label: t("case.group.country", { country: countryLabel(k, locale) }, locale), entries });
  }
  const kinds = uniq([...gearHints(q), ...EXTRA_KINDS.filter((k) => extraNames(k).some((n) => nameHit(tokens, n)))]);
  if (kinds.length) groups.push({ id: "gear", label: t("case.group.gear", undefined, locale), entries: kinds.map((k) => find("extra", k)).filter((e): e is CaseEntry => !!e) });
  const sv = ALL_SOUVENIRS.filter((x) => !used.has(x.item.id) && (nameHit(tokens, x.item.zh) || nameHit(tokens, x.item.en) || nameHit(tokens, x.item.ja))).map((x) => find("souvenir", x.item.id)).filter((e): e is CaseEntry => !!e);
  if (sv.length) groups.push({ id: "world", label: t("case.group.world", undefined, locale), entries: sv });
  const lm = (base.find((g) => g.id === "landmarks")?.entries ?? []).filter((e) => nameHit(tokens, e.label));
  if (lm.length) groups.unshift({ id: "landmarks", label: t("case.group.landmarks", undefined, locale), entries: lm });
  return groups;
}

// ---------------------------------------------------------------- 放进去 / 拿出来
export type ToggleResult = "added" | "removed" | "frontFull" | "backFull";
/** 点一格：在箱子里的拿出来（自己挑的从 picks / gear 里删，目的地给的与 AI 加的、名胜记进 hidden）；不在的放进去（后排最多 4 样特色物件、前排最多 3 样——满了不放，让界面提示）。
 *  返回新的 CaseEdits（空数组不记）与结果 */
export function toggleEntry(entry: CaseEntry, ctx: CaseContext): { edits: CaseEdits; result: ToggleResult } {
  const trip = ctx.trip; const e0 = trip.suitcase ?? {}; const c = caseContents(trip);
  const hidden = new Set(e0.hidden ?? []); const picks = [...(e0.picks ?? [])]; const gear = [...(e0.gear ?? [])];
  let result: ToggleResult;
  if (entry.type === "landmark") {
    if (entry.inBox) { hidden.add(entry.boxId); result = "removed"; } else { hidden.delete(entry.boxId); result = "added"; }
  } else if (entry.type === "souvenir") {
    if (entry.inBox) { const i = picks.indexOf(entry.id); if (i >= 0) picks.splice(i, 1); else hidden.add(entry.boxId); result = "removed"; }
    else if (hidden.has(entry.boxId)) { hidden.delete(entry.boxId); result = "added"; }
    else if (c.souvenirs.length >= MAX_SOUVENIRS) result = "backFull";
    else { picks.push(entry.id); result = "added"; }
  } else {
    const k = entry.id;
    if (entry.inBox) { const i = gear.indexOf(k); if (i >= 0) gear.splice(i, 1); else hidden.add(entry.boxId); result = "removed"; }
    else if (c.cards.length + c.gear.length >= MAX_FRONT) result = "frontFull";
    else { hidden.delete(entry.boxId); if (!gear.includes(k)) gear.push(k); result = "added"; }   // 放进去的都算自己挑的（AI 加过同一样也不重复）
  }
  const edits: CaseEdits = { ...e0 };
  const put = <K extends "hidden" | "picks" | "gear">(key: K, v: string[]) => { if (v.length) edits[key] = v; else delete edits[key]; };
  put("hidden", [...hidden]); put("picks", picks); put("gear", gear);
  return { edits, result };
}
/** 清单里在箱子里的有几样（给标题用） */
export const inBoxCount = (groups: CaseGroup[]): number => new Set(groups.flatMap((g) => g.entries.filter((e) => e.inBox).map((e) => `${e.type}:${e.id}`))).size;
