/** 卡通小人 v4（第五轮）：参照《潜水员戴夫》的圆润体量 +《双人成行》的玩偶质感。
 *  - 形体：有向距离场「捏」出来再网格化（sdf.ts），部件内部平滑并集，没有接缝；
 *  - 眼睛：真的三维眼球（大虹膜贴图 + 清漆高光）+ 一条贴着上沿的眼线，不再是画在脸上的；脸上只画眉、嘴、腮红、雀斑；
 *  - 细节：拉链、口袋盖、下摆与袖口罗纹、背包肩带、靴底与鞋带、卷边裤脚、围巾流苏、发绳；
 *  - 材质：着色器里程序化的布料细节（fabric.ts：毛线针脚、绗缝明线、牛仔斜纹与侧缝、发束、绒、编织），
 *    再加按距离场算的接触阴影（顶点色），褶皱和贴合处自然变暗；
 *  - 颜色克制：一件主色外套 + 奶油色毛线三件套 + 牛仔蓝 + 棕色靴，背包用界面的墨蓝。 */
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { Avatar } from "../spec/types.ts";
import { col, vcol, type RGB } from "./style.ts";
import { polygonize, type Vec3, type MeshData, type SDF } from "./sdf.ts";
import { SHAPES, HEAD_Y, SHOULDER, HIP, EYE, TAU, type PartSpec, type ShapeRef } from "./hero-shapes.ts";
import { partGeometry } from "./hero-mesh.ts";
export { SHAPES };
import { patchFabric, type FabricOpts } from "./fabric.ts";

export const SKIN_COLORS: RGB[] = [[248, 210, 186], [236, 190, 160], [206, 156, 120], [150, 104, 76]];
export const HAIR_COLORS: RGB[] = [[66, 42, 34], [30, 26, 30], [140, 92, 58], [206, 160, 98], [104, 58, 82]];
/** 外套（羽绒服）/ 连衣裙：金、靛蓝、奶油、灰绿、玫瑰、墨 */
export const DRESS_COLORS: RGB[] = [[218, 168, 86], [74, 95, 176], [238, 232, 220], [134, 160, 138], [212, 132, 144], [58, 66, 96]];
/** 毛线三件套（帽 / 围巾 / 手套）与草帽 */
export const HAT_COLORS: RGB[] = [[242, 236, 224], [74, 95, 176], [226, 172, 70], [58, 66, 96]];
export const SHOE_COLORS: RGB[] = [[112, 80, 62], [48, 50, 64], [236, 230, 218], [136, 62, 72]];
export const DEFAULT_AVATAR: Avatar = { skin: 0, hair: "short", hairColor: 0, dress: 0, hat: "cap", hatColor: 0, shoes: 0, name: "小旅" };
export type Outfit = "puffer" | "dress";
export type Vehicle = "car" | "boat" | "plane" | "train" | null;

/** 眼球贴图：暖白眼白（边缘略暗）、大虹膜（深棕 → 琥珀的放射纹 + 深色外圈）、瞳孔、上方眼睑投下的一抹阴影、两个高光 */
function eyeTexture(): THREE.CanvasTexture {
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d")!; const C = S / 2;
  x.fillStyle = "#1e1512"; x.fillRect(0, 0, S, S);
  const R = S * 0.5;
  const ig = x.createRadialGradient(C, C + R * 0.1, R * 0.15, C, C, R); ig.addColorStop(0, "#1e1512"); ig.addColorStop(0.7, "#2c1d17"); ig.addColorStop(1, "#4a3024");
  x.fillStyle = ig; x.beginPath(); x.arc(C, C, R, 0, TAU); x.fill();
  
  const lid = x.createLinearGradient(0, C - R * 1.2, 0, C - R * 0.4); lid.addColorStop(0, "rgba(60,30,30,0.35)"); lid.addColorStop(1, "rgba(60,30,30,0)"); x.fillStyle = lid; x.fillRect(0, 0, S, C);
  x.fillStyle = "#ffffff"; x.beginPath(); x.ellipse(C - R * 0.28, C - R * 0.3, R * 0.2, R * 0.24, -0.4, 0, TAU); x.fill();
  x.globalAlpha = 0.6; x.beginPath(); x.arc(C + R * 0.3, C + R * 0.34, R * 0.08, 0, TAU); x.fill(); x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function eyeGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 40, 28); const p = g.attributes.position as THREE.BufferAttribute; const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getY(i) * 0.5 + 0.5); }   // 从正面平行投影：虹膜在正前方
  return g;
}

