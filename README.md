# WeGrow Tracking - React Native (Expo) Mobile App

This is the mobile companion app for the WeGrow Business Owner / Director Planner, powered by **React Native**, **Expo Router**, and **Supabase**.

---

## 🚀 Features

- **Executive Daily Planner:** Track daily routines, mark tasks complete with 1 tap, and filter by high priority.
- **KPI Metrics Card:** Real-time calculation of today's completion percentage, total tasks, and completed counts.
- **Monthly Goals:** Progress tracker for Q2 strategic milestones and revenue goals.
- **Pending & Carryover Tasks:** One-tap "Move to Today's Agenda" action.
- **Director Profile:** Connected to Supabase Auth & PostgreSQL Row Level Security (RLS).
- **Fast Task Creation:** Floating action button (`+`) to quickly add custom tasks.

---

## 📱 How to Run on Your Mobile Phone (Expo Go)

1. Install **Expo Go** from Google Play Store (Android) or App Store (iOS) on your phone.
2. In your terminal, run:
   ```bash
   npm run mobile
   # or
   cd mobile
   npm start
   ```
3. Scan the generated QR code using the **Expo Go** app (or Camera app on iOS).

---

## 🤖 How to Run on Android Emulator

Make sure Android Studio with an Android Virtual Device (AVD) is running, then:

```bash
npm run mobile:android
```

---

## 🌐 Web Preview

```bash
npm run mobile:web
```
