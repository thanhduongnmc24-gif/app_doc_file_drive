package com.teotuyetvoi.drivereader

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class HardwareKeyModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "HardwareKeyModule"

    companion object {
        private var instance: HardwareKeyModule? = null

        fun setInstance(module: HardwareKeyModule) {
            instance = module
        }

        fun sendKeyEvent(keyCode: Int) {
            instance?.reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("HardwareKeyPress", Arguments.createMap().apply {
                    putInt("keyCode", keyCode)
                })
        }
    }

    init {
        setInstance(this)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}