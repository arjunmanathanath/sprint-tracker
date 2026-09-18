import type { DailyLog, WeeklyReview } from "../types";
import { GUARDRAIL } from "../seed/config";
import {
  addDaysISO,
  eachDayISO,
  isLastFridayOfMonth,
  dayOfWeek,
  weekDaysISO,
  weekStartISO,
  type ISODate,
} from "./dates";
import { resolveDay, slotById, type ResolvedEntry } from "./schedule";
import type { SprintCtx } from "./sprint";

export interface StatsCtx extends SprintCtx {
  logs: Record<ISODate, DailyLog>;
}

export const rowsFor = (date: ISODate, ctx: StatsCtx): ResolvedEntry[] =>
  resolveDay(date, ctx.logs[date], ctx);

/** Build the sprint/stats context from raw state. */
export function buildCtx(config: SprintCtx["config"], logs: Record<ISODate, DailyLog>): StatsCtx {
  const pausedDates = new Set<ISODate>();
  for (const log of Object.values(logs)) if (log.paused) pausedDates.add(log.date);
  return { config, pausedDates, logs };
}

// ---------------------------------------------------------------- day

export interface DayTotals {
  planned: number; // all scheduled minutes
  plannedEffective: number; // minus excused
  actual: number;
  scheduled: number; // slot count
  completed: number;
  excused: number; // slot count
}

export function dayTotals(date: ISODate, ctx: StatsCtx): DayTotals {
  const t: DayTotals = { planned: 0, plannedEffective: 0, actual: 0, scheduled: 0, completed: 0, excused: 0 };
  for (const r of rowsFor(date, ctx)) {
    if (r.offSchedule) {
      t.actual += r.actual;
      continue;
    }
    t.scheduled++;
    t.planned += r.planned;
    t.actual += r.actual;
    if (r.completed) t.completed++;
    if (r.excused) t.excused++;
    else t.plannedEffective += r.planned;
  }
  return t;
}

// ---------------------------------------------------------------- week

export interface WeekSummary {
  weekStart: ISODate;
  weekEnd: ISODate;
  actual: number;
  plannedFull: number; // whole week from the schedule
  excusedMinutes: number; // planned minutes excused anywhere in the week
  targetAdjusted: number; // min(weekly target, planned for this week) minus excused minutes
  plannedToDate: number; // through `today`, excluding excused
  ratioToDate: number | null; // actual / plannedToDate
  missed: number; // sessions on days before `today`: scheduled, not excused, nothing logged
  partial: number; // sessions on days before `today`: scheduled, not excused, time logged but not completed
  trimmedMinutes: number; // minutes removed from the week's plan by per-day trims
  pausedDays: number;
  skippedSessions: number;
}

/**
 * Week containing `anchor` (default: the week of `today`). `missed` and `partial` deliberately
 * count only days *before* today: a session is not missed until its day is over. The spec's
 * "missed" (not completed) is `missed + partial`; the split only changes how they are shown.
 */
export function weekSummary(today: ISODate, ctx: StatsCtx, anchor: ISODate = today): WeekSummary {
  const days = weekDaysISO(anchor);
  const s: WeekSummary = {
    weekStart: days[0],
    weekEnd: days[days.length - 1],
    actual: 0,
    plannedFull: 0,
    excusedMinutes: 0,
    targetAdjusted: ctx.config.weeklyTargetMinutes,
    plannedToDate: 0,
    ratioToDate: null,
    missed: 0,
    partial: 0,
    trimmedMinutes: 0,
    pausedDays: 0,
    skippedSessions: 0,
  };
  for (const d of days) {
    const log = ctx.logs[d];
    if (log?.paused) s.pausedDays++;
    for (const r of rowsFor(d, ctx)) {
      s.actual += r.actual;
      if (r.offSchedule) continue;
      s.plannedFull += r.planned;
      if (r.trimmed && r.entry?.originalPlannedMinutes !== undefined) {
        s.trimmedMinutes += Math.max(0, r.entry.originalPlannedMinutes - r.planned);
      }
      if (r.excused) {
        s.excusedMinutes += r.planned;
        if (!log?.paused) s.skippedSessions++;
      } else if (d <= today) {
        s.plannedToDate += r.planned;
        if (d < today && !r.completed) {
          if (r.actual > 0) s.partial++;
          else s.missed++;
        }
      }
    }
  }
  // Partial weeks (sprint starts mid-week, or before it starts) are measured against what the
  // schedule actually plans for them, never against the full weekly target.
  const base = Math.min(ctx.config.weeklyTargetMinutes, s.plannedFull);
  s.targetAdjusted = Math.max(0, base - s.excusedMinutes);
  s.ratioToDate = s.plannedToDate > 0 ? s.actual / s.plannedToDate : null;
  return s;
}

