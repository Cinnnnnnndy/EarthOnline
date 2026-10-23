import { promptAction } from '@kit.ArkUI';
import { Day, Trip, phaseOf, placesOf, todayIndexOf } from '../model/Spec';
import { AppModel, StageState } from '../model/AppModel';
import { TripStore } from '../model/TripStore';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { StageScaffold } from '../components/StageScaffold';
import { GlassIconButton, InkButton, Tag } from '../components/Controls';
import { Ticket } from '../components/Ticket';
import { ItinBuilder, ItinRow, ItineraryList } from '../components/Itinerary';
import { iconRes } from '../components/Icons';
import { FONT_BODY, FONT_SUB, SPACE_M, TOUCH } from '../gen/Shared';

/** 一本书：地球聚焦这本书；抽屉里上面一张票（状态、撕票根 = 进入今天 / 从 D1 开始 / 写旅行日记），下面是天的列表。
 *  点某一天 → 地球 focus-day，抽屉换成那天的站点预览 +「进入这一天」。左上回到地球，右上日记与删除。 */
@Component
export struct BookOverlay {
  @StorageLink('eo.trips') @Watch('refresh') trips: Trip[] = [];
  @StorageLink('eo.stage') @Watch('refresh') stage: StageState = new StageState();
  @StorageLink('eo.today') today: string = '';
  @State rows: ItinRow[] = [];
  @State rev: number = 0;

  private app: AppModel = AppModel.shared;
  private loadSeq: number = 0;

  aboutToAppear(): void { this.refresh(); }

  private trip(): Trip | undefined { return this.trips.find((t: Trip) => t.id === this.stage.tripId); }
  private hasTrip(): boolean { return this.trip() !== undefined; }
  private t(): Trip { return this.trip()!; }
  private selected(): number {
    const t = this.trip();
    return t !== undefined && this.stage.bookDay >= 0 && this.stage.bookDay < t.days.length ? this.stage.bookDay : -1;
  }
  private day(): Day { return this.t().days[this.selected()]; }

  /** 选中的那一天的行程（先给不带时间的一版，再用核心算出时间与待办） */
  refresh(): void {
    const t = this.trip(), d = this.selected();
    if (t === undefined || d < 0) { this.rows = []; return; }
    const day = t.days[d];
    this.rows = ItinBuilder.quick(day);
    this.rev++;
    const seq = ++this.loadSeq;
    ItinBuilder.full(t, day, this.today).then((r: ItinRow[]) => {
      if (seq !== this.loadSeq) return;
      this.rows = r;
      this.rev++;
    }).catch(() => { /* 世界层没好：先用没有时间的那版 */ });
  }

  private phase(): string { return phaseOf(this.t(), this.today); }
  private todayIdx(): number { return todayIndexOf(this.t(), this.today); }

  private stubLabel(): string {
    const p = this.phase();
    if (p === 'traveling') return I18n.t('home.enterToday');
    if (p === 'ended' || p === 'closed') return I18n.t('home.writeDiary');
    return I18n.tn('home.startFromD', this.t().days.length > 0 ? this.t().days[0].index : 1);
  }

  private primary(): void {
    const t = this.t(), p = this.phase();
    if (p === 'traveling') this.app.openDay(t.id, Math.max(0, this.todayIdx()));
    else if (p === 'ended' || p === 'closed') this.app.openDiary(t.id);
    else this.app.openDay(t.id, 0);
  }

  private dayMeta(i: number): string {
    const d = this.t().days[i];
    return i === this.todayIdx() ? I18n.t1('home.todayDate', 'date', I18n.monthDay(d.date)) : I18n.monthDay(d.date);
  }

