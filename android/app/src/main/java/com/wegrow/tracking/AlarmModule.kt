package com.wegrow.tracking

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class AlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AlarmModule"

    /** Check if exact alarms are allowed (Android 12+) and open settings if not */
    @ReactMethod
    fun checkAndRequestExactAlarmPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!am.canScheduleExactAlarms()) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    reactContext.startActivity(intent)
                    promise.resolve("opened_settings")
                } catch (e: Exception) {
                    promise.resolve("settings_failed")
                }
            } else {
                promise.resolve("granted")
            }
        } else {
            promise.resolve("not_required")
        }
    }

    /**
     * Android 14+: USE_FULL_SCREEN_INTENT requires explicit user grant.
     * Without it, fullScreenIntent fires the notification but AlarmActivity never opens.
     * Opens Settings → Apps → WeGrow → Allow full screen intents.
     * Uses string literal for ACTION because the constant was added in API 34.
     */
    @ReactMethod
    fun checkAndRequestFullScreenIntentPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= 34) { // Android 14 (UPSIDE_DOWN_CAKE)
            val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            val canUse = try {
                // canUseFullScreenIntent() added in API 34 — call via reflection to avoid compile error
                val method = nm.javaClass.getMethod("canUseFullScreenIntent")
                method.invoke(nm) as Boolean
            } catch (_: Exception) {
                true // assume granted if reflection fails
            }
            if (!canUse) {
                try {
                    // "android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENTS" is the API 34 action string
                    val intent = Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENTS").apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(intent)
                    promise.resolve("opened_settings")
                } catch (e: Exception) {
                    promise.resolve("settings_failed")
                }
            } else {
                promise.resolve("granted")
            }
        } else {
            promise.resolve("not_required") // Android 13 and below always allows it
        }
    }

    /**
     * Check & request "Appear on top" (Display over other apps / SYSTEM_ALERT_WINDOW).
     * Required on Android 10+ (and especially Android 14) to open AlarmActivity directly over lock screen.
     */
    @ReactMethod
    fun checkAndRequestOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(reactContext)) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    reactContext.startActivity(intent)
                    promise.resolve("opened_settings")
                } catch (e: Exception) {
                    promise.resolve("settings_failed")
                }
            } else {
                promise.resolve("granted")
            }
        } else {
            promise.resolve("not_required")
        }
    }

    /** Immediately show the full-screen alarm notification / AlarmActivity.
     *  Works from any state (foreground, background, killed). */
    @ReactMethod
    fun triggerAlarmNow(title: String, body: String, promise: Promise) {
        try {
            AlarmBroadcastReceiver.showFullScreenAlarmNotification(reactContext, title, body)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message)
        }
    }

    /**
     * Schedule AlarmActivity to open at a specific epoch-millisecond time.
     *
     * Uses AlarmBroadcastReceiver via PendingIntent.getBroadcast() with WAKEUP.
     * When triggered:
     * 1. AlarmBroadcastReceiver acquires a WakeLock
     * 2. Fires high-priority Notification with fullScreenIntent pointing to AlarmActivity
     * 3. Starts AlarmForegroundService which launches AlarmActivity
     * This bypasses Android 10-14 Background Activity Launch (BAL) blocks.
     */
    @ReactMethod
    fun scheduleAlarm(title: String, body: String, epochMs: Double, requestCode: Int, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(reactContext, AlarmBroadcastReceiver::class.java).apply {
                action = AlarmBroadcastReceiver.ACTION_TRIGGER_ALARM
                putExtra("title", title)
                putExtra("body", body)
            }
            val pi = PendingIntent.getBroadcast(
                reactContext,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAt = epochMs.toLong()
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                else ->
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_SCHEDULE_ERROR", e.message)
        }
    }

    /** Cancel a previously scheduled alarm by requestCode */
    @ReactMethod
    fun cancelAlarm(requestCode: Int, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(reactContext, AlarmBroadcastReceiver::class.java).apply {
                action = AlarmBroadcastReceiver.ACTION_TRIGGER_ALARM
            }
            val pi = PendingIntent.getBroadcast(
                reactContext,
                requestCode,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            pi?.let { alarmManager.cancel(it) }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_CANCEL_ERROR", e.message)
        }
    }

    /** Open battery optimization exemption settings for this app */
    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        try {
            val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve("opened")
        } catch (e: Exception) {
            promise.resolve("failed")
        }
    }
}
