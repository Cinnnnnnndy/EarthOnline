/** 名胜模型·非洲的补充（第八轮末，D87）：阿伊特本哈杜、塞伦盖蒂。只用公开的积木，可以单独拷走。每个模型不超过 5 种颜色；top 按包围盒算。 */
import * as THREE from "three";
import { type Maker, type RGB, type Landmark, mat, add, box, cyl, ball, water } from "../landmark-kit.ts";
import { lumpySphere } from "../geom.ts";

const L = (group: THREE.Group, footprint: number): Landmark => { group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(group); return { group, top: b.max.y + 0.05, footprint }; };
const OCHRE: RGB = [196, 140, 86], DARK: RGB = [120, 84, 50];

export const MORE_AFRICA: Record<string, Maker> = {
  af_ait_benhaddou: () => {   // 阿伊特本哈杜：山坡上一层层赭红的土楼，墙头一圈齿形，门前一条河与几棵棕榈（五色：水、山、赭、深褐、棕榈绿）
    const g = new THREE.Group(); water(g, 1.6, 0, 1.5, 0.03, [120, 160, 180], 1.6, 0.4); const dk = mat(DARK, 0.9);
    const hill = add(g, new THREE.SphereGeometry(1.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat([180, 128, 78], 0.95), 0, 0, -0.6); hill.scale.set(1.5, 0.55, 1.0);   // 上半球：不埋到地下
    const tiers: [number, number, number, number, number][] = [[-1.0, 0.2, 0.35, 0.8, 0.9], [0.1, 0.35, 0.2, 1.0, 1.1], [1.1, 0.25, 0.4, 0.7, 0.8], [0.0, 0.95, -0.4, 0.8, 1.0], [-0.8, 0.8, -0.6, 0.6, 0.7], [0.4, 1.45, -0.8, 0.6, 0.8]];
    for (const [x, y, z, w, h] of tiers) { add(g, box(w, h, w * 0.9, 0.02), mat(OCHRE, 0.9), x, y + h / 2, z); for (let i = 0; i < 4; i++) add(g, box(0.08, 0.08, 0.06, 0.01), dk, x - w / 2 + 0.08 + i * (w - 0.16) / 3, y + h + 0.04, z + w * 0.45); for (let i = 0; i < 2; i++) add(g, box(0.07, 0.1, 0.02, 0.005), dk, x - 0.12 + i * 0.24, y + h * 0.5, z + w * 0.46); }
    for (const [x, z] of [[-1.8, 1.0], [1.8, 1.1], [1.4, 1.9]]) { add(g, cyl(0.04, 0.06, 0.9, 8), dk, x, 0.45, z); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const leaf = add(g, box(0.5, 0.03, 0.12, 0.01), mat([96, 150, 86], 0.85), x + Math.sin(a) * 0.22, 0.9, z + Math.cos(a) * 0.22, a + Math.PI / 2); leaf.rotation.z = 0.25; } }
    return L(g, 4.2);
  },
  af_serengeti: () => {   // 塞伦盖蒂：金色的草原，一棵伞一样的金合欢，一只长颈鹿、一匹斑马（五色：草原、木 / 斑纹、树冠绿、长颈鹿黄、斑马白）
    const g = new THREE.Group(); add(g, cyl(2.1, 2.2, 0.08, 32), mat([204, 180, 108], 0.95), 0, 0.04, 0); const wood = mat([150, 100, 60], 0.85);
    add(g, cyl(0.06, 0.09, 1.3, 8), wood, -0.6, 0.7, -0.3); for (const s of [-1, 1]) add(g, cyl(0.03, 0.05, 0.6, 6), wood, -0.6 + s * 0.2, 1.4, -0.3).rotation.z = -s * 0.5;
    const canopy = add(g, lumpySphere(0.9, 7, 0.12), mat([104, 140, 72], 0.9), -0.6, 1.72, -0.3); canopy.scale.set(1.3, 0.3, 1.2);
    const gf = mat([226, 180, 110], 0.85);
    add(g, box(0.5, 0.3, 0.26, 0.06), gf, 0.9, 0.6, 0.3); for (const [x, z] of [[0.72, 0.2], [1.08, 0.2], [0.72, 0.4], [1.08, 0.4]]) add(g, cyl(0.035, 0.035, 0.45, 6), gf, x, 0.25, z);
    const neck = add(g, cyl(0.07, 0.09, 0.9, 8), gf, 1.15, 1.1, 0.3); neck.rotation.z = -0.3; add(g, box(0.22, 0.14, 0.14, 0.03), gf, 1.3, 1.55, 0.3); for (const s of [-1, 1]) add(g, cyl(0.015, 0.015, 0.1, 4), wood, 1.26 + s * 0.05, 1.68, 0.3);
    for (let i = 0; i < 6; i++) add(g, ball(0.045), wood, 0.72 + (i % 3) * 0.16, 0.62 + Math.floor(i / 3) * 0.12, 0.44).scale.set(1, 1, 0.3);
    const zw = mat([240, 240, 236], 0.85);
    add(g, box(0.5, 0.26, 0.24, 0.06), zw, -0.1, 0.4, 1.1); for (let i = 0; i < 5; i++) add(g, box(0.04, 0.27, 0.25, 0.005), wood, -0.3 + i * 0.1, 0.4, 1.1); for (const [x, z] of [[-0.3, 1.0], [0.1, 1.0], [-0.3, 1.2], [0.1, 1.2]]) add(g, cyl(0.03, 0.03, 0.3, 6), zw, x, 0.14, z);
    add(g, box(0.2, 0.14, 0.14, 0.03), zw, 0.3, 0.5, 1.1); add(g, cyl(0.03, 0.04, 0.2, 6), zw, 0.2, 0.5, 1.1).rotation.z = -0.8;
    return L(g, 4.3);
  },
};
