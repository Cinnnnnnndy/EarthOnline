/** 行李箱场景（第八轮末，D75 / D78）：一趟旅程走完，总结成一只打开的硬壳箱——世界层里的真 3D，不是画出来的平面。
 *  两半平放：靠镜头的下半摆每天的名胜小模型（landmarks.ts，和某一天的世界里是同一批模型），上半站着这趟穿搭的小人（hero.ts），
 *  旁边是目的地的特色物件（souvenir-models.ts）和一本厚日记。不放票、登机牌、明信片。
 *  内容与位置由 shared/algo/suitcase.ts 决定；这里只负责搭箱子、摆东西、打光、渲染与导出。网页的日记页与 iOS 的嵌入页都用它。 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Outfit } from "./hero.ts";
import { makeCharacter, type Character } from "./character.ts";
import { landmarkFor } from "./landmarks.ts";
import { souvenirModel } from "./souvenir-models.ts";
import { extraModel } from "./extra-models.ts";
import { applyToyLook } from "./look.ts";
import { type RGB, C, mat, add, box, cyl } from "./landmark-kit.ts";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { caseContents, layout, frontRow, isCaseExtra, CASE, SUITCASE_STYLE, DEFAULT_SUITCASE, type CaseContents, type CaseExtra, type SuitcaseStyleDef } from "../algo/suitcase.ts";
import { mulberry32 } from "../algo/prng.ts";
import type { Trip, Avatar, SuitcaseStyle, CaseCard } from "../spec/types.ts";
import type { PackedExtra } from "../planner/protocol.ts";

const TRIM: RGB = [40, 44, 56], DAWN: RGB = [240, 176, 58], CREAM: RGB = [246, 240, 226];
const FLOOR = 0.04;           // 里衬垫高一点，东西放在垫子上
const PAPER = 0xf7f8fb;       // 导出时的底色（界面里是透明的，露出页面的底）

export class SuitcaseScene {
  readonly canvas: HTMLCanvasElement;
  /** 箱子里有什么（给界面写一行说明用） */
  contents: CaseContents | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  /** 前排（照片卡、自己挑的随身物件、「AI 加的」）单独一组，服务回来再换，不用重装整箱 */
  private extrasGroup = new THREE.Group();
  /** 前排里现在摆着的随身物件：mine 是自己挑的，其余是 AI 加的 */
  extras: CaseExtra[] = [];
  /** 箱子本身单独一组，换样式时只换它 */
  private caseGroup: THREE.Group | null = null;
  /** 名胜、物件、日记一组；增减时只重摆它和前排 */
  private itemsGroup = new THREE.Group();
  style: SuitcaseStyle = DEFAULT_SUITCASE;
  /** 自己放的照片卡（D82）与它们的图；前排 = 照片卡在前，AI 加的补在后面，一共最多 3 */
  private cards: CaseCard[] = [];
  private images = new Map<string, TexImageSource>();
  private lastExtras: PackedExtra[] = [];
  private textures: THREE.Texture[] = [];
  private hero: Character | null = null;
  private updates: ((t: number) => void)[] = [];
  private raf = 0; private last = 0; private az = 0; private running = false;
  private ro: ResizeObserver | null = null;

  constructor(private host: HTMLElement, private opts: { assetBase: string }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0); this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // 中性的色调映射（不像 ACES 那样把饱和色压灰），曝光略高：参考图那种明亮的糖果色
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.15; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement; this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y"; host.appendChild(this.canvas);
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.45; pm.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe8eefc, 0xd8d0c0, 0.9));
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(0, 6, 14); this.scene.add(fill);   // 正面一点柔光，像参考图的棚拍
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.4); sun.position.set(-5, 10, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -8; sun.shadow.camera.right = sun.shadow.camera.top = 8; sun.shadow.camera.near = 1; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffd2a8, 1.4); rim.position.set(6, 5, -7); this.scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.22; ground.receiveShadow = true; this.scene.add(ground);
    this.scene.add(this.root);
    this.cam = new THREE.PerspectiveCamera(34, 0.8, 0.1, 100); this.place();
    // 拖一下可以稍微转着看（左右各 35°）
    let drag: number | null = null;
    this.canvas.addEventListener("pointerdown", (e) => { drag = e.clientX; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener("pointermove", (e) => { if (drag === null) return; this.az = Math.max(-0.6, Math.min(0.6, this.az - (e.clientX - drag) * 0.006)); drag = e.clientX; this.place(); if (!this.running) this.render(); });
    const up = () => (drag = null); this.canvas.addEventListener("pointerup", up); this.canvas.addEventListener("pointercancel", up);
    this.ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.resize()) : null; this.ro?.observe(host);
    this.resize();
  }

  /** 相机：从正前上方 52° 俯看，两半都在画面里（连轮子、提手与行李牌）；竖幅 4 : 5 */
  private place() { const d = 20.5, el = 0.9; const t = new THREE.Vector3(0, 0.3, 0.5); this.cam.position.set(t.x + Math.sin(this.az) * Math.cos(el) * d, t.y + Math.sin(el) * d, t.z + Math.cos(this.az) * Math.cos(el) * d); this.cam.lookAt(t); }
  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight || Math.round(w * 1.25));
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); if (!this.running) this.render();
  }

  /** 装箱：先清空，再按内容清单摆进去；extras 是「AI 加的」那几样（可以先给规则的，服务回来再 setExtras） */
  show(trip: Trip, avatar: Avatar, outfit: Outfit, extras: PackedExtra[] = [], style?: SuitcaseStyle, images?: Map<string, TexImageSource>) {
    this.clear();
    this.style = style ?? avatar.suitcase ?? DEFAULT_SUITCASE;
    this.caseGroup = buildCase(this.style); this.root.add(this.caseGroup);
    this.root.add(this.itemsGroup); this.root.add(this.extrasGroup);
    this.update(trip, extras, images ?? new Map());
    const hero = makeCharacter(avatar, this.opts.assetBase + "assets/hero_face.png");   // 小人，或 Q 版的动物 / 自建 IP（D86）
    hero.beforeShow = (o) => this.renderer.compileAsync(o, this.cam, this.scene);
    const slot = layout(0, 0).hero; hero.setAvatar(avatar, outfit); hero.group.position.set(slot.x, FLOOR, slot.z); hero.group.rotation.y = 0.18; hero.group.scale.setScalar(1.08);
    this.root.add(hero.group); this.hero = hero;
    this.start();
  }

  /** 东西变了（增减、照片卡、服务回来的几样）：只重摆名胜、物件、日记与前排，箱体与小人不动 */
  update(trip: Trip, extras: PackedExtra[], images?: Map<string, TexImageSource>) {
    if (images) this.images = images;
    this.itemsGroup.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); this.itemsGroup.clear(); this.updates = [];
    const c = caseContents(trip); this.contents = c; this.cards = c.cards;
    const front = frontRow(c, extras); const L = layout(c.landmarks.length, c.souvenirs.length, front.length); const r = mulberry32(trip.seed);
    c.landmarks.forEach((lm, i) => {
      const m = landmarkFor(lm.ref, trip.seed + i); const s = L.landmarks[i];
      // 直接放在里衬上，不垫底板（仓库主人：就像物品直接放在行李箱里一样）
      m.group.rotation.y = (r.next() - 0.5) * 0.3; applyToyLook(m.group); fitInto(m.group, s.x, s.z, s.w * 0.94, s.d * 0.94, 2.3);
      this.itemsGroup.add(m.group); if (m.update) this.updates.push(m.update);
    });
    c.souvenirs.forEach((sv, i) => {
      const m = souvenirModel(sv.item, sv.place, trip.seed + 31 + i); const s = L.souvenirs[i];
      m.group.rotation.y = (r.next() - 0.5) * 0.6; applyToyLook(m.group); fitInto(m.group, s.x, s.z, s.w * 0.9, s.d * 0.85, 1.6); this.itemsGroup.add(m.group);
    });
    const book = diary(L.diary.x, L.diary.z); applyToyLook(book, { strength: 0.6 }); this.itemsGroup.add(book);
    this.setExtras(extras);
  }

  /** 换箱子的样式（D81）：只重搭箱子，东西不动 */
  setStyle(style: SuitcaseStyle) {
    this.style = style; if (!this.contents) return;
    if (this.caseGroup) { this.caseGroup.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); this.root.remove(this.caseGroup); }
    this.caseGroup = buildCase(style); this.root.add(this.caseGroup); if (!this.running) this.render();
  }

  /** 照片卡的图读到了（IndexedDB 是异步的），重摆前排 */
  setImages(images: Map<string, TexImageSource>) { this.images = images; this.setExtras(this.lastExtras); }

  /** 换掉「AI 加的」那几样（规则的 → 服务回来的）；照片卡与自己挑的一起重摆 */
  setExtras(extras: PackedExtra[]) {
    const c = this.contents; if (!c) return; this.lastExtras = extras;
    this.extrasGroup.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); this.extrasGroup.clear();
    const front = frontRow(c, extras); this.extras = front.filter(isCaseExtra);
    const L = layout(c.landmarks.length, c.souvenirs.length, front.length); const r = mulberry32(front.length * 7 + 1);
    front.forEach((e, i) => {
      const s = L.front[i];
      if ("w" in e) { const m = cardModel(e, this.images.get(e.id), this.textures); m.group.rotation.y = (r.next() - 0.5) * 0.3; fitInto(m.group, s.x, s.z, s.w * 0.95, s.d * 0.9, 1.45); this.extrasGroup.add(m.group); }
      else { const m = extraModel(e.kind); m.group.rotation.y = (r.next() - 0.5) * 0.7; applyToyLook(m.group); fitInto(m.group, s.x, s.z, s.w * 0.9, s.d * 0.85, 1.15); this.extrasGroup.add(m.group); }
    });
    if (!this.running) this.render();
  }

  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const loop = (t: number) => { if (!this.running) return; this.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.hero?.update(dt, 0); for (const u of this.updates) u(t / 1000); this.render(); };
    this.raf = requestAnimationFrame(loop);
  }
  pause() { this.running = false; cancelAnimationFrame(this.raf); }
  private render() { this.renderer.render(this.scene, this.cam); }

  /** 导出：按 1080 × 1350（手机分享的比例）重新渲染一帧，底色是纸色 */
  private snapshot<T>(w: number, h: number, take: (canvas: HTMLCanvasElement) => T): T {
    const size = new THREE.Vector2(); this.renderer.getSize(size); const pr = this.renderer.getPixelRatio(); const aspect = this.cam.aspect;
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.renderer.setClearColor(PAPER, 1); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.render();
    try { return take(this.canvas); }
    finally { this.renderer.setClearColor(0x000000, 0); this.renderer.setPixelRatio(pr); this.renderer.setSize(size.x, size.y, false); this.cam.aspect = aspect; this.cam.updateProjectionMatrix(); this.render(); }
  }
  dataUrl(w = 1080, h = 1350): string { return this.snapshot(w, h, (c) => c.toDataURL("image/png")); }
  exportPNG(w = 1080, h = 1350): Promise<Blob> {
    const url = this.dataUrl(w, h);
    return fetch(url).then((r) => r.blob());
  }

  private clear() {
    this.hero?.dispose(); this.hero = null; this.updates = [];
    this.textures.forEach((t) => t.dispose()); this.textures = [];
    this.root.traverse((o) => { if (o instanceof THREE.Mesh && !(o.material as THREE.Material & { userData?: { shared?: boolean } }).userData?.shared) o.geometry.dispose(); });
    this.root.clear(); this.itemsGroup.clear(); this.extrasGroup.clear(); this.caseGroup = null;
  }
  dispose() { this.pause(); this.ro?.disconnect(); this.clear(); this.renderer.dispose(); this.canvas.remove(); }
}

