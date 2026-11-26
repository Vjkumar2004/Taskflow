import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Shadows } from '../../src/constants/theme';
import { alarmService } from '../../src/services/alarmService';
import {
  User,
  Building,
  Mail,
  Bell,
  Sparkles,
  LogOut,
  Shield,
  CheckCircle,
  AlarmClock,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [testingAlarm, setTestingAlarm] = useState(false);

  const handleTestAlarm = async () => {
    if (!alarmService.isAvailable()) {
      Alert.alert(
        'Not Available',
        'AlarmModule bridge is not loaded. This is an Android-only feature and requires a native build (not Expo Go).',
      );
      return;
    }
    setTestingAlarm(true);
    try {
      // requestExactAlarmPermission also handles USE_FULL_SCREEN_INTENT on Android 14
      await alarmService.requestExactAlarmPermission();
      await alarmService.scheduleTest(15);
      Alert.alert(
        '✅ Test Alarm Scheduled',
        '1. LOCK your phone now (press power button)\n2. Wait 15 seconds\n3. Alarm screen should appear\n\n⚠️ On Android 14: if nothing happens, go to Settings → Apps → WeGrow Tracking → Notifications → enable "Allow full screen intent"',
      );
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setTestingAlarm(false);
    }
  };

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
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>Account & Settings</Text>
          <Text style={styles.headerTitle}>User Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, Shadows.sm]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.user_metadata?.full_name || user?.email || 'U')
                .substring(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={styles.userRole}>
              {user ? 'Active User' : 'Guest Mode (Demo)'}
            </Text>
            <View style={styles.companyRow}>
              <Mail size={14} color={Colors.textMuted} />
              <Text style={styles.companyName}>
                {user?.email || 'Not logged in (Tap Sign Out / Login)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Status Badge */}
        <View style={styles.syncCard}>
          <View style={[styles.syncDot, { backgroundColor: user ? Colors.success : Colors.warning }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.syncTitle}>
              {user ? 'Supabase User Isolation Active' : 'Offline / Demo Mode'}
            </Text>
            <Text style={styles.syncSub}>
              {user
                ? `Account: ${user.email} (ID: ${user.id.slice(0, 8)}...)`
                : 'Sign in to sync your checklists privately'}
            </Text>
          </View>
          <CheckCircle size={18} color={user ? Colors.success : Colors.warning} />
        </View>

        {/* Settings Sections */}
        <Text style={styles.sectionHeading}>Preferences</Text>
        <View style={[styles.menuCard, Shadows.sm]}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
              <Bell size={18} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Daily Briefing Notification</Text>
              <Text style={styles.menuSub}>Scheduled at 08:30 AM every morning</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#FDF4EC' }]}>
              <Sparkles size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>AI Task & Habit Assistant</Text>
              <Text style={styles.menuSub}>Smart conflict detection & schedule optimization</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#ECFDF5' }]}>
              <Shield size={18} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Security & Privacy</Text>
              <Text style={styles.menuSub}>PostgreSQL Row Level Security (RLS) Active</Text>
            </View>
          </View>
        </View>

        {/* Alarm Test — verify alarm screen works */}
        {Platform.OS === 'android' && (
          <>
            <Text style={styles.sectionHeading}>Diagnostics</Text>
            <TouchableOpacity
              style={[styles.testAlarmBtn, testingAlarm && { opacity: 0.6 }]}
              onPress={handleTestAlarm}
              disabled={testingAlarm}
            >
              <AlarmClock size={18} color="#fff" />
              <Text style={styles.testAlarmText}>
                {testingAlarm ? 'Scheduling...' : 'Test Alarm Screen (10 sec)'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.testAlarmHint}>
              Tap → kill app → wait 10 sec. If alarm screen appears, system is working.
            </Text>
          </>
        )}

        {/* Sign Out / Switch Account Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, !user && { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
          onPress={user ? handleSignOut : () => router.push('/login')}
        >
          <LogOut size={18} color={user ? Colors.danger : Colors.primary} />
          <Text style={[styles.logoutText, !user && { color: Colors.primary }]}>
            {user ? 'Sign Out / Switch Account' : 'Sign In / Create Account'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>TaskFlow Mobile • v1.0.0 (Expo React Native)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.navy,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.navy,
  },
  userRole: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  companyName: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  syncCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    gap: 10,
  },
  syncDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  syncTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
  },
  syncSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
  },
  menuSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    height: 48,
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.danger,
  },
  testAlarmBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  testAlarmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  testAlarmHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  versionText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
