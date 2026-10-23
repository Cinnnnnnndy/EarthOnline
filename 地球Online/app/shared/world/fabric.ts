/** 布料与材质的「细节层」：在着色器里按部件本地坐标程序化生成凹凸与明暗，不用贴图、不用 UV，放多大都不糊。
 *  参照《双人成行》《潜水员戴夫》：玩偶一样的触感 —— 毛线的 V 字针脚、羽绒服绗缝上的明线、牛仔斜纹与侧缝、发束、
 *  毛球与靴口的绒、草帽的编织。细节在屏幕上小于约 2 像素时自动淡出，远看不闪。
 *
 *  用法：patchFabric(material, { kind: "knit", ... })；同一种材质不同参数要各自一份材质（参数写成 define，编译进着色器）。 */
import * as THREE from "three";

export type FabricKind = "knit" | "rib" | "nylon" | "denim" | "leather" | "sole" | "hair" | "fur" | "canvas" | "straw" | "cotton" | "skin" | "lace";
export interface FabricOpts {
  kind: FabricKind;
  /** 凹凸幅度（部件本地单位，头半径 = 1） */
  amp?: number;
  /** 环向的针脚 / 肋条数，行数（每单位高度） */
  n?: number; rows?: number;
  /** 圆周方向绕哪根竖轴（本地 x, z） */
  axis?: [number, number];
  /** 羽绒服：绗缝的起点与间距、下摆罗纹的高度；牛仔：侧缝；发：发旋位置 */
  y0?: number; period?: number; hem?: number; zip?: boolean;
  crown?: [number, number, number];
  /** 明线（缝线）颜色的明暗倍数，>1 更亮 */
  thread?: number;
  /** 植绒 / 丝绒：0–1。细密绒毛的凹凸 + 轮廓处的一圈柔光（潮玩的「毛绒」质感） */
  fuzz?: number; fuzzScale?: number;
}

const COMMON = /* glsl */ `
varying vec3 vFabLoc; varying vec3 vFabN; varying float vFabScale;
float fabH = 0.0; float fabA = 1.0; float fabR = 0.0; float fabRim = 0.0;
float fHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fNoise(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i + vec3(0,0,0)), fHash(i + vec3(1,0,0)), f.x), mix(fHash(i + vec3(0,1,0)), fHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0,0,1)), fHash(i + vec3(1,0,1)), f.x), mix(fHash(i + vec3(0,1,1)), fHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fFbm(vec3 p) { return fNoise(p) * 0.55 + fNoise(p * 2.03) * 0.28 + fNoise(p * 4.1) * 0.17; }
/** 周期 < 约 2 像素就淡出（u 是以「周期」为单位的坐标） */
float fFade(float u) { return clamp(1.6 - fwidth(u) * 2.2, 0.0, 1.0); }
vec3 fPerturb(vec3 pos, vec3 n, float h) {
  vec3 sx = dFdx(pos), sy = dFdy(pos); vec3 r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1);
  vec2 dh = vec2(dFdx(h), dFdy(h)); vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * n - g);
}
`;

