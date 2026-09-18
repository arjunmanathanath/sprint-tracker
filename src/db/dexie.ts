import Dexie, { type EntityTable } from "dexie";
import type { DailyLog, Milestone, ScratchCard, SprintConfig, Track, WeeklyReview } from "../types";

// Spec 3: tracks, config (singleton), milestones, dailyLogs (date), scratchCards (trackId), reviews (weekStart).
export class SprintDB extends Dexie {
  tracks!: EntityTable<Track, "id">;
  config!: EntityTable<SprintConfig, "id">;
  milestones!: EntityTable<Milestone, "id">;
  dailyLogs!: EntityTable<DailyLog, "date">;
  scratchCards!: EntityTable<ScratchCard, "trackId">;
  reviews!: EntityTable<WeeklyReview, "weekStart">;

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
  }
}

export const db = new SprintDB();
