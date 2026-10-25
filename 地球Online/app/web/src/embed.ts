/** 嵌入模式：给 iOS WKWebView / 鸿蒙 Web 组件用。页面里有两层：首页的地球（GlobeView + 宇宙背景）与某一天的世界（World），
 *  原生通过 window.EarthWorld.send 发消息（ShellToEmbed 由这里处理，其余 NativeToWorld 交给世界层），
 *  回传走 webkit.messageHandlers.world（iOS）/ harmonyBridge.postMessage（鸿蒙）/ androidBridge.postMessage（安卓）/ 父窗口 postMessage。界面（卡片、按钮）都在原生那边。 */
import { World } from "../../shared/world/world.ts";
import { GlobeView, easeOut } from "../../shared/world/globe.ts";
import { CITY_JSON } from "./cities.ts";
import { tripToGlobe } from "./globe-data.ts";
import { dayScene } from "./world-instance.ts";
import { mountBackdrop, type Backdrop } from "./backdrop.ts";
import { importRoutePage } from "../../shared/import/route-page.ts";
import { isShellMessage, type NativeToWorld, type WorldToNative, type ShellToEmbed, type EmbedToShell } from "../../shared/spec/bridge.ts";
import type { Palette, Trip } from "../../shared/spec/types.ts";
import { applyTokens, platform } from "./shape.ts";
import { cssVars, SPACE_BG } from "../../shared/world/tokens.ts";
import { getLocale } from "../../shared/i18n/index.ts";
import { SuitcaseScene } from "../../shared/world/suitcase-scene.ts";
import { DEFAULT_AVATAR } from "../../shared/world/hero.ts";
import { outfitFor } from "./outfit.ts";
import { packLocal } from "../../shared/planner/pack.ts";
import { hiddenId } from "../../shared/algo/suitcase.ts";
import { ItemIcons, type IconRef } from "../../shared/world/item-icons.ts";
import { searchCase, caseGroups, toggleEntry, type CaseContext, type CaseEntry } from "../../shared/algo/case-search.ts";
import type { PackedExtra, ExtraKind } from "../../shared/planner/protocol.ts";
import { souvenirName } from "../../shared/geo/souvenirs.ts";
import { t, setLocale, type MsgKey } from "../../shared/i18n/index.ts";
import { pickLocale } from "./locale.ts";
import { callCore } from "../../shared/core.ts";
import { exportLongImage } from "./export.ts";
import { makeCard } from "./case-cards.ts";

declare global { interface Window { EarthWorld?: unknown; harmonyBridge?: { postMessage(s: string): void }; androidBridge?: { postMessage(s: string): void }; webkit?: { messageHandlers?: { world?: { postMessage(s: string): void } } } } }

setLocale(pickLocale(undefined));   // 界面语言：原生壳在地址上带 ?lang=（地图标签、物件名、清单都按它；D94 之前一直是中文）
applyTokens();   // 字体、字阶、玻璃等变量（标签用得到）
const base = import.meta.env.BASE_URL;
/** 天色：夜里标签换深色玻璃（与网页应用同一套令牌），地球外的底色跟着换 */
function applySky(p: "day" | "dusk" | "night") {
  const r = document.documentElement; r.dataset.sky = p; r.dataset.theme = p === "night" ? "dark" : "light";
  for (const [k, v] of Object.entries(cssVars(p === "night", getLocale(), platform()))) r.style.setProperty(k, v);
  r.style.setProperty("--space-bg", SPACE_BG[p]);
}
const worldHost = document.getElementById("world")!; const globeHost = document.getElementById("globe")!; const caseHost = document.getElementById("suitcase")!;
// ?mode=suitcase：只要行李箱（iOS 的日记页用），地球与某一天的世界都不建
const suitcaseOnly = new URLSearchParams(location.search).get("mode") === "suitcase";
// 行李箱（D75 / D78）：合上的书的总结，第一次要用时再建
let caseScene: SuitcaseScene | null = null;
// 清单（D84）：图标渲染器与最近一次 show-suitcase 的书、「AI 加的」候选（case-search / case-toggle 用）
let icons: ItemIcons | null = null; let caseTrip: Trip | null = null; let caseExtras: PackedExtra[] = [];
const caseCtx = (): CaseContext | null => (caseTrip ? { trip: caseTrip, extras: caseExtras, locale: getLocale() } : null);
const iconRefOf = (e: CaseEntry): IconRef => e.type === "souvenir" ? { type: "souvenir", id: e.id } : e.type === "extra" ? { type: "extra", kind: e.id as ExtraKind } : { type: "landmark", ref: e.ref ?? { name: e.id }, seed: e.seed ?? 0 };
/** 给一组格子配图：先把内存里有的填上立刻回一次，剩下的渲染完再回一次 */
function withIcons<T extends { icon?: string }>(rows: { row: T; ref: IconRef }[], post1: (complete: boolean) => void) {
  icons ??= new ItemIcons({ size: 96, pixelRatio: 2 }); icons.beginPass();
  const missing = rows.filter(({ row, ref }) => { const hit = icons!.peek(ref); if (hit) row.icon = hit; return !hit; });
  post1(!missing.length); if (!missing.length) return;
  void Promise.all(missing.map(({ row, ref }) => icons!.get(ref).then((u) => { row.icon = u; }).catch(() => undefined))).then(() => post1(true));
}
const world: World | null = suitcaseOnly ? null : new World(worldHost, { assetBase: base, cities: CITY_JSON, transparent: true });
const worldBd: Backdrop | null = suitcaseOnly ? null : mountBackdrop(worldHost, "sea", "day");
const post = (m: WorldToNative | EmbedToShell) => {
  const s = JSON.stringify(m);
  window.harmonyBridge?.postMessage?.(s);
  window.androidBridge?.postMessage?.(s);   // 安卓（D93）：addJavascriptInterface 注入的对象
  window.webkit?.messageHandlers?.world?.postMessage?.(s);
  if (window.parent !== window) window.parent.postMessage({ earthOnline: m }, "*");
};
world?.on(post);

