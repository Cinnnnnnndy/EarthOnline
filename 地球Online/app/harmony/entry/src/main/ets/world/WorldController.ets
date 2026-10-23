import { webview } from '@kit.ArkWeb';
import { CHANNEL_OF, REPLAY_ORDER } from '../gen/Shared';
import { Trip } from '../model/Spec';
import { WORLD_ORIGIN } from './RawfileServer';
import { CoreCallMsg, ExportLongImageMsg, ImportPageMsg, WorldEvent, WorldMsg, sendScript } from './WorldMessages';

/** 世界层（地球 + 某一天的浮岛）常驻一个 Web 组件，切页面只换模式和相机，不销毁（技术选型 8.3，iOS WorldController.swift 同一套）。
 *  原生 → 世界：runJavaScript("EarthWorld.send(<JS 字符串字面量>)")；世界 → 原生：javaScriptProxy 注册的 harmonyBridge.postMessage(json)。
 *  状态型消息按频道（gen/Shared.ets 的 CHANNEL_OF）只留最新一条，页面（重新）载入后按 REPLAY_ORDER 重放；
 *  一次性动作（播放、打卡、导入、核心调用……）在页面就绪前排队，就绪后按发出的顺序发一次。
 *  只有页面级的 ready（每次载入一次，window.EarthWorld 挂好之后）才重放；同一次载入里再来一个 ready 也只重放一遍。
 *  底板建好发的是 plate-loaded（普通事件，交给监听者）——在它上面重放会把 show-day 再发一遍、底板无限重载。 */

/** 一条排队的一次性消息；核心调用 / 导入记着请求号，真正发出去时才开始计 10 秒超时 */
class Queued {
  json: string;
  requestId: string;
  constructor(json: string, requestId: string) { this.json = json; this.requestId = requestId; }
}

class Pending {
  resolve: (v: Object | null) => void;
  reject: (e: Error) => void;
  timer: number = -1;
  constructor(resolve: (v: Object | null) => void, reject: (e: Error) => void) { this.resolve = resolve; this.reject = reject; }
}

class PendingImport {
  resolve: (r: ImportResult) => void;
  reject: (e: Error) => void;
  timer: number = -1;
  constructor(resolve: (r: ImportResult) => void, reject: (e: Error) => void) { this.resolve = resolve; this.reject = reject; }
}

class PendingLong {
  resolve: (dataUrl: string) => void;
  reject: (e: Error) => void;
  timeoutMs: number;
  timer: number = -1;
  constructor(resolve: (dataUrl: string) => void, reject: (e: Error) => void, timeoutMs: number) {
    this.resolve = resolve; this.reject = reject; this.timeoutMs = timeoutMs;
  }
}

/** import-page 的结果 */
export class ImportResult {
  trips: Trip[] = [];
  warnings: string[] = [];
  error: string = '';
}

/** javaScriptProxy 注册的对象：方法里不用 this（ArkWeb 怎么绑定 this 文档没写），直接找单例 */
export class WorldProxy {
  postMessage(json: string): void { WorldController.shared.receive(json); }
}

export type WorldListener = (e: WorldEvent) => void;

const TIMEOUT_MS = 10000;

export class WorldController {
  static readonly shared: WorldController = new WorldController();

  readonly controller: webview.WebviewController = new webview.WebviewController();
  readonly proxy: WorldProxy = new WorldProxy();
  /** 页面语言（URL 的 ?lang=，嵌入页的标签、核心调用的默认语言） */
  locale: string = 'zh-Hans';

  private ready: boolean = false;
  private loadSeq: number = 0;
  private replayedSeq: number = -1;
  private sticky: Map<string, string> = new Map<string, string>();
  private queue: Queued[] = [];
  private pending: Map<string, Pending> = new Map<string, Pending>();
  private imports: Map<string, PendingImport> = new Map<string, PendingImport>();
  private longs: Map<string, PendingLong> = new Map<string, PendingLong>();
  private listeners: WorldListener[] = [];
  private seq: number = 0;

  isReady(): boolean { return this.ready; }

  /** 世界层入口：embed.html?lang=<locale>（嵌入页的 ?mode=suitcase 是另一个 Web，见 SuitcaseBridge） */
  entryUrl(): string { return WORLD_ORIGIN + 'embed.html?lang=' + encodeURIComponent(this.locale); }

  on(l: WorldListener): void { this.listeners.push(l); }

  // ------------------------------------------------------------ Web 组件的回调（Index 里接）

  /** onPageBegin：新的一次载入开始（包括重载、渲染进程崩溃后的重载）——之前的就绪作废 */
  pageBegin(): void {
    this.loadSeq++;
    this.ready = false;
    AppStorage.setOrCreate<boolean>('eo.worldReady', false);
    // 已经发出去的长图请求新页面不会回了：直接告诉等它的地方（核心调用、导入短，交给各自的超时）
    const gone = Array.from(this.longs.keys()).filter((id: string) => (this.longs.get(id) as PendingLong).timer >= 0);
    for (const id of gone) this.failLong(id, 'world reloaded');
  }