const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial({ vertexColors: true, ...p });
const fab = (p: THREE.MeshPhysicalMaterialParameters, o: FabricOpts) => patchFabric(phys(p), o);

const EMPTY = new THREE.BufferGeometry();

export class Hero {
  readonly group = new THREE.Group();
  readonly S: number;
  private rig = new THREE.Group(); private body = new THREE.Group(); private head = new THREE.Group(); private eyes: THREE.Mesh[] = [];
  private arms: THREE.Group[] = []; private legs: THREE.Group[] = []; private vehicleRoot = new THREE.Group();
  /** 材质按「颜色组」分：同一组共用一个颜色，但每个部件可以有自己的布料参数 */
  private m = {
    skin: fab({ roughness: 0.62, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(1, 0.72, 0.64), emissive: new THREE.Color(0.08, 0.03, 0.02) }, { kind: "skin", amp: 0.004, fuzz: 0.12 }),
    hair: fab({ roughness: 0.8, sheen: 1, sheenRoughness: 0.55 }, { kind: "hair", amp: 0.012, n: 13, crown: [0, 0.9, -0.3], fuzz: 0.9 }),
    lash: phys({ roughness: 0.6, color: col([36, 26, 28]), vertexColors: false }),
    tie: phys({ roughness: 0.5, color: col([58, 66, 96]) }),
    beanie: fab({ roughness: 0.95, sheen: 1.0, sheenRoughness: 0.6 }, { kind: "knit", amp: 0.022, n: 30, rows: 16, axis: [0, -0.05], fuzz: 0.6 }),
    beanieCuff: fab({ roughness: 0.95, sheen: 1.0, sheenRoughness: 0.6 }, { kind: "rib", amp: 0.02, n: 64, axis: [0, -0.05], fuzz: 0.6 }),
    pom: fab({ roughness: 1, sheen: 1, sheenRoughness: 0.8 }, { kind: "fur", amp: 0.03 }),
    scarf: fab({ roughness: 0.95, sheen: 1, sheenRoughness: 0.6 }, { kind: "knit", amp: 0.018, n: 44, rows: 20, axis: [0, 0.04], fuzz: 0.6 }),
    mitten: fab({ roughness: 0.95, sheen: 0.9, sheenRoughness: 0.6 }, { kind: "knit", amp: 0.016, n: 22, rows: 22, axis: [0.2, 0.1], fuzz: 0.6 }),
    jacket: fab({ roughness: 0.75, sheen: 1, sheenRoughness: 0.5 }, { kind: "nylon", fuzz: 0.8, amp: 0.02, y0: 1.18, period: 0.34, hem: 1.24, zip: true, thread: 1.18 }),
    sleeve: fab({ roughness: 0.75, sheen: 1, sheenRoughness: 0.5 }, { kind: "nylon", fuzz: 0.8, amp: 0.02, y0: -0.9, period: 0.3, hem: -0.68, thread: 1.18 }),
    zip: phys({ roughness: 0.35, metalness: 0.4, color: col([58, 66, 96]) }),
    pack: fab({ roughness: 0.85, sheen: 1, sheenRoughness: 0.5, color: col([58, 70, 118]) }, { kind: "canvas", amp: 0.008, fuzz: 0.9 }),
    denim: fab({ roughness: 0.85, sheen: 0.8, sheenRoughness: 0.5, color: col([74, 98, 160]) }, { kind: "denim", amp: 0.012, thread: 1.25, fuzz: 0.6 }),
    denimTop: fab({ roughness: 0.85, sheen: 0.8, sheenRoughness: 0.5, color: col([74, 98, 160]) }, { kind: "denim", amp: 0.012, thread: 1.25, fuzz: 0.6 }),
    boot: fab({ roughness: 0.8, sheen: 0.9, sheenRoughness: 0.5 }, { kind: "leather", amp: 0.008, fuzz: 0.7 }),
    sole: fab({ roughness: 0.8, color: col([62, 50, 46]) }, { kind: "sole", amp: 0.012, y0: -1.115 }),
    lace: fab({ roughness: 0.85, color: col([244, 238, 226]) }, { kind: "lace", amp: 0.008 }),
    fur: fab({ roughness: 1, sheen: 1, sheenRoughness: 0.8, color: col([246, 240, 228]) }, { kind: "fur", amp: 0.03 }),
    dress: fab({ roughness: 0.85, sheen: 1, sheenRoughness: 0.5 }, { kind: "cotton", amp: 0.008, hem: 1.07, fuzz: 0.8 }),
    puff: fab({ roughness: 0.85, sheen: 1, sheenRoughness: 0.5 }, { kind: "cotton", amp: 0.008, fuzz: 0.8 }),
    collar: fab({ roughness: 0.85, sheen: 0.6, color: col([250, 248, 242]) }, { kind: "cotton", amp: 0.008 }),
    sock: fab({ roughness: 0.9, sheen: 0.6, color: col([248, 246, 238]) }, { kind: "rib", amp: 0.012, n: 40 }),
    straw: fab({ roughness: 0.8, sheen: 0.4 }, { kind: "straw", amp: 0.02 }),
    band: phys({ roughness: 0.5, color: col([58, 66, 96]) }),
    carBody: phys({ roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, color: col([218, 168, 86]) }),
    tire: phys({ roughness: 0.8, color: col([48, 46, 52]) }),
    boat: phys({ roughness: 0.35, clearcoat: 0.6, color: col([250, 248, 242]) }),
    plane: phys({ roughness: 0.3, clearcoat: 0.8, color: col([245, 245, 250]) }),
    eye: new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
    face: new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.5 }),
    shadow: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.32 }),
  };
  private parts: Record<string, THREE.Object3D> = {};
  private outfit: Outfit = "puffer"; private avatar: Avatar = DEFAULT_AVATAR; private vehicle: Vehicle = null;
  private phase = 0; private walk = 0; private celebrateT = 0; private t = 0; private blinkAt = 2 + Math.random() * 3;

  constructor(faceUrl: string, S = 0.36) {
    this.S = S; this.group.add(this.rig); this.rig.scale.setScalar(S);
    this.rig.add(this.body, this.vehicleRoot); this.body.add(this.head); this.head.position.set(0, HEAD_Y, 0); this.head.scale.setScalar(1.04);
    new THREE.TextureLoader().load(faceUrl, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; this.m.face.map = tex; this.m.face.needsUpdate = true; });
    this.m.eye.map = eyeTexture();
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!; const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(20,30,40,0.9)"); g.addColorStop(1, "rgba(20,30,40,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    this.m.shadow.map = new THREE.CanvasTexture(c);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), this.m.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.renderOrder = 1; this.rig.add(sh); this.parts.shadow = sh;
    this.buildHead(); this.setAvatar(DEFAULT_AVATAR);
  }

  /** 加一个部件：网格在后台算，算好再挂上；第一次整身都齐了才显示（不会一块一块冒出来） */
  private pending = 0; private shown = false;
  private add(spec: PartSpec, mat: THREE.Material, parent: THREE.Object3D, name?: string, shadow = true, then?: (m: THREE.Mesh) => void): THREE.Mesh {
    const m = new THREE.Mesh(EMPTY, mat); m.castShadow = shadow; m.receiveShadow = true; m.visible = false; parent.add(m); if (name) { m.name = name; this.parts[name] = m; }
    this.pending++; if (!this.shown) this.rig.visible = false;
    partGeometry(spec).then((g) => { m.geometry = g; m.visible = true; then?.(m); if (--this.pending === 0) this.reveal(); });
    return m;
  }
  /** 显示前先把着色器在后台编好（每种布料一个程序，同步编会卡住首帧）：编译时整身挪到相机看不见的图层 */
  beforeShow: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
  private reveal() {
    const show = () => { this.rig.traverse((o) => o.layers.set(0)); this.shown = true; this.rig.visible = true; };
    if (!this.beforeShow || this.shown) { show(); return; }
    this.rig.traverse((o) => o.layers.set(31)); this.rig.visible = true;
    this.beforeShow(this.rig).catch(() => {}).then(show);
  }

  private buildHead() {
    this.add({ key: "head", shape: ["head"], lo: [-1.25, -1.2, -1.15], hi: [1.25, 1.15, 1.2], cell: 0.036 }, this.m.skin, this.head, "headMesh", true, (head) => {
      // 贴花在头部本地坐标里投影：用一个不挂在场景里的临时网格（世界矩阵 = 单位阵）
      const tmp = new THREE.Mesh(head.geometry); tmp.updateMatrixWorld(true);
      const decal = new THREE.Mesh(new DecalGeometry(tmp, new THREE.Vector3(0, -0.05, 0.9), new THREE.Euler(0, 0, 0), new THREE.Vector3(1.9, 1.9, 1.2)), this.m.face);
      decal.renderOrder = 2; this.head.add(decal);
    });
    const eg = eyeGeometry();
    for (const s of [-1, 1]) { const e = new THREE.Mesh(eg, this.m.eye); e.position.set(s * EYE.x, EYE.y, EYE.z); e.scale.set(...EYE.r); e.userData.base = e.scale.y; this.head.add(e); this.eyes.push(e); }
  }

  private clearOutfit() {
    for (const k of Object.keys(this.parts)) if (k.startsWith("o:")) { this.parts[k].removeFromParent(); delete this.parts[k]; }
    this.arms.forEach((a) => a.removeFromParent()); this.legs.forEach((l) => l.removeFromParent()); this.arms = []; this.legs = [];
  }

  private buildOutfit(outfit: Outfit, av: Avatar) {
    this.clearOutfit(); const { m } = this; const B = this.body; const o = (n: string) => `o:${n}`;
    // 头发与帽子
    this.add({ key: `hair-${av.hair}`, shape: ["hair", av.hair], lo: [-1.5, -2.2, -1.5], hi: [1.5, 1.3, 1.3], cell: 0.04, occ: [{ shape: ["head"] }] }, m.hair, this.head, o("hair"));
    if (av.hair === "bun") this.add({ key: "ties", shape: ["ties"], lo: [-1.15, -0.75, -0.6], hi: [1.15, -0.15, 0.0], cell: 0.02 }, m.tie, this.head, o("ties"));
    if (av.hat === "cap") {
      this.add({ key: "beanie", shape: ["beanie"], lo: [-1.4, 0.0, -1.45], hi: [1.4, 1.45, 1.35], cell: 0.035, occ: [{ shape: ["beanieCuff"] }] }, m.beanie, this.head, o("beanie"));
      this.add({ key: "beanieCuff", shape: ["beanieCuff"], lo: [-1.45, -0.05, -1.5], hi: [1.45, 0.9, 1.4], cell: 0.034 }, m.beanieCuff, this.head, o("beanieCuff"));
      this.add({ key: "pom", shape: ["pom"], lo: [-0.45, 0.95, -0.65], hi: [0.45, 1.8, 0.2], cell: 0.025 }, m.pom, this.head, o("pom"));
    } else if (av.hat === "straw") {
      this.add({ key: "straw", shape: ["strawHat"], lo: [-2.0, -0.1, -2.1], hi: [2.0, 1.3, 1.95], cell: 0.03 }, m.straw, this.head, o("straw"));
      this.add({ key: "band", shape: ["hatBand"], lo: [-1.2, 0.2, -1.25], hi: [1.2, 0.6, 1.15], cell: 0.03 }, m.band, this.head, o("band"));
    }
    const limb = (parent: THREE.Object3D, pivot: Vec3) => { const g = new THREE.Group(); g.position.set(...pivot); parent.add(g); return g; };
    if (outfit === "puffer") {
      this.add({ key: "jacket", shape: ["jacket"], lo: [-1.1, 0.95, -0.9], hi: [1.1, 3.05, 0.95], cell: 0.035, occ: [{ shape: ["scarf"] }, { shape: ["pack"] }] }, m.jacket, B, o("jacket"));
      this.add({ key: "zipPull", shape: ["zipPull"], lo: [-0.1, 2.35, 0.6], hi: [0.1, 2.65, 0.8], cell: 0.01 }, m.zip, B, o("zipPull"));
      this.add({ key: "scarf", shape: ["scarf"], lo: [-0.8, 1.95, -0.7], hi: [0.8, 3.2, 0.8], cell: 0.03, occ: [{ shape: ["jacket"] }] }, m.scarf, B, o("scarf"));
      this.add({ key: "fringe", shape: ["fringe"], lo: [0.05, 1.8, 0.45], hi: [0.55, 2.1, 0.8], cell: 0.012 }, m.scarf, B, o("fringe"));
      this.add({ key: "pack", shape: ["pack"], lo: [-0.8, 1.3, -1.2], hi: [0.8, 2.85, -0.35], cell: 0.035, occ: [{ shape: ["jacket"] }] }, m.pack, B, o("pack"));
      this.add({ key: "straps", shape: ["straps"], lo: [-0.62, 1.72, -0.75], hi: [0.62, 3.02, 0.82], cell: 0.018, occ: [{ shape: ["jacket"] }] }, m.pack, B, o("straps"));
      this.add({ key: "hips", shape: ["hips"], lo: [-0.75, 0.75, -0.6], hi: [0.75, 1.55, 0.6], cell: 0.035, occ: [{ shape: ["jacket"] }] }, m.denimTop, B, o("hips"));
      for (const s of [-1, 1]) {
        const arm = limb(B, [s * SHOULDER[0], SHOULDER[1], SHOULDER[2]]); const off: Vec3 = [s * SHOULDER[0], SHOULDER[1], SHOULDER[2]];
        this.add({ key: `sleeve${s}`, shape: ["sleeve", s], lo: [-0.6, -1.1, -0.45], hi: [0.6, 0.4, 0.5], cell: 0.03, occ: [{ shape: ["jacket"], off }, { shape: ["mitten", s] }] }, m.sleeve, arm);
        this.add({ key: `mitten${s}`, shape: ["mitten", s], lo: [-0.4, -1.35, -0.2], hi: [0.55, -0.65, 0.45], cell: 0.025, occ: [{ shape: ["sleeve", s] }] }, m.mitten, arm);
        const leg = limb(B, [s * HIP[0], HIP[1], HIP[2]]); const loff: Vec3 = [s * HIP[0], HIP[1], HIP[2]];
        this.add({ key: `pantLeg${s}`, shape: ["pantLeg"], lo: [-0.35, -0.85, -0.35], hi: [0.35, 0.3, 0.35], cell: 0.03, occ: [{ shape: ["hips"], off: loff }, { shape: ["pantCuff"] }] }, m.denim, leg);
        this.add({ key: "pantCuff", shape: ["pantCuff"], lo: [-0.35, -0.82, -0.35], hi: [0.35, -0.58, 0.35], cell: 0.02 }, m.denim, leg);
        this.add({ key: "boot", shape: ["boot"], lo: [-0.4, -1.2, -0.4], hi: [0.4, -0.6, 0.6], cell: 0.03, occ: [{ shape: ["bootCuff"] }, { shape: ["sole"] }] }, m.boot, leg);
        this.add({ key: "sole", shape: ["sole"], lo: [-0.4, -1.25, -0.4], hi: [0.4, -1.05, 0.62], cell: 0.02 }, m.sole, leg);
        this.add({ key: "laces", shape: ["laces"], lo: [-0.16, -1.05, 0.12], hi: [0.16, -0.78, 0.36], cell: 0.01 }, m.lace, leg);
        this.add({ key: "bootCuff", shape: ["bootCuff"], lo: [-0.42, -0.95, -0.42], hi: [0.42, -0.55, 0.42], cell: 0.025 }, m.fur, leg);
        this.arms.push(arm); this.legs.push(leg);
      }
    } else {
      this.add({ key: "bodice", shape: ["bodice"], lo: [-0.9, 1.4, -0.75], hi: [0.9, 2.95, 0.75], cell: 0.035, occ: [{ shape: ["collar"] }] }, m.dress, B, o("bodice"));
      this.add({ key: "skirt", shape: ["skirt"], lo: [-1.25, 0.8, -1.25], hi: [1.25, 2.0, 1.25], cell: 0.03, occ: [{ shape: ["bodice"] }] }, m.dress, B, o("skirt"));
      this.add({ key: "collar", shape: ["collar"], lo: [-0.6, 2.6, -0.6], hi: [0.6, 3.05, 0.6], cell: 0.025 }, m.collar, B, o("collar"));
      for (const s of [-1, 1]) {
        const arm = limb(B, [s * SHOULDER[0], SHOULDER[1], SHOULDER[2]]);
        this.add({ key: `puff${s}`, shape: ["puff", s], lo: [-0.5, -0.4, -0.4], hi: [0.5, 0.35, 0.4], cell: 0.03 }, m.puff, arm);
        this.add({ key: `arm${s}`, shape: ["arm", s], lo: [-0.45, -1.3, -0.3], hi: [0.6, 0.1, 0.4], cell: 0.03, occ: [{ shape: ["puff", s] }] }, m.skin, arm);
        const leg = limb(B, [s * HIP[0], HIP[1], HIP[2]]);
        this.add({ key: "bareLeg", shape: ["bareLeg"], lo: [-0.3, -1.05, -0.3], hi: [0.3, 0.3, 0.3], cell: 0.03, occ: [{ shape: ["sock"] }] }, m.skin, leg);
        this.add({ key: "sock", shape: ["sock"], lo: [-0.3, -1.15, -0.3], hi: [0.3, -0.35, 0.3], cell: 0.025 }, m.sock, leg);
        this.add({ key: "maryJane", shape: ["maryJane"], lo: [-0.35, -1.25, -0.35], hi: [0.35, -0.75, 0.55], cell: 0.025 }, m.boot, leg);
        this.arms.push(arm); this.legs.push(leg);
      }
    }
  }

  /** outfit 不给就按季节 / 纬度自动（地理底板在高纬度或秋冬 → 羽绒服） */
  setAvatar(av: Avatar, outfit?: Outfit) {
    const want = outfit ?? (av as Avatar & { outfit?: Outfit }).outfit ?? this.outfit;
    const rebuild = !this.parts["o:hair"] || want !== this.outfit || av.hair !== this.avatar.hair || av.hat !== this.avatar.hat;
    this.avatar = av; this.outfit = want;
    if (rebuild) this.buildOutfit(want, av);
    const { m } = this; const white = new THREE.Color(1, 1, 1);
    m.skin.color = col(SKIN_COLORS[av.skin % SKIN_COLORS.length]); m.hair.color = col(HAIR_COLORS[av.hairColor % HAIR_COLORS.length]); m.hair.sheenColor = m.hair.color.clone().lerp(white, 0.35);
    const d = vcol(DRESS_COLORS[av.dress % DRESS_COLORS.length]);   // 衣帽鞋过 vcol：与积木同一档鲜艳（D89）；皮肤、头发不动
    for (const k of ["jacket", "sleeve", "dress", "puff"] as const) { m[k].color = d.clone(); m[k].sheenColor = d.clone().lerp(white, 0.5); }
    const hc = vcol(HAT_COLORS[av.hatColor % HAT_COLORS.length]);
    for (const k of ["beanie", "beanieCuff", "scarf", "mitten"] as const) { m[k].color = hc.clone(); m[k].sheenColor = hc.clone().lerp(white, 0.4); }
    m.pom.color = hc.clone().lerp(white, 0.35);
    m.straw.color = vcol(av.hat === "straw" && av.hatColor === 0 ? [236, 208, 140] : HAT_COLORS[av.hatColor % HAT_COLORS.length]);
    m.boot.color = vcol(SHOE_COLORS[av.shoes % SHOE_COLORS.length]);
  }
  setOutfit(o: Outfit) { if (o !== this.outfit) this.setAvatar(this.avatar, o); }
  get currentOutfit() { return this.outfit; }

  setVehicle(v: Vehicle) {
    if (v === this.vehicle) return; this.vehicle = v; this.vehicleRoot.clear();
    const { m } = this; const r = this.vehicleRoot;
    if (v === "car" || v === "train") { this.add({ key: "car", shape: ["car"], lo: [-1.3, 0.1, -1.95], hi: [1.3, 1.6, 1.95], cell: 0.05 }, m.carBody, r); this.add({ key: "wheels", shape: ["wheels"], lo: [-1.3, -0.1, -1.4], hi: [1.3, 0.7, 1.4], cell: 0.045 }, m.tire, r); }
    else if (v === "boat") this.add({ key: "boat", shape: ["boat"], lo: [-1.3, -0.3, -2.35], hi: [1.3, 1.45, 2.35], cell: 0.05 }, m.boat, r);
    else if (v === "plane") this.add({ key: "plane", shape: ["plane"], lo: [-2.3, 0.4, -2.4], hi: [2.3, 2.3, 2.0], cell: 0.05 }, m.plane, r);
    const seated = v === "car" || v === "train" || v === "plane";
    this.body.position.set(0, seated ? (v === "plane" ? 0.15 : -0.35) : v === "boat" ? 0.62 : 0, seated ? 0.05 : 0);
    this.legs.forEach((l) => (l.visible = !seated)); this.parts.shadow.visible = !v || v === "car" || v === "train";
    r.position.z = v === "plane" ? -0.1 : 0;
  }

  face(dx: number, dz: number) { if (Math.abs(dx) + Math.abs(dz) > 1e-4) this.group.rotation.y = Math.atan2(dx, dz); }
  celebrate(seconds = 1.2) { this.celebrateT = seconds; }

  update(dt: number, speed: number) {
    this.t += dt; const riding = !!this.vehicle;
    const target = speed > 0.01 && !riding ? 1 : 0; this.walk += (target - this.walk) * Math.min(1, dt * 8);
    this.phase += dt * (6.2 + Math.min(speed, 3) * 2.2) * (speed > 0.01 ? 1 : 0.35);
    const s = Math.sin(this.phase), w = this.walk;
    this.legs.forEach((l, i) => (l.rotation.x = (i ? -1 : 1) * s * 0.55 * w));
    let armX = [-s * 0.45 * w, s * 0.45 * w], armZ = [0.12, -0.12];
    if (riding && this.vehicle !== "boat") armX = [-0.9, -0.9];
    if (this.celebrateT > 0) { this.celebrateT -= dt; const k = Math.min(1, this.celebrateT * 3); armX[1] = -2.7 * k; armZ[1] = -0.3 * k + Math.sin(this.t * 14) * 0.25 * k; }
    this.arms.forEach((a, i) => { a.rotation.x = armX[i]; a.rotation.z = armZ[i] * (i ? 1 : -1) * -1; });
    const bob = Math.abs(s) * 0.06 * w + (1 - w) * Math.sin(this.t * 2.2) * 0.015 + (riding ? Math.sin(this.t * 9) * 0.02 : 0);
    this.body.position.y = (this.vehicle === "boat" ? 0.62 : this.vehicle === "plane" ? 0.15 : this.vehicle ? -0.35 : 0) + bob;
    this.body.rotation.z = s * 0.03 * w;
    this.head.rotation.z = -s * 0.04 * w; this.head.rotation.x = -0.05 * w + (1 - w) * Math.sin(this.t * 1.3) * 0.03;
    // 眨眼：每 2–5 秒一次，眼球纵向压扁 0.12 秒（上眼睑盖着，看起来就是闭眼）
    if (this.t > this.blinkAt) { const u = (this.t - this.blinkAt) / 0.14; const k = u < 1 ? 1 - Math.sin(Math.PI * u) * 0.92 : 1; for (const e of this.eyes) e.scale.y = (e.userData.base as number) * k; if (u >= 1) this.blinkAt = this.t + 2 + Math.random() * 3; }
    if (this.vehicle === "boat") this.vehicleRoot.rotation.z = Math.sin(this.t * 1.6) * 0.05;
  }

  dispose() { Object.values(this.m).forEach((x) => x.dispose()); }
}