// 首页地球（第一次要用时再建）
let globe: GlobeView | null = null; let globeBd: Backdrop | null = null; let phase: "day" | "dusk" | "night" = "night";
let trips: Trip[] = [];
/** 最近一次 show-day：长图把世界层借去逐天渲染，渲染完要把这一天建回来 */
let lastShowDay: Extract<ShellToEmbed, { kind: "show-day" }> | null = null;
let exporting = false;
function ensureGlobe(): GlobeView {
  if (globe) return globe;
  globeBd = mountBackdrop(globeHost, "sea", phase); globeBd.setMode("space");
  const g = new GlobeView(globeHost, base, {
    pickBook: (id) => post({ kind: "book-tapped", id }),
    pickDay: (id, dayIndex) => post({ kind: "day-tapped", id, dayIndex }),
    planted: (ids) => post({ kind: "flags-planted", ids }),
    moved: (c) => { globeBd?.parallax(Math.sin((c.lng * Math.PI) / 180) * 0.8, Math.max(-1, Math.min(1, c.lat / 60))); const d = g.screenDisk(); globeBd?.orbit(d.x, d.y, d.r, -c.lng * 0.2); },
  });
  g.setPhase(phase); globe = g; return g;
}
function show(which: "globe" | "day" | "suitcase") {
  globeHost.hidden = which !== "globe"; worldHost.hidden = which !== "day"; caseHost.hidden = which !== "suitcase";
  if (which === "globe") ensureGlobe().setActive(true); else globe?.setActive(false);
  if (which !== "suitcase") caseScene?.pause();
}

