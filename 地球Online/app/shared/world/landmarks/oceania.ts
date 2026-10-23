/** 名胜模型：大洋洲。积木见 ../landmark-kit.ts，共用的摆放、合并、贴图件在 ./africa.ts；每个模型返回 { group, top, footprint, update? }。
 *  约定：原点在地面中心，+y 向上，正面朝 +z；抓住外形特征并夸张 1.2～1.4 倍，细节从简；每个模型不超过 5 种颜色、不超过 100 个网格。
 *  悉尼歌剧院的「帆」用二次三角贝塞尔曲面：尖、前脚、后脚三个角，三条边各一个控制点，左右对称两半，前口挂一面深色玻璃。 */
import * as THREE from "three";
import { mulberry32 } from "../../algo/prng.ts";
import { type Maker, type RGB, mat, add, cyl, water } from "../landmark-kit.ts";
import { MORE_OCEANIA } from "./oceania-more.ts";
import { type G, type P2, PI, V3, at, place, cube, rbox, bead, dome, lathe, beam, capsule, bake, flat, slab, ground, done, texMat, flowMat } from "./africa.ts";

/** 歌剧院的一片帆（开口朝 +z）：h 尖高、w 半宽、zt 尖、zf 前脚、zr 后脚的 z。返回壳面（含前沿的圆棱）与前口玻璃 */
function sail(h: number, w: number, zt: number, zf: number, zr: number, n = 10): { shell: G[]; glass: G } {
  const T = V3(0, h, zt), F = V3(w, 0, zf), R = V3(0, 0, zr);
  const mTR = V3(0, h * 1.0, zr + (zt - zr) * 0.68), mTF = V3(w * 1.08, h * 0.52, (zt + zf) / 2 + 0.06), mFR = V3(w * 1.12, 0, zf + (zr - zf) * 0.42);
  // 边上为二次贝塞尔；面中间再往外鼓一点（u·v·s 在三条边上为 0），壳才有圆鼓鼓的样子
  const P = (u: number, v: number, s: number) => new THREE.Vector3()
    .addScaledVector(T, u * u).addScaledVector(F, v * v).addScaledVector(R, s * s)
    .addScaledVector(mTF, 2 * u * v).addScaledVector(mFR, 2 * v * s).addScaledVector(mTR, 2 * u * s)
    .add(V3(w * 9 * u * v * s, h * 3 * u * v * s, 0));
  const half = (mirror: boolean): G => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [], id = (i: number, j: number) => (i * (i + 1)) / 2 + j;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= i; j++) { const u = 1 - i / n, v = j / n, s = (i - j) / n, p = P(u, v, s); pos.push(mirror ? -p.x : p.x, p.y, p.z); uv.push((v + s) * 2.2, (u + v) * 2.2); }
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1);
      if (mirror) idx.push(a, b, c); else idx.push(a, c, b);
      if (j < i) { const d = id(i, j + 1); if (mirror) idx.push(a, c, d); else idx.push(a, d, c); }
    }
    const q = new THREE.BufferGeometry(); q.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); q.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); q.setIndex(idx); q.computeVertexNormals(); return q;
  };
  // 前沿：从左脚经尖到右脚的一根圆棱
  const E = (s: number) => P(1 - s, s, 0), m = 14, rim: THREE.Vector3[] = [];
  for (let k = m; k >= 0; k--) { const p = E(k / m); rim.push(V3(-p.x, p.y, p.z)); }
  for (let k = 1; k <= m; k++) rim.push(E(k / m));
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim), 40, 0.028, 6, false);
  // 玻璃：左右前沿之间一条条横带，往里缩一点
  const gp: number[] = [], gu: number[] = [], gi: number[] = [];
  for (let k = 0; k <= m; k++) { const p = E(k / m), x = p.x * 0.96, z = p.z - 0.05; gp.push(-x, p.y, z, x, p.y, z); gu.push(0, k / m, 1, k / m); }
  for (let k = 0; k < m; k++) { const a = k * 2; gi.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const glass = new THREE.BufferGeometry(); glass.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3)); glass.setAttribute("uv", new THREE.Float32BufferAttribute(gu, 2)); glass.setIndex(gi); glass.computeVertexNormals();
  return { shell: [half(false), half(true), tube], glass };
}

