import { useEffect, useState } from "react";
import { Button, Sheet } from "./ui";

export const QUICK_REASONS = ["Baby / family", "Unwell", "Travel", "Work overrun", "Guests", "Rest day"];

/** Quick-reason chips plus a free-text field. Tapping a selected chip clears it. */
export function ReasonPicker({
  reason,
  onChange,
  onSubmit,
  autoFocus = false,
}: {
  reason: string;
  onChange: (r: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(reason === r ? "" : r)}
            className={`rounded-full px-3 py-1.5 text-xs border transition ${
              reason === r ? "bg-excused/20 border-excused text-text" : "bg-surface-2 border-border text-muted"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <input
        value={reason}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Reason (optional)"
        autoComplete="off"
        autoFocus={autoFocus}
        className="w-full rounded-xl bg-surface-2 border border-border px-3 py-3 text-sm outline-none focus:border-excused"
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
      />
    </>
  );
}

/**
 * Asks for a short reason before excusing a day or a task. The reason is optional but
 * encouraged: it is what makes the excuse "valid" when looking back at the week.
 */
export function ReasonSheet({
  open,
  title,
  description,
  confirmLabel,
  initial = "",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  initial?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(initial);
  useEffect(() => {
    if (open) setReason(initial);
  }, [open, initial]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {description && <p className="text-sm text-muted mb-3">{description}</p>}
      <ReasonPicker reason={reason} onChange={setReason} onSubmit={() => onConfirm(reason)} />
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" onClick={() => onConfirm(reason)}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
