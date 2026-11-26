import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { taskService } from '../services/taskService';
import { soundService, ChimeType } from '../services/soundService';
import { evaluateTaskReminders, clearTriggeredKeys } from '../services/reminderEvaluator';
import { notificationStorage } from '../services/notificationStorage';

import { useAuth } from './AuthContext';
import { Colors, Shadows } from '../constants/theme';

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'urgent' | 'reminder' | 'briefing' | 'success';
  route?: string;
}

interface InAppNotificationContextType {
  pendingCount: number;
  unreadNotificationCount: number;
  triggerNotification: (notif: {
    title: string;
    message: string;
    type?: 'urgent' | 'reminder' | 'briefing' | 'success';
    route?: string;
    sound?: ChimeType | false;
  }) => void;
  refreshCounts: () => Promise<number>;
  playChime: (type?: ChimeType) => void;
  stopAlarm: () => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextType>({
  pendingCount: 0,
  unreadNotificationCount: 0,
  triggerNotification: () => {},
  refreshCounts: async () => 0,
  playChime: () => {},
  stopAlarm: () => {},
});

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [activeNotification, setActiveNotification] = useState<InAppNotification | null>(null);

  // Slide animation for dropdown banner
  const slideAnim = useRef(new Animated.Value(-180)).current;

  // Reset state and stop any active alarms when user logs out or switches accounts
  useEffect(() => {
    soundService.stopAlarm();
    setActiveNotification(null);
    setPendingCount(0);
    setUnreadNotificationCount(0);
    clearTriggeredKeys();
  }, [user?.id]);

