import type { PhaseId, SprintConfig } from "../types";
import { daysBetween, type ISODate } from "./dates";

/** Everything the schedule logic needs to place a date inside the sprint. */
export interface SprintCtx {
  config: SprintConfig;
  /** Dates whose DailyLog is paused. Drives the sprint shift when `pauseExtendsSprint`. */
  pausedDates: ReadonlySet<ISODate>;
}

/**
 * 0-based effective day index within the sprint. Negative before the start date.
 * When `pauseExtendsSprint` is on, paused days *before* `date` are not counted, so the
 * sprint calendar stretches by one day per pause (the paused day itself keeps its week).
 */
export function sprintDayIndex(date: ISODate, ctx: SprintCtx): number | null {
  const { startDate, pauseExtendsSprint } = ctx.config;
  if (!startDate) return null;
  const calendarDays = daysBetween(startDate, date);
  if (calendarDays < 0) return calendarDays;
  if (!pauseExtendsSprint) return calendarDays;
  let paused = 0;
  for (const p of ctx.pausedDates) if (p >= startDate && p < date) paused++;
  return calendarDays - paused;
}

/** 1-based sprint week; 0 = before the sprint starts; null = no start date yet. */
export function sprintWeek(date: ISODate, ctx: SprintCtx): number | null {
  const idx = sprintDayIndex(date, ctx);
  if (idx === null) return null;
  if (idx < 0) return 0;
  return Math.floor(idx / 7) + 1;
}

export function phaseFor(date: ISODate, ctx: SprintCtx): PhaseId {
  const week = sprintWeek(date, ctx);
  if (week === null || week === 0) return "phase1";
  return week <= ctx.config.phase1Weeks ? "phase1" : "phase2";
}

/** Header label: "Sprint - Week 2", "Sprint starts in 3 days", ... */
export function sprintLabel(date: ISODate, ctx: SprintCtx): string {
  const idx = sprintDayIndex(date, ctx);
  if (idx === null) return "Sprint not started";
  if (idx < 0) return idx === -1 ? "Sprint starts tomorrow" : `Sprint starts in ${-idx} days`;
  const week = Math.floor(idx / 7) + 1;
  const phase = week <= ctx.config.phase1Weeks ? "" : " · Phase 2";
  return `Sprint · Week ${week}${phase}`;
}
