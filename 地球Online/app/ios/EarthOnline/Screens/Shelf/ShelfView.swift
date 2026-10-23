import SwiftUI
import UniformTypeIdentifiers

/// 全部旅程（只看列表，不显示地球）：给读屏与想快速找书的人。没有封面缩略图，只有书名、目的地与日期、状态。
struct ShelfView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @State private var pendingDelete: Trip?
    @State private var importing = false

    var body: some View {
        List {
            if store.trips.isEmpty {
                Section {
                    Text("还没有旅程。回到地球，点「新建旅程」开始第一本。")
                        .font(.eoSub)
                        .foregroundStyle(.secondary)
                }
            }
            Section {
                ForEach(store.trips) { t in
                    // 每一趟旅程都是一张票（D74）：一摞小票
                    TicketView(trip: t, status: t.statusText(today: app.today), live: t.isTravelingNow(today: app.today), compact: true, onFace: { app.openBook(t.id) })
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .padding(.vertical, 4)
                        .swipeActions {
                            Button(role: .destructive) { pendingDelete = t } label: { Label("删除", systemImage: "trash") }
                        }
                        .contextMenu {
                            Button { app.openDiary(t.id) } label: { Label("旅行日记", systemImage: "book.closed") }
                            Button(role: .destructive) { pendingDelete = t } label: { Label("删除", systemImage: "trash") }
                        }
                }
            } footer: {
                if !app.entitlements.isPro {
                    let nUsed = store.trips.count
                    let nLimit = Entitlements.freeTripLimit
                    Text("免费版可以放 \(nLimit) 本旅程，已用 \(nUsed) 本。").font(.eoSub)
                } else {
                    Text("左滑一本书可以删除。").font(.eoSub)
                }
            }
        }
        .listStyle(.insetGrouped)
        .font(.eoBody)
        .navigationTitle(Text("全部旅程"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { importing = true } label: { Label("导入", systemImage: "square.and.arrow.down") }
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json], allowsMultipleSelection: false) { result in
            if case .success(let urls) = result, let url = urls.first { app.openFile(url) }
        }
        .confirmationDialog(Text("删除这本书？"), isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
                            titleVisibility: .visible, presenting: pendingDelete) { t in
            Button("删除", role: .destructive) {
                store.delete(t.id)
                if app.stage.tripID == t.id { app.goHome() }
            }
        } message: { t in
            Text(plain(t.title))
        }
    }
}

/// 书的一行（第八轮末起列表用 TicketView；这一行留给长图等紧凑场合）
struct TripRow: View {
    let trip: Trip
    let today: String

    var body: some View {
        let phase = trip.phase(today: today)
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(plain(trip.title))
                    .font(.eoBody)
                    .lineLimit(1)
                Text(plainList(trip.destination) + AppLanguage.current.comma + Fmt.span(trip.startDate, trip.endDate))
                    .font(.eoSub)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Text(trip.statusText(today: today))
                .font(.eoSub)
                .foregroundStyle(isNow(phase) ? Color.eoDawnInk : Color.secondary)
            Image(systemName: "chevron.right")
                .font(.eoCaption)
                .foregroundStyle(.tertiary)
        }
        .frame(minHeight: Metrics.touch)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func isNow(_ p: TripPhase) -> Bool { if case .traveling = p { return true }; return false }
}
