import { LayoutInfo, SafeArea, isCompact } from '../layout/LayoutState';
import { AppModel, PageRoute, SheetRoute } from '../model/AppModel';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { GlassButton } from '../components/Controls';
import { iconRes } from '../components/Icons';
import { StopDetailSheet, TodoSheet, NotesSheet, NavSheet } from './StopDetailSheet';
import { NewTripSheet } from './NewTripSheet';
import { PaywallSheet } from './PaywallSheet';
import { SettingsPage } from './SettingsPage';
import { AvatarPage } from './AvatarPage';
import { FootprintsPage } from './FootprintsPage';
import { ShelfPage } from './ShelfPage';
import { DiaryPage } from './DiaryPage';
import { FONT_BODY, FONT_SUB, RADIUS_SHEET, SPACE_L, SPACE_M, SPACE_S } from '../gen/Shared';

/** 浮层的宿主：一摞浮层里最上面那个。按布局态摆（D90）：
 *   phone / outer：底部面板（贴内容高度，最高 88%；新建旅程固定高），后面一层遮罩，点遮罩关；
 *   spread：浮在右页（世界那页）的底部，不盖左页的内容；
 *   triple：停靠在右页，整列高，不盖住世界（三折叠的第三页就是给它的）；
 *   hover：落在下半屏（盖在卡上）。 */
@Component
export struct SheetHost {
  @StorageLink('eo.sheets') sheets: SheetRoute[] = [];
  @StorageLink('eo.layout') layout: LayoutInfo = new LayoutInfo();
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();
  @State contentH: number = 0;

  private app: AppModel = AppModel.shared;

  /** 最上面那个（空的时候给一个空路由：父组件移除本组件之前，自己的订阅可能先收到变化） */
  private top(): SheetRoute { return this.sheets.length > 0 ? this.sheets[this.sheets.length - 1] : new SheetRoute(); }
  private fill(): boolean { return this.top().kind === 'newTrip'; }
  private state(): string { return this.layout.result.state; }
  private compact(): boolean { return isCompact(this.layout.result.state); }

  /** 面板的矩形 */
  private x(): number {
    const r = this.layout.result;
    if (r.state === 'triple' && r.panes.length > 2) return r.panes[2].x + SPACE_S;
    if (r.state === 'spread' && r.panes.length > 1) return r.panes[1].x + Math.max(SPACE_S, (r.panes[1].w - this.w()) / 2);
    return Math.max(0, (this.layout.width - this.w()) / 2);
  }
  private w(): number {
    const r = this.layout.result;
    if (r.state === 'triple' && r.panes.length > 2) return Math.max(280, r.panes[2].w - SPACE_S * 2 - this.safe.right);
    if (r.state === 'spread' && r.panes.length > 1) return Math.min(480, r.panes[1].w - SPACE_L * 2);
    if (r.state === 'hover') return Math.min(560, this.layout.width - SPACE_L * 2);
    return Math.min(600, this.layout.width - SPACE_S * 2);
  }
  /** 面板最高多高（含内边距） */
  private maxH(): number {
    const r = this.layout.result;
    const top = this.safe.top + SPACE_S, bottom = this.safe.bottom + SPACE_S;
    if (r.state === 'triple') return this.layout.height - top - bottom;
    if (r.state === 'hover' && r.panes.length > 1) return r.panes[1].w - bottom - SPACE_S;
    return Math.round((this.layout.height - top - bottom) * (this.compact() ? 0.88 : 0.8));
  }
  private h(): number {
    if (this.fill() || this.state() === 'triple') return this.maxH();
    return Math.min(this.maxH(), this.contentH + 24 + 20);
  }
  private y(): number {
    const r = this.layout.result;
    if (r.state === 'triple') return this.safe.top + SPACE_S;
    return this.layout.height - this.safe.bottom - SPACE_S - this.h();
  }

  build() {
    Stack() {
      if (this.compact()) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor(Theme.scrim())
          .onClick(() => this.app.popSheet())
      }
      Column() {
        if (this.fill()) {
          this.Body()
        } else {
          Scroll() {
            Column() {
              this.Body()
            }
            .width('100%')
            .onAreaChange((_o: Area, n: Area) => { this.contentH = n.height as number; })
          }
          .width('100%')
          .layoutWeight(1)
          .scrollBar(BarState.Off)
          .align(Alignment.Top)
        }
      }
      .width(this.w())
      .height(this.h())
      .padding({ left: 20, right: 20, top: 24, bottom: 20 })
      .borderRadius(RADIUS_SHEET)
      .backgroundColor(Theme.p().sheet)
      .backdropBlur(22)
      .border({ width: 0.5, color: Theme.p().glassRim })
      .shadow({ radius: 30, color: Theme.shadow(), offsetX: 0, offsetY: 10 })
      .position({ x: this.x(), y: this.y() })
      .animation({ duration: 220, curve: Curve.EaseOut })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(this.compact() ? HitTestMode.Default : HitTestMode.Transparent)
  }

