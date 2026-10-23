/** 夜里的浮岛（第八轮末，D85）：仓库主人发来一张 Blender 夜林的截图（正经陛暹跟 KurTips 学的那段：深蓝的夜、青蓝的大叶子、
 *  一堆暖黄的篝火、发光的蘑菇、满地萤火、两只小狐狸）。第五轮留下的问题「夜里浮岛是否亮灯」就按它来：
 *  白天的那块浮岛到了夜里（手机的天色是夜）换一套夜色（style.ts 的 nightOf），再撒上这里的几样会发光的东西：
 *  - 萤火：一小片慢慢飘、忽明忽暗的光点（Points + 自己的着色器，叠加混合，不吃阴影）；
 *  - 发光的蘑菇：三两一丛，橙粉色的伞盖自己发光，头顶一团柔光；
 *  - 站点的灯：每个站点图钉头上一圈暖黄的光晕（夜里图钉本身也换成暖色）；
 *  - 民居的窗：每户两扇暖黄的小窗（不受光照的平面，看着就是亮的）；
 *  - 篝火（地理底板上才有）：两根木柴、两层火苗、一团大光晕、一盏会跳的暖光。
 *  这些都只在夜里建，白天一样没有。底板只告诉这里「哪里可以放」（NightSpots），画法全在这里。 */
import * as THREE from "three";
import { mulberry32 } from "../algo/prng.ts";
import { col, type RGB } from "./style.ts";

export interface NightSpots {
  /** 地面上可以放蘑菇、起萤火的点（x, 地面高度, z），越多越好，这里再挑 */
  ground: [number, number, number][];
  /** 站点图钉头的位置：暖光晕 */
  lamps: [number, number, number][];
  /** 民居：中心与朝向（窗开在 +z 面，ry 是绕 y 的转角），s 是缩放 */
  houses: { x: number; y: number; z: number; ry?: number; s?: number }[];
  /** 篝火的位置（没有就不生） */
  fire?: [number, number, number] | null;
  /** 底板的尺寸（萤火的多少按面积） */
  cols: number; rows: number;
}
export interface NightDecor { group: THREE.Group; update(t: number): void; dispose(): void }

const FIREFLY: RGB = [255, 232, 150], MUSHROOM: RGB = [255, 150, 120], MUSHROOM_GLOW: RGB = [255, 130, 96], LAMP: RGB = [255, 212, 140], WINDOW: RGB = [255, 214, 140], FIRE: RGB = [255, 160, 70];

