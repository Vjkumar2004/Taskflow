package com.wegrow.tracking

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat

class AlarmBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "Task Alarm"
        val body  = intent.getStringExtra("body")  ?: "Scheduled activity is due now."

        // Acquire WakeLock to keep CPU awake while turning screen on
        try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            val wl = pm.newWakeLock(
                android.os.PowerManager.PARTIAL_WAKE_LOCK or android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "taskflow:AlarmReceiverWakeLock"
            )
            wl.acquire(15000)
        } catch (_: Exception) {}

        when (intent.action) {
            ACTION_TRIGGER_ALARM,
            ACTION_SNOOZE_ALARM -> showFullScreenAlarmNotification(context, title, body)
        }
    }

    companion object {
        const val ACTION_TRIGGER_ALARM = "com.wegrow.tracking.TRIGGER_ALARM"
        const val ACTION_SNOOZE_ALARM  = "com.wegrow.tracking.SNOOZE_ALARM"
        const val ALARM_CHANNEL_ID     = "wegrow_native_alarm_v2"
        const val NOTIF_ID             = 9001

        /**
         * Show a high-priority notification with a fullScreenIntent pointing to AlarmActivity.
         *
         * Android behaviour:
         *  - Phone sleeping / screen off  → screen turns ON, AlarmActivity shown full-screen
         *  - Another app in foreground    → heads-up notification banner; tap → AlarmActivity
         *  - App killed                   → same as sleeping
         */
        fun showFullScreenAlarmNotification(context: Context, title: String, body: String) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Create/ensure alarm channel with sound — MUST be done before first notify.
            // Channel sound is locked after first creation, so use a versioned channel ID.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val soundUri = Uri.parse(
                    "android.resource://${context.packageName}/raw/routine_alarm_ringtone"
                )
                val audioAttr = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                val ch = NotificationChannel(
                    ALARM_CHANNEL_ID,
                    "WeGrow Task Alarms",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Full-screen alarms for scheduled tasks"
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 500, 300, 500, 300)
                    setBypassDnd(true)
                    setSound(soundUri, audioAttr)
                }
                nm.createNotificationChannel(ch)
            }

            // PendingIntent → AlarmActivity (full screen)
            val activityIntent = Intent(context, AlarmActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("title", title)
                putExtra("body", body)
            }
            val fullScreenPi = PendingIntent.getActivity(
                context,
                NOTIF_ID,
                activityIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // PendingIntent → open app on notification tap (if user dismisses full-screen)
            val tapIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val tapPi = PendingIntent.getActivity(
                context,
                NOTIF_ID + 1,
                tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val soundUri = Uri.parse(
                "android.resource://${context.packageName}/raw/routine_alarm_ringtone"
            )
            val notification = NotificationCompat.Builder(context, ALARM_CHANNEL_ID)
                .setSmallIcon(R.drawable.notification_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOngoing(true)           // keeps notification visible until dismissed
                .setSound(soundUri)
                .setContentIntent(tapPi)
                .setFullScreenIntent(fullScreenPi, true)   // ← opens AlarmActivity
                .build()

            nm.notify(NOTIF_ID, notification)

            // Also start foreground service → it calls startActivity(AlarmActivity).
            // This is the reliable path on Android 12-14 because:
            // - An exact-alarm BroadcastReceiver IS allowed to start a foreground service
            // - A foreground service IS allowed to call startActivity()
            // - No USE_FULL_SCREEN_INTENT permission needed
            val serviceIntent = Intent(context, AlarmForegroundService::class.java).apply {
                putExtra("title", title)
                putExtra("body", body)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        }

        /** Schedule a snooze: re-trigger after `minutes` minutes */
        fun scheduleSnooze(context: Context, title: String, body: String, minutes: Int) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, AlarmBroadcastReceiver::class.java).apply {
                action = ACTION_SNOOZE_ALARM
                putExtra("title", title)
                putExtra("body", body)
            }
            val pi = PendingIntent.getBroadcast(
                context,
                System.currentTimeMillis().toInt(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAt = SystemClock.elapsedRealtime() + minutes * 60 * 1000L
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            } else {
                alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            }
        }
    }
}