function body(o: FabricOpts): string {
  const f = (v: number) => v.toFixed(4);
  const ax = o.axis ?? [0, 0];
  const ang = `atan(p.x - ${f(ax[0])}, p.z - ${f(ax[1])})`;
  const th = f(o.thread ?? 1.12);
  switch (o.kind) {
    case "knit": return `{ // 毛线：竖向一列列 V 字针脚
      float a = ${ang}; float u = a / 6.2831853 * ${f(o.n ?? 26)}; float v = p.y * ${f(o.rows ?? 18)};
      float cu = fract(u); float leg = abs(cu - 0.5) * 2.0; float st = fract(v + leg * 0.55);
      float bump = sin(3.14159 * st) * (1.0 - pow(leg, 6.0) * 0.8); float fade = fFade(u) * fFade(v);
      fabH = bump * fade; fabA = mix(1.0, 0.78 + 0.22 * bump, fade) * (0.96 + 0.08 * fNoise(p * 9.0)); }`;
    case "rib": return `{ // 罗纹：细密竖条
      float a = ${ang}; float u = a / 6.2831853 * ${f(o.n ?? 60)}; float s = 0.5 + 0.5 * cos(6.2831853 * u); float fade = fFade(u);
      fabH = s * fade; fabA = mix(1.0, 0.82 + 0.18 * s, fade); }`;
    case "nylon": return `{ // 羽绒服：绗缝的沟 + 沟里的明线 + 尼龙细褶；拉链；下摆罗纹
      float per = ${f(o.period ?? 0.34)}; float yy = (p.y - ${f(o.y0 ?? 1.18)}) / per; float d = abs(fract(yy + 0.5) - 0.5) * per;
      float a = ${ang}; float ua = a * 26.0; float dash = step(0.45, fract(ua)); float fadeS = fFade(ua);
      float groove = smoothstep(0.035, 0.0, d); float stitch = smoothstep(0.012, 0.004, abs(d - 0.02)) * dash * fadeS;
      float crinkle = fFbm(p * vec3(26.0, 9.0, 26.0));
      fabH = -groove * 0.6 + stitch * 0.35 + crinkle * 0.12; fabA = 1.0 - groove * 0.14 + stitch * (${th} - 1.0) * 1.6; fabR = crinkle * 0.08 - groove * 0.05;
      ${o.zip ? `if (p.z > 0.2 && abs(p.x) < 0.06) { float t = fract(p.y * 38.0 + step(0.0, p.x) * 0.5); float teeth = step(abs(p.x), 0.03) * smoothstep(0.5, 0.2, abs(t - 0.5)); float tape = smoothstep(0.06, 0.045, abs(p.x));
        fabA = mix(fabA, 0.32, tape * 0.85); fabH = mix(fabH, teeth * 0.6, tape); fabR = mix(fabR, -0.3, tape); }` : ""}
      ${o.hem !== undefined ? `if (p.y < ${f(o.hem)}) { float u2 = a / 6.2831853 * 70.0; float s2 = 0.5 + 0.5 * cos(6.2831853 * u2); float fd = fFade(u2); fabH = s2 * fd * 0.8; fabA = 0.9 + 0.1 * s2 * fd; fabR = 0.2; }` : ""} }`;
    case "denim": return `{ // 牛仔：斜纹 + 侧缝明线 + 磨白
      float a = ${ang}; float u = (a * 0.26 + p.y) * 90.0; float s = 0.5 + 0.5 * sin(6.2831853 * u); float fade = fFade(u);
      float seam = smoothstep(0.1, 0.0, abs(abs(a) - 1.5708)); float dash = step(0.5, fract(p.y * 34.0)); float fs = fFade(p.y * 34.0);
      float wear = smoothstep(0.35, 0.95, fNoise(p * 4.0) * max(0.0, cos(a)));
      fabH = s * fade * 0.5 - seam * 0.5 + seam * dash * fs * 0.3; fabA = (0.92 + 0.08 * s * fade) * (1.0 + wear * 0.35) * (1.0 - seam * 0.12) + seam * dash * fs * (${th} - 1.0) * 1.4; fabR = s * 0.05; }`;
    case "leather": return `{ float n = fFbm(p * 22.0); fabH = n * 0.5; fabA = 0.92 + 0.12 * n; fabR = -0.1 + n * 0.1; }`;
    case "sole": return `{ // 鞋底：侧面一圈细横纹 + 沿口一圈明线
      float u = p.y * 60.0; float s = 0.5 + 0.5 * cos(6.2831853 * u); float fade = fFade(u); float a = ${ang}; float ua = a * 30.0;
      float stitch = smoothstep(0.012, 0.0, abs(p.y - ${f(o.y0 ?? -1.1)})) * step(0.4, fract(ua)) * fFade(ua);
      fabH = s * fade * 0.4 + stitch * 0.4; fabA = 0.95 + 0.05 * s + stitch * 0.5; }`;
    case "hair": { const c = o.crown ?? [0, 0.9, -0.25];
      return `{ // 发束：从发旋向四周放射的一缕缕，粗细两层 + 随机错位
      vec3 q = p - vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])}); float a = atan(q.x, q.z); float w = fNoise(p * 2.5) * 2.0;
      float u1 = a * ${f(o.n ?? 11)} + w; float u2 = a * ${f((o.n ?? 11) * 3.1)} + w * 1.7 + fNoise(p * 6.0) * 2.0;
      float c1 = pow(abs(sin(u1)), 0.6); float c2 = 0.5 + 0.5 * sin(u2); float f1 = fFade(u1 / 3.1416), f2 = fFade(u2 / 3.1416);
      fabH = c1 * f1 * 0.7 + c2 * f2 * 0.3; fabA = 0.82 + 0.14 * c1 * f1 + 0.1 * c2 * f2; fabR = -0.08 * c2 * f2; }`; }
    case "fur": return `{ float n = fFbm(p * 30.0) * 0.7 + fNoise(p * 70.0) * 0.3; float fade = fFade(p.x * 30.0); fabH = n * fade; fabA = 0.9 + 0.12 * n; fabR = 0.1; }`;
    case "canvas": return `{ float u = p.x * 110.0, v = p.y * 110.0; float s = sin(6.2831853 * u) * sin(6.2831853 * v); float fade = fFade(u) * fFade(v);
      fabH = s * fade * 0.4; fabA = 0.95 + 0.05 * s * fade + (fNoise(p * 6.0) - 0.5) * 0.06; }`;
    case "straw": return `{ // 草帽：绕帽顶的一圈圈编织（放射向 × 同心圆 棋盘交错）
      vec3 q = p - vec3(0.0, 0.0, -0.08); float r = length(q.xz); float a = atan(q.x, q.z);
      float u = a / 6.2831853 * 90.0, v = (r + q.y * 0.6) * 26.0; float cu = step(0.5, fract(u)), cv = step(0.5, fract(v));
      float weave = mix(0.5 + 0.5 * sin(6.2831853 * v), 0.5 + 0.5 * sin(6.2831853 * u), abs(cu - cv)); float fade = fFade(u) * fFade(v);
      fabH = weave * fade; fabA = 0.86 + 0.18 * weave * fade + (fNoise(p * 8.0) - 0.5) * 0.08; fabR = 0.1; }`;
    case "cotton": return `{ float u = p.x * 140.0 + p.z * 140.0, v = p.y * 140.0; float s = 0.5 + 0.5 * sin(6.2831853 * u) * sin(6.2831853 * v); float fade = fFade(u) * fFade(v);
      float hem = ${o.hem !== undefined ? `smoothstep(0.012, 0.0, abs(p.y - ${f(o.hem)})) * step(0.45, fract(${ang} * 30.0))` : "0.0"};
      fabH = s * fade * 0.3 + hem * 0.5; fabA = 0.96 + 0.05 * s * fade + hem * 0.15 + (fNoise(p * 5.0) - 0.5) * 0.05; }`;
    case "skin": return `{ float n = fNoise(p * 18.0); fabH = n * 0.15; fabA = 1.0; fabR = (n - 0.5) * 0.06; }`;
    case "lace": return `{ float u = p.y * 30.0; float s = 0.5 + 0.5 * sin(6.2831853 * u); fabH = s * fFade(u) * 0.4; fabA = 0.95 + 0.05 * s; }`;
  }
}