function handleShell(m: ShellToEmbed) {
  switch (m.kind) {
    case "show-globe": show("globe"); break;
    case "show-day": {
      lastShowDay = m; show("day"); const sc = dayScene(m.trip, m.dayIndex); const day = m.trip.days[m.dayIndex];
      world?.send({ kind: "load-plate", city: sc.geo ? "geo" : day.city, route: sc.route, seed: m.trip.seed, dayIndex: m.dayIndex, geo: sc.geo }); break;
    }
    case "set-trips": trips = m.trips; ensureGlobe().setBooks(trips.map(tripToGlobe)); break;
    case "focus-home": ensureGlobe().focusHome(m.animate, [m.lat, m.lng]); break;
    case "focus-book": ensureGlobe().focusBook(m.id, m.animate); break;
    case "focus-day": ensureGlobe().focusDay(m.id, m.dayIndex, m.animate); break;
    case "fly-to": ensureGlobe().flyTo({ lat: m.lat, lng: m.lng, alt: m.alt, tilt: 0, heading: 0 }, 1000, undefined, 0.6, easeOut); break;   // 新建旅程选了地方：1 秒、只减速，跟手
    case "set-home": ensureGlobe().setHome(m.home); break;
    case "set-footprints": ensureGlobe().setFootprints(m.flags, m.fresh); break;
    case "set-insets": { const i = { left: m.left, bottom: m.bottom, right: m.right, top: m.top }; globe?.setInsets(i); world?.setInsets(i); break; }
    case "set-sky": phase = m.phase; globe?.setPhase(m.phase); globeBd?.setPhase(m.phase); world?.setPhase(m.phase); worldBd?.setPhase(m.phase); applySky(m.phase); break;   // 某一天的世界夜里也换（D85）
    case "set-palette": world?.setPalette(m.palette); worldBd?.setPalette(m.palette); break;
    case "mark-visited": world?.markVisited(m.entryId, m.visited); break;
    case "pick-point": ensureGlobe().pickPoint(m.on ? (lat, lng) => post({ kind: "point-picked", lat, lng }) : null); break;
    case "show-suitcase": {
      show("suitcase"); caseScene ??= new SuitcaseScene(caseHost, { assetBase: base });
      // 「AI 加的」那几样：原生给了就用原生的（它可以自己问服务），没给用本机规则；照片卡的图（dataUrl）先解码再装箱
      const extras = m.extras ?? packLocal(m.trip, { tripsCount: Math.max(1, trips.length), visitedTotal: 0 }, getLocale());
      const scene = caseScene; const decode = (c: { id: string; dataUrl: string }) => new Promise<[string, HTMLImageElement]>((res) => { const im = new Image(); im.onload = () => res([c.id, im]); im.onerror = () => res([c.id, im]); im.src = c.dataUrl; });
      void Promise.all((m.cards ?? []).map(decode)).then((pairs) => {
        if (caseScene !== scene) return; scene.show(m.trip, m.avatar ?? DEFAULT_AVATAR, outfitFor(m.trip), extras, m.style ?? m.avatar?.suitcase, new Map(pairs));
        // 装好了告诉原生箱子里有什么（id 是藏东西用的 id），原生的清单据此列出来；类 emoji 的图标渲染好后再发一次带图的（D84）
        caseTrip = m.trip; caseExtras = extras;
        const c = scene.contents!; const loc = getLocale();
        type Row = { id: string; type: "landmark" | "souvenir" | "extra" | "card"; key: string; label: string; icon?: string };
        const items: Row[] = [
          ...c.landmarks.map((l): Row => ({ id: hiddenId.landmark(l.name), type: "landmark", key: l.name, label: l.name })),
          ...c.souvenirs.map((s): Row => ({ id: hiddenId.souvenir(s.item, s.place), type: "souvenir", key: s.item ?? s.place, label: souvenirName(s.item, loc) ?? t("case.snack") })),
          ...scene.extras.map((e): Row => ({ id: hiddenId.extra(e.kind), type: "extra", key: e.kind, label: t(`case.extra.${e.kind}` as MsgKey) })),
          ...c.cards.map((x): Row => { const im = pairs.find(([pid]) => pid === x.id)?.[1]; return { id: hiddenId.card(x.id), type: "card", key: x.id, label: x.label ?? t("case.photo"), icon: im ? cardThumb(im) : undefined }; }),
        ];
        const refs = [
          ...c.landmarks.map((l, i) => ({ row: items[i], ref: { type: "landmark", ref: l.ref, seed: m.trip.seed + i } as IconRef })),
          ...c.souvenirs.map((s, i) => ({ row: items[c.landmarks.length + i], ref: { type: "souvenir", id: s.item, place: s.place } as IconRef })),
          ...scene.extras.map((e, i) => ({ row: items[c.landmarks.length + c.souvenirs.length + i], ref: { type: "extra", kind: e.kind } as IconRef })),
        ];
        withIcons(refs, () => { if (caseScene === scene) post({ kind: "suitcase-contents", items: items.map((r) => ({ ...r })) }); });
      });
      break;
    }
    case "case-search": {
      const ctx = caseCtx(); if (!ctx) break; const query = m.query;
      const groups = searchCase(query, ctx);
      const rows = groups.flatMap((g) => g.entries.map((e) => ({ row: e as CaseEntry & { icon?: string }, ref: iconRefOf(e) })));
      withIcons(rows, (complete) => post({ kind: "case-results", query, complete, groups: groups.map((g) => ({ id: g.id, label: g.label, entries: g.entries.map((e) => { const { type, id, boxId, label, sub, inBox, mine } = e; return { type, id, boxId, label, sub, inBox, mine, icon: (e as { icon?: string }).icon }; }) })) }));
      break;
    }
    case "case-toggle": {
      const ctx = caseCtx(); if (!ctx) break;
      const entry = caseGroups(ctx).flatMap((g) => g.entries).find((e) => e.type === m.type && e.id === m.id); if (!entry) break;
      const r = toggleEntry(entry, ctx);
      post({ kind: "case-edits", suitcase: Object.keys(r.edits).length ? r.edits : null, result: r.result });
      break;
    }
    case "export-long-image": {   // 长图（D96）：借世界层逐天渲染，拼好回 PNG；渲染完把原来那一天建回来。一次只做一张
      const id = m.requestId;
      if (!world || exporting) { post({ kind: "long-image", requestId: id, error: world ? "busy" : "no world" }); break; }
      exporting = true;
      void exportLongImage(m.trip, (text) => post({ kind: "long-image-progress", requestId: id, text }), world)
        .then(blobToDataUrl)
        .then((dataUrl) => post({ kind: "long-image", requestId: id, dataUrl }))
        .catch((e) => post({ kind: "long-image", requestId: id, error: e instanceof Error ? e.message : String(e) }))
        .finally(() => { exporting = false; if (lastShowDay) { const d = lastShowDay; const sc = dayScene(d.trip, d.dayIndex); world?.send({ kind: "load-plate", city: sc.geo ? "geo" : d.trip.days[d.dayIndex].city, route: sc.route, seed: d.trip.seed, dayIndex: d.dayIndex, geo: sc.geo }); } });
      break;
    }
    case "make-card": {   // 照片小卡（D99）：网页那套本机抠图，三端同一个结果（iOS 有 Vision 时先用 Vision）
      const id = m.requestId;
      void Promise.resolve().then(() => makeCard(dataUrlToBlob(m.dataUrl)))
        .then(async (made) => post({ kind: "card-made", requestId: id, card: made.card, dataUrl: await blobToDataUrl(made.blob) }))
        .catch((e) => post({ kind: "card-made", requestId: id, error: e instanceof Error ? e.message : String(e) }));
      break;
    }
    case "core-call": {   // 公用的领域核心（D94）：原生按名字调 shared/core.ts 里的纯函数
      try { post({ kind: "core-result", requestId: m.requestId, value: callCore(m.fn, m.args, m.locale) }); }
      catch (e) { post({ kind: "core-result", requestId: m.requestId, error: e instanceof Error ? e.message : String(e) }); }
      break;
    }
    case "export-suitcase": { if (caseScene) post({ kind: "suitcase-image", dataUrl: caseScene.dataUrl() }); break; }
    case "import-page": {
      try { const r = importRoutePage(m.html, {}); post({ kind: "import-result", requestId: m.requestId, trips: r.trips, warnings: r.warnings }); }
      catch (e) { post({ kind: "import-result", requestId: m.requestId, trips: [], warnings: [], error: (e as Error).message }); }
      break;
    }
  }
}
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
/** data:<mime>;base64,… → Blob（不走 fetch：自定义源里 fetch data: 不一定放行） */
function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(","); if (!url.startsWith("data:") || comma < 0) throw new Error("not a data url");
  const head = url.slice(5, comma), mime = head.split(";")[0] || "application/octet-stream";
  const bin = atob(url.slice(comma + 1)); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
