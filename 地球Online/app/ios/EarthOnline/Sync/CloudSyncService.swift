import Foundation
import Combine
import CloudKit

/// iCloud 同步（Pro）：CloudKit 私有库里每本书一条记录（recordType "Trip"，recordName = trip.id，字段 json / updatedAt / title）。
/// 冲突按 updatedAt 取新（ISO 8601 字符串可直接比较）；本地删掉的书（墓碑）把远端也删掉。
///
/// 没开通 iCloud 能力时不能碰 CKContainer（会直接崩溃），所以只有 Info.plist 的 EOCloudKitContainerID 填了容器 ID 才会建容器。
/// 开通步骤见 ios/README.md。
@MainActor
final class CloudSyncService: ObservableObject {
    enum Status: Equatable {
        case off
        case notConfigured
        case noAccount
        case syncing
        case synced(Date)
        case failed(String)
    }

    @Published private(set) var status: Status = .off

    static let recordType = "Trip"

    static var containerID: String? {
        guard let id = Bundle.main.object(forInfoDictionaryKey: "EOCloudKitContainerID") as? String,
              !id.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return id
    }

    static var isConfigured: Bool { containerID != nil }

    private var container: CKContainer? {
        guard let id = CloudSyncService.containerID else { return nil }
        return CKContainer(identifier: id)
    }

    /// 同步一次：拉远端 → 合并 → 推本地更新的 → 删墓碑
    func sync(store: TripStore, entitled: Bool) async {
        guard entitled, store.settings.iCloudSync else { status = .off; return }
        guard !store.isEphemeral else { status = .off; return }
        guard let container else { status = .notConfigured; return }
        if case .syncing = status { return }
        status = .syncing
        do {
            let account = try await container.accountStatus()
            guard account == .available else { status = .noAccount; return }
            let db = container.privateCloudDatabase
            let remote = try await fetchAll(db)
            let plan = CloudSyncService.merge(local: store.trips, remote: remote.map(\.trip), tombstones: Set(store.state.deletedTripIDs))
            if plan.merged != store.trips { store.replaceTrips(plan.merged, clearTombstones: false) }
            let toSave: [CKRecord] = plan.upload.compactMap { trip in
                let existing = remote.first { $0.trip.id == trip.id }?.record
                return CloudSyncService.record(for: trip, reusing: existing)
            }
            let toDelete = plan.deleteRemote.map { CKRecord.ID(recordName: $0) }
            if !toSave.isEmpty || !toDelete.isEmpty {
                _ = try await db.modifyRecords(saving: toSave, deleting: toDelete, savePolicy: .allKeys, atomically: false)
            }
            store.replaceTrips(store.trips, clearTombstones: true)
            status = .synced(Date())
        } catch {
            status = .failed(error.localizedDescription)
        }
    }

    private func fetchAll(_ db: CKDatabase) async throws -> [(record: CKRecord, trip: Trip)] {
        var out: [(record: CKRecord, trip: Trip)] = []
        let query = CKQuery(recordType: CloudSyncService.recordType, predicate: NSPredicate(value: true))
        var (results, cursor) = try await db.records(matching: query, desiredKeys: nil, resultsLimit: CKQueryOperation.maximumResults)
        while true {
            for (_, r) in results {
                if case .success(let rec) = r, let t = CloudSyncService.trip(from: rec) { out.append((rec, t)) }
            }
            guard let c = cursor else { break }
            (results, cursor) = try await db.records(continuingMatchFrom: c, desiredKeys: nil, resultsLimit: CKQueryOperation.maximumResults)
        }
        return out
    }

    static func record(for trip: Trip, reusing existing: CKRecord?) -> CKRecord? {
        let rec = existing ?? CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: trip.id))
        guard let json = String(data: TripImporter.encode(trip), encoding: .utf8) else { return nil }
        rec["json"] = json
        rec["updatedAt"] = trip.updatedAt
        rec["title"] = trip.title
        return rec
    }

    static func trip(from rec: CKRecord) -> Trip? {
        guard let json = rec["json"] as? String, let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Trip.self, from: data)
    }

    struct MergePlan: Equatable {
        var merged: [Trip]
        var upload: [Trip]
        var deleteRemote: [String]
    }

    /// 纯函数，便于测试：同 id 取 updatedAt 新的；只在一边有的照收；本地墓碑里的远端记录删掉
    nonisolated static func merge(local: [Trip], remote: [Trip], tombstones: Set<String>) -> MergePlan {
        var merged: [Trip] = []
        var upload: [Trip] = []
        var deleteRemote: [String] = []
        var remoteByID: [String: Trip] = [:]
        for r in remote { remoteByID[r.id] = r }
        for l in local {
            if let r = remoteByID[l.id] {
                if r.updatedAt > l.updatedAt { merged.append(r) }
                else {
                    merged.append(l)
                    if l.updatedAt > r.updatedAt { upload.append(l) }
                }
                remoteByID[l.id] = nil
            } else {
                merged.append(l)
                upload.append(l)
            }
        }
        for r in remote where remoteByID[r.id] != nil {
            if tombstones.contains(r.id) { deleteRemote.append(r.id) } else { merged.append(r) }
        }
        return MergePlan(merged: merged, upload: upload, deleteRemote: deleteRemote)
    }
}
