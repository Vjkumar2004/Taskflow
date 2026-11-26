export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskCategory =
  | 'operations'
  | 'strategy'
  | 'finance'
  | 'marketing'
  | 'team'
  | 'review'
  | 'personal';

export type TaskStatus = 'todo' | 'completed' | 'pending' | 'skipped';

export interface MobileTask {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: TaskPriority;
  category: TaskCategory;
  isTopPriority?: boolean;
  status: TaskStatus;
  completedAt?: string;
  isFixedRoutine?: boolean;
  routineSource?: string;
  notes?: string;
}

export interface MonthlyGoal {
  id: string;
  title: string;
  description?: string;
  month: string;
  targetCount: number;
  currentCount: number;
  progressPercent?: number;
  targetMetric?: string;
  currentMetric?: string;
  timeframe?: string;
  targetDate?: string;
  category: string;
  status: 'in_progress' | 'completed' | 'on_track' | 'not_started';
}
