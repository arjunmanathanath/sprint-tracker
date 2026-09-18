# Sprint Tracker — Phased Build Plan

Source spec: `Sprint Tracker — App Build Spec (for Claude Code).md`.
This plan adds two requirements on top of the spec:

1. **User-chosen sprint start date** — picked on first launch (default: next Sunday), editable in Settings.
2. **Pause & recalibrate** — a day (or a single task) can be excused with a reason. Excused work is
   shown neutral (never red), is not counted as "missed", does not break habit streaks, and is
   subtracted from that week's planned target. A paused day can optionally push the sprint calendar
   forward by one day so phase boundaries (e.g. the 4-week Java window) keep their full length.

---

## Design additions (over the spec's data model)

```ts
interface TaskEntry {
  // ...spec fields
  skipped: boolean;      // this one task is excused for the day
  skipReason: string;
}

interface DailyLog {
  // ...spec fields
  paused: boolean;       // the whole day is excused
  pauseReason: string;
}

interface SprintConfig {
  // ...spec fields
  pauseExtendsSprint: boolean; // paused days shift the sprint timeline (default: true)
}
```

Logic rules:

| Concern | Rule |
| --- | --- |
| Excused slot | `log.paused \|\| entry.skipped` |
| Missed sessions (week) | scheduled, past days only, not completed, **not excused** |
| Streak (habit track) | excused scheduled day is *skipped* (neither breaks nor extends); a completed excused day still extends |
| Adherence / weekly target | planned minutes exclude excused slots; actual minutes always count |
| Sprint week | `effectiveDays = calendarDays − pausedDaysBefore(date)` when `pauseExtendsSprint`, else calendar days |
| Guardrail | uses the adjusted (excused-removed) planned figure |
| Rendering | excused rows/days use a neutral "paused" style, never the missed/red style |

Weekly stats stay on the calendar week (Sun–Sat, Saudi week); only the sprint-week/phase counter shifts.

---

## Phases

### Phase 0 — Scaffold ✅
- Vite 6 + React 19 + TypeScript, Tailwind v4 (`@tailwindcss/vite`), vite-plugin-pwa, Vitest.
- Dark theme default, bottom tab bar shell (Today · Progress · Scratch · Settings).
- PWA manifest + generated icons; `npm run build` produces an installable static site.
- **Done when:** `npm run dev` shows the shell; `npm run build` emits `dist/` with `sw.js` + `manifest.webmanifest`.

### Phase 1 — Data layer & core logic (with tests) ✅
- `src/types.ts` — data model (spec + additions above).
- `src/seed/` — tracks, phase 1 / phase 2 schedules, milestones, default config.
- `src/db/` — Dexie schema (`tracks`, `config`, `milestones`, `dailyLogs`, `scratchCards`, `reviews`), seed loader, export/import/reset.
- `src/logic/` — `dayType`, `sprint` (week/phase with pause shift), `schedule` (slots for a date, planned minutes), `stats` (adherence, cumulative, streak, missed, guardrail, weekly review nudge), `excuse`.
- `src/store/` — Zustand store: loads everything into memory, every mutation writes through to Dexie.
- Tests: daily totals 360 / 270 / 660 and week 3030 for both phases; dayType; sprint week & phase incl. paused-day shift; streak with excused days; missed/adherence exclusions; guardrail thresholds.
- **Done when:** `npm test` is green.

### Phase 2 — Today screen ✅
- Header: date, day-type badge, progress ring, sprint week label (phase 2 bump visible).
- Task rows: colour dot(s), label, planned, complete toggle, manual minutes, expandable note.
- Stopwatch: start/stop, `timerStartedAt` persisted, single-runner rule, survives reload.
- Footer: day note + "logged X of Y min".
- Date stepper for past days (backfill).
- **Done when:** a full day can be logged, closed, reopened, and the numbers are intact.

### Phase 3 — Pause, skip & recalibrate (the added requirement) ✅
- "Pause today" action with reason → banner on the day, rows neutral, still loggable.
- Per-task "Skip with reason" action.
- Paused-day sprint shift (toggle in Settings, default on).
- Weekly target and progress ring show the adjusted target with an "excused N min" hint.
- **Done when:** a paused/skipped day never renders as missed, streaks survive it, and the sprint week counter shifts when the toggle is on.

### Phase 4 — Scratch cards ✅
- One expandable card per track (incl. parked T03): auto-saving notes, open-questions checklist (add / resolve / delete / filter), unresolved count on collapsed card.

### Phase 5 — Progress screen ✅
- Weekly total vs (adjusted) target bar.
- Load-check card: missed sessions, guardrail advisory ("cut load ~20% and re-plan"), advisory only.
- Deep-track cards: planned vs actual, adherence %, cumulative hours, milestones (tickable), architect-critical flag.
- Habit-track cards: streak + adherence.
- Weekly-review nudge on the last Friday of the month (held / slipped / adjust) saved as `WeeklyReview`.
- Nice-to-have: 4-week trend bars.

### Phase 6 — Settings & onboarding ✅
- First-launch start-date picker (default next Sunday).
- Settings: start date, `phase1Weeks`, weekly target, pause-extends-sprint toggle.
- Export JSON / Import JSON / Reset (confirm).
- Monthly export reminder.

### Phase 7 — Polish & ship ✅ (v1)
- Empty states, pre-sprint state, safe-area insets, large tap targets, reduced motion.
- Offline verification (service worker precache) — verified via `vite preview`.
- Deploy notes (any static HTTPS host) — see README.

## Status (2026-09-18)

Reviewed and browser-tested; 9 bugs fixed and a prioritised gap list written up in `REVIEW.md`.
The four P1 items from that review are built: tick fills planned minutes, Partial state, Trim with a
reason, and Load adjustment (see README "Logging" and "Pause, skip, trim & recalibrate"). The P2 batch
followed: forgotten-stopwatch guard, sustained-warning tracking, persistent storage after onboarding,
recent daily notes in scratch cards, 14-day strip, Today date kept across tabs. Then: nightly automatic
backup (in-app snapshots at 23:58 with catch-up, restore/undo, optional folder file on desktop Chrome/Edge).

v1 complete: 42 tests green, `npm run build` emits the PWA. Decisions made during the build:

- Days before the start date carry no plan (no "missed" sessions before day 1).
- "Missed" counts only days *before* today; the guardrail ratio uses planned-through-yesterday.
- A partial first week is measured against what the schedule plans for it, not the full 50.5 h.
- Stored `plannedMinutes` snapshots win over the live schedule; entries that fall off the schedule
  after a start-date change stay visible (as "Off-schedule") only if they carry data.

Possible follow-ups (not built):

- Carry-over: offer to spread a paused day's minutes across the rest of the week.
- Remaining P3 items in `REVIEW.md` (review cadence setting, phase-2 banner, plan grid, custom milestones, SW update prompt, ...).
- Per-track 4-week trend (overall trend is in place).
- v2 sync backend (data layer is a single `BackupFile` shape, ready to ship over the wire).

---

## Project layout

```
src/
  types.ts
  db/         dexie.ts, seedLoader.ts, backup.ts
  seed/       tracks.ts, schedule.ts, milestones.ts, config.ts
  logic/      dayType.ts, sprint.ts, schedule.ts, stats.ts, excuse.ts, dates.ts
  store/      useStore.ts
  screens/    Today.tsx, Progress.tsx, Scratch.tsx, Settings.tsx, Onboarding.tsx
  components/ TaskRow.tsx, Stopwatch.tsx, Ring.tsx, TrackCard.tsx, TabBar.tsx, Sheet.tsx, ...
  App.tsx, main.tsx, index.css
```
