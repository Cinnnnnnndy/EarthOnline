/** 夜里提一盏灯（D94）：D85 留下的「小人提一盏灯」。夜里某一天的世界里，不管是小人、动物还是自建 IP，手边都提着一盏暖黄的小纸灯，
 *  走路时轻轻晃，脚下照出一圈暖光——参考仓库主人发来的 Blender 夜林里那团暖光。白天收起来。
 *  做成一个独立的小道具挂在角色的 group 上（不改 Hero / Mascot），世界层在换角色时重新挂。尺寸按角色的高度定（小人的网格是异步建的，高度量到了才摆）。 */
import * as THREE from "three";
import { mat, add, cyl, ball } from "./landmark-kit.ts";
import { col, LANTERN } from "./style.ts";
import { halo } from "./night.ts";

export class Lantern {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private light: THREE.PointLight;
  private glow: THREE.Sprite;
  private sized = false; private t = 0; private on = false;

  constructor() {
    this.group.visible = false; this.group.add(this.body);
    // 一根小提杆 + 一段弯把手，下面吊着圆鼓鼓的纸灯：深色的上下盖、暖黄发光的灯身、底下一颗小坠
    const ink = mat([60, 50, 46], 0.6), paper = new THREE.MeshStandardMaterial({ color: col(LANTERN), emissive: col(LANTERN), emissiveIntensity: 1.6, roughness: 0.7 });
    paper.userData.shared = false;
    add(this.body, cyl(0.012, 0.012, 0.32, 6), ink, 0, 0.16, 0).rotation.z = 0.5;               // 提杆（手握的那头在原点）
    const lamp = new THREE.Group(); lamp.position.set(0.15, 0.2, 0); this.body.add(lamp);
    add(lamp, cyl(0.004, 0.004, 0.09, 4), ink, 0, -0.045, 0);                                   // 吊绳
    const shade = add(lamp, ball(0.085), paper, 0, -0.16, 0); shade.scale.set(1, 1.15, 1); shade.castShadow = false;
    add(lamp, cyl(0.05, 0.06, 0.025, 12), ink, 0, -0.07, 0); add(lamp, cyl(0.06, 0.05, 0.025, 12), ink, 0, -0.255, 0);
    add(lamp, ball(0.012), mat([220, 80, 60], 0.5), 0, -0.29, 0);
    this.glow = halo(LANTERN, 0.7, 0.75); this.glow.position.set(0, -0.16, 0); lamp.add(this.glow);
    this.light = new THREE.PointLight(col(LANTERN), 0, 3.2, 2); this.light.position.set(0, -0.16, 0); this.light.castShadow = false; lamp.add(this.light);
    this.body.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
  }

  /** 挂到一个角色上（换角色时再挂一次） */
  attach(parent: THREE.Object3D) { this.group.removeFromParent(); parent.add(this.group); this.sized = false; }
  setOn(on: boolean) { this.on = on; this.group.visible = on; this.light.intensity = on ? 2.2 : 0; }

  /** 每帧：量到角色的高度后摆到手边；走路时晃，站着轻轻摆；光晕微微闪 */
  update(dt: number, walking: boolean) {
    if (!this.on) return; this.t += dt;
    const parent = this.group.parent;
    if (!this.sized && parent) {
      this.group.visible = false; const b = new THREE.Box3().setFromObject(parent); this.group.visible = true;
      const h = b.isEmpty() ? 0 : (b.max.y - b.min.y) / Math.max(1e-3, parent.getWorldScale(new THREE.Vector3()).y);
      if (h > 0.2) { const k = h / 1.6; this.body.scale.setScalar(k); this.group.position.set(h * 0.27, h * 0.36, h * 0.12); this.light.distance = 3.2 * k; this.sized = true; }
    }
    this.body.rotation.z = Math.sin(this.t * (walking ? 7 : 1.6)) * (walking ? 0.18 : 0.05);
    this.body.rotation.x = Math.sin(this.t * (walking ? 3.5 : 1.1)) * (walking ? 0.08 : 0.02);
    (this.glow.material as THREE.SpriteMaterial).opacity = 0.7 + Math.sin(this.t * 5.3) * 0.05 + Math.sin(this.t * 13.1) * 0.03;
  }

  dispose() { this.group.removeFromParent(); this.body.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); (this.glow.material as THREE.Material).dispose(); }
}
