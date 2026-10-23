import SwiftUI
import UIKit

/// 「新建旅程」：浮在地球上、不属于任何卡片的胶囊（第七轮起高 44）。
/// 平涂的「沙画」渐变 + 细颗粒噪点 + 5 颗小星光 + 一道白色渐变的玻璃边。
/// 第八轮续：全应用唯一带颜色的按钮——蜜 → 晨 → 琥珀，只有晨色一个色相（珊瑚那一端和天空打架，去掉了），白星，墨色字保证对比；深色外观下底深一档。
struct DreamyCapsuleButton: View {
    let title: LocalizedStringKey
    var systemImage: String = "sparkles"
    let action: () -> Void

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let night = colorScheme == .dark
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                Text(title)
            }
            .font(.eoSubStrong)
            .foregroundStyle(Color.dreamInk)
            .padding(.horizontal, 22)
            .frame(height: Metrics.capsuleHeight)
            .background { DreamySand(night: night, reduceTransparency: reduceTransparency).clipShape(Capsule()) }
            .overlay {
                Capsule().strokeBorder(
                    LinearGradient(colors: [Color.white.opacity(0.95), Color.white.opacity(0.2), Color.white.opacity(0.7)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    lineWidth: 1.2)
            }
            .contentShape(Capsule())
        }
        .buttonStyle(DreamyPressStyle())
        .shadow(color: (night ? Color.black : Color.dreamAmber).opacity(night ? 0.3 : 0.35), radius: 18, x: 0, y: 8)
    }
}

private struct DreamyPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? -0.04 : 0)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

/// 沙画底：平涂渐变 + 颗粒 + 星光（不做立体高光）。night = 深色外观（底深一档，星仍是白）
struct DreamySand: View {
    var night = false
    var reduceTransparency = false

    var body: some View {
        let glint = Color.white
        ZStack {
            LinearGradient(colors: night ? [.dreamHoneyNight, .dreamDawnNight, .dreamAmberNight] : [.dreamHoney, .dreamDawn, .dreamAmber], startPoint: .leading, endPoint: .trailing)
            // 沙画的「笔触」：两团很淡的横向晕染，仍然是平的
            LinearGradient(colors: [glint.opacity(0.0), glint.opacity(0.10), glint.opacity(0.0)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            if !reduceTransparency {
                Image(uiImage: GrainTexture.image)
                    .resizable(resizingMode: .tile)
                    .blendMode(.overlay)
                    .opacity(0.55)
                    .allowsHitTesting(false)
            }
            StarGlints(color: glint)
                .allowsHitTesting(false)
        }
    }
}

/// 4–6 颗细小的四角星光（位置固定，由种子决定）
struct StarGlints: View {
    var color: Color = .white
    private static let stars: [(x: CGFloat, y: CGFloat, r: CGFloat, o: Double)] = [
        (0.08, 0.30, 2.4, 0.9), (0.22, 0.74, 1.6, 0.7), (0.47, 0.18, 1.8, 0.8),
        (0.71, 0.70, 2.2, 0.85), (0.90, 0.28, 1.5, 0.7),
    ]

    var body: some View {
        Canvas { ctx, size in
            for s in StarGlints.stars {
                let c = CGPoint(x: s.x * size.width, y: s.y * size.height)
                var p = Path()
                let r = s.r, k = s.r * 0.28
                p.move(to: CGPoint(x: c.x, y: c.y - r * 1.6))
                p.addLine(to: CGPoint(x: c.x + k, y: c.y - k))
                p.addLine(to: CGPoint(x: c.x + r * 1.6, y: c.y))
                p.addLine(to: CGPoint(x: c.x + k, y: c.y + k))
                p.addLine(to: CGPoint(x: c.x, y: c.y + r * 1.6))
                p.addLine(to: CGPoint(x: c.x - k, y: c.y + k))
                p.addLine(to: CGPoint(x: c.x - r * 1.6, y: c.y))
                p.addLine(to: CGPoint(x: c.x - k, y: c.y - k))
                p.closeSubpath()
                ctx.fill(p, with: .color(color.opacity(s.o)))
                ctx.fill(Path(ellipseIn: CGRect(x: c.x - k, y: c.y - k, width: k * 2, height: k * 2)), with: .color(color))
            }
        }
    }
}

/// 代码生成的颗粒噪点（96×96，平铺）；确定性随机，每次启动一样
enum GrainTexture {
    static let image: UIImage = make(size: 96)

    static func make(size: Int) -> UIImage {
        var state: UInt64 = 0x9E37_79B9_7F4A_7C15
        func next() -> UInt64 {
            state &+= 0x9E37_79B9_7F4A_7C15
            var z = state
            z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
            z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
            return z ^ (z >> 31)
        }
        var bytes = [UInt8](repeating: 0, count: size * size * 4)
        for i in 0..<(size * size) {
            let r = next()
            let light = r & 1 == 0                              // 一半亮点、一半暗点
            let alpha = UInt8(truncatingIfNeeded: 24 + (r >> 8) % 72)
            let v: UInt8 = light ? alpha : 0                     // 预乘 alpha：白点 rgb = alpha，黑点 rgb = 0
            bytes[i * 4] = v
            bytes[i * 4 + 1] = v
            bytes[i * 4 + 2] = v
            bytes[i * 4 + 3] = alpha
        }
        let data = Data(bytes) as CFData
        guard let provider = CGDataProvider(data: data),
              let cg = CGImage(width: size, height: size, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: size * 4,
                               space: CGColorSpaceCreateDeviceRGB(),
                               bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                               provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
        else { return UIImage() }
        return UIImage(cgImage: cg, scale: 2, orientation: .up)
    }
}
