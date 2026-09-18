import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/dexie";
import { useStore } from "./useStore";

const SUN = "2026-09-20";
const MON = "2026-09-21";

beforeEach(async () => {
  await db.delete();
  await db.open();
  useStore.setState({
    ready: false,
    error: null,
    config: { ...useStore.getState().config, startDate: null },
    tracks: [],
    milestones: [],
    logs: {},
    scratch: {},
    reviews: {},
    runningTimer: null,
  });
  await useStore.getState().init();
  useStore.getState().setConfig({ startDate: SUN });
});

describe("seed", () => {
  it("loads tracks, milestones, scratch cards and config on first run", async () => {
    const s = useStore.getState();
    expect(s.ready).toBe(true);
    expect(s.tracks).toHaveLength(11);
    expect(s.milestones).toHaveLength(8);
    expect(Object.keys(s.scratch)).toHaveLength(11);
    expect(s.config.phase1Weeks).toBe(4);
    expect(await db.tracks.count()).toBe(11);
  });

  it("is idempotent and keeps user changes", async () => {
    useStore.getState().setMilestoneDone("M01", true);
    await useStore.getState().init();
    expect(useStore.getState().milestones.find((m) => m.id === "M01")?.done).toBe(true);
    expect(await db.milestones.count()).toBe(8);
  });
});

describe("daily log mutations", () => {
  it("creates the log with snapshotted planned minutes on first touch", async () => {
    useStore.getState().setCompleted(MON, "S1", true);
    const log = useStore.getState().logs[MON];
    expect(log.entries.S1.completed).toBe(true);
    expect(log.entries.S1.plannedMinutes).toBe(120);
    expect(Object.keys(log.entries)).toHaveLength(6);
    expect((await db.dailyLogs.get(MON))?.entries.S1.completed).toBe(true);
  });

  it("clamps manual minutes to a sane range", () => {
    useStore.getState().setActualMinutes(MON, "S2", -5);
    expect(useStore.getState().logs[MON].entries.S2.actualMinutes).toBe(0);
    useStore.getState().setActualMinutes(MON, "S2", 99999);
    expect(useStore.getState().logs[MON].entries.S2.actualMinutes).toBe(1440);
  });

  it("pauses and resumes a day with a reason", () => {
    useStore.getState().pauseDay(MON, "  Travel  ");
    expect(useStore.getState().logs[MON]).toMatchObject({ paused: true, pauseReason: "Travel" });
    useStore.getState().resumeDay(MON);
    expect(useStore.getState().logs[MON]).toMatchObject({ paused: false, pauseReason: "" });
  });

  it("skips and unskips a single task", () => {
    useStore.getState().skipTask(MON, "S6", "Gym closed");
    expect(useStore.getState().logs[MON].entries.S6).toMatchObject({ skipped: true, skipReason: "Gym closed" });
    useStore.getState().unskipTask(MON, "S6");
    expect(useStore.getState().logs[MON].entries.S6.skipped).toBe(false);
  });
});

describe("tick-only logging", () => {
  it("fills the planned minutes on complete and takes them back on un-complete", () => {
    const s = useStore.getState();
    s.setCompleted(MON, "S1", true);
    let e = useStore.getState().logs[MON].entries.S1;
    expect(e.actualMinutes).toBe(120);
    expect(e.minutesAutoFilled).toBe(true);
    s.setCompleted(MON, "S1", false);
    e = useStore.getState().logs[MON].entries.S1;
    expect(e.actualMinutes).toBe(0);
    expect(e.minutesAutoFilled).toBeUndefined();
  });

  it("never overrides minutes the user entered", () => {
    const s = useStore.getState();
    s.setActualMinutes(MON, "S2", 40);
    s.setCompleted(MON, "S2", true);
    expect(useStore.getState().logs[MON].entries.S2.actualMinutes).toBe(40);
    s.setCompleted(MON, "S2", false);
    expect(useStore.getState().logs[MON].entries.S2.actualMinutes).toBe(40);
    // editing an auto-filled value makes it the user's
    s.setCompleted(MON, "S3", true);
    s.addMinutes(MON, "S3", 10);
    s.setCompleted(MON, "S3", false);
    expect(useStore.getState().logs[MON].entries.S3.actualMinutes).toBe(40);
  });
});

