import { useEffect, useRef, useState } from "react";

/**
 * Text field that keeps typing responsive and auto-saves (debounced, plus on blur).
 * `resetKey` re-syncs the local value when the underlying record changes (e.g. date step);
 * any pending save is flushed first, with the callback it was scheduled with, so a note
 * typed on one day never lands on another.
 */
export function AutoSaveText({
  value,
  onSave,
  placeholder,
  multiline = false,
  rows = 3,
  resetKey,
  className = "",
  delay = 400,
  ariaLabel,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  resetKey?: string;
  className?: string;
  delay?: number;
  ariaLabel?: string;
}) {
  const [local, setLocal] = useState(value);
  const pending = useRef<{ timer: number; save: (v: string) => void; value: string } | null>(null);

  const flush = () => {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    p.save(p.value);
  };

  const schedule = (v: string) => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    const timer = window.setTimeout(() => {
      pending.current = null;
      onSave(v);
    }, delay);
    pending.current = { timer, save: onSave, value: v };
  };

  // Record changed underneath us: flush what was typed for the old record, adopt the new value.
  useEffect(() => {
    flush();
    setLocal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Unmount (tab switch): never drop a pending save.
  useEffect(() => flush, []);

  const base = `w-full rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-sm outline-none focus:border-accent placeholder:text-muted/70 ${className}`;

  if (multiline) {
    return (
      <textarea
        value={local}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => {
          setLocal(e.target.value);
          schedule(e.target.value);
        }}
        onBlur={flush}
        className={`${base} resize-y leading-relaxed`}
      />
    );
  }
  return (
    <input
      value={local}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoComplete="off"
      onChange={(e) => {
        setLocal(e.target.value);
        schedule(e.target.value);
      }}
      onBlur={flush}
      className={base}
    />
  );
}
