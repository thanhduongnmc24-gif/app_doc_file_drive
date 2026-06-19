package com.teotuyetvoi.drivereader

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.PackageList
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

    private val mReactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {

            override fun getUseDeveloperSupport(): Boolean {
                return BuildConfig.DEBUG
            }

            override fun getPackages(): List<ReactPackage> {
                val packages = PackageList(this).packages
                packages.add(HardwareKeyPackage()) // 👈 QUAN TRỌNG
                return packages
            }

            override fun getJSMainModuleName(): String {
                return "index"
            }
        }

    override fun getReactNativeHost(): ReactNativeHost {
        return mReactNativeHost
    }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
    }
}