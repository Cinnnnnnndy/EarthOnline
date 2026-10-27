package app.earthonline.android.model

/** 默认形象（D101）：和网页 shared/world/avatar-presets.ts、iOS AvatarPresets.swift 同一份——小王、小伍、福贵（银白长毛猫）。
 *  颜色都是 hero.ts 调色板里的序号；点一下整套换上，行李箱款式保留。 */
data class AvatarPreset(val id: String, val avatar: Avatar) {
    /** 换上：保留自己的行李箱 */
    fun appliedTo(cur: Avatar): Avatar = avatar.copy(suitcase = cur.suitcase)

    companion object {
        val all = listOf(
            // 齐肩的深棕头发、驼色毛衣、奶油色的毛绒拖鞋
            AvatarPreset("xiaowang", Avatar(skin = 0, hair = "long", hairColor = 0, dress = 6, hat = "none", hatColor = 0, shoes = 2, name = "小王")),
            // 短短的黑头发、细框眼镜、蓝色麻花毛衣、深灰的鞋
            AvatarPreset("xiaowu", Avatar(skin = 0, hair = "short", hairColor = 1, dress = 1, hat = "none", hatColor = 0, shoes = 1, name = "小伍", glasses = true)),
            // 银白长毛、绿眼睛的猫
            AvatarPreset("fugui", Avatar(skin = 0, hair = "short", hairColor = 0, dress = 0, hat = "none", hatColor = 0, shoes = 0, name = "福贵", form = "persian")),
        )
    }
}
