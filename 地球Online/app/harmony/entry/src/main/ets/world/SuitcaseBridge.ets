import { webview } from '@kit.ArkWeb';
import { Avatar, CaseEdits, CaseGroup, CaseItem, Trip } from '../model/Spec';
import { Files } from '../util/Files';
import { WORLD_ORIGIN } from './RawfileServer';
import { CardImage, CaseSearchMsg, CaseToggleMsg, ExportSuitcaseMsg, MakeCardMsg, ShowSuitcaseMsg, WorldEvent, sendScript } from './WorldMessages';

/** 做好的照片小卡（card-made）：kind 是 cutout / polaroid，图是 data URL */
export class MadeCard {
  kind: string = 'polaroid'; w: number = 0; h: number = 0; dataUrl: string = '';
}

class PendingCard {
  resolve: (c: MadeCard | null) => void;
  timer: number = -1;
  constructor(resolve: (c: MadeCard | null) => void) { this.resolve = resolve; }
}

/** javaScriptProxy 注册给行李箱 Web 的对象（方法里不用 this，直接找当前那座桥） */
export class SuitcaseProxy {
  postMessage(json: string): void {
    const b = SuitcaseBridge.current;
    if (b !== null) b.receive(json);
  }
}

/** 行李箱（D75 / D78）：3D 的箱子在世界层（shared/world/suitcase-scene.ts）里，与网页、iOS 同一只。
 *  日记页用第二个 Web 装嵌入页 embed.html?mode=suitcase（只建箱子，不建地球与浮岛；同一个虚拟源、同一份 rawfile/world），
 *  ready 之后发 show-suitcase（这本书 + 小人 + 箱子的样式），导出发 export-suitcase、收 suitcase-image（PNG 的 dataUrl）。
 *  清单（D98，iOS SuitcaseEditSheet / 安卓 CaseList 同一套）：case-search 一句话检索（回 case-results，先不带图标、图标渲染好再回一次），
 *  case-toggle 点一格放进去 / 拿出来（回 case-edits，由日记页存进书里再重显箱子）；箱子里现有的东西随 suitcase-contents 回来。
 *  一次只有一座桥（日记页一次只开一本）。 */
export class SuitcaseBridge {
  static current: SuitcaseBridge | null = null;

  readonly controller: webview.WebviewController = new webview.WebviewController();
  readonly proxy: SuitcaseProxy = new SuitcaseProxy();
  private ready: boolean = false;
  private pendingShow: string = '';
  private exportResolve: ((dataUrl: string) => void) | null = null;
  private exportTimer: number = -1;
  /** 最近一次检索的词（打得快时只认最新的结果；重新载入后照它再搜一次） */
  lastQuery: string = '';
  /** 箱子里现有的（suitcase-contents） */
  onContents: (items: CaseItem[]) => void = () => {};
  /** 检索结果（case-results，只给 lastQuery 的） */
  onResults: (groups: CaseGroup[]) => void = () => {};
  /** 点一格之后（case-edits）：edits 为 null 表示没改过；result 是 added / removed / frontFull / backFull */
  onEdits: (edits: CaseEdits | null, result: string) => void = () => {};

  private cards: Map<string, PendingCard> = new Map<string, PendingCard>();
  private cardSeq: number = 0;

  constructor() { SuitcaseBridge.current = this; }

  url(locale: string): string { return WORLD_ORIGIN + 'embed.html?mode=suitcase&lang=' + encodeURIComponent(locale); }

  dispose(): void {
    if (SuitcaseBridge.current === this) SuitcaseBridge.current = null;
    if (this.exportResolve !== null) { this.exportResolve(''); this.exportResolve = null; }
    for (const id of Array.from(this.cards.keys())) this.settleCard(id, null);
  }

  /** onPageBegin：重新载入（渲染进程回收等），等下一个 ready 再把箱子发过去 */
  pageBegin(): void {
    this.ready = false;
    // 正在抠的卡新页面不会回了：直接作废
    const ids = Array.from(this.cards.keys());
    for (const id of ids) this.settleCard(id, null);
  }

