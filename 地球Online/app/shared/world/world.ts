/** 世界层入口：渲染器、灯光、天空、底板、小人、相机、信息层、播放器；对外只走桥接消息（spec/bridge.ts）。
 *  第一版渲染后端是 three.js（浏览器 / WebView 里可跑，可验证）；换 Cocos 时保留这层接口与消息。 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { NativeToWorld, WorldListener, WorldToNative } from "../spec/bridge.ts";
import type { Avatar, Palette, PostLevel, WorldSpec } from "../spec/types.ts";
import { CityPlate, type CityJson } from "../algo/city.ts";
import type { Route } from "../algo/route.ts";
import { icon, MODE_ICON_NAME } from "./icons.ts";
import { formatDuration } from "../algo/duration.ts";
import { STYLES, col, LZ, nightOf, LANTERN, type WorldStyle } from "./style.ts";
import { Lantern } from "./lantern.ts";
import { buildNight, type NightDecor, type NightSpots } from "./night.ts";
import type { SkyPhase } from "./daylight.ts";
import { buildPlate } from "./plate.ts";
import { buildGeoPlate, flightAlt } from "./geo-plate.ts";
import { loadLand10 } from "../geo/topo.ts";
import { MODE_VEHICLE } from "../algo/transport.ts";
import type { GeoFrame } from "../algo/geo.ts";
import type { Day } from "../spec/types.ts";

/** 城市底板与地理底板的共同接口 */
interface AnyPlate { nightSpots: NightSpots; group: THREE.Group; pins: Map<string, THREE.Group>; landmarks: Map<string, THREE.Group>; ribbon: THREE.Mesh | null; dispose(): void; heightAt(x: number, z: number): number; anchorTop(entryId: string): number; update?(t: number): void; cols: number; rows: number }
import { DEFAULT_AVATAR, type Outfit } from "./hero.ts";
import { makeCharacter, formOf, type Character } from "./character.ts";
import type { AvatarForm } from "../spec/types.ts";
import { CameraRig } from "./camera.ts";
import { LabelLayer, type LabelSpec } from "./labels.ts";
import { Playback } from "./playback.ts";