/** 量实际的包围盒，把东西缩到格子里（宽、深、高都不超），底面落在里衬上、中心对到格子中心；返回缩好后的尺寸。
 *  模型自带的 footprint 只是大概，不够准 */
function fitInto(g: THREE.Group, x: number, z: number, maxW: number, maxD: number, maxH: number, lift = 0): THREE.Vector3 {
  g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); const size = b.getSize(new THREE.Vector3());
  const k = Math.min(maxW / Math.max(0.2, size.x), maxD / Math.max(0.2, size.z), maxH / Math.max(0.2, size.y));
  g.scale.setScalar(k); g.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(g); const c = b2.getCenter(new THREE.Vector3());
  g.position.set(x - c.x, FLOOR + lift - b2.min.y, z - c.z);
  return b2.getSize(new THREE.Vector3());
}

// ---------- 箱子（四种样式，表在 shared/algo/suitcase.ts 的 SUITCASE_STYLE）

const shellMaterial = (st: SuitcaseStyleDef): THREE.Material =>
  st.finish === "gloss" ? new THREE.MeshPhysicalMaterial({ color: C(st.shell), roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.2, sheenRoughness: 0.8 }) : new THREE.MeshPhysicalMaterial({ color: C(st.shell), roughness: st.ribs === "slats" ? 0.75 : 0.9, sheen: 0.4, sheenRoughness: 0.8 });