  show(trip: Trip, avatar: Avatar): void {
    // 照片小卡的图从 filesDir/cards/ 读出来一起带上（读不到的那张跳过，箱子里就不放它）
    const imgs: CardImage[] = [];
    for (const c of (trip.suitcase?.cards ?? [])) {
      const path = Files.cardPath(c.id);
      if (!Files.exists(path)) continue;
      try { imgs.push(new CardImage(c.id, Files.bytesDataUrl(Files.readBytes(path)))); } catch (e) { /* 读不出来：跳过 */ }
    }
    const msg = new ShowSuitcaseMsg(trip, avatar, avatar.suitcase, imgs);
    this.pendingShow = JSON.stringify(msg);
    if (this.ready) this.run(this.pendingShow);
  }

  /** 清单：打一句话或一个词（空的给默认分组） */
  search(query: string): void {
    this.lastQuery = query;
    if (this.ready) this.run(JSON.stringify(new CaseSearchMsg(query)));
  }

  /** 清单：点一格（放进去 / 拿出来），结果从 onEdits 回来 */
  toggle(type: string, id: string): void {
    if (this.ready) this.run(JSON.stringify(new CaseToggleMsg(type, id)));
  }

  /** 照片小卡（D99）：把一张照片（data URL，长边 ≤ 1280）交给嵌入页抠图；没就绪或 20 秒没回给 null */
  makeCard(photoDataUrl: string): Promise<MadeCard | null> {
    return new Promise<MadeCard | null>((resolve) => {
      if (!this.ready) { resolve(null); return; }
      this.cardSeq++;
      const id = 'card-' + this.cardSeq;
      const p = new PendingCard(resolve);
      p.timer = setTimeout(() => this.settleCard(id, null), 20000);
      this.cards.set(id, p);
      this.run(JSON.stringify(new MakeCardMsg(id, photoDataUrl)));
    });
  }

  private settleCard(id: string, c: MadeCard | null): void {
    const p = this.cards.get(id);
    if (p === undefined) return;
    this.cards.delete(id);
    if (p.timer >= 0) clearTimeout(p.timer);
    p.resolve(c);
  }

  /** 让嵌入页渲染一张 PNG（1080 × 1350）；没就绪或 8 秒没回给空串 */
  export(): Promise<string> {
    return new Promise<string>((resolve) => {
      if (!this.ready || this.exportResolve !== null) { resolve(''); return; }
      this.exportResolve = resolve;
      this.run(JSON.stringify(new ExportSuitcaseMsg()));
      this.exportTimer = setTimeout(() => {
        if (this.exportResolve !== null) { this.exportResolve(''); this.exportResolve = null; }
      }, 8000);
    });
  }

  receive(json: string): void {
    let e: WorldEvent;
    try { e = JSON.parse(json) as WorldEvent; } catch (err) { return; }
    if (e.kind === 'ready') {
      // 页面级就绪（每次载入一次）：把最近一次的 show-suitcase 发过去；同一次载入再来也只是重发一遍同一只箱子
      this.ready = true;
      if (this.pendingShow !== '') this.run(this.pendingShow);
      if (this.lastQuery !== '') this.search(this.lastQuery);
    } else if (e.kind === 'suitcase-image') {
      if (this.exportTimer >= 0) { clearTimeout(this.exportTimer); this.exportTimer = -1; }
      if (this.exportResolve !== null) { this.exportResolve(e.dataUrl ?? ''); this.exportResolve = null; }
    } else if (e.kind === 'suitcase-contents') {
      this.onContents(e.items ?? []);
    } else if (e.kind === 'case-results') {
      if ((e.query ?? '') !== this.lastQuery) return;   // 打得快时旧的结果不要
      this.onResults(e.groups ?? []);
    } else if (e.kind === 'card-made') {
      const id = e.requestId ?? '';
      if (e.error !== undefined || e.card === undefined || e.dataUrl === undefined) { this.settleCard(id, null); return; }
      const c = new MadeCard();
      c.kind = e.card.kind; c.w = e.card.w; c.h = e.card.h; c.dataUrl = e.dataUrl;
      this.settleCard(id, c);
    } else if (e.kind === 'case-edits') {
      this.onEdits(e.suitcase ?? null, e.result ?? '');
    }
  }

  private run(json: string): void {
    try {
      this.controller.runJavaScript(sendScript([json])).catch(() => { /* 页面没好 */ });
    } catch (e) { /* 控制器还没绑上 */ }
  }
}
