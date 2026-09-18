import { describe, expect, it } from "vitest";
import { PHASES } from "../seed/schedule";
import { SEED_TRACKS } from "../seed/tracks";
import { DEFAULT_CONFIG } from "../seed/config";
import type { DailyLog, DayType, SprintConfig } from "../types";
import { dayTypeFor } from "./dayType";
import { phaseFor, sprintLabel, sprintWeek } from "./sprint";
import { loadFactorOn, newDailyLog, plannedTotalFor, resolveDay, scheduledSlotsFor, slotMinutesOn } from "./schedule";
import {
  buildCtx,
  cumulativeMinutes,
  dayStatus,
  guardrail,
  recentTaskNotes,
  reviewNudgeFor,
  streakFor,
  trackWeekStats,
  weekSummary,
  weeklyTrend,
} from "./stats";
import { defaultStartDateISO, isLastFridayOfMonth, weekStartISO } from "./dates";

// Calendar anchors (2026-09-20 is a Sunday).
const SUN = "2026-09-20";
const MON = "2026-09-21";
const TUE = "2026-09-22";
const WED = "2026-09-23";
const FRI = "2026-09-25";
const SAT = "2026-09-26";

const config = (over: Partial<SprintConfig> = {}): SprintConfig => ({
  ...DEFAULT_CONFIG,
  startDate: SUN,
  ...over,
});

const total = (phase: "phase1" | "phase2", dt: DayType) =>
  PHASES[phase].slots.reduce((sum, s) => sum + s.minutes[dt], 0);

describe("seed schedule totals (spec 4)", () => {
  for (const phase of ["phase1", "phase2"] as const) {
    it(`${phase}: weekday 360, tuesday 270, weekend 660, week 3030`, () => {
      expect(total(phase, "weekday")).toBe(360);
      expect(total(phase, "tuesday")).toBe(270);
      expect(total(phase, "weekend")).toBe(660);
      // Sun, Mon, Wed, Thu = weekday; Tue; Fri, Sat = weekend
      const week = 4 * total(phase, "weekday") + total(phase, "tuesday") + 2 * total(phase, "weekend");
      expect(week).toBe(3030);
      expect(week).toBe(DEFAULT_CONFIG.weeklyTargetMinutes);
    });
  }

  it("phase 2 drops Java and bumps Architecture to 180", () => {
    expect(PHASES.phase2.slots.find((s) => s.id === "S1")).toBeUndefined();
    expect(PHASES.phase2.slots.find((s) => s.id === "S2")?.minutes).toEqual({ weekday: 180, tuesday: 180, weekend: 180 });
  });

  it("T03 is parked: inactive and has no slot", () => {
    expect(SEED_TRACKS.find((t) => t.id === "T03")?.active).toBe(false);
    for (const phase of Object.values(PHASES)) {
      expect(phase.slots.some((s) => s.trackIds.includes("T03"))).toBe(false);
    }
  });
});

describe("day type (Saudi week)", () => {
  it("maps Tue -> tuesday, Fri/Sat -> weekend, rest -> weekday", () => {
    expect(dayTypeFor(SUN)).toBe("weekday");
    expect(dayTypeFor(MON)).toBe("weekday");
    expect(dayTypeFor(TUE)).toBe("tuesday");
    expect(dayTypeFor(WED)).toBe("weekday");
    expect(dayTypeFor("2026-09-24")).toBe("weekday");
    expect(dayTypeFor(FRI)).toBe("weekend");
    expect(dayTypeFor(SAT)).toBe("weekend");
  });
});