  @Builder
  Body() {
    if (this.top().kind === 'stop') {
      StopDetailSheet({ route: this.top() })
    } else if (this.top().kind === 'todos') {
      TodoSheet({ route: this.top() })
    } else if (this.top().kind === 'notes') {
      NotesSheet({ route: this.top() })
    } else if (this.top().kind === 'nav') {
      NavSheet({ route: this.top() })
    } else if (this.top().kind === 'paywall') {
      PaywallSheet({ route: this.top() })
    } else if (this.top().kind === 'newTrip') {
      NewTripSheet({ route: this.top() })
    }
  }
}

/** 整页的宿主：一页（手机、外屏、悬停）铺满；两页 / 三页时停在左页，世界仍露在右边 */
@Component
export struct PagesHost {
  @StorageLink('eo.pages') pages: PageRoute[] = [];
  @StorageLink('eo.layout') layout: LayoutInfo = new LayoutInfo();

  private top(): PageRoute { return this.pages.length > 0 ? this.pages[this.pages.length - 1] : new PageRoute(); }
  private docked(): boolean { return this.layout.result.state === 'spread' || this.layout.result.state === 'triple'; }
  private w(): number {
    if (!this.docked() || this.layout.result.panes.length < 2) return this.layout.width;
    return Math.max(360, this.layout.result.panes[0].w + this.layout.result.gap / 2);
  }

  build() {
    Column() {
      if (this.top().name === 'settings') {
        SettingsPage()
      } else if (this.top().name === 'avatar') {
        AvatarPage()
      } else if (this.top().name === 'footprints') {
        FootprintsPage()
      } else if (this.top().name === 'shelf') {
        ShelfPage()
      } else if (this.top().name === 'diary') {
        DiaryPage({ tripId: this.top().tripId })
      }
    }
    .width(this.w())
    .height('100%')
    .backgroundColor(Theme.p().paper)
    .shadow({ radius: this.docked() ? 24 : 0, color: Theme.shadow(), offsetX: 0, offsetY: 0 })
    .position({ x: 0, y: 0 })
  }
}

/** 在地球上点选时顶部的提示条 */
@Component
export struct PickBar {
  @StorageLink('eo.picking') picking: string = '';
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();

  build() {
    Row({ space: 12 }) {
      Image(iconRes('pin')).width(18).height(18).fillColor(Theme.p().ink)
      Text(I18n.t(this.picking === 'home' ? 'fp.pickHome' : 'fp.pickVisited')).fontSize(FONT_BODY).fontColor(Theme.p().ink).layoutWeight(1)
      GlassButton({ title: I18n.t('common.cancel'), action: () => AppModel.shared.cancelPick() })
    }
    .width('92%')
    .constraintSize({ maxWidth: 480 })
    .padding({ left: 18, right: 6, top: 6, bottom: 6 })
    .borderRadius(28)
    .backgroundColor(Theme.p().glassFillStrong)
    .backdropBlur(22)
    .border({ width: 0.5, color: Theme.p().glassRim })
    .position({ x: '4%', y: this.safe.top + SPACE_S })
  }
}

/** 顶部提示（toast） */
@Component
export struct ToastBar {
  @StorageLink('eo.toast') text: string = '';
  @StorageLink('eo.safe') safe: SafeArea = new SafeArea();

  build() {
    Row() {
      Text(this.text).fontSize(FONT_SUB).fontColor(Theme.p().ink).textAlign(TextAlign.Center)
        .padding({ left: 18, right: 18, top: 12, bottom: 12 })
        .borderRadius(22)
        .backgroundColor(Theme.p().glassFillStrong)
        .backdropBlur(22)
        .border({ width: 0.5, color: Theme.p().glassRim })
        .constraintSize({ maxWidth: '90%' })
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
    .position({ x: 0, y: this.safe.top + SPACE_M })
    .hitTestBehavior(HitTestMode.None)
  }
}
