/** 封底：统计、日记（自动生成、可改）、导出长图、合上书 */
import { h, toast, fmtDate, dateRange } from "../ui.ts";
import { store } from "../store.ts";
import { go } from "../router.ts";
import { tripStats } from "../../../shared/algo/stats.ts";
import { generateDiary } from "../../../shared/algo/diary.ts";
import { exportLongImage, download } from "../export.ts";
import { SuitcaseScene } from "../../../shared/world/suitcase-scene.ts";
import { outfitFor } from "../outfit.ts";
import { souvenirName } from "../../../shared/geo/souvenirs.ts";
import { packLocal, packExtras } from "../../../shared/planner/pack.ts";
import { SUITCASE_STYLE } from "../../../shared/algo/suitcase.ts";
import { SUITCASE_STYLES, type SuitcaseStyle, type CaseEdits } from "../../../shared/spec/types.ts";
import { makeCard, saveCardImage, deleteCardImage, loadCardBitmaps, decodeImage } from "../case-cards.ts";
import { sheet } from "../ui.ts";
import type { PackedExtra, ExtraKind } from "../../../shared/planner/protocol.ts";
import { ItemIcons, type IconRef } from "../../../shared/world/item-icons.ts";
import { caseGroups, searchCase, toggleEntry, CASE_SCENES, type CaseContext, type CaseEntry } from "../../../shared/algo/case-search.ts";
import { t, plain, plainNames, getLocale, type MsgKey } from "../../../shared/i18n/index.ts";
import { icon } from "../../../shared/world/icons.ts";

