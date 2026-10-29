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

    /// 新建旅程胶囊的三段色（D110）：全应用唯一带颜色的按钮。原来的蜜 → 琥珀在淡紫的天上像一块旧黄铜，
    /// 改成糖果色的靛紫 → 兰紫 → 樱粉：和天空同一族（紫、粉），但深两档、更饱和，一眼就是能按的那个；字和星光是白的。深色外观下底深一档
    static let dreamViolet = Color(red: 0x6A / 255, green: 0x5C / 255, blue: 0xF0 / 255)
    static let dreamOrchid = Color(red: 0xA8 / 255, green: 0x62 / 255, blue: 0xF2 / 255)
    static let dreamPink = Color(red: 0xF2 / 255, green: 0x6E / 255, blue: 0xB4 / 255)
    static let dreamVioletNight = Color(red: 0x55 / 255, green: 0x48 / 255, blue: 0xD8 / 255)
    static let dreamOrchidNight = Color(red: 0x8E / 255, green: 0x4E / 255, blue: 0xDA / 255)
    static let dreamPinkNight = Color(red: 0xD8 / 255, green: 0x58 / 255, blue: 0x9C / 255)
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
    /// D105：展开的大屏上，整颗地球上下留的边（在安全区之外再留这么多；上边还要让出顶上那排图标）
    static let globeTopMargin: CGFloat = 28
    static let globeBottomMargin: CGFloat = 28
    /// 地球占那一条的多少：竖持时那一条受宽度限制，留一点左右的空
    static let globeFill: Double = 0.94
    /// D105：两页时左页内容离屏幕左边的距离（内屏四角圆得很大，16 会被切掉票的一角）
    static let spreadLeading: CGFloat = 32
    /// D110：Duo 横持展开时状态栏（时间 + 信号）竖着放在右上角，顶上那排图标要让开它这么宽
    static let statusSideWidth: CGFloat = 64
}
