import SwiftUI
import UIKit

/// 导出长图：书名、日期、统计、每一天（站点 + 日记），拼成一张竖长 PNG。
/// 免费版 1080px 宽，Pro 2160px 宽（高清）。D96 起日记页先用嵌入页的长图（带每天的世界层渲染图，WorldController.exportLongImage），
/// 这里是世界层不在时的文字版兜底。
enum LongImageExporter {
    @MainActor
    static func export(trip: Trip, highResolution: Bool) -> URL? {
        let width: CGFloat = 390
        let targetPixels: CGFloat = highResolution ? 2160 : 1080
        let renderer = ImageRenderer(content: LongImageView(trip: trip).frame(width: width))
        renderer.scale = targetPixels / width
        renderer.isOpaque = true
        guard let image = renderer.uiImage, let data = image.pngData() else { return nil }
        let url = ExportFiles.directory().appendingPathComponent(ExportFiles.safeName(trip.title) + ".png")
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}

/// 长图的版式（与界面同一套字阶与颜色；固定浅色）
struct LongImageView: View {
    let trip: Trip

    var body: some View {
        let s = Stats.of(trip)
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text(verbatim: "地球Online").font(.eoCaption).foregroundStyle(Color.eoLake)
                Text(plain(trip.title)).font(.eoTitle)
                Text(plainList(trip.destination) + AppLanguage.current.comma + Fmt.span(trip.startDate, trip.endDate))
                    .font(.eoSub).foregroundStyle(.secondary)
            }
            Text(Counts.join([Counts.days(s.days), Counts.stops(s.places), s.visited > 0 ? Counts.checkIns(s.visited) : "",
                              s.km > 0 ? Fmt.km(s.km) : ""]))
                .font(.eoSub)
                .foregroundStyle(.secondary)
            ForEach(Array(trip.days.enumerated()), id: \.element.index) { _, d in
                VStack(alignment: .leading, spacing: 8) {
                    Divider()
                    Text(verbatim: "D\(d.index) " + plain(d.title)).font(.eoBodyStrong)
                    Text(Fmt.monthDay(d.date)).font(.eoSub).foregroundStyle(.secondary)
                    ItineraryList(day: d, showTimes: true, fallbackDue: trip.startDate, today: DayMath.today())
                    Text(d.diary ?? DiaryWriter.generate(seed: trip.seed, day: d))
                        .font(.eoBody)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(24)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }
}

/// 导出文件（临时目录）
enum ExportFiles {
    static func directory() -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Export", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func safeName(_ s: String) -> String {
        let bad = CharacterSet(charactersIn: "/\\:?%*|\"<>")
        let cleaned = s.components(separatedBy: bad).joined(separator: "_").trimmingCharacters(in: .whitespaces)
        return cleaned.isEmpty ? "trip" : String(cleaned.prefix(60))
    }

    /// 一本书的 JSON（与网页版导出的格式一致，可在另一台设备或网页版导入）
    static func json(for trip: Trip) -> URL {
        let url = directory().appendingPathComponent(safeName(trip.title) + ".json")
        try? TripImporter.encode(trip).write(to: url, options: .atomic)
        return url
    }

    /// 全部旅程
    static func allJSON(_ trips: [Trip]) -> URL {
        let name = String(localized: "地球Online 全部旅程")
        let url = directory().appendingPathComponent(safeName(name) + ".json")
        try? TripImporter.encode(trips).write(to: url, options: .atomic)
        return url
    }
}
