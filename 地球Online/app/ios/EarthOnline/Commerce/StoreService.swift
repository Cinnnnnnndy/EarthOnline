import Foundation
import Combine
import StoreKit

/// StoreKit 2 的骨架：拉商品、买、恢复、监听交易，算出 Entitlements。
/// 本地测试用 ios/EarthOnline.storekit（scheme 的 Run 已经指向它）；正式上架前在 App Store Connect 建同样 ID 的商品。
enum ProductIDs {
    static let proMonthly = "app.earthonline.pro.monthly"
    static let proYearly = "app.earthonline.pro.yearly"
    static let landmarkPack = "app.earthonline.pack.landmarks"
    static let all = [proYearly, proMonthly, landmarkPack]
}

@MainActor
final class StoreService: ObservableObject {

    enum PurchaseOutcome: Equatable { case purchased, pending, cancelled, failed(String) }

    @Published private(set) var products: [Product] = []
    @Published private(set) var entitlements: Entitlements = .free
    @Published private(set) var isLoading = false
    @Published private(set) var loadFailed = false

    /// 调试：启动参数 `-proUnlocked YES` 直接当 Pro（截图、测试用）
    private let debugPro: Bool
    private var updatesTask: Task<Void, Never>?

    init(debugPro: Bool = false) {
        self.debugPro = debugPro
        if debugPro { entitlements = Entitlements(isPro: true, packs: [ProductIDs.landmarkPack]) }
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(result)
            }
        }
    }

    var proYearly: Product? { products.first { $0.id == ProductIDs.proYearly } }
    var proMonthly: Product? { products.first { $0.id == ProductIDs.proMonthly } }
    var landmarkPack: Product? { products.first { $0.id == ProductIDs.landmarkPack } }

    func loadProducts() async {
        guard products.isEmpty, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let list = try await Product.products(for: ProductIDs.all)
            products = list.sorted { ProductIDs.all.firstIndex(of: $0.id) ?? 9 < ProductIDs.all.firstIndex(of: $1.id) ?? 9 }
            loadFailed = list.isEmpty
        } catch {
            loadFailed = true
        }
        await refreshEntitlements()
    }

    func purchase(_ product: Product) async -> PurchaseOutcome {
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handle(verification)
                return .purchased
            case .pending:
                return .pending
            case .userCancelled:
                return .cancelled
            @unknown default:
                return .cancelled
            }
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    func refreshEntitlements() async {
        guard !debugPro else { return }
        var pro = false
        var packs: Set<String> = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, t.revocationDate == nil else { continue }
            if t.productID == ProductIDs.proMonthly || t.productID == ProductIDs.proYearly {
                if let exp = t.expirationDate, exp < Date() { continue }
                pro = true
            } else {
                packs.insert(t.productID)
            }
        }
        entitlements = Entitlements(isPro: pro, packs: packs)
    }

    private func handle(_ result: VerificationResult<Transaction>) async {
        if case .verified(let t) = result {
            await t.finish()
        }
        await refreshEntitlements()
    }
}
