import { Insets, LayoutInfo, SafeArea, isCompact, worldInsets } from '../layout/LayoutState';
import { AppModel } from '../model/AppModel';
import { Theme } from '../theme/Theme';
import { emptyBuilder } from './Controls';
import { RADIUS_L, SPACE_L, SPACE_M, SPACE_S, TOUCH } from '../gen/Shared';

/** 卡片最宽（与 iOS Metrics.cardMaxWidth 一致）；左页内容最宽 400 */
const CARD_MAX = 420;
const PANE_MAX = 400;
const HANDLE = 22;

/** 地球舞台的骨架：世界层铺满整屏（主画面），其余界面尽量少——左上一颗返回、右上一组图标、一张贴内容的卡。按布局态摆：
 *   phone / outer（一页）：卡是底部抽屉（半开 / 全开两档，拖抓手或点抓手切换）；outer（折叠外屏）半开高一点；
 *   spread（两页）：卡停靠在左页（≤ 400，避开书脊），地球居中在右页；
 *   triple（三页）：卡在左页，图标在中页右上，右页留给浮层（SheetHost 停靠在那里，不盖住世界）；
 *   hover（半开悬停）：上半屏地球，卡落在下半屏。
 *  卡挡住的区域按布局报给世界层（set-insets）：一页 = 卡顶以下；其余 = worldInsets（左页 / 左右两页 / 下半屏）。
 *  drawer = false 时（首页）卡不带玻璃与抓手，只是浮在底部的一组东西（票 + 胶囊）。 */
@Component
export struct StageScaffold {
  @StorageLink('eo.layout') @Watch('onGeom') layout: LayoutInfo = new LayoutInfo();
  @StorageLink('eo.safe') @Watch('onGeom') safe: SafeArea = new SafeArea();
  @Prop drawer: boolean = true;
  @BuilderParam leading: () => void = emptyBuilder;
  @BuilderParam trailing: () => void = emptyBuilder;
  @BuilderParam content: () => void = emptyBuilder;
  @State private full: boolean = false;
  @State private contentH: number = 0;
  @State private bottomH: number = 0;

  aboutToAppear(): void { this.report(); }

  onGeom(): void { this.report(); }

  private state(): string { return this.layout.result.state; }
  private compact(): boolean { return isCompact(this.layout.result.state); }
  private topY(): number { return this.safe.top + SPACE_S; }

  // ---------------------------------------------------------------- 一页：底部抽屉的两档

  private peekMax(): number {
    return Math.round(this.layout.height * (this.state() === 'outer' ? 0.55 : 0.42));
  }
  private fullMax(): number {
    return Math.max(200, this.layout.height - this.topY() - TOUCH - SPACE_L - this.safe.bottom - SPACE_M);
  }
  private canFull(): boolean { return this.contentH + HANDLE + 16 > this.peekMax(); }
  private toggle(): void {
    if (!this.canFull()) return;
    this.getUIContext().animateTo({ duration: 260, curve: Curve.EaseOut }, () => { this.full = !this.full; });
  }

  private drag(dy: number): void {
    if (dy < -24 && !this.full && this.canFull()) this.getUIContext().animateTo({ duration: 260, curve: Curve.EaseOut }, () => { this.full = true; });
    else if (dy > 24 && this.full) this.getUIContext().animateTo({ duration: 260, curve: Curve.EaseOut }, () => { this.full = false; });
  }

  // ---------------------------------------------------------------- 两页 / 三页 / 悬停

  private paneX(): number { return this.layout.result.panes.length > 0 ? this.layout.result.panes[0].x : 0; }
  private paneW(): number { return this.layout.result.panes.length > 0 ? this.layout.result.panes[0].w : this.layout.width; }
  private cardW(): number { return Math.max(240, Math.min(PANE_MAX, this.paneW() - SPACE_L * 2)); }
  /** 右上图标那一行的右边界：三页时停在中页的右边（右页留给浮层），其余贴屏幕右边 */
  private iconRight(): number {
    const r = this.layout.result;
    if (r.state === 'triple' && r.panes.length > 2) return r.panes[1].x + r.panes[1].w;
    return this.layout.width - this.safe.right;
  }
  /** 左页那一列：从图标行下面到底边，卡贴底 */
  private paneColumnY(): number { return this.topY() + TOUCH + SPACE_M; }
  private paneColumnH(): number { return Math.max(160, this.layout.height - this.paneColumnY() - this.safe.bottom - SPACE_M); }
  private paneBodyMax(): number { return Math.max(120, this.paneColumnH() - HANDLE - 16); }
  private hoverTop(): number { return this.layout.result.panes.length > 1 ? this.layout.result.panes[1].x : this.layout.height / 2; }
  private hoverH(): number { return this.layout.result.panes.length > 1 ? this.layout.result.panes[1].w : this.layout.height / 2; }
  private hoverW(): number { return Math.min(560, this.layout.width - SPACE_L * 2); }

