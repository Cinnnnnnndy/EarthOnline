/** 开屏 = 一颗大地球（平面插画天空里的三维地球）。书是地球上的标记；点一本书 / 新建一本书 → 飞进去（zoom in）；
 *  书的视图里按天看路线，选一天 → 当天卡片 → 「潜入」这一天的微缩世界。 */
import { h, toast, sheet, field } from "../ui.ts";
import { store, addDays } from "../store.ts";
import { go } from "../router.ts";
import { globe, showGlobe, handlers, globeBackdrop } from "../globe-instance.ts";
import { tripToGlobe, todayIndex, today as localToday } from "../globe-data.ts";
import { THEMES, type Trip, type TransportEntry } from "../../../shared/spec/types.ts";
import { searchPlaces, type Place } from "../../../shared/geo/gazetteer.ts";
// 书的函数里 t 是那本书（Trip），取文字用 tr
import { getLocale, t, t as tr, duration, monthDay, dateRange, plain } from "../../../shared/i18n/index.ts";
import { themeName } from "../../../shared/algo/world-spec.ts";
import { outfitFor } from "../outfit.ts";
import { pushToGlobe, openFootprints, currentFootprints, countryLookup } from "../footprints-ui.ts";
import { footprintStats } from "../../../shared/algo/footprints.ts";
import { bottomSheet } from "../bsheet.ts";
import { icon } from "../../../shared/world/icons.ts";
import { placeTodos } from "../../../shared/algo/todos.ts";
import { placeKind } from "../place-kind.ts";
import { openVoiceComposer, buildPlannerContext, getPlannerEndpoint } from "../voice/composer.ts";
import { withTripSlot, canAddTrip, canAiPlan } from "../quota.ts";
import { openPaywall } from "../paywall.ts";
import { journeyState, departLabel } from "../../../shared/algo/journey.ts";
import { buildTimeline, itemOf } from "../../../shared/algo/timeline.ts";
import { guessPlace } from "../../../shared/world/daylight.ts";
import { modeName } from "../../../shared/algo/transport.ts";
import { paintDreamButton } from "../backdrop-paint.ts";
import { ticket, tearAndGo } from "../ticket.ts";
import { shape, paneInsets } from "../shape.ts";
import { skyPhase, onPhase } from "../theme.ts";

const md = (iso: string) => monthDay(iso);
const span = (a: string, b: string) => dateRange(a, b);
const ic = (n: string, sz = 20) => h("span", { class: "icw", html: icon(n, sz) });

