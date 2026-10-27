/** 默认形象（D101）：仓库主人给的一张 Q 版合照里的三位——小王、小伍、福贵（一只银白长毛猫）。
 *  捏人面板最上面一排，点一下整套换上（行李箱不动）；之后还能再细调。颜色都是 hero.ts 调色板里的序号。 */
import type { Avatar } from "../spec/types.ts";

export interface AvatarPreset { id: string; avatar: Omit<Avatar, "suitcase"> }

export const AVATAR_PRESETS: AvatarPreset[] = [
  // 齐肩的深棕头发、驼色毛衣、奶油色的毛绒拖鞋
  { id: "xiaowang", avatar: { skin: 0, hair: "long", hairColor: 0, dress: 6, hat: "none", hatColor: 0, shoes: 2, name: "小王" } },
  // 短短的黑头发、细框眼镜、蓝色麻花毛衣、深灰的鞋
  { id: "xiaowu", avatar: { skin: 0, hair: "short", hairColor: 1, dress: 1, hat: "none", hatColor: 0, shoes: 1, name: "小伍", glasses: true } },
  // 银白长毛、绿眼睛的猫
  { id: "fugui", avatar: { skin: 0, hair: "short", hairColor: 0, dress: 0, hat: "none", hatColor: 0, shoes: 0, name: "福贵", form: "persian" } },
];

/** 换上一套默认形象：保留自己的行李箱款式，其余按预设（没写的可选项清掉，免得上一套的眼镜、形态留下来） */
export function applyPreset(cur: Avatar, p: AvatarPreset): Avatar {
  return { ...p.avatar, suitcase: cur.suitcase, form: p.avatar.form, glasses: p.avatar.glasses };
}
