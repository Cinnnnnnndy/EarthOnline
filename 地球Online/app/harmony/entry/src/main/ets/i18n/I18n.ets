import { i18n } from '@kit.LocalizationKit';
import { Files } from '../util/Files';
import { Dates } from '../util/Dates';
import { THEMES, THEME_KEYS } from '../model/Spec';

/** 多语言：界面文字一律从消息表取（shared/i18n 导出的 rawfile/shared/i18n.<locale>.json，tools/export-shared.ts 生成）。
 *  format() 是 shared/i18n/index.ts 的 format 的移植：{var} 换成值；{var:单数|复数} 按 var 是否为 1 选（英文用）；没给的占位原样留着。
 *  语言：设置里的「语言」（auto = 跟随手机，resolveLocale 同一套：繁体也用简体，认不出的用英文）。换语言后整层界面重建、世界层带 ?lang= 重新载入。
 *  日期、时长、距离的格式化也照 shared/i18n 移植（只是格式，不是领域算法）。 */
export type Vars = Record<string, string | number>;

export class I18n {
  static locale: string = 'zh-Hans';
  private static catalogs: Map<string, Record<string, string>> = new Map<string, Record<string, string>>();

  // ------------------------------------------------------------ 语言

  static isLocale(x: string | undefined): boolean { return x === 'zh-Hans' || x === 'en' || x === 'ja'; }

  /** 设置 + 手机的语言列表 → 界面语言（shared/i18n resolveLocale 的移植） */
  static resolve(setting: string | undefined): string {
    if (setting !== undefined && setting !== 'auto' && I18n.isLocale(setting)) return setting;
    const langs: string[] = [];
    try {
      const list: string[] = i18n.System.getPreferredLanguageList();
      for (const l of list) langs.push(l);
    } catch (e) { /* 拿不到就看系统语言 */ }
    try { langs.push(i18n.System.getSystemLanguage()); } catch (e) { /* 空 */ }
    return I18n.resolveFrom(langs);
  }

  static resolveFrom(langs: string[]): string {
    for (const raw of langs) {
      const l = raw.toLowerCase();
      if (l === 'zh' || l.startsWith('zh-') || l.startsWith('zh_')) return 'zh-Hans';
      if (l === 'ja' || l.startsWith('ja-') || l.startsWith('ja_')) return 'ja';
      if (l === 'en' || l.startsWith('en-') || l.startsWith('en_')) return 'en';
    }
    return langs.length > 0 ? 'en' : 'zh-Hans';
  }

  static setLocale(l: string): void { I18n.locale = I18n.isLocale(l) ? l : 'zh-Hans'; }

  private static catalog(l: string): Record<string, string> {
    const hit = I18n.catalogs.get(l);
    if (hit !== undefined) return hit;
    let c: Record<string, string> = {};
    try { c = JSON.parse(Files.rawText('shared/i18n.' + l + '.json')) as Record<string, string>; } catch (e) { /* 缺表：退回简体 / 键名 */ }
    I18n.catalogs.set(l, c);
    return c;
  }

  private static template(key: string): string | undefined {
    const own: string | undefined = I18n.catalog(I18n.locale)[key];
    if (own !== undefined) return own;
    const zh: string | undefined = I18n.catalog('zh-Hans')[key];
    return zh;
  }

  static has(key: string): boolean { return I18n.template(key) !== undefined; }

  /** 一句界面文字；表里没有就原样返回键名（方便发现漏的键） */
  static t(key: string, vars?: Vars): string {
    const tpl = I18n.template(key);
    if (tpl === undefined) return key;
    return vars === undefined ? I18n.format(tpl, {}) : I18n.format(tpl, vars);
  }

  /** 只有一个数字占位 {n} 的常见写法 */
  static tn(key: string, n: number): string {
    const v: Vars = { 'n': n };
    return I18n.t(key, v);
  }

  /** 只有一个占位的写法 */
  static t1(key: string, name: string, value: string | number): string {
    const v: Vars = {};
    v[name] = value;
    return I18n.t(key, v);
  }

  /** shared/i18n format() 的移植：/\{(\w+)(?::([^{}|]*)\|([^{}]*))?\}/g 的逐字符版本（不靠 replace 回调的可变参数） */
  static format(tpl: string, vars: Vars): string {
    let out = '';
    let i = 0;
    while (i < tpl.length) {
      const open = tpl.indexOf('{', i);
      if (open < 0) { out += tpl.substring(i); break; }
      out += tpl.substring(i, open);
      const close = tpl.indexOf('}', open + 1);
      if (close < 0) { out += tpl.substring(open); break; }
      const body = tpl.substring(open + 1, close);
      if (body.indexOf('{') >= 0) { out += '{'; i = open + 1; continue; }   // 「{{n}}」：从里面那个 { 重新找
      const colon = body.indexOf(':');
      const name = colon < 0 ? body : body.substring(0, colon);
      let ok = /^\w+$/.test(name);
      let one = '', other = '', plural = false;
      if (ok && colon >= 0) {
        const rest = body.substring(colon + 1);
        const bar = rest.indexOf('|');
        if (bar < 0) ok = false;
        else { one = rest.substring(0, bar); other = rest.substring(bar + 1); plural = true; }
      }
      const whole = tpl.substring(open, close + 1);
      if (!ok) { out += whole; i = close + 1; continue; }
      const v: string | number | undefined = vars[name];
      if (v === undefined) out += whole;
      else if (plural) out += Number(v) === 1 ? one : other;
      else out += String(v);
      i = close + 1;
    }
    return out;
  }

