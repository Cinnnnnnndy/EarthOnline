import { Avatar } from '../model/Spec';
import { AVATAR_PRESETS, AvatarPreset, applyPreset } from '../model/AvatarPresets';
import { AppModel } from '../model/AppModel';
import { TripStore } from '../model/TripStore';
import { SafeArea } from '../layout/LayoutState';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { Field, ListSection, PageHeader, Segmented } from '../components/Controls';
import { iconRes } from '../components/Icons';
import { AVATAR_FORMS, SUITCASE_STYLES, FONT_SUB, SPACE_L, TOUCH, SKIN_COLORS, HAIR_COLORS, DRESS_COLORS, HAT_COLORS, SHOES_COLORS } from '../gen/Shared';

/** 小人的色板：导出的 shared/world/hero.ts 那几组（gen/Shared.ets；存的是下标） */
const SKIN: string[] = SKIN_COLORS;
const HAIR: string[] = HAIR_COLORS;
const DRESS: string[] = DRESS_COLORS;
const HAT: string[] = HAT_COLORS;
const SHOES: string[] = SHOES_COLORS;

/** 捏人（网页 avatar-sheet.ts / iOS AvatarView 同一套）：名字、默认形象（D101）、形态（AVATAR_FORMS）、发型、帽子、五排色块、眼镜、箱子的样式。
 *  改一样就存，并发 set-avatar（世界里的小人实时变；形态由嵌入页按 form 建角色，原生不画）。 */
@Component
export struct AvatarPage {
  @StorageLink('eo.avatar') avatar: Avatar = { skin: 0, hair: 'short', hairColor: 0, dress: 0, hat: 'cap', hatColor: 0, shoes: 0, name: '' };
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();

  private app: AppModel = AppModel.shared;

  /** 改一份副本再存（写时复制，AppStorage 才看得见） */
  private apply(body: (a: Avatar) => void): void {
    const a = JSON.parse(JSON.stringify(this.avatar)) as Avatar;
    body(a);
    TripStore.shared.setAvatar(a);   // onLookChange → set-avatar
  }

  private form(): string { return this.avatar.form !== undefined ? this.avatar.form : 'human'; }
  private suitcase(): string { return this.avatar.suitcase !== undefined ? this.avatar.suitcase : 'sand'; }

