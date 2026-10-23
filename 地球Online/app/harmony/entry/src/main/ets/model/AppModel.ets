import { ConfigurationConstant } from '@kit.AbilityKit';
import { Day, Entry, Footprint, FootprintsResult, HomePlace, JourneyResult, Place, Settings, Trip } from './Spec';
import { TripStore } from './TripStore';
import { WorldController } from '../world/WorldController';
import { CoreApi } from '../world/CoreApi';
import {
  FlagMsg, FlyToMsg, FocusBookMsg, GotoStopMsg, FocusDayMsg, FocusHomeMsg, MarkVisitedMsg, PickPointMsg, PlayMsg, SetAvatarMsg,
  SetFootprintsMsg, SetHomeMsg, SetInsetsMsg, SetLayoutMsg, SetPaletteMsg, SetPostMsg, SetSkyMsg, SetTripsMsg, SetViewMsg,
  ShowDayMsg, ShowGlobeMsg, WorldEvent
} from '../world/WorldMessages';
import { Insets, LayoutInfo, LayoutState, SafeArea } from '../layout/LayoutState';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { Dates } from '../util/Dates';
import { AppContext } from '../util/Files';

/** 地球上的三种「舞台」：home（我的旅程）→ book（一本书）→ day（潜入某一天的浮岛）。世界层常驻，舞台切换只换模式和相机 */
export class StageState {
  kind: string = 'home';
  tripId: string = '';
  dayIndex: number = 0;
  /** 书页里选中的那一天（-1 = 看整本书） */
  bookDay: number = -1;
}

/** 浮层（底部面板 / 三页时的右页）：一摞，最上面那个显示；返回键先退浮层 */
export class SheetRoute {
  kind: string = '';            // newTrip | paywall | stop | todos | notes | nav
  tripId: string = '';
  dayIndex: number = 0;
  entryId: string = '';
  tab: string = '';             // newTrip：plan | dest | import
  feature: string = '';         // paywall：trips | ai | sync | export
}

/** 压栈的整页（列表页，不显示地球或只占左页） */
export class PageRoute {
  name: string = '';            // settings | avatar | footprints | shelf | diary
  tripId: string = '';
}

/** 某一天的世界里：小人到过的最后一站、走完了没有、播放中、跟随小人还是看全天 */
export class DayRun {
  heroStop: number = -1;
  heroEntry: string = '';
  finished: boolean = false;
  playing: boolean = true;
  follow: boolean = true;
}

/** 首页的旅程状态（core('journey') 的结果摊平） */
export class JourneyView {
  kind: string = 'none';        // none（还没算出来）| traveling | departing | back | idle
  tripId: string = '';
  dayIndex: number = 0;
  inDays: number = 0;
  daysAgo: number = 0;
  nextTripId: string = '';
  nextInDays: number = 0;
}

/** 应用的协调者（iOS AppModel.swift 的移植）：导航、浮层、提示、与世界层的同步。
 *  界面读 AppStorage 的这些键：eo.stage / eo.sheets / eo.pages / eo.dayRun / eo.journey / eo.toast / eo.picking / eo.today / eo.uiKey；
 *  数据键（eo.trips 等）由 TripStore 发；布局键（eo.layout / eo.safe）由 LayoutState 发。 */
export class AppModel {
  static readonly shared: AppModel = new AppModel();

  stage: StageState = new StageState();
  sheets: SheetRoute[] = [];
  pages: PageRoute[] = [];
  dayRun: DayRun = new DayRun();
  journey: JourneyView = new JourneyView();
  picking: string = '';
  today: string = Dates.today();
  systemDark: boolean = false;

  private store: TripStore = TripStore.shared;
  private world: WorldController = WorldController.shared;
  private started: boolean = false;
  private pushTimer: number = -1;
  private toastTimer: number = -1;
  private lastDaySig: string = '';
  private lastInsets: string = '';
  private lastFocus: string = '';
  /** 进入某一天时要走到的那一站（等 plate-loaded 再发 goto-stop） */
  private pendingStop: number = -1;

  // ------------------------------------------------------------ 启动

