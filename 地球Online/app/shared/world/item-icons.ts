/** 物件图标（第八轮末，D84）：把库里的 3D 模型从一个固定的好角度渲染成一张小图——像 emoji 那种「类 3D」的小物件：
 *  正面偏左四分之三、略俯视（Apple 的物件 emoji 多是这个角度），透明底，脚下一圈柔和的影子，潮玩质感（look.ts）。
 *  仓库主人看了「jev」那条视频里的清单（一格一格 emoji 样的东西）说：「找好角度用类似 emoji 这种类 3D 也可以。」
 *  用处：增减面板与「清单」弹层里一格一格的图、iOS 的清单（嵌入页渲染好随消息把 dataUrl 发过去）、实验台 ?lm=icons 的全家福。
 *  一个离屏的 WebGLRenderer 共用，按帧排队渲染（每帧最多几毫秒，不卡界面），内存里缓存，IndexedDB 里也存一份（按版本号作废）。 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { landmarkFor, type PlaceRef } from "./landmarks.ts";
import { souvenirModel } from "./souvenir-models.ts";
import { extraModel } from "./extra-models.ts";
import { applyToyLook } from "./look.ts";
import { matCache } from "./landmark-kit.ts";
import type { ExtraKind } from "../planner/protocol.ts";
import { Mascot, type MascotForm } from "./mascot.ts";
import { DEFAULT_AVATAR } from "./hero.ts";

export type IconRef =
  | { type: "souvenir"; id: string | null; place?: string }
  | { type: "extra"; kind: ExtraKind }
  | { type: "landmark"; ref: PlaceRef; seed: number }
  /** 角色的形态（D94：捏人面板的形态格子）：不戴帽子、不系围巾以外的东西，正面偏左一点；小人的网格是异步建的，不在这里画 */
  | { type: "form"; form: MascotForm };

/** 模型或角度改了就加一，旧缓存作废 */
export const ICON_VERSION = 3;   // 2：D89 颜色更鲜艳；3：D94 形态的小图（摘掉假影子后重画）
export const iconKey = (r: IconRef): string => r.type === "souvenir" ? `sv:${r.id ?? `snack:${r.place ?? ""}`}` : r.type === "extra" ? `ex:${r.kind}` : r.type === "form" ? `fm:${r.form}` : `lm:${r.ref.name}:${r.seed}`;

/** 看的角度：方位（从正面往左转 32°）、俯角 24°、窄一点的视角（透视不夸张，更像 emoji 的正交感） */
const YAW = -0.56, PITCH = 0.42, FOV = 22, FILL = 0.84;
const DB = "earth-online:item-icons", STORE = "icons";

interface Job { ref: IconRef; key: string; pass: number; res: (url: string) => void; rej: (e: unknown) => void }

export class ItemIcons {
  readonly size: number;
  private pr: number;
  private persist: boolean;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(FOV, 1, 0.05, 200);
  private sun!: THREE.DirectionalLight;
  private shadow!: THREE.Mesh;
  private mem = new Map<string, string>();
  private pending = new Map<string, Promise<string>>();
  private queue: Job[] = [];
  /** 「这一批」的编号：界面每重画一遍清单就开新的一批，新一批的先渲染（搜索结果不用排在上一屏一百样后面）；passOf 记每张图最近被哪一批要过 */
  private pass = 0;
  private passOf = new Map<string, number>();
  private scheduled = false;
  private dead = false;

  constructor(opts: { size?: number; pixelRatio?: number; persist?: boolean } = {}) {
    this.size = opts.size ?? 112; this.pr = Math.min(3, opts.pixelRatio ?? (globalThis.devicePixelRatio || 1)); this.persist = opts.persist ?? true;
  }

  /** 开新的一批：之后 get() 的排在队伍前面；上一批还没渲染的往后挪（再被要到就跟着进新一批） */
  beginPass(): number { return ++this.pass; }

  /** 内存里已经有就立刻给（同步），没有返回 null */
  peek(ref: IconRef): string | null { return this.mem.get(iconKey(ref)) ?? null; }

  /** 取一张图标（PNG 的 data URL）：内存 → IndexedDB → 排队渲染。渲染不了（没有 WebGL）就 reject，界面退回只显示文字 */
  get(ref: IconRef): Promise<string> {
    const key = iconKey(ref); const hit = this.mem.get(key); if (hit) return Promise.resolve(hit);
    this.passOf.set(key, this.pass);
    const p = this.pending.get(key); if (p) { const q = this.queue.find((j) => j.key === key); if (q) q.pass = this.pass; return p; }
    const job = (async () => {
      const stored = this.persist ? await idbGet(this.cacheKey(key)).catch(() => null) : null;
      if (stored) { this.mem.set(key, stored); return stored; }
      // 查完 IndexedDB 才排队：用最近一次被要到的那一批的编号（期间界面可能已经重画过）
      const url = await new Promise<string>((res, rej) => { this.queue.push({ ref, key, pass: this.passOf.get(key) ?? this.pass, res, rej }); this.schedule(); });
      this.mem.set(key, url); if (this.persist) void idbPut(this.cacheKey(key), url).catch(() => undefined);
      return url;
    })();
    this.pending.set(key, job); void job.finally(() => this.pending.delete(key));
    return job;
  }

  /** 一次要很多张（清单弹层）：按顺序排队，逐张回调 */
  prefetch(refs: IconRef[], onEach?: (key: string, url: string) => void) { for (const r of refs) void this.get(r).then((u) => onEach?.(iconKey(r), u)).catch(() => undefined); }

  dispose() { this.dead = true; this.queue.forEach((j) => j.rej(new Error("disposed"))); this.queue = []; this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.renderer = null; }

  private cacheKey(key: string) { return `${ICON_VERSION}:${this.size}x${this.pr}:${key}`; }

