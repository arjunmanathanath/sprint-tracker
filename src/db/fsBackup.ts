import type { SprintDB } from "./dexie";

/**
 * Optional nightly file backup to a folder the user picks once (File System Access API:
 * desktop Chrome/Edge only). The directory handle is kept in IndexedDB; installed PWAs keep
 * the permission across sessions, plain tabs may need a one-tap re-authorisation.
 */

// Minimal WICG declarations that lib.dom does not ship.
type FsPermissionMode = "read" | "readwrite";
interface PermissionHandle {
  queryPermission?(desc: { mode: FsPermissionMode }): Promise<PermissionState>;
  requestPermission?(desc: { mode: FsPermissionMode }): Promise<PermissionState>;
}
type DirHandle = FileSystemDirectoryHandle & PermissionHandle;
interface PickerWindow {
  showDirectoryPicker?(options?: { id?: string; mode?: FsPermissionMode; startIn?: string }): Promise<FileSystemDirectoryHandle>;
}

const KV_KEY = "backupDir";

export const folderBackupSupported = (): boolean =>
  typeof window !== "undefined" && typeof (window as unknown as PickerWindow).showDirectoryPicker === "function";

/** Must be called from a user gesture. */
export async function pickBackupDir(db: SprintDB): Promise<FileSystemDirectoryHandle> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("This browser cannot write to folders (desktop Chrome or Edge only).");
  const handle = await picker({ id: "sprint-tracker-backups", mode: "readwrite", startIn: "documents" });
  await db.kv.put({ key: KV_KEY, value: handle });
  return handle;
}

export async function loadBackupDir(db: SprintDB): Promise<FileSystemDirectoryHandle | null> {
  const row = await db.kv.get(KV_KEY);
  const value = row?.value as FileSystemDirectoryHandle | undefined;
  return value && typeof value === "object" && "name" in value ? value : null;
}

export async function clearBackupDir(db: SprintDB): Promise<void> {
  await db.kv.delete(KV_KEY);
}

/** "granted" | "prompt" | "denied". Pass `request` only from a user gesture. */
export async function backupDirPermission(handle: FileSystemDirectoryHandle, request = false): Promise<PermissionState> {
  const h = handle as DirHandle;
  const current = (await h.queryPermission?.({ mode: "readwrite" })) ?? "granted";
  if (current === "granted" || !request) return current;
  return (await h.requestPermission?.({ mode: "readwrite" })) ?? "denied";
}

/** Write (or overwrite) `name` in the folder. Throws if permission is not granted. */
export async function writeBackupFile(handle: FileSystemDirectoryHandle, name: string, json: string): Promise<void> {
  const file = await handle.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(new Blob([json], { type: "application/json" }));
  } finally {
    await writable.close();
  }
}
