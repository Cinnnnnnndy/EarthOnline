/** 足迹与家（第八轮精简）：一张弹层，两组分组列表。
 *  家：一行（家在哪 / 还没标注，右边「清除」）+ 搜索框 + 两个玻璃小胶囊（用当前位置 / 在地球上选）。
 *  去过的地方：一行小结（几个地方、几个国家、最远多远）+ 按国家分组的行（名字 + 日期与书名）+ 补一个地方（搜索框 + 在地球上选）。
 *  不再有三格统计、不再有大段说明；按钮只有玻璃小胶囊与文字按钮。 */
import { h, toast, sheet, tBold } from "./ui.ts";
import { store } from "./store.ts";
import { globe } from "./globe-instance.ts";
import { footprints, footprintStats, type Footprint } from "../../shared/algo/footprints.ts";
import { locate, searchPlaces, nearestPlace, type Place } from "../../shared/geo/gazetteer.ts";
import { makeCountryLookup, countryName } from "../../shared/geo/countries.ts";
import { loadCountries } from "../../shared/geo/topo.ts";
import { icon } from "../../shared/world/icons.ts";
import { today } from "./globe-data.ts";
import { t, km, latLng, list, names, fullDate } from "../../shared/i18n/index.ts";

let countryOf: ((lat: number, lng: number) => string | null) | null = null;
export async function countryLookup(): Promise<(lat: number, lng: number) => string | null> {
  if (!countryOf) { const lk = makeCountryLookup(await loadCountries(import.meta.env.BASE_URL)); countryOf = (lat, lng) => { const n = lk(lat, lng); return n ? countryName(n) : null; }; }
  return countryOf;
}
export function currentFootprints(): Footprint[] { return footprints(store.trips, store.pins, today(), (n) => locate(n)); }

/** 把足迹与家推给地球；还没插过的旗会播插旗动画 */
export function pushToGlobe() {
  const G = globe(); const fps = currentFootprints();
  G.setFootprints(fps.map((f) => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng })), fps.filter((f) => !store.planted.includes(f.id)).map((f) => f.id));
  G.setHome(store.home);
  return fps;
}

const iconSpan = (n: string, size = 15) => h("span", { class: "icw", html: icon(n, size) });
const coordName = (lat: number, lng: number) => latLng(lat, lng);

export function footprintChips(onChange: () => void): HTMLElement {
  const row = h("div", { class: "fp-row" });
  const render = async () => {
    const fps = currentFootprints(); const home = store.home;
    const a = h("button", { type: "button", class: "fp-chip", onclick: () => openFootprints(onChange) }, iconSpan("flag"), h("span", {}, ...tBold("fp.chipPlaces", { n: fps.length })));
    const b = h("button", { type: "button", class: "fp-chip" + (home ? "" : " ghost"), onclick: () => openFootprints(onChange, "home") }, iconSpan("home"), h("span", {}, home ? home.name : t("fp.markHome")));
    row.replaceChildren(a, b);
    try { const co = await countryLookup(); const st = footprintStats(fps, home, co); if (st.countries.length) a.append(h("span", { class: "sub" }, t("punct.list") + t("fp.chipCountries", { n: st.countries.length }))); } catch { /* 国界数据没到就只显示地方数 */ }
  };
  render(); (row as unknown as { refresh: () => void }).refresh = render;
  return row;
}

/** 在地球上点一下：顶部出一条提示，点完回调 */
function pickOnGlobe(prompt: string, done: (lat: number, lng: number) => void) {
  const G = globe(); const bar = h("div", { class: "pick-bar lg" }, iconSpan("tap"), h("span", {}, prompt), h("button", { type: "button", class: "tbtn", style: { minHeight: "32px" }, onclick: () => { G.pickPoint(null); bar.remove(); } }, t("common.cancel")));
  document.body.append(bar); G.pickPoint((lat, lng) => { bar.remove(); done(lat, lng); });
}

/** 列表行（不可点）：图标、一两行文字、右边的尾巴 */
const row = (ic: string, tt: string, mt: string | null, trail: HTMLElement | null) =>
  h("div", { class: "row", style: { cursor: "default" } }, h("span", { class: "lead soft", html: icon(ic, 16) }), h("span", { class: "main" }, h("span", { class: "tt" }, tt), mt ? h("span", { class: "mt num" }, mt) : null), trail);