  private schedule() {
    if (this.scheduled || this.dead) return; this.scheduled = true;
    const tick = () => { this.scheduled = false; this.drain(); if (this.queue.length) this.schedule(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick); else setTimeout(tick, 0);
  }
  /** 每帧最多渲染 6 ms，剩下的下一帧 */
  private drain() {
    const start = performance.now();
    while (this.queue.length && performance.now() - start < 6) {
      let bi = 0; for (let i = 1; i < this.queue.length; i++) if (this.queue[i].pass > this.queue[bi].pass) bi = i;   // 最新的一批先来，同一批按先后
      const job = this.queue.splice(bi, 1)[0];

      try { job.res(this.render(job.ref)); } catch (e) { job.rej(e); }
    }
  }

  private setup(): THREE.WebGLRenderer {
    if (this.renderer) return this.renderer;
    const canvas = document.createElement("canvas");
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
    r.setClearColor(0x000000, 0); r.setPixelRatio(this.pr); r.setSize(this.size, this.size, false);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.15; r.outputColorSpace = THREE.SRGBColorSpace;
    // 和行李箱同一套光（suitcase-scene.ts）：半球光、带影子的太阳、正面柔光、轮廓光、房间环境贴图
    const pm = new THREE.PMREMGenerator(r); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.45; pm.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe8eefc, 0xd8d0c0, 0.9));
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(0, 6, 14); this.scene.add(fill);
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; this.scene.add(sun); this.scene.add(sun.target); this.sun = sun;
    const rim = new THREE.DirectionalLight(0xffd2a8, 1.2); rim.position.set(5, 5, -6); this.scene.add(rim);
    // 只接影子的地面：别处透明，脚下一团柔和的灰
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.2 })); this.shadow.rotation.x = -Math.PI / 2; this.shadow.receiveShadow = true; this.scene.add(this.shadow);
    this.renderer = r; return r;
  }

  private build(ref: IconRef): THREE.Group {
    if (ref.type === "extra") return extraModel(ref.kind).group;
    if (ref.type === "souvenir") return souvenirModel(ref.id, ref.place ?? ref.id ?? "", 1).group;
    if (ref.type === "form") {   // 已经上过潮玩质感（mascot.ts 自己上），标一下别再上一遍
      const m = new Mascot(ref.form, 0.36); m.setAvatar({ ...DEFAULT_AVATAR, form: ref.form, hat: "none" }); m.showShadow(false); m.group.rotation.y = 0.35; m.group.userData.looked = true; return m.group;
    }
    return landmarkFor(ref.ref, ref.seed).group;
  }

  private render(ref: IconRef): string {
    const r = this.setup(); const g = this.build(ref);
    this.scene.add(g); g.updateMatrixWorld(true); if (!g.userData.looked) applyToyLook(g);
    const box = new THREE.Box3().setFromObject(g); const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()); const rad = Math.max(1e-3, size.length() / 2);
    // 影子的地面贴着底，太阳从左上前方照过来（和箱子里一致），影子的相机刚好罩住这件东西
    this.shadow.position.set(c.x, box.min.y - 0.002, c.z); this.shadow.scale.setScalar(rad * 6);
    this.sun.position.set(c.x - rad * 2.2, box.max.y + rad * 3.6, c.z + rad * 2.6); this.sun.target.position.copy(c); this.sun.target.updateMatrixWorld();
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -rad * 1.8; sc.right = sc.top = rad * 1.8; sc.near = 0.05; sc.far = rad * 12; sc.updateProjectionMatrix();
    // 相机：固定的方向，距离按投影后的包围盒反推，让东西占画面的 FILL
    const dir = new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH));
    const look = c.clone().setY(c.y - size.y * 0.04);                                    // 视线略低于中心，给头顶留一点、脚下的影子露一点
    let d = rad / Math.sin(THREE.MathUtils.degToRad(FOV / 2));
    const corners = cornersOf(box); const v = new THREE.Vector3();
    for (let i = 0; i < 3; i++) {
      this.cam.position.copy(look).addScaledVector(dir, d); this.cam.lookAt(look); this.cam.updateMatrixWorld(true); this.cam.updateProjectionMatrix();
      let m = 0; for (const p of corners) { v.copy(p).project(this.cam); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); }
      if (m <= 0) break; d *= m / FILL;
    }
    this.cam.position.copy(look).addScaledVector(dir, d); this.cam.lookAt(look); this.cam.updateMatrixWorld(true);
    r.render(this.scene, this.cam);
    const url = r.domElement.toDataURL("image/png");
    this.scene.remove(g); disposeModel(g);
    return url;
  }
}

function cornersOf(b: THREE.Box3): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
}
/** 渲染完就扔：几何体都是这件东西自己的；材质里 look.ts 新建的那些也扔，积木缓存里的（mat()）留着 */
function disposeModel(g: THREE.Group) {
  const cached = new Set(matCache.values());
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return; o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!cached.has(m) && !(m.userData as { shared?: boolean }).shared) m.dispose();
  });
}

// ---------------------------------------------------------------- IndexedDB（没有就只用内存）；连接只开一次
let dbp: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  dbp ??= openDbOnce().catch((e) => { dbp = null; throw e; }); return dbp;
}
function openDbOnce(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") { rej(new Error("no indexedDB")); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error ?? new Error("indexedDB"));
  });
}
function idbGet(key: string): Promise<string | null> {
  return openDb().then((db) => new Promise<string | null>((res, rej) => { const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key); r.onsuccess = () => res(typeof r.result === "string" ? r.result : null); r.onerror = () => rej(r.error); }));
}
function idbPut(key: string, value: string): Promise<void> {
  return openDb().then((db) => new Promise<void>((res, rej) => { const r = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }));
}
