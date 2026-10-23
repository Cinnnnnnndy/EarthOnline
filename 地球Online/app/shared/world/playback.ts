/** 播放器：小人沿当天路径走，到站停顿并发事件；点站可跳转；乘车段速度更快 */
import type { Route } from "../algo/route.ts";
import { MODE_SPEED } from "../algo/transport.ts";

export interface PlaybackEvents { arrive?: (stopIndex: number) => void; segment?: (segIndex: number) => void; finished?: () => void; lodging?: () => void }

export class Playback {
  route: Route | null = null;
  t = 0; playing = true; finished = false; reached = new Set<number>();
  private pauseLeft = 0; private lastSeg = -1; private lodged = false;
  constructor(private ev: PlaybackEvents = {}) {}

  load(route: Route) { this.route = route; this.t = 0; this.finished = false; this.reached.clear(); this.lastSeg = -1; this.lodged = false; this.pauseLeft = 0.9;
    route.stops.forEach((s, i) => { if (s.arrive === 0) this.reached.add(i); }); }
  get segment() { const r = this.route; if (!r) return null; return r.segments.find((s) => s.end > this.t) ?? r.segments.at(-1) ?? null; }
  get segmentIndex() { const r = this.route; if (!r) return -1; const i = r.segments.findIndex((s) => s.end > this.t); return i < 0 ? r.segments.length - 1 : i; }
  get nextStopIndex() { const r = this.route; if (!r) return -1; return r.stops.findIndex((_, i) => !this.reached.has(i)); }
  get paused() { return this.pauseLeft > 0; }
  /** 当前速度（格 / 秒），0 表示停着 */
  get speed() { if (!this.route || !this.playing || this.finished || this.pauseLeft > 0) return 0; const s = this.segment; return s ? MODE_SPEED[s.mode] * (s.speedScale ?? 1) : MODE_SPEED.walk; }
  /** 当前路段内的进度 0–1（航班起降高度用） */
  get segmentProgress() { const s = this.segment; if (!s) return 0; return Math.max(0, Math.min(1, (this.t - s.start) / Math.max(1e-6, s.end - s.start))); }

  tick(dt: number) {
    const r = this.route; if (!r || r.path.length < 2 || this.finished) return;
    if (this.pauseLeft > 0) { this.pauseLeft -= dt; return; }
    if (!this.playing) return;
    const si = this.segmentIndex; if (si !== this.lastSeg) { this.lastSeg = si; this.ev.segment?.(si); }
    const before = this.t; this.t = Math.min(r.path.length - 1, this.t + this.speed * dt);
    for (let i = 0; i < r.stops.length; i++) {
      const s = r.stops[i];
      if (!this.reached.has(i) && before < s.arrive && this.t >= s.arrive) { this.t = s.arrive; this.reached.add(i); this.pauseLeft = 1.5; this.ev.arrive?.(i); return; }
    }
    if (this.t >= r.path.length - 1) {
      if (r.lodging && !r.lodging.offPlate && !this.lodged) { this.lodged = true; this.ev.lodging?.(); }
      this.finished = true; this.ev.finished?.();
    }
  }
  jumpTo(stopIndex: number) {
    const r = this.route; if (!r || !r.stops[stopIndex]) return;
    for (let i = 0; i <= stopIndex; i++) this.reached.add(i);
    this.t = r.stops[stopIndex].arrive; this.finished = false; this.pauseLeft = 1.2; this.ev.arrive?.(stopIndex);
  }
  restart() { if (this.route) this.load(this.route); }
  /** 底板建好后再给一个开场停顿（加载期间不走） */
  restartPause() { if (this.t === 0) this.pauseLeft = Math.max(this.pauseLeft, 0.9); }
  /** 路径上的插值位置与朝向（格坐标） */
  pose(): { x: number; y: number; dx: number; dy: number } | null {
    const r = this.route; if (!r || !r.path.length) return null;
    const i = Math.min(Math.floor(this.t), r.path.length - 1), f = this.t - i; const a = r.path[i], b = r.path[Math.min(i + 1, r.path.length - 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx === 0 && dy === 0 && i > 0) { const p = r.path[i - 1]; dx = a[0] - p[0]; dy = a[1] - p[1]; }
    const o = r.kind === "geo" ? 0 : 0.5;
    return { x: a[0] + (b[0] - a[0]) * f + o, y: a[1] + (b[1] - a[1]) * f + o, dx, dy };
  }
}