export function openFootprints(onChange: () => void, focus: "home" | "list" = "list") {
  const G = globe(); const body = h("div", { class: "col" });
  const s = sheet(t("fp.title"), body);
  const changed = () => { pushToGlobe(); onChange(); render(); };
  const setHome = (p: { name: string; lat: number; lng: number }) => { store.setHome(p); changed(); G.flyTo({ lat: p.lat - 6, lng: p.lng, alt: 1.3, tilt: 0, heading: 0 }, 1400); toast(t("fp.homeSet", { name: p.name })); };
  const addPin = (p: { name: string; lat: number; lng: number }) => { store.addPin(p); changed(); G.flyTo({ lat: p.lat - 4, lng: p.lng, alt: 0.9, tilt: 0, heading: 0 }, 1400); toast(t("fp.added", { name: p.name })); };
  // 搜索：输入后才出现建议（最多 5 个小胶囊，一行一个地名）
  const search = (placeholder: string, onPick: (p: Place) => void) => {
    const q = h("input", { placeholder }); const sug = h("div", { class: "suggest" });
    const draw = () => { const hits = q.value.trim() ? searchPlaces(q.value, 5) : []; sug.replaceChildren(...hits.map((pl) => h("button", { type: "button", class: "sug", onclick: () => { q.value = ""; draw(); onPick(pl); } }, pl.name))); sug.hidden = !hits.length; };
    q.oninput = draw; draw(); return h("div", { class: "col" }, q, sug);
  };
  const glassBtn = (label: string, fn: () => void) => h("button", { type: "button", class: "btn glass", onclick: fn }, label);
  async function render() {
    const fps = currentFootprints(); const home = store.home;
    let co: ((lat: number, lng: number) => string | null) | null = null; try { co = await countryLookup(); } catch { co = null; }
    const st = footprintStats(fps, home, co ?? undefined);
    // ---- 家
    const homeSec = h("section", { class: "group" }, h("div", { class: "gh" }, t("fp.home")),
      h("div", { class: "list" }, row("home", home ? home.name : t("fp.noHome"), home ? coordName(home.lat, home.lng) : null,
        home ? h("button", { type: "button", class: "ibtn plain", "aria-label": t("common.clear"), title: t("common.clear"), html: icon("close", 16), onclick: () => { store.setHome(null); changed(); } }) : null)),
      search(t("fp.searchCity"), (p) => setHome({ name: p.name, lat: p.lat, lng: p.lng })),
      h("div", { class: "btn-row" },
        glassBtn(t("fp.useLocation"), () => {
          if (!navigator.geolocation) return toast(t("fp.noGeo"));
          navigator.geolocation.getCurrentPosition((pos) => { const { latitude: lat, longitude: lng } = pos.coords; setHome({ name: nearestPlace(lat, lng)?.name ?? t("fp.myHome"), lat, lng }); }, () => toast(t("fp.geoFailed")), { timeout: 8000 });
        }),
        glassBtn(t("fp.pickOnGlobe"), () => { s.close(); pickOnGlobe(t("fp.pickHome"), (lat, lng) => setHome({ name: nearestPlace(lat, lng)?.name ?? t("fp.myHome"), lat, lng })); })));
    // ---- 去过的地方：一行小结 + 按国家分组
    // 小结是三个标签（同一类信息用同一种标签）
    const summary = h("span", { class: "tgs" }, [t("fp.chipPlaces", { n: st.places }), st.countries.length ? t("fp.chipCountries", { n: st.countries.length }) : "", home && st.farthest ? t("fp.farthestKm", { km: km(st.farthestKm) }) : ""].filter(Boolean).map((x) => h("span", { class: "tg" }, x)));
    const groups = new Map<string, Footprint[]>();
    for (const f of fps) { const c = co?.(f.lat, f.lng) ?? t("fp.otherCountry"); groups.set(c, [...(groups.get(c) ?? []), f]); }
    const bookTitle = (id: string) => store.trip(id)?.title ?? "";
    const groupEls = [...groups.entries()].map(([c, arr]) => h("div", { class: "group" }, h("div", { class: "gh" }, c, " ", h("span", { class: "tg" }, String(arr.length))),
      h("div", { class: "list" }, arr.map((f) => row("flag", f.name, list([f.date ? fullDate(f.date) : "", f.source === "manual" ? t("fp.manual") : names([...new Set(f.trips.map(bookTitle))])]),
        f.source === "manual" ? h("button", { type: "button", class: "fab sm", "aria-label": t("fp.removeFlag"), html: icon("close", 14), onclick: () => { store.removePin(f.id); changed(); } }) : null)))));
    const listSec = h("section", { class: "group" }, h("div", { class: "gh" }, t("fp.visited")),
      fps.length ? h("div", { style: { padding: "0 4px 4px" } }, summary) : h("p", { class: "t-sub", style: { margin: "0 4px 2px" } }, t("fp.noneVisited")),
      ...groupEls,
      h("div", { class: "gh", style: { paddingTop: "10px" } }, t("fp.addPlace")),
      search(t("fp.searchPlace"), (p) => addPin({ name: p.name, lat: p.lat, lng: p.lng })),
      h("div", { class: "btn-row" }, glassBtn(t("fp.pickOnGlobe"), () => { s.close(); pickOnGlobe(t("fp.pickVisited"), (lat, lng) => addPin({ name: nearestPlace(lat, lng, 60, ["city", "poi"])?.name ?? coordName(lat, lng), lat, lng })); })));
    body.replaceChildren(...(focus === "home" ? [homeSec, listSec] : [listSec, homeSec]));
  }
  render();
}
