import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInAppNotifications } from '../context/InAppNotificationContext';
import { Colors } from '../constants/theme';

interface Props {
  showPendingChip?: boolean;
}

export function PendingNotificationBell({ showPendingChip = false }: Props) {
  const { pendingCount, unreadNotificationCount, playChime } = useInAppNotifications();
  const totalAlerts = pendingCount + (unreadNotificationCount > 0 ? 1 : 0);

  // Pulse animation for the red badge
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pendingCount > 0) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pendingCount, pulseAnim]);

  const handlePress = () => {
    if (pendingCount > 0) {
      router.push('/(tabs)/pending');
    } else {
      router.push('/notifications');
    }
  };

  const handleLongPress = () => {
    // Executive audio chime test
    playChime(pendingCount > 0 ? 'urgent' : 'gentle');
  };

  return (
    <View style={styles.container}>
      {/* Optional Pending Chip if tasks need urgent attention */}
      {showPendingChip && pendingCount > 0 && (
        <TouchableOpacity
          style={styles.pendingChip}
          onPress={() => router.push('/(tabs)/pending')}
          activeOpacity={0.8}
        >
          <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.pendingChipText}>{pendingCount} Pending</Text>
        </TouchableOpacity>
      )}

      {/* Bell Icon with Red Badge */}
      <TouchableOpacity
        style={styles.bellBtn}
        onPress={handlePress}
        onLongPress={handleLongPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Ionicons
          name={pendingCount > 0 ? 'notifications' : 'notifications-outline'}
          size={19}
          color={pendingCount > 0 ? Colors.danger : Colors.navy}
        />

        {pendingCount > 0 ? (
          <Animated.View
            style={[
              styles.badge,
              styles.badgePending,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.badgeText}>
              {pendingCount > 9 ? '9+' : pendingCount}
            </Text>
          </Animated.View>
        ) : unreadNotificationCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadNotificationCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Colors.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgePending: {
    backgroundColor: Colors.danger,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
  },
  pendingChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.danger,
  },
});