  // Fetch pending tasks count for current user
  const refreshCounts = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return 0;
    }
    try {
      const pTasks = await taskService.getPendingTasks();
      const count = pTasks.length;
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  }, [user]);

  const playChime = useCallback((type: ChimeType = 'gentle') => {
    soundService.playExecutiveChime(type);
  }, []);

  const stopAlarm = useCallback(() => {
    soundService.stopAlarm();
  }, []);

  const dismissBanner = useCallback(() => {
    soundService.stopAlarm();
    Animated.timing(slideAnim, {
      toValue: -180,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setActiveNotification(null);
    });
  }, [slideAnim]);

  // Display top floating in-app notification banner
  // NOTE: Stays open until user taps OK or View
  const triggerNotification = useCallback(
    ({
      title,
      message,
      type = 'reminder',
      route = '/notifications',
      sound = 'gentle',
    }: {
      title: string;
      message: string;
      type?: 'urgent' | 'reminder' | 'briefing' | 'success';
      route?: string;
      sound?: ChimeType | false;
    }) => {
      const newNotif: InAppNotification = {
        id: `notif-${Date.now()}`,
        title,
        message,
        type,
        route,
      };

      // Play sound based on sound type
      if (sound) {
        if (sound === 'upcoming' || sound === 'reminder') {
          // Upcoming reminder: loops continuously until user taps OK
          soundService.playContinuousAlarm();
        } else if (sound === 'pending') {
          // Pending backlog: distinct one-shot alert (NOT continuous)
          soundService.playPendingNoticeSound();
        } else if (sound === 'urgent') {
          // Urgent alarms loop continuously
          soundService.playContinuousAlarm();
        } else {
          // Other gentle or hourly chimes
          soundService.playExecutiveChime(sound);
        }
      }

      setActiveNotification(newNotif);

      // Slide down and stay on screen until user explicitly acknowledges with OK
      Animated.spring(slideAnim, {
        toValue: insets.top > 0 ? insets.top + 8 : 16,
        useNativeDriver: true,
        bounciness: 6,
        speed: 14,
      }).start();
    },
    [insets.top, slideAnim]
  );

  // Initial load & periodic poll every 30 seconds for task reminders (STRICTLY when user is logged in)
  useEffect(() => {
    if (!user) {
      return;
    }

    const runEvaluation = async () => {
      if (!user) return;
      await refreshCounts();
      const unread = await notificationStorage.getUnreadCount();
      setUnreadNotificationCount(unread);

      const generated = await evaluateTaskReminders();
      if (generated && generated.length > 0) {
        const first = generated[0];
        // In-app banner + sound only — OS tray notifications are handled by
        // pre-scheduled alarms (scheduleTaskAlarmAhead / scheduleDailySectionAlarms)
        // so we never duplicate them here while the app is active.
        if (AppState.currentState === 'active') {
          triggerNotification({
            title: first.title,
            message: first.message,
            type: first.type,
            route: first.route,
            sound: first.sound,
          });
        }
      }
    };

    const timer = setTimeout(runEvaluation, 1500);
    const interval = setInterval(runEvaluation, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user?.id, refreshCounts, triggerNotification]);

  const handlePressBanner = () => {
    const route = activeNotification?.route || '/notifications';
    dismissBanner();
    router.push(route as any);
  };

  const handleAcknowledgeOk = () => {
    dismissBanner();
  };

  const getTypeStyle = (type: InAppNotification['type']) => {
    switch (type) {
      case 'urgent':
        return {
          icon: 'flame' as const,
          color: Colors.danger,
          bg: '#FEF2F2',
          border: '#FECACA',
          badgeText: 'URGENT',
        };
      case 'briefing':
        return {
          icon: 'sparkles' as const,
          color: Colors.primary,
          bg: '#FFF7ED',
          border: '#FFEDD5',
          badgeText: 'BRIEFING',
        };
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          color: '#10B981',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          badgeText: 'UPDATE',
        };
      default:
        return {
          icon: 'notifications' as const,
          color: '#3B82F6',
          bg: '#EFF6FF',
          border: '#BFDBFE',
          badgeText: 'REMINDER',
        };
    }
  };

  return (
    <InAppNotificationContext.Provider
      value={{
        pendingCount,
        unreadNotificationCount,
        triggerNotification,
        refreshCounts,
        playChime,
        stopAlarm,
      }}
    >
      {children}

      {/* Floating Persistent In-App Notification Banner with OK Action */}
      {activeNotification && (
        <Animated.View
          style={[
            styles.bannerContainer,
            Shadows.lg,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {(() => {
            const st = getTypeStyle(activeNotification.type);
            return (
              <View style={[styles.bannerCard, { borderColor: st.border }]}>
                {/* Left Colored Accent Bar */}
                <View style={[styles.bannerStrip, { backgroundColor: st.color }]} />

                {/* Top Section */}
                <View style={styles.bannerTopRow}>
                  {/* Icon box */}
                  <View style={[styles.bannerIconBox, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon} size={20} color={st.color} />
                  </View>

                  {/* Text Content */}
                  <View style={styles.bannerContent}>
                    <View style={styles.bannerHeaderRow}>
                      <Text style={[styles.bannerTypeBadge, { color: st.color, backgroundColor: st.bg }]}>
                        {st.badgeText}
                      </Text>
                      <Text style={styles.bannerTime}>Now</Text>
                    </View>
                    <Text style={styles.bannerTitle} numberOfLines={1}>
                      {activeNotification.title}
                    </Text>
                    <Text style={styles.bannerMessage} numberOfLines={2}>
                      {activeNotification.message}
                    </Text>
                  </View>

                  {/* Close X */}
                  <TouchableOpacity
                    style={styles.bannerDismissBtn}
                    onPress={dismissBanner}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Bottom Actions Row: OK Button & View Button */}
                <View style={styles.bannerActionsRow}>
                  {activeNotification.route && (
                    <TouchableOpacity
                      style={[styles.bannerViewBtn, { borderColor: st.border, backgroundColor: st.bg }]}
                      onPress={handlePressBanner}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="open-outline" size={13} color={st.color} />
                      <Text style={[styles.bannerViewBtnText, { color: st.color }]}>View Details</Text>
                    </TouchableOpacity>
                  )}

                  {/* Prominent OK Button to acknowledge and dismiss */}
                  <TouchableOpacity
                    style={[styles.bannerOkBtn, { backgroundColor: st.color }]}
                    onPress={handleAcknowledgeOk}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
                    <Text style={styles.bannerOkBtnText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
        </Animated.View>
      )}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotifications() {
  return useContext(InAppNotificationContext);
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  bannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  bannerStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  bannerContent: {
    flex: 1,
    paddingRight: 6,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  bannerTypeBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  bannerTime: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.navy,
    letterSpacing: -0.2,
  },
  bannerMessage: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
    marginTop: 2,
  },
  bannerDismissBtn: {
    padding: 4,
    marginLeft: 4,
  },
  bannerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  bannerViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  bannerViewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bannerOkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 70,
    justifyContent: 'center',
  },
  bannerOkBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
