package app.earthonline.android.world

import android.view.ViewGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

/**
 * 把常驻的世界层 WebView 挂进 Compose。WebView 由 WorldController 持有（跨重组、跨配置变化都是同一个），
 * 这里只负责「挂上去」：先从旧的父视图上摘下来（Activity 重建时旧的视图树可能还拿着它）。
 * 渲染进程被回收后 WorldController 会换一个新的 WebView，key 变了就重新挂。
 */
@Composable
fun WorldHost(world: WorldController, modifier: Modifier = Modifier) {
    val webView by world.webView.collectAsState()
    val wv = webView ?: return
    key(wv) {
        AndroidView(
            factory = {
                (wv.parent as? ViewGroup)?.removeView(wv)
                wv
            },
            modifier = modifier,
        )
    }
}
