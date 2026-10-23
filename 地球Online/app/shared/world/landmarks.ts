/** 站点地标（分三级，见 landmark-kinds.ts）：名胜用专门的模型，其余按类型用通用模型，认不出的用路标兜底。
 *  积木在 landmark-kit.ts；各大洲名胜的专门模型在 landmarks/*.ts。 */
import * as THREE from "three";
import { mulberry32 } from "../algo/prng.ts";
import { classifyPlace } from "./landmark-kinds.ts";
import { tierOf, type Tier } from "./landmark-famous.ts";
import { type Landmark, type Maker, type RGB, C, mat, add, box, cyl, cone, ball, prism, house, flag, peak, water, steam, pick, NORDIC, waterTex } from "./landmark-kit.ts";
import { WORLD_MODELS } from "./landmarks/index.ts";
export type { Landmark } from "./landmark-kit.ts";

const T: Record<string, Maker> = {
  hallgrimskirkja: () => { const g = new THREE.Group(); const c: RGB = [222, 222, 216];
    for (let i = 0; i < 6; i++) { const w = 0.9 - i * 0.1; add(g, box(w, 0.7, w * 0.8, 0.04), mat(c), 0, 0.35 + i * 0.62, 0); }
    add(g, cone(0.3, 0.8, 4), mat([200, 200, 196]), 0, 4.3, 0, Math.PI / 4);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) add(g, box(0.3, 2.4 - i * 0.42, 0.9, 0.03), mat(c), s * (0.55 + i * 0.3), (2.4 - i * 0.42) / 2, 0.1);
    add(g, box(1.0, 1.2, 1.6, 0.05), mat(c), 0, 0.6, -1.0); return { group: g, top: 4.8, footprint: 1.8 }; },
  rift: () => { const g = new THREE.Group(); const rock: RGB = [74, 70, 72], moss: RGB = [104, 150, 86];
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const h = 0.9 + ((i * 37) % 5) * 0.12; add(g, box(0.6, h, 0.8, 0.08), mat(rock, 0.95), s * 0.75 + s * ((i * 13) % 3) * 0.05, h / 2, -2.2 + i * 0.85); add(g, box(0.62, 0.08, 0.82, 0.03), mat(moss), s * 0.75, h + 0.02, -2.2 + i * 0.85); }
    const f = flag(g, 1.6, 0.4, 2.0, [[2, 82, 156], [255, 255, 255], [220, 30, 38], [255, 255, 255], [2, 82, 156]]);
    house(g, -1.9, 1.2, [245, 243, 236], [196, 62, 52], 0.6, 0.45, 0.8);
    return { group: g, top: 2.2, footprint: 2.4, update: (t) => { f.rotation.y = Math.sin(t * 2) * 0.2; } }; },
  geyser: () => { const g = new THREE.Group();
    const m = add(g, ball(1.0), mat([214, 190, 150], 0.9), 0, -0.55, 0); m.scale.set(1.2, 0.7, 1.2);
    water(g, 0.45, 0, 0, 0.13, [96, 206, 226]);
    for (let i = 0; i < 3; i++) steam(g, Math.cos(i * 2.1) * 1.3, Math.sin(i * 2.1) * 1.3, 0.1, 3, 0.16);
    const col = steam(g, 0, 0, 0.15, 7, 0.26);
    return { group: g, top: 1.4, footprint: 1.8, update: (t) => { const k = Math.max(0, Math.sin(t * 0.9)); col.scale.set(1, 0.15 + k * 2.2, 1); col.visible = k > 0.02; } }; },
  waterfall: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const tiers = r.next() < 0.5 ? 1 : 2; const rock: RGB = [96, 92, 96], moss: RGB = [98, 150, 88];
    add(g, box(3.2, 2.2, 1.2, 0.2), mat(rock, 0.95), 0, 1.1, -0.9); add(g, box(3.3, 0.18, 1.3, 0.08), mat(moss), 0, 2.25, -0.9);
    if (tiers === 2) add(g, box(2.2, 1.0, 1.0, 0.15), mat(rock, 0.95), 0.9, 0.5, 0.2);
    const tex = waterTex(); const fm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.92, roughness: 0.2, emissive: C([200, 235, 255]), emissiveIntensity: 0.25 });
    const fall = add(g, new THREE.PlaneGeometry(0.9, 2.2), fm, -0.2, 1.1, -0.28); fall.castShadow = false;
    water(g, 1.1, -0.2, 0.55, 0.03, [80, 190, 210], 1.2, 0.8); const mist = steam(g, -0.2, 0.3, 0.1, 3, 0.35);
    return { group: g, top: 2.7, footprint: 2.2, update: (t) => { tex.offset.y = -t * 1.4; mist.rotation.y = t * 0.3; } }; },
  crater: () => { const g = new THREE.Group();
    const rim = add(g, new THREE.TorusGeometry(1.2, 0.5, 14, 36), mat([168, 74, 52], 0.95), 0, 0.2, 0); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1, 0.7);
    water(g, 1.0, 0, 0, 0.0, [58, 176, 170]); add(g, new THREE.TorusGeometry(1.25, 0.12, 8, 36), mat([108, 150, 88]), 0, 0.5, 0).rotation.x = Math.PI / 2;
    return { group: g, top: 1.0, footprint: 1.8 }; },
  glacier: () => { const g = new THREE.Group(); const ice = mat([214, 236, 248], 0.35, { metalness: 0.05 }), blue = mat([140, 196, 232], 0.3);
    const t = add(g, box(2.4, 0.9, 3.4, 0.35), ice, 0, 0.35, -0.6); t.rotation.x = -0.12;
    for (let i = 0; i < 5; i++) add(g, box(0.06, 0.5, 2.4, 0.02), blue, -0.9 + i * 0.45, 0.62, -0.5);
    add(g, box(0.9, 0.35, 0.7, 0.1), mat([60, 58, 60], 0.95), 1.4, 0.18, 0.9); return { group: g, top: 1.3, footprint: 2.2 }; },
  blackbeach: () => { const g = new THREE.Group(); const bas = mat([52, 52, 58], 0.85);
    add(g, box(3.4, 0.08, 2.0, 0.04), mat([46, 46, 52], 1), 0, 0.04, 0.4);
    for (let i = 0; i < 9; i++) { const h = 0.8 + ((i * 7) % 5) * 0.28; add(g, cyl(0.2, 0.2, h, 6), bas, -1.4 + i * 0.3, h / 2, -0.8); }
    for (const [x, z, h] of [[1.2, 1.6, 1.6], [0.5, 2.0, 1.2], [1.8, 2.2, 1.0]] as const) add(g, box(0.4, h, 0.4, 0.12), bas, x, h / 2 - 0.1, z);
    return { group: g, top: 2.1, footprint: 2.0 }; },
  lagoon: () => { const g = new THREE.Group(); water(g, 1.6, 0, 0, 0.02, [58, 150, 190], 1.3, 0.8);
    const ice = [mat([240, 250, 255], 0.3), mat([160, 214, 240], 0.25)];
    for (let i = 0; i < 9; i++) { const b = add(g, box(0.3 + (i % 3) * 0.18, 0.25 + (i % 2) * 0.2, 0.3, 0.08), ice[i % 2], Math.cos(i * 1.7) * 1.3, 0.12, Math.sin(i * 1.7) * 0.8, i); b.rotation.z = (i % 3) * 0.2; }
    return { group: g, top: 0.9, footprint: 2.0 }; },
  diamondbeach: () => { const g = new THREE.Group(); add(g, box(3.2, 0.06, 1.8, 0.03), mat([40, 40, 46], 1), 0, 0.03, 0);
    const ice = mat([220, 240, 252], 0.2, { transparent: true, opacity: 0.9 });
    for (let i = 0; i < 12; i++) add(g, box(0.18 + (i % 4) * 0.06, 0.14 + (i % 3) * 0.06, 0.2, 0.05), ice, -1.3 + (i % 6) * 0.5, 0.1, -0.5 + Math.floor(i / 6) * 0.8, i);
    return { group: g, top: 0.7, footprint: 1.8 }; },
  bluelagoon: () => { const g = new THREE.Group(); water(g, 1.5, 0, 0, 0.04, [150, 218, 226], 1.3, 0.9);
    for (let i = 0; i < 10; i++) add(g, box(0.4, 0.3, 0.4, 0.14), mat([44, 44, 50], 0.95), Math.cos(i * 0.63) * 1.95, 0.12, Math.sin(i * 0.63) * 1.25, i);
    add(g, box(1.4, 0.6, 0.6, 0.08), mat([40, 42, 48], 0.6), -1.5, 0.3, -1.4); const s = steam(g, 0.3, 0.2, 0.2, 4, 0.3);
    return { group: g, top: 1.0, footprint: 2.0, update: (t) => { s.rotation.y = t * 0.2; } }; },
  airport: () => { const g = new THREE.Group();
    add(g, box(4.4, 0.04, 0.7, 0.02), mat([74, 78, 88], 0.9), 0, 0.02, 1.2); for (let i = 0; i < 6; i++) add(g, box(0.35, 0.05, 0.06, 0.01), mat(0xffffff), -1.8 + i * 0.7, 0.04, 1.2);
    add(g, box(2.2, 0.55, 0.9, 0.08), mat([236, 240, 244], 0.3), 0, 0.28, -0.3); add(g, box(2.25, 0.2, 0.95, 0.06), mat([120, 190, 226], 0.15, { metalness: 0.2 }), 0, 0.56, -0.3);
    add(g, cyl(0.1, 0.12, 1.4, 12), mat([236, 240, 244]), 1.5, 0.7, -0.6); add(g, cyl(0.22, 0.18, 0.25, 12), mat([90, 150, 190], 0.2), 1.5, 1.5, -0.6);
    const p = new THREE.Group(); p.position.set(-0.8, 0.12, 1.2); g.add(p); add(p, cyl(0.1, 0.1, 1.0, 12), mat(0xffffff, 0.3), 0, 0, 0).rotation.z = Math.PI / 2; add(p, box(0.25, 0.03, 1.0, 0.02), mat(0xffffff, 0.3), 0, 0, 0);
    return { group: g, top: 1.8, footprint: 2.4 }; },
  port: () => { const g = new THREE.Group(); add(g, box(0.8, 0.2, 2.6, 0.04), mat([150, 120, 90], 0.9), -1.1, 0.1, 0);
    const ship = new THREE.Group(); ship.position.set(0.3, 0, 0); g.add(ship);
    add(ship, box(1.0, 0.5, 3.2, 0.3), mat([30, 32, 40], 0.5), 0, 0.2, 0); add(ship, box(0.9, 0.45, 2.2, 0.08), mat(0xffffff, 0.4), 0, 0.65, -0.2); add(ship, box(0.8, 0.35, 1.4, 0.08), mat(0xffffff, 0.4), 0, 1.0, -0.3);
    add(ship, cyl(0.16, 0.18, 0.5, 14), mat([200, 40, 40], 0.4), 0, 1.4, -0.8); for (let i = 0; i < 7; i++) add(ship, box(0.02, 0.08, 0.14, 0.01), mat([40, 60, 90]), 0.46, 0.72, -1.1 + i * 0.3);
    return { group: g, top: 1.9, footprint: 2.2, update: (t) => { ship.rotation.z = Math.sin(t * 1.3) * 0.02; ship.position.y = Math.sin(t * 1.7) * 0.02; } }; },
  hotel: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const wall = NORDIC[r.int(NORDIC.length)];
    add(g, box(1.3, 1.1, 1.0, 0.08), mat(wall), 0, 0.55, 0); const roof = add(g, cone(1.0, 0.6, 4), mat([54, 58, 70], 0.6), 0, 1.4, 0, Math.PI / 4); roof.scale.set(1, 1, 0.8);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) add(g, box(0.2, 0.2, 0.02, 0.02), mat([255, 214, 140], 0.4, { emissive: C([255, 190, 110]), emissiveIntensity: 0.8 }), -0.4 + i * 0.4, 0.35 + j * 0.42, 0.51);
    add(g, box(0.4, 0.25, 0.04, 0.02), mat([255, 108, 76], 0.4), 0, 1.0, 0.52);
    return { group: g, top: 1.9, footprint: 1.2 }; },
  arcticCathedral: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const m = add(g, cone(1.0 - i * 0.12, 2.6 - i * 0.3, 3), mat(0xffffff, 0.35), 0, (2.6 - i * 0.3) / 2, -0.4 + i * 0.22, Math.PI); m.scale.set(1, 1, 0.5); }
    add(g, box(0.9, 1.6, 0.05, 0.02), mat([150, 200, 230], 0.1, { metalness: 0.3 }), 0, 0.8, 0.72); return { group: g, top: 2.9, footprint: 1.4 }; },
  church: () => { const g = new THREE.Group(); house(g, 0, 0, [245, 243, 236], [196, 62, 52], 1.0, 0.8, 1.6); add(g, box(0.4, 1.4, 0.4, 0.04), mat([245, 243, 236]), 0, 0.7, 0.9); add(g, cone(0.35, 0.8, 4), mat([196, 62, 52], 0.6), 0, 1.8, 0.9, Math.PI / 4); return { group: g, top: 2.4, footprint: 1.2 }; },
  mcdonalds: () => { const g = new THREE.Group(); add(g, box(1.2, 0.8, 1.0, 0.06), mat([200, 40, 40], 0.5), 0, 0.4, 0); add(g, box(1.25, 0.12, 1.05, 0.04), mat([250, 200, 30], 0.4), 0, 0.82, 0);
    const m = add(g, new THREE.TorusGeometry(0.16, 0.05, 8, 16, Math.PI), mat([255, 196, 20], 0.3, { emissive: C([255, 180, 0]), emissiveIntensity: 0.4 }), -0.16, 1.2, 0); m.rotation.z = 0; add(g, new THREE.TorusGeometry(0.16, 0.05, 8, 16, Math.PI), mat([255, 196, 20], 0.3, { emissive: C([255, 180, 0]), emissiveIntensity: 0.4 }), 0.16, 1.2, 0);
    add(g, cyl(0.04, 0.04, 0.5, 8), mat([200, 200, 205]), 0, 0.95, 0); return { group: g, top: 1.6, footprint: 1.0 }; },
  polaria: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = add(g, box(0.5, 1.4, 1.1, 0.05), mat(0xffffff, 0.4), -1 + i * 0.5, 0.55, 0); b.rotation.z = 0.55; }
    add(g, box(2.6, 0.5, 1.0, 0.05), mat([150, 200, 230], 0.15, { metalness: 0.2 }), 0, 0.25, 0.5); return { group: g, top: 1.6, footprint: 1.6 }; },
  cablecar: () => { const g = new THREE.Group(); peak(g, 1.3, -1.0, 1.2, 2.2, true, [96, 110, 100]); add(g, box(0.5, 0.4, 0.5, 0.05), mat([200, 60, 50]), -1.1, 0.2, 1.0); add(g, box(0.5, 0.35, 0.5, 0.05), mat([200, 60, 50]), 1.1, 2.1, -0.9);
    const L = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.1, 0.45, 1.0), new THREE.Vector3(1.1, 2.3, -0.9)]); g.add(new THREE.Line(L, new THREE.LineBasicMaterial({ color: 0x333333 })));
    const cab = add(g, box(0.25, 0.22, 0.18, 0.05), mat([220, 40, 40], 0.4), 0, 1.3, 0); return { group: g, top: 2.9, footprint: 2.0, update: (t) => { const k = (Math.sin(t * 0.5) + 1) / 2; cab.position.set(-1.1 + 2.2 * k, 0.28 + 1.85 * k, 1.0 - 1.9 * k); } }; },
  fishingVillage: () => { const g = new THREE.Group(); peak(g, -0.6, -1.6, 1.4, 3.0); peak(g, 1.0, -1.9, 1.1, 2.4);
    for (let i = 0; i < 4; i++) { house(g, -1.0 + i * 0.7, 0.4 + (i % 2) * 0.3, [178, 42, 38], [44, 40, 42], 0.55, 0.45, 0.5); for (const dx of [-0.2, 0.2]) add(g, cyl(0.04, 0.04, 0.3, 6), mat([90, 70, 50]), -1.0 + i * 0.7 + dx, -0.05, 0.62 + (i % 2) * 0.3); }
    add(g, box(2.4, 0.08, 0.3, 0.03), mat([60, 64, 74], 0.5), 0.3, 0.35, 1.4); for (let i = 0; i < 5; i++) add(g, box(0.05, 0.35, 0.05, 0.01), mat([60, 64, 74]), -0.8 + i * 0.55, 0.18, 1.4);
    return { group: g, top: 3.2, footprint: 2.2 }; },
  beach: () => { const g = new THREE.Group(); peak(g, 0.6, -1.6, 1.5, 2.8, false, [110, 130, 104]); const s = add(g, cyl(1.6, 1.6, 0.06, 32, ), mat([238, 226, 196], 1), 0, 0.03, 0.4); s.scale.set(1.3, 1, 0.6); water(g, 1.4, 0, 1.4, 0.02, [80, 210, 210], 1.3, 0.6); return { group: g, top: 2.9, footprint: 2.0 }; },
  rowHouses: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); add(g, box(4.0, 0.05, 0.6, 0.02), mat([70, 150, 190], 0.15), 0, 0.02, 0.9);
    for (let i = 0; i < 7; i++) { const h = 0.9 + r.next() * 0.5; add(g, box(0.52, h, 0.7, 0.04), mat(NORDIC[(i + r.int(3)) % NORDIC.length]), -1.6 + i * 0.54, h / 2, 0); add(g, cone(0.4, 0.4, 4), mat([60, 56, 60], 0.6), -1.6 + i * 0.54, h + 0.2, 0, Math.PI / 4); }
    return { group: g, top: 2.0, footprint: 2.2 }; },
  palace: () => { const g = new THREE.Group(); add(g, box(2.6, 1.0, 1.2, 0.06), mat([236, 226, 206]), 0, 0.5, 0); add(g, box(2.7, 0.3, 1.3, 0.05), mat([86, 110, 96], 0.6), 0, 1.15, 0);
    for (const x of [-1.1, 1.1]) { add(g, box(0.5, 1.6, 0.5, 0.05), mat([236, 226, 206]), x, 0.8, 0); add(g, cone(0.36, 0.7, 4), mat([86, 110, 96], 0.5), x, 1.95, 0, Math.PI / 4); }
    add(g, ball(0.35), mat([200, 170, 90], 0.3, { metalness: 0.5 }), 0, 1.45, 0); return { group: g, top: 2.4, footprint: 1.8 }; },
  mermaid: () => { const g = new THREE.Group(); const r = add(g, ball(0.6), mat([110, 110, 104], 0.95), 0, 0.1, 0); r.scale.set(1.3, 0.6, 1); water(g, 1.3, 0, 0.4, 0.02, [70, 150, 190]);
    add(g, ball(0.16), mat([60, 110, 90], 0.3, { metalness: 0.4 }), 0.05, 0.62, 0); add(g, cyl(0.1, 0.16, 0.4, 10), mat([60, 110, 90], 0.3, { metalness: 0.4 }), 0.05, 0.4, 0); return { group: g, top: 1.0, footprint: 1.2 }; },
  market: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { add(g, box(0.6, 0.45, 0.6, 0.04), mat([240, 236, 226]), -0.9 + i * 0.6, 0.22, 0); add(g, box(0.66, 0.06, 0.7, 0.02), mat(i % 2 ? [220, 60, 50] : [255, 255, 255]), -0.9 + i * 0.6, 0.5, 0.05); } water(g, 1.2, 0, 1.2, 0.02, [70, 150, 190], 1.6, 0.5); return { group: g, top: 1.1, footprint: 1.6 }; },
  opera: () => { const g = new THREE.Group(); const w = add(g, box(2.8, 0.2, 2.0, 0.05), mat(0xffffff, 0.4), 0, 0.5, 0); w.rotation.x = 0.28; add(g, box(1.0, 1.1, 0.8, 0.05), mat([150, 200, 230], 0.15, { metalness: 0.2 }), 0.4, 0.8, -0.4); water(g, 1.4, 0, 1.6, 0.02, [70, 150, 190], 1.5, 0.5); return { group: g, top: 1.8, footprint: 2.0 }; },
  modern: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) add(g, box(0.8, 1.0 + i * 0.4, 0.8, 0.06), mat(i === 1 ? [150, 200, 230] : [236, 232, 224], 0.3, { metalness: i === 1 ? 0.2 : 0 }), -0.9 + i * 0.9, (1.0 + i * 0.4) / 2, 0); water(g, 1.5, 0, 1.3, 0.02, [70, 150, 190], 1.4, 0.5); return { group: g, top: 2.2, footprint: 1.8 }; },
  sculpture: () => { const g = new THREE.Group(); add(g, box(1.6, 0.2, 1.6, 0.05), mat([200, 196, 188]), 0, 0.1, 0); add(g, cyl(0.2, 0.28, 2.2, 10), mat([180, 176, 168], 0.8), 0, 1.3, 0);
    for (let i = 0; i < 6; i++) add(g, ball(0.12), mat([180, 176, 168], 0.8), Math.cos(i) * 0.6, 0.35, Math.sin(i) * 0.6); return { group: g, top: 2.6, footprint: 1.4 }; },
  cityhall: () => { const g = new THREE.Group(); add(g, box(1.6, 0.9, 1.0, 0.05), mat([170, 90, 64], 0.8), 0, 0.45, 0); for (const x of [-0.55, 0.55]) add(g, box(0.5, 2.2, 0.6, 0.05), mat([170, 90, 64], 0.8), x, 1.1, -0.1); add(g, box(0.3, 0.3, 0.02, 0.02), mat([240, 210, 120], 0.3, { metalness: 0.5 }), -0.55, 1.9, 0.21); return { group: g, top: 2.6, footprint: 1.4 }; },
  // ---------- 第二级：按类型的通用模型（潮玩比例、柔和配色，种子决定颜色与小变化；同一类型在不同地方长得不完全一样）
  temple: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const roof = pick<RGB>(r, [[112, 96, 104], [86, 104, 120], [150, 90, 86]]); const wood: RGB = [214, 96, 78];
    add(g, box(2.2, 0.18, 1.8, 0.05), mat([214, 206, 192], 0.9), 0, 0.09, 0);
    if (r.next() < 0.5) { const n = 3 + r.int(2); for (let i = 0; i < n; i++) { const w = 0.9 - i * 0.14; add(g, box(w * 0.7, 0.42, w * 0.7, 0.04), mat([246, 236, 220]), 0, 0.4 + i * 0.52, 0); const rf = add(g, cone(w * 0.95, 0.2, 4), mat(roof, 0.6), 0, 0.68 + i * 0.52, 0, Math.PI / 4); rf.scale.y = 0.8; }
      add(g, cyl(0.03, 0.03, 0.5, 8), mat([214, 180, 90], 0.4, { metalness: 0.4 }), 0, 0.72 + n * 0.52, 0); }
    else { add(g, box(1.5, 0.6, 1.0, 0.05), mat([246, 236, 220]), 0, 0.48, -0.2); const rf = add(g, cone(1.25, 0.55, 4), mat(roof, 0.6), 0, 1.05, -0.2, Math.PI / 4); rf.scale.set(1, 1, 0.72); }
    // 鸟居
    for (const sx of [-1, 1]) add(g, cyl(0.06, 0.07, 1.1, 10), mat(wood, 0.6), sx * 0.45, 0.55, 0.95);
    add(g, box(1.3, 0.08, 0.12, 0.03), mat(wood, 0.6), 0, 1.12, 0.95); add(g, box(1.05, 0.06, 0.08, 0.02), mat(wood, 0.6), 0, 0.92, 0.95);
    return { group: g, top: 2.6, footprint: 1.4 }; },
  mosque: () => { const g = new THREE.Group(); add(g, box(1.8, 0.7, 1.4, 0.05), mat([246, 238, 222]), 0, 0.35, 0);
    const d = add(g, new THREE.SphereGeometry(0.62, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat([120, 176, 190], 0.4), 0, 0.7, 0); d.scale.y = 1.2;
    add(g, cyl(0.12, 0.14, 2.2, 12), mat([246, 238, 222]), 1.05, 1.1, -0.5); add(g, cone(0.16, 0.4, 12), mat([120, 176, 190], 0.4), 1.05, 2.4, -0.5);
    return { group: g, top: 2.6, footprint: 1.4 }; },
  museum: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const stone: RGB = [240, 234, 222];
    add(g, box(2.4, 0.14, 1.7, 0.03), mat([214, 208, 198], 0.9), 0, 0.07, 0); add(g, box(2.2, 0.14, 1.5, 0.03), mat([226, 220, 210], 0.9), 0, 0.21, 0);
    add(g, box(2.0, 1.0, 1.0, 0.04), mat(stone), 0, 0.78, -0.2); const n = 4 + r.int(3);
    for (let i = 0; i < n; i++) add(g, cyl(0.07, 0.08, 0.9, 12), mat(stone, 0.6), -0.85 + (1.7 / (n - 1)) * i, 0.73, 0.5);
    add(g, box(2.1, 0.14, 1.5, 0.03), mat(stone), 0, 1.25, 0.05); add(g, prism(2.1, 0.46, 1.3), mat(pick<RGB>(r, [[176, 160, 214], [120, 136, 210], [214, 140, 150]]), 0.6), 0, 1.32, 0.05);
    return { group: g, top: 2.0, footprint: 1.4 }; },
  theater: () => { const g = new THREE.Group(); add(g, box(2.2, 0.8, 1.4, 0.06), mat([244, 238, 228]), 0, 0.4, 0);
    const shell = add(g, new THREE.CylinderGeometry(0.9, 0.9, 1.6, 24, 1, false, 0, Math.PI), mat([176, 160, 214], 0.5), 0, 0.8, 0); shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; shell.scale.set(1, 1, 0.6);
    add(g, box(0.5, 0.5, 0.05, 0.02), mat([255, 214, 150], 0.4, { emissive: C([255, 190, 120]), emissiveIntensity: 0.5 }), 0, 0.35, 0.71); return { group: g, top: 2.0, footprint: 1.4 }; },
  ruins: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const st: RGB = [214, 200, 178];
    add(g, box(2.4, 0.1, 1.8, 0.03), mat([198, 190, 170], 1), 0, 0.05, 0);
    for (let i = 0; i < 6; i++) { const h = 0.3 + r.next() * 1.3; add(g, cyl(0.12, 0.13, h, 12), mat(st, 0.9), -1 + (i % 3) * 1.0, h / 2 + 0.1, i < 3 ? -0.55 : 0.55); }
    for (let i = 0; i < 3; i++) { const b = add(g, box(0.5, 0.2, 0.26, 0.05), mat(st, 0.9), -0.6 + r.next() * 1.2, 0.2, -0.1 + r.next() * 0.3); b.rotation.y = r.next() * 3; }
    add(g, box(1.8, 0.45, 0.2, 0.04), mat(st, 0.9), 0.1, 0.32, -0.95); return { group: g, top: 1.8, footprint: 1.4 }; },
  monument: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); add(g, box(1.3, 0.25, 1.3, 0.05), mat([214, 208, 198], 0.9), 0, 0.12, 0); add(g, box(0.9, 0.3, 0.9, 0.05), mat([226, 220, 210], 0.9), 0, 0.4, 0);
    if (r.next() < 0.5) { const o = add(g, cone(0.3, 2.4, 4), mat([236, 232, 222], 0.8), 0, 1.75, 0, Math.PI / 4); o.scale.set(1, 1, 1); }
    else { add(g, cyl(0.2, 0.26, 0.9, 14), mat([140, 170, 160], 0.5, { metalness: 0.3 }), 0, 1.0, 0); add(g, ball(0.2), mat([140, 170, 160], 0.5, { metalness: 0.3 }), 0, 1.6, 0); }
    return { group: g, top: 2.8, footprint: 1.0 }; },
  bridge: () => { const g = new THREE.Group(); water(g, 1.1, 0, 0, 0.02, [110, 180, 214], 1.8, 0.8);
    const n = 9; for (let i = 0; i < n; i++) { const u = i / (n - 1) - 0.5; add(g, box(0.36, 0.14, 0.9, 0.04), mat([196, 108, 96], 0.8), u * 3.0, 0.2 + Math.cos(u * Math.PI) * 0.7, 0); }
    for (const sx of [-1, 1]) add(g, box(0.4, 0.5, 1.0, 0.05), mat([214, 200, 178], 0.9), sx * 1.6, 0.25, 0); return { group: g, top: 1.4, footprint: 1.8 }; },
  tower: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const col = pick<RGB>(r, [[232, 120, 96], [236, 232, 222], [120, 136, 210]]);
    for (let i = 0; i < 5; i++) { const w = 0.9 - i * 0.16; add(g, box(w, 0.7, w, 0.05), mat(i % 2 ? [246, 240, 230] : col), 0, 0.35 + i * 0.7, 0); }
    add(g, cyl(0.45, 0.45, 0.18, 20), mat([246, 240, 230]), 0, 2.9, 0); add(g, cyl(0.03, 0.03, 0.9, 8), mat(col), 0, 3.5, 0);
    return { group: g, top: 4.0, footprint: 1.0 }; },
  square: () => { const g = new THREE.Group(); add(g, cyl(1.4, 1.4, 0.06, 32), mat([226, 218, 204], 0.9), 0, 0.03, 0); water(g, 0.55, 0, 0, 0.14, [150, 206, 230]);
    add(g, cyl(0.56, 0.6, 0.18, 24), mat([236, 230, 220], 0.8), 0, 0.09, 0); add(g, cyl(0.07, 0.1, 0.6, 10), mat([236, 230, 220]), 0, 0.45, 0); steam(g, 0, 0, 0.75, 3, 0.1);
    for (const [x, z] of [[-1.1, 0.6], [1.1, -0.6]]) { add(g, cyl(0.03, 0.03, 1.0, 8), mat([70, 76, 96], 0.5), x, 0.5, z); add(g, ball(0.09), mat([255, 226, 160], 0.4, { emissive: C([255, 210, 140]), emissiveIntensity: 0.6 }), x, 1.02, z); }
    return { group: g, top: 1.4, footprint: 1.5 }; },
  viewpoint: () => { const g = new THREE.Group(); peak(g, 0, -0.6, 1.2, 1.6, false, [150, 170, 150]);
    add(g, box(1.2, 0.08, 0.8, 0.03), mat([176, 136, 100], 0.9), 0.3, 1.0, 0.5); for (const [x, z] of [[-0.2, 0.2], [0.8, 0.2], [-0.2, 0.85], [0.8, 0.85]]) add(g, cyl(0.04, 0.04, 1.0, 8), mat([150, 116, 86], 0.9), x, 0.5, z);
    add(g, box(1.2, 0.2, 0.04, 0.02), mat([150, 116, 86], 0.9), 0.3, 1.14, 0.9); add(g, cyl(0.07, 0.07, 0.24, 10), mat([80, 90, 120], 0.4), 0.3, 1.3, 0.7).rotation.x = Math.PI / 2;
    return { group: g, top: 1.9, footprint: 1.3 }; },
  themepark: () => { const g = new THREE.Group(); const wheel = new THREE.Group(); wheel.position.set(-0.4, 1.4, 0); g.add(wheel);
    add(wheel, new THREE.TorusGeometry(1.0, 0.05, 8, 40), mat([240, 206, 130], 0.5)); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const sp = add(wheel, box(0.04, 2.0, 0.04, 0.01), mat([246, 240, 230]), 0, 0, 0); sp.rotation.z = a; add(wheel, box(0.2, 0.18, 0.2, 0.05), mat(i % 2 ? [214, 140, 150] : [120, 136, 210], 0.6), Math.cos(a), Math.sin(a), 0); }
    for (const sx of [-1, 1]) { const l = add(g, box(0.06, 1.6, 0.06, 0.02), mat([246, 240, 230]), -0.4 + sx * 0.35, 0.7, 0); l.rotation.z = sx * 0.25; }
    add(g, cyl(0.6, 0.6, 0.3, 20), mat([246, 236, 220]), 1.2, 0.15, 0.4); add(g, cone(0.7, 0.5, 20), mat([214, 140, 150], 0.6), 1.2, 0.8, 0.4);
    return { group: g, top: 2.7, footprint: 1.6, update: (t) => { wheel.rotation.z = t * 0.3; } }; },
  zoo: () => { const g = new THREE.Group(); const dome = add(g, new THREE.SphereGeometry(0.9, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat([180, 220, 236], 0.1, { transparent: true, opacity: 0.55 }), 0, 0.1, 0); dome.castShadow = false;
    water(g, 0.8, 0, 0, 0.1, [90, 170, 214]); add(g, cyl(0.95, 0.95, 0.12, 28), mat([236, 230, 220]), 0, 0.06, 0);
    const fish = add(g, ball(0.14), mat([240, 160, 110], 0.5), 0.3, 0.45, 0); fish.scale.set(1.6, 1, 0.7); return { group: g, top: 1.3, footprint: 1.2, update: (t) => { fish.position.set(Math.cos(t) * 0.4, 0.45, Math.sin(t) * 0.4); fish.rotation.y = -t; } }; },
  hotspring: () => { const g = new THREE.Group(); water(g, 0.9, 0, 0, 0.06, [140, 214, 220], 1.3, 1);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const b = add(g, ball(0.22), mat([170, 164, 156], 0.95), Math.cos(a) * 1.2, 0.08, Math.sin(a) * 0.95); b.scale.y = 0.6; }
    steam(g, -0.2, 0, 0.2, 4, 0.2); steam(g, 0.35, 0.2, 0.2, 3, 0.16); return { group: g, top: 1.3, footprint: 1.5 }; },
  mountain: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); peak(g, 0, 0, 1.2, 2.8 + r.next() * 0.6); peak(g, -1.0, 0.4, 0.8, 1.7, r.next() < 0.5); peak(g, 0.9, 0.5, 0.7, 1.4, false, [140, 160, 140]);
    return { group: g, top: 3.4, footprint: 1.6 }; },
  trail: () => { const g = new THREE.Group(); peak(g, 0.4, -0.7, 1.1, 2.0, false, [140, 168, 136]);
    for (let i = 0; i < 6; i++) { const s = add(g, box(0.34, 0.05, 0.22, 0.04), mat([214, 200, 178], 0.95), -0.9 + i * 0.3, 0.03 + i * 0.12, 0.8 - i * 0.24); s.rotation.y = 0.4; }
    add(g, cyl(0.03, 0.03, 0.9, 8), mat([150, 116, 86], 0.9), -1.1, 0.45, 1.0); add(g, box(0.5, 0.16, 0.04, 0.02), mat([240, 206, 130], 0.7), -0.9, 0.8, 1.0);
    return { group: g, top: 2.2, footprint: 1.4 }; },
  lake: () => { const g = new THREE.Group(); water(g, 1.3, 0, 0, 0.03, [120, 186, 222], 1.3, 0.9);
    for (let i = 0; i < 7; i++) add(g, cyl(0.015, 0.015, 0.4 + (i % 3) * 0.1, 6), mat([150, 176, 120], 0.8), -1.4 + (i % 4) * 0.12, 0.2, 0.5 + Math.floor(i / 4) * 0.15);
    add(g, box(0.3, 0.05, 1.0, 0.02), mat([176, 136, 100], 0.9), 1.0, 0.1, 0.3); return { group: g, top: 1.0, footprint: 1.7 }; },
  fjord: () => { const g = new THREE.Group(); water(g, 1.2, 0, 0, 0.02, [80, 150, 200], 0.6, 1.5);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const h = 1.6 + ((i * 7) % 3) * 0.5; add(g, box(0.9, h, 1.0, 0.1), mat(i % 2 ? [130, 140, 150] : [150, 160, 170], 0.95), sx * 1.15, h / 2, -1 + i); add(g, box(0.92, 0.12, 1.02, 0.06), mat([140, 176, 130], 0.9), sx * 1.15, h + 0.04, -1 + i); }
    return { group: g, top: 2.8, footprint: 1.8 }; },
  cave: () => { const g = new THREE.Group(); const m = add(g, ball(1.2), mat([150, 144, 150], 0.95), 0, 0, -0.2); m.scale.set(1.2, 0.85, 0.9);
    const hole = add(g, new THREE.CircleGeometry(0.45, 20, 0, Math.PI), mat([40, 36, 48], 1), 0, 0.02, 0.85); hole.castShadow = false; return { group: g, top: 1.3, footprint: 1.4 }; },
  forest: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const greens: RGB[] = [[134, 176, 128], [156, 196, 140], [118, 160, 140], [176, 204, 150]];
    for (let i = 0; i < 9; i++) { const x = (r.next() - 0.5) * 2.4, z = (r.next() - 0.5) * 1.8, s = 0.35 + r.next() * 0.3; add(g, cyl(0.05, 0.07, s * 1.2, 8), mat([150, 116, 86], 0.9), x, s * 0.6, z); const c = add(g, ball(s), mat(pick(r, greens), 0.95), x, s * 1.3, z); c.scale.y = 1.15; }
    add(g, box(0.6, 0.08, 0.2, 0.03), mat([176, 136, 100], 0.9), 0.2, 0.22, 1.0); return { group: g, top: 1.6, footprint: 1.6 }; },
  food: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const aw = pick<RGB>(r, [[214, 140, 150], [120, 136, 210], [140, 176, 150], [240, 206, 130]]);
    add(g, box(1.2, 0.8, 0.9, 0.06), mat([246, 238, 226]), 0, 0.4, 0); for (let i = 0; i < 5; i++) { const a = add(g, box(0.24, 0.04, 0.4, 0.01), mat(i % 2 ? [255, 255, 255] : aw, 0.7), -0.48 + i * 0.24, 0.7, 0.6); a.rotation.x = 0.35; }
    add(g, box(0.5, 0.35, 0.02, 0.01), mat([255, 220, 160], 0.4, { emissive: C([255, 196, 120]), emissiveIntensity: 0.5 }), 0, 0.35, 0.46);
    add(g, cyl(0.2, 0.2, 0.04, 16), mat([246, 240, 230]), 0.9, 0.4, 0.7); add(g, cyl(0.02, 0.02, 0.4, 6), mat([120, 120, 130]), 0.9, 0.2, 0.7); return { group: g, top: 1.4, footprint: 1.2 }; },
  shop: (seed) => { const g = new THREE.Group(); const r = mulberry32(seed); const c = pick<RGB>(r, [[176, 160, 214], [120, 136, 210], [214, 140, 150]]);
    add(g, box(1.3, 1.1, 0.9, 0.06), mat([246, 238, 226]), 0, 0.55, 0); add(g, box(1.34, 0.22, 0.94, 0.05), mat(c, 0.6), 0, 1.1, 0);
    add(g, box(0.9, 0.5, 0.02, 0.01), mat([200, 226, 240], 0.2, { emissive: C([200, 220, 255]), emissiveIntensity: 0.25 }), 0, 0.45, 0.46); return { group: g, top: 1.6, footprint: 1.1 }; },
  station: () => { const g = new THREE.Group(); add(g, box(2.6, 0.2, 0.8, 0.04), mat([214, 208, 198], 0.9), 0, 0.1, 0); add(g, box(2.6, 0.08, 1.0, 0.03), mat([120, 136, 210], 0.6), 0, 1.0, 0);
    for (const x of [-1.1, 0, 1.1]) add(g, cyl(0.04, 0.04, 0.8, 8), mat([236, 230, 220]), x, 0.6, -0.3);
    for (let i = 0; i < 2; i++) add(g, box(1.0, 0.5, 0.5, 0.14), mat(i ? [246, 240, 230] : [214, 140, 150], 0.6), -0.55 + i * 1.08, 0.35, 0.75); return { group: g, top: 1.5, footprint: 1.6 }; },
  sight: () => { const l = T.cairn(0); const p = new THREE.Group(); p.position.set(0.1, 1.2, 0); l.group.add(p); add(p, cyl(0.02, 0.02, 0.6, 6), mat([236, 230, 220]), 0, 0.3, 0);
    const f = add(p, cone(0.14, 0.34, 3), mat([240, 176, 58], 0.7), 0.17, 0.48, 0); f.rotation.z = -Math.PI / 2; return { ...l, top: 1.9, update: (t) => { p.rotation.y = Math.sin(t * 1.6) * 0.3; } }; },
  cairn: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = add(g, box(0.5 - i * 0.07, 0.22, 0.45 - i * 0.06, 0.1), mat([150, 146, 140], 0.95), 0, 0.11 + i * 0.2, 0); b.rotation.y = i * 0.7; } return { group: g, top: 1.3, footprint: 0.8 }; },
};

