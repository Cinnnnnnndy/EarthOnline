/** 地球视图（开屏）：风格化地球浮在平面插画天空里；书是地球上的标记，点开 → 飞进去看这本书的路线（按天着色），
 *  选一天 → 飞到这一天的上空，再「潜入」这一天的微缩世界。渲染器透明背景，背景由页面的平面插画层负责。 */
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { loadGlobeGeo, loadLand10, type Ring } from "../geo/topo.ts";
import { paintEarth, paintClouds } from "./earth-texture.ts";
import { Hero, DEFAULT_AVATAR, type Outfit } from "./hero.ts";
import type { Avatar } from "../spec/types.ts";
import { greatCircle, haversineKm, type LatLng } from "../algo/geo.ts";
import { clusterFlags, type FlagCluster, type HomePlace } from "../algo/footprints.ts";
import { FlagKit, makeHouse } from "./globe-marks.ts";
import { icon } from "./icons.ts";
import { t } from "../i18n/index.ts";

export type StopKind = "hotel" | "airport" | "port" | "sight";
export interface GlobeLeg { mode: string; coords: LatLng[]; label?: string }
export interface GlobeStop { name: string; lat: number; lng: number; kind: StopKind; n: string }
export interface GlobeDay { index: number; label: string; title: string; color: string; legs: GlobeLeg[]; stops: GlobeStop[]; center: LatLng; radiusKm: number }
export interface GlobeBook { id: string; title: string; subtitle: string; badge?: string; badgeKind?: "live" | "soon" | "done" | "plan"; center: LatLng; radiusKm: number; color: string; days: GlobeDay[]; heroAt?: LatLng }
export interface CamState { lat: number; lng: number; alt: number; tilt: number; heading: number }
export interface GlobeEvents { pickBook?: (id: string) => void; pickDay?: (bookId: string, dayIdx: number) => void; moved?: (s: CamState) => void; planted?: (ids: string[]) => void }
export interface GlobeFlag { id: string; name: string; lat: number; lng: number }

