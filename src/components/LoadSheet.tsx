import { useEffect, useState } from "react";
import type { DayType } from "../types";
import { addDaysISO, formatShort, minutesToHours, todayISO, type ISODate } from "../logic/dates";
import { phaseSlotsFor } from "../logic/schedule";
import type { SprintCtx } from "../logic/sprint";
import { LOAD_CUT } from "../seed/config";
import { Button, Sheet } from "./ui";

const FACTORS = [0.9, 0.8, 0.7];
const DURATIONS: { label: string; days: number | null }[] = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "4 weeks", days: 28 },
  { label: "Until I restore", days: null },
];

/** Weekly minutes the plan would ask for at `factor` (same rounding as the schedule). */
export function weeklyMinutesAt(factor: number, ctx: SprintCtx, date: ISODate): number {
  const scale = (base: number) => (base === 0 ? 0 : factor >= 1 ? base : Math.max(5, Math.round((base * factor) / 5) * 5));
  const slots = phaseSlotsFor(date, ctx);
  const dayTotal = (dt: DayType) => slots.reduce((sum, s) => sum + scale(s.minutes[dt]), 0);
  return 4 * dayTotal("weekday") + dayTotal("tuesday") + 2 * dayTotal("weekend");
}

/**
 * "Cut load ~20% and re-plan": scale every planned session for a while. History keeps its
 * numbers; today and later follow the reduced plan until the window ends or it is restored.
 */
export function LoadSheet({
  open,
  ctx,
  onConfirm,
  onRestore,
  onClose,
}: {
  open: boolean;
  ctx: SprintCtx;
  onConfirm: (factor: number, from: ISODate, until: ISODate | null) => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const today = todayISO();
  const { loadFactor, loadFrom, loadUntil } = ctx.config;
  const active = loadFactor < 1 && !!loadFrom && (!loadUntil || loadUntil >= today);
  const [factor, setFactor] = useState(LOAD_CUT.factor);
  const [days, setDays] = useState<number | null>(LOAD_CUT.days);
  useEffect(() => {
    if (open) {
      setFactor(active ? loadFactor : LOAD_CUT.factor);
      setDays(LOAD_CUT.days);
    }
  }, [open, active, loadFactor]);

  const until = days === null ? null : addDaysISO(today, days - 1);
  const fullWeek = weeklyMinutesAt(1, ctx, today);
  const reducedWeek = weeklyMinutesAt(factor, ctx, today);

  return (
    <Sheet open={open} onClose={onClose} title={active ? "Adjust load" : "Cut load"}>
      {active && (
        <p className="text-sm mb-3">
          Currently at <span className="font-semibold">{Math.round(loadFactor * 100)}%</span>
          {loadUntil ? ` until ${formatShort(loadUntil)}` : " until restored"}.
        </p>
      )}
      <p className="text-xs text-muted mb-3">
        Every planned session shrinks by the same share, rounded to 5 minutes. Days already logged keep their numbers.
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Load</p>
      <div className="flex gap-2 mb-3">
        {FACTORS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFactor(f)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm border transition ${
              factor === f ? "bg-accent/15 border-accent text-text" : "bg-surface-2 border-border text-muted"
            }`}
          >
            {Math.round(f * 100)}%
          </button>
        ))}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">For</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {DURATIONS.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setDays(d.days)}
            className={`rounded-full px-3 py-1.5 text-xs border transition ${
              days === d.days ? "bg-accent/15 border-accent text-text" : "bg-surface-2 border-border text-muted"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted tabular">
        Week: {minutesToHours(fullWeek)} → <span className="text-text">{minutesToHours(reducedWeek)}</span>
        {until ? ` · from today to ${formatShort(until)}` : " · from today"}
      </p>
      <div className="mt-4 flex gap-2">
        {active ? (
          <Button variant="secondary" className="flex-1" onClick={onRestore}>
            Restore 100%
          </Button>
        ) : (
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button variant="primary" className="flex-1" onClick={() => onConfirm(factor, today, until)}>
          {active ? "Apply" : `Cut to ${Math.round(factor * 100)}%`}
        </Button>
      </div>
    </Sheet>
  );
}
