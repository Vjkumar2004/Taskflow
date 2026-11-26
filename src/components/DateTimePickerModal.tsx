import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Colors, Shadows } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addDays,
  parseISO,
  isValid,
} from 'date-fns';

// ─── 1. DATE PICKER MODAL ───────────────────────────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
}

export function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
}: DatePickerModalProps) {
  const initialDate = selectedDate && isValid(parseISO(selectedDate)) ? parseISO(selectedDate) : new Date();
  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const startDayIndex = startOfMonth(currentMonth).getDay(); // 0 for Sunday
  const emptyDays = Array.from({ length: startDayIndex });

  const handleSelectDay = (day: Date) => {
    onSelectDate(format(day, 'yyyy-MM-dd'));
    onClose();
  };

  const handlePreset = (offsetDays: number) => {
    const target = addDays(new Date(), offsetDays);
    onSelectDate(format(target, 'yyyy-MM-dd'));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalCard, Shadows.lg]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalHeaderIconBadge}>
                <Ionicons name="calendar" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Select Due Date</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Quick Presets */}
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => handlePreset(0)}>
              <Text style={styles.presetChipText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handlePreset(1)}>
              <Text style={styles.presetChipText}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handlePreset(3)}>
              <Text style={styles.presetChipText}>In 3 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handlePreset(7)}>
              <Text style={styles.presetChipText}>Next Week</Text>
            </TouchableOpacity>
          </View>

          {/* Month / Year Navigator */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
              style={styles.navArrowBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.navy} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <TouchableOpacity
              onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
              style={styles.navArrowBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={20} color={Colors.navy} />
            </TouchableOpacity>
          </View>

          {/* Weekday Labels */}
          <View style={styles.weekdayRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
              <Text key={idx} style={styles.weekdayLabel}>{w}</Text>
            ))}
          </View>

          {/* Calendar Days Grid */}
          <View style={styles.calendarGrid}>
            {emptyDays.map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            {daysInMonth.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDate === dateStr;
              const isTodayDate = isToday(day);

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    !isSelected && isTodayDate && styles.dayCellToday,
                  ]}
                  onPress={() => handleSelectDay(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      !isSelected && isTodayDate && styles.dayTextToday,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── 2. TIME PICKER MODAL ───────────────────────────────────────────────────

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTime: string; // "HH:MM" 24h format, e.g. "10:00" or "14:30"
  onSelectTime: (timeStr: string) => void;
}

const QUICK_TIME_PRESETS = [
  { label: '09:00 AM', desc: 'Morning Routine', time: '09:00' },
  { label: '10:00 AM', desc: 'Admissions Review', time: '10:00' },
  { label: '11:30 AM', desc: 'Fee Check', time: '11:30' },
  { label: '02:00 PM', desc: 'Staff Operations', time: '14:00' },
  { label: '03:30 PM', desc: 'Marketing & Leads', time: '15:30' },
  { label: '05:00 PM', desc: 'Evening Follow-up', time: '17:00' },
  { label: '06:30 PM', desc: 'Day Wrap-Up', time: '18:30' },
];

export function TimePickerModal({
  visible,
  onClose,
  selectedTime,
  onSelectTime,
}: TimePickerModalProps) {
  // Parse initial 24h time to 12h + period
  const parseInitial = () => {
    let [hStr, mStr] = (selectedTime || '10:00').split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    if (isNaN(h)) h = 10;
    if (isNaN(m)) m = 0;
    const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { h: h12, m, period };
  };

  const initial = parseInitial();
  const [hour, setHour] = useState<number>(initial.h);
  const [minute, setMinute] = useState<number>(initial.m);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutesList = [0, 15, 30, 45, 10, 20, 40, 50];

  const handleConfirm = () => {
    let h24 = hour;
    if (period === 'PM' && hour < 12) h24 = hour + 12;
    if (period === 'AM' && hour === 12) h24 = 0;
    const time24Str = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onSelectTime(time24Str);
    onClose();
  };

  const handleSelectPreset = (time24: string) => {
    onSelectTime(time24);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalCard, Shadows.lg]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalHeaderIconBadge}>
                <Ionicons name="time" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Select Due Time</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Time Display Badge */}
          <View style={styles.timeDisplayBadge}>
            <Text style={styles.timeDisplayText}>
              {String(hour).padStart(2, '0')} : {String(minute).padStart(2, '0')}
            </Text>
            <View style={styles.periodToggleGroup}>
              <TouchableOpacity
                style={[styles.periodBtn, period === 'AM' && styles.periodBtnActive]}
                onPress={() => setPeriod('AM')}
              >
                <Text style={[styles.periodBtnText, period === 'AM' && styles.periodBtnTextActive]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodBtn, period === 'PM' && styles.periodBtnActive]}
                onPress={() => setPeriod('PM')}
              >
                <Text style={[styles.periodBtnText, period === 'PM' && styles.periodBtnTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 310 }} showsVerticalScrollIndicator={false}>
            {/* Quick Executive Presets */}
            <Text style={styles.pickerSectionTitle}>Quick Routine Presets</Text>
            <View style={styles.presetGrid}>
              {QUICK_TIME_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.time}
                  style={[styles.presetTimeChip, selectedTime === p.time && styles.presetTimeChipActive]}
                  onPress={() => handleSelectPreset(p.time)}
                >
                  <Text style={[styles.presetTimeChipText, selectedTime === p.time && styles.presetTimeChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Select Hour */}
            <Text style={styles.pickerSectionTitle}>Hour</Text>
            <View style={styles.pickerNumbersRow}>
              {hoursList.map((h) => {
                const active = hour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.numberPill, active && styles.numberPillActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.numberPillText, active && styles.numberPillTextActive]}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Select Minute */}
            <Text style={styles.pickerSectionTitle}>Minute</Text>
            <View style={styles.pickerNumbersRow}>
              {minutesList.map((m) => {
                const active = minute === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.numberPill, active && styles.numberPillActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.numberPillText, active && styles.numberPillTextActive]}>
                      :{String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Set Time</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF4EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.navy,
  },
  modalCloseBtn: {
    padding: 4,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  presetChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.navy,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.navy,
  },
  navArrowBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayLabel: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    backgroundColor: '#FFF4EE',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.navy,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // ─── Time Picker Styles ───
  timeDisplayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeDisplayText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.navy,
    letterSpacing: 1,
  },
  periodToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
  },
  periodBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: Colors.primary,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  pickerSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
    marginTop: 10,
    marginBottom: 8,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetTimeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetTimeChipActive: {
    backgroundColor: '#FFF4EE',
    borderColor: Colors.primary,
  },
  presetTimeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.navy,
  },
  presetTimeChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  pickerNumbersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  numberPill: {
    width: 44,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  numberPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
  },
  numberPillTextActive: {
    color: '#FFFFFF',
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