describe("trim", () => {
  it("lowers the day's plan with a reason and restores it on untrim", () => {
    const s = useStore.getState();
    s.trimTask(MON, "S1", 45, "  Late meeting ");
    let e = useStore.getState().logs[MON].entries.S1;
    expect(e).toMatchObject({ plannedMinutes: 45, originalPlannedMinutes: 120, adjustReason: "Late meeting" });
    s.trimTask(MON, "S1", 500, ""); // cannot exceed the original; empty reason gets a label
    e = useStore.getState().logs[MON].entries.S1;
    expect(e).toMatchObject({ plannedMinutes: 120, originalPlannedMinutes: 120, adjustReason: "Trimmed" });
    s.untrimTask(MON, "S1");
    e = useStore.getState().logs[MON].entries.S1;
    expect(e.plannedMinutes).toBe(120);
    expect(e.adjustReason).toBe("");
    expect(e.originalPlannedMinutes).toBeUndefined();
  });
});

describe("load adjustment", () => {
  it("re-snapshots today and later, keeps history and trims, and restores on clear", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 8, 23, 9, 0, 0)); // Wednesday
      const s = useStore.getState();
      s.setCompleted("2026-09-21", "S1", true); // Monday, history
      s.setActualMinutes("2026-09-23", "S1", 10); // today
      s.trimTask("2026-09-23", "S2", 30, "Guests");
      s.setDayNote("2026-09-24", "tomorrow"); // future log exists

      s.setLoad(0.8, "2026-09-23", "2026-10-06");
      const st = useStore.getState();
      expect(st.config).toMatchObject({ loadFactor: 0.8, loadFrom: "2026-09-23", loadUntil: "2026-10-06" });
      expect(st.logs["2026-09-21"].entries.S1.plannedMinutes).toBe(120); // history untouched
      expect(st.logs["2026-09-23"].entries.S1.plannedMinutes).toBe(95); // today re-snapshotted
      expect(st.logs["2026-09-23"].entries.S2.plannedMinutes).toBe(30); // trim wins
      expect(st.logs["2026-09-24"].entries.S1.plannedMinutes).toBe(95);

      s.clearLoad();
      const after = useStore.getState();
      expect(after.config.loadFactor).toBe(1);
      expect(after.logs["2026-09-23"].entries.S1.plannedMinutes).toBe(120);
      expect(after.logs["2026-09-23"].entries.S2.plannedMinutes).toBe(30);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("stopwatch", () => {
  it("banks elapsed minutes on stop and survives a reload", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 8, 21, 9, 0, 0));
      useStore.getState().startTimer(MON, "S1");
      expect(useStore.getState().runningTimer?.slotId).toBe("S1");

      // Simulate app close/reopen while the timer runs.
      await useStore.getState().init();
      expect(useStore.getState().runningTimer?.slotId).toBe("S1");

      vi.setSystemTime(new Date(2026, 8, 21, 9, 25, 20));
      useStore.getState().stopTimer(MON, "S1");
      const e = useStore.getState().logs[MON].entries.S1;
      expect(e.actualMinutes).toBe(25);
      expect(e.timerStartedAt).toBeUndefined();
      expect(useStore.getState().runningTimer).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("banks a corrected figure instead of the elapsed time when asked", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 8, 21, 9, 0, 0));
      useStore.getState().startTimer(MON, "S1");
      vi.setSystemTime(new Date(2026, 8, 21, 15, 0, 0)); // forgot it for 6 h
      useStore.getState().stopTimer(MON, "S1", 90);
      expect(useStore.getState().logs[MON].entries.S1.actualMinutes).toBe(90);
      expect(useStore.getState().runningTimer).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starting a second stopwatch stops and banks the first", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 8, 21, 9, 0, 0));
      useStore.getState().startTimer(MON, "S1");
      vi.setSystemTime(new Date(2026, 8, 21, 9, 10, 0));
      useStore.getState().startTimer(MON, "S2");
      const log = useStore.getState().logs[MON];
      expect(log.entries.S1.actualMinutes).toBe(10);
      expect(log.entries.S1.timerStartedAt).toBeUndefined();
      expect(log.entries.S2.timerStartedAt).toBeDefined();
      expect(useStore.getState().runningTimer?.slotId).toBe("S2");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("scratch cards", () => {
  it("adds, resolves and deletes open questions", () => {
    const s = useStore.getState();
    s.addQuestion("T02", "How does Raft handle membership change?");
    s.addQuestion("T02", "   ");
    let card = useStore.getState().scratch.T02;
    expect(card.openQuestions).toHaveLength(1);
    const id = card.openQuestions[0].id;
    s.setQuestionResolved("T02", id, true);
    expect(useStore.getState().scratch.T02.openQuestions[0].resolved).toBe(true);
    s.deleteQuestion("T02", id);
    card = useStore.getState().scratch.T02;
    expect(card.openQuestions).toHaveLength(0);
  });
});

describe("nightly snapshots", () => {
  const at = (d: number, h: number, m: number) => new Date(2026, 8, d, h, m, 0).getTime();

  it("takes a catch-up on first run, skips when nothing changed, and a nightly at the scheduled time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(at(18, 9, 0));
      const s = useStore.getState();
      s.setCompleted(MON, "S1", true);
      let r = await s.runNightlyBackup();
      expect(r.ran).toBe(true);
      expect(r.snapshot?.reason).toBe("catch-up");
      expect(useStore.getState().snapshots).toHaveLength(1);

      // Same day, later: not due.
      vi.setSystemTime(at(18, 12, 0));
      r = await s.runNightlyBackup();
      expect(r.ran).toBe(false);

      // 23:58 with unchanged data: runs, but stores nothing new.
      vi.setSystemTime(at(18, 23, 58));
      r = await s.runNightlyBackup();
      expect(r.ran).toBe(true);
      expect(r.snapshot).toBeNull();
      expect(useStore.getState().snapshots).toHaveLength(1);

      // Next night with a change: a "nightly" snapshot.
      s.setActualMinutes("2026-09-19", "S2", 25);
      vi.setSystemTime(at(19, 23, 59));
      r = await s.runNightlyBackup();
      expect(r.snapshot?.reason).toBe("nightly");
      expect(useStore.getState().snapshots).toHaveLength(2);
      expect(useStore.getState().snapshots[0].takenAt).toBe(at(19, 23, 59)); // newest first
    } finally {
      vi.useRealTimers();
    }
  });

  it("respects the enabled flag and prunes to `keep`", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const s = useStore.getState();
      s.setAutoBackup({ enabled: false });
      vi.setSystemTime(at(18, 23, 59));
      expect((await s.runNightlyBackup()).ran).toBe(false);
      s.setAutoBackup({ enabled: true, keep: 2 });
      for (let d = 18; d <= 21; d++) {
        s.setActualMinutes(`2026-09-${d}`, "S1", d);
        vi.setSystemTime(at(d, 23, 59));
        await s.runNightlyBackup();
      }
      expect(useStore.getState().snapshots).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores a snapshot after keeping a before-restore copy, and reset keeps snapshots", async () => {
    const s = useStore.getState();
    s.setScratchNotes("T04", "first");
    await s.runNightlyBackup(true);
    const id = useStore.getState().snapshots[0].id;
    s.setScratchNotes("T04", "second");
    await s.restoreFromSnapshot(id);
    expect(useStore.getState().scratch.T04.notes).toBe("first");
    const reasons = useStore.getState().snapshots.map((m) => m.reason);
    expect(reasons).toContain("before-restore");
    await s.resetData();
    expect(useStore.getState().config.startDate).toBeNull();
    expect(useStore.getState().snapshots.length).toBeGreaterThanOrEqual(2);
    const snap = await s.readSnapshot(id);
    expect(snap?.json).toContain('"first"');
  });
});