  build() {
    Column() {
      PageHeader({ title: I18n.t('avatar.title'), topInset: this.safe.top, back: () => this.app.popPage() })
      Scroll() {
        Column({ space: SPACE_L }) {
          ListSection({ header: I18n.t('avatar.name') }) {
            Field({
              placeholder: I18n.t('avatar.defaultName'), text: this.avatar.name,
              onChange: (v: string) => this.apply((a: Avatar) => { a.name = v.substring(0, 12); })
            })
              .margin({ top: 8, bottom: 8 })
          }
          // 默认形象（D101）：点一下整套换上，下面的选项还能再细调
          ListSection({ header: I18n.t('avatar.presets') }) {
            Row({ space: 6 }) {
              ForEach(AVATAR_PRESETS, (p: AvatarPreset) => {
                Column({ space: 4 }) {
                  Image(iconRes(p.icon)).width(22).height(22).fillColor(Theme.p().ink)
                  Text(p.avatar.name).fontSize(FONT_SUB).maxLines(1).fontColor(Theme.p().ink)
                }
                .layoutWeight(1)
                .height(TOUCH + 20)
                .justifyContent(FlexAlign.Center)
                .borderRadius(12)
                .backgroundColor(Theme.p().fill)
                .accessibilityText(p.avatar.name)
                .onClick(() => TripStore.shared.setAvatar(applyPreset(this.avatar, p)))
              }, (p: AvatarPreset) => p.id)
            }
            .width('100%')
            .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('avatar.form') }) {
            Grid() {
              ForEach(AVATAR_FORMS, (f: string) => {
                GridItem() {
                  Column({ space: 4 }) {
                    Image(iconRes(f === 'human' ? 'person' : 'sparkle')).width(22).height(22)
                      .fillColor(f === this.form() ? Theme.onInk() : Theme.p().ink)
                    Text(I18n.t('avatar.form.' + f)).fontSize(FONT_SUB).maxLines(1)
                      .fontColor(f === this.form() ? Theme.onInk() : Theme.p().ink)
                  }
                  .width('100%')
                  .height(TOUCH + 20)
                  .justifyContent(FlexAlign.Center)
                  .borderRadius(12)
                  .backgroundColor(f === this.form() ? Theme.p().ink : Theme.p().fill)
                  .accessibilityText(I18n.t('avatar.form.' + f))
                  .onClick(() => this.apply((a: Avatar) => { a.form = f; }))
                }
              }, (f: string) => f + ':' + (f === this.form() ? 1 : 0))
            }
            .columnsTemplate('1fr 1fr 1fr 1fr')
            .columnsGap(6)
            .rowsGap(6)
            .height(Math.ceil(AVATAR_FORMS.length / 4) * (TOUCH + 26))
            .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('avatar.hair') }) {
            Segmented({
              options: ['bun', 'long', 'short'],
              labels: [I18n.t('avatar.hairBun'), I18n.t('avatar.hairLong'), I18n.t('avatar.hairShort')],
              selected: this.avatar.hair,
              onPick: (v: string) => this.apply((a: Avatar) => { a.hair = v; })
            })
              .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('avatar.hat') }) {
            Segmented({
              options: ['straw', 'cap', 'none'],
              labels: [I18n.t('avatar.hatStraw'), I18n.t('avatar.hatCap'), I18n.t('avatar.hatNone')],
              selected: this.avatar.hat,
              onPick: (v: string) => this.apply((a: Avatar) => { a.hat = v; })
            })
              .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('avatar.skin') }) { this.Swatches(SKIN, 'skin', I18n.t('avatar.skin')) }
          ListSection({ header: I18n.t('avatar.hairColor') }) { this.Swatches(HAIR, 'hairColor', I18n.t('avatar.hairColor')) }
          ListSection({ header: I18n.t('avatar.dress') }) { this.Swatches(DRESS, 'dress', I18n.t('avatar.dress')) }
          ListSection({ header: I18n.t('avatar.hatColor') }) { this.Swatches(HAT, 'hatColor', I18n.t('avatar.hatColor')) }
          ListSection({ header: I18n.t('avatar.shoes') }) { this.Swatches(SHOES, 'shoes', I18n.t('avatar.shoes')) }
          ListSection({ header: I18n.t('avatar.glasses') }) {
            Segmented({
              options: ['off', 'on'],
              labels: [I18n.t('avatar.hatNone'), I18n.t('avatar.glassesOn')],
              selected: this.avatar.glasses === true ? 'on' : 'off',
              onPick: (v: string) => this.apply((a: Avatar) => { a.glasses = v === 'on' ? true : undefined; })
            })
              .margin({ top: 8, bottom: 8 })
          }
          ListSection({ header: I18n.t('case.styleLabel') }) {
            Segmented({
              options: SUITCASE_STYLES,
              labels: SUITCASE_STYLES.map((s: string) => I18n.t('case.style.' + s)),
              selected: this.suitcase(),
              onPick: (v: string) => this.apply((a: Avatar) => { a.suitcase = v; })
            })
              .margin({ top: 8, bottom: 8 })
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

  private current(key: string): number {
    if (key === 'skin') return this.avatar.skin;
    if (key === 'hairColor') return this.avatar.hairColor;
    if (key === 'dress') return this.avatar.dress;
    if (key === 'hatColor') return this.avatar.hatColor;
    return this.avatar.shoes;
  }

  private setIndex(key: string, i: number): void {
    this.apply((a: Avatar) => {
      if (key === 'skin') a.skin = i;
      else if (key === 'hairColor') a.hairColor = i;
      else if (key === 'dress') a.dress = i;
      else if (key === 'hatColor') a.hatColor = i;
      else a.shoes = i;
    });
  }

  /** 一排色块：选中的外面一圈墨色 */
  @Builder
  Swatches(colors: string[], key: string, part: string) {
    Row({ space: 10 }) {
      ForEach(colors, (c: string, i: number) => {
        Column()
          .width(32).height(32)
          .borderRadius(16)
          .backgroundColor(c)
          .border({ width: i === this.current(key) ? 3 : 0.5, color: i === this.current(key) ? Theme.p().ink : Theme.p().line })
          .accessibilityText(I18n.t('avatar.swatch', { 'part': part, 'n': i + 1 }))
          .onClick(() => this.setIndex(key, i))
      }, (c: string, i: number) => key + i + ':' + (i === this.current(key) ? 1 : 0))
    }
    .width('100%')
    .height(TOUCH + 8)
  }
}