export interface TrackWeekStats {
  trackId: string;
  plannedFull: number;
  plannedToDate: number; // excludes excused
  actual: number;
  adherence: number | null; // %
  scheduled: number; // sessions so far (through today)
  completed: number;
  excused: number;
  missed: number; // before today, nothing logged
  partial: number; // before today, time logged but not completed
}

export function trackWeekStats(trackId: string, today: ISODate, ctx: StatsCtx): TrackWeekStats {
  const t: TrackWeekStats = {
    trackId,
    plannedFull: 0,
    plannedToDate: 0,
    actual: 0,
    adherence: null,
    scheduled: 0,
    completed: 0,
    excused: 0,
    missed: 0,
    partial: 0,
  };
  for (const d of weekDaysISO(today)) {
    for (const r of rowsFor(d, ctx)) {
      if (!r.slot.trackIds.includes(trackId)) continue;
      t.actual += r.actual;
      if (r.offSchedule) continue;
      t.plannedFull += r.planned;
      if (d > today) continue;
      t.scheduled++;
      if (r.completed) t.completed++;
      if (r.excused) t.excused++;
      else {
        t.plannedToDate += r.planned;
        if (d < today && !r.completed) {
          if (r.actual > 0) t.partial++;
          else t.missed++;
        }
      }
    }
  }
  t.adherence = t.plannedToDate > 0 ? Math.round((t.actual / t.plannedToDate) * 100) : null;
  return t;
}

// ---------------------------------------------------------------- cumulative

/** Sum of logged minutes for a track since the sprint start (all logs if no start date). */
export function cumulativeMinutes(trackId: string, ctx: StatsCtx): number {
  const start = ctx.config.startDate;
  let total = 0;
  for (const log of Object.values(ctx.logs)) {
    if (start && log.date < start) continue;
    for (const e of Object.values(log.entries)) {
      if (slotById(e.slotId)?.trackIds.includes(trackId)) total += e.actualMinutes;
    }
  }
  return total;
}

// ---------------------------------------------------------------- streak

const STREAK_LOOKBACK_DAYS = 400;

/**
 * Habit streak: walk back from `today` over days the track was scheduled. Completed
 * extends, excused (paused/skipped) is skipped, unscheduled is skipped, otherwise break.
 * Today only counts if completed; an unfinished today never breaks the streak.
 */
export function streakFor(trackId: string, today: ISODate, ctx: StatsCtx): number {
  const floor = ctx.config.startDate ?? addDaysISO(today, -STREAK_LOOKBACK_DAYS);
  let streak = 0;
  let d = today;
  let guard = 0;
  while (d >= floor && guard++ < STREAK_LOOKBACK_DAYS) {
    const rows = rowsFor(d, ctx).filter((r) => !r.offSchedule && r.slot.trackIds.includes(trackId));
    if (rows.length > 0) {
      const completed = rows.some((r) => r.completed);
      const excused = rows.every((r) => r.excused);
      if (completed) streak++;
      else if (!excused && d !== today) break;
    }
    d = addDaysISO(d, -1);
  }
  return streak;
}

// ---------------------------------------------------------------- guardrail

export interface WeekGuard {
  warn: boolean;
  missed: number; // nothing logged
  partial: number; // logged but not completed
  ratio: number | null; // actual / planned-through-yesterday (whole week once it is over)
  reasons: string[];
}

export interface GuardrailStatus extends WeekGuard {
  /** Consecutive warning weeks ending with this one; 0 when this week is fine so far. */
  streak: number;
  /** Consecutive warning weeks ending with *last* week. */
  previousStreak: number;
  /** Warning flags for the last N weeks, oldest first (last = this week). */
  history: boolean[];
}

/** Guardrail for the week of `anchor`, judged as of `today`. */
export function weekGuard(anchor: ISODate, today: ISODate, ctx: StatsCtx): WeekGuard {
  const w = weekSummary(today, ctx, anchor);
  const reasons: string[] = [];
  // Spec: "missed" = scheduled and not completed; a partial session still counts here.
  const incomplete = w.missed + w.partial;
  if (incomplete >= GUARDRAIL.missedSessionsWarn) {
    reasons.push(
      w.partial > 0
        ? `${incomplete} sessions not completed (${w.partial} partial)`
        : `${incomplete} sessions missed`,
    );
  }
  // Compare logged minutes against what was planned up to yesterday, so an early-morning
  // check does not trip the warning before the day has started.
  const lastJudged = w.weekEnd < today ? w.weekEnd : addDaysISO(today, -1);
  const plannedThrough = eachDayISO(w.weekStart, lastJudged).reduce((sum, d) => sum + dayTotals(d, ctx).plannedEffective, 0);
  const ratio = plannedThrough > 0 ? w.actual / plannedThrough : null;
  if (ratio !== null && ratio < GUARDRAIL.weeklyRatioWarn) {
    reasons.push(`logged ${Math.round(ratio * 100)}% of planned time`);
  }
  return { warn: reasons.length > 0, missed: w.missed, partial: w.partial, ratio, reasons };
}

