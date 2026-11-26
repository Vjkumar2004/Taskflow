import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { format, addDays, subDays } from 'date-fns';
import { taskService, RoutineActivity, DailySection, parseSectionTimeRange } from '../../src/services/taskService';
import { MobileTask } from '../../src/types';
import { Colors, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PendingNotificationBell } from '../../src/components/PendingNotificationBell';
import { useAuth } from '../../src/context/AuthContext';
import { pushNotificationService } from '../../src/services/pushNotificationService';

// ─── Task Action Modal ────────────────────────────────────────────────────────

interface TaskActionModalProps {
  task: MobileTask | null;
  routineItem: { id: string; text: string; branch: string; sectionTitle: string } | null;
  isRoutineItemDone: boolean;
  onClose: () => void;
  onToggle: (id: string, currentStatus: string) => void;
  onToggleRoutine: (itemId: string) => void;
  onSnooze: (task: MobileTask) => void;
  onSkip: (task: MobileTask) => void;
  onRescheduleToTomorrow: (task: MobileTask) => void;
  onAddNote: (task: MobileTask, note: string) => void;
  onDelete: (task: MobileTask) => void;
}

function TaskActionModal({
  task,
  routineItem,
  isRoutineItemDone,
  onClose,
  onToggle,
  onToggleRoutine,
  onSnooze,
  onSkip,
  onRescheduleToTomorrow,
  onAddNote,
  onDelete,
}: TaskActionModalProps) {
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visible = !!(task || routineItem);

  const resetAndClose = () => {
    setNoteMode(false);
    setNoteText('');
    setConfirmDelete(false);
    onClose();
  };

  if (!visible) return null;

  // ── Routine checklist item modal ──────────────────────────────────────────
  if (routineItem) {
    const isDone = isRoutineItemDone;
    return (
      <Modal visible transparent animationType="slide" onRequestClose={resetAndClose}>
        <Pressable style={styles.modalOverlay} onPress={resetAndClose}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            {/* Title */}
            <View style={styles.modalTitleRow}>
              <View style={[styles.modalIconBox, { backgroundColor: isDone ? Colors.successLight : '#F3EFEA' }]}>
                <Ionicons name={isDone ? 'checkbox' : 'square-outline'} size={22} color={isDone ? Colors.success : Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTaskTitle, isDone && styles.modalTaskTitleDone]}>{routineItem.text}</Text>
                <Text style={styles.modalTaskMeta}>{routineItem.sectionTitle} • {routineItem.branch}</Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            {/* Toggle */}
            <TouchableOpacity
              style={[styles.modalAction, { backgroundColor: isDone ? '#FEF2F2' : Colors.successLight }]}
              onPress={() => { onToggleRoutine(routineItem.id); resetAndClose(); }}
            >
              <Ionicons name={isDone ? 'close-circle-outline' : 'checkmark-circle-outline'} size={20} color={isDone ? Colors.danger : Colors.success} />
              <Text style={[styles.modalActionText, { color: isDone ? Colors.danger : Colors.success }]}>
                {isDone ? 'Mark as Incomplete' : 'Mark as Complete'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={resetAndClose}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  if (!task) return null;

  const isCompleted = task.status === 'completed';
  const isSkipped = task.status === 'skipped';
  const isCustom = !task.isFixedRoutine;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.modalOverlay} onPress={noteMode ? undefined : resetAndClose}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            {/* Task Title row */}
            <View style={styles.modalTitleRow}>
              <View style={[
                styles.modalIconBox,
                { backgroundColor: isCompleted ? Colors.successLight : isSkipped ? '#F1F5F9' : Colors.primaryLight }
              ]}>
                <Ionicons
                  name={isCompleted ? 'checkmark-circle' : isSkipped ? 'play-skip-forward' : 'ellipse-outline'}
                  size={22}
                  color={isCompleted ? Colors.success : isSkipped ? Colors.textMuted : Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTaskTitle, (isCompleted || isSkipped) && styles.modalTaskTitleDone]}>
                  {task.title}
                </Text>
                <Text style={styles.modalTaskMeta}>
                  {task.dueTime ? `⏰ ${task.dueTime}` : 'No time set'}
                  {task.category ? `  •  ${task.category}` : ''}
                </Text>
                {task.notes ? (
                  <Text style={styles.modalNotePreview} numberOfLines={2}>📝 {task.notes}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.modalDivider} />

            {noteMode ? (
              /* Note input inline */
              <View style={styles.noteInputBox}>
                <Text style={styles.noteInputLabel}>Add Executive Note</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Type decision, context or follow-up..."
                  placeholderTextColor={Colors.textLight}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  autoFocus
                />
                <View style={styles.noteInputActions}>
                  <TouchableOpacity
                    style={styles.noteSaveBtn}
                    onPress={() => {
                      if (noteText.trim()) {
                        onAddNote(task, noteText.trim());
                        setNoteMode(false);
                        setNoteText('');
                        resetAndClose();
                      }
                    }}
                  >
                    <Text style={styles.noteSaveBtnText}>Save Note</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.noteCancelBtn} onPress={() => { setNoteMode(false); setNoteText(''); }}>
                    <Text style={styles.noteCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : confirmDelete ? (
              /* Delete confirmation */
              <View style={styles.deleteConfirmBox}>
                <Ionicons name="warning-outline" size={28} color={Colors.danger} />
                <Text style={styles.deleteConfirmTitle}>Delete this task?</Text>
                <Text style={styles.deleteConfirmSub}>"{task.title}" will be permanently removed.</Text>
                <View style={styles.deleteConfirmActions}>
                  <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setConfirmDelete(false)}>
                    <Text style={styles.deleteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteConfirmBtn}
                    onPress={() => { onDelete(task); resetAndClose(); }}
                  >
                    <Text style={styles.deleteConfirmBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Main actions */
              <View style={styles.actionsGrid}>
                {/* Complete / Undo */}
                <TouchableOpacity
                  style={[styles.actionTile, { backgroundColor: isCompleted ? '#FEF2F2' : Colors.successLight }]}
                  onPress={() => { onToggle(task.id, task.status); resetAndClose(); }}
                >
                  <Ionicons
                    name={isCompleted ? 'close-circle-outline' : 'checkmark-circle-outline'}
                    size={24}
                    color={isCompleted ? Colors.danger : Colors.success}
                  />
                  <Text style={[styles.actionTileText, { color: isCompleted ? Colors.danger : Colors.success }]}>
                    {isCompleted ? 'Undo Complete' : 'Mark Done'}
                  </Text>
                </TouchableOpacity>

                {/* Snooze 1 hour — only for custom tasks not completed */}
                {isCustom && !isCompleted && !isSkipped && (
                  <TouchableOpacity
                    style={[styles.actionTile, { backgroundColor: Colors.warningLight }]}
                    onPress={() => { onSnooze(task); resetAndClose(); }}
                  >
                    <Ionicons name="moon-outline" size={24} color={Colors.warning} />
                    <Text style={[styles.actionTileText, { color: '#92400E' }]}>Snooze 1h</Text>
                  </TouchableOpacity>
                )}

                {/* Skip — only if not completed */}
                {!isCompleted && !isSkipped && (
                  <TouchableOpacity
                    style={[styles.actionTile, { backgroundColor: '#F8FAFC' }]}
                    onPress={() => { onSkip(task); resetAndClose(); }}
                  >
                    <Ionicons name="play-skip-forward-outline" size={24} color={Colors.textMuted} />
                    <Text style={[styles.actionTileText, { color: Colors.textMuted }]}>Skip Today</Text>
                  </TouchableOpacity>
                )}

                {/* Reschedule to tomorrow — only for custom tasks */}
                {isCustom && !isCompleted && (
                  <TouchableOpacity
                    style={[styles.actionTile, { backgroundColor: Colors.infoLight }]}
                    onPress={() => { onRescheduleToTomorrow(task); resetAndClose(); }}
                  >
                    <Ionicons name="calendar-outline" size={24} color={Colors.info} />
                    <Text style={[styles.actionTileText, { color: '#1E40AF' }]}>To Tomorrow</Text>
                  </TouchableOpacity>
                )}

                {/* Add Note */}
                {isCustom && (
                  <TouchableOpacity
                    style={[styles.actionTile, { backgroundColor: Colors.primaryLight }]}
                    onPress={() => setNoteMode(true)}
                  >
                    <Ionicons name="document-text-outline" size={24} color={Colors.primary} />
                    <Text style={[styles.actionTileText, { color: Colors.primaryHover }]}>Add Note</Text>
                  </TouchableOpacity>
                )}

                {/* Delete — only for custom tasks */}
                {isCustom && (
                  <TouchableOpacity
                    style={[styles.actionTile, { backgroundColor: '#FEF2F2' }]}
                    onPress={() => setConfirmDelete(true)}
                  >
                    <Ionicons name="trash-outline" size={24} color={Colors.danger} />
                    <Text style={[styles.actionTileText, { color: Colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!noteMode && !confirmDelete && (
              <TouchableOpacity style={styles.modalCancelBtn} onPress={resetAndClose}>
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Routine Modal ────────────────────────────────────────────────────────

// Fixed time slots for daily routines
const TIME_SLOTS: { label: string; value: string }[] = [
  { label: '6:00 – 7:00 AM',   value: '06:00' },
  { label: '7:00 – 8:00 AM',   value: '07:00' },
  { label: '8:00 – 9:00 AM',   value: '08:00' },
  { label: '9:00 – 10:00 AM',  value: '09:00' },
  { label: '10:00 – 11:00 AM', value: '10:00' },
  { label: '11:00 – 12:00 PM', value: '11:00' },
  { label: '12:00 – 1:00 PM',  value: '12:00' },
  { label: '2:00 – 3:00 PM',   value: '14:00' },
  { label: '4:00 – 5:00 PM',   value: '16:00' },
  { label: '6:00 – 7:00 PM',   value: '18:00' },
  { label: '8:00 – 9:00 PM',   value: '20:00' },
  { label: '9:00 – 10:00 PM',  value: '21:00' },
];

interface AddRoutineModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, time: string, days: string) => void;
}

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function AddRoutineModal({ visible, onClose, onSave }: AddRoutineModalProps) {
  const [title, setTitle] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([...ALL_DAYS]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setSelectedTime('09:00');
    setSelectedDays([...ALL_DAYS]);
    setSaving(false);
  };

  useEffect(() => {
    if (visible) {
      reset();
    }
  }, [visible]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!title.trim() || selectedDays.length === 0) return;
    setSaving(true);
    // Sort days in week order, empty string = every day
    const orderedDays = ALL_DAYS.filter((d) => selectedDays.includes(d));
    const daysStr = orderedDays.length === 7 ? '' : orderedDays.join(',');
    await onSave(title.trim(), selectedTime, daysStr);
    reset();
    onClose();
  };

  const selectedSlot = TIME_SLOTS.find(s => s.value === selectedTime) || TIME_SLOTS[0];

  const canSave = title.trim().length > 0 && selectedDays.length > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={[styles.modalSheet, { maxHeight: '92%' }]} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <View style={[styles.modalIconBox, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="repeat-outline" size={22} color={Colors.primary} />
              </View>
              <View>
                <Text style={[styles.modalTaskTitle, { fontSize: 17 }]}>Add Routine</Text>
                <Text style={styles.modalTaskMeta}>Choose days &amp; time slot</Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            {/* Title input */}
            <Text style={styles.noteInputLabel}>Routine Title</Text>
            <TextInput
              style={[styles.noteInput, { minHeight: 50, marginBottom: 16 }]}
              placeholder="e.g. Morning Workout, Daily Planning, Reading..."
              placeholderTextColor={Colors.textLight}
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="done"
            />

            {/* Day picker */}
            <Text style={[styles.noteInputLabel, { marginBottom: 8 }]}>Repeat on Days</Text>
            <View style={styles.dayPickerRow}>
              {ALL_DAYS.map((day) => {
                const active = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayPill, active && styles.dayPillActive]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedDays.length === 0 && (
              <Text style={{ fontSize: 11, color: Colors.danger, marginBottom: 8 }}>Select at least one day</Text>
            )}

            {/* Time slot picker */}
            <Text style={[styles.noteInputLabel, { marginBottom: 8, marginTop: 14 }]}>Select Time Slot</Text>
            <Text style={styles.selectedTimeDisplay}>
              <Ionicons name="time-outline" size={14} color={Colors.primary} />
              {'  '}{selectedSlot.label}
            </Text>
            <ScrollView
              style={styles.timeSlotList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {TIME_SLOTS.map((slot) => {
                const active = slot.value === selectedTime;
                return (
                  <TouchableOpacity
                    key={slot.value}
                    style={[styles.timeSlotOption, active && styles.timeSlotOptionActive]}
                    onPress={() => setSelectedTime(slot.value)}
                  >
                    <Text style={[styles.timeSlotOptionText, active && styles.timeSlotOptionTextActive]}>
                      {slot.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.addRoutineSaveBtn, !canSave && { opacity: 0.45 }]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Ionicons name="repeat-outline" size={19} color="#FFF" />
              <Text style={styles.addRoutineSaveBtnText}>{saving ? 'Saving...' : 'Add Routine'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Focus Item Modal ─────────────────────────────────────────────────────

interface AddFocusItemModalProps {
  visible: boolean;
  dayLabel: string;
  onClose: () => void;
  onSave: (title: string) => void;
}

function AddFocusItemModal({ visible, dayLabel, onClose, onSave }: AddFocusItemModalProps) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setSaving(false); };

  useEffect(() => {
    if (visible) {
      reset();
    }
  }, [visible]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave(title.trim());
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <View style={[styles.modalIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="calendar-outline" size={22} color="#2563EB" />
              </View>
              <View>
                <Text style={[styles.modalTaskTitle, { fontSize: 17 }]}>Add to {dayLabel}'s Schedule</Text>
                <Text style={styles.modalTaskMeta}>Repeats every {dayLabel} in Focus tab</Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            <Text style={styles.noteInputLabel}>Activity Title</Text>
            <TextInput
              style={[styles.noteInput, { minHeight: 50, marginBottom: 20 }]}
              placeholder="e.g. Client meeting, Staff review..."
              placeholderTextColor={Colors.textLight}
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <TouchableOpacity
              style={[styles.addRoutineSaveBtn, { backgroundColor: '#2563EB' }, (!title.trim() || saving) && { opacity: 0.45 }]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
            >
              <Ionicons name="calendar-outline" size={19} color="#FFF" />
              <Text style={styles.addRoutineSaveBtnText}>{saving ? 'Saving...' : 'Add to Schedule'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DailyChecklistScreen() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [routineActivities, setRoutineActivities] = useState<RoutineActivity[]>([]);
  const [dailySections, setDailySections] = useState<DailySection[]>([]);
  const [customTasks, setCustomTasks] = useState<MobileTask[]>([]);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'checklist' | 'schedule' | 'custom'>('custom');

  const [pendingCount, setPendingCount] = useState<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Modal state
  const [selectedTask, setSelectedTask] = useState<MobileTask | null>(null);
  const [selectedRoutineItem, setSelectedRoutineItem] = useState<{
    id: string; text: string; branch: string; sectionTitle: string;
  } | null>(null);
  const [addRoutineOpen, setAddRoutineOpen] = useState(false);
  const [addFocusItemOpen, setAddFocusItemOpen] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isTodayDate = dateStr === todayStr;
  const isPastDate = dateStr < todayStr;

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

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await taskService.getTasksForDate(dateStr);
    setRoutineActivities(data.routineActivities);
    setDailySections(data.dailySections);
    setCustomTasks(data.customTasks);

    const initialMap: Record<string, boolean> = {};
    data.completedIds.forEach((id) => { initialMap[id] = true; });
    setCompletedItems(initialMap);
    setLoading(false);

    taskService.getPendingTasks().then((pList) => setPendingCount(pList.length));
  }, [dateStr]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggleRoutineItem = async (itemId: string) => {
    const isCompleted = !completedItems[itemId];
    setCompletedItems((prev) => ({ ...prev, [itemId]: isCompleted }));
    await taskService.toggleTask(itemId, isCompleted ? 'todo' : 'completed', dateStr);
  };

  const handleToggleScheduleItem = async (activityId: string, itemIndex: number) => {
    const logicalId = `schedule_${activityId}_item_${itemIndex}`;
    const isCompleted = !completedItems[logicalId];
    setCompletedItems((prev) => ({ ...prev, [logicalId]: isCompleted }));
    await taskService.toggleScheduleItem(activityId, itemIndex, dateStr);
  };

  const handleToggleCustomTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'todo' : 'completed';
    setCustomTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: nextStatus as any } : t));
    await taskService.toggleTask(taskId, currentStatus as any);
  };

  const handleSnooze = async (task: MobileTask) => {
    const currentHour = new Date().getHours();
    const currentTime = task.dueTime || `${String(currentHour).padStart(2, '0')}:00`;
    await taskService.snoozeTask(task.id, currentTime);
    await loadData();
  };

  const handleSkip = async (task: MobileTask) => {
    setCustomTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'skipped' } : t));
    await taskService.skipTask(task.id);
  };

  const handleRescheduleToTomorrow = async (task: MobileTask) => {
    setCustomTasks((prev) => prev.filter((t) => t.id !== task.id));
    await taskService.rescheduleToTomorrow(task.id);
  };

  const handleAddNote = async (task: MobileTask, note: string) => {
    await taskService.addNote(task.id, note);
    setCustomTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, notes: note } : t));
  };

  const handleDelete = async (task: MobileTask) => {
    setCustomTasks((prev) => prev.filter((t) => t.id !== task.id));
    await taskService.deleteCustomTask(task.id);
  };

  const handleAddRoutine = async (title: string, time: string, days: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const created = await taskService.createCustomRoutine({ title, time, startDate: today, days });
    if (time) {
      pushNotificationService.scheduleTaskAlarmAhead({
        id: (created as any)?.id || `routine-${Date.now()}`,
        title: title,
        dueDate: today,
        dueTime: time,
        isUrgent: false,
      }).catch(() => {});
    }
    await loadData();
  };

  const handleAddFocusItem = async (title: string) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[currentDate.getDay()];
    await taskService.createCustomFocusItem(title, dayName);
    await loadData();
  };

  const handleDeleteFocusItem = async (dbId: string) => {
    await taskService.deleteCustomFocusItem(dbId);
    await loadData();
  };

  const handleDeleteCustomRoutine = async (routineId: string) => {
    await taskService.deleteCustomRoutine(routineId);
    await loadData();
  };

  // Calculate totals
  let totalItemsCount = 0;
  dailySections.forEach((s) => { totalItemsCount += s.items.length; });
  totalItemsCount += customTasks.length;
  const completedCount = Object.values(completedItems).filter(Boolean).length +
    customTasks.filter((t) => t.status === 'completed').length;
  const completionPercent = totalItemsCount > 0 ? Math.min(100, Math.round((completedCount / totalItemsCount) * 100)) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Header — title + date nav + icons in one compact row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Daily Checklist</Text>
            <Text style={styles.headerSub}>{format(currentDate, 'EEE, MMM d')}</Text>
          </View>
          <View style={styles.headerDateNav}>
            <TouchableOpacity onPress={() => setCurrentDate((d) => subDays(d, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={16} color={Colors.navy} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.todayChip} onPress={() => setCurrentDate(new Date())}>
              <Text style={styles.todayChipText}>
                {format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'Today' : 'Go today'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentDate((d) => addDays(d, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={16} color={Colors.navy} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerRightIcons}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/ai-chat')}>
              <Ionicons name="sparkles" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <PendingNotificationBell />
            <TouchableOpacity
              style={styles.profileAvatarBtn}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.profileAvatarText}>
                {(user?.user_metadata?.full_name || user?.email || 'U').substring(0, 1).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Slim stats bar — progress + count + pending chip */}
        <View style={styles.statsBar}>
          <Text style={styles.statsBarPct}>{completionPercent}%</Text>
          <View style={styles.statsBarTrack}>
            <View style={[styles.statsBarFill, { width: `${Math.max(3, completionPercent)}%` as any }]} />
          </View>
          <Text style={styles.statsBarCount}>{completedCount}/{totalItemsCount} done</Text>
          {pendingCount > 0 && (
            <TouchableOpacity style={styles.pendingChip} onPress={() => router.push('/(tabs)/pending')}>
              <Animated.View style={[styles.pendingChipDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.pendingChipText}>{pendingCount} pending</Text>
              <Ionicons name="chevron-forward" size={10} color="#991B1B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs + Add Routine inline button */}
        <View style={styles.tabRow}>
          {[
            { key: 'custom', label: `My Tasks (${customTasks.length})` },
            { key: 'checklist', label: `Routines (${dailySections.reduce((acc, s) => acc + s.items.length, 0)})` },
            { key: 'schedule', label: `Focus (${routineActivities.length})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addRoutineTabBtn}
            onPress={() => {
              if (activeTab === 'checklist') setAddRoutineOpen(true);
              else if (activeTab === 'schedule') setAddFocusItemOpen(true);
              else router.push('/new-task');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        >
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : activeTab === 'checklist' ? (
            dailySections.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="sparkles-outline" size={38} color={Colors.primary} />
                <Text style={styles.emptyTitle}>No Daily Routines Set</Text>
                <Text style={styles.emptySub}>Set up recurring daily habits with reminders. Tap below to create your first routine.</Text>
                <TouchableOpacity
                  style={[styles.modalAction, { backgroundColor: Colors.primaryLight, marginTop: 14, justifyContent: 'center' }]}
                  onPress={() => setAddRoutineOpen(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  <Text style={[styles.modalActionText, { color: Colors.primary }]}>Add Daily Routine</Text>
                </TouchableOpacity>
              </View>
            ) : (
            <>
              {dailySections.map((sec) => {
                const timeInfo = parseSectionTimeRange(sec.timeRange);
                const totalItems = sec.items.length;
                const doneCount = sec.items.filter((item) => {
                  const itemId = item.routineId
                    ? `custom_routine_${item.routineId}`
                    : `${sec.id}_item_${item.itemNumber}`;
                  return !!completedItems[itemId];
                }).length;
                const isAllDone = totalItems > 0 && doneCount === totalItems;
                const unfinishedCount = totalItems - doneCount;

                // Overdue: container time has ended and items remain incomplete
                const isContainerOverdue =
                  ((isTodayDate && timeInfo && nowMin > timeInfo.endMin) || isPastDate) &&
                  !isAllDone &&
                  totalItems > 0;

                // Active: within current slot bracket and incomplete
                const isContainerActive =
                  isTodayDate &&
                  timeInfo &&
                  nowMin >= timeInfo.startMin &&
                  nowMin <= timeInfo.endMin &&
                  !isAllDone;

                return (
                  <View
                    key={sec.id}
                    style={[
                      styles.sectionCard,
                      Shadows.sm,
                      sec.isCustom && { borderColor: Colors.primary, borderWidth: 1.5 },
                      isContainerActive && styles.sectionCardActive,
                      isContainerOverdue && styles.sectionCardOverdue,
                      isAllDone && styles.sectionCardAllDone,
                    ]}
                  >
                    {/* Visual left indicator strips */}
                    {isContainerOverdue && <View style={styles.overdueLeftStrip} />}
                    {isContainerActive && <View style={styles.activeLeftStrip} />}
                    {isAllDone && <View style={styles.completedLeftStrip} />}

                    <View style={styles.sectionHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.sectionTitle, isContainerOverdue && styles.sectionTitleOverdue]}>
                          {sec.sectionTitle}
                        </Text>
                        {isContainerOverdue && (
                          <View style={styles.overdueAlertRow}>
                            <Ionicons name="alert-circle" size={13} color="#DC2626" />
                            <Text style={styles.overdueAlertText}>Time ended • {unfinishedCount} pending checklist items</Text>
                          </View>
                        )}
                        {isContainerActive && (
                          <View style={styles.activeAlertRow}>
                            <Ionicons name="time" size={13} color="#D97706" />
                            <Text style={styles.activeAlertText}>Active slot • In progress ({unfinishedCount} remaining)</Text>
                          </View>
                        )}
                      </View>

                      <View
                        style={[
                          styles.timeBadge,
                          sec.isCustom && { backgroundColor: Colors.primaryLight },
                          isContainerActive && styles.timeBadgeActive,
                          isContainerOverdue && styles.timeBadgeOverdue,
                          isAllDone && styles.timeBadgeAllDone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeBadgeText,
                            sec.isCustom && { color: Colors.primary },
                            isContainerActive && styles.timeBadgeTextActive,
                            isContainerOverdue && styles.timeBadgeTextOverdue,
                            isAllDone && styles.timeBadgeTextAllDone,
                          ]}
                        >
                          {isContainerOverdue ? `⚠️ ${sec.timeRange} • PENDING` : isAllDone ? `✓ ${sec.timeRange}` : sec.timeRange}
                        </Text>
                      </View>
                    </View>
                    {sec.items.map((item) => {
                      const itemId = item.routineId
                        ? `custom_routine_${item.routineId}` // custom routine item key
                        : `${sec.id}_item_${item.itemNumber}`;
                      const isDone = !!completedItems[itemId];
                      return (
                        <TouchableOpacity
                          key={itemId}
                          style={[styles.checkItemRow, isDone && styles.itemRowDone]}
                          onPress={() => handleToggleRoutineItem(itemId)}
                          onLongPress={() => setSelectedRoutineItem({
                            id: itemId,
                            text: item.text,
                            branch: item.branch,
                            sectionTitle: sec.sectionTitle,
                          })}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isDone ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isDone ? '#10B981' : Colors.danger}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemText, isDone && styles.itemTextDone]}>{item.text}</Text>
                            <View style={styles.itemMeta}>
                              <Text style={[styles.branchTag, item.routineId && { color: Colors.primary, backgroundColor: Colors.primaryLight }]}>{item.branch}</Text>
                              {item.actionNeeded ? <Text style={styles.actionText}>{item.actionNeeded}</Text> : null}
                            </View>
                          </View>
                          {/* Delete button only for custom routines */}
                          {item.routineId ? (
                            <TouchableOpacity
                              style={styles.customRoutineDelete}
                              onPress={() => handleDeleteCustomRoutine(item.routineId!)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                            </TouchableOpacity>
                          ) : (
                            <Ionicons name="ellipsis-vertical" size={14} color={Colors.textLight} style={{ marginLeft: 6 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}

            </>
            )
          ) : activeTab === 'schedule' ? (
            routineActivities.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="calendar-outline" size={38} color={Colors.primary} />
                <Text style={styles.emptyTitle}>No schedule for today</Text>
                <Text style={styles.emptySub}>Tap + to add an activity to today's schedule.</Text>
              </View>
            ) : (
              <>
                {routineActivities.map((act) => {
                  const isCustomAct = !!(act as any).isCustom;
                  const doneCount = act.items.filter((_: string, idx: number) =>
                    completedItems[`schedule_${act.id}_item_${idx}`]
                  ).length;
                  const allDone = doneCount === act.items.length && act.items.length > 0;
                  return (
                    <View
                      key={act.id}
                      style={[
                        styles.sectionCard, Shadows.sm,
                        isCustomAct && { borderColor: '#2563EB', borderWidth: 1.5 },
                      ]}
                    >
                      {/* Section header — matches daily checklist style */}
                      <View style={styles.sectionHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sectionTitle}>{act.title}</Text>
                          <Text style={[styles.branchTag, isCustomAct && { color: '#2563EB', backgroundColor: '#EFF6FF' }]}>
                            {act.branch}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[styles.timeBadge, isCustomAct && { backgroundColor: '#EFF6FF' }]}>
                            <Text style={[styles.timeBadgeText, isCustomAct && { color: '#2563EB' }]}>
                              {isCustomAct ? 'Custom' : act.timeSlot}
                            </Text>
                          </View>
                          <Text style={styles.focusProgress}>
                            {allDone ? '✓ Done' : `${doneCount}/${act.items.length}`}
                          </Text>
                        </View>
                        {isCustomAct && (
                          <TouchableOpacity
                            onPress={() => handleDeleteFocusItem((act as any)._dbId)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ marginLeft: 8 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Checklist items — identical layout to daily checklist */}
                      {act.items.map((it: string, idx: number) => {
                        const itemKey = `schedule_${act.id}_item_${idx}`;
                        const isDone = !!completedItems[itemKey];
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.checkItemRow, isDone && styles.itemRowDone, idx === act.items.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => handleToggleScheduleItem(act.id, idx)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={isDone ? 'checkmark-circle' : 'square-outline'}
                              size={22}
                              color={isDone ? '#10B981' : Colors.danger}
                              style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.itemText, isDone && styles.itemTextDone]}>{it}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </>
            )
          ) : (
            customTasks.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="document-text-outline" size={38} color={Colors.primary} />
                <Text style={styles.emptyTitle}>No custom tasks for this date</Text>
                <Text style={styles.emptySub}>Tap the + button to add personal tasks or client visits.</Text>
              </View>
            ) : (
              customTasks.map((task) => {
                const isDone = task.status === 'completed';
                const isSkipped = task.status === 'skipped';
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.customTaskCard, Shadows.sm, (isDone || isSkipped) && styles.itemRowDone]}
                    onPress={() => setSelectedTask(task)}
                    activeOpacity={0.75}
                  >
                    <TouchableOpacity
                      style={styles.customCheckboxHit}
                      onPress={() => handleToggleCustomTask(task.id, task.status)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isDone ? 'checkbox' : isSkipped ? 'play-skip-forward' : 'square-outline'}
                        size={24}
                        color={isDone ? '#10B981' : isSkipped ? Colors.textMuted : Colors.danger}
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, (isDone || isSkipped) && styles.itemTextDone]}>{task.title}</Text>
                      {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                      {task.notes ? (
                        <Text style={styles.taskNotePreview} numberOfLines={1}>📝 {task.notes}</Text>
                      ) : null}
                      <View style={styles.badgeRow}>
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{task.category}</Text>
                        </View>
                        {task.dueTime ? (
                          <View style={styles.timeTag}>
                            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                            <Text style={styles.timeTagText}>{task.dueTime}</Text>
                          </View>
                        ) : null}
                        {task.isTopPriority ? (
                          <View style={[styles.catBadge, { backgroundColor: '#FEF3C7' }]}>
                            <Text style={[styles.catBadgeText, { color: '#92400E' }]}>★ Top Priority</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {/* Action hint arrow */}
                    <Ionicons name="chevron-forward" size={16} color={Colors.textLight} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              })
            )
          )}
        </ScrollView>

        {/* Dedicated FAB for Daily Checklist Screen */}
        <TouchableOpacity
          style={[styles.fab, Shadows.lg]}
          onPress={() => {
            if (activeTab === 'checklist') setAddRoutineOpen(true);
            else if (activeTab === 'schedule') setAddFocusItemOpen(true);
            else router.push('/new-task');
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>
            {activeTab === 'checklist' ? 'Add Routine' : activeTab === 'schedule' ? 'Add to Focus' : 'New Task'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task Action Modal */}
      <TaskActionModal
        task={selectedTask}
        routineItem={selectedRoutineItem}
        isRoutineItemDone={selectedRoutineItem ? !!completedItems[selectedRoutineItem.id] : false}
        onClose={() => { setSelectedTask(null); setSelectedRoutineItem(null); }}
        onToggle={handleToggleCustomTask}
        onToggleRoutine={handleToggleRoutineItem}
        onSnooze={handleSnooze}
        onSkip={handleSkip}
        onRescheduleToTomorrow={handleRescheduleToTomorrow}
        onAddNote={handleAddNote}
        onDelete={handleDelete}
      />

      {/* Add Routine Modal */}
      <AddRoutineModal
        visible={addRoutineOpen}
        onClose={() => setAddRoutineOpen(false)}
        onSave={handleAddRoutine}
      />

      {/* Add Focus Item Modal */}
      <AddFocusItemModal
        visible={addFocusItemOpen}
        dayLabel={format(currentDate, 'EEEE')}
        onClose={() => setAddFocusItemOpen(false)}
        onSave={handleAddFocusItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', marginTop: 1 },
  headerDateNav: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  todayChip: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  todayChipText: { fontSize: 11, fontWeight: '700', color: Colors.navy },
  // slim stats bar
  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8, gap: 7,
  },
  statsBarPct: { fontSize: 12, fontWeight: '800', color: Colors.primary, minWidth: 34 },
  statsBarTrack: {
    flex: 1, height: 5, backgroundColor: '#F0EDE8',
    borderRadius: 3, overflow: 'hidden',
  },
  statsBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  statsBarCount: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  pendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  pendingChipDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger,
  },
  pendingChipText: { fontSize: 10, fontWeight: '800', color: '#991B1B' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  tabBtnTextActive: { color: '#FFFFFF' },
  scrollList: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  sectionCardOverdue: {
    borderColor: '#EF4444',
    borderWidth: 1.8,
    backgroundColor: '#FEF2F2',
  },
  sectionCardActive: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    backgroundColor: '#FFFDF5',
  },
  sectionCardAllDone: {
    borderColor: '#10B981',
    borderWidth: 1.2,
    backgroundColor: '#F0FDF4',
  },
  overdueLeftStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#EF4444',
  },
  activeLeftStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#F59E0B',
  },
  completedLeftStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#10B981',
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.navy, flex: 1 },
  sectionTitleOverdue: { color: '#991B1B' },
  overdueAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  overdueAlertText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  activeAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  activeAlertText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  timeBadge: { backgroundColor: '#F3EFEA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  timeBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.navyLight },
  timeBadgeOverdue: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  timeBadgeTextOverdue: {
    color: '#DC2626',
    fontWeight: '800',
  },
  timeBadgeActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
  },
  timeBadgeTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  timeBadgeAllDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  timeBadgeTextAllDone: {
    color: '#15803D',
    fontWeight: '800',
  },
  checkItemRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F5F2EB',
  },
  itemRowDone: { opacity: 0.5 },
  itemText: { fontSize: 14, color: Colors.navy, fontWeight: '500', lineHeight: 20 },
  itemTextDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  branchTag: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    backgroundColor: '#FFF5EE', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  actionText: { fontSize: 11, color: Colors.textMuted },
  focusProgress: { fontSize: 10, fontWeight: '700', color: Colors.success },
  scheduleCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletText: { fontSize: 13, color: Colors.textMuted, flex: 1, lineHeight: 18 },
  customTaskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  customCheckboxHit: { marginRight: 12, padding: 2 },
  taskTitle: { fontSize: 14, fontWeight: '700', color: Colors.navy },
  taskDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  taskNotePreview: { fontSize: 11, color: Colors.primary, marginTop: 3 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' },
  catBadge: { backgroundColor: '#F3EFEA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.navyLight, textTransform: 'capitalize' },
  timeTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeTagText: { fontSize: 11, color: Colors.textMuted },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.navy, marginTop: 8 },
  emptySub: { fontSize: 12, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 28,
  },
  fabText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  headerRightIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  profileAvatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navy,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  profileAvatarText: {
    fontSize: 13, fontWeight: '800', color: '#FFFFFF',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 7,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.danger, borderWidth: 1, borderColor: '#FFFFFF',
  },

  // ── Modal styles ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    minHeight: 200,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 18,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  modalIconBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  modalTaskTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy, lineHeight: 22 },
  modalTaskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  modalTaskMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  modalNotePreview: { fontSize: 11, color: Colors.primary, marginTop: 4 },
  modalDivider: { height: 1, backgroundColor: Colors.borderLight, marginBottom: 16 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTile: {
    width: '47%', borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 8,
  },
  actionTileText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  modalCancelBtn: {
    marginTop: 14, paddingVertical: 13,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  modalAction: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, marginBottom: 10,
  },
  modalActionText: { fontSize: 15, fontWeight: '700' },

  // Note input
  noteInputBox: { gap: 10 },
  noteInputLabel: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  noteInput: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, padding: 12,
    fontSize: 14, color: Colors.navy,
    minHeight: 80, textAlignVertical: 'top',
    backgroundColor: '#FAF9F6',
  },
  noteInputActions: { flexDirection: 'row', gap: 10 },
  noteSaveBtn: {
    flex: 1, backgroundColor: Colors.primary,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  noteSaveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  addRoutineSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, marginTop: 14,
  },
  addRoutineSaveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  dayPickerRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  dayPill: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  dayPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dayPillText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  dayPillTextActive: { color: '#FFF' },
  noteCancelBtn: {
    paddingHorizontal: 20, borderRadius: 12, paddingVertical: 13,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  noteCancelBtnText: { color: Colors.textMuted, fontWeight: '700', fontSize: 14 },

  // Delete confirm
  deleteConfirmBox: {
    alignItems: 'center', gap: 8, paddingVertical: 8,
  },
  deleteConfirmTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  deleteConfirmSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  deleteConfirmActions: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  deleteCancelBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 13,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  deleteCancelText: { color: Colors.textMuted, fontWeight: '700', fontSize: 14 },
  deleteConfirmBtn: {
    flex: 1, backgroundColor: Colors.danger,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  deleteConfirmBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // Time slot picker (Add Routine modal)
  timeSlotBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, alignItems: 'center', gap: 5,
  },
  timeSlotText: { fontSize: 12, fontWeight: '700' },

  // Custom routine row delete icon
  customRoutineDelete: {
    paddingHorizontal: 6, paddingVertical: 4,
  },
  addRoutineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: 12, marginTop: 4,
  },
  addRoutineText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  addRoutineTabBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primaryHover,
  },

  selectedTimeDisplay: {
    fontSize: 14, fontWeight: '700', color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, marginBottom: 10,
  },
  timeSlotList: {
    maxHeight: 200,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, marginBottom: 4,
  },
  timeSlotOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight,
  },
  timeSlotOptionActive: {
    backgroundColor: Colors.primaryLight,
  },
  timeSlotOptionText: {
    fontSize: 14, color: Colors.navy, fontWeight: '500',
  },
  timeSlotOptionTextActive: {
    color: Colors.primary, fontWeight: '700',
  },
});
