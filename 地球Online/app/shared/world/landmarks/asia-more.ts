/** 名胜模型·亚洲的补充（第八轮末，D87）：姬路城、浅草寺雷门、白川乡合掌村、仰光大金塔、帆船酒店、狮子岩。
 *  和 asia.ts 同一套约定（原点在地面中心、+y 向上、正面朝 +z、不超过 5 种颜色），只用公开的积木（landmark-kit），可以单独拷走。 */
import * as THREE from "three";
import { type Maker, type RGB, type Landmark, mat, add, box, cyl, cone, ball, water } from "../landmark-kit.ts";
import { lumpySphere } from "../geom.ts";

const PI = Math.PI;
const L = (group: THREE.Group, _top: number, footprint: number): Landmark => { group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(group); return { group, top: b.max.y + 0.05, footprint }; };
const WHITE: RGB = [246, 246, 242], STONE: RGB = [150, 146, 140], GRASS: RGB = [140, 176, 130], GOLD: RGB = [232, 188, 80], RED: RGB = [204, 48, 40], INK: RGB = [60, 56, 62];
const goldM = () => mat(GOLD, 0.3, { metalness: 0.35 });
/** 四坡顶：四棱锥压扁一点 */
const hip = (g: THREE.Group, w: number, d: number, h: number, c: RGB, x: number, y: number, z: number) => { const geo = cone(Math.max(w, d) * 0.78, h, 4); geo.rotateY(PI / 4); geo.scale(1, 1, d / w + 0.15); return add(g, geo, mat(c, 0.6), x, y + h / 2, z); };   // 旋转烤进几何体，包围盒才准

