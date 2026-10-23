import { Theme } from '../theme/Theme';
import { iconRes } from './Icons';
import { FONT_BODY, FONT_SUB, RADIUS_L, RADIUS_M, SPACE_S, TOUCH } from '../gen/Shared';

/** 空的构建函数（@BuilderParam 的默认值） */
@Builder
export function emptyBuilder() {
}

/** 玻璃卡：半透明白 + 背景模糊 + 一道亮边（GLASS 令牌），圆角 22。宽度跟父容器走（父容器限最宽 420） */
@Component
export struct GlassCard {
  @Prop pad: number = 20;
  @Prop strong: boolean = false;
  @Prop radius: number = RADIUS_L;
  @BuilderParam content: () => void = emptyBuilder;

  build() {
    Column() {
      this.content()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(this.pad)
    .backgroundColor(this.strong ? Theme.p().glassFillStrong : Theme.p().glassFill)
    .backdropBlur(22)
    .borderRadius(this.radius)
    .border({ width: 0.5, color: Theme.p().glassRim })
    .shadow({ radius: 24, color: Theme.shadow(), offsetX: 0, offsetY: 10 })
  }
}

/** 图标按钮（编辑、删除、清除、重写这类通用操作）：32 的圆，点击区 44，带无障碍标签 */
@Component
export struct IconButton {
  @Prop icon: string = 'plus';
  @Prop label: string = '';
  @Prop plain: boolean = false;
  @Prop danger: boolean = false;
  @Prop enabled: boolean = true;
  /** 填了就用它当图标色（例如打过卡的晨色） */
  @Prop tint: string = '';
  action: () => void = () => {};

  private fg(): string {
    if (this.tint !== '') return this.tint;
    if (this.danger) return Theme.p().danger;
    return this.plain ? Theme.p().mist : Theme.p().ink;
  }

  build() {
    Stack() {
      Column()
        .width(32).height(32).borderRadius(16)
        .backgroundColor(this.plain ? 'rgba(0,0,0,0)' : (this.danger ? 'rgba(190,58,82,0.12)' : Theme.p().fill))
      Image(iconRes(this.icon)).width(18).height(18).fillColor(this.fg()).objectFit(ImageFit.Contain)
    }
    .width(TOUCH).height(TOUCH)
    .opacity(this.enabled ? 1 : 0.4)
    .accessibilityText(this.label)
    .onClick(() => { if (this.enabled) this.action(); })
  }
}

/** 浮在地球上的圆形玻璃图标按钮（44） */
@Component
export struct GlassIconButton {
  @Prop icon: string = 'plus';
  @Prop label: string = '';
  @Prop tint: string = '';
  action: () => void = () => {};

  build() {
    Image(iconRes(this.icon))
      .fillColor(this.tint !== '' ? this.tint : Theme.p().ink)
      .objectFit(ImageFit.Contain)
      .width(TOUCH).height(TOUCH)
      .padding(12)
      .borderRadius(TOUCH / 2)
      .backgroundColor(Theme.p().glassFill)
      .backdropBlur(22)
      .border({ width: 0.5, color: Theme.p().glassRim })
      .shadow({ radius: 16, color: Theme.shadow(), offsetX: 0, offsetY: 6 })
      .accessibilityText(this.label)
      .onClick(() => this.action())
  }
}

/** 标签：同一类信息用同一种小标签（状态、第几天、类型、到期日）。13 号、高 22 的胶囊；live（现在）用晨色 */
@Component
export struct Tag {
  @Prop text: string = '';
  @Prop live: boolean = false;
  @Prop icon: string = '';

  build() {
    Row({ space: 3 }) {
      if (this.icon !== '') {
        Image(iconRes(this.icon)).width(12).height(12).fillColor(this.live ? Theme.p().dawnInk : Theme.p().ink2)
      }
      Text(this.text)
        .fontSize(FONT_SUB)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.live ? Theme.p().dawnInk : Theme.p().ink2)
        .maxLines(1)
    }
    .padding({ left: 7, right: 7 })
    .constraintSize({ minHeight: 22 })
    .borderRadius(11)
    .backgroundColor(this.live ? Theme.p().dawnSoft : Theme.p().fill)
  }
}

/** 主按钮：墨色小胶囊（白天深底白字，夜里白底深字），高 36、随内容宽，一屏最多一个 */
@Component
export struct InkButton {
  @Prop title: string = '';
  @Prop enabled: boolean = true;
  @Prop icon: string = '';
  action: () => void = () => {};

  build() {
    Row({ space: 6 }) {
      if (this.icon !== '') {
        Image(iconRes(this.icon)).width(16).height(16).fillColor(Theme.onInk())
      }
      Text(this.title).fontSize(FONT_SUB).fontWeight(FontWeight.Medium).fontColor(Theme.onInk()).maxLines(1)
    }
    .padding({ left: 16, right: 16 })
    .height(36)
    .borderRadius(18)
    .backgroundColor(Theme.p().ink)
    .opacity(this.enabled ? 1 : 0.4)
    .onClick(() => { if (this.enabled) this.action(); })
  }
}

/** 次按钮：玻璃胶囊，墨色字 */
@Component
export struct GlassButton {
  @Prop title: string = '';
  @Prop icon: string = '';
  @Prop enabled: boolean = true;
  action: () => void = () => {};