/** 给 Blender（tools/hero_v4）用：把某套装束的全部部件导出成网格 + 摆放矩阵 + 材质名（Node 里跑） */
export function exportParts(outfit: Outfit = "puffer", av: Avatar = DEFAULT_AVATAR): { name: string; material: string; matrix: number[]; mesh: MeshData }[] {
  const out: { name: string; material: string; matrix: number[]; mesh: MeshData }[] = [];
  const M = (x = 0, y = 0, z = 0, s = 1) => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, x, y, z, 1];
  const put = (name: string, material: string, f: SDF, lo: Vec3, hi: Vec3, cell: number, m = M()) => out.push({ name, material, matrix: m, mesh: polygonize(f, lo, hi, cell) });
  const H = M(0, HEAD_Y, 0, 1.04);
  put("head", "skin", SHAPES.head(), [-1.25, -1.2, -1.15], [1.25, 1.15, 1.2], 0.025, H);
  put("hair", "hair", SHAPES.hair(av.hair), [-1.5, -2.2, -1.5], [1.5, 1.3, 1.3], 0.025, H);
  if (av.hair === "bun") put("ties", "tie", SHAPES.ties(), [-1.15, -0.75, -0.6], [1.15, -0.15, 0.0], 0.015, H);
  if (av.hat === "cap") { put("beanie", "knit", SHAPES.beanie(), [-1.4, 0, -1.45], [1.4, 1.45, 1.35], 0.025, H); put("beanieCuff", "rib", SHAPES.beanieCuff(), [-1.45, -0.05, -1.5], [1.45, 0.9, 1.4], 0.02, H); put("pom", "fur", SHAPES.pom(), [-0.45, 0.95, -0.65], [0.45, 1.8, 0.2], 0.02, H); }
  if (outfit === "puffer") {
    put("jacket", "jacket", SHAPES.jacket(), [-1.1, 0.95, -0.9], [1.1, 3.05, 0.95], 0.025); put("zipPull", "zip", SHAPES.zipPull(), [-0.1, 2.35, 0.6], [0.1, 2.65, 0.8], 0.008);
    put("scarf", "knit", SHAPES.scarf(), [-0.8, 1.95, -0.7], [0.8, 3.2, 0.8], 0.025); put("fringe", "knit", SHAPES.fringe(), [0.05, 1.8, 0.45], [0.55, 2.1, 0.8], 0.01);
    put("pack", "pack", SHAPES.pack(), [-0.8, 1.3, -1.2], [0.8, 2.85, -0.35], 0.025); put("straps", "pack", SHAPES.straps(), [-0.62, 1.72, -0.75], [0.62, 3.02, 0.82], 0.012);
    put("hips", "denim", SHAPES.hips(), [-0.75, 0.75, -0.6], [0.75, 1.55, 0.6], 0.03);
    for (const s of [-1, 1]) {
      const A = M(s * SHOULDER[0], SHOULDER[1], SHOULDER[2]), L = M(s * HIP[0], HIP[1], HIP[2]);
      put(`sleeve${s}`, "jacket", SHAPES.sleeve(s), [-0.6, -1.1, -0.45], [0.6, 0.4, 0.5], 0.025, A); put(`mitten${s}`, "knit", SHAPES.mitten(s), [-0.4, -1.35, -0.2], [0.55, -0.65, 0.45], 0.02, A);
      put(`pantLeg${s}`, "denim", SHAPES.pantLeg(), [-0.35, -0.85, -0.35], [0.35, 0.3, 0.35], 0.025, L); put(`pantCuff${s}`, "denim", SHAPES.pantCuff(), [-0.35, -0.82, -0.35], [0.35, -0.58, 0.35], 0.015, L);
      put(`boot${s}`, "boot", SHAPES.boot(), [-0.4, -1.2, -0.4], [0.4, -0.6, 0.6], 0.025, L); put(`sole${s}`, "sole", SHAPES.sole(), [-0.4, -1.25, -0.4], [0.4, -1.05, 0.62], 0.015, L);
      put(`laces${s}`, "lace", SHAPES.laces(), [-0.16, -1.05, 0.12], [0.16, -0.78, 0.36], 0.008, L); put(`bootCuff${s}`, "fur", SHAPES.bootCuff(), [-0.42, -0.95, -0.42], [0.42, -0.55, 0.42], 0.02, L);
    }
  }
  return out;
}
export const HERO_ANCHORS = { HEAD_Y, SHOULDER, HIP, TAU, EYE };
