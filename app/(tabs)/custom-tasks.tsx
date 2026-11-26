import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { format, isToday, isTomorrow, isPast, parseISO, isValid, addDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { taskService } from '../../src/services/taskService';
import { pushNotificationService } from '../../src/services/pushNotificationService';
import { MobileTask, TaskCategory, TaskPriority } from '../../src/types';
import { Colors, Shadows } from '../../src/constants/theme';
import { PendingNotificationBell } from '../../src/components/PendingNotificationBell';
import { DatePickerModal, TimePickerModal } from '../../src/components/DateTimePickerModal';

const formatDisplayTime = (time24: string) => {
  if (!time24) return 'Select Time';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr || '00'} ${period}`;
};

// Available categories with metadata
const CATEGORIES: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] = [
  { label: 'All', value: 'All', icon: 'apps-outline', color: Colors.navy, bg: '#F1F5F9' },
  { label: 'Operations', value: 'operations', icon: 'settings-outline', color: '#0284C7', bg: '#E0F2FE' },
  { label: 'Strategy', value: 'strategy', icon: 'trending-up-outline', color: '#7C3AED', bg: '#EDE9FE' },
  { label: 'Finance', value: 'finance', icon: 'cash-outline', color: '#059669', bg: '#D1FAE5' },
  { label: 'Marketing', value: 'marketing', icon: 'megaphone-outline', color: '#EA580C', bg: '#FFEDD5' },
  { label: 'Team', value: 'team', icon: 'people-outline', color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Review', value: 'review', icon: 'checkmark-done-outline', color: '#0D9488', bg: '#CCFBF1' },
  { label: 'Personal', value: 'personal', icon: 'person-outline', color: '#D97706', bg: '#FEF3C7' },
];

const PRIORITIES: { label: string; value: TaskPriority; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'High', value: 'high', color: Colors.danger, bg: '#FEF2F2', icon: 'flame' },
  { label: 'Medium', value: 'medium', color: Colors.warning, bg: '#FFFBEB', icon: 'alert-circle-outline' },
  { label: 'Low', value: 'low', color: Colors.success, bg: '#F0FDF4', icon: 'shield-checkmark-outline' },
];

type StatusFilter = 'all' | 'pending' | 'completed' | 'high' | 'today';

// Quick Add Task Modal Component
function AddCustomTaskModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (task: {
    title: string;
    description?: string;
    dueDate: string;
    dueTime?: string;
    category: TaskCategory;
    priority: TaskPriority;
    isTopPriority?: boolean;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTime, setDueTime] = useState('10:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [category, setCategory] = useState<TaskCategory>('operations');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isTopPriority, setIsTopPriority] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
      setDueTime('10:00');
      setCategory('operations');
      setPriority('medium');
      setIsTopPriority(false);
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        dueTime: dueTime.trim() || undefined,
        category,
        priority,
        isTopPriority,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Could not create task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const setDatePreset = (daysOffset: number) => {
    const target = addDays(new Date(), daysOffset);
    setDueDate(format(target, 'yyyy-MM-dd'));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>New Custom Task</Text>
                <Text style={styles.modalSubTitle}>Saved directly to Supabase DB</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={styles.inputLabel}>
                Task Title <Text style={{ color: Colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Conduct monthly revenue audit"
                placeholderTextColor={Colors.textLight}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />

              {/* Description */}
              <Text style={styles.inputLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.modalTextInput, { minHeight: 64, textAlignVertical: 'top' }]}
                placeholder="Key questions, attendees, or requirements..."
                placeholderTextColor={Colors.textLight}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* Date Presets */}
              <Text style={styles.inputLabel}>Due Date</Text>
              <View style={styles.datePresetRow}>
                <TouchableOpacity
                  style={[styles.presetChip, dueDate === format(new Date(), 'yyyy-MM-dd') && styles.presetChipActive]}
                  onPress={() => setDatePreset(0)}
                >
                  <Text style={[styles.presetChipText, dueDate === format(new Date(), 'yyyy-MM-dd') && styles.presetChipTextActive]}>
                    Today
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetChip, dueDate === format(addDays(new Date(), 1), 'yyyy-MM-dd') && styles.presetChipActive]}
                  onPress={() => setDatePreset(1)}
                >
                  <Text style={[styles.presetChipText, dueDate === format(addDays(new Date(), 1), 'yyyy-MM-dd') && styles.presetChipTextActive]}>
                    Tomorrow
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetChip, dueDate === format(addDays(new Date(), 3), 'yyyy-MM-dd') && styles.presetChipActive]}
                  onPress={() => setDatePreset(3)}
                >
                  <Text style={[styles.presetChipText, dueDate === format(addDays(new Date(), 3), 'yyyy-MM-dd') && styles.presetChipTextActive]}>
                    In 3 Days
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <TouchableOpacity
                    style={styles.pickerSelectorBtn}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar" size={16} color={Colors.primary} style={styles.inputIcon} />
                    <Text style={styles.pickerSelectorText} numberOfLines={1}>
                      {dueDate || 'Select Date'}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.rowHalf, { marginLeft: 10 }]}>
                  <TouchableOpacity
                    style={styles.pickerSelectorBtn}
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time" size={16} color={Colors.primary} style={styles.inputIcon} />
                    <Text style={styles.pickerSelectorText} numberOfLines={1}>
                      {formatDisplayTime(dueTime)}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Priority */}
              <Text style={styles.inputLabel}>Priority Level</Text>
              <View style={styles.pillRow}>
                {PRIORITIES.map((p) => {
                  const active = priority === p.value;
                  return (
                    <TouchableOpacity
                      key={p.value}
                      style={[
                        styles.priorityPill,
                        { backgroundColor: active ? p.color : p.bg, borderColor: active ? p.color : Colors.border },
                      ]}
                      onPress={() => setPriority(p.value)}
                    >
                      <Ionicons name={p.icon} size={15} color={active ? '#FFF' : p.color} />
                      <Text style={[styles.priorityText, { color: active ? '#FFF' : p.color }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Category */}
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScrollRow}>
                {CATEGORIES.filter((c) => c.value !== 'All').map((c) => {
                  const active = category === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[styles.categoryPill, active && { backgroundColor: Colors.navy, borderColor: Colors.navy }]}
                      onPress={() => setCategory(c.value as TaskCategory)}
                    >
                      <Ionicons name={c.icon} size={14} color={active ? '#FFF' : Colors.navy} />
                      <Text style={[styles.categoryPillText, active && { color: '#FFF' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Top Priority Toggle */}
              <TouchableOpacity
                style={[styles.topPriorityToggle, isTopPriority && styles.topPriorityToggleActive]}
                onPress={() => setIsTopPriority((v) => !v)}
              >
                <Ionicons
                  name={isTopPriority ? 'star' : 'star-outline'}
                  size={18}
                  color={isTopPriority ? '#F59E0B' : Colors.textMuted}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.topPriorityLabel, isTopPriority && { color: Colors.navy }]}>
                    Pin to Top Priority
                  </Text>
                  <Text style={styles.topPriorityHint}>Displays with highlighted star badge on dashboard</Text>
                </View>
                <Ionicons
                  name={isTopPriority ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isTopPriority ? Colors.primary : Colors.textMuted}
                />
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  onClose();
                  router.push('/new-task');
                }}
              >
                <Ionicons name="expand-outline" size={15} color={Colors.navy} />
                <Text style={styles.modalCancelText}>Full Form</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!title.trim() || saving) && styles.modalSubmitBtnDisabled]}
                onPress={handleSave}
                disabled={!title.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitText}>Save Task</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      {/* Date & Time Picker Modals */}
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={dueDate}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(d) => setDueDate(d)}
      />
      <TimePickerModal
        visible={showTimePicker}
        selectedTime={dueTime}
        onClose={() => setShowTimePicker(false)}
        onSelectTime={(t) => setDueTime(t)}
      />
    </Modal>
  );
}

export default function CustomTasksScreen() {
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const loadTasks = useCallback(async () => {
    try {
      const data = await taskService.getAllCustomTasks();
      setTasks(data);
    } catch (err) {
      console.error('Error fetching custom tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleToggle = async (task: MobileTask) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    await taskService.toggleTask(task.id, task.status);
  };

  const handleDelete = (task: MobileTask) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          await taskService.deleteCustomTask(task.id);
        },
      },
    ]);
  };

  const handleMoveToToday = async (task: MobileTask) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, dueDate: todayStr } : t)));
    await taskService.updateCustomTask(task.id, { dueDate: todayStr });
  };

  const handleCreateTask = async (taskData: {
    title: string;
    description?: string;
    dueDate: string;
    dueTime?: string;
    category: TaskCategory;
    priority: TaskPriority;
    isTopPriority?: boolean;
  }) => {
    const created = await taskService.createCustomTask(taskData);
    if (created) {
      setTasks((prev) => [created, ...prev]);
      if (taskData.dueTime) {
        pushNotificationService.scheduleTaskAlarmAhead({
          id: created.id,
          title: created.title,
          dueDate: created.dueDate,
          dueTime: taskData.dueTime,
          isUrgent: created.priority === 'high' || !!created.isTopPriority,
        }).catch(() => {});
      }
    } else {
      await loadTasks();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Stats Calculations ──────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pending = total - completed;
    const high = tasks.filter((t) => t.priority === 'high' && t.status !== 'completed').length;
    const todayTasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      try {
        const parsed = parseISO(t.dueDate);
        return isValid(parsed) && isToday(parsed);
      } catch {
        return false;
      }
    }).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, high, todayTasks, pct };
  }, [tasks]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { All: tasks.length };
    tasks.forEach((t) => {
      const cat = (t.category || 'operations').toLowerCase();
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [tasks]);

  // ── Filtered & Searched Tasks ───────────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description ? t.description.toLowerCase().includes(q) : false;
        const matchesCat = t.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'All' && t.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter === 'pending') {
        return t.status !== 'completed';
      }
      if (statusFilter === 'completed') {
        return t.status === 'completed';
      }
      if (statusFilter === 'high') {
        return t.priority === 'high' || t.isTopPriority;
      }
      if (statusFilter === 'today') {
        if (!t.dueDate) return false;
        try {
          const parsed = parseISO(t.dueDate);
          return isValid(parsed) && isToday(parsed);
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [tasks, searchQuery, selectedCategory, statusFilter]);

  // Helper for due date badge
  const renderDateBadge = (dueDateStr?: string, dueTimeStr?: string, isDone?: boolean) => {
    if (!dueDateStr) return null;
    let label = dueDateStr;
    let badgeBg = '#F1F5F9';
    let textColor = Colors.textMuted;
    let isOverdue = false;

    try {
      const parsed = parseISO(dueDateStr);
      if (isValid(parsed)) {
        if (isToday(parsed)) {
          label = dueTimeStr ? `Today, ${dueTimeStr}` : 'Today';
          badgeBg = isDone ? '#F1F5F9' : '#ECFDF5';
          textColor = isDone ? Colors.textMuted : '#059669';
        } else if (isTomorrow(parsed)) {
          label = dueTimeStr ? `Tomorrow, ${dueTimeStr}` : 'Tomorrow';
          badgeBg = isDone ? '#F1F5F9' : '#EEF2FF';
          textColor = isDone ? Colors.textMuted : '#4F46E5';
        } else if (isPast(parsed) && !isDone) {
          isOverdue = true;
          label = `Overdue (${format(parsed, 'dd MMM')})`;
          badgeBg = '#FEF2F2';
          textColor = Colors.danger;
        } else {
          label = format(parsed, 'dd MMM yyyy');
        }
      }
    } catch {
      // fallback to raw text
    }

    return (
      <View style={[styles.dueDateBadge, { backgroundColor: badgeBg }]}>
        <Ionicons
          name={isOverdue ? 'alert-circle' : 'calendar-outline'}
          size={11}
          color={textColor}
          style={{ marginRight: 3 }}
        />
        <Text style={[styles.dueDateBadgeText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.container}>

        {/* ── 1. Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>Personal & Ad-hoc Operations</Text>
            <Text style={styles.headerTitle}>Custom Tasks</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.dbBadge}>
              <View style={styles.dbBadgeDot} />
              <Text style={styles.dbBadgeText}>Live DB</Text>
            </View>

            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={() => setShowAddModal(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={17} color="#FFFFFF" />
              <Text style={styles.headerAddBtnText}>Add</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push('/ai-chat')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
            </TouchableOpacity>

            <PendingNotificationBell />
          </View>
        </View>

        {/* ── 2. Hero Progress & Summary Banner ─────────────────────── */}
        <View style={[styles.statsCard, Shadows.sm]}>
          <View style={styles.statsMetricsRow}>
            <View style={styles.statsMetricCol}>
              <Text style={styles.statsMetricNum}>{stats.total}</Text>
              <Text style={styles.statsMetricLabel}>Total</Text>
            </View>
            <View style={styles.statsMetricDivider} />
            <View style={styles.statsMetricCol}>
              <Text style={[styles.statsMetricNum, { color: Colors.warning }]}>{stats.pending}</Text>
              <Text style={styles.statsMetricLabel}>Pending</Text>
            </View>
            <View style={styles.statsMetricDivider} />
            <View style={styles.statsMetricCol}>
              <Text style={[styles.statsMetricNum, { color: Colors.success }]}>{stats.completed}</Text>
              <Text style={styles.statsMetricLabel}>Done</Text>
            </View>
            <View style={styles.statsMetricDivider} />
            <View style={styles.statsMetricCol}>
              <Text style={[styles.statsMetricNum, { color: Colors.danger }]}>{stats.high}</Text>
              <Text style={styles.statsMetricLabel}>High Pri</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(stats.pct, 4)}%` },
                  stats.pct === 100 && { backgroundColor: '#10B981' },
                ]}
              />
            </View>
            <Text style={styles.progressPctText}>{stats.pct}% Completed</Text>
          </View>
        </View>

        {/* ── 3. Search Bar ─────────────────────────────────────────── */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search custom tasks by name or notes..."
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={Colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── 4. Status Filter Segment ──────────────────────────────── */}
        <View style={styles.statusSegmentRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusSegmentScroll}>
            <TouchableOpacity
              style={[styles.statusSegmentChip, statusFilter === 'all' && styles.statusSegmentChipActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.statusSegmentText, statusFilter === 'all' && styles.statusSegmentTextActive]}>
                All ({stats.total})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusSegmentChip, statusFilter === 'pending' && styles.statusSegmentChipActive]}
              onPress={() => setStatusFilter('pending')}
            >
              <Text style={[styles.statusSegmentText, statusFilter === 'pending' && styles.statusSegmentTextActive]}>
                Pending ({stats.pending})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusSegmentChip, statusFilter === 'today' && styles.statusSegmentChipActive]}
              onPress={() => setStatusFilter('today')}
            >
              <Ionicons
                name="calendar"
                size={11}
                color={statusFilter === 'today' ? '#FFF' : '#059669'}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.statusSegmentText, statusFilter === 'today' && styles.statusSegmentTextActive]}>
                Today ({stats.todayTasks})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusSegmentChip, statusFilter === 'high' && styles.statusSegmentChipActive]}
              onPress={() => setStatusFilter('high')}
            >
              <Ionicons
                name="flame"
                size={11}
                color={statusFilter === 'high' ? '#FFF' : Colors.danger}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.statusSegmentText, statusFilter === 'high' && styles.statusSegmentTextActive]}>
                High ({stats.high})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusSegmentChip, statusFilter === 'completed' && styles.statusSegmentChipActive]}
              onPress={() => setStatusFilter('completed')}
            >
              <Text style={[styles.statusSegmentText, statusFilter === 'completed' && styles.statusSegmentTextActive]}>
                Done ({stats.completed})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── 5. Category Filter Chips ──────────────────────────────── */}
        <View style={styles.categoryBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const isSel = selectedCategory === cat.value;
              const count = categoryCounts[cat.value.toLowerCase()] || (cat.value === 'All' ? stats.total : 0);

              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.catChip, isSel && styles.catChipActive]}
                  onPress={() => setSelectedCategory(cat.value)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={12}
                    color={isSel ? '#FFFFFF' : cat.color}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>
                    {cat.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.catCountBadge, isSel && styles.catCountBadgeActive]}>
                      <Text style={[styles.catCountText, isSel && styles.catCountTextActive]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── 6. Task List ──────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Syncing custom tasks from Supabase...</Text>
            </View>
          ) : filteredTasks.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="clipboard-outline" size={38} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'No matching tasks found'
                  : selectedCategory !== 'All'
                  ? `No tasks in ${selectedCategory}`
                  : statusFilter === 'completed'
                  ? 'No completed tasks yet'
                  : 'No custom tasks scheduled'}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? 'Try searching with another keyword or clearing the filter.'
                  : 'Add meetings, branch visits, strategy sessions or ad-hoc tasks.'}
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAddModal(true)}>
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Create Custom Task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              const pInfo = PRIORITIES.find((p) => p.value === task.priority) || PRIORITIES[1];
              const cInfo = CATEGORIES.find((c) => c.value === task.category) || CATEGORIES[1];
              const isExpanded = !!expandedNotes[task.id];
              const hasNotes = !!task.description;

              // Check if overdue
              let isOverdue = false;
              if (task.dueDate && !isDone) {
                try {
                  const pDate = parseISO(task.dueDate);
                  isOverdue = isValid(pDate) && isPast(pDate) && !isToday(pDate);
                } catch {
                  // ignore
                }
              }

              // Card accent color
              const accentColor = isDone ? '#10B981' : task.priority === 'high' ? Colors.danger : pInfo.color;

              return (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    Shadows.sm,
                    isDone && styles.taskCardDone,
                    isOverdue && styles.taskCardOverdue,
                  ]}
                >
                  {/* Left priority accent strip */}
                  <View style={[styles.taskCardStrip, { backgroundColor: accentColor }]} />

                  <View style={styles.taskCardBody}>
                    {/* Top Meta Row */}
                    <View style={styles.taskMetaRow}>
                      {/* Category Badge */}
                      <View style={[styles.metaPill, { backgroundColor: cInfo.bg }]}>
                        <Ionicons name={cInfo.icon} size={11} color={cInfo.color} style={{ marginRight: 3 }} />
                        <Text style={[styles.metaPillText, { color: cInfo.color }]}>{cInfo.label}</Text>
                      </View>

                      {/* Priority Badge */}
                      <View style={[styles.metaPill, { backgroundColor: pInfo.bg }]}>
                        <Ionicons name={pInfo.icon} size={10} color={pInfo.color} style={{ marginRight: 3 }} />
                        <Text style={[styles.metaPillText, { color: pInfo.color, fontWeight: '800' }]}>
                          {pInfo.label.toUpperCase()}
                        </Text>
                      </View>

                      {/* Top Priority Star */}
                      {task.isTopPriority && (
                        <View style={styles.topPriorityBadge}>
                          <Ionicons name="star" size={10} color="#D97706" style={{ marginRight: 2 }} />
                          <Text style={styles.topPriorityBadgeText}>Top Pri</Text>
                        </View>
                      )}

                      {/* Due Date Badge */}
                      <View style={{ marginLeft: 'auto' }}>
                        {renderDateBadge(task.dueDate, task.dueTime, isDone)}
                      </View>
                    </View>

                    {/* Main Title Row with Checkbox & Actions */}
                    <View style={styles.taskMainRow}>
                      <TouchableOpacity
                        onPress={() => handleToggle(task)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.checkTouch}
                      >
                        <Ionicons
                          name={isDone ? 'checkbox' : 'square-outline'}
                          size={23}
                          color={isDone ? '#10B981' : Colors.danger}
                        />
                      </TouchableOpacity>

                      <View style={{ flex: 1, paddingRight: 4 }}>
                        <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                          {task.title}
                        </Text>
                      </View>

                      {/* Delete Action Button */}
                      <TouchableOpacity
                        onPress={() => handleDelete(task)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.cardDeleteBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>

                    {/* Description / Notes */}
                    {hasNotes && (
                      <View style={styles.notesContainer}>
                        <Text
                          numberOfLines={isExpanded ? undefined : 2}
                          style={[styles.taskDesc, isDone && styles.taskDescDone]}
                        >
                          {task.description}
                        </Text>
                        {task.description && task.description.length > 80 && (
                          <TouchableOpacity onPress={() => toggleExpand(task.id)} style={styles.expandToggle}>
                            <Text style={styles.expandToggleText}>
                              {isExpanded ? 'Show less' : 'Read full notes...'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Quick Move to Today chip if overdue */}
                    {isOverdue && !isDone && (
                      <View style={styles.overdueActionRow}>
                        <Ionicons name="time" size={12} color={Colors.danger} />
                        <Text style={styles.overdueActionText}>Task is past scheduled date.</Text>
                        <TouchableOpacity
                          style={styles.rescheduleBtn}
                          onPress={() => handleMoveToToday(task)}
                        >
                          <Ionicons name="refresh" size={11} color={Colors.primary} />
                          <Text style={styles.rescheduleBtnText}>Move to Today</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* ── 7. Floating Action Button ──────────────────────────────── */}
        <TouchableOpacity
          style={[styles.fab, Shadows.lg]}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Quick Add Modal */}
        <AddCustomTaskModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleCreateTask}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerSub: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: Colors.navy, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dbBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  dbBadgeText: { fontSize: 11, fontWeight: '700', color: '#047857' },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  headerAddBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Stats Card
  statsCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsMetricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 10 },
  statsMetricCol: { alignItems: 'center' },
  statsMetricNum: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  statsMetricLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, marginTop: 1 },
  statsMetricDivider: { width: 1, height: 24, backgroundColor: Colors.borderLight },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  progressPctText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },

  // Search
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.navy, paddingVertical: 0 },

  // Status Filter Segments
  statusSegmentRow: { marginBottom: 6 },
  statusSegmentScroll: { paddingHorizontal: 16, gap: 6 },
  statusSegmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusSegmentChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  statusSegmentText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  statusSegmentTextActive: { color: '#FFFFFF' },

  // Categories
  categoryBar: { marginBottom: 8 },
  categoryScroll: { paddingHorizontal: 16, gap: 6 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: '#1E293B', borderColor: '#1E293B' },
  catChipText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  catChipTextActive: { color: '#FFFFFF' },
  catCountBadge: {
    marginLeft: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  catCountBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  catCountText: { fontSize: 9, fontWeight: '800', color: Colors.navy },
  catCountTextActive: { color: '#FFFFFF' },

  // Scroll List
  scrollList: { paddingHorizontal: 16, paddingBottom: 90 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  loadingText: { fontSize: 12, color: Colors.textMuted, marginTop: 10 },

  // Empty Box
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy, textAlign: 'center' },
  emptySub: { fontSize: 12, color: Colors.textMuted, marginTop: 4, textAlign: 'center', lineHeight: 18 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  emptyAddBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Task Card
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskCardDone: { opacity: 0.65, backgroundColor: '#FAFAFA' },
  taskCardOverdue: { borderColor: '#FECACA' },
  taskCardStrip: { width: 4 },
  taskCardBody: { flex: 1, padding: 12 },

  // Task Meta Row
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  metaPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6 },
  metaPillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  topPriorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  topPriorityBadgeText: { fontSize: 9, fontWeight: '800', color: '#B45309' },
  dueDateBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6 },
  dueDateBadgeText: { fontSize: 10, fontWeight: '700' },

  // Main Title Row
  taskMainRow: { flexDirection: 'row', alignItems: 'flex-start' },
  checkTouch: { marginRight: 10, marginTop: 1 },
  taskTitle: { fontSize: 14, fontWeight: '700', color: Colors.navy, lineHeight: 20 },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  cardDeleteBtn: { padding: 4, marginLeft: 'auto' },

  // Notes
  notesContainer: { marginTop: 6, paddingLeft: 33 },
  taskDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  taskDescDone: { textDecorationLine: 'line-through' },
  expandToggle: { marginTop: 2 },
  expandToggleText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  // Overdue Banner
  overdueActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
    marginLeft: 33,
  },
  overdueActionText: { fontSize: 10, color: Colors.danger, fontWeight: '600', flex: 1 },
  rescheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rescheduleBtnText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  modalIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  modalSubTitle: { fontSize: 11, color: Colors.textMuted },
  modalCloseBtn: { padding: 4 },

  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.navy, marginTop: 10, marginBottom: 5, textTransform: 'uppercase' },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.navy,
  },
  datePresetRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#F1F5F9' },
  presetChipActive: { backgroundColor: Colors.navy },
  presetChipText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  presetChipTextActive: { color: '#FFFFFF' },

  row: { flexDirection: 'row' },
  rowHalf: { flex: 1 },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  inputIcon: { marginRight: 6 },
  inputInner: { flex: 1, fontSize: 12, color: Colors.navy, paddingVertical: 0 },

  pillRow: { flexDirection: 'row', gap: 8 },
  priorityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  priorityText: { fontSize: 11, fontWeight: '700' },

  categoryScrollRow: { gap: 6 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  categoryPillText: { fontSize: 11, fontWeight: '700', color: Colors.navy },

  topPriorityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  topPriorityToggleActive: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  topPriorityLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  topPriorityHint: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    gap: 4,
  },
  modalCancelText: { fontSize: 12, fontWeight: '700', color: Colors.navy },
  modalSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    gap: 6,
  },
  modalSubmitBtnDisabled: { opacity: 0.5 },
  modalSubmitText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  pickerSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerSelectorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.navy,
  },
});
