package app.earthonline.android.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * 照片小卡（D82 / D99）：抠好的图存在 files/cards/<id>.img（PNG 或 JPEG，读的时候看文件头），书里只记 { id, kind, w, h }。
 * 抠图本身在嵌入页（make-card，网页那套本机抠图），三端同一个结果；这里只管读照片、缩小、存取。
 */
object CaseCards {
    /** 发给嵌入页的照片长边（嵌入页再缩到 640 抠；再大只是白传） */
    private const val SEND_MAX_SIDE = 1280

    private fun dir(context: Context) = File(context.filesDir, "cards").apply { mkdirs() }
    private fun file(context: Context, id: String) = File(dir(context), Share.safeName(id) + ".img")

    fun save(context: Context, id: String, bytes: ByteArray) {
        val f = file(context, id)
        val tmp = File(f.parentFile, f.name + ".tmp")
        tmp.writeBytes(bytes)
        tmp.renameTo(f)
    }

    fun delete(context: Context, id: String) { file(context, id).delete() }

    /** 存着的卡 → data URL（show-suitcase 的 cards）；没有这张返回 null */
    fun dataUrl(context: Context, id: String): String? {
        val f = file(context, id)
        if (!f.exists()) return null
        val bytes = f.readBytes()
        return "data:${mimeOf(bytes)};base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    /** PNG 的文件头是 89 50 4E 47；其余当 JPEG */
    fun mimeOf(bytes: ByteArray): String =
        if (bytes.size >= 4 && bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() && bytes[2] == 0x4E.toByte() && bytes[3] == 0x47.toByte()) "image/png" else "image/jpeg"

    /** 从相册选的一张照片 → 缩到长边 ≤ 1280、按 EXIF 转正（API 28+ 的 ImageDecoder 自己转）→ JPEG 的 data URL；读不出来返回 null。在 IO 线程调 */
    fun photoDataUrl(context: Context, uri: Uri): String? = runCatching {
        val bmp = decode(context, uri) ?: return null
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 90, out)
        bmp.recycle()
        "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }.getOrNull()

    private fun decode(context: Context, uri: Uri): Bitmap? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val src = ImageDecoder.createSource(context.contentResolver, uri)
            return ImageDecoder.decodeBitmap(src) { decoder, info, _ ->
                val w = info.size.width; val h = info.size.height
                val k = SEND_MAX_SIDE.toFloat() / max(w, h)
                if (k < 1f) decoder.setTargetSize((w * k).roundToInt().coerceAtLeast(1), (h * k).roundToInt().coerceAtLeast(1))
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE   // 要 compress，不能是硬件位图
            }
        }
        // API 26–27：先量尺寸，按 2 的幂缩着读，再精确缩到 1280（不转 EXIF 方向：这两版的机器不多，横着的照片抠出来也能用）
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= SEND_MAX_SIDE) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val bmp = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) } ?: return null
        val k = SEND_MAX_SIDE.toFloat() / max(bmp.width, bmp.height)
        if (k >= 1f) return bmp
        val scaled = Bitmap.createScaledBitmap(bmp, (bmp.width * k).roundToInt().coerceAtLeast(1), (bmp.height * k).roundToInt().coerceAtLeast(1), true)
        if (scaled !== bmp) bmp.recycle()
        return scaled
    }
}
