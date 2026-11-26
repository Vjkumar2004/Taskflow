import { supabase } from '../lib/supabase';
import { MobileTask, MonthlyGoal, TaskPriority, TaskCategory, TaskStatus } from '../types';
import { FIXED_EXCEL_ROUTINE_DATA } from '../data/fixed-routine-data';
import { format } from 'date-fns';

// Helper to get authenticated user ID for multi-user data isolation
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session.user.id;
    const { data: userData } = await supabase.auth.getUser();
    return userData?.user?.id || null;
  } catch {
    return null;
  }
}

// Converts any string into a deterministic valid UUID (same algorithm as website)
function stringToUuid(str: string): string {
  if (!str) return '00000000-0000-0000-0000-000000000000';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return str.toLowerCase();
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x811c9dc5, h4 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2246822507);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2654435761);
  h4 = Math.imul(h4 ^ (h4 >>> 15), 1597334677);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = (h4 >>> 0).toString(16).padStart(8, '0');
  const full = hex1 + hex2 + hex3 + hex4;
  return `${full.slice(0,8)}-${full.slice(8,12)}-4${full.slice(13,16)}-a${full.slice(17,20)}-${full.slice(20,32)}`;
}

// Map mobile status to DB-allowed values
function mapToDbStatus(status: string): string {
  if (['todo', 'in_progress', 'completed', 'snoozed'].includes(status)) return status;
  if (status === 'skipped') return 'snoozed';
  return 'todo';
}

export interface RoutineActivity {
  id: string;
  dayOfWeek: string;
  timeSlot: string;
  timeBlock: string;
  title: string;
  branch: string;
  priority: string;
  category: string;
  items: string[];
  isCustom?: boolean; // true for user-added focus items
}

export interface DailySection {
  id: string;
  sectionTitle: string;
  timeRange: string;
  isCustom?: boolean; // true for user-added routines section
  items: {
    itemNumber: number;
    text: string;
    branch: string;
    actionNeeded?: string;
    routineId?: string; // set for custom routine items
  }[];
}

export interface CustomRoutine {
  id: string;
  title: string;
  time: string;      // HH:MM, e.g. "10:00"
  startDate: string; // YYYY-MM-DD, routine appears from this date onwards
  isActive: boolean;
  createdAt: string;
  days?: string;     // comma-separated short day names, e.g. "Mon,Wed,Fri"; empty = every day
}

// Parse time ranges like "9:00 – 9:30 AM", "11:30 AM - 1:00 PM", "2:00 - 4:00 PM" into minutes from midnight
export function parseSectionTimeRange(timeRange: string): { startMin: number; endMin: number } | null {
  if (!timeRange) return null;
  const normalized = timeRange.replace(/–/g, '-').trim();
  const parts = normalized.split('-');
  if (parts.length !== 2) return null;

  const parseTimePart = (part: string, fallbackPeriod?: string): { min: number; period: string } | null => {
    const trimmed = part.trim();
    const periodMatch = trimmed.match(/(AM|PM)/i);
    const period = periodMatch ? periodMatch[1].toUpperCase() : fallbackPeriod || 'AM';
    const cleanTime = trimmed.replace(/(AM|PM)/i, '').trim();
    const [hStr, mStr] = cleanTime.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr ? parseInt(mStr, 10) : 0;
    if (isNaN(h)) return null;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return { min: h * 60 + m, period };
  };

  const endResult = parseTimePart(parts[1]);
  if (!endResult) return null;
  const startResult = parseTimePart(parts[0], endResult.period);
  if (!startResult) return null;

  return { startMin: startResult.min, endMin: endResult.min };
}

