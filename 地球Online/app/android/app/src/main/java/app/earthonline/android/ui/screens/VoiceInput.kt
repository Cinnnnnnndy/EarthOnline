package app.earthonline.android.ui.screens

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * 说一句话做行程的语音输入（可选）：系统的 SpeechRecognizer，语言跟界面（zh-CN / en-US / ja-JP）。
 * 识别出的文字交给规划（core plan），和打字走同一条路。没有识别服务的设备上麦克风按钮不显示。
 * 错误码 → i18n 的 voice.* 键（ui 层换成文字）。
 */
class VoiceInput(
    private val context: Context,
    private val languageTag: String,
    private val onPartial: (String) -> Unit,
    private val onFinal: (String) -> Unit,
    private val onFailure: (String) -> Unit,
    private val onListening: (Boolean) -> Unit,
) {
    private var recognizer: SpeechRecognizer? = null

    val available: Boolean get() = SpeechRecognizer.isRecognitionAvailable(context)

    fun start() {
        stop()
        val r = SpeechRecognizer.createSpeechRecognizer(context)
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) = onListening(true)
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() = onListening(false)
            override fun onError(error: Int) {
                onListening(false)
                onFailure(
                    when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "voice.noSpeech"
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "voice.network"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "voice.micDenied"
                        SpeechRecognizer.ERROR_AUDIO -> "voice.noMic"
                        else -> "voice.error"
                    },
                )
            }
            override fun onResults(results: Bundle?) {
                onListening(false)
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                if (text.isNotBlank()) onFinal(text)
            }
            override fun onPartialResults(partialResults: Bundle?) {
                partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let(onPartial)
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        recognizer = r
        r.startListening(intent)
    }

    fun stopListening() {
        recognizer?.stopListening()
    }

    fun stop() {
        recognizer?.destroy()
        recognizer = null
    }
}