/** 平面上的心形（大堡礁的心形礁），尖朝 +z，宽约 s */
function heart(s: number): THREE.Shape {
  const h = new THREE.Shape(), k = s / 22, X = (x: number) => (x - 5) * k, Y = (y: number) => (y - 9.5) * k;
  h.moveTo(X(5), Y(5)); h.bezierCurveTo(X(5), Y(5), X(4), Y(0), X(0), Y(0)); h.bezierCurveTo(X(-6), Y(0), X(-6), Y(7), X(-6), Y(7));
  h.bezierCurveTo(X(-6), Y(11), X(-3), Y(15.4), X(5), Y(19)); h.bezierCurveTo(X(12), Y(15.4), X(16), Y(11), X(16), Y(7));
  h.bezierCurveTo(X(16), Y(7), X(16), Y(0), X(10), Y(0)); h.bezierCurveTo(X(7), Y(0), X(5), Y(5), X(5), Y(5)); return h;
}

export const MODELS_OCEANIA: Record<string, Maker> = {
  ...MORE_OCEANIA,   // 补充的一批（D87，oceania-more.ts）
  /** 悉尼歌剧院：海港里的花岗岩基座上两排白色贝壳顶（音乐厅一排、歌剧厅一排），一片比一片高地叠着，开口朝海、挂着深色玻璃；最后面各有一片朝后的小帆 */
  oc_sydney_opera: () => {
    const g = new THREE.Group(), white: RGB = [248, 247, 242], cream: RGB = [232, 228, 216], podium: RGB = [222, 194, 168], glass: RGB = [150, 128, 116], sea: RGB = [110, 180, 214];
    water(g, 2.5, 0, 0, 0.02, sea, 1, 1);
    // 整座楼转过去：贝壳的开口朝左前方（海港），从正面看到的是一排白色的帆背——最常见的那个角度
    const b = new THREE.Group(); b.rotation.y = -PI / 2 + 0.25; g.add(b);
    const pm = mat(podium, 0.85), py = 0.32;
    add(b, rbox(2.5, py, 3.3, 0.05, 2), pm, 0, py / 2, -0.1);
    const St: G[] = []; for (let i = 0; i < 3; i++) St.push(at(rbox(1.5 - i * 0.05, py - i * 0.12, 0.14, 0.02), -0.1, (py - i * 0.12) / 2, -1.82 - i * 0.12));
    bake(b, St, pm);
    const S: G[] = [], Gl: G[] = [];
    const put = (x: number, z: number, h: number, w: number, dep: number, ry = 0) => {
      const { shell, glass } = sail(h, w, 0.12 + h * 0.1, 0, -dep);
      for (const q of shell) S.push(at(q, x, py, z, ry)); Gl.push(at(glass, x, py, z, ry));
    };
    for (const [x, dz, k] of [[-0.6, 0, 1], [0.62, -0.25, 0.9]] as [number, number, number][]) {
      put(x, -0.55 + dz, 2.2 * k, 0.56 * k, 1.35 * k);
      put(x, 0.2 + dz, 1.68 * k, 0.53 * k, 1.1 * k);
      put(x, 0.86 + dz, 1.15 * k, 0.48 * k, 0.82 * k);
      put(x, -1.42 + dz * 0.5, 1.08 * k, 0.48 * k, 0.72 * k, PI);
    }
    bake(b, S, texMat("diamond", white, cream, 3.5, 3.5, 0.45, { side: THREE.DoubleSide }));
    bake(b, Gl, mat(glass, 0.3, { side: THREE.DoubleSide, metalness: 0.15 }));
    return done(g, 2.2);
  },

  /** 悉尼海港大桥（「衣架」）：一道钢桁架拱，上下两条弦之间密密的斜杆，桥面从拱中间穿过、吊在拱下；两头各一对花岗岩桥塔；拱顶两面旗在飘 */
  oc_harbour_bridge: () => {
    const g = new THREE.Group(), steel: RGB = [150, 158, 172], granite: RGB = [226, 212, 186], sea: RGB = [110, 180, 214], blue: RGB = [62, 88, 160];
    const sm = mat(steel, 0.5, { metalness: 0.2 }), gm = mat(granite, 0.85);
    water(g, 2.5, 0, 0, 0.02, sea, 1, 0.62);
    const L = 1.8, yd = 0.84, zA = 0.4, N = 16;
    const yb = (x: number) => 0.1 + 1.95 * (1 - (x / L) ** 2), yt = (x: number) => 2.34 - 1.08 * (x / L) ** 2;
    const X = (i: number) => -L + (2 * L * i) / N;
    const S: G[] = [];
    for (const z of [-zA, zA]) {
      for (let i = 0; i < N; i++) {
        const a = X(i), b = X(i + 1);
        S.push(beam(V3(a, yb(a), z), V3(b, yb(b), z), 0.07, 0.09), beam(V3(a, yt(a), z), V3(b, yt(b), z), 0.07, 0.08));
        S.push(i % 2 ? beam(V3(a, yb(a), z), V3(b, yt(b), z), 0.035) : beam(V3(a, yt(a), z), V3(b, yb(b), z), 0.035));
      }
      for (let i = 0; i <= N; i++) { const x = X(i); S.push(beam(V3(x, yb(x), z), V3(x, yt(x), z), 0.04)); if (yb(x) > yd + 0.08) S.push(beam(V3(x, yb(x), z), V3(x, yd, z), 0.022)); }
    }
    for (let i = 0; i <= N; i++) { const x = X(i); S.push(beam(V3(x, yt(x), -zA), V3(x, yt(x), zA), 0.035)); if (i < N) { const b = X(i + 1); S.push(beam(V3(x, yt(x), -zA), V3(b, yt(b), zA), 0.02), beam(V3(x, yt(x), zA), V3(b, yt(b), -zA), 0.02)); } }
    S.push(at(rbox(5.0, 0.1, 0.8, 0.03), 0, yd, 0));
    for (const sx of [-1, 1]) { S.push(at(cube(0.5, 0.06, 0.8), sx * 2.0, yd - 0.08, 0)); for (const sz of [-1, 1]) S.push(at(cube(0.06, 0.34, 0.01), sx * 2.02 + 0.0, 1.45, sz * 0.67)); }
    bake(g, S, sm);
    // 桥塔：两头各一对，下面一个大墩托着桥面
    const P: G[] = [];
    for (const sx of [-1, 1]) {
      P.push(at(rbox(0.56, yd - 0.04, 1.36, 0.04), sx * 2.02, (yd - 0.04) / 2, 0), at(rbox(0.18, yd, 0.5, 0.03), sx * 2.42, yd / 2, 0));
      for (const sz of [-1, 1]) P.push(at(rbox(0.42, 1.0, 0.4, 0.04), sx * 2.02, yd + 0.5 - 0.04, sz * 0.47), at(rbox(0.36, 0.3, 0.34, 0.03), sx * 2.02, yd + 1.06, sz * 0.47), at(rbox(0.28, 0.12, 0.26, 0.03), sx * 2.02, yd + 1.27, sz * 0.47));
    }
    bake(g, P, gm);
    // 拱顶两面旗
    const flags: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const x = sx * 0.14; add(g, cyl(0.012, 0.012, 0.42, 6), sm, x, yt(x) + 0.21, 0);
      const f = new THREE.Group(); f.position.set(x, yt(x) + 0.34, 0); g.add(f); flags.push(f);
      add(f, rbox(0.26, 0.15, 0.012, 0.005), mat(blue, 0.6), 0.13, 0, 0);
    }
    return done(g, 2.5, (t) => flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2 + i) * 0.3; }));
  },

  /** 乌鲁鲁：红色沙漠上一整块长面包形的赭红巨石，四壁陡、顶上圆缓起伏，表面一道道竖沟；周围几丛三齿稃草和沙漠橡树 */
  oc_uluru: () => {
    const g = new THREE.Group(), rock: RGB = [206, 106, 72], rockD: RGB = [174, 80, 56], sand: RGB = [230, 164, 116], olive: RGB = [150, 160, 104];
    ground(g, sand);
    const A = 2.3, B = 1.02, H = 1.3;
    const q = new THREE.SphereGeometry(1, 56, 14, 0, PI * 2, 0, PI / 2), p = q.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = Math.max(0, p.getY(i)), z = p.getZ(i), a = Math.atan2(z, x);
      const px = Math.sign(x) * Math.abs(x) ** 0.7, pz = Math.sign(z) * Math.abs(z) ** 0.7, fl = 1 - 0.03 * (0.5 + 0.5 * Math.cos(a * 24)) * (1 - y);
      const hump = 1 + 0.06 * Math.sin(px * 2.6 + 0.9) - 0.16 * Math.max(0, Math.abs(px) - 0.55) - 0.1 * Math.max(0, px - 0.2);
      p.setXYZ(i, A * px * fl, H * y ** 0.4 * hump, B * pz * fl);
    }
    q.computeVertexNormals();
    add(g, q, texMat("vlow", rock, rockD, 30, 1, 0.92), 0, 0.05, -0.1, -0.12);
    const r = mulberry32(9), Sp: G[] = [], Tr: G[] = [];
    for (let i = 0; i < 22; i++) { const a = r.next() * PI * 2, e = 1.2 + r.next() * 0.25, x = Math.cos(a) * 2.25 * Math.min(1.04, e * 0.85), z = Math.sin(a) * 1.2 * e; if (Math.abs(x) > 2.35 || Math.abs(z) > 2.3) continue; Sp.push(at(dome(0.09 + r.next() * 0.06, 10, 4), x, 0.06, z, 0, 0, 0, [1, 0.8, 1])); }
    for (const [x, z, h] of [[-1.7, 1.55, 0.75], [1.35, 1.75, 0.6], [2.05, -1.25, 0.65]] as [number, number, number][]) { Tr.push(beam(V3(x, 0.05, z), V3(x, h * 0.6, z), 0.04, 0, true)); Sp.push(capsule(V3(x, h * 0.55, z), V3(x, h, z), 0.12)); }
    bake(g, Sp, mat(olive, 0.95)); bake(g, Tr, mat(rockD, 0.9));
    return done(g, 2.4);
  },

  /** 大堡礁：深蓝的海上几片碧绿浅滩，正中一颗心形礁；鹿角珊瑚、海扇、脑珊瑚、桌珊瑚、管海绵冒出来；一条小丑鱼绕着游 */
  oc_great_barrier_reef: () => {
    const g = new THREE.Group(), deep: RGB = [66, 136, 196], shallow: RGB = [118, 206, 214], sand: RGB = [242, 226, 190], pink: RGB = [238, 138, 152], orange: RGB = [242, 150, 92];
    const pm = mat(pink, 0.7), om = mat(orange, 0.7), sm = mat(sand, 0.9);
    water(g, 2.45, 0, 0, 0.02, deep);
    bake(g, [at(cyl(1, 1, 0.06, 32), 0, 0.05, 0.05, 0, 0, 0, [1.75, 1, 1.35]), at(cyl(1, 1, 0.06, 24), -1.6, 0.05, -1.45, 0.4, 0, 0, [0.6, 1, 0.4]), at(cyl(1, 1, 0.06, 24), 1.75, 0.05, -1.35, -0.3, 0, 0, [0.5, 1, 0.6])], mat(shallow, 0.15, { metalness: 0.05 }));
    add(g, slab(heart(1.55), 0.06, 0.03).rotateX(PI / 2), sm, 0.0, 0.1, 0.72);
    const Pk: G[] = [], Or: G[] = [], Sd: G[] = [];
    // 心形礁上的小珊瑚
    const r = mulberry32(3);
    for (let i = 0; i < 11; i++) { const a = r.next() * PI * 2, d = 0.15 + r.next() * 0.35; (i % 2 ? Pk : Or).push(at(bead(0.05 + r.next() * 0.04, 8, 6), Math.cos(a) * d * 1.2, 0.13, 0.62 + Math.sin(a) * d * 0.7)); }
    // 鹿角珊瑚（粉）
    const base = V3(-1.0, 0.06, -0.75);
    for (let k = 0; k < 10; k++) {
      const a = k * 2.4, tilt = 0.2 + (k % 3) * 0.17, len = 0.6 + ((k * 7) % 5) * 0.17;
      const tip = V3(base.x + Math.cos(a) * Math.sin(tilt) * len, base.y + Math.cos(tilt) * len, base.z + Math.sin(a) * Math.sin(tilt) * len * 0.8);
      Pk.push(capsule(base, tip, 0.055, 6));
      if (k % 2 === 0) { const mid = base.clone().lerp(tip, 0.55); Pk.push(capsule(mid, V3(mid.x + Math.cos(a + 1) * 0.22, mid.y + 0.25, mid.z + Math.sin(a + 1) * 0.18), 0.04, 6)); }
    }
    // 海扇（粉，网格）
    add(g, new THREE.CircleGeometry(0.72, 24, 0, PI), texMat("grid", pink, sand, 11, 7, 0.8, { side: THREE.DoubleSide }), 0.25, 0.05, -1.35, 0.15);
    Pk.push(beam(V3(0.25, 0.0, -1.35), V3(0.25, 0.2, -1.35), 0.05, 0, true));
    // 脑珊瑚（橙，回纹）
    add(g, dome(0.42, 20, 8), texMat("zigzag", orange, sand, 5, 3, 0.85), 1.2, 0.06, -0.55).scale.y = 0.8;
    // 桌珊瑚（橙）
    Or.push(at(cyl(0.05, 0.08, 0.5, 8), -1.6, 0.3, 0.3), at(cyl(0.44, 0.34, 0.06, 20), -1.6, 0.56, 0.3), at(cyl(0.3, 0.24, 0.05, 18), -1.55, 0.72, 0.25));
    // 管海绵（橙）
    for (const [x, z, h] of [[1.8, 0.35, 0.85], [2.0, 0.6, 0.6], [1.62, 0.62, 0.5], [2.02, 0.15, 0.45]] as [number, number, number][]) Or.push(at(new THREE.CylinderGeometry(0.1, 0.085, h, 12, 1, true), x, 0.06 + h / 2, z));
    // 海葵（粉）
    for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2; Pk.push(capsule(V3(-1.15, 0.08, 1.3), V3(-1.15 + Math.cos(a) * 0.2, 0.3, 1.3 + Math.sin(a) * 0.2), 0.035, 5)); }
    Sd.push(at(dome(0.18, 12, 4), -1.15, 0.06, 1.3, 0, 0, 0, [1, 0.5, 1]));
    bake(g, Pk, pm); bake(g, Or, om); bake(g, Sd, sm);
    // 小丑鱼：橙身两道白纹，绕着珊瑚游
    const fish = new THREE.Group(); g.add(fish);
    const body = new THREE.Group(); body.position.set(1.05, 0.42, 0); fish.add(body);
    bake(body, [at(bead(0.12, 12, 8), 0, 0, 0, 0, 0, 0, [1.5, 1, 0.6]), at(new THREE.ConeGeometry(0.09, 0.14, 8), 0, 0, -0.22, 0, PI / 2, 0, [1, 1, 0.4]), at(new THREE.ConeGeometry(0.05, 0.08, 6), 0, 0.13, 0.0, 0, 0, 0, [1, 1, 0.3])], om);
    bake(body, [at(cyl(0.118, 0.118, 0.035, 14), 0, 0, 0.06, 0, PI / 2, 0, [1, 1, 1]).scale(0.6, 1, 1), at(cyl(0.1, 0.1, 0.03, 14), 0, 0, -0.1, 0, PI / 2, 0).scale(0.6, 1, 1)], sm);
    body.rotation.y = PI / 2;
    return done(g, 2.4, (t) => { fish.rotation.y = -t * 0.5; body.position.y = 0.42 + Math.sin(t * 2.2) * 0.04; });
  },

  /** 米尔福德峡湾：峡湾水面右边拔起尖尖的主教冠峰（下半截长满雨林），左边一排陡崖，崖上一道瀑布直落进水里；尽头一座带雪的山；一条白色游船 */
  oc_milford_sound: () => {
    const g = new THREE.Group(), rock: RGB = [126, 132, 146], forest: RGB = [100, 146, 112], fj: RGB = [96, 156, 198], white: RGB = [250, 251, 252], red: RGB = [214, 96, 70];
    const rm = mat(rock, 0.9), fm = mat(forest, 0.95), wm = mat(white, 0.8);
    water(g, 2.45, 0, 0, 0.02, fj, 0.8, 1);
    const R: G[] = [], F: G[] = [], W: G[] = [];
    /** 一座尖峰：五棱锥（尖往 lean 方向偏一点），下半截套一圈雨林 */
    const peakAt = (x: number, z: number, r: number, h: number, forestH: number, lean = 0, ry = 0) => {
      const c = new THREE.ConeGeometry(r, h, 5, 4), pp = c.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) { const k = (pp.getY(i) + h / 2) / h; pp.setX(i, pp.getX(i) + lean * k * k); }
      R.push(at(flat(c), x, h / 2, z, ry));
      const rt = r * (1 - forestH / h) * 1.08 + 0.02;
      F.push(at(flat(new THREE.CylinderGeometry(rt, r * 1.06, forestH, 5, 1)), x + lean * (forestH / h) ** 2 * 0.3, forestH / 2, z, ry));
    };
    /** 圆钝的陡山（狮子山一带）：车削出来的钝头，下半截雨林 */
    const domeAt = (x: number, z: number, r: number, h: number, forestH: number, ry = 0) => {
      const prof = (k: number): P2[] => [[r * k, 0], [r * 0.97 * k, h * 0.3], [r * 0.84 * k, h * 0.58], [r * 0.6 * k, h * 0.82], [r * 0.3 * k, h * 0.96], [0, h]];
      const P0 = prof(1), rAt = (y: number) => { for (let i = 1; i < P0.length; i++) if (y <= P0[i][1]) { const [r0, y0] = P0[i - 1], [r1, y1] = P0[i]; return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0); } return 0; };
      R.push(at(flat(lathe(P0, 7)), x, 0, z, ry));
      F.push(at(flat(lathe([...prof(1.05).filter(([, y]) => y < forestH), [rAt(forestH) * 1.05 + 0.02, forestH], [0, forestH]], 7)), x, 0, z, ry));
    };
    peakAt(0.95, -0.35, 0.95, 4.1, 1.25, -0.2, 0.2);
    domeAt(1.6, -1.15, 0.66, 1.9, 1.2, 0.6);
    domeAt(-1.45, -1.15, 0.95, 2.5, 1.5);
    domeAt(-1.55, 0.25, 0.85, 2.0, 1.25, 0.8);
    domeAt(-1.4, 1.35, 0.68, 1.3, 0.9, 0.3);
    peakAt(-0.2, -1.8, 0.72, 2.7, 0.6, 0, 0.1);
    W.push(at(flat(new THREE.ConeGeometry(0.31, 1.16, 5, 1)), -0.2, 2.7 - 0.58 + 0.01, -1.8, 0.1).scale(1.04, 1, 1.04));
    bake(g, R, rm); bake(g, F, fm);
    // 瀑布：从左崖半腰直落进水里
    const { m: flm, tex } = flowMat(white, fj, 1, 1.4);
    const fall = add(g, new THREE.PlaneGeometry(0.34, 1.62), flm, -0.8, 0.84, 0.5, PI / 2 - 0.45); fall.castShadow = false;
    for (let i = 0; i < 4; i++) W.push(at(bead(0.11 + i * 0.03, 10, 6), -0.76 + i * 0.07, 0.13, 0.55 + i * 0.06, 0, 0, 0, [1.3, 0.7, 1]));
    // 游船（开往峡湾里）
    const boat = new THREE.Group(); boat.position.set(0.15, 0.03, 1.25); boat.rotation.y = 0.25; g.add(boat);
    bake(boat, [at(rbox(0.26, 0.13, 0.72, 0.05), 0, 0.09, 0), at(rbox(0.2, 0.12, 0.4, 0.03), 0, 0.21, 0.06), at(rbox(0.15, 0.08, 0.22, 0.03), 0, 0.31, 0.08), at(rbox(0.2, 0.012, 0.5, 0.005), 0, 0.03, 0.5)], wm);
    bake(boat, [at(rbox(0.27, 0.035, 0.73, 0.012), 0, 0.05, 0), at(cyl(0.035, 0.04, 0.1, 8), 0, 0.38, 0.12)], mat(red, 0.6));
    bake(g, W, wm);
    return done(g, 2.4, (t) => { tex.offset.y = t * 1.3; boat.position.y = 0.03 + Math.sin(t * 1.4) * 0.015; boat.rotation.z = Math.sin(t * 1.1) * 0.03; });
  },

  /** 霍比特人村（玛塔玛塔的电影布景）：绿草坡上一个个挖进山里的圆门洞（黄门、红门），带圆窗、木栅栏和烟囱；坡顶是比尔博的袋底洞（绿门、正中一颗黄铜把手），上面一棵大派对树 */
  oc_hobbiton: () => {
    const g = new THREE.Group(), grass: RGB = [148, 186, 112], dark: RGB = [92, 136, 84], wood: RGB = [150, 110, 80], yellow: RGB = [240, 190, 70], red: RGB = [204, 92, 72];
    const gm = mat(grass, 0.95);
    ground(g, grass);
    // 草坡：后面一座大的、左前一座小的
    add(g, dome(1, 32, 12), gm, 0.1, 0.04, -0.75).scale.set(2.2, 1.25, 1.45);
    add(g, dome(1, 24, 10), gm, -1.45, 0.04, 0.85).scale.set(0.95, 0.6, 0.8);
    const Gw: G[] = [], Dk: G[] = [], Wd: G[] = [], Ye: G[] = [], Rd: G[] = [];
    /** 一个洞府：门脸（平的一块草墙）、圆门、门框、圆窗、门前的小路与栅栏 */
    const hole = (x: number, y: number, z: number, ry: number, door: G[], s = 1, fence = true) => {
      const L: { wall: G[]; door: G[]; wood: G[]; win: G[] } = { wall: [], door: [], wood: [], win: [] };
      L.wall.push(at(rbox(0.62, 0.46, 0.3, 0.08), 0, 0.23, -0.1));
      L.door.push(at(cyl(0.17, 0.17, 0.04, 20), 0, 0.2, 0.06, 0, PI / 2));
      L.wood.push(at(new THREE.TorusGeometry(0.18, 0.03, 6, 20), 0, 0.2, 0.07), at(rbox(0.22, 0.025, 0.3, 0.01), 0, 0.012, 0.28));
      L.wood.push(at(new THREE.TorusGeometry(0.055, 0.015, 6, 14), 0.25, 0.27, 0.07)); L.win.push(at(cyl(0.05, 0.05, 0.02, 14), 0.25, 0.27, 0.06, 0, PI / 2));
      L.wood.push(at(cyl(0.035, 0.04, 0.22, 8), 0.18, 0.55, -0.32));
      if (fence) { for (let i = 0; i < 5; i++) L.wood.push(at(cube(0.03, 0.16, 0.03), 0.3 + i * 0.07, 0.08, 0.42)); L.wood.push(at(cube(0.32, 0.025, 0.025), 0.44, 0.12, 0.42)); }
      const xf = (l: G[]) => place(l, x, y, z, ry, s);
      Gw.push(...xf(L.wall)); door.push(...xf(L.door)); Wd.push(...xf(L.wood)); Ye.push(...xf(L.win));
    };
    // 坡上一圈（门脸朝外），黄门红门相间；坡顶是袋底洞（绿门）
    const onHill = (f: number, k: number) => { const rx = 2.2, rz = 1.45, ry0 = 1.25, c = Math.cos(k), x = 0.1 + Math.sin(f) * rx * c, z = -0.75 + Math.cos(f) * rz * c, y = 0.04 + Math.sin(k) * ry0 - 0.06; return [x, y, z, Math.atan2(Math.sin(f) * rz, Math.cos(f) * rx)] as [number, number, number, number]; };
    for (const [f, k, d] of [[-0.95, 0.42, Ye], [-0.25, 0.3, Rd], [0.5, 0.36, Ye], [0.98, 0.4, Rd], [0.15, 0.82, Dk]] as [number, number, G[]][]) { const [x, y, z, ry] = onHill(f, k); hole(x, y, z, ry, d, d === Dk ? 1.15 : 1, d !== Dk); }
    hole(-1.45, 0.04, 1.55, 0.1, Ye, 0.9);
    { const [x, y, z, ry] = onHill(0.15, 0.82); Ye.push(at(bead(0.035, 8, 6), x + Math.sin(ry) * 0.12, y + 0.23, z + Math.cos(ry) * 0.12)); }
    // 派对树：坡顶右后方一棵大树
    const tx = 0.75, tz = -1.15, ty = 1.05;
    Wd.push(at(cyl(0.11, 0.16, 0.8, 10), tx, ty + 0.4, tz), beam(V3(tx, ty + 0.6, tz), V3(tx - 0.3, ty + 0.95, tz + 0.05), 0.07, 0, true), beam(V3(tx, ty + 0.6, tz), V3(tx + 0.28, ty + 1.0, tz - 0.05), 0.07, 0, true));
    for (const [dx, dy, dz, r] of [[0, 1.25, 0, 0.5], [-0.4, 1.05, 0.1, 0.38], [0.42, 1.08, -0.05, 0.4], [0.05, 1.0, 0.35, 0.34], [-0.1, 1.5, -0.1, 0.32]] as [number, number, number, number][]) Dk.push(at(bead(r, 14, 10), tx + dx, ty + dy, tz + dz));
    // 树篱与小菜园
    for (let i = 0; i < 6; i++) Dk.push(at(bead(0.12, 10, 7), 1.35 + (i % 3) * 0.25, 0.1, 0.9 + Math.floor(i / 3) * 0.3, 0, 0, 0, [1.2, 0.7, 1]));
    for (let i = 0; i < 7; i++) Dk.push(at(bead(0.14, 10, 7), -2.1 + i * 0.12, 0.12, -0.2 + i * 0.16));
    // 红色小邮筒
    Rd.push(at(rbox(0.1, 0.1, 0.12, 0.03), 0.95, 0.42, 1.0)); Wd.push(at(cube(0.03, 0.36, 0.03), 0.95, 0.19, 1.0));
    bake(g, Gw, gm); bake(g, Dk, mat(dark, 0.9)); bake(g, Wd, mat(wood, 0.85)); bake(g, Ye, mat(yellow, 0.5)); bake(g, Rd, mat(red, 0.6));
    return done(g, 2.4);
  },

  /** 十二使徒岩：后面一道金黄的石灰岩海崖（顶上是草），海里一根根层层风化的石柱，脚下一圈白浪 */
  oc_twelve_apostles: () => {
    const g = new THREE.Group(), lime: RGB = [236, 194, 132], limeD: RGB = [206, 154, 100], grass: RGB = [140, 176, 130], sea: RGB = [84, 164, 200], foam: RGB = [250, 251, 252];
    const strata = texMat("hband", lime, limeD, 1, 6, 0.92), gm = mat(grass, 0.95), wm = mat(foam, 0.9);
    water(g, 2.45, 0, 0.2, 0.02, sea, 1, 0.92);
    const Cl: G[] = [], Gr: G[] = [], Fo: G[] = [];
    const r = mulberry32(12);
    for (let i = 0; i < 6; i++) {
      const x = -2.0 + i * 0.8, z = -1.75 + Math.abs(x) * 0.12, h = 1.15 + r.next() * 0.3, ry = -x * 0.08;
      Cl.push(at(rbox(0.9, h, 0.95, 0.08, 2), x, h / 2, z, ry)); Gr.push(at(rbox(0.92, 0.09, 0.97, 0.04), x, h + 0.03, z, ry));
    }
    Cl.push(at(rbox(4.6, 0.05, 0.42, 0.02), 0, 0.03, -1.12));
    Fo.push(at(rbox(4.5, 0.03, 0.08, 0.015), 0, 0.045, -0.88));
    bake(g, Cl, strata); bake(g, Gr, gm);
    // 石柱
    const stacks: [number, number, number, number][] = [[-1.85, -0.25, 1.55, 0.3], [-1.05, 0.3, 2.05, 0.34], [-0.3, -0.45, 1.45, 0.27], [0.4, 0.55, 1.85, 0.32], [1.15, -0.15, 1.65, 0.3], [1.85, 0.75, 1.25, 0.27], [-0.45, 1.4, 1.0, 0.24]];
    const S: G[] = [];
    for (const [x, z, h, rr] of stacks) {
      const j = () => 0.88 + r.next() * 0.24;
      const prof: P2[] = [[rr * 1.15, 0], [rr * 1.05 * j(), h * 0.1], [rr * 0.78, h * 0.2], [rr * 0.95 * j(), h * 0.36], [rr * 0.9 * j(), h * 0.55], [rr * 0.96 * j(), h * 0.72], [rr * 0.8 * j(), h * 0.88], [rr * 0.55, h * 0.98], [0, h]];
      S.push(at(flat(lathe(prof, 7)), x, 0.02, z, r.next() * 3));
      Fo.push(at(new THREE.TorusGeometry(rr * 1.18, 0.05, 6, 16), x, 0.05, z, 0, PI / 2, 0, [1, 1, 0.5]));
      if (h > 1.5) Gr.push(at(dome(rr * 0.5, 10, 4), x, h - 0.04, z, 0, 0, 0, [1, 0.45, 1]));
    }
    bake(g, S, texMat("hband", lime, limeD, 1, 7, 0.92)); bake(g, Fo, wm);
    return done(g, 2.4);
  },
};

