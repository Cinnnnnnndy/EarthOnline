/** 行李箱（第八轮末，判断 D75 / D78）：一趟旅程走完，总结成一只打开的行李箱。
 *  仓库主人定的：箱子里放的是立体的东西——每天最有代表性的名胜小模型（世界层的 landmark-kit）、目的地的特色物件、这趟穿搭的小人、
 *  一本厚厚的日记；不放票、登机牌、明信片这类「对应的」平面物。
 *  这里只做纯的两件事：从行程数据里挑出箱子里的内容（caseContents），再给每样东西一个箱内的位置（layout）。
 *  画出来是 shared/world/suitcase-scene.ts（three.js）的事。 */
import type { Trip, PlaceEntry, SuitcaseStyle, CaseCard } from "../spec/types.ts";
import { tierOf } from "../world/landmark-famous.ts";
import { classifyPlace } from "../world/landmark-kinds.ts";
import { souvenirKey, souvenirItems } from "../geo/souvenirs.ts";
import { EXTRA_KINDS, type ExtraKind, type PackedExtra } from "../planner/protocol.ts";

export interface CaseLandmark { name: string; day: number; famous: boolean; kind: string; ref: { name: string; category?: string; kind?: string; lat?: number; lng?: number } }
/** 目的地的一段 → 国家（表里的键）与这个国家的哪一样（id）；同一个国家写了两段就依次拿第二样、第三样，拿完了 item 为 null（一袋零食） */
export interface CaseSouvenir { place: string; key: string | null; item: string | null }
export interface CaseContents { landmarks: CaseLandmark[]; souvenirs: CaseSouvenir[]; cards: CaseCard[]; gear: ExtraKind[]; hidden: Set<string>; diaryEntries: number; visited: number }
/** 前排的一样「AI 加的」或自己挑的随身物件：mine 是自己从清单里挑的（D84），没有理由那一句 */
export interface CaseExtra extends PackedExtra { mine?: boolean }

export const MAX_LANDMARKS = 6, MAX_SOUVENIRS = 4, MAX_FRONT = 3;
/** 藏东西用的 id（D82）：名胜按名字、特色物件按物件 id（没有就按地名）、随身物件按种类、照片卡按 id */
export const hiddenId = { landmark: (name: string) => `lm:${name}`, souvenir: (item: string | null, place: string) => `sv:${item ?? place}`, extra: (kind: string) => `ex:${kind}`, card: (id: string) => `card:${id}` };

export const splitDestination = (destination: string): string[] => destination.split(/ · |、|，|,|\+|＋/).map((s) => s.trim()).filter(Boolean);

const SKIP = new Set(["hotel", "airport", "port", "station"]);
const rank = (p: PlaceEntry): { score: number; famous: boolean; kind: string } => {
  const t = tierOf({ name: p.name, category: p.category, kind: p.kind, lat: p.geo?.lat, lng: p.geo?.lng }, classifyPlace);
  const famous = t.tier === "famous";
  const score = (famous ? 100 : t.tier === "kind" ? 10 : 0) + (p.category === "sight" ? 5 : 0) + (p.visited ? 1 : 0);
  return { score, famous, kind: t.kind };
};

/** 箱子里的内容：每天一座名胜（名胜 > 认得出类型的 > 兜底；景点类别优先），去重，最多 6 座（超了先留名胜，再按天）；
 *  目的地的每一段一样特色物件，再加从库里挑的（一共最多 4）；自己放的照片卡（最多 3）；日记写了几篇；打卡几处。
 *  藏起来的（trip.suitcase.hidden）直接拿掉，不用别的补位——拿掉就是拿掉 */
