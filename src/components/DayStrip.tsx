import { format } from "date-fns";
import { addDaysISO, fromISO, type ISODate } from "../logic/dates";
import { dayStatus, type DayStatus, type StatsCtx } from "../logic/stats";

const STYLE: Record<DayStatus, { cls: string; label: string }> = {
  done: { cls: "bg-ok", label: "done" },
  partial: { cls: "bg-warn", label: "partial" },
  missed: { cls: "bg-danger/80", label: "missed" },
  paused: { cls: "bg-excused/60 border border-dashed border-excused", label: "paused" },
  open: { cls: "bg-transparent border-2 border-accent", label: "today" },
  none: { cls: "bg-surface-2", label: "no plan" },
  future: { cls: "bg-surface-2", label: "" },
};

const LEGEND: DayStatus[] = ["done", "partial", "missed", "paused"];

/** One cell per day for the last `days` days ending today; tap a cell to open that day. */
export function DayStrip({
  today,
  ctx,
  days = 14,
  onOpen,
}: {
  today: ISODate;
  ctx: StatsCtx;
  days?: number;
  onOpen: (date: ISODate) => void;
}) {
  const cells: ISODate[] = [];
  for (let i = days - 1; i >= 0; i--) cells.push(addDaysISO(today, -i));
  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
        {cells.map((d) => {
          const status = dayStatus(d, today, ctx);
          const st = STYLE[status];
          const dow = format(fromISO(d), "EEEEE");
          return (
            <button
              key={d}
              type="button"
              onClick={() => onOpen(d)}
              className="flex flex-col items-center gap-1 min-w-0"
              aria-label={`${format(fromISO(d), "EEE d MMM")} · ${st.label || "upcoming"}`}
              title={`${format(fromISO(d), "EEE d MMM")} · ${st.label}`}
            >
              <span className={`block w-full aspect-square rounded-md ${st.cls}`} />
              <span className={`text-[10px] leading-none ${d === today ? "text-text" : "text-muted"}`}>{dow}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {LEGEND.map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${STYLE[k].cls}`} />
            {STYLE[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
