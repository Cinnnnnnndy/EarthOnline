/** 特色物件的补充（第八轮末，D88）：各国的第二、三样，30 样。仓库主人：「继续做一些建模景点和物品建模的补充。」
 *  做法和 souvenir-models.ts 一样：积木拼，每样不超过 5 种颜色，原点在底面中心、正面朝 +z；id 对应 shared/geo/souvenirs.ts 的登记。
 *  常用的几样（铁盒、罐子、瓶子、玩偶的身子）这里自己带一份，不从主文件拿——这个文件可以单独拷进别的仓库。 */
import * as THREE from "three";
import { type Maker, type RGB, type Landmark, mat, add, box, cyl, cone, ball } from "./landmark-kit.ts";

const PI = Math.PI;
const CREAM: RGB = [246, 240, 226], INK: RGB = [40, 44, 56], WOOD: RGB = [196, 150, 96], DARK_WOOD: RGB = [132, 90, 56], RED: RGB = [200, 48, 44], GOLD: RGB = [226, 172, 70], GREEN: RGB = [96, 150, 86];
const SILVER: RGB = [200, 206, 216], WHITE: RGB = [248, 246, 240], PINK: RGB = [244, 184, 196], TEAL: RGB = [96, 176, 170], BROWN: RGB = [150, 104, 66];
const GLASS = () => mat([226, 236, 244], 0.08, { transparent: true, opacity: 0.42, metalness: 0.05 });
const flat = (g: THREE.Group, top: number, footprint: number): Landmark => ({ group: g, top, footprint });
const torus = (r: number, t: number, arc = PI * 2, seg = 24) => new THREE.TorusGeometry(r, t, 8, seg, arc);

function tin(body: RGB, lid: RGB, label: RGB = CREAM, r = 0.42, h = 0.5): Landmark {
  const g = new THREE.Group(); add(g, cyl(r, r, h, 24), mat(body, 0.45, { metalness: 0.25 }), 0, h / 2, 0);
  add(g, cyl(r + 0.012, r + 0.012, h * 0.42, 24), mat(label, 0.7), 0, h * 0.45, 0);
  add(g, cyl(r + 0.03, r + 0.03, 0.08, 24), mat(lid, 0.4, { metalness: 0.3 }), 0, h + 0.03, 0);
  return flat(g, h + 0.08, r * 2 + 0.06);
}
function jar(content: RGB, lid: RGB, r = 0.36, h = 0.62): Landmark {
  const g = new THREE.Group(); add(g, cyl(r * 0.9, r * 0.84, h * 0.86, 20), mat(content, 0.5), 0, h * 0.43 + 0.02, 0);
  add(g, cyl(r, r * 0.92, h, 20), GLASS(), 0, h / 2, 0).castShadow = false;
  add(g, cyl(r * 0.78, r * 0.78, 0.14, 20), mat(lid, 0.5), 0, h + 0.06, 0);
  return flat(g, h + 0.14, r * 2);
}
function bottle(liquid: RGB, cap: RGB, h = 0.95): Landmark {
  const g = new THREE.Group(); const m = mat(liquid, 0.25, { transparent: true, opacity: 0.92 });
  add(g, cyl(0.26, 0.24, h * 0.6, 18), m, 0, h * 0.3, 0); add(g, cyl(0.1, 0.24, h * 0.18, 18), m, 0, h * 0.69, 0);
  add(g, cyl(0.1, 0.1, h * 0.18, 12), GLASS(), 0, h * 0.87, 0).castShadow = false; add(g, cyl(0.12, 0.12, 0.1, 12), mat(cap, 0.5), 0, h + 0.01, 0);
  add(g, box(0.3, 0.26, 0.03, 0.01), mat(CREAM, 0.7), 0, h * 0.3, 0.25);
  return flat(g, h + 0.06, 0.55);
}
function plushBody(fur: RGB, belly: RGB, earR = 0.08, earY = 0.9): THREE.Group {
  const g = new THREE.Group(); const f = mat(fur, 0.95), p = mat(belly, 0.9);
  add(g, ball(0.28), f, 0, 0.3, 0).scale.set(1, 1.05, 0.9); add(g, ball(0.2), p, 0, 0.26, 0.17).scale.set(0.8, 0.9, 0.5);
  add(g, ball(0.24), f, 0, 0.72, 0.02); for (const s of [-1, 1]) { add(g, ball(earR), f, s * 0.19, earY, 0); add(g, ball(0.1), f, s * 0.26, 0.14, 0.18).scale.set(1, 0.8, 1.3); add(g, ball(0.09), f, s * 0.3, 0.38, 0.06); }
  return g;
}
const eyes = (g: THREE.Group, y: number, z: number, dx = 0.08, r = 0.025) => { for (const s of [-1, 1]) add(g, ball(r), mat(INK, 0.3), s * dx, y, z); };
const plate = (g: THREE.Group, r = 0.55) => add(g, cyl(r, r * 0.9, 0.04, 28), mat(WHITE, 0.4), 0, 0.02, 0);

