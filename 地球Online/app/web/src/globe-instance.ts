/** 地球常驻一个实例（与世界层一样：切页面只是藏起来） */
import { GlobeView } from "../../shared/world/globe.ts";
import { mountBackdrop, type Backdrop } from "./backdrop.ts";
import { store } from "./store.ts";
import { go } from "./router.ts";
import { skyPhase, onPhase } from "./theme.ts";

let g: GlobeView | null = null; let bd: Backdrop | null = null;
export const globeHost = () => document.getElementById("globe-host")!;
export const handlers = { pickBook: (id: string) => go(`/book/${id}`), pickDay: (_book: string, _day: number) => {}, planted: (_ids: string[]) => {} };
export function globe(): GlobeView {
  if (!g) {
    const host = globeHost(); bd = mountBackdrop(host, store.settings.palette, skyPhase()); onPhase((p) => { bd?.setPhase(p); g?.setPhase(p); });
    g = new GlobeView(host, import.meta.env.BASE_URL, {
      pickBook: (id) => handlers.pickBook(id), pickDay: (b, d) => handlers.pickDay(b, d), planted: (ids) => handlers.planted(ids),
      moved: (c) => { bd?.parallax(Math.sin((c.lng * Math.PI) / 180) * 0.8, Math.max(-1, Math.min(1, c.lat / 60))); if (g) { const d = g.screenDisk(); bd?.orbit(d.x, d.y, d.r, -c.lng * 0.2); } },
    });
    g.setPhase(skyPhase());
  }
  (window as unknown as { __globe: GlobeView }).__globe = g;
  return g;
}
export function globeBackdrop() { globe(); return bd!; }
export function showGlobe(on: boolean) { const h = globeHost(); h.hidden = !on; if (g) g.setActive(on); }
