import { Avatar } from './Spec';

/** 默认形象（D101）：和网页 shared/world/avatar-presets.ts、iOS AvatarPresets.swift 同一份——小王、小伍、福贵（银白长毛猫）。
 *  颜色都是 hero.ts 调色板里的序号；点一下整套换上，行李箱款式保留。 */
export interface AvatarPreset {
  id: string;
  icon: string;   // components/Icons 的名字
  avatar: Avatar;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  // 齐肩的深棕头发、驼色毛衣、奶油色的毛绒拖鞋
  { id: 'xiaowang', icon: 'person', avatar: { skin: 0, hair: 'long', hairColor: 0, dress: 6, hat: 'none', hatColor: 0, shoes: 2, name: '小王' } },
  // 短短的黑头发、细框眼镜、蓝色麻花毛衣、深灰的鞋
  { id: 'xiaowu', icon: 'person', avatar: { skin: 0, hair: 'short', hairColor: 1, dress: 1, hat: 'none', hatColor: 0, shoes: 1, name: '小伍', glasses: true } },
  // 银白长毛、绿眼睛的猫
  { id: 'fugui', icon: 'sparkle', avatar: { skin: 0, hair: 'short', hairColor: 0, dress: 0, hat: 'none', hatColor: 0, shoes: 0, name: '福贵', form: 'persian' } },
];

/** 换上一套：保留自己的行李箱，其余按预设（没写的可选项清掉，免得上一套的眼镜、形态留下来） */
export function applyPreset(cur: Avatar, p: AvatarPreset): Avatar {
  const a = JSON.parse(JSON.stringify(p.avatar)) as Avatar;
  if (cur.suitcase !== undefined) a.suitcase = cur.suitcase;
  return a;
}
