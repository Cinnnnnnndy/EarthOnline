import { Avatar, CaseCard, CaseEdits, CaseEntry, CaseGroup, CaseItem, Day, Trip, TripStats } from '../model/Spec';
import { AppModel } from '../model/AppModel';
import { TripStore } from '../model/TripStore';
import { SafeArea } from '../layout/LayoutState';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { CoreApi } from '../world/CoreApi';
import { RawfileServer } from '../world/RawfileServer';
import { SuitcaseBridge } from '../world/SuitcaseBridge';
import { WorldController } from '../world/WorldController';
import { MadeCard } from '../world/SuitcaseBridge';
import { Photos } from '../util/Photos';
import { Field, IconButton, ListSection, NavRow, PageHeader, Segmented, Tag } from '../components/Controls';
import { iconRes } from '../components/Icons';
import { AppContext, Files, Share } from '../util/Files';
import { SUITCASE_STYLES, FONT_BODY, FONT_SUB, RADIUS_M, RADIUS_S, SPACE_L, SPACE_S } from '../gen/Shared';

/** 统计的一格：数值 17 半粗、说明 13 次要色 */
class Stat {
  value: string; label: string;
  constructor(value: string, label: string) { this.value = value; this.label = label; }
}

/** 清单里的一格：类 emoji 的图标（嵌入页渲染的 PNG）+ 名字；remove = 「箱子里的」那一排（右上角是叉） */
class CaseTile {
  key: string = ''; type: string = ''; id: string = '';
  label: string = ''; sub: string = ''; icon: string = '';
  inBox: boolean = false; remove: boolean = false;
}

/** 清单上面那排场景标签（点了就按它检索；shared/algo/case-search.ts 认这几个词） */
const CASE_SCENES: string[] = ['aurora', 'beach', 'stroll', 'trail'];

/** 封底 = 旅行日记（iOS DiaryView 同一套）：统计（core('tripStats')）、这一趟的行李箱（第二个 Web：embed.html?mode=suitcase）、
 *  每天的日记（写过的以用户的为准，没写过的是 core('diary') 生成的；可改、可重写）、复制行程数据、合上 / 重新翻开这本书。
 *  行李箱的清单（D98，iOS SuitcaseEditSheet / 安卓 CaseList 同一套）：搜索框、场景标签、「箱子里的」一排、按组的图标格，点一格放进去 / 拿出来。
 *  书名旁导出长图（D96）：交给世界层的嵌入页逐天渲染、按网页同一份排版拼好（WorldController.exportLongImage），三端同一张图。 */
@Component
export struct DiaryPage {
  @Prop @Watch('load') tripId: string = '';
  @StorageLink('eo.trips') trips: Trip[] = [];
  @StorageLink('eo.avatar') avatar: Avatar = { skin: 0, hair: 'short', hairColor: 0, dress: 0, hat: 'cap', hatColor: 0, shoes: 0, name: '' };
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();
  @State stats: Stat[] = [];
  @State texts: string[] = [];
  @State textRev: number = 0;
  @State exporting: boolean = false;
  @State exportingLong: boolean = false;
  @StorageLink('eo.longProgress') longProgress: string = '';
  @State editingCase: boolean = false;
  @State caseQuery: string = '';
  @State caseItems: CaseItem[] = [];
  @State caseGroups: CaseGroup[] = [];
  @State makingCard: boolean = false;

  private app: AppModel = AppModel.shared;
  private store: TripStore = TripStore.shared;
  private bridge: SuitcaseBridge = new SuitcaseBridge();
  /** 正在打的字（不进 @State：免得每打一个字整列重建、光标乱跳） */
  private typed: string[] = [];
  private saveTimers: number[] = [];
  private searchTimer: number = -1;

  aboutToAppear(): void {
    this.bridge.onContents = (items: CaseItem[]) => { this.caseItems = items; };
    this.bridge.onResults = (groups: CaseGroup[]) => { this.caseGroups = groups; };
    this.bridge.onEdits = (edits: CaseEdits | null, result: string) => this.onCaseEdits(edits, result);
    this.load();
  }

