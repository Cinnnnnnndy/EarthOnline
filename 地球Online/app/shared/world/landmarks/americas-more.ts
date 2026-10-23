/** 名胜模型·美洲的补充（第八轮末，D87）：布鲁克林大桥、云门（芝加哥的豆子）、莫雷诺冰川、路易斯湖。只用公开的积木，可以单独拷走。
 *  约定同 americas.ts：每个模型不超过 6 种颜色、100 个网格；top 按包围盒算。 */
import * as THREE from "three";
import { type Maker, type RGB, type Landmark, mat, add, box, cyl, cone, ball, water, peak } from "../landmark-kit.ts";
import { capsuleBetween } from "../geom.ts";

const L = (group: THREE.Group, footprint: number): Landmark => { group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(group); return { group, top: b.max.y + 0.05, footprint }; };
const INK: RGB = [60, 56, 62], ROCK: RGB = [120, 124, 136];

export const MORE_AMERICAS: Record<string, Maker> = {
  am_brooklyn_bridge: () => {   // 布鲁克林大桥：两座哥特式的石塔，双拱门，斜拉的钢索，桥面跨过东河（五色）
    const g = new THREE.Group(); water(g, 2.6, 0, 0, 0.03, [70, 120, 170], 1.0, 0.45); const st = mat([176, 160, 140], 0.9), cab = mat([200, 200, 210], 0.4, { metalness: 0.5 });
    add(g, box(5.2, 0.1, 0.7, 0.02), mat([130, 124, 120], 0.85), 0, 0.9, 0);
    for (const x of [-1.3, 1.3]) {
      add(g, box(0.6, 2.4, 0.9, 0.03), st, x, 1.2, 0); for (const s of [-1, 1]) add(g, box(0.16, 0.9, 0.95, 0.02), mat(INK, 0.6), x + s * 0.16, 1.55, 0); for (const s of [-1, 1]) add(g, ball(0.09), mat(INK, 0.6), x + s * 0.16, 2.0, 0).scale.set(1, 1.3, 5.3);
      add(g, box(0.7, 0.1, 1.0, 0.02), st, x, 2.45, 0);
      for (const z of [-0.3, 0.3]) for (const ex of [-2.6, 0, 2.6]) { if (ex !== 0 && Math.sign(ex) !== Math.sign(x)) continue; g.add(capsuleBetween(new THREE.Vector3(x, 2.45, z), new THREE.Vector3(ex, 0.95, z), 0.018, cab)); }
      for (let i = 1; i < 5; i++) g.add(capsuleBetween(new THREE.Vector3(x + Math.sign(x) * i * 0.26, 2.45 - i * 0.3, -0.3), new THREE.Vector3(x + Math.sign(x) * i * 0.26, 0.95, -0.3), 0.012, cab));
    }
    for (const z of [-0.3, 0.3]) g.add(capsuleBetween(new THREE.Vector3(-1.3, 2.45, z), new THREE.Vector3(1.3, 2.45, z), 0.02, cab));
    return L(g, 5.4);
  },
  am_cloud_gate: () => {   // 云门：千禧公园里那颗镜面的大豆子，两头着地；几个小人衬出它多大（六色）
    const g = new THREE.Group(); add(g, cyl(1.9, 2.0, 0.06, 32), mat([200, 196, 190], 0.95), 0, 0.03, 0);
    const bean = add(g, ball(0.9), mat([225, 228, 235], 0.08, { metalness: 1.0 }), 0, 0.72, 0); bean.scale.set(1.5, 0.78, 0.9); bean.rotation.z = 0.08;
    for (const [x, c] of [[-1.0, [210, 80, 60]], [0.9, [70, 120, 180]], [1.3, [230, 190, 80]]] as [number, RGB][]) { add(g, ball(0.07), mat([240, 210, 190], 0.8), x, 0.28, 1.05); add(g, box(0.1, 0.2, 0.08, 0.02), mat(c, 0.8), x, 0.12, 1.05); }
    return L(g, 3.4);
  },
  am_perito_moreno: () => {   // 莫雷诺冰川：湖面上一道高高的蓝白冰墙，裂着一道道深蓝的缝，对面的木栈道，身后雪山（六色）
    const g = new THREE.Group(); water(g, 1.9, 0, 0.9, 0.03, [110, 170, 200], 1.2, 0.7);
    const ice = mat([214, 236, 250], 0.4), deep = mat([110, 170, 230], 0.3), snow = mat(0xffffff, 0.9);
    for (let i = 0; i < 9; i++) { const x = -1.8 + i * 0.45, h = 0.9 + ((i * 7) % 4) * 0.2; add(g, box(0.5, h, 1.2, 0.04), ice, x, h / 2 + 0.05, -0.4); add(g, box(0.52, 0.1, 1.22, 0.02), snow, x, h + 0.08, -0.4); if (i % 2) add(g, box(0.06, h * 0.8, 0.06, 0.01), deep, x + 0.25, h * 0.45, 0.2); }
    for (let i = 0; i < 3; i++) add(g, box(1.6, 0.6 + i * 0.3, 0.8, 0.1), ice, -0.8 + i * 0.8, 1.9 + i * 0.15, -1.3);
    peak(g, -1.3, -1.8, 0.8, 2.6, true, ROCK); peak(g, 1.2, -1.85, 0.8, 2.2, true, ROCK);
    for (let i = 0; i < 4; i++) add(g, box(0.5, 0.06, 0.14, 0.01), mat([150, 110, 70], 0.8), 2.0, 0.3 + i * 0.12, 1.4 - i * 0.3); add(g, cyl(0.03, 0.03, 0.5, 6), mat([150, 110, 70], 0.8), 2.0, 0.3, 1.2);
    return L(g, 5.0);
  },
  am_lake_louise: () => {   // 路易斯湖：一汪牛奶蓝的湖，背后雪山与冰川，岸边一座城堡酒店，一只红皮艇（六色）
    const g = new THREE.Group(); const green = mat([80, 130, 110], 0.8), rock = mat(ROCK, 0.9), cream = mat([236, 228, 212], 0.8), white = mat(0xffffff, 0.7);
    add(g, cyl(1.9, 2.0, 0.06, 32), green, 0, 0.01, 0); water(g, 1.8, 0, 0.5, 0.04, [96, 196, 200], 1.3, 0.9);
    peak(g, -0.9, -1.6, 1.0, 3.0, true, ROCK); peak(g, 0.9, -1.7, 0.9, 2.6, true, ROCK); peak(g, 0.1, -1.8, 0.9, 3.6, true, ROCK);
    add(g, box(1.6, 0.14, 0.7, 0.05), white, 0.1, 1.9, -1.9);
    add(g, box(1.3, 0.6, 0.5, 0.03), cream, 1.5, 0.35, 1.1); add(g, box(1.36, 0.14, 0.56, 0.02), green, 1.5, 0.72, 1.1); add(g, box(0.4, 0.9, 0.4, 0.03), cream, 1.9, 0.5, 1.1); const cg = cone(0.3, 0.3, 4); cg.rotateY(Math.PI / 4); add(g, cg, green, 1.9, 1.1, 1.1);
    for (const [x, z] of [[-1.9, 0.4], [-1.5, 1.2], [-2.0, 1.5], [2.1, 0.2]]) { add(g, cyl(0.03, 0.04, 0.3, 6), rock, x, 0.15, z); add(g, cone(0.2, 0.7, 8), green, x, 0.6, z); }
    const canoe = add(g, box(0.5, 0.1, 0.16, 0.04), mat([200, 50, 50], 0.5), -0.4, 0.09, 1.0); canoe.rotation.y = 0.5;
    return L(g, 4.4);
  },
};
