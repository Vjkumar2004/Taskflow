import { format, parseISO, isValid, isToday, isPast } from 'date-fns';
import { taskService, parseSectionTimeRange, getCurrentUserId } from './taskService';
import { notificationStorage } from './notificationStorage';

export interface GeneratedReminder {
  title: string;
  message: string;
  type: 'urgent' | 'reminder' | 'briefing' | 'success';
  route: string;
  sound: 'gentle' | 'urgent' | 'hourly' | 'upcoming' | 'pending';
  idempotencyKey: string;
}

// In-memory set to prevent duplicate trigger during app session
const triggeredKeys = new Set<string>();

export function clearTriggeredKeys(): void {
  triggeredKeys.clear();
}

export async function evaluateTaskReminders(): Promise<GeneratedReminder[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return []; // Never generate reminders if user is not authenticated
  }

  const remindersToTrigger: GeneratedReminder[] = [];
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const currentTotalMin = now.getHours() * 60 + now.getMinutes();

  try {
    // 1. Fetch Today's Daily Schedule, Custom Tasks, and Stored Notifications
    const [dailyData, allCustomTasks, pendingTasks, storedNotifs] = await Promise.all([
      taskService.getTasksForDate(todayStr),
      taskService.getAllCustomTasks(),
      taskService.getPendingTasks(),
      notificationStorage.getNotifications(),
    ]);

    // Check both memory cache and persistent storage to prevent duplicates
    const persistedKeys = new Set(
      (storedNotifs || []).map((n) => n.idempotencyKey).filter(Boolean) as string[]
    );
    const isAlreadyTriggered = (k: string) => triggeredKeys.has(k) || persistedKeys.has(k);
    const markTriggered = (k: string) => triggeredKeys.add(k);

    // Gather all today's items with time info
    const tasksToEvaluate: {
      id: string;
      title: string;
      dueTime?: string;
      dueDate?: string;
      isDone: boolean;
      isUrgent: boolean;
    }[] = [];

    // Daily custom tasks
    (dailyData.customTasks || []).forEach((ct) => {
      tasksToEvaluate.push({
        id: ct.id,
        title: ct.title,
        dueTime: ct.dueTime,
        dueDate: ct.dueDate || todayStr,
        isDone: ct.status === 'completed' || ct.status === 'skipped',
        isUrgent: ct.priority === 'high' || !!ct.isTopPriority,
      });
    });

    // All custom tasks for today
    allCustomTasks.forEach((ct) => {
      if (ct.dueDate === todayStr) {
        tasksToEvaluate.push({
          id: ct.id,
          title: ct.title,
          dueTime: ct.dueTime,
          dueDate: ct.dueDate,
          isDone: ct.status === 'completed',
          isUrgent: ct.priority === 'high' || !!ct.isTopPriority,
        });
      }
    });

    // Fixed routine activities with time slots
    (dailyData.routineActivities || []).forEach((act) => {
      let slotTime = '';
      if (act.timeSlot) {
        const match = act.timeSlot.match(/(\d{1,2}:\d{2})/);
        if (match) slotTime = match[1];
      }
      if (slotTime) {
        const allDone = act.items.every((_, idx) =>
          dailyData.completedIds.has(`schedule_${act.id}_item_${idx}`)
        );
        tasksToEvaluate.push({
          id: act.id,
          title: act.title,
          dueTime: slotTime,
          dueDate: todayStr,
          isDone: allDone,
          isUrgent: true,
        });
      }
    });

    // ── Evaluate Each Task for Reminders, Start, Warning ────────────
    for (const task of tasksToEvaluate) {
      if (!task.dueTime) continue;

      const [h, m] = task.dueTime.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) continue;

      const taskTotalMin = h * 60 + m;
      const diffMin = taskTotalMin - currentTotalMin; // positive: future, negative: past

      // A. Upcoming Reminder (within 15 minutes before start)
      if (!task.isDone && diffMin > 0 && diffMin <= 15) {
        const key = `upcoming_${task.id}_${todayStr}_${task.dueTime}`;
        if (!isAlreadyTriggered(key)) {
          markTriggered(key);
          remindersToTrigger.push({
            title: `Upcoming: ${task.title} in ${diffMin} mins`,
            message: `Scheduled routine activity begins at ${task.dueTime}. Get ready for execution.`,
            type: 'reminder',
            route: '/(tabs)',
            sound: 'upcoming',
            idempotencyKey: key,
          });
        }
      }

      // B. Time to Start Notification (at scheduled time: 0 to 5 mins past)
      if (!task.isDone && diffMin <= 0 && diffMin >= -5) {
        const key = `start_${task.id}_${todayStr}_${task.dueTime}`;
        if (!isAlreadyTriggered(key)) {
          markTriggered(key);
          remindersToTrigger.push({
            title: `Time to Start: ${task.title}`,
            message: `It is now ${task.dueTime}. Open your checklist and begin your focused task.`,
            type: 'briefing',
            route: '/(tabs)',
            sound: 'hourly',
            idempotencyKey: key,
          });
        }
      }

      // C. Warning / Overdue Notification (past start time > 15 mins & still unfinished)
      if (!task.isDone && diffMin < -15 && diffMin >= -180) {
        const key = `warning_overdue_${task.id}_${todayStr}`;
        if (!isAlreadyTriggered(key)) {
          markTriggered(key);
          remindersToTrigger.push({
            title: `Warning: Unfinished Task Overdue`,
            message: `"${task.title}" was scheduled for ${task.dueTime} and is still incomplete.`,
            type: 'urgent',
            route: '/(tabs)/custom-tasks',
            sound: 'urgent',
            idempotencyKey: key,
          });
        }
      }
    }

    // ── Evaluate Daily Checklist Containers (e.g. 09:00 - 09:30 AM block) ──
    (dailyData.dailySections || []).forEach((sec) => {
      const timeInfo = parseSectionTimeRange(sec.timeRange);
      if (!timeInfo) return;

      const unfinishedCount = sec.items.filter((item) => {
        const itemId = item.routineId ? `custom_routine_${item.routineId}` : `${sec.id}_item_${item.itemNumber}`;
        return !dailyData.completedIds.has(itemId);
      }).length;

      const isUnfinished = unfinishedCount > 0;
      const diffToStart = timeInfo.startMin - currentTotalMin;
      const diffPastEnd = currentTotalMin - timeInfo.endMin;

      // 1. Upcoming Checklist Container (within 15 mins before container starts)
      if (isUnfinished && diffToStart > 0 && diffToStart <= 15) {
        const key = `upcoming_container_${sec.id}_${todayStr}`;
        if (!isAlreadyTriggered(key)) {
          markTriggered(key);
          remindersToTrigger.push({
            title: `Upcoming Checklist: ${sec.timeRange}`,
            message: `"${sec.sectionTitle}" begins in ${diffToStart} mins (${unfinishedCount} items queued).`,
            type: 'reminder',
            route: '/(tabs)',
            sound: 'upcoming',
            idempotencyKey: key,
          });
        }
      }

      // 2. Active Checklist Container (current time slot starts now)
      if (isUnfinished && diffToStart <= 0 && currentTotalMin <= timeInfo.endMin && Math.abs(diffToStart) <= 5) {
        const key = `active_container_${sec.id}_${todayStr}`;
        if (!isAlreadyTriggered(key)) {
          markTriggered(key);
          remindersToTrigger.push({
            title: `Checklist Slot Active: ${sec.timeRange}`,
            message: `"${sec.sectionTitle}" time slot has started! You have ${unfinishedCount} checklist items to complete.`,
            type: 'briefing',
            route: '/(tabs)',
            sound: 'hourly',
            idempotencyKey: key,
          });
        }
      }

      // 3. Checklist Container Overdue & Incomplete (current time is past the container end time)
      if (isUnfinished && diffPastEnd > 0 && diffPastEnd <= 720) {
        const key = `overdue_container_${sec.id}_${todayStr}`;
        if (!isAlreadyTriggered(key)) {
          markTriggered(key);
          remindersToTrigger.push({
            title: `⚠️ Pending Checklist Overdue: ${sec.timeRange}`,
            message: `"${sec.sectionTitle}" ended with ${unfinishedCount} unfinished items! Container is marked red.`,
            type: 'urgent',
            route: '/(tabs)',
            sound: 'urgent',
            idempotencyKey: key,
          });
        }
      }
    });

    // ── D. Pending Backlog Notification (earlier unfinished tasks awaiting carryover) ──
    if (pendingTasks.length > 0) {
      const key = `pending_backlog_${todayStr}_${pendingTasks.length}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: `Action Required: ${pendingTasks.length} Pending Tasks`,
          message: `You have unfinished tasks from previous days awaiting your review or carryover.`,
          type: 'urgent',
          route: '/(tabs)/pending',
          sound: 'pending',
          idempotencyKey: key,
        });
      }
    }

    // ── E. Weekly Schedule & Review Notifications ─────────────────────────────
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentHour = now.getHours();

    // 1. Monday Executive Planning Launch (Mondays between 08:00 AM - 11:30 AM)
    if (dayOfWeek === 1 && currentHour >= 8 && currentHour <= 11) {
      const key = `weekly_planning_${todayStr}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: '📅 Monday Planning: Weekly Focus Schedule',
          message: 'Good morning! Open your Weekly Schedule to plan your weekly focus and goals.',
          type: 'briefing',
          route: '/(tabs)/weekly',
          sound: 'hourly',
          idempotencyKey: key,
        });
      }
    }

    // 2. Mid-Week Momentum Check (Wednesdays between 02:00 PM - 06:00 PM)
    if (dayOfWeek === 3 && currentHour >= 14 && currentHour <= 18) {
      const key = `weekly_midweek_${todayStr}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: '⚡ Mid-Week Execution Momentum',
          message: 'Half the week is complete! Review your weekly task completion and maintain momentum.',
          type: 'reminder',
          route: '/(tabs)/weekly',
          sound: 'gentle',
          idempotencyKey: key,
        });
      }
    }

    // 3. Weekly Review & Closure (Fridays after 05:00 PM OR Saturdays 10:00 AM - 07:00 PM)
    if ((dayOfWeek === 5 && currentHour >= 17) || (dayOfWeek === 6 && currentHour >= 10 && currentHour <= 19)) {
      const key = `weekly_review_${todayStr}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: '📋 Weekly Review & Task Carryover',
          message: "Review this week's checklist momentum. Ensure unfinished tasks are completed or scheduled.",
          type: 'urgent',
          route: '/(tabs)/weekly',
          sound: 'urgent',
          idempotencyKey: key,
        });
      }
    }

    // 4. Sunday Evening Prep for Upcoming Week (Sundays between 06:00 PM - 10:00 PM)
    if (dayOfWeek === 0 && currentHour >= 18 && currentHour <= 22) {
      const key = `weekly_sunday_prep_${todayStr}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: "🎯 Upcoming Week's Agenda Ready",
          message: "Prepare for the new week. Review tomorrow's scheduled tasks and set your daily routines.",
          type: 'briefing',
          route: '/(tabs)/weekly',
          sound: 'hourly',
          idempotencyKey: key,
        });
      }
    }

    // ── F. Monthly Roadmap & Strategic Goal Notifications ──────────────────────
    const dayOfMonth = now.getDate();
    const monthKey = format(now, 'yyyy-MM');
    const monthName = format(now, 'MMMM yyyy');

    // 1. Monthly Kickoff Roadmap (1st, 2nd, 3rd of the month between 08:30 AM - 01:00 PM)
    if (dayOfMonth <= 3 && currentHour >= 8 && currentHour <= 13) {
      const key = `monthly_kickoff_${monthKey}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: `🎯 Monthly Roadmap Active: ${monthName}`,
          message: 'New month strategic roadmap is active! Review admissions pace, fee collection, and monthly key milestones.',
          type: 'briefing',
          route: '/(tabs)/monthly',
          sound: 'hourly',
          idempotencyKey: key,
        });
      }
    }

    // 2. Mid-Month Performance & Target Audit (14th, 15th, 16th of the month between 09:00 AM - 03:00 PM)
    if (dayOfMonth >= 14 && dayOfMonth <= 16 && currentHour >= 9 && currentHour <= 15) {
      const key = `monthly_mid_audit_${monthKey}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: '📊 Mid-Month Target Audit: Day 15',
          message: 'Mid-month milestone reached! Audit admissions shortfall and fee collection pace against monthly targets.',
          type: 'urgent',
          route: '/(tabs)/monthly',
          sound: 'urgent',
          idempotencyKey: key,
        });
      }
    }

    // 3. Month-End Target Closure & Final Review (28th through end of month, 09:00 AM - 08:00 PM)
    if (dayOfMonth >= 28 && currentHour >= 9 && currentHour <= 20) {
      const key = `monthly_closure_${monthKey}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: '🏁 Month-End Closure & Target Audit',
          message: 'Month-end audit active. Close remaining monthly roadmap items and verify overall target completion % in Monthly tab.',
          type: 'urgent',
          route: '/(tabs)/monthly',
          sound: 'urgent',
          idempotencyKey: key,
        });
      }
    }

    // 4. Active Monthly Week Review (Week 1, 2, 3, 4 milestone alert once per week on weekdays between 09:00 - 12:00)
    let currentWeekNum = 1;
    if (dayOfMonth > 21) currentWeekNum = 4;
    else if (dayOfMonth > 14) currentWeekNum = 3;
    else if (dayOfMonth > 7) currentWeekNum = 2;

    if (currentHour >= 9 && currentHour <= 12 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      const key = `monthly_week_${monthKey}_w${currentWeekNum}`;
      if (!isAlreadyTriggered(key)) {
        markTriggered(key);
        remindersToTrigger.push({
          title: `📌 Week ${currentWeekNum} Monthly Milestones`,
          message: `Working through Week ${currentWeekNum} roadmap. Tap to review your monthly strategic checklist.`,
          type: 'reminder',
          route: '/(tabs)/monthly',
          sound: 'gentle',
          idempotencyKey: key,
        });
      }
    }

    // Persist all generated reminders to notificationStorage
    for (const rem of remindersToTrigger) {
      await notificationStorage.addNotification({
        title: rem.title,
        message: rem.message,
        type: rem.type,
        idempotencyKey: rem.idempotencyKey,
      });
    }

    // Prioritize urgent reminders first
    remindersToTrigger.sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, reminder: 1, briefing: 2, success: 3 };
      return (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99);
    });

    return remindersToTrigger;
  } catch (err) {
    console.warn('Reminder evaluation warning:', err);
    return [];
  }
}