  /** onRenderExited：网页进程被系统回收 / 崩溃 → 重新载入，就绪后重放全部状态 */
  rendererGone(): void {
    this.ready = false;
    try { this.controller.loadUrl(this.entryUrl()); } catch (e) { /* 控制器没绑上 */ }
  }

  /** 换语言：带新的 ?lang= 重新载入（状态会重放） */
  reloadForLocale(locale: string): void {
    if (locale === this.locale) return;
    this.locale = locale;
    this.ready = false;
    try { this.controller.loadUrl(this.entryUrl()); } catch (e) { /* 还没绑上：首次载入就用新 URL */ }
  }

  // ------------------------------------------------------------ 发送

  send(msg: WorldMsg): void { this.sendJson(msg.kind, JSON.stringify(msg), ''); }

  private sendJson(kind: string, json: string, requestId: string): void {
    const ch: string | undefined = CHANNEL_OF[kind];
    if (ch !== undefined) {
      this.sticky.set(ch, json);          // 状态：只留最新一条；没就绪时等重放
      if (this.ready) this.deliver([json], []);
      return;
    }
    const item = new Queued(json, requestId);
    if (!this.ready) { this.queue.push(item); return; }
    this.deliver([json], [item]);
  }

  /** 发一批；EarthWorld 不在（"no"）就撤回就绪，一次性的放回队首、等下一次 ready（状态型的反正会重放） */
  private deliver(jsons: string[], oneShots: Queued[]): void {
    for (const q of oneShots) this.arm(q.requestId);
    this.run(sendScript(jsons), (result: string) => {
      if (result.indexOf('no') < 0 || result.indexOf('ok') >= 0) return;
      this.ready = false;
      this.replayedSeq = -1;
      for (const q of oneShots) this.disarm(q.requestId);
      this.queue = oneShots.concat(this.queue);
    });
  }

  private run(script: string, done?: (result: string) => void): void {
    try {
      this.controller.runJavaScript(script).then((r: string) => {
        if (done !== undefined) done(r);
      }).catch(() => {
        if (done !== undefined) done('');
      });
    } catch (e) {
      if (done !== undefined) done('');   // 控制器还没绑到 Web 组件上
    }
  }

  // ------------------------------------------------------------ 接收（WorldProxy.postMessage → 这里）

  receive(json: string): void {
    let e: WorldEvent;
    try { e = JSON.parse(json) as WorldEvent; } catch (err) { return; }
    if (e.kind === 'ready') { this.onReady(); }   // 只认页面级的 ready；plate-loaded 等原样交给监听者
    else if (e.kind === 'core-result') { this.settle(e); return; }
    else if (e.kind === 'import-result') { this.settleImport(e); return; }
    else if (e.kind === 'long-image-progress') { if (this.longs.has(e.requestId ?? '')) AppStorage.setOrCreate<string>('eo.longProgress', e.text ?? ''); return; }
    else if (e.kind === 'long-image') { this.settleLong(e); return; }   // 好几 MB 的 data URL，只给等它的那一处
    for (const l of this.listeners) l(e);
  }

  private onReady(): void {
    if (this.ready && this.replayedSeq === this.loadSeq) return;   // 同一次载入的第二个 ready：已经重放过（幂等）
    const seq = this.loadSeq;
    const jsons: string[] = [];
    for (const ch of REPLAY_ORDER) {
      const j = this.sticky.get(ch);
      if (j !== undefined) jsons.push(j);
    }
    const q = this.queue;
    this.queue = [];
    const ids: string[] = [];
    for (const item of q) { jsons.push(item.json); if (item.requestId !== '') ids.push(item.requestId); }
    this.ready = true;
    this.replayedSeq = seq;
    AppStorage.setOrCreate<boolean>('eo.worldReady', true);
    for (const id of ids) this.arm(id);
    this.run(sendScript(jsons), (result: string) => {
      // 只有脚本明说 EarthWorld 不在（"no"）才撤回；runJavaScript 本身出错（空串）时不撤，免得同一次载入再也等不到 ready
      if (result.indexOf('no') < 0 || result.indexOf('ok') >= 0 || seq !== this.loadSeq) return;
      // EarthWorld 还没出现（理论上不会：嵌入页先挂 EarthWorld 再发 ready）：撤回就绪，一次性的放回队首等下一次 ready
      this.ready = false;
      this.replayedSeq = -1;
      this.queue = q.concat(this.queue);
      for (const id of ids) this.disarm(id);
    });
  }

  // ------------------------------------------------------------ 核心调用（shared/core.ts）

