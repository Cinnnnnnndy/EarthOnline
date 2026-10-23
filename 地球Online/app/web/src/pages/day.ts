/** 某一天 = 主界面：微缩世界铺满整屏，翻页、下一站、行程面板、捏人、控制都悬浮其上（判断 D19 / D20） */
import { h, toast, sheet, field, select, fmtDate } from "../ui.ts";
import { store, type NewEntry } from "../store.ts";
import { go } from "../router.ts";
import { worldInstance, worldHost, dayScene, worldBackdrop } from "../world-instance.ts";
import { outfitFor } from "../outfit.ts";
import { locate, PLACES } from "../../../shared/geo/gazetteer.ts";
import { geoFrameOfDay } from "../../../shared/algo/geo.ts";
import { openAvatarSheet } from "../avatar-sheet.ts";
import { plateOf, cityName, PLATE_CITY_IDS } from "../cities.ts";
import { placeKind } from "../place-kind.ts";
import { openPlaceTodos } from "../todos-ui.ts";
import { MAP_APPS, mapLink, navMode } from "../../../shared/geo/maplinks.ts";
import { today } from "../globe-data.ts";
import { placeTodos } from "../../../shared/algo/todos.ts";
import { buildTimeline, itemOf, type Timeline } from "../../../shared/algo/timeline.ts";
import { deriveWorldSpec } from "../../../shared/algo/world-spec.ts";
import { modeName, classifyTransport } from "../../../shared/algo/transport.ts";
import { bottomSheet } from "../bsheet.ts";
import { icon } from "../../../shared/world/icons.ts";
import { parseDuration } from "../../../shared/algo/duration.ts";
import { STYLES, styleName } from "../../../shared/world/style.ts";
import { t, duration, km, list, names, monthDay, stops, plain, plainNames, type MsgKey } from "../../../shared/i18n/index.ts";
import type { Route } from "../../../shared/algo/route.ts";
import type { Entry, PlaceEntry, TransportEntry, LodgingEntry, Palette, PostLevel, TransportMode, PlaceCategory } from "../../../shared/spec/types.ts";
import { layout, screenInfo } from "../shape.ts";
import type { WorldToNative } from "../../../shared/spec/bridge.ts";

const postName = (p: PostLevel) => t(`post.${p}`);