/** 类型 → 通用模型（第二级）。老街小镇按种子在两种里挑 */
const KIND_MODEL: Record<string, string | ((seed: number) => string)> = {
  temple: "temple", mosque: "mosque", church: "church", castle: "palace", museum: "museum", theater: "theater", ruins: "ruins", monument: "monument",
  bridge: "bridge", tower: "tower", square: "square", oldtown: (s) => (s % 2 ? "rowHouses" : "fishingVillage"),
  viewpoint: "viewpoint", cablecar: "cablecar", themepark: "themepark", zoo: "zoo",
  geyser: "geyser", hotspring: "hotspring", volcano: "crater", waterfall: "waterfall", glacier: "glacier", beach: "beach", fjord: "fjord", cave: "cave",
  lake: "lake", trail: "trail", forest: "forest", mountain: "mountain", market: "market", food: "food", shop: "shop",
  airport: "airport", port: "port", station: "station", hotel: "hotel", sight: "sight",
};
export interface PlaceRef { name: string; category?: string; kind?: string; lat?: number; lng?: number }
/** 分级挑模型：名胜（专门的模型）→ 类型（通用模型）→ 兜底（路标石堆 + 小旗）。结果里带上 tier / kind，界面据此显示图标与说明 */
export function landmarkFor(p: PlaceRef, seed: number): Landmark & { tier: Tier; kind: string } {
  const t = tierOf(p, classifyPlace);
  const fm = t.famous?.model ? T[t.famous.model] ?? WORLD_MODELS[t.famous.model] : undefined;
  if (t.tier === "famous" && fm) return { ...fm(seed), tier: "famous", kind: t.kind };
  const km = KIND_MODEL[t.kind] ?? "sight"; const key = typeof km === "function" ? km(seed) : km;
  return { ...(T[key] ?? T.sight)(seed), tier: t.tier, kind: t.kind };
}
export { house, peak, NORDIC };
