import { abilityAccessCtrl } from '@kit.AbilityKit';
import { geoLocationManager } from '@kit.LocationKit';
import { Footprint, FootprintsResult, HomePlace, ManualFlag, Place, Trip } from '../model/Spec';
import { AppModel } from '../model/AppModel';
import { TripStore } from '../model/TripStore';
import { SafeArea } from '../layout/LayoutState';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { CoreApi } from '../world/CoreApi';
import { Field, IconButton, ListSection, NavRow, PageHeader } from '../components/Controls';
import { iconRes } from '../components/Icons';
import { AppContext } from '../util/Files';
import { FONT_BODY, FONT_SUB, SPACE_L, TOUCH } from '../gen/Shared';

/** 足迹与家（iOS FootprintsView 同一套）：去过几个地方、离家最远（core('footprints')）；放家（搜城市 / 当前位置 / 在地球上点）；
 *  去过的地方列表（手动补的可以拔掉）；补一面旗（搜地点 / 在地球上点）。 */
@Component
export struct FootprintsPage {
  @StorageLink('eo.trips') @Watch('refresh') trips: Trip[] = [];
  @StorageLink('eo.pins') @Watch('refresh') pins: ManualFlag[] = [];
  @StorageLink('eo.home') @Watch('refresh') home: HomePlace[] = [];
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();
  @StorageLink('eo.today') today: string = '';
  @State fps: Footprint[] = [];
  @State places: number = 0;
  @State farthest: string = '';
  @State farthestKm: number = 0;
  @State homeQuery: string = '';
  @State homeHits: Place[] = [];
  @State pinQuery: string = '';
  @State pinHits: Place[] = [];
  @State locating: boolean = false;
  @State rev: number = 0;

  private app: AppModel = AppModel.shared;
  private store: TripStore = TripStore.shared;
  private seq: number = 0;

  aboutToAppear(): void { this.refresh(); }

  refresh(): void {
    const seq = ++this.seq;
    CoreApi.footprints(this.trips, this.pins, this.today, this.home.length > 0 ? this.home[0] : undefined).then((r: FootprintsResult) => {
      if (seq !== this.seq) return;
      this.fps = r.flags;
      this.places = r.stats.places;
      this.farthest = r.stats.farthest ?? '';
      this.farthestKm = r.stats.farthestKm;
      this.rev++;
    }).catch(() => { /* 世界层没好 */ });
  }

  private search(q: string, forHome: boolean): void {
    if (forHome) this.homeQuery = q; else this.pinQuery = q;
    if (q.trim() === '') { if (forHome) this.homeHits = []; else this.pinHits = []; return; }
    CoreApi.searchPlaces(q.trim(), 6).then((r: Place[]) => {
      if (forHome) this.homeHits = r; else this.pinHits = r;
    }).catch(() => { /* 先不显示 */ });
  }

  private setHome(p: Place): void {
    const h: HomePlace = { name: p.name, lat: p.lat, lng: p.lng };
    this.store.setHome(h);
    this.homeQuery = ''; this.homeHits = [];
    this.app.toast(I18n.t1('fp.homeSet', 'name', p.name));
  }

  private addPin(p: Place): void {
    this.store.addPin(p.name, p.lat, p.lng);
    this.pinQuery = ''; this.pinHits = [];
    this.app.toast(I18n.t1('fp.added', 'name', p.name));
  }

  /** 当前位置（模糊位置就够：只是把家放进那座城） */
  private async useLocation(): Promise<void> {
    const ctx = AppContext.ability;
    if (ctx === null || this.locating) return;
    this.locating = true;
    try {
      const res = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(ctx, ['ohos.permission.APPROXIMATELY_LOCATION']);
      if (res.authResults.length === 0 || res.authResults[0] !== 0) throw new Error('denied');
      const req: geoLocationManager.CurrentLocationRequest = { priority: geoLocationManager.LocationRequestPriority.FIRST_FIX, timeoutMs: 8000 };
      const loc = await geoLocationManager.getCurrentLocation(req);
      let name = I18n.t('fp.myHome');
      try { const near = await CoreApi.nearest(loc.latitude, loc.longitude); if (near !== null) name = near.name; } catch (e2) { /* 用「我的家」 */ }
      const h: HomePlace = { name: name, lat: loc.latitude, lng: loc.longitude };
      this.store.setHome(h);
      this.app.toast(I18n.t1('fp.homeSet', 'name', name));
    } catch (e) {
      this.app.toast(I18n.t('fp.geoFailed'));
    }
    this.locating = false;
  }