describe("sprint week & phase", () => {
  const ctx = { config: config(), pausedDates: new Set<string>() };

  it("counts weeks from the start date", () => {
    expect(sprintWeek(SUN, ctx)).toBe(1);
    expect(sprintWeek(SAT, ctx)).toBe(1);
    expect(sprintWeek("2026-09-27", ctx)).toBe(2);
    expect(sprintWeek("2026-10-17", ctx)).toBe(4);
    expect(sprintWeek("2026-10-18", ctx)).toBe(5);
  });

  it("switches to phase 2 after phase1Weeks", () => {
    expect(phaseFor("2026-10-17", ctx)).toBe("phase1");
    expect(phaseFor("2026-10-18", ctx)).toBe("phase2");
    expect(scheduledSlotsFor("2026-10-18", ctx).some((s) => s.id === "S1")).toBe(false);
  });

  it("handles pre-sprint and unset start date", () => {
    expect(sprintWeek("2026-09-19", ctx)).toBe(0);
    expect(sprintLabel("2026-09-19", ctx)).toBe("Sprint starts tomorrow");
    expect(sprintLabel("2026-09-17", ctx)).toBe("Sprint starts in 3 days");
    expect(phaseFor("2026-09-19", ctx)).toBe("phase1");
    expect(scheduledSlotsFor("2026-09-19", ctx)).toEqual([]);
    const unset = { config: config({ startDate: null }), pausedDates: new Set<string>() };
    expect(sprintWeek(SUN, unset)).toBeNull();
    expect(sprintLabel(SUN, unset)).toBe("Sprint not started");
    expect(scheduledSlotsFor(SUN, unset)).toEqual([]);
  });

  it("a paused day shifts the sprint by one day when pauseExtendsSprint is on", () => {
    const shifted = { config: config(), pausedDates: new Set([WED]) };
    expect(sprintWeek(WED, shifted)).toBe(1); // the paused day keeps its own week
    expect(sprintWeek("2026-09-27", shifted)).toBe(1); // would be week 2 without the pause
    expect(sprintWeek("2026-09-28", shifted)).toBe(2);
    expect(phaseFor("2026-10-18", shifted)).toBe("phase1"); // Java window keeps 4 full weeks
    expect(phaseFor("2026-10-19", shifted)).toBe("phase2");
    expect(sprintLabel("2026-10-19", shifted)).toBe("Sprint · Week 5 · Phase 2");
  });

  it("a paused day does not shift when pauseExtendsSprint is off", () => {
    const fixed = { config: config({ pauseExtendsSprint: false }), pausedDates: new Set([WED]) };
    expect(sprintWeek("2026-09-27", fixed)).toBe(2);
    expect(phaseFor("2026-10-18", fixed)).toBe("phase2");
  });

  it("pauses before the start date are ignored", () => {
    const shifted = { config: config(), pausedDates: new Set(["2026-09-10"]) };
    expect(sprintWeek("2026-09-27", shifted)).toBe(2);
  });
});

