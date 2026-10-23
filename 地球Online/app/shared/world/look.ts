/** 潮玩的质感（第八轮末，D83）：仓库主人发来三张「情绪治愈师」的参考——哑光、渐变、玻璃、圆润。
 *  这里是一道「上色」工序，给拼好的模型（积木里 mat() 出来的普通材质）换成这一套质感：
 *  - 哑光：软胶玩具那种不反光但有一层绒光的面（MeshPhysicalMaterial：粗糙 0.5～0.8，sheen 一点，clearcoat 几乎没有）；
 *  - 渐变：整件东西从上到下一道柔和的渐变（顶上亮一点、暖一点，底下暗一点、偏冷），烤进顶点色，不用贴图；
 *  - 玻璃：原来半透明的（罐子、瓶子）换成真正的透射玻璃；原来又黑又亮的小点（眼睛、鼻子）换成清漆的亮球；
 *  - 金属（铜、银）保留金属度，加一层清漆；
 *  - 圆润：积木的圆角盒默认圆角大一点（landmark-kit.ts）。
 *  只换这一份模型的材质（新建，不改 mat() 的缓存），所以某一天的世界里同一批模型不受影响；几何体被共用时先复制再烤颜色。 */
import * as THREE from "three";

export interface LookOptions {
  /** 渐变的强度，0 不渐变，1 是参考图那种明显的；默认 1 */
  strength?: number;
}

type Std = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
const isStd = (m: THREE.Material): m is Std => (m as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

type Kind = "matte" | "gloss" | "metal" | "glass";
function kindOf(m: Std): Kind {
  if (m.transparent && m.opacity < 0.6 && !m.map) return "glass";
  if (m.metalness >= 0.3) return "metal";
  if (m.roughness <= 0.25 || (lum(m.color) < 0.03 && m.roughness <= 0.45)) return "gloss";
  return "matte";
}

/** 换材质：按种类新建一份；同一份原材质只新建一次 */
function toyMaterial(src: Std, kind: Kind, baked: boolean, cache: Map<string, THREE.Material>): THREE.Material {
  const key = `${src.uuid}:${kind}:${baked ? 1 : 0}`; const hit = cache.get(key); if (hit) return hit;
  let m: THREE.MeshPhysicalMaterial;
  if (kind === "glass") {
    m = new THREE.MeshPhysicalMaterial({ color: src.color.clone().lerp(new THREE.Color(1, 1, 1), 0.3), transmission: 0.85, thickness: 0.5, ior: 1.4, roughness: 0.1, metalness: 0, transparent: true, opacity: 1, side: src.side });
  } else {
    const common: THREE.MeshPhysicalMaterialParameters = {
      color: baked ? 0xffffff : src.color, vertexColors: baked, map: src.map ?? null, transparent: src.transparent, opacity: src.opacity, side: src.side, alphaTest: src.alphaTest, depthWrite: src.depthWrite,
      emissive: src.emissive.clone(), emissiveIntensity: src.emissiveIntensity,
    };
    if (kind === "gloss") m = new THREE.MeshPhysicalMaterial({ ...common, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
    else if (kind === "metal") m = new THREE.MeshPhysicalMaterial({ ...common, roughness: THREE.MathUtils.clamp(src.roughness, 0.25, 0.5), metalness: src.metalness, clearcoat: 0.35, clearcoatRoughness: 0.2 });
    else m = new THREE.MeshPhysicalMaterial({ ...common, roughness: THREE.MathUtils.clamp(src.roughness, 0.55, 0.8), metalness: 0, sheen: 0.3, sheenRoughness: 0.9, sheenColor: src.color.clone().lerp(new THREE.Color(1, 1, 1), 0.35), clearcoat: 0.04, clearcoatRoughness: 0.5, specularIntensity: 0.5 });   // 绒光跟着本色走：黑的不发灰
  }
  cache.set(key, m); return m;
}

/** 把整件东西从上到下的渐变烤进这个网格的顶点色（世界坐标的 y，按整件的高度算） */
function bakeGradient(mesh: THREE.Mesh, base: THREE.Color, y0: number, y1: number, strength: number) {
  let geo = mesh.geometry; const pos = geo.getAttribute("position"); if (!pos) return;
  const hex = base.getHex(); const tag = geo.userData.look as { color: number } | undefined;
  if (tag && tag.color !== hex) { geo = geo.clone(); mesh.geometry = geo; }                 // 共用的几何体，颜色不同就复制一份
  // 乘法的明暗，不是加法：黑的还是黑，红的还是红（加法会把深色提成灰、把红提成橙）。顶上亮一点并微微偏暖，底下暗一点并微微偏冷
  // 颜色先提一点饱和（参考图是糖果色，不是灰扑扑的；仓库主人：「现在颜色看起来有点暗淡」）
  const hsl = { h: 0, s: 0, l: 0 }; base.getHSL(hsl); const vivid = base.clone(); if (hsl.s > 0.08) vivid.setHSL(hsl.h, Math.min(1, hsl.s * (1 + 0.22 * strength)), hsl.l);
  const clamp01 = (c: THREE.Color) => c.setRGB(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b));
  const top = clamp01(vivid.clone().multiplyScalar(1 + 0.16 * strength).lerp(new THREE.Color(1, 0.96, 0.9), 0.03 * strength));
  const bottom = vivid.clone().multiplyScalar(1 - 0.2 * strength).lerp(new THREE.Color(0.08, 0.09, 0.14), 0.05 * strength);
  const n = pos.count, arr = new Float32Array(n * 3), v = new THREE.Vector3(), c = new THREE.Color(); const span = Math.max(1e-3, y1 - y0);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const t = THREE.MathUtils.clamp((v.y - y0) / span, 0, 1); c.copy(bottom).lerp(top, t * t * (3 - 2 * t));   // 平滑一点
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3)); geo.userData.look = { color: hex };
}

/** 给一件拼好的模型上潮玩的质感。调用前先把它摆好（渐变按它现在的高度算；之后再缩放也没关系） */
export function applyToyLook(root: THREE.Object3D, opts: LookOptions = {}) {
  const strength = opts.strength ?? 1;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root); if (box.isEmpty()) return;
  const cache = new Map<string, THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return; const src = o.material; if (Array.isArray(src) || !isStd(src) || src.userData.noLook) return;
    const kind = kindOf(src);
    const baked = kind !== "glass" && !src.map && strength > 0;
    if (baked) bakeGradient(o, src.color, box.min.y, box.max.y, strength);
    o.material = toyMaterial(src, kind, baked, cache);
  });
}
