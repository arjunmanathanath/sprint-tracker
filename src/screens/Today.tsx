import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { useExportDue, useNow, useStatsCtx, useTrackMap } from "../store/hooks";
import { TIMER_LONG_RUN_MS } from "../seed/config";
import { ConfirmMinutesSheet } from "../components/ConfirmMinutesSheet";
import type { ResolvedEntry } from "../logic/schedule";
import { addDaysISO, daysBetween, formatLong, formatMinutes, formatShort, minutesToHours, todayISO, type ISODate } from "../logic/dates";
import { DAY_TYPE_LABEL, dayTypeFor } from "../logic/dayType";
import { sprintDayIndex, sprintLabel } from "../logic/sprint";
import { dayTotals, rowsFor } from "../logic/stats";
import { loadFactorOn, plannedTotalFor, slotById } from "../logic/schedule";
import { TaskRow } from "../components/TaskRow";
import { AutoSaveText } from "../components/AutoSaveText";
import { ReasonSheet } from "../components/ReasonSheet";
import { TrimSheet } from "../components/TrimSheet";
import { IconChevronLeft, IconChevronRight, IconMoon } from "../components/Icons";
import { Button, Card, EmptyState, Pill, Ring } from "../components/ui";

export function Today() {
  const date = useStore((s) => s.viewDate);
  const setDate = useStore((s) => s.setViewDate);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sheet, setSheet] = useState<
    | { kind: "pause" }
    | { kind: "skip"; slotId: string }
    | { kind: "trim"; slotId: string }
    | { kind: "stop"; date: ISODate; slotId: string; elapsedMs: number }
    | null
  >(null);

  const ctx = useStatsCtx();
  const tracks = useTrackMap();
  const log = useStore((s) => s.logs[date]);
  const runningTimer = useStore((s) => s.runningTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const pauseDay = useStore((s) => s.pauseDay);
  const resumeDay = useStore((s) => s.resumeDay);
  const skipTask = useStore((s) => s.skipTask);
  const trimTask = useStore((s) => s.trimTask);
  const setDayNote = useStore((s) => s.setDayNote);
  const setTab = useStore((s) => s.setTab);
  const exportDue = useExportDue();

  // Roll the view over to the new day when the app stays open past midnight.
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = todayISO();
      if (t !== today) {
        setToday(t);
        if (date === today) setDate(t);
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [today, date, setDate]);

  // A stopwatch left running for hours was probably forgotten: warn, and confirm on stop.
  const now = useNow(runningTimer !== null, 30_000);
  const longRunMs = runningTimer ? now - runningTimer.startedAt : 0;
  const longRunning = runningTimer !== null && longRunMs >= TIMER_LONG_RUN_MS;
  const requestStop = (stopDate: ISODate, row: ResolvedEntry) => {
    const startedAt = row.entry?.timerStartedAt;
    if (startedAt === undefined) return;
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= TIMER_LONG_RUN_MS) setSheet({ kind: "stop", date: stopDate, slotId: row.slotId, elapsedMs });
    else stopTimer(stopDate, row.slotId);
  };
  const stopRow = sheet?.kind === "stop" ? rowsFor(sheet.date, ctx).find((r) => r.slotId === sheet.slotId) : undefined;

  const rows = useMemo(() => rowsFor(date, ctx), [date, ctx]);
  const totals = useMemo(() => dayTotals(date, ctx), [date, ctx]);
  const dayType = dayTypeFor(date);
  const plannedToday = plannedTotalFor(date, ctx);
  const isToday = date === today;
  const isPast = date < today;
  const isFuture = date > today;
  const paused = log?.paused ?? false;
  const inSprint = (sprintDayIndex(date, ctx) ?? -1) >= 0;
  // Stopwatch only for today and yesterday (a late-night session may belong to the day before);
  // older days are backfilled by typing minutes.
  const stopwatchAllowed = !isFuture && daysBetween(date, today) <= 1;
  const loadFactor = loadFactorOn(date, ctx);
  const trimRow = sheet?.kind === "trim" ? rows.find((r) => r.slotId === sheet.slotId) : undefined;

  const ringValue = totals.plannedEffective > 0 ? totals.actual / totals.plannedEffective : totals.actual > 0 ? 1 : 0;
  const pct = Math.round(ringValue * 100);

  const timerElsewhere =
    runningTimer && runningTimer.date !== date ? { ...runningTimer, slot: slotById(runningTimer.slotId) } : null;
  const runningSlotLabel = runningTimer ? (slotById(runningTimer.slotId)?.label ?? runningTimer.slotId) : "";

  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur px-4 pt-safe">
        <div className="flex items-center justify-between pt-3">
          <button
            type="button"
            onClick={() => setDate(addDaysISO(date, -1))}
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-muted active:bg-surface-2"
            aria-label="Previous day"
          >
            <IconChevronLeft />
          </button>
          <div className="text-center min-w-0">
            <h1 className="text-base font-semibold truncate">{formatLong(date)}</h1>
            {!isToday && (
              <button type="button" onClick={() => setDate(today)} className="text-[11px] text-accent font-medium">
                Back to today
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDate(addDaysISO(date, 1))}
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-muted active:bg-surface-2"
            aria-label="Next day"
          >
            <IconChevronRight />
          </button>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={dayType === "tuesday" ? "warn" : dayType === "weekend" ? "accent" : "muted"}>
                {DAY_TYPE_LABEL[dayType]}
                {inSprint && ` · ${minutesToHours(totals.planned || plannedToday)}`}
              </Pill>
              {paused && (
                <Pill tone="excused">
                  <IconMoon size={12} className="inline align-[-2px] mr-1" />
                  paused
                </Pill>
              )}
              {loadFactor < 1 && inSprint && <Pill tone="warn">{Math.round(loadFactor * 100)}% load</Pill>}
              {isFuture && <Pill tone="muted">upcoming</Pill>}
            </div>
            <p className="text-xs text-muted mt-1.5">{sprintLabel(date, ctx)}</p>
          </div>
          <Ring
            value={paused ? 0 : ringValue}
            size={60}
            stroke={6}
            color={paused ? "var(--color-excused)" : "var(--color-accent)"}
            label={`${pct}% of planned time logged`}
          >
            {paused ? (
              <IconMoon size={18} className="text-excused" />
            ) : (
              <span className="text-xs font-semibold tabular">{pct}%</span>
            )}
          </Ring>
        </div>
      </header>

      <div className="px-4 pt-3 space-y-2.5">
        {exportDue && (
          <button
            type="button"
            onClick={() => setTab("settings")}
            className="w-full text-left rounded-xl bg-warn/10 border border-warn/30 px-3 py-2 text-xs text-warn"
          >
            Backup reminder: your data only lives on this device. Tap to export a JSON copy.
          </button>
        )}
        {longRunning && runningTimer && (
          <button
            type="button"
            onClick={() => {
              const row = rowsFor(runningTimer.date, ctx).find((r) => r.slotId === runningTimer.slotId);
              if (row) requestStop(runningTimer.date, row);
            }}
            className="w-full text-left rounded-xl bg-warn/10 border border-warn/30 px-3 py-2 text-xs text-warn"
          >
            Stopwatch on {runningSlotLabel} has been running for {formatMinutes(Math.round(longRunMs / 60000))}. Still working? Tap to
            stop and set the real time.
          </button>
        )}
        {timerElsewhere && !longRunning && (
          <button
            type="button"
            onClick={() => setDate(timerElsewhere.date)}
            className="w-full text-left rounded-xl bg-accent/10 border border-accent/30 px-3 py-2 text-xs text-accent"
          >
            Stopwatch running on {formatShort(timerElsewhere.date)} · {timerElsewhere.slot?.label ?? timerElsewhere.slotId}. Tap to open.
          </button>
        )}

        {paused && (
          <Card className="p-3 border-dashed border-excused/50">
            <div className="flex items-start gap-3">
              <IconMoon className="text-excused shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Day paused{log?.pauseReason ? ` · ${log.pauseReason}` : ""}</p>
                <p className="text-xs text-muted mt-0.5">
                  Nothing here counts as missed and streaks are safe. Anything you do log still counts.
                  {ctx.config.pauseExtendsSprint && inSprint ? " The sprint calendar shifts by a day." : ""}
                </p>
              </div>
              <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => resumeDay(date)}>
                Resume
              </Button>
            </div>
          </Card>
        )}

        {rows.length === 0 ? (
          inSprint ? (
            <EmptyState title="Nothing scheduled" body="This day has no planned sessions." />
          ) : (
            <EmptyState
              title={ctx.config.startDate ? `Sprint starts ${formatLong(ctx.config.startDate)}` : "No start date"}
              body="The daily plan begins on day 1. Use the arrows to look ahead, or change the start date in Settings."
            />
          )
        ) : (
          rows.map((row) => (
            <TaskRow
              key={row.slotId}
              date={date}
              row={row}
              tracks={tracks}
              dayPaused={paused}
              isPast={isPast}
              stopwatchAllowed={stopwatchAllowed}
              expanded={expanded === row.slotId}
              onToggleExpand={() => setExpanded(expanded === row.slotId ? null : row.slotId)}
              onSkip={() => setSheet({ kind: "skip", slotId: row.slotId })}
              onTrim={() => setSheet({ kind: "trim", slotId: row.slotId })}
              onStopRequest={() => requestStop(date, row)}
            />
          ))
        )}

        <div className="pt-2 space-y-3">
          <p className="text-xs text-muted text-center tabular">
            {paused
              ? `logged ${totals.actual} min · day paused (${totals.planned} min planned)`
              : `logged ${totals.actual} of ${totals.plannedEffective} min`}
            {totals.excused > 0 && !paused && ` · ${totals.planned - totals.plannedEffective} min excused`}
          </p>
          <AutoSaveText
            value={log?.dayNote ?? ""}
            onSave={(v) => setDayNote(date, v)}
            placeholder="Day note (one line)"
            resetKey={date}
            ariaLabel="Day note"
          />
          {!paused && (
            <button
              type="button"
              onClick={() => setSheet({ kind: "pause" })}
              className="w-full text-xs text-muted py-2 inline-flex items-center justify-center gap-1.5"
            >
              <IconMoon size={14} /> Pause this day
            </button>
          )}
        </div>
      </div>

      <ReasonSheet
        open={sheet?.kind === "pause"}
        title="Pause this day"
        description="Use this when something valid gets in the way. The day stays loggable, nothing is marked missed, and streaks are kept."
        confirmLabel="Pause day"
        onConfirm={(reason) => {
          pauseDay(date, reason);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <ReasonSheet
        open={sheet?.kind === "skip"}
        title={sheet?.kind === "skip" ? `Skip ${slotById(sheet.slotId)?.label ?? "task"}` : "Skip task"}
        description="Excuse just this session for the day. It will not count as missed and will not break a streak."
        confirmLabel="Skip"
        onConfirm={(reason) => {
          if (sheet?.kind === "skip") skipTask(date, sheet.slotId, reason);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <ConfirmMinutesSheet
        open={sheet?.kind === "stop"}
        label={stopRow?.slot.label ?? "task"}
        elapsedMs={sheet?.kind === "stop" ? sheet.elapsedMs : 0}
        planned={stopRow?.planned ?? 0}
        onConfirm={(minutes) => {
          if (sheet?.kind === "stop") stopTimer(sheet.date, sheet.slotId, minutes);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <TrimSheet
        open={sheet?.kind === "trim" && !!trimRow}
        label={trimRow?.slot.label ?? "task"}
        original={trimRow?.entry?.originalPlannedMinutes ?? trimRow?.planned ?? 0}
        current={trimRow?.planned ?? 0}
        initialReason={trimRow?.entry?.adjustReason ?? ""}
        onConfirm={(minutes, reason) => {
          if (sheet?.kind === "trim") trimTask(date, sheet.slotId, minutes, reason);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </main>
  );
}