describe("today's slots", () => {
  const ctx = { config: config(), pausedDates: new Set<string>() };

  it("lists only planned > 0 slots for the day type", () => {
    expect(scheduledSlotsFor(MON, ctx).map((s) => s.id)).toEqual(["S1", "S2", "S3", "S5", "S6", "S9"]);
    expect(scheduledSlotsFor(TUE, ctx).map((s) => s.id)).toEqual(["S1", "S2", "S3", "S5", "S9"]);
    expect(scheduledSlotsFor(FRI, ctx).map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"]);
  });

  it("snapshots planned minutes into a new log", () => {
    const log = newDailyLog(FRI, ctx);
    expect(log.entries.S3.plannedMinutes).toBe(180);
    expect(Object.keys(log.entries)).toHaveLength(9);
  });

  it("keeps logged data for slots that fell off the schedule", () => {
    const log = newDailyLog(MON, ctx);
    log.entries.S1.actualMinutes = 45;
    const phase2 = { config: config({ phase1Weeks: 0 }), pausedDates: new Set<string>() };
    const rows = resolveDay(MON, log, phase2);
    const s1 = rows.find((r) => r.slotId === "S1");
    expect(s1?.offSchedule).toBe(true);
    expect(s1?.actual).toBe(45);
    // untouched off-schedule entries are hidden
    expect(rows.filter((r) => r.offSchedule)).toHaveLength(1);
  });

  it("keeps a skipped-with-reason entry visible after it falls off the schedule", () => {
    const log = newDailyLog(MON, ctx);
    log.entries.S1.skipped = true;
    log.entries.S1.skipReason = "Travel";
    const phase2 = { config: config({ phase1Weeks: 0 }), pausedDates: new Set<string>() };
    const s1 = resolveDay(MON, log, phase2).find((r) => r.slotId === "S1");
    expect(s1?.offSchedule).toBe(true);
    expect(s1?.excused).toBe(true);
  });

  it("falls back to the schedule when a stored snapshot is a stale 0", () => {
    const log = newDailyLog(MON, ctx);
    log.entries.S1.plannedMinutes = 0; // created while off-schedule, now scheduled again
    const s1 = resolveDay(MON, log, ctx).find((r) => r.slotId === "S1");
    expect(s1?.planned).toBe(120);
    expect(s1?.offSchedule).toBe(false);
  });
});

/** Week of 2026-09-20 with a mix of completed, paused and skipped days. */
function sampleWeek() {
  const base = { config: config(), pausedDates: new Set<string>() };
  const sun = newDailyLog(SUN, base);
  for (const e of Object.values(sun.entries)) {
    e.completed = true;
    e.actualMinutes = e.plannedMinutes;
  }
  const mon: DailyLog = { ...newDailyLog(MON, base), paused: true, pauseReason: "Baby unwell" };
  const tue = newDailyLog(TUE, base);
  tue.entries.S1.skipped = true;
  tue.entries.S1.skipReason = "Late meeting";
  tue.entries.S9.completed = true;
  tue.entries.S9.actualMinutes = 30;
  const logs: Record<string, DailyLog> = { [SUN]: sun, [MON]: mon, [TUE]: tue };
  return buildCtx(config(), logs);
}

describe("week summary with excused work", () => {
  it("excludes paused/skipped sessions from missed and lowers the target", () => {
    const ctx = sampleWeek();
    const w = weekSummary(WED, ctx);
    expect(w.pausedDays).toBe(1);
    expect(w.skippedSessions).toBe(1);
    // Tuesday: S2, S3, S5 not completed and not excused (S1 skipped, S9 done)
    expect(w.missed).toBe(3);
    // Monday 360 paused + Tuesday S1 120 skipped
    expect(w.excusedMinutes).toBe(480);
    expect(w.targetAdjusted).toBe(3030 - 480);
    expect(w.actual).toBe(360 + 30);
    // Sun 360 + Tue (270 - 120) + Wed 360
    expect(w.plannedToDate).toBe(870);
  });

  it("measures a partial first week against the schedule, not the full target", () => {
    const ctx = buildCtx(config({ startDate: WED }), {});
    const w = weekSummary(WED, ctx);
    // Wed 360 + Thu 360 + Fri 660 + Sat 660
    expect(w.plannedFull).toBe(2040);
    expect(w.targetAdjusted).toBe(2040);
    expect(weekSummary("2026-09-15", ctx).targetAdjusted).toBe(0); // week before the sprint
  });

  it("does not count today's unfinished sessions as missed", () => {
    const ctx = sampleWeek();
    expect(weekSummary(TUE, ctx).missed).toBe(0);
  });
});

describe("track week stats", () => {
  it("attributes a shared slot to both tracks and computes adherence to date", () => {
    const ctx = sampleWeek();
    const baby = trackWeekStats("T06", WED, ctx);
    const family = trackWeekStats("T08", WED, ctx);
    expect(baby.actual).toBe(30);
    expect(family.actual).toBe(30);
    expect(baby.scheduled).toBe(4); // Sun, Mon(paused), Tue, Wed
    expect(baby.excused).toBe(1);
    expect(baby.missed).toBe(1); // Tuesday
    expect(baby.plannedToDate).toBe(90); // Sun + Tue + Wed (Mon excused)
    expect(baby.adherence).toBe(33);
  });

  it("guards divide-by-zero", () => {
    const ctx = sampleWeek();
    // T05 (Domain) is weekend-only: nothing planned through Wednesday.
    expect(trackWeekStats("T05", WED, ctx).adherence).toBeNull();
  });
});

describe("streaks", () => {
  it("skips excused days instead of breaking", () => {
    const ctx = sampleWeek();
    // T11 (Languages, daily): Sun done, Mon paused, Tue done, Wed (today) unfinished.
    expect(streakFor("T11", WED, ctx)).toBe(2);
  });

  it("breaks on an unexcused incomplete scheduled day", () => {
    const ctx = sampleWeek();
    // T02 (Architecture, daily): Sun done, Mon paused, Tue not done and not excused.
    expect(streakFor("T02", WED, ctx)).toBe(0);
  });

  it("skips unscheduled days", () => {
    const ctx = sampleWeek();
    // T07 (Fitness): Sun done, Mon paused, Tue unscheduled, Wed unfinished today.
    expect(streakFor("T07", WED, ctx)).toBe(1);
  });

  it("an unfinished today never breaks a streak", () => {
    const ctx = sampleWeek();
    expect(streakFor("T11", TUE, ctx)).toBe(2);
  });
});

describe("cumulative minutes", () => {
  it("sums since the start date across slots covering the track", () => {
    const ctx = sampleWeek();
    expect(cumulativeMinutes("T11", ctx)).toBe(60);
    expect(cumulativeMinutes("T08", ctx)).toBe(30);
    expect(cumulativeMinutes("T03", ctx)).toBe(0);
  });
});

describe("guardrail", () => {
  it("warns on 4+ missed sessions", () => {
    const ctx = sampleWeek();
    ctx.logs[TUE].entries.S9.completed = false;
    ctx.logs[TUE].entries.S9.actualMinutes = 0;
    const g = guardrail(WED, ctx);
    expect(g.missed).toBe(4);
    expect(g.warn).toBe(true);
  });

  it("warns when logged time is under 70% of planned through yesterday", () => {
    const ctx = sampleWeek();
    const g = guardrail(WED, ctx);
    // planned through Tue (excused removed) = 360 + 150 = 510; logged 390 -> 76% -> ok on ratio
    expect(g.ratio).toBeCloseTo(390 / 510, 3);
    expect(g.missed).toBe(3);
    expect(g.warn).toBe(false);
    ctx.logs[SUN].entries.S1.actualMinutes = 0; // now 270 / 510 = 53%
    expect(guardrail(WED, ctx).warn).toBe(true);
  });

  it("is quiet on the first morning of a week", () => {
    const ctx = sampleWeek();
    expect(guardrail(SUN, ctx).warn).toBe(false);
  });
});

describe("weekly trend", () => {
  it("returns n weeks oldest first with effective planned", () => {
    const ctx = sampleWeek();
    const t = weeklyTrend(WED, 4, ctx);
    expect(t).toHaveLength(4);
    expect(t[3].weekStart).toBe(SUN);
    expect(t[3].actual).toBe(390);
    expect(t[3].planned).toBe(870);
    expect(t[0].actual).toBe(0);
  });
});

describe("weekly review nudge", () => {
  it("fires on the last Friday of the month and the Saturday after", () => {
    expect(isLastFridayOfMonth(FRI)).toBe(true);
    expect(isLastFridayOfMonth("2026-09-18")).toBe(false);
    expect(reviewNudgeFor(FRI, {})).toBe(weekStartISO(FRI));
    expect(reviewNudgeFor(SAT, {})).toBe(weekStartISO(FRI));
    expect(reviewNudgeFor(WED, {})).toBeNull();
  });

  it("stays quiet once a review exists", () => {
    const key = weekStartISO(FRI);
    expect(reviewNudgeFor(FRI, { [key]: { weekStart: key, held: "", slipped: "", adjust: "", createdAt: 0 } })).toBeNull();
  });
});

describe("default start date", () => {
  it("is the next Sunday, or today when today is Sunday", () => {
    expect(defaultStartDateISO(new Date(2026, 8, 18))).toBe(SUN); // Friday -> Sunday
    expect(defaultStartDateISO(new Date(2026, 8, 20))).toBe(SUN); // Sunday -> itself
    expect(defaultStartDateISO(new Date(2026, 8, 21))).toBe("2026-09-27");
  });
});

describe("load adjustment", () => {
  const reduced = {
    config: config({ loadFactor: 0.8, loadFrom: TUE, loadUntil: "2026-10-05" }),
    pausedDates: new Set<string>(),
  };

  it("applies only inside the window", () => {
    expect(loadFactorOn(MON, reduced)).toBe(1);
    expect(loadFactorOn(TUE, reduced)).toBe(0.8);
    expect(loadFactorOn("2026-10-05", reduced)).toBe(0.8);
    expect(loadFactorOn("2026-10-06", reduced)).toBe(1);
    const open = { config: config({ loadFactor: 0.8, loadFrom: TUE, loadUntil: null }), pausedDates: new Set<string>() };
    expect(loadFactorOn("2027-01-01", open)).toBe(0.8);
    const off = { config: config({ loadFactor: 0.8, loadFrom: null }), pausedDates: new Set<string>() };
    expect(loadFactorOn(TUE, off)).toBe(1);
  });

  it("scales slot minutes, rounded to 5 and never below 5", () => {
    const s1 = PHASES.phase1.slots.find((s) => s.id === "S1")!; // 120
    const s5 = PHASES.phase1.slots.find((s) => s.id === "S5")!; // 30
    const s6 = PHASES.phase1.slots.find((s) => s.id === "S6")!; // 0 on Tuesday
    expect(slotMinutesOn(s1, MON, reduced)).toBe(120);
    expect(slotMinutesOn(s1, WED, reduced)).toBe(95); // 96 -> 95
    expect(slotMinutesOn(s5, WED, reduced)).toBe(25); // 24 -> 25
    expect(slotMinutesOn(s6, TUE, reduced)).toBe(0); // unscheduled stays unscheduled
    const tiny = { config: config({ loadFactor: 0.1, loadFrom: SUN }), pausedDates: new Set<string>() };
    expect(slotMinutesOn(s5, MON, tiny)).toBe(5);
  });

  it("flows into day totals, snapshots and the weekly target", () => {
    expect(plannedTotalFor(MON, reduced)).toBe(360);
    expect(plannedTotalFor(WED, reduced)).toBe(95 + 50 + 25 + 25 + 70 + 25);
    expect(newDailyLog(WED, reduced).entries.S1.plannedMinutes).toBe(95);
    const ctx = buildCtx(reduced.config, {});
    const w = weekSummary(WED, ctx);
    expect(w.plannedFull).toBeLessThan(3030);
    expect(w.targetAdjusted).toBe(w.plannedFull);
  });
});

describe("trim and partial", () => {
  it("a trimmed plan lowers the target and counts against the week as trimmed", () => {
    const base = { config: config(), pausedDates: new Set<string>() };
    const mon = newDailyLog(MON, base);
    mon.entries.S1.originalPlannedMinutes = 120;
    mon.entries.S1.plannedMinutes = 45;
    mon.entries.S1.adjustReason = "Late meeting";
    mon.entries.S1.actualMinutes = 45;
    mon.entries.S1.completed = true;
    const ctx = buildCtx(config(), { [MON]: mon });
    const row = resolveDay(MON, mon, ctx).find((r) => r.slotId === "S1")!;
    expect(row.trimmed).toBe(true);
    expect(row.planned).toBe(45);
    const w = weekSummary(TUE, ctx);
    expect(w.trimmedMinutes).toBe(75);
    expect(w.plannedFull).toBe(3030 - 75);
    expect(w.targetAdjusted).toBe(3030 - 75);
    expect(w.missed).toBe(11); // Sunday untouched (6) + the other five Monday sessions
  });

  it("splits partial from missed and keeps the spec's threshold on the sum", () => {
    const ctx = sampleWeek();
    ctx.logs[TUE].entries.S2.actualMinutes = 20; // some Architecture time, not ticked
    const w = weekSummary(WED, ctx);
    expect(w.partial).toBe(1);
    expect(w.missed).toBe(2);
    const t = trackWeekStats("T02", WED, ctx);
    expect(t.partial).toBe(1);
    expect(t.missed).toBe(0);
    ctx.logs[TUE].entries.S9.completed = false; // 30 min logged, now partial too
    const g = guardrail(WED, ctx);
    expect(g.missed + g.partial).toBe(4);
    expect(g.warn).toBe(true);
    expect(g.reasons[0]).toMatch(/4 sessions not completed.*2 partial/);
  });
});

describe("sustained guardrail", () => {
  /** Two full weeks before the sample week, each left untouched (everything missed). */
  function withBadHistory() {
    const ctx = sampleWeek();
    return buildCtx(config({ startDate: "2026-09-06" }), ctx.logs);
  }

  it("reports history oldest-first and a streak ending with this week", () => {
    const ctx = withBadHistory();
    const g = guardrail(WED, ctx);
    // weeks of 30 Aug (pre-sprint, quiet), 6 Sep (missed), 13 Sep (missed), 20 Sep (this week: 3 missed, 76% -> ok)
    expect(g.history).toEqual([false, true, true, false]);
    expect(g.warn).toBe(false);
    expect(g.streak).toBe(0);
    expect(g.previousStreak).toBe(2);
  });

  it("counts this week when it warns", () => {
    const ctx = withBadHistory();
    ctx.logs[TUE].entries.S9.completed = false; // 4 not completed on Tuesday
    const g = guardrail(WED, ctx);
    expect(g.warn).toBe(true);
    expect(g.streak).toBe(3);
  });

  it("judges a finished week on all seven days", () => {
    const ctx = sampleWeek();
    // Look at the sample week from the following Wednesday: Wed-Sat of it were never logged.
    const g = guardrail("2026-09-30", ctx);
    expect(g.history[g.history.length - 2]).toBe(true);
    expect(g.previousStreak).toBe(1);
  });
});

describe("day status", () => {
  it("classifies each kind of day", () => {
    const ctx = sampleWeek();
    expect(dayStatus("2026-09-19", WED, ctx)).toBe("none"); // pre-sprint
    expect(dayStatus(SUN, WED, ctx)).toBe("done");
    expect(dayStatus(MON, WED, ctx)).toBe("paused");
    expect(dayStatus(TUE, WED, ctx)).toBe("partial"); // one session done
    expect(dayStatus(WED, WED, ctx)).toBe("open"); // today, nothing yet
    expect(dayStatus("2026-09-24", WED, ctx)).toBe("future");
    expect(dayStatus(WED, "2026-09-24", ctx)).toBe("missed"); // yesterday, untouched
  });

  it("treats a day where every session was skipped as excused", () => {
    const ctx = sampleWeek();
    const tue = ctx.logs[TUE];
    for (const e of Object.values(tue.entries)) {
      e.completed = false;
      e.actualMinutes = 0;
      e.skipped = true;
    }
    expect(dayStatus(TUE, WED, ctx)).toBe("paused");
  });
});

describe("recent task notes", () => {
  it("lists a track's notes newest first, capped", () => {
    const ctx = sampleWeek();
    ctx.logs[SUN].entries.S2.note = "Read DDIA ch. 5";
    ctx.logs[TUE].entries.S2.note = "  Raft membership changes ";
    ctx.logs[TUE].entries.S1.note = "Java note (other track)";
    const notes = recentTaskNotes("T02", ctx, 5);
    expect(notes.map((n) => n.note)).toEqual(["Raft membership changes", "Read DDIA ch. 5"]);
    expect(notes[0]).toMatchObject({ date: TUE, slotId: "S2", label: "Architecture" });
    expect(recentTaskNotes("T02", ctx, 1)).toHaveLength(1);
    expect(recentTaskNotes("T11", ctx)).toEqual([]);
  });
});
