import Foundation

/// 旅程的类型（影响书名、主题和回复里的一句提示；数据上仍是同一种 Trip）
enum TripStyle: String, CaseIterable, Sendable {
    case city, roadTrip, island, hiking, rail, themePark, business
}

/// 离线规划：从对话里抽出目的地（内置小地名表）、天数（「五天 / 5天 / 5 days / 3日間 / 2泊3日」）、
/// 出发日期（「下个月 / 10月3号 / 下周 / next month / Oct 3 / 来月」）、主题与旅程类型，缺什么就追问什么，
/// 齐了就起一本只有骨架的草稿（每天一页；知道坐标时每天放一个住处站点，和手动新建一致）。
struct LocalRulePlanner: TripPlanner {
    struct Slots: Equatable {
        var destination: String?
        var place: Place?
        var days: Int?
        var startDate: String?
        var startDateGuessed = false
        var theme: String?
        var style: TripStyle = .city
    }

    func plan(conversation: [PlannerMessage], context: PlannerContext) async throws -> PlannerReply {
        let lang = AppLanguage.from(context.locale)
        let userText = conversation.filter { $0.role == .user }.map(\.text).joined(separator: "\n")
        let s = LocalRulePlanner.extract(userText, today: context.today, lang: lang)
        return LocalRulePlanner.reply(for: s, today: context.today, lang: lang)
    }

    // MARK: - 回复

    static func reply(for s: Slots, today: String, lang: AppLanguage, now: Date = Date()) -> PlannerReply {
        guard let dest = s.destination else {
            return PlannerReply(reply: String(localized: "好呀，我们一起排一段旅程。"),
                                question: String(localized: "想去哪里？可以说一个城市或国家。"), draft: nil, done: false)
        }
        guard let days = s.days else {
            return PlannerReply(reply: String(localized: "去\(dest)，好主意。"),
                                question: String(localized: "打算玩几天？"), draft: nil, done: false)
        }
        let start = s.startDate ?? DayMath.add(today, days: 30)
        let theme = s.theme ?? defaultTheme(place: s.place, style: s.style, start: start)
        let title = LocalRulePlanner.title(dest: dest, days: days, style: s.style)
        let draft = TripFactory.make(title: title, destination: dest, place: s.place, startDate: start, days: days,
                                     theme: theme, now: now, language: lang)
        var parts = [String(localized: "好的：\(dest)，\(Counts.days(days))，\(Fmt.monthDay(start))出发。")]
        if let note = styleNote(s.style) { parts.append(note) }
        if s.startDate == nil || s.startDateGuessed { parts.append(String(localized: "出发日期先按一个月后算，可以再改。")) }
        parts.append(String(localized: "骨架搭好了，看看下面的草稿。"))
        return PlannerReply(reply: parts.joined(separator: lang == .en ? " " : ""), question: nil, draft: draft, done: true)
    }

    static func title(dest: String, days: Int, style: TripStyle) -> String {
        switch style {
        case .roadTrip: return String(localized: "\(dest)自驾")
        case .hiking: return String(localized: "\(dest)徒步")
        case .island: return String(localized: "\(dest)海岛假期")
        case .rail: return String(localized: "\(dest)铁路慢游")
        case .themePark: return String(localized: "\(dest)亲子行")
        case .business: return String(localized: "\(dest)出差")
        case .city: return TripFactory.defaultTitle(destination: dest, days: days)
        }
    }

    static func styleNote(_ style: TripStyle) -> String? {
        switch style {
        case .city: return nil
        case .roadTrip: return String(localized: "路上以自驾为主。")
        case .hiking: return String(localized: "留足了徒步的时间。")
        case .island: return String(localized: "海岛的日子，节奏放慢一点。")
        case .rail: return String(localized: "按铁路串起每一站。")
        case .themePark: return String(localized: "给乐园留了整天。")
        case .business: return String(localized: "行程排得紧凑些。")
        }
    }

    static func defaultTheme(place: Place?, style: TripStyle, start: String) -> String {
        if let p = place {
            let nordic = ["雷克雅未克", "维克", "特罗姆瑟", "罗弗敦", "罗瓦涅米", "奥斯陆", "卑尔根", "赫尔辛基", "斯德哥尔摩"]
            if nordic.contains(p.name) { return "极光冰原" }
            let islands = ["巴厘岛", "普吉岛", "马尔代夫", "三亚", "檀香山", "圣托里尼", "那霸", "海口"]
            if islands.contains(p.name) { return "离岛夏日" }
            let japan = ["东京", "京都", "大阪", "奈良", "神户", "札幌", "名古屋", "福冈"]
            if japan.contains(p.name), let m = DayMath.components(start)?.month {
                if m == 3 || m == 4 { return "樱花春日" }
                if m >= 10 && m <= 12 { return "红叶古都" }
                if m <= 2 { return "温泉雪国" }
            }
        }
        switch style {
        case .island: return "离岛夏日"
        case .roadTrip, .hiking, .rail: return "海风港町"
        case .themePark, .business, .city: return "都市霓虹"
        }
    }

