import Foundation

/// 应用当前的界面语言（String Catalog 里有 zh-Hans / en / ja）。语音识别、朗读、规划服务的 locale 都跟着它。
enum AppLanguage: String, CaseIterable, Sendable {
    case zhHans = "zh-Hans"
    case en
    case ja

    static var current: AppLanguage {
        from(Bundle.main.preferredLocalizations.first ?? "zh-Hans")
    }

    static func from(_ identifier: String) -> AppLanguage {
        let id = identifier.lowercased()
        if id.hasPrefix("en") { return .en }
        if id.hasPrefix("ja") { return .ja }
        return .zhHans
    }

    /// SFSpeechRecognizer / AVSpeechSynthesisVoice 用的 locale
    var speechLocale: String {
        switch self {
        case .zhHans: return "zh-CN"
        case .en: return "en-US"
        case .ja: return "ja-JP"
        }
    }

    /// 规划服务 context.locale
    var plannerLocale: String { rawValue }

    /// 列表分隔符（「、」/「, 」）
    var listSeparator: String {
        switch self {
        case .zhHans, .ja: return "、"
        case .en: return ", "
        }
    }

    /// 并列短语之间的逗号（「，」/「, 」/「、」）
    var comma: String {
        switch self {
        case .zhHans: return "，"
        case .ja: return "、"
        case .en: return ", "
        }
    }
}

/// 导入的标题、备注里常有「A · B」：显示时换成当前语言的逗号（数据不改）
func plain(_ s: String, _ lang: AppLanguage = .current) -> String {
    s.replacingOccurrences(of: " · ", with: lang.comma).replacingOccurrences(of: "·", with: lang.comma)
}

/// 目的地「冰岛 · 丹麦」→「冰岛、丹麦」
func plainList(_ s: String, _ lang: AppLanguage = .current) -> String {
    s.replacingOccurrences(of: " · ", with: lang.listSeparator)
}
