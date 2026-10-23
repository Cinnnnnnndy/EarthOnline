/** 角色（第八轮末，D86）：小人（hero.ts）与 Q 版的动物 / 自建 IP（mascot.ts）走同一个接口，世界、行李箱、实验台按 Avatar.form 挑一个。
 *  form 没写或是 "human" 就是小人；换形态要重建（makeCharacter），同一个形态只换颜色（setAvatar）。 */
import type * as THREE from "three";
import type { Avatar, AvatarForm } from "../spec/types.ts";
import { Hero, type Outfit, type Vehicle } from "./hero.ts";
import { Mascot, isMascotForm } from "./mascot.ts";

export interface Character {
  readonly group: THREE.Group;
  beforeShow: ((o: THREE.Object3D) => Promise<unknown>) | null;
  setAvatar(av: Avatar, outfit?: Outfit): void;
  setOutfit(o: Outfit): void;
  readonly currentOutfit: Outfit;
  setVehicle(v: Vehicle): void;
  face(dx: number, dz: number): void;
  celebrate(seconds?: number): void;
  update(dt: number, speed: number): void;
  dispose(): void;
}

export const formOf = (av: Pick<Avatar, "form"> | null | undefined): AvatarForm => (av && isMascotForm(av.form) ? av.form : "human");

/** 按形态建一个角色：小人要脸的贴图地址；S 与小人的尺寸参数同义 */
export function makeCharacter(av: Avatar, faceUrl: string, S = 0.36): Character {
  const form = formOf(av);
  return form === "human" ? new Hero(faceUrl, S) : new Mascot(form, S);
}
