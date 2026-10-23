/** 日记自动生成：按条目顺序串成一段话，措辞由 seed 决定；用户改过（day.diary）就不再覆盖。
 *  句式在消息表里（diary.*，中 / 英 / 日各三套），按界面语言写；三种语言挑句式用同一串随机数，同一天换语言也是「同一句话」。 */
import type { Day, Trip } from "../spec/types.ts";
import { mulberry32, hashString } from "./prng.ts";
import { modeName } from "./transport.ts";
import { t, getLocale, duration, type Locale, type MsgKey } from "../i18n/index.ts";

const OPEN: MsgKey[] = ["diary.open0", "diary.open1", "diary.open2"];
const MOVE: MsgKey[] = ["diary.move0", "diary.move1", "diary.move2"];
const CLOSE: MsgKey[] = ["diary.close0", "diary.close1", "diary.close2"];
const VISITED: (MsgKey | null)[] = ["diary.visited0", "diary.visited1", null];
const JOIN: Record<Locale, string> = { "zh-Hans": "", en: " ", ja: "" };

export function generateDiary(trip: Pick<Trip, "seed">, day: Day, locale: Locale = getLocale()): string {
  const rng = mulberry32(trip.seed ^ hashString(day.date));
  const tr = (k: MsgKey, vars?: Record<string, string>) => t(k, vars, locale);
  const end = tr("diary.end"); const cap = (s: string) => (locale === "en" ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const parts: string[] = [];
  let pendingMode: { name: string; dur: string } | null = null; let first = true;
  for (const e of day.entries) {
    if (e.type === "transport") { pendingMode = { name: e.label || modeName(e.mode, locale), dur: duration(e.durationMinutes, locale) }; continue; }
    if (e.type === "place") {
      const v = e.visited ? rng.pick(VISITED) : null; const tag = v ? tr(v) : "";
      if (first) { parts.push(tr(rng.pick(OPEN), { place: e.name, tag })); first = false; }
      else if (pendingMode) parts.push(cap(tr(rng.pick(MOVE), { mode: pendingMode.name, dur: pendingMode.dur || tr("diary.soon"), place: e.name, tag })));
      else parts.push(tr("diary.then", { place: e.name, tag }));
      if (e.notes) parts.push(e.notes.trim().replace(/[。.\s]*$/, "") + end);
      pendingMode = null;
    }
  }
  if (day.lodging) parts.push(tr(rng.pick(CLOSE), { place: day.lodging }));
  const dup = new RegExp(`${end.replace(".", "\\.")}{2,}`, "g");
  return parts.join(JOIN[locale]).replace(dup, end).replace(/ · /g, tr("punct.list"));   // 备注里的「A · B」写进日记时换成逗号
}
