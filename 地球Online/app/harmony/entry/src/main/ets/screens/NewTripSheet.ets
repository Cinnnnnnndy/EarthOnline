import {
  Day, DraftInput, HomePlace, Place, PlanRequest, PlanResult, PlannerContext, PlannerMessage, PlannerTripRef,
  THEMES, Trip, placesOf
} from '../model/Spec';
import { AppModel, SheetRoute } from '../model/AppModel';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { CoreApi } from '../world/CoreApi';
import { ImportResult, WorldController } from '../world/WorldController';
import { FlyToMsg } from '../world/WorldMessages';
import { Field, GlassButton, IconButton, InkButton, Segmented } from '../components/Controls';
import { iconRes } from '../components/Icons';
import { Dates } from '../util/Dates';
import { AppContext, Files } from '../util/Files';
import { FONT_BODY, FONT_SUB, RADIUS_L, RADIUS_M, SPACE_M, SPACE_S, TOUCH } from '../gen/Shared';

/** 对话里的一句 */
class ChatLine {
  role: string; text: string; key: string;
  constructor(role: string, text: string, key: string) { this.role = role; this.text = text; this.key = key; }
}

/** 导入的 JSON 可能是一本书、一组书，或 { trips: [...] } */
interface ImportWrapper { trips?: Object[] }

/** 新建旅程：说一句话（离线规划 core('plan') 的对话 → 草稿 → 生成）/ 去一个地方（core('searchPlaces') → core('buildTrip')）/ 导入（JSON 走 core('migrate')，行程页 HTML 走 import-page）。
 *  免费版名额满了弹付费墙（AppModel.addTrips）。语音识别还没接（TODO(voice)：@kit.CoreSpeechKit 的 speechRecognizer，转写结果交给 send()）。 */
@Component
export struct NewTripSheet {
  @Prop route: SheetRoute = new SheetRoute();
  @StorageLink('eo.trips') trips: Trip[] = [];
  @StorageLink('eo.home') home: HomePlace[] = [];
  @StorageLink('eo.today') today: string = '';
  @State tab: string = 'plan';
  // 说一句话
  @State lines: ChatLine[] = [];
  @State typed: string = '';
  @State thinking: boolean = false;
  @State drafts: Trip[] = [];          // 0 或 1 本草稿
  // 去一个地方
  @State query: string = '';
  @State results: Place[] = [];
  @State picked: Place[] = [];         // 0 或 1 个目的地
  @State title: string = '';
  @State start: string = '';
  @State days: number = 5;
  @State theme: string = THEMES[0];
  // 导入
  @State pasted: string = '';
  @State busy: boolean = false;
  @State error: string = '';

  private app: AppModel = AppModel.shared;
  private scroller: Scroller = new Scroller();
  private searchTimer: number = -1;
  private searchSeq: number = 0;

  aboutToAppear(): void {
    this.tab = this.route.tab !== '' ? this.route.tab : 'plan';
    this.start = Dates.add(this.today !== '' ? this.today : Dates.today(), 30);
  }

  // ------------------------------------------------------------ 说一句话

  private send(): void {
    const text = this.typed.trim();
    if (text === '' || this.thinking) return;
    this.typed = '';
    this.lines = this.lines.concat([new ChatLine('user', text, 'u' + this.lines.length)]);
    this.ask();
  }

