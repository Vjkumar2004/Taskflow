import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInAppNotifications } from '../../src/context/InAppNotificationContext';
import { Colors } from '../../src/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { pendingCount } = useInAppNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64 + (insets.bottom > 0 ? insets.bottom : 6),
          paddingBottom: Platform.OS === 'ios' ? 28 : (insets.bottom > 0 ? insets.bottom : 8),
          paddingTop: 8,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Daily',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={22} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="weekly"
        options={{
          title: 'Weekly',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar-number' : 'calendar-number-outline'} size={22} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="monthly"
        options={{
          title: 'Monthly',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'layers' : 'layers-outline'} size={22} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="custom-tasks"
        options={{
          title: 'Custom',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={22} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarBadge: pendingCount > 0 ? (pendingCount > 9 ? '9+' : pendingCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.danger,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color as any} />
          ),
        }}
      />
      {/* Hidden sub-tabs accessible through More Hub */}
      <Tabs.Screen
        name="goals"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="pending"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color as any} />
          ),
        }}
      />
    </Tabs>
  );
}
