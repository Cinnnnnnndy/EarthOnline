/** 角色实验台：单独看小人（正面 / 四分之三 / 侧面 / 背面、走路、载具、换装），美术迭代用。URL 参数 ?view=front|three|side|back&outfit=puffer|dress&hat=cap|straw|none&vehicle=car&zoom=face */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DEFAULT_AVATAR, type Outfit, type Vehicle } from "../../shared/world/hero.ts";
import { makeCharacter, type Character } from "../../shared/world/character.ts";
import { AVATAR_FORMS, type Avatar, type AvatarForm } from "../../shared/spec/types.ts";
import { mountBackdrop } from "./backdrop.ts";
import { landmarkFor } from "../../shared/world/landmarks.ts";
import { KINDS } from "../../shared/world/landmark-kinds.ts";
import { FAMOUS } from "../../shared/world/landmark-famous.ts";
import { ALL_SOUVENIRS } from "../../shared/geo/souvenirs.ts";
import { souvenirModel } from "../../shared/world/souvenir-models.ts";
import { extraModel } from "../../shared/world/extra-models.ts";
import { applyToyLook } from "../../shared/world/look.ts";
import { EXTRA_KINDS } from "../../shared/planner/protocol.ts";
import { t, type MsgKey } from "../../shared/i18n/index.ts";
import { ItemIcons, type IconRef } from "../../shared/world/item-icons.ts";

const q = new URLSearchParams(location.search);
const host = document.getElementById("lab")!;
mountBackdrop(host, (q.get("pal") as "sea") ?? "sea", q.get("phase") === "night" ? "night" : "day");   // 实验台默认白天；?phase=night 看夜里
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.08;   // D89：与世界同一种色调映射
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.domElement.style.cssText = "position:absolute;inset:0"; host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
scene.add(new THREE.HemisphereLight(0xdcecff, 0xb8c8a0, 1.1));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6); sun.position.set(-3, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
const rim = new THREE.DirectionalLight(0xffd2a8, 2.2); rim.position.set(4, 4, -5); scene.add(rim);
const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: 0xcfe7b0, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
// ?form=xiaowang|xiaowu|fugui（D101，仓库主人一家）|fox|cat|shiba|bear|rabbit|penguin|panda|duck|bean|cloud|pebble：Q 版的动物 / 自建 IP（D86）；不给是小人
const av: Avatar = { ...DEFAULT_AVATAR, hat: (q.get("hat") as Avatar["hat"]) ?? DEFAULT_AVATAR.hat, hair: (q.get("hair") as Avatar["hair"]) ?? DEFAULT_AVATAR.hair, dress: +(q.get("color") ?? 0), form: (q.get("form") as AvatarForm) ?? "human" };
const hero: Character = makeCharacter(av, import.meta.env.BASE_URL + "assets/hero_face.png", 0.36);
hero.setAvatar(av, (q.get("outfit") as Outfit) ?? "puffer"); hero.setVehicle((q.get("vehicle") as Vehicle) ?? null); scene.add(hero.group);
const cam = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 100);
const VIEWS: Record<string, number> = { front: 0, three: 0.6, side: Math.PI / 2, back: Math.PI };
let az = VIEWS[q.get("view") ?? "three"] ?? 0.6; const walking = q.get("walk") === "1";
const face = q.get("zoom") === "face";
const place = () => { const d = face ? 1.55 : q.get("vehicle") ? 6.2 : 4.4; const y = face ? 1.28 : 1.35, ly = face ? 1.26 : 1.0; cam.position.set(Math.sin(az) * d, y, Math.cos(az) * d); cam.lookAt(0, ly, 0); };
place();
addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
let last = performance.now(); let drag: number | null = null;
renderer.domElement.addEventListener("pointerdown", (e) => (drag = e.clientX)); addEventListener("pointerup", () => (drag = null));
addEventListener("pointermove", (e) => { if (drag !== null) { az -= (e.clientX - drag) * 0.01; drag = e.clientX; place(); } });
// ?lm=kind：所有类型的通用模型排成一格一格；?lm=famous：已做的名胜模型
const lmMode = q.get("lm"); const lmUpd: ((t: number) => void)[] = [];
// ?lm=forms：全部形态排一排（D86）：小人 + 仓库主人一家三口 + 十一只动物 + 三只自建 IP，各戴各的帽子
const chars: Character[] = [];
if (lmMode === "forms") {
  hero.group.visible = false; ground.visible = false;
  const cols = 5, sp = 2.5, rsp = 3.4; const rows = Math.ceil(AVATAR_FORMS.length / cols);   // 18 只：五列四行   // 行距比列距大：镜头偏低，后排不能被前排挡住
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(cols * sp + 2, rows * rsp + 2), new THREE.MeshStandardMaterial({ color: 0xd8ecc4, roughness: 0.95 })); plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; scene.add(plane);
  const placed: [string, THREE.Vector3][] = [];
  AVATAR_FORMS.forEach((form, i) => {
    // 帽子轮着戴；会把特征挡住的（海獭的蛤蜊、水豚的柚子、海豹的斑点、云团整朵）不戴，草帽只给头大的几只
    const bare = ["xiaowang", "xiaowu", "fugui", "seal", "otter", "capybara", "cloud", "pebble", "bean"].includes(form);
    const a: Avatar = { ...DEFAULT_AVATAR, form, hat: bare ? "none" : (["cap", "straw", "cap", "none"] as const)[i % 4], hatColor: i % 4, dress: i % 6 };
    const c = makeCharacter(a, import.meta.env.BASE_URL + "assets/hero_face.png", 0.36); c.setAvatar(a, "puffer");
    const x = ((i % cols) - (cols - 1) / 2) * sp, z = (Math.floor(i / cols) - (rows - 1) / 2) * rsp; c.group.position.set(x, 0, z); c.group.rotation.y = 0.25; scene.add(c.group); chars.push(c);
    placed.push([t(`avatar.form.${form}` as MsgKey), new THREE.Vector3(x, 0, z + 0.95)]);
  });
  sun.shadow.camera.left = sun.shadow.camera.bottom = -10; sun.shadow.camera.right = sun.shadow.camera.top = 10; sun.shadow.camera.updateProjectionMatrix();
  const ext = Math.max(rows * rsp * 1.0, ((cols * sp) / Math.min(1.6, innerWidth / innerHeight)) * 1.3, 6);   // 近处那一排透视更宽，左右多留一点
  cam.fov = 30; cam.aspect = innerWidth / innerHeight; cam.position.set(0, ext * 1.15, ext * 1.4); cam.lookAt(0, 0.5, 0); cam.updateProjectionMatrix();
  cam.updateMatrixWorld(); for (const [name, v] of placed) { const pr = v.clone().project(cam); const d = document.createElement("div"); d.textContent = name;
    d.style.cssText = `position:fixed;left:${(pr.x + 1) / 2 * innerWidth}px;top:${(1 - pr.y) / 2 * innerHeight}px;transform:translate(-50%,0);font:13px/1.2 sans-serif;color:#1E2640;background:rgba(255,255,255,.8);padding:2px 7px;border-radius:7px;z-index:9;white-space:nowrap`; document.body.append(d); }