const R = 1; const D2R = Math.PI / 180;
export function ll2v(lat: number, lng: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * D2R, th = (lng + 180) * D2R;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** 只减速不加速：一出手就转过去、最后轻轻停住（选目的地时的转向用它，跟手） */
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
/** 让一个半径 km 的范围装进视野需要的离地高度（地球半径单位） */
export function altFor(radiusKm: number, fovDeg = 32) { const ang = Math.min(1.2, radiusKm / 6371); return Math.max(0.018, (Math.sin(ang) / Math.tan((fovDeg * D2R) / 2)) * 1.25 - (1 - Math.cos(ang))); }

interface Label { id: string; el: HTMLElement; pos: THREE.Vector3; w: number; h: number; prio: number; kind: string }

export class GlobeView {
  readonly renderer: THREE.WebGLRenderer; readonly scene = new THREE.Scene(); readonly camera = new THREE.PerspectiveCamera(32, 1, 0.001, 50);
  readonly root = new THREE.Group(); private earth!: THREE.Mesh; private clouds!: THREE.Mesh; private patch: THREE.Mesh | null = null;
  private overlay = new THREE.Group(); private labelsEl: HTMLElement; private labels: Label[] = []; private atmoMat!: THREE.ShaderMaterial; private rimMat!: THREE.ShaderMaterial; private cloudShadow!: THREE.Mesh; private backGlow!: THREE.Sprite;
  private key!: THREE.DirectionalLight; private rimLight!: THREE.DirectionalLight; private hemi!: THREE.HemisphereLight;
  private books: GlobeBook[] = []; private focus: { book?: string; day?: number } = {};
  private hero: Hero; private heroAt: LatLng | null = null;
  cam: CamState = { lat: 30, lng: 60, alt: 2.4, tilt: 0, heading: 0 };
  private anim: { from: CamState; to: CamState; t: number; dur: number; hop: number; ease: (t: number) => number; done?: () => void } | null = null;
  private vel = { lat: 0, lng: 0 }; private dragging = false; private idle = 0; private active = true; private raf = 0; private last = 0;
  private w = 1; private h = 1; private ro: ResizeObserver; private lineMats: LineMaterial[] = []; private stopMeshes: THREE.Mesh[] = [];
  autoRotate = true;
  // 足迹小旗 + 家
  private kit = new FlagKit(); private marks = new THREE.Group(); private flagEl: HTMLElement; private flagLabels: Label[] = [];
  private fpData: GlobeFlag[] = []; private fpFresh = new Set<string>(); private flagBucket = NaN;
  private flags: { c: FlagCluster; g: THREE.Group; P: THREE.Vector3; t0: number; fresh: boolean }[] = []; private rings: { m: THREE.Mesh; P: THREE.Vector3; t0: number }[] = [];
  private plantPending: string[] = []; private home: HomePlace | null = null; private house = makeHouse(); private homeLabel: Label | null = null;
  private pickCb: ((lat: number, lng: number) => void) | null = null;

  constructor(readonly host: HTMLElement, readonly base: string, readonly ev: GlobeEvents = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.className = "globe-canvas"; host.appendChild(this.renderer.domElement);
    this.labelsEl = document.createElement("div"); this.labelsEl.className = "globe-labels"; host.appendChild(this.labelsEl);
    this.flagEl = document.createElement("div"); this.flagEl.className = "globe-labels flags"; host.appendChild(this.flagEl);
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.5; pm.dispose();
    this.scene.add(this.root, this.camera); this.root.add(this.overlay, this.marks); this.house.visible = false; this.root.add(this.house);
    // 光：跟着相机走的主光（左上），天光，一盏暖色轮廓光从背后
    const key = new THREE.DirectionalLight(0xfff4e6, 2.6); key.position.set(-3.2, 2.4, 2.2); this.camera.add(key); key.target.position.set(0, 0, -5); this.camera.add(key.target); this.key = key;
    const rim = new THREE.DirectionalLight(0xdcd2ff, 0.7); rim.position.set(3, -0.5, -2); this.camera.add(rim); rim.target.position.set(0, 0, -5); this.camera.add(rim.target); this.rimLight = rim;
    this.hemi = new THREE.HemisphereLight(0xeef4ff, 0x9a92c4, 0.75); this.scene.add(this.hemi);
    this.buildEarth();
    this.hero = new Hero(base + "assets/hero_face.png", 1); this.hero.beforeShow = (o) => this.renderer.compileAsync(o, this.camera, this.scene); this.hero.group.visible = false; this.root.add(this.hero.group);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.bindInput(); this.raf = requestAnimationFrame(this.frame);
  }

  private buildEarth() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a8ed0, roughness: 0.5, metalness: 0 });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 128), mat); this.root.add(this.earth);
    loadGlobeGeo(this.base).then((g) => {
      // 手机（触屏）上用 2048×1024：整颗地球在屏幕上也就一千来像素宽，四分之一的像素量让三张贴图上传与生成 mipmap 快得多；拉近时有 detailPatch 补细节
      const big = !(typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
      const { color, rough, bump } = paintEarth(g.land50!, { width: big ? 4096 : 2048, height: big ? 2048 : 1024, borders: g.borders50, shelf: 0.5 });
      const tex = new THREE.CanvasTexture(color); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      mat.map = tex; mat.roughnessMap = new THREE.CanvasTexture(rough); mat.bumpMap = new THREE.CanvasTexture(bump); mat.bumpScale = 0.8; mat.color.set(0xffffff); mat.roughness = 1; mat.needsUpdate = true;
    }).catch((e) => console.warn("地球贴图加载失败", e));
    // 云 + 云影（同一张云图，影子层贴在地表、朝背光方向偏一点）
    const ct = new THREE.CanvasTexture(paintClouds()); ct.colorSpace = THREE.SRGBColorSpace;
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.014, 96, 64), new THREE.MeshStandardMaterial({ map: ct, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1 }));
    this.cloudShadow = new THREE.Mesh(new THREE.SphereGeometry(R * 1.0015, 96, 64), new THREE.MeshBasicMaterial({ color: 0x2a2f5a, alphaMap: ct, transparent: true, opacity: 0.07, depthWrite: false }));
    this.root.add(this.cloudShadow, this.clouds);
    // 大气：沿视线积分指数衰减的空气密度（单次散射的简化版，思路同开源的 glsl-atmosphere / takram three-atmosphere），
    // 受光一侧偏白青、背光一侧偏淡紫，和插画天空同一组颜色；普通透明混合，不做加色（加色会发白发青）
    this.atmoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
      uniforms: { sunDir: { value: new THREE.Vector3(-0.5, 0.5, 0.7).normalize() }, Rp: { value: R }, Ra: { value: R * 1.085 }, H: { value: 0.022 }, k: { value: 8.5 }, diskK: { value: 0.5 },
        cDay: { value: new THREE.Color(0xeef2ff) }, cEdge: { value: new THREE.Color(0x8fa8ff) }, cNight: { value: new THREE.Color(0x6f64c8) }, fade: { value: 1 } },
      vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: `uniform vec3 sunDir; uniform float Rp; uniform float Ra; uniform float H; uniform float k; uniform float diskK; uniform vec3 cDay; uniform vec3 cEdge; uniform vec3 cNight; uniform float fade; varying vec3 vW;
        void main(){
          vec3 ro = cameraPosition; vec3 rd = normalize(vW - ro);
          float tca = -dot(ro, rd); float b2 = dot(ro, ro) - tca * tca; if (b2 > Ra * Ra) discard;
          float dA = sqrt(max(Ra * Ra - b2, 0.0)); float t0 = max(0.0, tca - dA); float t1 = tca + dA;
          bool hit = b2 < Rp * Rp; if (hit) t1 = tca - sqrt(max(Rp * Rp - b2, 0.0)); if (t1 <= t0) discard;
          float ds = (t1 - t0) / 16.0; float od = 0.0; vec3 acc = vec3(0.0);
          for (int i = 0; i < 16; i++) {
            vec3 p = ro + rd * (t0 + ds * (float(i) + 0.5)); float r = length(p);
            float dens = exp(-max(r - Rp, 0.0) / H); float mu = dot(p / r, sunDir);
            float lit = smoothstep(-0.45, 0.6, mu); vec3 c = mix(cNight, mix(cEdge, cDay, smoothstep(0.2, 0.9, mu)), lit);
            acc += c * dens * ds; od += dens * ds;
          }
          float a = 1.0 - exp(-od * k * (hit ? diskK : 1.0));
          vec3 col = acc / max(od, 1e-5);
          // 迎光的一侧边缘加一道细亮线
          float edge = hit ? 0.0 : smoothstep(Rp * 1.03, Rp, sqrt(b2)) * smoothstep(-0.2, 0.7, dot(normalize(ro + rd * tca), sunDir));
          gl_FragColor = vec4(mix(col, vec3(1.0), edge * 0.6), clamp(a + edge * 0.25, 0.0, 1.0) * fade);
        }`,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.085, 128, 96), this.atmoMat); atmo.renderOrder = 2; this.root.add(atmo);
    // 地表边缘的一层薄亮（菲涅耳），很淡
    const rimM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { c: { value: new THREE.Color(0xf2f6ff) }, k: { value: 1 } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 c; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(0.0, dot(vN, vV)), 4.0); gl_FragColor = vec4(c, f * 0.35 * k); }" });
    this.rimMat = rimM; this.root.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.003, 96, 64), rimM));
    // 背后一团柔光：让地球「浮」在插画天空里
    const gc = document.createElement("canvas"); gc.width = gc.height = 256; const gx = gc.getContext("2d")!; const gg = gx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gg.addColorStop(0, "rgba(200,212,255,0.55)"); gg.addColorStop(0.32, "rgba(150,170,250,0.42)"); gg.addColorStop(0.46, "rgba(120,140,230,0.22)"); gg.addColorStop(0.7, "rgba(90,110,210,0.08)"); gg.addColorStop(1, "rgba(90,110,210,0)"); gx.fillStyle = gg; gx.fillRect(0, 0, 256, 256);
    const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
    this.backGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, transparent: true, depthWrite: false })); this.backGlow.scale.setScalar(3.4); this.backGlow.renderOrder = -1; this.root.add(this.backGlow);
  }

  /** 聚焦一本书时给它的范围铺一块高清贴图（land-10m），近看不糊 */
  private async detailPatch(book: GlobeBook | null) {
    if (this.patch) { this.root.remove(this.patch); (this.patch.material as THREE.MeshStandardMaterial).map?.dispose(); this.patch.geometry.dispose(); this.patch = null; }
    this.patchBox = null; if (!book) return;
    const pts: LatLng[] = book.days.flatMap((d) => d.stops.map((s) => [s.lat, s.lng] as LatLng)); if (!pts.length) pts.push(book.center);
    let minLat = Math.min(...pts.map((p) => p[0])), maxLat = Math.max(...pts.map((p) => p[0])), minLng = Math.min(...pts.map((p) => p[1])), maxLng = Math.max(...pts.map((p) => p[1]));
    const pad = Math.max(3, (maxLat - minLat) * 0.3); minLat = Math.max(-85, minLat - pad); maxLat = Math.min(85, maxLat + pad); minLng -= pad * 2; maxLng += pad * 2;
    await this.paintPatch({ minLat, maxLat, minLng, maxLng }, () => this.focus.book === book.id);
  }
  private patchBox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null = null; private patchBusy = false;
  /** 首页近看（没聚焦书）时，停下来就给视野中心补一块高清海岸线 */
  private viewPatch() {
    if (this.focus.book !== undefined || this.patchBusy || this.anim || this.dragging || this.idle < 0.5 || this.cam.alt > 0.32) return;
    const c = this.cam; const b = this.patchBox;
    if (b && c.lat > b.minLat + 2 && c.lat < b.maxLat - 2 && c.lng > b.minLng + 3 && c.lng < b.maxLng - 3) return;
    const half = Math.max(4, Math.min(16, c.alt * 45)); const w = half * 1.6 / Math.max(0.35, Math.cos(c.lat * D2R));
    this.patchBusy = true;
    this.paintPatch({ minLat: Math.max(-85, c.lat - half), maxLat: Math.min(85, c.lat + half), minLng: c.lng - w, maxLng: c.lng + w }, () => this.focus.book === undefined).finally(() => { this.patchBusy = false; });
  }
  private async paintPatch(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }, still: () => boolean) {
    let { minLat, maxLat, minLng, maxLng } = box;
    const land: Ring[][] = await loadLand10(this.base).catch(() => []); if (!land.length || !still()) return;
    if (this.patch) { this.root.remove(this.patch); (this.patch.material as THREE.MeshStandardMaterial).map?.dispose(); this.patch.geometry.dispose(); this.patch = null; }
    this.patchBox = box;
    const W = 3072, H = Math.min(3072, Math.round((W * (maxLat - minLat)) / (maxLng - minLng) / Math.max(0.3, Math.cos(((minLat + maxLat) / 2) * D2R)) * Math.cos(((minLat + maxLat) / 2) * D2R)) || 1536);
    const sub = land.filter((poly) => poly[0].some(([x, y]) => x > minLng - 5 && x < maxLng + 5 && y > minLat - 5 && y < maxLat + 5));
    const { color, rough } = paintEarth(sub, { width: W, height: Math.max(512, H), bbox: { minLng, maxLng, minLat, maxLat }, shelf: 0.12, seed: 11 });
    // 边缘羽化，和底图融在一起
    const cx = color.getContext("2d")!; const fx = document.createElement("canvas"); fx.width = color.width; fx.height = color.height; const f = fx.getContext("2d")!;
    const gh = f.createLinearGradient(0, 0, fx.width, 0); gh.addColorStop(0, "rgba(0,0,0,0)"); gh.addColorStop(0.08, "#000"); gh.addColorStop(0.92, "#000"); gh.addColorStop(1, "rgba(0,0,0,0)"); f.fillStyle = gh; f.fillRect(0, 0, fx.width, fx.height);
    f.globalCompositeOperation = "destination-in"; const gv = f.createLinearGradient(0, 0, 0, fx.height); gv.addColorStop(0, "rgba(0,0,0,0)"); gv.addColorStop(0.1, "#000"); gv.addColorStop(0.9, "#000"); gv.addColorStop(1, "rgba(0,0,0,0)"); f.fillStyle = gv; f.fillRect(0, 0, fx.width, fx.height);
    cx.globalCompositeOperation = "destination-in"; cx.drawImage(fx, 0, 0);
    const tex = new THREE.CanvasTexture(color); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const geo = new THREE.SphereGeometry(R * 1.0006, 96, 64, (minLng + 180) * D2R, (maxLng - minLng) * D2R, (90 - maxLat) * D2R, (maxLat - minLat) * D2R);
    this.patch = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughnessMap: new THREE.CanvasTexture(rough), roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.patch.renderOrder = 1; this.root.add(this.patch);
  }

  // ---------------- 数据
  setBooks(books: GlobeBook[]) { this.books = books; this.rebuildOverlay(); }
  setAvatar(a: Avatar, outfit?: Outfit) { this.hero.setAvatar(a, outfit); }
  /** 足迹：fresh 里的是还没「插」过的，出现时播插旗动画，播完回调 planted 记下来 */
  setFootprints(list: GlobeFlag[], fresh: Iterable<string> = []) { this.fpData = list; this.fpFresh = new Set(fresh); this.flagBucket = NaN; }
  setHome(h: HomePlace | null) { this.home = h; this.rebuildOverlay(); }
  /** 下一次点地球时回调经纬度（用来放家、补旗）；传 null 取消 */
  pickPoint(cb: ((lat: number, lng: number) => void) | null) { this.pickCb = cb; this.renderer.domElement.style.cursor = cb ? "crosshair" : ""; }
  get homePlace() { return this.home; }
  /** 横纵两个方向里较窄的那个视角（装东西以它为准） */
  private fitFov() { const v = this.camera.fov; const hz = (2 * Math.atan(Math.tan((v / 2) * D2R) * this.camera.aspect)) / D2R; return Math.min(v, hz); }
  /** 回到整颗地球。at = 要对准的地方（没有行程时是家）；不给就对准第一本书那一带 */
  focusHome(animate = true, at?: [number, number]) {
    this.focus = {}; this.rebuildOverlay(); this.detailPatch(null);
    const alt = Math.max(2.4, 1 / Math.sin((this.fitFov() / 2) * D2R) * 1.3 - 1);   // 地球占约四分之三，四周留出宇宙
    if (at) { this.flyTo({ lat: Math.max(-50, Math.min(60, at[0] - 4)), lng: at[1], alt, tilt: 0, heading: 0 }, animate ? 1800 : 0); return; }
    const c = this.books[0]?.center ?? [30, 60];
    this.flyTo({ lat: Math.max(-40, Math.min(50, c[0] - 8)), lng: c[1] - 15, alt, tilt: 0, heading: 0 }, animate ? 1800 : 0);
  }
  focusBook(id: string, animate = true, done?: () => void) {
    const b = this.books.find((x) => x.id === id); if (!b) return; this.focus = { book: id }; this.rebuildOverlay(); this.detailPatch(b);
    this.flyTo({ lat: b.center[0] - 1, lng: b.center[1], alt: altFor(b.radiusKm, this.fitFov()) * 1.05, tilt: 18, heading: 0 }, animate ? 2400 : 0, done);
  }
  focusDay(id: string, dayIdx: number, animate = true, done?: () => void) {
    const b = this.books.find((x) => x.id === id); const d = b?.days[dayIdx]; if (!b || !d) return; this.focus = { book: id, day: dayIdx }; this.rebuildOverlay();
    if (!this.patch) this.detailPatch(b);
    this.flyTo({ lat: d.center[0] - 0.15 * Math.min(4, d.radiusKm / 60), lng: d.center[1], alt: altFor(Math.max(18, d.radiusKm), this.fitFov()) * 1.1, tilt: 38, heading: 0 }, animate ? 1800 : 0, done);
  }
  /** 潜入：从当前视角往这一天的中心俯冲 */
  dive(done: () => void) {
    const d = this.focus.book !== undefined && this.focus.day !== undefined ? this.books.find((x) => x.id === this.focus.book)?.days[this.focus.day!] : null;
    const c = d?.center ?? [this.cam.lat, this.cam.lng];
    this.flyTo({ lat: c[0], lng: c[1], alt: 0.004, tilt: 58, heading: this.cam.heading }, 1100, done, 0);
  }
  get focused() { return { ...this.focus }; }

  flyTo(to: CamState, ms = 1600, done?: () => void, hopScale = 1, easing: (t: number) => number = ease) {
    if (ms <= 0) { this.cam = { ...to }; this.anim = null; done?.(); return; }
    const from = { ...this.cam }; const ang = haversineKm([from.lat, from.lng], [to.lat, to.lng]) / 6371;
    this.anim = { from, to: { ...to, lng: from.lng + wrap(to.lng - from.lng) }, t: 0, dur: ms / 1000, hop: Math.min(1.4, ang * 0.9) * hopScale, ease: easing, done };
  }

  // ---------------- 覆盖层：路线、站点、标签、小人
  private clearOverlay() {
    this.overlay.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.overlay.clear(); this.lineMats = []; this.stopMeshes = []; this.labelsEl.replaceChildren(); this.labels = [];
  }
  private addLabel(id: string, html: string, pos: THREE.Vector3, kind: string, prio: number, onClick?: () => void) {
    const el = document.createElement(onClick ? "button" : "div"); el.className = `glabel gl-${kind}`; el.innerHTML = html; if (onClick) { el.setAttribute("type", "button"); el.addEventListener("click", (e) => { e.stopPropagation(); onClick(); }); }
    this.labelsEl.appendChild(el); this.labels.push({ id, el, pos, w: 0, h: 0, prio, kind });
  }
  private line(points: THREE.Vector3[], color: string, width: number, dashed: boolean, opacity: number) {
    if (points.length < 2) return;
    const g = new LineGeometry(); g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
    const m = new LineMaterial({ color: new THREE.Color(color), linewidth: width, dashed, dashSize: 0.006, gapSize: 0.004, transparent: true, opacity, worldUnits: false, depthTest: true });
    m.resolution.set(this.w, this.h); this.lineMats.push(m);
    const l = new Line2(g, m); if (dashed) l.computeLineDistances(); l.renderOrder = 3; this.overlay.add(l);
  }
  private legPoints(leg: GlobeLeg): THREE.Vector3[] {
    if (leg.mode === "flight") {
      const a = leg.coords[0], b = leg.coords[leg.coords.length - 1]; const gc = greatCircle(a, b, 64); const ang = haversineKm(a, b) / 6371;
      return gc.map(([la, ln], i) => ll2v(la, ln, R * (1.004 + Math.sin((Math.PI * i) / (gc.length - 1)) * Math.min(0.12, ang * 0.35))));
    }
    const step = Math.max(1, Math.floor(leg.coords.length / 400));
    return leg.coords.filter((_, i) => i % step === 0 || i === leg.coords.length - 1).map(([la, ln]) => ll2v(la, ln, R * 1.0018));
  }
  private rebuildOverlay() {
    this.clearOverlay();
    const focusBook = this.books.find((b) => b.id === this.focus.book);
    const stopGeo = new THREE.SphereGeometry(1, 16, 12);
    const KIND: Record<StopKind, string> = { hotel: "#1d2842", airport: "#1d2842", port: "#1d2842", sight: "" };
    for (const b of this.books) {
      const focused = b === focusBook;
      if (!focusBook) {
        // 首页：每本书一个标记 + 卡片
        const p = ll2v(b.center[0], b.center[1], R * 1.002);
        const pin = new THREE.Mesh(stopGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color), emissive: new THREE.Color(b.color), emissiveIntensity: 0.35, roughness: 0.3 }));
        pin.position.copy(p); pin.userData = { book: b.id, px: 7 }; this.overlay.add(pin); this.stopMeshes.push(pin);
        for (const d of b.days) for (const leg of d.legs) this.line(this.legPoints(leg), b.color, 2, leg.mode === "flight" || leg.mode === "ship", 0.75);
        this.addLabel(`book-${b.id}`, `<b>${esc(b.title)}</b>${b.badge ? `<em class="${b.badgeKind ?? ""}">${esc(b.badge)}</em>` : ""}`, ll2v(b.center[0], b.center[1], R * 1.01), "book", 0, () => this.ev.pickBook?.(b.id));
        continue;
      }
      if (!focused) continue;
      b.days.forEach((d, di) => {
        const on = this.focus.day === undefined || this.focus.day === di;
        for (const leg of d.legs) this.line(this.legPoints(leg), d.color, on ? (this.focus.day === di ? 4 : 3) : 2, leg.mode === "flight" || leg.mode === "ship", on ? 1 : 0.3);
        if (this.focus.day === undefined) this.addLabel(`day-${di}`, `<b>${esc(d.label)}</b>${esc(d.title)}`, ll2v(d.center[0], d.center[1], R * 1.004), "day", 1 + di * 0.01, () => this.ev.pickDay?.(b.id, di));
        if (this.focus.day === di) {
          d.stops.forEach((s, si) => {
            const col = KIND[s.kind] || d.color; const p = ll2v(s.lat, s.lng, R * 1.002);
            const m = new THREE.Mesh(stopGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(col), emissive: new THREE.Color(col), emissiveIntensity: 0.3, roughness: 0.35 }));
            m.position.copy(p); m.userData = { px: 5 }; this.overlay.add(m); this.stopMeshes.push(m);
            const ic = s.kind === "hotel" ? icon("hotel", 13) : s.kind === "airport" ? icon("plane", 13) : s.kind === "port" ? icon("anchor", 13) : `<span class="n" style="background:${col}">${esc(String(s.n))}</span>`;
            if (d.stops.slice(0, si).some((x) => x.name === s.name)) return;
            this.addLabel(`stop-${si}`, `${ic}<b>${esc(s.name)}</b>`, ll2v(s.lat, s.lng, R * 1.004), `stop ${s.kind}`, 2 + si * 0.01);
          });
          // 路段标签不在地球上显示了：底部抽屉里逐段列着交通方式、公里和时长
        }
      });
    }
    // 家：小房子 + 标牌；首页再从家往每本书拉一条淡虚线弧（同一片目的地只拉一条）
    this.house.visible = !!this.home; this.homeLabel = null;
    if (this.home) {
      this.addLabel("home", `${icon("home", 14)}<b>${esc(t("globe.home"))}</b>${esc(this.home.name)}`, ll2v(this.home.lat, this.home.lng, R * 1.006), "home", -1);
      this.homeLabel = this.labels[this.labels.length - 1];
      if (!focusBook) {
        const done: LatLng[] = [];
        for (const b of this.books) {
          if (done.some((c) => haversineKm(c, b.center) < 400) || haversineKm([this.home.lat, this.home.lng], b.center) < 150) continue; done.push(b.center);
          this.line(this.legPoints({ mode: "flight", coords: [[this.home.lat, this.home.lng], b.center] }), "#ffffff", 1.6, true, 0.85);
        }
      }
    }
    this.marks.visible = this.focus.day === undefined; this.flagEl.hidden = this.focus.day !== undefined;
    // 小人：站在「今天」或这一天的起点
    const here = focusBook ? (this.focus.day !== undefined ? [focusBook.days[this.focus.day].stops[0]?.lat, focusBook.days[this.focus.day].stops[0]?.lng] as LatLng : focusBook.heroAt ?? focusBook.center) : this.books.find((b) => b.heroAt)?.heroAt ?? null;
    this.heroAt = here && Number.isFinite(here[0]) ? here : null; this.hero.group.visible = !!this.heroAt;

  }

  // ---------------- 相机与交互
  private camPose(s: CamState) {
    const P = ll2v(s.lat, s.lng, R); const N = P.clone().normalize();
    const Y = new THREE.Vector3(0, 1, 0); let E = new THREE.Vector3().crossVectors(Y, N); if (E.lengthSq() < 1e-8) E.set(1, 0, 0); E.normalize();
    const Nn = new THREE.Vector3().crossVectors(N, E).normalize();
    const h = s.heading * D2R, t = s.tilt * D2R;
    const F = Nn.clone().multiplyScalar(Math.cos(h)).add(E.clone().multiplyScalar(Math.sin(h)));
    const dist = R * 0 + s.alt;
    const pos = P.clone().add(N.clone().multiplyScalar(dist * Math.cos(t))).sub(F.clone().multiplyScalar(dist * Math.sin(t)));
    // 远景看球心（整颗地球居中），近景看目标点；中间平滑过渡
    const k = Math.min(1, Math.max(0, (s.alt - 0.25) / 1.2));
    const look = P.clone().lerp(new THREE.Vector3(0, 0, 0), k);
    return { pos, look, up: F };
  }
  private bindInput() {
    const el = this.renderer.domElement; const pts = new Map<number, { x: number; y: number }>(); let pinch = 0; let moved = 0;
    el.addEventListener("pointerdown", (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.dragging = true; this.anim = null; this.idle = 0; moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    el.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) this.zoom(pinch / d); pinch = d; return; }
      const k = (this.cam.alt * 55) / this.h; const cs = Math.cos(this.cam.heading * D2R), sn = Math.sin(this.cam.heading * D2R);
      const dLat = (dy * cs + dx * sn) * k, dLng = (-dx * cs + dy * sn) * k / Math.max(0.2, Math.cos(this.cam.lat * D2R));
      this.cam.lat = Math.max(-80, Math.min(80, this.cam.lat + dLat)); this.cam.lng = wrap(this.cam.lng + dLng); this.vel = { lat: dLat * 60, lng: dLng * 60 };
    });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (!pts.size) this.dragging = false; pinch = 0; if (moved < 6) this.pick(e); };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.anim = null; this.idle = 0; this.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    // 键盘：方向键转地球，+ / - 缩放（桌面与无障碍）
    window.addEventListener("keydown", (e) => {
      if (!this.active || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const k = this.cam.alt * 10; const m: Record<string, [number, number]> = { ArrowLeft: [0, -k], ArrowRight: [0, k], ArrowUp: [k, 0], ArrowDown: [-k, 0] };
      if (m[e.key]) { this.anim = null; this.idle = 0; this.vel = { lat: m[e.key][0] * 3, lng: m[e.key][1] * 3 }; e.preventDefault(); }
      else if (e.key === "+" || e.key === "=") this.zoom(0.8); else if (e.key === "-") this.zoom(1.25);
    });
  }
  private zoom(f: number) { this.cam.alt = Math.max(0.012, Math.min(4, this.cam.alt * f)); this.cam.tilt = Math.max(0, Math.min(45, (1 - Math.min(1, this.cam.alt / 1.2)) * 45)); }
  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect(); const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, this.camera); rc.params.Mesh = {};
    if (this.pickCb) { const h = rc.intersectObject(this.earth, false)[0]; if (h) { const n = h.point.clone().normalize(); const lat = 90 - Math.acos(Math.max(-1, Math.min(1, n.y))) / D2R; const lng = wrap(Math.atan2(n.z, -n.x) / D2R - 180); const cb = this.pickCb; this.pickPoint(null); cb(lat, lng); } return; }
    const hit = rc.intersectObjects(this.stopMeshes, false)[0]; if (hit?.object.userData.book) this.ev.pickBook?.(hit.object.userData.book as string);
  }
  setActive(on: boolean) { this.active = on; if (on) { this.last = performance.now(); this.resize(); } }
  /** 被界面挡住的部分（底部抽屉的高度 / 左页的宽度）：把投影中心挪到露出来的那块的中间 */
  private insets = { left: 0, bottom: 0, right: 0, top: 0 };
  /** 天色（白天 / 晨昏 / 夜，跟随手机当地时间与深浅外观）：只换光的颜色与大气的颜色，地表贴图不变 */
  setPhase(p: "day" | "dusk" | "night") {
    const L = {
      day: { key: [0xfff4e6, 2.6], rim: [0xdcd2ff, 0.7], hemi: [0xeef4ff, 0x9a92c4, 0.75], atmo: [0xf2f5ff, 0x9fb6ff, 0x857cd4] },
      dusk: { key: [0xffd9bd, 2.45], rim: [0xffb4c6, 0.95], hemi: [0xffe4da, 0x8a6ab0, 0.7], atmo: [0xffe8da, 0xf3a3b6, 0x7a5cb8] },
      night: { key: [0xe4eaff, 2.25], rim: [0xaebcff, 0.85], hemi: [0xc9d4ff, 0x5a5c9c, 0.62], atmo: [0xe2eaff, 0x7f98ff, 0x5a4cb8] },
    }[p];
    this.key.color.setHex(L.key[0]); this.key.intensity = L.key[1];
    this.rimLight.color.setHex(L.rim[0]); this.rimLight.intensity = L.rim[1];
    this.hemi.color.setHex(L.hemi[0]); this.hemi.groundColor.setHex(L.hemi[1]); this.hemi.intensity = L.hemi[2];
    (this.backGlow.material as THREE.SpriteMaterial).color.setHex(p === "dusk" ? 0xffc6d2 : 0xffffff);
    const u = this.atmoMat.uniforms; (u.cDay.value as THREE.Color).setHex(L.atmo[0]); (u.cEdge.value as THREE.Color).setHex(L.atmo[1]); (u.cNight.value as THREE.Color).setHex(L.atmo[2]);
  }
  /** 地球在屏幕上的圆（CSS 像素）：给背景的「环」对位用 */
  screenDisk(): { x: number; y: number; r: number } {
    const c = new THREE.Vector3(0, 0, 0).project(this.camera); const d = this.camera.position.distanceTo(this.root.position);
    const ang = Math.asin(Math.min(1, R / Math.max(d, R + 1e-4))); const r = (Math.tan(ang) / Math.tan((this.camera.fov * D2R) / 2)) * (this.h / 2);
    return { x: (c.x + 1) / 2 * this.w, y: (1 - c.y) / 2 * this.h, r };
  }
  /** 被面板挡住的四边（D90：三页时左右都让，悬停时让下半）：视觉中心挪到露出来的那块 */
  setInsets(i: { left: number; bottom: number; right?: number; top?: number }) { this.insets = { left: i.left, bottom: i.bottom, right: i.right ?? 0, top: i.top ?? 0 }; this.applyInsets(); }
  private applyInsets() {
    const { left, bottom, right, top } = this.insets; if (!left && !bottom && !right && !top) { this.camera.clearViewOffset(); return; }
    this.camera.setViewOffset(this.w, this.h, (right - left) / 2, (bottom - top) / 2, this.w, this.h);
  }
  private resize() {
    const r = this.host.getBoundingClientRect(); this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); this.renderer.setSize(this.w, this.h, false);
    const asp = this.w / this.h; this.camera.aspect = asp;
    // 竖屏（手机、折叠外屏）：加大纵向视角，横向才装得下地球
    this.camera.fov = asp < 1 ? Math.min(56, (2 * Math.atan((Math.tan(16 * D2R) / asp) * 0.72)) / D2R) : 32;
    this.camera.updateProjectionMatrix(); this.applyInsets(); for (const m of this.lineMats) m.resolution.set(this.w, this.h);
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame); if (!this.active) return;
    const real = Math.min(0.5, (now - this.last) / 1000 || 0.016); const dt = Math.min(0.05, real); this.last = now; this.idle += real;
    if (this.anim) {
      const a = this.anim; a.t = Math.min(1, a.t + real / a.dur); const e = a.ease(a.t);
      const L = (x: number, y: number) => x + (y - x) * e;
      this.cam = { lat: L(a.from.lat, a.to.lat), lng: wrap(L(a.from.lng, a.to.lng)), alt: Math.exp(L(Math.log(a.from.alt), Math.log(a.to.alt))) + a.hop * Math.sin(Math.PI * e), tilt: L(a.from.tilt, a.to.tilt), heading: L(a.from.heading, a.to.heading + wrap(a.to.heading - a.from.heading) - (a.to.heading - a.from.heading)) };
      if (a.t >= 1) { this.anim = null; a.done?.(); }
    } else if (!this.dragging) {
      this.cam.lat = Math.max(-80, Math.min(80, this.cam.lat + this.vel.lat * dt)); this.cam.lng = wrap(this.cam.lng + this.vel.lng * dt);
      this.vel.lat *= Math.pow(0.12, dt); this.vel.lng *= Math.pow(0.12, dt);
      if (this.autoRotate && this.focus.book === undefined && !this.pickCb && this.idle > 3) this.cam.lng = wrap(this.cam.lng + dt * 4 * Math.min(1, (this.idle - 3) / 2));
    }
    const pose = this.camPose(this.cam); this.camera.position.copy(pose.pos); this.camera.up.copy(pose.up); this.camera.lookAt(pose.look);
    this.rimMat.uniforms.k.value = Math.min(1, Math.max(0, (this.cam.alt - 0.06) / 0.5));
    this.camera.updateMatrixWorld(); const sd = new THREE.Vector3().setFromMatrixPosition(this.key.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(this.key.target.matrixWorld)).normalize();
    this.atmoMat.uniforms.sunDir.value.copy(sd); this.atmoMat.uniforms.fade.value = Math.min(1, Math.max(0.25, this.cam.alt / 0.15));
    this.backGlow.visible = this.cam.alt > 0.5; (this.backGlow.material as THREE.SpriteMaterial).opacity = Math.min(1, (this.cam.alt - 0.5) / 0.8);
    this.clouds.rotation.y += dt * 0.004; this.cloudShadow.rotation.y = this.clouds.rotation.y + 0.006; (this.clouds.material as THREE.MeshStandardMaterial).opacity = 0.55 * Math.max(0, Math.min(1, (this.cam.alt - 0.12) / 0.7)); (this.cloudShadow.material as THREE.MeshBasicMaterial).opacity = 0.07 * Math.max(0, Math.min(1, (this.cam.alt - 0.12) / 0.7));
    // 站点小球：保持屏幕上的像素大小
    const pxWorld = (p: THREE.Vector3) => (this.camera.position.distanceTo(p) * Math.tan((this.camera.fov * D2R) / 2) * 2) / this.h;
    for (const m of this.stopMeshes) m.scale.setScalar(pxWorld(m.position) * (m.userData.px as number));
    this.updateMarks(now / 1000, pxWorld); this.viewPatch();
    // 小人：站在地面上，脸朝镜头，屏幕上约 110 像素高
    if (this.heroAt) {
      const P = ll2v(this.heroAt[0], this.heroAt[1], R); const N = P.clone().normalize();
      const size = Math.min(pxWorld(P) * Math.min(150, this.h * 0.16), 0.2); this.hero.group.scale.setScalar(size / 5.1);
      this.hero.group.position.copy(P);
      const qUp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), N);
      const toCam = this.camera.position.clone().sub(P); toCam.sub(N.clone().multiplyScalar(toCam.dot(N))); const local = toCam.applyQuaternion(qUp.clone().invert());
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(local.x, local.z));
      this.hero.group.quaternion.copy(qUp).multiply(qYaw); this.hero.update(dt, 0);
      const vis = N.dot(this.camera.position.clone().normalize()) > 0.15; this.hero.group.visible = vis;
    }
    this.renderer.render(this.scene, this.camera);
    this.updateLabels(); this.ev.moved?.(this.cam);
  };

  private updateLabels() {
    const hr = this.host.getBoundingClientRect(); const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-avoid]")) { const r = el.getBoundingClientRect(); if (r.width && r.height) placed.push({ x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height }); }
    const camN = this.camera.position.clone().normalize();
    const order = [...this.labels, ...(this.flagEl.hidden ? [] : this.flagLabels)].sort((a, b) => a.prio - b.prio);
    for (const l of order) {
      const facing = l.pos.clone().normalize().dot(camN) > 0.18 || l.pos.length() > R * 1.05;
      const v = l.pos.clone().project(this.camera); const x = (v.x * 0.5 + 0.5) * this.w, y = (-v.y * 0.5 + 0.5) * this.h;
      if (!facing || v.z > 1 || x < -60 || x > this.w + 60 || y < -40 || y > this.h + 40) { l.el.style.display = "none"; continue; }
      if (!l.w) { l.el.style.display = ""; l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
      const w = l.w, h = l.h; let lx = x - w / 2, ly = y - h - 8;
      const hit = placed.find((r) => lx < r.x + r.w + 4 && lx + w + 4 > r.x && ly < r.y + r.h + 3 && ly + h + 3 > r.y);
      if (hit) { if (l.kind === "leg" || l.kind.startsWith("stop")) { ly = hit.y - h - 4; if (placed.some((r) => lx < r.x + r.w && lx + w > r.x && ly < r.y + r.h && ly + h > r.y)) { l.el.style.display = "none"; continue; } } else if (l.kind === "book") {
        // 书签：先试着往下挪，再试往上；都不行就让它压着（书签必须看得见）
        const free = (yy: number) => !placed.some((r) => lx < r.x + r.w + 4 && lx + w + 4 > r.x && yy < r.y + r.h + 3 && yy + h + 3 > r.y) && yy > 4 && yy + h < this.h - 4;
        let y2 = ly; for (let k = 1; k < 8 && !free(y2); k++) { const d = (h + 6) * Math.ceil(k / 2) * (k % 2 ? 1 : -1); y2 = ly + d; } if (free(y2)) ly = y2;
      } else { l.el.style.display = "none"; continue; } }
      l.el.style.display = ""; l.el.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`; placed.push({ x: lx, y: ly, w, h });
    }
  }

  /** 立在地面上、朝着镜头一侧的姿态 */
  private standQuat(N: THREE.Vector3, P: THREE.Vector3): THREE.Quaternion {
    const qUp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), N);
    const toCam = this.camera.position.clone().sub(P); toCam.sub(N.clone().multiplyScalar(toCam.dot(N))); const local = toCam.applyQuaternion(qUp.clone().invert());
    return qUp.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(local.x, local.z)));
  }
  private rebuildFlags(deg: number) {
    for (const f of this.flags) this.marks.remove(f.g); this.flags = []; this.flagEl.replaceChildren(); this.flagLabels = [];
    const clusters = clusterFlags(this.fpData, deg); const now = performance.now() / 1000; let k = 0;
    clusters.forEach((c, i) => {
      const g = this.kit.make(i); const P = ll2v(c.lat, c.lng, R * 1.0004); g.position.copy(P); this.marks.add(g);
      const fresh = c.members.some((m) => this.fpFresh.has(m)); const t0 = fresh ? now + 0.6 + k++ * 0.14 : 0;
      this.flags.push({ c, g, P, t0, fresh });
      const el = document.createElement("div"); el.className = `glabel gl-flag${c.count > 1 ? " many" : ""}`; el.innerHTML = c.count > 1 ? `<b>${c.count}</b>` : `<b>${esc(c.name)}</b>`;
      this.flagEl.appendChild(el); this.flagLabels.push({ id: `flag-${c.id}`, el, pos: ll2v(c.lat, c.lng, R * 1.004), w: 0, h: 0, prio: c.count > 1 ? 6 : 8, kind: c.count > 1 ? "flagn" : "flag" });
    });
    if (k) this.plantPending = [...this.fpFresh];
  }
  private updateMarks(t: number, pxWorld: (p: THREE.Vector3) => number) {
    // 聚合阈值：屏幕上约 34 像素对应的地表角度；按对数分档，缩放跨档才重排
    const deg = ((2 * Math.tan((this.camera.fov * D2R) / 2) * Math.max(0.01, this.cam.alt)) / this.h) * 34 / D2R;
    const bucket = Math.round(Math.log2(deg) * 2);
    if (bucket !== this.flagBucket) { this.flagBucket = bucket; this.rebuildFlags(Math.pow(2, bucket / 2)); }
    const camN = this.camera.position.clone().normalize(); let anyPlanting = false;
    for (const f of this.flags) {
      const N = f.P.clone().normalize(); const vis = N.dot(camN) > 0.05; f.g.visible = vis && this.marks.visible; if (!vis) continue;
      const size = Math.min(pxWorld(f.P) * 30, 0.09); f.g.quaternion.copy(this.standQuat(N, f.P));
      let drop = 0, sq = 1;
      if (f.t0) {
        const u = (t - f.t0) / 0.75; anyPlanting ||= u < 1.2;
        if (u < 0) { f.g.visible = false; continue; }
        if (u < 1) { const b = 1 - Math.pow(1 - u, 3); drop = (1 - b) * 2.4; sq = u > 0.8 ? 1 - Math.sin(((u - 0.8) / 0.2) * Math.PI) * 0.18 : 1; }
        else if (!f.fresh) f.t0 = 0;
        if (f.fresh && u >= 1) { f.fresh = false; const m = this.kit.ring(); m.position.copy(f.P); m.quaternion.copy(f.g.quaternion); this.marks.add(m); this.rings.push({ m, P: f.P, t0: t }); }
      }
      f.g.position.copy(f.P).addScaledVector(N, drop * size); f.g.scale.set(size, size * sq, size);
    }
    for (const r of [...this.rings]) { const u = (t - r.t0) / 0.7; if (u >= 1) { this.marks.remove(r.m); (r.m.material as THREE.Material).dispose(); this.rings.splice(this.rings.indexOf(r), 1); continue; } const sz = pxWorld(r.P) * (10 + u * 26); r.m.scale.setScalar(sz); (r.m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u); }
    if (!anyPlanting && this.plantPending.length) { const ids = this.plantPending; this.plantPending = []; for (const i of ids) this.fpFresh.delete(i); this.ev.planted?.(ids); }
    this.kit.wave(t);
    // 家
    if (this.home) {
      const P = ll2v(this.home.lat, this.home.lng, R * 1.0004); const N = P.clone().normalize(); const vis = N.dot(camN) > 0.05; this.house.visible = vis;
      if (vis) { const size = Math.min(pxWorld(P) * 34, 0.1); this.house.position.copy(P); this.house.quaternion.copy(this.standQuat(N, P)); this.house.scale.setScalar(size); }
    }
  }

  snapshot(): string { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL("image/png"); }
  dispose() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.clearOverlay(); this.kit.dispose(); this.flagEl.remove(); this.renderer.dispose(); this.renderer.domElement.remove(); this.labelsEl.remove(); this.hero.dispose(); }
}
function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }
export { DEFAULT_AVATAR };