const trimMaterial = (st: SuitcaseStyleDef): THREE.Material =>
  st.corners === "brass" ? new THREE.MeshStandardMaterial({ color: C(st.trim), roughness: 0.3, metalness: 0.6 }) : mat(st.trim, st.corners === "leather" ? 0.75 : 0.5);

/** 外壳四面墙上的纹路：硬壳是竖肋，木箱是横板条；合并成一个网格 */
function ribs(w: number, d: number, rim: number, wall: number, st: SuitcaseStyleDef): THREE.Mesh | null {
  if (st.ribs === "none") return null;
  const parts: THREE.BufferGeometry[] = []; const ox = w / 2 + wall, oz = d / 2 + wall, t = 0.035;
  if (st.ribs === "vertical") {
    const h = rim - 0.3, rw = 0.09, step = 0.42;
    for (let x = -ox + 0.6; x <= ox - 0.6; x += step) for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(rw, h, t).translate(x, rim / 2 - 0.05, s * (oz + t / 2)));
    for (let z = -oz + 0.6; z <= oz - 0.6; z += step) for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(t, h, rw).translate(s * (ox + t / 2), rim / 2 - 0.05, z));
  } else {
    for (const y of [rim * 0.3, rim * 0.62]) for (const s of [-1, 1]) { parts.push(new THREE.BoxGeometry(2 * ox - 0.9, 0.13, t).translate(0, y, s * (oz + t / 2))); parts.push(new THREE.BoxGeometry(t, 0.13, 2 * oz - 0.9).translate(s * (ox + t / 2), y, 0)); }
  }
  const color = C(st.shell).multiplyScalar(st.ribs === "slats" ? 0.72 : 0.93);
  const m = new THREE.Mesh(mergeGeometries(parts), st.finish === "gloss" ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 }) : new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.castShadow = true; m.receiveShadow = true; parts.forEach((p) => p.dispose()); return m;
}
/** 帆布箱：前后墙外面各两条皮带，带铜扣 */
function straps(g: THREE.Group, d: number, rim: number, wall: number, color: RGB) {
  const leather = mat(color, 0.75), buckle = new THREE.MeshStandardMaterial({ color: C([200, 160, 90]), roughness: 0.3, metalness: 0.6 }); const oz = d / 2 + wall;
  for (const x of [-1.7, 1.7]) for (const s of [-1, 1]) { add(g, box(0.3, rim + 0.2, 0.05, 0.02), leather, x, rim / 2 - 0.05, s * (oz + 0.025)); add(g, box(0.34, 0.12, 0.07, 0.02), buckle, x, rim * 0.55, s * (oz + 0.035)); }
}
/** 木箱：沿口一圈小铜钉，合并成一个网格 */
function rivets(g: THREE.Group, w: number, d: number, rim: number, wall: number, brass: THREE.Material) {
  const ox = w / 2 + wall, oz = d / 2 + wall; const parts: THREE.BufferGeometry[] = [];
  for (let x = -ox + 0.4; x <= ox - 0.4; x += 0.5) for (const s of [-1, 1]) parts.push(new THREE.SphereGeometry(0.04, 8, 6).translate(x, rim - 0.2, s * (oz + 0.02)));
  for (let z = -oz + 0.4; z <= oz - 0.4; z += 0.5) for (const s of [-1, 1]) parts.push(new THREE.SphereGeometry(0.04, 8, 6).translate(s * (ox + 0.02), rim - 0.2, z));
  const m = new THREE.Mesh(mergeGeometries(parts), brass); m.castShadow = true; g.add(m); parts.forEach((p) => p.dispose());
}

