/** 信息层：站点标牌（序号 + 计划时间 + 地名）、路段标牌（交通 + 时长）、住宿标牌、淡的地标小标签；HTML 元素跟着三维锚点走，简单避让 */
import * as THREE from "three";
import type { CameraRig } from "./camera.ts";

export type LabelKind = "stop" | "seg" | "lodging" | "lm";
export interface LabelSpec { id: string; kind: LabelKind; pos: THREE.Vector3; html: string; onClick?: () => void; state?: string }
interface Live extends LabelSpec { el: HTMLElement; w: number; h: number }

export class LabelLayer {
  readonly root: HTMLElement;
  private items: Live[] = [];
  constructor(container: HTMLElement) {
    this.root = document.createElement("div"); this.root.className = "world-labels"; container.appendChild(this.root);
  }
  set(specs: LabelSpec[]) {
    this.root.replaceChildren(); this.items = [];
    for (const s of specs) {
      const el = document.createElement(s.onClick ? "button" : "div"); el.className = `tag tag-${s.kind}` + (s.state ? ` is-${s.state}` : ""); el.innerHTML = s.html; el.dataset.id = s.id;
      if (s.onClick) { el.setAttribute("type", "button"); el.addEventListener("click", s.onClick); }
      this.root.appendChild(el); this.items.push({ ...s, el, w: 0, h: 0 });
    }
    for (const it of this.items) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
  }
  setState(id: string, state: string | null) {
    const it = this.items.find((x) => x.id === id); if (!it) return;
    it.el.className = `tag tag-${it.kind}` + (state ? ` is-${state}` : "");
  }
  update(rig: CameraRig, w: number, h: number) {
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const order = [...this.items].sort((a, b) => rank(a.kind) - rank(b.kind));
    for (const it of order) {
      const p = rig.project(it.pos, w, h);
      if (!p.front || p.x < -80 || p.x > w + 80 || p.y < -60 || p.y > h + 60) { it.el.style.display = "none"; continue; }
      let x = p.x - it.w / 2, y = p.y - it.h - (it.kind === "seg" ? 4 : 10);
      let hidden = false;
      for (let tries = 0; tries < 4; tries++) {
        const hit = placed.find((r) => x < r.x + r.w + 4 && x + it.w + 4 > r.x && y < r.y + r.h + 4 && y + it.h + 4 > r.y);
        if (!hit) break;
        if (it.kind === "lm" || it.kind === "seg") { hidden = true; break; }
        y = hit.y - it.h - 6;
      }
      if (hidden) { it.el.style.display = "none"; continue; }
      it.el.style.display = ""; it.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      it.el.style.opacity = it.kind === "lm" && rig.follow ? String(Math.max(0, 1 - Math.max(0, p.depth - 0.985) * 40)) : "";
      placed.push({ x, y, w: it.w, h: it.h });
    }
  }
  dispose() { this.root.remove(); }
}
function rank(k: LabelKind) { return k === "stop" ? 0 : k === "lodging" ? 1 : k === "seg" ? 2 : 3; }
