/** 自己放进箱子的照片（第八轮末，D82）：读照片 → 抠出主体 → 做成一张小卡（立牌）；抠不出来就整张做成拍立得。
 *  图存在浏览器的 IndexedDB 里（earth-online:case-cards），书里只记 id 与尺寸（spec 的 CaseCard）。
 *  抠图是本机的、不联网的办法：从四边找背景的主色，沿着颜色连续的地方往里漫延（渐变的天空、纯色的墙都能漫过去），
 *  漫到的算背景；主体挨着边也不怕——边上颜色和背景差得远的点不当种子。去掉太少（< 12%）或太多（> 92%）就当背景太复杂，整张保留。
 *  iOS 走原生的 Vision（VNGenerateForegroundInstanceMaskRequest），比这个准；网页先这样。 */
import type { CaseCard } from "../../shared/spec/types.ts";

const DB = "earth-online:case-cards", STORE = "cards";
const MAX_SIDE = 640;

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") { rej(new Error("no indexedDB")); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error ?? new Error("indexedDB"));
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((res, rej) => { const r = fn(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error ?? new Error("indexedDB")); }));
}
export const saveCardImage = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id)).then(() => undefined);
export const loadCardImage = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id)).then((b) => b ?? null).catch(() => null);
export const deleteCardImage = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined).catch(() => undefined);

/** 解码一张图（给刚做好的卡立刻用，不用等 IndexedDB 再读一遍） */
export const decodeImage = (blob: Blob): Promise<TexImageSource> => toBitmap(blob);

async function toBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") { try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch { /* 下面用 img */ } }
  return new Promise((res, rej) => { const url = URL.createObjectURL(blob); const im = new Image(); im.onload = () => { URL.revokeObjectURL(url); res(im); }; im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); }; im.src = url; });
}
/** 把书里记着的卡的图都读出来（读不到的跳过） */
export async function loadCardBitmaps(cards: CaseCard[]): Promise<Map<string, TexImageSource>> {
  const out = new Map<string, TexImageSource>();
  await Promise.all(cards.map(async (c) => { const b = await loadCardImage(c.id); if (!b) return; try { out.set(c.id, await toBitmap(b)); } catch { /* 跳过 */ } }));
  return out;
}

export interface MadeCard { card: Omit<CaseCard, "id">; blob: Blob }

/** 读一张照片，抠图，做成卡 */
export async function makeCard(file: Blob): Promise<MadeCard> {
  const src = await toBitmap(file);
  const sw = src.width, sh = src.height; const k = Math.min(1, MAX_SIDE / Math.max(sw, sh)); const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; const ctx = canvas.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h); const cut = cutout(img);
  if (!cut) return { card: { kind: "polaroid", w, h }, blob: await toBlob(canvas, "image/jpeg", 0.88) };
  const out = document.createElement("canvas"); out.width = cut.w; out.height = cut.h; out.getContext("2d")!.putImageData(cut.data, 0, 0);
  return { card: { kind: "cutout", w: cut.w, h: cut.h }, blob: await toBlob(out, "image/png") };
}
const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), type, q));

/** 抠图：返回裁好边的带透明的像素，背景太复杂就返回 null */
export function cutout(img: ImageData): { data: ImageData; w: number; h: number } | null {
  const { width: w, height: h, data: px } = img; const n = w * h;
  // 1. 四边的像素按颜色粗量化，最多的那一撮就是背景的主色
  const bins = new Map<number, { c: number; r: number; g: number; b: number }>();
  const border: number[] = [];
  for (let x = 0; x < w; x++) { border.push(x, (h - 1) * w + x); } for (let y = 1; y < h - 1; y++) { border.push(y * w, y * w + w - 1); }
  for (const i of border) { const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5); const e = bins.get(key) ?? { c: 0, r: 0, g: 0, b: 0 }; e.c++; e.r += r; e.g += g; e.b += b; bins.set(key, e); }
  let top = { c: 0, r: 0, g: 0, b: 0 }; for (const e of bins.values()) if (e.c > top.c) top = e;
  if (top.c < border.length * 0.25) return null;                                 // 边上颜色太杂：没有一个像样的背景
  const br = top.r / top.c, bg = top.g / top.c, bb = top.b / top.c;
  const dist = (i: number, r: number, g: number, b: number) => Math.abs(px[i * 4] - r) + Math.abs(px[i * 4 + 1] - g) + Math.abs(px[i * 4 + 2] - b);
  // 2. 从像背景的边缘点开始漫延：相邻像素颜色连续（差 ≤ 48）且离背景主色不太远（≤ 190）就算背景
  const mask = new Uint8Array(n); const queue: number[] = [];
  for (const i of border) if (dist(i, br, bg, bb) <= 70) { mask[i] = 1; queue.push(i); }
  if (!queue.length) return null;
  const LOCAL = 48, GLOBAL = 190;
  while (queue.length) {
    const i = queue.pop()!; const x = i % w, y = (i - x) / w; const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) { if (j < 0 || mask[j]) continue; if (dist(j, r, g, b) <= LOCAL && dist(j, br, bg, bb) <= GLOBAL) { mask[j] = 1; queue.push(j); } }
  }
  let removed = 0; for (let i = 0; i < n; i++) removed += mask[i];
  const ratio = removed / n; if (ratio < 0.12 || ratio > 0.92) return null;
  // 3. 主体的包围盒（留 6px 边），边缘一圈半透明，免得毛边
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) if (!mask[i]) { const x = i % w, y = (i - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0 || y1 < y0) return null;
  x0 = Math.max(0, x0 - 6); y0 = Math.max(0, y0 - 6); x1 = Math.min(w - 1, x1 + 6); y1 = Math.min(h - 1, y1 + 6);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1; const out = new ImageData(cw, ch); const o = out.data;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w + x, k = ((y - y0) * cw + (x - x0)) * 4; o[k] = px[i * 4]; o[k + 1] = px[i * 4 + 1]; o[k + 2] = px[i * 4 + 2];
    if (mask[i]) { o[k + 3] = 0; continue; }
    const edge = (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w]);
    o[k + 3] = edge ? 150 : 255;
  }
  return { data: out, w: cw, h: ch };
}
