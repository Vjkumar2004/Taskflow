import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface MobileNotification {
  id: string;
  type: 'urgent' | 'reminder' | 'briefing' | 'pending' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
  taskId?: string;
  idempotencyKey?: string;
  createdAt: number;
}

async function getStorageKey(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    return uid ? `@wegrow_notifs_v3_${uid}` : '@wegrow_notifs_v3_guest';
  } catch {
    return '@wegrow_notifs_v3_guest';
  }
}

const SEED_NOTIFICATIONS: MobileNotification[] = [
  {
    id: 'seed-1',
    type: 'briefing',
    title: 'Daily Briefing Ready',
    message: 'Welcome to TaskFlow! Your daily routines and tasks are ready to track.',
    time: 'Today, 08:30 AM',
    read: true,
    createdAt: Date.now() - 1000 * 60 * 120,
  },
];

export const notificationStorage = {
  async getNotifications(): Promise<MobileNotification[]> {
    try {
      const storageKey = await getStorageKey();
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(SEED_NOTIFICATIONS));
        return SEED_NOTIFICATIONS;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_NOTIFICATIONS;
    }
  },

  async addNotification(notif: Omit<MobileNotification, 'id' | 'createdAt' | 'read' | 'time'> & { id?: string }): Promise<MobileNotification | null> {
    try {
      const storageKey = await getStorageKey();
      const current = await this.getNotifications();
      if (notif.idempotencyKey) {
        const exists = current.some((n) => n.idempotencyKey === notif.idempotencyKey);
        if (exists) return null; // Prevent duplicates
      }

      const newNotif: MobileNotification = {
        ...notif,
        id: notif.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        read: false,
        time: 'Just now',
        createdAt: Date.now(),
      };

      const updated = [newNotif, ...current].slice(0, 40);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      return newNotif;
    } catch (err) {
      console.warn('Error saving notification:', err);
      return null;
    }
  },

  async markAllRead(): Promise<void> {
    try {
      const storageKey = await getStorageKey();
      const current = await this.getNotifications();
      const updated = current.map((n) => ({ ...n, read: true }));
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  },

  async clearAll(): Promise<void> {
    try {
      const storageKey = await getStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
    } catch {}
  },

  async getUnreadCount(): Promise<number> {
    try {
      const current = await this.getNotifications();
      return current.filter((n) => !n.read).length;
    } catch {
      return 0;
    }
  },
};