let glowTex: THREE.CanvasTexture | null = null;
/** 一张柔和的圆光（画布径向渐变），所有光晕共用 */
function glow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
}
export function halo(c: RGB, scale: number, opacity: number): THREE.Sprite {
  const m = new THREE.SpriteMaterial({ map: glow(), color: col(c), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(scale); s.renderOrder = 5; return s;
}

/** 萤火：位置固定，着色器里按时间漂与闪 */
function fireflies(points: [number, number, number][], seed: number): { obj: THREE.Points; mat: THREE.ShaderMaterial } {
  const r = mulberry32(seed); const n = points.length;
  const pos = new Float32Array(n * 3), sd = new Float32Array(n * 3);
  points.forEach((p, i) => { pos[i * 3] = p[0] + (r.next() - 0.5) * 0.8; pos[i * 3 + 1] = p[1] + 0.35 + r.next() * 1.3; pos[i * 3 + 2] = p[2] + (r.next() - 0.5) * 0.8; sd[i * 3] = r.next(); sd[i * 3 + 1] = r.next(); sd[i * 3 + 2] = r.next(); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aSeed", new THREE.BufferAttribute(sd, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 30 }, uMax: { value: 24 }, uColor: { value: col(FIREFLY) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aSeed; uniform float uTime; uniform float uScale; uniform float uMax; varying float vA;
      void main(){ vec3 p = position; float t = uTime * (0.35 + aSeed.y * 0.5) + aSeed.x * 6.2831;
        p.x += sin(t) * 0.4 + sin(t * 0.37 + aSeed.x * 4.0) * 0.25; p.z += cos(t * 0.8 + aSeed.z * 3.0) * 0.4; p.y += sin(t * 1.3 + aSeed.x * 3.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.25 + 0.75 * smoothstep(-0.3, 0.9, sin(uTime * (1.2 + aSeed.y * 2.2) + aSeed.x * 12.0)); vA = tw;
        gl_PointSize = clamp((4.0 + aSeed.z * 6.0) * (0.6 + 0.4 * tw) * uScale / max(1.0, -mv.z), 2.0, uMax); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(1.0, 0.0, length(d) * 2.0); a *= a; gl_FragColor = vec4(uColor * (0.5 + 0.5 * vA), a * vA); }`,
  });
  const obj = new THREE.Points(geo, mat); obj.frustumCulled = false; obj.renderOrder = 6; return { obj, mat };
}

export function buildNight(spots: NightSpots, seed: number, pixelRatio = 1): NightDecor {
  const g = new THREE.Group(); g.name = "night"; const r = mulberry32(seed ^ 0x51ed);
  const mats: THREE.Material[] = []; const geos: THREE.BufferGeometry[] = []; const flicker: { s: THREE.Sprite; base: number; k: number; w: number }[] = [];
  const M = <T extends THREE.Material>(m: T) => { mats.push(m); return m; }; const G = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const ground = [...spots.ground];
  const pick = () => ground.length ? ground.splice(r.int(ground.length), 1)[0] : null;

  // 萤火：按面积 40～120 只
  const nFly = Math.round(Math.max(40, Math.min(120, (spots.cols * spots.rows) / 7)));
  const flyPts: [number, number, number][] = []; for (let i = 0; i < nFly && ground.length; i++) flyPts.push(ground[r.int(ground.length)]);
  const ff = flyPts.length ? fireflies(flyPts, seed) : null; if (ff) { g.add(ff.obj); mats.push(ff.mat); geos.push(ff.obj.geometry); ff.mat.uniforms.uScale.value = 30 * pixelRatio; ff.mat.uniforms.uMax.value = 24 * pixelRatio; }

  // 发光的蘑菇：最多 14 丛，每丛 2～3 朵
  const stemGeo = G(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 8)), capGeo = G(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55));
  const stemMat = M(new THREE.MeshStandardMaterial({ color: col([246, 236, 220]), roughness: 0.8 }));
  const capMat = M(new THREE.MeshStandardMaterial({ color: col(MUSHROOM), roughness: 0.6, emissive: col(MUSHROOM_GLOW), emissiveIntensity: 1.3 }));
  const nShroom = Math.min(14, Math.round(spots.ground.length / 12));
  for (let i = 0; i < nShroom; i++) {
    const p = pick(); if (!p) break; const cluster = new THREE.Group(); cluster.position.set(p[0], p[1], p[2]);
    const k = 2 + r.int(2);
    for (let j = 0; j < k; j++) {
      const s = 0.7 + r.next() * 0.7; const ox = (r.next() - 0.5) * 0.3, oz = (r.next() - 0.5) * 0.3;
      const stem = new THREE.Mesh(stemGeo, stemMat); stem.position.set(ox, 0.08 * s, oz); stem.scale.setScalar(s); stem.castShadow = true; cluster.add(stem);
      const cap = new THREE.Mesh(capGeo, capMat); cap.position.set(ox, 0.14 * s, oz); cap.scale.set(s, s * 0.7, s); cluster.add(cap);
      const h = halo(MUSHROOM_GLOW, 0.55 * s, 0.5); h.position.set(ox, 0.2 * s, oz); cluster.add(h); mats.push(h.material); flicker.push({ s: h, base: 0.5, k: 0.1, w: 1.5 + r.next() });
    }
    g.add(cluster);
  }

  // 站点的灯：暖光晕
  for (const [x, y, z] of spots.lamps) { const h = halo(LAMP, 1.7, 0.65); h.position.set(x, y, z); g.add(h); mats.push(h.material); flicker.push({ s: h, base: 0.6, k: 0.06, w: 2.5 + r.next() }); }

  // 民居的窗：不受光的小平面，两扇一户
  if (spots.houses.length) {
    const wGeo = G(new THREE.PlaneGeometry(0.09, 0.1)); const wMat = M(new THREE.MeshBasicMaterial({ color: col(WINDOW), fog: false }));
    const im = new THREE.InstancedMesh(wGeo, wMat, spots.houses.length * 2); const o = new THREE.Object3D(); let n = 0;
    for (const h of spots.houses) {
      const s = h.s ?? 1; const ry = h.ry ?? 0;
      for (const dx of [-0.09, 0.09]) { o.position.set(h.x, h.y, h.z); o.rotation.set(0, ry, 0); o.scale.setScalar(s); o.updateMatrix(); o.position.add(new THREE.Vector3(dx * s, 0, 0.205 * s).applyEuler(o.rotation)); o.updateMatrix(); im.setMatrixAt(n++, o.matrix); }
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; g.add(im);
  }

  // 篝火
  let fireLight: THREE.PointLight | null = null; let flame: THREE.Group | null = null;
  if (spots.fire) {
    const [x, y, z] = spots.fire; const f = new THREE.Group(); f.position.set(x, y, z);
    const logGeo = G(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 7)), logMat = M(new THREE.MeshStandardMaterial({ color: col([70, 48, 38]), roughness: 0.9 }));
    for (const a of [0.5, -0.6]) { const l = new THREE.Mesh(logGeo, logMat); l.rotation.z = Math.PI / 2; l.rotation.y = a; l.position.y = 0.06; l.castShadow = true; f.add(l); }
    const stoneGeo = G(new THREE.DodecahedronGeometry(0.09, 0)), stoneMat = M(new THREE.MeshStandardMaterial({ color: col([92, 90, 100]), roughness: 0.95 }));
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(stoneGeo, stoneMat); const a = (i / 7) * Math.PI * 2; s.position.set(Math.cos(a) * 0.5, 0.04, Math.sin(a) * 0.5); s.rotation.set(r.next(), r.next(), 0); f.add(s); }
    flame = new THREE.Group(); flame.position.y = 0.1;
    const outer = new THREE.Mesh(G(new THREE.ConeGeometry(0.22, 0.62, 8)), M(new THREE.MeshBasicMaterial({ color: col([255, 140, 50]), transparent: true, opacity: 0.85, fog: false }))); outer.position.y = 0.31;
    const inner = new THREE.Mesh(G(new THREE.ConeGeometry(0.12, 0.4, 8)), M(new THREE.MeshBasicMaterial({ color: col([255, 232, 150]), fog: false }))); inner.position.set(0.02, 0.2, 0.03);
    flame.add(outer, inner); f.add(flame);
    const h = halo(FIRE, 2.6, 0.75); h.position.y = 0.45; f.add(h); mats.push(h.material); flicker.push({ s: h, base: 0.75, k: 0.12, w: 7 });
    fireLight = new THREE.PointLight(col(FIRE), 6, 9, 2); fireLight.position.y = 0.6; fireLight.castShadow = false; f.add(fireLight);
    g.add(f);
  }

  return {
    group: g,
    update: (t) => {
      if (ff) ff.mat.uniforms.uTime.value = t;
      for (const fl of flicker) (fl.s.material as THREE.SpriteMaterial).opacity = fl.base + Math.sin(t * fl.w) * fl.k + Math.sin(t * fl.w * 2.7 + 1) * fl.k * 0.5;
      if (fireLight) fireLight.intensity = 5.5 + Math.sin(t * 9) * 0.7 + Math.sin(t * 23) * 0.4;
      if (flame) { flame.scale.set(1 + Math.sin(t * 11) * 0.06, 1 + Math.sin(t * 13 + 1) * 0.12, 1 + Math.cos(t * 9) * 0.06); flame.rotation.y = t * 0.8; }
    },
    dispose: () => { mats.forEach((m) => m.dispose()); geos.forEach((x) => x.dispose()); },
  };
}
