import { NativeModules, Platform } from 'react-native';

const { AlarmModule } = NativeModules;

// Debug: log on load so we know if bridge is available
if (Platform.OS === 'android') {
  console.log('[AlarmService] AlarmModule available:', !!AlarmModule);
  if (!AlarmModule) {
    console.warn('[AlarmService] ❌ AlarmModule is NULL — native bridge not loaded. Check AlarmPackage registration in MainApplication.kt');
  }
}

// Stable numeric request codes per task (hash of string id)
function stableCode(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2_000_000;
}

export const alarmService = {
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!AlarmModule;
  },

  /** Check & request all permissions needed for full-screen alarms */
  async requestExactAlarmPermission(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const exactResult = await AlarmModule.checkAndRequestExactAlarmPermission();
      console.log('[AlarmService] Exact alarm permission:', exactResult);
    } catch (err) {
      console.warn('[AlarmService] Exact alarm permission error:', err);
    }
    try {
      const fsiResult = await AlarmModule.checkAndRequestFullScreenIntentPermission();
      console.log('[AlarmService] FullScreenIntent permission:', fsiResult);
    } catch (err) {
      console.warn('[AlarmService] FullScreenIntent permission error:', err);
    }
    try {
      const overlayResult = await AlarmModule.checkAndRequestOverlayPermission();
      console.log('[AlarmService] Appear on top (overlay) permission:', overlayResult);
    } catch (err) {
      console.warn('[AlarmService] Overlay permission error:', err);
    }
    try {
      // Critical for Samsung/OnePlus/Xiaomi — battery optimization kills background alarms
      await AlarmModule.requestBatteryOptimizationExemption();
      console.log('[AlarmService] Battery optimization exemption requested');
    } catch (err) {
      console.warn('[AlarmService] Battery optimization error:', err);
    }
  },

  /** Open alarm screen immediately (e.g. from foreground trigger) */
  async triggerNow(title: string, body: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await AlarmModule.triggerAlarmNow(title, body);
    } catch (err) {
      console.warn('[AlarmService] triggerNow error:', err);
    }
  },

  /** Schedule alarm screen at a specific future Date */
  async scheduleAt(id: string, title: string, body: string, date: Date): Promise<void> {
    if (!this.isAvailable()) return;
    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 5000) return; // too close or past
    try {
      const code = stableCode(id);
      await AlarmModule.scheduleAlarm(title, body, date.getTime(), code);
    } catch (err) {
      console.warn('[AlarmService] scheduleAt error:', err);
    }
  },

  /** Cancel a previously scheduled alarm */
  async cancel(id: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await AlarmModule.cancelAlarm(stableCode(id));
    } catch (err) {
      console.warn('[AlarmService] cancel error:', err);
    }
  },

  /** Schedule a quick test alarm N seconds from now to verify system works */
  async scheduleTest(secondsFromNow: number): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('[AlarmService] ❌ Cannot test — AlarmModule not available');
      return;
    }
    const target = new Date(Date.now() + secondsFromNow * 1000);
    await this.scheduleAt(
      `test_alarm_${Date.now()}`,
      '🚨 Test Alarm — TaskFlow',
      `Background alarm fired after ${secondsFromNow} seconds. System working!`,
      target
    );
    console.log(`[AlarmService] ✅ Test alarm set for ${target.toLocaleTimeString()}`);
  },

  /** Schedule alarms for all today's sections, tasks, and pending tasks */
  async scheduleAllDayAlarms(
    sections: Array<{ id: string; title: string; timeRange: string; startTime: string }>,
    tasks: Array<{ id: string; title: string; dueTime: string; dueDate?: string }>,
    pendingTasks: Array<{ id: string; title: string }> = []
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // Checklist section alarms
    for (const sec of sections) {
      if (!sec.startTime) continue;
      const [h, m] = sec.startTime.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) continue;
      const [y, mo, d] = todayStr.split('-').map(Number);
      const target = new Date(y, mo - 1, d, h, m, 0, 0);
      await this.scheduleAt(
        `section_${sec.id}`,
        `⏰ Checklist Starting: ${sec.title}`,
        `Time slot ${sec.timeRange} has begun. Open your checklist now.`,
        target
      );
      // 10-min warning
      const warn = new Date(target.getTime() - 10 * 60 * 1000);
      await this.scheduleAt(
        `section_warn_${sec.id}`,
        `Upcoming in 10m: ${sec.title}`,
        `Checklist block ${sec.timeRange} starts in 10 minutes.`,
        warn
      );
    }

    // Custom / upcoming task alarms (at due time + 15-min warning)
    for (const task of tasks) {
      if (!task.dueTime) continue;
      const timeMatch = task.dueTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!timeMatch) continue;
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const mer = timeMatch[3]?.toUpperCase();
      if (mer === 'PM' && h < 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      const dateStr = task.dueDate || todayStr;
      const [y, mo, d] = dateStr.split('-').map(Number);
      const target = new Date(y, mo - 1, d, h, m, 0, 0);
      await this.scheduleAt(
        `task_${task.id}`,
        `⏰ Time to Start: ${task.title}`,
        `Scheduled task is due now at ${task.dueTime}. Tap to begin.`,
        target
      );
      const warn = new Date(target.getTime() - 15 * 60 * 1000);
      await this.scheduleAt(
        `task_warn_${task.id}`,
        `Upcoming in 15m: ${task.title}`,
        `Task starts at ${task.dueTime}. Get ready.`,
        warn
      );
    }

    // Pending tasks morning reminder — fires at 9:00 AM today if there are any overdue tasks
    if (pendingTasks.length > 0) {
      const [y, mo, d] = todayStr.split('-').map(Number);
      const morningReminder = new Date(y, mo - 1, d, 9, 0, 0, 0);
      const count = pendingTasks.length;
      const label = count === 1 ? `"${pendingTasks[0].title}"` : `${count} tasks`;
      await this.scheduleAt(
        `pending_morning_${todayStr}`,
        `⚠️ Pending Tasks Waiting`,
        `You have ${label} from previous days that need attention today.`,
        morningReminder
      );
      // Also a midday nudge at 1:00 PM
      const noon = new Date(y, mo - 1, d, 13, 0, 0, 0);
      await this.scheduleAt(
        `pending_noon_${todayStr}`,
        `⏳ Don't Forget Pending Tasks`,
        `Still ${count} pending task${count > 1 ? 's' : ''} waiting to be completed.`,
        noon
      );
    }
  },
};
