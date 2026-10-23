import Foundation
import Combine
import Speech
import AVFoundation

/// 手机上的语音转文字（SFSpeechRecognizer，locale 跟随界面语言；支持时强制在设备上识别，不上传录音）。
@MainActor
final class SpeechService: ObservableObject {
    enum Failure: Equatable { case denied, unavailable, audio(String) }

    @Published private(set) var isListening = false
    @Published private(set) var transcript = ""
    /// 0…1 的音量，给麦克风按钮的呼吸动画用
    @Published private(set) var level: Double = 0
    @Published var failure: Failure?

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    /// 麦克风 + 语音识别的授权
    func requestPermissions() async -> Bool {
        let speech: Bool = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status == .authorized)
            }
        }
        guard speech else { failure = .denied; return false }
        let mic = await AVAudioApplication.requestRecordPermission()
        if !mic { failure = .denied }
        return mic
    }

    func start(language: AppLanguage = .current) {
        stop()
        failure = nil
        transcript = ""
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language.speechLocale)) ?? SFSpeechRecognizer(),
              recognizer.isAvailable else {
            failure = .unavailable
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
            req.taskHint = .dictation
            request = req

            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            let onLevel: @Sendable (Double) -> Void = { [weak self] v in
                Task { @MainActor in self?.level = v }
            }
            input.installTap(onBus: 0, bufferSize: 1024, format: format, block: SpeechService.makeTap(request: req, onLevel: onLevel))
            engine.prepare()
            try engine.start()

            let onResult: @Sendable (String?, Bool) -> Void = { [weak self] text, finished in
                Task { @MainActor in
                    guard let self else { return }
                    if let text { self.transcript = text }
                    if finished { self.stopAudio() }
                }
            }
            task = recognizer.recognitionTask(with: req, resultHandler: SpeechService.makeResultHandler(onResult))
            isListening = true
        } catch {
            failure = .audio(error.localizedDescription)
            stop()
        }
    }

    /// 停止并返回听到的话
    @discardableResult
    func stop() -> String {
        let text = transcript
        stopAudio()
        task?.cancel()
        task = nil
        return text
    }

    private func stopAudio() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        request = nil
        isListening = false
        level = 0
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // 两个回调在音频线程 / 识别线程上跑：在非隔离的静态函数里造，免得被推断成主线程闭包
    nonisolated private static func makeTap(request: SFSpeechAudioBufferRecognitionRequest,
                                            onLevel: @escaping @Sendable (Double) -> Void) -> AVAudioNodeTapBlock {
        return { buffer, _ in
            request.append(buffer)
            onLevel(rms(buffer))
        }
    }

    nonisolated private static func makeResultHandler(_ onResult: @escaping @Sendable (String?, Bool) -> Void) -> @Sendable (SFSpeechRecognitionResult?, Error?) -> Void {
        return { result, error in
            onResult(result?.bestTranscription.formattedString, error != nil || (result?.isFinal ?? false))
        }
    }

    nonisolated private static func rms(_ buffer: AVAudioPCMBuffer) -> Double {
        guard let ch = buffer.floatChannelData?[0] else { return 0 }
        let n = Int(buffer.frameLength)
        guard n > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<n { sum += ch[i] * ch[i] }
        return min(1, Double(sqrt(sum / Float(n))) * 10)
    }
}

/// 朗读规划助手的回复（AVSpeechSynthesizer，语言跟随界面）
@MainActor
final class SpeechVoice {
    private let synth = AVSpeechSynthesizer()

    func speak(_ text: String, language: AppLanguage = .current) {
        guard !text.isEmpty else { return }
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: language.speechLocale)
        u.rate = AVSpeechUtteranceDefaultSpeechRate
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
        synth.speak(u)
    }

    func stop() {
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
    }
}
