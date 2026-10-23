import Foundation

/// shared/algo/prng.ts：两端结果必须一致，所以不用平台随机数
enum PRNG {
    /// FNV-1a（按 UTF-16 码元，与 JS 的 charCodeAt 一致）
    static func hashString(_ s: String) -> UInt32 {
        var h: UInt32 = 2_166_136_261
        for u in s.utf16 {
            h ^= UInt32(u)
            h = h &* 16_777_619
        }
        return h
    }
}

struct Mulberry32 {
    private var a: UInt32

    init(seed: UInt32) { a = seed }

    mutating func next() -> Double {
        a = a &+ 0x6D2B_79F5
        var t = a
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }

    mutating func int(_ n: Int) -> Int { Int((next() * Double(n)).rounded(.down)) }

    mutating func pick<T>(_ arr: [T]) -> T { arr[min(arr.count - 1, int(arr.count))] }
}

/// shared/algo/diary.ts：按条目顺序串成一段话，措辞由 seed 决定；用户改过（day.diary）就不再覆盖。
/// 中文与网页版逐字一致；英文、日文用同一套抽签顺序，只换句式。
enum DiaryWriter {
    struct Templates {
        let open: [String]
        let move: [String]
        let close: [String]
        let visited: [String]
        let then: String
        let soon: String
        let stop: String
        let joiner: String
        let modeName: (TransportMode) -> String
        let duration: (Int?) -> String
    }

    static func templates(_ lang: AppLanguage) -> Templates {
        switch lang {
        case .zhHans:
            return Templates(
                open: ["这一天从%s开始。", "早上出发，第一站是%s。", "%s是今天的起点。"],
                move: ["%s后到了%s", "坐%s，%s到了%s", "%s，%s便是%s"],
                close: ["晚上住在%s。", "夜里回到%s，脚有点酸，心是满的。", "回到%s，把今天记下来。"],
                visited: ["（打过卡了）", "（到过）", ""],
                then: "然后是%s%s。", soon: "不久", stop: "。", joiner: "",
                modeName: { m in
                    switch m {
                    case .walk: return "步行"
                    case .rail: return "铁路"
                    case .subway: return "地铁"
                    case .bus: return "巴士"
                    case .ship: return "船"
                    case .taxi: return "出租车"
                    case .car: return "自驾"
                    case .flight: return "飞机"
                    }
                },
                duration: { min in
                    // shared/algo/duration.ts 的 formatDuration（与网页一字不差）
                    guard let min else { return "" }
                    let h = min / 60, m = min % 60
                    if h > 0 && m > 0 { return "\(h) 小时 \(m) 分钟" }
                    if h > 0 { return "\(h) 小时" }
                    return "\(m) 分钟"
                })
        case .en:
            return Templates(
                open: ["The day began at %s.", "Set off in the morning; the first stop was %s.", "%s was where today started."],
                move: ["After %s, arrived at %s", "Took %s and, %s later, reached %s", "%s, and %s on there was %s"],
                close: ["Stayed the night at %s.", "Back at %s at night, feet sore and heart full.", "Back at %s, writing today down."],
                visited: [" (checked in)", " (been there)", ""],
                then: "Then %s%s.", soon: "a little while", stop: ".", joiner: " ",
                modeName: { m in
                    switch m {
                    case .walk: return "a walk"
                    case .rail: return "the train"
                    case .subway: return "the metro"
                    case .bus: return "the bus"
                    case .ship: return "the boat"
                    case .taxi: return "a taxi"
                    case .car: return "the car"
                    case .flight: return "a flight"
                    }
                },
                duration: { min in
                    guard let min else { return "" }
                    return min > 0 ? Fmt.duration(min) : "0 min"
                })
        case .ja:
            return Templates(
                open: ["この日は%sから始まった。", "朝に出発、最初の行き先は%s。", "%sが今日の出発点。"],
                move: ["%sで%sに着いた", "%sに乗って、%sで%sに着いた", "%s、%sほどで%s"],
                close: ["夜は%sに泊まった。", "夜、%sに戻った。足は疲れたけれど、心は満たされた。", "%sに戻って、今日を書き留めた。"],
                visited: ["（チェックイン済み）", "（訪れた）", ""],
                then: "それから%s%s。", soon: "しばらく", stop: "。", joiner: "",
                modeName: { m in
                    switch m {
                    case .walk: return "徒歩"
                    case .rail: return "電車"
                    case .subway: return "地下鉄"
                    case .bus: return "バス"
                    case .ship: return "船"
                    case .taxi: return "タクシー"
                    case .car: return "車"
                    case .flight: return "飛行機"
                    }
                },
                duration: { min in
                    guard let min else { return "" }
                    return min > 0 ? Fmt.duration(min) : "0分"
                })
        }
    }

    static func generate(seed: Int, day: Day, language: AppLanguage = .current) -> String {
        let T = templates(language)
        var rng = Mulberry32(seed: UInt32(truncatingIfNeeded: seed) ^ PRNG.hashString(day.date))
        var parts: [String] = []
        var pending: (name: String, dur: String)?
        var first = true
        for e in day.entries {
            switch e {
            case .transport(let t):
                pending = (t.label.isEmpty ? T.modeName(t.mode) : t.label, T.duration(t.durationMinutes))
            case .place(let p):
                let tag = p.visited == true ? rng.pick(T.visited) : ""
                if first {
                    parts.append(rng.pick(T.open).replacingFirst("%s", with: p.name) + tag)
                    first = false
                } else if let pm = pending {
                    let idx = rng.int(T.move.count)
                    let t = T.move[min(idx, T.move.count - 1)]
                    let s = idx == 0
                        ? t.replacingFirst("%s", with: pm.name).replacingFirst("%s", with: p.name)
                        : t.replacingFirst("%s", with: pm.name).replacingFirst("%s", with: pm.dur.isEmpty ? T.soon : pm.dur).replacingFirst("%s", with: p.name)
                    parts.append(s + tag + T.stop)
                } else {
                    parts.append(T.then.replacingFirst("%s", with: p.name).replacingFirst("%s", with: tag))
                }
                if let n = p.notes, !n.isEmpty {
                    parts.append(trimTrailing(n) + T.stop)
                }
                pending = nil
            case .lodging:
                break
            }
        }
        if let l = day.lodging, !l.isEmpty { parts.append(rng.pick(T.close).replacingFirst("%s", with: l)) }
        var out = parts.joined(separator: T.joiner)
        out = out.replacingOccurrences(of: "。。", with: "。")
        out = out.replacingOccurrences(of: " · ", with: language == .en ? ", " : (language == .ja ? "、" : "，"))
        return out
    }

    /// notes.trim().replace(/[。\s]*$/, "")
    private static func trimTrailing(_ s: String) -> String {
        var t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        while let last = t.last, last == "。" || last.isWhitespace { t.removeLast() }
        return t
    }
}

extension String {
    func replacingFirst(_ target: String, with replacement: String) -> String {
        guard let r = range(of: target) else { return self }
        return replacingCharacters(in: r, with: replacement)
    }
}
