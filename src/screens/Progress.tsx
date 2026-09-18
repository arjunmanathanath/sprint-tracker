import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { useStatsCtx } from "../store/hooks";
import type { Milestone, Track } from "../types";
import { formatShort, fromISO, minutesToHours, todayISO, formatMinutes } from "../logic/dates";
import { format } from "date-fns";
import { sprintLabel } from "../logic/sprint";
import {
  cumulativeMinutes,
  guardrail,
  reviewNudgeFor,
  streakFor,
  trackWeekStats,
  weekSummary,
  weeklyTrend,
  type StatsCtx,
} from "../logic/stats";
import { GUARDRAIL, LOAD_CUT } from "../seed/config";
import { loadFactorOn } from "../logic/schedule";
import { addDaysISO } from "../logic/dates";
import { LoadSheet } from "../components/LoadSheet";
import { DayStrip } from "../components/DayStrip";
import { Bar, Button, Card, Pill, SectionTitle } from "../components/ui";
import { IconAlert, IconCheck } from "../components/Icons";

export function Progress() {
  const ctx = useStatsCtx();
  const tracks = useStore((s) => s.tracks);
  const milestones = useStore((s) => s.milestones);
  const reviews = useStore((s) => s.reviews);
  const setLoad = useStore((s) => s.setLoad);
  const clearLoad = useStore((s) => s.clearLoad);
  const openDay = useStore((s) => s.openDay);
  const today = todayISO();
  const [loadOpen, setLoadOpen] = useState(false);
  const loadFactor = loadFactorOn(today, ctx);
  const loadActive = loadFactor < 1;

  const week = useMemo(() => weekSummary(today, ctx), [today, ctx]);
  const guard = useMemo(() => guardrail(today, ctx), [today, ctx]);
  const trend = useMemo(() => weeklyTrend(today, 4, ctx), [today, ctx]);
  const reviewKey = reviewNudgeFor(today, reviews);

  const weekRatio = week.targetAdjusted > 0 ? week.actual / week.targetAdjusted : 0;
  const excusedHours = week.excusedMinutes > 0 ? minutesToHours(week.excusedMinutes) : null;

  const visibleTracks = tracks.filter((t) => t.active);
  const deep = visibleTracks.filter((t) => t.metricType === "deep");
  const habit = visibleTracks.filter((t) => t.metricType === "habit");

  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur px-4 pt-safe">
        <div className="flex items-baseline justify-between pt-4 pb-3 border-b border-border">
          <h1 className="text-base font-semibold">Progress</h1>
          <span className="text-xs text-muted">
            {formatShort(week.weekStart)} – {format(fromISO(week.weekEnd), "d MMM")} · {sprintLabel(today, ctx).replace("Sprint · ", "")}
          </span>
        </div>
      </header>

      <div className="px-4 pt-3">
        {/* Weekly total vs target */}
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted">This week</p>
            <p className="text-xs text-muted tabular">{Math.round(weekRatio * 100)}%</p>
          </div>
          <p className="mt-1 text-2xl font-semibold tabular">
            {minutesToHours(week.actual)} <span className="text-sm font-normal text-muted">of {minutesToHours(week.targetAdjusted)}</span>
          </p>
          <Bar value={weekRatio} className="mt-3" />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            <span>target {minutesToHours(ctx.config.weeklyTargetMinutes)}</span>
            {excusedHours && (
              <span className="text-excused">
                − {excusedHours} excused
                {week.pausedDays > 0 && ` · ${week.pausedDays} paused day${week.pausedDays > 1 ? "s" : ""}`}
                {week.skippedSessions > 0 && ` · ${week.skippedSessions} skipped`}
              </span>
            )}
            {week.trimmedMinutes > 0 && <span className="text-excused">− {formatMinutes(week.trimmedMinutes)} trimmed</span>}
            {loadActive && <span className="text-warn">{Math.round(loadFactor * 100)}% load</span>}
            <span>planned so far {minutesToHours(week.plannedToDate)}</span>
          </div>
        </Card>

        {/* Load check */}
        <Card className={`mt-3 p-4 ${guard.warn ? "border-warn/40" : ""}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 shrink-0 ${guard.warn ? "text-warn" : "text-ok"}`}>
              {guard.warn ? <IconAlert /> : <IconCheck size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Load check</p>
                <p className="text-xs text-muted tabular">
                  {guard.missed} missed{guard.partial > 0 && ` · ${guard.partial} partial`} ·{" "}
                  {week.excusedMinutes > 0 ? `${week.pausedDays + week.skippedSessions} excused` : "0 excused"}
                </p>
              </div>
              {guard.warn ? (
                <>
                  <p className="text-xs text-muted mt-1">{guard.reasons.join(" · ")}.</p>
                  {guard.streak >= 2 ? (
                    <p className="text-xs mt-2 text-warn">
                      {guard.streak === 2 ? "2nd" : `${guard.streak}th`} week in a row — the plan's rule: sustained warning signs
                      (2+) → cut load ~20% and re-plan. Pause a day, skip or trim a session with a reason rather than pushing
                      through.
                    </p>
                  ) : (
                    <p className="text-xs mt-2 text-warn">
                      First warning sign this week. One off-week is normal; two in a row is the signal to cut load ~20%. Pause,
                      skip or trim with a reason rather than pushing through.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted mt-1">
                  {guard.previousStreak > 0
                    ? `Last week tripped the guardrail${guard.previousStreak > 1 ? ` (${guard.previousStreak} weeks running)` : ""}; this week is on track so far. `
                    : ""}
                  Sessions not completed without a reason this week: {guard.missed + guard.partial}. Advisory triggers at{" "}
                  {GUARDRAIL.missedSessionsWarn} or under {Math.round(GUARDRAIL.weeklyRatioWarn * 100)}% of planned time.
                </p>
              )}
              <div className="mt-2 flex items-center gap-1" aria-label="Guardrail over the last 4 weeks">
                {guard.history.map((w, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${w ? "bg-warn" : "bg-ok/60"} ${i === guard.history.length - 1 ? "" : "opacity-70"}`}
                    title={i === guard.history.length - 1 ? "this week" : `${guard.history.length - 1 - i} week(s) ago`}
                  />
                ))}
                <span className="text-[10px] text-muted ml-1">4 wk</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {loadActive ? (
                  <>
                    <Pill tone="warn">
                      {Math.round(loadFactor * 100)}% load
                      {ctx.config.loadUntil ? ` until ${formatShort(ctx.config.loadUntil)}` : ""}
                    </Pill>
                    <button type="button" onClick={() => setLoadOpen(true)} className="text-xs text-accent underline underline-offset-2">
                      Adjust
                    </button>
                    <button type="button" onClick={clearLoad} className="text-xs text-muted underline underline-offset-2">
                      Restore 100%
                    </button>
                  </>
                ) : guard.warn ? (
                  <>
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-xs"
                      onClick={() => setLoad(LOAD_CUT.factor, today, addDaysISO(today, LOAD_CUT.days - 1))}
                    >
                      Cut load {Math.round((1 - LOAD_CUT.factor) * 100)}% for {LOAD_CUT.days / 7} weeks
                    </Button>
                    <button type="button" onClick={() => setLoadOpen(true)} className="text-xs text-muted underline underline-offset-2">
                      Choose…
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setLoadOpen(true)} className="text-xs text-muted underline underline-offset-2">
                    Adjust load
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <LoadSheet
          open={loadOpen}
          ctx={ctx}
          onConfirm={(factor, from, until) => {
            setLoad(factor, from, until);
            setLoadOpen(false);
          }}
          onRestore={() => {
            clearLoad();
            setLoadOpen(false);
          }}
          onClose={() => setLoadOpen(false)}
        />

        {reviewKey && <ReviewCard weekStart={reviewKey} />}

        {/* 14-day strip */}
        <SectionTitle>Last 14 days</SectionTitle>
        <Card className="p-4">
          <DayStrip today={today} ctx={ctx} onOpen={openDay} />
        </Card>

        {/* Trend */}
        <SectionTitle>Last 4 weeks</SectionTitle>
        <Card className="p-4">
          <Trend points={trend} />
        </Card>

        {/* Deep tracks */}
        <SectionTitle>Deep tracks</SectionTitle>
        <div className="space-y-2.5">
          {deep.map((t) => (
            <DeepTrackCard key={t.id} track={t} ctx={ctx} today={today} milestones={milestones.filter((m) => m.trackId === t.id)} />
          ))}
        </div>

        {/* Habit tracks */}
        <SectionTitle>Habit tracks</SectionTitle>
        <div className="space-y-2.5">
          {habit.map((t) => (
            <HabitTrackCard key={t.id} track={t} ctx={ctx} today={today} milestones={milestones.filter((m) => m.trackId === t.id)} />
          ))}
        </div>

        {Object.keys(reviews).length > 0 && (
          <>
            <SectionTitle>Reviews</SectionTitle>
            <div className="space-y-2.5">
              {Object.values(reviews)
                .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
                .map((r) => (
                  <Card key={r.weekStart} className="p-3.5 text-xs space-y-1">
                    <p className="text-muted">Week of {formatShort(r.weekStart)}</p>
                    {r.held && (
                      <p>
                        <span className="text-ok">Held</span> · {r.held}
                      </p>
                    )}
                    {r.slipped && (
                      <p>
                        <span className="text-warn">Slipped</span> · {r.slipped}
                      </p>
                    )}
                    {r.adjust && (
                      <p>
                        <span className="text-accent">Adjust</span> · {r.adjust}
                      </p>
                    )}
                  </Card>
                ))}
            </div>
          </>
        )}

        {tracks.some((t) => !t.active) && (
          <p className="text-[11px] text-muted text-center mt-5">
            Parked: {tracks.filter((t) => !t.active).map((t) => `${t.shortLabel} ${t.name}`).join(", ")} — no sessions scheduled.
          </p>
        )}
      </div>
    </main>
  );
}

function Trend({ points }: { points: ReturnType<typeof weeklyTrend> }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.actual, p.planned)));
  return (
    <div className="flex items-end gap-3 h-24">
      {points.map((p, i) => {
        const current = i === points.length - 1;
        return (
          <div key={p.weekStart} className="flex-1 flex flex-col items-center gap-1 h-full">
            <div className="flex-1 w-full flex items-end justify-center gap-1">
              <div
                className="w-3 rounded-t bg-border"
                style={{ height: `${(p.planned / max) * 100}%` }}
                title={`planned ${formatMinutes(p.planned)}`}
              />
              <div
                className={`w-3 rounded-t ${current ? "bg-accent" : "bg-accent/50"}`}
                style={{ height: `${(p.actual / max) * 100}%` }}
                title={`logged ${formatMinutes(p.actual)}`}
              />
            </div>
            <span className={`text-[10px] tabular ${current ? "text-text" : "text-muted"}`}>{format(fromISO(p.weekStart), "d MMM")}</span>
            <span className="text-[10px] text-muted tabular">{minutesToHours(p.actual)}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrackHeader({ track, right }: { track: Track; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: track.color }} aria-hidden />
      <span className="text-sm font-medium truncate">
        {track.shortLabel} · {track.name}
      </span>
      {track.architectCritical && <Pill tone="accent">architect-critical</Pill>}
      <span className="ml-auto shrink-0">{right}</span>
    </div>
  );
}

function MilestoneList({ milestones }: { milestones: Milestone[] }) {
  const setMilestoneDone = useStore((s) => s.setMilestoneDone);
  if (milestones.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {milestones.map((m) => (
        <li key={m.id} className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={m.done}
            onChange={(e) => setMilestoneDone(m.id, e.target.checked)}
            aria-label={m.title}
            className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="flex-1 min-w-0">
            <span className={`block text-xs leading-snug ${m.done ? "line-through text-muted" : ""}`}>{m.title}</span>
            <span className="block text-[11px] text-muted">{m.targetHint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function DeepTrackCard({ track, ctx, today, milestones }: { track: Track; ctx: StatsCtx; today: string; milestones: Milestone[] }) {
  const w = trackWeekStats(track.id, today, ctx);
  const cumulative = cumulativeMinutes(track.id, ctx);
  const ratio = w.plannedFull > 0 ? w.actual / w.plannedFull : 0;
  return (
    <Card className="p-3.5">
      <TrackHeader track={track} right={<span className="text-xs text-muted tabular">{(cumulative / 60).toFixed(1)} h total</span>} />
      <div className="mt-2.5 flex items-baseline justify-between text-xs tabular">
        <span>
          {formatMinutes(w.actual)} <span className="text-muted">/ {formatMinutes(w.plannedFull)} this week</span>
        </span>
        <span className="text-muted">
          {w.adherence === null ? "—" : `${w.adherence}%`} adherence
          {w.excused > 0 && <span className="text-excused"> · {w.excused} excused</span>}
        </span>
      </div>
      <Bar value={ratio} color={track.color} height={6} className="mt-1.5" />
      <MilestoneList milestones={milestones} />
    </Card>
  );
}

function HabitTrackCard({ track, ctx, today, milestones }: { track: Track; ctx: StatsCtx; today: string; milestones: Milestone[] }) {
  const w = trackWeekStats(track.id, today, ctx);
  const streak = streakFor(track.id, today, ctx);
  return (
    <Card className="p-3.5">
      <TrackHeader
        track={track}
        right={
          <span className="text-xs tabular">
            <span className="font-semibold" style={{ color: track.color }}>
              {streak}
            </span>{" "}
            <span className="text-muted">day streak</span>
          </span>
        }
      />
      <div className="mt-2.5 flex items-baseline justify-between text-xs tabular">
        <span>
          {w.completed}/{w.scheduled} <span className="text-muted">sessions this week</span>
          {w.excused > 0 && <span className="text-excused"> · {w.excused} excused</span>}
          {w.partial > 0 && <span className="text-warn"> · {w.partial} partial</span>}
        </span>
        <span className="text-muted">{w.adherence === null ? "—" : `${w.adherence}%`} adherence</span>
      </div>
      <Bar value={w.scheduled > 0 ? w.completed / w.scheduled : 0} color={track.color} height={6} className="mt-1.5" />
      <MilestoneList milestones={milestones} />
    </Card>
  );
}

function ReviewCard({ weekStart }: { weekStart: string }) {
  const saveReview = useStore((s) => s.saveReview);
  const [held, setHeld] = useState("");
  const [slipped, setSlipped] = useState("");
  const [adjust, setAdjust] = useState("");
  const field = "w-full rounded-xl bg-surface-2 border border-border px-3 py-2 text-sm outline-none focus:border-accent placeholder:text-muted/70";
  return (
    <Card className="mt-3 p-4 border-accent/40">
      <p className="text-sm font-medium">Monthly review</p>
      <p className="text-xs text-muted mt-0.5">Last Friday of the month. Three lines, then move on.</p>
      <div className="mt-3 space-y-2">
        <input className={field} placeholder="What held?" value={held} onChange={(e) => setHeld(e.target.value)} />
        <input className={field} placeholder="What slipped?" value={slipped} onChange={(e) => setSlipped(e.target.value)} />
        <input className={field} placeholder="What to adjust?" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
      </div>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!held.trim() && !slipped.trim() && !adjust.trim()}
        onClick={() => saveReview({ weekStart, held: held.trim(), slipped: slipped.trim(), adjust: adjust.trim() })}
      >
        Save review
      </Button>
    </Card>
  );
}
