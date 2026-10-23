import SwiftUI

/// 说一说：大麦克风（玻璃，听的时候呼吸）、实时转写、一小段对话；规划器给出草稿后，用户看一眼再点「生成这本书」。
/// 语音在手机上识别（SFSpeechRecognizer，支持时强制本机识别）；助手的回复用 AVSpeechSynthesizer 朗读（设置里可关）。
struct VoiceComposer: View {
    let onCreate: (Trip) -> Void

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var store: TripStore
    @EnvironmentObject private var purchases: StoreService
    @StateObject private var speech = SpeechService()
    @State private var messages: [PlannerMessage] = []
    @State private var draft: Trip?
    @State private var typed = ""
    @State private var thinking = false
    @State private var awaitingTranscript = false
    @FocusState private var typing: Bool

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { reader in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Bubble(role: .assistant, text: String(localized: "说说想去哪里、玩几天、什么时候出发。比如：「十月去京都玩五天，看红叶」。"))
                        ForEach(messages) { m in
                            Bubble(role: m.role, text: m.text).id(m.id)
                        }
                        if speech.isListening {
                            Bubble(role: .user, text: speech.transcript.isEmpty ? String(localized: "在听……") : speech.transcript, live: true)
                                .id("live")
                        }
                        if thinking {
                            ProgressView()
                                .padding(.leading, 8)
                                .id("thinking")
                        }
                        if draft != nil {
                            DraftCard(draft: $draft, onCreate: onCreate)
                                .id("draft")
                        }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.vertical, 12)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: messages.count) { _, _ in scrollDown(reader) }
                .onChange(of: draft != nil) { _, _ in scrollDown(reader) }
                .onChange(of: speech.transcript) { _, _ in scrollDown(reader) }
            }
            composer
        }
        .onChange(of: speech.isListening) { _, listening in
            guard !listening, awaitingTranscript else { return }
            awaitingTranscript = false
            send(speech.transcript)
        }
        .onDisappear {
            speech.stop()
            app.voice.stop()
        }
    }

    // MARK: - 输入区

    private var composer: some View {
        VStack(spacing: 8) {
            if let f = speech.failure {
                Text(failureText(f))
                    .font(.eoSub)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            HStack(alignment: .center, spacing: 12) {
                TextField("也可以打字", text: $typed)
                    .font(.eoBody)
                    .focused($typing)
                    .submitLabel(.send)
                    .onSubmit { send(typed) }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .frame(minHeight: Metrics.touch)
                    .glassEffect(.regular, in: .capsule)
                if !typed.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    GlassIconButton("arrow.up", label: "发送") { send(typed) }
                }
                MicButton(listening: speech.isListening, level: speech.level, action: toggleMic)
            }
            Text(plannerLabel)
                .font(.eoCaption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private var plannerLabel: String {
        let remote = purchases.entitlements.allows(.remotePlanner) && store.settings.useRemotePlanner && store.settings.plannerURL != nil
        return remote ? String(localized: "云端规划，语音在手机上识别") : String(localized: "离线规划，语音在手机上识别")
    }

    private func failureText(_ f: SpeechService.Failure) -> String {
        switch f {
        case .denied: return String(localized: "需要麦克风和语音识别权限，可以在系统设置里打开；也可以直接打字。")
        case .unavailable: return String(localized: "这台设备暂时不能识别语音，可以直接打字。")
        case .audio: return String(localized: "麦克风没有启动，再试一次或直接打字。")
        }
    }

    private func scrollDown(_ reader: ScrollViewProxy) {
        withAnimation(.snappy) {
            if draft != nil { reader.scrollTo("draft", anchor: .bottom) }
            else if speech.isListening { reader.scrollTo("live", anchor: .bottom) }
            else if let last = messages.last { reader.scrollTo(last.id, anchor: .bottom) }
        }
    }

    // MARK: - 动作

    private func toggleMic() {
        typing = false
        if speech.isListening {
            speech.stop()            // isListening → false，onChange 会把转写发出去
            return
        }
        app.voice.stop()
        Task { @MainActor in
            guard await speech.requestPermissions() else { return }
            awaitingTranscript = true
            speech.start()
            if !speech.isListening { awaitingTranscript = false }
        }
    }

    private func send(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        typed = ""
        messages.append(PlannerMessage(role: .user, text: text))
        Task { await ask() }
    }

    @MainActor
    private func ask() async {
        thinking = true
        defer { thinking = false }
        let lang = AppLanguage.current
        let planner = PlannerFactory.make(settings: store.settings, entitlements: purchases.entitlements)
        let context = PlannerContext(today: app.today, locale: lang.plannerLocale, home: store.home,
                                     trips: store.trips.map { PlannerContext.TripSummary(title: $0.title, startDate: $0.startDate, endDate: $0.endDate) })
        do {
            let r = try await planner.plan(conversation: messages, context: context)
            var text = r.reply
            if let q = r.question, !q.isEmpty { text += (text.isEmpty ? "" : (lang == .en ? " " : "")) + q }
            messages.append(PlannerMessage(role: .assistant, text: text))
            if let d = r.draft {
                draft = d
                if let c = Geo.center(of: d) { app.world.send(WorldMsg.FlyTo(lat: c.lat - 4, lng: c.lng, alt: 0.55)) }
            }
            if store.settings.speakReplies { app.voice.speak(text, language: lang) }
        } catch {
            messages.append(PlannerMessage(role: .assistant, text: error.localizedDescription))
        }
    }
}

/// 对话气泡：助手在左（玻璃），自己在右（墨色淡染的玻璃）
struct Bubble: View {
    let role: PlannerMessage.Role
    let text: String
    var live = false

    private var label: some View {
        Text(text)
            .font(.eoBody)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .textSelection(.enabled)
    }

    var body: some View {
        HStack {
            if role == .user { Spacer(minLength: 48) }
            if role == .user && !live {
                label
                    .foregroundStyle(Color.primary)
                    .glassEffect(.regular.tint(Color.primary.opacity(0.12)), in: .rect(cornerRadius: 18))
            } else {
                label
                    .foregroundStyle(Color.primary)
                    .opacity(live ? 0.7 : 1)
                    .glassEffect(.regular, in: .rect(cornerRadius: 18))
            }
            if role == .assistant { Spacer(minLength: 48) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(role == .user ? Text("我：\(text)") : Text("助手：\(text)"))
    }
}

/// 大麦克风：玻璃圆，听的时候墨色、随音量呼吸，外圈一圈圈散开
struct MicButton: View {
    let listening: Bool
    let level: Double
    let action: () -> Void
    @State private var ripple = false

    @ViewBuilder
    private var glassButton: some View {
        let button = Button(action: action) {
            Image(systemName: listening ? "stop.fill" : "mic.fill")
                .font(.eoTitle)
                .foregroundStyle(listening ? Color(uiColor: .systemBackground) : Color.primary)
                .frame(width: 72, height: 72)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        if listening {
            button.glassEffect(.regular.tint(Color.primary).interactive(), in: .circle)
        } else {
            button.glassEffect(.regular.interactive(), in: .circle)
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        glassButton
        .scaleEffect(listening && !reduceMotion ? CGFloat(1 + min(0.12, level * 0.12)) : 1)
        .animation(.easeOut(duration: 0.12), value: level)
        .background {
            Circle()
                .stroke(Color.primary.opacity(0.35), lineWidth: 2)
                .scaleEffect(ripple ? 1.7 : 1)
                .opacity(ripple || reduceMotion ? 0 : (listening ? 0.9 : 0))
                .animation(listening && !reduceMotion ? Animation.easeOut(duration: 1.4).repeatForever(autoreverses: false) : Animation.easeOut(duration: 0.2), value: ripple)
        }
        .onChange(of: listening) { _, on in ripple = on }
        .sensoryFeedback(.impact(weight: .light), trigger: listening)
        .accessibilityLabel(listening ? Text("停止并发送") : Text("说话"))
    }
}