// Helper to merge custom focus items into matching activities by day & time
export function mergeFocusItemsIntoActivities(activities: any[], focusRows: any[]): any[] {
  // Deep clone activities to avoid mutating static objects
  const list = JSON.parse(JSON.stringify(activities));

  // Initialize checkItems on each activity
  list.forEach((act: any) => {
    act.checkItems = (act.items || []).map((text: string, idx: number) => ({
      key: `schedule_${act.id}_item_${idx}`,
      text,
      isCustom: false,
    }));
  });

  const orphans: any[] = [];

  for (const r of focusRows || []) {
    let title = r.title;
    let items: string[] = [r.title];
    let branch = 'General';
    let priority = 'medium';
    let timeSlot = 'Afternoon 12 PM–4 PM';
    let timeBlock = 'afternoon';

    try {
      if (r.title && (r.title.startsWith('{') || r.title.startsWith('['))) {
        const parsed = JSON.parse(r.title);
        if (parsed && typeof parsed === 'object') {
          if (parsed.title) title = parsed.title;
          if (Array.isArray(parsed.items) && parsed.items.length > 0) items = parsed.items;
          if (parsed.branch) branch = parsed.branch;
          if (parsed.priority) priority = parsed.priority;
          if (parsed.timeSlot) timeSlot = parsed.timeSlot;
          if (parsed.timeBlock) timeBlock = parsed.timeBlock;
        }
      }
    } catch {}

    const slotLower = (timeSlot || '').toLowerCase();
    const titleLower = (title || '').toLowerCase();

    // Smart block matching:
    let matchedBlock = timeBlock;
    if (
      slotLower.includes('12') || slotLower.includes('afternoon') || slotLower.includes('lunch') ||
      titleLower.includes('12pm') || titleLower.includes('12 pm') || titleLower.includes('afternoon')
    ) {
      matchedBlock = 'afternoon';
    } else if (
      slotLower.includes('9') || slotLower.includes('morning') || slotLower.includes('10') || slotLower.includes('11') ||
      titleLower.includes('9am') || titleLower.includes('9 am') || titleLower.includes('morning')
    ) {
      matchedBlock = 'morning';
    } else if (
      slotLower.includes('4') || slotLower.includes('evening') || slotLower.includes('night') || slotLower.includes('5') || slotLower.includes('6') || slotLower.includes('7') ||
      titleLower.includes('4pm') || titleLower.includes('4 pm') || titleLower.includes('evening')
    ) {
      matchedBlock = 'evening';
    }

    // Find the target container for this day & time block!
    const targetActivity = list.find((act: any) => {
      const sameDay = act.dayOfWeek.toLowerCase() === r.day_of_week.toLowerCase();
      if (!sameDay) return false;
      if (act.timeBlock && act.timeBlock === matchedBlock) return true;
      if (act.timeSlot && timeSlot && act.timeSlot.toLowerCase().includes(slotLower)) return true;
      return false;
    });

    if (targetActivity) {
      // JOIN INSIDE THE EXISTING CONTAINER!
      items.forEach((itemText, itemIdx) => {
        targetActivity.checkItems.push({
          key: `schedule_${targetActivity.id}_custom_${r.id}_${itemIdx}`,
          text: itemText,
          isCustom: true,
          dbId: r.id,
          itemIndex: itemIdx,
        });
        targetActivity.items.push(itemText);
      });
    } else {
      // Standalone card only if no container exists
      orphans.push({
        id: `custom_focus_${r.id}`,
        dayOfWeek: r.day_of_week,
        timeSlot: timeSlot || 'Afternoon 12 PM–4 PM',
        timeBlock: matchedBlock || 'afternoon',
        title,
        branch,
        priority,
        category: 'operations',
        items,
        checkItems: items.map((it, itemIdx) => ({
          key: `schedule_custom_focus_${r.id}_item_${itemIdx}`,
          text: it,
          isCustom: true,
          dbId: r.id,
          itemIndex: itemIdx,
        })),
        isCustom: true,
        _dbId: r.id,
      });
    }
  }

  return [...list, ...orphans];
}

