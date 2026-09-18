import { useNow } from "../store/hooks";
import { TIMER_LONG_RUN_MS } from "../seed/config";
import { IconPlay, IconStop } from "./Icons";

const pad = (n: number) => n.toString().padStart(2, "0");

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Start/stop control. Elapsed is always derived from the persisted start timestamp. */
export function Stopwatch({
  startedAt,
  onStart,
  onStop,
  color,
  disabled = false,
}: {
  startedAt: number | undefined;
  onStart: () => void;
  onStop: () => void;
  color: string;
  disabled?: boolean;
}) {
  const running = startedAt !== undefined;
  const now = useNow(running);
  if (running) {
    const long = now - startedAt >= TIMER_LONG_RUN_MS;
    return (
      <button
        type="button"
        onClick={onStop}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 min-h-11 min-w-24 justify-center text-bg font-semibold tabular text-sm"
        style={{ background: long ? "var(--color-warn)" : color }}
        aria-label={long ? "Stop stopwatch (running unusually long)" : "Stop stopwatch"}
        title={long ? "Running for a long time - still working?" : undefined}
      >
        <IconStop size={16} />
        {formatElapsed(now - startedAt)}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-xl min-h-11 min-w-11 border border-border bg-surface-2 text-text active:bg-border disabled:opacity-40"
      aria-label="Start stopwatch"
    >
      <IconPlay size={18} />
    </button>
  );
}
