/** 导出长图：封面信息 + 每天的定角度渲染图（带站点标牌）+ 条目 + 日记，拼成一张竖长 PNG */
import type { Trip } from "../../shared/spec/types.ts";
import { worldInstance, dayScene } from "./world-instance.ts";
import type { World } from "../../shared/world/world.ts";
import { generateDiary } from "../../shared/algo/diary.ts";
import { MODE_ICON } from "../../shared/algo/transport.ts";
import { deriveWorldSpec, coverColors, themeName } from "../../shared/algo/world-spec.ts";
import { tripStats } from "../../shared/algo/stats.ts";
import { buildTimeline, itemOf } from "../../shared/algo/timeline.ts";
import { cityName } from "./cities.ts";
import { COLOR, fontFamily } from "../../shared/world/tokens.ts";
import { platform } from "./shape.ts";
import { t, getLocale, duration, list, fullDate, fullDateRange, plainNames } from "../../shared/i18n/index.ts";

const W = 1080, IMG_H = 620, PAD = 48;

/** 折行：中日文逐字断，英文按词断（一个词比一行还长时才逐字断） */
const TOKEN = /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]|[^\s\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]+\s*|\s+/g;
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const tok of para.match(TOKEN) ?? []) {
      if (ctx.measureText(line + tok).width <= maxW) { line += tok; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ""; }
      if (ctx.measureText(tok).width <= maxW) { line = tok.trimStart(); continue; }
      for (const ch of tok) { if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch; }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

/** world 不给就用网页应用的那个常驻实例；嵌入页（原生壳的长图，D96）传自己的 World 进来 */
export async function exportLongImage(trip: Trip, onProgress?: (s: string) => void, world: World = worldInstance()): Promise<Blob> {
  const FONT = fontFamily(getLocale(), platform());                // 画布不走 CSS，字体栈按界面语言单独取
  const spec = deriveWorldSpec(trip); const cc = coverColors(spec); const st = tripStats(trip);
  // 先把每天渲染出来
  const shots: { img: HTMLImageElement; tags: { x: number; y: number; text: string }[] }[] = [];
  for (let i = 0; i < trip.days.length; i++) {
    onProgress?.(t("export.rendering", { i: i + 1, n: trip.days.length }));
    const sc = dayScene(trip, i); world.setSeason(spec.season, spec.decorDensity); await world.loadPlate(sc.geo ? "geo" : trip.days[i].city, sc.route, trip.seed, i, false, sc.geo);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    const snap = world.snapshot(W, IMG_H); shots.push({ img: await loadImg(snap.dataUrl), tags: snap.tags });
  }
  await Promise.all(["400 15px", "600 15px"].map((f) => document.fonts.load(`${f} ${FONT}`).catch(() => [])));   // 随包字体先载好再画
  // 量高度
  const measure = document.createElement("canvas").getContext("2d")!; measure.font = `15px ${FONT}`;
  const blocks = trip.days.map((d, i) => {
    const tl = buildTimeline(d); const at = (id: string) => { const it = itemOf(tl, id); return it ? t("export.about", { time: it.start }) : "--:--"; };
    const entries = d.entries.map((e) => e.type === "place" ? `● ${e.plannedStart ?? at(e.id)}  ${e.name}${e.visited ? " ✓" : ""}` : e.type === "transport" ? `   ${MODE_ICON[e.mode]} ${list([e.label, e.durationMinutes ? duration(e.durationMinutes) : ""])}` : `▲ ${t("export.stay", { name: e.name })}`);
    const diary = wrap(measure, d.diary ?? generateDiary(trip, d), W - PAD * 2 - 20);
    return { d, i, entries, diary, h: 60 + IMG_H + 24 + entries.length * 24 + 16 + diary.length * 26 + 40 };
  });
  const H = 220 + blocks.reduce((s, b) => s + b.h, 0) + 90;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#f4f7fb"; ctx.fillRect(0, 0, W, H);
  // 封面块
  ctx.fillStyle = cc.b; ctx.fillRect(0, 0, W, 220);   // 封面平涂，不用渐变
  ctx.fillStyle = cc.sub; ctx.font = `400 17px ${FONT}`; ctx.fillText(list([plainNames(trip.destination), themeName(trip.theme)]), PAD, 64);
  ctx.fillStyle = cc.title; ctx.font = `600 48px ${FONT}`; ctx.fillText(trip.title, PAD, 130);
  ctx.font = `400 17px ${FONT}`; ctx.fillText(list([fullDateRange(trip.startDate, trip.endDate), t("export.summary", { days: st.days, places: st.places, visited: st.visited, walk: duration(st.walkMinutes), transit: duration(st.transitMinutes) })]), PAD, 176);
  let y = 220;
  for (const b of blocks) {
    y += 16; ctx.fillStyle = "#1D1E23"; ctx.font = `600 26px ${FONT}`; ctx.fillText(`D${b.d.index}  ${b.d.title}`, PAD, y + 30);
    ctx.fillStyle = COLOR.mist; ctx.font = `400 15px ${FONT}`; ctx.textAlign = "right"; ctx.fillText(`${fullDate(b.d.date)}  ${cityName(b.d.city) ?? plainNames(trip.destination)}`, W - PAD, y + 30); ctx.textAlign = "left"; y += 60;
    const s = shots[b.i]; ctx.drawImage(s.img, 0, y, W, IMG_H);
    for (const t of s.tags) { const tw = ctx.measureText(t.text).width + 22; ctx.font = `400 15px ${FONT}`; const tx = Math.min(W - tw - 8, Math.max(8, t.x - tw / 2)), ty = Math.max(y + 8, y + t.y - 34);
      ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.roundRect(tx, ty, tw, 26, 13); ctx.fill(); ctx.fillStyle = "#1f2a37"; ctx.fillText(t.text, tx + 11, ty + 18); }
    y += IMG_H + 24;
    ctx.font = `400 15px ${FONT}`; ctx.fillStyle = "#1f2a37"; for (const line of b.entries) { ctx.fillText(line, PAD, y + 16); y += 24; }
    y += 16; ctx.fillStyle = "#3a4654"; ctx.font = `400 15px ${FONT}`; for (const line of b.diary) { ctx.fillText(line, PAD + 10, y + 16); y += 26; }
    y += 40; ctx.strokeStyle = "rgba(31,42,55,.12)"; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  }
  ctx.fillStyle = COLOR.mist; ctx.font = `400 15px ${FONT}`; ctx.fillText(t("export.footer"), PAD, H - 40);
  onProgress?.(t("export.stitching"));
  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}
export function download(blob: Blob, name: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
