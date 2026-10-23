import "./store.ts";                     // 最先读设置：界面语言在这里定下来（shared/i18n），各页面的 t() 都在函数里调用
import { route, start, go } from "./router.ts";
import { applyTheme, watchPhase } from "./theme.ts";
import { HomePage } from "./pages/home.ts";
import { ShelfPage } from "./pages/shelf.ts";
import { DayPage } from "./pages/day.ts";
import { EpiloguePage } from "./pages/epilogue.ts";
import { SettingsPage } from "./pages/settings.ts";
import { TokensPage } from "./pages/tokens.ts";
import { applyTokens } from "./shape.ts";

applyTokens(); applyTheme(); watchPhase();
route("home", "/", HomePage);
route("shelf", "/shelf", ShelfPage);   // 纯列表视图（无障碍 / 低配机）
route("new", "/new", (_p, _root) => { go("/"); });   // 旧的新建页已并入地球上的新建抽屉
route("settings", "/settings", SettingsPage);
route("book", "/book/:id", HomePage);
route("day", "/book/:id/day/:n", DayPage);
route("epilogue", "/book/:id/end", EpiloguePage);
route("tokens", "/tokens", TokensPage);   // 色卡与字阶（设计令牌的活页）
start(document.getElementById("app")!);
