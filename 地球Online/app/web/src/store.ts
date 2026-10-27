/** 本地存储（P0：单机；P2 起走服务端同步，接口不变） */
import type { Trip, Day, Entry, PlaceEntry, TransportEntry, LodgingEntry, Avatar, Settings, Todo } from "../../shared/spec/types.ts";
import { SCHEMA_VERSION } from "../../shared/spec/types.ts";
import { migrateTrip } from "../../shared/spec/migrate.ts";
import { validateTrip } from "../../shared/spec/validate.ts";
import { DEFAULT_AVATAR } from "../../shared/world/hero.ts";
import { AVATAR_PRESETS, applyPreset } from "../../shared/world/avatar-presets.ts";   // D103：第一次打开默认是「小王」
import { hashString } from "../../shared/algo/prng.ts";
import sample from "../../shared/golden/trips/kansai-7d.v0.1.json";
import { importRoutePage } from "../../shared/import/route-page.ts";
import { makeCountryLookup } from "../../shared/geo/countries.ts";
import { loadCountries } from "../../shared/geo/topo.ts";
import type { Place } from "../../shared/geo/gazetteer.ts";
import type { HomePlace, ManualFlag } from "../../shared/algo/footprints.ts";
import { setLocale, t } from "../../shared/i18n/index.ts";
import { pickLocale } from "./locale.ts";
import { usageMonth, type Entitlement } from "../../shared/billing/plans.ts";

export type NewEntry = Omit<PlaceEntry, "id"> | Omit<TransportEntry, "id"> | Omit<LodgingEntry, "id">;
export type { Settings };
interface State { trips: Trip[]; avatar: Avatar; settings: Settings; flags: Record<string, boolean>; home: HomePlace | null; pins: ManualFlag[]; planted: string[];
  /** 套餐（网页参考应用不收款，默认免费版；正式 App 由 StoreKit / IAP 验票后写入）与本月 AI 规划用量 */
  entitlement: Entitlement; usage: { month: string; aiPlans: number } }
const KEY = "earth-online:v2";
const PLATE_CITIES: Record<string, string> = { "大阪": "osaka", "京都": "kyoto", "奈良": "nara", "神户": "kobe" };   // i18n-ok：按地名表里的目的地名匹配（数据）
type Listener = () => void;

