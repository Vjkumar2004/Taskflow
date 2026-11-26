import type { TaskStatus } from "./index";
export type TaskRescheduleProposal = any;

export type RoutineDayOfWeek = 
  | "Monday" 
  | "Tuesday" 
  | "Wednesday" 
  | "Thursday" 
  | "Friday" 
  | "Saturday" 
  | "Sunday";

export type RoutineBranch = "Sivakasi" | "Srivi" | "Both" | "MD Office";

export interface RoutineActivityTemplate {
  id: string;
  dayOfWeek: RoutineDayOfWeek;
  dayIndex: number; // 1 = Monday, ..., 7 = Sunday
  timeSlot: string; // e.g. "Morning 9 AM–12 PM"
  timeBlock: "morning" | "afternoon" | "evening";
  defaultStartTime: string; // HH:mm e.g. "09:00"
  defaultEndTime: string; // HH:mm e.g. "12:00"
  title: string;
  branch: RoutineBranch;
  priority: "low" | "medium" | "high" | "urgent";
  category: "operations" | "finance" | "strategy" | "leadership" | "team";
  items: string[];
  isMeetingOrVisit?: boolean;
}

export interface MonthlyCalendarWeekTemplate {
  week: string; // "Week 1", "Week 2", "Week 3", "Week 4"
  dateRange: string; // "1–7", "8–14", "15–21", "22–31"
  theme: string;
  mdFocusSchedule: string[];
  sivakasiActivities: string[];
  sriviActivities: string[];
  jointActivities: string[];
  kpisToTrack: string[];
  keyDecisionPoint: string;
}

export interface MonthlyDashboardMetricTemplate {
  metric: string;
  sivakasiTarget: string;
  sriviTarget: string;
  combinedTotal: string;
  mdAction?: string;
}

export interface DailyChecklistItemTemplate {
  itemNumber: number;
  text: string;
  branch: RoutineBranch;
  actionNeeded?: string;
}

export interface DailyChecklistSectionTemplate {
  id: string;
  sectionTitle: string; // e.g. "MORNING ROUTINE  (9:00 – 9:30 AM)"
  timeRange: string; // "9:00 – 9:30 AM"
  defaultTime: string; // "09:00"
  items: DailyChecklistItemTemplate[];
}

export interface MondayReviewScorecardMetric {
  kpi: string;
  sivakasiLastWk?: string;
  sriviLastWk?: string;
  combined?: string;
  sivakasiThisWk?: string;
  sriviThisWk?: string;
  combinedGoal?: string;
  drPriority?: string;
}

export interface MondayReviewAgendaItem {
  timeSlot: string; // "0:00–0:10"
  topic: string; // "Opening"
  whatToCover: string;
  directorRole: string; // "BM / Director"
  actionDecision?: string;
  deadline?: string;
}

export interface FixedRoutineDataset {
  version: string;
  sourceFile: string;
  importedAt: string;
  isReadOnly: boolean;
  weeklySchedule: RoutineActivityTemplate[];
  monthlyCalendar: {
    weeks: MonthlyCalendarWeekTemplate[];
    dashboardMetrics: MonthlyDashboardMetricTemplate[];
  };
  dailyChecklist: DailyChecklistSectionTemplate[];
  mondayReview: {
    scorecardMetrics: MondayReviewScorecardMetric[];
    agendaItems: MondayReviewAgendaItem[];
  };
}

export interface RoutineDailyExecution {
  routineId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
  status?: TaskStatus;
  skipped?: boolean;
  skipReason?: string;
  snoozedUntil?: string;
  reminderCount?: number;
  lastReminderAt?: string;
  rescheduleProposal?: TaskRescheduleProposal;
  completedChecklistIds?: string[];
  notes?: string;
}

export interface RoutineConflictCheckResult {
  hasConflict: boolean;
  conflictingRoutine?: RoutineActivityTemplate;
  suggestedAvailableSlots: string[];
  message?: string;
}
