import { useEffect, useState } from "react";
import { formatMinutes } from "../logic/dates";
import { ReasonPicker } from "./ReasonSheet";
import { Button, Sheet } from "./ui";

/**
 * Lower today's plan for one task with a reason. Hitting the trimmed number then counts as
 * done; the original plan is kept so the trim can be removed.
 */
export function TrimSheet({
  open,
  label,
  original,
  current,
  initialReason = "",
  onConfirm,
  onClose,
}: {
  open: boolean;
  label: string;
  /** The untrimmed plan for the day. */
  original: number;
  /** The current plan (equal to `original` unless already trimmed). */
  current: number;
  initialReason?: string;
  onConfirm: (minutes: number, reason: string) => void;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(current);
  const [reason, setReason] = useState(initialReason);
  useEffect(() => {
    if (open) {
      setMinutes(current);
      setReason(initialReason);
    }
  }, [open, current, initialReason]);

  const clampTo = (n: number) => Math.max(5, Math.min(original, Math.round(n / 5) * 5));
  const presets = [
    { label: "−15", value: minutes - 15 },
    { label: "−30", value: minutes - 30 },
    { label: "Half", value: original / 2 },
    { label: "Reset", value: original },
  ];
  const valid = minutes >= 5 && minutes <= original;

  return (
    <Sheet open={open} onClose={onClose} title={`Trim ${label}`}>
      <p className="text-sm text-muted mb-3">
        Plan for today was {formatMinutes(original)}. Set what is realistically possible; reaching it counts as done and
        nothing turns red. The week's target drops by the difference.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMinutes(clampTo(minutes - 5))}
          className="w-11 h-11 rounded-xl bg-surface-2 border border-border text-lg"
          aria-label="5 minutes less"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={5}
          max={original}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          onBlur={() => setMinutes(clampTo(Number.isFinite(minutes) ? minutes : current))}
          aria-label="Trimmed minutes"
          className="flex-1 rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-center text-lg font-semibold tabular outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setMinutes(clampTo(minutes + 5))}
          className="w-11 h-11 rounded-xl bg-surface-2 border border-border text-lg"
          aria-label="5 minutes more"
        >
          +
        </button>
        <span className="text-xs text-muted w-8">min</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setMinutes(clampTo(p.value))}
            className="rounded-full px-3 py-1.5 text-xs border bg-surface-2 border-border text-muted"
          >
            {p.label}
          </button>
        ))}
      </div>
      <ReasonPicker reason={reason} onChange={setReason} onSubmit={() => valid && onConfirm(minutes, reason)} />
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" disabled={!valid} onClick={() => onConfirm(minutes, reason)}>
          Trim to {formatMinutes(valid ? minutes : current)}
        </Button>
      </div>
    </Sheet>
  );
}
