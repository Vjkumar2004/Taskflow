// ============================================================================
// PUBLIC USER ROUTINES & CHECKLIST DATA TEMPLATE
// Generic template for public users — no company-specific data.
// All routines and tasks are added and managed dynamically by the user.
// ============================================================================

import { FixedRoutineDataset } from "../types/fixed-routine";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultWeeklySchedule: any[] = [];
DAYS.forEach((dayName, idx) => {
  defaultWeeklySchedule.push(
    {
      id: `routine_${dayName.toLowerCase()}_morning`,
      dayOfWeek: dayName,
      dayIndex: idx + 1,
      timeSlot: 'Morning 9 AM–12 PM',
      timeBlock: 'morning',
      defaultStartTime: '09:00',
      defaultEndTime: '12:00',
      title: 'Morning Focus & Planning',
      branch: 'Work',
      priority: 'high',
      category: 'planning',
      items: [],
      checkItems: [],
    },
    {
      id: `routine_${dayName.toLowerCase()}_afternoon`,
      dayOfWeek: dayName,
      dayIndex: idx + 1,
      timeSlot: 'Afternoon 12 PM–4 PM',
      timeBlock: 'afternoon',
      defaultStartTime: '12:00',
      defaultEndTime: '16:00',
      title: 'Afternoon Execution & Tasks',
      branch: 'Work',
      priority: 'medium',
      category: 'operations',
      items: [],
      checkItems: [],
    },
    {
      id: `routine_${dayName.toLowerCase()}_evening`,
      dayOfWeek: dayName,
      dayIndex: idx + 1,
      timeSlot: 'Evening 4 PM–7 PM',
      timeBlock: 'evening',
      defaultStartTime: '16:00',
      defaultEndTime: '19:00',
      title: 'Evening Review & Wrap-up',
      branch: 'Personal',
      priority: 'medium',
      category: 'review',
      items: [],
      checkItems: [],
    }
  );
});

export const FIXED_EXCEL_ROUTINE_DATA: FixedRoutineDataset = {
  version: "2.0.0",
  sourceFile: "user_custom",
  importedAt: new Date().toISOString(),
  isReadOnly: false,
  weeklySchedule: defaultWeeklySchedule,
  dailyChecklist: [],
  monthlyCalendar: {
    weeks: [
      {
        week: 'Week 1',
        dateRange: '1–7',
        theme: 'Week 1: Planning & Setup',
        mdFocusSchedule: [],
        sivakasiActivities: [],
        sriviActivities: [],
        jointActivities: [],
        kpisToTrack: [],
        keyDecisionPoint: '',
      },
      {
        week: 'Week 2',
        dateRange: '8–14',
        theme: 'Week 2: Execution & Habit Building',
        mdFocusSchedule: [],
        sivakasiActivities: [],
        sriviActivities: [],
        jointActivities: [],
        kpisToTrack: [],
        keyDecisionPoint: '',
      },
      {
        week: 'Week 3',
        dateRange: '15–21',
        theme: 'Week 3: Momentum & Mid-Month Review',
        mdFocusSchedule: [],
        sivakasiActivities: [],
        sriviActivities: [],
        jointActivities: [],
        kpisToTrack: [],
        keyDecisionPoint: '',
      },
      {
        week: 'Week 4',
        dateRange: '22–31',
        theme: 'Week 4: Review & Monthly Wrap-Up',
        mdFocusSchedule: [],
        sivakasiActivities: [],
        sriviActivities: [],
        jointActivities: [],
        kpisToTrack: [],
        keyDecisionPoint: '',
      },
    ],
    dashboardMetrics: []
  },
  mondayReview: {
    scorecardMetrics: [],
    agendaItems: []
  }
};
