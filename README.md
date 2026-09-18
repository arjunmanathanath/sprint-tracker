# Sprint Tracker

A single-user, offline-first mobile PWA that runs a fixed daily study/life plan and tracks progress,
notes and open questions per track. No backend, no account — everything lives in the browser's
IndexedDB on your device, with JSON export/import for backup.

Built from `Sprint Tracker — App Build Spec (for Claude Code).md`; see `PLAN.md` for the phased plan.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # logic + store tests (vitest)
npm run build      # static site in dist/ with service worker + manifest
npm run preview    # serve dist/ locally to check the PWA
```

Node 20.12+ (Vite 6).

## Deploy & install on a phone

1. `npm run build` and upload `dist/` to any static HTTPS host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).
   The service worker and manifest need HTTPS (or `localhost`).
2. Open the URL on the phone → browser menu → **Add to Home Screen**. It launches full-screen.
3. In **Settings**, tap **Keep persistent** so the browser will not evict the data under storage pressure,
   and export a JSON backup now and then (the app reminds you monthly).

If you host under a sub-path (e.g. GitHub Pages `/repo/`), set `base` in `vite.config.ts` and the
manifest `start_url`/`scope` to that path.

## How the app works

- **Today** — the plan for the day is generated from the day of week (Saudi week: Tue = rest/cushion,
  Fri+Sat = weekend) and the sprint week (phase 2 from week 5 drops Java and gives Architecture 3 h).
  Tap the circle to complete, use the stopwatch (persists across app close; only one runs at a time)
  or expand a row to type minutes, add a note, or skip. Step through past days to backfill.
- **Progress** — weekly total vs target, load-check guardrail (advisory only), 4-week trend, deep-track
  cards (hours, adherence, cumulative, milestones) and habit-track cards (streak, adherence), and the
  end-of-month review nudge.
- **Scratch** — one card per track: a running note plus an open-question checklist.
- **Settings** — sprint start date, phase-1 length, weekly target, pause behaviour, export / import / reset.

### Start date

Chosen on first launch (default: next Sunday) and editable in Settings. Days before the start date
have no plan. Logged days keep the planned minutes they were created with, so re-dating the sprint
never rewrites history.

### Logging

- **Tick = done.** Ticking a task with no time logged fills in the planned minutes (editable); un-ticking
  takes them back out unless you edited them. Any typed or stopwatch time is never overridden.
- **Partial.** Time logged but not ticked shows amber *Partial* on past days, not red *Missed*. For the
  guardrail both still count as "not completed" (spec).
- **Forgotten stopwatch.** A timer running over 4 h turns amber and Today shows a banner; stopping it asks
  how long you really worked (planned / 1 h / all) and logs only that.

### Pause, skip, trim & recalibrate

Life happens. Three ways to record a valid reason instead of a red mark:

| Action | Where | Effect |
| --- | --- | --- |
| **Pause this day** (with reason) | Today footer | Whole day is excused. Rows turn neutral, nothing counts as missed, habit streaks are kept, the week's target drops by that day's planned minutes. Anything you still log counts. |
| **Skip with a reason** | Expanded task row | Same, for one session only. |
| **Trim time** (with reason) | Expanded task row | Lowers that day's plan for one task ("could only do 45 min"). Reaching the trimmed number counts as done; the week's target drops by the difference. The original plan is kept so the trim can be removed. |

With **Paused days extend the sprint** on (default), every paused day pushes the sprint calendar forward
by one day, so a 4-week phase still gets 4 weeks of work. Turn it off in Settings to keep the calendar fixed.

**Load adjustment** is the plan's "cut load ~20% and re-plan" rule made real: from the load-check card
(one tap: 80% for 2 weeks) or Settings, every planned session scales down by the same share for a while.
Days already logged keep their numbers; today and later follow the reduced plan until the window ends or
you restore 100%. Trimmed sessions are left alone.

The guardrail counts only *unexcused* misses on past days, and compares logged time against what was
planned through yesterday — so an early-morning check never trips it. It also remembers the last four
weeks: the first off-week gets a gentle note, the second in a row escalates to the plan's "cut load ~20%"
copy with the one-tap button.

### Progress extras

- **Last 14 days** strip: one cell per day (done / partial / missed / paused / no plan); tap a cell to open
  that day on Today. The Today screen keeps the day you were looking at when you switch tabs.
- **Scratch cards** list the track's five most recent daily task notes, so quick daily capture and the
  standing notepad meet in one place.
- Persistent storage is requested right after onboarding (and can be re-requested in Settings).

## Project layout

```
src/
  types.ts             data model
  seed/                tracks, phase 1/2 schedules, milestones, default config
  db/                  Dexie schema, seed loader, export/import/reset
  logic/               pure functions: day type, sprint week/phase, schedule, stats (+ tests)
  store/               Zustand store (write-through to IndexedDB), hooks (+ tests)
  screens/             Onboarding, Today, Progress, Scratch, Settings
  components/          TaskRow, Stopwatch, ReasonSheet, TrimSheet, LoadSheet, ConfirmMinutesSheet, DayStrip, TabBar, ui, icons
scripts/make-icons.mjs generates the PWA icons (no image libraries)
```
