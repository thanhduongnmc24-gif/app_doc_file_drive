package com.teotuyetvoi.drivereader;

import com.facebook.react.*;
importanager.ViewManager;import com.facebook.react.bridge.*;

import java.util.*;

public class HardwareKeyPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext context) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new HardwareKeyModule(context));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext context) {
        return Collections.emptyList();
    }
}
