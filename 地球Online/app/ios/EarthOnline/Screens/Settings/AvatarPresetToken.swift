import SwiftUI

/// 默认形象的小头像（D112）：按这一套的肤色、发色、毛衣色画一个圆头像；动物形态（福贵）画一只银白长毛猫。
/// 颜色和 shared/world/hero.ts 的 SKIN_COLORS / HAIR_COLORS / DRESS_COLORS 同一份；只是预览，不追求和 3D 一模一样
struct AvatarPresetToken: View {
    let avatar: Avatar

    private static let skin: [(Double, Double, Double)] = [(248, 210, 186), (236, 190, 160), (206, 156, 120), (150, 104, 76)]
    private static let hair: [(Double, Double, Double)] = [(66, 42, 34), (30, 26, 30), (140, 92, 58), (206, 160, 98), (104, 58, 82)]
    private static let dress: [(Double, Double, Double)] = [(218, 168, 86), (74, 95, 176), (238, 232, 220), (134, 160, 138), (212, 132, 144), (58, 66, 96), (204, 156, 112)]
    private static func color(_ t: (Double, Double, Double)) -> Color { Color(red: t.0 / 255, green: t.1 / 255, blue: t.2 / 255) }

    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            ctx.fill(Path(ellipseIn: CGRect(x: 0, y: 0, width: w, height: h)), with: .color(Color.white.opacity(0.55)))
            ctx.clip(to: Path(ellipseIn: CGRect(x: 0, y: 0, width: w, height: h)))
            if avatar.form == "persian" { cat(ctx, w, h) } else if avatar.form == nil { person(ctx, w, h) } else { other(ctx, w, h) }
        }
        .accessibilityHidden(true)
    }

    private func person(_ ctx: GraphicsContext, _ w: CGFloat, _ h: CGFloat) {
        let skin = Self.color(Self.skin[avatar.skin % Self.skin.count])
        let hair = Self.color(Self.hair[avatar.hairColor % Self.hair.count])
        let dress = Self.color(Self.dress[avatar.dress % Self.dress.count])
        ctx.fill(Path(ellipseIn: CGRect(x: w * 0.14, y: h * 0.7, width: w * 0.72, height: h * 0.6)), with: .color(dress))   // 毛衣
        if avatar.hair == "long" { ctx.fill(Path(roundedRect: CGRect(x: w * 0.24, y: h * 0.2, width: w * 0.52, height: h * 0.56), cornerRadius: w * 0.2), with: .color(hair)) }
        let face = CGRect(x: w * 0.3, y: h * 0.26, width: w * 0.4, height: h * 0.44)
        ctx.fill(Path(ellipseIn: face), with: .color(skin))
        var cap = Path(); cap.addArc(center: CGPoint(x: w * 0.5, y: h * 0.42), radius: w * 0.22, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false); cap.closeSubpath()
        ctx.fill(cap, with: .color(hair))
        let eyeY = h * 0.5
        for x in [w * 0.43, w * 0.57] { ctx.fill(Path(ellipseIn: CGRect(x: x - 1.5, y: eyeY - 1.5, width: 3, height: 3)), with: .color(Color(white: 0.15))) }
        if avatar.glasses == true {
            for x in [w * 0.43, w * 0.57] { ctx.stroke(Path(ellipseIn: CGRect(x: x - 4, y: eyeY - 4, width: 8, height: 8)), with: .color(Color(white: 0.35)), lineWidth: 1) }
        }
    }

    private func cat(_ ctx: GraphicsContext, _ w: CGFloat, _ h: CGFloat) {
        let fur = Color(red: 236 / 255, green: 232 / 255, blue: 230 / 255), shade = Color(red: 200 / 255, green: 196 / 255, blue: 204 / 255)
        ctx.fill(Path(ellipseIn: CGRect(x: w * 0.12, y: h * 0.66, width: w * 0.76, height: h * 0.6)), with: .color(shade))   // 蓬毛的胸口
        for flip in [CGFloat(-1), 1] {   // 两只尖耳朵
            var ear = Path(); let cx = w * 0.5 + flip * w * 0.2
            ear.move(to: CGPoint(x: cx - flip * w * 0.1, y: h * 0.36)); ear.addLine(to: CGPoint(x: cx + flip * w * 0.04, y: h * 0.14)); ear.addLine(to: CGPoint(x: cx + flip * w * 0.12, y: h * 0.4)); ear.closeSubpath()
            ctx.fill(ear, with: .color(fur))
        }
        ctx.fill(Path(ellipseIn: CGRect(x: w * 0.2, y: h * 0.26, width: w * 0.6, height: h * 0.46)), with: .color(fur))   // 圆扁脸
        for x in [w * 0.4, w * 0.6] { ctx.fill(Path(ellipseIn: CGRect(x: x - 2.5, y: h * 0.44, width: 5, height: 5)), with: .color(Color(red: 0.36, green: 0.68, blue: 0.4))) }   // 绿眼睛
        ctx.fill(Path(ellipseIn: CGRect(x: w * 0.5 - 2, y: h * 0.54, width: 4, height: 3)), with: .color(Color(red: 0.92, green: 0.6, blue: 0.66)))
    }

    private func other(_ ctx: GraphicsContext, _ w: CGFloat, _ h: CGFloat) {
        ctx.draw(Text(Image(systemName: "pawprint.fill")).font(.system(size: w * 0.4)), at: CGPoint(x: w / 2, y: h / 2))
    }
}