/** 植绒：两层高频噪声做绒毛，远看自动淡出 */
function fuzzCode(o: FabricOpts): string {
  const f = o.fuzz ?? 0; if (!f) return ""; const sc = (o.fuzzScale ?? 90).toFixed(2);
  return `{ float fz = fNoise(p * ${sc}) * 0.6 + fNoise(p * ${sc} * 2.1) * 0.4; float ff = fFade(p.x * ${sc}); fabH = mix(fabH, fabH * 0.6 + (fz - 0.5) * 0.9, ${f.toFixed(3)} * ff); fabA *= 1.0 - (1.0 - fz) * 0.1 * ${f.toFixed(3)}; fabR += 0.15 * ${f.toFixed(3)}; }`;
}

/** 给材质装上细节层；返回同一个材质（链式） */
export function patchFabric<T extends THREE.MeshStandardMaterial>(m: T, o: FabricOpts): T {
  const amp = o.amp ?? 0.012;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFabLoc; varying vec3 vFabN; varying float vFabScale;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFabLoc = position; vFabN = normal; vFabScale = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + COMMON)
      .replace("#include <color_fragment>", `#include <color_fragment>\n{ vec3 p = vFabLoc; ${body(o)} ${fuzzCode(o)} }\ndiffuseColor.rgb *= fabA;`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + fabR, 0.04, 1.0);")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\nnormal = fPerturb(-vViewPosition, normal, fabH * ${amp.toFixed(5)} * vFabScale);\nfabRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * fabRim * ${((o.fuzz ?? 0) * 0.5).toFixed(3)};`);
  };
  m.customProgramCacheKey = () => `fab:${JSON.stringify(o)}`;
  m.needsUpdate = true;
  return m;
}
