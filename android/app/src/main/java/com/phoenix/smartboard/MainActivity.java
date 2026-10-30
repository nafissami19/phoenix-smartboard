package com.phoenix.smartboard;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(DeviceLibraryPlugin.class);
        registerPlugin(DisplayAnnotationPlugin.class);
        registerPlugin(SmartboardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
