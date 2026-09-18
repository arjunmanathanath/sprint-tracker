import { useEffect, useState } from "react";
import type { Track } from "../types";
import type { ResolvedEntry } from "../logic/schedule";
import { formatMinutes, type ISODate } from "../logic/dates";
import { useStore } from "../store/useStore";
import { AutoSaveText } from "./AutoSaveText";
import { IconCheck, IconChevronDown } from "./Icons";
import { Stopwatch } from "./Stopwatch";
import { Pill, TrackDots } from "./ui";

export function TaskRow({
  date,
  row,
  tracks,
  dayPaused,
  isPast,
  stopwatchAllowed,
  expanded,
  onToggleExpand,
  onSkip,
  onTrim,
  onStopRequest,
}: {
  date: ISODate;
  row: ResolvedEntry;
  tracks: Record<string, Track>;
  dayPaused: boolean;
  isPast: boolean;
  /** Offer the start button (a running timer is always shown so it can be stopped). */
  stopwatchAllowed: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onSkip: () => void;
  onTrim: () => void;
  /** Stop the stopwatch (the parent may first confirm an unusually long run). */
  onStopRequest: () => void;
}) {
  const setCompleted = useStore((s) => s.setCompleted);
  const setActualMinutes = useStore((s) => s.setActualMinutes);
  const addMinutes = useStore((s) => s.addMinutes);
  const setTaskNote = useStore((s) => s.setTaskNote);
  const startTimer = useStore((s) => s.startTimer);
  const unskipTask = useStore((s) => s.unskipTask);
  const untrimTask = useStore((s) => s.untrimTask);

  const trackList = row.slot.trackIds.map((id) => tracks[id]).filter(Boolean);
  const colors = trackList.map((t) => t.color);
  const primaryColor = colors[0] ?? "var(--color-accent)";
  const shortLabels = trackList.map((t) => t.shortLabel).join("+");
  const skipped = row.entry?.skipped ?? false;
  const excused = row.excused;
  // Past, unexcused and not ticked: red only when nothing was logged; amber when some time was.
  const missed = isPast && !row.completed && !excused && row.actual === 0;
  const partial = isPast && !row.completed && !excused && row.actual > 0;
  const trimmed = row.trimmed;
  const originalPlanned = row.entry?.originalPlannedMinutes;
  const running = row.entry?.timerStartedAt !== undefined;
  const hasNote = (row.entry?.note ?? "").length > 0;

  const [minutesDraft, setMinutesDraft] = useState(String(row.actual));
  useEffect(() => setMinutesDraft(String(row.actual)), [row.actual]);
  const commitMinutes = () => {
    const n = Number(minutesDraft);
    if (Number.isFinite(n) && n !== row.actual) setActualMinutes(date, row.slotId, n);
    else setMinutesDraft(String(row.actual));
  };

  const border = missed
    ? "border-danger/40"
    : partial
      ? "border-warn/40"
      : excused
        ? "border-dashed border-excused/50"
        : "border-border";

  return (
    <div className={`rounded-2xl bg-surface border ${border} ${excused && !row.completed ? "opacity-75" : ""}`}>
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setCompleted(date, row.slotId, !row.completed)}
          aria-pressed={row.completed}
          aria-label={row.completed ? "Mark not done" : "Mark done"}
          className="shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center transition"
          style={{
            borderColor: row.completed ? primaryColor : excused ? "var(--color-excused)" : "var(--color-border)",
            background: row.completed ? primaryColor : "transparent",
            borderStyle: excused && !row.completed ? "dashed" : "solid",
            color: "var(--color-bg)",
          }}
        >
          {row.completed && <IconCheck size={22} />}
        </button>

        <button type="button" onClick={onToggleExpand} className="flex-1 min-w-0 text-left" aria-expanded={expanded}>
          <div className="flex items-center gap-2 min-w-0">
            <TrackDots colors={colors} />
            <span className={`truncate text-sm font-medium ${row.completed ? "text-muted" : ""}`}>
              {shortLabels} · {row.slot.label}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted tabular">
            <span>
              {formatMinutes(row.planned)}
              {trimmed && originalPlanned !== undefined && originalPlanned !== row.planned && (
                <span className="text-muted/60 line-through ml-1">{formatMinutes(originalPlanned)}</span>
              )}
            </span>
            {row.actual > 0 && (
              <span className={row.actual >= row.planned ? "text-accent" : "text-text"}>· {formatMinutes(row.actual)} logged</span>
            )}
            {skipped && <Pill tone="excused">Skipped{row.entry?.skipReason ? ` · ${row.entry.skipReason}` : ""}</Pill>}
            {!skipped && dayPaused && !row.completed && <Pill tone="excused">Paused</Pill>}
            {trimmed && !skipped && <Pill tone="excused">Trimmed · {row.entry?.adjustReason}</Pill>}
            {missed && <Pill tone="danger">Missed</Pill>}
            {partial && <Pill tone="warn">Partial</Pill>}
            {row.offSchedule && <Pill tone="muted">Off-schedule</Pill>}
            {hasNote && !expanded && <span className="text-muted/70">· note</span>}
            <IconChevronDown size={14} className={`ml-auto shrink-0 text-muted/60 transition ${expanded ? "rotate-180" : ""}`} />
          </div>
        </button>

        {(stopwatchAllowed || running) && (
          <Stopwatch
            startedAt={row.entry?.timerStartedAt}
            onStart={() => startTimer(date, row.slotId)}
            onStop={onStopRequest}
            color={primaryColor}
          />
        )}
      </div>

      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted w-14 shrink-0" htmlFor={`min-${row.slotId}`}>
              Logged
            </label>
            <input
              id={`min-${row.slotId}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={minutesDraft}
              onChange={(e) => setMinutesDraft(e.target.value)}
              onBlur={commitMinutes}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              disabled={running}
              className="w-20 rounded-xl bg-surface-2 border border-border px-3 py-2 text-sm tabular text-center outline-none focus:border-accent disabled:opacity-50"
            />
            <span className="text-xs text-muted">min</span>
            <div className="flex-1 flex justify-end gap-1.5">
              {[5, 15, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => addMinutes(date, row.slotId, d)}
                  disabled={running}
                  className="rounded-lg bg-surface-2 border border-border px-2.5 min-h-9 text-xs tabular active:bg-border disabled:opacity-40"
                >
                  +{d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setActualMinutes(date, row.slotId, row.planned)}
                disabled={running}
                className="rounded-lg bg-surface-2 border border-border px-2.5 min-h-9 text-xs active:bg-border disabled:opacity-40"
                title="Set to planned"
              >
                = plan
              </button>
            </div>
          </div>

          <AutoSaveText
            value={row.entry?.note ?? ""}
            onSave={(v) => setTaskNote(date, row.slotId, v)}
            placeholder="Note for this task today…"
            multiline
            rows={2}
            resetKey={`${date}:${row.slotId}`}
            ariaLabel="Task note"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {skipped ? (
                <button type="button" onClick={() => unskipTask(date, row.slotId)} className="text-xs text-excused underline-offset-2 underline">
                  Remove skip
                </button>
              ) : (
                <button type="button" onClick={onSkip} className="text-xs text-muted underline-offset-2 underline">
                  Skip with a reason
                </button>
              )}
              {trimmed ? (
                <button type="button" onClick={() => untrimTask(date, row.slotId)} className="text-xs text-excused underline-offset-2 underline">
                  Remove trim
                </button>
              ) : (
                !skipped && (
                  <button type="button" onClick={onTrim} className="text-xs text-muted underline-offset-2 underline">
                    Trim time
                  </button>
                )
              )}
            </div>
            <span className="text-[11px] text-muted shrink-0">{row.slot.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}