// ?lm=icons：同一批东西按类 emoji 的图标排（item-icons.ts，D84）：固定的好角度、透明底、脚下一圈影子；全部渲染完 window.__iconsDone = true
} else if (lmMode === "icons") {
  hero.group.visible = false; ground.visible = false; renderer.domElement.style.display = "none";
  const icons = new ItemIcons({ size: 128, pixelRatio: 2, persist: false });
  const grid = document.createElement("div"); grid.style.cssText = "position:fixed;inset:0;overflow:auto;padding:28px 24px;display:grid;grid-template-columns:repeat(auto-fill,104px);gap:16px 8px;justify-content:center;align-content:start;background:#f4f5f8;z-index:5";
  document.body.append(grid);
  const list: { name: string; sub: string; ref: IconRef }[] = [
    ...ALL_SOUVENIRS.map((x) => ({ name: x.item.zh, sub: x.country, ref: { type: "souvenir", id: x.item.id } as IconRef })),
    ...EXTRA_KINDS.map((k) => ({ name: t(`case.extra.${k}` as MsgKey), sub: "", ref: { type: "extra", kind: k } as IconRef })),
  ];
  let done = 0;
  for (const it of list) {
    const cell = document.createElement("div"); cell.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;font:11px/1.3 sans-serif;color:#1D1E23;text-align:center";
    const img = document.createElement("img"); img.style.cssText = "width:88px;height:88px;object-fit:contain"; const cap = document.createElement("div"); cap.textContent = it.name; const sub = document.createElement("div"); sub.textContent = it.sub; sub.style.color = "#8A8D96";
    cell.append(img, cap, sub); grid.append(cell);
    icons.get(it.ref).then((u) => { img.src = u; }).catch(() => { cap.textContent += " ×"; }).finally(() => { if (++done === list.length) (window as unknown as { __iconsDone: boolean }).__iconsDone = true; });
  }
} else if (lmMode === "case") {
  hero.group.visible = false; ground.visible = false;
  const list: { name: string; make: () => THREE.Group }[] = [
    ...ALL_SOUVENIRS.map((x) => ({ name: `${x.country} · ${x.item.zh}`, make: () => souvenirModel(x.item.id, x.item.zh, 1).group })),
    ...EXTRA_KINDS.map((k) => ({ name: t(`case.extra.${k}` as MsgKey), make: () => extraModel(k).group })),
  ];
  const cols = 9, sp = 2.9; const rows = Math.ceil(list.length / cols);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(cols * sp + 2, rows * sp + 2), new THREE.MeshStandardMaterial({ color: 0xeceef3, roughness: 0.95 })); plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; scene.add(plane);
  scene.environmentIntensity = 0.45; sun.intensity = 2.4; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.15; const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(0, 8, 16); scene.add(fill);
  const placed: [string, THREE.Vector3][] = [];
  list.forEach((it, i) => {
    const g = it.make(); applyToyLook(g); g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); const size = b.getSize(new THREE.Vector3());
    const k = Math.min(1.7 / Math.max(0.2, size.x), 1.7 / Math.max(0.2, size.z), 1.7 / Math.max(0.2, size.y)); g.scale.setScalar(k); g.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(g); const c = b2.getCenter(new THREE.Vector3());
    const x = ((i % cols) - (cols - 1) / 2) * sp, z = (Math.floor(i / cols) - (rows - 1) / 2) * sp; g.position.set(x - c.x, -b2.min.y, z - c.z); scene.add(g); placed.push([it.name, new THREE.Vector3(x, 0, z + 1.15)]);
  });
  sun.shadow.camera.left = sun.shadow.camera.bottom = -16; sun.shadow.camera.right = sun.shadow.camera.top = 16; sun.shadow.camera.updateProjectionMatrix();
  const ext = Math.max(rows * sp * 1.05, ((cols * sp) / Math.min(1.6, innerWidth / innerHeight)) * 1.25, 8);
  cam.fov = 30; cam.aspect = innerWidth / innerHeight; cam.position.set(0, ext * 1.35, ext * 1.0); cam.lookAt(0, 0, 0.6); cam.updateProjectionMatrix();
  cam.updateMatrixWorld(); for (const [name, v] of placed) { const pr = v.clone().project(cam); const d = document.createElement("div"); d.textContent = name;
    d.style.cssText = `position:fixed;left:${(pr.x + 1) / 2 * innerWidth}px;top:${(1 - pr.y) / 2 * innerHeight}px;transform:translate(-50%,0);font:11px/1.2 sans-serif;color:#1D1E23;background:rgba(255,255,255,.8);padding:1px 5px;border-radius:6px;z-index:9;white-space:nowrap`; document.body.append(d); }
} else if (lmMode) {
  hero.group.visible = false; ground.visible = false;
  const region = q.get("region"); const list = lmMode === "famous" ? FAMOUS.filter((f) => f.model && (!region || f.region === region)).map((f) => ({ name: f.name, kind: f.kind, category: "sight" })) : KINDS.map((k) => ({ name: "", kind: k.id, category: k.group === "stay" ? "hotel" : k.id === "airport" || k.id === "port" || k.id === "station" ? k.id : "sight" }));
  const cols = 6, sp = 4.6; const rows = Math.ceil(list.length / cols);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(cols * sp + 2, rows * sp + 2), new THREE.MeshStandardMaterial({ color: 0xd8ecc4, roughness: 0.95 })); plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; scene.add(plane);
  const placed: [string, THREE.Vector3][] = [];
  list.forEach((p, i) => { const lm = landmarkFor(p, 7 + i); const x = ((i % cols) - (cols - 1) / 2) * sp, z = (Math.floor(i / cols) - (rows - 1) / 2) * sp; lm.group.position.set(x, 0, z); scene.add(lm.group); if (lm.update) lmUpd.push(lm.update); placed.push([p.name || p.kind, new THREE.Vector3(x, 0, z + 1.6)]); });
  sun.shadow.camera.left = sun.shadow.camera.bottom = -18; sun.shadow.camera.right = sun.shadow.camera.top = 18; sun.shadow.camera.updateProjectionMatrix();
  // 取景按行数和列数里更宽的那个算（第八轮：只有一两行时也要装下六列，不然非洲、大洋洲那页会被切掉）
  const ext = Math.max(rows * sp, ((cols * sp) / Math.min(1.6, innerWidth / innerHeight)) * 1.15, 12);   // 1.15：近处那一行透视更宽，留出余量
  cam.fov = 34; cam.aspect = innerWidth / innerHeight; cam.position.set(0, ext * 1.25, ext * 1.35); cam.lookAt(0, 0, 0.6); cam.updateProjectionMatrix();
  // 每个模型下面标上名字（核对用）
  cam.updateMatrixWorld(); for (const [name, v] of placed) { const pr = v.clone().project(cam); const d = document.createElement("div"); d.textContent = name;
    d.style.cssText = `position:fixed;left:${(pr.x + 1) / 2 * innerWidth}px;top:${(1 - pr.y) / 2 * innerHeight}px;transform:translate(-50%,0);font:12px/1.2 sans-serif;color:#1E2640;background:rgba(255,255,255,.8);padding:2px 6px;border-radius:6px;z-index:9;white-space:nowrap`; document.body.append(d); }
}
const loop = (t: number) => { lmUpd.forEach((u) => u(t / 1000)); requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t; hero.update(dt, walking ? 1 : 0); for (const c of chars) c.update(dt, walking ? 1 : 0); renderer.render(scene, cam); };
requestAnimationFrame(loop);
(window as unknown as { __ready: boolean }).__ready = true;
