package app.earthonline.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import app.earthonline.android.app.AppModel
import app.earthonline.android.ui.EarthApp

/**
 * 唯一的 Activity：边到边，Compose 画全部界面；世界层是 AppModel 里那个常驻的 WebView。
 * Manifest 里声明了 configChanges（方向、尺寸、屏幕布局、密度、深浅色……），折叠 / 展开 / 旋转都不重建 Activity，
 * WebView 不会重载；Compose 随 Configuration 重新排版（rememberLayout 重新量折痕）。
 */
class MainActivity : ComponentActivity() {
    private val model: AppModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { EarthApp(model) }
    }

    override fun onStart() {
        super.onStart()
        model.setForeground(true)
    }

    override fun onStop() {
        model.setForeground(false)
        super.onStop()
    }
}
