package com.teotuyetvoi.drivereader;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class HardwareKeyModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContext;

    public HardwareKeyModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @NonNull
    @Override
    public String getName() {
        return "HardwareKeyModule";
    }

    public static void sendKeyEvent(int keyCode) {
        if (reactContext == null) return;

        WritableMap map = Arguments.createMap();
        map.putInt("keyCode", keyCode);

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("HardwareKeyPress", map);
    }

    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}
}