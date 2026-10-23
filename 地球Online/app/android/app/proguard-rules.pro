# 世界层回调：window.androidBridge.postMessage(json) 靠反射找 @JavascriptInterface 方法，混淆后也要留着
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keep class app.earthonline.android.world.WorldJsBridge { *; }

# kotlinx.serialization：库自带 R8 规则（1.5 起）；这里只保证 @Serializable 类的伴生 serializer() 不被去掉
-keepattributes *Annotation*, InnerClasses
-keepclassmembers @kotlinx.serialization.Serializable class app.earthonline.android.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
