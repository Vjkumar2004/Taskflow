import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Colors, Shadows } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { notificationStorage, MobileNotification } from '../src/services/notificationStorage';

interface NotificationItem {
  id: string;
  type: 'reminder' | 'urgent' | 'briefing' | 'pending';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'urgent',
    title: 'Pending Tasks Carryover Required',
    message: '2 unfinished tasks from earlier dates are awaiting your decision. Move to Today or forward.',
    time: '10 mins ago',
    read: false,
  },
  {
    id: 'notif-2',
    type: 'reminder',
    title: 'Upcoming Focus: Sivakasi Branch Review',
    message: 'Scheduled for 09:30 AM. Review lead follow-up & counselor briefing targets.',
    time: '25 mins ago',
    read: false,
  },
  {
    id: 'notif-3',
    type: 'briefing',
    title: 'Daily Briefing Ready',
    message: 'Good morning! Your tasks and daily routines are ready for today.',
    time: '08:30 AM',
    read: true,
  },
  {
    id: 'notif-4',
    type: 'reminder',
    title: 'Goal Milestone Update',
    message: 'Your monthly tasks reached 80% completion. Keep up the momentum!',
    time: 'Yesterday',
    read: true,
  },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const loadNotifs = async () => {
    const list = await notificationStorage.getNotifications();
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifs();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await notificationStorage.markAllRead();
  };

  const handleClearAll = () => {
    Alert.alert('Clear All', 'Do you want to clear all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setNotifications([]);
          await notificationStorage.clearAll();
        },
      },
    ]);
  };



  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'urgent') return n.type === 'urgent';
    return true;
  });

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
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSub}>{unreadCount} unread alerts</Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.readAllBtn}>
              <Text style={styles.readAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>


        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'urgent' && styles.filterChipActive]}
            onPress={() => setFilter('urgent')}
          >
            <Text style={[styles.filterText, filter === 'urgent' && styles.filterTextActive]}>
              Urgent Action
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notifications List */}
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="notifications-off-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySub}>You are all caught up with your executive schedule.</Text>
            </View>
          ) : (
            filtered.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.notifCard, Shadows.sm, !item.read && styles.unreadCard]}
                onPress={() => {
                  setNotifications((prev) =>
                    prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                  );
                  if (item.type === 'urgent') {
                    router.push('/(tabs)/pending');
                  }
                }}
              >
                <View
                  style={[
                    styles.iconBox,
                    item.type === 'urgent'
                      ? { backgroundColor: '#FEE2E2' }
                      : item.type === 'briefing'
                      ? { backgroundColor: '#EFF6FF' }
                      : { backgroundColor: '#FFF5EE' },
                  ]}
                >
                  <Ionicons
                    name={
                      item.type === 'urgent'
                        ? 'alert-circle'
                        : item.type === 'briefing'
                        ? 'sunny'
                        : 'alarm-outline'
                    }
                    size={20}
                    color={
                      item.type === 'urgent'
                        ? Colors.danger
                        : item.type === 'briefing'
                        ? Colors.info
                        : Colors.primary
                    }
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, !item.read && styles.unreadTitle]}>
                      {item.title}
                    </Text>
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                  <Text style={styles.cardMsg}>{item.message}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={styles.clearText}>Clear all notifications</Text>
            </TouchableOpacity>
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
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.textMuted },
  readAllBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  readAllText: { fontSize: 12, fontWeight: '700', color: Colors.primary },


  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  filterTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 6 },
  notifCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadCard: {
    backgroundColor: '#FFFCFA',
    borderColor: '#F6D0B4',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.navy, flex: 1, marginRight: 8 },
  unreadTitle: { fontWeight: '800' },
  timeText: { fontSize: 11, color: Colors.textMuted },
  cardMsg: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    padding: 10,
  },
  clearText: { fontSize: 13, color: Colors.danger, fontWeight: '600' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.navy, marginTop: 12 },
  emptySub: { fontSize: 12, color: Colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
});