  private ask(): void {
    this.thinking = true;
    const messages: PlannerMessage[] = this.lines.map((l: ChatLine) => {
      const m: PlannerMessage = { role: l.role, text: l.text };
      return m;
    });
    const refs: PlannerTripRef[] = this.trips.map((t: Trip) => {
      const r: PlannerTripRef = { title: t.title, startDate: t.startDate, endDate: t.endDate };
      return r;
    });
    const ctx: PlannerContext = { today: this.today, locale: I18n.locale, trips: refs };
    if (this.home.length > 0) ctx.home = this.home[0];
    const req: PlanRequest = { messages: messages, context: ctx };
    CoreApi.plan(req, I18n.locale).then((r: PlanResult) => {
      let reply = r.reply;
      if (r.question !== undefined && r.question !== '') reply = reply + (reply === '' ? '' : (I18n.locale === 'en' ? ' ' : '')) + r.question;
      this.lines = this.lines.concat([new ChatLine('assistant', reply, 'a' + this.lines.length)]);
      if (r.draft !== undefined && r.draft !== null) {
        this.drafts = [r.draft];
        this.flyToDraft(r.draft);
      }
      this.thinking = false;
      this.scrollDown();
    }).catch(() => {
      this.lines = this.lines.concat([new ChatLine('assistant', I18n.t('voice.error'), 'a' + this.lines.length)]);
      this.thinking = false;
      this.scrollDown();
    });
  }

  private scrollDown(): void { setTimeout(() => { this.scroller.scrollEdge(Edge.Bottom); }, 60); }

  private flyToDraft(t: Trip): void {
    for (const d of t.days) {
      for (const e of placesOf(d)) {
        if (e.geo !== undefined) { WorldController.shared.send(new FlyToMsg(e.geo.lat - 4, e.geo.lng, 0.55)); return; }
      }
    }
  }

  private draft(): Trip { return this.drafts[0]; }

  /** 草稿的出发日挪一挪：整本书的日期一起挪 */
  private moveDraft(newStart: string): void {
    const t = JSON.parse(JSON.stringify(this.draft())) as Trip;
    const shift = Dates.diff(t.startDate, newStart);
    if (shift === 0) return;
    t.startDate = newStart;
    t.endDate = Dates.add(t.endDate, shift);
    for (const d of t.days) d.date = Dates.add(d.date, shift);
    this.drafts = [t];
  }

  private renameDraft(v: string): void {
    const t = JSON.parse(JSON.stringify(this.draft())) as Trip;
    t.title = v.substring(0, 40);
    this.drafts = [t];
  }

  private pickDate(current: string, done: (iso: string) => void): void {
    this.getUIContext().showDatePickerDialog({
      start: new Date(2000, 0, 1),
      end: new Date(2100, 11, 31),
      selected: Dates.toDate(current),
      onDateAccept: (v: Date) => done(Dates.iso(v))
    });
  }

  // ------------------------------------------------------------ 去一个地方

  private search(q: string): void {
    this.query = q;
    if (this.searchTimer >= 0) clearTimeout(this.searchTimer);
    if (q.trim() === '') { this.results = []; return; }
    const seq = ++this.searchSeq;
    this.searchTimer = setTimeout(() => {
      CoreApi.searchPlaces(q.trim(), 6).then((r: Place[]) => { if (seq === this.searchSeq) this.results = r; }).catch(() => { this.results = []; });
    }, 200);
  }

  private pick(p: Place): void {
    this.picked = [p];
    this.results = [];
    this.query = '';
    WorldController.shared.send(new FlyToMsg(p.lat - 4, p.lng, 0.55));
  }

  private createFromPlace(): void {
    if (this.picked.length === 0 || this.busy) return;
    const p = this.picked[0];
    const input: DraftInput = {
      destination: { name: p.name, place: p },
      startDate: this.start, days: this.days, theme: this.theme,
      locale: I18n.locale, today: this.today, now: Dates.nowIso()
    };
    this.busy = true;
    CoreApi.buildTrip(input).then((t: Trip) => {
      const name = this.title.trim();
      if (name !== '') t.title = name.substring(0, 40);
      this.busy = false;
      this.add([t], []);
    }).catch(() => { this.busy = false; this.app.toast(I18n.t('voice.error')); });
  }

  // ------------------------------------------------------------ 导入

  private chooseFile(): void {
    const ctx = AppContext.ability;
    if (ctx === null) return;
    Files.pickText(ctx).then((text: string) => { if (text !== '') this.parse(text); }).catch(() => { /* 取消 */ });
  }

