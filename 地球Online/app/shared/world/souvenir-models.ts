/** 目的地的特色物件（第八轮末，D78 / D80）：行李箱里按国家放的立体小东西——达摩、招财猫、海鹦、达拉木马、套娃、羊驼、骆驼、塔吉锅……
 *  用 landmark-kit 的积木拼，和名胜小模型是一套潮玩比例：原点在地面中心，+y 向上，正面朝 +z，自然高度 0.4～1.3；每个不超过 5 种颜色。
 *  键是 shared/geo/souvenirs.ts 里每样东西的 id；国家对不上或这个国家的东西拿完了，给一袋零食，颜色按名字定。 */
import * as THREE from "three";
import { mulberry32 } from "../algo/prng.ts";
import { type Landmark, type RGB, mat, add, box, cyl, cone, ball, prism } from "./landmark-kit.ts";
import { MORE_SOUVENIRS } from "./souvenir-models-more.ts";

type Maker = () => Landmark;
const PI = Math.PI;
const CREAM: RGB = [246, 240, 226], INK: RGB = [40, 44, 56], WOOD: RGB = [196, 150, 96], DARK_WOOD: RGB = [132, 90, 56], RED: RGB = [200, 48, 44], GOLD: RGB = [226, 172, 70], GREEN: RGB = [96, 150, 86];
const INDIGO: RGB = [74, 95, 176], SILVER: RGB = [200, 206, 216], HONEY: RGB = [196, 150, 96], SKY: RGB = [110, 180, 214], PINK: RGB = [244, 184, 196];
const GLASS = () => mat([226, 236, 244], 0.08, { transparent: true, opacity: 0.42, metalness: 0.05 });
const flat = (g: THREE.Group, top: number, footprint: number): Landmark => ({ group: g, top, footprint });

// ---------- 通用的几样（铁盒、罐子、瓶子、袋子、方盒、巧克力、玩偶的身子）
function tin(body: RGB, lid: RGB, label: RGB = CREAM, r = 0.42, h = 0.5): Landmark {
  const g = new THREE.Group(); add(g, cyl(r, r, h, 24), mat(body, 0.45, { metalness: 0.25 }), 0, h / 2, 0);
  add(g, cyl(r + 0.012, r + 0.012, h * 0.42, 24), mat(label, 0.7), 0, h * 0.45, 0);
  add(g, cyl(r + 0.03, r + 0.03, 0.08, 24), mat(lid, 0.4, { metalness: 0.3 }), 0, h + 0.03, 0);
  return flat(g, h + 0.08, r * 2 + 0.06);
}
function jar(content: RGB, lid: RGB, r = 0.36, h = 0.62): Landmark {
  const g = new THREE.Group(); add(g, cyl(r * 0.9, r * 0.84, h * 0.86, 20), mat(content, 0.5), 0, h * 0.43 + 0.02, 0);
  const glass = add(g, cyl(r, r * 0.92, h, 20), GLASS(), 0, h / 2, 0); glass.castShadow = false;
  add(g, cyl(r * 0.78, r * 0.78, 0.14, 20), mat(lid, 0.5), 0, h + 0.06, 0);
  return flat(g, h + 0.14, r * 2);
}
function bottle(liquid: RGB, cap: RGB, h = 0.95): Landmark {
  const g = new THREE.Group(); const m = mat(liquid, 0.25, { transparent: true, opacity: 0.92 });
  add(g, cyl(0.26, 0.24, h * 0.6, 18), m, 0, h * 0.3, 0); add(g, cyl(0.1, 0.24, h * 0.18, 18), m, 0, h * 0.69, 0);
  add(g, cyl(0.1, 0.1, h * 0.18, 12), GLASS(), 0, h * 0.87, 0); add(g, cyl(0.12, 0.12, 0.1, 12), mat(cap, 0.5), 0, h + 0.01, 0);
  add(g, box(0.3, 0.26, 0.03, 0.01), mat(CREAM, 0.7), 0, h * 0.3, 0.25);
  return flat(g, h + 0.06, 0.55);
}
function bag(c: RGB, stripe: RGB, w = 0.72, h = 0.9): Landmark {
  const g = new THREE.Group(); const b = add(g, box(w, h, 0.3, 0.1), mat(c, 0.55), 0, h / 2, 0); b.rotation.x = -0.08;
  add(g, box(w * 0.86, h * 0.26, 0.31, 0.03), mat(stripe, 0.6), 0, h * 0.55, 0.0).rotation.x = -0.08;
  add(g, box(w + 0.02, 0.07, 0.08, 0.02), mat(c, 0.55), 0, h + 0.02, -0.05); add(g, box(w + 0.02, 0.07, 0.08, 0.02), mat(c, 0.55), 0, 0.03, 0.02);
  return flat(g, h + 0.06, w);
}
function carton(c: RGB, lid: RGB, w = 0.9, h = 0.34, d = 0.7): Landmark {
  const g = new THREE.Group(); add(g, box(w, h, d, 0.04), mat(c, 0.6), 0, h / 2, 0); add(g, box(w + 0.03, 0.07, d + 0.03, 0.02), mat(lid, 0.55), 0, h + 0.035, 0);
  add(g, box(w * 0.5, 0.075, 0.2, 0.01), mat(CREAM, 0.7), 0, h + 0.04, d * 0.1);
  return flat(g, h + 0.07, Math.max(w, d));
}
/** 玩偶的身子（坐着）：圆身、圆头、两只耳朵、两条小腿；具体的脸、花纹由调用方加 */
function plushBody(fur: RGB, belly: RGB, earR = 0.08, earY = 0.9): THREE.Group {
  const g = new THREE.Group(); const f = mat(fur, 0.95), p = mat(belly, 0.9);
  add(g, ball(0.28), f, 0, 0.3, 0).scale.set(1, 1.05, 0.9); add(g, ball(0.2), p, 0, 0.26, 0.17).scale.set(0.8, 0.9, 0.5);
  add(g, ball(0.24), f, 0, 0.72, 0.02); for (const s of [-1, 1]) { add(g, ball(earR), f, s * 0.19, earY, 0); add(g, ball(0.1), f, s * 0.26, 0.14, 0.18).scale.set(1, 0.8, 1.3); add(g, ball(0.09), f, s * 0.3, 0.38, 0.06); }
  return g;
}
const eyes = (g: THREE.Group, y: number, z: number, dx = 0.08, r = 0.025) => { for (const s of [-1, 1]) add(g, ball(r), mat(INK, 0.3), s * dx, y, z); };