export const taskService = {
  // 1. Fetch all items for a given date (Fixed Excel Routine + Real Custom Tasks from Supabase)
  async getTasksForDate(dateStr: string): Promise<{
    routineActivities: RoutineActivity[];
    dailySections: DailySection[];
    customTasks: MobileTask[];
    completedIds: Set<string>;
  }> {
    try {
      const userId = await getCurrentUserId();

      // Find day of week (Monday, Tuesday, etc.)
      const date = new Date(dateStr + 'T00:00:00');
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[date.getDay()];

      // 1. Get Scheduled Focus Activities for this day from Excel dataset + custom focus items
      const staticActivities: RoutineActivity[] = (FIXED_EXCEL_ROUTINE_DATA.weeklySchedule || []).filter(
        (a) => a.dayOfWeek.toLowerCase() === dayName.toLowerCase()
      );

      let focusQuery = supabase
        .from('custom_focus_items')
        .select('*')
        .eq('is_active', true)
        .eq('day_of_week', dayName);

      if (userId) {
        focusQuery = focusQuery.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { data: focusRows } = await focusQuery.order('created_at', { ascending: true });

      const routineActivities: RoutineActivity[] = mergeFocusItemsIntoActivities(
        staticActivities,
        focusRows || []
      );

      // 2. Get 6 Daily Checklist Sections from Excel dataset + user custom routines
      const fixedSections: DailySection[] = FIXED_EXCEL_ROUTINE_DATA.dailyChecklist || [];

      // Fetch active custom routines that have started on or before this date for this user
      let routineQuery = supabase
        .from('custom_routines')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', dateStr);

      if (userId) {
        routineQuery = routineQuery.eq('user_id', userId);
      }

      const { data: routineRows } = await routineQuery.order('created_at', { ascending: true });

      const allCustomRoutines: CustomRoutine[] = (routineRows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        time: r.time_slot || '09:00',
        startDate: r.start_date,
        isActive: r.is_active,
        createdAt: r.created_at,
        days: r.days_of_week || '',
      }));

      // Filter by day-of-week: empty days = every day
      const dayShort = dayName.slice(0, 3); // "Mon", "Tue", ...
      const customRoutines = allCustomRoutines.filter((r) => {
        if (!r.days || r.days.trim() === '') return true;
        return r.days.split(',').map((d) => d.trim()).includes(dayShort);
      });

      // Format "10:00" → "10:00 AM"
      const fmtTime = (t: string) => {
        const [hStr, mStr] = t.split(':');
        const h = parseInt(hStr, 10);
        const period = h < 12 ? 'AM' : 'PM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${mStr} ${period}`;
      };

      // Deep-copy fixed sections so we can inject routine items into them
      const dailySections: DailySection[] = fixedSections.map((sec) => ({
        ...sec,
        items: [...sec.items],
      }));

      // Generate clean dynamic sections for user-defined daily routines
      if (customRoutines.length > 0) {
        const routinesByTime: Record<string, typeof customRoutines> = {};
        customRoutines.forEach((r) => {
          const t = r.time || '09:00';
          if (!routinesByTime[t]) routinesByTime[t] = [];
          routinesByTime[t].push(r);
        });

        Object.keys(routinesByTime).sort().forEach((timeKey, sIdx) => {
          const formattedTime = fmtTime(timeKey);
          const [hStr, mStr] = timeKey.split(':');
          const h = parseInt(hStr, 10);
          const m = parseInt(mStr || '0', 10);
          const endMin = (h * 60 + m + 30) % 1440;
          const endH = Math.floor(endMin / 60);
          const endM = endMin % 60;
          const endFormatted = fmtTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);

          let targetSec = dailySections.find((sec) => (sec as any).defaultTime === timeKey);
          if (!targetSec) {
            targetSec = {
              id: `custom_section_${timeKey.replace(':', '_')}`,
              sectionTitle: `${formattedTime} Routine`,
              timeRange: `${formattedTime} - ${endFormatted}`,
              isCustom: true,
              items: [],
            };
            (targetSec as any).defaultTime = timeKey;
            dailySections.push(targetSec);
          }

          routinesByTime[timeKey].forEach((routine, rIdx) => {
            targetSec!.items.push({
              itemNumber: 900 + sIdx * 50 + rIdx,
              text: routine.title,
              branch: 'Daily Routine',
              routineId: routine.id,
            });
          });
        });
      }

      // 3. Query Real Custom Tasks from Supabase for this date (strictly isolated to this user)
      let customTasks: MobileTask[] = [];
      const completedIds = new Set<string>();

      if (userId) {
        const { data: customData, error: customErr } = await supabase
          .from('custom_tasks')
          .select('*')
          .eq('due_date', dateStr)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!customErr && customData) {
          customTasks = customData.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description || undefined,
            dueDate: t.due_date,
            dueTime: t.due_time || undefined,
            priority: (t.priority || 'medium') as TaskPriority,
            category: (t.category || 'operations') as TaskCategory,
            isTopPriority: Boolean(t.is_top_priority),
            status: (t.status || 'todo') as TaskStatus,
            completedAt: t.completed_at || undefined,
            isFixedRoutine: false,
            notes: t.notes || undefined,
          }));
        }

        // 4. Query completed checklist items for this date from Supabase tasks table, strictly isolated to current user!
        const { data: occData } = await supabase
          .from('tasks')
          .select('id, status, notes')
          .eq('due_date', dateStr)
          .eq('status', 'completed')
          .eq('user_id', userId);

        if (occData) {
          occData.forEach((row: any) => {
            completedIds.add(row.id); // DB UUID
            // Extract the original logical ID (e.g. "sec1_item_3") from notes metadata
            try {
              const meta = JSON.parse(row.notes || '{}');
              const logicalId = meta?.__meta__?.logicalId;
              if (logicalId) completedIds.add(logicalId);
            } catch {}
          });
        }
      }

      return {
        routineActivities,
        dailySections,
        customTasks,
        completedIds,
      };
    } catch (err) {
      console.error('Error fetching tasks for date:', err);
      return {
        routineActivities: [],
        dailySections: [],
        customTasks: [],
        completedIds: new Set(),
      };
    }
  },

  // 2. Toggle Task Complete status in Supabase (isolated to authenticated user)
  async toggleTask(taskId: string, currentStatus: TaskStatus, dateStr?: string): Promise<TaskStatus> {
    const userId = await getCurrentUserId();
    const nextStatus: TaskStatus = currentStatus === 'completed' ? 'todo' : 'completed';
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;

    try {
      // If it's a UUID, it belongs to custom_tasks
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);

      if (isUUID) {
        let updateQ = supabase
          .from('custom_tasks')
          .update({ status: nextStatus, completed_at: completedAt })
          .eq('id', taskId);

        if (userId) {
          updateQ = updateQ.eq('user_id', userId);
        }

        await updateQ;
      } else {
        // Routine checklist item: User-specific deterministic UUID: prevents User A's ticks from overriding User B
        const date = dateStr || format(new Date(), 'yyyy-MM-dd');
        const idSeed = userId ? `${userId}_${taskId}_${date}` : `${taskId}_${date}`;
        const dbId = stringToUuid(idSeed);
        const { error } = await supabase.from('tasks').upsert({
          id: dbId,
          user_id: userId || null,
          title: taskId, // logical id as fallback title
          priority: 'high',
          status: mapToDbStatus(nextStatus),
          category: 'operations',
          due_date: date,
          completed_at: completedAt,
          notes: JSON.stringify({ __meta__: { logicalId: taskId, userId } }),
          updated_at: new Date().toISOString(),
        });
        if (error) console.error('Supabase upsert error for checklist item:', error);
      }

      return nextStatus;
    } catch (err) {
      console.error('Error toggling task:', err);
      return nextStatus;
    }
  },

  // 3. Create Custom Task directly in Supabase (assigned to current user)
  async createCustomTask(task: {
    title: string;
    description?: string;
    dueDate: string;
    dueTime?: string;
    priority: TaskPriority;
    category: TaskCategory;
    isTopPriority?: boolean;
  }): Promise<MobileTask | null> {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('custom_tasks')
        .insert([
          {
            user_id: userId || null,
            title: task.title,
            description: task.description || null,
            due_date: task.dueDate,
            due_time: task.dueTime || null,
            priority: task.priority,
            category: task.category,
            is_top_priority: task.isTopPriority || false,
            status: 'todo',
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert warning:', error.message);
        return {
          id: `local-${Date.now()}`,
          ...task,
          status: 'todo',
        };
      }

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        dueDate: data.due_date,
        dueTime: data.due_time,
        priority: data.priority,
        category: data.category,
        isTopPriority: data.is_top_priority,
        status: data.status,
      };
    } catch (err) {
      console.error('Error in createCustomTask:', err);
      return {
        id: `local-${Date.now()}`,
        ...task,
        status: 'todo',
      };
    }
  },

  // 4. Delete Custom Task in Supabase
  async deleteCustomTask(taskId: string): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      let query = supabase.from('custom_tasks').delete().eq('id', taskId);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;
      return !error;
    } catch {
      return false;
    }
  },

  // 4b. Update Custom Task in Supabase
  async updateCustomTask(taskId: string, updates: Partial<MobileTask>): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.dueTime !== undefined) dbUpdates.due_time = updates.dueTime;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.isTopPriority !== undefined) dbUpdates.is_top_priority = updates.isTopPriority;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

      let query = supabase.from('custom_tasks').update(dbUpdates).eq('id', taskId);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;
      return !error;
    } catch {
      return false;
    }
  },

  // 5. Fetch all Custom Tasks from Supabase for current user
  async getAllCustomTasks(): Promise<MobileTask[]> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return []; // Strictly isolated: no data without authenticated user

      const { data, error } = await supabase
        .from('custom_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });

      if (error || !data) return [];

      return data.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.due_date,
        dueTime: t.due_time,
        priority: (t.priority || 'medium') as TaskPriority,
        category: (t.category || 'operations') as TaskCategory,
        isTopPriority: Boolean(t.is_top_priority),
        status: (t.status || 'todo') as TaskStatus,
        completedAt: t.completed_at,
        notes: t.notes,
      }));
    } catch (err) {
      console.error('Error fetching custom tasks:', err);
      return [];
    }
  },

  // 6. Fetch Pending Tasks from Supabase (Strictly scoped to authenticated user)
  async getPendingTasks(): Promise<MobileTask[]> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        return []; // Strictly isolated: no cross-user or unauthenticated pending tasks
      }

      // Query pending_tasks strictly belonging to this authenticated user
      const { data, error } = await supabase
        .from('pending_tasks')
        .select('*')
        .eq('status', 'pending')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          dueDate: t.original_due_date,
          dueTime: t.due_time,
          priority: (t.priority || 'high') as TaskPriority,
          category: (t.category || 'operations') as TaskCategory,
          status: 'pending',
        }));
      }

      // Check overdue custom_tasks specifically belonging to this user
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { data: overdueCustom } = await supabase
        .from('custom_tasks')
        .select('*')
        .eq('user_id', userId)
        .lt('due_date', todayStr)
        .neq('status', 'completed')
        .order('due_date', { ascending: true });

      if (overdueCustom && overdueCustom.length > 0) {
        return overdueCustom.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          dueDate: t.due_date,
          dueTime: t.due_time,
          priority: (t.priority || 'high') as TaskPriority,
          category: (t.category || 'operations') as TaskCategory,
          status: 'pending',
        }));
      }

      return [];
    } catch (err) {
      console.error('Error getting pending tasks:', err);
      return [];
    }
  },

  // 7. Move Pending Task to Today (Updates Supabase pending_tasks and inserts into custom_tasks)
  async movePendingToToday(pendingTask: MobileTask): Promise<void> {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
      const userId = await getCurrentUserId();
      // 1. Mark pending task as resolved/forwarded in Supabase
      let updateQuery = supabase
        .from('pending_tasks')
        .update({
          status: 'forwarded',
          forwarded_to_date: todayStr,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', pendingTask.id);

      if (userId) {
        updateQuery = updateQuery.eq('user_id', userId);
      }
      await updateQuery;

      // 2. Add into custom_tasks for today (automatically receives user_id inside createCustomTask)
      await this.createCustomTask({
        title: pendingTask.title,
        description: pendingTask.description,
        dueDate: todayStr,
        dueTime: pendingTask.dueTime || '11:00',
        priority: pendingTask.priority,
        category: pendingTask.category,
        isTopPriority: true,
      });
    } catch (err) {
      console.error('Error forwarding pending task:', err);
    }
  },

  // 8. Fetch Monthly Roadmap & Goals directly from Supabase
  async getMonthlyGoals(monthKey?: string): Promise<{
    goals: MonthlyGoal[];
    weeks: any[];
    metrics: any[];
  }> {
    try {
      const userId = await getCurrentUserId();
      let goalsQuery = supabase.from('goals').select('*');
      if (userId) {
        goalsQuery = goalsQuery.or(`user_id.eq.${userId},user_id.is.null`);
      }
      const { data: dbGoals } = await goalsQuery.order('created_at', { ascending: true });

      let goals: MonthlyGoal[] = [];
      if (dbGoals && dbGoals.length > 0) {
        goals = dbGoals.map((g: any) => {
          let cleanDesc = '';
          let theme = '';
          let realCategory = g.category || 'Strategic';

          if (g.description) {
            if (typeof g.description === 'string' && (g.description.startsWith('{') || g.description.startsWith('['))) {
              try {
                const parsed = JSON.parse(g.description);
                if (parsed.__meta__) {
                  if (parsed.__meta__.monthTheme) theme = parsed.__meta__.monthTheme;
                  if (parsed.__meta__.realCategory) realCategory = parsed.__meta__.realCategory;
                }
                cleanDesc = parsed.text || parsed.description || (theme ? `Theme: ${theme}` : '');
              } catch {
                cleanDesc = '';
              }
            } else {
              cleanDesc = String(g.description);
            }
          }

          if (!cleanDesc && theme) {
            cleanDesc = `Strategic Theme: ${theme}`;
          }

          const rawStatus = (g.status || 'in_progress').toLowerCase();
          let normalizedStatus: 'completed' | 'in_progress' | 'on_track' | 'not_started' = 'in_progress';
          if (rawStatus === 'completed') normalizedStatus = 'completed';
          else if (rawStatus === 'on_track' || rawStatus === 'active') normalizedStatus = 'on_track';
          else if (rawStatus === 'not_started' || rawStatus === 'pending') normalizedStatus = 'not_started';

          return {
            id: g.id,
            title: g.title,
            description: cleanDesc,
            month: theme || g.month_theme || 'October 2026',
            targetCount: 100,
            currentCount: g.progress_percent || 0,
            progressPercent: g.progress_percent || 0,
            targetMetric: g.target_metric || '',
            currentMetric: g.current_metric || '',
            timeframe: g.timeframe || 'monthly',
            targetDate: g.target_date || '',
            category: realCategory.charAt(0).toUpperCase() + realCategory.slice(1),
            status: normalizedStatus,
          };
        });
      } else {
        goals = [];
      }

      // Deep clone weeks from fixed routine dataset
      const weeks = JSON.parse(JSON.stringify(FIXED_EXCEL_ROUTINE_DATA.monthlyCalendar?.weeks || []));

      // Fetch custom monthly items for this month
      try {
        let query = supabase
          .from('custom_focus_items')
          .select('*')
          .eq('is_active', true);

        if (userId) {
          query = query.or(`user_id.eq.${userId},user_id.is.null`);
        }

        if (monthKey) {
          query = query.or(`day_of_week.eq.Month:${monthKey},day_of_week.ilike.Month:${monthKey}:%`);
        } else {
          query = query.ilike('day_of_week', 'Month:%');
        }

        const { data: customMonthlyRows } = await query.order('created_at', { ascending: true });

        if (customMonthlyRows && customMonthlyRows.length > 0) {
          for (const r of customMonthlyRows) {
            let weekIdx = 0;
            let section = 'md';
            let items: string[] = [r.title];

            try {
              if (r.title && (r.title.startsWith('{') || r.title.startsWith('['))) {
                const parsed = JSON.parse(r.title);
                if (typeof parsed.weekIndex === 'number') weekIdx = parsed.weekIndex;
                if (parsed.section) section = parsed.section;
                if (Array.isArray(parsed.items) && parsed.items.length > 0) items = parsed.items;
              }
            } catch {}

            if (r.day_of_week && r.day_of_week.includes('Week:')) {
              const parts = r.day_of_week.split('Week:');
              const parsedIdx = parseInt(parts[1], 10);
              if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < weeks.length) {
                weekIdx = parsedIdx;
              }
            }

            const targetWeek = weeks[weekIdx];
            if (targetWeek) {
              if (!targetWeek.customItems) targetWeek.customItems = [];
              items.forEach((itemText: string, itemIdx: number) => {
                targetWeek.customItems.push({
                  id: r.id,
                  text: itemText,
                  section,
                  dbId: r.id,
                  itemIndex: itemIdx,
                });
              });
            }
          }
        }
      } catch (e) {
        console.warn('Could not fetch custom monthly items:', e);
      }

      const metrics = FIXED_EXCEL_ROUTINE_DATA.monthlyCalendar?.dashboardMetrics || [];

      return { goals, weeks, metrics };
    } catch (err) {
      console.error('Error fetching monthly goals:', err);
      return { goals: [], weeks: [], metrics: [] };
    }
  },

  // 9. Snooze Task by 1 hour
  async snoozeTask(taskId: string, currentTime?: string): Promise<void> {
    try {
      const [h, m] = (currentTime || '09:00').split(':').map(Number);
      const newHour = Math.min(h + 1, 23);
      const newTime = `${String(newHour).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
      if (isUUID) {
        await supabase.from('custom_tasks').update({ due_time: newTime, status: 'todo' }).eq('id', taskId);
      }
    } catch (err) {
      console.error('Error snoozing task:', err);
    }
  },

  // 10. Skip Task
  async skipTask(taskId: string): Promise<void> {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
      if (isUUID) {
        await supabase.from('custom_tasks').update({ status: 'skipped' }).eq('id', taskId);
      } else {
        await supabase.from('tasks').upsert({
          id: taskId,
          status: 'skipped',
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error skipping task:', err);
    }
  },

  // 11. Reschedule Task to Tomorrow
  async rescheduleToTomorrow(taskId: string): Promise<void> {
    try {
      const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
      if (isUUID) {
        await supabase.from('custom_tasks').update({ due_date: tomorrow }).eq('id', taskId);
      }
    } catch (err) {
      console.error('Error rescheduling task:', err);
    }
  },

  // 12. Add Note to Task
  async addNote(taskId: string, note: string): Promise<void> {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
      if (isUUID) {
        await supabase.from('custom_tasks').update({ notes: note }).eq('id', taskId);
      }
    } catch (err) {
      console.error('Error adding note:', err);
    }
  },

  // 13. Create a Custom Routine (saved to Supabase, repeats on selected days from start_date)
  async createCustomRoutine(routine: {
    title: string;
    time: string;      // HH:MM, stored in time_slot column
    startDate: string;
    days?: string;     // comma-separated short names e.g. "Mon,Wed,Fri"; empty = every day
  }): Promise<CustomRoutine | null> {
    try {
      const userId = await getCurrentUserId();
      const insertPayload: any = {
        title: routine.title,
        time_slot: routine.time,
        start_date: routine.startDate,
        is_active: true,
        days_of_week: routine.days || '',
      };
      if (userId) {
        insertPayload.user_id = userId;
      }

      const { data, error } = await supabase
        .from('custom_routines')
        .insert([insertPayload])
        .select()
        .single();

      if (error || !data) {
        console.error('Error creating custom routine:', error);
        return null;
      }
      return {
        id: data.id,
        title: data.title,
        time: data.time_slot,
        startDate: data.start_date,
        isActive: data.is_active,
        createdAt: data.created_at,
        days: data.days_of_week || '',
      };
    } catch (err) {
      console.error('Error in createCustomRoutine:', err);
      return null;
    }
  },

  // 14b. Toggle a Focus/Schedule tab item completion by exact logical ID
  async toggleScheduleItemByKey(logicalId: string, date: string): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      // Scoped deterministic ID per user so User A and User B never clash
      const dbId = stringToUuid(userId ? `${userId}_${logicalId}_${date}` : `${logicalId}_${date}`);
      let checkQuery = supabase
        .from('tasks')
        .select('id, status')
        .eq('id', dbId);

      if (userId) {
        checkQuery = checkQuery.eq('user_id', userId);
      }

      const { data: existing } = await checkQuery.maybeSingle();
      const isDone = existing?.status === 'completed';
      const nextStatus = isDone ? 'todo' : 'completed';

      const upsertPayload: any = {
        id: dbId,
        title: logicalId,
        priority: 'medium',
        status: nextStatus,
        category: 'operations',
        due_date: date,
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
        notes: JSON.stringify({ __meta__: { logicalId } }),
        updated_at: new Date().toISOString(),
      };
      if (userId) {
        upsertPayload.user_id = userId;
      }

      await supabase.from('tasks').upsert(upsertPayload);
      return nextStatus === 'completed';
    } catch (err) {
      console.error('Error toggling schedule item key:', err);
      return false;
    }
  },

  // Toggle by activityId and itemIndex (backward-compatible)
  async toggleScheduleItem(activityId: string, itemIndex: number, date: string): Promise<boolean> {
    const logicalId = `schedule_${activityId}_item_${itemIndex}`;
    return this.toggleScheduleItemByKey(logicalId, date);
  },

  // 14. Delete (deactivate) a Custom Routine
  async deleteCustomRoutine(routineId: string): Promise<void> {
    try {
      await supabase.from('custom_routines').update({ is_active: false }).eq('id', routineId);
    } catch (err) {
      console.error('Error deleting custom routine:', err);
    }
  },

  // 15. Fetch Full Weekly Monday to Sunday Schedule from Excel Dataset
  getWeeklySchedule() {
    return FIXED_EXCEL_ROUTINE_DATA.weeklySchedule || [];
  },

  // 15b. Fetch Weekly Schedule merged with user custom focus items (joined inside existing containers!)
  async getWeeklyScheduleWithCustom(): Promise<any[]> {
    const staticActivities = FIXED_EXCEL_ROUTINE_DATA.weeklySchedule || [];
    try {
      const userId = await getCurrentUserId();
      let query = supabase
        .from('custom_focus_items')
        .select('*')
        .eq('is_active', true);

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { data: focusRows } = await query.order('created_at', { ascending: true });
      return mergeFocusItemsIntoActivities(staticActivities, focusRows || []);
    } catch (err) {
      console.warn('Fallback to static weekly schedule:', err);
      return staticActivities;
    }
  },

  // 15c. Fetch completed schedule items for a whole week (or date range)
  async getWeekCompletedScheduleItems(startDate: string, endDate: string): Promise<Record<string, boolean>> {
    try {
      const userId = await getCurrentUserId();
      let query = supabase
        .from('tasks')
        .select('id, status, notes, due_date')
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .eq('status', 'completed');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: occData } = await query;
      const completedMap: Record<string, boolean> = {};
      if (occData) {
        occData.forEach((row: any) => {
          const date = row.due_date;
          try {
            const meta = JSON.parse(row.notes || '{}');
            const logicalId = meta?.__meta__?.logicalId;
            if (logicalId) {
              completedMap[`${date}_${logicalId}`] = true;
            }
          } catch {}
        });
      }
      return completedMap;
    } catch (err) {
      console.error('Error fetching week completed items:', err);
      return {};
    }
  },

  // 15d. Fetch completed items for a month (e.g. "2026-10")
  async getMonthCompletedScheduleItems(monthStr: string): Promise<Record<string, boolean>> {
    try {
      const userId = await getCurrentUserId();
      let query = supabase
        .from('tasks')
        .select('id, status, notes, due_date')
        .gte('due_date', `${monthStr}-01`)
        .lte('due_date', `${monthStr}-31`)
        .eq('status', 'completed');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: occData } = await query;
      const completedMap: Record<string, boolean> = {};
      if (occData) {
        occData.forEach((row: any) => {
          try {
            const meta = JSON.parse(row.notes || '{}');
            const logicalId = meta?.__meta__?.logicalId;
            if (logicalId) {
              completedMap[logicalId] = true;
            }
          } catch {}
        });
      }
      return completedMap;
    } catch (err) {
      console.error('Error fetching month completed items:', err);
      return {};
    }
  },

  // 15e. Toggle a monthly checklist item by logical ID
  async toggleMonthlyScheduleItemByKey(logicalId: string, monthStr: string): Promise<boolean> {
    return this.toggleScheduleItemByKey(logicalId, `${monthStr}-01`);
  },

  // 10. Fetch Monday Review Scorecard & Agenda from Excel Dataset
  getMondayReviewData() {
    return FIXED_EXCEL_ROUTINE_DATA.mondayReview || { scorecardMetrics: [], agendaItems: [] };
  },

  // 16. Create Custom Focus Item(s) (repeats weekly on given day)
  async createCustomFocusItem(
    title: string,
    dayOfWeek: string,
    options?: { items?: string[]; branch?: string; priority?: string; timeSlot?: string; timeBlock?: string }
  ): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      const slot = options?.timeSlot || 'Afternoon 12 PM–4 PM';
      let block = options?.timeBlock;
      if (!block) {
        const slotL = slot.toLowerCase();
        if (slotL.includes('12') || slotL.includes('afternoon') || slotL.includes('lunch')) block = 'afternoon';
        else if (slotL.includes('9') || slotL.includes('morning') || slotL.includes('10')) block = 'morning';
        else if (slotL.includes('4') || slotL.includes('evening') || slotL.includes('night') || slotL.includes('7')) block = 'evening';
        else block = 'afternoon';
      }

      const itemsList = options?.items && options.items.length > 0 ? options.items : [title];

      // Insert each task as an independent row in custom_focus_items
      // so each task has its own unique DB ID and can be deleted individually without affecting sibling tasks!
      const rowsToInsert = itemsList.map((itemText) => {
        const payload = {
          title: itemText,
          items: [itemText],
          branch: options?.branch || 'Both',
          priority: options?.priority || 'medium',
          timeSlot: slot,
          timeBlock: block,
        };
        const row: any = {
          title: JSON.stringify(payload),
          day_of_week: dayOfWeek,
          is_active: true,
        };
        if (userId) {
          row.user_id = userId;
        }
        return row;
      });

      const { error } = await supabase
        .from('custom_focus_items')
        .insert(rowsToInsert);
      if (error) { console.error('Error creating custom focus item:', error); return false; }
      return true;
    } catch (err) {
      console.error('Error in createCustomFocusItem:', err);
      return false;
    }
  },

  // 17. Delete (deactivate) a Custom Focus Item or single task inside it
  async deleteCustomFocusItem(dbId: string, itemIndex?: number, itemText?: string): Promise<void> {
    try {
      if (itemIndex !== undefined || itemText) {
        // Fetch current row to check if it has multiple items stored together (legacy rows)
        const { data: row } = await supabase
          .from('custom_focus_items')
          .select('id, title')
          .eq('id', dbId)
          .single();

        if (row && row.title && (row.title.startsWith('{') || row.title.startsWith('['))) {
          try {
            const parsed = JSON.parse(row.title);
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 1) {
              // Filter out just this single item
              let updatedItems: string[];
              if (itemIndex !== undefined && itemIndex >= 0 && itemIndex < parsed.items.length) {
                updatedItems = parsed.items.filter((_: any, idx: number) => idx !== itemIndex);
              } else if (itemText) {
                let removed = false;
                updatedItems = parsed.items.filter((t: string) => {
                  if (!removed && t === itemText) {
                    removed = true;
                    return false;
                  }
                  return true;
                });
              } else {
                updatedItems = [];
              }

              if (updatedItems.length > 0) {
                parsed.items = updatedItems;
                // If the display title was the deleted item, update to the first remaining item
                if (parsed.title === itemText || !updatedItems.includes(parsed.title)) {
                  parsed.title = updatedItems[0];
                }
                await supabase
                  .from('custom_focus_items')
                  .update({ title: JSON.stringify(parsed) })
                  .eq('id', dbId);
                return;
              }
            }
          } catch (e) {
            console.warn('Could not parse custom focus item JSON during item deletion:', e);
          }
        }
      }

      // If only 1 item, or all items removed, deactivate the entire row
      await supabase.from('custom_focus_items').update({ is_active: false }).eq('id', dbId);
    } catch (err) {
      console.error('Error deleting custom focus item:', err);
    }
  },

  // 18. Create Custom Monthly Focus Item(s)
  async createCustomMonthlyItem(
    title: string,
    monthKey: string,
    weekIndex: number,
    section: 'md' | 'sivakasi' | 'srivi' | 'joint',
    items?: string[]
  ): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      const itemsList = items && items.length > 0 ? items : [title];

      const rowsToInsert = itemsList.map((itemText) => {
        const payload = {
          title: itemText,
          items: [itemText],
          isMonthly: true,
          monthKey,
          weekIndex,
          section,
        };
        const row: any = {
          title: JSON.stringify(payload),
          day_of_week: `Month:${monthKey}:Week:${weekIndex}`,
          is_active: true,
        };
        if (userId) {
          row.user_id = userId;
        }
        return row;
      });

      const { error } = await supabase.from('custom_focus_items').insert(rowsToInsert);
      if (error) {
        console.error('Error creating custom monthly item:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error in createCustomMonthlyItem:', err);
      return false;
    }
  },
};
