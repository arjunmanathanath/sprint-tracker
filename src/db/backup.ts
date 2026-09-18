import type { SprintDB } from "./dexie";
import type { BackupFile, SprintConfig } from "../types";
import { DEFAULT_CONFIG } from "../seed/config";
import { ensureSeeded, normalizeLog } from "./seedLoader";

export async function exportAll(db: SprintDB): Promise<BackupFile> {
  const [config, tracks, milestones, dailyLogs, scratchCards, reviews] = await Promise.all([
    db.config.get("config"),
    db.tracks.toArray(),
    db.milestones.toArray(),
    db.dailyLogs.toArray(),
    db.scratchCards.toArray(),
    db.reviews.toArray(),
  ]);
  return {
    app: "sprint-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    config: config ?? DEFAULT_CONFIG,
    tracks,
    milestones,
    dailyLogs,
    scratchCards,
    reviews,
  };
}

export function validateBackup(data: unknown): BackupFile {
  if (!data || typeof data !== "object") throw new Error("Not a JSON object.");
  const b = data as Partial<BackupFile>;
  if (b.app !== "sprint-tracker") throw new Error("This file was not exported by Sprint Tracker.");
  if (b.version !== 1) throw new Error(`Unsupported backup version: ${String(b.version)}`);
  for (const key of ["tracks", "milestones", "dailyLogs", "scratchCards", "reviews"] as const) {
    if (!Array.isArray(b[key])) throw new Error(`Backup is missing "${key}".`);
  }
  if (!b.config || typeof b.config !== "object") throw new Error('Backup is missing "config".');
  return b as BackupFile;
}

/** Replaces everything in the DB with the backup contents (all-or-nothing). */
export async function importAll(db: SprintDB, backup: BackupFile): Promise<void> {
  const config: SprintConfig = { ...DEFAULT_CONFIG, ...backup.config, id: "config" };
  await db.transaction(
    "rw",
    [db.tracks, db.config, db.milestones, db.dailyLogs, db.scratchCards, db.reviews],
    async () => {
      await Promise.all([
        db.tracks.clear(),
        db.config.clear(),
        db.milestones.clear(),
        db.dailyLogs.clear(),
        db.scratchCards.clear(),
        db.reviews.clear(),
      ]);
      await db.tracks.bulkPut(backup.tracks);
      await db.config.put(config);
      await db.milestones.bulkPut(backup.milestones);
      await db.dailyLogs.bulkPut(backup.dailyLogs.map(normalizeLog));
      await db.scratchCards.bulkPut(backup.scratchCards);
      await db.reviews.bulkPut(backup.reviews);
    },
  );
  // Back-fill anything the backup predates (new tracks, milestones, config fields).
  await ensureSeeded(db);
}

export async function resetAll(db: SprintDB): Promise<void> {
  await db.transaction(
    "rw",
    [db.tracks, db.config, db.milestones, db.dailyLogs, db.scratchCards, db.reviews],
    async () => {
      await Promise.all([
        db.tracks.clear(),
        db.config.clear(),
        db.milestones.clear(),
        db.dailyLogs.clear(),
        db.scratchCards.clear(),
        db.reviews.clear(),
      ]);
    },
  );
  await ensureSeeded(db);
}
