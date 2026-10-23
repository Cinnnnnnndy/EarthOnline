import SwiftUI

/// 规划器给出的草稿：书名可改、出发日期可挪（整本书的日期一起挪），看一眼每天的标题，点「生成这本书」
struct DraftCard: View {
    @Binding var draft: Trip?
    let onCreate: (Trip) -> Void

    var body: some View {
        if let trip = draft {
            GlassCard(maxWidth: 560, spacing: 8) {
                Text("草稿")
                    .font(.eoSubStrong)
                    .foregroundStyle(.secondary)
                TextField("书名", text: titleBinding)
                    .font(.eoTitle)
                Text(plainList(trip.destination) + AppLanguage.current.comma + Counts.days(trip.days.count) + AppLanguage.current.comma + ThemeName.localized(trip.theme))
                    .font(.eoSub)
                    .foregroundStyle(.secondary)
                DatePicker("出发", selection: startBinding, displayedComponents: .date)
                    .font(.eoBody)
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(trip.days.prefix(6)) { d in
                        HStack(spacing: 12) {
                            Text(verbatim: "D\(d.index)")
                                .font(.eoSubStrong)
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                                .frame(minWidth: 32, alignment: .leading)
                            Text(plain(d.title)).font(.eoSub).lineLimit(1)
                            Spacer(minLength: 0)
                            if !d.places.isEmpty {
                                let nStops = d.places.count
                                Text(Counts.stops(nStops)).font(.eoSub).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if trip.days.count > 6 {
                        let nMore = trip.days.count - 6
                        Text("还有 \(nMore) 天").font(.eoSub).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
                PrimaryActionButton(title: String(localized: "生成这本书")) { onCreate(trip) }
                    .padding(.top, 4)
            }
        }
    }

    private var titleBinding: Binding<String> {
        Binding {
            draft?.title ?? ""
        } set: { v in
            draft?.title = String(v.prefix(40))
        }
    }

    private var startBinding: Binding<Date> {
        Binding {
            DayMath.localNoon(draft?.startDate ?? DayMath.today())
        } set: { d in
            guard var t = draft else { return }
            let newStart = DayMath.today(now: d)
            let shift = DayMath.diff(t.startDate, newStart)
            guard shift != 0 else { return }
            t.startDate = newStart
            t.endDate = DayMath.add(t.endDate, days: shift)
            for i in t.days.indices { t.days[i].date = DayMath.add(t.days[i].date, days: shift) }
            draft = t
        }
    }
}
