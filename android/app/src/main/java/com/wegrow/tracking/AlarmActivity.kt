package com.wegrow.tracking

import android.app.KeyguardManager
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import android.widget.TextView
import android.widget.LinearLayout
import android.widget.Button
import android.view.Gravity
import android.graphics.Color
import android.view.View
import android.os.Handler
import android.os.Looper

class AlarmActivity : AppCompatActivity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Wake screen and show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            km.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val title = intent.getStringExtra("title") ?: "Task Alarm"
        val body  = intent.getStringExtra("body")  ?: "Scheduled activity is due now."

        // Cancel the alarm notification so its channel sound doesn't double-play
        // with AlarmActivity's own MediaPlayer
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.cancel(AlarmBroadcastReceiver.NOTIF_ID)

        buildUI(title, body)
        startAlarm()
    }

    private fun buildUI(title: String, body: String) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0F172A"))
            setPadding(48, 80, 48, 80)
        }

        // Alarm icon text
        val icon = TextView(this).apply {
            text = "🚨"
            textSize = 64f
            gravity = Gravity.CENTER
        }

        // Title
        val titleView = TextView(this).apply {
            text = title
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 12)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }

        // Body
        val bodyView = TextView(this).apply {
            text = body
            textSize = 15f
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 64)
        }

        // Dismiss button
        val dismissBtn = Button(this).apply {
            text = "DISMISS"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#DC2626"))
            setPadding(80, 28, 80, 28)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setOnClickListener { stopAndFinish() }
        }

        // Snooze button
        val snoozeBtn = Button(this).apply {
            text = "Snooze 5 min"
            textSize = 14f
            setTextColor(Color.parseColor("#94A3B8"))
            setBackgroundColor(Color.parseColor("#1E293B"))
            setPadding(60, 20, 60, 20)
            setOnClickListener { snooze() }
        }

        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            addView(snoozeBtn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.marginEnd = 24 })
            addView(dismissBtn)
        }

        root.addView(icon)
        root.addView(titleView)
        root.addView(bodyView)
        root.addView(btnRow)

        setContentView(root)
    }

    private fun startAlarm() {
        // Start looping ringtone on ALARM stream (bypasses silent/DND)
        try {
            val afd = resources.openRawResourceFd(R.raw.routine_alarm_ringtone)
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Start looping vibration
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            val pattern = longArrayOf(0, 500, 300, 500, 300)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Auto-dismiss after 3 minutes if user doesn't respond
        handler.postDelayed({ stopAndFinish() }, 3 * 60 * 1000L)
    }

    private fun snooze() {
        stopAlarm()
        // Reschedule via broadcast after 5 minutes
        val snoozedTitle = intent.getStringExtra("title") ?: "Task Alarm"
        val snoozedBody  = intent.getStringExtra("body")  ?: "Snoozed reminder."
        AlarmBroadcastReceiver.scheduleSnooze(this, snoozedTitle, snoozedBody, 5)
        finish()
    }

    private fun stopAndFinish() {
        stopAlarm()
        finish()
    }

    private fun stopAlarm() {
        handler.removeCallbacksAndMessages(null)
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (_: Exception) {}
        try {
            vibrator?.cancel()
            vibrator = null
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarm()
    }

    override fun onBackPressed() {
        // Back button = dismiss
        stopAndFinish()
    }
}
