// Data model — spec §3 plus the pause/skip ("valid reason") additions.

export type DayType = "weekday" | "tuesday" | "weekend";
export type Category = "technical" | "life" | "soft";
export type MetricType = "deep" | "habit";
export type PhaseId = "phase1" | "phase2";

export interface Track {
  id: string; // "T01".."T11"
  name: string;
  shortLabel: string; // "T02"
  category: Category;
  metricType: MetricType; // deep => hours+milestones; habit => streak+adherence
  color: string; // hex
  active: boolean; // T03 = false (parked)
  architectCritical: boolean; // T02, T04 = true
}

export interface ScheduleSlot {
  id: string; // "S1".."S9"
  trackIds: string[]; // usually one; Baby+Family = ["T06","T08"]
  label: string;
  minutes: Record<DayType, number>;
}

export interface SchedulePhase {
  id: PhaseId;
  slots: ScheduleSlot[];
}

export interface SprintConfig {
  id: "config"; // singleton row key
  startDate: string | null; // ISO "YYYY-MM-DD" = week 1, day 1; null until chosen
  phase1Weeks: number; // 4 (T01 refresher window)
  weeklyTargetMinutes: number; // 3030 (50.5 h)
  /** Paused days push the sprint calendar forward so phase windows keep their full length. */
  pauseExtendsSprint: boolean;
  lastExportAt: number | null; // epoch ms, drives the monthly export reminder
  /**
   * Load adjustment ("cut load ~20% and re-plan"): planned minutes are scaled by `loadFactor`
   * on days from `loadFrom` to `loadUntil` (inclusive; null = open-ended). 1 = full plan.
   */
  loadFactor: number;
  loadFrom: string | null;
  loadUntil: string | null;
  /** Nightly in-app snapshot (and folder file on desktop Chrome/Edge). */
  autoBackup: { enabled: boolean; time: string; keep: number };
  /** Last time the nightly job ran (whether or not anything changed). */
  lastAutoBackupAt: number | null;
}

export interface Milestone {
  id: string;
  trackId: string;
  title: string;
  targetHint: string; // "End of Week 4", "By Month 3", "Ongoing"
  done: boolean;
}

export interface TaskEntry {
  // one slot on one day
  slotId: string;
  plannedMinutes: number; // snapshot for that date
  actualMinutes: number;
  completed: boolean;
  note: string; // per-task daily note
  timerStartedAt?: number; // epoch ms if stopwatch running
  /** Excused for the day with a reason: never counted as missed, never breaks a streak. */
  skipped: boolean;
  skipReason: string;
  /** Planned minutes trimmed for this day with a reason ("could only do 45 min because..."). */
  adjustReason: string;
  /** The plan before it was trimmed, so the trim can be removed. */
  originalPlannedMinutes?: number;
  /** actualMinutes were filled from the plan by ticking complete; cleared on any manual edit. */
  minutesAutoFilled?: boolean;
}

export interface DailyLog {
  date: string; // "YYYY-MM-DD" (primary key)
  entries: Record<string, TaskEntry>; // keyed by slotId
  dayNote: string;
  /** Whole day excused (sick, travel, family…). Tasks stay loggable but are neutral, not red. */
  paused: boolean;
  pauseReason: string;
}

export interface OpenQuestion {
  id: string;
  text: string;
  resolved: boolean;
  createdAt: number;
}

export interface ScratchCard {
  // one per track (primary key trackId)
  trackId: string;
  notes: string; // running freeform notes
  openQuestions: OpenQuestion[];
}

export interface WeeklyReview {
  weekStart: string; // "YYYY-MM-DD" (Sunday)
  held: string;
  slipped: string;
  adjust: string;
  createdAt: number;
}

/** A stored copy of everything, taken by the nightly job or by hand. */
export interface Snapshot {
  id: string; // ISO datetime of the take
  takenAt: number; // epoch ms
  reason: "nightly" | "catch-up" | "manual" | "before-restore";
  bytes: number;
  json: string; // BackupFile as JSON text
}

export type SnapshotMeta = Omit<Snapshot, "json">;

/** Shape of the JSON produced by Settings → Export. */
export interface BackupFile {
  app: "sprint-tracker";
  version: 1;
  exportedAt: string;
  config: SprintConfig;
  tracks: Track[];
  milestones: Milestone[];
  dailyLogs: DailyLog[];
  scratchCards: ScratchCard[];
  reviews: WeeklyReview[];
}