  // ------------------------------------------------------------ 并列（不用「A · B」）

  static list(parts: string[]): string { return parts.filter((p: string) => p.length > 0).join(I18n.t('punct.list')); }
  static names(parts: string[]): string { return parts.filter((p: string) => p.length > 0).join(I18n.t('punct.names')); }
  /** 导入数据里的「A · B」显示时换成当前语言的逗号（数据不改） */
  static plain(text: string): string { return text.split(' · ').join(I18n.t('punct.list')); }
  static plainNames(text: string): string { return text.split(' · ').join(I18n.t('punct.names')); }

  // ------------------------------------------------------------ 日期、时长、距离（shared/i18n 的移植）

  private static MON: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** 10月3日 / Oct 3 */
  static monthDay(iso: string): string {
    const m = parseInt(iso.substring(5, 7), 10), d = parseInt(iso.substring(8, 10), 10);
    return I18n.locale === 'en' ? I18n.MON[m - 1] + ' ' + d : m + '月' + d + '日';
  }

  /** 10月3日 – 12日 / Oct 3 – 12；跨月两头都写月份 */
  static dateRange(a: string, b: string): string {
    const same = a.substring(0, 7) === b.substring(0, 7);
    const db = parseInt(b.substring(8, 10), 10);
    if (I18n.locale === 'en') return I18n.monthDay(a) + ' – ' + (same ? String(db) : I18n.monthDay(b));
    return I18n.monthDay(a) + ' – ' + (same ? db + '日' : I18n.monthDay(b));
  }

  /** 2026.10.03 / Oct 3, 2026 */
  static fullDate(iso: string): string {
    if (I18n.locale === 'en') return I18n.monthDay(iso) + ', ' + iso.substring(0, 4);
    return iso.substring(0, 10).split('-').join('.');
  }

  /** 2026.10.03 – 10.12 / Oct 3 – 12, 2026；跨年两头都写年份 */
  static fullDateRange(a: string, b: string): string {
    const sameYear = a.substring(0, 4) === b.substring(0, 4);
    if (I18n.locale === 'en') return sameYear ? I18n.dateRange(a, b) + ', ' + a.substring(0, 4) : I18n.fullDate(a) + ' – ' + I18n.fullDate(b);
    const da = I18n.fullDate(a), dbs = I18n.fullDate(b);
    return sameYear ? da + ' – ' + dbs.substring(5) : da + ' – ' + dbs;
  }

  /** 87 → 1 小时 27 分钟 / 1 h 27 min */
  static duration(minutes: number): string {
    const min = Math.round(minutes), h = Math.floor(min / 60), m = min % 60;
    const v: Vars = { 'h': h, 'm': m };
    if (h > 0 && m > 0) return I18n.t('unit.hm', v);
    if (h > 0) return I18n.t('unit.h', v);
    return I18n.t('unit.m', v);
  }

  /** 数字：最多一位小数（不做千分位） */
  static num(n: number): string { return Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toString(); }

  static km(n: number): string { return I18n.t1('unit.km', 'n', I18n.num(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10)); }
  static days(n: number): string { return I18n.tn('count.day', n); }
  static stops(n: number): string { return I18n.tn('count.stop', n); }

  /** 北纬 64.1°，西经 21.9° */
  static latLng(lat: number, lng: number): string {
    return I18n.list([
      I18n.t1(lat >= 0 ? 'geo.n' : 'geo.s', 'v', Math.abs(lat).toFixed(1)),
      I18n.t1(lng >= 0 ? 'geo.e' : 'geo.w', 'v', Math.abs(lng).toFixed(1))
    ]);
  }

  /** 今天出发 / 明天出发 / 后天出发 / n 天后出发（shared/algo/journey.ts departLabel 的文字部分） */
  static departLabel(inDays: number): string {
    if (inDays <= 0) return I18n.t('journey.departToday');
    if (inDays === 1) return I18n.t('journey.departTomorrow');
    if (inDays === 2) return I18n.t('journey.departDayAfter');
    return I18n.tn('journey.departIn', inDays);
  }

  /** 主题的显示名（Trip.theme 是中文原名） */
  static theme(name: string): string {
    const i = THEMES.indexOf(name);
    return i >= 0 ? I18n.t(THEME_KEYS[i]) : name;
  }

  /** 书此刻的状态标签：旅行中 D3 / n 天后出发 / 已结束 / 已合上 */
  static tripStatus(phase: string, todayIndex: number, startDate: string): string {
    if (phase === 'traveling') return I18n.tn('home.statusToday', Math.max(0, todayIndex) + 1);
    if (phase === 'upcoming') return I18n.departLabel(Dates.diff(Dates.today(), startDate));
    if (phase === 'closed') return I18n.t('shelf.closed');
    return I18n.t('home.statusEnded');
  }
}