  /** EntryAbility.onCreate 里调一次（store 已载入、I18n 已 init） */
  start(systemDark: boolean): void {
    if (this.started) return;
    this.started = true;
    this.systemDark = systemDark;
    I18n.setLocale(I18n.resolve(this.store.settings.lang));
    this.world.locale = I18n.locale;
    if (this.store.avatar.name === '') {
      const a = this.store.avatar;
      a.name = I18n.t('avatar.defaultName');
    }
    AppStorage.setOrCreate<StageState>('eo.stage', this.stage);
    AppStorage.setOrCreate<SheetRoute[]>('eo.sheets', []);
    AppStorage.setOrCreate<PageRoute[]>('eo.pages', []);
    AppStorage.setOrCreate<DayRun>('eo.dayRun', this.dayRun);
    AppStorage.setOrCreate<JourneyView>('eo.journey', this.journey);
    AppStorage.setOrCreate<string>('eo.toast', '');
    AppStorage.setOrCreate<string>('eo.picking', '');
    AppStorage.setOrCreate<string>('eo.today', this.today);
    AppStorage.setOrCreate<boolean>('eo.worldReady', false);
    AppStorage.setOrCreate<LayoutInfo>('eo.layout', LayoutState.info);
    AppStorage.setOrCreate<SafeArea>('eo.safe', new SafeArea());
    Theme.dark = this.resolveDark();
    this.publishUiKey();
    this.applyColorMode();

    this.world.on((e: WorldEvent) => this.handle(e));
    this.store.onTripsChange = () => this.tripsChanged();
    this.store.onLookChange = () => this.pushLook();

    this.pushLook();
    this.pushWorldState();
    this.enterStage(this.stage, false);
    this.refreshJourney();
    setInterval(() => this.tick(), 60000);
  }

  /** 每分钟（以及回到前台时）看一眼日期变了没有；每 10 分钟重算一次天色 */
  tick(): void {
    this.skyTick = (this.skyTick + 1) % 10;
    if (this.skyTick === 0) this.refreshSky();
    const d = Dates.today();
    if (d === this.today) return;
    this.today = d;
    AppStorage.setOrCreate<string>('eo.today', d);
    this.tripsChanged();
  }

  // ------------------------------------------------------------ 外观与语言

  private resolveDark(): boolean {
    const th = this.store.settings.theme;
    return th === 'dark' || (th !== 'light' && this.systemDark);
  }

  private publishUiKey(): void {
    AppStorage.setOrCreate<string>('eo.uiKey', I18n.locale + '/' + (Theme.dark ? 'night' : 'day'));
  }

  /** 设置里固定了白天 / 夜晚就让系统控件（输入框、键盘、弹窗）也跟着；「跟随手机」时不干预 */
  private applyColorMode(): void {
    const ctx = AppContext.ability;
    if (ctx === null) return;
    const th = this.store.settings.theme;
    const mode = th === 'dark' ? ConfigurationConstant.ColorMode.COLOR_MODE_DARK
      : th === 'light' ? ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT : ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET;
    try { ctx.getApplicationContext().setColorMode(mode); } catch (e) { /* 旧系统没有这个接口 */ }
  }

  /** 系统深浅变了（EntryAbility.onConfigurationUpdate） */
  setSystemDark(dark: boolean): void {
    this.systemDark = dark;
    this.applyAppearance();
  }

  /** 系统语言变了：设置是「跟随手机」时跟着换 */
  systemLanguageChanged(): void { this.applyLocale(); }

  private applyAppearance(): void {
    const dark = this.resolveDark();
    if (dark !== Theme.dark) {
      Theme.dark = dark;
      this.publishUiKey();
    }
    this.world.send(new SetSkyMsg(dark ? 'night' : 'day'));   // 先按深浅给，core 回来再换成带晨昏的
    this.refreshSky();
  }

  /** 天色按 core 的 skyPhase（含晨昏）：外观或深浅变了、每 10 分钟各算一次 */
  private skyTick: number = 0;
  private refreshSky(): void {
    CoreApi.skyPhase(this.store.settings.theme, this.systemDark, new Date().toISOString(), this.store.home)
      .then((p: string) => { this.world.send(new SetSkyMsg(p)); })
      .catch(() => { /* 世界层还没就绪：保持按深浅给的那一个 */ });
  }

