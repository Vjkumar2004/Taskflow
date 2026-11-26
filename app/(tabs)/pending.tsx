import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { taskService } from '../../src/services/taskService';
import { MobileTask } from '../../src/types';
import { Colors, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PendingScreen() {
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Red Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const loadPending = async () => {
    setLoading(true);
    const data = await taskService.getPendingTasks();
    setTasks(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPending();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPending();
    setRefreshing(false);
  };

  // 1. Move to Today's Agenda
  const handleMoveToToday = async (task: MobileTask) => {
    setActionInProgressId(task.id);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await taskService.movePendingToToday(task);
    setActionInProgressId(null);
    Alert.alert('Moved to Today', `"${task.title}" has been moved to today's schedule.`);
  };

  // 2. Mark as Completed directly
  const handleMarkCompleted = async (task: MobileTask) => {
    setActionInProgressId(task.id);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await taskService.toggleTask(task.id, 'todo');
    setActionInProgressId(null);
    Alert.alert('Completed', `"${task.title}" marked as completed.`);
  };

  // 3. Forward All to Tomorrow
  const handleForwardAll = async () => {
    if (tasks.length === 0) return;
    Alert.alert('Forward All', `Forward all ${tasks.length} pending tasks to tomorrow's agenda?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forward All',
        onPress: async () => {
          setLoading(true);
          for (const t of tasks) {
            await taskService.movePendingToToday(t);
          }
          setTasks([]);
          setLoading(false);
          Alert.alert('Done', 'All pending tasks forwarded to tomorrow.');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.navy} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>Backlog & Overdue Records</Text>
            <Text style={styles.headerTitle}>Pending Tasks</Text>
          </View>

          {/* Quick AI Help button */}
          <TouchableOpacity
            style={styles.aiQuickBtn}
            onPress={() => router.push('/ai-chat')}
          >
            <Ionicons name="sparkles" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.danger]} />}
        >
          {loading ? (
            <ActivityIndicator size="large" color={Colors.danger} style={{ marginTop: 40 }} />
          ) : tasks.length === 0 ? (
            /* Emerald All Clear State */
            <View style={[styles.allClearCard, Shadows.sm]}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              </View>
              <Text style={styles.allClearTitle}>No Pending Tasks</Text>
              <Text style={styles.allClearSub}>
                All tasks are up to date! There are no incomplete tasks from today or previous dates.
              </Text>
              <TouchableOpacity
                style={styles.backTodayBtn}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={styles.backTodayText}>Back to Today's Agenda</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Red Alert Banner with Pulse Animation */}
              <View style={[styles.redAlertBanner, Shadows.sm]}>
                <View style={styles.alertHeaderRow}>
                  <View style={styles.pulseContainer}>
                    <Animated.View
                      style={[
                        styles.pulseGlow,
                        { transform: [{ scale: pulseAnim }] },
                      ]}
                    />
                    <View style={styles.alertIconBox}>
                      <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.alertTitleRow}>
                      <Text style={styles.alertTitle}>ACTION REQUIRED</Text>
                      <View style={styles.alertBadge}>
                        <Text style={styles.alertBadgeText}>
                          {tasks.length} {tasks.length === 1 ? 'TASK' : 'TASKS'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.alertSub}>
                      Unfinished tasks from earlier dates. Review or reschedule below.
                    </Text>
                  </View>
                </View>

                {/* Bulk Forward Button */}
                {tasks.length > 1 && (
                  <TouchableOpacity style={styles.forwardAllBtn} onPress={handleForwardAll}>
                    <Ionicons name="repeat" size={16} color={Colors.danger} />
                    <Text style={styles.forwardAllText}>Forward All to Tomorrow</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Task Cards */}
              {tasks.map((task) => (
                <View key={task.id} style={[styles.taskCard, Shadows.sm]}>
                  <View style={styles.cardTop}>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{task.category.toUpperCase()}</Text>
                    </View>
                    <View style={styles.overdueBadge}>
                      <Ionicons name="time-outline" size={12} color={Colors.danger} />
                      <Text style={styles.overdueText}>Due: {task.dueDate}</Text>
                    </View>
                  </View>

                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.description ? (
                    <Text style={styles.taskDesc}>{task.description}</Text>
                  ) : null}

                  {/* Actions Row */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.moveBtn}
                      onPress={() => handleMoveToToday(task)}
                      disabled={actionInProgressId === task.id}
                    >
                      <Ionicons name="arrow-forward-circle" size={16} color={Colors.primary} />
                      <Text style={styles.moveBtnText}>Move to Today</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doneBtn}
                      onPress={() => handleMarkCompleted(task)}
                      disabled={actionInProgressId === task.id}
                    >
                      <Ionicons name="checkmark-done" size={16} color={Colors.success} />
                      <Text style={styles.doneBtnText}>Mark Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.textMuted },
  aiQuickBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollList: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 14 },
  redAlertBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  alertHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FCA5A5',
    opacity: 0.5,
  },
  alertIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B', letterSpacing: 0.5 },
  alertBadge: { backgroundColor: Colors.danger, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  alertBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  alertSub: { fontSize: 12, color: '#B91C1C', marginTop: 2, lineHeight: 16 },
  forwardAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  forwardAllText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catBadge: { backgroundColor: '#F3EFEA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.navyLight },
  overdueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  overdueText: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  taskTitle: { fontSize: 15, fontWeight: '700', color: Colors.navy },
  taskDesc: { fontSize: 13, color: Colors.textMuted, marginTop: 4, lineHeight: 18 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDF2F2',
  },
  moveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moveBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneBtnText: { fontSize: 13, fontWeight: '700', color: Colors.success },
  allClearCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 20,
  },
  checkCircle: { marginBottom: 12 },
  allClearTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  allClearSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  backTodayBtn: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 18,
  },
  backTodayText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
