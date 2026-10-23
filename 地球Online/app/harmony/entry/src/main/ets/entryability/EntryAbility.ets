import { AbilityConstant, Configuration, ConfigurationConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { LayoutInfo, LayoutState } from '../layout/LayoutState';
import { TripStore } from '../model/TripStore';
import { AppModel } from '../model/AppModel';
import { AppContext } from '../util/Files';

/** 入口：一个窗口、一页（pages/Index）。世界层 Web 铺满整屏，界面都是浮在它上面的 ArkUI。
 *  启动顺序：上下文 → 本机数据 → 协调者（发出第一批状态，排队等世界层就绪）→ 载入页面 → 量窗口与安全区。 */
export default class EntryAbility extends UIAbility {
  onCreate(_want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    AppContext.init(this.context);
    TripStore.shared.load(this.context.filesDir);
    const dark = this.context.config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK;
    AppModel.shared.start(dark);
    try { webview.WebviewController.initializeWebEngine(); } catch (e) { /* 首次建 Web 时也会初始化 */ }
  }

  onConfigurationUpdate(config: Configuration): void {
    AppModel.shared.setSystemDark(config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK);
    AppModel.shared.systemLanguageChanged();
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', () => {
      const win = windowStage.getMainWindowSync();
      win.setWindowLayoutFullScreen(true).catch(() => { /* 不全屏也能用 */ });   // 世界铺满整屏，面板自己避开安全区
      LayoutState.watchSafeArea(win);
      LayoutState.watch(win, (li: LayoutInfo) => AppModel.shared.onLayout(li));   // 折叠开合 / 尺寸变化 → 布局态 → set-layout
    });
  }

  onForeground(): void { AppModel.shared.tick(); }

  onBackground(): void { TripStore.shared.saveNow(); }
}