  private applyLocale(): void {
    const l = I18n.resolve(this.store.settings.lang);
    if (l === I18n.locale) return;
    I18n.setLocale(l);
    this.world.reloadForLocale(l);
    this.publishUiKey();
  }

  /** 设置页改了设置：存、推给世界层、外观与语言跟着变 */
  updateSettings(palette: string, post: string, theme: string, lang: string): void {
    const s: Settings = { palette: palette, post: post, theme: theme, lang: lang };
    this.store.setSettings(s);
    this.applyColorMode();
    this.applyAppearance();
    this.applyLocale();
  }

  // ------------------------------------------------------------ 舞台

  goHome(): void {
    const s = new StageState();
    this.enterStage(s, true);
  }

  openBook(id: string, day: number): void {
    if (this.store.trip(id) === undefined) return;
    this.setPages([]);
    const s = new StageState();
    s.kind = 'book'; s.tripId = id; s.bookDay = day;
    this.enterStage(s, true);
  }

  /** 进入某一天并让小人走到第 stop 站（书页的预览里点了站点） */
  openDayAt(id: string, index: number, stop: number): void {
    this.openDay(id, index);
    if (this.stage.kind === 'day') this.pendingStop = stop;
  }

  openDay(id: string, index: number): void {
    this.pendingStop = -1;
    const t = this.store.trip(id);
    if (t === undefined || index < 0 || index >= t.days.length) return;
    this.setPages([]);
    this.setSheets([]);
    const s = new StageState();
    s.kind = 'day'; s.tripId = id; s.dayIndex = index;
    this.enterStage(s, true);
  }

  selectBookDay(day: number): void {
    if (this.stage.kind !== 'book') return;
    const s = new StageState();
    s.kind = 'book'; s.tripId = this.stage.tripId; s.bookDay = day;
    this.setStage(s);
    if (day >= 0) this.world.send(new FocusDayMsg(s.tripId, day, true));
    else this.world.send(new FocusBookMsg(s.tripId, true));
  }

  private setStage(s: StageState): void {
    this.stage = s;
    AppStorage.setOrCreate<StageState>('eo.stage', s);
  }

  private enterStage(s: StageState, animate: boolean): void {
    this.setStage(s);
    if (s.kind === 'home') {
      this.world.send(new ShowGlobeMsg());
      this.lastFocus = '';
      this.focusHome(animate);
    } else if (s.kind === 'book') {
      this.world.send(new ShowGlobeMsg());
      if (s.bookDay >= 0) this.world.send(new FocusDayMsg(s.tripId, s.bookDay, animate));
      else this.world.send(new FocusBookMsg(s.tripId, animate));
    } else {
      const t = this.store.trip(s.tripId);
      if (t === undefined) { this.goHome(); return; }
      this.setRun(new DayRun());
      this.lastDaySig = AppModel.signature(t.days[s.dayIndex]);
      this.world.send(new SetAvatarMsg(this.store.avatar));
      this.world.send(new SetPostMsg(this.store.settings.post));
      this.world.send(new ShowDayMsg(t, s.dayIndex));
      this.world.send(new SetViewMsg(30, true));
      this.world.send(new PlayMsg());
    }
  }

  /** 首页相机：有「现在」的书（旅行中 / 快出发 / 刚回来）就聚焦它，平常日子回到家 */
  private focusHome(animate: boolean): void {
    const j = this.journey;
    const focusId = j.kind === 'traveling' || j.kind === 'departing' || j.kind === 'back' ? j.tripId : '';
    const key = focusId !== '' ? 'book:' + focusId : 'home';
    if (key === this.lastFocus) return;
    this.lastFocus = key;
    if (focusId !== '') { this.world.send(new FocusBookMsg(focusId, animate)); return; }
    const h = this.store.home;
    if (h !== undefined) this.world.send(new FocusHomeMsg(h.lat, h.lng, animate));
    else this.world.send(new FocusHomeMsg(30, Dates.guessHomeLng(), animate));
  }