/** 一半箱子：底板、四面墙（外壳）、里衬、沿口一圈、四个护角、纹路（与皮带 / 铜钉）。原点在里衬地面的中心 */
function half(w: number, d: number, rim: number, wall: number, st: SuitcaseStyleDef): THREE.Group {
  const g = new THREE.Group(); const sh = shellMaterial(st), trim = trimMaterial(st), lining = mat(st.lining, 0.95);
  add(g, box(w + 2 * wall, 0.22, d + 2 * wall, 0.1), sh, 0, -0.11, 0);
  add(g, box(w, FLOOR, d, 0.02), lining, 0, FLOOR / 2, 0);
  for (const s of [-1, 1]) {
    add(g, box(w + 2 * wall, rim, wall, 0.08), sh, 0, rim / 2, s * (d / 2 + wall / 2));
    add(g, box(wall, rim, d, 0.08), sh, s * (w / 2 + wall / 2), rim / 2, 0);
    add(g, box(w, rim - 0.08, 0.04, 0.01), lining, 0, (rim - 0.08) / 2 + FLOOR, s * (d / 2 - 0.02));
    add(g, box(0.04, rim - 0.08, d, 0.01), lining, s * (w / 2 - 0.02), (rim - 0.08) / 2 + FLOOR, 0);
    // 沿口一圈：硬壳是拉链（墨 / 银），木箱是铜边，帆布是皮边
    add(g, box(w + 2 * wall + 0.04, 0.07, 0.1, 0.02), trim, 0, rim, s * (d / 2 + wall / 2));
    add(g, box(0.1, 0.07, d + 2 * wall + 0.04, 0.02), trim, s * (w / 2 + wall / 2), rim, 0);
  }
  const cr = st.corners === "leather" ? 0.2 : 0.12;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.5, rim + 0.26, 0.5, cr), trim, sx * (w / 2 + wall / 2 - 0.02), rim / 2 - 0.1, sz * (d / 2 + wall / 2 - 0.02));
  const r = ribs(w, d, rim, wall, st); if (r) g.add(r);
  if (st.straps) straps(g, d, rim, wall, st.straps);
  if (st.rivets) rivets(g, w, d, rim, wall, trim);
  return g;
}

