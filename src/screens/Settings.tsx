import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { validateBackup } from "../db/backup";
import type { BackupFile } from "../types";
import { EXPORT_REMINDER_DAYS } from "../seed/config";
import { dayOfWeek, formatLong, formatShort, minutesToHours, todayISO } from "../logic/dates";
import { loadFactorOn } from "../logic/schedule";
import { useStatsCtx } from "../store/hooks";
import { LoadSheet } from "../components/LoadSheet";
import { folderBackupSupported } from "../db/fsBackup";
import type { SnapshotMeta } from "../types";
import { Button, Card, Pill, SectionTitle, Sheet } from "../components/ui";

export function Settings() {
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const logs = useStore((s) => s.logs);
  const exportData = useStore((s) => s.exportData);
  const markExported = useStore((s) => s.markExported);
  const importData = useStore((s) => s.importData);
  const resetData = useStore((s) => s.resetData);
  const setTab = useStore((s) => s.setTab);
  const setLoad = useStore((s) => s.setLoad);
  const clearLoad = useStore((s) => s.clearLoad);
  const ctx = useStatsCtx();
  const [loadOpen, setLoadOpen] = useState(false);
  const loadFactor = loadFactorOn(todayISO(), ctx);

  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [pendingRestore, setPendingRestore] = useState<SnapshotMeta | null>(null);
  const [showAllSnapshots, setShowAllSnapshots] = useState(false);
  const snapshots = useStore((s) => s.snapshots);
  const backupDir = useStore((s) => s.backupDir);
  const setAutoBackup = useStore((s) => s.setAutoBackup);
  const runNightlyBackup = useStore((s) => s.runNightlyBackup);
  const restoreFromSnapshot = useStore((s) => s.restoreFromSnapshot);
  const deleteSnapshot = useStore((s) => s.deleteSnapshot);
  const deleteAllSnapshots = useStore((s) => s.deleteAllSnapshots);
  const readSnapshot = useStore((s) => s.readSnapshot);
  const chooseBackupDir = useStore((s) => s.chooseBackupDir);
  const reauthorizeBackupDir = useStore((s) => s.reauthorizeBackupDir);
  const forgetBackupDir = useStore((s) => s.forgetBackupDir);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [storage, setStorage] = useState<{ persisted: boolean | null; usage: number | null }>({ persisted: null, usage: null });
  useEffect(() => {
    void (async () => {
      if (!("storage" in navigator)) return;
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
      const est = navigator.storage.estimate ? await navigator.storage.estimate() : null;
      setStorage({ persisted, usage: est?.usage ?? null });
    })();
  }, []);

  const logCount = Object.keys(logs).length;
  const daysSinceExport = config.lastExportAt ? Math.floor((Date.now() - config.lastExportAt) / 86_400_000) : null;
  const exportDue = logCount > 0 && (daysSinceExport === null || daysSinceExport >= EXPORT_REMINDER_DAYS);

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File(["{}"], "probe.json", { type: "application/json" })] });

  /**
   * Export: on phones the share sheet ("Save to Files", Drive, ...) is the reliable path,
   * especially for home-screen PWAs on iOS where blob downloads may silently fail; elsewhere
   * download directly. `lastExportAt` is only marked once the file has actually gone somewhere.
   */
  /** Hand a JSON text to the user via the share sheet or a download. Returns false if cancelled. */
  const deliver = async (json: string, name: string, mode: "share" | "download"): Promise<boolean> => {
    if (mode === "share") {
      const file = new File([json], name, { type: "application/json" });
      try {
        await navigator.share({ files: [file], title: "Sprint Tracker backup" });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return false; // user closed the share sheet
        throw err;
      }
      return true;
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  };

  const doExport = async (mode: "share" | "download") => {
    setBusy(true);
    try {
      const backup = await exportData();
      const name = `sprint-tracker-${todayISO()}.json`;
      const summary = `${backup.dailyLogs.length} days, ${backup.scratchCards.length} scratch cards`;
      if (!(await deliver(JSON.stringify(backup, null, 2), name, mode))) return;
      markExported();
      setMessage({ tone: "ok", text: `${mode === "share" ? "Shared" : "Downloaded"} ${name} (${summary}).` });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Export failed." });
    } finally {
      setBusy(false);
    }
  };

  const saveSnapshot = async (meta: SnapshotMeta) => {
    setBusy(true);
    try {
      const snap = await readSnapshot(meta.id);
      if (!snap) throw new Error("That snapshot no longer exists.");
      const name = `sprint-tracker-${meta.id.slice(0, 10)}.json`;
      if (await deliver(snap.json, name, canShareFiles ? "share" : "download")) {
        markExported();
        setMessage({ tone: "ok", text: `Saved snapshot ${name}.` });
      }
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not save the snapshot." });
    } finally {
      setBusy(false);
    }
  };

  const snapshotNow = async () => {
    setBusy(true);
    try {
      const r = await runNightlyBackup(true);
      if (r.error) setMessage({ tone: "error", text: r.error });
      else if (r.snapshot) setMessage({ tone: "ok", text: `Snapshot taken${r.fileWritten ? " and written to the backup folder" : ""}.` });
      else setMessage({ tone: "ok", text: `Nothing changed since the last snapshot${r.fileWritten ? "; folder file refreshed" : ""}.` });
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (!pendingRestore) return;
    setBusy(true);
    try {
      await restoreFromSnapshot(pendingRestore.id);
      setMessage({ tone: "ok", text: `Restored the snapshot from ${fmtWhen(pendingRestore.takenAt)}. A copy of the previous state was kept.` });
      setPendingRestore(null);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Restore failed." });
    } finally {
      setBusy(false);
    }
  };

  const withBusy = async (fn: () => Promise<void>, failText: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessage({ tone: "error", text: err instanceof Error ? err.message : failText });
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const backup = validateBackup(JSON.parse(text));
      setPendingImport(backup);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not read that file." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    try {
      await importData(pendingImport);
      setMessage({ tone: "ok", text: `Restored ${pendingImport.dailyLogs.length} days from backup.` });
      setPendingImport(null);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Import failed." });
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setBusy(true);
    try {
      await resetData();
      setConfirmReset(false);
      setMessage({ tone: "ok", text: "All data cleared. Pick a start date to begin again." });
    } finally {
      setBusy(false);
    }
  };

  const requestPersist = async () => {
    if (!navigator.storage?.persist) return;
    const ok = await navigator.storage.persist();
    setStorage((s) => ({ ...s, persisted: ok }));
  };


  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur px-4 pt-safe">
        <div className="flex items-baseline justify-between pt-4 pb-3 border-b border-border">
          <h1 className="text-base font-semibold">Settings</h1>
          <span className="text-xs text-muted">local only · no account</span>
        </div>
      </header>

      <div className="px-4 pt-3">
        {message && (
          <div
            className={`mb-3 rounded-xl px-3 py-2 text-xs ${message.tone === "ok" ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}
            role="status"
          >
            {message.text}
          </div>
        )}

        <SectionTitle>Sprint</SectionTitle>
        <Card className="divide-y divide-border">
          <div className="p-3.5">
            <label className="block text-sm" htmlFor="cfg-start">
              Start date
            </label>
            <p className="text-xs text-muted mb-2">Week 1, day 1. Changing this re-numbers every week; logged days keep their planned minutes.</p>
            <input
              id="cfg-start"
              type="date"
              value={config.startDate ?? ""}
              onChange={(e) => e.target.value && setConfig({ startDate: e.target.value })}
              className="w-full rounded-xl bg-surface-2 border border-border px-3 py-2 text-sm tabular outline-none focus:border-accent"
            />
            {config.startDate && (
              <p className="text-xs text-muted mt-1.5">
                {formatLong(config.startDate)}
                {dayOfWeek(config.startDate) !== 0 && " · not a Sunday, so sprint weeks and calendar weeks differ"}
              </p>
            )}
          </div>

          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label className="block text-sm" htmlFor="cfg-p1">
                Phase 1 length
              </label>
              <p className="text-xs text-muted">Weeks of Java refresher before Architecture takes its time.</p>
            </div>
            <NumberField
              id="cfg-p1"
              value={config.phase1Weeks}
              min={0}
              max={52}
              unit="wk"
              onCommit={(n) => setConfig({ phase1Weeks: n })}
            />
          </div>

          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label className="block text-sm" htmlFor="cfg-target">
                Weekly target
              </label>
              <p className="text-xs text-muted">{minutesToHours(config.weeklyTargetMinutes)} · the schedule plans 3030 min (50.5 h).</p>
            </div>
            <NumberField
              id="cfg-target"
              value={config.weeklyTargetMinutes}
              min={0}
              max={7 * 24 * 60}
              unit="min"
              onCommit={(n) => setConfig({ weeklyTargetMinutes: n })}
            />
          </div>

          <label className="p-3.5 flex items-center justify-between gap-3 cursor-pointer">
            <div className="min-w-0">
              <span className="block text-sm">Paused days extend the sprint</span>
              <span className="block text-xs text-muted">
                Each paused day pushes the sprint calendar forward by a day, so the 4-week Java window keeps its full length. Off:
                pauses are excused but the calendar stays fixed.
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.pauseExtendsSprint}
              onChange={(e) => setConfig({ pauseExtendsSprint: e.target.checked })}
              className="w-6 h-6 shrink-0 accent-[var(--color-accent)]"
            />
          </label>
        </Card>

        <SectionTitle>Load</SectionTitle>
        <Card className="p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm">
              {loadFactor < 1 ? `Reduced to ${Math.round(loadFactor * 100)}%` : "Full plan (100%)"}
              {loadFactor < 1 && config.loadUntil && <span className="text-muted"> · until {formatShort(config.loadUntil)}</span>}
              {loadFactor < 1 && !config.loadUntil && <span className="text-muted"> · until restored</span>}
            </p>
            <p className="text-xs text-muted">
              The guardrail's "cut load ~20 %" rule, made real: every planned session scales down for a while. Days already
              logged keep their numbers.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => setLoadOpen(true)}>
              {loadFactor < 1 ? "Adjust" : "Cut load"}
            </Button>
            {loadFactor < 1 && (
              <button type="button" onClick={clearLoad} className="text-xs text-muted underline underline-offset-2">
                Restore
              </button>
            )}
          </div>
        </Card>
        <LoadSheet
          open={loadOpen}
          ctx={ctx}
          onConfirm={(factor, from, until) => {
            setLoad(factor, from, until);
            setLoadOpen(false);
          }}
          onRestore={() => {
            clearLoad();
            setLoadOpen(false);
          }}
          onClose={() => setLoadOpen(false)}
        />

        <SectionTitle>Automatic backup</SectionTitle>
        <Card className="divide-y divide-border">
          <label className="p-3.5 flex items-center justify-between gap-3 cursor-pointer">
            <div className="min-w-0">
              <span className="block text-sm">Nightly snapshot</span>
              <span className="block text-xs text-muted">
                A full copy is stored in this browser every night at the time below (or on the next open if the app was closed).
                Only changed data is kept; the newest {config.autoBackup.keep} are retained.
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.autoBackup.enabled}
              onChange={(e) => setAutoBackup({ enabled: e.target.checked })}
              className="w-6 h-6 shrink-0 accent-[var(--color-accent)]"
            />
          </label>
          <div className="p-3.5 flex items-center justify-between gap-3">
            <label className="text-sm" htmlFor="cfg-backup-time">
              Time
            </label>
            <div className="flex items-center gap-3">
              <input
                id="cfg-backup-time"
                type="time"
                value={config.autoBackup.time}
                onChange={(e) => e.target.value && setAutoBackup({ time: e.target.value })}
                className="rounded-xl bg-surface-2 border border-border px-3 py-2 text-sm tabular outline-none focus:border-accent"
              />
              <NumberField
                id="cfg-backup-keep"
                value={config.autoBackup.keep}
                min={3}
                max={365}
                unit="kept"
                onCommit={(n) => setAutoBackup({ keep: n })}
              />
            </div>
          </div>
          <div className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {config.lastAutoBackupAt ? `Last run ${fmtWhen(config.lastAutoBackupAt)}` : "Not run yet"} ·{" "}
                {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
                {snapshots.length > 0 && ` · ${(snapshots.reduce((sum, m) => sum + m.bytes, 0) / 1024).toFixed(0)} KB`}
              </p>
              <Button variant="secondary" className="min-h-9 px-3 text-xs shrink-0" onClick={() => void snapshotNow()} disabled={busy}>
                Snapshot now
              </Button>
            </div>
            {snapshots.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {(showAllSnapshots ? snapshots : snapshots.slice(0, 5)).map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 min-w-0 truncate tabular">
                      {fmtWhen(m.takenAt)}
                      <span className="text-muted"> · {(m.bytes / 1024).toFixed(0)} KB</span>
                    </span>
                    <Pill tone={m.reason === "before-restore" ? "warn" : m.reason === "manual" ? "accent" : "muted"}>{m.reason}</Pill>
                    <button type="button" onClick={() => setPendingRestore(m)} className="text-accent underline underline-offset-2" disabled={busy}>
                      Restore
                    </button>
                    <button type="button" onClick={() => void saveSnapshot(m)} className="text-muted underline underline-offset-2" disabled={busy}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void withBusy(() => deleteSnapshot(m.id), "Could not delete.")}
                      className="text-muted underline underline-offset-2"
                      disabled={busy}
                      aria-label="Delete snapshot"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {snapshots.length > 5 && (
              <button type="button" onClick={() => setShowAllSnapshots((v) => !v)} className="mt-2 text-[11px] text-muted underline underline-offset-2">
                {showAllSnapshots ? "Show fewer" : `Show all ${snapshots.length}`}
              </button>
            )}
          </div>
          {folderBackupSupported() ? (
            <div className="p-3.5">
              <p className="text-sm">Also write a file to a folder</p>
              <p className="text-xs text-muted">
                Desktop Chrome/Edge only. Each run also writes <span className="tabular">sprint-tracker-YYYY-MM-DD.json</span> to a
                folder you pick once, so a copy lives outside the browser (put it in a synced folder for off-device safety).
              </p>
              {backupDir ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="tabular">
                    Folder: <span className="text-text">{backupDir.name}</span>
                  </span>
                  {backupDir.permission === "granted" ? (
                    <Pill tone="ok">writable</Pill>
                  ) : (
                    <>
                      <Pill tone="warn">needs permission</Pill>
                      <button
                        type="button"
                        onClick={() => void withBusy(reauthorizeBackupDir, "Could not re-authorise the folder.")}
                        className="text-accent underline underline-offset-2"
                        disabled={busy}
                      >
                        Allow again
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void withBusy(chooseBackupDir, "Could not choose a folder.")}
                    className="text-muted underline underline-offset-2"
                    disabled={busy}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => void withBusy(forgetBackupDir, "Could not forget the folder.")}
                    className="text-muted underline underline-offset-2"
                    disabled={busy}
                  >
                    Forget
                  </button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-2 min-h-9 px-3 text-xs"
                  onClick={() => void withBusy(chooseBackupDir, "Could not choose a folder.")}
                  disabled={busy}
                >
                  Choose folder…
                </Button>
              )}
            </div>
          ) : (
            <p className="p-3.5 text-xs text-muted">
              This browser cannot write files on a schedule; snapshots stay inside the app. Use Export (below) now and then for an
              off-device copy.
            </p>
          )}
        </Card>

        <SectionTitle>Export &amp; import</SectionTitle>
        <Card className="p-3.5">
          <p className="text-xs text-muted">
            Everything lives in this browser on this device. Export a JSON backup now and then; import it to restore or move phones.
          </p>
          <p className={`text-xs mt-1.5 ${exportDue ? "text-warn" : "text-muted"}`}>
            {daysSinceExport === null
              ? logCount > 0
                ? "Never exported."
                : "Nothing to back up yet."
              : `Last export ${daysSinceExport === 0 ? "today" : `${daysSinceExport} days ago`}.`}
            {" "}{logCount} day{logCount === 1 ? "" : "s"} logged.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => void doExport(canShareFiles ? "share" : "download")} disabled={busy}>
              Export JSON
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
              aria-label="Import backup file"
            />
          </div>
          {canShareFiles && (
            <p className="text-[11px] text-muted mt-2">
              Export opens the share sheet (Save to Files, Drive...).{" "}
              <button type="button" className="underline underline-offset-2" onClick={() => void doExport("download")} disabled={busy}>
                Download instead
              </button>
            </p>
          )}
          {storage.persisted !== null && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>
                Storage {storage.persisted ? "is persistent" : "may be cleared under pressure"}
                {storage.usage !== null && ` · ${(storage.usage / 1024).toFixed(0)} KB used`}
              </span>
              {!storage.persisted && (
                <button type="button" onClick={requestPersist} className="text-accent underline underline-offset-2">
                  Keep persistent
                </button>
              )}
            </div>
          )}
        </Card>

        <SectionTitle>Danger zone</SectionTitle>
        <Card className="p-3.5">
          <p className="text-xs text-muted">
            Deletes every log, note, question, review and setting on this device. Snapshots are kept (a copy is taken first), so
            a reset can be undone from the list above.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={() => setConfirmReset(true)} disabled={busy}>
              Reset all data
            </Button>
            <Button
              variant="secondary"
              onClick={() => void withBusy(deleteAllSnapshots, "Could not delete snapshots.")}
              disabled={busy || snapshots.length === 0}
            >
              Delete snapshots
            </Button>
          </div>
        </Card>

        <p className="text-[11px] text-muted text-center mt-6">
          Sprint Tracker · v{__APP_VERSION__} · offline-first PWA ·{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => setTab("today")}>
            back to today
          </button>
        </p>
      </div>

      <Sheet open={pendingImport !== null} onClose={() => setPendingImport(null)} title="Replace all data?">
        {pendingImport && (
          <p className="text-sm text-muted">
            This backup was exported on {new Date(pendingImport.exportedAt).toLocaleString()} and holds{" "}
            {pendingImport.dailyLogs.length} logged day{pendingImport.dailyLogs.length === 1 ? "" : "s"}. Everything currently on this
            device will be replaced.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setPendingImport(null)}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={doImport} disabled={busy}>
            Replace
          </Button>
        </div>
      </Sheet>

      <Sheet open={pendingRestore !== null} onClose={() => setPendingRestore(null)} title="Restore this snapshot?">
        {pendingRestore && (
          <p className="text-sm text-muted">
            Everything on this device will be replaced by the snapshot from {fmtWhen(pendingRestore.takenAt)} (
            {pendingRestore.reason}). A copy of the current state is kept first, so this can be undone.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setPendingRestore(null)}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => void doRestore()} disabled={busy}>
            Restore
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset all data?">
        <p className="text-sm text-muted">This cannot be undone. {logCount} logged day{logCount === 1 ? "" : "s"} will be deleted.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={doReset} disabled={busy}>
            Delete everything
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Number input that keeps a local draft while typing and only commits a valid value on
 * blur / Enter, so clearing the field to type a new number never writes 0 to the config.
 */
function NumberField({
  id,
  value,
  min,
  max,
  unit,
  onCommit,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(draft));
    if (draft.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) {
      if (n !== value) onCommit(n);
      setDraft(String(n));
    } else {
      setDraft(String(value));
    }
  };
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-24 rounded-xl bg-surface-2 border border-border px-3 py-2 text-sm tabular text-right outline-none focus:border-accent"
      />
      <span className="text-xs text-muted">{unit}</span>
    </div>
  );
}
