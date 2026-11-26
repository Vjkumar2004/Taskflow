package com.wegrow.tracking

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service started by AlarmBroadcastReceiver to launch AlarmActivity.
 *
 * Why a service? Android 12+ blocks startActivity() from a BroadcastReceiver.
 * BUT when the BroadcastReceiver was triggered by an exact alarm (AlarmManager),
 * it IS allowed to start a foreground service — and a foreground service CAN
 * call startActivity(). This works even without USE_FULL_SCREEN_INTENT permission.
 */
class AlarmForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra("title") ?: "Task Alarm"
        val body  = intent?.getStringExtra("body")  ?: "Scheduled activity is due now."

        // Must call startForeground immediately (ANR risk if delayed)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                "alarm_service_ch", "Alarm Launcher", NotificationManager.IMPORTANCE_LOW
            )
            nm.createNotificationChannel(ch)
        }
        val serviceNotif = NotificationCompat.Builder(this, "alarm_service_ch")
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= 34) {
            // Android 14+: must declare foreground service type
            startForeground(
                9002, serviceNotif,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(9002, serviceNotif)
        }

        // Launch AlarmActivity — allowed because we're in a foreground service
        // Note: use addFlags() not flags= to avoid conflict with onStartCommand's flags param
        val activityIntent = Intent(this, AlarmActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
            putExtra("title", title)
            putExtra("body", body)
        }
        startActivity(activityIntent)

        // Service job is done — stop immediately
        stopSelf()
        return START_NOT_STICKY
    }
}
