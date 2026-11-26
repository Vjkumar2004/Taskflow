import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { taskService } from '../src/services/taskService';
import { pushNotificationService } from '../src/services/pushNotificationService';
import { TaskCategory, TaskPriority } from '../src/types';
import { Colors, Shadows } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatePickerModal, TimePickerModal } from '../src/components/DateTimePickerModal';

const formatDisplayTime = (time24: string) => {
  if (!time24) return 'Select Time';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr || '00'} ${period}`;
};

const CATEGORIES: { label: string; value: TaskCategory; icon: string }[] = [
  { label: 'Operations', value: 'operations', icon: 'settings-outline' },
  { label: 'Strategy',   value: 'strategy',   icon: 'trending-up-outline' },
  { label: 'Finance',    value: 'finance',     icon: 'cash-outline' },
  { label: 'Marketing',  value: 'marketing',   icon: 'megaphone-outline' },
  { label: 'Team',       value: 'team',        icon: 'people-outline' },
  { label: 'Review',     value: 'review',      icon: 'checkmark-done-outline' },
];

const PRIORITIES: { label: string; value: TaskPriority; color: string; bg: string; icon: string }[] = [
  { label: 'High',   value: 'high',   color: Colors.danger,  bg: '#FEF2F2', icon: 'arrow-up-circle-outline' },
  { label: 'Medium', value: 'medium', color: Colors.warning, bg: '#FFFBEB', icon: 'remove-circle-outline' },
  { label: 'Low',    value: 'low',    color: Colors.success, bg: '#F0FDF4', icon: 'arrow-down-circle-outline' },
];

export default function NewTaskScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [dueDate, setDueDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTime, setDueTime]           = useState('10:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [category, setCategory]         = useState<TaskCategory>('operations');
  const [priority, setPriority]         = useState<TaskPriority>('medium');
  const [isTopPriority, setIsTopPriority] = useState(false);
  const [loading, setLoading]           = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    setLoading(true);
    try {
      const created = await taskService.createCustomTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        dueTime: dueTime.trim() || undefined,
        category,
        priority,
        isTopPriority,
      });

      if (dueTime.trim()) {
        pushNotificationService.scheduleTaskAlarmAhead({
          id: (created as any)?.id || `task-${Date.now()}`,
          title: title.trim(),
          dueDate,
          dueTime: dueTime.trim(),
          isUrgent: priority === 'high' || isTopPriority,
        }).catch(() => {});
      }

      router.back();
    } catch {
      Alert.alert('Error', 'Could not save the task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={Colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Task</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={[styles.saveBtn, (!title.trim() || loading) && styles.saveBtnDisabled]}
        >
          {loading
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title ── */}
          <Text style={styles.label}>Task Title <Text style={{ color: Colors.danger }}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Conduct monthly revenue audit"
            placeholderTextColor={Colors.textLight}
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="next"
          />

          {/* ── Description ── */}
          <Text style={styles.label}>Description / Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add context, key questions or preparation notes..."
            placeholderTextColor={Colors.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          {/* ── Date & Time Selector ── */}
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Text style={styles.label}>Due Date</Text>
              <TouchableOpacity
                style={styles.pickerSelectorBtn}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar" size={17} color={Colors.primary} style={styles.inputIcon} />
                <Text style={styles.pickerSelectorText} numberOfLines={1}>
                  {dueDate || 'Select Date'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={[styles.rowHalf, { marginLeft: 12 }]}>
              <Text style={styles.label}>Due Time</Text>
              <TouchableOpacity
                style={styles.pickerSelectorBtn}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="time" size={17} color={Colors.primary} style={styles.inputIcon} />
                <Text style={styles.pickerSelectorText} numberOfLines={1}>
                  {formatDisplayTime(dueTime)}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Priority ── */}
          <Text style={styles.label}>Priority</Text>
          <View style={styles.pillRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p.value;
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.priorityPill, { backgroundColor: active ? p.color : p.bg, borderColor: active ? p.color : Colors.border }]}
                  onPress={() => setPriority(p.value)}
                >
                  <Ionicons name={p.icon as any} size={15} color={active ? '#FFF' : p.color} />
                  <Text style={[styles.priorityText, { color: active ? '#FFF' : p.color }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Category ── */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.categoryCard, active && styles.categoryCardActive]}
                  onPress={() => setCategory(c.value)}
                >
                  <Ionicons name={c.icon as any} size={18} color={active ? '#FFF' : Colors.navyLight} />
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Top Priority Toggle ── */}
          <TouchableOpacity
            style={[styles.topPriorityRow, isTopPriority && styles.topPriorityRowActive]}
            onPress={() => setIsTopPriority((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.topPriorityLeft}>
              <Ionicons name="star" size={18} color={isTopPriority ? '#92400E' : Colors.textMuted} />
              <View>
                <Text style={[styles.topPriorityTitle, isTopPriority && { color: '#92400E' }]}>Mark as Top Priority</Text>
                <Text style={styles.topPrioritySub}>Highlights this task in your daily view</Text>
              </View>
            </View>
            <View style={[styles.toggle, isTopPriority && styles.toggleActive]}>
              <View style={[styles.toggleThumb, isTopPriority && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>

          {/* ── Submit Button ── */}
          <TouchableOpacity
            style={[styles.submitBtn, Shadows.md, (!title.trim() || loading) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!title.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                <Text style={styles.submitBtnText}>Create & Schedule Task</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.navy,
  },
  headerIconBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFF', fontWeight: '700', fontSize: 14,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // ── Form fields ─────────────────────────────────────────────────────────────
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
  },
  textArea: {
    height: 88,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  rowHalf: {
    flex: 1,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
  },

  // ── Priority pills ──────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Category grid ────────────────────────────────────────────────────────────
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '30%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryCardActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.navyLight,
  },
  categoryTextActive: {
    color: '#FFF',
  },

  // ── Top Priority toggle ──────────────────────────────────────────────────────
  topPriorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topPriorityRowActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  topPriorityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topPriorityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
  },
  topPrioritySub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.warning,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },

  // ── Submit button ────────────────────────────────────────────────────────────
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  pickerSelectorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
  },
});
