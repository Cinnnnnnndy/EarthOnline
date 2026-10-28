/** 高清补丁交给 Web Worker 画（D109）：落地后画一张 1536–3072 的图，在主线程上要卡几百毫秒到一秒多。
 *  没有 Worker / OffscreenCanvas（Node 测试、老 WebKit），或者后台画失败，就退回主线程同步画。 */
import { paintPatchTex, newCanvas, type EarthOpts } from "./earth-texture.ts";
import type { Ring } from "../geo/topo.ts";

let worker: Worker | null | undefined; let seq = 0;
const waiting = new Map<number, (m: { color?: ImageBitmap; rough?: ImageBitmap; error?: string }) => void>();

function patchWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof window !== "undefined") {
      worker = new Worker(new URL("./patch-worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e) => { const cb = waiting.get(e.data.id); waiting.delete(e.data.id); cb?.(e.data); };
      worker.onerror = () => { worker = null; for (const cb of waiting.values()) cb({ error: "worker" }); waiting.clear(); };
    }
  } catch { worker = null; }
  return worker;
}
/** ImageBitmap 画回一张普通画布（贴图仍用 CanvasTexture，上下方向与原来一致） */
function toCanvas(b: ImageBitmap): HTMLCanvasElement {
  const c = newCanvas(); c.width = b.width; c.height = b.height; c.getContext("2d")!.drawImage(b, 0, 0); b.close(); return c;
}
export async function paintPatchAsync(land: Ring[][], opts: EarthOpts): Promise<{ color: HTMLCanvasElement; rough: HTMLCanvasElement }> {
  const w = patchWorker();
  if (w) {
    const m = await new Promise<{ color?: ImageBitmap; rough?: ImageBitmap; error?: string }>((res) => { const id = ++seq; waiting.set(id, res); w.postMessage({ id, land, opts }); });
    if (m.color && m.rough) return { color: toCanvas(m.color), rough: toCanvas(m.rough) };
  }
  return paintPatchTex(land, opts);
}
