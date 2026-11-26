import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { format, addDays, subDays, startOfWeek, isSameDay } from 'date-fns';
import { taskService, parseSectionTimeRange } from '../../src/services/taskService';
import { Colors, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PendingNotificationBell } from '../../src/components/PendingNotificationBell';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BRANCHES = ['All', 'Work', 'Personal', 'Health', 'Study', 'Finance'];

const TIME_SLOT_CONTAINERS = [
  { label: 'Morning 9 AM–12 PM', slot: 'Morning 9 AM–12 PM', block: 'morning', icon: 'sunny-outline' },
  { label: 'Afternoon 12 PM–4 PM', slot: 'Afternoon 12 PM–4 PM', block: 'afternoon', icon: 'partly-sunny-outline' },
  { label: 'Evening 4 PM–7 PM', slot: 'Evening 4 PM–7 PM', block: 'evening', icon: 'moon-outline' },
];

const BRANCH_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  Work:       { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', border: '#BFDBFE' },
  Personal:   { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B', border: '#FDE68A' },
  Health:     { bg: '#ECFDF5', text: '#065F46', dot: '#10B981', border: '#A7F3D0' },
  Study:      { bg: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6', border: '#DDD6FE' },
  Finance:    { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B', border: '#FCD34D' },
  General:    { bg: '#F1F5F9', text: '#475569', dot: '#64748B', border: '#CBD5E1' },
  Both:       { bg: '#F1F5F9', text: '#475569', dot: '#64748B', border: '#CBD5E1' },
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#DC2626',
  high: '#D97706',
  medium: '#2563EB',
  low: '#6B7280',
};

const TIME_BLOCK_ICONS: Record<string, string> = {
  morning: 'sunny-outline',
  afternoon: 'partly-sunny-outline',
  evening: 'moon-outline',
  custom: 'time-outline',
};

interface AddWeeklyRoutineModalProps {
  visible: boolean;
  initialDay: string;
  onClose: () => void;
  onSave: (data: {
    title: string;
    dayOfWeek: string;
    branch: string;
    timeSlot: string;
    timeBlock: string;
    items: string[];
  }) => Promise<void>;
}

function AddWeeklyRoutineModal({ visible, initialDay, onClose, onSave }: AddWeeklyRoutineModalProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [selectedSlotObj, setSelectedSlotObj] = useState(TIME_SLOT_CONTAINERS[1]); // Default to 12 PM - 4 PM
  const [selectedBranch, setSelectedBranch] = useState('Work');
  const [tasksText, setTasksText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedDay(initialDay);
      setSelectedSlotObj(TIME_SLOT_CONTAINERS[1]);
      setTasksText('');
      setSaving(false);
    }
  }, [visible, initialDay]);

  const handleSave = async () => {
    const items = tasksText
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (items.length === 0) {
      Alert.alert('Required', 'Please enter at least one task to add.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title: items[0],
        dayOfWeek: selectedDay,
        branch: selectedBranch,
        timeSlot: selectedSlotObj.slot,
        timeBlock: selectedSlotObj.block,
        items,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save routine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="add-circle-outline" size={20} color="#6D28D9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add Task to Routine Container</Text>
                <Text style={styles.modalSubTitle}>Joins directly inside the selected time container</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Day Selector */}
              <Text style={styles.inputLabel}>Day of Week</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {DAYS.map((day) => {
                  const isSel = selectedDay === day;
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.modalChip, isSel && styles.modalChipActive]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>
                        {day.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Target Container / Time Slot */}
              <Text style={styles.inputLabel}>Select Container (Time Slot) *</Text>
              <View style={styles.containerOptionsCol}>
                {TIME_SLOT_CONTAINERS.map((opt) => {
                  const isSel = selectedSlotObj.slot === opt.slot;
                  return (
                    <TouchableOpacity
                      key={opt.slot}
                      style={[styles.containerOptionCard, isSel && styles.containerOptionCardActive]}
                      onPress={() => setSelectedSlotObj(opt)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={17}
                        color={isSel ? '#1D4ED8' : Colors.navy}
                      />
                      <Text style={[styles.containerOptionText, isSel && styles.containerOptionTextActive]}>
                        {opt.label}
                      </Text>
                      {isSel && (
                        <Ionicons name="checkmark-circle" size={18} color="#1D4ED8" style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Container Join Note */}
              <View style={styles.joinContainerNote}>
                <Ionicons name="git-merge-outline" size={14} color="#1D4ED8" />
                <Text style={styles.joinContainerNoteText}>
                  Tasks will join inside {selectedDay}'s {selectedSlotObj.label} container checklist.
                </Text>
              </View>

              {/* Tasks Input */}
              <Text style={styles.inputLabel}>Tasks to Add (1 per line)</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder={`Task 1: Work on project roadmap\nTask 2: Weekly sync & review\nTask 3: Gym workout`}
                placeholderTextColor={Colors.textLight}
                value={tasksText}
                onChangeText={setTasksText}
                multiline
                numberOfLines={4}
                autoFocus
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!tasksText.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!tasksText.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Add to Container</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function WeeklyScheduleScreen() {
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const todayIndex = new Date().getDay();
    const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return map[todayIndex];
  });
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'schedule' | 'review'>('schedule');

  const [allActivities, setAllActivities] = useState<any[]>([]);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // 7 days of current selected week
  const weekDays = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(currentWeekMonday, i);
      const name = DAYS[i];
      const short = DAY_SHORT[i];
      return {
        date: d,
        dateStr: format(d, 'yyyy-MM-dd'),
        dayName: name,
        shortDay: short,
        dayNum: format(d, 'd'),
        isToday: isSameDay(d, new Date()),
      };
    });
  }, [currentWeekMonday]);

  const selectedDayObj = useMemo(() => {
    return weekDays.find((w) => w.dayName === selectedDay) || weekDays[0];
  }, [weekDays, selectedDay]);

  const selectedDateStr = selectedDayObj.dateStr;
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isTodayDate = selectedDateStr === todayStr;
  const isPastDate = selectedDateStr < todayStr;

  const [nowMin, setNowMin] = useState<number>(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const updateTime = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTimeLimits = (act: any): { startMin: number; endMin: number } => {
    if (act.defaultEndTime) {
      const [sh, sm] = (act.defaultStartTime || '09:00').split(':').map((v: string) => parseInt(v, 10));
      const [eh, em] = act.defaultEndTime.split(':').map((v: string) => parseInt(v, 10));
      return {
        startMin: (sh || 0) * 60 + (sm || 0),
        endMin: (eh || 0) * 60 + (em || 0),
      };
    }
    if (act.timeBlock === 'morning') return { startMin: 540, endMin: 720 };
    if (act.timeBlock === 'afternoon') return { startMin: 720, endMin: 960 };
    if (act.timeBlock === 'evening') return { startMin: 960, endMin: 1140 };
    const parsed = parseSectionTimeRange(act.timeSlot);
    if (parsed) return parsed;
    return { startMin: 540, endMin: 1080 };
  };

  const mondayReview = useMemo(() => taskService.getMondayReviewData(), []);

  const loadWeekData = useCallback(async () => {
    setLoading(true);
    try {
      const activities = await taskService.getWeeklyScheduleWithCustom();
      setAllActivities(activities);

      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;
      const doneMap = await taskService.getWeekCompletedScheduleItems(startDate, endDate);
      setCompletedItems(doneMap);
    } catch (err) {
      console.error('Error loading weekly schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [weekDays]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWeekData();
    setRefreshing(false);
  };

  const dayActivities = useMemo(() => {
    return allActivities.filter(
      (a) =>
        a.dayOfWeek.toLowerCase() === selectedDay.toLowerCase() &&
        (selectedBranch === 'All' || a.branch === selectedBranch)
    );
  }, [allActivities, selectedDay, selectedBranch]);

  const handleToggleItemKey = async (logicalKey: string) => {
    const fullKey = `${selectedDateStr}_${logicalKey}`;
    const nextVal = !completedItems[fullKey];
    setCompletedItems((prev) => ({ ...prev, [fullKey]: nextVal }));
    await taskService.toggleScheduleItemByKey(logicalKey, selectedDateStr);
  };

  const handleDeleteCustomItem = (dbId?: string, itemText?: string, itemIndex?: number) => {
    if (!dbId) return;
    Alert.alert(
      'Delete Task',
      `Delete "${itemText || 'task'}" from ${selectedDay}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await taskService.deleteCustomFocusItem(dbId, itemIndex, itemText);
            await loadWeekData();
          },
        },
      ]
    );
  };

  const handleSaveNewRoutine = async (data: {
    title: string;
    dayOfWeek: string;
    branch: string;
    timeSlot: string;
    timeBlock: string;
    items: string[];
  }) => {
    await taskService.createCustomFocusItem(data.title, data.dayOfWeek, {
      items: data.items,
      branch: data.branch,
      timeSlot: data.timeSlot,
      timeBlock: data.timeBlock,
    });
    await loadWeekData();
  };

  const handlePrevWeek = () => setCurrentWeekMonday((prev) => subDays(prev, 7));
  const handleNextWeek = () => setCurrentWeekMonday((prev) => addDays(prev, 7));
  const handleThisWeek = () => {
    const thisMon = startOfWeek(new Date(), { weekStartsOn: 1 });
    setCurrentWeekMonday(thisMon);
    const todayIndex = new Date().getDay();
    const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    setSelectedDay(map[todayIndex]);
  };

  // Day & Week stats (accurate across both static and joined custom tasks)
  const dayStats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    dayActivities.forEach((a) => {
      const cItems = a.checkItems || (a.items || []).map((it: string, idx: number) => ({
        key: `schedule_${a.id}_item_${idx}`,
        text: it,
      }));
      totalTasks += cItems.length;
      completedTasks += cItems.filter((ci: any) => completedItems[`${selectedDateStr}_${ci.key}`]).length;
    });
    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { totalTasks, completedTasks, pct };
  }, [dayActivities, completedItems, selectedDateStr]);

  const weekDayStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    weekDays.forEach((w) => {
      const acts = allActivities.filter((a) => a.dayOfWeek.toLowerCase() === w.dayName.toLowerCase());
      let total = 0;
      let completed = 0;
      acts.forEach((a) => {
        const cItems = a.checkItems || (a.items || []).map((it: string, idx: number) => ({
          key: `schedule_${a.id}_item_${idx}`,
          text: it,
        }));
        total += cItems.length;
        completed += cItems.filter((ci: any) => completedItems[`${w.dateStr}_${ci.key}`]).length;
      });
      map.set(w.dayName, { total, completed });
    });
    return map;
  }, [weekDays, allActivities, completedItems]);

  const isCurrentWeek = isSameDay(currentWeekMonday, startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.container}>

        {/* ── 1. Compact Header: Title + Week Navigator + Icons ──── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Weekly Routine</Text>
            <Text style={styles.headerSub}>
              {format(weekDays[0].date, 'MMM d')} – {format(weekDays[6].date, 'MMM d')}
            </Text>
          </View>

          {/* Week Nav controls */}
          <View style={styles.headerWeekNav}>
            <TouchableOpacity onPress={handlePrevWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={17} color={Colors.navy} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.todayChip, isCurrentWeek && styles.todayChipActive]}
              onPress={handleThisWeek}
            >
              <Text style={[styles.todayChipText, isCurrentWeek && styles.todayChipTextActive]}>
                {isCurrentWeek ? 'This Week' : 'Go Current'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={17} color={Colors.navy} />
            </TouchableOpacity>
          </View>

          {/* Right Action Icons */}
          <View style={styles.headerRightIcons}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/ai-chat')}>
              <Ionicons name="sparkles" size={17} color={Colors.primary} />
            </TouchableOpacity>
            <PendingNotificationBell />
          </View>
        </View>

        {/* ── 2. Slim Stats & View Mode Strip ─────────────────────── */}
        <View style={styles.statsStrip}>
          <View style={styles.statsLeft}>
            <Text style={styles.statsPctText}>{dayStats.pct}%</Text>
            <View style={styles.statsTrack}>
              <View
                style={[
                  styles.statsFill,
                  { width: `${Math.max(dayStats.pct, 4)}%` },
                  dayStats.pct === 100 && { backgroundColor: '#10B981' },
                ]}
              />
            </View>
            <Text style={styles.statsCountText}>
              {dayStats.completedTasks}/{dayStats.totalTasks} done
            </Text>
          </View>

          {/* Compact View Switcher */}
          <View style={styles.segmentedToggle}>
            <TouchableOpacity
              style={[styles.segmentBtn, viewMode === 'schedule' && styles.segmentBtnActive]}
              onPress={() => setViewMode('schedule')}
            >
              <Ionicons
                name="calendar"
                size={12}
                color={viewMode === 'schedule' ? '#FFFFFF' : Colors.textMuted}
              />
              <Text style={[styles.segmentText, viewMode === 'schedule' && styles.segmentTextActive]}>
                Routine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, viewMode === 'review' && styles.segmentBtnActive]}
              onPress={() => setViewMode('review')}
            >
              <Ionicons
                name="bar-chart"
                size={12}
                color={viewMode === 'review' ? '#FFFFFF' : Colors.textMuted}
              />
              <Text style={[styles.segmentText, viewMode === 'review' && styles.segmentTextActive]}>
                Review
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'schedule' ? (
          <>
            {/* ── 3. Ergonomic 7-Day Calendar Strip ──────────────── */}
            <View style={styles.calendarStripWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.calendarStrip}
              >
                {weekDays.map((w) => {
                  const isActive = w.dayName === selectedDay;
                  const stats = weekDayStatsMap.get(w.dayName) || { total: 0, completed: 0 };
                  const isAllDone = stats.total > 0 && stats.completed === stats.total;

                  return (
                    <TouchableOpacity
                      key={w.dayName}
                      style={[
                        styles.dayCard,
                        isActive && styles.dayCardActive,
                        w.isToday && !isActive && styles.dayCardToday,
                      ]}
                      onPress={() => setSelectedDay(w.dayName)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayCardShort, isActive && styles.dayCardShortActive]}>
                        {w.shortDay}
                      </Text>
                      <Text style={[styles.dayCardNum, isActive && styles.dayCardNumActive]}>
                        {w.dayNum}
                      </Text>

                      {/* Mini indicator dot */}
                      <View style={styles.dayDotContainer}>
                        {isAllDone ? (
                          <View style={[styles.miniDot, { backgroundColor: '#10B981' }]} />
                        ) : w.dateStr < todayStr && stats.total > 0 && stats.completed < stats.total ? (
                          <View style={[styles.miniDot, { backgroundColor: '#EF4444' }]} />
                        ) : stats.completed > 0 ? (
                          <View style={[styles.miniDot, { backgroundColor: '#F59E0B' }]} />
                        ) : stats.total > 0 ? (
                          <View style={[styles.miniDot, { backgroundColor: isActive ? '#94A3B8' : '#CBD5E1' }]} />
                        ) : null}
                        {w.isToday && !isActive && <View style={styles.todayIndicatorDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── 4. Branch Filter Chips + Inline Add ─────────────── */}
            <View style={styles.filterBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.branchFilterScroll}
              >
                {BRANCHES.map((branch) => {
                  const isSel = selectedBranch === branch;
                  return (
                    <TouchableOpacity
                      key={branch}
                      style={[styles.branchFilterChip, isSel && styles.branchFilterChipActive]}
                      onPress={() => setSelectedBranch(branch)}
                    >
                      <Text style={[styles.branchFilterText, isSel && styles.branchFilterTextActive]}>
                        {branch}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.addRoutineQuickBtn}
                onPress={() => setAddModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.addRoutineQuickText}>Add Task</Text>
              </TouchableOpacity>
            </View>

            {/* ── 5. Main Task Checklist List ─────────────────────── */}
            <ScrollView
              contentContainerStyle={styles.scrollList}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
            >
              {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
              ) : dayActivities.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>No routines for {selectedDay}</Text>
                  <Text style={styles.emptySub}>
                    {selectedBranch !== 'All'
                      ? `No activities for ${selectedBranch} category.`
                      : `You have no routines scheduled for ${selectedDay}.`}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setAddModalVisible(true)}
                  >
                    <Ionicons name="add-circle" size={17} color={Colors.primary} />
                    <Text style={styles.emptyAddBtnText}>Add Routine for {selectedDay}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                dayActivities.map((activity) => {
                  const bColors = BRANCH_COLORS[activity.branch] || BRANCH_COLORS['Both'];
                  const prioColor = PRIORITY_COLOR[activity.priority] || Colors.textMuted;
                  const isCustom = Boolean(activity.isCustom);

                  // Normalized checklist items (includes static + user added tasks)
                  const checkItems = activity.checkItems || (activity.items || []).map((it: string, idx: number) => ({
                    key: `schedule_${activity.id}_item_${idx}`,
                    text: it,
                    isCustom: false,
                  }));

                  const doneCount = checkItems.filter(
                    (ci: any) => completedItems[`${selectedDateStr}_${ci.key}`]
                  ).length;
                  const allDone = checkItems.length > 0 && doneCount === checkItems.length;
                  const unfinishedCount = checkItems.length - doneCount;

                  const timeLimits = getTimeLimits(activity);
                  const isTimeEnded = nowMin > timeLimits.endMin;
                  const isTimeActive = nowMin >= timeLimits.startMin && nowMin <= timeLimits.endMin;

                  const isPending = ((isTodayDate && isTimeEnded) || isPastDate) && !allDone && checkItems.length > 0;
                  const isActiveSlot = isTodayDate && isTimeActive && !allDone && checkItems.length > 0;

                  return (
                    <View
                      key={activity.id}
                      style={[
                        styles.taskCard,
                        Shadows.sm,
                        isPending && styles.taskCardPending,
                        isActiveSlot && styles.taskCardActive,
                        allDone && styles.taskCardAllDone,
                        isCustom && { borderColor: '#3B82F6', borderWidth: 1.5 },
                      ]}
                    >
                      {/* Left color bar */}
                      <View
                        style={[
                          styles.cardLeftStrip,
                          {
                            backgroundColor: allDone
                              ? '#10B981'
                              : isPending
                              ? '#EF4444'
                              : isActiveSlot
                              ? '#F59E0B'
                              : prioColor,
                          },
                        ]}
                      />

                      <View style={styles.cardContent}>
                        {/* Meta strip: Branch + Time + Badges */}
                        <View style={styles.cardMetaRow}>
                          <View style={[styles.branchPill, { backgroundColor: bColors.bg, borderColor: bColors.border }]}>
                            <View style={[styles.branchDot, { backgroundColor: bColors.dot }]} />
                            <Text style={[styles.branchPillText, { color: bColors.text }]}>
                              {activity.branch}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.timePill,
                              isPending && styles.timePillPending,
                              isActiveSlot && styles.timePillActive,
                              allDone && styles.timePillAllDone,
                            ]}
                          >
                            <Ionicons
                              name={TIME_BLOCK_ICONS[activity.timeBlock] as any || 'time-outline'}
                              size={12}
                              color={isPending ? '#DC2626' : isActiveSlot ? '#B45309' : allDone ? '#15803D' : Colors.primary}
                            />
                            <Text
                              style={[
                                styles.timePillText,
                                isPending && styles.timePillTextPending,
                                isActiveSlot && styles.timePillTextActive,
                                allDone && styles.timePillTextAllDone,
                              ]}
                            >
                              {isPending ? `⚠️ ${activity.timeSlot} • PENDING` : activity.timeSlot}
                            </Text>
                          </View>

                          {/* Done / Pending badge */}
                          <View
                            style={[
                              styles.doneBadge,
                              isPending && styles.doneBadgePending,
                              allDone && styles.doneBadgeAllDone,
                            ]}
                          >
                            <Text
                              style={[
                                styles.doneBadgeText,
                                isPending && styles.doneBadgeTextPending,
                                allDone && styles.doneBadgeTextAllDone,
                              ]}
                            >
                              {allDone
                                ? '✓ All Done'
                                : isPending
                                ? `⚠️ ${doneCount}/${checkItems.length} done`
                                : `${doneCount}/${checkItems.length} done`}
                            </Text>
                          </View>

                          {isCustom && (
                            <TouchableOpacity
                              onPress={() => handleDeleteCustomItem(activity._dbId, activity.title)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ marginLeft: 'auto' }}
                            >
                              <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Title Row */}
                        <Text
                          style={[
                            styles.taskCardTitle,
                            allDone && styles.taskCardTitleAllDone,
                            isPending && styles.taskCardTitlePending,
                          ]}
                        >
                          {activity.title}
                        </Text>

                        {/* Pending / Active Alert Row */}
                        {isPending && (
                          <View style={styles.pendingAlertRow}>
                            <Ionicons name="alert-circle" size={13} color="#DC2626" />
                            <Text style={styles.pendingAlertText}>
                              {isPastDate ? 'Past due' : 'Time ended'} • {unfinishedCount} pending {unfinishedCount === 1 ? 'checklist item' : 'checklist items'}
                            </Text>
                          </View>
                        )}
                        {isActiveSlot && (
                          <View style={styles.activeAlertRow}>
                            <Ionicons name="time" size={13} color="#D97706" />
                            <Text style={styles.activeAlertText}>
                              Active slot • In progress ({unfinishedCount} remaining)
                            </Text>
                          </View>
                        )}

                        {/* Interactive Checklist Items (Static + Injected tasks) */}
                        <View style={styles.checklistBlock}>
                          {checkItems.map((ci: any, idx: number) => {
                            const isDone = !!completedItems[`${selectedDateStr}_${ci.key}`];

                            return (
                              <View
                                key={ci.key || idx}
                                style={[
                                  styles.checkRowWrapper,
                                  idx === checkItems.length - 1 && { borderBottomWidth: 0 },
                                ]}
                              >
                                <TouchableOpacity
                                  style={[styles.checkRow, isDone && styles.checkRowDone]}
                                  onPress={() => handleToggleItemKey(ci.key)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons
                                    name={isDone ? 'checkmark-circle' : 'square-outline'}
                                    size={21}
                                    color={isDone ? '#10B981' : Colors.danger}
                                    style={{ marginRight: 10 }}
                                  />
                                  <Text
                                    style={[
                                      styles.checkText,
                                      isDone && styles.checkTextDone,
                                    ]}
                                  >
                                    {ci.text}
                                  </Text>
                                </TouchableOpacity>

                                {ci.isCustom && (
                                  <TouchableOpacity
                                    onPress={() => handleDeleteCustomItem(ci.dbId, ci.text, ci.itemIndex)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.customItemDeleteBtn}
                                  >
                                    <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
              <View style={{ height: 100 }} />
            </ScrollView>

            {/* ── 6. Bottom Floating Action Button (FAB) ─────────── */}
            <TouchableOpacity
              style={[styles.fabBtn, Shadows.lg]}
              onPress={() => setAddModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : (
          /* ── Monday Review Mode ────────────────────────────────── */
          <ScrollView contentContainerStyle={styles.reviewList} showsVerticalScrollIndicator={false}>
            <View style={[styles.reviewBanner, Shadows.sm]}>
              <Ionicons name="bar-chart" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewBannerTitle}>Monday Review Scorecard</Text>
                <Text style={styles.reviewBannerSub}>Weekly KPI tracking & management agenda</Text>
              </View>
            </View>

            {mondayReview.scorecardMetrics.length > 0 && (
              <View style={[styles.reviewSection, Shadows.sm]}>
                <Text style={styles.sectionHeaderTitle}>📊 KPI Scorecard</Text>
                {mondayReview.scorecardMetrics.map((metric: any, idx: number) => (
                  <View key={idx} style={styles.metricRow}>
                    <Text style={styles.metricKpi}>{metric.kpi}</Text>
                    <View style={styles.metricBranches}>
                      {metric.sivakasiLastWk && (
                        <View style={styles.metricBadge}>
                          <Text style={styles.metricBadgeLabel}>SVK</Text>
                          <Text style={styles.metricBadgeValue}>{metric.sivakasiLastWk}</Text>
                        </View>
                      )}
                      {metric.sriviLastWk && (
                        <View style={[styles.metricBadge, { backgroundColor: '#EFF6FF' }]}>
                          <Text style={[styles.metricBadgeLabel, { color: '#1D4ED8' }]}>VNR</Text>
                          <Text style={[styles.metricBadgeValue, { color: '#1D4ED8' }]}>{metric.sriviLastWk}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {mondayReview.agendaItems.length > 0 && (
              <View style={[styles.reviewSection, Shadows.sm]}>
                <Text style={styles.sectionHeaderTitle}>📋 Meeting Agenda</Text>
                {mondayReview.agendaItems.map((item: any, idx: number) => (
                  <View key={idx} style={styles.agendaItem}>
                    <View style={styles.agendaTimeBox}>
                      <Text style={styles.agendaTime}>{item.timeSlot}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.agendaTopic}>{item.topic}</Text>
                      <Text style={styles.agendaCover}>{item.whatToCover}</Text>
                      {item.actionDecision && (
                        <Text style={styles.agendaAction}>→ {item.actionDecision}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}

        {/* ── Add Routine / Task Modal ─────────────────────────────── */}
        <AddWeeklyRoutineModal
          visible={addModalVisible}
          initialDay={selectedDay}
          onClose={() => setAddModalVisible(false)}
          onSave={handleSaveNewRoutine}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },

  // 1. Compact Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 8,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 1 },
  headerWeekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  todayChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  todayChipText: { fontSize: 11, fontWeight: '700', color: Colors.navy },
  todayChipTextActive: { color: '#1D4ED8' },
  headerRightIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 2. Slim Stats & Mode Strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 10,
  },
  statsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statsPctText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  statsTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#EBE7E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statsFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  statsCountText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: '#EBE7E0',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: Colors.navy,
  },
  segmentText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  segmentTextActive: { color: '#FFFFFF' },

  // 3. Ergonomic 7-Day Calendar Strip
  calendarStripWrapper: {
    paddingVertical: 2,
  },
  calendarStrip: {
    paddingHorizontal: 16,
    gap: 6,
  },
  dayCard: {
    width: 44,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  dayCardToday: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FFFBF7',
  },
  dayCardShort: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  dayCardShortActive: { color: '#CBD5E1' },
  dayCardNum: { fontSize: 14, fontWeight: '800', color: Colors.navy, marginTop: 1 },
  dayCardNumActive: { color: '#FFFFFF' },
  dayDotContainer: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3, height: 5 },
  miniDot: { width: 4, height: 4, borderRadius: 2 },
  todayIndicatorDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary },

  // 4. Branch Filter Bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  branchFilterScroll: {
    gap: 6,
  },
  branchFilterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  branchFilterChipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  branchFilterText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  branchFilterTextActive: { color: '#FFFFFF' },
  addRoutineQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  addRoutineQuickText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // 5. Scroll list
  scrollList: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 45,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.navy, marginTop: 8 },
  emptySub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5EE',
    borderWidth: 1,
    borderColor: '#F6D0B4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyAddBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Activity Task Card
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskCardPending: {
    borderColor: '#EF4444',
    borderWidth: 1.8,
    backgroundColor: '#FEF2F2',
  },
  taskCardActive: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    backgroundColor: '#FFFDF5',
  },
  taskCardAllDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  cardLeftStrip: { width: 4 },
  cardContent: { flex: 1, padding: 12 },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  branchDot: { width: 5, height: 5, borderRadius: 2.5 },
  branchPillText: { fontSize: 10, fontWeight: '700' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  timePillPending: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  timePillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
  },
  timePillAllDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  timePillText: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  timePillTextPending: { color: '#DC2626', fontWeight: '800' },
  timePillTextActive: { color: '#B45309', fontWeight: '800' },
  timePillTextAllDone: { color: '#15803D', fontWeight: '800' },
  doneBadge: {
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  doneBadgePending: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  doneBadgeAllDone: { backgroundColor: '#DCFCE7' },
  doneBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  doneBadgeTextPending: { color: '#DC2626', fontWeight: '800' },
  doneBadgeTextAllDone: { color: '#166534', fontWeight: '800' },

  taskCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 6,
    lineHeight: 20,
  },
  taskCardTitlePending: {
    color: '#991B1B',
  },
  pendingAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  pendingAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  activeAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  activeAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  taskCardTitleAllDone: {
    color: '#065F46',
  },

  // Checklist Block
  checklistBlock: {
    borderTopWidth: 1,
    borderTopColor: '#F0EDE8',
    paddingTop: 4,
  },
  checkRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F7F5F0',
  },
  checkRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkRowDone: {
    opacity: 0.65,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.navy,
    lineHeight: 18,
  },
  checkTextDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  customItemDeleteBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 6. Floating Action Button (FAB)
  fabBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  modalSubTitle: { fontSize: 11, color: Colors.textMuted },
  modalCloseBtn: { padding: 4 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.navy,
    marginTop: 8,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.navy,
  },
  textAreaInput: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  modalChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  modalChipText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  modalChipTextActive: { color: '#FFFFFF' },

  // Container Selection
  containerOptionsCol: {
    gap: 6,
    marginBottom: 6,
  },
  containerOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  containerOptionCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  containerOptionText: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  containerOptionTextActive: { color: '#1D4ED8' },
  joinContainerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 6,
  },
  joinContainerNoteText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600', flex: 1 },

  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3EFEA',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  saveBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  // Monday Review Mode
  reviewList: { paddingHorizontal: 16, paddingTop: 10 },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF5EE',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F6D0B4',
  },
  reviewBannerTitle: { fontSize: 14, fontWeight: '800', color: Colors.navy },
  reviewBannerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  reviewSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeaderTitle: { fontSize: 13, fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
  },
  metricKpi: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.navyLight, paddingRight: 8 },
  metricBranches: { flexDirection: 'row', gap: 6 },
  metricBadge: {
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  metricBadgeLabel: { fontSize: 9, fontWeight: '800', color: '#92400E' },
  metricBadgeValue: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  agendaItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
  },
  agendaTimeBox: {
    backgroundColor: '#F3EFEA',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    minWidth: 48,
    alignItems: 'center',
  },
  agendaTime: { fontSize: 9, fontWeight: '800', color: Colors.navy },
  agendaTopic: { fontSize: 12, fontWeight: '800', color: Colors.navy, marginBottom: 1 },
  agendaCover: { fontSize: 11, color: Colors.textMuted, lineHeight: 15 },
  agendaAction: { fontSize: 10, color: Colors.primary, fontWeight: '600', marginTop: 3 },
});
