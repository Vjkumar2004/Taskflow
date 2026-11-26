import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { format, addMonths, subMonths, startOfMonth, isSameMonth } from 'date-fns';
import { taskService } from '../../src/services/taskService';
import { Colors, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PendingNotificationBell } from '../../src/components/PendingNotificationBell';

type BranchFilter = 'All' | 'Work' | 'Personal' | 'Finance' | 'Health';

const BRANCH_PILL_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  'Work':          { bg: '#ECFDF5', text: '#065F46', dot: '#10B981', border: '#A7F3D0' },
  'Personal':      { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B', border: '#FDE68A' },
  'Finance':       { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6', border: '#BFDBFE' },
  'Health':        { bg: '#F5F3FF', text: '#5B21B6', dot: '#8B5CF6', border: '#DDD6FE' },
  'MD Focus':      { bg: '#ECFDF5', text: '#065F46', dot: '#10B981', border: '#A7F3D0' },
  'Sivakasi':      { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B', border: '#FDE68A' },
  'Virudhunagar':  { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6', border: '#BFDBFE' },
  'Joint':         { bg: '#F5F3FF', text: '#5B21B6', dot: '#8B5CF6', border: '#DDD6FE' },
};

const BRANCH_FILTERS: BranchFilter[] = ['All', 'Work', 'Personal', 'Finance', 'Health'];

const MONTHLY_CONTAINERS = [
  { section: 'md', label: 'Work & Projects', icon: 'briefcase-outline', color: '#10B981', branch: 'Work' },
  { section: 'sivakasi', label: 'Personal & Habits', icon: 'person-outline', color: '#F59E0B', branch: 'Personal' },
  { section: 'srivi', label: 'Finance & Budget', icon: 'cash-outline', color: '#3B82F6', branch: 'Finance' },
  { section: 'joint', label: 'Health & Wellness', icon: 'fitness-outline', color: '#8B5CF6', branch: 'Health' },
];

// Calculate current week of month (Week 1 = Days 1-7, Week 2 = Days 8-14, Week 3 = Days 15-21, Week 4 = Days 22-31)
function getCurrentWeekIndex(date: Date = new Date()): number {
  const day = date.getDate();
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
}

// ── Add Monthly Routine Modal ───────────────────────────────────────
interface AddMonthlyRoutineModalProps {
  visible: boolean;
  initialWeekIdx: number;
  monthLabel: string;
  onClose: () => void;
  onSave: (data: {
    weekIndex: number;
    section: 'md' | 'sivakasi' | 'srivi' | 'joint';
    items: string[];
  }) => Promise<void>;
}

function AddMonthlyRoutineModal({
  visible,
  initialWeekIdx,
  monthLabel,
  onClose,
  onSave,
}: AddMonthlyRoutineModalProps) {
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeekIdx >= 0 ? initialWeekIdx : 0);
  const [selectedContainer, setSelectedContainer] = useState(MONTHLY_CONTAINERS[0]);
  const [tasksText, setTasksText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedWeek(initialWeekIdx >= 0 ? initialWeekIdx : 0);
      setSelectedContainer(MONTHLY_CONTAINERS[0]);
      setTasksText('');
      setSaving(false);
    }
  }, [visible, initialWeekIdx]);

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
        weekIndex: selectedWeek,
        section: selectedContainer.section as any,
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
              <View style={[styles.modalIconBox, { backgroundColor: '#FFF5EE' }]}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add Task to Monthly Routine</Text>
                <Text style={styles.modalSubTitle}>{monthLabel} • Joins week container checklist</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Target Week Selector */}
              <Text style={styles.inputLabel}>Select Target Week *</Text>
              <View style={styles.modalWeekRow}>
                {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((wLabel, wI) => {
                  const isSel = selectedWeek === wI;
                  return (
                    <TouchableOpacity
                      key={wI}
                      style={[styles.modalWeekChip, isSel && styles.modalWeekChipActive]}
                      onPress={() => setSelectedWeek(wI)}
                    >
                      <Text style={[styles.modalWeekChipText, isSel && styles.modalWeekChipTextActive]}>
                        {wLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Target Container Selector */}
              <Text style={styles.inputLabel}>Select Container (Section) *</Text>
              <View style={styles.containerOptionsCol}>
                {MONTHLY_CONTAINERS.map((opt) => {
                  const isSel = selectedContainer.section === opt.section;
                  return (
                    <TouchableOpacity
                      key={opt.section}
                      style={[styles.containerOptionCard, isSel && styles.containerOptionCardActive]}
                      onPress={() => setSelectedContainer(opt)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={17}
                        color={isSel ? Colors.primary : Colors.navy}
                      />
                      <Text style={[styles.containerOptionText, isSel && styles.containerOptionTextActive]}>
                        {opt.label}
                      </Text>
                      {isSel && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Join Note */}
              <View style={styles.joinContainerNote}>
                <Ionicons name="git-merge-outline" size={14} color={Colors.primary} />
                <Text style={styles.joinContainerNoteText}>
                  Tasks will join inside Week {selectedWeek + 1}'s {selectedContainer.label} checklist.
                </Text>
              </View>

              {/* Tasks Input */}
              <Text style={styles.inputLabel}>Tasks to Add (1 per line)</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder={`Task 1: Fee collection review with BM\nTask 2: Mid-month admissions push`}
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
                    <Text style={styles.saveBtnText}>Add to Week {selectedWeek + 1}</Text>
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

// ── Main Screen ────────────────────────────────────────────────────
export default function MonthlyRoadmapScreen() {
  const weekScrollRef = useRef<any>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [weeks, setWeeks] = useState<any[]>([]);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Selected week index: 0 = Week 1, 1 = Week 2, 2 = Week 3, 3 = Week 4, -1 = All Weeks
  // Automatically starts from current week based on date (e.g. Day 23 -> Week 4 / index 3)
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(() => getCurrentWeekIndex(new Date()));
  const [selectedBranch, setSelectedBranch] = useState<BranchFilter>('All');

  const monthKey = format(currentMonth, 'yyyy-MM');
  const monthLabel = format(currentMonth, 'MMMM yyyy');
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskService.getMonthlyGoals(monthKey);
      setWeeks(data.weeks || []);

      const doneMap = await taskService.getMonthCompletedScheduleItems(monthKey);
      setCompletedItems(doneMap || {});
    } catch (err) {
      console.error('Error loading monthly data:', err);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Auto-scroll Week Selector strip to current week when mounted or selected
  useEffect(() => {
    if (selectedWeekIdx >= 2) {
      const timer = setTimeout(() => {
        weekScrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedWeekIdx]);

  const handlePrevMonth = () => {
    const prev = subMonths(currentMonth, 1);
    setCurrentMonth(prev);
    setSelectedWeekIdx(isSameMonth(prev, new Date()) ? getCurrentWeekIndex(new Date()) : 0);
  };
  const handleNextMonth = () => {
    const next = addMonths(currentMonth, 1);
    setCurrentMonth(next);
    setSelectedWeekIdx(isSameMonth(next, new Date()) ? getCurrentWeekIndex(new Date()) : 0);
  };
  const handleThisMonth = () => {
    const today = new Date();
    setCurrentMonth(startOfMonth(today));
    setSelectedWeekIdx(getCurrentWeekIndex(today));
  };

  const handleToggleItemKey = async (logicalKey: string) => {
    const nextVal = !completedItems[logicalKey];
    setCompletedItems((prev) => ({ ...prev, [logicalKey]: nextVal }));
    await taskService.toggleMonthlyScheduleItemByKey(logicalKey, monthKey);
  };

  const handleDeleteCustomItem = (dbId?: string, itemText?: string, itemIndex?: number) => {
    if (!dbId) return;
    Alert.alert(
      'Delete Task',
      `Delete "${itemText || 'task'}" from this week's routine?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await taskService.deleteCustomFocusItem(dbId, itemIndex, itemText);
            await loadData();
          },
        },
      ]
    );
  };

  const handleSaveNewRoutine = async (data: {
    weekIndex: number;
    section: 'md' | 'sivakasi' | 'srivi' | 'joint';
    items: string[];
  }) => {
    await taskService.createCustomMonthlyItem(
      data.items[0],
      monthKey,
      data.weekIndex,
      data.section,
      data.items
    );
    await loadData();
  };

  // Stats across the whole month (includes static + user-added custom tasks)
  const monthStats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;

    weeks.forEach((w, wIdx) => {
      const mdItems: string[] = w.mdFocusSchedule || [];
      const sivItems: string[] = w.sivakasiActivities || [];
      const sriItems: string[] = w.sriviActivities || [];
      const jointItems: string[] = w.jointActivities || [];
      const customItems: any[] = w.customItems || [];

      mdItems.forEach((_: any, i: number) => {
        totalTasks++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_md_${i}`]) completedTasks++;
      });
      sivItems.forEach((_: any, i: number) => {
        totalTasks++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_siv_${i}`]) completedTasks++;
      });
      sriItems.forEach((_: any, i: number) => {
        totalTasks++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_sri_${i}`]) completedTasks++;
      });
      jointItems.forEach((_: any, i: number) => {
        totalTasks++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_joint_${i}`]) completedTasks++;
      });
      customItems.forEach((c: any) => {
        totalTasks++;
        const key = `monthly_${monthKey}_w${wIdx}_${c.section}_custom_${c.dbId}_${c.itemIndex}`;
        if (completedItems[key]) completedTasks++;
      });
    });

    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { totalTasks, completedTasks, pct };
  }, [weeks, completedItems, monthKey]);

  // Stats per week
  const weekStatsMap = useMemo(() => {
    const map = new Map<number, { total: number; completed: number; pct: number }>();
    weeks.forEach((w, wIdx) => {
      let t = 0;
      let c = 0;
      (w.mdFocusSchedule || []).forEach((_: any, i: number) => {
        t++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_md_${i}`]) c++;
      });
      (w.sivakasiActivities || []).forEach((_: any, i: number) => {
        t++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_siv_${i}`]) c++;
      });
      (w.sriviActivities || []).forEach((_: any, i: number) => {
        t++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_sri_${i}`]) c++;
      });
      (w.jointActivities || []).forEach((_: any, i: number) => {
        t++;
        if (completedItems[`monthly_${monthKey}_w${wIdx}_joint_${i}`]) c++;
      });
      (w.customItems || []).forEach((ci: any) => {
        t++;
        const key = `monthly_${monthKey}_w${wIdx}_${ci.section}_custom_${ci.dbId}_${ci.itemIndex}`;
        if (completedItems[key]) c++;
      });
      map.set(wIdx, { total: t, completed: c, pct: t > 0 ? Math.round((c / t) * 100) : 0 });
    });
    return map;
  }, [weeks, completedItems, monthKey]);

  // Week cards to display
  const activeWeeks = useMemo(() => {
    if (selectedWeekIdx === -1) {
      return weeks.map((w, idx) => ({ week: w, index: idx }));
    }
    const current = weeks[selectedWeekIdx];
    return current ? [{ week: current, index: selectedWeekIdx }] : [];
  }, [weeks, selectedWeekIdx]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.container}>

        {/* ── 1. Top Header ────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>Monthly Strategy & Targets</Text>
            <Text style={styles.headerTitle}>Monthly Roadmap</Text>
          </View>

          {/* Month Navigation Controls */}
          <View style={styles.headerMonthNav}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.navArrowBtn}
            >
              <Ionicons name="chevron-back" size={17} color={Colors.navy} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.todayChip, isCurrentMonth && styles.todayChipActive]}
              onPress={handleThisMonth}
            >
              <Ionicons
                name="calendar-outline"
                size={12}
                color={isCurrentMonth ? '#FFFFFF' : Colors.navy}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.todayChipText, isCurrentMonth && styles.todayChipTextActive]}>
                {isCurrentMonth ? 'This Month' : monthLabel.slice(0, 3)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNextMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.navArrowBtn}
            >
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

        {/* ── 2. Slim Stats Strip ─────────────────────── */}
        <View style={styles.statsStrip}>
          <View style={styles.statsLeft}>
            <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
            <Text style={styles.statsCountText}>
              Monthly Routine: {monthStats.completedTasks}/{monthStats.totalTasks} done
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.statsTrack}>
              <View
                style={[
                  styles.statsFill,
                  { width: `${Math.max(monthStats.pct, 4)}%` },
                  monthStats.pct === 100 && { backgroundColor: '#10B981' },
                ]}
              />
            </View>
            <Text style={styles.statsPctText}>{monthStats.pct}%</Text>
          </View>
        </View>

        {/* ── 3. Ergonomic 4-Week Selector Strip ──────────────── */}
            <View style={styles.weekStripWrapper}>
              <ScrollView
                ref={weekScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.weekStrip}
              >
                {weeks.map((w, idx) => {
                  const isActive = selectedWeekIdx === idx;
                  const isCurrentWeek = isCurrentMonth && getCurrentWeekIndex(new Date()) === idx;
                  const st = weekStatsMap.get(idx) || { total: 0, completed: 0, pct: 0 };
                  const isAllDone = st.total > 0 && st.completed === st.total;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.weekSelectCard,
                        isActive && styles.weekSelectCardActive,
                        isCurrentWeek && !isActive && styles.weekSelectCardToday,
                      ]}
                      onPress={() => setSelectedWeekIdx(idx)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.weekCardHeaderRow}>
                        <Text style={[styles.weekSelectTitle, isActive && styles.weekSelectTitleActive]}>
                          {w.week || `W${idx + 1}`}
                        </Text>
                        {isCurrentWeek && (
                          <View style={[styles.activeDot, isActive && styles.activeDotOnActive]} />
                        )}
                      </View>
                      <Text style={[styles.weekSelectRange, isActive && styles.weekSelectRangeActive]}>
                        Days {w.dateRange}
                      </Text>

                      {/* Mini indicator dot */}
                      <View style={styles.weekDotContainer}>
                        {isAllDone ? (
                          <View style={[styles.miniDot, { backgroundColor: '#10B981' }]} />
                        ) : (monthKey < format(new Date(), 'yyyy-MM') || (isCurrentMonth && idx < getCurrentWeekIndex(new Date()))) && st.total > 0 && st.completed < st.total ? (
                          <View style={[styles.miniDot, { backgroundColor: '#EF4444' }]} />
                        ) : st.completed > 0 ? (
                          <View style={[styles.miniDot, { backgroundColor: '#F59E0B' }]} />
                        ) : st.total > 0 ? (
                          <View style={[styles.miniDot, { backgroundColor: isActive ? '#94A3B8' : '#CBD5E1' }]} />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* All Weeks Pill */}
                <TouchableOpacity
                  style={[
                    styles.weekSelectCard,
                    styles.weekSelectCardAll,
                    selectedWeekIdx === -1 && styles.weekSelectCardActive,
                  ]}
                  onPress={() => setSelectedWeekIdx(-1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.weekSelectTitle, selectedWeekIdx === -1 && styles.weekSelectTitleActive]}>
                    All
                  </Text>
                  <Text style={[styles.weekSelectRange, selectedWeekIdx === -1 && styles.weekSelectRangeActive]}>
                    4 Weeks
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* ── 4. Branch Filter Bar + Add Task Quick Button ───── */}
            <View style={styles.filterBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.branchFilterScroll}
              >
                {BRANCH_FILTERS.map((branch) => {
                  const isSel = selectedBranch === branch;
                  return (
                    <TouchableOpacity
                      key={branch}
                      style={[styles.branchFilterChip, isSel && styles.branchFilterChipActive]}
                      onPress={() => setSelectedBranch(branch)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.branchFilterText, isSel && styles.branchFilterTextActive]}>
                        {branch}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Add Task Button */}
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
              ) : activeWeeks.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>No monthly roadmap data</Text>
                  <Text style={styles.emptySub}>Please check database or refresh.</Text>
                </View>
              ) : (
                activeWeeks.map(({ week, index: wIdx }) => {
                  const mdItems: string[] = week.mdFocusSchedule || [];
                  const sivItems: string[] = week.sivakasiActivities || [];
                  const sriItems: string[] = week.sriviActivities || [];
                  const jointItems: string[] = week.jointActivities || [];
                  const customItems: any[] = week.customItems || [];

                  const mdCustom = customItems.filter((c: any) => c.section === 'md');
                  const sivCustom = customItems.filter((c: any) => c.section === 'sivakasi');
                  const sriCustom = customItems.filter((c: any) => c.section === 'srivi');
                  const jointCustom = customItems.filter((c: any) => c.section === 'joint');

                  const st = weekStatsMap.get(wIdx) || { total: 0, completed: 0, pct: 0 };
                  const allWeekDone = st.total > 0 && st.completed === st.total;
                  const isPastMonth = monthKey < format(new Date(), 'yyyy-MM');
                  const currentWeekIdx = getCurrentWeekIndex(new Date());
                  const isPastWeek = isPastMonth || (isCurrentMonth && wIdx < currentWeekIdx);
                  const isWeekPending = isPastWeek && !allWeekDone && st.total > 0;

                  return (
                    <View key={wIdx} style={styles.weekSectionContainer}>
                      {/* Week Header Banner Card */}
                      <View style={styles.weekBannerCard}>
                        {/* Top row: Week Badge + Current pill + Date Range + Done Badge */}
                        <View style={styles.weekBannerTopRow}>
                          <View style={styles.weekBannerLeftPills}>
                            <View style={[styles.weekBadge, isCurrentMonth && getCurrentWeekIndex(new Date()) === wIdx && styles.weekBadgeCurrent]}>
                              <Text style={styles.weekBadgeText}>WEEK {wIdx + 1}</Text>
                            </View>
                            {isCurrentMonth && getCurrentWeekIndex(new Date()) === wIdx && (
                              <View style={styles.currentWeekTag}>
                                <View style={styles.currentWeekPulseDot} />
                                <Text style={styles.currentWeekTagText}>Current</Text>
                              </View>
                            )}
                            <View style={styles.weekRangeChip}>
                              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                              <Text style={styles.weekBannerRange}>Days {week.dateRange}</Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.doneBadge,
                              allWeekDone && styles.doneBadgeAllDone,
                              isWeekPending && styles.doneBadgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.doneBadgeText,
                                allWeekDone && styles.doneBadgeTextAllDone,
                                isWeekPending && styles.doneBadgeTextPending,
                              ]}
                            >
                              {allWeekDone ? '✓ All Done' : isWeekPending ? `⚠️ ${st.completed}/${st.total} done` : `${st.completed}/${st.total} done`}
                            </Text>
                          </View>
                        </View>

                        {/* Bottom row: Week Theme Title */}
                        <View style={styles.weekBannerBottomRow}>
                          <Text style={styles.weekBannerTheme} numberOfLines={2}>
                            {week.theme}
                          </Text>
                          <Text style={styles.weekBannerPctText}>{st.pct}%</Text>
                        </View>

                        {/* Progress Bar for the week */}
                        <View style={styles.weekProgressBarTrack}>
                          <View
                            style={[
                              styles.weekProgressBarFill,
                              {
                                width: `${Math.max(allWeekDone ? 100 : st.pct, 4)}%`,
                                backgroundColor: allWeekDone ? '#10B981' : isWeekPending ? '#EF4444' : Colors.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>

                      {/* 1. Work & Projects Routine Card */}
                      {(selectedBranch === 'All' || selectedBranch === 'Work') && (mdItems.length > 0 || mdCustom.length > 0) && (
                        <ChecklistTaskCard
                          title="Work & Projects Routine"
                          branch="Work"
                          category="Work"
                          items={mdItems}
                          customItems={mdCustom}
                          prefix={`monthly_${monthKey}_w${wIdx}_md_`}
                          completedItems={completedItems}
                          onToggle={handleToggleItemKey}
                          onDeleteCustomItem={handleDeleteCustomItem}
                          weekIndex={wIdx}
                          monthKey={monthKey}
                        />
                      )}

                      {/* 2. Personal & Habits Routine Card */}
                      {(selectedBranch === 'All' || selectedBranch === 'Personal') && (sivItems.length > 0 || sivCustom.length > 0) && (
                        <ChecklistTaskCard
                          title="Personal & Habits Routine"
                          branch="Personal"
                          category="Personal"
                          items={sivItems}
                          customItems={sivCustom}
                          prefix={`monthly_${monthKey}_w${wIdx}_siv_`}
                          completedItems={completedItems}
                          onToggle={handleToggleItemKey}
                          onDeleteCustomItem={handleDeleteCustomItem}
                          weekIndex={wIdx}
                          monthKey={monthKey}
                        />
                      )}

                      {/* 3. Finance & Budget Routine Card */}
                      {(selectedBranch === 'All' || selectedBranch === 'Finance') && (sriItems.length > 0 || sriCustom.length > 0) && (
                        <ChecklistTaskCard
                          title="Finance & Budget Routine"
                          branch="Finance"
                          category="Finance"
                          items={sriItems}
                          customItems={sriCustom}
                          prefix={`monthly_${monthKey}_w${wIdx}_sri_`}
                          completedItems={completedItems}
                          onToggle={handleToggleItemKey}
                          onDeleteCustomItem={handleDeleteCustomItem}
                          weekIndex={wIdx}
                          monthKey={monthKey}
                        />
                      )}

                      {/* 4. Health & Wellness Routine Card */}
                      {(selectedBranch === 'All' || selectedBranch === 'Health') && (jointItems.length > 0 || jointCustom.length > 0) && (
                        <ChecklistTaskCard
                          title="Health & Wellness Routine"
                          branch="Health"
                          category="Health"
                          items={jointItems}
                          customItems={jointCustom}
                          prefix={`monthly_${monthKey}_w${wIdx}_joint_`}
                          completedItems={completedItems}
                          onToggle={handleToggleItemKey}
                          onDeleteCustomItem={handleDeleteCustomItem}
                          weekIndex={wIdx}
                          monthKey={monthKey}
                        />
                      )}

                      {/* Week Empty State if no tasks yet in this week */}
                      {mdItems.length === 0 && mdCustom.length === 0 &&
                       sivItems.length === 0 && sivCustom.length === 0 &&
                       sriItems.length === 0 && sriCustom.length === 0 &&
                       jointItems.length === 0 && jointCustom.length === 0 && (
                        <View style={styles.emptyCard}>
                          <Ionicons name="calendar-outline" size={32} color={Colors.textLight} />
                          <Text style={styles.emptyTitle}>No tasks added for Week {wIdx + 1} yet</Text>
                          <Text style={styles.emptySub}>Add routines to plan this week's goals.</Text>
                          <TouchableOpacity
                            style={styles.emptyAddBtn}
                            onPress={() => setAddModalVisible(true)}
                          >
                            <Ionicons name="add-circle" size={16} color={Colors.primary} />
                            <Text style={styles.emptyAddBtnText}>Add Routine to Week {wIdx + 1}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* 5. Key Decision Point & KPIs Card */}
                      {(week.keyDecisionPoint || week.kpisToTrack?.length > 0) && (
                        <View style={[styles.decisionCard, Shadows.sm]}>
                          {week.keyDecisionPoint ? (
                            <View style={styles.decisionBlock}>
                              <View style={styles.decisionTitleRow}>
                                <Ionicons name="bulb-outline" size={15} color="#B45309" />
                                <Text style={styles.decisionBadgeText}>KEY DECISION POINT</Text>
                              </View>
                              <Text style={styles.decisionText}>{week.keyDecisionPoint}</Text>
                            </View>
                          ) : null}

                          {week.kpisToTrack?.length > 0 && (
                            <View style={styles.kpiBlock}>
                              <Text style={styles.kpiTitle}>WEEK {wIdx + 1} METRICS TO MONITOR</Text>
                              <View style={styles.kpiChipsWrap}>
                                {week.kpisToTrack.map((kpi: string, ki: number) => (
                                  <View key={ki} style={styles.kpiChip}>
                                    <Text style={styles.kpiChipText}>{kpi}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
              <View style={{ height: 90 }} />
            </ScrollView>

        {/* Floating Action Button (FAB) for quick add */}
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Add Monthly Routine Modal */}
        <AddMonthlyRoutineModal
          visible={addModalVisible}
          initialWeekIdx={selectedWeekIdx >= 0 ? selectedWeekIdx : getCurrentWeekIndex(new Date())}
          monthLabel={monthLabel}
          onClose={() => setAddModalVisible(false)}
          onSave={handleSaveNewRoutine}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Reusable Component: Checklist Task Card ───────────────────────
function ChecklistTaskCard({
  title,
  branch,
  category,
  items,
  customItems = [],
  prefix,
  completedItems,
  onToggle,
  onDeleteCustomItem,
  weekIndex,
  monthKey,
}: {
  title: string;
  branch: string;
  category: string;
  items: string[];
  customItems?: { id: string; text: string; dbId: string; itemIndex: number }[];
  prefix: string;
  completedItems: Record<string, boolean>;
  onToggle: (key: string) => void;
  onDeleteCustomItem?: (dbId: string, text: string, itemIndex?: number) => void;
  weekIndex: number;
  monthKey: string;
}) {
  const pStyle = BRANCH_PILL_STYLES[branch] || BRANCH_PILL_STYLES['MD Focus'];

  const allCheckItems = [
    ...items.map((it, idx) => ({
      key: `${prefix}${idx}`,
      text: it,
      isCustom: false,
      dbId: undefined,
      itemIndex: undefined,
    })),
    ...customItems.map((c) => ({
      key: `${prefix}custom_${c.dbId}_${c.itemIndex}`,
      text: c.text,
      isCustom: true,
      dbId: c.dbId,
      itemIndex: c.itemIndex,
    })),
  ];

  const doneCount = allCheckItems.filter((ci) => completedItems[ci.key]).length;
  const allDone = allCheckItems.length > 0 && doneCount === allCheckItems.length;
  const unfinishedCount = allCheckItems.length - doneCount;

  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const isCurrentMonth = monthKey === currentMonthKey;
  const isPastMonth = monthKey < currentMonthKey;
  const currentWeekIdx = getCurrentWeekIndex(new Date());

  const isPastWeek = isPastMonth || (isCurrentMonth && weekIndex < currentWeekIdx);
  const isCurrentWeek = isCurrentMonth && weekIndex === currentWeekIdx;

  const isPending = !allDone && allCheckItems.length > 0 && (isPastWeek || isCurrentWeek);
  const isOverduePast = !allDone && allCheckItems.length > 0 && isPastWeek;

  return (
    <View
      style={[
        styles.taskCard,
        Shadows.sm,
        isPending && styles.taskCardPending,
        allDone && styles.taskCardAllDone,
      ]}
    >
      {/* Left colored accent bar */}
      <View
        style={[
          styles.cardLeftStrip,
          { backgroundColor: allDone ? '#10B981' : isPending ? '#EF4444' : pStyle.dot },
        ]}
      />

      <View style={styles.cardContent}>
        {/* Meta row: branch pill + category + done badge */}
        <View style={styles.cardMetaRow}>
          <View style={[styles.branchPill, { backgroundColor: pStyle.bg, borderColor: pStyle.border }]}>
            <View style={[styles.branchDot, { backgroundColor: pStyle.dot }]} />
            <Text style={[styles.branchPillText, { color: pStyle.text }]}>{branch}</Text>
          </View>

          <View
            style={[
              styles.timePill,
              isPending && styles.timePillPending,
            ]}
          >
            <Ionicons
              name="pricetag-outline"
              size={11}
              color={isPending ? '#DC2626' : Colors.textMuted}
            />
            <Text
              style={[
                styles.timePillText,
                isPending && styles.timePillTextPending,
              ]}
            >
              {isPending ? `⚠️ ${category} • PENDING` : category}
            </Text>
          </View>

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
                ? `⚠️ ${doneCount}/${allCheckItems.length} done`
                : `${doneCount}/${allCheckItems.length} done`}
            </Text>
          </View>
        </View>

        {/* Card Title */}
        <Text
          style={[
            styles.taskCardTitle,
            allDone && styles.taskCardTitleAllDone,
            isPending && styles.taskCardTitlePending,
          ]}
        >
          {title}
        </Text>

        {/* Pending Alert Row */}
        {isPending && (
          <View style={styles.pendingAlertRow}>
            <Ionicons name="alert-circle" size={13} color="#DC2626" />
            <Text style={styles.pendingAlertText}>
              {isOverduePast ? 'Week ended' : 'Current week'} • {unfinishedCount} pending {unfinishedCount === 1 ? 'checklist item' : 'checklist items'}
            </Text>
          </View>
        )}

        {/* Interactive Checklist Block (Static + Custom Injected Tasks) */}
        <View style={styles.checklistBlock}>
          {allCheckItems.map((ci, idx) => {
            const isDone = !!completedItems[ci.key];

            return (
              <View
                key={ci.key || idx}
                style={[
                  styles.checkRowWrapper,
                  idx === allCheckItems.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <TouchableOpacity
                  style={[styles.checkRow, isDone && styles.checkRowDone]}
                  onPress={() => onToggle(ci.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isDone ? 'checkmark-circle' : 'square-outline'}
                    size={21}
                    color={isDone ? '#10B981' : Colors.danger}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={[styles.checkText, isDone && styles.checkTextDone]}>
                    {ci.text}
                  </Text>
                </TouchableOpacity>

                {ci.isCustom && ci.dbId && onDeleteCustomItem && (
                  <TouchableOpacity
                    onPress={() => onDeleteCustomItem(ci.dbId as string, ci.text, ci.itemIndex)}
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
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },

  /* 1. Top Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.navy },

  headerMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  navArrowBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F3EFEA',
  },
  todayChipActive: { backgroundColor: Colors.navy },
  todayChipText: { fontSize: 11, fontWeight: '700', color: Colors.navy },
  todayChipTextActive: { color: '#FFFFFF' },

  headerRightIcons: { flexDirection: 'row', gap: 5 },
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

  /* 2. Slim Stats Strip */
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statsPctText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  statsTrack: {
    flex: 1,
    maxWidth: 90,
    height: 6,
    backgroundColor: '#F3EFEA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statsFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  statsCountText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: '#FAF8F5',
    borderRadius: 9,
    padding: 2,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  segmentBtnActive: { backgroundColor: Colors.navy },
  segmentText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  segmentTextActive: { color: '#FFFFFF' },

  /* 3. 4-Week Selector Strip */
  weekStripWrapper: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weekStrip: {
    paddingHorizontal: 16,
    gap: 8,
  },
  weekSelectCard: {
    width: 72,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  weekSelectCardAll: {
    width: 60,
  },
  weekSelectCardActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  weekSelectTitle: { fontSize: 13, fontWeight: '800', color: Colors.navy },
  weekSelectTitleActive: { color: '#FFFFFF' },
  weekSelectRange: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, marginTop: 1 },
  weekSelectRangeActive: { color: '#94A3B8' },
  weekCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  activeDotOnActive: {
    backgroundColor: '#10B981',
  },
  weekSelectCardToday: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FFF5EE',
  },
  weekDotContainer: { flexDirection: 'row', gap: 2, marginTop: 4, height: 5, alignItems: 'center' },
  miniDot: { width: 5, height: 5, borderRadius: 2.5 },

  /* 4. Filter Bar */
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  branchFilterScroll: { gap: 6 },
  branchFilterChip: {
    paddingHorizontal: 10,
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
    marginLeft: 6,
  },
  addRoutineQuickText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  /* 5. Scroll List & Week Section */
  scrollList: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  weekSectionContainer: {
    marginBottom: 16,
  },
  weekBannerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  weekBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekBannerLeftPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  weekBadge: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  weekBadgeCurrent: {
    backgroundColor: Colors.primary,
  },
  weekBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  currentWeekTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentWeekPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  currentWeekTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  weekRangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  weekBannerRange: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  weekBannerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  weekBannerTheme: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy,
    flex: 1,
  },
  weekBannerPctText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  weekProgressBarTrack: {
    height: 4,
    backgroundColor: '#F3EFEA',
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  weekProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* Empty State */
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
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFF5EE',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  /* Activity Task Card */
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
  timePillText: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  timePillTextPending: { color: '#DC2626', fontWeight: '800' },
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
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 6,
    lineHeight: 19,
  },
  taskCardTitlePending: {
    color: '#991B1B',
  },
  taskCardTitleAllDone: {
    color: '#065F46',
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

  /* Checklist Block */
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

  /* Floating Action Button (FAB) */
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
    ...Shadows.md,
  },

  /* Decision & KPIs Card */
  decisionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  decisionBlock: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  decisionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  decisionBadgeText: { fontSize: 9, fontWeight: '800', color: '#B45309', letterSpacing: 0.5 },
  decisionText: { fontSize: 12, color: '#78350F', fontWeight: '600', lineHeight: 17 },

  kpiBlock: {
    paddingTop: 2,
  },
  kpiTitle: { fontSize: 10, fontWeight: '800', color: Colors.navy, marginBottom: 6 },
  kpiChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kpiChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kpiChipText: { fontSize: 10, fontWeight: '700', color: Colors.navyLight },

  /* Goals Tab Extras */
  goalCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 6,
    lineHeight: 20,
  },
  goalDescriptionText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    lineHeight: 17,
  },
  goalMetricsContainer: {
    backgroundColor: '#FAF9F6',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  goalMetricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  goalMetricRowBorder: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  goalMetricHeading: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  goalMetricContent: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
    lineHeight: 17,
  },
  goalProgressSection: {
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.navyLight,
  },
  progressPctBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  goalStatsTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },

  /* Metrics Tab Extras */
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricCardTitle: { fontSize: 13, fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  metricBranchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metricBranchBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
  },
  metricBranchLabel: { fontSize: 9, fontWeight: '800', marginBottom: 2 },
  metricBranchValue: { fontSize: 14, fontWeight: '800' },
  metricActionText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  /* Modal Styles */
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
  modalWeekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  modalWeekChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalWeekChipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  modalWeekChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
  },
  modalWeekChipTextActive: {
    color: '#FFFFFF',
  },
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
    backgroundColor: '#FFF5EE',
    borderColor: '#F6D0B4',
  },
  containerOptionText: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  containerOptionTextActive: { color: Colors.primary },
  joinContainerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 6,
  },
  joinContainerNoteText: { fontSize: 11, color: Colors.primary, fontWeight: '600', flex: 1 },
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
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F3EFEA',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  saveBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
