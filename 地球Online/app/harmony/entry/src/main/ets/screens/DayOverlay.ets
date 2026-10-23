import { Day, Entry, Trip, placesOf, todayIndexOf } from '../model/Spec';
import { AppModel, DayRun, StageState } from '../model/AppModel';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { StageScaffold } from '../components/StageScaffold';
import { GlassIconButton, IconButton, InkButton } from '../components/Controls';
import { ItinBuilder, ItinRow, ItineraryList } from '../components/Itinerary';
import { groupIcon, iconRes } from '../components/Icons';
import { WorldController } from '../world/WorldController';
import { GotoStopMsg, PauseMsg, PlayMsg, RestartMsg } from '../world/WorldMessages';
import { FONT_BODY, FONT_SUB, SPACE_S, TOUCH } from '../gen/Shared';

/** 某一天 = 潜入浮岛：世界铺满整屏；左上回到这本书；右上一枚控制胶囊（播放 / 暂停、跟随 / 看全天、重走今天、小人）；
 *  抽屉：这一天（D2 标题、日期、前一天 / 后一天）、下一站一行、编号的行程列表（组图标、待办标签、时间）。
 *  点站点 → 小人走过去（goto-stop）+ 站点详情。走完了给「翻到下一天」/「写旅行日记」。 */
@Component
export struct DayOverlay {
  @StorageLink('eo.trips') @Watch('refresh') trips: Trip[] = [];
  @StorageLink('eo.stage') @Watch('refresh') stage: StageState = new StageState();
  @StorageLink('eo.dayRun') run: DayRun = new DayRun();
  @StorageLink('eo.today') today: string = '';
  @State rows: ItinRow[] = [];
  @State rev: number = 0;

  private app: AppModel = AppModel.shared;
  private world: WorldController = WorldController.shared;
  private loadSeq: number = 0;

  aboutToAppear(): void { this.refresh(); }

  private trip(): Trip | undefined { return this.trips.find((t: Trip) => t.id === this.stage.tripId); }
  private valid(): boolean {
    const t = this.trip();
    return t !== undefined && this.stage.kind === 'day' && this.stage.dayIndex >= 0 && this.stage.dayIndex < t.days.length;
  }
  private t(): Trip { return this.trip()!; }
  private day(): Day { return this.t().days[this.stage.dayIndex]; }
  private places(): Entry[] { return placesOf(this.day()); }

  refresh(): void {
    if (!this.valid()) { this.rows = []; return; }
    const t = this.t(), day = this.day();
    this.rows = ItinBuilder.quick(day);
    this.rev++;
    const seq = ++this.loadSeq;
    ItinBuilder.full(t, day, this.today).then((r: ItinRow[]) => {
      if (seq !== this.loadSeq) return;
      this.rows = r;
      this.rev++;
    }).catch(() => { /* 先用没有时间的那版 */ });
  }

  private isToday(): boolean { return todayIndexOf(this.t(), this.today) === this.stage.dayIndex; }

  private dateLine(): string {
    const d = I18n.monthDay(this.day().date);
    return this.isToday() ? I18n.t1('home.todayDate', 'date', d) : d;
  }

  /** 下一站：小人到过的那一站的后一站（按 entryId 找，找不到按 stopIndex） */
  private nextIndex(): number {
    const ps = this.places();
    if (ps.length === 0) return -1;
    let at = -1;
    if (this.run.heroEntry !== '') at = ps.findIndex((e: Entry) => e.id === this.run.heroEntry);
    if (at < 0) at = this.run.heroStop;
    return Math.min(ps.length - 1, at + 1);
  }
  private next(): Entry { return this.places()[Math.max(0, this.nextIndex())]; }
  private nextTime(): string {
    const id = this.next().id;
    const r = this.rows.find((x: ItinRow) => x.entryId === id);
    return r !== undefined ? r.time : '';
  }

  private togglePlay(): void {
    const on = !this.run.playing;
    this.app.setPlaying(on);
    this.world.send(on ? new PlayMsg() : new PauseMsg());
  }

  private replay(): void {
    const r = new DayRun();
    r.follow = this.run.follow;
    this.app.setRun(r);
    this.world.send(new RestartMsg());
    this.world.send(new PlayMsg());
  }

  private tapStop(r: ItinRow): void {
    this.world.send(new GotoStopMsg(r.placeIndex));
    this.app.openStop(this.stage.tripId, this.stage.dayIndex, r.entryId);
  }

