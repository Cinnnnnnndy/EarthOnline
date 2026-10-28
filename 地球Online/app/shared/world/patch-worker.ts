/** 后台画高清补丁（D109）：收到这一片的陆地多边形与尺寸，在 OffscreenCanvas 上画好、羽化好，转成 ImageBitmap 交回主线程 */
import { paintPatchTex, type EarthOpts } from "./earth-texture.ts";
import type { Ring } from "../geo/topo.ts";
const ctx = self as unknown as { onmessage: ((e: MessageEvent<{ id: number; land: Ring[][]; opts: EarthOpts }>) => void) | null; postMessage: (m: unknown, t: Transferable[]) => void };
ctx.onmessage = (e) => {
  const { id, land, opts } = e.data;
  try {
    const { color, rough } = paintPatchTex(land, opts);
    const c = (color as unknown as OffscreenCanvas).transferToImageBitmap(), r = (rough as unknown as OffscreenCanvas).transferToImageBitmap();
    ctx.postMessage({ id, color: c, rough: r }, [c, r]);
  } catch (err) { ctx.postMessage({ id, error: String(err) }, []); }
};
