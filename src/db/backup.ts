import type { SprintDB } from "./dexie";
import type { BackupFile, Snapshot, SnapshotMeta, SprintConfig } from "../types";
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

// ---------------------------------------------------------------- snapshots

export const toMeta = (s: Snapshot): SnapshotMeta => ({ id: s.id, takenAt: s.takenAt, reason: s.reason, bytes: s.bytes });

/**
 * Store a full copy of the app data. Returns null (and stores nothing) when the data is
 * identical to the newest snapshot, so a quiet week does not pile up copies.
 */
export async function takeSnapshot(db: SprintDB, reason: Snapshot["reason"], now = Date.now()): Promise<Snapshot | null> {
  const backup = await exportAll(db);
  const json = JSON.stringify({ ...backup, exportedAt: new Date(now).toISOString() });
  const latest = await db.backups.orderBy("takenAt").last();
  if (latest && reason !== "before-restore" && sameData(latest.json, json)) return null;
  const snap: Snapshot = { id: new Date(now).toISOString(), takenAt: now, reason, bytes: json.length, json };
  await db.backups.put(snap);
  return snap;
}

/** Compare two backup JSON texts ignoring bookkeeping timestamps the backup job itself changes. */
function sameData(a: string, b: string): boolean {
  const strip = (j: string) => j.replace(/"(exportedAt|lastAutoBackupAt|lastExportAt)":("[^"]*"|\d+|null)/g, "");
  return strip(a) === strip(b);
}

export async function listSnapshots(db: SprintDB): Promise<SnapshotMeta[]> {
  const rows = await db.backups.orderBy("takenAt").reverse().toArray();
  return rows.map(toMeta);
}

/** Delete the oldest snapshots beyond `keep`, never touching the newest one. */
export async function pruneSnapshots(db: SprintDB, keep: number): Promise<number> {
  const rows = await db.backups.orderBy("takenAt").reverse().toArray();
  const extra = rows.slice(Math.max(1, keep));
  if (extra.length) await db.backups.bulkDelete(extra.map((r) => r.id));
  return extra.length;
}

export async function getSnapshot(db: SprintDB, id: string): Promise<Snapshot | undefined> {
  return db.backups.get(id);
}

/** Replace the app data with a snapshot, keeping a "before-restore" copy of the current state first. */
export async function restoreSnapshot(db: SprintDB, id: string): Promise<void> {
  const snap = await db.backups.get(id);
  if (!snap) throw new Error("That snapshot no longer exists.");
  const backup = validateBackup(JSON.parse(snap.json));
  await takeSnapshot(db, "before-restore");
  await importAll(db, backup);
}