export interface WorldOptions { assetBase?: string; palette?: Palette; cities: Record<string, CityJson>; /** 透明背景：天空交给页面的平面插画层 */ transparent?: boolean }

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly labels: LabelLayer;
  /** 角色：小人或 Q 版的动物 / 自建 IP（D86）；换形态时重建（setCharacter） */
  hero: Character; private heroForm: AvatarForm = "human"; private faceUrl: string;
  readonly playback: Playback;
  style: WorldStyle;
  /** 色调（白天的那一套）与天色：夜里用 nightOf 推出来的一套，再撒上灯、萤火、蘑菇（night.ts，D85） */
  palette: Palette; phase: SkyPhase = "day";
  private night: NightDecor | null = null;
  /** 夜里角色手边的一盏灯（D94，lantern.ts）：挂在当前角色上，换角色时重挂 */
  private lantern = new Lantern();
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight; private sky: THREE.Mesh;
  private plateBuild: AnyPlate | null = null; private plate: CityPlate | null = null; private geo: { frame: GeoFrame; day: Day } | null = null; private loadToken = 0; private route: Route | null = null; private spec: WorldSpec | null = null;
  private listeners: WorldListener[] = []; private raf = 0; private last = 0; private w = 1; private h = 1; private ro: ResizeObserver;
  private postLevel: PostLevel = "high"; private pointer = { x: 0, y: 0, down: false, moved: false };
  private raycaster = new THREE.Raycaster();

  constructor(readonly container: HTMLElement, readonly opts: WorldOptions) {
    this.palette = opts.palette ?? "sea"; this.style = STYLES[this.palette];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.transparent, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    if (opts.transparent) this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0; this.renderer.outputColorSpace = THREE.SRGBColorSpace;   // D89：中性色调映射，ACES 会把中间调的颜色压灰
    this.renderer.domElement.className = "world-canvas"; container.appendChild(this.renderer.domElement);
    this.labels = new LabelLayer(container);
    // 灯：太阳（软阴影）+ 天光 / 地光；环境反射用室内环境贴图（水面与漆面的高光）
    this.hemi = new THREE.HemisphereLight(col(this.style.skyLight), col(this.style.groundLight), this.style.hemiIntensity); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(col(this.style.sun), this.style.sunIntensity); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03; this.scene.add(this.sun, this.sun.target);
    const pmrem = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.35; pmrem.dispose();
    this.sky = this.makeSky(); this.sky.visible = !opts.transparent; this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(col(this.style.haze), this.style.fogNear, this.style.fogFar);
    this.faceUrl = (opts.assetBase ?? "") + "assets/hero_face.png";
    this.hero = makeCharacter(DEFAULT_AVATAR, this.faceUrl); this.hero.beforeShow = (o) => this.renderer.compileAsync(o, this.rig.camera, this.scene); this.hero.group.visible = false; this.scene.add(this.hero.group); this.lantern.attach(this.hero.group);
    this.playback = new Playback({
      arrive: (i) => { this.hero.celebrate(); this.refreshLabelStates(); const s = this.route?.stops[i]; if (s) this.emit({ kind: "hero-arrived", stopIndex: i, entryId: s.entryId }); },
      segment: (i) => { const s = this.route?.segments[i]; if (s) this.emit({ kind: "segment-started", segmentIndex: i, mode: s.mode, label: s.label }); },
      finished: () => this.emit({ kind: "day-finished" }),
    });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.bindPointer();
    this.raf = requestAnimationFrame(this.frame); this.emit({ kind: "ready" });
  }

  on(l: WorldListener) { this.listeners.push(l); return () => { this.listeners = this.listeners.filter((x) => x !== l); }; }
  private emit(m: WorldToNative) { for (const l of this.listeners) l(m); }

  /** 桥接入口：原生（或网页壳）→ 世界 */
  send(msg: NativeToWorld) {
    switch (msg.kind) {
      case "load-plate": { void this.loadPlate(msg.city, msg.route, msg.seed, msg.dayIndex, false, msg.geo); return; }
      case "goto-stop": return this.playback.jumpTo(msg.stopIndex);
      case "play": this.playback.playing = true; return;
      case "pause": this.playback.playing = false; return;
      case "restart": this.playback.restart(); this.refreshLabelStates(); return;
      case "set-avatar": return this.setCharacter(msg.avatar);
      case "set-view": if (msg.pitch) this.rig.pitch = msg.pitch; if (msg.azimuthStep !== undefined) this.rig.azimuthStep = ((msg.azimuthStep % 4) + 4) % 4; if (msg.follow !== undefined) this.rig.follow = msg.follow; this.applyFog(); return;
      case "set-post": this.postLevel = msg.level; this.renderer.shadowMap.enabled = msg.level !== "low"; this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; }); return;
      case "set-layout": return;                       // 布局态只影响原生面板停靠；世界只需尺寸（ResizeObserver 已处理）
      case "snapshot": { const r = this.snapshot(msg.width, msg.height); this.emit({ kind: "snapshot-done", dataUrl: r.dataUrl }); return; }
    }
  }

  /** 换角色：同一形态只换颜色；形态变了就换一只（位置、朝向、可见性接着） */
  setCharacter(av: Avatar, outfit?: Outfit) {
    const form = formOf(av);
    if (form === this.heroForm) { this.hero.setAvatar(av, outfit); return; }
    const old = this.hero; const vis = old.group.visible; const pos = old.group.position.clone(); const ry = old.group.rotation.y;
    this.scene.remove(old.group); old.dispose();
    const c = makeCharacter(av, this.faceUrl); c.beforeShow = (o) => this.renderer.compileAsync(o, this.rig.camera, this.scene); c.setAvatar(av, outfit);
    c.group.visible = vis; c.group.position.copy(pos); c.group.rotation.y = ry; this.scene.add(c.group); this.hero = c; this.heroForm = form; this.lantern.attach(c.group);
  }

  setPalette(p: Palette) { if (p === this.palette) return; this.palette = p; this.applyStyle(); this.rebuild(); }
  /** 天色（D85）：夜里换一套夜色重建底板，再撒上灯、萤火、蘑菇、篝火；白天 / 晨昏都是白天的那一套 */
  setPhase(p: SkyPhase) { if (p === this.phase) return; this.phase = p; this.applyStyle(); this.rebuild(); }
  private applyStyle() {
    this.style = this.phase === "night" ? nightOf(STYLES[this.palette]) : STYLES[this.palette];
    this.hemi.color = col(this.style.skyLight); this.hemi.groundColor = col(this.style.groundLight); this.hemi.intensity = this.style.hemiIntensity;
    this.sun.color = col(this.style.sun); this.sun.intensity = this.style.sunIntensity; (this.scene.fog as THREE.Fog).color = col(this.style.haze);
    this.scene.environmentIntensity = this.style.night ? 0.18 : 0.35;
    this.lantern.setOn(!!this.style.night);
    const u = (this.sky.material as THREE.ShaderMaterial).uniforms; u.top.value = col(this.style.skyTop); u.bottom.value = col(this.style.skyBottom);
  }
  private rebuild() { if ((this.plate || this.geo) && this.spec) void this.loadPlate(this.geo ? "geo" : this.plate!.id, this.route, this.spec.seed, 0, true, this.geo ?? undefined); }

  async loadPlate(city: string, route: Route | null, seed: number, _dayIndex: number, keepPlayback = false, geo?: { frame: GeoFrame; day: Day }) {
    const token = ++this.loadToken;
    const season = this.spec?.season ?? "autumn", density = this.spec?.decorDensity ?? 0.7;
    this.spec = { seed, palette: this.palette, season, theme: "", decorDensity: density, coverHue: 0 };
    let built: AnyPlate; let cols: number, rows: number;
    // 先切换播放的路线（页面马上就要用它），小人等底板建好再出现
    if (!keepPlayback || !this.playback.route) { if (route) this.playback.load(route); }
    this.route = route; this.hero.group.visible = false;
    if (city === "geo" && geo && route) {
      const land = await loadLand10(this.opts.assetBase ?? "").catch(() => []);
      if (token !== this.loadToken) return;
      const gp = buildGeoPlate(geo.day, geo.frame, route, this.spec, this.style, land); built = gp; cols = gp.cols; rows = gp.rows; this.plate = null; this.geo = geo;
    } else {
      const json = this.opts.cities[city]; if (!json) throw new Error(`没有城市底板：${city}`);
      this.plate = new CityPlate(json); this.geo = null; const cp = buildPlate(this.plate, this.spec, this.style, route); const plate = this.plate;
      built = { ...cp, cols: plate.cols, rows: plate.rows, heightAt: () => 0.06, anchorTop: (id) => { const st = route?.stops.find((x) => x.entryId === id); const lm = plate.landmarks.find((l) => l.name === st?.landmark); return (lm?.topz ?? 0.3) * LZ + 0.75; } };
      cols = plate.cols; rows = plate.rows;
    }
    if (this.plateBuild) { this.scene.remove(this.plateBuild.group); this.plateBuild.dispose(); }
    if (this.night) { this.scene.remove(this.night.group); this.night.dispose(); this.night = null; }
    this.plateBuild = built; this.route = route; this.scene.add(built.group);
    if (this.style.night) { this.night = buildNight(built.nightSpots, seed, this.renderer.getPixelRatio()); this.scene.add(this.night.group); }
    const cx = cols / 2, cz = rows / 2; const ext = Math.max(cols, rows) / 2 + 8;
    this.sun.position.set(cx - 26, 40, cz + 18); this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 140; sc.updateProjectionMatrix();
    this.rig.setPlate(cols, rows); this.sky.position.set(cx, 0, cz);
    if (route) this.playback.restartPause();
    this.hero.group.visible = !!route && route.path.length > 0;
    this.buildLabels(); this.refreshLabelStates(); this.applyFog();
    this.emit({ kind: "plate-loaded" });   // 不叫 ready：原生收到 ready 会重放全部状态（含 show-day），叫 ready 就会无限重载
  }

  setSeason(season: WorldSpec["season"], decorDensity: number) { if (this.spec) { this.spec.season = season; this.spec.decorDensity = decorDensity; } }

  private buildLabels() {
    const specs: LabelSpec[] = []; const route = this.route; const pb = this.plateBuild!;
    if (route) {
      route.stops.forEach((s, i) => {
        if (route.stops.slice(0, i).some((o) => o.name === s.name)) return;
        const kindIcon = s.category === "hotel" ? icon("hotel", 12) : s.category === "airport" ? icon("plane", 12) : s.category === "port" ? icon("anchor", 12) : null;
        const n = route.stops.slice(0, i + 1).filter((o) => !o.category || o.category === "sight").length;
        const pin = pb.pins.get(s.entryId); const at = pin ? new THREE.Vector3(pin.position.x, pb.anchorTop(s.entryId) + 0.45, pin.position.z) : new THREE.Vector3(s.center[0], pb.anchorTop(s.entryId) + 0.35, s.center[1]);
        specs.push({ id: s.entryId, kind: "stop", pos: at, state: s.visited ? "visited" : undefined,
          html: `<b class="n${kindIcon ? " k" : ""}">${kindIcon ?? n}</b><span class="t">${s.time ?? ""}</span><span class="name">${esc(s.name)}${s.offPlate ? " ↗" : ""}</span>`, onClick: () => this.emit({ kind: "building-tapped", landmark: s.landmark }) });
      });
      // 路段标牌（交通 · 公里 · 时长）第五轮消融掉了：底部时间轴和「下一站」卡片已经有这些信息，地图上只留站名
      if (route.lodging && !route.lodging.offPlate && route.lodging.center) specs.push({ id: "lodging", kind: "lodging", pos: new THREE.Vector3(route.lodging.center[0], pb.anchorTop("lodging"), route.lodging.center[1]), html: `<b class="n k">${icon("hotel", 12)}</b><span class="name">${esc(route.lodging.name)}</span>` });
    }
    if (this.plate) {
      const plate = this.plate; const used = new Set([...(route?.stops.map((s) => s.landmark) ?? []), route?.lodging?.landmark]);
      for (const lm of plate.landmarks) if (lm.name && !used.has(lm.name)) specs.push({ id: `lm-${lm.name}`, kind: "lm", pos: new THREE.Vector3(lm.x + 0.5, lm.topz * LZ + 0.4, lm.y + 0.5), html: esc(lm.name), onClick: () => this.emit({ kind: "building-tapped", landmark: lm.name }) });
      for (const [x, y, text] of plate.labels) specs.push({ id: `txt-${text}`, kind: "lm", pos: new THREE.Vector3(x + 0.5, 0.3, y + 0.5), html: esc(text) });
    }
    this.labels.set(specs);
  }
  private refreshLabelStates() {
    const r = this.route; if (!r) return;
    r.stops.forEach((s, i) => { const st = s.visited ? "visited" : this.playback.reached.has(i) ? "reached" : i === this.playback.nextStopIndex ? "next" : null; this.labels.setState(s.entryId, st);
      const pin = this.plateBuild?.pins.get(s.entryId); if (pin) { const m = pin.userData.mat as THREE.MeshStandardMaterial; m.color = col(s.visited ? this.style.gold : this.style.night ? LANTERN : this.style.accent); m.emissive = m.color; }
      const grp = this.plateBuild?.landmarks.get(s.landmark); if (grp) grp.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm && mm.emissive) { mm.emissive = col(this.style.gold); mm.emissiveIntensity = s.visited ? 0.18 : 0; } });
    });
  }
  /** 打卡状态变了（visited）→ 重建标牌状态与图钉颜色 */
  markVisited(entryId: string, visited: boolean) { const s = this.route?.stops.find((x) => x.entryId === entryId); if (s) { s.visited = visited; this.refreshLabelStates(); } }

  private applyFog() { const f = this.scene.fog as THREE.Fog; const k = this.rig.follow ? 1 : 2.2; f.near = this.style.fogNear * k; f.far = this.style.fogFar * k; }

  private makeSky(): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: col(this.style.skyTop) }, bottom: { value: col(this.style.skyBottom) } }, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vDir; void main(){ float h = clamp(vDir.y * 1.7 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.75)), 1.0); }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), mat); m.renderOrder = -1; return m;
  }

  private resize() {
    const r = this.container.getBoundingClientRect(); this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.postLevel === "low" ? 1 : 2)); this.renderer.setSize(this.w, this.h, false);
    this.rig.setAspect(this.w / this.h); this.applyInsets();
  }
  /** 被界面挡住的部分（底部抽屉 / 左页）：投影中心挪到露出来的那块 */
  private insets = { left: 0, bottom: 0, right: 0, top: 0 };
  /** 被面板挡住的四边（D90：三页时左右都让，悬停时让下半） */
  setInsets(i: { left: number; bottom: number; right?: number; top?: number }) { this.insets = { left: i.left, bottom: i.bottom, right: i.right ?? 0, top: i.top ?? 0 }; this.applyInsets(); }
  private applyInsets() { const { left, bottom, right, top } = this.insets; const cam = this.rig.camera; if (!left && !bottom && !right && !top) cam.clearViewOffset(); else cam.setViewOffset(this.w, this.h, (right - left) / 2, (bottom - top) / 2, this.w, this.h); }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016); this.last = now;
    if (this.hero.group.visible) this.playback.tick(dt);
    const pose = this.playback.pose(); let heroPos: THREE.Vector3 | null = null;
    if (pose && this.hero.group.visible) {
      const seg = this.playback.segment; const moving = this.playback.speed > 0;
      const veh = moving && seg ? MODE_VEHICLE[seg.mode] : null; this.hero.setVehicle(veh === "train" ? "car" : veh);
      let y = this.plateBuild ? this.plateBuild.heightAt(pose.x, pose.y) : 0.06; if (veh === "boat") y = Math.max(y, 0.02);
      if (seg?.mode === "flight") y += 0.4 + flightAlt(seg.arc, this.playback.segmentProgress);
      this.hero.group.position.set(pose.x, y + 0.02, pose.y);
      if (this.playback.speed > 0) this.hero.face(pose.dx, pose.dy);
      else { const c = this.rig.position; this.hero.face(c.x - pose.x, c.z - pose.y); }
      const sp = this.playback.speed; this.hero.update(dt, sp > 0 ? Math.max(1, sp / 1.7) : 0); heroPos = this.hero.group.position; this.lantern.update(dt, sp > 0 && !veh);
    }
    if (this.plateBuild) { const t = now / 1000; for (const p of this.plateBuild.pins.values()) p.position.y = (p.userData.baseY as number) + Math.sin(t * 2.4 + p.position.x) * 0.06; this.plateBuild.update?.(t); this.night?.update(t); }
    if (heroPos && this.plateBuild && this.rig.follow) {
      // 地形挡住小人：沿「相机 → 小人」连线采样，有山高过视线就把相机抬高
      const cam = this.rig.position, tgt = heroPos; let block = 0;
      for (let q = 1; q < 10; q++) { const u = q / 10; const x = tgt.x + (cam.x - tgt.x) * u, z = tgt.z + (cam.z - tgt.z) * u, y = tgt.y + 0.8 + (cam.y - tgt.y - 0.8) * u; block = Math.max(block, this.plateBuild.heightAt(x, z) - y); }
      this.rig.lift = block > -0.2 ? Math.min(40, this.rig.lift + 6 * dt * 10) : Math.max(0, this.rig.lift - dt * 8);
    } else this.rig.lift = 0;
    this.rig.update(dt, heroPos);
    this.renderer.render(this.scene, this.rig.camera);
    this.labels.update(this.rig, this.w, this.h);
  };

  /** 定角度渲染图：临时改尺寸渲染一帧，返回图片与标牌位置（导出长图用） */
  snapshot(width: number, height: number): { dataUrl: string; tags: { x: number; y: number; kind: string; text: string }[] } {
    const saveFollow = this.rig.follow; this.rig.follow = false; this.applyFog();
    const dpr = this.renderer.getPixelRatio(); this.renderer.setPixelRatio(1); this.renderer.setSize(width, height, false); this.rig.setAspect(width / height);
    this.rig.update(1, null); this.rig.update(1, null);
    if (this.opts.transparent) this.renderer.setClearColor(col(this.style.skyBottom), 1);
    this.renderer.render(this.scene, this.rig.camera);
    const dataUrl = this.renderer.domElement.toDataURL("image/jpeg", 0.9);
    if (this.opts.transparent) this.renderer.setClearColor(0x000000, 0);
    const tags: { x: number; y: number; kind: string; text: string }[] = [];
    if (this.route && this.plateBuild) { const pb = this.plateBuild; this.route.stops.forEach((s, i) => { if (this.route!.stops.slice(0, i).some((o) => o.name === s.name)) return; const p = this.rig.project(new THREE.Vector3(s.center[0], pb.anchorTop(s.entryId) + 0.3, s.center[1]), width, height); tags.push({ x: p.x, y: p.y, kind: "stop", text: `${s.time ?? ""} ${s.name}`.trim() }); }); }
    this.rig.follow = saveFollow; this.applyFog(); this.renderer.setPixelRatio(dpr); this.resize();
    return { dataUrl, tags };
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", (e) => { this.pointer = { x: e.clientX, y: e.clientY, down: true, moved: false }; });
    let lx = 0, ly = 0;
    el.addEventListener("pointermove", (e) => {
      if (!this.pointer.down) return;
      if (!this.pointer.moved && Math.hypot(e.clientX - this.pointer.x, e.clientY - this.pointer.y) > 6) { this.pointer.moved = true; lx = e.clientX; ly = e.clientY; }
      if (this.pointer.moved) { this.rig.dragBy(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; }
    });
    el.addEventListener("pointerup", (e) => {
      if (!this.pointer.down || this.pointer.moved || !this.plateBuild) { this.pointer.down = false; return; } this.pointer.down = false;
      const r = el.getBoundingClientRect(); const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(v, this.rig.camera);
      const targets: THREE.Object3D[] = [...this.plateBuild.landmarks.values(), ...this.plateBuild.pins.values()];
      const hit = this.raycaster.intersectObjects(targets, true)[0]; if (!hit) { this.emit({ kind: "empty-tapped" }); return; }
      let o: THREE.Object3D | null = hit.object; while (o && !o.userData.landmark) o = o.parent;
      if (o?.userData.landmark) this.emit({ kind: "building-tapped", landmark: o.userData.landmark as string });
    });
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.rig.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  }

  dispose() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.plateBuild?.dispose(); this.night?.dispose(); this.lantern.dispose(); this.hero.dispose(); this.labels.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}

function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }
export { DEFAULT_AVATAR } from "./hero.ts";
export type { Avatar };