class Store {
  state: State; private listeners: Listener[] = [];
  constructor() { this.state = this.load(); }
  private load(): State {
    let s: Partial<State> | null = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { s = null; }
    const trips = (s?.trips ?? []).map((t) => { try { return migrateTrip(t); } catch { return null; } }).filter((t): t is Trip => !!t && validateTrip(t).length === 0);
    if (!s) trips.push(migrateTrip(sample));
    const settings: Settings = { palette: "sea", post: "high", theme: "auto", lang: "auto", ...(s?.settings ?? {}) };
    setLocale(pickLocale(settings.lang));                     // 界面语言先定下来：下面小人的默认名字、以后生成的标题都按它写
    return { trips, avatar: s?.avatar ? { ...DEFAULT_AVATAR, name: t("avatar.defaultName"), ...(s.avatar as Partial<Avatar>) } : applyPreset(DEFAULT_AVATAR, AVATAR_PRESETS[0]), settings, flags: { ...(s?.flags ?? {}) },
      home: s?.home ?? null, pins: Array.isArray(s?.pins) ? s!.pins! : [], planted: Array.isArray(s?.planted) ? s!.planted! : [],
      entitlement: s?.entitlement && typeof s.entitlement === "object" ? s.entitlement : { plan: "free" }, usage: s?.usage && typeof s.usage === "object" ? s.usage : { month: "", aiPlans: 0 } };
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* 隐私模式下忽略 */ } this.listeners.forEach((l) => l()); }
  subscribe(l: Listener) { this.listeners.push(l); return () => { this.listeners = this.listeners.filter((x) => x !== l); }; }

  get trips() { return this.state.trips; }
  trip(id: string) { return this.state.trips.find((t) => t.id === id); }
  get avatar() { return this.state.avatar; }
  get settings() { return this.state.settings; }
  setAvatar(a: Partial<Avatar>) { this.state.avatar = { ...this.state.avatar, ...a }; this.save(); }
  setSettings(s: Partial<Settings>) { this.state.settings = { ...this.state.settings, ...s }; this.save(); }

  // ---------------- 套餐与用量（规则在 shared/billing/plans.ts，接法在 web/src/quota.ts）。截图与调试：?plan=pro 按 Pro 看
  get entitlement(): Entitlement { const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("plan") : null; return q === "pro" ? { plan: "pro" } : q === "free" ? { plan: "free" } : this.state.entitlement; }
  setEntitlement(e: Entitlement) { this.state.entitlement = e; this.save(); }
  get aiPlansThisMonth(): number { return this.state.usage.month === usageMonth(new Date().toISOString()) ? this.state.usage.aiPlans : 0; }
  /** 一段对话第一次出草稿时计一次（离线规则不算；见 quota.ts） */
  countAiPlan() { const m = usageMonth(new Date().toISOString()); this.state.usage = { month: m, aiPlans: this.aiPlansThisMonth + 1 }; this.save(); }

  // ---------------- 家与足迹
  get home() { return this.state.home; }
  get pins() { return this.state.pins; }
  get planted() { return this.state.planted; }
  setHome(h: HomePlace | null) { this.state.home = h; this.save(); }
  addPin(p: Omit<ManualFlag, "id">): ManualFlag { const f = { ...p, id: `pin-${Date.now().toString(36)}` }; this.state.pins.push(f); this.save(); return f; }
  removePin(id: string) { this.state.pins = this.state.pins.filter((p) => p.id !== id); this.state.planted = this.state.planted.filter((x) => x !== id); this.save(); }
  markPlanted(ids: string[]) { const set = new Set(this.state.planted); ids.forEach((i) => set.add(i)); this.state.planted = [...set]; this.save(); }

  /** 首次打开：导入仓库主人的「冰岛 + 北欧」行程（数据来自行程 artifact）。
   *  第五轮起只保留方案 2（冰岛 + 北欧），方案 1（冰岛 + 邮轮）按仓库主人的要求删掉；以前存下来的那本也清掉一次。 */
  async ensureSamples(base: string): Promise<boolean> {
    if (!this.state.flags.dropCruise) {
      const before = this.state.trips.length;
      this.state.trips = this.state.trips.filter((t) => !(t.plan && t.plan.index === 1 && /邮轮/.test(t.title)));
      for (const t of this.state.trips) if (t.plan && /冰岛/.test(t.title) && !this.state.trips.some((x) => x !== t && x.plan?.group === t.plan!.group)) delete t.plan;
      this.state.flags.dropCruise = true; this.save(); if (this.state.trips.length !== before && this.state.flags.iceland) return true;
    }
    if (this.state.flags.iceland) return false;
    try {
      const [html, countries] = await Promise.all([fetch(base + "assets/samples/iceland-nordic.html").then((r) => r.text()), loadCountries(base)]);
      const all = importRoutePage(html, { countryOf: makeCountryLookup(countries) }).trips;
      const trips = all.filter((t) => t.plan?.index === 2).map((t) => { const c = { ...t }; delete c.plan; return c; });
      this.state.trips = [...trips, ...this.state.trips.filter((t) => !trips.some((x) => x.id === t.id))]; this.state.flags.iceland = true; this.save(); return true;
    } catch (e) { console.warn("示例导入失败", e); return false; }   // i18n-ok：开发者日志
  }
  async importPage(html: string, base: string): Promise<{ trips: Trip[]; warnings: string[] }> {
    const countries = await loadCountries(base).catch(() => null);
    const r = importRoutePage(html, { countryOf: countries ? makeCountryLookup(countries) : undefined });
    for (const t of r.trips) { const i = this.state.trips.findIndex((x) => x.id === t.id); if (i >= 0) this.state.trips[i] = t; else this.state.trips.unshift(t); }
    this.save(); return r;
  }

  createTrip(input: { title: string; destination: string; city?: string; place?: Place; startDate: string; days: number; theme: string }): Trip {
    const now = new Date().toISOString(); const seed = hashString(`${input.title}|${input.startDate}|${now}`);
    const city = input.city ?? PLATE_CITIES[input.destination] ?? (input.place ? "geo" : "kyoto");
    // 新书的天标题与住处名按当时的界面语言写（之后就是用户的数据，换语言不跟着变）
    const days: Day[] = Array.from({ length: input.days }, (_, i) => ({ index: i + 1, date: addDays(input.startDate, i), title: i === 0 ? t("new.dayArrive", { dest: input.destination }) : i === input.days - 1 ? t("new.dayReturn", { dest: input.destination }) : t("new.dayN", { n: i + 1 }), city,
      entries: city === "geo" && input.place ? [{ id: `d${i + 1}-e0`, type: "place", name: t("new.stayIn", { place: input.place.name }), category: "hotel", geo: { lat: input.place.lat, lng: input.place.lng } } as Entry] : [] }));
    const trip: Trip = { schemaVersion: SCHEMA_VERSION, id: `trip-${seed.toString(36)}-${Date.now().toString(36)}`, title: input.title, destination: input.destination, startDate: input.startDate, endDate: addDays(input.startDate, input.days - 1), theme: input.theme, seed, status: "planning", days, createdAt: now, updatedAt: now };
    this.state.trips.unshift(trip); this.save(); return trip;
  }
  importTrip(raw: unknown): Trip {
    // 校验与迁移的报错是给开发者看的（字段路径），只进控制台；界面上统一说「不是有效的行程数据」
    let tr: Trip; try { tr = migrateTrip(raw); } catch (e) { console.warn(e); throw new Error(t("common.importInvalid")); }
    const errs = validateTrip(tr); if (errs.length) { console.warn(errs); throw new Error(t("common.importInvalid")); } tr.id = `${tr.id}-${Date.now().toString(36)}`; this.state.trips.unshift(tr); this.save(); return tr; }
  updateTrip(id: string, fn: (t: Trip) => void) { const t = this.trip(id); if (!t) return; fn(t); t.updatedAt = new Date().toISOString(); this.save(); }
  deleteTrip(id: string) { this.state.trips = this.state.trips.filter((t) => t.id !== id); this.save(); }
  resetToSample() { this.state.trips = [migrateTrip(sample)]; this.state.flags = {}; this.save(); }

  // ---- 行程编排
  addEntry(tripId: string, dayIndex: number, entry: NewEntry, afterId?: string) {
    this.updateTrip(tripId, (t) => { const d = t.days[dayIndex]; const e = { ...entry, id: newId(d) } as Entry; const at = afterId ? d.entries.findIndex((x) => x.id === afterId) + 1 : d.entries.length; d.entries.splice(at, 0, e); });
  }
  updateEntry(tripId: string, dayIndex: number, entryId: string, patch: Partial<Entry>) {
    this.updateTrip(tripId, (t) => { const d = t.days[dayIndex]; const i = d.entries.findIndex((x) => x.id === entryId); if (i >= 0) d.entries[i] = { ...d.entries[i], ...patch } as Entry; });
  }
  removeEntry(tripId: string, dayIndex: number, entryId: string) { this.updateTrip(tripId, (t) => { const d = t.days[dayIndex]; d.entries = d.entries.filter((x) => x.id !== entryId); }); }
  moveEntry(tripId: string, dayIndex: number, entryId: string, dir: -1 | 1) {
    this.updateTrip(tripId, (t) => { const d = t.days[dayIndex]; const i = d.entries.findIndex((x) => x.id === entryId); const j = i + dir; if (i < 0 || j < 0 || j >= d.entries.length) return; [d.entries[i], d.entries[j]] = [d.entries[j], d.entries[i]]; });
  }
  moveEntryToDay(tripId: string, dayIndex: number, entryId: string, toDay: number) {
    this.updateTrip(tripId, (t) => { const d = t.days[dayIndex], to = t.days[toDay]; if (!to) return; const i = d.entries.findIndex((x) => x.id === entryId); if (i < 0) return; const [e] = d.entries.splice(i, 1); e.id = newId(to); to.entries.push(e); });
  }
  setDayMeta(tripId: string, dayIndex: number, patch: Partial<Pick<Day, "title" | "city" | "lodging" | "diary">>) { this.updateTrip(tripId, (t) => { Object.assign(t.days[dayIndex], patch); }); }

  // ---- 待办（第八轮）：挂在站点上（PlaceEntry.todos）
  private place(t: Trip, dayIndex: number, entryId: string): PlaceEntry | undefined { const e = t.days[dayIndex]?.entries.find((x) => x.id === entryId); return e && e.type === "place" ? e : undefined; }
  addTodo(tripId: string, dayIndex: number, entryId: string, todo: { text: string; due?: string }) {
    this.updateTrip(tripId, (t) => { const p = this.place(t, dayIndex, entryId); if (!p) return; (p.todos ??= []).push({ id: `td-${Date.now().toString(36)}-${p.todos.length}`, ...todo }); });
  }
  setTodo(tripId: string, dayIndex: number, entryId: string, todoId: string, patch: Partial<Pick<Todo, "text" | "due" | "done">>) {
    this.updateTrip(tripId, (t) => { const td = this.place(t, dayIndex, entryId)?.todos?.find((x) => x.id === todoId); if (td) Object.assign(td, patch); });
  }
  removeTodo(tripId: string, dayIndex: number, entryId: string, todoId: string) {
    this.updateTrip(tripId, (t) => { const p = this.place(t, dayIndex, entryId); if (p?.todos) p.todos = p.todos.filter((x) => x.id !== todoId); });
  }
}

function newId(d: Day) { let n = d.entries.length; while (d.entries.some((e) => e.id === `d${d.index}-e${n}`)) n++; return `d${d.index}-e${n}`; }
export function addDays(iso: string, n: number) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const store = new Store();
