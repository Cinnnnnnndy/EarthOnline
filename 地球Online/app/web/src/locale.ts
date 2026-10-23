/** 界面语言：设置里的「语言」（默认跟随手机）→ shared/i18n 的当前语言。
 *  store 读设置时就定下来（后面的默认名字、日记都按它写）；换语言后重新载入页面。截图与调试：?lang=zh-Hans|en|ja */
import { resolveLocale, isLocale, type LangSetting, type Locale } from "../../shared/i18n/index.ts";

export function pickLocale(setting: LangSetting | undefined): Locale {
  const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("lang") : null;
  if (isLocale(q)) return q;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const langs = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  return resolveLocale(setting ?? "auto", langs);
}