  build() {
    Row({ space: 6 }) {
      if (this.icon !== '') {
        Image(iconRes(this.icon)).width(16).height(16).fillColor(Theme.p().ink)
      }
      Text(this.title).fontSize(FONT_SUB).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink).maxLines(1)
    }
    .padding({ left: 14, right: 14 })
    .height(36)
    .borderRadius(18)
    .backgroundColor(Theme.p().fill)
    .opacity(this.enabled ? 1 : 0.4)
    .onClick(() => { if (this.enabled) this.action(); })
  }
}

/** 分段控件（设置页、新建旅程）：未选是浅填充，选中是白块（夜里浅白） */
@Component
export struct Segmented {
  @Prop options: string[] = [];
  @Prop labels: string[] = [];
  @Prop selected: string = '';
  onPick: (v: string) => void = () => {};

  build() {
    Row({ space: 2 }) {
      ForEach(this.options, (v: string, i: number) => {
        Text(i < this.labels.length ? this.labels[i] : v)
          .fontSize(FONT_SUB)
          .fontWeight(v === this.selected ? FontWeight.Medium : FontWeight.Normal)
          .fontColor(Theme.p().ink)
          .textAlign(TextAlign.Center)
          .maxLines(1)
          .layoutWeight(1)
          .height(32)
          .borderRadius(9)
          .backgroundColor(v === this.selected ? Theme.p().segOn : 'rgba(0,0,0,0)')
          .shadow({ radius: v === this.selected ? 4 : 0, color: Theme.shadow(), offsetX: 0, offsetY: v === this.selected ? 1 : 0 })
          .accessibilityText(i < this.labels.length ? this.labels[i] : v)
          .onClick(() => this.onPick(v))
      }, (v: string, i: number) => v + '|' + (v === this.selected ? 1 : 0) + '|' + (i < this.labels.length ? this.labels[i] : ''))
    }
    .width('100%')
    .padding(2)
    .borderRadius(RADIUS_M - 3)
    .backgroundColor(Theme.p().fill)
  }
}

/** 列表页的一组（设置、足迹、日记）：小标题 + 圆角底的行 */
@Component
export struct ListSection {
  @Prop header: string = '';
  @Prop footer: string = '';
  @BuilderParam content: () => void = emptyBuilder;

  build() {
    Column({ space: 6 }) {
      if (this.header !== '') {
        Text(this.header).fontSize(FONT_SUB).fontColor(Theme.p().mist).padding({ left: 4 })
      }
      Column() {
        this.content()
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding({ left: 16, right: 12, top: 4, bottom: 4 })
      .borderRadius(RADIUS_M)
      .backgroundColor(Theme.p().listStrong)
      if (this.footer !== '') {
        Text(this.footer).fontSize(FONT_SUB).fontColor(Theme.p().mist).padding({ left: 4, right: 4 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/** 列表里的一行：图标、标题、右边的说明与箭头；整行可点、高 44 */
@Component
export struct NavRow {
  @Prop icon: string = '';
  @Prop title: string = '';
  @Prop trailing: string = '';
  @Prop chevron: boolean = true;
  @Prop danger: boolean = false;
  action: () => void = () => {};

  build() {
    Row({ space: 12 }) {
      if (this.icon !== '') {
        Image(iconRes(this.icon)).width(20).height(20).fillColor(this.danger ? Theme.p().danger : Theme.p().mist)
      }
      Text(this.title).fontSize(FONT_BODY).fontColor(this.danger ? Theme.p().danger : Theme.p().ink).maxLines(1).layoutWeight(1)
      if (this.trailing !== '') {
        Text(this.trailing).fontSize(FONT_BODY).fontColor(Theme.p().mist).maxLines(1)
      }
      if (this.chevron) {
        Image(iconRes('forward')).width(14).height(14).fillColor(Theme.p().mist2)
      }
    }
    .width('100%')
    .constraintSize({ minHeight: TOUCH })
    .onClick(() => this.action())
  }
}

/** 整页的页头：返回 + 标题（17 半粗） */
@Component
export struct PageHeader {
  @Prop title: string = '';
  @Prop topInset: number = 0;
  back: () => void = () => {};

  build() {
    Row({ space: SPACE_S }) {
      IconButton({ icon: 'back', label: this.title, plain: true, action: () => this.back() })
      Text(this.title).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink).maxLines(1).layoutWeight(1)
    }
    .width('100%')
    .padding({ top: this.topInset, left: 4, right: 16 })
    .height(this.topInset + TOUCH + 4)
  }
}

/** 文字输入框（玻璃底，高 44） */
@Component
export struct Field {
  @Prop placeholder: string = '';
  @Prop text: string = '';
  @Prop icon: string = '';
  onChange: (v: string) => void = () => {};
  onSubmit: () => void = () => {};

  build() {
    Row({ space: 8 }) {
      if (this.icon !== '') {
        Image(iconRes(this.icon)).width(18).height(18).fillColor(Theme.p().mist)
      }
      TextInput({ placeholder: this.placeholder, text: this.text })
        .fontSize(FONT_BODY)
        .fontColor(Theme.p().ink)
        .placeholderColor(Theme.p().mist2)
        .backgroundColor('rgba(0,0,0,0)')
        .padding(0)
        .layoutWeight(1)
        .onChange((v: string) => this.onChange(v))
        .onSubmit(() => this.onSubmit())
    }
    .width('100%')
    .height(TOUCH)
    .padding({ left: 12, right: 12 })
    .borderRadius(RADIUS_M - 2)
    .backgroundColor(Theme.p().field)
  }
}

/** 分隔线 */
@Component
export struct Divider1 {
  @Prop indent: number = 0;
  build() {
    Row().width('100%').height(0.5).backgroundColor(Theme.p().line).margin({ left: this.indent })
  }
}
