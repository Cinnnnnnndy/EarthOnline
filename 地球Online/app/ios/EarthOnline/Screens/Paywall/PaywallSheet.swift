import SwiftUI
import StoreKit

/// 付费墙：贴内容高度的玻璃面板。免费用户建第 4 本书、或点 Pro 功能时出现。
struct PaywallSheet: View {
    let feature: ProFeature

    @EnvironmentObject private var purchases: StoreService
    @Environment(\.dismiss) private var dismiss
    @State private var busy: String?
    @State private var message: String?

    private var benefits: [ProFeature] { ProFeature.allCases }

    var body: some View {
        FittedSheet {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles").foregroundStyle(.secondary)
                    Text(verbatim: "地球Online Pro").font(.eoBodyStrong)
                }
                Text(feature.reason)
                    .font(.eoSub)
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(benefits) { f in
                        Label {
                            Text(f.title).font(.eoBody)
                        } icon: {
                            Image(systemName: f.symbol).foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.vertical, 4)

                if purchases.entitlements.isPro {
                    Label("已开通 Pro", systemImage: "checkmark.seal.fill")
                        .font(.eoBodyStrong)
                        .foregroundStyle(Color.eoDawnInk)
                } else if purchases.products.isEmpty {
                    HStack(spacing: 8) {
                        if purchases.isLoading { ProgressView() }
                        Text(purchases.isLoading ? "正在连接 App Store……" : "暂时连不上 App Store，稍后再试。")
                            .font(.eoSub)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    GlassEffectContainer(spacing: 10) {
                        VStack(spacing: 10) {
                            if let y = purchases.proYearly {
                                buyButton(y, title: String(localized: "按年订阅，\(y.displayPrice)/年"), prominent: true)
                            }
                            if let m = purchases.proMonthly {
                                buyButton(m, title: String(localized: "按月订阅，\(m.displayPrice)/月"), prominent: false)
                            }
                            if feature == .landmarkPack, let p = purchases.landmarkPack, !purchases.entitlements.packs.contains(p.id) {
                                buyButton(p, title: String(localized: "只买名胜扩展包，\(p.displayPrice)"), prominent: false)
                            }
                        }
                    }
                }
                if let message {
                    Text(message).font(.eoSub).foregroundStyle(.secondary)
                }
                HStack {
                    Button("恢复购买") {
                        Task {
                            busy = "restore"
                            await purchases.restore()
                            busy = nil
                            if purchases.entitlements.isPro { dismiss() }
                        }
                    }
                    .font(.eoSub)
                    Spacer()
                    Button("以后再说") { dismiss() }
                        .font(.eoSub)
                }
                .buttonStyle(.borderless)
                .frame(minHeight: Metrics.touch)
                Text("订阅自动续期，随时可在系统设置里取消。")
                    .font(.eoSub)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .padding(.bottom, 16)
        }
        .task { await purchases.loadProducts() }
    }

    @ViewBuilder
    private func buyButton(_ product: Product, title: String, prominent: Bool) -> some View {
        let label = HStack {
            Text(title).font(.eoBodyStrong)
            if busy == product.id { ProgressView().padding(.leading, 4) }
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 30)
        if prominent {
            Button { buy(product) } label: { label }
                .buttonStyle(InkCapsuleButtonStyle())
                .disabled(busy != nil)
        } else {
            Button { buy(product) } label: { label }
                .buttonStyle(.glass)
                .controlSize(.large)
                .disabled(busy != nil)
        }
    }

    private func buy(_ product: Product) {
        Task { @MainActor in
            busy = product.id
            let outcome = await purchases.purchase(product)
            busy = nil
            switch outcome {
            case .purchased: dismiss()
            case .pending: message = String(localized: "购买待确认，确认后会自动开通。")
            case .cancelled: break
            case .failed(let why): message = why
            }
        }
    }
}
