import { Platform, Linking } from 'react-native';
import { supabase } from '../lib/supabase';

// Safely load expo-notifications to prevent crashes in Expo Go (where FCM native modules are excluded)
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (err) {
  console.warn(
    '[PushNotificationService] Native notifications module not available in this environment (Expo Go). Falling back gracefully.'
  );
  Notifications = null;
}

export const NOTIFICATION_CHANNELS = {
  URGENT_ALARM: 'urgent-alarm-channel-v3',
  ROUTINE_REMINDERS: 'routine-reminders-channel-v3',
  GENERAL: 'general-channel-v3',
};

class PushNotificationService {
  private isInitialized = false;
  private pushToken: string | null = null;
  private deviceFcmToken: string | null = null;

  /**
   * Check if native OS notifications are supported in current runner (e.g. false in Expo Go, true in Dev Build/APK)
   */
  isNotificationsAvailable(): boolean {
    return Notifications !== null;
  }

  /**
   * Initialize Android notification channels with high-importance and custom sounds.
   * Uses v2 channel IDs to force Android OS to recreate the channel and bind custom sounds.
   */
  async setupNotificationChannels(): Promise<void> {
    if (!Notifications || Platform.OS !== 'android') return;

    try {
      // 1. High-priority Continuous / Urgent Alarm Channel (v2)
      // Mapped to Android ALARM stream so it rings loudly even in silent/DND mode
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.URGENT_ALARM, {
        name: 'Urgent Task Alarms',
        description: 'High-priority executive alarms for overdue tasks and urgent carryovers',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 800],
        lightColor: '#DC2626',
        enableLights: true,
        enableVibrate: true,
        sound: 'routine_alarm_ringtone',
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage?.ALARM ?? 4,
          contentType: Notifications.AndroidAudioContentType?.SONIFICATION ?? 4,
        },
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      // 2. Scheduled Routine Checklist Reminders Channel (v2) - Single Tune Format
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.ROUTINE_REMINDERS, {
        name: 'Checklist Reminders',
        description: 'Upcoming scheduled routine checklist container reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D9531E',
        enableLights: true,
        enableVibrate: true,
        sound: 'alarm_chime',
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage?.NOTIFICATION ?? 5,
          contentType: Notifications.AndroidAudioContentType?.SONIFICATION ?? 4,
        },
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      // 3. Default General Channel (v2)
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.GENERAL, {
        name: 'General Updates',
        description: 'Daily briefing and milestone completion updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#10B981',
      });
    } catch (err) {
      console.warn('Could not set up Android notification channels:', err);
    }
  }

  /**
   * Request notification permissions & register for FCM / Expo Push tokens
   */
  async registerForPushNotifications(forceSync = false): Promise<{
    expoToken: string | null;
    deviceToken: string | null;
    isExpoGo?: boolean;
  }> {
    if (!Notifications) {
      return { expoToken: null, deviceToken: null, isExpoGo: true };
    }

    if (this.isInitialized && this.pushToken && !forceSync) {
      return { expoToken: this.pushToken, deviceToken: this.deviceFcmToken };
    }

    try {
      await this.setupNotificationChannels();

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Ask for permission if not granted yet
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions denied by user.');
        return { expoToken: null, deviceToken: null };
      }

      // Get Native FCM Device Token (works without EAS project ID)
      // getExpoPushTokenAsync() requires an EAS projectId — we skip it and use
      // the raw FCM device token directly, which our backend sends to FCM legacy API.
      let deviceToken: string | null = null;
      try {
        const nativeData = await Notifications.getDevicePushTokenAsync();
        deviceToken = nativeData.data;
        this.deviceFcmToken = deviceToken;
        this.pushToken = deviceToken;
      } catch (err) {
        console.warn('Could not get Native Device Push Token:', err);
      }

      this.isInitialized = true;

      // Sync token to Supabase for the current user
      await this.syncTokenToSupabase(null, deviceToken);

      // Request battery optimization exemption so killed-state alarms fire
      if (Platform.OS === 'android') {
        this.requestBatteryOptimizationExemption().catch(() => {});
      }

      return { expoToken: null, deviceToken };
    } catch (err) {
      console.warn('Error during push notification registration:', err);
      return { expoToken: null, deviceToken: null };
    }
  }

  /**
   * Store device token in Supabase table for targeted backend pushes.
   * Crucially removes any previous user mapping to this same device token so notifications never cross over!
   */
  async syncTokenToSupabase(expoToken: string | null, deviceToken: string | null): Promise<void> {
    const tokenToSave = expoToken || deviceToken;
    if (!tokenToSave) return;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      // 1. Clean up: Delete any previous user associated with this physical device token
      await supabase
        .from('user_push_tokens')
        .delete()
        .eq('token', tokenToSave)
        .neq('user_id', userId);

      // 2. Upsert token for current active user
      await supabase.from('user_push_tokens').upsert(
        {
          user_id: userId,
          token: tokenToSave,
          fcm_token: deviceToken,
          platform: Platform.OS,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, token' }
      );
    } catch (err) {
      console.warn('Could not sync push token to Supabase:', err);
    }
  }

  /**
   * Called when a user signs out to cleanly detach device tokens and clear alarms
   */
  async onSignOut(userId?: string): Promise<void> {
    try {
      // 1. Cancel all scheduled OS-level local notification alarms
      await this.cancelAllScheduled();

      // 2. If token exists, remove it or deactivate it from Supabase
      const token = this.pushToken || this.deviceFcmToken;
      if (token) {
        let query = supabase.from('user_push_tokens').delete().eq('token', token);
        if (userId) {
          query = query.eq('user_id', userId);
        }
        await query;
      }

      // 3. Reset in-memory session tokens
      this.isInitialized = false;
      this.pushToken = null;
      this.deviceFcmToken = null;
    } catch (err) {
      console.warn('Error during push notification sign out cleanup:', err);
    }
  }

  /**
   * Schedule a local OS-level push notification that rings even when the app is in background
   */
  async scheduleLocalNotification({
    title,
    body,
    channelId = NOTIFICATION_CHANNELS.ROUTINE_REMINDERS,
    secondsFromNow = 1,
    data = {},
  }: {
    title: string;
    body: string;
    channelId?: string;
    secondsFromNow?: number;
    data?: Record<string, any>;
  }): Promise<string | null> {
    if (!Notifications) return null;

    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound:
            channelId === NOTIFICATION_CHANNELS.URGENT_ALARM
              ? 'routine_alarm_ringtone.mp3'
              : 'alarm_chime.mp3',
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
        trigger:
          secondsFromNow > 0
            ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: Math.max(1, secondsFromNow),
              }
            : null,
      });
      return identifier;
    } catch (err) {
      console.warn('Could not schedule local notification:', err);
      return null;
    }
  }

  /**
   * Schedule OS alarms for all daily section containers (checklist time blocks).
   * Call this once per day on app open so alarms fire even when app is killed.
   * Cancels all existing scheduled notifications first to avoid duplicates.
   */
  async scheduleDailySectionAlarms(
    sections: Array<{ id: string; title: string; timeRange: string; startTime: string }>
  ): Promise<void> {
    if (!Notifications) return;

    for (const sec of sections) {
      if (!sec.startTime) continue;
      const [h, m] = sec.startTime.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) continue;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const [year, month, day] = todayStr.split('-').map(Number);
      const target = new Date(year, month - 1, day, h, m, 0, 0);
      const diffMs = target.getTime() - now.getTime();

      // Only schedule alarms that are in the future (> 30 seconds away)
      if (diffMs <= 30000) continue;

      try {
        // Alarm AT start time
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ Checklist Starting: ${sec.title}`,
            body: `Time slot ${sec.timeRange} has begun. Open your checklist now.`,
            sound: 'routine_alarm_ringtone',
            channelId: NOTIFICATION_CHANNELS.URGENT_ALARM,
            data: { sectionId: sec.id, type: 'section-start', route: '/(tabs)' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: target,
          },
        });

        // Reminder 10 mins before (if far enough)
        const tenMinBefore = diffMs - 10 * 60 * 1000;
        if (tenMinBefore > 30000) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Upcoming in 10m: ${sec.title}`,
              body: `Checklist block ${sec.timeRange} starts in 10 minutes. Get ready.`,
              sound: 'alarm_chime',
              channelId: NOTIFICATION_CHANNELS.ROUTINE_REMINDERS,
              data: { sectionId: sec.id, type: 'section-reminder', route: '/(tabs)' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(target.getTime() - 10 * 60 * 1000),
            },
          });
        }
      } catch (err) {
        console.warn('[PushNotificationService] Could not schedule section alarm:', err);
      }
    }
  }

  /**
   * Proactively schedule a native OS alarm for a specific task ahead of time.
   * This uses Android's native AlarmManager via Expo Notifications, meaning it WILL ring
   * even if the app is completely closed, killed from memory, or the phone screen is locked.
   */
  async scheduleTaskAlarmAhead({
    id,
    title,
    dueDate,
    dueTime,
    isUrgent = false,
  }: {
    id: string;
    title: string;
    dueDate?: string;
    dueTime?: string;
    isUrgent?: boolean;
  }): Promise<void> {
    if (!Notifications || !dueTime) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetDateStr = dueDate || todayStr;

      // Parse HH:mm from dueTime (handles "14:30" or "02:30 PM")
      let hours = 0;
      let minutes = 0;

      const timeMatch = dueTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const meridiem = timeMatch[3]?.toUpperCase();
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
      } else {
        const parts = dueTime.split(':').map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          hours = parts[0];
          minutes = parts[1];
        } else {
          return;
        }
      }

      const [year, month, day] = targetDateStr.split('-').map(Number);
      if (!year || !month || !day) return;

      const targetDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      const now = new Date();
      const diffMs = targetDateTime.getTime() - now.getTime();

      // 1. If task is in the future, schedule the Exact Start Time Alarm (Continuous Ringtone channel)
      if (diffMs > 5000) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: isUrgent ? `🚨 URGENT: ${title}` : `⏰ Time to Start: ${title}`,
            body: `Scheduled executive activity is due now (${dueTime}). Tap to open checklist.`,
            sound: 'routine_alarm_ringtone.mp3',
            channelId: NOTIFICATION_CHANNELS.URGENT_ALARM,
            data: { taskId: id, type: 'task-start', route: '/(tabs)' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: targetDateTime,
          },
        });
      }

      // 2. Schedule 15-Minute Upcoming Notice (Single Tune Chime channel) if at least 16 minutes in future
      const fifteenMinsBeforeMs = diffMs - 15 * 60 * 1000;
      if (fifteenMinsBeforeMs > 10000) {
        const priorDate = new Date(targetDateTime.getTime() - 15 * 60 * 1000);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Upcoming in 15m: ${title}`,
            body: `Scheduled routine begins at ${dueTime}. Get ready for execution.`,
            sound: 'alarm_chime.mp3',
            channelId: NOTIFICATION_CHANNELS.ROUTINE_REMINDERS,
            data: { taskId: id, type: 'task-reminder', route: '/(tabs)' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: priorDate,
          },
        });
      }
    } catch (err) {
      console.warn('[PushNotificationService] Error scheduling proactive task alarm:', err);
    }
  }

  /**
   * Ask Android to exempt this app from battery optimization so AlarmManager
   * fires even when the app is killed. Prompts user once per install.
   */
  async requestBatteryOptimizationExemption(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      // ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS opens the per-app dialog directly.
      // Requires android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS in manifest.
      const url = 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch {
      // Fallback: open general battery optimization list
      try {
        await Linking.openURL('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      } catch (err) {
        console.warn('Could not open battery optimization settings:', err);
      }
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllScheduled(): Promise<void> {
    if (!Notifications) return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (err) {
      console.warn('Could not cancel scheduled notifications:', err);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