describe("export / import / reset", () => {
  it("round-trips all data", async () => {
    const s = useStore.getState();
    s.setCompleted(MON, "S1", true);
    s.setScratchNotes("T04", "Try a RAG POC");
    s.setMilestoneDone("M03", true);
    s.saveReview({ weekStart: SUN, held: "Java", slipped: "Gym", adjust: "Move gym earlier" });

    const backup = await s.exportData();
    expect(backup.dailyLogs).toHaveLength(1);
    expect(useStore.getState().config.lastExportAt).toBeNull(); // only marked once the file is saved
    s.markExported();
    expect(useStore.getState().config.lastExportAt).not.toBeNull();

    useStore.setState({ tab: "settings" });
    await s.resetData();
    expect(useStore.getState().logs).toEqual({});
    expect(useStore.getState().tab).toBe("today");
    expect(useStore.getState().milestones.find((m) => m.id === "M03")?.done).toBe(false);

    await useStore.getState().importData(JSON.parse(JSON.stringify(backup)));
    const after = useStore.getState();
    expect(after.logs[MON].entries.S1.completed).toBe(true);
    expect(after.scratch.T04.notes).toBe("Try a RAG POC");
    expect(after.milestones.find((m) => m.id === "M03")?.done).toBe(true);
    expect(after.reviews[SUN].adjust).toBe("Move gym earlier");
    expect(after.config.startDate).toBe(SUN);
  });

  it("rejects foreign files", async () => {
    await expect(useStore.getState().importData({ hello: "world" })).rejects.toThrow(/not exported/);
  });
});