  /** 调一个共用核心函数；页面没就绪时排队，真正发出后 10 秒没回就 reject */
  core(fn: string, args: Object[], locale?: string): Promise<Object | null> {
    this.seq++;
    const id = 'c' + this.seq + '-' + Date.now().toString(36);
    return new Promise<Object | null>((resolve, reject) => {
      this.pending.set(id, new Pending(resolve, reject));
      const msg = new CoreCallMsg(id, fn, args, locale !== undefined ? locale : this.locale);
      this.sendJson(msg.kind, JSON.stringify(msg), id);
    });
  }

  /** 用网页的导入器解析行程页 HTML（importRoutePage）；10 秒没回 reject */
  importPage(html: string): Promise<ImportResult> {
    this.seq++;
    const id = 'i' + this.seq + '-' + Date.now().toString(36);
    return new Promise<ImportResult>((resolve, reject) => {
      this.imports.set(id, new PendingImport(resolve, reject));
      const msg = new ImportPageMsg(id, html);
      this.sendJson(msg.kind, JSON.stringify(msg), id);
    });
  }

  /** 导出长图（D96）：嵌入页借这个常驻的世界层逐天建底板、拍一张，按网页同一份排版（web/src/export.ts）拼成 PNG，回 data URL。
   *  三端同一张图。时限按天数给（一天 30 秒，从真正发出去算起）；进度写进 AppStorage 'eo.longProgress'（嵌入页按当前语言给的文字）。
   *  嵌入页拍完会把原来那一天建回来；同一时刻只做一张（第二次回 busy）。 */
  exportLongImage(trip: Trip): Promise<string> {
    this.seq++;
    const id = 'l' + this.seq + '-' + Date.now().toString(36);
    return new Promise<string>((resolve, reject) => {
      this.longs.set(id, new PendingLong(resolve, reject, 60000 + 30000 * trip.days.length));
      const msg = new ExportLongImageMsg(id, trip);
      this.sendJson(msg.kind, JSON.stringify(msg), id);
    });
  }

  private failLong(id: string, reason: string): void {
    const p = this.longs.get(id);
    if (p === undefined) return;
    this.longs.delete(id);
    if (p.timer >= 0) clearTimeout(p.timer);
    AppStorage.setOrCreate<string>('eo.longProgress', '');
    p.reject(new Error(reason));
  }

  private settleLong(e: WorldEvent): void {
    const id = e.requestId ?? '';
    const p = this.longs.get(id);
    if (p === undefined) return;
    if (e.error !== undefined && e.error !== null) { this.failLong(id, e.error); return; }
    if (e.dataUrl === undefined || e.dataUrl === '') { this.failLong(id, 'empty'); return; }
    this.longs.delete(id);
    if (p.timer >= 0) clearTimeout(p.timer);
    AppStorage.setOrCreate<string>('eo.longProgress', '');
    p.resolve(e.dataUrl);
  }

  private arm(id: string): void {
    if (id === '') return;
    const c = this.longs.get(id);
    if (c !== undefined && c.timer < 0) c.timer = setTimeout(() => this.failLong(id, 'timeout'), c.timeoutMs);
    const a = this.pending.get(id);
    if (a !== undefined && a.timer < 0) {
      a.timer = setTimeout(() => {
        const p = this.pending.get(id);
        if (p !== undefined) { this.pending.delete(id); p.reject(new Error('core timeout')); }
      }, TIMEOUT_MS);
    }
    const b = this.imports.get(id);
    if (b !== undefined && b.timer < 0) {
      b.timer = setTimeout(() => {
        const p = this.imports.get(id);
        if (p !== undefined) { this.imports.delete(id); p.reject(new Error('import timeout')); }
      }, TIMEOUT_MS);
    }
  }

  private disarm(id: string): void {
    const c = this.longs.get(id);
    if (c !== undefined && c.timer >= 0) { clearTimeout(c.timer); c.timer = -1; }
    const a = this.pending.get(id);
    if (a !== undefined && a.timer >= 0) { clearTimeout(a.timer); a.timer = -1; }
    const b = this.imports.get(id);
    if (b !== undefined && b.timer >= 0) { clearTimeout(b.timer); b.timer = -1; }
  }

  private settle(e: WorldEvent): void {
    const id = e.requestId ?? '';
    const p = this.pending.get(id);
    if (p === undefined) return;
    this.pending.delete(id);
    if (p.timer >= 0) clearTimeout(p.timer);
    if (e.error !== undefined && e.error !== null) p.reject(new Error(e.error));
    else p.resolve(e.value !== undefined ? e.value : null);
  }

  private settleImport(e: WorldEvent): void {
    const id = e.requestId ?? '';
    const p = this.imports.get(id);
    if (p === undefined) return;
    this.imports.delete(id);
    if (p.timer >= 0) clearTimeout(p.timer);
    const r = new ImportResult();
    r.trips = e.trips ?? [];
    r.warnings = e.warnings ?? [];
    r.error = e.error ?? '';
    p.resolve(r);
  }
}
