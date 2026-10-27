import Foundation

/// 默认形象（D101）：和网页 shared/world/avatar-presets.ts 同一份——小王、小伍、福贵（银白长毛猫）。
/// 颜色都是 hero.ts 调色板里的序号；点一下整套换上，行李箱款式保留。
struct AvatarPreset: Identifiable {
    let id: String
    let symbol: String
    let avatar: Avatar

    static let all: [AvatarPreset] = [
        // 齐肩的深棕头发、驼色毛衣、奶油色的毛绒拖鞋
        AvatarPreset(id: "xiaowang", symbol: "person.fill", avatar: make(name: "小王", hair: "long", hairColor: 0, dress: 6, shoes: 2)),
        // 短短的黑头发、细框眼镜、蓝色麻花毛衣、深灰的鞋
        AvatarPreset(id: "xiaowu", symbol: "eyeglasses", avatar: make(name: "小伍", hair: "short", hairColor: 1, dress: 1, shoes: 1, glasses: true)),
        // 银白长毛、绿眼睛的猫
        AvatarPreset(id: "fugui", symbol: "cat.fill", avatar: make(name: "福贵", hair: "short", hairColor: 0, dress: 0, shoes: 0, form: "persian")),
    ]

    private static func make(name: String, hair: String, hairColor: Int, dress: Int, shoes: Int, glasses: Bool? = nil, form: String? = nil) -> Avatar {
        var a = Avatar()
        a.skin = 0; a.hair = hair; a.hairColor = hairColor; a.dress = dress; a.hat = "none"; a.hatColor = 0; a.shoes = shoes
        a.name = name; a.glasses = glasses; a.form = form
        return a
    }

    /// 换上：保留自己的行李箱
    func applied(to cur: Avatar) -> Avatar {
        var a = avatar
        a.suitcase = cur.suitcase
        return a
    }
}