/** 地球页（首页 + 一本书）。手机习惯：地球铺满，顶上两三个浮动圆按钮，内容都在底部抽屉里；展开态抽屉停靠成左页。 */
/** 导入的标题里常有「A · B」，显示时换成当前语言的逗号（数据不改；plain 见 shared/i18n） */
export function HomePage(p: Record<string, string>, root: HTMLElement) {
  const G = globe(); showGlobe(true); document.body.classList.remove("diving");
  G.setBooks(store.trips.map(tripToGlobe));
  const trip = p.id ? store.trip(p.id) : undefined;
  G.setAvatar(store.avatar, outfitFor(trip)); globeBackdrop().setMode("space");
  handlers.pickBook = (id) => go(`/book/${id}`);
  pushToGlobe();
  handlers.planted = (ids) => { store.markPlanted(ids); if (!trip && ids.length) toast(t("home.planted", { n: ids.length })); };
  const bar = h("div", { class: "fab-bar", "data-avoid": "1" });
  const tkDock = h("div", { class: "tk-dock", "data-avoid": "1", hidden: true });   // 书的页面：这趟旅程的票浮在抽屉上方，不放在抽屉这张大卡片上
  let lastInsets: { left: number; bottom: number } = { left: 0, bottom: 0 };
  const applyInsets = () => { tkDock.style.bottom = `${lastInsets.bottom + 12}px`; G.setInsets({ left: lastInsets.left, bottom: lastInsets.bottom + (tkDock.hidden ? 0 : tkDock.offsetHeight + 12) }); };
  const sh = bottomSheet({ fit: true, onLayout: (i) => { lastInsets = i; applyInsets(); } });
  const dock = h("div", { class: "home-dock", "data-avoid": "1" });            // 首页：随内容大小的票 + 悬浮的新建按钮（不用抽屉）
  const ui = h("div", { class: "globe-ui" }, bar, sh.el, tkDock, dock); root.append(ui);
  const layoutDock = () => { if (dock.hidden) return; if (shape() !== "compact") G.setInsets(paneInsets()); else { const r = dock.getBoundingClientRect(); G.setInsets({ left: 0, bottom: r.height ? innerHeight - r.top + 8 : 0 }); } };   // 两页 / 三页 / 悬停：按分页让；一页：让出票的高度
  addEventListener("resize", layoutDock);
  // 第八轮去色：路线、针、新建按钮的底都按天色取（白天墨、夜里白），天色变了重画
  const offPhase = onPhase(() => { G.setBooks(store.trips.map(tripToGlobe)); dock.querySelector<HTMLButtonElement>(".dream-btn")?.style.setProperty("background-image", `url(${paintDreamButton(220, 56, 23, skyPhase() === "night")})`); });
  if (!trip) { renderHome(!!sessionStorageGet("visited")); sessionStorageSet("visited", "1"); }
  else renderBook(trip);
  store.ensureSamples(import.meta.env.BASE_URL).then((added) => { if (added) { G.setBooks(store.trips.map(tripToGlobe)); pushToGlobe(); if (!trip) renderHome(true); } });
  return { leave: () => { sh.destroy(); offPhase(); removeEventListener("resize", layoutDock); G.setInsets({ left: 0, bottom: 0 }); showGlobe(false); } };

  // ---------------- 首页：按用户旅程的阶段给东西（shared/algo/journey.ts）
  //  旅行中 → 直接是这趟旅程与今天；即将出发 → 倒计时与第一天；刚回来 → 写日记；空闲 → 地球对准家，主角是「新建旅程」
  function renderHome(animate = true) {
    sh.el.hidden = true; dock.hidden = false; tkDock.hidden = true;
    const j = journeyState(store.trips, localToday()); const home = store.home;
    const homeAt: [number, number] = home ? [home.lat, home.lng] : ((g) => [g.lat, g.lng] as [number, number])(guessPlace(new Date()));
    const fab = (n: string, label: string, fn: () => void) => h("button", { type: "button", "aria-label": label, title: label, onclick: fn }, ic(n, 19));
    bar.replaceChildren(h("span", { class: "wordmark" }, t("app.name")), h("span", { class: "grow" }),
      h("div", { class: "fab-group lg" },
        j.kind === "traveling" ? fab("plus", t("home.newTrip"), () => openNew("dest")) : null,
        fab("locate", t("home.recenter"), () => G.recenter()),   // D108：回正
        fab("list", t("home.allTrips"), openTrips), fab("import", t("home.importTrip"), () => openNew("import")),
        fab("flag", t("home.footprints"), () => openFootprints(() => renderHome(false))), fab("gear", t("common.settings"), () => go("/settings"))));
    const items: (HTMLElement | null)[] = [];
    // 每一趟旅程都是一张票（D74）：空闲时下一趟是一张小票，旅行中 / 要出发 / 刚回来是一张大票；点票面翻开这本书，撕票根做这一刻最要紧的事
    if (j.kind === "idle" && j.next) { const nt = j.next.trip; items.push(ticket(nt, { compact: true, status: { text: departLabel(j.next.inDays) }, onFace: () => go(`/book/${nt.id}`) })); }
    if (j.kind !== "traveling") items.push(dreamButton());
    if (j.kind === "traveling") items.push(travelingCard(j.trip, j.dayIndex));
    // 要出发了：一行要点是第一天（待办的提示跟着站点走，不汇总到这里）
    if (j.kind === "departing") { const first = j.trip.days[0];
      items.push(card(j.trip, { text: departLabel(j.inDays) }, [first ? `D1 · ${plain(first.title)}` : null], () => go(`/book/${j.trip.id}`))); }
    if (j.kind === "back") items.push(card(j.trip, { text: j.daysAgo <= 1 ? t("home.welcomeBack") : t("home.backDaysAgo", { n: j.daysAgo }) }, [], () => go(`/book/${j.trip.id}/end`), t("home.diary")));
    dock.replaceChildren(...items.filter(Boolean) as HTMLElement[]);
    requestAnimationFrame(layoutDock);
    if (j.kind === "traveling") G.focusBook(j.trip.id, animate);                           // 旅行中：直接看这趟的路线
    else if (j.kind === "departing") G.focusHome(animate, tripToGlobe(j.trip).center);       // 要出发了：整颗地球对准目的地
    else G.focusHome(animate, homeAt);                                                        // 其余：对准家
  }
  /** 首页的票：状态标签、标题、一两行要点；点票面翻开这本书，撕票根做这一刻最要紧的事（进入今天 / 查看 / 写日记） */
  function card(tp: Trip, status: { text: string; live?: boolean }, lines: (string | HTMLElement | null)[], fn: () => void, stubLabel?: string) {
    const el: HTMLElement = ticket(tp, { status, lines, stubLabel, onFace: () => go(`/book/${tp.id}`), onStub: () => tearAndGo(el, fn) });
    return el;
  }
  function travelingCard(t: Trip, di: number) {
    const d = t.days[di];
    return card(t, { text: tr("home.travelingDay", { n: d.index }), live: true }, [`D${d.index} · ${plain(d.title)}`],
      () => { document.body.classList.add("diving"); G.focusDay(t.id, di, true, () => G.dive(() => go(`/book/${t.id}/day/${di + 1}`))); });
  }
  function dreamButton() {
    const b = h("button", { type: "button", class: "dream-btn", onclick: () => openNew("dest") }, h("span", { html: icon("sparkle", 20) }), t("home.newTrip"));
    b.style.backgroundImage = `url(${paintDreamButton(220, 56, 23, skyPhase() === "night")})`; return b;
  }
  function openVoice() {
    // 免费版：每月 2 次 AI 规划（只有走规划服务的才算；离线规则不限）；生成这本书还要有一个行程名额
    if (getPlannerEndpoint() && !canAiPlan()) { openPaywall("ai"); return; }
    let counted = false;
    openVoiceComposer({
      context: buildPlannerContext({ locale: getLocale(), home: store.home, trips: store.trips }),
      onDraft: (r) => { if (r.source !== "local" && !counted) { counted = true; store.countAiPlan(); } },
      onCreate: (draft) => { withTripSlot(() => { const t = store.importTrip(draft); G.setBooks(store.trips.map(tripToGlobe)); go(`/book/${t.id}`); }); },
    });
  }
  function openTrips() {
    const trips = [...store.trips].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const s = sheet(t("home.allTrips"), h("div", { class: "tk-stack" }, trips.map((x) => { const b = tripToGlobe(x);
      return ticket(x, { compact: true, status: b.badge ? { text: b.badge, live: b.badgeKind === "live" } : undefined, onFace: () => { s.close(); go(`/book/${x.id}`); } }); })));
  }

  // ---------------- 一本书：天的列表 → 某一天的站点
  function renderBook(t: Trip) {
    dock.hidden = true; sh.el.hidden = false; sh.relayout();
    const book = tripToGlobe(t); const ti = todayIndex(t);
    bar.replaceChildren(h("button", { type: "button", class: "fab lg", "aria-label": tr("home.backToGlobe"), onclick: () => go("/") }, ic("back", 20)), h("span", { class: "grow" }),
      h("button", { type: "button", class: "fab lg", "aria-label": tr("home.diaryExport"), onclick: () => go(`/book/${t.id}/end`) }, ic("book")));
    const status = t.status === "closed" ? tr("home.statusEnded") : ti >= 0 ? tr("home.statusToday", { n: t.days[ti].index }) : book.badge ?? "";
    G.focusBook(t.id, true);
    handlers.pickDay = (_b, d) => showDay(d);
    showList();

    function showList() {
      const start = ti >= 0 ? ti : 0;
      // 这趟旅程的票浮在抽屉上方（不放在抽屉这张大卡片上）：撕票根 = 进入今天 / 进入第一天；抽屉里只有天的列表
      const tk: HTMLElement = ticket(t, { status: status ? { text: status, live: book.badgeKind === "live" } : undefined, stubLabel: ti >= 0 ? tr("home.enterToday") : tr("home.enter"),
        onStub: () => tearAndGo(tk, () => { G.focusDay(t.id, start, true, () => enter(start)); }) });
      tkDock.replaceChildren(tk); tkDock.hidden = false; requestAnimationFrame(applyInsets);
      sh.head.replaceChildren();
      sh.body.replaceChildren(...([
        h("div", { class: "list", style: { "--sep-left": "60px" } }, t.days.map((d, i) =>
          h("button", { type: "button", class: "row" + (i === ti ? " today" : ""), onclick: () => showDay(i) },
            h("span", { class: "lead auto" }, h("span", { class: "tg" + (i === ti ? " live" : "") }, `D${d.index}`)),
            h("span", { class: "main" }, h("span", { class: "tt" }, plain(d.title))),
            h("span", { class: "trail num" }, i === ti ? tr("home.todayDate", { date: md(d.date) }) : md(d.date))))),
      ].filter(Boolean) as HTMLElement[]));
      sh.foot.replaceChildren(); sh.refit();
      G.focusBook(t.id, true);
    }
    function showDay(i: number) {
      tkDock.hidden = true; applyInsets();
      const d = t.days[i]; G.focusDay(t.id, i, true); const tl = buildTimeline(d);
      sh.head.replaceChildren(h("div", { class: "ttl" },
        h("button", { type: "button", class: "tbtn", style: { marginLeft: "-6px", minHeight: "32px" }, onclick: showList }, ic("back", 18), tr("home.allDays")),
        h("h2", { class: "t-title" }, h("span", { class: "tg" }, `D${d.index}`), plain(d.title)),
        h("span", { class: "t-sub num" }, md(d.date))),
        h("button", { type: "button", class: "btn primary", onclick: () => enter(i) }, tr("home.enter")));
      const items: HTMLElement[] = []; let pend: TransportEntry[] = []; let seq = 0;
      for (const e of d.entries) {
        if (e.type === "transport") { pend.push(e); continue; }
        if (e.type !== "place") continue;
        if (pend.length) { const m = pend.reduce((s, x) => s + (x.durationMinutes ?? 0), 0); items.push(h("div", { class: "row leg" }, h("span", { html: icon("route", 14) }), m ? duration(m) : modeName(pend[0].mode))); }
        const pk = placeKind(e); seq += 1;
        const at = e.plannedStart ?? itemOf(tl, e.id)?.start;
        const td = placeTodos(e, t.startDate, localToday());   // 待办的提示跟着站点：名字旁边的小标签是数量，下面一行是最近的一件
        // 从上往下有顺序：左边是序号（和浮岛上的针一致），名字前是组图标
        items.push(h("div", { class: "row", style: { cursor: "default" } }, h("span", { class: "lead seq num" }, String(seq)),
          h("span", { class: "main" }, h("span", { class: "tt" }, h("span", { class: "kic", "aria-label": pk.label, html: icon(pk.icon, 14) }), e.name, td.open ? h("span", { class: "tg todo-tg", "aria-label": tr("todo.count", { n: td.open }) }, h("span", { html: icon("check", 12) }), String(td.open)) : null),
            td.next ? h("span", { class: "mt" }, tr("todo.next", { text: td.next.todo.text, date: md(td.next.due) })) : null),
          at ? h("span", { class: "trail num" }, at) : null));
        pend = [];
      }
      sh.body.replaceChildren(h("div", { class: "list itin", style: { "--sep-left": "54px" } }, items));
      sh.foot.replaceChildren(); sh.refit();
    }
    function enter(i: number) { document.body.classList.add("diving"); G.dive(() => { go(`/book/${t.id}/day/${i + 1}`); }); }
  }

  // ---------------- 新建 / 导入
  function openNew(tab: "dest" | "import") {
    const st = { place: null as Place | null, title: "", start: addDays(new Date().toISOString().slice(0, 10), 30), days: 5, theme: THEMES[0] as string };
    const q = h("input", { placeholder: t("new.searchPlaceholder"), autofocus: true });
    const sug = h("div", { class: "suggest" });
    // 搜索建议：输入后才出现，最多 5 个，一行一个地名
    const renderSug = () => { sug.replaceChildren(...(q.value.trim() ? searchPlaces(q.value, 5) : []).map((pl) => h("button", { type: "button", class: "sug" + (st.place === pl ? " on" : ""), onclick: () => { st.place = pl; q.value = pl.name; renderSug(); G.flyTo({ lat: pl.lat - 4, lng: pl.lng, alt: 0.55, tilt: 20, heading: 0 }, 1400); } }, pl.name))); sug.hidden = !sug.childElementCount; };
    q.oninput = renderSug; renderSug();
    const title = h("input", { placeholder: t("new.titlePlaceholder"), maxlength: 40 });
    const date = h("input", { type: "date", value: st.start }); const days = h("input", { type: "number", min: 1, max: 21, value: "5" });
    const themes = h("div", { class: "chips" }, THEMES.map((th) => h("button", { type: "button", class: th === st.theme ? "on" : "", onclick: (e: Event) => { st.theme = th; themes.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); } }, themeName(th))));
    const destPane = h("div", { class: "col" }, q, sug, title, h("div", { class: "row" }, field(t("new.start"), date), field(t("new.days"), days)), field(t("new.theme"), themes),
      h("button", { type: "button", class: "primary", onclick: () => {
        if (!st.place) return toast(t("new.pickFirst"));
        const place = st.place; const n = Math.max(1, Math.min(21, parseInt(days.value) || 5));
        withTripSlot(() => {   // 免费版同时最多 3 个没走完的行程（shared/billing/plans.ts）
          const nt = store.createTrip({ title: title.value.trim() || t("new.defaultTitle", { place: place.name, n }), destination: place.name, place, startDate: date.value || st.start, days: n, theme: st.theme });
          s.close(); G.setBooks(store.trips.map(tripToGlobe)); go(`/book/${nt.id}`);
        });
      } }, t("common.create")));
    const file = h("input", { type: "file", accept: ".html,.htm,.json,text/html,application/json" });
    const paste = h("textarea", { placeholder: t("new.pastePlaceholder") });
    const importPane = h("div", { class: "col" }, file, paste,
      h("button", { type: "button", class: "primary", onclick: async () => {
        let text = paste.value.trim(); if (!text && file.files?.[0]) text = await file.files[0].text(); if (!text) return toast(t("new.needInput"));
        if (!canAddTrip()) { s.close(); openPaywall("trips"); return; }   // 一页几个方案算一个名额，所以只看还有没有名额
        try {
          if (text.startsWith("{")) { let raw: unknown; try { raw = JSON.parse(text); } catch { throw new Error(t("common.importInvalid")); } const nt = store.importTrip(raw); s.close(); go(`/book/${nt.id}`); return; }
          const r = await store.importPage(text, import.meta.env.BASE_URL);
          s.close(); G.setBooks(store.trips.map(tripToGlobe)); toast(r.warnings.length ? t("new.importedWarn", { n: r.trips.length, warning: r.warnings[0] }) : t("new.imported", { n: r.trips.length })); go(`/book/${r.trips[0].id}`);
        } catch (e) { toast(t("common.importFailed", { reason: (e as Error).message })); }
      } }, t("common.import")));
    const tabs = h("div", { class: "seg tabs2", role: "tablist" });
    // 语音与 AI：说出想去哪、几天、什么时候，AI 追问缺的，再给一本草稿书（离线时用本机规则）
    const voiceRow = h("button", { type: "button", class: "voice-entry", onclick: () => { s.close(); openVoice(); } },
      h("span", { class: "ve-mic", html: icon("mic", 18) }), h("span", { class: "ve-text" }, t("new.voice")), h("span", { class: "icw chev", html: icon("chev", 14) }));
    const body = h("div", { class: "col" }, voiceRow, tabs, destPane, importPane);
    const setTab = (x: "dest" | "import") => { destPane.hidden = x !== "dest"; importPane.hidden = x !== "import"; tabs.replaceChildren(h("button", { type: "button", class: x === "dest" ? "on" : "", onclick: () => setTab("dest") }, t("new.tabDest")), h("button", { type: "button", class: x === "import" ? "on" : "", onclick: () => setTab("import") }, t("new.tabImport"))); };
    setTab(tab);
    const s = sheet(t("home.newTrip"), body);
  }
}
function sessionStorageGet(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* 忽略 */ } }
