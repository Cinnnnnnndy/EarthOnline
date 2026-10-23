import { promptAction } from '@kit.ArkUI';
import { Trip, phaseOf, todayIndexOf } from '../model/Spec';
import { AppModel } from '../model/AppModel';
import { TripStore } from '../model/TripStore';
import { SafeArea } from '../layout/LayoutState';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { PageHeader, IconButton } from '../components/Controls';
import { Ticket } from '../components/Ticket';
import { FONT_SUB, SPACE_L, SPACE_M } from '../gen/Shared';

/** 全部旅程（只看列表）：每一趟旅程是一张小票（D74），按出发日从近到远；点票面翻开，长按删除。 */
@Component
export struct ShelfPage {
  @StorageLink('eo.trips') trips: Trip[] = [];
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();
  @StorageLink('eo.today') today: string = '';

  private app: AppModel = AppModel.shared;

  private sorted(): Trip[] {
    return this.trips.slice().sort((a: Trip, b: Trip) => a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0);
  }

  private confirmDelete(t: Trip): void {
    const buttons: promptAction.Button[] = [
      { text: I18n.t('common.cancel'), color: Theme.p().ink },
      { text: I18n.t('common.delete'), color: Theme.p().danger }
    ];
    this.getUIContext().getPromptAction().showDialog({ title: I18n.t1('shelf.deleteConfirm', 'title', I18n.plain(t.title)), buttons: buttons })
      .then((r: promptAction.ShowDialogSuccessResponse) => {
        if (r.index !== 1) return;
        TripStore.shared.delete(t.id);
        this.app.toast(I18n.t('shelf.deleted'));
      }).catch(() => { /* 取消 */ });
  }

  build() {
    Column() {
      Row() {
        Column() {
          PageHeader({ title: I18n.t('home.allTrips'), topInset: this.safe.top, back: () => this.app.popPage() })
        }
        .layoutWeight(1)
        Column() {
          IconButton({ icon: 'import', label: I18n.t('home.importTrip'), plain: true, action: () => { this.app.popPage(); this.app.newTrip('import'); } })
        }
        .padding({ top: this.safe.top, right: 8 })
      }
      .width('100%')
      List({ space: SPACE_M }) {
        ForEach(this.sorted(), (t: Trip) => {
          ListItem() {
            Ticket({
              trip: t,
              status: I18n.tripStatus(phaseOf(t, this.today), todayIndexOf(t, this.today), t.startDate),
              live: phaseOf(t, this.today) === 'traveling',
              compact: true,
              stubEnabled: false,
              onFace: () => this.app.openBook(t.id, -1)
            })
          }
          .gesture(LongPressGesture().onAction(() => this.confirmDelete(t)))
        }, (t: Trip) => t.id + ':' + t.updatedAt + ':' + this.today)
        ListItem() {
          Text(I18n.t('shelf.hint')).fontSize(FONT_SUB).fontColor(Theme.p().mist).padding({ top: 4 })
        }
      }
      .width('100%')
      .layoutWeight(1)
      .padding({ left: SPACE_L, right: SPACE_L, bottom: this.safe.bottom + SPACE_L })
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
  }
}
