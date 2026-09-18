import { useEffect, useState } from "react";
import { formatMinutes } from "../logic/dates";
import { formatElapsed } from "./Stopwatch";
import { Button, Sheet } from "./ui";

/**
 * A stopwatch that ran unusually long was probably forgotten. Before banking the elapsed
 * time, ask what was actually worked so the log stays honest.
 */
export function ConfirmMinutesSheet({
  open,
  label,
  elapsedMs,
  planned,
  onConfirm,
  onClose,
}: {
  open: boolean;
  label: string;
  elapsedMs: number;
  planned: number;
  onConfirm: (minutes: number) => void;
  onClose: () => void;
}) {
  const elapsedMin = Math.round(elapsedMs / 60000);
  const [minutes, setMinutes] = useState(planned);
  useEffect(() => {
    if (open) setMinutes(planned > 0 ? planned : Math.min(elapsedMin, 60));
  }, [open, planned, elapsedMin]);

  const clamp = (n: number) => Math.max(0, Math.min(elapsedMin, Math.round(n)));
  const presets = [
    { label: `Planned · ${formatMinutes(planned)}`, value: planned, show: planned > 0 },
    { label: "1 h", value: 60, show: true },
    { label: "2 h", value: 120, show: elapsedMin >= 120 },
    { label: `All · ${formatMinutes(elapsedMin)}`, value: elapsedMin, show: true },
  ].filter((p) => p.show);

  return (
    <Sheet open={open} onClose={onClose} title="Still working?">
      <p className="text-sm text-muted mb-3">
        The stopwatch on <span className="text-text">{label}</span> has run for {formatElapsed(elapsedMs)}. How long did
        you actually work? Only that is logged.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={elapsedMin}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          onBlur={() => setMinutes(clamp(Number.isFinite(minutes) ? minutes : planned))}
          aria-label="Minutes worked"
          className="flex-1 rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-center text-lg font-semibold tabular outline-none focus:border-accent"
        />
        <span className="text-xs text-muted w-8">min</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setMinutes(clamp(p.value))}
            className="rounded-full px-3 py-1.5 text-xs border bg-surface-2 border-border text-muted"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Keep running
        </Button>
        <Button variant="primary" className="flex-1" onClick={() => onConfirm(clamp(minutes))}>
          Log {formatMinutes(clamp(minutes))}
        </Button>
      </div>
    </Sheet>
  );
}
