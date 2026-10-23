/** 后台网格化：收到部件说明，算好网格 + 接触阴影，把缓冲区转交回主线程 */
import { buildPart, type PartSpec } from "./hero-shapes.ts";
const ctx = self as unknown as { onmessage: ((e: MessageEvent<{ id: number; spec: PartSpec }>) => void) | null; postMessage: (m: unknown, t: Transferable[]) => void };
ctx.onmessage = (e) => {
  const { id, spec } = e.data; const r = buildPart(spec);
  ctx.postMessage({ id, positions: r.positions, normals: r.normals, indices: r.indices, colors: r.colors }, [r.positions.buffer, r.normals.buffer, r.indices.buffer, r.colors.buffer]);
};