  // ---------------------------------------------------------------- 留白

  private report(): void {
    if (this.compact()) {
      const i = new Insets();
      i.bottom = this.bottomH;
      AppModel.shared.reportInsets(i);
    } else {
      AppModel.shared.reportInsets(worldInsets(this.layout.result));
    }
  }

  build() {
    Stack() {
      if (this.compact()) {
        this.CompactBody()
      } else if (this.state() === 'hover') {
        this.HoverBody()
      } else {
        this.PaneBody()
      }
    }
    .width('100%')
    .height('100%')
    .alignContent(this.compact() ? Alignment.Bottom : Alignment.TopStart)
    .hitTestBehavior(HitTestMode.Transparent)
  }

  /** 图标行的宽：三页时到中页右边为止 */
  private topRowW(): number { return this.compact() || this.state() === 'hover' ? this.layout.width : this.iconRight(); }

  /** 抽屉里滚动区最多多高：一页按当前那一档；悬停按下半屏；左页按整列 */
  private maxBody(): number {
    if (this.compact()) {
      return Math.max(44, (this.full && this.canFull() ? this.fullMax() : this.peekMax()) - HANDLE - 16);
    }
    if (this.state() === 'hover') return Math.max(80, this.hoverH() - SPACE_M * 2 - HANDLE - 16 - this.safe.bottom);
    return this.paneBodyMax();
  }

  @Builder
  TopRow() {
    Row() {
      this.leading()
      Blank()
      this.trailing()
    }
    .width(this.topRowW())
    .padding({ left: SPACE_L + this.safe.left, right: SPACE_L })
    .position({ x: 0, y: this.topY() })
    .hitTestBehavior(HitTestMode.Transparent)
  }

  @Builder
  DrawerCard() {
    Column() {
      Row() {
        Column().width(36).height(5).borderRadius(3).backgroundColor(Theme.p().grab)
      }
      .width('100%')
      .height(HANDLE)
      .justifyContent(FlexAlign.Center)
      .accessibilityText('')
      .onClick(() => this.toggle())
      .gesture(PanGesture({ direction: PanDirection.Vertical }).onActionEnd((e: GestureEvent) => this.drag(e.offsetY)))
      Scroll() {
        Column() {
          this.content()
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .onAreaChange((_o: Area, n: Area) => { this.contentH = n.height as number; })
      }
      .width('100%')
      .height(Math.max(44, Math.min(this.contentH, this.maxBody())))
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.Spring)
      .align(Alignment.Top)
    }
    .width('100%')
    .padding({ left: 20, right: 20, bottom: 16 })
    .backgroundColor(Theme.p().glassFill)
    .backdropBlur(22)
    .borderRadius(RADIUS_L)
    .border({ width: 0.5, color: Theme.p().glassRim })
    .shadow({ radius: 24, color: Theme.shadow(), offsetX: 0, offsetY: 10 })
  }

  @Builder
  CompactBody() {
    this.TopRow()
    Column() {
      if (this.drawer) {
        this.DrawerCard()
      } else {
        Column() {
          this.content()
        }
        .width('100%')
        .alignItems(HorizontalAlign.Center)
      }
    }
    .width('100%')
    .constraintSize({ maxWidth: CARD_MAX + SPACE_L * 2 })
    .padding({ left: SPACE_L, right: SPACE_L, bottom: this.safe.bottom + SPACE_M })
    .onAreaChange((_o: Area, n: Area) => {
      const h = n.height as number;
      if (Math.abs(h - this.bottomH) >= 1) { this.bottomH = h; this.report(); }
    })
    .hitTestBehavior(HitTestMode.Transparent)
  }

  @Builder
  PaneBody() {
    this.TopRow()
    Column() {
      if (this.drawer) {
        this.DrawerCard()
      } else {
        Column() {
          this.content()
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
      }
    }
    .width(this.cardW())
    .height(this.paneColumnH())
    .justifyContent(FlexAlign.End)
    .position({ x: this.paneX() + SPACE_L + this.safe.left, y: this.paneColumnY() })
    .hitTestBehavior(HitTestMode.Transparent)
  }

  @Builder
  HoverBody() {
    this.TopRow()
    Column() {
      if (this.drawer) {
        this.DrawerCard()
      } else {
        Column() {
          this.content()
        }
        .width('100%')
        .alignItems(HorizontalAlign.Center)
      }
    }
    .width(this.hoverW())
    .height(Math.max(120, this.hoverH() - SPACE_M - this.safe.bottom))
    .justifyContent(FlexAlign.Start)
    .position({ x: (this.layout.width - this.hoverW()) / 2, y: this.hoverTop() + SPACE_M })
    .hitTestBehavior(HitTestMode.Transparent)
  }
}
