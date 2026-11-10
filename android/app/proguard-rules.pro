# Capacitor bridge + annotations
-keep class com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.annotation.CapacitorPlugin
-keep @interface com.getcapacitor.PluginMethod

# Plugin methods are invoked reflectively from the JS bridge
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod <methods>;
    @com.getcapacitor.PluginMethod <methods>;
}

# Capacitor + Cordova plugin classes are resolved by class name at runtime
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# WebView JS interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Better stack traces for crash reporting
-keepattributes SourceFile,LineNumberTable