  private async parse(raw: string): Promise<void> {
    const text = raw.trim();
    if (text === '' || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (text.startsWith('{') || text.startsWith('[')) {
        const parsed = JSON.parse(text) as Object;
        let raws: Object[] = [];
        if (Array.isArray(parsed)) raws = parsed as Object[];
        else {
          const w = parsed as ImportWrapper;
          raws = w.trips !== undefined && Array.isArray(w.trips) ? w.trips : [parsed];
        }
        const trips: Trip[] = [];
        for (const r of raws) {
          try { trips.push(await CoreApi.migrate(r)); } catch (e) { /* 坏的一本跳过 */ }
        }
        if (trips.length === 0) this.error = I18n.t('common.importInvalid');
        else await this.add(trips, []);
      } else {
        const r: ImportResult = await WorldController.shared.importPage(text);
        if (r.error !== '') this.error = I18n.t1('common.importFailed', 'reason', r.error);
        else if (r.trips.length === 0) this.error = I18n.t('import.noRoutes');
        else await this.add(r.trips, r.warnings);
      }
    } catch (e) {
      this.error = I18n.t1('common.importFailed', 'reason', (e as Error).message);
    }
    this.busy = false;
  }

  // ------------------------------------------------------------ 加进书架

  private async add(trips: Trip[], warnings: string[]): Promise<void> {
    const added = await this.app.addTrips(trips);
    if (added.length === 0) return;   // 名额满了：付费墙已经叠在上面
    if (added.length > 1 || warnings.length > 0) {
      this.app.toast(warnings.length > 0
        ? I18n.t('new.importedWarn', { 'n': added.length, 'warning': warnings[0] })
        : I18n.tn('new.imported', added.length));
    }
    this.app.closeSheets();
    this.app.openBook(added[0].id, -1);
  }

  // ------------------------------------------------------------ 界面