  private confirmDelete(): void {
    const t = this.trip();
    if (t === undefined) return;
    const buttons: promptAction.Button[] = [
      { text: I18n.t('common.cancel'), color: Theme.p().ink },
      { text: I18n.t('common.delete'), color: Theme.p().danger }
    ];
    this.getUIContext().getPromptAction().showDialog({
      title: I18n.t1('shelf.deleteConfirm', 'title', I18n.plain(t.title)),
      buttons: buttons
    }).then((r: promptAction.ShowDialogSuccessResponse) => {
      if (r.index !== 1) return;
      TripStore.shared.delete(t.id);
      this.app.goHome();
      this.app.toast(I18n.t('shelf.deleted'));
    }).catch(() => { /* 取消 */ });
  }

  build() {
    if (this.hasTrip()) {
      StageScaffold({
        drawer: true,
        leading: (): void => { this.Leading() },
        trailing: (): void => { this.Trailing() },
        content: (): void => { this.Card() }
      })
    }
  }

  @Builder
  Leading() {
    GlassIconButton({ icon: 'globe', label: I18n.t('home.backToGlobe'), action: () => this.app.goHome() })
  }

  @Builder
  Trailing() {
    Row({ space: 10 }) {
      GlassIconButton({ icon: 'book', label: I18n.t('epi.title'), action: () => this.app.openDiary(this.stage.tripId) })
      GlassIconButton({ icon: 'trash', label: I18n.t('common.delete'), action: () => this.confirmDelete() })
    }
  }

  @Builder
  Card() {
    Column({ space: SPACE_M }) {
      if (this.selected() < 0) {
        Ticket({
          trip: this.t(),
          status: I18n.tripStatus(this.phase(), this.todayIdx(), this.t().startDate),
          live: this.phase() === 'traveling',
          stubLabel: this.stubLabel(),
          onStub: () => this.primary()
        })
        Column() {
          ForEach(this.t().days, (d: Day, i: number) => {
            Row({ space: 12 }) {
              Row() {
                Tag({ text: I18n.tn('home.travelingDay', d.index), live: i === this.todayIdx() })
              }
              .constraintSize({ minWidth: 40 })
              Column({ space: 2 }) {
                Text(I18n.plain(d.title)).fontSize(FONT_BODY).fontColor(Theme.p().ink).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                Text(this.dayMeta(i)).fontSize(FONT_SUB).fontColor(i === this.todayIdx() ? Theme.p().dawnInk : Theme.p().mist).maxLines(1)
              }
              .layoutWeight(1)
              .alignItems(HorizontalAlign.Start)
              Image(iconRes('forward')).width(14).height(14).fillColor(Theme.p().mist2)
            }
            .width('100%')
            .constraintSize({ minHeight: TOUCH })
            .onClick(() => this.app.selectBookDay(i))
          }, (d: Day, i: number) => this.t().id + ':' + i + ':' + d.title + ':' + d.date + ':' + (i === this.todayIdx() ? 1 : 0))
        }
        .width('100%')
      } else {
        // 某一天的预览（仍在地球上）
        Row({ space: 6 }) {
          Image(iconRes('back')).width(16).height(16).fillColor(Theme.p().ink)
          Text(I18n.t('home.allDays')).fontSize(FONT_BODY).fontColor(Theme.p().ink)
        }
        .height(TOUCH)
        .onClick(() => this.app.selectBookDay(-1))
        Column({ space: 2 }) {
          Text(I18n.tn('home.travelingDay', this.day().index) + ' ' + I18n.plain(this.day().title))
            .fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(I18n.monthDay(this.day().date)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
        }
        .alignItems(HorizontalAlign.Start)
        if (placesOf(this.day()).length === 0) {
          Text(I18n.t('day.noStops')).fontSize(FONT_BODY).fontColor(Theme.p().mist).padding({ top: 8, bottom: 8 })
        } else {
          ItineraryList({
            rows: this.rows,
            rev: this.rev,
            onTap: (r: ItinRow) => this.app.openDayAt(this.stage.tripId, this.selected(), r.placeIndex)   // 底板建好后小人走到点的那一站
          })
        }
        Row() {
          InkButton({ title: I18n.t('home.enterDay'), action: () => this.app.openDay(this.stage.tripId, this.selected()) })
        }
        .width('100%')
        .justifyContent(FlexAlign.End)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
