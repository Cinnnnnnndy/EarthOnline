import SwiftUI

/// 设计令牌（shared/world/tokens.ts 的原生版）。规则只有三条：
///  1. 强调色已去色（第八轮）：能点的、选中的、路线一律用墨（深色外观下是白），不再有蓝紫色；名字 eoLake 保留，值同墨；
///  2. 高亮色只有一个「晨」：现在（旅行中、今天）与去过（打过卡、足迹旗）；
///  3. 其余全是系统的墨色层级（primary / secondary / tertiary）与玻璃。
/// 颜色在 Assets.xcassets 里（Any / Dark 两套）。
extension Color {
    /// 强调（已去色）#1E2640（深色外观 #EEF0FA）：与墨相同，不再是湖蓝
    static let eoLake = Color("Lake")
    /// 晨 #F0B03A（夜 #F5BE4E）：填充、图标
    static let eoDawn = Color("Dawn")
    /// 晨 · 字 #754A00（夜 #F5C766）：浅底上的晨色文字（第八轮校准：晨填充的标签上 ≥ 4.5）
    static let eoDawnInk = Color("DawnInk")
    /// 墨 · 次 #444C6A（夜 #C9CDE0）：标签文字；行的第二行仍用系统的 secondary（随「增强对比度」变深）
    static let eoInk2 = Color("Ink2")

    /// 地球外的底色（画布画好之前、边缘露出来的颜色）
    static func space(_ phase: SkyPhase) -> Color {
        switch phase {
        case .day: return Color(red: 0x9C / 255, green: 0xB4 / 255, blue: 0xF0 / 255)
        case .dusk: return Color(red: 0x6A / 255, green: 0x5A / 255, blue: 0x9E / 255)
        case .night: return Color(red: 0x14 / 255, green: 0x1A / 255, blue: 0x4A / 255)
        }
    }

    /// 新建旅程胶囊的三段色（第八轮续）：全应用唯一带颜色的按钮——蜜 → 晨 → 琥珀，只有晨色一个色相（珊瑚那一端和天空打架，去掉了）；深色外观下底深一档，字一直是墨
    static let dreamInk = Color(red: 0x1E / 255, green: 0x26 / 255, blue: 0x40 / 255)
    static let dreamHoney = Color(red: 0xF6 / 255, green: 0xD5 / 255, blue: 0x8C / 255)
    static let dreamDawn = Color(red: 0xF0 / 255, green: 0xB8 / 255, blue: 0x4A / 255)
    static let dreamAmber = Color(red: 0xE6 / 255, green: 0xA0 / 255, blue: 0x32 / 255)
    static let dreamHoneyNight = Color(red: 0xEB / 255, green: 0xC2 / 255, blue: 0x5E / 255)
    static let dreamDawnNight = Color(red: 0xDF / 255, green: 0xA5 / 255, blue: 0x3C / 255)
    static let dreamAmberNight = Color(red: 0xCF / 255, green: 0x8E / 255, blue: 0x2C / 255)
}

/// 字阶（第八轮末，判断 D69）：只有两档字号——17（.body）与 13（.footnote），两种字重；不用字间距、不用全大写。
///  标题也是 17 semibold（像系统的内联导航标题）；次要与标签都是 13。角色名保留，title 与 body、sub 与 caption 现在同档。
extension Font {
    static let eoTitle = Font.body.weight(.semibold)
    static let eoBody = Font.body
    static let eoBodyStrong = Font.body.weight(.semibold)
    static let eoSub = Font.footnote
    static let eoSubStrong = Font.footnote.weight(.semibold)
    static let eoCaption = Font.footnote
}

/// 间距、圆角、触控
enum Metrics {
    static let gutter: CGFloat = 16
    static let cardPadding: CGFloat = 20
    static let cardRadius: CGFloat = 22
    static let cardMaxWidth: CGFloat = 420
    static let touch: CGFloat = 44
    static let capsuleHeight: CGFloat = 44
    static let foldGap: CGFloat = 24
}
