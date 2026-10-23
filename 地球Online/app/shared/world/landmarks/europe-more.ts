/** 名胜模型·欧洲的补充（第八轮末，D87）：白金汉宫、贝伦塔、布拉格天文钟、五渔村、原子塔。只用公开的积木，可以单独拷走。
 *  约定同 europe.ts：原点在地面中心、+y 向上、正面朝 +z，每个模型不超过 5 种颜色、100 个网格；top 按包围盒算。 */
import * as THREE from "three";
import { type Maker, type RGB, type Landmark, mat, add, box, cyl, cone, ball, water } from "../landmark-kit.ts";
import { capsuleBetween } from "../geom.ts";

const PI = Math.PI;
const L = (group: THREE.Group, footprint: number): Landmark => { group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(group); return { group, top: b.max.y + 0.05, footprint }; };
const CREAM: RGB = [228, 222, 204], STONE: RGB = [196, 180, 160], INK: RGB = [60, 56, 62], GOLD: RGB = [232, 188, 80], GRASS: RGB = [140, 176, 130];

export const MORE_EUROPE: Record<string, Maker> = {
  eu_buckingham: () => {   // 白金汉宫：长长的奶油色正面、一排柱子、阳台，前面黑金的大门（五色：奶油、灰褐、草绿、墨、金）
    const g = new THREE.Group(); const w = mat(CREAM, 0.8), d = mat([170, 160, 140], 0.8), k = mat(INK, 0.5), au = mat(GOLD, 0.3, { metalness: 0.4 });
    add(g, box(4.4, 0.06, 2.2, 0.02), mat(GRASS, 0.95), 0, 0.03, -0.3);
    add(g, box(3.8, 1.1, 1.0, 0.03), w, 0, 0.6, -0.5); add(g, box(1.5, 1.3, 0.5, 0.03), w, 0, 0.7, 0.1); add(g, box(3.9, 0.1, 1.1, 0.02), d, 0, 1.2, -0.5); add(g, box(1.6, 0.1, 0.6, 0.02), d, 0, 1.4, 0.1);
    for (let i = 0; i < 6; i++) add(g, cyl(0.05, 0.05, 0.7, 10), w, -0.55 + i * 0.22, 0.85, 0.36);
    add(g, box(0.9, 0.06, 0.3, 0.01), d, 0, 0.5, 0.42); for (let i = 0; i < 10; i++) add(g, box(0.1, 0.22, 0.03, 0.01), k, -1.7 + i * 0.38 + (i > 4 ? 0.1 : 0), 0.55, 0.01);
    for (let i = 0; i < 8; i++) add(g, box(0.08, 0.12, 0.12, 0.01), d, -1.6 + i * 0.46, 1.3, -0.5);
    add(g, cyl(0.02, 0.02, 1.0, 6), d, 0, 1.95, 0.1); add(g, box(0.3, 0.18, 0.01, 0.005), au, 0.17, 2.35, 0.1);
    for (let i = 0; i < 9; i++) { add(g, cyl(0.02, 0.02, 0.5, 6), k, -1.2 + i * 0.3, 0.3, 1.0); add(g, ball(0.03), au, -1.2 + i * 0.3, 0.56, 1.0); }
    add(g, box(2.6, 0.06, 0.05, 0.01), k, 0, 0.42, 1.0);
    return L(g, 4.6);
  },
  eu_belem: () => {   // 贝伦塔：河口的石塔，前面一座半圆的堡垒，角上几个小圆塔（五色：水、奶油石、灰褐顶、墨窗、蓝门）
    const g = new THREE.Group(); water(g, 2.0, 0, 0.4, 0.03, [90, 160, 200], 1.3, 1.0); const s = mat(CREAM, 0.85);
    add(g, box(1.0, 2.2, 1.0, 0.03), s, 0, 1.1, -0.3); add(g, box(1.6, 0.7, 1.4, 0.06), s, 0, 0.35, 0.5); add(g, cyl(0.8, 0.8, 0.7, 24), s, 0, 0.35, 0.9);
    for (let i = 0; i < 7; i++) add(g, box(0.1, 0.1, 0.1, 0.01), s, -0.5 + i * 0.17, 0.75, 1.55 - Math.abs(i - 3) * 0.1);
    for (const [x, z] of [[-0.45, -0.75], [0.45, -0.75], [-0.45, 0.15], [0.45, 0.15]]) { add(g, cyl(0.1, 0.1, 0.6, 10), s, x, 2.2, z); add(g, cone(0.13, 0.22, 10), mat([150, 130, 110], 0.8), x, 2.6, z); }
    for (let i = 0; i < 2; i++) add(g, box(0.16, 0.26, 0.03, 0.01), mat(INK, 0.5), -0.2 + i * 0.4, 1.4, 0.21); add(g, box(0.3, 0.5, 0.03, 0.02), mat([80, 110, 140], 0.5), 0, 0.9, 0.21);
    return L(g, 3.2);
  },
  eu_prague_clock: () => {   // 布拉格天文钟：老市政厅的方塔，正面上下两个圆盘——蓝金的天文盘、米色的历盘（五色：石、深灰、蓝、金、米）
    const g = new THREE.Group(); const st = mat(STONE, 0.85), dk = mat([60, 70, 90], 0.6), au = mat(GOLD, 0.3, { metalness: 0.4 }), cm = mat([236, 222, 190], 0.6);
    add(g, box(1.1, 3.6, 1.1, 0.03), st, 0, 1.8, 0); const rg = cone(0.85, 1.0, 4); rg.rotateY(PI / 4); add(g, rg, dk, 0, 4.1, 0);
    for (const s of [-1, 1]) { const sg = cone(0.12, 0.4, 4); sg.rotateY(PI / 4); add(g, sg, dk, s * 0.5, 3.75, 0.5); }
    add(g, box(1.3, 0.6, 1.3, 0.02), st, 0, 3.55, 0);
    add(g, cyl(0.42, 0.42, 0.08, 28), mat([60, 90, 160], 0.5), 0, 1.75, 0.56).rotation.x = PI / 2; add(g, new THREE.TorusGeometry(0.42, 0.035, 8, 28), au, 0, 1.75, 0.6);
    add(g, cyl(0.2, 0.2, 0.02, 20), cm, 0, 1.75, 0.61).rotation.x = PI / 2; add(g, box(0.03, 0.34, 0.02, 0.005), au, 0.04, 1.84, 0.62).rotation.z = -0.5;
    add(g, cyl(0.36, 0.36, 0.08, 28), cm, 0, 0.85, 0.56).rotation.x = PI / 2; add(g, new THREE.TorusGeometry(0.36, 0.03, 8, 28), au, 0, 0.85, 0.6);
    for (const s of [-1, 1]) add(g, ball(0.07), dk, s * 0.62, 1.75, 0.5);
    add(g, box(0.22, 0.4, 0.03, 0.01), dk, 0, 2.7, 0.56);
    return L(g, 1.6);
  },
  eu_cinque_terre: () => {   // 五渔村：海边的山崖，粉的黄的橙的房子叠上去，顶上一座小钟楼（五色：海、崖、三种墙色）
    const g = new THREE.Group(); water(g, 1.8, 0, 1.3, 0.03, [70, 150, 200], 1.3, 0.7); const cl = mat([120, 108, 96], 0.95);
    const cliff = add(g, new THREE.SphereGeometry(1.3, 24, 12, 0, PI * 2, 0, PI / 2), cl, 0, 0.0, -0.6); cliff.scale.set(1.4, 1.1, 1.0);   // 上半球：不埋到地下
    const cols = [mat([236, 160, 120], 0.8), mat([240, 200, 100], 0.8), mat([200, 90, 80], 0.8)];
    const spots: [number, number, number, number][] = [[-1.3, 0.35, 0.2, 0.8], [-0.7, 0.55, 0.1, 1.0], [-0.1, 0.75, 0.0, 1.2], [0.5, 0.6, 0.1, 1.0], [1.1, 0.4, 0.2, 0.8], [-0.4, 1.3, -0.5, 0.9], [0.35, 1.25, -0.5, 0.9]];
    spots.forEach(([x, y, z, h], i) => { add(g, box(0.5, h, 0.5, 0.02), cols[i % 3], x, y + h / 2, z); add(g, box(0.52, 0.06, 0.52, 0.01), cl, x, y + h + 0.03, z); for (let k = 0; k < 2; k++) add(g, box(0.08, 0.12, 0.02, 0.005), cl, x - 0.12 + k * 0.24, y + h * 0.55, z + 0.26); });
    add(g, box(0.3, 1.0, 0.3, 0.02), cols[1], 0.0, 2.2, -0.9); const cg = cone(0.22, 0.3, 4); cg.rotateY(PI / 4); add(g, cg, cl, 0.0, 2.85, -0.9);
    return L(g, 4.4);
  },
  eu_atomium: () => {   // 原子塔：九颗银球——一颗在中间，八颗在一个立起来的立方体的角上，管子连着
    const g = new THREE.Group(); const sm = mat([218, 222, 230], 0.2, { metalness: 0.85 }), tm = mat([200, 204, 214], 0.3, { metalness: 0.7 });
    const C = new THREE.Vector3(0, 1.9, 0); const pts: THREE.Vector3[] = [new THREE.Vector3(0, 3.5, 0), new THREE.Vector3(0, 0.3, 0)];
    for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * 1.3, 2.45, Math.cos(a) * 1.3)); pts.push(new THREE.Vector3(Math.sin(a + PI / 3) * 1.3, 1.35, Math.cos(a + PI / 3) * 1.3)); }
    add(g, ball(0.34), sm, C.x, C.y, C.z);
    for (const p of pts) { add(g, ball(0.3), sm, p.x, p.y, p.z); g.add(capsuleBetween(C, p, 0.05, tm)); }
    for (let i = 0; i < 3; i++) g.add(capsuleBetween(pts[2 + i * 2], pts[3 + i * 2], 0.04, tm));
    for (const p of pts.slice(2)) if (p.y < 1.5) g.add(capsuleBetween(p, new THREE.Vector3(p.x * 0.9, 0.05, p.z * 0.9), 0.04, tm));
    add(g, cyl(1.9, 2.0, 0.06, 32), mat([214, 210, 200], 0.95), 0, 0.03, 0);
    return L(g, 3.4);
  },
};