export const MORE_ASIA: Record<string, Maker> = {
  as_himeji: () => {   // 姬路城：石垣上一座白鹭似的大天守，四层递减、灰瓦四坡顶，旁边两座小天守
    const g = new THREE.Group(); const w = mat(WHITE, 0.8), roof: RGB = [96, 100, 112];
    add(g, box(3.0, 0.55, 2.4, 0.06), mat(STONE, 0.95), 0, 0.27, 0); add(g, box(3.4, 0.08, 2.8, 0.03), mat(GRASS, 0.95), 0, 0.04, 0);
    const tiers: [number, number, number][] = [[1.8, 0.55, 1.5], [1.55, 0.5, 1.3], [1.3, 0.48, 1.1], [1.0, 0.45, 0.85]]; let y = 0.55;
    tiers.forEach(([tw, th, td], i) => { add(g, box(tw, th, td, 0.03), w, 0, y + th / 2, 0); hip(g, tw + 0.5, td + 0.5, 0.26, roof, 0, y + th - 0.02, 0); if (i < 3) add(g, box(tw * 0.5, 0.08, 0.04, 0.01), mat(INK, 0.6), 0, y + th * 0.55, td / 2 + 0.02); y += th + 0.16; });
    for (const s of [-1, 1]) add(g, box(0.05, 0.14, 0.04, 0.01), goldM(), s * 0.3, y + 0.12, 0);
    for (const s of [-1, 1]) { add(g, box(0.8, 0.5, 0.7, 0.03), w, s * 1.05, 0.8, 0.7); hip(g, 1.1, 1.0, 0.22, roof, s * 1.05, 1.03, 0.7); }
    return L(g, y + 0.3, 3.4);
  },
  as_kaminarimon: () => {   // 浅草寺雷门：两根朱柱、黑瓦顶、中间一盏大红灯笼
    const g = new THREE.Group(); const red = mat([188, 44, 36], 0.6);
    add(g, box(3.0, 0.08, 1.6, 0.02), mat([214, 206, 194], 0.95), 0, 0.04, 0);
    for (const x of [-1.0, 1.0]) { add(g, cyl(0.14, 0.15, 1.7, 14), red, x, 0.93, 0); add(g, box(0.4, 0.1, 0.4, 0.02), mat(INK, 0.7), x, 0.1, 0); }
    add(g, box(2.9, 0.2, 1.1, 0.03), mat(INK, 0.6), 0, 1.86, 0); hip(g, 3.3, 1.5, 0.34, [62, 58, 66], 0, 1.96, 0); add(g, box(1.6, 0.1, 0.08, 0.02), mat(INK, 0.6), 0, 2.36, 0);
    const lan = add(g, ball(0.5), mat(RED, 0.55), 0, 1.12, 0); lan.scale.set(1, 1.15, 1);
    for (const y of [0.78, 1.0, 1.24, 1.46]) add(g, new THREE.TorusGeometry(0.5 * Math.sqrt(Math.max(0.05, 1 - ((y - 1.12) / 0.58) ** 2)) + 0.012, 0.015, 6, 24), mat(INK, 0.6), 0, y, 0).rotation.x = PI / 2;
    add(g, cyl(0.2, 0.2, 0.08, 16), mat(INK, 0.6), 0, 1.72, 0); add(g, cyl(0.2, 0.2, 0.08, 16), mat(INK, 0.6), 0, 0.52, 0); add(g, cyl(0.04, 0.06, 0.2, 8), goldM(), 0, 0.38, 0);
    for (const s of [-1, 1]) add(g, box(0.3, 0.6, 0.3, 0.04), mat([120, 100, 70], 0.8), s * 1.0, 0.48, 0.55);
    return L(g, 2.6, 3.2);
  },
  as_shirakawago: () => {   // 白川乡：三栋合掌造，陡陡的茅草顶，雪地或草地，一棵树
    const g = new THREE.Group(); add(g, cyl(2.0, 2.1, 0.08, 32), mat(GRASS, 0.95), 0, 0.04, 0);
    const thatch = mat([150, 118, 78], 0.95), wall = mat([236, 226, 206], 0.85), wood = mat([110, 80, 54], 0.8);
    const houses: [number, number, number, number][] = [[-0.9, 0.3, 1.0, 0.2], [0.75, -0.2, 1.25, -0.35], [-0.2, -1.1, 0.85, 0.5]];
    for (const [x, z, s, ry] of houses) {
      const h = new THREE.Group(); h.position.set(x, 0.08, z); h.rotation.y = ry; h.scale.setScalar(s); g.add(h);
      add(h, box(0.9, 0.5, 0.7, 0.02), wall, 0, 0.25, 0); add(h, box(0.92, 0.1, 0.72, 0.01), wood, 0, 0.05, 0);
      const rg = new THREE.CylinderGeometry(0, 0.72, 1.15, 4); rg.rotateY(PI / 4); rg.scale(1.0, 1, 1.5); add(h, rg, thatch, 0, 1.05, 0);
      add(h, box(0.16, 0.2, 0.02, 0.01), wood, 0, 0.78, 0.36); add(h, box(0.12, 0.16, 0.02, 0.01), wood, 0.2, 0.3, 0.36);
    }
    add(g, cyl(0.05, 0.07, 0.6, 8), wood, 1.5, 0.3, 1.0); add(g, lumpySphere(0.42, 3, 0.2), mat([96, 150, 86], 0.85), 1.5, 0.85, 1.0);
    return L(g, 1.7, 4.0);
  },
  as_shwedagon: () => {   // 仰光大金塔：白台基上一座金色的覆钟大塔，层层收上去，周围一圈小塔
    const g = new THREE.Group(); const gm = goldM(); add(g, cyl(1.7, 1.8, 0.22, 32), mat([240, 236, 228], 0.9), 0, 0.11, 0);
    add(g, cyl(1.1, 1.2, 0.3, 28), gm, 0, 0.37, 0); add(g, cyl(0.95, 1.05, 0.24, 28), gm, 0, 0.64, 0);
    add(g, ball(0.78), gm, 0, 1.2, 0).scale.set(1, 0.85, 1); add(g, cyl(0.46, 0.66, 0.5, 24), gm, 0, 1.95, 0);
    for (let i = 0; i < 4; i++) add(g, cyl(0.42 - i * 0.07, 0.46 - i * 0.07, 0.14, 20), gm, 0, 2.27 + i * 0.14, 0);
    add(g, cone(0.3, 1.2, 20), gm, 0, 3.4, 0); add(g, cyl(0.02, 0.03, 0.5, 8), gm, 0, 4.2, 0); add(g, ball(0.08), mat([250, 240, 220], 0.3, { metalness: 0.4 }), 0, 4.48, 0);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; add(g, cone(0.14, 0.5, 12), gm, Math.sin(a) * 1.45, 0.47, Math.cos(a) * 1.45); add(g, cyl(0.16, 0.18, 0.12, 12), gm, Math.sin(a) * 1.45, 0.28, Math.cos(a) * 1.45); }
    return L(g, 4.5, 3.6);
  },
  as_burj_al_arab: () => {   // 帆船酒店：海上的小岛，一面鼓起的白帆，蓝玻璃的正面，顶上一块停机坪
    const g = new THREE.Group(); water(g, 2.0, 0, 0.3, 0.03, [96, 184, 220], 1.3, 1.0); add(g, cyl(0.9, 1.0, 0.16, 24), mat([214, 206, 194], 0.9), 0, 0.08, 0);
    const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(0, 3.6); sail.quadraticCurveTo(2.0, 3.5, 2.0, 0.2); sail.lineTo(0, 0);
    const sg = new THREE.ExtrudeGeometry(sail, { depth: 0.12, bevelEnabled: false }); sg.translate(-0.9, 0, -0.06);
    add(g, sg, mat([240, 242, 248], 0.5), 0, 0.16, -0.3);
    add(g, box(0.5, 3.4, 0.55, 0.06), mat([120, 170, 220], 0.2, { metalness: 0.2 }), 0.15, 1.86, 0.1);
    add(g, box(1.1, 0.06, 0.6, 0.02), mat([236, 232, 224], 0.7), 0.9, 3.0, 0.1); add(g, cyl(0.26, 0.26, 0.04, 20), mat([236, 232, 224], 0.7), 1.05, 3.05, 0.1); add(g, cyl(0.12, 0.12, 0.02, 16), mat([200, 60, 60], 0.6), 1.05, 3.08, 0.1);
    add(g, cyl(0.02, 0.02, 0.8, 6), mat([200, 200, 210], 0.4), 0.05, 4.1, -0.1);
    return L(g, 4.5, 3.0);
  },
  as_sigiriya: () => {   // 狮子岩：丛林里拔地而起的一块橙褐色巨岩，顶上是平的（宫殿的草地），脚下一对狮爪与阶梯
    const g = new THREE.Group(); add(g, cyl(2.1, 2.2, 0.1, 32), mat([110, 150, 92], 0.95), 0, 0.05, 0);
    const rock = add(g, lumpySphere(1.0, 17, 0.12), mat([190, 118, 66], 0.9), 0, 1.6, 0); rock.scale.set(1.15, 1.6, 0.95);
    add(g, cyl(0.84, 0.9, 0.1, 24), mat([120, 170, 96], 0.9), 0, 3.15, 0); add(g, box(0.5, 0.2, 0.4, 0.03), mat([214, 196, 160], 0.8), 0.1, 3.3, 0);
    for (const s of [-1, 1]) { add(g, box(0.32, 0.26, 0.36, 0.05), mat([214, 186, 140], 0.8), s * 0.42, 0.3, 1.02); for (let i = 0; i < 3; i++) add(g, box(0.08, 0.06, 0.1, 0.01), mat([214, 186, 140], 0.8), s * (0.3 + i * 0.1), 0.46, 1.2); }
    for (let i = 0; i < 6; i++) add(g, box(0.4, 0.05, 0.14, 0.01), mat([214, 196, 160], 0.8), 0, 0.5 + i * 0.1, 1.15 - i * 0.12);
    for (const [x, z] of [[-1.6, 0.9], [1.5, -0.8], [-1.2, -1.3], [1.7, 1.0]]) { add(g, cyl(0.04, 0.05, 0.4, 6), mat([110, 80, 54], 0.8), x, 0.3, z); add(g, lumpySphere(0.3, 5, 0.2), mat([96, 150, 86], 0.85), x, 0.68, z); }
    return L(g, 3.5, 4.2);
  },
};
