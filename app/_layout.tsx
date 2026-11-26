import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InAppNotificationProvider } from '../src/context/InAppNotificationContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/theme';

import { pushNotificationService } from '../src/services/pushNotificationService';
import { taskService, parseSectionTimeRange } from '../src/services/taskService';
import { alarmService } from '../src/services/alarmService';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function AuthProtection({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const scheduledForUserRef = useRef<string | null>(null);

  // Navigation guard — depends on segments too but ONLY for routing
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading]);

  // Alarm scheduling — ONLY fires once per user login, NOT on every navigation
  useEffect(() => {
    if (!session?.user?.id) {
      scheduledForUserRef.current = null;
      return;
    }

    const userId = session.user.id;
    const todayStr = new Date().toISOString().split('T')[0];
    const scheduleKey = `${userId}_${todayStr}`;

    // Skip if already scheduled for this user today
    if (scheduledForUserRef.current === scheduleKey) return;
    scheduledForUserRef.current = scheduleKey;

    // Register push token
    pushNotificationService.registerForPushNotifications(true).catch((err) => {
      console.warn('[Layout] Push token registration failed:', err);
    });

    // Android 12+: exact alarm permission
    alarmService.requestExactAlarmPermission().catch(() => {});

    // Schedule today's alarms (cancel stale ones first)
    const scheduleAlarms = async () => {
      try {
        await pushNotificationService.cancelAllScheduled();
        console.log('[Layout] Cancelled stale scheduled notifications');

        const [dailyData, pendingRaw] = await Promise.all([
          taskService.getTasksForDate(todayStr),
          taskService.getPendingTasks().catch(() => []),
        ]);
        console.log('[Layout] Daily sections:', dailyData.dailySections?.length ?? 0, 'custom tasks:', dailyData.customTasks?.length ?? 0, 'pending tasks:', pendingRaw.length);

        const sections = (dailyData.dailySections || []).flatMap((sec) => {
          const timeInfo = parseSectionTimeRange(sec.timeRange);
          if (!timeInfo) return [];
          const h = Math.floor(timeInfo.startMin / 60);
          const m = timeInfo.startMin % 60;
          return [{
            id: sec.id,
            title: sec.sectionTitle,
            timeRange: sec.timeRange,
            startTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          }];
        });

        const tasks = (dailyData.customTasks || [])
          .filter((t) => t.dueTime && t.status !== 'completed' && t.status !== 'skipped')
          .map((t) => ({ id: t.id, title: t.title, dueTime: t.dueTime!, dueDate: t.dueDate }));

        const pendingTasks = pendingRaw
          .filter((t) => t.status !== 'completed')
          .map((t) => ({ id: t.id, title: t.title }));

        console.log('[Layout] Scheduling alarms for', sections.length, 'sections,', tasks.length, 'tasks,', pendingTasks.length, 'pending');

        // Native AlarmManager (opens AlarmActivity full-screen)
        await alarmService.scheduleAllDayAlarms(sections, tasks, pendingTasks);

        // expo-notifications fallback (OS tray notification)
        await pushNotificationService.scheduleDailySectionAlarms(sections);

        console.log('[Layout] ✅ All alarms scheduled successfully');
      } catch (err) {
        console.error('[Layout] ❌ Alarm scheduling failed:', err);
        scheduledForUserRef.current = null; // allow retry next render
      }
    };

    scheduleAlarms();
  }, [session?.user?.id]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
    pushNotificationService.setupNotificationChannels().catch(() => {});
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <InAppNotificationProvider>
          <AuthProtection>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen
                name="new-task"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ai-chat"
                options={{
                  presentation: 'card',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="notifications"
                options={{
                  presentation: 'card',
                  headerShown: false,
                }}
              />
            </Stack>
          </AuthProtection>
        </InAppNotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