/**
 * This week's guardrail plus how sustained it is: the plan's rule is "2+ sustained warning
 * signs -> cut load ~20%", so the advisory only escalates from the second week in a row.
 */
export function guardrail(today: ISODate, ctx: StatsCtx, weeks = 4): GuardrailStatus {
  const history: boolean[] = [];
  for (let i = weeks - 1; i >= 1; i--) history.push(weekGuard(addDaysISO(today, -7 * i), today, ctx).warn);
  const current = weekGuard(today, today, ctx);
  history.push(current.warn);
  let previousStreak = 0;
  for (let i = history.length - 2; i >= 0 && history[i]; i--) previousStreak++;
  const streak = current.warn ? previousStreak + 1 : 0;
  return { ...current, streak, previousStreak, history };
}

// ---------------------------------------------------------------- day status

export type DayStatus = "future" | "none" | "open" | "paused" | "done" | "partial" | "missed";

/**
 * One-glance verdict for a day. `none` = nothing scheduled (pre-sprint); `open` = today with
 * nothing logged yet; `paused` = the day (or everything on it) was excused.
 */
export function dayStatus(date: ISODate, today: ISODate, ctx: StatsCtx): DayStatus {
  if (date > today) return "future";
  const log = ctx.logs[date];
  const rows = rowsFor(date, ctx).filter((r) => !r.offSchedule);
  if (rows.length === 0) return "none";
  if (log?.paused) return "paused";
  const active = rows.filter((r) => !r.excused);
  if (active.length === 0) return "paused";
  const completed = active.filter((r) => r.completed).length;
  const logged = active.some((r) => r.actual > 0);
  if (completed === active.length) return "done";
  if (completed > 0 || logged) return "partial";
  return date === today ? "open" : "missed";
}

// ---------------------------------------------------------------- notes

export interface DatedNote {
  date: ISODate;
  slotId: string;
  label: string;
  note: string;
}

/** The most recent per-task daily notes for a track, newest first. */
export function recentTaskNotes(trackId: string, ctx: StatsCtx, n = 5): DatedNote[] {
  const out: DatedNote[] = [];
  const dates = Object.keys(ctx.logs).sort().reverse();
  for (const d of dates) {
    for (const e of Object.values(ctx.logs[d].entries)) {
      if (!e.note.trim()) continue;
      const slot = slotById(e.slotId);
      if (!slot?.trackIds.includes(trackId)) continue;
      out.push({ date: d, slotId: e.slotId, label: slot.label, note: e.note.trim() });
    }
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}

// ---------------------------------------------------------------- trend

export interface WeekPoint {
  weekStart: ISODate;
  actual: number;
  planned: number; // effective (excused removed), through today
}

/** Last `n` calendar weeks ending with the week of `today`, oldest first. */
export function weeklyTrend(today: ISODate, n: number, ctx: StatsCtx, trackId?: string): WeekPoint[] {
  const out: WeekPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const anchor = addDaysISO(today, -7 * i);
    const point: WeekPoint = { weekStart: weekStartISO(anchor), actual: 0, planned: 0 };
    for (const d of weekDaysISO(anchor)) {
      if (d > today) break;
      for (const r of rowsFor(d, ctx)) {
        if (trackId && !r.slot.trackIds.includes(trackId)) continue;
        point.actual += r.actual;
        if (!r.offSchedule && !r.excused) point.planned += r.planned;
      }
    }
    out.push(point);
  }
  return out;
}

// ---------------------------------------------------------------- weekly review nudge

/**
 * Show the review card from the last Friday of the month through the Saturday after it,
 * unless a review for that week already exists. Returns the week key to save under.
 */
export function reviewNudgeFor(today: ISODate, reviews: Record<ISODate, WeeklyReview>): ISODate | null {
  const friday = dayOfWeek(today) === 6 ? addDaysISO(today, -1) : today;
  if (!isLastFridayOfMonth(friday)) return null;
  const key = weekStartISO(friday);
  return reviews[key] ? null : key;
}
