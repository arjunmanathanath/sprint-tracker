/**
 * Nightly backup schedule. A browser app cannot run while closed, so the rule is:
 * a snapshot is *due* once the most recent scheduled moment (e.g. today 23:58, or yesterday's
 * if that has not passed yet) is later than the last time the job ran. The job runs when the
 * timer fires while the app is open, and again on the next open as a catch-up.
 */

export interface BackupSchedule {
  enabled: boolean;
  /** "HH:MM", 24-hour, local time. */
  time: string;
  /** Snapshots to keep (oldest pruned). */
  keep: number;
}

export const DEFAULT_BACKUP_SCHEDULE: BackupSchedule = { enabled: true, time: "23:58", keep: 30 };

export function parseTime(time: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  const h = match ? Number(match[1]) : NaN;
  const m = match ? Number(match[2]) : NaN;
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return { h: 23, m: 58 };
  return { h, m };
}

const atTime = (day: Date, time: string): Date => {
  const { h, m } = parseTime(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
};

/** The most recent scheduled moment at or before `now`. */
export function lastDueAt(now: Date, time: string): Date {
  const today = atTime(now, time);
  if (today.getTime() <= now.getTime()) return today;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return atTime(yesterday, time);
}

/** The next scheduled moment strictly after `now`. */
export function nextDueAt(now: Date, time: string): Date {
  const today = atTime(now, time);
  if (today.getTime() > now.getTime()) return today;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return atTime(tomorrow, time);
}

/** True when the job has not run since the last scheduled moment. */
export function isBackupDue(now: Date, lastRunAt: number | null, time: string): boolean {
  if (lastRunAt === null) return true;
  return lastRunAt < lastDueAt(now, time).getTime();
}

/** Milliseconds until the next scheduled moment (at least 1 s). */
export function msUntilNextDue(now: Date, time: string): number {
  return Math.max(1000, nextDueAt(now, time).getTime() - now.getTime());
}
