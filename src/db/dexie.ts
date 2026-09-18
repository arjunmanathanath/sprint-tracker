import Dexie, { type EntityTable } from "dexie";
import type { DailyLog, Milestone, ScratchCard, Snapshot, SprintConfig, Track, WeeklyReview } from "../types";

/** Small key/value rows for things that are not app data (e.g. the backup folder handle). */
export interface KvRow {
  key: string;
  value: unknown;
}

// Spec 3: tracks, config (singleton), milestones, dailyLogs (date), scratchCards (trackId), reviews (weekStart).
export class SprintDB extends Dexie {
  tracks!: EntityTable<Track, "id">;
  config!: EntityTable<SprintConfig, "id">;
  milestones!: EntityTable<Milestone, "id">;
  dailyLogs!: EntityTable<DailyLog, "date">;
  scratchCards!: EntityTable<ScratchCard, "trackId">;
  reviews!: EntityTable<WeeklyReview, "weekStart">;
  backups!: EntityTable<Snapshot, "id">;
  kv!: EntityTable<KvRow, "key">;

  constructor(name = "sprint-tracker") {
    super(name);
    this.version(1).stores({
      tracks: "id",
      config: "id",
      milestones: "id, trackId",
      dailyLogs: "date",
      scratchCards: "trackId",
      reviews: "weekStart",
    });
    // v2: nightly snapshots + key/value rows (backup folder handle).
    this.version(2).stores({
      tracks: "id",
      config: "id",
      milestones: "id, trackId",
      dailyLogs: "date",
      scratchCards: "trackId",
      reviews: "weekStart",
      backups: "id, takenAt",
      kv: "key",
    });
  }
}

export const db = new SprintDB();
