package app.earthonline.android.util

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File

/**
 * 分享文件（行李箱 PNG、行程 JSON）：写进 cache/exports/，经 FileProvider（authority = 包名 + ".files"，
 * 见 AndroidManifest 与 res/xml/file_paths.xml）给系统的分享面板。
 */
object Share {
    private val UNSAFE = Regex("""[\\/:*?"<>|\n\r\t]""")

    fun safeName(name: String): String = name.replace(UNSAFE, "_").trim().ifEmpty { "export" }.take(80)

    fun file(context: Context, name: String, bytes: ByteArray, mime: String) {
        try {
            val dir = File(context.cacheDir, "exports").apply { mkdirs() }
            val f = File(dir, safeName(name))
            f.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(context, context.packageName + ".files", f)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newRawUri(null, uri)   // 让分享面板选中的应用也拿到读权限
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(send, null)
            if (context !is Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)
        } catch (e: Exception) {
            Log.w("Share", "share failed", e)
        }
    }
}