export function caseContents(trip: Trip): CaseContents {
  const edits = trip.suitcase; const hidden = new Set(edits?.hidden ?? []);
  const seen = new Set<string>(); const picks: CaseLandmark[] = [];
  for (const d of trip.days) {
    const places = d.entries.filter((e): e is PlaceEntry => e.type === "place" && !SKIP.has(e.category));
    // 类别没写对的机场 / 车站 / 住处（名字里认得出来）也不要
    const best = places.map((p) => ({ p, r: rank(p) })).filter((x) => !seen.has(x.p.name) && !SKIP.has(x.r.kind)).sort((a, b) => b.r.score - a.r.score)[0];
    if (!best) continue; seen.add(best.p.name);
    picks.push({ name: best.p.name, day: d.index, famous: best.r.famous, kind: best.r.kind, ref: { name: best.p.name, category: best.p.category, kind: best.p.kind, lat: best.p.geo?.lat, lng: best.p.geo?.lng } });
  }
  const kept = picks.filter((l) => !hidden.has(hiddenId.landmark(l.name)));
  const landmarks = kept.length <= MAX_LANDMARKS ? kept
    : [...kept].sort((a, b) => Number(b.famous) - Number(a.famous) || a.day - b.day).slice(0, MAX_LANDMARKS).sort((a, b) => a.day - b.day);
  const used = new Map<string, number>();
  const fromDestination: CaseSouvenir[] = splitDestination(trip.destination).slice(0, 3).map((place) => {
    const key = souvenirKey(place); if (!key) return { place, key, item: null };
    const i = used.get(key) ?? 0; used.set(key, i + 1); return { place, key, item: souvenirItems(key)[i]?.id ?? null };
  });
  const fromLibrary: CaseSouvenir[] = (edits?.picks ?? []).map((id) => ({ place: id, key: null, item: id }));
  const souvenirs = [...fromDestination, ...fromLibrary].filter((s) => !hidden.has(hiddenId.souvenir(s.item, s.place))).slice(0, MAX_SOUVENIRS);
  const cards = (edits?.cards ?? []).filter((c) => !hidden.has(hiddenId.card(c.id))).slice(0, MAX_FRONT);
  // 自己从清单里挑的随身物件（D84）：只认有模型的种类，去重；挑了就是要，不受 hidden 影响（拿出来是从 gear 里删）
  const gear = [...new Set((edits?.gear ?? []).filter((k): k is ExtraKind => (EXTRA_KINDS as readonly string[]).includes(k)))];
  const diaryEntries = trip.days.filter((d) => !!d.diary).length || trip.days.length;
  const visited = trip.days.reduce((n, d) => n + d.entries.filter((e) => e.type === "place" && e.visited).length, 0);
  return { landmarks, souvenirs, cards, gear, hidden, diaryEntries, visited };
}

/** 前排怎么排（场景与清单共用）：照片卡在前，自己挑的随身物件其次，AI 加的（没被藏起来、没和自己挑的重复的）补在后面，一共最多 MAX_FRONT */
export function frontRow(c: CaseContents, extras: PackedExtra[]): (CaseCard | CaseExtra)[] {
  const mine: CaseExtra[] = c.gear.map((kind) => ({ kind, reason: "", mine: true }));
  const ai = extras.filter((e) => !c.hidden.has(hiddenId.extra(e.kind)) && !c.gear.includes(e.kind));
  return [...c.cards, ...mine, ...ai].slice(0, MAX_FRONT);
}
export const isCaseExtra = (x: CaseCard | CaseExtra): x is CaseExtra => "kind" in x && !("w" in x);

/** 箱子的尺寸（场景单位；小人站着约 1.8 高）：每半内腔 W × D，边沿高 RIM，两半之间的合页缝 GAP。下半（靠近镜头）放名胜，上半放小人、特色物件与日记 */
export const CASE = { W: 7.0, D: 4.6, RIM: 0.9, GAP: 0.9, WALL: 0.28 } as const;
export interface Slot { x: number; z: number; w: number; d: number }
export interface CaseLayout { landmarks: Slot[]; hero: Slot; souvenirs: Slot[]; front: Slot[]; diary: Slot }
export const MAX_EXTRAS = MAX_FRONT;

/** 位置都在箱子坐标里：原点在合页中心，+z 朝镜头（下半），−z 是上半；y 另算。
 *  上半：左边站小人；右边后排是特色物件（含从库里挑的），前排是自己放的照片卡与「AI 加的」那几样（一共最多 3），右前角一本日记 */