  aboutToDisappear(): void {
    if (this.searchTimer >= 0) clearTimeout(this.searchTimer);
    this.flushAll();
    this.bridge.dispose();
  }

  private trip(): Trip | undefined { return this.trips.find((t: Trip) => t.id === this.tripId); }
  private has(): boolean { return this.trip() !== undefined; }
  private t(): Trip { return this.trip()!; }

  load(): void {
    const t = this.trip();
    if (t === undefined) return;
    this.bridge.show(t, this.avatar);
    CoreApi.tripStats(t).then((s: TripStats) => {
      this.stats = [
        new Stat(String(s.days), I18n.t('epi.statDays')),
        new Stat(String(s.places), I18n.t('epi.statStops')),
        new Stat(String(s.visited), I18n.t('epi.statVisited')),
        new Stat(String(s.cities.length), I18n.t('epi.statDestinations')),
        new Stat(I18n.duration(s.walkMinutes), I18n.t('epi.statWalk')),
        new Stat(I18n.duration(s.transitMinutes), I18n.t('epi.statTransit'))
      ];
    }).catch(() => { this.stats = []; });
    // 每天的日记：写过的直接用；没写过的问核心要生成的那一版
    const texts: string[] = t.days.map((d: Day) => d.diary ?? '');
    this.texts = texts.slice();
    this.typed = texts.slice();
    this.textRev++;
    t.days.forEach((d: Day, i: number) => {
      if (d.diary !== undefined) return;
      CoreApi.diary(t, i, I18n.locale).then((g: string) => {
        if (this.typed[i] !== '' && this.typed[i] !== undefined) return;   // 用户已经开始写了
        const next = this.texts.slice(); next[i] = g; this.texts = next;
        this.typed[i] = g;
        this.textRev++;
      }).catch(() => { /* 世界层没好：留空 */ });
    });
  }

  /** 打字：0.6 秒没动就存 */
  private onType(i: number, v: string): void {
    this.typed[i] = v;
    if (this.saveTimers[i] !== undefined && this.saveTimers[i] >= 0) clearTimeout(this.saveTimers[i]);
    this.saveTimers[i] = setTimeout(() => { this.saveTimers[i] = -1; this.store.setDiary(this.tripId, i, v); }, 600);
  }

  private flushAll(): void {
    for (let i = 0; i < this.saveTimers.length; i++) {
      if (this.saveTimers[i] !== undefined && this.saveTimers[i] >= 0) {
        clearTimeout(this.saveTimers[i]);
        this.saveTimers[i] = -1;
        this.store.setDiary(this.tripId, i, this.typed[i]);
      }
    }
  }

  /** 重写：丢掉用户写的，换回生成的 */
  private rewrite(i: number): void {
    const t = this.trip();
    if (t === undefined) return;
    if (this.saveTimers[i] !== undefined && this.saveTimers[i] >= 0) { clearTimeout(this.saveTimers[i]); this.saveTimers[i] = -1; }
    this.store.setDiary(t.id, i, undefined);
    CoreApi.diary(t, i, I18n.locale).then((g: string) => {
      const next = this.texts.slice(); next[i] = g; this.texts = next;
      this.typed[i] = g;
      this.textRev++;
      this.app.toast(I18n.t('epi.restored'));
    }).catch(() => { /* 世界层没好 */ });
  }

  private setStyle(style: string): void {
    const a = JSON.parse(JSON.stringify(this.avatar)) as Avatar;
    a.suitcase = style;
    this.store.setAvatar(a);
    const t = this.trip();
    if (t !== undefined) this.bridge.show(t, a);
  }

  private async exportSuitcase(): Promise<void> {
    const ctx = AppContext.ability, t = this.trip();
    if (ctx === null || t === undefined || this.exporting) return;
    this.exporting = true;
    const dataUrl = await this.bridge.export();
    this.exporting = false;
    if (dataUrl === '') { this.app.toast(I18n.t1('epi.exportFailed', 'reason', 'timeout')); return; }
    try {
      const path = Files.exportDir() + '/' + Files.safeName(I18n.t1('case.fileName', 'title', I18n.plain(t.title)));
      Files.writeBytes(path, Files.dataUrlBytes(dataUrl));
      await Share.file(ctx, path, true);
    } catch (e) {
      this.app.toast(I18n.t1('epi.exportFailed', 'reason', (e as Error).message));
    }
  }