    // MARK: - 抽取

    static func extract(_ text: String, today: String, lang: AppLanguage = .zhHans) -> Slots {
        var s = Slots()
        if let hit = Gazetteer.find(in: text) {
            s.place = hit.place
            let official = [hit.place.name, hit.place.en, hit.place.ja].compactMap { $0 }
            s.destination = official.contains(hit.matched) ? hit.place.displayName(lang) : hit.matched
        }
        s.style = style(in: text)
        s.days = days(in: text) ?? (s.style == .business && matches(#"当天|一日|day ?trip|日帰り"#, text) ? 1 : nil)
        if let d = startDate(in: text, today: today) { s.startDate = d }
        s.theme = theme(in: text)
        return s
    }

    static func style(in text: String) -> TripStyle {
        if matches(#"出差|开会|出張|business|work trip|conference|meeting"#, text) { return .business }
        if matches(#"自驾|租车|开车|road ?trip|driv(e|ing)|ドライブ|レンタカー"#, text) { return .roadTrip }
        if matches(#"乐园|迪士尼|环球影城|游乐园|亲子|带娃|theme ?park|disney|universal|kids|テーマパーク|ディズニー|子ども"#, text) { return .themePark }
        if matches(#"徒步|登山|爬山|hik(e|ing)|trek|ハイキング|トレッキング"#, text) { return .hiking }
        if matches(#"海岛|海边|沙滩|潜水|island|beach|snorkel|diving|島|ビーチ"#, text) { return .island }
        if matches(#"火车|铁路|高铁|rail|train|列車|鉄道|電車"#, text) { return .rail }
        return .city
    }

    static func theme(in text: String) -> String? {
        let table: [(String, String)] = [
            (#"极光|冰川|冰原|aurora|northern lights|glacier|オーロラ|氷河"#, "极光冰原"),
            (#"红叶|枫叶|古都|autumn leaves|foliage|紅葉"#, "红叶古都"),
            (#"樱花|赏樱|cherry blossom|sakura|桜|花見"#, "樱花春日"),
            (#"温泉|滑雪|onsen|hot spring|ski|スキー"#, "温泉雪国"),
            (#"海岛|沙滩|潜水|island|beach|diving|ビーチ"#, "离岛夏日"),
            (#"港口|海风|峡湾|harbou?r|fjord|港町|フィヨルド"#, "海风港町"),
            (#"夜景|霓虹|购物|nightlife|shopping|neon|夜景"#, "都市霓虹"),
        ]
        for (p, t) in table where matches(p, text) { return t }
        return nil
    }

    static func days(in text: String) -> Int? {
        if let m = match(#"(\d{1,2})\s*泊\s*(\d{1,2})\s*日"#, text), let n = Int(m[2]) { return clampDays(n) }
        let num = #"([0-9]{1,2}|[一二两三四五六七八九十]{1,3})"#
        if let m = match(#"(?<![0-9月/．.])"# + num + #"\s*(?:个)?(?:整)?(?:天|日游|日行|日間|日间|日程)"#, text), let n = parseNumber(m[1]) { return clampDays(n) }
        if let m = match(#"\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)[\s-]*days?\b"#, text), let n = parseNumber(m[1]) { return clampDays(n) }
        if let m = match(#"(\d{1,2})\s*nights?"#, text), let n = Int(m[1]) { return clampDays(n + 1) }
        if let m = match(#"(?<![下上这這本来])([一两二三1-3])\s*(?:周|个星期|個星期|週間|週)(?![末])"#, text), let n = parseNumber(m[1]) { return clampDays(n * 7) }
        if let m = match(#"\b(a|one|two|three|\d)\s*weeks?\b"#, text), let n = parseNumber(m[1]) { return clampDays(n * 7) }
        if matches(#"当天往返|一日游|day ?trip|日帰り"#, text) { return 1 }
        if matches(#"周末|週末|weekend"#, text) { return 2 }
        return nil
    }

    static func startDate(in text: String, today: String) -> String? {
        guard let t = DayMath.components(today) else { return nil }
        func future(_ month: Int, _ day: Int) -> String? {
            guard let d = DayMath.make(year: t.year, month: month, day: day) else { return nil }
            if d < today { return DayMath.make(year: t.year + 1, month: month, day: day) }
            return d
        }
        if let m = match(#"(\d{4})-(\d{1,2})-(\d{1,2})"#, text), let y = Int(m[1]), let mo = Int(m[2]), let d = Int(m[3]) {
            return DayMath.make(year: y, month: mo, day: d)
        }
        let cn = #"([0-9]{1,2}|[一二三四五六七八九十]{1,3})"#
        if let m = match(cn + #"\s*月\s*"# + cn + #"\s*[日号號]"#, text), let mo = parseNumber(m[1]), let d = parseNumber(m[2]) {
            return future(mo, d)
        }
        let months = #"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"#
        if let m = match(#"\b"# + months + #"\s+(\d{1,2})(?:st|nd|rd|th)?\b"#, text), let mo = monthNumber(m[1]), let d = Int(m[2]) {
            return future(mo, d)
        }
        if let m = match(#"\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?"# + months, text), let d = Int(m[1]), let mo = monthNumber(m[2]) {
            return future(mo, d)
        }
        if matches(#"后天|後天|明後日|day after tomorrow"#, text) { return DayMath.add(today, days: 2) }
        if matches(#"明天|明日|tomorrow"#, text) { return DayMath.add(today, days: 1) }
        let weekday = DayMath.weekday(today)                          // 1 = 周日 … 7 = 周六
        let toSaturday = (7 - weekday + 7) % 7
        let toMonday = ((9 - weekday) % 7 == 0) ? 7 : (9 - weekday) % 7
        if matches(#"下周末|下個週末|next weekend|来週末"#, text) { return DayMath.add(today, days: toSaturday + 7) }
        if matches(#"这周末|這週末|周末|週末|this weekend|weekend|今週末"#, text) { return DayMath.add(today, days: toSaturday) }
        if matches(#"下周|下星期|下週|next week|来週"#, text) { return DayMath.add(today, days: toMonday) }
        if matches(#"下个月|下月|下個月|next month|来月"#, text) {
            let (y, mo) = t.month == 12 ? (t.year + 1, 1) : (t.year, t.month + 1)
            return DayMath.make(year: y, month: mo, day: 1)
        }
        if matches(#"国庆|國慶|national day"#, text) { return future(10, 1) }
        if let m = match(#"(?<![0-9])"# + cn + #"\s*月(?:份|初|中)?(?![0-9一二三四五六七八九十])"#, text), let mo = parseNumber(m[1]), (1...12).contains(mo) {
            return future(mo, 1)
        }
        if let m = match(#"\bin\s+"# + months, text), let mo = monthNumber(m[1]) { return future(mo, 1) }
        if matches(#"今天|today|今日"#, text) { return today }
        return nil
    }

    // MARK: - 小工具

    static func clampDays(_ n: Int) -> Int? { n >= 1 ? min(n, 30) : nil }

    static func monthNumber(_ s: String) -> Int? {
        let keys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
        let k = String(s.lowercased().prefix(3))
        return keys.firstIndex(of: k).map { $0 + 1 }
    }

    static func parseNumber(_ raw: String) -> Int? {
        let s = raw.trimmingCharacters(in: .whitespaces).lowercased()
        if let n = Int(s) { return n }
        let words: [String: Int] = ["a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
                                    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fourteen": 14]
        if let n = words[s] { return n }
        let digits: [Character: Int] = ["零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9]
        if let i = s.firstIndex(of: "十") {
            let head = s[..<i], tail = s[s.index(after: i)...]
            let tens: Int? = head.isEmpty ? 1 : (head.count == 1 ? head.first.flatMap { digits[$0] } : nil)
            let ones: Int? = tail.isEmpty ? 0 : (tail.count == 1 ? tail.first.flatMap { digits[$0] } : nil)
            guard let a = tens, let b = ones else { return nil }
            return a * 10 + b
        }
        if s.count == 1, let c = s.first { return digits[c] }
        return nil
    }

    static func matches(_ pattern: String, _ text: String) -> Bool { match(pattern, text) != nil }

    static func match(_ pattern: String, _ text: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: JSRegex.compatible(pattern), options: [.caseInsensitive]),
              let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            guard let r = Range(m.range(at: i), in: text) else { return "" }
            return String(text[r])
        }
    }
}
