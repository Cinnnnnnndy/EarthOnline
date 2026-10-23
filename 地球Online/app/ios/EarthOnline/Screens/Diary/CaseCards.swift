import Foundation
import UIKit
import Vision
import CoreImage

/// 自己放进箱子的照片（D82）：图存在 Application Support/EarthOnline/cards/<id>.png，书里只记 id 与尺寸（CaseCard）
enum CaseCardStore {
    static func directory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("EarthOnline/cards", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
    static func url(id: String) -> URL { directory().appendingPathComponent(id + ".png") }
    static func save(_ data: Data, id: String) { try? data.write(to: url(id: id), options: .atomic) }
    static func load(id: String) -> Data? { try? Data(contentsOf: url(id: id)) }
    static func delete(id: String) { try? FileManager.default.removeItem(at: url(id: id)) }
    /// 给嵌入页用的 data URL（拍立得是 JPEG，按文件头写对类型；PNG 的头是 89 50 4E 47）
    static func dataURL(id: String) -> String? {
        guard let d = load(id: id) else { return nil }
        let png = d.starts(with: [0x89, 0x50, 0x4E, 0x47] as [UInt8])
        return "data:image/\(png ? "png" : "jpeg");base64," + d.base64EncodedString()
    }
}

/// 抠图：用 Vision 把主体从背景里提出来（iOS 17 的 VNGenerateForegroundInstanceMaskRequest），比网页的漫延法准。
/// 抠不出来（没有主体、太小）时，给了 fallback 就再交给它（D99：嵌入页的本机抠图，三端同一套），还不行就整张保留，做成拍立得。
enum SubjectLifter {
    struct Result { let data: Data; let kind: String; let w: Int; let h: Int }

    static func lift(_ image: UIImage, fallback: ((Data) async -> Result?)? = nil) async -> Result? {
        guard let cg = downscaled(image, maxSide: 1024) else { return nil }
        let cutout = await cutOut(cg)
        if let cutout { return cutout }
        guard let jpeg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.88) else { return nil }
        if let fallback, let other = await fallback(jpeg) { return other }
        return Result(data: jpeg, kind: "polaroid", w: cg.width, h: cg.height)
    }

    private static func cutOut(_ cg: CGImage) async -> Result? {
        await withCheckedContinuation { (cont: CheckedContinuation<Result?, Never>) in
            DispatchQueue.global(qos: .userInitiated).async {
                let request = VNGenerateForegroundInstanceMaskRequest()
                let handler = VNImageRequestHandler(cgImage: cg, options: [:])
                do {
                    try handler.perform([request])
                    guard let obs = request.results?.first, !obs.allInstances.isEmpty else { cont.resume(returning: nil); return }
                    let buffer = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: true)
                    let ci = CIImage(cvPixelBuffer: buffer)
                    let ctx = CIContext()
                    guard let out = ctx.createCGImage(ci, from: ci.extent), let png = UIImage(cgImage: out).pngData() else { cont.resume(returning: nil); return }
                    // 主体太小（不到两成）当没抠到
                    if Double(out.width * out.height) < Double(cg.width * cg.height) * 0.04 { cont.resume(returning: nil); return }
                    cont.resume(returning: Result(data: png, kind: "cutout", w: out.width, h: out.height))
                } catch {
                    cont.resume(returning: nil)
                }
            }
        }
    }

    private static func downscaled(_ image: UIImage, maxSide: CGFloat) -> CGImage? {
        let size = image.size
        let k = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: max(1, (size.width * k).rounded()), height: max(1, (size.height * k).rounded()))
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let img = UIGraphicsImageRenderer(size: target, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        return img.cgImage
    }
}