  setRun(r: DayRun): void {
    this.dayRun = r;
    AppStorage.setOrCreate<DayRun>('eo.dayRun', r);
  }

  // ------------------------------------------------------------ 整页与浮层

  private setPages(p: PageRoute[]): void { this.pages = p; AppStorage.setOrCreate<PageRoute[]>('eo.pages', p); }
  private setSheets(s: SheetRoute[]): void { this.sheets = s; AppStorage.setOrCreate<SheetRoute[]>('eo.sheets', s); }

  show(name: string): void {
    const p = new PageRoute(); p.name = name;
    this.setSheets([]);
    this.setPages(this.pages.concat([p]));
  }

  openDiary(tripId: string): void {
    const p = new PageRoute(); p.name = 'diary'; p.tripId = tripId;
    this.setSheets([]);
    this.setPages([p]);
  }

  popPage(): void { if (this.pages.length > 0) this.setPages(this.pages.slice(0, this.pages.length - 1)); }

  present(r: SheetRoute): void { this.setSheets([r]); }
  push(r: SheetRoute): void { this.setSheets(this.sheets.concat([r])); }
  popSheet(): void { if (this.sheets.length > 0) this.setSheets(this.sheets.slice(0, this.sheets.length - 1)); }
  closeSheets(): void { this.setSheets([]); }

  newTrip(tab: string): void { const r = new SheetRoute(); r.kind = 'newTrip'; r.tab = tab; this.present(r); }
  paywall(feature: string): void { const r = new SheetRoute(); r.kind = 'paywall'; r.feature = feature; this.push(r); }

  /** 站点详情：小人走过去 + 面板 */
  openStop(tripId: string, dayIndex: number, entryId: string): void {
    const r = new SheetRoute(); r.kind = 'stop'; r.tripId = tripId; r.dayIndex = dayIndex; r.entryId = entryId;
    this.present(r);
  }

  /** 系统返回（手势 / 返回键）：先退子浮层、浮层、点选、整页，再退舞台；在首页返回 false（交给系统） */
  back(): boolean {
    if (this.sheets.length > 0) { this.popSheet(); return true; }
    if (this.picking !== '') { this.cancelPick(); return true; }
    if (this.pages.length > 0) { this.popPage(); return true; }
    if (this.stage.kind === 'day') { this.openBook(this.stage.tripId, this.stage.dayIndex); return true; }
    if (this.stage.kind === 'book') {
      if (this.stage.bookDay >= 0) this.selectBookDay(-1); else this.goHome();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ 与世界层同步

  /** 书、家、足迹变了：去抖 0.4 秒推给世界层，并重算旅程状态 */
  tripsChanged(): void {
    if (this.pushTimer >= 0) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = -1;
      if (this.stage.kind !== 'home' && this.store.trip(this.stage.tripId) === undefined) this.goHome();
      this.pushWorldState();
      this.refreshJourney();
    }, 400);
  }

  /** 外观（天色、色调、画质、小人） */
  pushLook(): void {
    this.world.send(new SetSkyMsg(Theme.dark ? 'night' : 'day'));
    this.refreshSky();
    this.world.send(new SetPaletteMsg(this.store.settings.palette));
    this.world.send(new SetPostMsg(this.store.settings.post));
    this.world.send(new SetAvatarMsg(this.store.avatar));
  }

  pushWorldState(): void {
    this.world.send(new SetTripsMsg(this.store.trips, this.today));
    this.world.send(new SetHomeMsg(this.store.home !== undefined ? this.store.home : null));
    this.world.send(new SetPaletteMsg(this.store.settings.palette));
    CoreApi.footprints(this.store.trips, this.store.pins, this.today, this.store.home).then((r: FootprintsResult) => {
      const planted = new Set<string>(this.store.planted);
      const flags: FlagMsg[] = r.flags.map((f: Footprint) => new FlagMsg(f.id, f.name, f.lat, f.lng));
      const fresh: string[] = r.flags.filter((f: Footprint) => !planted.has(f.id)).map((f: Footprint) => f.id);
      this.world.send(new SetFootprintsMsg(flags, fresh));
    }).catch(() => { /* 世界层还没好：就绪后下一次修改再推 */ });
    if (this.stage.kind === 'day') {
      const t = this.store.trip(this.stage.tripId);
      if (t !== undefined && this.stage.dayIndex < t.days.length) {
        // 某一天的条目改了（增删、改名、挪顺序、改坐标）才让世界层重建路线；打卡只发 mark-visited
        const sig = AppModel.signature(t.days[this.stage.dayIndex]);
        if (sig !== this.lastDaySig) {
          this.lastDaySig = sig;
          this.world.send(new ShowDayMsg(t, this.stage.dayIndex));
        }
      }
    }
  }