export function DayPage(p: Record<string, string>, root: HTMLElement) {
  const trip0 = store.trip(p.id); if (!trip0) { go("/"); return; }
  const trip = trip0;
  const dayIndex = Math.max(0, Math.min(trip.days.length - 1, (parseInt(p.n) || 1) - 1));
  const day = () => trip.days[dayIndex];
  const world = worldInstance(); const host = worldHost();
  let route: Route = dayScene(trip, dayIndex).route; let timeline: Timeline = buildTimeline(day());
  const ui = { edit: false, follow: true, pitch: 30 as 30 | 90, hidden: false };

  // ---------- 骨架
  const el = {
    page: h("div", { class: "day", "data-layout": layout().state, "data-post": store.settings.post }),
    post: h("div", { class: "post" }, h("div", { class: "tilt top" }), h("div", { class: "tilt bottom" }), h("div", { class: "vig" }), h("div", { class: "grain" })),
    dayTitle: h("h2", { class: "t-title" }), dayDate: null as unknown as HTMLElement, pages: h("div", { class: "pages" }),
    hudV: h("span", { class: "v" }), hudW: h("span", { class: "w" }), hudK: h("span", { class: "k" }, t("day.nextStop")),
    itin: h("div", { class: "list itin" }),
    caption: h("div", { class: "caption" }), play: h("button", { type: "button", title: t("day.pauseResume"), "aria-label": t("day.pauseResume"), html: icon("pause", 17) }), viewBtn: h("button", { type: "button", title: t("day.viewAngle"), "aria-label": t("day.viewAngle") }), followBtn: h("button", { type: "button", title: t("day.seeWholeDay"), "aria-label": t("day.seeWholeDay") }),
    postBtn: h("button", { type: "button", class: "desk", title: t("day.postLevel"), "aria-label": t("day.postLevel") }), palBtn: h("button", { type: "button", class: "desk", title: t("day.palette"), "aria-label": t("day.palette") }), heroName: h("span", { class: "n" }),
    timeline: h("div", { class: "timeline" }), showUi: h("button", { type: "button", class: "chip show-ui", title: t("day.showUi"), "aria-label": t("day.showUi"), html: icon("eye", 18) }),
    hudIc: h("span", { class: "lead soft", html: icon("pin", 16) }),
  };
  /** 站点在行程列表里的图标：交通一种（route）、住宿一种（hotel）、其余按六组（人文 / 自然 / 休闲 / 吃喝购物）——见 landmark-kinds 的 GROUP_ICON */
  const stopIcon = (entryId: string, category?: string) => { const e = day().entries.find((x) => x.id === entryId); return e && e.type === "place" ? placeKind(e).icon : category === "hotel" ? "hotel" : "route"; };
  const nav = (n: number) => { if (n < 1) go(`/book/${trip.id}`); else if (n > trip.days.length) go(`/book/${trip.id}/end`); else { host.classList.remove("flipfx"); void host.offsetWidth; host.classList.add("flipfx"); go(`/book/${trip.id}/day/${n}`); } };
  // 手机 App 的骨架：左上返回、右侧一列控制（玻璃竖排）、内容全在底部抽屉；展开态抽屉停靠成左页
  const sh = bottomSheet({ fit: true, onLayout: (i) => world.setInsets(i) });
  const prevBtn = h("button", { type: "button", class: "fab sm", "aria-label": t("day.prevDay"), html: icon("back", 16), onclick: () => nav(dayIndex) });
  const nextBtn = h("button", { type: "button", class: "fab sm", "aria-label": t("day.nextDay"), html: icon("chev", 16), onclick: () => nav(dayIndex + 2) });
  el.dayDate = h("span", { class: "t-sub num" });
  sh.head.append(h("div", { class: "ttl" }, el.dayTitle, el.dayDate), prevBtn, nextBtn);
  sh.body.append(h("div", { class: "list next" }, h("div", { class: "row", style: { cursor: "default" } }, el.hudIc, h("span", { class: "main" }, h("span", { class: "tt" }, el.hudK, el.hudV), h("span", { class: "mt" }, el.hudW)))),
    el.itin);   // 抽屉里只有两样：下一站一行、从上往下编号的行程（和书里的一天同一个列表）；时间轴条与「行程」小标题去掉了，和列表重复
  el.page.append(host, el.post,
    h("div", { class: "fab-bar" }, h("button", { type: "button", class: "fab lg", "aria-label": t("day.backToBook"), html: icon("back", 20), onclick: () => nav(0) }), h("span", { class: "grow" })),
    h("div", { class: "fab-col" }, h("div", { class: "pill lg" }, el.play, el.followBtn,
      h("button", { type: "button", "aria-label": t("day.replay"), html: icon("restart", 19), onclick: () => { world.send({ kind: "restart" }); world.rig.intro(1.6); renderAll(); } }),
      h("button", { type: "button", "aria-label": t("avatar.title"), html: icon("person", 19), onclick: () => openAvatarSheet((a) => { world.send({ kind: "set-avatar", avatar: a }); el.heroName.textContent = a.name; }) }))),
    sh.el, el.caption, el.showUi);
  el.showUi.onclick = () => setHidden(false);
  const setHidden = (v: boolean) => { ui.hidden = v; el.page.classList.toggle("ui-hidden", v); };
  root.append(el.page); host.hidden = false; worldBackdrop().setMode("sky"); document.body.classList.remove("diving");
  // 底部一排：左边是编辑态的开关（上移 / 下移 / 编辑 / 删除出现在每一行右边），右边是「添加」（站点 / 交通 / 住宿三选一）
  const editBtn = h("button", { type: "button", class: "ibtn plain", "aria-label": t("day.editMode"), title: t("day.editMode"), "aria-pressed": "false", html: icon("edit", 16),
    onclick: () => { ui.edit = !ui.edit; editBtn.classList.toggle("on", ui.edit); editBtn.setAttribute("aria-pressed", String(ui.edit)); renderQuest(); } });
  const addBtn = h("button", { type: "button", class: "btn glass", onclick: () => {
    const s = sheet(t("common.add"), h("div", { class: "list" }, ([["place", "pin", t("day.addStop")], ["transport", "route", t("day.addTransport")], ["lodging", "hotel", t("day.addStay")]] as const).map(([k, ic, label]) =>
      h("button", { type: "button", class: "row", onclick: () => { s.close(); showForm(k); } }, h("span", { class: "lead soft", html: icon(ic, 16) }), h("span", { class: "main" }, h("span", { class: "tt" }, label)), h("span", { class: "icw chev", html: icon("chev", 14) })))));
  } }, t("common.add"));
  sh.foot.append(h("div", { class: "btn-row" }, h("span", { style: { marginRight: "auto" } }, editBtn), addBtn));
  el.heroName.textContent = store.avatar.name;

  // ---------- 世界
  const spec = deriveWorldSpec(trip); let first = true;
  const loadWorld = () => {
    const sc = dayScene(trip, dayIndex); route = sc.route; timeline = buildTimeline(day());
    world.setSeason(spec.season, spec.decorDensity);
    world.send({ kind: "load-plate", city: sc.geo ? "geo" : day().city, route, seed: trip.seed, dayIndex, geo: sc.geo });
    world.setCharacter(store.avatar, outfitFor(trip)); world.send({ kind: "set-view", pitch: ui.pitch, follow: ui.follow }); world.send({ kind: "set-post", level: store.settings.post });
    if (first) { world.rig.intro(3.4); first = false; }
    world.playback.playing = true; el.play.innerHTML = icon("pause", 17);
    if (route.unresolved.length) toast(t("day.unresolved", { names: names(route.unresolved) }));
    renderAll();
  };
  const onMsg = (m: WorldToNative) => {
    if (m.kind === "hero-arrived") { const s = route.stops[m.stopIndex]; renderQuest(); renderHud(); if (s && !s.visited) toast(t("day.arrived", { name: s.name }), { label: t("day.checkIn"), onClick: () => setVisited(s.entryId, true) }); }
    else if (m.kind === "segment-started") { if (m.mode !== "walk") { const sg = route.segments[m.segmentIndex]; showCaption(list([modeName(m.mode as TransportMode), m.label, sg?.durationMinutes ? duration(sg.durationMinutes) : ""])); } renderQuest(); renderHud(); }
    else if (m.kind === "day-finished") { renderHud(); renderQuest(); toast(route.lodging ? t("day.atLodging", { name: route.lodging.name }) : t("day.dayDone"), { label: dayIndex + 1 < trip.days.length ? t("day.turnNext") : t("day.seeBackCover"), onClick: () => nav(dayIndex + 2) }, 4000); }
    else if (m.kind === "building-tapped") openDetail(m.landmark);
    else if (m.kind === "empty-tapped") setHidden(!ui.hidden);
    else if (m.kind === "ready" || m.kind === "plate-loaded") renderAll();
  };
  const offMsg = world.on(onMsg);
  if (STYLES[store.settings.palette] !== world.style) world.setPalette(store.settings.palette);
  loadWorld();

  // ---------- 渲染悬浮层
  function renderAll() { renderChip(); renderHud(); renderQuest(); renderCtrls(); renderTimeline(); }
  /** 底部时间轴：站点按路程比例排开，中间是交通方式与里程；小人图标跟着走 */
  function renderTimeline() {
    const L = Math.max(1, route.path.length - 1); const tl = el.timeline; tl.replaceChildren();
    const track = h("div", { class: "tl-track" }); const marker = h("div", { class: "tl-hero" }); track.append(marker); tl.append(track);
    route.segments.forEach((sg) => { if (sg.end - sg.start < 2) return; const mid = ((sg.start + sg.end) / 2 / L) * 100; track.append(h("span", { class: "tl-seg", style: { left: `${mid}%` }, title: sg.distanceKm ? list([sg.label, km(sg.distanceKm)]) : sg.label, html: icon("route", 12) })); });
    let lastNamed = -99;
    const seen = new Set<string>();
    route.stops.forEach((s, i) => {
      const left = (s.arrive / L) * 100; const repeat = seen.has(s.name); seen.add(s.name); const named = !repeat && left - lastNamed > 9; if (named) lastNamed = left;
      track.append(h("button", { type: "button", class: `tl-node${world.playback.reached.has(i) ? " done" : ""}${s.visited ? " visited" : ""}${repeat ? " repeat" : ""}`, style: { left: `${left}%` }, title: s.name, onclick: () => { world.send({ kind: "goto-stop", stopIndex: i }); renderHud(); } },
        h("i", { html: icon(stopIcon(s.entryId, s.category), 12) }), !named ? null : h("span", {}, h("b", {}, s.time ?? ""), s.name.length > 9 ? s.name.slice(0, 8) + "…" : s.name)));
    });
    const move = () => { if (!tl.isConnected) return; marker.style.left = `${(world.playback.t / L) * 100}%`; requestAnimationFrame(move); }; move();
  }
  function renderChip() {
    el.dayTitle.textContent = `D${day().index} ${plain(day().title)}`; el.dayDate.textContent = monthDay(day().date); prevBtn.toggleAttribute("disabled", dayIndex === 0); nextBtn.toggleAttribute("disabled", dayIndex === trip.days.length - 1);
  }
  function renderHud() {
    const pb = world.playback; const ni = pb.nextStopIndex;
    if (!route.stops.length || route.stops.every((x) => x.category === "hotel")) { el.hudIc.innerHTML = icon("pin", 16); el.hudK.textContent = t("day.today"); el.hudV.textContent = t("day.noStops"); el.hudW.textContent = t("day.addFirstHint"); return; }
    if (ni < 0) { el.hudIc.innerHTML = icon("hotel", 16); el.hudK.textContent = pb.finished ? t("day.dayDone") : t("day.lastLeg"); el.hudV.textContent = route.lodging ? t("home.stayAt", { name: route.lodging.name }) : t("day.return"); el.hudW.textContent = route.lodging?.offPlate ? t("day.stayOtherCity") : t("day.allArrived", { n: route.stops.length }); return; }
    const s = route.stops[ni], sg = route.segments[ni], ti = itemOf(timeline, s.entryId);
    el.hudIc.innerHTML = icon(stopIcon(s.entryId, s.category), 16);
    el.hudK.textContent = ni === 0 && pb.t === 0 ? t("day.firstStop") : t("day.nextStop"); el.hudV.textContent = s.name;
    el.hudW.innerHTML = `${icon("route", 13)} ${esc(list([sg.label, sg.durationMinutes ? duration(sg.durationMinutes) : "", ti ? t("day.eta", { time: ti.start }) : ""]))}`;
  }
  /** 图标按钮（编辑态的上移 / 下移 / 编辑 / 删除） */
  const ib = (ic: string, label: string, fn: () => void, o: { disabled?: boolean; danger?: boolean } = {}) =>
    h("button", { type: "button", class: "ibtn sm" + (o.danger ? " danger" : " plain"), "aria-label": label, title: label, html: icon(ic, 14), disabled: !!o.disabled, onclick: (ev: Event) => { ev.stopPropagation(); fn(); } });
  /** 行程列表（第八轮末）：和书里的一天同一个列表——序号、组图标、名字、状态与待办的标签、右边时间；交通是缩进的一行；编辑态右边换成四个图标按钮 */
  function renderQuest() {
    const d = day(); const pb = world.playback;
    const ni = pb.nextStopIndex; const nextEntry = ni >= 0 ? route.stops[ni].entryId : null;
    let travelIds = new Set<string>(); if (ni >= 0) travelIds = new Set(route.segments[ni].entryIds);
    const n = d.entries.length;
    const editTools = (e: Entry, idx: number) => h("span", { class: "trail tools" },
      ib("up", t("day.moveUp"), () => { store.moveEntry(trip.id, dayIndex, e.id, -1); loadWorld(); }, { disabled: idx === 0 }),
      ib("down", t("day.moveDown"), () => { store.moveEntry(trip.id, dayIndex, e.id, 1); loadWorld(); }, { disabled: idx === n - 1 }),
      ib("edit", t("common.edit"), () => showForm(e.type, undefined, e)),
      ib("trash", t("common.delete"), () => { store.removeEntry(trip.id, dayIndex, e.id); loadWorld(); }, { danger: true }));
    const tag = (text: string, live = false) => h("span", { class: "tg todo-tg" + (live ? " live" : "") }, text);
    let seq = 0;
    el.itin.classList.toggle("editing", ui.edit);
    el.itin.replaceChildren(...d.entries.map((e, idx) => {
      if (e.type === "place") {
        seq += 1;
        const si = route.stops.findIndex((s) => s.entryId === e.id); const reached = si >= 0 && pb.reached.has(si); const ti = itemOf(timeline, e.id);
        const td = placeTodos(e, trip.startDate); const pk = placeKind(e);
        const current = nextEntry === e.id && pb.paused === false && pb.speed === 0 && reached;
        return h("button", { type: "button", class: "row" + (reached ? " done" : "") + (e.visited ? " visited" : "") + (current ? " current" : ""),
          onclick: () => { if (ui.edit) return; if (si >= 0) { world.send({ kind: "goto-stop", stopIndex: si }); renderHud(); } openDetail(e.id); } },
          h("span", { class: "lead seq num" }, String(seq)),
          h("span", { class: "main" }, h("span", { class: "tt" }, h("span", { class: "kic", "aria-label": pk.label, html: icon(pk.icon, 14) }), e.name,
            e.visited ? tag(t("day.checkedIn"), true) : reached ? tag(t("day.reached")) : si < 0 ? tag(t("day.notFound")) : null,
            td.open ? h("span", { class: "tg todo-tg", "aria-label": t("todo.count", { n: td.open }) }, h("span", { html: icon("check", 12) }), String(td.open)) : null),
            td.next ? h("span", { class: "mt" }, t("todo.next", { text: td.next.todo.text, date: monthDay(td.next.due) })) : null),
          ui.edit ? editTools(e, idx) : h("span", { class: "trail num" }, e.plannedStart ?? (ti ? ti.start : "")));
      }
      if (e.type === "transport") {
        return h("div", { class: "row leg" + (travelIds.has(e.id) && pb.speed > 0 ? " current" : "") }, h("span", { html: icon("route", 14) }),
          h("span", { class: "grow" }, list([e.label || modeName(e.mode), e.durationMinutes ? duration(e.durationMinutes) : ""])), ui.edit ? editTools(e, idx) : null);
      }
      return h("div", { class: "row" + (pb.finished ? " current" : "") }, h("span", { class: "lead soft", html: icon("hotel", 16) }),
        h("span", { class: "main" }, h("span", { class: "tt" }, e.name, pb.finished ? tag(t("day.reached")) : null)), ui.edit ? editTools(e, idx) : null);
    }));
  }
  function renderCtrls() {
    el.play.onclick = () => { const pb = world.playback; pb.playing = !pb.playing; world.send({ kind: pb.playing ? "play" : "pause" }); el.play.innerHTML = icon(pb.playing ? "pause" : "play", 17); };
    el.viewBtn.innerHTML = icon(ui.pitch === 30 ? "top" : "tilt", 17); el.viewBtn.onclick = () => { ui.pitch = ui.pitch === 30 ? 90 : 30; world.send({ kind: "set-view", pitch: ui.pitch }); renderCtrls(); };
    el.followBtn.innerHTML = icon(ui.follow ? "map" : "locate", 17); el.followBtn.title = ui.follow ? t("day.seeWholeDay") : t("day.followHero"); el.followBtn.onclick = () => { ui.follow = !ui.follow; world.send({ kind: "set-view", follow: ui.follow }); renderCtrls(); };
    el.postBtn.innerHTML = `${icon("sparkle", 14)} ${esc(postName(store.settings.post))}`; el.postBtn.onclick = () => { const order: PostLevel[] = ["high", "medium", "low"]; const next = order[(order.indexOf(store.settings.post) + 1) % 3]; store.setSettings({ post: next }); el.page.dataset.post = next; world.send({ kind: "set-post", level: next }); renderCtrls(); };
    el.palBtn.innerHTML = icon("palette", 17); el.palBtn.title = t("day.paletteName", { name: styleName(store.settings.palette) }); el.palBtn.onclick = () => { const order: Palette[] = ["sea", "warm", "dusk"]; const next = order[(order.indexOf(store.settings.palette) + 1) % 3]; store.setSettings({ palette: next }); document.documentElement.dataset.palette = next; world.setPalette(next); worldBackdrop().setPalette(next); renderCtrls(); };
  }
  let captionTimer = 0;
  function showCaption(text: string) { el.caption.textContent = text; el.caption.classList.add("show"); clearTimeout(captionTimer); captionTimer = window.setTimeout(() => el.caption.classList.remove("show"), 2800); }

  // ---------- 编辑：站点 / 交通 / 住宿
  const plate = () => plateOf(day().city);
  function showForm(kind: Entry["type"], afterId?: string, existing?: Entry) {
    const dl = (id: string, names: string[]) => h("datalist", { id }, names.map((n) => h("option", { value: n })));
    const fr = day().city === "geo" ? geoFrameOfDay(day()) : null;
    const near = fr ? PLACES.filter((p) => Math.abs(p.lat - fr.lat0) < 3 && Math.abs(p.lng - fr.lng0) < 6).map((p) => p.name) : [];
    const placeNames = fr ? near : plate().landmarks.filter((l) => l.name && l.role !== "lodging").map((l) => l.name);
    const lodgingNames = fr ? near : plate().landmarks.filter((l) => l.role === "lodging").map((l) => l.name);
    const f: Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = {};
    let body: HTMLElement[];
    if (kind === "place") {
      const ex = existing as PlaceEntry | undefined;
      f.name = h("input", { placeholder: t("day.placePlaceholder", { examples: names(placeNames.slice(0, 3)) }), list: "dl-place", value: ex?.name ?? "" });
      f.time = h("input", { type: "time", value: ex?.plannedStart ?? "" });
      f.cat = select((["sight", "food", "shop", "station", "airport", "other"] as PlaceCategory[]).map((value) => ({ value, label: t(`cat.${value}` as MsgKey) })), ex?.category ?? "sight", () => {});
      body = [dl("dl-place", placeNames), field(t("day.placeName"), f.name), h("div", { class: "row" }, field(t("day.plannedArrival"), f.time), field(t("day.category"), f.cat))];
    } else if (kind === "transport") {
      const ex = existing as TransportEntry | undefined;
      f.label = h("input", { placeholder: t("day.transportPlaceholder"), list: "dl-mode", value: ex?.label ?? "" });
      f.dur = h("input", { placeholder: t("day.durationPlaceholder"), value: ex?.durationMinutes ? duration(ex.durationMinutes) : "" });
      body = [dl("dl-mode", t("day.modeSuggestions").split("|")), h("div", { class: "row" }, field(t("day.mode"), f.label), field(t("day.duration"), f.dur))];
    } else {
      const ex = existing as LodgingEntry | undefined;
      f.name = h("input", { placeholder: t("day.lodgingPlaceholder", { names: names(lodgingNames) }), list: "dl-lodging", value: ex?.name ?? "" });
      body = [dl("dl-lodging", lodgingNames), field(t("day.lodging"), f.name)];
    }
    const submit = () => {
      let entry: NewEntry;
      if (kind === "place") {
        const name = (f.name as HTMLInputElement).value.trim(); if (!name) { toast(t("day.nameRequired")); return false; }
        entry = { type: "place", name, category: (f.cat as HTMLSelectElement).value as PlaceEntry["category"], plannedStart: (f.time as HTMLInputElement).value || undefined };
        if (day().city === "geo") {
          const hit = locate(name); const prev = (existing as PlaceEntry | undefined)?.geo;
          const anchor = day().entries.find((e): e is PlaceEntry => e.type === "place" && !!e.geo)?.geo;
          if (hit) (entry as PlaceEntry).geo = { lat: hit.lat, lng: hit.lng };
          else if (prev) (entry as PlaceEntry).geo = prev;
          else if (anchor) { const a = Math.random() * Math.PI * 2; (entry as PlaceEntry).geo = { lat: anchor.lat + Math.sin(a) * 0.02, lng: anchor.lng + Math.cos(a) * 0.04 }; (entry as PlaceEntry).notes = t("day.pendingNote"); toast(t("day.notInGazetteer")); }
        }
      }
      else if (kind === "transport") { const label = (f.label as HTMLInputElement).value.trim() || modeName("walk"); entry = { type: "transport", label, mode: classifyTransport(label), durationMinutes: parseDuration((f.dur as HTMLInputElement).value) ?? undefined }; }
      else { const name = (f.name as HTMLInputElement).value.trim(); if (!name) { toast(t("day.lodgingRequired")); return false; } entry = { type: "lodging", name }; }
      if (existing) store.updateEntry(trip.id, dayIndex, existing.id, entry); else store.addEntry(trip.id, dayIndex, entry, afterId);
      if (kind === "lodging") store.setDayMeta(trip.id, dayIndex, { lodging: (entry as LodgingEntry).name.split(" · ")[0] });
      loadWorld(); return true;
    };
    // 表单在自己的抽屉里（第八轮末：不再嵌在列表中间）；已有条目还能在它后面插交通、挪到前一天 / 后一天
    const extra = existing ? h("div", { class: "btn-row", style: { justifyContent: "flex-start" } },
      h("button", { type: "button", class: "tbtn", onclick: () => { fs.close(); showForm("transport", existing.id); } }, t("day.insertTransport")),
      dayIndex > 0 ? h("button", { type: "button", class: "tbtn", onclick: () => { fs.close(); store.moveEntryToDay(trip.id, dayIndex, existing.id, dayIndex - 1); loadWorld(); toast(t("day.movedPrev")); } }, t("day.toPrev")) : null,
      dayIndex < trip.days.length - 1 ? h("button", { type: "button", class: "tbtn", onclick: () => { fs.close(); store.moveEntryToDay(trip.id, dayIndex, existing.id, dayIndex + 1); loadWorld(); toast(t("day.movedNext")); } }, t("day.toNext")) : null) : null;
    const fs = sheet(existing ? t("common.edit") : afterId ? t("day.insertAfter") : t("day.appendEnd"), h("div", { class: "col" }, ...body, extra,
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn primary", onclick: () => { if (submit()) fs.close(); } }, existing ? t("common.save") : t("common.add")))));
    requestAnimationFrame(() => (f.name ?? f.label)?.focus());
  }
  function editDay() {
    const d = day(); const title = h("input", { value: d.title }); const city = select(PLATE_CITY_IDS.map((value) => ({ value, label: cityName(value) ?? value })), d.city, () => {}); const lodging = h("input", { value: d.lodging ?? "", placeholder: t("day.lodgingShortPlaceholder") });
    const s = sheet(t("day.pageSettings"), h("div", { class: "col" }, field(t("day.titleField"), title), field(t("day.plateCity"), city), field(t("day.tonightStay"), lodging),
      h("div", { class: "row" }, h("button", { type: "button", class: "primary", onclick: () => { store.setDayMeta(trip.id, dayIndex, { title: title.value.trim() || d.title, city: city.value, lodging: lodging.value.trim() || undefined }); s.close(); loadWorld(); } }, t("common.save")))));
  }

  // ---------- 导航：跳到手机上的地图 App（Apple / Google / 高德 / 百度），方式按到这一站的交通来
  function openNav(name: string, pt: { lat: number; lng: number }, mode?: TransportMode) {
    const ns = sheet(t("nav.title"), h("div", { class: "list" }, MAP_APPS.map((app) =>
      h("button", { type: "button", class: "row", onclick: () => { ns.close(); window.open(mapLink(app, { name, ...pt }, navMode(mode)), "_blank", "noopener"); } },
        h("span", { class: "lead soft", html: icon("map", 16) }), h("span", { class: "main" }, h("span", { class: "tt" }, t(`nav.${app}` as MsgKey))), h("span", { class: "icw chev", html: icon("chev", 14) })))));
  }

  // ---------- 站点详情 / 地标详情
  function setVisited(entryId: string, v: boolean) { store.updateEntry(trip.id, dayIndex, entryId, { visited: v, visitedAt: v ? new Date().toISOString() : undefined }); world.markVisited(entryId, v); renderQuest(); toast(v ? t("day.checkedInToast") : t("day.uncheckedToast")); }
  /** 站点详情（第八轮精简）：标题是名字；一行类型与时间，一行怎么去；备注框；底下一排小按钮（删除靠左，打卡是唯一的主按钮） */
  function openDetail(idOrLandmark: string) {
    const d = day(); let e = d.entries.find((x) => x.id === idOrLandmark) as PlaceEntry | undefined;
    if (!e) { const stop = route.stops.find((s) => s.landmark === idOrLandmark); e = stop ? (d.entries.find((x) => x.id === stop.entryId) as PlaceEntry) : undefined; }
    if (!e) {   // 不在行程里的地标：一句话 + 一个主按钮
      const lm = plate().landmarks.find((l) => l.name === idOrLandmark); if (!lm) return;
      const s = sheet(lm.name, h("div", { class: "col" }, h("p", { class: "t-sub", style: { margin: "0 4px" } }, t("day.landmarkOf", { city: cityName(d.city) ?? plainNames(trip.destination) })),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn primary", onclick: () => { if (d.entries.some((x) => x.type === "place")) store.addEntry(trip.id, dayIndex, { type: "transport", mode: "walk", label: modeName("walk") }); store.addEntry(trip.id, dayIndex, { type: lm.role === "lodging" ? "lodging" : "place", name: lm.name, category: lm.role === "airport" ? "airport" : "sight" } as NewEntry); s.close(); loadWorld(); toast(t("day.addedToast", { name: lm.name })); } }, t("day.addToToday")))));
      return;
    }
    const entry = e; const si = route.stops.findIndex((s) => s.entryId === entry.id); const ti = itemOf(timeline, entry.id); const sg = si >= 0 ? route.segments[si] : null; const pk = placeKind(entry);
    const hit = entry.geo ? null : locate(entry.name); const pt = entry.geo ?? (hit ? { lat: hit.lat, lng: hit.lng } : null);   // 导航要真实坐标
    const when = ti ? `${ti.start} – ${ti.end}` : entry.plannedStart ?? "";
    const line = (ic: string, text: string, trail: string) => h("div", { class: "row", style: { cursor: "default" } }, h("span", { class: "lead soft", html: icon(ic, 16) }), h("span", { class: "main" }, h("span", { class: "tt" }, text)), trail ? h("span", { class: "trail num" }, trail) : null);
    // 待办与备注各占一行，点进去再看（第八轮续：不默认摊开）；关掉子抽屉后重画这两行
    const cur = () => (store.trip(trip.id)?.days[dayIndex]?.entries.find((x) => x.id === entry.id) as PlaceEntry | undefined) ?? entry;
    const openRow = (ic: string, main: HTMLElement, onclick: () => void) => h("button", { type: "button", class: "row", onclick }, h("span", { class: "lead soft", html: icon(ic, 16) }), main, h("span", { class: "icw chev", html: icon("chev", 14) }));
    const listEl = h("div", { class: "list", style: { "--sep-left": "54px" } });
    const openNotes = () => {
      const ta = h("textarea", { placeholder: t("day.notesPlaceholder"), value: cur().notes ?? "", rows: 4, oninput: () => store.updateEntry(trip.id, dayIndex, entry.id, { notes: ta.value }) });
      const ns = sheet(t("day.notes"), h("div", { class: "col" }, ta, h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn primary", onclick: () => ns.close() }, t("common.done")))), { onClose: drawList });
      requestAnimationFrame(() => ta.focus());
    };
    function drawList() {
      const p = cur(); const td = placeTodos(p, trip.startDate, today());
      const rows: (HTMLElement | null)[] = [
        // 一行：组图标 + 类型与名胜的标签 + 时间（标签：同一类信息用同一种小标签）
        h("div", { class: "row", style: { cursor: "default" } }, h("span", { class: "lead soft", html: icon(pk.icon, 16) }),
          h("span", { class: "main" }, h("span", { class: "tgs" }, h("span", { class: "tg" }, pk.label), pk.famous ? h("span", { class: "tg live" }, t("home.famous")) : null)), when ? h("span", { class: "trail num" }, when) : null),
        sg ? line("route", sg.label || modeName(sg.mode), sg.durationMinutes ? duration(sg.durationMinutes) : "") : null,
        openRow("check", h("span", { class: "main" }, h("span", { class: "tt" }, t("todo.title"), td.open ? h("span", { class: "tg todo-tg", "aria-label": t("todo.count", { n: td.open }) }, h("span", { html: icon("check", 12) }), String(td.open)) : null),
          td.next ? h("span", { class: "mt" }, t("todo.next", { text: td.next.todo.text, date: monthDay(td.next.due) })) : null), () => openPlaceTodos(trip, dayIndex, entry.id, () => { drawList(); renderQuest(); })),
        openRow("edit", h("span", { class: "main" }, p.notes ? h("span", { class: "tt" }, p.notes) : h("span", { class: "tt", style: { color: "var(--c-ink2)" } }, t("day.addNote"))), openNotes),
      ];
      listEl.replaceChildren(...rows.filter((x): x is HTMLElement => !!x));
    }
    drawList();
    const s = sheet(entry.name, h("div", { class: "col" }, listEl,
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "ibtn danger", style: { marginRight: "auto" }, "aria-label": t("common.delete"), title: t("common.delete"), html: icon("trash", 16), onclick: () => { store.removeEntry(trip.id, dayIndex, entry.id); s.close(); loadWorld(); } }),
        h("button", { type: "button", class: "ibtn", "aria-label": t("common.edit"), title: t("common.edit"), html: icon("edit", 16), onclick: () => { showForm("place", undefined, entry); s.close(); } }),
        pt ? h("button", { type: "button", class: "tbtn", onclick: () => openNav(entry.name, pt, sg?.mode) }, h("span", { html: icon("map", 18) }), t("nav.go")) : null,
        h("button", { type: "button", class: "btn primary", onclick: () => { setVisited(entry.id, !entry.visited); s.close(); } }, entry.visited ? t("day.uncheck") : t("day.checkIn")))));
  }

  // ---------- 布局态、键盘、离开
  const onResize = () => { const l = layout(); el.page.dataset.layout = l.state; const si = screenInfo(); world.send({ kind: "set-layout", layout: l.state, width: innerWidth, height: innerHeight, segments: si.segments, posture: si.posture }); };   // 布局态（D90）：shared/spec/layout.ts 的规则
  const onKey = (ev: KeyboardEvent) => { if ((ev.target as HTMLElement).matches("input,textarea,select")) return; if (ev.key === "ArrowLeft") nav(dayIndex); else if (ev.key === "ArrowRight") nav(dayIndex + 2); else if (ev.key === " ") { ev.preventDefault(); el.play.click(); } };
  window.addEventListener("resize", onResize); window.addEventListener("keydown", onKey);
  const tick = window.setInterval(() => { renderHud(); el.timeline.querySelectorAll(".tl-node").forEach((n, i) => n.classList.toggle("done", world.playback.reached.has(i))); }, 700);
  return { leave: () => { sh.destroy(); world.setInsets({ left: 0, bottom: 0 }); offMsg(); world.send({ kind: "pause" }); window.removeEventListener("resize", onResize); window.removeEventListener("keydown", onKey); clearInterval(tick); host.hidden = true; document.body.append(host); } };
}
function esc(x: string) { return x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }
