package com.teotuyetvoi.drivereader

import android.view.KeyEvent
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String {
        return "main"
    }

    private fun isOurKey(keyCode: Int): Boolean {
        return keyCode in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9 ||
                keyCode == KeyEvent.KEYCODE_DPAD_UP ||
                keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
                keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
                keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                keyCode == KeyEvent.KEYCODE_ENTER ||
                keyCode == KeyEvent.KEYCODE_BACK ||
                keyCode == KeyEvent.KEYCODE_DEL ||
                keyCode == KeyEvent.KEYCODE_STAR ||
                keyCode == KeyEvent.KEYCODE_POUND
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val keyCode = event.keyCode

        if (isOurKey(keyCode)) {
            if (event.action == KeyEvent.ACTION_UP) {
                HardwareKeyModule.sendKeyEvent(keyCode)
            }
            return true
        }

        return super.dispatchKeyEvent(event)
    }
}