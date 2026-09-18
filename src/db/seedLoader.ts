import type { SprintDB } from "./dexie";
import { SEED_TRACKS } from "../seed/tracks";
import { SEED_MILESTONES } from "../seed/milestones";
import { DEFAULT_CONFIG } from "../seed/config";
import type { DailyLog, ScratchCard, SprintConfig, TaskEntry } from "../types";

/**
 * Loads seed data on first run and back-fills anything missing on later runs (a new track
 * or milestone added in code, a new config field). Never overwrites user-changed rows.
 */
export async function ensureSeeded(db: SprintDB): Promise<void> {
  await db.transaction("rw", db.tracks, db.config, db.milestones, db.scratchCards, async () => {
    const trackIds = new Set((await db.tracks.toArray()).map((t) => t.id));
    const missingTracks = SEED_TRACKS.filter((t) => !trackIds.has(t.id));
    if (missingTracks.length) await db.tracks.bulkAdd(missingTracks);

    const milestoneIds = new Set((await db.milestones.toArray()).map((m) => m.id));
    const missingMilestones = SEED_MILESTONES.filter((m) => !milestoneIds.has(m.id));
    if (missingMilestones.length) await db.milestones.bulkAdd(missingMilestones);

    const cardIds = new Set((await db.scratchCards.toArray()).map((c) => c.trackId));
    const missingCards: ScratchCard[] = SEED_TRACKS.filter((t) => !cardIds.has(t.id)).map((t) => ({
      trackId: t.id,
      notes: "",
      openQuestions: [],
    }));
    if (missingCards.length) await db.scratchCards.bulkAdd(missingCards);

    const existing = await db.config.get("config");
    const merged: SprintConfig = { ...DEFAULT_CONFIG, ...(existing ?? {}), id: "config" };
    await db.config.put(merged);
  });
}

/** Fill fields added after a log was written (older backups, future schema growth). */
export function normalizeLog(log: DailyLog): DailyLog {
  const entries: Record<string, TaskEntry> = {};
  for (const [slotId, e] of Object.entries(log.entries ?? {})) {
    entries[slotId] = {
      slotId: e.slotId ?? slotId,
      plannedMinutes: e.plannedMinutes ?? 0,
      actualMinutes: e.actualMinutes ?? 0,
      completed: e.completed ?? false,
      note: e.note ?? "",
      skipped: e.skipped ?? false,
      skipReason: e.skipReason ?? "",
      adjustReason: e.adjustReason ?? "",
      ...(e.originalPlannedMinutes !== undefined ? { originalPlannedMinutes: e.originalPlannedMinutes } : {}),
      ...(e.minutesAutoFilled ? { minutesAutoFilled: true } : {}),
      ...(e.timerStartedAt !== undefined ? { timerStartedAt: e.timerStartedAt } : {}),
    };
  }
  return {
    date: log.date,
    entries,
    dayNote: log.dayNote ?? "",
    paused: log.paused ?? false,
    pauseReason: log.pauseReason ?? "",
  };
}