  /** 一天的「形状」（与 iOS AppModel.signature 同一套） */
  static signature(d: Day): string {
    const parts: string[] = d.entries.map((e: Entry) => {
      if (e.type === 'place') {
        const g = e.geo;
        return 'p|' + e.id + '|' + (e.name ?? '') + '|' + (e.category ?? '') + '|' + (e.kind ?? '') + '|' +
          (g !== undefined ? g.lat + ',' + g.lng : '0,0') + '|' + (e.plannedStart ?? '');
      }
      if (e.type === 'transport') {
        return 't|' + e.id + '|' + (e.mode ?? '') + '|' + (e.label ?? '') + '|' + (e.durationMinutes ?? 0) + '|' + (e.polyline !== undefined ? e.polyline.length : 0);
      }
      return 'l|' + e.id + '|' + (e.name ?? '');
    });
    return parts.join(';') + '#' + d.city;
  }

  refreshJourney(): void {
    CoreApi.journey(this.store.trips, this.today).then((j: JourneyResult) => {
      const v = new JourneyView();
      v.kind = j.kind;
      v.tripId = j.tripId ?? '';
      v.dayIndex = j.dayIndex ?? 0;
      v.inDays = j.inDays ?? 0;
      v.daysAgo = j.daysAgo ?? 0;
      if (j.next) { v.nextTripId = j.next.tripId; v.nextInDays = j.next.inDays; }
      this.journey = v;
      AppStorage.setOrCreate<JourneyView>('eo.journey', v);
      if (this.stage.kind === 'home') this.focusHome(true);
    }).catch(() => { /* 就绪后会再算 */ });
  }

  /** 舞台的卡片挡住的区域（StageScaffold 量好报上来） */
  reportInsets(i: Insets): void {
    const k = i.key();
    if (k === this.lastInsets) return;
    this.lastInsets = k;
    this.world.send(new SetInsetsMsg(Math.round(i.left), Math.round(i.bottom), Math.round(i.top), Math.round(i.right)));
  }

  /** 布局态变了（LayoutState.watch） */
  onLayout(li: LayoutInfo): void {
    this.world.send(new SetLayoutMsg(li.result.state, li.width, li.height, li.segments, li.posture));
  }

  // ------------------------------------------------------------ 打卡、播放

  setVisited(tripId: string, dayIndex: number, entryId: string, visited: boolean): void {
    this.store.setVisited(tripId, dayIndex, entryId, visited);
    this.world.send(new MarkVisitedMsg(entryId, visited));
    this.toast(I18n.t(visited ? 'day.checkedInToast' : 'day.uncheckedToast'));
  }

  setFollow(follow: boolean): void {
    const r = this.copyRun(); r.follow = follow; this.setRun(r);
    this.world.send(new SetViewMsg(undefined, follow));
  }

  private copyRun(): DayRun {
    const r = new DayRun();
    r.heroStop = this.dayRun.heroStop; r.heroEntry = this.dayRun.heroEntry;
    r.finished = this.dayRun.finished; r.playing = this.dayRun.playing; r.follow = this.dayRun.follow;
    return r;
  }

  setPlaying(on: boolean): void { const r = this.copyRun(); r.playing = on; this.setRun(r); }

  // ------------------------------------------------------------ 世界层的事件