  private meta(f: Footprint): string {
    const parts: string[] = [];
    if (f.date !== '') parts.push(I18n.fullDate(f.date));
    if (f.source === 'manual') parts.push(I18n.t('fp.manual'));
    else if (f.trips.length > 0) {
      const t = this.trips.find((x: Trip) => x.id === f.trips[0]);
      if (t !== undefined) parts.push(I18n.plain(t.title));
    }
    return I18n.list(parts);
  }

  build() {
    Column() {
      PageHeader({ title: I18n.t('home.footprints'), topInset: this.safe.top, back: () => this.app.popPage() })
      Scroll() {
        Column({ space: SPACE_L }) {
          // 统计：数值 17 粗、说明 13
          Row({ space: SPACE_L }) {
            Column({ space: 2 }) {
              Text(String(this.places)).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
              Text(I18n.t('fp.statPlaces')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            Column({ space: 2 }) {
              Text(this.home.length > 0 && this.farthest !== '' ? I18n.km(this.farthestKm) : '—')
                .fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
              Text(this.farthest !== '' ? I18n.t1('fp.farthest', 'name', this.farthest) : I18n.t('fp.farthestLabel'))
                .fontSize(FONT_SUB).fontColor(Theme.p().mist).maxLines(1)
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
          }
          .width('100%')
          .padding({ left: 4, right: 4, top: 8 })
          ListSection({ header: I18n.t('fp.home') }) {
            if (this.home.length > 0) {
              Row({ space: 12 }) {
                Image(iconRes('home')).width(20).height(20).fillColor(Theme.p().mist)
                Column({ space: 2 }) {
                  Text(this.home[0].name).fontSize(FONT_BODY).fontColor(Theme.p().ink)
                  Text(I18n.latLng(this.home[0].lat, this.home[0].lng)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
                IconButton({ icon: 'close', label: I18n.t('common.clear'), plain: true, action: () => this.store.setHome(undefined) })
              }
              .width('100%')
              .constraintSize({ minHeight: TOUCH })
            } else {
              Text(I18n.t('fp.noHome')).fontSize(FONT_SUB).fontColor(Theme.p().mist).height(TOUCH)
            }
            Field({ placeholder: I18n.t('fp.searchCity'), text: this.homeQuery, icon: 'search', onChange: (v: string) => this.search(v, true) })
              .margin({ top: 4, bottom: 4 })
            ForEach(this.homeHits, (p: Place) => {
              NavRow({ icon: 'pin', title: p.name, chevron: false, action: () => this.setHome(p) })
            }, (p: Place) => 'h' + p.name + p.lat)
            NavRow({ icon: 'navigate', title: I18n.t('fp.useLocation'), trailing: this.locating ? '…' : '', chevron: false, action: () => { this.useLocation(); } })
            NavRow({ icon: 'globe', title: I18n.t('fp.pickOnGlobe'), chevron: false, action: () => this.app.startPick('home') })
          }
          ListSection({ header: I18n.t('fp.visited') }) {
            if (this.fps.length === 0) {
              Text(I18n.t('fp.noneVisited')).fontSize(FONT_SUB).fontColor(Theme.p().mist).height(TOUCH)
            }
            ForEach(this.fps, (f: Footprint) => {
              Row({ space: 12 }) {
                Image(iconRes('flag')).width(20).height(20).fillColor(Theme.p().dawn)
                Column({ space: 2 }) {
                  Text(f.name).fontSize(FONT_BODY).fontColor(Theme.p().ink).maxLines(1)
                  Text(this.meta(f)).fontSize(FONT_SUB).fontColor(Theme.p().mist).maxLines(1)
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
                if (f.source === 'manual') {
                  IconButton({ icon: 'trash', label: I18n.t('fp.removeFlag'), plain: true, action: () => this.store.removePin(f.id) })
                }
              }
              .width('100%')
              .constraintSize({ minHeight: TOUCH })
            }, (f: Footprint) => f.id + '#' + this.rev)
          }
          ListSection({ header: I18n.t('fp.addPlace') }) {
            Field({ placeholder: I18n.t('fp.searchPlace'), text: this.pinQuery, icon: 'search', onChange: (v: string) => this.search(v, false) })
              .margin({ top: 8, bottom: 4 })
            ForEach(this.pinHits, (p: Place) => {
              NavRow({ icon: 'flag', title: p.name, chevron: false, action: () => this.addPin(p) })
            }, (p: Place) => 'p' + p.name + p.lat)
            NavRow({ icon: 'globe', title: I18n.t('fp.pickOnGlobe'), chevron: false, action: () => this.app.startPick('pin') })
          }
        }
        .width('100%')
        .padding({ left: SPACE_L, right: SPACE_L, bottom: this.safe.bottom + SPACE_L })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .align(Alignment.Top)
    }
    .width('100%')
    .height('100%')
  }
}
