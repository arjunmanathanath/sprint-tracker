import { create } from "zustand";
import { db } from "../db/dexie";
import { ensureSeeded } from "../db/seedLoader";
import { exportAll, importAll, resetAll, validateBackup } from "../db/backup";
import { DEFAULT_CONFIG } from "../seed/config";
import type {
  BackupFile,
  DailyLog,
  Milestone,
  OpenQuestion,
  ScratchCard,
  SprintConfig,
  TaskEntry,
  Track,
  WeeklyReview,
} from "../types";
import { todayISO, type ISODate } from "../logic/dates";
import { buildCtx } from "../logic/stats";
import { newDailyLog, newTaskEntry, plannedMinutesFor, scheduledSlotsFor, slotMinutesOn } from "../logic/schedule";

export interface RunningTimer {
  date: ISODate;
  slotId: string;
  startedAt: number;
}

export type Tab = "today" | "progress" | "scratch" | "settings";

interface State {
  ready: boolean;
  error: string | null;
  tab: Tab;
  /** The day shown on the Today screen; kept across tab switches. */
  viewDate: ISODate;
  config: SprintConfig;
  tracks: Track[];
  milestones: Milestone[];
  logs: Record<ISODate, DailyLog>;
  scratch: Record<string, ScratchCard>;
  reviews: Record<ISODate, WeeklyReview>;
  runningTimer: RunningTimer | null;
}

interface Actions {
  init: () => Promise<void>;
  setTab: (tab: Tab) => void;
  setViewDate: (date: ISODate) => void;
  /** Jump to a day on the Today screen. */
  openDay: (date: ISODate) => void;
  setConfig: (patch: Partial<Omit<SprintConfig, "id">>) => void;

  // Day / task
  setCompleted: (date: ISODate, slotId: string, completed: boolean) => void;
  setActualMinutes: (date: ISODate, slotId: string, minutes: number) => void;
  addMinutes: (date: ISODate, slotId: string, delta: number) => void;
  setTaskNote: (date: ISODate, slotId: string, note: string) => void;
  setDayNote: (date: ISODate, note: string) => void;
  startTimer: (date: ISODate, slotId: string) => void;
  /** Stop and bank the elapsed minutes, or `minutesOverride` when the user corrected a long run. */
  stopTimer: (date: ISODate, slotId: string, minutesOverride?: number) => void;

  // Pause / skip / trim (excused or adjusted with a reason)
  pauseDay: (date: ISODate, reason: string) => void;
  resumeDay: (date: ISODate) => void;
  skipTask: (date: ISODate, slotId: string, reason: string) => void;
  unskipTask: (date: ISODate, slotId: string) => void;
  /** Lower this day's plan for one task ("could only do 45 min because..."). */
  trimTask: (date: ISODate, slotId: string, minutes: number, reason: string) => void;
  untrimTask: (date: ISODate, slotId: string) => void;

  // Load adjustment ("cut load ~20% and re-plan")
  setLoad: (factor: number, from: ISODate, until: ISODate | null) => void;
  clearLoad: () => void;

  // Progress
  setMilestoneDone: (id: string, done: boolean) => void;
  saveReview: (review: Omit<WeeklyReview, "createdAt">) => void;

  // Scratch
  setScratchNotes: (trackId: string, notes: string) => void;
  addQuestion: (trackId: string, text: string) => void;
  setQuestionResolved: (trackId: string, questionId: string, resolved: boolean) => void;
  deleteQuestion: (trackId: string, questionId: string) => void;

  // Data
  exportData: () => Promise<BackupFile>;
  /** Call once the exported file has actually been saved/shared. */
  markExported: () => void;
  dismissError: () => void;
  importData: (raw: unknown) => Promise<void>;
  resetData: () => Promise<void>;
}

export type Store = State & Actions;

const keyBy = <T, K extends keyof T>(rows: T[], key: K): Record<string, T> =>
  Object.fromEntries(rows.map((r) => [String(r[key]), r]));

function findRunningTimer(logs: Record<ISODate, DailyLog>): RunningTimer | null {
  for (const log of Object.values(logs)) {
    for (const e of Object.values(log.entries)) {
      if (e.timerStartedAt) return { date: log.date, slotId: e.slotId, startedAt: e.timerStartedAt };
    }
  }
  return null;
}

/**
 * Write-through: state is already updated; surface persistence failures without blocking
 * the UI, and clear the banner again as soon as a later write succeeds.
 */
function persist(p: Promise<unknown>, set: (s: Partial<State>) => void, get: () => State) {
  p.then(
    () => {
      if (get().error) set({ error: null });
    },
    (err: unknown) => {
      console.error("persist failed", err);
      set({ error: err instanceof Error ? err.message : "Could not save to local storage." });
    },
  );
}

