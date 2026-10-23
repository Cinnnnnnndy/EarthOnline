/** 名胜模型·大洋洲的补充（第八轮末，D87）：奥克兰天空塔、皇后镇缆车、怀托摩萤火虫洞。只用公开的积木，可以单独拷走。每个模型不超过 5 种颜色；top 按包围盒算。 */
import * as THREE from "three";
import { type Maker, type RGB, type Landmark, mat, add, box, cyl, cone, ball, water, peak } from "../landmark-kit.ts";
import { capsuleBetween } from "../geom.ts";

const L = (group: THREE.Group, footprint: number): Landmark => { group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(group); return { group, top: b.max.y + 0.05, footprint }; };
const GRASS: RGB = [140, 176, 130], GREY: RGB = [120, 124, 136];

export const MORE_OCEANIA: Record<string, Maker> = {
  oc_sky_tower: () => {   // 奥克兰天空塔：一根白色的细杆，上面一个灰色的观景舱，再往上一根天线（五色：草、白、灰、深灰、红灯）
    const g = new THREE.Group(); const grey = mat(GREY, 0.6), white = mat([236, 236, 232], 0.7), dark = mat([80, 84, 92], 0.6);
    add(g, box(1.6, 0.5, 1.2, 0.04), grey, 0, 0.25, 0.2); add(g, cyl(1.2, 1.3, 0.06, 32), mat(GRASS, 0.95), 0, 0.03, 0);
    add(g, cyl(0.13, 0.2, 2.7, 14), white, 0, 1.85, 0);
    add(g, cyl(0.5, 0.4, 0.45, 24), grey, 0, 3.35, 0); add(g, cyl(0.55, 0.55, 0.12, 24), white, 0, 3.62, 0); add(g, cyl(0.34, 0.5, 0.3, 24), dark, 0, 3.83, 0);
    add(g, cyl(0.05, 0.1, 1.2, 8), white, 0, 4.55, 0); add(g, ball(0.07), mat([220, 60, 60], 0.4, { emissive: new THREE.Color(0.5, 0.05, 0.05), emissiveIntensity: 0.8 }), 0, 5.2, 0);
    return L(g, 2.6);
  },
  oc_queenstown_gondola: () => {   // 皇后镇缆车：湖边的山，一条缆绳斜上山顶的观景台，三只红色的小吊厢（五色：湖、绿、雪白、灰、红）
    const g = new THREE.Group(); const green = mat([96, 140, 100], 0.9), white = mat(0xffffff, 0.7), grey = mat(GREY, 0.6), red = mat([200, 50, 50], 0.5);
    add(g, cyl(2.1, 2.2, 0.06, 32), green, 0, 0.01, 0); water(g, 1.3, -0.6, 1.4, 0.04, [70, 150, 200], 1.3, 0.7);
    add(g, cone(1.8, 2.8, 7), green, 0.6, 1.4, -0.6); peak(g, 1.6, -1.4, 0.8, 2.0, true, GREY);
    add(g, box(0.9, 0.3, 0.6, 0.04), white, 0.6, 2.95, -0.6); add(g, box(0.96, 0.08, 0.66, 0.02), grey, 0.6, 3.14, -0.6);
    add(g, box(0.5, 0.3, 0.4, 0.03), white, -1.3, 0.2, 0.6);
    const a = new THREE.Vector3(-1.3, 0.45, 0.6), b = new THREE.Vector3(0.5, 2.9, -0.4); g.add(capsuleBetween(a, b, 0.012, grey));
    for (const u of [0.25, 0.5, 0.75]) { const p = a.clone().lerp(b, u); add(g, box(0.16, 0.16, 0.14, 0.03), red, p.x, p.y - 0.14, p.z); add(g, cyl(0.01, 0.01, 0.1, 4), grey, p.x, p.y - 0.04, p.z); }
    for (const [x, z] of [[-1.7, -0.2], [-0.4, 0.3], [1.6, 0.4]]) { add(g, cyl(0.03, 0.04, 0.3, 6), grey, x, 0.15, z); add(g, cone(0.2, 0.6, 8), green, x, 0.55, z); }
    return L(g, 4.4);
  },
  oc_waitomo: () => {   // 怀托摩萤火虫洞：山脚一个黑黑的洞口，洞里满顶蓝莹莹的小光点，一条小船划进去（五色：山绿、洞黑、萤蓝、暗水、木）
    const g = new THREE.Group(); const green = mat([86, 136, 80], 0.95), wood = mat([110, 80, 54], 0.8);
    const hill = add(g, new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), green, 0, 0, -0.4); hill.scale.set(1.5, 1.2, 1.0);   // 上半球：不埋到地下
    const mouth = add(g, cyl(0.9, 0.9, 0.9, 20), mat([18, 22, 32], 1), 0, 0.5, 0.95); mouth.rotation.x = Math.PI / 2; mouth.scale.set(1, 0.3, 0.5);   // 转到竖着后，本地 z 就是世界 y：压到 0.5 免得埋进地里
    const glow = mat([140, 230, 255], 0.3, { emissive: new THREE.Color(0.35, 0.8, 1.0), emissiveIntensity: 1.2 });
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI; add(g, ball(0.025), glow, Math.cos(a) * 0.75 * (0.6 + ((i * 7) % 5) / 10), 0.5 + Math.sin(a) * 0.45 * (0.7 + ((i * 3) % 4) / 10), 0.75 - ((i * 11) % 7) * 0.08).castShadow = false; }
    water(g, 1.0, 0, 1.6, 0.02, [30, 60, 100], 1.4, 0.5);
    const boat = add(g, box(0.5, 0.12, 0.2, 0.05), wood, 0.1, 0.1, 1.5); boat.rotation.y = 0.3; for (let i = 0; i < 3; i++) add(g, ball(0.05), wood, -0.05 + i * 0.14, 0.22, 1.5 - i * 0.04);
    for (const [x, z] of [[-1.5, 0.9], [1.5, 0.8]]) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; const f = add(g, box(0.3, 0.02, 0.08, 0.01), green, x + Math.sin(a) * 0.15, 0.1, z + Math.cos(a) * 0.15, a + Math.PI / 2); f.rotation.z = 0.4; }
    return L(g, 4.0);
  },
};