  // ------------------------------------------------------------ 清单

  /** 打字：停 0.2 秒再检索（嵌入页每次都要分组、可能还要渲染图标） */
  private onCaseQuery(v: string): void {
    this.caseQuery = v;
    if (this.searchTimer >= 0) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.searchTimer = -1; this.bridge.search(v); }, 200);
  }

  private pickScene(label: string): void {
    if (this.searchTimer >= 0) { clearTimeout(this.searchTimer); this.searchTimer = -1; }
    this.caseQuery = label;
    this.bridge.search(label);
  }

  /** 把新的增减存进书里，箱子按它重显，检索结果刷新（里面的「已在箱子里」会变） */
  private saveCase(edits: CaseEdits | undefined): void {
    const t = this.trip();
    if (t === undefined) return;
    this.store.setSuitcase(t.id, edits);
    const next = JSON.parse(JSON.stringify(t)) as Trip;
    next.suitcase = edits;
    this.bridge.show(next, this.avatar);
    this.bridge.search(this.bridge.lastQuery);
  }

  /** 嵌入页按规则放进去 / 拿出来之后：前面 / 后面放满了就提示，其余存下 */
  private onCaseEdits(edits: CaseEdits | null, result: string): void {
    if (result === 'frontFull') { this.app.toast(I18n.t('case.frontFull')); return; }
    if (result === 'backFull') { this.app.toast(I18n.t('case.backFull')); return; }
    this.saveCase(edits ?? undefined);
  }

  /** 「箱子里的」那一排点一格：照片卡直接从书里删，其余和清单里点一格一样走嵌入页的规则 */
  private removeFromBox(tile: CaseTile): void {
    const t = this.trip();
    if (t === undefined) return;
    if (tile.type === 'card') {
      const e = t.suitcase;
      if (e === undefined) return;
      Files.remove(Files.cardPath(tile.key));
      const next = JSON.parse(JSON.stringify(e)) as CaseEdits;
      const left = (e.cards ?? []).filter((c: CaseCard) => c.id !== tile.key);
      next.cards = left.length > 0 ? left : undefined;
      this.saveCase(next);
    } else {
      this.bridge.toggle(tile.type, tile.key);
    }
  }

  /** 放一张照片进去（D82 / D99）：系统的照片选择器 → 缩小 → 嵌入页抠图 → 存进 filesDir/cards/ → 记进书里（最多 3 张，挤掉最早的） */
  private async addPhoto(): Promise<void> {
    if (this.makingCard) return;
    let uri = '';
    try { uri = await Photos.pickOne(); } catch (e) { return; }
    if (uri === '') return;
    this.makingCard = true;
    try {
      const made: MadeCard | null = await this.bridge.makeCard(await Photos.dataUrl(uri));
      const t = this.trip();
      if (made === null || t === undefined) { this.app.toast(I18n.t('case.photoFailed')); return; }
      const id = 'card-' + Date.now().toString(36);
      Files.writeBytes(Files.cardPath(id), Files.dataUrlBytes(made.dataUrl));
      const e: CaseEdits = t.suitcase !== undefined ? JSON.parse(JSON.stringify(t.suitcase)) as CaseEdits : {};
      const card: CaseCard = { id: id, kind: made.kind, w: made.w, h: made.h };
      const all: CaseCard[] = (e.cards ?? []).concat([card]);
      for (const old of all.slice(0, Math.max(0, all.length - 3))) Files.remove(Files.cardPath(old.id));   // 挤掉的那张连图一起删
      e.cards = all.slice(-3);
      this.saveCase(e);
      this.app.toast(I18n.t(made.kind === 'cutout' ? 'case.photoCut' : 'case.photoFull'));
    } catch (err) {
      this.app.toast(I18n.t('case.photoFailed'));
    } finally {
      this.makingCard = false;
    }
  }

  /** 恢复成默认：拿掉所有增减，照片卡留着 */
  private restoreCase(): void {
    const e = this.trip()?.suitcase;
    if (e === undefined) return;
    const next: CaseEdits = {};
    if (e.cards !== undefined && e.cards.length > 0) next.cards = e.cards;
    this.saveCase(next.cards !== undefined ? next : undefined);
  }

  private hasCaseEdits(): boolean {
    const e = this.trip()?.suitcase;
    return e !== undefined && ((e.hidden ?? []).length > 0 || (e.picks ?? []).length > 0 || (e.gear ?? []).length > 0);
  }

  private itemTiles(): CaseTile[] {
    return this.caseItems.map((it: CaseItem) => {
      const tile = new CaseTile();
      tile.key = it.key; tile.type = it.type; tile.id = it.id; tile.label = it.label; tile.icon = it.icon ?? '';
      tile.inBox = true; tile.remove = true;
      return tile;
    });
  }

  private entryTiles(g: CaseGroup): CaseTile[] {
    return g.entries.map((en: CaseEntry) => {
      const tile = new CaseTile();
      tile.key = en.id; tile.type = en.type; tile.id = en.id; tile.label = en.label; tile.sub = en.sub ?? ''; tile.icon = en.icon ?? '';
      tile.inBox = en.inBox === true; tile.remove = false;
      return tile;
    });
  }

  private tapTile(tile: CaseTile): void {
    if (tile.remove) this.removeFromBox(tile); else this.bridge.toggle(tile.type, tile.id);
  }

  /** 一格一格（每行 4 格）：图标 56、名字一行、副标题一行；在箱子里的右上角一个勾，「箱子里的」那排是叉 */
  @Builder
  tileGrid(tiles: CaseTile[]) {
    Flex({ wrap: FlexWrap.Wrap }) {
      ForEach(tiles, (tile: CaseTile) => {
        Column({ space: 2 }) {
          Stack({ alignContent: Alignment.TopEnd }) {
            if (tile.icon !== '') {
              Image(tile.icon).width(56).height(56).objectFit(ImageFit.Contain)
            } else {
              Column().width(44).height(44).margin(6).borderRadius(RADIUS_M).backgroundColor(Theme.p().fill)
            }
            if (tile.inBox) {
              Image(iconRes(tile.remove ? 'close' : 'check'))
                .fillColor(tile.remove ? Theme.p().mist : Theme.p().paper)
                .width(18).height(18).padding(3).borderRadius(9)
                .backgroundColor(tile.remove ? Theme.p().fill : Theme.p().ink)
            }
          }
          .width(56).height(56)
          Text(tile.label).fontSize(FONT_SUB).fontColor(Theme.p().ink).maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis }).textAlign(TextAlign.Center).width('100%')
          if (tile.sub !== '') {
            Text(tile.sub).fontSize(FONT_SUB).fontColor(Theme.p().mist).maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis }).textAlign(TextAlign.Center).width('100%')
          }
        }
        .width('25%')
        .padding({ top: 4, bottom: 4, left: 2, right: 2 })
        .borderRadius(RADIUS_S)
        .onClick(() => this.tapTile(tile))
        .accessibilityText(tile.inBox ? I18n.t1('case.removeItem', 'name', tile.label) : I18n.t1('case.putIn', 'name', tile.label))
      }, (tile: CaseTile) => tile.type + ':' + tile.id + ':' + tile.inBox + ':' + (tile.icon !== ''))
    }
    .width('100%')
  }

  /** 清单：搜索框、场景标签、「箱子里的」、按组的图标格、恢复默认 */
  @Builder
  caseList() {
    Column({ space: 8 }) {
      Text(I18n.t('case.list')).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
      Field({ placeholder: I18n.t('case.searchPlaceholder'), text: this.caseQuery, icon: 'search', onChange: (v: string) => this.onCaseQuery(v) })
      Scroll() {
        Row({ space: 6 }) {
          ForEach(CASE_SCENES, (k: string) => {
            Text(I18n.t('case.scene.' + k))
              .fontSize(FONT_SUB)
              .fontColor(this.caseQuery === I18n.t('case.scene.' + k) ? Theme.p().paper : Theme.p().ink2)
              .padding({ left: 10, right: 10 })
              .height(30)
              .borderRadius(15)
              .backgroundColor(this.caseQuery === I18n.t('case.scene.' + k) ? Theme.p().ink : Theme.p().fill)
              .onClick(() => this.pickScene(I18n.t('case.scene.' + k)))
          }, (k: string) => k)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
      if (this.caseQuery === '' && this.caseItems.length > 0) {
        Text(I18n.tn('case.inBoxCount', this.caseItems.length)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
        this.tileGrid(this.itemTiles())
      }
      if (this.caseGroups.length === 0 && this.caseQuery !== '') {
        Text(I18n.t('case.noMatch')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
      }
      ForEach(this.caseGroups, (g: CaseGroup) => {
        Column({ space: 4 }) {
          Text(g.label).fontSize(FONT_SUB).fontColor(Theme.p().mist)
          this.tileGrid(this.entryTiles(g))
        }
        .alignItems(HorizontalAlign.Start)
        .width('100%')
      }, (g: CaseGroup) => this.caseQuery + ':' + g.id + ':' + g.entries.map((en: CaseEntry) => (en.inBox ? '1' : '0') + (en.icon !== undefined ? 'i' : '')).join(''))
      NavRow({ icon: 'import', title: I18n.t('case.addPhoto'), chevron: false, action: () => { this.addPhoto(); } })
      if (this.hasCaseEdits()) {
        NavRow({ icon: 'replay', title: I18n.t('case.restore'), chevron: false, action: () => this.restoreCase() })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(12)
    .margin({ bottom: 8 })
    .borderRadius(RADIUS_M)
    .backgroundColor(Theme.p().listStrong)
  }

  /** 长图：世界层渲染、拼好，写进 exports/ 再交给系统分享 */
  private async exportLong(): Promise<void> {
    const ctx = AppContext.ability, t = this.trip();
    if (ctx === null || t === undefined || this.exportingLong) return;
    this.flushAll();   // 正在打的日记先存下，长图里是最新的
    this.exportingLong = true;
    try {
      const dataUrl = await WorldController.shared.exportLongImage(this.trip() ?? t);
      const path = Files.exportDir() + '/' + Files.safeName(I18n.t1('epi.fileName', 'title', I18n.plain(t.title)));
      Files.writeBytes(path, Files.dataUrlBytes(dataUrl));
      await Share.file(ctx, path, true);
    } catch (e) {
      this.app.toast(I18n.t1('epi.exportFailed', 'reason', (e as Error).message));
    } finally {
      this.exportingLong = false;
    }
  }

  private copyData(): void {
    const t = this.trip();
    if (t === undefined) return;
    Share.copy(JSON.stringify(t)).then(() => this.app.toast(I18n.t('epi.copied'))).catch(() => { /* 剪贴板不可用 */ });
  }

  private toggleClosed(): void {
    const t = this.trip();
    if (t === undefined) return;
    const closed = t.status === 'closed';
    this.flushAll();
    this.store.setStatus(t.id, closed ? 'planning' : 'closed');
    this.app.toast(I18n.t(closed ? 'epi.reopened' : 'epi.closedToast'));
    this.app.popPage();
    this.app.goHome();
  }

  build() {
    Column() {
      PageHeader({ title: I18n.t('epi.title'), topInset: this.safe.top, back: () => { this.flushAll(); this.app.popPage(); } })
      if (this.has()) {
        Scroll() {
          Column({ space: SPACE_L }) {
            // 书名与日期；右边导出长图（导出中显示进度）
            Row({ space: SPACE_S }) {
              Column({ space: 4 }) {
                Text(I18n.plain(this.t().title)).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
                Text(I18n.fullDateRange(this.t().startDate, this.t().endDate)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
                if (this.exportingLong) {
                  Text(this.longProgress !== '' ? this.longProgress : I18n.t('epi.export')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
                }
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              IconButton({ icon: 'share', label: I18n.t('epi.export'), plain: true, enabled: !this.exportingLong, action: () => { this.exportLong(); } })
            }
            .width('100%')
            .padding({ left: 4, right: 4 })
            // 统计：两列
            Grid() {
              ForEach(this.stats, (s: Stat) => {
                GridItem() {
                  Column({ space: 2 }) {
                    Text(s.value).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
                    Text(s.label).fontSize(FONT_SUB).fontColor(Theme.p().mist)
                  }
                  .width('100%')
                  .alignItems(HorizontalAlign.Start)
                }
              }, (s: Stat) => s.label + ':' + s.value)
            }
            .columnsTemplate('1fr 1fr')
            .rowsGap(12)
            .height(Math.ceil(this.stats.length / 2) * 52)
            .padding({ left: 4, right: 4 })
            // 这一趟的行李箱：世界层里的 3D 箱子
            ListSection({ header: I18n.t('case.title') }) {
              Web({ src: this.bridge.url(I18n.locale), controller: this.bridge.controller })
                .width('100%')
                .aspectRatio(0.8)
                .borderRadius(RADIUS_M)
                .backgroundColor(Theme.p().paper)
                .javaScriptAccess(true)
                .domStorageAccess(true)
                .databaseAccess(true)
                .fileAccess(false)
                .zoomAccess(false)
                .horizontalScrollBarAccess(false)
                .verticalScrollBarAccess(false)
                .javaScriptProxy({ object: this.bridge.proxy, name: 'harmonyBridge', methodList: ['postMessage'], controller: this.bridge.controller })
                .onInterceptRequest((event) => RawfileServer.respond(event ? event.request.getRequestUrl() : ''))
                .onPageBegin(() => this.bridge.pageBegin())
                .accessibilityText(I18n.t('case.title'))
                .margin({ top: 8 })
              Row({ space: SPACE_S }) {
                Column() {
                  Segmented({
                    options: SUITCASE_STYLES,
                    labels: SUITCASE_STYLES.map((s: string) => I18n.t('case.style.' + s)),
                    selected: this.avatar.suitcase !== undefined ? this.avatar.suitcase : 'sand',
                    onPick: (v: string) => this.setStyle(v)
                  })
                }
                .layoutWeight(1)
                IconButton({
                  icon: 'edit', label: I18n.t('case.edit'), plain: true,
                  action: () => { this.editingCase = !this.editingCase; if (this.editingCase) this.bridge.search(this.bridge.lastQuery); }
                })
                IconButton({ icon: 'share', label: I18n.t('case.export'), plain: true, enabled: !this.exporting, action: () => { this.exportSuitcase(); } })
              }
              .width('100%')
              .padding({ top: 8, bottom: 8 })
              if (this.editingCase) {
                this.caseList()
              }
            }
            // 每天的日记
            ListSection({ header: I18n.t('epi.diaries'), footer: I18n.t('epi.diaryNote') }) {
              ForEach(this.t().days, (d: Day, i: number) => {
                Column({ space: 6 }) {
                  Row({ space: 6 }) {
                    Tag({ text: I18n.tn('home.travelingDay', d.index) })
                    Text(I18n.plain(d.title)).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
                      .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
                    IconButton({ icon: 'replay', label: I18n.t('epi.rewrite'), plain: true, action: () => this.rewrite(i) })
                  }
                  .width('100%')
                  Text(I18n.monthDay(d.date)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
                  TextArea({ text: i < this.texts.length ? this.texts[i] : '' })
                    .fontSize(FONT_BODY)
                    .fontColor(Theme.p().ink)
                    .backgroundColor(Theme.p().field)
                    .borderRadius(12)
                    .constraintSize({ minHeight: 96 })
                    .onChange((v: string) => this.onType(i, v))
                }
                .width('100%')
                .alignItems(HorizontalAlign.Start)
                .padding({ top: 8, bottom: 8 })
              }, (d: Day, i: number) => this.tripId + ':' + i + ':' + this.textRev)
            }
            ListSection() {
              NavRow({ icon: 'copy', title: I18n.t('epi.copyData'), chevron: false, action: () => this.copyData() })
              NavRow({
                icon: 'book', title: I18n.t(this.t().status === 'closed' ? 'epi.reopen' : 'epi.close'), chevron: false,
                action: () => this.toggleClosed()
              })
            }
          }
          .width('100%')
          .padding({ left: SPACE_L, right: SPACE_L, bottom: this.safe.bottom + SPACE_L })
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .align(Alignment.Top)
      }
    }
    .width('100%')
    .height('100%')
  }
}
