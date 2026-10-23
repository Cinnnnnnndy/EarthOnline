/** 「让 AI 装箱」加进去的那几样（第八轮末，D79 / D80）：保温杯、墨镜、相机、登山鞋、游泳圈、纸地图、望远镜、围巾、折叠伞、小玩偶、
 *  遮阳帽、手套、充电宝、耳机、小说、速写本、旅行枕、防晒霜、手电筒、水壶。
 *  和特色物件一样用 landmark-kit 的积木拼：原点在地面中心，+y 向上，正面朝 +z，自然高度 0.4～1.0；每样不超过 5 种颜色。 */
import * as THREE from "three";
import { type Landmark, type RGB, C, mat, add, box, cyl, ball } from "./landmark-kit.ts";
import type { ExtraKind } from "../planner/protocol.ts";

const PI = Math.PI;
const INK: RGB = [40, 44, 56], CREAM: RGB = [246, 240, 226], INDIGO: RGB = [74, 95, 176], KNIT: RGB = [242, 236, 224], LEATHER: RGB = [112, 80, 62], CORAL: RGB = [232, 120, 48], RED: RGB = [196, 62, 52], HONEY: RGB = [196, 150, 96], GOLD: RGB = [226, 172, 70];

const M: Record<ExtraKind, () => Landmark> = {
  thermos: () => { const g = new THREE.Group(); add(g, cyl(0.2, 0.2, 0.8, 20), mat(INDIGO, 0.35, { metalness: 0.3 }), 0, 0.4, 0);   // 保温杯：靛蓝瓶身、墨色杯盖、奶油色带
    add(g, cyl(0.21, 0.21, 0.16, 20), mat(CREAM, 0.6), 0, 0.3, 0); add(g, cyl(0.17, 0.2, 0.14, 20), mat(INK, 0.4), 0, 0.87, 0); add(g, cyl(0.1, 0.1, 0.06, 12), mat(INK, 0.4), 0, 0.97, 0);
    return { group: g, top: 1.0, footprint: 0.42 }; },
  sunglasses: () => { const g = new THREE.Group(); const lens = mat([44, 48, 60], 0.15, { metalness: 0.2 }), rim = mat(INK, 0.4);   // 墨镜：平放，镜片略翘
    for (const s of [-1, 1]) { const l = add(g, cyl(0.24, 0.24, 0.04, 20), lens, s * 0.3, 0.08, 0); l.rotation.x = PI / 2 - 0.35; const r = add(g, new THREE.TorusGeometry(0.25, 0.025, 8, 24), rim, s * 0.3, 0.08, 0); r.rotation.x = PI / 2 - 0.35; }
    add(g, box(0.16, 0.04, 0.04, 0.01), rim, 0, 0.12, 0.02); for (const s of [-1, 1]) add(g, box(0.04, 0.04, 0.6, 0.01), rim, s * 0.54, 0.14, -0.28);
    return { group: g, top: 0.3, footprint: 1.1 }; },
  camera: () => { const g = new THREE.Group(); add(g, box(0.9, 0.52, 0.42, 0.06), mat(INK, 0.5), 0, 0.26, 0);   // 相机：墨色机身、奶油色饰皮、镜头、快门与肩带扣
    add(g, box(0.92, 0.22, 0.44, 0.03), mat(CREAM, 0.7), 0, 0.26, 0);
    add(g, cyl(0.2, 0.2, 0.22, 24), mat([60, 64, 76], 0.4), 0, 0.26, 0.3).rotation.x = PI / 2; add(g, cyl(0.14, 0.14, 0.03, 24), mat([30, 40, 70], 0.1, { metalness: 0.3 }), 0, 0.26, 0.42).rotation.x = PI / 2;
    add(g, cyl(0.07, 0.07, 0.06, 12), mat([200, 206, 216], 0.3, { metalness: 0.6 }), 0.3, 0.55, 0); add(g, box(0.24, 0.12, 0.2, 0.03), mat(INK, 0.5), -0.1, 0.56, -0.05);
    return { group: g, top: 0.62, footprint: 0.95 }; },
  boots: () => { const g = new THREE.Group(); const leather = mat(LEATHER, 0.75), sole = mat([62, 50, 46], 0.9), cuff = mat(KNIT, 0.95);   // 登山鞋：一双
    for (const s of [-1, 1]) { const x = s * 0.22; add(g, box(0.3, 0.1, 0.62, 0.03), sole, x, 0.05, 0.04); add(g, box(0.28, 0.42, 0.34, 0.08), leather, x, 0.3, -0.1);
      const toe = add(g, ball(0.15), leather, x, 0.2, 0.2); toe.scale.set(0.95, 0.8, 1.2); add(g, box(0.3, 0.1, 0.36, 0.04), cuff, x, 0.52, -0.1); add(g, box(0.04, 0.3, 0.02, 0.01), mat(RED, 0.6), x, 0.3, 0.08); }
    return { group: g, top: 0.58, footprint: 0.75 }; },
  swimRing: () => { const g = new THREE.Group(); const ring = add(g, new THREE.TorusGeometry(0.44, 0.17, 14, 36), mat(CORAL, 0.55), 0, 0.17, 0); ring.rotation.x = PI / 2;   // 游泳圈：珊瑚色、四段奶白
    for (let i = 0; i < 4; i++) { const seg = add(g, new THREE.TorusGeometry(0.44, 0.175, 14, 10, 0.5), mat(CREAM, 0.6), 0, 0.17, 0); seg.rotation.x = PI / 2; seg.rotation.z = i * (PI / 2) + 0.3; }
    return { group: g, top: 0.35, footprint: 1.25 }; },
  roadmap: () => { const g = new THREE.Group(); const paper = mat(CREAM, 0.85), road = mat(RED, 0.6), sea = mat([150, 196, 224], 0.7);   // 纸地图：折成三折，立着像屏风
    for (let i = 0; i < 3; i++) { const p = new THREE.Group(); p.position.set((i - 1) * 0.36, 0, (i % 2 ? -0.1 : 0.1)); p.rotation.y = (i % 2 ? -1 : 1) * 0.5; g.add(p);
      add(p, box(0.4, 0.62, 0.02, 0.005), paper, 0, 0.31, 0); add(p, box(0.26, 0.16, 0.022, 0.005), sea, -0.04, 0.42, 0.001); add(p, box(0.03, 0.4, 0.024, 0.005), road, 0.08 - i * 0.05, 0.3, 0.002).rotation.z = 0.3 - i * 0.2; }
    return { group: g, top: 0.63, footprint: 1.1 }; },
  binoculars: () => { const g = new THREE.Group(); const body = mat(INK, 0.5), glass = mat([30, 40, 70], 0.1, { metalness: 0.3 });   // 望远镜：竖着放
    for (const s of [-1, 1]) { add(g, cyl(0.15, 0.13, 0.62, 18), body, s * 0.17, 0.31, 0); add(g, cyl(0.13, 0.13, 0.02, 18), glass, s * 0.17, 0.63, 0); add(g, cyl(0.09, 0.09, 0.08, 14), mat([70, 74, 86], 0.6), s * 0.17, 0.04, 0); }
    add(g, box(0.14, 0.14, 0.2, 0.03), body, 0, 0.42, 0); add(g, box(0.5, 0.05, 0.06, 0.01), mat(HONEY, 0.7), 0, 0.5, -0.12);
    return { group: g, top: 0.65, footprint: 0.65 }; },
  scarf: () => { const g = new THREE.Group(); const knit = mat(KNIT, 0.95), stripe = mat(RED, 0.8);   // 围巾：盘成一圈，一头搭出来
    const coil = add(g, new THREE.TorusGeometry(0.34, 0.13, 12, 32), knit, 0, 0.13, 0); coil.rotation.x = PI / 2;
    const tail = add(g, box(0.26, 0.1, 0.5, 0.04), knit, 0.3, 0.06, 0.42); tail.rotation.y = -0.3; add(g, box(0.27, 0.11, 0.06, 0.01), stripe, 0.33, 0.06, 0.52).rotation.y = -0.3;
    for (let i = 0; i < 3; i++) add(g, box(0.02, 0.1, 0.03, 0.005), knit, 0.2 + i * 0.09, 0.05, 0.72);
    return { group: g, top: 0.27, footprint: 1.0 }; },
  umbrella: () => { const g = new THREE.Group(); const u = new THREE.Group(); u.rotation.z = PI / 2 - 0.12; u.position.set(0, 0.1, 0); g.add(u);   // 折叠伞：收着，斜躺
    add(u, cyl(0.1, 0.1, 0.8, 12), mat(RED, 0.6), 0, 0.4, 0); add(u, cyl(0.105, 0.105, 0.08, 12), mat(INK, 0.5), 0, 0.36, 0); add(u, cyl(0.06, 0.06, 0.12, 10), mat(INK, 0.5), 0, 0.86, 0);
    add(u, cyl(0.06, 0.06, 0.16, 10), mat(HONEY, 0.6), 0, -0.08, 0); add(u, cyl(0.03, 0.03, 0.08, 8), mat([200, 206, 216], 0.3, { metalness: 0.6 }), 0, 0.96, 0);
    return { group: g, top: 0.22, footprint: 1.1 }; },
  plush: () => { const g = new THREE.Group(); const fur = mat(HONEY, 0.95), pale = mat(CREAM, 0.9), dark = mat(INK, 0.4);   // 小玩偶：坐着的小熊
    const body = add(g, ball(0.28), fur, 0, 0.3, 0); body.scale.set(1, 1.05, 0.9); add(g, ball(0.2), pale, 0, 0.26, 0.17).scale.set(0.8, 0.9, 0.5);
    add(g, ball(0.24), fur, 0, 0.72, 0.02); for (const s of [-1, 1]) { add(g, ball(0.08), fur, s * 0.19, 0.9, 0); add(g, ball(0.045), pale, s * 0.19, 0.9, 0.04); add(g, ball(0.025), dark, s * 0.08, 0.76, 0.21); }
    add(g, ball(0.1), pale, 0, 0.66, 0.2).scale.set(1, 0.8, 0.7); add(g, ball(0.035), dark, 0, 0.69, 0.28);
    for (const s of [-1, 1]) { add(g, ball(0.1), fur, s * 0.26, 0.14, 0.18).scale.set(1, 0.8, 1.3); add(g, ball(0.09), fur, s * 0.3, 0.38, 0.06); }
    return { group: g, top: 0.98, footprint: 0.62 }; },
  hat: () => { const g = new THREE.Group(); const straw = mat([228, 204, 140], 0.85);   // 遮阳帽：宽檐草帽，一条墨色帽带
    add(g, cyl(0.62, 0.56, 0.05, 32), straw, 0, 0.05, 0); add(g, ball(0.34), straw, 0, 0.08, 0).scale.set(1, 0.7, 1); add(g, cyl(0.32, 0.34, 0.08, 24), mat(INK, 0.6), 0, 0.12, 0);
    return { group: g, top: 0.34, footprint: 1.25 }; },
  mittens: () => { const g = new THREE.Group(); const knit = mat(KNIT, 0.95), cuff = mat(RED, 0.9);   // 一双连指手套，叠在一起
    for (const s of [-1, 1]) { const m = new THREE.Group(); m.position.set(s * 0.18, 0.08 + (s > 0 ? 0.12 : 0), 0); m.rotation.y = s * 0.3; m.rotation.z = s * 0.1; g.add(m);
      add(m, box(0.34, 0.16, 0.5, 0.08), knit, 0, 0, 0); add(m, ball(0.1), knit, s * 0.2, 0.02, 0.1); add(m, box(0.36, 0.17, 0.14, 0.04), cuff, 0, 0, -0.3); }
    return { group: g, top: 0.36, footprint: 0.8 }; },
  powerbank: () => { const g = new THREE.Group(); add(g, box(0.72, 0.16, 0.36, 0.05), mat(INK, 0.4, { metalness: 0.2 }), 0, 0.08, 0); for (let i = 0; i < 4; i++) add(g, ball(0.02), mat(i < 3 ? [120, 200, 120] : [90, 94, 110], 0.3), -0.24 + i * 0.08, 0.17, 0.1);
    const cable = add(g, new THREE.TorusGeometry(0.2, 0.02, 6, 24, PI * 1.5), mat(CREAM, 0.6), 0.2, 0.03, 0.28); cable.rotation.x = PI / 2; return { group: g, top: 0.2, footprint: 0.8 }; },
  headphones: () => { const g = new THREE.Group(); const band = add(g, new THREE.TorusGeometry(0.36, 0.035, 8, 24, PI), mat(INK, 0.5), 0, 0.4, 0); band.rotation.z = 0; band.rotation.y = 0;   // 头戴耳机，立着
    for (const s of [-1, 1]) { add(g, cyl(0.14, 0.14, 0.1, 20), mat(INK, 0.5), s * 0.36, 0.38, 0).rotation.z = PI / 2; add(g, cyl(0.1, 0.1, 0.04, 20), mat(INDIGO, 0.7), s * 0.42, 0.38, 0).rotation.z = PI / 2; }
    add(g, box(0.3, 0.05, 0.06, 0.01), mat(CREAM, 0.6), 0, 0.77, 0); return { group: g, top: 0.8, footprint: 0.95 }; },
  book: () => { const g = new THREE.Group(); const b = new THREE.Group(); b.rotation.z = -0.08; g.add(b);   // 一本小说：平躺，封面一道色带，旁边露出书页
    add(b, box(0.7, 0.14, 0.95, 0.02), mat(INDIGO, 0.6), 0, 0.07, 0); add(b, box(0.66, 0.1, 0.9, 0.01), mat(CREAM, 0.9), 0.04, 0.07, 0); add(b, box(0.7, 0.145, 0.16, 0.01), mat(CORAL, 0.6), 0, 0.07, 0.3); add(b, box(0.08, 0.02, 0.3, 0.005), mat(RED, 0.6), 0.2, 0.15, -0.3);
    return { group: g, top: 0.18, footprint: 1.0 }; },
  sketchbook: () => { const g = new THREE.Group(); add(g, box(0.8, 0.1, 0.62, 0.02), mat([120, 92, 60], 0.8), 0, 0.05, 0); add(g, box(0.76, 0.06, 0.58, 0.01), mat(CREAM, 0.9), 0.02, 0.1, 0);   // 速写本：牛皮封面、一圈线圈、两支笔
    for (let i = 0; i < 7; i++) add(g, new THREE.TorusGeometry(0.05, 0.01, 6, 12), mat([200, 206, 216], 0.3, { metalness: 0.6 }), -0.36 + i * 0.12, 0.08, -0.3).rotation.y = PI / 2;
    add(g, cyl(0.025, 0.025, 0.7, 8), mat(GOLD, 0.5), 0.1, 0.16, 0.14).rotation.z = PI / 2; add(g, cyl(0.025, 0.025, 0.6, 8), mat(INK, 0.5), -0.05, 0.16, 0.26).rotation.z = PI / 2 + 0.1;
    return { group: g, top: 0.2, footprint: 0.85 }; },
  neckPillow: () => { const g = new THREE.Group(); const p = add(g, new THREE.TorusGeometry(0.32, 0.15, 14, 32, PI * 1.6), mat([134, 160, 138], 0.95), 0, 0.15, 0); p.rotation.x = PI / 2; p.rotation.z = PI * 0.7;   // U 形旅行枕
    add(g, box(0.1, 0.06, 0.2, 0.02), mat(INK, 0.6), 0.22, 0.12, 0.36); return { group: g, top: 0.32, footprint: 1.0 }; },
  sunscreen: () => { const g = new THREE.Group(); add(g, box(0.3, 0.7, 0.14, 0.06), mat(CREAM, 0.5), 0, 0.35, 0); add(g, box(0.31, 0.3, 0.145, 0.03), mat(CORAL, 0.6), 0, 0.3, 0); add(g, cyl(0.07, 0.07, 0.1, 12), mat(INK, 0.5), 0, 0.75, 0);   // 防晒霜：扁瓶、珊瑚色标签
    add(g, box(0.16, 0.08, 0.15, 0.01), mat(INK, 0.6), 0, 0.55, 0); return { group: g, top: 0.8, footprint: 0.35 }; },
  flashlight: () => { const g = new THREE.Group(); const f = new THREE.Group(); f.rotation.z = PI / 2 - 0.1; f.position.set(0, 0.1, 0); g.add(f);   // 手电筒：斜躺着
    add(f, cyl(0.09, 0.09, 0.7, 14), mat(INK, 0.4, { metalness: 0.3 }), 0, 0.35, 0); add(f, cyl(0.13, 0.09, 0.16, 14), mat(INK, 0.4, { metalness: 0.3 }), 0, 0.78, 0); add(f, cyl(0.1, 0.1, 0.03, 14), mat([246, 236, 180], 0.3, { emissive: C([255, 230, 150]), emissiveIntensity: 0.5 }), 0, 0.87, 0);
    add(f, new THREE.TorusGeometry(0.09, 0.015, 6, 16), mat(DAWN_RGB, 0.5), 0, 0.3, 0); add(f, box(0.06, 0.1, 0.03, 0.01), mat(DAWN_RGB, 0.5), 0, 0.55, 0.09); return { group: g, top: 0.24, footprint: 0.95 }; },
  waterBottle: () => { const g = new THREE.Group(); add(g, cyl(0.17, 0.17, 0.8, 18), mat([134, 160, 138], 0.4, { metalness: 0.3 }), 0, 0.4, 0); add(g, cyl(0.12, 0.17, 0.1, 18), mat([134, 160, 138], 0.4, { metalness: 0.3 }), 0, 0.85, 0); add(g, cyl(0.1, 0.1, 0.1, 12), mat(INK, 0.5), 0, 0.95, 0);   // 水壶：墨绿、带提环
    add(g, new THREE.TorusGeometry(0.08, 0.015, 6, 16), mat(INK, 0.5), 0.12, 1.0, 0).rotation.x = PI / 2; add(g, box(0.2, 0.2, 0.02, 0.01), mat(CREAM, 0.7), 0, 0.42, 0.17); return { group: g, top: 1.02, footprint: 0.36 }; },
};
const DAWN_RGB: RGB = [240, 176, 58];

export function extraModel(kind: ExtraKind): Landmark { return (M[kind] ?? M.plush)(); }