/** 整只箱子：下半（靠镜头，带轮子、提手与行李牌）、上半、中间的合页 */
function buildCase(style: SuitcaseStyle): THREE.Group {
  const st = SUITCASE_STYLE[style] ?? SUITCASE_STYLE[DEFAULT_SUITCASE];
  const g = new THREE.Group(); const { W, D, RIM, GAP, WALL } = CASE; const trim = trimMaterial(st), rubber = mat([44, 46, 52], 0.8);
  const baseZ = GAP / 2 + D / 2;
  const base = half(W, D, RIM, WALL, st); base.position.z = baseZ; g.add(base);
  const lid = half(W, D, RIM * 0.92, WALL, st); lid.position.z = -baseZ; g.add(lid);
  for (const x of [-2.1, 2.1]) add(g, cyl(0.1, 0.1, 1.3, 12), trim, x, 0.0, 0).rotation.z = Math.PI / 2;
  // 轮子：下半靠镜头那一边的两角（木箱没有）
  if (st.wheels) for (const s of [-1, 1]) { add(g, cyl(0.3, 0.3, 0.2, 20), rubber, s * (W / 2 + WALL - 0.4), 0.08, baseZ + D / 2 + WALL + 0.1).rotation.z = Math.PI / 2; add(g, cyl(0.12, 0.12, 0.22, 12), trim, s * (W / 2 + WALL - 0.4), 0.08, baseZ + D / 2 + WALL + 0.1).rotation.z = Math.PI / 2; }
  // 提手：下半右侧；行李牌（晨色）挂在提手上——四款都有，它是唯一的高亮，也是「我的」箱子的记号
  const hx = W / 2 + WALL + 0.14, hy = RIM * 0.55;
  add(g, cyl(0.05, 0.05, 0.9, 10), trim, hx + 0.1, hy, baseZ).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(g, cyl(0.045, 0.045, 0.3, 10), trim, hx - 0.02, hy, baseZ + s * 0.42).rotation.z = Math.PI / 2;
  const tag = new THREE.Group(); tag.position.set(hx + 0.12, hy - 0.08, baseZ + 0.55); tag.rotation.set(0.1, 0.25, -0.2); g.add(tag);
  add(tag, cyl(0.02, 0.02, 0.3, 8), mat(TRIM, 0.5), 0, -0.1, 0);
  add(tag, box(0.42, 0.6, 0.05, 0.04), mat(DAWN, 0.55), 0, -0.55, 0); add(tag, box(0.26, 0.05, 0.052, 0.01), mat(TRIM, 0.5), 0, -0.62, 0); add(tag, box(0.18, 0.05, 0.052, 0.01), mat(TRIM, 0.5), -0.04, -0.72, 0);
  return g;
}

