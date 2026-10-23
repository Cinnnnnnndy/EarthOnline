/** 日期小工具：本地的「今天」与 YYYY-MM-DD 的加减（与 shared 里一样，按 UTC 零点算，避免时区把日期推一天）。
 *  这里只有格式与算术，旅程状态、待办到期日之类的规则一律走共用核心（core-call）。 */
export class Dates {
  private static pad(n: number): string { return n < 10 ? '0' + n : String(n); }

  /** 本地日历上的今天 */
  static today(): string { return Dates.iso(new Date()); }

  static iso(d: Date): string {
    return d.getFullYear() + '-' + Dates.pad(d.getMonth() + 1) + '-' + Dates.pad(d.getDate());
  }

  private static dayNo(iso: string): number {
    return Math.floor(Date.parse(iso.substring(0, 10) + 'T00:00:00Z') / 86400000);
  }

  /** b − a（天） */
  static diff(a: string, b: string): number { return Dates.dayNo(b) - Dates.dayNo(a); }

  static add(iso: string, n: number): string {
    const d = new Date(iso.substring(0, 10) + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().substring(0, 10);
  }

  /** YYYY-MM-DD → 本地中午的 Date（给日期选择器） */
  static toDate(iso: string): Date {
    const y = parseInt(iso.substring(0, 4), 10), m = parseInt(iso.substring(5, 7), 10), d = parseInt(iso.substring(8, 10), 10);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  static nowIso(): string { return new Date().toISOString(); }

  /** 没设家时的经纬度：时区推出经度、纬度 30°（与 iOS Daylight.guessPlace 一致） */
  static guessHomeLng(): number { return -new Date().getTimezoneOffset() / 4; }
}
