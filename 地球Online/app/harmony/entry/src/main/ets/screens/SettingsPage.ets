import { promptAction } from '@kit.ArkUI';
import { Avatar, HomePlace, Quota, SampleInfo, Settings, Trip } from '../model/Spec';
import { AppModel } from '../model/AppModel';
import { TripStore } from '../model/TripStore';
import { SafeArea } from '../layout/LayoutState';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { CoreApi } from '../world/CoreApi';
import { GlassButton, ListSection, NavRow, PageHeader, Segmented } from '../components/Controls';
import { AppContext, Files, Share } from '../util/Files';
import { FONT_BODY, FONT_SUB, SPACE_L, TOUCH } from '../gen/Shared';

/** 设置（iOS SettingsView 同一套分组）：地球外的天色、浮岛的色调、画质、语言；小人 / 足迹与家 / 全部旅程；示例行程；Pro；数据。 */
@Component
export struct SettingsPage {
  @StorageLink('eo.settings') settings: Settings = { palette: 'sea', post: 'high', theme: 'auto', lang: 'auto' };
  @StorageLink('eo.trips') @Watch('refreshQuota') trips: Trip[] = [];
  @StorageLink('eo.avatar') avatar: Avatar = { skin: 0, hair: 'short', hairColor: 0, dress: 0, hat: 'cap', hatColor: 0, shoes: 0, name: '' };
  @StorageLink('eo.home') home: HomePlace[] = [];
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();
  @StorageLink('eo.today') today: string = '';
  @State samples: SampleInfo[] = [];
  @State quota: string = '';

  private app: AppModel = AppModel.shared;

  aboutToAppear(): void {
    this.samples = TripStore.samples();
    this.refreshQuota();
  }

  refreshQuota(): void {
    CoreApi.quota('free', this.trips, this.today).then((q: Quota) => {
      this.quota = I18n.t('settings.proTrips', { 'used': q.used, 'limit': q.limit !== null ? q.limit : '∞' });   // Pro 不限名额时 limit 是 null
    }).catch(() => { this.quota = ''; });
  }

  private set(palette: string, post: string, theme: string, lang: string): void {
    this.app.updateSettings(palette, post, theme, lang);
  }

  private lang(): string { return this.settings.lang !== undefined ? this.settings.lang : 'auto'; }

  private skyNote(): string {
    if (this.settings.theme === 'light') return I18n.t('settings.skyLight');
    if (this.settings.theme === 'dark') return I18n.t('settings.skyDark');
    return I18n.t1('settings.skyAuto', 'phase', I18n.t(Theme.dark ? 'phase.night' : 'phase.day'));
  }

  private postNote(): string {
    if (this.settings.post === 'low') return I18n.t('settings.qLowNote');
    if (this.settings.post === 'medium') return I18n.t('settings.qMediumNote');
    return I18n.t('settings.qHighNote');
  }

  private hasSample(s: SampleInfo): boolean { return this.trips.some((t: Trip) => t.id === s.id); }

  private addSample(s: SampleInfo): void {
    if (this.hasSample(s)) return;
    TripStore.loadSample(s).then((t: Trip) => {
      TripStore.shared.insert(t);
      this.app.toast(I18n.t('settings.sampleAdded'));
    }).catch(() => { this.app.toast(I18n.t('common.importInvalid')); });
  }

  private addAll(): void { for (const s of this.samples) this.addSample(s); }

  private exportAll(): void {
    const ctx = AppContext.ability;
    if (ctx === null) return;
    try {
      const path = Files.exportDir() + '/' + Files.safeName(I18n.t('settings.exportFile'));
      Files.writeTextAtomic(path, JSON.stringify(this.trips));
      Share.file(ctx, path, false).catch(() => { /* 取消分享 */ });
    } catch (e) {
      this.app.toast(I18n.t1('epi.exportFailed', 'reason', (e as Error).message));
    }
  }

  private confirmReset(): void {
    const buttons: promptAction.Button[] = [
      { text: I18n.t('common.cancel'), color: Theme.p().ink },
      { text: I18n.t('settings.reset'), color: Theme.p().danger }
    ];
    this.getUIContext().getPromptAction().showDialog({ title: I18n.t('settings.reset'), message: I18n.t('settings.resetConfirm'), buttons: buttons })
      .then(async (r: promptAction.ShowDialogSuccessResponse) => {
        if (r.index !== 1) return;
        const out: Trip[] = [];
        for (const s of this.samples) {
          try { out.push(await TripStore.loadSample(s)); } catch (e) { /* 跳过 */ }
        }
        TripStore.shared.replaceAll(out);
        this.app.goHome();
        this.app.toast(I18n.t('settings.resetDone'));
      }).catch(() => { /* 取消 */ });
  }