export function layout(nLandmarks: number, nSouvenirs: number, nFront = 0): CaseLayout {
  const baseZ = CASE.GAP / 2 + CASE.D / 2, lidZ = -baseZ;
  const n = Math.max(0, Math.min(MAX_LANDMARKS, nLandmarks));
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.max(1, Math.ceil(n / cols));
  const cw = CASE.W / cols, cd = CASE.D / rows;
  const landmarks: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols); const inRow = Math.min(cols, n - r * cols); const off = ((cols - inRow) * cw) / 2;   // 最后一行没排满就居中
    landmarks.push({ x: -CASE.W / 2 + off + (c + 0.5) * cw, z: baseZ - CASE.D / 2 + (r + 0.5) * cd, w: cw, d: cd });
  }
  const hero: Slot = { x: -CASE.W / 2 + 1.2, z: lidZ + 0.1, w: 2.4, d: CASE.D - 0.2 };
  const right0 = -CASE.W / 2 + 2.4;                                              // 小人右边开始
  const m = Math.max(0, Math.min(MAX_SOUVENIRS, nSouvenirs)); const sw = (CASE.W / 2 - right0) / Math.max(1, m);
  const souvenirs: Slot[] = Array.from({ length: m }, (_, i) => ({ x: right0 + (i + 0.5) * sw, z: lidZ - 1.0, w: sw, d: 2.0 }));
  const diaryW = 1.6; const diary: Slot = { x: CASE.W / 2 - diaryW / 2, z: lidZ + 1.2, w: diaryW, d: 1.5 };
  const k = Math.max(0, Math.min(MAX_FRONT, nFront)); const ew = (CASE.W / 2 - diaryW - right0) / Math.max(1, k);
  const front: Slot[] = Array.from({ length: k }, (_, i) => ({ x: right0 + (i + 0.5) * ew, z: lidZ + 1.2, w: ew, d: 1.5 }));
  return { landmarks, hero, souvenirs, front, diary };
}

/** 箱子的四种样式（D81）：颜色与做法都是纯数据，画法在 shared/world/suitcase-scene.ts。
 *  沙色硬壳是默认（和纸、墨、晨的界面最搭）；墨色硬壳给喜欢深色的人；帆布箱有皮角和皮带；复古木箱是木板条、铜边、铜钉、暗红里衬。
 *  晨色的行李牌四款都有——它是唯一的高亮，也是这是「我的」箱子的记号。 */
export type RGB3 = [number, number, number];
export interface SuitcaseStyleDef {
  shell: RGB3; trim: RGB3; lining: RGB3;
  /** 外壳的纹路：竖肋（硬壳）/ 横板条（木箱）/ 没有（帆布） */
  ribs: "vertical" | "slats" | "none";
  /** 清漆的硬壳，还是哑光的布与木 */
  finish: "gloss" | "matte";
  corners: "guard" | "brass" | "leather";
  wheels: boolean;
  /** 帆布箱前后的皮带颜色 */
  straps?: RGB3;
  /** 木箱沿口一圈铜钉 */
  rivets?: boolean;
}
export const SUITCASE_STYLE: Record<SuitcaseStyle, SuitcaseStyleDef> = {
  sand: { shell: [218, 206, 184], trim: [40, 44, 56], lining: [238, 240, 245], ribs: "vertical", finish: "gloss", corners: "guard", wheels: true },
  ink: { shell: [46, 50, 64], trim: [172, 176, 186], lining: [236, 232, 222], ribs: "vertical", finish: "gloss", corners: "guard", wheels: true },
  canvas: { shell: [138, 150, 118], trim: [112, 80, 62], lining: [226, 218, 198], ribs: "none", finish: "matte", corners: "leather", wheels: true, straps: [112, 80, 62] },
  trunk: { shell: [150, 104, 66], trim: [200, 160, 90], lining: [168, 80, 76], ribs: "slats", finish: "matte", corners: "brass", wheels: false, rivets: true },
};
export const DEFAULT_SUITCASE: SuitcaseStyle = "sand";
