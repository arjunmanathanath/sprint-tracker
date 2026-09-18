import type { DailyLog, ScheduleSlot, TaskEntry } from "../types";
import { PHASES } from "../seed/schedule";
import { dayTypeFor } from "./dayType";
import { phaseFor, sprintDayIndex, type SprintCtx } from "./sprint";
import type { ISODate } from "./dates";

/** All slots of the phase active on `date` (including 0-minute ones). Nothing before the sprint starts. */
export function phaseSlotsFor(date: ISODate, ctx: SprintCtx): ScheduleSlot[] {
  const idx = sprintDayIndex(date, ctx);
  if (idx === null || idx < 0) return [];
  return PHASES[phaseFor(date, ctx)].slots;
}

export function slotById(slotId: string): ScheduleSlot | undefined {
  // Phase 1 is a superset of phase 2 (same slot ids, different minutes).
  return PHASES.phase1.slots.find((s) => s.id === slotId);
}

/** Load factor in effect on `date`: 1 outside the reduced-load window. */
export function loadFactorOn(date: ISODate, ctx: SprintCtx): number {
  const { loadFactor, loadFrom, loadUntil } = ctx.config;
  if (!loadFactor || loadFactor >= 1 || !loadFrom) return 1;
  if (date < loadFrom) return 1;
  if (loadUntil && date > loadUntil) return 1;
  return loadFactor;
}

/**
 * Minutes a slot plans on a date: the day type's base minutes scaled by the load factor,
 * rounded to 5 minutes (never below 5 for a scheduled slot).
 */
export function slotMinutesOn(slot: ScheduleSlot, date: ISODate, ctx: SprintCtx): number {
  const base = slot.minutes[dayTypeFor(date)];
  if (base === 0) return 0;
  const f = loadFactorOn(date, ctx);
  if (f === 1) return base;
  return Math.max(5, Math.round((base * f) / 5) * 5);
}

/** Planned minutes for a slot on a date, from that date's phase, day type and load factor. */
export function plannedMinutesFor(slotId: string, date: ISODate, ctx: SprintCtx): number {
  const slot = phaseSlotsFor(date, ctx).find((s) => s.id === slotId);
  return slot ? slotMinutesOn(slot, date, ctx) : 0;
}

/** Slots scheduled on `date` (planned > 0), in schedule order. */
export function scheduledSlotsFor(date: ISODate, ctx: SprintCtx): ScheduleSlot[] {
  const dt = dayTypeFor(date);
  return phaseSlotsFor(date, ctx).filter((s) => s.minutes[dt] > 0);
}

/** Total planned minutes on `date` (load factor applied). */
export function plannedTotalFor(date: ISODate, ctx: SprintCtx): number {
  return scheduledSlotsFor(date, ctx).reduce((sum, s) => sum + slotMinutesOn(s, date, ctx), 0);
}

export function newTaskEntry(slotId: string, plannedMinutes: number): TaskEntry {
  return {
    slotId,
    plannedMinutes,
    actualMinutes: 0,
    completed: false,
    note: "",
    skipped: false,
    skipReason: "",
    adjustReason: "",
  };
}

/** A fresh log for `date` with every scheduled slot snapshotted (spec 8 "snapshot"). */
export function newDailyLog(date: ISODate, ctx: SprintCtx): DailyLog {
  const entries: Record<string, TaskEntry> = {};
  for (const slot of scheduledSlotsFor(date, ctx)) {
    entries[slot.id] = newTaskEntry(slot.id, slotMinutesOn(slot, date, ctx));
  }
  return { date, entries, dayNote: "", paused: false, pauseReason: "" };
}

/**
 * A row to show/compute for one slot on one date. Comes from the stored entry when the
 * day has a log, otherwise a virtual entry planned from the schedule.
 */
export interface ResolvedEntry {
  slotId: string;
  slot: ScheduleSlot;
  planned: number;
  actual: number;
  completed: boolean;
  /** Excused: whole day paused or this task skipped with a reason. */
  excused: boolean;
  /** Planned minutes were trimmed for this day with a reason (`entry.adjustReason`). */
  trimmed: boolean;
  /** Time logged but not completed. */
  partial: boolean;
  /** True when the slot is not on this date's schedule but the log carries data for it. */
  offSchedule: boolean;
  entry: TaskEntry | null;
}

const hasData = (e: TaskEntry): boolean =>
  e.actualMinutes > 0 ||
  e.completed ||
  e.skipped ||
  e.adjustReason.length > 0 ||
  e.note.length > 0 ||
  e.timerStartedAt !== undefined;

/**
 * Rows for a date: scheduled slots (planned > 0) merged with any stored entries. Stored
 * entries for slots no longer on the schedule are kept only if they carry data, so nothing
 * logged is ever hidden after a start-date or phase change.
 */
export function resolveDay(date: ISODate, log: DailyLog | undefined, ctx: SprintCtx): ResolvedEntry[] {
  const scheduled = scheduledSlotsFor(date, ctx);
  const seen = new Set<string>();
  const rows: ResolvedEntry[] = [];
  const paused = log?.paused ?? false;

  const build = (slot: ScheduleSlot, entry: TaskEntry | null, planned: number, offSchedule: boolean): ResolvedEntry => {
    const actual = entry?.actualMinutes ?? 0;
    const completed = entry?.completed ?? false;
    return {
      slotId: slot.id,
      slot,
      planned,
      actual,
      completed,
      excused: paused || (entry?.skipped ?? false),
      trimmed: (entry?.adjustReason ?? "").length > 0,
      partial: !completed && actual > 0,
      offSchedule,
      entry,
    };
  };

  for (const slot of scheduled) {
    seen.add(slot.id);
    const entry = log?.entries[slot.id] ?? null;
    // A scheduled slot always plans > 0; a 0 snapshot is stale (entry created off-schedule).
    const planned = entry && entry.plannedMinutes > 0 ? entry.plannedMinutes : slotMinutesOn(slot, date, ctx);
    rows.push(build(slot, entry, planned, false));
  }

  if (log) {
    for (const entry of Object.values(log.entries)) {
      if (seen.has(entry.slotId) || !hasData(entry)) continue;
      const slot = slotById(entry.slotId);
      if (!slot) continue;
      rows.push(build(slot, entry, entry.plannedMinutes, true));
    }
  }
  return rows;
}
