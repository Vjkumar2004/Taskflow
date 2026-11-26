import React from 'react';
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
import { useInAppNotifications } from '../../src/context/InAppNotificationContext';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PendingNotificationBell } from '../../src/components/PendingNotificationBell';

export default function MoreHubScreen() {
  const { pendingCount } = useInAppNotifications();
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of WeGrow AI?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>Executive Control Hub</Text>
            <Text style={styles.headerTitle}>More Options</Text>
          </View>
          <PendingNotificationBell showPendingChip />
        </View>

        {/* User Account Card */}
        <TouchableOpacity
          style={[styles.userCard, Shadows.sm]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.8}
        >
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user?.user_metadata?.full_name || user?.email || 'U').substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Executive User'}
            </Text>
            <Text style={styles.userEmail}>{user?.email || 'Tap to sign in'}</Text>
          </View>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>Profile</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        {/* 1. Pending Tasks */}
        <TouchableOpacity
          style={[styles.menuCard, Shadows.sm]}
          onPress={() => router.push('/(tabs)/pending')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={24} color={Colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>Pending Tasks</Text>
              {pendingCount > 0 ? (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{pendingCount} ACTION</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardSub}>Review, reschedule and forward unfinished tasks from previous days.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* 2. Monthly Strategic Goals */}
        <TouchableOpacity
          style={[styles.menuCard, Shadows.sm]}
          onPress={() => router.push('/(tabs)/goals')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FFF5EE' }]}>
            <Ionicons name="trophy-outline" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Strategic OKRs & Goals</Text>
            <Text style={styles.cardSub}>Monthly revenue targets, admission milestones & KPIs.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* 3. User Profile & Settings */}
        <TouchableOpacity
          style={[styles.menuCard, Shadows.sm]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#F3EFEA' }]}>
            <Ionicons name="person-circle-outline" size={24} color={Colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Profile & Settings</Text>
            <Text style={styles.cardSub}>Account credentials, cloud sync & preferences.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* 4. AI Chat Assistant */}
        <TouchableOpacity
          style={[styles.menuCard, Shadows.sm, { borderColor: '#F6D0B4', backgroundColor: '#FFFBF7' }]}
          onPress={() => router.push('/ai-chat')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FFF5EE' }]}>
            <Ionicons name="sparkles" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>AI Planning Assistant</Text>
              <View style={styles.geminiBadge}>
                <Text style={styles.geminiBadgeText}>GEMINI AI</Text>
              </View>
            </View>
            <Text style={styles.cardSub}>Chat with your personal AI assistant for schedule analysis & suggestions.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>

        {/* 5. Notification Center */}
        <TouchableOpacity
          style={[styles.menuCard, Shadows.sm]}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="notifications-outline" size={24} color={Colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Notifications & Reminders</Text>
            <Text style={styles.cardSub}>Smart reminders, morning briefings, and task alerts.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Quick Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutBtn, !user && { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
          onPress={user ? handleSignOut : () => router.push('/login')}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={user ? Colors.danger : Colors.primary} />
          <Text style={[styles.signOutBtnText, !user && { color: Colors.primary }]}>
            {user ? 'Sign Out' : 'Sign In / Create Account'}
          </Text>
        </TouchableOpacity>

        {/* App Version Info */}
        <Text style={styles.versionLabel}>TaskFlow • Daily Routine & Task Planner v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60 },
  header: { marginBottom: 18 },
  headerSub: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.navy },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.navy,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF4EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  alertBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  alertBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.danger },
  cardSub: { fontSize: 12, color: Colors.textMuted, lineHeight: 16, marginTop: 2 },
  aiNoticeCard: {
    backgroundColor: '#FFFBF7',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F6D0B4',
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  aiText: { fontSize: 12, color: Colors.navyLight, lineHeight: 18 },
  geminiBadge: { backgroundColor: '#FDF4EC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: '#F6D0B4' },
  geminiBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.primary },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 14,
    height: 50,
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  signOutBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.danger,
  },
  versionLabel: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 14 },
});
