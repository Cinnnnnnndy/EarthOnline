import { Trip } from '../model/Spec';
import { AppModel, JourneyView } from '../model/AppModel';
import { I18n } from '../i18n/I18n';
import { StageScaffold } from '../components/StageScaffold';
import { GlassIconButton } from '../components/Controls';
import { Ticket } from '../components/Ticket';
import { DreamyCapsule } from '../components/DreamyCapsule';
import { SPACE_L } from '../gen/Shared';

/** 首页：按用户旅程的哪一步决定地球上浮什么（core('journey')，与网页、iOS 同一套判断）。
 *   旅行中：一张票（D8 / 今天的标题），撕票根进入今天；新建旅程缩成右上的一颗加号
 *   快出发：梦幻的新建胶囊 + 一张票（后天出发 / D1），撕票根查看
 *   刚回来：新建胶囊 + 一张票（欢迎回家），撕票根写日记
 *   平常日子：地球回到家；有将来的书时胶囊上方一张小票（n 天后出发）
 *  右上一排玻璃图标：（旅行中的加号）、全部旅程、导入、足迹与家、设置。 */
@Component
export struct HomeOverlay {
  @StorageLink('eo.trips') trips: Trip[] = [];
  @StorageLink('eo.journey') journey: JourneyView = new JourneyView();

  private app: AppModel = AppModel.shared;

  private tripOf(id: string): Trip | undefined { return this.trips.find((t: Trip) => t.id === id); }

  private focusTrip(): Trip | undefined {
    return this.journey.kind === 'traveling' || this.journey.kind === 'departing' || this.journey.kind === 'back'
      ? this.tripOf(this.journey.tripId) : undefined;
  }

  private nextTrip(): Trip | undefined {
    return this.journey.kind === 'idle' && this.journey.nextTripId !== '' ? this.tripOf(this.journey.nextTripId) : undefined;
  }

  /** 票面上的一行：旅行中「D8 · 今天的标题」，要出发「D1 · 第一天」，刚回来用默认的书名与日期 */
  private lines(t: Trip): string[] {
    if (this.journey.kind === 'traveling') {
      const i = this.journey.dayIndex;
      if (i < 0 || i >= t.days.length) return [];
      return [I18n.tn('home.travelingDay', t.days[i].index) + ' · ' + I18n.plain(t.days[i].title)];
    }
    if (this.journey.kind === 'departing' && t.days.length > 0) return [I18n.tn('home.travelingDay', t.days[0].index) + ' · ' + I18n.plain(t.days[0].title)];
    return [];
  }

  private status(): string {
    if (this.journey.kind === 'traveling') return I18n.tn('home.statusToday', this.journey.dayIndex + 1);
    if (this.journey.kind === 'departing') return I18n.departLabel(this.journey.inDays);
    if (this.journey.kind === 'back') return I18n.t('home.welcomeBack');
    return '';
  }

  private stubLabel(): string {
    if (this.journey.kind === 'departing') return I18n.t('home.view');
    if (this.journey.kind === 'back') return I18n.t('home.writeDiary');
    return '';
  }

  private primary(t: Trip): void {
    if (this.journey.kind === 'traveling') this.app.openDay(t.id, Math.min(this.journey.dayIndex, t.days.length - 1));
    else if (this.journey.kind === 'departing') this.app.openBook(t.id, -1);
    else this.app.openDiary(t.id);
  }

  build() {
    StageScaffold({
      drawer: false,
      trailing: (): void => { this.IconBar() },
      content: (): void => { this.Bottom() }
    })
  }

  @Builder
  IconBar() {
    Row({ space: 10 }) {
      if (this.journey.kind === 'traveling') {
        GlassIconButton({ icon: 'plus', label: I18n.t('home.newTrip'), action: () => this.app.newTrip('plan') })
      }
      GlassIconButton({ icon: 'books', label: I18n.t('home.allTrips'), action: () => this.app.show('shelf') })
      GlassIconButton({ icon: 'import', label: I18n.t('home.importTrip'), action: () => this.app.newTrip('import') })
      GlassIconButton({ icon: 'flag', label: I18n.t('home.footprints'), action: () => this.app.show('footprints') })
      GlassIconButton({ icon: 'settings', label: I18n.t('common.settings'), action: () => this.app.show('settings') })
    }
  }

  @Builder
  Bottom() {
    Column({ space: SPACE_L }) {
      if (this.nextTrip() !== undefined) {
        Ticket({
          trip: this.nextTrip()!,
          status: I18n.departLabel(this.journey.nextInDays),
          compact: true,
          stubEnabled: false,
          onFace: () => { const t = this.nextTrip(); if (t !== undefined) this.app.openBook(t.id, -1); }
        })
      }
      if (this.journey.kind !== 'traveling') {
        DreamyCapsule({ title: I18n.t('home.newTrip'), action: () => this.app.newTrip('plan') })
      }
      if (this.focusTrip() !== undefined) {
        Ticket({
          trip: this.focusTrip()!,
          status: this.status(),
          live: this.journey.kind === 'traveling',
          lines: this.lines(this.focusTrip()!),
          stubLabel: this.stubLabel(),
          onFace: () => { const t = this.focusTrip(); if (t !== undefined) this.app.openBook(t.id, -1); },
          onStub: () => { const t = this.focusTrip(); if (t !== undefined) this.primary(t); }
        })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }
}
