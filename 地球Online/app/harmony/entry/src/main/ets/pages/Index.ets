import { webview } from '@kit.ArkWeb';
import { AppModel, PageRoute, SheetRoute, StageState } from '../model/AppModel';
import { WorldController } from '../world/WorldController';
import { RawfileServer } from '../world/RawfileServer';
import { SPACE_BG } from '../gen/Shared';
import { HomeOverlay } from '../screens/HomeOverlay';
import { BookOverlay } from '../screens/BookOverlay';
import { DayOverlay } from '../screens/DayOverlay';
import { PagesHost, PickBar, SheetHost, ToastBar } from '../screens/Hosts';

/** 唯一的一页：Stack { 世界层（Web，铺满、常驻）; 当前舞台的浮层; 点选提示; 整页; 浮层; 提示 }。
 *  界面层放在 ForEach([uiKey]) 里：语言或深浅一变 uiKey 就变，整层界面重建（文字、颜色都跟着换）；世界层的 Web 在外面，不重建
 *  （换语言时 WorldController 带新的 ?lang= 重新载入页面，状态重放）。 */
@Entry
@Component
struct Index {
  @StorageLink('eo.uiKey') uiKey: string = '';

  private world: WorldController = WorldController.shared;

  aboutToAppear(): void {
    try { webview.WebviewController.setWebDebuggingAccess(false); } catch (e) { /* 调试时改成 true，用 chrome://inspect 看世界层 */ }
  }

  onBackPress(): boolean { return AppModel.shared.back(); }

  /** 地球外的底色：从 uiKey 读深浅（Theme.dark 本身不是状态变量，读 uiKey 才会跟着刷新） */
  private spaceColor(): string {
    const v: string | undefined = SPACE_BG[this.uiKey.endsWith('night') ? 'night' : 'day'];
    return v !== undefined ? v : '#141a4a';
  }

  build() {
    Stack() {
      // 世界层画好之前露出来的底色
      Column().width('100%').height('100%').backgroundColor(this.spaceColor())
      Web({ src: this.world.entryUrl(), controller: this.world.controller })
        .width('100%')
        .height('100%')
        .backgroundColor(Color.Transparent)
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .databaseAccess(true)
        .fileAccess(false)
        .zoomAccess(false)
        .overScrollMode(OverScrollMode.NEVER)
        .horizontalScrollBarAccess(false)
        .verticalScrollBarAccess(false)
        .javaScriptProxy({ object: this.world.proxy, name: 'harmonyBridge', methodList: ['postMessage'], controller: this.world.controller })
        .onInterceptRequest((event) => RawfileServer.respond(event ? event.request.getRequestUrl() : ''))
        .onPageBegin(() => this.world.pageBegin())
        .onRenderExited(() => this.world.rendererGone())
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      ForEach([this.uiKey], (k: string) => {
        StageRoot()
      }, (k: string) => k)
    }
    .width('100%')
    .height('100%')
  }
}

/** 界面层：当前舞台的浮层 + 点选提示 + 整页 + 浮层 + 提示（从下往上叠） */
@Component
struct StageRoot {
  @StorageLink('eo.stage') stage: StageState = new StageState();
  @StorageLink('eo.sheets') sheets: SheetRoute[] = [];
  @StorageLink('eo.pages') pages: PageRoute[] = [];
  @StorageLink('eo.picking') picking: string = '';
  @StorageLink('eo.toast') toast: string = '';

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.stage.kind === 'home') {
        HomeOverlay()
      } else if (this.stage.kind === 'book') {
        BookOverlay()
      } else {
        DayOverlay()
      }
      if (this.picking !== '') {
        PickBar()
      }
      if (this.pages.length > 0) {
        PagesHost()
      }
      if (this.sheets.length > 0) {
        SheetHost()
      }
      if (this.toast !== '') {
        ToastBar()
      }
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
  }
}
