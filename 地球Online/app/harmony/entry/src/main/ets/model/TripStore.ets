import { STARTER_SAMPLES } from '../gen/Shared';
import {
  Avatar, CaseEdits, Entry, HomePlace, ManualFlag, PersistedState, SampleInfo, Settings, Todo, Trip,
  cloneTrip, defaultAvatar, defaultSettings
} from './Spec';
import { AppContext, Files } from '../util/Files';
import { Dates } from '../util/Dates';
import { CoreApi } from '../world/CoreApi';

/** 本机存储（iOS TripStore.swift 同一套）：{trips, avatar, settings, home, pins, planted} 存成一个 JSON（filesDir/state.json）。
 *  所有修改都走这里的方法：改完立刻发到 AppStorage（界面跟着变，'eo.trips' 等键），写盘做 0.3 秒去抖。
 *  修改一律「写时复制」：换新数组、新对象，AppStorage 的 @StorageLink 才看得见变化。
 *  第一次启动（还没有 state.json）：世界层就绪后从 rawfile/world/assets/samples/trips 读示例行程，每本过一次 core('migrate')。 */
export class TripStore {
  static readonly shared: TripStore = new TripStore();

  trips: Trip[] = [];
  avatar: Avatar = defaultAvatar();
  settings: Settings = defaultSettings();
  home: HomePlace | undefined = undefined;
  pins: ManualFlag[] = [];
  planted: string[] = [];

  /** 书、家、足迹变了（AppModel 据此去抖推给世界层） */
  onTripsChange: () => void = () => {};
  /** 外观、小人变了 */
  onLookChange: () => void = () => {};

  private path: string = '';
  private needsSeed: boolean = false;
  private saveTimer: number = -1;

  // ------------------------------------------------------------ 载入 / 保存

  load(filesDir: string): void {
    this.path = filesDir + '/state.json';
    if (!Files.exists(this.path)) {
      this.needsSeed = true;
    } else {
      try {
        const st = JSON.parse(Files.readText(this.path)) as PersistedState;
        this.trips = Array.isArray(st.trips) ? st.trips.filter((t: Trip) => t !== null && typeof t.id === 'string' && Array.isArray(t.days)) : [];
        if (st.avatar !== undefined && st.avatar !== null) this.avatar = st.avatar;
        if (st.settings !== undefined && st.settings !== null) this.settings = TripStore.fillSettings(st.settings);
        this.home = st.home !== undefined && st.home !== null ? st.home : undefined;
        this.pins = Array.isArray(st.pins) ? st.pins : [];
        this.planted = Array.isArray(st.planted) ? st.planted : [];
      } catch (e) {
        // 读坏了：不覆盖原文件（留给人看），从空的开始；下一次保存会写新的
        this.trips = [];
      }
    }
    this.publish();
  }

  private static fillSettings(s: Settings): Settings {
    const d = defaultSettings();
    const out: Settings = {
      palette: s.palette !== undefined ? s.palette : d.palette,
      post: s.post !== undefined ? s.post : d.post,
      theme: s.theme !== undefined ? s.theme : d.theme,
      lang: s.lang !== undefined ? s.lang : 'auto'
    };
    return out;
  }

  /** 发到 AppStorage（界面读这些键） */
  private publish(): void {
    AppStorage.setOrCreate<Trip[]>('eo.trips', this.trips);
    AppStorage.setOrCreate<Avatar>('eo.avatar', this.avatar);
    AppStorage.setOrCreate<Settings>('eo.settings', this.settings);
    AppStorage.setOrCreate<HomePlace[]>('eo.home', this.home !== undefined ? [this.home] : []);
    AppStorage.setOrCreate<ManualFlag[]>('eo.pins', this.pins);
    AppStorage.setOrCreate<string[]>('eo.planted', this.planted);
  }

  private changed(trips: boolean, look: boolean): void {
    this.publish();
    this.scheduleSave();
    if (trips) this.onTripsChange();
    if (look) this.onLookChange();
  }