/** 自己放的照片卡（D82）：抠出来的主体做成立牌（背后一根小支架，不是底板），抠不出来的整张做成拍立得；没图时是一张空白卡 */
function cardModel(card: CaseCard, img: TexImageSource | undefined, textures: THREE.Texture[]): { group: THREE.Group; top: number; footprint: number } {
  const g = new THREE.Group(); const aspect = card.w / Math.max(1, card.h); const H = 1.3, W = Math.max(0.4, H * aspect);
  let tex: THREE.Texture | null = null;
  if (img) { tex = new THREE.Texture(img as HTMLImageElement); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true; textures.push(tex); }
  const tilt = new THREE.Group(); tilt.rotation.x = -0.14; g.add(tilt);
  if (card.kind === "cutout") {
    const m = new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : 0xdddddd, transparent: true, alphaTest: 0.35, roughness: 0.85, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m); p.position.set(0, H / 2 + 0.02, 0); p.castShadow = true; p.receiveShadow = false; tilt.add(p);
    const stand = add(g, box(0.06, H * 0.55, 0.05, 0.01), mat(CREAM, 0.8), 0, H * 0.27, -0.2); stand.rotation.x = 0.4;
    return { group: g, top: H, footprint: Math.max(W, 0.6) };
  }
  const cw = W + 0.16, ch = H + 0.4;
  add(tilt, box(cw, ch, 0.05, 0.02), mat([250, 250, 248], 0.8), 0, ch / 2, 0);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : 0xcfd3dc, roughness: 0.6 })); photo.position.set(0, 0.32 + H / 2, 0.03); tilt.add(photo);
  const stand = add(g, box(0.06, ch * 0.5, 0.05, 0.01), mat(CREAM, 0.8), 0, ch * 0.25, -0.22); stand.rotation.x = 0.4;
  return { group: g, top: ch, footprint: Math.max(cw, 0.6) };
}

/** 一本厚日记（墨色封皮、晨色松紧带、奶油色的页边），立着稍微后仰，旁边一支笔 */
function diary(x: number, z: number): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, FLOOR, z);
  const book = new THREE.Group(); g.add(book); book.rotation.x = -0.32; book.position.z = 0.1;
  add(book, box(0.95, 1.2, 0.34, 0.04), mat(TRIM, 0.6), 0, 0.6, 0);
  add(book, box(0.9, 1.12, 0.3, 0.01), mat(CREAM, 0.9), 0.05, 0.6, 0);
  add(book, box(0.07, 1.22, 0.36, 0.01), mat(DAWN, 0.5), 0.3, 0.61, 0);
  add(book, box(0.4, 0.24, 0.02, 0.01), mat(CREAM, 0.85), -0.1, 0.84, 0.18);
  const pen = add(g, cyl(0.035, 0.035, 0.9, 10), mat(DAWN, 0.4), 0.55, 0.035, 0.55); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5;
  add(g, cyl(0.036, 0.036, 0.16, 10), mat(TRIM, 0.4), 0.95, 0.035, 0.33).rotation.z = Math.PI / 2;
  return g;
}
