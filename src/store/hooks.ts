import { useEffect, useMemo, useState } from "react";
import { useStore } from "./useStore";
import { buildCtx, type StatsCtx } from "../logic/stats";
import type { Track } from "../types";
import { EXPORT_REMINDER_DAYS } from "../seed/config";

/** Memoised sprint/stats context; recomputed only when config or logs change. */
export function useStatsCtx(): StatsCtx {
  const config = useStore((s) => s.config);
  const logs = useStore((s) => s.logs);
  return useMemo(() => buildCtx(config, logs), [config, logs]);
}

export function useTrackMap(): Record<string, Track> {
  const tracks = useStore((s) => s.tracks);
  return useMemo(() => Object.fromEntries(tracks.map((t) => [t.id, t])), [tracks]);
}

/** Re-renders every `ms` while `active`; returns Date.now() at the last tick. */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

/** True when there is data worth backing up and the last export is older than the reminder cadence. */
export function useExportDue(): boolean {
  const lastExportAt = useStore((s) => s.config.lastExportAt);
  const logCount = useStore((s) => Object.keys(s.logs).length);
  if (logCount < 7) return false;
  if (lastExportAt === null) return true;
  return Date.now() - lastExportAt >= EXPORT_REMINDER_DAYS * 86_400_000;
}