  private scheduleSave(): void {
    if (this.saveTimer >= 0) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = -1; this.saveNow(); }, 300);
  }

  saveNow(): void {
    if (this.path === '') return;
    const st: PersistedState = {
      trips: this.trips, avatar: this.avatar, settings: this.settings, home: this.home, pins: this.pins, planted: this.planted
    };
    try { Files.writeTextAtomic(this.path, JSON.stringify(st)); } catch (e) { /* 磁盘满等：下次修改再试 */ }
  }

  // ------------------------------------------------------------ 示例行程

  /** 示例目录（设置页也用） */
  static samples(): SampleInfo[] {
    try { return JSON.parse(Files.rawText('world/assets/samples/trips/index.json')) as SampleInfo[]; } catch (e) { return []; }
  }

  /** 读一本示例并迁移到当前版本（要世界层就绪） */
  static async loadSample(s: SampleInfo): Promise<Trip> {
    const raw = JSON.parse(Files.rawText('world/assets/samples/trips/' + s.file)) as Object;
    return CoreApi.migrate(raw);
  }

  /** 世界层就绪后调用：第一次启动才装示例 */
  async seedIfNeeded(): Promise<void> {
    if (!this.needsSeed) return;
    this.needsSeed = false;
    const list = TripStore.samples().filter((s: SampleInfo) => STARTER_SAMPLES.indexOf(s.id) >= 0);   // 第一次启动只装两本（shared/spec/samples.ts），其余在设置 → 示例行程里加
    const added: Trip[] = [];
    for (const s of list) {
      try { added.push(await TripStore.loadSample(s)); } catch (e) { /* 一本坏了不连累其他 */ }
    }
    if (added.length > 0) {
      this.trips = added.concat(this.trips.filter((t: Trip) => added.every((a: Trip) => a.id !== t.id)));
    }
    this.changed(true, false);   // 也写一次盘：以后不再装
  }

  // ------------------------------------------------------------ 读

  trip(id: string): Trip | undefined { return this.trips.find((t: Trip) => t.id === id); }

  // ------------------------------------------------------------ 书

  /** 加一本：同 id 已在就换个 id；放在最前面 */
  insert(trip: Trip): Trip {
    const t = cloneTrip(trip);
    if (this.trip(t.id) !== undefined) t.id = t.id + '-' + Date.now().toString(36);
    this.trips = [t].concat(this.trips);
    this.changed(true, false);
    return t;
  }

  /** 改一本：在副本上改，改完换进去（updatedAt 跟着变） */
  update(id: string, body: (t: Trip) => void): void {
    const i = this.trips.findIndex((t: Trip) => t.id === id);
    if (i < 0) return;
    const t = cloneTrip(this.trips[i]);
    body(t);
    t.updatedAt = Dates.nowIso();
    const next = this.trips.slice();
    next[i] = t;
    this.trips = next;
    this.changed(true, false);
  }

  delete(id: string): void {
    this.trips = this.trips.filter((t: Trip) => t.id !== id);
    this.changed(true, false);
  }

  replaceAll(trips: Trip[]): void {
    this.trips = trips.slice();
    this.changed(true, false);
  }

  setStatus(id: string, status: string): void { this.update(id, (t: Trip) => { t.status = status; }); }

  /** 日记：text 为 undefined = 换回自动生成的 */
  setDiary(id: string, dayIndex: number, text: string | undefined): void {
    this.update(id, (t: Trip) => { if (dayIndex >= 0 && dayIndex < t.days.length) t.days[dayIndex].diary = text; });
  }

  private updatePlace(id: string, dayIndex: number, entryId: string, body: (e: Entry) => void): void {
    this.update(id, (t: Trip) => {
      if (dayIndex < 0 || dayIndex >= t.days.length) return;
      const e = t.days[dayIndex].entries.find((x: Entry) => x.id === entryId);
      if (e !== undefined && e.type === 'place') body(e);
    });
  }

  setVisited(id: string, dayIndex: number, entryId: string, visited: boolean): void {
    this.updatePlace(id, dayIndex, entryId, (e: Entry) => {
      e.visited = visited;
      e.visitedAt = visited ? Dates.nowIso() : undefined;
    });
  }

  setNotes(id: string, dayIndex: number, entryId: string, notes: string): void {
    this.updatePlace(id, dayIndex, entryId, (e: Entry) => { e.notes = notes.trim().length > 0 ? notes : undefined; });
  }

  addTodo(id: string, dayIndex: number, entryId: string, text: string, due: string): void {
    this.updatePlace(id, dayIndex, entryId, (e: Entry) => {
      const td: Todo = { id: 'td-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), text: text, due: due };
      e.todos = (e.todos ?? []).concat([td]);
    });
  }

  setTodoDone(id: string, dayIndex: number, entryId: string, todoId: string, done: boolean): void {
    this.updatePlace(id, dayIndex, entryId, (e: Entry) => {
      for (const td of (e.todos ?? [])) { if (td.id === todoId) td.done = done; }
    });
  }

  removeTodo(id: string, dayIndex: number, entryId: string, todoId: string): void {
    this.updatePlace(id, dayIndex, entryId, (e: Entry) => {
      const left = (e.todos ?? []).filter((td: Todo) => td.id !== todoId);
      e.todos = left.length > 0 ? left : undefined;
    });
  }

  setSuitcase(id: string, edits: CaseEdits | undefined): void { this.update(id, (t: Trip) => { t.suitcase = edits; }); }

  // ------------------------------------------------------------ 小人、设置、家、足迹

  setAvatar(a: Avatar): void { this.avatar = a; this.changed(false, true); }

  setSettings(s: Settings): void { this.settings = s; this.changed(true, true); }

  setHome(h: HomePlace | undefined): void { this.home = h; this.changed(true, false); }

  addPin(name: string, lat: number, lng: number): ManualFlag {
    const f: ManualFlag = { id: 'pin-' + Date.now().toString(36), name: name, lat: lat, lng: lng, date: Dates.today() };
    this.pins = this.pins.concat([f]);
    this.changed(true, false);
    return f;
  }

  removePin(id: string): void {
    this.pins = this.pins.filter((f: ManualFlag) => f.id !== id);
    this.changed(true, false);
  }

  /** 播过插旗动画的足迹（不再算 fresh） */
  markPlanted(ids: string[]): void {
    const set = new Set<string>(this.planted);
    let grew = false;
    for (const id of ids) { if (!set.has(id)) { set.add(id); grew = true; } }
    if (!grew) return;
    this.planted = Array.from(set);
    this.publish();
    this.scheduleSave();   // 不触发 set-footprints：动画已经播过了
  }

  /** filesDir 是否可用（EntryAbility 已 init） */
  static ready(): boolean { return AppContext.filesDir() !== ''; }
}
