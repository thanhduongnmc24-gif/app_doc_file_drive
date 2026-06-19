package com.teotuyetvoi.drivereader

import android.app.Application
import com.facebook.react.*
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {

            override fun getUseDeveloperSupport(): Boolean {
                return BuildConfig.DEBUG
            }

            override fun getPackages(): List<ReactPackage> {
                val packages = PackageList(this).packages
                packages.add(HardwareKeyPackage())
                return packages
            }

            override fun getJSMainModuleName(): String {
                return "index"
            }
        }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
    }
}