  build() {
    Column({ space: SPACE_M }) {
      Row() {
        Text(I18n.t('home.newTrip')).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink).layoutWeight(1)
        IconButton({ icon: 'close', label: I18n.t('common.close'), plain: true, action: () => this.app.closeSheets() })
      }
      .width('100%')
      Segmented({
        options: ['plan', 'dest', 'import'],
        labels: [I18n.t('voice.title'), I18n.t('new.tabDest'), I18n.t('new.tabImport')],
        selected: this.tab,
        onPick: (v: string) => { this.tab = v; }
      })
      if (this.tab === 'plan') {
        this.PlanPane()
      } else if (this.tab === 'dest') {
        this.DestPane()
      } else {
        this.ImportPane()
      }
    }
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  PlanPane() {
    Column({ space: SPACE_S }) {
      Scroll(this.scroller) {
        Column({ space: SPACE_M }) {
          this.Bubble(new ChatLine('assistant', I18n.list([I18n.t('new.voiceSub'), I18n.t('voice.hint')]), 'intro'))
          ForEach(this.lines, (l: ChatLine) => {
            this.Bubble(l)
          }, (l: ChatLine) => l.key)
          if (this.thinking) {
            Row({ space: 8 }) {
              LoadingProgress().width(20).height(20).color(Theme.p().mist)
              Text(I18n.t('voice.thinking')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
            }
          }
          if (this.drafts.length > 0) {
            this.DraftCard()
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding({ bottom: 8 })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .align(Alignment.Top)
      Row({ space: 8 }) {
        Column() {
          Field({
            placeholder: I18n.t('voice.placeholder'), text: this.typed,
            onChange: (v: string) => { this.typed = v; }, onSubmit: () => this.send()
          })
        }
        .layoutWeight(1)
        IconButton({ icon: 'send', label: I18n.t('voice.send'), enabled: this.typed.trim() !== '' && !this.thinking, action: () => this.send() })
      }
      .width('100%')
    }
    .width('100%')
    .layoutWeight(1)
  }

  @Builder
  Bubble(l: ChatLine) {
    Row() {
      if (l.role === 'user') {
        Blank()
      }
      Text(l.text)
        .fontSize(FONT_BODY)
        .fontColor(Theme.p().ink)
        .padding({ left: 14, right: 14, top: 10, bottom: 10 })
        .borderRadius(18)
        .backgroundColor(l.role === 'user' ? Theme.p().fill : Theme.p().listStrong)
        .constraintSize({ maxWidth: '85%' })
        .copyOption(CopyOptions.LocalDevice)
      if (l.role !== 'user') {
        Blank()
      }
    }
    .width('100%')
  }

  @Builder
  DraftCard() {
    Column({ space: SPACE_S }) {
      TextInput({ placeholder: I18n.t('new.bookTitle'), text: this.draft().title })
        .fontSize(FONT_BODY)
        .fontWeight(FontWeight.Medium)
        .fontColor(Theme.p().ink)
        .backgroundColor(Theme.p().field)
        .borderRadius(RADIUS_M - 2)
        .height(TOUCH)
        .onChange((v: string) => this.renameDraft(v))
      Text(I18n.list([I18n.plainNames(this.draft().destination), I18n.days(this.draft().days.length), I18n.theme(this.draft().theme)]))
        .fontSize(FONT_SUB).fontColor(Theme.p().mist)
      Row({ space: 8 }) {
        Text(I18n.t('new.start')).fontSize(FONT_BODY).fontColor(Theme.p().ink)
        Blank()
        Text(I18n.fullDate(this.draft().startDate)).fontSize(FONT_BODY).fontColor(Theme.p().mist)
        IconButton({ icon: 'calendar', label: I18n.t('new.start'), plain: true, action: () => this.pickDate(this.draft().startDate, (iso: string) => this.moveDraft(iso)) })
      }
      .width('100%')
      ForEach(this.draft().days.slice(0, 6), (d: Day) => {
        Row({ space: 12 }) {
          Text(I18n.tn('home.travelingDay', d.index)).fontSize(FONT_SUB).fontWeight(FontWeight.Medium).fontColor(Theme.p().mist).constraintSize({ minWidth: 32 })
          Text(I18n.plain(d.title)).fontSize(FONT_SUB).fontColor(Theme.p().ink).maxLines(1).layoutWeight(1)
          if (placesOf(d).length > 0) {
            Text(I18n.stops(placesOf(d).length)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
          }
        }
        .width('100%')
      }, (d: Day) => d.index + ':' + d.date + ':' + d.title)
      if (this.draft().days.length > 6) {
        Text(I18n.tn('voice.moreDays', this.draft().days.length - 6)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
      }
      Row() {
        InkButton({ title: I18n.t('voice.create'), action: () => { this.add([this.draft()], []); } })
      }
      .width('100%')
      .justifyContent(FlexAlign.End)
    }
    .width('100%')
    .padding(16)
    .borderRadius(RADIUS_L)
    .backgroundColor(Theme.p().listStrong)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  DestPane() {
    Scroll() {
      Column({ space: SPACE_M }) {
        Text(I18n.t('new.destination')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
        if (this.picked.length > 0) {
          Row({ space: 12 }) {
            Image(iconRes('pin')).width(20).height(20).fillColor(Theme.p().ink)
            Text(this.picked[0].name).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink).layoutWeight(1)
            IconButton({ icon: 'close', label: I18n.t('common.clear'), plain: true, action: () => { this.picked = []; } })
          }
          .width('100%')
          .height(TOUCH)
        } else {
          Field({
            placeholder: I18n.t('new.searchPlaceholder'), text: this.query, icon: 'search',
            onChange: (v: string) => this.search(v)
          })
          ForEach(this.results, (p: Place) => {
            Row() {
              Text(p.name).fontSize(FONT_BODY).fontColor(Theme.p().ink).layoutWeight(1)
              Text(p.aliases.length > 0 ? p.aliases[0] : '').fontSize(FONT_SUB).fontColor(Theme.p().mist).maxLines(1)
            }
            .width('100%')
            .height(TOUCH)
            .onClick(() => this.pick(p))
          }, (p: Place) => p.name + ':' + p.lat + ':' + p.lng)
        }
        Field({ placeholder: I18n.t('new.titlePlaceholder'), text: this.title, onChange: (v: string) => { this.title = v; } })
        Row({ space: 8 }) {
          Text(I18n.t('new.start')).fontSize(FONT_BODY).fontColor(Theme.p().ink)
          Blank()
          Text(I18n.fullDate(this.start)).fontSize(FONT_BODY).fontColor(Theme.p().mist)
          IconButton({ icon: 'calendar', label: I18n.t('new.start'), plain: true, action: () => this.pickDate(this.start, (iso: string) => { this.start = iso; }) })
        }
        .width('100%')
        Row({ space: 8 }) {
          Text(I18n.t('new.days')).fontSize(FONT_BODY).fontColor(Theme.p().ink)
          Blank()
          IconButton({ icon: 'minus', label: I18n.t('new.days'), enabled: this.days > 1, action: () => { this.days = Math.max(1, this.days - 1); } })
          Text(I18n.days(this.days)).fontSize(FONT_BODY).fontColor(Theme.p().ink).constraintSize({ minWidth: 56 }).textAlign(TextAlign.Center)
          IconButton({ icon: 'plus', label: I18n.t('new.days'), enabled: this.days < 30, action: () => { this.days = Math.min(30, this.days + 1); } })
        }
        .width('100%')
        Text(I18n.t('new.theme')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
        Flex({ wrap: FlexWrap.Wrap }) {
          ForEach(THEMES, (th: string) => {
            Text(I18n.theme(th))
              .fontSize(FONT_SUB)
              .fontColor(th === this.theme ? Theme.onInk() : Theme.p().ink)
              .padding({ left: 12, right: 12 })
              .height(32)
              .borderRadius(16)
              .backgroundColor(th === this.theme ? Theme.p().ink : Theme.p().fill)
              .margin({ right: 6, bottom: 6 })
              .onClick(() => { this.theme = th; })
          }, (th: string) => th + ':' + (th === this.theme ? 1 : 0))
        }
        .width('100%')
        Row() {
          InkButton({ title: I18n.t('voice.create'), enabled: this.picked.length > 0 && !this.busy, action: () => this.createFromPlace() })
        }
        .width('100%')
        .justifyContent(FlexAlign.End)
        if (this.picked.length === 0) {
          Text(I18n.t('new.pickFirst')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
    .align(Alignment.Top)
  }

  @Builder
  ImportPane() {
    Scroll() {
      Column({ space: SPACE_M }) {
        Text(I18n.t('new.importHint')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
        GlassButton({ title: I18n.t('new.chooseFile'), icon: 'import', enabled: !this.busy, action: () => this.chooseFile() })
        TextArea({ placeholder: I18n.t('new.pastePlaceholder'), text: this.pasted })
          .fontSize(FONT_SUB)
          .fontColor(Theme.p().ink)
          .placeholderColor(Theme.p().mist2)
          .backgroundColor(Theme.p().field)
          .borderRadius(RADIUS_M - 2)
          .height(140)
          .onChange((v: string) => { this.pasted = v; })
        Row({ space: 8 }) {
          if (this.busy) {
            LoadingProgress().width(24).height(24).color(Theme.p().mist)
          }
          Blank()
          InkButton({ title: I18n.t('common.import'), enabled: this.pasted.trim() !== '' && !this.busy, action: () => { this.parse(this.pasted); } })
        }
        .width('100%')
        if (this.error !== '') {
          Text(this.error).fontSize(FONT_SUB).fontColor(Theme.p().danger)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
    .layoutWeight(1)
    .scrollBar(BarState.Off)
    .align(Alignment.Top)
  }
}
