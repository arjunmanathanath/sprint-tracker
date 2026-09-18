import type { SprintConfig } from "../types";

// startDate stays null until the user picks it on first launch (default offered = next Sunday).
export const DEFAULT_CONFIG: SprintConfig = {
  id: "config",
  startDate: null,
  phase1Weeks: 4,
  weeklyTargetMinutes: 3030,
  pauseExtendsSprint: true,
  lastExportAt: null,
  loadFactor: 1,
  loadFrom: null,
  loadUntil: null,
};

/** A stopwatch running this long is probably forgotten: warn, and confirm the time on stop. */
export const TIMER_LONG_RUN_MS = 4 * 60 * 60 * 1000;

/** Preset for the guardrail's one-tap action. */
export const LOAD_CUT = { factor: 0.8, days: 14 };

// Guardrail thresholds (spec §8) — tunable.
export const GUARDRAIL = {
  missedSessionsWarn: 4,
  weeklyRatioWarn: 0.7,
};

// Export reminder cadence (spec §9).
export const EXPORT_REMINDER_DAYS = 30;