  build() {
    if (this.valid()) {
      StageScaffold({
        drawer: true,
        leading: (): void => { this.Leading() },
        trailing: (): void => { this.Controls() },
        content: (): void => { this.Card() }
      })
    }
  }

  @Builder
  Leading() {
    GlassIconButton({ icon: 'back', label: I18n.t('day.backToBook'), action: () => this.app.openBook(this.stage.tripId, this.stage.dayIndex) })
  }

  /** 控制胶囊：一个玻璃胶囊里的四颗图标 */
  @Builder
  Controls() {
    Row() {
      IconButton({ icon: this.run.playing ? 'pause' : 'play', label: I18n.t('day.pauseResume'), plain: true, tint: Theme.p().ink, action: () => this.togglePlay() })
      IconButton({ icon: this.run.follow ? 'whole' : 'follow', label: I18n.t(this.run.follow ? 'day.seeWholeDay' : 'day.followHero'), plain: true, tint: Theme.p().ink, action: () => this.app.setFollow(!this.run.follow) })
      IconButton({ icon: 'replay', label: I18n.t('day.replay'), plain: true, tint: Theme.p().ink, action: () => this.replay() })
      IconButton({ icon: 'person', label: I18n.t('settings.avatar'), plain: true, tint: Theme.p().ink, action: () => this.app.show('avatar') })
    }
    .height(TOUCH)
    .borderRadius(TOUCH / 2)
    .backgroundColor(Theme.p().glassFill)
    .backdropBlur(22)
    .border({ width: 0.5, color: Theme.p().glassRim })
    .shadow({ radius: 16, color: Theme.shadow(), offsetX: 0, offsetY: 6 })
  }

  @Builder
  Card() {
    Column({ space: SPACE_S }) {
      // 这一天 + 前一天 / 后一天
      Row({ space: 4 }) {
        Column({ space: 2 }) {
          Text(I18n.tn('home.travelingDay', this.day().index) + ' ' + I18n.plain(this.day().title))
            .fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.dateLine()).fontSize(FONT_SUB).fontColor(this.isToday() ? Theme.p().dawnInk : Theme.p().mist)
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
        IconButton({
          icon: 'back', label: I18n.t('day.prevDay'), plain: true, enabled: this.stage.dayIndex > 0,
          action: () => this.app.openDay(this.stage.tripId, this.stage.dayIndex - 1)
        })
        IconButton({
          icon: 'forward', label: I18n.t('day.nextDay'), plain: true, enabled: this.stage.dayIndex < this.t().days.length - 1,
          action: () => this.app.openDay(this.stage.tripId, this.stage.dayIndex + 1)
        })
      }
      .width('100%')
      // 下一站（一行：组图标、「下一站」、名字、时间）
      if (this.places().length === 0) {
        Text(I18n.t('day.noStops')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
      } else if (this.run.finished) {
        Row({ space: 8 }) {
          Image(iconRes('flag')).width(18).height(18).fillColor(Theme.p().dawn)
          Text(I18n.t('day.dayDone')).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().dawnInk)
        }
        .height(TOUCH)
      } else {
        Row({ space: 12 }) {
          Image(iconRes(groupIcon(this.next().category, this.next().kind))).width(20).height(20).fillColor(Theme.p().mist)
          Text(I18n.t('day.nextStop')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
          Text(this.next().name ?? '').fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
          if (this.nextTime() !== '') {
            Text(this.nextTime()).fontSize(FONT_SUB).fontColor(Theme.p().mist)
          }
        }
        .width('100%')
        .height(TOUCH)
        .onClick(() => this.app.openStop(this.stage.tripId, this.stage.dayIndex, this.next().id))
      }
      if (this.day().entries.length > 0) {
        Row().width('100%').height(0.5).backgroundColor(Theme.p().line)
        ItineraryList({ rows: this.rows, rev: this.rev, onTap: (r: ItinRow) => this.tapStop(r) })
      }
      if (this.run.finished) {
        Row() {
          if (this.stage.dayIndex < this.t().days.length - 1) {
            InkButton({ title: I18n.t('day.turnNext'), action: () => this.app.openDay(this.stage.tripId, this.stage.dayIndex + 1) })
          } else {
            InkButton({ title: I18n.t('home.writeDiary'), action: () => this.app.openDiary(this.stage.tripId) })
          }
        }
        .width('100%')
        .justifyContent(FlexAlign.End)
        .padding({ top: 4 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