  handle(e: WorldEvent): void {
    switch (e.kind) {
      case 'ready':   // 页面级就绪（每次载入一次）：状态与排队的核心调用已经由 WorldController 重放 / 发出；第一次启动这时装示例
        this.store.seedIfNeeded();
        break;
      case 'plate-loaded': {
        // 底板建好（每次 show-day 之后一次）：世界层把小人放回起点并停住，这里把面板的进度清零、接着播，书页里点过的那一站走过去
        if (this.stage.kind !== 'day') break;
        const r = new DayRun(); r.follow = this.dayRun.follow; r.playing = this.dayRun.playing; this.setRun(r);
        if (r.playing) this.world.send(new PlayMsg());
        if (this.pendingStop >= 0) { this.world.send(new GotoStopMsg(this.pendingStop)); this.pendingStop = -1; }
        break;
      }
      case 'hero-arrived': {
        const r = this.copyRun(); r.heroStop = e.stopIndex ?? -1; r.heroEntry = e.entryId ?? ''; this.setRun(r);
        break;
      }
      case 'day-finished': {
        const r = this.copyRun(); r.finished = true; this.setRun(r);
        break;
      }
      case 'book-tapped':
        if (this.stage.kind === 'day' || e.id === undefined) return;
        this.openBook(e.id, -1);
        break;
      case 'day-tapped': {
        const id = e.id ?? '', d = e.dayIndex ?? 0;
        if (this.stage.kind === 'book' && this.stage.tripId === id) this.selectBookDay(d);
        else if (this.stage.kind !== 'day') this.openBook(id, d);
        break;
      }
      case 'point-picked':
        this.finishPick(e.lat ?? 0, e.lng ?? 0);
        break;
      case 'flags-planted': {
        const ids = e.ids ?? [];
        this.store.markPlanted(ids);
        if (this.stage.kind === 'home' && ids.length > 0) this.toast(I18n.tn('home.planted', ids.length));
        break;
      }
      default:
        break;   // building-tapped / empty-tapped / segment-started / snapshot-done：这一版不用
    }
  }

  // ------------------------------------------------------------ 在地球上点选（放家 / 补旗）

  startPick(purpose: string): void {
    this.setPages([]);
    this.setSheets([]);
    if (this.stage.kind !== 'home') this.goHome();
    this.picking = purpose;
    AppStorage.setOrCreate<string>('eo.picking', purpose);
    this.world.send(new PickPointMsg(true));
  }

  cancelPick(): void {
    this.picking = '';
    AppStorage.setOrCreate<string>('eo.picking', '');
    this.world.send(new PickPointMsg(false));
  }

  private finishPick(lat: number, lng: number): void {
    const p = this.picking;
    if (p === '') return;
    this.cancelPick();
    if (p === 'home') {
      // 名字用 core 的 nearest（最近的城市 / 地方）；附近没有就叫「我的家」
      CoreApi.nearest(lat, lng).then((pl: Place | null) => pl !== null ? pl.name : I18n.t('fp.myHome')).catch(() => I18n.t('fp.myHome')).then((name: string) => {
        const h: HomePlace = { name: name, lat: lat, lng: lng };
        this.store.setHome(h);
        this.toast(I18n.t1('fp.homeSet', 'name', name));
      });
    } else {
      const name = I18n.latLng(lat, lng);
      this.store.addPin(name, lat, lng);
      this.toast(I18n.t1('fp.added', 'name', name));
    }
    this.world.send(new FlyToMsg(lat - 6, lng, 1.3));
  }

  // ------------------------------------------------------------ 新建、导入、付费墙

  /** 加入新书；免费版名额满了就停下、弹付费墙。过去的、已合上的书不占名额 */
  async addTrips(trips: Trip[]): Promise<Trip[]> {
    const added: Trip[] = [];
    for (const t of trips) {
      const takesSlot = t.status !== 'closed' && t.endDate >= this.today;
      if (takesSlot) {
        let ok = true;
        try { ok = (await CoreApi.quota('free', this.store.trips, this.today)).canCreate; } catch (e) { ok = true; }
        if (!ok) { this.paywall('trips'); break; }
      }
      added.push(this.store.insert(t));
    }
    return added;
  }

  // ------------------------------------------------------------ 提示

  toast(text: string): void {
    AppStorage.setOrCreate<string>('eo.toast', text);
    if (this.toastTimer >= 0) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastTimer = -1; AppStorage.setOrCreate<string>('eo.toast', ''); }, 2600);
  }
}