// ---------- 每样东西（补充的 30 样在 souvenir-models-more.ts，D88）
const M: Record<string, Maker> = {
  ...MORE_SOUVENIRS,
  // ---- 日本
  daruma: () => { const g = new THREE.Group(); const r = 0.42;
    add(g, ball(r), mat(RED, 0.6), 0, r * 1.05, 0).scale.set(1, 1.12, 0.96); add(g, ball(r * 0.62), mat(CREAM, 0.7), 0, r * 1.12, r * 0.52).scale.set(1, 1.05, 0.35);
    for (const s of [-1, 1]) { add(g, box(0.1, 0.05, 0.03, 0.01), mat(INK), s * 0.14, r * 1.3, r * 0.9); add(g, box(0.12, 0.04, 0.02, 0.01), mat(GOLD), s * 0.14, r * 1.4, r * 0.88); }
    add(g, box(0.1, 0.05, 0.03, 0.01), mat(GOLD, 0.4), 0, r * 0.8, r * 0.95); return flat(g, r * 2.25, r * 2); },
  manekineko: () => { const g = new THREE.Group(); const w = mat(CREAM, 0.8), red = mat(RED, 0.6), gold = mat(GOLD, 0.3, { metalness: 0.5 }), pink = mat(PINK, 0.8);   // 招财猫：白身、举起的右手掌心朝前、眯眼、红项圈、金铃、金币
    add(g, ball(0.32), w, 0, 0.34, 0).scale.set(1, 1.1, 0.9); add(g, ball(0.27), w, 0, 0.82, 0.02).scale.set(1.1, 1, 1);
    for (const s of [-1, 1]) { add(g, cone(0.09, 0.18, 4), w, s * 0.18, 1.06, 0).rotation.z = -s * 0.2; add(g, cone(0.05, 0.1, 4), pink, s * 0.18, 1.06, 0.03).rotation.z = -s * 0.2; add(g, box(0.09, 0.025, 0.02, 0.005), mat(INK, 0.4), s * 0.1, 0.86, 0.26).rotation.z = s * 0.5; }
    add(g, ball(0.03), pink, 0, 0.78, 0.28); for (const s of [-1, 1]) for (let i = 0; i < 2; i++) add(g, box(0.18, 0.012, 0.01, 0.002), mat(INK, 0.4), s * 0.2, 0.76 + i * 0.04, 0.24).rotation.z = s * (0.15 - i * 0.3);
    add(g, new THREE.TorusGeometry(0.2, 0.035, 8, 24), red, 0, 0.6, 0.02).rotation.x = PI / 2 - 0.2; add(g, ball(0.05), gold, 0, 0.55, 0.22);
    add(g, cyl(0.075, 0.075, 0.42, 10), w, 0.3, 0.78, 0.12).rotation.z = -0.1; add(g, ball(0.1), w, 0.33, 1.02, 0.14); add(g, ball(0.06), pink, 0.33, 1.02, 0.23).scale.set(1, 1, 0.4);
    add(g, ball(0.09), w, -0.3, 0.3, 0.2); add(g, cyl(0.17, 0.17, 0.05, 20), gold, -0.22, 0.2, 0.3).rotation.x = PI / 2 - 0.3;
    return flat(g, 1.14, 0.8); },
  matchaTin: () => tin([84, 132, 76], SILVER, [232, 236, 200], 0.3, 0.5),
  // ---- 北欧
  puffin: () => { const g = new THREE.Group(); const k = mat([42, 44, 50], 0.8), w = mat(CREAM, 0.75), o = mat([232, 120, 48], 0.5);
    add(g, ball(0.34), k, 0, 0.5, 0).scale.set(0.9, 1.15, 1); add(g, ball(0.27), w, 0, 0.42, 0.14).scale.set(0.85, 1.05, 0.7); add(g, ball(0.25), k, 0, 0.92, 0.08).scale.set(1, 0.95, 1);
    add(g, ball(0.2), w, 0, 0.9, 0.2).scale.set(0.95, 0.9, 0.55); const beak = add(g, cone(0.11, 0.3, 10), o, 0, 0.88, 0.42); beak.rotation.x = PI / 2; beak.scale.set(1, 1, 1.4);
    for (const s of [-1, 1]) { add(g, ball(0.035), mat(INK, 0.3), s * 0.1, 0.97, 0.36); add(g, box(0.16, 0.04, 0.22, 0.02), o, s * 0.12, 0.02, 0.1); }
    return flat(g, 1.15, 0.75); },
  lopapeysa: () => { const g = new THREE.Group(); const knit = mat(KNIT_GREY, 0.95), dark = mat([120, 112, 104], 0.95);   // 叠好的冰岛毛衣：两只袖子交叉搭在上面，领口一圈花纹
    add(g, box(0.9, 0.3, 0.8, 0.08), knit, 0, 0.15, 0);
    for (const s of [-1, 1]) { add(g, box(0.26, 0.14, 0.9, 0.06), knit, s * 0.2, 0.36, 0.05).rotation.y = s * 0.45; add(g, box(0.27, 0.15, 0.1, 0.03), dark, s * 0.37, 0.36, 0.45).rotation.y = s * 0.45; }
    add(g, cyl(0.16, 0.18, 0.1, 16), dark, 0, 0.47, -0.2);
    for (let i = 0; i < 10; i++) { const a = i * (PI * 2 / 10); add(g, box(0.07, 0.05, 0.07, 0.01), mat(i % 2 ? CREAM : [160, 70, 60], 0.9), Math.cos(a) * 0.3, 0.46, -0.2 + Math.sin(a) * 0.22); }
    return flat(g, 0.52, 1.0); },
  licorice: () => tin([32, 32, 36], SILVER, [60, 60, 66], 0.34, 0.26),
  butterCookies: () => tin([54, 92, 168], SILVER, [236, 232, 220], 0.48, 0.34),
  bricks: () => { const g = new THREE.Group(); const cs: RGB[] = [RED, GOLD, INDIGO];   // 三块积木摞着，顶上有凸点
    cs.forEach((c, i) => { const y = i * 0.22, w = 0.7 - i * 0.14; add(g, box(w, 0.2, 0.36, 0.02), mat(c, 0.5), (i % 2) * 0.1, y + 0.1, 0); for (let k = 0; k < 2; k++) add(g, cyl(0.05, 0.05, 0.05, 10), mat(c, 0.5), (i % 2) * 0.1 - w / 4 + k * w / 2, y + 0.225, 0); });
    return flat(g, 0.7, 0.75); },
  brunost: () => { const g = new THREE.Group(); add(g, box(0.8, 0.5, 0.5, 0.04), mat([150, 94, 56], 0.7), 0, 0.25, 0);
    add(g, box(0.5, 0.02, 0.32, 0.005), mat(SILVER, 0.3, { metalness: 0.6 }), 0.1, 0.52, 0.05, 0.3); add(g, cyl(0.03, 0.03, 0.42, 8), mat(WOOD, 0.7), 0.45, 0.54, -0.2, 0).rotation.z = PI / 2;
    return flat(g, 0.56, 0.9); },
  troll: () => { const g = new THREE.Group(); const skin = mat([150, 130, 104], 0.9), hair = mat([200, 110, 60], 1);   // 山妖：矮胖、大鼻子、乱发、一条尾巴
    add(g, ball(0.34), skin, 0, 0.36, 0).scale.set(1, 1.0, 0.9); add(g, ball(0.28), skin, 0, 0.82, 0.02);
    add(g, ball(0.09), skin, 0, 0.78, 0.28); eyes(g, 0.9, 0.24, 0.1, 0.03); for (let i = 0; i < 6; i++) add(g, cone(0.07, 0.3, 6), hair, (i - 2.5) * 0.09, 1.1, -0.05 + (i % 2) * 0.06).rotation.z = (i - 2.5) * 0.2;
    for (const s of [-1, 1]) { add(g, ball(0.09), skin, s * 0.3, 0.14, 0.14); add(g, ball(0.08), skin, s * 0.36, 0.42, 0.04); } add(g, cone(0.05, 0.3, 6), hair, 0, 0.2, -0.36).rotation.x = -1.2;
    return flat(g, 1.2, 0.8); },
  dalaHorse: () => { const g = new THREE.Group(); const red = mat([204, 54, 48], 0.6);
    add(g, box(0.78, 0.36, 0.26, 0.08), red, 0, 0.62, 0); for (const [x, z] of [[-0.26, -0.08], [-0.26, 0.08], [0.26, -0.08], [0.26, 0.08]] as const) add(g, box(0.1, 0.46, 0.1, 0.02), red, x, 0.23, z);
    add(g, box(0.22, 0.48, 0.2, 0.05), red, 0.36, 0.88, 0).rotation.z = -0.35; add(g, box(0.34, 0.2, 0.18, 0.05), red, 0.52, 1.08, 0);
    add(g, box(0.1, 0.42, 0.06, 0.01), mat(CREAM, 0.7), 0.26, 0.92, 0).rotation.z = -0.35; add(g, box(0.08, 0.26, 0.04, 0.01), mat(CREAM, 0.7), -0.42, 0.5, 0).rotation.z = 0.5;
    for (const s of [-1, 1]) add(g, box(0.2, 0.08, 0.02, 0.01), mat([240, 196, 80], 0.6), 0.05, 0.62, s * 0.14);
    return flat(g, 1.18, 0.95); },
  cinnamonBun: () => { const g = new THREE.Group();   // 肉桂卷：一道面团卷成的螺旋，缝里一道肉桂，顶上撒糖
    class Spiral extends THREE.Curve<THREE.Vector3> { constructor() { super(); } getPoint(t: number, target = new THREE.Vector3()) { const a = t * PI * 5, r = 0.05 + t * 0.3; return target.set(Math.cos(a) * r, 0, Math.sin(a) * r); } }
    add(g, new THREE.TubeGeometry(new Spiral(), 90, 0.1, 10, false), mat([206, 150, 84], 0.85), 0, 0.12, 0).scale.set(1, 0.85, 1);
    add(g, new THREE.TubeGeometry(new Spiral(), 90, 0.035, 6, false), mat([132, 82, 48], 0.8), 0, 0.2, 0);
    for (let i = 0; i < 10; i++) add(g, ball(0.025), mat(CREAM, 0.9), Math.cos(i * 0.9) * (0.1 + i * 0.03), 0.22, Math.sin(i * 0.9) * (0.1 + i * 0.03));
    return flat(g, 0.26, 0.8); },
  salmiakki: () => tin([32, 32, 36], SILVER, [60, 60, 66], 0.34, 0.26),
  // ---- 西欧、南欧
  macarons: () => { const g = new THREE.Group(); const cs: RGB[] = [PINK, [186, 216, 190], [248, 222, 150]];
    cs.forEach((c, i) => { const y = i * 0.3; add(g, cyl(0.34, 0.3, 0.1, 24), mat(c, 0.75), 0, y + 0.05, 0); add(g, cyl(0.3, 0.3, 0.08, 24), mat(CREAM, 0.8), 0, y + 0.14, 0); add(g, cyl(0.3, 0.34, 0.1, 24), mat(c, 0.75), 0, y + 0.23, 0); });
    return flat(g, 0.9, 0.7); },
  beret: () => { const g = new THREE.Group(); const m = mat([40, 44, 56], 0.95);   // 贝雷帽：扁扁一顶，顶上一个小揪
    const cap = add(g, ball(0.46), m, 0, 0.08, 0); cap.scale.set(1, 0.42, 1); add(g, cyl(0.3, 0.3, 0.08, 24), m, 0, 0.04, 0); add(g, cyl(0.03, 0.03, 0.08, 8), m, 0, 0.3, 0);
    return flat(g, 0.34, 0.95); },
  pasta: () => carton([40, 76, 150], [240, 196, 80], 0.5, 0.95, 0.3),
  gelato: () => { const g = new THREE.Group(); const c = add(g, cone(0.2, 0.6, 12), mat([206, 150, 84], 0.8), 0, 0.3, 0); c.rotation.x = PI;   // 两球冰淇淋，倒扣的甜筒
    add(g, ball(0.21), mat(PINK, 0.8), 0, 0.68, 0); add(g, ball(0.18), mat([180, 214, 150], 0.8), 0.06, 0.96, 0.04);
    return flat(g, 1.14, 0.45); },
  jamon: () => { const g = new THREE.Group(); add(g, box(0.9, 0.08, 0.36, 0.02), mat(WOOD, 0.7), 0, 0.04, 0); add(g, cyl(0.04, 0.04, 0.5, 8), mat(WOOD, 0.7), 0.3, 0.3, 0);
    const ham = add(g, ball(0.3), mat([150, 54, 50], 0.65), -0.08, 0.55, 0); ham.scale.set(1.5, 0.75, 0.6); ham.rotation.z = -0.25; add(g, cyl(0.045, 0.045, 0.5, 8), mat(CREAM, 0.6), 0.45, 0.72, 0).rotation.z = -1.1;
    return flat(g, 0.9, 1.0); },
  handFan: () => { const g = new THREE.Group(); const paper = mat([200, 48, 44], 0.7), rib = mat(DARK_WOOD, 0.7);   // 折扇：半张开，立着
    for (let i = 0; i <= 8; i++) { const a = PI * 0.15 + (i / 8) * PI * 0.7; const r = add(g, box(0.03, 0.72, 0.02, 0.005), rib, Math.cos(a) * 0.36, 0.05 + Math.sin(a) * 0.36, 0); r.rotation.z = a - PI / 2; }
    const sheet = add(g, new THREE.CircleGeometry(0.7, 24, PI * 0.15, PI * 0.7), paper, 0, 0.05, 0.012); sheet.castShadow = false;
    const back = add(g, new THREE.CircleGeometry(0.7, 24, PI * 0.15, PI * 0.7), paper, 0, 0.05, -0.012); back.rotation.y = PI;
    add(g, box(0.5, 0.06, 0.06, 0.01), rib, 0, 0.03, 0); return flat(g, 0.75, 1.4); },
  teaTin: () => tin([150, 32, 40], GOLD, [236, 232, 220], 0.3, 0.62),
  toyBus: () => { const g = new THREE.Group(); const red = mat(RED, 0.5), win = mat([200, 224, 240], 0.2);   // 双层小巴士
    add(g, box(1.0, 0.62, 0.42, 0.06), red, 0, 0.41, 0); for (let i = 0; i < 4; i++) for (const y of [0.3, 0.56]) for (const s of [-1, 1]) add(g, box(0.16, 0.14, 0.02, 0.005), win, -0.36 + i * 0.24, y, s * 0.215);
    add(g, box(0.3, 0.14, 0.02, 0.005), win, 0.49, 0.3, 0).rotation.y = PI / 2; for (const x of [-0.3, 0.3]) for (const s of [-1, 1]) add(g, cyl(0.09, 0.09, 0.06, 14), mat(INK, 0.6), x, 0.09, s * 0.21).rotation.x = PI / 2;
    return flat(g, 0.72, 1.0); },
  gingerbread: () => { const g = new THREE.Group();
    const heart = (s: number) => { const sh = new THREE.Shape(); sh.moveTo(0, -0.42 * s); sh.bezierCurveTo(0.6 * s, -0.05 * s, 0.42 * s, 0.42 * s, 0, 0.18 * s); sh.bezierCurveTo(-0.42 * s, 0.42 * s, -0.6 * s, -0.05 * s, 0, -0.42 * s); return sh; };
    const outer = new THREE.ExtrudeGeometry(heart(1.05), { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); const inner = new THREE.ExtrudeGeometry(heart(0.92), { depth: 0.11, bevelEnabled: false });
    add(g, outer, mat(CREAM, 0.8), 0, 0.5, -0.04).rotation.x = -0.25; add(g, inner, mat(DARK_WOOD, 0.75), 0, 0.5, -0.045).rotation.x = -0.25; add(g, box(0.9, 0.02, 0.3, 0.005), mat(DARK_WOOD, 0.75), 0, 0.02, 0.1);
    return flat(g, 1.0, 1.0); },
  nutcracker: () => { const g = new THREE.Group(); const red = mat(RED, 0.6), blue = mat(INDIGO, 0.6), skin = mat([236, 200, 176], 0.8), white = mat(CREAM, 0.9);   // 胡桃夹子：高帽、白胡子、红衣蓝裤
    for (const s of [-1, 1]) add(g, box(0.14, 0.4, 0.16, 0.03), blue, s * 0.1, 0.2, 0); add(g, box(0.4, 0.42, 0.26, 0.04), red, 0, 0.6, 0); add(g, box(0.08, 0.3, 0.02, 0.005), mat(GOLD, 0.4), 0, 0.62, 0.135);
    for (const s of [-1, 1]) add(g, box(0.1, 0.36, 0.1, 0.03), red, s * 0.26, 0.6, 0); add(g, box(0.3, 0.3, 0.26, 0.04), skin, 0, 0.98, 0); add(g, box(0.3, 0.12, 0.1, 0.03), white, 0, 0.88, 0.14); eyes(g, 1.04, 0.14, 0.07, 0.025);
    add(g, box(0.32, 0.36, 0.3, 0.04), mat(INK, 0.6), 0, 1.3, 0); add(g, box(0.34, 0.05, 0.32, 0.01), mat(GOLD, 0.4), 0, 1.14, 0);
    return flat(g, 1.5, 0.6); },
  chocolate: () => { const g = new THREE.Group(); add(g, box(1.0, 0.14, 0.5, 0.02), mat([110, 72, 140], 0.5), 0, 0.07, 0).rotation.y = 0.2; add(g, box(0.34, 0.15, 0.51, 0.02), mat(GOLD, 0.5), 0, 0.075, 0).rotation.y = 0.2;
    add(g, prism(0.42, 0.36, 1.1), mat([232, 190, 92], 0.4, { metalness: 0.2 }), 0.1, 0.14, -0.5, PI / 2); return flat(g, 0.5, 1.15); },
  cowbell: () => { const g = new THREE.Group(); const brass = mat([200, 160, 90], 0.3, { metalness: 0.6 });   // 牛铃：上窄下宽，一条红皮带
    add(g, cyl(0.22, 0.34, 0.6, 16), brass, 0, 0.3, 0); add(g, cyl(0.1, 0.1, 0.16, 8), brass, 0, 0.66, 0); add(g, box(0.2, 0.3, 0.06, 0.02), mat(RED, 0.6), 0, 0.84, 0); add(g, ball(0.08), mat(INK, 0.5), 0, 0.06, 0.1);
    return flat(g, 1.0, 0.7); },
  clogs: () => { const g = new THREE.Group(); const y = mat([236, 196, 72], 0.6);
    for (const s of [-1, 1]) { add(g, box(0.3, 0.26, 0.72, 0.1), y, s * 0.2, 0.13, 0).rotation.y = s * 0.12; add(g, ball(0.16), y, s * 0.24, 0.2, 0.36).scale.set(0.95, 1, 1.3); add(g, box(0.2, 0.16, 0.26, 0.04), mat(INK, 0.6), s * 0.2, 0.2, -0.1).rotation.y = s * 0.12; }
    return flat(g, 0.4, 0.95); },
  tulips: () => { const g = new THREE.Group(); const cs: RGB[] = [RED, GOLD, PINK];   // 三支郁金香插在小罐里
    add(g, cyl(0.18, 0.14, 0.3, 16), mat(SKY, 0.6), 0, 0.15, 0); cs.forEach((c, i) => { const x = (i - 1) * 0.16, h = 0.9 + (i % 2) * 0.15; const st = add(g, cyl(0.02, 0.02, h, 6), mat(GREEN, 0.8), x, 0.3 + h / 2, 0); st.rotation.z = (i - 1) * -0.12;
      add(g, ball(0.1), mat(c, 0.7), x - (i - 1) * 0.1, 0.3 + h, 0).scale.set(1, 1.4, 1); add(g, box(0.16, 0.05, 0.02, 0.01), mat(GREEN, 0.8), x + 0.06, 0.55 + i * 0.1, 0); });
    return flat(g, 1.5, 0.55); },
  mozartkugeln: () => { const l = carton([150, 32, 40], GOLD, 0.9, 0.3, 0.6); for (let i = 0; i < 6; i++) add(l.group, ball(0.1), mat([226, 172, 70], 0.25, { metalness: 0.6 }), -0.3 + (i % 3) * 0.3, 0.44, (i < 3 ? -0.14 : 0.14)); l.top = 0.56; return l; },
  rooster: () => { const g = new THREE.Group(); const k = mat(INK, 0.6), r = mat(RED, 0.6);   // 巴塞罗斯公鸡：黑身、红冠、彩色尾巴
    add(g, ball(0.28), k, 0, 0.5, 0).scale.set(0.9, 1, 1.2); add(g, cyl(0.1, 0.12, 0.3, 10), k, 0, 0.8, 0.2).rotation.x = 0.3; add(g, ball(0.16), k, 0, 0.98, 0.3);
    add(g, cone(0.06, 0.14, 8), mat(GOLD, 0.5), 0, 0.96, 0.46).rotation.x = PI / 2; for (let i = 0; i < 3; i++) add(g, ball(0.05), r, 0, 1.12, 0.22 + i * 0.08); add(g, ball(0.05), r, 0, 0.9, 0.42);
    const cs: RGB[] = [RED, GOLD, GREEN, INDIGO]; cs.forEach((c, i) => add(g, box(0.06, 0.5, 0.1, 0.02), mat(c, 0.6), (i - 1.5) * 0.08, 0.8, -0.3).rotation.x = -0.7);
    for (const s of [-1, 1]) add(g, cyl(0.03, 0.03, 0.3, 6), mat(GOLD, 0.5), s * 0.1, 0.15, 0); add(g, box(0.5, 0.06, 0.4, 0.02), mat(INK, 0.6), 0, 0.03, 0);
    return flat(g, 1.2, 0.7); },
  blueDome: () => { const g = new THREE.Group(); const w = mat(CREAM, 0.9), b = mat([40, 80, 180], 0.5);   // 蓝顶小屋：白墙、蓝圆顶、蓝门窗
    add(g, box(0.7, 0.6, 0.7, 0.04), w, 0, 0.3, 0); add(g, ball(0.34), b, 0, 0.62, 0); add(g, box(0.3, 0.44, 0.3, 0.03), w, 0.42, 0.22, 0.2); add(g, ball(0.16), b, 0.42, 0.46, 0.2);
    add(g, box(0.14, 0.22, 0.02, 0.005), b, -0.1, 0.14, 0.355); add(g, box(0.1, 0.1, 0.02, 0.005), b, 0.18, 0.4, 0.355); add(g, box(0.02, 0.1, 0.1, 0.005), b, 0.355, 0.4, -0.15);
    return flat(g, 0.96, 0.9); },
  beerStein: () => { const g = new THREE.Group(); add(g, cyl(0.24, 0.22, 0.7, 20), GLASS(), 0, 0.35, 0).castShadow = false; add(g, cyl(0.21, 0.19, 0.56, 20), mat([226, 172, 70], 0.3, { transparent: true, opacity: 0.9 }), 0, 0.3, 0);
    add(g, ball(0.25), mat(CREAM, 0.9), 0, 0.72, 0).scale.set(1, 0.5, 1); add(g, new THREE.TorusGeometry(0.13, 0.035, 8, 16, PI), GLASS(), 0.26, 0.38, 0).rotation.z = -PI / 2;
    return flat(g, 0.86, 0.6); },
  shamrock: () => { const g = new THREE.Group(); const green = mat(GREEN, 0.8);   // 三叶草：一盆三株
    add(g, cyl(0.26, 0.2, 0.3, 16), mat([180, 110, 80], 0.8), 0, 0.15, 0); for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.16, h = 0.5 + (i % 2) * 0.1; add(g, cyl(0.015, 0.015, h, 6), green, x, 0.3 + h / 2, 0); for (let k = 0; k < 3; k++) { const a = k * (2 * PI / 3) + PI / 2; add(g, ball(0.08), green, x + Math.cos(a) * 0.08, 0.3 + h + Math.sin(a) * 0.08, 0).scale.set(1, 1, 0.3); } }
    return flat(g, 1.0, 0.6); },
  waffle: () => { const g = new THREE.Group(); const dough = mat([214, 160, 84], 0.85);   // 华夫饼：格子，淋一点巧克力
    add(g, box(0.8, 0.12, 0.6, 0.03), dough, 0, 0.06, 0); for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) add(g, box(0.14, 0.06, 0.14, 0.01), mat([170, 120, 60], 0.85), -0.3 + i * 0.2, 0.14, -0.2 + k * 0.2);
    add(g, box(0.36, 0.04, 0.1, 0.01), mat(DARK_WOOD, 0.5), 0.05, 0.19, 0.05).rotation.y = 0.5; return flat(g, 0.22, 0.85); },
  matryoshka: () => { const g = new THREE.Group(); const cs: RGB[] = [RED, GOLD, INDIGO];   // 套娃：三个由大到小
    cs.forEach((c, i) => { const s = 1 - i * 0.28, x = -0.45 + i * 0.45 + i * 0.1; add(g, ball(0.26 * s), mat(c, 0.6), x, 0.3 * s, 0).scale.set(1, 1.25, 1); add(g, ball(0.2 * s), mat(c, 0.6), x, 0.72 * s, 0); add(g, ball(0.13 * s), mat([236, 200, 176], 0.8), x, 0.7 * s, 0.1 * s).scale.set(1, 1.1, 0.5);
      for (const d of [-1, 1]) add(g, ball(0.02 * s), mat(INK, 0.3), x + d * 0.05 * s, 0.72 * s, 0.17 * s); add(g, ball(0.12 * s), mat(CREAM, 0.8), x, 0.3 * s, 0.2 * s).scale.set(1, 1.3, 0.4); });
    return flat(g, 0.95, 1.4); },
  seaweed: () => bag([42, 66, 52], GOLD, 0.6, 0.72),
  elephant: () => { const g = new THREE.Group(); const w = mat(DARK_WOOD, 0.7);   // 木雕小象：圆身、长鼻、大耳、一块红毯
    add(g, ball(0.34), w, 0, 0.46, 0).scale.set(1.2, 0.95, 1); add(g, ball(0.24), w, 0.4, 0.6, 0); for (const s of [-1, 1]) add(g, ball(0.14), w, 0.38, 0.62, s * 0.22).scale.set(0.4, 1, 1);
    const trunk = add(g, cyl(0.06, 0.09, 0.5, 8), w, 0.62, 0.42, 0); trunk.rotation.z = 0.5; for (const [x, z] of [[-0.2, -0.14], [-0.2, 0.14], [0.2, -0.14], [0.2, 0.14]] as const) add(g, cyl(0.08, 0.09, 0.3, 8), w, x, 0.15, z);
    add(g, box(0.4, 0.04, 0.5, 0.01), mat(RED, 0.7), -0.05, 0.78, 0); eyes(g, 0.66, 0.0, 0, 0.0); for (const s of [-1, 1]) add(g, ball(0.025), mat(INK, 0.3), 0.56, 0.68, s * 0.12);
    return flat(g, 0.85, 1.0); },
  conicalHat: () => { const g = new THREE.Group(); add(g, cone(0.6, 0.42, 24), mat([222, 200, 150], 0.85), 0, 0.21, 0); add(g, new THREE.TorusGeometry(0.42, 0.012, 6, 32), mat(DARK_WOOD, 0.7), 0, 0.14, 0).rotation.x = PI / 2;
    add(g, new THREE.TorusGeometry(0.22, 0.012, 6, 32), mat(DARK_WOOD, 0.7), 0, 0.28, 0).rotation.x = PI / 2; add(g, box(0.03, 0.26, 0.02, 0.005), mat(RED, 0.6), 0.5, 0.16, 0.2).rotation.z = 0.6; return flat(g, 0.42, 1.2); },
  kaya: () => jar([112, 150, 84], SILVER),
  whiteCoffee: () => bag([236, 226, 206], [110, 72, 48]),
  krupuk: () => bag([240, 160, 170], [246, 220, 120]),
  driedMango: () => bag([236, 150, 60], [246, 220, 120]),
  palmSugar: () => jar([170, 110, 60], DARK_WOOD, 0.34, 0.5),
  spiceJars: () => { const g = new THREE.Group(); const cs: RGB[] = [[214, 120, 40], [200, 48, 44], [226, 172, 70]];   // 三罐香料：姜黄、辣椒、咖喱
    cs.forEach((c, i) => { const x = (i - 1) * 0.4; add(g, cyl(0.16, 0.15, 0.4, 16), mat(c, 0.6), x, 0.22, 0); add(g, cyl(0.17, 0.16, 0.44, 16), GLASS(), x, 0.22, 0).castShadow = false; add(g, cyl(0.13, 0.13, 0.08, 16), mat(DARK_WOOD, 0.6), x, 0.48, 0); });
    add(g, box(1.2, 0.06, 0.4, 0.02), mat(WOOD, 0.7), 0, 0.03, 0); return flat(g, 0.55, 1.25); },
  feltSheep: () => { const g = new THREE.Group(); const wool = mat(CREAM, 1), face = mat(INK, 0.6);   // 毛毡小羊
    add(g, ball(0.32), wool, 0, 0.42, 0).scale.set(1.2, 1, 1); for (let i = 0; i < 6; i++) add(g, ball(0.12), wool, Math.cos(i * 1.05) * 0.3, 0.58 + (i % 2) * 0.06, Math.sin(i * 1.05) * 0.24);
    add(g, ball(0.16), face, 0.4, 0.52, 0).scale.set(1.1, 0.9, 0.8); for (const s of [-1, 1]) { add(g, ball(0.06), face, 0.36, 0.64, s * 0.16).scale.set(0.6, 0.6, 1.4); add(g, ball(0.02), wool, 0.54, 0.56, s * 0.06); add(g, cyl(0.04, 0.04, 0.2, 8), face, s * 0.2, 0.1, 0.16); add(g, cyl(0.04, 0.04, 0.2, 8), face, s * 0.2, 0.1, -0.16); }
    return flat(g, 0.78, 0.95); },
  teaCaddy: () => tin([180, 48, 44], GOLD, [246, 230, 190], 0.3, 0.58),
  panda: () => { const g = plushBody(CREAM, CREAM, 0.09, 0.92); const k = mat(INK, 0.95);   // 熊猫：白身、黑耳黑眼圈黑手脚
    for (const s of [-1, 1]) { add(g, ball(0.09), k, s * 0.19, 0.92, 0); add(g, ball(0.06), k, s * 0.09, 0.78, 0.2).scale.set(1, 1.3, 0.5); add(g, ball(0.025), mat(CREAM, 0.5), s * 0.09, 0.78, 0.23); add(g, ball(0.1), k, s * 0.3, 0.38, 0.06); add(g, ball(0.1), k, s * 0.26, 0.14, 0.18).scale.set(1, 0.8, 1.3); }
    add(g, ball(0.035), k, 0, 0.68, 0.24); return flat(g, 0.98, 0.62); },
  pineappleCake: () => carton([236, 196, 72], WOOD, 0.8, 0.3, 0.6),
  eggRolls: () => tin(RED, GOLD, [246, 230, 190], 0.34, 0.7),
  koala: () => { const g = plushBody([150, 150, 160], CREAM, 0.14, 0.86); add(g, ball(0.07), mat(INK, 0.5), 0, 0.68, 0.24).scale.set(1, 1.4, 0.8); eyes(g, 0.78, 0.2, 0.08); for (const s of [-1, 1]) add(g, ball(0.08), mat([236, 220, 216], 0.9), s * 0.2, 0.86, 0.06);
    return flat(g, 1.0, 0.64); },
  timtam: () => carton([150, 54, 50], GOLD, 0.9, 0.3, 0.6),
  manuka: () => jar([214, 150, 48], INK),
  kiwiBird: () => { const g = new THREE.Group(); const brown = mat([120, 92, 60], 1);   // 几维鸟：蛋形身子、长喙、两条小腿
    add(g, ball(0.32), brown, 0, 0.42, 0).scale.set(1, 0.9, 1.3); add(g, ball(0.18), brown, 0, 0.66, 0.34); add(g, cyl(0.025, 0.015, 0.5, 8), mat([214, 190, 150], 0.7), 0, 0.6, 0.66).rotation.x = PI / 2 + 0.2;
    eyes(g, 0.72, 0.48, 0.1, 0.025); for (const s of [-1, 1]) { add(g, cyl(0.035, 0.035, 0.22, 8), mat([214, 190, 150], 0.7), s * 0.12, 0.11, 0.06); add(g, box(0.1, 0.03, 0.16, 0.01), mat([214, 190, 150], 0.7), s * 0.12, 0.02, 0.12); }
    return flat(g, 0.8, 0.8); },
  peanutButter: () => jar([208, 160, 96], [196, 48, 44], 0.34, 0.56),
  baseballCap: () => { const g = new THREE.Group(); const m = mat(INDIGO, 0.8);   // 棒球帽
    add(g, ball(0.4), m, 0, 0.1, 0).scale.set(1, 0.72, 1); add(g, cyl(0.4, 0.4, 0.1, 24), m, 0, 0.1, 0); add(g, box(0.5, 0.04, 0.42, 0.02), m, 0, 0.12, 0.5).rotation.x = -0.12; add(g, ball(0.04), m, 0, 0.4, 0);
    add(g, box(0.16, 0.12, 0.02, 0.005), mat(CREAM, 0.8), 0, 0.22, 0.38); return flat(g, 0.44, 1.0); },
  mapleSyrup: () => bottle([206, 118, 36], [196, 48, 44]),
  sombrero: () => { const g = new THREE.Group(); const straw = mat([222, 190, 110], 0.85);   // 草帽：大帽檐、高帽顶、一条彩带
    add(g, cyl(0.8, 0.7, 0.06, 32), straw, 0, 0.06, 0); add(g, new THREE.TorusGeometry(0.78, 0.04, 8, 32), straw, 0, 0.1, 0).rotation.x = PI / 2; add(g, cyl(0.3, 0.36, 0.5, 24), straw, 0, 0.32, 0);
    add(g, cyl(0.33, 0.37, 0.1, 24), mat(RED, 0.6), 0, 0.14, 0); add(g, cyl(0.32, 0.34, 0.06, 24), mat(GREEN, 0.6), 0, 0.22, 0); return flat(g, 0.58, 1.6); },
  flipFlops: () => { const g = new THREE.Group(); for (const s of [-1, 1]) { const x = s * 0.24; add(g, cyl(0.16, 0.16, 0.06, 20), mat(GOLD, 0.7), x, 0.03, 0).scale.set(1, 1, 2.1); for (const d of [-1, 1]) add(g, cyl(0.02, 0.02, 0.28, 6), mat(GREEN, 0.7), x + d * 0.06, 0.12, 0.08).rotation.z = d * 0.6 - 0.0; add(g, cyl(0.02, 0.02, 0.1, 6), mat(GREEN, 0.7), x, 0.1, 0.2).rotation.x = 0.6; }
    return flat(g, 0.24, 0.9); },
  mateGourd: () => { const g = new THREE.Group(); add(g, ball(0.3), mat(DARK_WOOD, 0.8), 0, 0.3, 0).scale.set(1, 1.1, 1); add(g, cyl(0.2, 0.26, 0.2, 16), mat(DARK_WOOD, 0.8), 0, 0.58, 0); add(g, cyl(0.18, 0.18, 0.04, 16), mat(GREEN, 0.9), 0, 0.68, 0);
    add(g, cyl(0.025, 0.025, 0.7, 8), mat(SILVER, 0.3, { metalness: 0.6 }), 0.12, 0.9, 0).rotation.z = -0.3; add(g, new THREE.TorusGeometry(0.3, 0.025, 8, 20), mat(SILVER, 0.3, { metalness: 0.6 }), 0, 0.5, 0).rotation.x = PI / 2;
    return flat(g, 1.2, 0.65); },
  alpaca: () => { const g = new THREE.Group(); const wool = mat(CREAM, 1);   // 羊驼：长脖子、小耳朵、蓬蓬的毛
    add(g, ball(0.3), wool, 0, 0.5, 0).scale.set(1.3, 0.9, 1); add(g, cyl(0.12, 0.14, 0.6, 12), wool, 0.3, 0.9, 0).rotation.z = -0.15; add(g, ball(0.16), wool, 0.36, 1.26, 0.04); add(g, ball(0.1), wool, 0.44, 1.2, 0.2).scale.set(1, 0.8, 1.3);
    for (const s of [-1, 1]) { add(g, cone(0.04, 0.14, 6), wool, 0.3, 1.44, s * 0.08); add(g, cyl(0.06, 0.06, 0.4, 8), wool, -0.2, 0.2, s * 0.14); add(g, cyl(0.06, 0.06, 0.4, 8), wool, 0.24, 0.2, s * 0.14); add(g, ball(0.02), mat(INK, 0.3), 0.46, 1.28, s * 0.1); }
    for (let i = 0; i < 5; i++) add(g, ball(0.1), wool, -0.3 + i * 0.15, 0.72 + (i % 2) * 0.04, 0); return flat(g, 1.5, 0.95); },
  cigarBox: () => { const l = carton([120, 80, 48], GOLD, 0.9, 0.26, 0.6); for (let i = 0; i < 4; i++) add(l.group, cyl(0.05, 0.05, 0.56, 10), mat([150, 100, 60], 0.7), -0.24 + i * 0.16, 0.36, 0).rotation.x = PI / 2; add(l.group, box(0.06, 0.11, 0.6, 0.01), mat(GOLD, 0.5), -0.0, 0.36, 0); l.top = 0.42; return l; },
  dates: () => { const l = carton([214, 188, 140], [150, 94, 56]); for (let i = 0; i < 5; i++) add(l.group, ball(0.09), mat([96, 56, 40], 0.6), -0.3 + i * 0.15, 0.46, (i % 2) * 0.12 - 0.06).scale.set(1, 0.8, 1.5); l.top = 0.56; return l; },
  tagine: () => { const g = new THREE.Group(); const clay = mat([200, 120, 80], 0.8);   // 塔吉锅：盘底、圆锥盖
    add(g, cyl(0.5, 0.42, 0.18, 24), clay, 0, 0.09, 0); add(g, cone(0.46, 0.7, 24), clay, 0, 0.53, 0); add(g, ball(0.06), clay, 0, 0.9, 0); add(g, new THREE.TorusGeometry(0.44, 0.02, 6, 32), mat(INDIGO, 0.6), 0, 0.32, 0).rotation.x = PI / 2;
    return flat(g, 0.96, 1.0); },
  giraffe: () => { const g = new THREE.Group(); const w = mat([206, 160, 90], 0.7), spot = mat(DARK_WOOD, 0.7);   // 木雕长颈鹿
    add(g, box(0.5, 0.3, 0.24, 0.06), w, 0, 0.5, 0); for (const [x, z] of [[-0.18, -0.08], [-0.18, 0.08], [0.18, -0.08], [0.18, 0.08]] as const) add(g, cyl(0.04, 0.04, 0.36, 8), w, x, 0.18, z);
    add(g, cyl(0.07, 0.09, 0.8, 10), w, 0.24, 0.98, 0).rotation.z = -0.25; add(g, box(0.26, 0.14, 0.16, 0.04), w, 0.42, 1.36, 0); for (const s of [-1, 1]) add(g, cyl(0.015, 0.015, 0.12, 6), spot, 0.36, 1.48, s * 0.05);
    for (let i = 0; i < 6; i++) add(g, ball(0.04), spot, -0.2 + (i % 3) * 0.2, 0.5 + (i < 3 ? 0.06 : -0.06), (i < 3 ? 0.12 : -0.12)).scale.set(1, 1, 0.3); for (let i = 0; i < 3; i++) add(g, ball(0.03), spot, 0.2 + i * 0.07, 0.75 + i * 0.22, 0.07).scale.set(1, 1, 0.3);
    return flat(g, 1.55, 0.7); },
  rooibos: () => tin([180, 90, 50], GOLD, [246, 230, 190], 0.3, 0.58),
  lokum: () => { const l = carton([246, 214, 220], GOLD); for (let i = 0; i < 4; i++) add(l.group, box(0.18, 0.18, 0.18, 0.04), mat(i % 2 ? PINK : [186, 216, 190], 0.8), -0.28 + i * 0.19, 0.5, (i % 2) * 0.1 - 0.05, i * 0.4); l.top = 0.6; return l; },
  evilEye: () => { const g = new THREE.Group(); const disc = (r: number, c: RGB, z: number) => { const d = add(g, cyl(r, r, 0.04, 32), mat(c, 0.2, { metalness: 0.1 }), 0, 0.42, z); d.rotation.x = PI / 2 - 0.3; };   // 蓝眼睛：几圈同心，立着斜靠
    disc(0.42, [40, 80, 180], 0); disc(0.3, CREAM, 0.03); disc(0.2, SKY, 0.06); disc(0.1, INK, 0.09); add(g, cyl(0.05, 0.05, 0.3, 8), mat(DARK_WOOD, 0.7), 0, 0.15, -0.2).rotation.x = -0.5;
    return flat(g, 0.84, 0.9); },
  camel: () => { const g = new THREE.Group(); const fur = mat([214, 170, 110], 1);   // 骆驼玩偶：一个驼峰、长脖子
    add(g, ball(0.3), fur, 0, 0.5, 0).scale.set(1.4, 0.9, 1); add(g, ball(0.2), fur, 0, 0.76, 0); add(g, cyl(0.1, 0.12, 0.5, 10), fur, 0.36, 0.82, 0).rotation.z = -0.35; add(g, ball(0.15), fur, 0.5, 1.08, 0.04).scale.set(1.3, 0.9, 0.9);
    for (const s of [-1, 1]) { add(g, cyl(0.06, 0.06, 0.4, 8), fur, -0.22, 0.2, s * 0.14); add(g, cyl(0.06, 0.06, 0.4, 8), fur, 0.26, 0.2, s * 0.14); add(g, ball(0.02), mat(INK, 0.3), 0.58, 1.12, s * 0.09); add(g, cone(0.035, 0.1, 6), fur, 0.44, 1.22, s * 0.08); }
    add(g, box(0.3, 0.04, 0.4, 0.01), mat(RED, 0.7), 0, 0.9, 0); return flat(g, 1.3, 1.0); },
  deadSeaMud: () => jar([90, 84, 78], CREAM, 0.34, 0.46),
  // ---- D82 续加
  vase: () => { const g = new THREE.Group(); const pts = [[0.12, 0], [0.3, 0.1], [0.36, 0.4], [0.3, 0.7], [0.14, 0.86], [0.16, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));   // 青花瓷瓶：车削的瓶身，两道青花
    add(g, new THREE.LatheGeometry(pts, 24), mat(CREAM, 0.3), 0, 0, 0); add(g, new THREE.TorusGeometry(0.355, 0.02, 6, 32), mat([40, 80, 180], 0.4), 0, 0.42, 0).rotation.x = PI / 2; add(g, new THREE.TorusGeometry(0.3, 0.02, 6, 32), mat([40, 80, 180], 0.4), 0, 0.68, 0).rotation.x = PI / 2;
    for (let i = 0; i < 6; i++) add(g, ball(0.04), mat([40, 80, 180], 0.4), Math.cos(i * 1.05) * 0.35, 0.55, Math.sin(i * 1.05) * 0.35).scale.set(1, 1.6, 0.3); return flat(g, 1.0, 0.75); },
  hahoeMask: () => { const g = new THREE.Group(); const face = mat([226, 190, 140], 0.8);   // 河回面具：椭圆脸、弯眼、咧嘴、黑帽带，斜靠着
    const f = new THREE.Group(); f.rotation.x = -0.35; f.position.y = 0.1; g.add(f); add(f, ball(0.42), face, 0, 0.5, 0).scale.set(0.85, 1, 0.3); add(f, box(0.7, 0.1, 0.1, 0.02), mat(INK, 0.6), 0, 0.88, 0.02);
    for (const s of [-1, 1]) { add(f, new THREE.TorusGeometry(0.08, 0.015, 6, 12, PI), mat(INK, 0.4), s * 0.14, 0.62, 0.13); add(f, ball(0.07), mat([226, 170, 130], 0.8), s * 0.2, 0.48, 0.1).scale.set(1, 0.8, 0.5); }
    add(f, new THREE.TorusGeometry(0.16, 0.025, 6, 16, PI), mat(INK, 0.4), 0, 0.3, 0.13).rotation.z = PI; add(f, ball(0.05), face, 0, 0.5, 0.15).scale.set(1, 1.4, 1);
    add(g, box(0.5, 0.06, 0.3, 0.02), mat(DARK_WOOD, 0.7), 0, 0.03, -0.1); return flat(g, 1.0, 0.8); },
  paprika: () => tin([200, 48, 44], GOLD, CREAM, 0.26, 0.56),
  polishPottery: () => { const g = new THREE.Group(); const w = mat([236, 236, 230], 0.5), b = mat([40, 80, 180], 0.5);   // 波兰陶杯：白底蓝点点，一只耳朵
    add(g, cyl(0.26, 0.22, 0.56, 20), w, 0, 0.28, 0); for (let i = 0; i < 14; i++) add(g, ball(0.035), b, Math.cos(i * 0.9) * 0.245, 0.14 + (i % 3) * 0.16, Math.sin(i * 0.9) * 0.245).scale.set(1, 1, 0.4);
    add(g, new THREE.TorusGeometry(0.11, 0.03, 8, 16, PI), w, 0.3, 0.3, 0).rotation.z = -PI / 2; add(g, cyl(0.21, 0.21, 0.02, 20), mat([120, 90, 60], 0.6), 0, 0.56, 0); return flat(g, 0.58, 0.75); },
  lavenderSachet: () => { const g = new THREE.Group(); const lilac = mat([176, 150, 200], 0.9);   // 薰衣草香包：一小袋，扎口，插两枝
    add(g, ball(0.3), lilac, 0, 0.3, 0).scale.set(1, 1.1, 0.8); add(g, cyl(0.1, 0.14, 0.14, 12), lilac, 0, 0.66, 0); add(g, new THREE.TorusGeometry(0.11, 0.02, 6, 16), mat(CREAM, 0.8), 0, 0.64, 0).rotation.x = PI / 2;
    for (const s of [-1, 1]) { add(g, cyl(0.012, 0.012, 0.5, 6), mat(GREEN, 0.8), s * 0.05, 0.9, 0).rotation.z = s * 0.3; for (let i = 0; i < 4; i++) add(g, ball(0.03), mat([130, 100, 180], 0.8), s * (0.05 + (0.08 + i * 0.07) * 0.3), 0.98 + i * 0.07, 0); }
    return flat(g, 1.3, 0.65); },
  roseOil: () => bottle([232, 120, 150], [200, 160, 90], 0.7),
  ceramicPlate: () => { const g = new THREE.Group(); const p = new THREE.Group(); p.rotation.x = -0.4; p.position.set(0, 0.1, 0); g.add(p);   // 陶盘：立在小架上，蓝黄两圈纹
    add(p, cyl(0.52, 0.5, 0.05, 32), mat(CREAM, 0.4), 0, 0.5, 0).rotation.x = PI / 2; add(p, new THREE.TorusGeometry(0.4, 0.025, 6, 32), mat([40, 80, 180], 0.4), 0, 0.5, 0.03); add(p, new THREE.TorusGeometry(0.25, 0.025, 6, 32), mat(GOLD, 0.4), 0, 0.5, 0.03); add(p, ball(0.06), mat([40, 80, 180], 0.4), 0, 0.5, 0.03).scale.set(1, 1, 0.4);
    add(g, box(0.5, 0.06, 0.3, 0.02), mat(DARK_WOOD, 0.7), 0, 0.03, -0.05); return flat(g, 1.1, 1.05); },
  jebena: () => { const g = new THREE.Group(); const clay = mat([150, 80, 60], 0.8);   // 埃塞俄比亚咖啡壶：圆肚、长颈、斜嘴、一只耳朵
    add(g, ball(0.3), clay, 0, 0.32, 0); add(g, cyl(0.07, 0.1, 0.5, 12), clay, 0, 0.78, 0); add(g, cyl(0.1, 0.07, 0.08, 12), clay, 0, 1.06, 0); add(g, ball(0.06), mat(GOLD, 0.4), 0, 1.12, 0);
    add(g, cyl(0.03, 0.06, 0.5, 8), clay, 0.3, 0.6, 0).rotation.z = -0.7; add(g, new THREE.TorusGeometry(0.14, 0.03, 8, 16, PI), clay, -0.28, 0.5, 0).rotation.z = PI / 2;
    add(g, cyl(0.2, 0.26, 0.08, 16), mat(WOOD, 0.7), 0, 0.04, 0); return flat(g, 1.15, 0.8); },
  maasaiBeads: () => { const g = new THREE.Group(); const cs: RGB[] = [RED, [40, 80, 180], CREAM, GOLD, GREEN];   // 马赛珠串：几圈平放的珠圈
    cs.forEach((c, i) => { const r = 0.5 - i * 0.08; add(g, new THREE.TorusGeometry(r, 0.03, 8, 40), mat(c, 0.5), 0, 0.03 + i * 0.012, 0).rotation.x = PI / 2; }); for (let i = 0; i < 12; i++) add(g, ball(0.035), mat(i % 2 ? CREAM : INK, 0.4), Math.cos(i * 0.52) * 0.5, 0.04, Math.sin(i * 0.52) * 0.5);
    return flat(g, 0.1, 1.1); },
  ceramicBowl: () => { const g = new THREE.Group(); const pts = [[0, 0], [0.16, 0], [0.3, 0.12], [0.36, 0.3], [0.34, 0.32], [0.29, 0.14], [0.16, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));   // 青花茶碗
    add(g, new THREE.LatheGeometry(pts, 24), mat(CREAM, 0.3, { side: THREE.DoubleSide }), 0, 0, 0); add(g, new THREE.TorusGeometry(0.33, 0.018, 6, 32), mat([40, 80, 180], 0.4), 0, 0.26, 0).rotation.x = PI / 2; add(g, cyl(0.15, 0.15, 0.01, 20), mat([40, 80, 180], 0.4), 0, 0.035, 0);
    return flat(g, 0.33, 0.75); },
  prayerFlags: () => { const g = new THREE.Group(); const cs: RGB[] = [[40, 80, 180], CREAM, RED, GREEN, GOLD];   // 经幡：两根小杆，一串五色小旗
    for (const x of [-0.6, 0.6]) add(g, cyl(0.02, 0.02, 1.0, 6), mat(DARK_WOOD, 0.7), x, 0.5, 0); add(g, cyl(0.008, 0.008, 1.2, 4), mat(INK, 0.6), 0, 0.95, 0).rotation.z = PI / 2;
    cs.forEach((c, i) => add(g, box(0.18, 0.22, 0.01, 0.005), mat(c, 0.8, { side: THREE.DoubleSide }), -0.44 + i * 0.22, 0.83, 0).rotation.y = (i % 2 ? 1 : -1) * 0.15); return flat(g, 1.0, 1.3); },
  lacquerBox: () => { const g = new THREE.Group(); const lac = mat([120, 30, 30], 0.25, { metalness: 0.1 });   // 漆器盒：圆盒，金线
    add(g, cyl(0.36, 0.36, 0.3, 24), lac, 0, 0.15, 0); add(g, cyl(0.37, 0.37, 0.12, 24), lac, 0, 0.36, 0); add(g, new THREE.TorusGeometry(0.37, 0.012, 6, 32), mat(GOLD, 0.3, { metalness: 0.5 }), 0, 0.3, 0).rotation.x = PI / 2; add(g, new THREE.TorusGeometry(0.2, 0.012, 6, 32), mat(GOLD, 0.3, { metalness: 0.5 }), 0, 0.425, 0).rotation.x = PI / 2;
    return flat(g, 0.44, 0.76); },
  ceylonTea: () => tin([40, 110, 80], GOLD, CREAM, 0.3, 0.6),
  wine: () => { const g = new THREE.Group(); const glass = mat([50, 36, 44], 0.3);   // 红酒：深色瓶、红封、奶油标签
    add(g, cyl(0.15, 0.15, 0.7, 16), glass, 0, 0.35, 0); add(g, cyl(0.06, 0.15, 0.2, 16), glass, 0, 0.8, 0); add(g, cyl(0.06, 0.06, 0.3, 12), glass, 0, 1.05, 0); add(g, cyl(0.065, 0.065, 0.1, 12), mat(RED, 0.5), 0, 1.17, 0); add(g, box(0.22, 0.26, 0.02, 0.01), mat(CREAM, 0.7), 0, 0.36, 0.15);
    return flat(g, 1.22, 0.32); },
  coffeeBeans: () => { const l = bag([196, 170, 120], [110, 72, 48], 0.72, 0.8); for (let i = 0; i < 6; i++) add(l.group, ball(0.05), mat([96, 60, 36], 0.6), 0.3 + (i % 3) * 0.12, 0.05, 0.25 + (i < 3 ? 0 : 0.12)).scale.set(1, 0.7, 1.4); l.footprint = 1.0; return l; },
  sloth: () => { const g = new THREE.Group(); const fur = mat([150, 120, 90], 1), pale = mat(CREAM, 0.9);   // 树懒玩偶：抱着一根树枝
    add(g, cyl(0.05, 0.05, 1.1, 8), mat(DARK_WOOD, 0.8), 0, 1.0, 0).rotation.z = PI / 2; for (const x of [-0.45, 0.45]) add(g, cyl(0.035, 0.035, 1.0, 6), mat(DARK_WOOD, 0.8), x, 0.5, 0);
    add(g, ball(0.26), fur, 0, 0.5, 0.05).scale.set(1, 1.1, 0.9); add(g, ball(0.2), pale, 0, 0.74, 0.1); add(g, ball(0.08), fur, 0, 0.74, 0.22).scale.set(1.6, 0.6, 1); for (const s of [-1, 1]) { add(g, ball(0.04), fur, s * 0.08, 0.76, 0.26).scale.set(1.6, 0.8, 0.6); add(g, ball(0.02), mat(INK, 0.3), s * 0.08, 0.76, 0.3); add(g, cyl(0.06, 0.06, 0.55, 8), fur, s * 0.2, 0.78, 0.0).rotation.z = s * 0.25; add(g, cyl(0.06, 0.06, 0.4, 8), fur, s * 0.14, 0.2, 0.08); }
    return flat(g, 1.1, 1.0); },
  rum: () => { const g = new THREE.Group(); const glass = mat([150, 90, 40], 0.3, { transparent: true, opacity: 0.95 });
    add(g, box(0.3, 0.72, 0.3, 0.06), glass, 0, 0.36, 0); add(g, cyl(0.06, 0.1, 0.16, 12), glass, 0, 0.8, 0); add(g, cyl(0.07, 0.07, 0.1, 12), mat(INK, 0.5), 0, 0.92, 0); add(g, box(0.24, 0.3, 0.02, 0.01), mat(CREAM, 0.7), 0, 0.4, 0.155);
    return flat(g, 0.97, 0.4); },
  saffron: () => { const l = jar([200, 60, 30], [200, 160, 90], 0.2, 0.26); add(l.group, box(0.18, 0.12, 0.02, 0.005), mat(CREAM, 0.7), 0, 0.14, 0.19); return l; },
  sandBottle: () => { const g = new THREE.Group(); const cs: RGB[] = [[214, 160, 90], [200, 120, 80], [226, 196, 150], [150, 94, 56], [240, 196, 80], [120, 80, 60]];   // 沙画瓶：一层层彩沙
    cs.forEach((c, i) => add(g, cyl(0.17, 0.17, 0.11, 16), mat(c, 0.9), 0, 0.06 + i * 0.11, 0)); add(g, cyl(0.19, 0.19, 0.72, 16), GLASS(), 0, 0.36, 0).castShadow = false; add(g, cyl(0.08, 0.19, 0.12, 16), GLASS(), 0, 0.78, 0).castShadow = false; add(g, cyl(0.07, 0.07, 0.1, 10), mat([180, 140, 100], 0.9), 0, 0.88, 0);
    return flat(g, 0.94, 0.4); },
};
const KNIT_GREY: RGB = [206, 200, 190];

/** 按物件 id 取模型；对不上就是一袋零食（颜色按名字定） */
export function souvenirModel(id: string | null, place: string, seed: number): Landmark {
  const mk = id ? M[id] : undefined;
  if (mk) return mk();
  const r = mulberry32(seed + [...place].reduce((n, ch) => n + ch.charCodeAt(0), 0));
  const hue = r.next(); const c = new THREE.Color().setHSL(hue, 0.5, 0.62), s = new THREE.Color().setHSL((hue + 0.12) % 1, 0.55, 0.8);
  const rgb = (x: THREE.Color): RGB => [Math.round(x.r * 255), Math.round(x.g * 255), Math.round(x.b * 255)];
  return bag(rgb(c), rgb(s));
}
export const SOUVENIR_MODEL_IDS = Object.keys(M);
