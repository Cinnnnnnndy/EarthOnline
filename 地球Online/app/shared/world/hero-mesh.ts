/** 小人部件的网格：优先交给两个 Web Worker 在后台算（界面不卡），没有 Worker 的环境（Node 测试、老浏览器）就地同步算。
 *  同一个 key 只算一次，地球上的小人和某一天里的小人共用。 */
import * as THREE from "three";
import { buildPart, type PartSpec, type PartMesh } from "./hero-shapes.ts";

const cache = new Map<string, Promise<THREE.BufferGeometry>>();
let pool: Worker[] | null = null; let rr = 0; let seq = 0;
const waiting = new Map<number, (m: PartMesh) => void>();

function workers(): Worker[] {
  if (pool) return pool;
  pool = [];
  try {
    if (typeof Worker !== "undefined" && typeof window !== "undefined") for (let i = 0; i < 2; i++) {
      const w = new Worker(new URL("./hero-worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<PartMesh & { id: number }>) => { const cb = waiting.get(e.data.id); waiting.delete(e.data.id); cb?.(e.data); };
      pool.push(w);
    }
  } catch { pool = []; }
  return pool;
}
function toGeometry(m: PartMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3)); g.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute("color", new THREE.BufferAttribute(m.colors, 3)); g.setIndex(new THREE.BufferAttribute(m.indices, 1)); g.computeBoundingSphere(); return g;
}
export function partGeometry(spec: PartSpec): Promise<THREE.BufferGeometry> {
  const hit = cache.get(spec.key); if (hit) return hit;
  const ws = workers();
  const p = ws.length
    ? new Promise<THREE.BufferGeometry>((res) => { const id = ++seq; waiting.set(id, (m) => res(toGeometry(m))); ws[rr++ % ws.length].postMessage({ id, spec }); })
    : Promise.resolve().then(() => toGeometry(buildPart(spec)));
  cache.set(spec.key, p); return p;
}