/** 照片卡在清单里的小图（112px，PNG）：原生的「箱子里的」那一排要有图，不能传整张 */
function cardThumb(im: HTMLImageElement): string | undefined {
  if (!im.naturalWidth || !im.naturalHeight) return undefined;
  const cv = document.createElement("canvas"); cv.width = cv.height = 112; const g = cv.getContext("2d"); if (!g) return undefined;
  const k = Math.min(100 / im.naturalWidth, 100 / im.naturalHeight); const w = im.naturalWidth * k, h = im.naturalHeight * k;
  g.drawImage(im, (112 - w) / 2, (112 - h) / 2, w, h); return cv.toDataURL("image/png");
}
function send(msg: string | NativeToWorld | ShellToEmbed) {
  const m = typeof msg === "string" ? (JSON.parse(msg) as NativeToWorld | ShellToEmbed) : msg;
  if (isShellMessage(m)) handleShell(m); else world?.send(m as NativeToWorld);
}

window.EarthWorld = {
  send,
  setPalette: (p: Palette) => world?.setPalette(p),
  markVisited: (id: string, v: boolean) => world?.markVisited(id, v),
};
window.addEventListener("message", (e) => { if (e.data && e.data.earthOnlineSend) send(e.data.earthOnlineSend); });
applySky(phase); if (!suitcaseOnly) show("globe");
post({ kind: "ready" });   // 原生可能在 World 构造时发的第一次 ready 之后才开始监听，这里再发一次