export function EpiloguePage(p: Record<string, string>, root: HTMLElement): { leave?: () => void } | void {
  const trip0 = store.trip(p.id); if (!trip0) { go("/"); return; }
  let caseScene: SuitcaseScene | null = null; let caseIcons: ItemIcons | null = null;
  const trip = trip0;
  const st = tripStats(trip);
  // 导出是通用操作：图标按钮（进度写在 title 里，导完有提示）
  const exportBtn = h("button", { type: "button", class: "ibtn", "aria-label": t("epi.export"), title: t("epi.export"), html: icon("export", 16), onclick: async () => {
    exportBtn.disabled = true; try { const blob = await exportLongImage(trip, (s) => { exportBtn.title = s + "…"; }); download(blob, t("epi.fileName", { title: trip.title })); toast(t("epi.exported")); } catch (e) { toast(t("epi.exportFailed", { reason: (e as Error).message })); } finally { exportBtn.disabled = false; exportBtn.title = t("epi.export"); }
  } });
  const closed = trip.status === "closed"; const countries = trip.destination.split(/ · |、|，/).filter(Boolean).length;
  root.replaceChildren(h("div", { class: "spg" },
    h("header", { class: "navbar" }, h("button", { type: "button", class: "tbtn", onclick: () => go(`/book/${trip.id}/day/${trip.days.length}`) }, h("span", { html: icon("back", 18) }), t("epi.lastDay")), h("h1", { class: "t-headline" }, t("epi.title")), exportBtn),
    h("h2", { class: "t-title", style: { margin: "4px 4px 2px" } }, trip.title),
    h("p", { class: "t-sub", style: { margin: "0 4px 12px" } }, dateRange(trip.startDate, trip.endDate)),
    // 这一趟的行李箱（D75 / D78）：世界层里的 3D 箱子——名胜小模型、特色物件、穿搭小人；导出是图标按钮
    suitcase(),
    h("div", { class: "list stat-grid" }, stat(String(st.days), t("epi.statDays")), stat(String(st.places), t("epi.statStops")), stat(String(st.visited), t("epi.statVisited")), stat(String(countries), trip.destination.includes(" · ") || /、/.test(trip.destination) ? t("epi.statCountries") : t("epi.statDestinations"))),
    h("section", { class: "group" }, h("div", { class: "gh" }, t("epi.diaries")),
      h("div", { class: "list" }, trip.days.map((d, i) => {
        // 日记平时只露两行，点一下展开成可编辑的文本框（第七轮：少出现大段文字）
        const text = () => d.diary ?? generateDiary(trip, d);
        const ta = h("textarea", { class: "diary-ta", value: text(), hidden: true, oninput: () => { store.setDayMeta(trip.id, i, { diary: ta.value }); prev.textContent = ta.value; } });
        const prev = h("button", { type: "button", class: "dr-prev", onclick: () => { prev.hidden = true; ta.hidden = false; ta.focus(); } }, text());
        return h("div", { class: "diary-row" },
          h("div", { class: "dr-head" }, h("span", { class: "tt" }, h("span", { class: "tg" }, t("new.dayN", { n: i + 1 })), plain(d.title)), h("span", { class: "t-sub num" }, fmtDate(d.date)),
            h("button", { type: "button", class: "ibtn sm plain", "aria-label": t("epi.rewrite"), title: t("epi.rewrite"), html: icon("restart", 14), onclick: () => { store.setDayMeta(trip.id, i, { diary: undefined }); ta.value = prev.textContent = generateDiary(trip, d); toast(t("epi.restored")); } })),
          prev, ta);
      }))),
    h("section", { class: "group" }, h("div", { class: "list" },
      h("button", { type: "button", class: "row", onclick: () => { navigator.clipboard?.writeText(JSON.stringify(trip, null, 2)); toast(t("epi.copied")); } }, h("span", { class: "lead soft", html: icon("import", 16) }), h("span", { class: "main" }, h("span", { class: "tt" }, t("epi.copyData"))), h("span", { class: "trail" }, "JSON")),
      h("button", { type: "button", class: "row", onclick: () => { store.updateTrip(trip.id, (x) => { x.status = closed ? "planning" : "closed"; }); toast(closed ? t("epi.reopened") : t("epi.closedToast")); go("/"); } }, h("span", { class: "lead soft", html: icon("book", 16) }), h("span", { class: "main" }, h("span", { class: "tt" }, closed ? t("epi.reopen") : t("epi.close")))))),
  ));
  function stat(v: string, k: string) { return h("div", { class: "stat" }, h("b", {}, v), h("span", {}, k)); }
  function suitcase() {
    const host = h("div", { class: "case-3d", role: "img", "aria-label": t("case.title") });
    // 「让 AI 装箱」（D79）：先按本机规则加几样，立刻能画；有规划服务地址就再去问一次，回来换掉
    const profile = { tripsCount: store.trips.length, visitedTotal: store.trips.reduce((n, x) => n + x.days.reduce((m, d) => m + d.entries.filter((e) => e.type === "place" && e.visited).length, 0), 0) };
    const extras0 = packLocal(trip, profile, getLocale());
    // 箱子的样式（D81）：存在小人的档案里（我的箱子）；?case=ink 这类参数只给截图用
    const dbg = new URLSearchParams(location.search).get("case") as SuitcaseStyle | null;
    let style: SuitcaseStyle = dbg && (SUITCASE_STYLES as readonly string[]).includes(dbg) ? dbg : store.avatar.suitcase ?? "sand";
    try { caseScene = new SuitcaseScene(host, { assetBase: import.meta.env.BASE_URL }); caseScene.show(trip, store.avatar, outfitFor(trip), extras0, style); }
    catch { return h("span"); }   // 没有 WebGL 就不放箱子
    let images = new Map<string, TexImageSource>(); let extrasNow = extras0;
    const loadImages = () => loadCardBitmaps(trip.suitcase?.cards ?? []).then((m) => { images = m; caseScene?.setImages(m); });
    void loadImages();
    const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
    const swatches = SUITCASE_STYLES.map((id) => {
      const b = h("button", { type: "button", class: "case-sw" + (id === style ? " on" : ""), role: "radio", "aria-checked": String(id === style), "aria-label": t(`case.style.${id}` as MsgKey), title: t(`case.style.${id}` as MsgKey),
        onclick: () => { style = id; store.setAvatar({ suitcase: id }); caseScene?.setStyle(id); swatches.forEach((x, i) => { const on = SUITCASE_STYLES[i] === id; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); }); } });
      b.style.setProperty("--sw", rgb(SUITCASE_STYLE[id].shell)); b.style.setProperty("--sw2", rgb(SUITCASE_STYLE[id].trim));   // 自定义属性要用 setProperty
      return b;
    });
    const styleRow = h("div", { class: "case-styles", role: "radiogroup", "aria-label": t("case.styleLabel") }, h("span", { class: "t-sub" }, t("case.styleLabel")), ...swatches);
    const capLine = h("p", { class: "t-sub case-cap" }); const extrasLine = h("p", { class: "t-sub case-cap" });
    const extraName = (kind: string) => t(`case.extra.${kind}` as MsgKey);
    const renderCaption = () => {
      const c = caseScene!.contents!;
      const mine = caseScene!.extras.filter((e) => e.mine);
      capLine.textContent = plainNames([...c.landmarks.map((l) => l.name), ...c.souvenirs.map((s) => souvenirName(s.item, getLocale()) ?? t("case.snack")), ...mine.map((e) => extraName(e.kind)), ...c.cards.map((x) => x.label ?? t("case.photo"))].join(" · "));
      const ex = caseScene!.extras.filter((e) => !e.mine); extrasLine.hidden = !ex.length;
      extrasLine.textContent = ex.length ? t("case.extrasLine", { items: plainNames(ex.map((e) => t("case.extraItem", { name: extraName(e.kind), reason: e.reason })).join(" · ")) }) : "";
    };
    renderCaption();
    const endpoint = localStorage.getItem("earth-online:planner-endpoint") ?? "";   // 与语音规划同一个地址（voice/composer.ts）
    if (endpoint) packExtras(trip, profile, getLocale(), { endpoint }).then((r) => { if (r.source === "remote" && caseScene) { extrasNow = r.extras; caseScene.setExtras(r.extras); renderCaption(); renderEdit(); } }).catch(() => {});

    // 增减箱子里的东西（D82 / D84）：面板里是一格一格类 emoji 的图标（item-icons.ts：库里的模型从一个好角度渲染出来），点一格拿出来；
    // 「清单」弹层照仓库主人发来的那条视频：一个搜索框（打一句话或一个词）、几枚场景标签、下面按组一格一格的东西，点一格放进去或拿出来
    const icons = new ItemIcons(); caseIcons = icons;
    const editPanel = h("div", { class: "case-edit", hidden: true });
    const edits = (): CaseEdits => trip.suitcase ?? {};
    const ctx = (): CaseContext => ({ trip, extras: extrasNow, locale: getLocale() });
    const setEdits = (fn: (e: CaseEdits) => void) => { store.updateTrip(trip.id, (x) => { x.suitcase = x.suitcase ?? {}; fn(x.suitcase); if (!Object.keys(x.suitcase).length) delete x.suitcase; }); refresh(); };
    let listSheet: { refresh: () => void } | null = null;
    const refresh = () => { caseScene?.update(trip, extrasNow, images); renderCaption(); renderEdit(); listSheet?.refresh(); };
    const iconRefOf = (e: CaseEntry): IconRef => e.type === "souvenir" ? { type: "souvenir", id: e.id } : e.type === "extra" ? { type: "extra", kind: e.id as ExtraKind } : { type: "landmark", ref: e.ref ?? { name: e.id }, seed: e.seed ?? 0 };
    /** 一格：图 + 名字（+ 副标题）；在箱子里的右上角一个勾（面板里是叉：点了就拿出来） */
    const tile = (e: CaseEntry, onTap: () => void, remove = false) => {
      const img = h("img", { class: "ci-img", alt: "", draggable: false });
      const label = e.inBox ? t("case.removeItem", { name: e.label }) : t("case.putIn", { name: e.label });
      const b = h("button", { type: "button", class: "case-item" + (e.inBox ? " in" : "") + (remove ? " rm" : ""), "aria-pressed": String(e.inBox), "aria-label": label, title: label, onclick: onTap },
        h("span", { class: "ci-pic" }, h("span", { class: "ci-ph" }), img, h("span", { class: "ci-badge", html: icon(remove ? "close" : "check", 12) })),
        h("span", { class: "ci-label" }, e.label), remove || !e.sub ? null : h("span", { class: "ci-sub" }, e.sub));
      const ref = iconRefOf(e); const hit = icons.peek(ref);
      if (hit) { img.src = hit; b.classList.add("ready"); } else icons.get(ref).then((u) => { img.src = u; b.classList.add("ready"); }).catch(() => b.classList.add("noicon"));
      return b;
    };
    /** 照片卡的一格：图从 IndexedDB 读出来的位图画到小画布上 */
    const cardTile = (id: string, label: string, onRemove: () => void) => {
      const cv = h("canvas", { class: "ci-img", width: 120, height: 120 }); const im = images.get(id) as ImageBitmap | HTMLImageElement | undefined;   // case-cards.ts 解码出来的就是这两种
      if (im) { const g = cv.getContext("2d")!; const w = im.width, hh = im.height; const k = Math.min(104 / w, 104 / hh); g.drawImage(im, (120 - w * k) / 2, (120 - hh * k) / 2, w * k, hh * k); }
      const name = t("case.removeItem", { name: label });
      return h("button", { type: "button", class: "case-item in rm ready", "aria-label": name, title: name, onclick: onRemove }, h("span", { class: "ci-pic" }, cv, h("span", { class: "ci-badge", html: icon("close", 12) })), h("span", { class: "ci-label" }, label));
    };
    /** 点一格：放进去 / 拿出来（规则在 shared/algo/case-search.ts：后排最多 4、前排最多 3，满了提示） */
    const tap = (e: CaseEntry) => {
      const r = toggleEntry(e, ctx()); if (r.result === "frontFull" || r.result === "backFull") { toast(t(`case.${r.result}` as MsgKey)); return; }
      store.updateTrip(trip.id, (x) => { if (Object.keys(r.edits).length) x.suitcase = r.edits; else delete x.suitcase; }); refresh();
    };
    const addPhoto = async (file: File) => {
      try {
        const made = await makeCard(file); const id = `card-${Date.now().toString(36)}`;
        await saveCardImage(id, made.blob); images.set(id, await decodeImage(made.blob));   // 刚做好的图直接用，不等再读一遍
        setEdits((e) => { e.cards = [...(e.cards ?? []), { id, ...made.card }].slice(-3); });
        toast(t(made.card.kind === "cutout" ? "case.photoCut" : "case.photoFull"));
      } catch { toast(t("case.photoFailed")); }
    };
    const removeCard = (id: string) => { void deleteCardImage(id); setEdits((e) => { e.cards = (e.cards ?? []).filter((y) => y.id !== id); if (!e.cards.length) delete e.cards; }); };
    /** 「清单」弹层 */
    const openList = () => {
      const input = h("input", { type: "search", class: "case-search", placeholder: t("case.searchPlaceholder"), autocomplete: "off", enterkeyhint: "search", "aria-label": t("case.searchPlaceholder") });
      const aiBtn = endpoint ? h("button", { type: "button", class: "btn tinted", hidden: true, onclick: () => void askAI() }, t("case.askAI")) : null;
      const scenes = h("div", { class: "case-scenes" }, CASE_SCENES.map((sc) => h("button", { type: "button", class: "case-scene", onclick: () => { input.value = t(`case.scene.${sc}` as MsgKey); render(); } }, t(`case.scene.${sc}` as MsgKey))));
      const body = h("div", { class: "case-list-body" });
      const wrap = h("div", { class: "case-list" }, h("div", { class: "case-search-row" }, input, aiBtn), scenes, body);
      let timer = 0; input.addEventListener("input", () => { clearTimeout(timer); timer = window.setTimeout(render, 160); });
      input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { clearTimeout(timer); render(); } });
      const render = () => {
        const q = input.value; const groups = searchCase(q, ctx()); icons.beginPass();
        body.replaceChildren(...(groups.length ? groups.map((g) => h("section", { class: "case-group" }, h("div", { class: "t-sub cg-title" }, g.label), h("div", { class: "case-items" }, g.entries.map((e) => tile(e, () => tap(e)))))) : [h("p", { class: "t-sub case-empty" }, t("case.noMatch"))]));
        if (aiBtn) aiBtn.hidden = q.trim().length < 4;
      };
      // 让 AI 按这句挑（D84）：一句话随摘要进 /v1/pack，回来换掉「AI 加的」那几样
      const askAI = async () => {
        const note = input.value.trim(); if (!note || !aiBtn) return; aiBtn.disabled = true;
        try { const r = await packExtras(trip, profile, getLocale(), { endpoint, note }); extrasNow = r.extras; caseScene?.setExtras(r.extras); renderCaption(); renderEdit(); render(); toast(t("case.aiPicked", { items: plainNames(r.extras.map((e) => extraName(e.kind)).join(" · ")) })); }
        finally { aiBtn.disabled = false; }
      };
      const sh = sheet(t("case.list"), wrap, { wide: true, onClose: () => { listSheet = null; } }); sh.el.querySelector(".sheet")?.classList.add("solid"); listSheet = { refresh: render }; render();
      if (new URLSearchParams(location.search).get("q")) { input.value = new URLSearchParams(location.search).get("q")!; render(); }   // 截图用
    };
    function renderEdit() {
      const c = caseScene?.contents; if (!c) return;
      const inBox = caseGroups(ctx()).flatMap((g) => g.entries).filter((e) => e.inBox); icons.beginPass();
      const order = { landmark: 0, souvenir: 1, extra: 2 } as const; inBox.sort((a, b) => order[a.type] - order[b.type]);
      const tiles = [...inBox.map((e) => tile(e, () => tap(e), true)), ...c.cards.map((x) => cardTile(x.id, x.label ?? t("case.photo"), () => removeCard(x.id)))];
      const file = h("input", { type: "file", accept: "image/*", onchange: () => { const f = file.files?.[0]; if (f) void addPhoto(f); file.value = ""; } });
      const e = edits(); const touched = !!(e.hidden?.length || e.picks?.length || e.gear?.length);
      editPanel.replaceChildren(h("div", { class: "case-items" }, ...tiles), h("div", { class: "case-actions" },
        h("button", { type: "button", class: "tbtn", onclick: openList }, h("span", { html: icon("plus", 16) }), t("case.list")),
        h("label", { class: "tbtn" }, h("span", { html: icon("import", 16) }), t("case.addPhoto"), file),
        touched ? h("button", { type: "button", class: "tbtn", onclick: () => setEdits((x) => { delete x.hidden; delete x.picks; delete x.gear; }) }, t("case.restore")) : null));
    }
    const editBtn = h("button", { type: "button", class: "ibtn", "aria-label": t("case.edit"), title: t("case.edit"), "aria-pressed": "false", html: icon("edit", 16), onclick: () => { const on = editPanel.hidden; editPanel.hidden = !on; editBtn.setAttribute("aria-pressed", String(on)); editBtn.classList.toggle("on", on); if (on) renderEdit(); } });
    // 截图用：?edit=1 打开面板，?list=1 打开清单（?q= 预填一句话）
    const dbgQ = new URLSearchParams(location.search);
    if (dbgQ.get("edit") === "1") setTimeout(() => editBtn.click(), 1500);
    if (dbgQ.get("list") === "1") setTimeout(openList, 1500);
    // 截图用：?card=<图的地址> 放一张进去
    const dbgCard = new URLSearchParams(location.search).get("card");
    if (dbgCard && !(trip.suitcase?.cards?.length)) fetch(dbgCard).then((r) => r.blob()).then((b) => addPhoto(new File([b], "photo"))).catch(() => {});
    const btn = h("button", { type: "button", class: "ibtn", "aria-label": t("case.export"), title: t("case.export"), html: icon("export", 16), onclick: async () => {
      btn.disabled = true; try { download(await caseScene!.exportPNG(), t("case.fileName", { title: trip.title })); toast(t("epi.exported")); } finally { btn.disabled = false; }
    } });
    return h("section", { class: "case-wrap" }, host, h("div", { class: "case-bar" }, h("span", { class: "t-sub" }, t("case.title")), h("span", { class: "case-tools" }, editBtn, btn)), styleRow, editPanel, capLine, extrasLine);
  }
  return { leave: () => { caseScene?.dispose(); caseIcons?.dispose(); } };
}