  build() {
    Column() {
      PageHeader({ title: I18n.t('common.settings'), topInset: this.safe.top, back: () => this.app.popPage() })
      Scroll() {
        Column({ space: SPACE_L }) {
          ListSection({ header: I18n.t('settings.sky'), footer: this.skyNote() }) {
            Segmented({
              options: ['auto', 'light', 'dark'],
              labels: [I18n.t('settings.auto'), I18n.t('settings.day'), I18n.t('settings.night')],
              selected: this.settings.theme,
              onPick: (v: string) => this.set(this.settings.palette, this.settings.post, v, this.lang())
            })
              .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('settings.palette') }) {
            Segmented({
              options: ['sea', 'warm', 'dusk'],
              labels: [I18n.t('settings.palSea'), I18n.t('settings.palWarm'), I18n.t('settings.palDusk')],
              selected: this.settings.palette,
              onPick: (v: string) => this.set(v, this.settings.post, this.settings.theme, this.lang())
            })
              .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('settings.quality'), footer: this.postNote() }) {
            Segmented({
              options: ['high', 'medium', 'low'],
              labels: [I18n.t('post.high'), I18n.t('post.medium'), I18n.t('settings.qLow')],
              selected: this.settings.post,
              onPick: (v: string) => this.set(this.settings.palette, v, this.settings.theme, this.lang())
            })
              .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('settings.language'), footer: I18n.t('settings.langNote') }) {
            Segmented({
              options: ['auto', 'zh-Hans', 'en', 'ja'],
              labels: [I18n.t('settings.auto'), I18n.t('lang.zh-Hans'), I18n.t('lang.en'), I18n.t('lang.ja')],
              selected: this.lang(),
              onPick: (v: string) => this.set(this.settings.palette, this.settings.post, this.settings.theme, v)
            })
              .margin({ top: 8, bottom: 8 })
          }
          ListSection() {
            NavRow({ icon: 'person', title: I18n.t('settings.avatar'), trailing: this.avatar.name, action: () => this.app.show('avatar') })
            NavRow({
              icon: 'flag', title: I18n.t('home.footprints'),
              trailing: this.home.length > 0 ? this.home[0].name : I18n.t('settings.notSet'),
              action: () => this.app.show('footprints')
            })
            NavRow({ icon: 'books', title: I18n.t('home.allTrips'), trailing: String(this.trips.length), action: () => this.app.show('shelf') })
          }
          ListSection({ header: I18n.t('settings.samples'), footer: I18n.t('settings.samplesNote') }) {
            ForEach(this.samples, (s: SampleInfo) => {
              Row({ space: 12 }) {
                Column({ space: 2 }) {
                  Text(s.title).fontSize(FONT_BODY).fontColor(Theme.p().ink).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(I18n.t('sample.type.' + s.type)).fontSize(FONT_SUB).fontColor(Theme.p().mist)
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
                if (this.hasSample(s)) {
                  Text(I18n.t('settings.sampleAdded')).fontSize(FONT_SUB).fontColor(Theme.p().mist)
                } else {
                  GlassButton({ title: I18n.t('common.add'), icon: 'plus', action: () => this.addSample(s) })
                }
              }
              .width('100%')
              .constraintSize({ minHeight: TOUCH + 8 })
            }, (s: SampleInfo) => s.id + ':' + (this.hasSample(s) ? 1 : 0))
            if (this.samples.some((s: SampleInfo) => !this.hasSample(s))) {
              NavRow({ icon: 'plus', title: I18n.t('settings.sampleAddAll'), chevron: false, action: () => this.addAll() })
            }
          }
          ListSection({ header: I18n.t('settings.pro'), footer: this.quota }) {
            NavRow({ icon: 'sparkle', title: I18n.t('settings.pro'), trailing: I18n.t('settings.proLearn'), action: () => this.app.paywall('trips') })
          }
          ListSection({ footer: I18n.t('settings.localOnly') }) {
            NavRow({ icon: 'share', title: I18n.t('settings.exportAll'), trailing: 'JSON', action: () => this.exportAll() })
            NavRow({ icon: 'replay', title: I18n.t('settings.reset'), chevron: false, danger: true, action: () => this.confirmReset() })
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
