import { useEffect, useRef, type ReactNode } from "react";
import { IconX } from "./Icons";

/** Track colour dot(s); shared slots render two overlapping dots. */
export function TrackDots({ colors, size = 10 }: { colors: string[]; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-hidden>
      {colors.map((c, i) => (
        <span
          key={i}
          className="inline-block rounded-full ring-2 ring-surface"
          style={{
            width: size,
            height: size,
            background: c,
            marginLeft: i === 0 ? 0 : -(size / 3),
          }}
        />
      ))}
    </span>
  );
}

/** SVG progress ring. `value` in [0, 1]; values above 1 fill completely. */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = "var(--color-accent)",
  track = "var(--color-border)",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Horizontal bar. */
export function Bar({
  value,
  color = "var(--color-accent)",
  height = 8,
  className = "",
}: {
  value: number;
  color?: string;
  height?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className={`w-full rounded-full bg-border overflow-hidden ${className}`} style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color, transition: "width 300ms ease" }} />
    </div>
  );
}

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl bg-surface border border-border ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: "muted" | "accent" | "warn" | "danger" | "excused" | "ok";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-surface-2 text-muted",
    accent: "bg-accent/15 text-accent",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    excused: "bg-excused/15 text-excused",
    ok: "bg-ok/15 text-ok",
  };
  return (
    <span
      className={`inline-block max-w-full truncate align-middle rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    primary: "bg-accent text-bg font-semibold active:opacity-80",
    secondary: "bg-surface-2 text-text border border-border active:bg-border",
    ghost: "bg-transparent text-muted active:bg-surface-2",
    danger: "bg-danger/15 text-danger border border-danger/30 active:bg-danger/25",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-sm transition disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Bottom sheet. Closes on backdrop tap or Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Lock the page behind the sheet so a swipe inside it never scrolls the list underneath.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={ref}
        className="relative w-full max-w-md rounded-t-3xl bg-surface border-t border-border p-5 pb-safe shadow-2xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          <button type="button" onClick={onClose} className="p-2 -mr-2 text-muted" aria-label="Close">
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1 mb-2 mt-5 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-center py-10 px-6">
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="text-xs text-muted mt-1">{body}</p>}
    </div>
  );
}
