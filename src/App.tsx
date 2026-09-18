import { useEffect } from "react";
import { useStore } from "./store/useStore";
import { msUntilNextDue } from "./logic/backupSchedule";
import { TabBar } from "./components/TabBar";
import { Onboarding } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { Progress } from "./screens/Progress";
import { Scratch } from "./screens/Scratch";
import { Settings } from "./screens/Settings";

export default function App() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const init = useStore((s) => s.init);
  const tab = useStore((s) => s.tab);
  const startDate = useStore((s) => s.config.startDate);
  const dismissError = useStore((s) => s.dismissError);
  const autoBackupEnabled = useStore((s) => s.config.autoBackup.enabled);
  const autoBackupTime = useStore((s) => s.config.autoBackup.time);
  const runNightlyBackup = useStore((s) => s.runNightlyBackup);

  useEffect(() => {
    void init();
  }, [init]);

  // Nightly backup: run when due (catch-up on open / foreground), and at the scheduled time
  // while the app stays open. A browser app cannot run while closed, so "on next open" is the
  // fallback for nights the app was not running.
  useEffect(() => {
    if (!ready || !startDate || !autoBackupEnabled) return;
    let timer: number | undefined;
    const arm = () => {
      timer = window.setTimeout(async () => {
        await runNightlyBackup();
        arm();
      }, msUntilNextDue(new Date(), autoBackupTime));
    };
    void runNightlyBackup();
    arm();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runNightlyBackup();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, startDate, autoBackupEnabled, autoBackupTime, runNightlyBackup]);

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted text-sm" aria-busy="true">
        Loading…
      </div>
    );
  }

  if (!startDate) return <Onboarding />;

  return (
    <>
      {error && (
        <button
          type="button"
          onClick={dismissError}
          className="fixed top-0 inset-x-0 z-50 bg-danger/90 text-bg text-xs px-4 py-2 text-center pt-safe"
        >
          {error} · tap to dismiss
        </button>
      )}
      {tab === "today" && <Today />}
      {tab === "progress" && <Progress />}
      {tab === "scratch" && <Scratch />}
      {tab === "settings" && <Settings />}
      <TabBar />
    </>
  );
}