export const MORE_SOUVENIRS: Record<string, Maker> = {
  // ---- 亚洲
  omamori: () => { const g = new THREE.Group(); const b = add(g, box(0.5, 0.72, 0.16, 0.08), mat([196, 48, 60], 0.75), 0, 0.42, 0); b.rotation.x = -0.1;   // 御守：锦囊 + 顶上的绳结与流苏
    add(g, box(0.52, 0.12, 0.17, 0.02), mat(GOLD, 0.5), 0, 0.5, 0.0).rotation.x = -0.1; add(g, box(0.46, 0.1, 0.1, 0.04), mat([120, 28, 40], 0.7), 0, 0.8, -0.03);
    add(g, torus(0.1, 0.018, PI * 2, 16), mat(GOLD, 0.5), 0, 0.98, -0.02); add(g, cyl(0.03, 0.05, 0.16, 8), mat(GOLD, 0.6), 0.2, 0.6, 0.1);
    return flat(g, 1.08, 0.55); },
  gochujang: () => { const g = new THREE.Group(); add(g, cyl(0.4, 0.36, 0.5, 20), mat([204, 44, 40], 0.5), 0, 0.25, 0); add(g, cyl(0.42, 0.42, 0.1, 20), mat([150, 30, 30], 0.5), 0, 0.55, 0);
    add(g, box(0.4, 0.26, 0.03, 0.01), mat(CREAM, 0.7), 0, 0.26, 0.39); return flat(g, 0.6, 0.85); },
  mooncake: () => { const g = new THREE.Group(); plate(g, 0.5); const m = mat([196, 130, 70], 0.6);
    add(g, cyl(0.4, 0.42, 0.26, 24), m, 0, 0.17, 0); add(g, torus(0.28, 0.03, PI * 2, 24), mat([170, 104, 50], 0.6), 0, 0.3, 0).rotation.x = PI / 2;
    for (let i = 0; i < 8; i++) add(g, box(0.05, 0.03, 0.14, 0.01), mat([170, 104, 50], 0.6), Math.sin((i / 8) * PI * 2) * 0.17, 0.31, Math.cos((i / 8) * PI * 2) * 0.17, (i / 8) * PI * 2);
    add(g, ball(0.06), mat(GOLD, 0.5), 0, 0.32, 0); return flat(g, 0.36, 1.0); },
  thaiTea: () => tin([230, 120, 40], GOLD, [250, 232, 200], 0.36, 0.56),
  phin: () => { const g = new THREE.Group(); add(g, cyl(0.2, 0.17, 0.46, 16), mat([120, 70, 40], 0.4, { transparent: true, opacity: 0.9 }), 0, 0.25, 0);   // 滴滤咖啡：玻璃杯里深色的咖啡，杯口架着铝滤壶
    add(g, cyl(0.22, 0.2, 0.52, 16), GLASS(), 0, 0.27, 0).castShadow = false;
    const al = mat(SILVER, 0.35, { metalness: 0.6 }); add(g, cyl(0.26, 0.26, 0.03, 20), al, 0, 0.55, 0); add(g, cyl(0.2, 0.17, 0.28, 16), al, 0, 0.7, 0); add(g, cyl(0.21, 0.21, 0.03, 16), al, 0, 0.85, 0); add(g, ball(0.03), al, 0, 0.88, 0);
    return flat(g, 0.9, 0.55); },
  merlionFigure: () => { const g = new THREE.Group(); add(g, box(0.5, 0.14, 0.4, 0.03), mat([196, 192, 184], 0.9), 0, 0.07, 0); const w = mat(WHITE, 0.5);
    add(g, cyl(0.12, 0.2, 0.5, 14), w, 0, 0.39, 0); add(g, ball(0.17), w, 0, 0.7, 0.03); add(g, ball(0.2), w, 0, 0.7, -0.06).scale.set(1, 0.9, 0.6);
    add(g, box(0.08, 0.02, 0.14, 0.01), mat([150, 206, 234], 0.3), 0, 0.68, 0.26); add(g, box(0.16, 0.14, 0.05, 0.02), w, 0, 0.2, -0.22).rotation.x = -0.4;
    eyes(g, 0.72, 0.17, 0.06, 0.02); return flat(g, 0.9, 0.55); },
  paintedElephant: () => { const g = new THREE.Group(); const w = mat([226, 120, 140], 0.7);   // 彩绘小象：粉身子、金毯子、青色的小点
    add(g, ball(0.34), w, 0, 0.46, 0).scale.set(1.2, 0.95, 1); add(g, ball(0.24), w, 0.4, 0.6, 0); for (const s of [-1, 1]) add(g, ball(0.14), w, 0.38, 0.62, s * 0.22).scale.set(0.4, 1, 1);
    const trunk = add(g, cyl(0.06, 0.09, 0.5, 8), w, 0.62, 0.42, 0); trunk.rotation.z = 0.5; for (const [x, z] of [[-0.2, -0.14], [-0.2, 0.14], [0.2, -0.14], [0.2, 0.14]] as const) add(g, cyl(0.08, 0.09, 0.3, 8), w, x, 0.15, z);
    add(g, box(0.4, 0.04, 0.5, 0.01), mat(GOLD, 0.5), -0.05, 0.78, 0); for (let i = 0; i < 6; i++) add(g, ball(0.03), mat(TEAL, 0.6), -0.2 + (i % 3) * 0.15, 0.55 + Math.floor(i / 3) * 0.12, 0.3);
    eyes(g, 0.66, 0.0, 0, 0.0); for (const s of [-1, 1]) add(g, ball(0.025), mat(INK, 0.3), 0.56, 0.68, s * 0.12);
    return flat(g, 0.85, 1.0); },
  // ---- 欧洲
  croissant: () => { const g = new THREE.Group(); plate(g, 0.55); const m = mat([226, 160, 80], 0.6);
    for (let i = 0; i < 5; i++) { const a = -0.7 + i * 0.35; const r = i === 0 || i === 4 ? 0.1 : i === 2 ? 0.17 : 0.14; add(g, ball(r), m, Math.sin(a) * 0.42, 0.06 + r, Math.cos(a) * 0.42 - 0.3).scale.set(1, 0.9, 1.2); }
    return flat(g, 0.4, 1.0); },
  venetianMask: () => { const g = new THREE.Group(); add(g, cyl(0.02, 0.02, 0.7, 8), mat(DARK_WOOD, 0.6), 0.2, 0.35, -0.02).rotation.z = 0.2;   // 威尼斯面具：金面、两个眼洞、一根羽毛、手持的棍
    const f = add(g, ball(0.3), mat(GOLD, 0.35, { metalness: 0.3 }), 0, 0.72, 0); f.scale.set(1, 1.2, 0.45);
    for (const s of [-1, 1]) add(g, ball(0.07), mat(INK, 0.4), s * 0.12, 0.78, 0.12).scale.set(1.3, 0.8, 0.3);
    add(g, cone(0.06, 0.4, 8), mat([120, 70, 160], 0.7), 0.1, 1.18, -0.04).rotation.z = -0.3; add(g, ball(0.05), mat(TEAL, 0.6), 0, 0.95, 0.12);
    return flat(g, 1.3, 0.6); },
  phoneBox: () => { const g = new THREE.Group(); const r = mat([200, 40, 40], 0.5), w = mat([236, 240, 244], 0.3, { transparent: true, opacity: 0.6 });   // 红色电话亭
    add(g, box(0.5, 0.95, 0.5, 0.03), r, 0, 0.475, 0); add(g, box(0.52, 0.08, 0.52, 0.02), r, 0, 0.99, 0); add(g, ball(0.26), r, 0, 1.0, 0).scale.set(1, 0.35, 1);
    for (const [x, z, ry] of [[0, 0.251, 0], [0, -0.251, 0], [0.251, 0, PI / 2], [-0.251, 0, PI / 2]] as const) { const p = add(g, box(0.36, 0.6, 0.02, 0.005), w, x, 0.5, z, ry); p.castShadow = false; }
    add(g, box(0.36, 0.08, 0.01, 0.005), mat(CREAM, 0.7), 0, 0.86, 0.26); return flat(g, 1.12, 0.6); },
  cuckooClock: () => { const g = new THREE.Group(); const w = mat(DARK_WOOD, 0.7);   // 布谷鸟钟：小屋、钟面、两个松果坠
    add(g, box(0.5, 0.5, 0.26, 0.02), w, 0, 0.55, 0); add(g, cone(0.42, 0.3, 4), mat([96, 64, 40], 0.7), 0, 0.95, 0).rotation.y = PI / 4;
    add(g, cyl(0.15, 0.15, 0.03, 20), mat(CREAM, 0.7), 0, 0.5, 0.14).rotation.x = PI / 2; add(g, box(0.03, 0.1, 0.01, 0.003), mat(INK, 0.5), 0, 0.54, 0.16); add(g, box(0.08, 0.025, 0.01, 0.003), mat(INK, 0.5), 0.03, 0.5, 0.16);
    add(g, box(0.12, 0.1, 0.06, 0.01), mat(INK, 0.6), 0, 0.74, 0.14); add(g, ball(0.03), mat(GOLD, 0.5), 0, 0.74, 0.17);
    for (const s of [-1, 1]) { add(g, cyl(0.006, 0.006, 0.3, 4), mat(GOLD, 0.5), s * 0.12, 0.15, 0.05); add(g, cone(0.05, 0.14, 8), mat([110, 70, 40], 0.8), s * 0.12, 0.07, 0.05).rotation.x = PI; }
    return flat(g, 1.1, 0.6); },
  swissKnife: () => { const g = new THREE.Group(); const b = add(g, box(0.9, 0.22, 0.12, 0.05), mat([204, 32, 40], 0.4), 0, 0.11, 0);   // 军刀：红柄、白十字、一片打开的刀
    void b; add(g, box(0.05, 0.14, 0.01, 0.005), mat(WHITE, 0.5), 0.2, 0.12, 0.065); add(g, box(0.14, 0.05, 0.01, 0.005), mat(WHITE, 0.5), 0.2, 0.12, 0.065);
    const blade = add(g, box(0.6, 0.12, 0.02, 0.01), mat(SILVER, 0.25, { metalness: 0.7 }), -0.6, 0.3, 0); blade.rotation.z = 0.5; blade.position.set(-0.68, 0.28, 0);
    return flat(g, 0.5, 1.2); },
  cheeseWheel: () => { const g = new THREE.Group(); add(g, cyl(0.46, 0.46, 0.26, 28), mat([200, 50, 50], 0.5), 0, 0.13, 0);   // 奶酪轮：红蜡皮，切出一块黄的
    const wedge = add(g, new THREE.CylinderGeometry(0.46, 0.46, 0.27, 28, 1, false, 0, PI / 3.5), mat([240, 200, 90], 0.7), 0, 0.135, 0); wedge.rotation.y = 0.3;
    add(g, new THREE.CylinderGeometry(0.44, 0.44, 0.25, 28, 1, false, 0, PI / 3.5), mat([240, 200, 90], 0.7), 0.62, 0.125, 0.2).rotation.y = 2.2;
    return flat(g, 0.3, 1.2); },
  oliveOil: () => bottle([132, 160, 60], GOLD, 0.98),
  pastelDeNata: () => { const g = new THREE.Group(); add(g, box(1.0, 0.16, 0.42, 0.03), mat([214, 196, 160], 0.8), 0, 0.08, 0);   // 蛋挞一盒三个
    for (let i = 0; i < 3; i++) { const x = -0.3 + i * 0.3; add(g, cyl(0.13, 0.1, 0.12, 14), mat([226, 196, 130], 0.7), x, 0.22, 0); add(g, cyl(0.1, 0.1, 0.04, 14), mat([240, 190, 90], 0.5), x, 0.3, 0); add(g, ball(0.03), mat([120, 70, 40], 0.7), x + 0.03, 0.32, 0.02).scale.set(1, 0.4, 1); }
    return flat(g, 0.36, 1.05); },
  olives: () => jar([110, 140, 60], [60, 90, 50], 0.3, 0.6),
  sacherTorte: () => { const g = new THREE.Group(); plate(g, 0.55); const c = mat([70, 40, 30], 0.45);
    add(g, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 28, 1, false, 0.5, PI * 1.84), c, 0, 0.19, 0); add(g, ball(0.08), mat(WHITE, 0.6), 0.1, 0.4, 0.2).scale.set(1, 0.7, 1);
    add(g, cyl(0.1, 0.1, 0.02, 16), mat([120, 70, 50], 0.5), -0.1, 0.35, -0.1); return flat(g, 0.45, 1.1); },
  crystalGlass: () => { const g = new THREE.Group(); const gl = GLASS();   // 波西米亚水晶杯：高脚、宽口、杯身有几道棱
    add(g, cyl(0.24, 0.24, 0.03, 20), gl, 0, 0.015, 0); add(g, cyl(0.03, 0.05, 0.4, 10), gl, 0, 0.22, 0); add(g, cyl(0.24, 0.12, 0.42, 20), gl, 0, 0.63, 0);
    for (let i = 0; i < 8; i++) add(g, box(0.02, 0.3, 0.015, 0.005), mat([180, 150, 60], 0.3, { metalness: 0.3 }), Math.sin((i / 8) * PI * 2) * 0.2, 0.62, Math.cos((i / 8) * PI * 2) * 0.2, (i / 8) * PI * 2);
    g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; }); return flat(g, 0.86, 0.5); },
  ushanka: () => { const g = new THREE.Group(); const fur = mat([120, 110, 100], 1), cloth = mat([60, 70, 100], 0.85);   // 乌沙帽
    add(g, ball(0.4), cloth, 0, 0.3, 0).scale.set(1, 0.7, 1); add(g, torus(0.4, 0.1, PI * 2, 24), fur, 0, 0.26, 0).rotation.x = PI / 2;
    for (const s of [-1, 1]) add(g, ball(0.16), fur, s * 0.42, 0.14, 0).scale.set(0.5, 1.3, 1); add(g, box(0.34, 0.16, 0.08, 0.03), fur, 0, 0.4, 0.34);
    return flat(g, 0.6, 1.0); },
  cezve: () => { const g = new THREE.Group(); const cu = mat([196, 120, 70], 0.35, { metalness: 0.6 });   // 土耳其咖啡壶：铜，长柄
    add(g, cyl(0.18, 0.26, 0.4, 20), cu, 0, 0.2, 0); add(g, cyl(0.22, 0.18, 0.08, 20), cu, 0, 0.44, 0); add(g, box(0.5, 0.03, 0.04, 0.01), mat(DARK_WOOD, 0.7), 0.42, 0.42, 0);
    return flat(g, 0.5, 0.9); },
  // ---- 美洲
  sugarSkull: () => { const g = new THREE.Group(); const w = mat(WHITE, 0.6);   // 糖骷髅：白骷髅，粉、青的小花
    add(g, ball(0.32), w, 0, 0.42, 0).scale.set(1, 1.1, 0.95); add(g, box(0.36, 0.2, 0.28, 0.06), w, 0, 0.14, 0.04);
    for (const s of [-1, 1]) { add(g, ball(0.09), mat(INK, 0.5), s * 0.13, 0.48, 0.24).scale.set(1, 1.1, 0.5); add(g, torus(0.1, 0.02, PI * 2, 16), mat(PINK, 0.6), s * 0.13, 0.48, 0.27); }
    add(g, ball(0.04), mat(INK, 0.5), 0, 0.34, 0.3).scale.set(1, 1.4, 0.5); for (let i = 0; i < 5; i++) add(g, ball(0.035), mat(i % 2 ? TEAL : PINK, 0.6), -0.2 + i * 0.1, 0.68 - Math.abs(i - 2) * 0.04, 0.2);
    return flat(g, 0.78, 0.7); },
  moose: () => { const g = plushBody([120, 84, 56], [196, 160, 120]); const a = mat([214, 190, 140], 0.8);   // 驼鹿玩偶：扁角
    for (const s of [-1, 1]) { add(g, box(0.22, 0.14, 0.03, 0.03), a, s * 0.28, 1.0, -0.02).rotation.z = -s * 0.5; add(g, box(0.1, 0.08, 0.03, 0.02), a, s * 0.36, 1.1, -0.02); }
    add(g, ball(0.11), mat([140, 100, 70], 0.9), 0, 0.64, 0.2).scale.set(1.2, 0.8, 1); eyes(g, 0.78, 0.2); return flat(g, 1.15, 0.8); },
  libertyFigure: () => { const g = new THREE.Group(); const t = mat([120, 180, 160], 0.6);   // 自由女神摆件：青绿铜色，火炬金
    add(g, box(0.4, 0.2, 0.4, 0.03), mat([180, 174, 160], 0.9), 0, 0.1, 0); add(g, cyl(0.12, 0.2, 0.6, 12), t, 0, 0.5, 0); add(g, ball(0.12), t, 0, 0.9, 0);
    for (let i = 0; i < 7; i++) add(g, cone(0.02, 0.12, 4), t, Math.sin((i / 7) * PI - PI / 2) * 0.13, 1.02, Math.cos((i / 7) * PI - PI / 2) * 0.1 - 0.02);
    const arm = add(g, cyl(0.03, 0.035, 0.45, 8), t, 0.16, 1.05, 0.02); arm.rotation.z = -0.25; add(g, ball(0.06), mat(GOLD, 0.4, { emissive: new THREE.Color(0.6, 0.4, 0.1), emissiveIntensity: 0.6 }), 0.22, 1.32, 0.02);
    add(g, box(0.16, 0.2, 0.04, 0.01), t, -0.16, 0.62, 0.1).rotation.z = 0.2; return flat(g, 1.4, 0.5); },
  football: () => { const g = new THREE.Group(); add(g, ball(0.32), mat(WHITE, 0.55), 0, 0.32, 0);
    const pts: [number, number, number][] = [[0, 1, 0], [0.9, 0.3, 0.3], [-0.9, 0.3, 0.3], [0.3, -0.5, 0.8], [-0.3, -0.5, -0.8], [0.5, 0.3, -0.8], [-0.5, 0.3, -0.8]];
    for (const [x, y, z] of pts) { const p = add(g, ball(0.09), mat(INK, 0.6), x * 0.3, 0.32 + y * 0.3, z * 0.3); p.scale.set(1, 1, 0.5); p.lookAt(0, 0.32, 0); }
    return flat(g, 0.64, 0.66); },
  chullo: () => { const g = new THREE.Group(); const c = mat([200, 60, 60], 0.95);   // 安第斯毛帽：条纹、护耳、流苏
    add(g, ball(0.36), c, 0, 0.3, 0).scale.set(1, 0.9, 1); for (const [y, col] of [[0.22, GOLD], [0.34, GREEN], [0.46, GOLD]] as [number, RGB][]) add(g, torus(0.35 * Math.sqrt(1 - ((y - 0.3) / 0.33) ** 2) + 0.01, 0.03, PI * 2, 24), mat(col, 0.95), 0, y, 0).rotation.x = PI / 2;
    for (const s of [-1, 1]) { add(g, box(0.16, 0.24, 0.08, 0.03), c, s * 0.3, 0.1, 0.02); add(g, cyl(0.01, 0.01, 0.18, 4), mat(GOLD, 0.9), s * 0.3, -0.05, 0.02); add(g, ball(0.04), mat(GOLD, 0.9), s * 0.3, -0.14, 0.02); }
    add(g, ball(0.06), mat(GOLD, 0.9), 0, 0.66, 0); g.position.y = 0.16; const w = new THREE.Group(); w.add(g); return flat(w, 0.9, 0.9); },
  // ---- 非洲、大洋洲、其他
  bastet: () => { const g = new THREE.Group(); const k = mat([30, 30, 36], 0.4);   // 猫神像：黑猫端坐，金项圈
    add(g, box(0.44, 0.12, 0.5, 0.02), mat([196, 160, 90], 0.6), 0, 0.06, 0); add(g, ball(0.2), k, 0, 0.4, 0).scale.set(1, 1.5, 0.9); add(g, ball(0.16), k, 0, 0.82, 0.04);
    for (const s of [-1, 1]) add(g, cone(0.06, 0.14, 6), k, s * 0.1, 0.98, 0.02); add(g, torus(0.12, 0.025, PI * 2, 16), mat(GOLD, 0.4, { metalness: 0.4 }), 0, 0.66, 0.02).rotation.x = PI / 2;
    add(g, ball(0.05), k, 0.16, 0.14, 0.14).scale.set(1, 0.6, 2.4); for (const s of [-1, 1]) add(g, ball(0.02), mat(GOLD, 0.3), s * 0.06, 0.84, 0.17);
    return flat(g, 1.05, 0.55); },
  mintTeapot: () => { const g = new THREE.Group(); const sv = mat(SILVER, 0.3, { metalness: 0.7 });   // 薄荷茶壶：银壶、长嘴、一只小玻璃杯
    add(g, ball(0.3), sv, 0, 0.32, 0).scale.set(1, 0.8, 1); add(g, cyl(0.1, 0.14, 0.1, 16), sv, 0, 0.58, 0); add(g, cone(0.05, 0.12, 8), sv, 0, 0.68, 0);
    const sp = add(g, cyl(0.03, 0.05, 0.5, 8), sv, 0.34, 0.5, 0); sp.rotation.z = -0.7; add(g, torus(0.14, 0.025, PI, 16), sv, -0.3, 0.4, 0).rotation.z = PI / 2;
    add(g, cyl(0.07, 0.06, 0.2, 12), mat([110, 170, 80], 0.3, { transparent: true, opacity: 0.8 }), 0.55, 0.1, 0.25); return flat(g, 0.75, 1.0); },
  boomerang: () => { const g = new THREE.Group(); const w = mat(WOOD, 0.7);
    for (const s of [-1, 1]) { const b = add(g, box(0.55, 0.05, 0.14, 0.03), w, s * 0.22, 0.03, 0.1); b.rotation.y = s * 0.55; }
    for (let i = 0; i < 6; i++) add(g, ball(0.025), mat(i % 2 ? [200, 60, 50] : [60, 60, 70], 0.7), -0.4 + i * 0.16, 0.06, 0.2 - Math.abs(i - 2.5) * 0.07);
    return flat(g, 0.1, 1.1); },
  pounamu: () => { const g = new THREE.Group(); const j = mat([60, 140, 100], 0.35, { transparent: true, opacity: 0.95 });   // 绿玉吊坠：鱼钩形，挂在绳上
    add(g, cyl(0.012, 0.012, 0.6, 6), mat([60, 50, 44], 0.8), 0, 0.72, 0); add(g, torus(0.22, 0.06, PI * 1.5, 24), j, 0, 0.32, 0).rotation.z = PI * 0.6; add(g, ball(0.06), j, 0.06, 0.52, 0);
    add(g, box(0.5, 0.06, 0.4, 0.02), mat([80, 80, 90], 0.7), 0, 0.03, 0); return flat(g, 1.0, 0.55); },
  lavaSalt: () => jar([50, 48, 56], [120, 110, 100], 0.3, 0.5),
  // ---- 仓库主人：「我喜欢海豹还有海獭。还有 capybara。」（D95）：三只毛绒玩偶，和角色里的三只同一个样子
  capybaraPlush: () => {   // 水豚玩偶（巴西）：趴着的一条面包，方方的大鼻口，头顶一颗柚子（五色：毛、鼻口、墨、柚子、叶）
    const g = new THREE.Group(); const fur = mat([184, 136, 86], 0.95), snout = mat([150, 108, 66], 0.95);
    add(g, ball(0.34), fur, 0, 0.3, -0.06).scale.set(1.15, 0.85, 1.1);
    add(g, ball(0.25), fur, 0, 0.5, 0.24).scale.set(0.95, 0.85, 1.15); add(g, ball(0.15), snout, 0, 0.45, 0.44).scale.set(1.25, 0.95, 0.8);
    for (const s of [-1, 1]) { add(g, ball(0.03), mat(INK, 0.3), s * 0.05, 0.47, 0.56); add(g, ball(0.028), mat(INK, 0.3), s * 0.13, 0.6, 0.42); add(g, ball(0.05), snout, s * 0.15, 0.7, 0.16).scale.set(1, 0.8, 0.6); }
    for (const [x, z] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.28], [0.2, -0.28]]) add(g, ball(0.08), snout, x, 0.06, z).scale.set(1, 0.7, 1.2);
    add(g, ball(0.1), mat([246, 192, 64], 0.6), 0.02, 0.8, 0.2).scale.set(1, 0.88, 1); add(g, box(0.08, 0.015, 0.04, 0.01), mat(GREEN, 0.8), 0.06, 0.9, 0.2).rotation.z = 0.3;
    return flat(g, 0.95, 0.85);
  },
  seaOtterPlush: () => {   // 海獭玩偶（美国加州海岸）：坐着，浅色的脸，胸前抱着一只蛤蜊（四色：毛、脸 / 蛤蜊、墨、腮红）
    const g = new THREE.Group(); const fur = mat([128, 88, 58], 0.95), face = mat([226, 204, 172], 0.9);
    add(g, ball(0.3), fur, 0, 0.32, 0).scale.set(1, 1.15, 0.9); add(g, ball(0.25), fur, 0, 0.78, 0.02);
    add(g, ball(0.18), face, 0, 0.74, 0.14).scale.set(1.2, 0.9, 0.7); add(g, ball(0.035), mat(INK, 0.3), 0, 0.76, 0.27).scale.set(1.3, 0.9, 0.8);
    eyes(g, 0.84, 0.22, 0.09); for (const s of [-1, 1]) { add(g, ball(0.045), mat(PINK, 0.9), s * 0.15, 0.72, 0.22).scale.set(1, 0.7, 0.5); add(g, ball(0.06), fur, s * 0.21, 0.98, 0); }
    const clam = add(g, ball(0.13), face, 0, 0.42, 0.27); clam.scale.set(1.2, 0.55, 0.9); clam.rotation.x = -0.5;
    for (const s of [-1, 1]) { add(g, ball(0.08), fur, s * 0.14, 0.44, 0.26).scale.set(0.9, 0.7, 1); add(g, ball(0.09), fur, s * 0.16, 0.06, 0.12).scale.set(1, 0.6, 1.4); }
    return flat(g, 1.05, 0.7);
  },
  sealPlush: () => {   // 海豹玩偶（加拿大东岸）：趴着的一条，银灰、一身斑点、大黑眼睛、小鳍（四色：银、斑点、墨、腮红）
    const g = new THREE.Group(); const fur = mat([214, 222, 232], 0.95), spot = mat([156, 166, 184], 0.95);
    add(g, ball(0.3), fur, 0, 0.26, -0.08).scale.set(0.95, 0.85, 1.55); add(g, ball(0.24), fur, 0, 0.38, 0.32);
    eyes(g, 0.44, 0.52, 0.1, 0.04); add(g, ball(0.035), mat(INK, 0.3), 0, 0.36, 0.56).scale.set(1.3, 0.9, 0.8);
    for (const s of [-1, 1]) { add(g, ball(0.045), mat(PINK, 0.9), s * 0.16, 0.34, 0.5).scale.set(1, 0.7, 0.5); const f = add(g, ball(0.08), fur, s * 0.3, 0.1, 0.18); f.scale.set(1.4, 0.4, 0.8); f.rotation.y = -s * 0.5; }
    for (const s of [-1, 1]) { const t = add(g, ball(0.08), fur, s * 0.08, 0.1, -0.56); t.scale.set(1.3, 0.35, 1); t.rotation.y = s * 0.6; }
    for (const [x, y, z] of [[0.14, 0.45, -0.1], [-0.18, 0.42, -0.25], [0.05, 0.5, -0.32], [-0.1, 0.5, 0.05], [0.2, 0.36, -0.42], [-0.06, 0.6, 0.3]] as [number, number, number][]) add(g, ball(0.04), spot, x, y, z).scale.set(1, 0.4, 1);
    return flat(g, 0.7, 0.8);
  },
};
export const MORE_SOUVENIR_IDS = Object.keys(MORE_SOUVENIRS);