export const useStore = create<Store>()((set, get) => {
  async function loadAll() {
    const [config, tracks, milestones, logs, cards, reviews] = await Promise.all([
      db.config.get("config"),
      db.tracks.toArray(),
      db.milestones.toArray(),
      db.dailyLogs.toArray(),
      db.scratchCards.toArray(),
      db.reviews.toArray(),
    ]);
    const logMap = keyBy(logs, "date");
    set({
      config: config ?? DEFAULT_CONFIG,
      tracks: [...tracks].sort((a, b) => a.id.localeCompare(b.id)),
      milestones,
      logs: logMap,
      scratch: keyBy(cards, "trackId"),
      reviews: keyBy(reviews, "weekStart"),
      runningTimer: findRunningTimer(logMap),
    });
  }

  const patchLog = (date: ISODate, fn: (log: DailyLog) => DailyLog): DailyLog => {
    const s = get();
    const base = s.logs[date] ?? newDailyLog(date, buildCtx(s.config, s.logs));
    const next = fn(base);
    set({ logs: { ...s.logs, [date]: next } });
    persist(db.dailyLogs.put(next), set, get);
    return next;
  };

  const patchEntry = (date: ISODate, slotId: string, fn: (entry: TaskEntry) => TaskEntry) =>
    patchLog(date, (log) => {
      const s = get();
      const existing =
        log.entries[slotId] ?? newTaskEntry(slotId, plannedMinutesFor(slotId, date, buildCtx(s.config, s.logs)));
      return { ...log, entries: { ...log.entries, [slotId]: fn(existing) } };
    });

  const patchCard = (trackId: string, fn: (card: ScratchCard) => ScratchCard) => {
    const s = get();
    const base = s.scratch[trackId] ?? { trackId, notes: "", openQuestions: [] };
    const next = fn(base);
    set({ scratch: { ...s.scratch, [trackId]: next } });
    persist(db.scratchCards.put(next), set, get);
  };

  const clamp = (n: number) => Math.max(0, Math.min(24 * 60, Math.round(n)));

  /**
   * Re-snapshot planned minutes for logs on/after `fromDate` from the current schedule and
   * load factor. Trimmed entries and slots not scheduled that day are left alone; days before
   * `fromDate` keep their history.
   */
  const resnapshot = (fromDate: ISODate) => {
    const s = get();
    const ctx = buildCtx(s.config, s.logs);
    const changed: DailyLog[] = [];
    const logs = { ...s.logs };
    for (const log of Object.values(s.logs)) {
      if (log.date < fromDate) continue;
      let touched = false;
      const entries = { ...log.entries };
      for (const slot of scheduledSlotsFor(log.date, ctx)) {
        const e = entries[slot.id];
        if (!e || e.adjustReason) continue;
        const planned = slotMinutesOn(slot, log.date, ctx);
        if (e.plannedMinutes !== planned) {
          entries[slot.id] = { ...e, plannedMinutes: planned };
          touched = true;
        }
      }
      if (touched) {
        const next = { ...log, entries };
        logs[log.date] = next;
        changed.push(next);
      }
    }
    if (changed.length) {
      set({ logs });
      persist(db.dailyLogs.bulkPut(changed), set, get);
    }
  };

  return {
    ready: false,
    error: null,
    tab: "today",
    viewDate: todayISO(),
    config: DEFAULT_CONFIG,
    tracks: [],
    milestones: [],
    logs: {},
    scratch: {},
    reviews: {},
    runningTimer: null,

    init: async () => {
      try {
        await ensureSeeded(db);
        await loadAll();
        set({ ready: true, error: null });
      } catch (err) {
        console.error(err);
        set({ ready: true, error: err instanceof Error ? err.message : "Could not open local storage." });
      }
    },

    setTab: (tab) => set({ tab }),

    setViewDate: (date) => set({ viewDate: date }),

    openDay: (date) => set({ viewDate: date, tab: "today" }),

    setConfig: (patch) => {
      const config: SprintConfig = { ...get().config, ...patch, id: "config" };
      set({ config });
      persist(db.config.put(config), set, get);
    },

    setCompleted: (date, slotId, completed) => {
      patchEntry(date, slotId, (e) => {
        if (completed && e.actualMinutes === 0 && !e.timerStartedAt) {
          // Tick-only logging: take the plan as the time spent (still editable).
          const planned = e.plannedMinutes > 0 ? e.plannedMinutes : plannedMinutesFor(slotId, date, buildCtx(get().config, get().logs));
          if (planned > 0) return { ...e, completed, actualMinutes: planned, minutesAutoFilled: true };
        }
        if (!completed && e.minutesAutoFilled && e.actualMinutes === e.plannedMinutes) {
          // Un-ticking an auto-filled task takes the assumed time back out.
          const { minutesAutoFilled: _drop, ...rest } = e;
          void _drop;
          return { ...rest, completed, actualMinutes: 0 };
        }
        return { ...e, completed };
      });
    },

    setActualMinutes: (date, slotId, minutes) => {
      patchEntry(date, slotId, (e) => ({ ...e, actualMinutes: clamp(minutes), minutesAutoFilled: undefined }));
    },

    addMinutes: (date, slotId, delta) => {
      patchEntry(date, slotId, (e) => ({ ...e, actualMinutes: clamp(e.actualMinutes + delta), minutesAutoFilled: undefined }));
    },

    setTaskNote: (date, slotId, note) => {
      patchEntry(date, slotId, (e) => ({ ...e, note }));
    },

    setDayNote: (date, note) => {
      patchLog(date, (log) => ({ ...log, dayNote: note }));
    },

    startTimer: (date, slotId) => {
      const running = get().runningTimer;
      // Only one stopwatch at a time: starting a new one stops and banks the other.
      if (running && (running.date !== date || running.slotId !== slotId)) {
        get().stopTimer(running.date, running.slotId);
      } else if (running) {
        return;
      }
      const startedAt = Date.now();
      patchEntry(date, slotId, (e) => ({ ...e, timerStartedAt: startedAt }));
      set({ runningTimer: { date, slotId, startedAt } });
    },

    stopTimer: (date, slotId, minutesOverride) => {
      patchEntry(date, slotId, (e) => {
        if (!e.timerStartedAt) return e;
        const elapsedMin = minutesOverride ?? Math.round((Date.now() - e.timerStartedAt) / 60000);
        const { timerStartedAt: _dropped, ...rest } = e;
        void _dropped;
        return { ...rest, actualMinutes: clamp(e.actualMinutes + elapsedMin), minutesAutoFilled: undefined };
      });
      const running = get().runningTimer;
      if (running && running.date === date && running.slotId === slotId) set({ runningTimer: null });
    },

    pauseDay: (date, reason) => {
      patchLog(date, (log) => ({ ...log, paused: true, pauseReason: reason.trim() }));
    },

    resumeDay: (date) => {
      patchLog(date, (log) => ({ ...log, paused: false, pauseReason: "" }));
    },

    skipTask: (date, slotId, reason) => {
      patchEntry(date, slotId, (e) => ({ ...e, skipped: true, skipReason: reason.trim() }));
    },

    unskipTask: (date, slotId) => {
      patchEntry(date, slotId, (e) => ({ ...e, skipped: false, skipReason: "" }));
    },

    trimTask: (date, slotId, minutes, reason) => {
      patchEntry(date, slotId, (e) => {
        const original = e.originalPlannedMinutes ?? e.plannedMinutes;
        const trimmed = Math.max(5, Math.min(original, Math.round(minutes)));
        return { ...e, originalPlannedMinutes: original, plannedMinutes: trimmed, adjustReason: reason.trim() || "Trimmed" };
      });
    },

    untrimTask: (date, slotId) => {
      patchEntry(date, slotId, (e) => {
        const { originalPlannedMinutes, ...rest } = e;
        return { ...rest, plannedMinutes: originalPlannedMinutes ?? e.plannedMinutes, adjustReason: "" };
      });
    },

    setLoad: (factor, from, until) => {
      const f = Math.max(0.1, Math.min(1, factor));
      get().setConfig({ loadFactor: f, loadFrom: f < 1 ? from : null, loadUntil: f < 1 ? until : null });
      // History before today stays as it was; today and later follow the new plan.
      resnapshot(from > todayISO() ? from : todayISO());
    },

    clearLoad: () => {
      get().setConfig({ loadFactor: 1, loadFrom: null, loadUntil: null });
      resnapshot(todayISO());
    },

    setMilestoneDone: (id, done) => {
      const milestones = get().milestones.map((m) => (m.id === id ? { ...m, done } : m));
      set({ milestones });
      const m = milestones.find((x) => x.id === id);
      if (m) persist(db.milestones.put(m), set, get);
    },

    saveReview: (review) => {
      const full: WeeklyReview = { ...review, createdAt: Date.now() };
      set({ reviews: { ...get().reviews, [full.weekStart]: full } });
      persist(db.reviews.put(full), set, get);
    },

    setScratchNotes: (trackId, notes) => {
      patchCard(trackId, (c) => ({ ...c, notes }));
    },

    addQuestion: (trackId, text) => {
      const q: OpenQuestion = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        text: text.trim(),
        resolved: false,
        createdAt: Date.now(),
      };
      if (!q.text) return;
      patchCard(trackId, (c) => ({ ...c, openQuestions: [q, ...c.openQuestions] }));
    },

    setQuestionResolved: (trackId, questionId, resolved) => {
      patchCard(trackId, (c) => ({
        ...c,
        openQuestions: c.openQuestions.map((q) => (q.id === questionId ? { ...q, resolved } : q)),
      }));
    },

    deleteQuestion: (trackId, questionId) => {
      patchCard(trackId, (c) => ({ ...c, openQuestions: c.openQuestions.filter((q) => q.id !== questionId) }));
    },

    exportData: () => exportAll(db),

    markExported: () => {
      get().setConfig({ lastExportAt: Date.now() });
    },

    dismissError: () => set({ error: null }),

    importData: async (raw) => {
      const backup = validateBackup(raw);
      await importAll(db, backup);
      await loadAll();
    },

    resetData: async () => {
      await resetAll(db);
      await loadAll();
      set({ tab: "today", viewDate: todayISO() });
    },
  };
});

/** Stable selector helpers (avoid new-object selectors in components). */
export const selectConfig = (s: Store) => s.config;
export const selectLogs = (s: Store) => s.logs;
export const selectTracks = (s: Store) => s.tracks;
