/** 外观：天色（白天 / 晨昏 / 夜）由手机当地时间与手机深浅外观一起决定（规则见 shared/world/daylight.ts）。
 *  夜里界面换深色玻璃；地球外的画布、底色跟着换。每分钟看一次太阳，回到前台时立即看。 */
import { store } from "./store.ts";
import { resolvePhase, type SkyPhase } from "../../shared/world/daylight.ts";
import { cssVars, SPACE_BG } from "../../shared/world/tokens.ts";
import { getLocale } from "../../shared/i18n/index.ts";
import { platform } from "./shape.ts";

const dark = matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<(p: SkyPhase) => void>();
let current: SkyPhase | null = null;

export function currentPhase(): SkyPhase {
  const q = new URLSearchParams(location.search).get("sky");                 // 截图与调试：?sky=day|dusk|night
  if (q === "day" || q === "dusk" || q === "night") return q;
  return resolvePhase({ appearance: store.settings.theme, systemDark: dark.matches, now: new Date(), place: store.home });
}
export const skyPhase = () => current ?? currentPhase();
export function onPhase(fn: (p: SkyPhase) => void) { listeners.add(fn); return () => listeners.delete(fn); }

export function applyTheme() {
  const r = document.documentElement; r.dataset.palette = store.settings.palette;
  const p = currentPhase(); const night = p === "night";
  r.dataset.sky = p; r.dataset.theme = night ? "dark" : "light"; r.classList.remove("dark-auto");
  for (const [k, v] of Object.entries(cssVars(night, getLocale(), platform()))) r.style.setProperty(k, v);
  r.style.setProperty("--space-bg", SPACE_BG[p]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", SPACE_BG[p]);
  if (p !== current) { current = p; listeners.forEach((f) => f(p)); }
}

let armed = false;
export function watchPhase() {
  if (armed) return; armed = true;
  dark.addEventListener("change", applyTheme);
  setInterval(applyTheme, 60_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) applyTheme(); });
}
