# Sprint Tracker — App Build Spec (for Claude Code)

2026-09-18 · @Someone

Paste this whole spec into Claude Code to build v1. It is a single-user, offline-first mobile PWA that runs a fixed daily plan and tracks progress, notes and open questions per track.

## 1. Goal & Core Principles

A personal, mobile-first web app (installable PWA) that runs my fixed daily study/life plan and keeps me on track. Single-user, offline-first, all data stored locally on the device.

- **Schedule-aware, zero daily setup.** The app already knows the plan. It generates today's task list automatically from the day of week and the current sprint week — I never build a to-do list. I open it and the items are there.
- **Tick and log, fast.** Each task supports one-tap completion, quick minute entry, and a start/stop stopwatch that fills actual time with no mental math.
- **Depend-on-able.** Loads instantly, works with no network, survives app close (stopwatch included), and never loses data (local persistence + manual export).
- **Two note surfaces.** A quick per-task note each day, plus one persistent scratch card per track for running notes and open questions.
- **Honest signals.** Progress shown per track with the metric that suits it — deep tracks show cumulative hours + milestones; habit tracks show streak + adherence — plus a gentle load/guardrail check.

## 2. Tech Stack & Project Setup

- **Build tool:** Vite
- **Framework:** React + TypeScript
- **Styling:** Tailwind CSS (mobile-first, dark theme default)
- **State:** Zustand (single store)
- **Persistence:** Dexie.js over IndexedDB (all app data)
- **Dates:** date-fns
- **PWA:** vite-plugin-pwa (web manifest + service worker; installable, offline precache)
- **No backend, no auth, no runtime network calls** in v1.

Suggested layout:

```
src/
  db/         # Dexie schema + data access
  store/      # Zustand store
  seed/       # tracks, schedule, milestones, config
  logic/      # dayType, phase, adherence, streak, guardrail
  screens/    # Today, Progress, Scratch, Settings
  components/ # TaskRow, Stopwatch, TrackCard, Ring, etc.
  App.tsx, main.tsx
```

**Deployment:** build to static files and host on any static HTTPS host (Vercel, Netlify, Cloudflare Pages, or GitHub Pages). HTTPS is required for Add to Home Screen. After deploy, open the URL on the phone, Add to Home Screen, and it launches full-screen like a native app.

## 3. Data Model (TypeScript)

```ts
type DayType = "weekday" | "tuesday" | "weekend";
type Category = "technical" | "life" | "soft";
type MetricType = "deep" | "habit";

interface Track {
  id: string;              // "T01".."T11"
  name: string;
  shortLabel: string;      // "T02"
  category: Category;
  metricType: MetricType;  // deep => hours+milestones; habit => streak+adherence
  color: string;           // hex
  active: boolean;         // T03 = false (parked)
  architectCritical: boolean; // T02, T04 = true
}

interface ScheduleSlot {
  id: string;              // "S1".."S9"
  trackIds: string[];      // usually one; Baby+Family = ["T06","T08"]
  label: string;
  minutes: { weekday: number; tuesday: number; weekend: number };
}

interface SchedulePhase { id: "phase1" | "phase2"; slots: ScheduleSlot[]; }

interface SprintConfig {
  startDate: string;           // ISO "YYYY-MM-DD" = week 1, day 1
  phase1Weeks: number;         // 4 (T01 refresher window)
  weeklyTargetMinutes: number; // 3030 (50.5 h)
}

interface Milestone {
  id: string; trackId: string; title: string;
  targetHint: string;      // "End of Week 4", "By Month 3", "Ongoing"
  done: boolean;
}

interface TaskEntry {        // one slot on one day
  slotId: string;
  plannedMinutes: number;   // snapshot for that date
  actualMinutes: number;
  completed: boolean;
  note: string;             // per-task daily note
  timerStartedAt?: number;  // epoch ms if stopwatch running
}

interface DailyLog {
  date: string;             // "YYYY-MM-DD" (primary key)
  entries: Record<string, TaskEntry>; // keyed by slotId
  dayNote: string;
}

interface OpenQuestion { id: string; text: string; resolved: boolean; createdAt: number; }

interface ScratchCard {     // one per track (primary key trackId)
  trackId: string;
  notes: string;            // running freeform notes
  openQuestions: OpenQuestion[];
}

interface WeeklyReview { weekStart: string; held: string; slipped: string; adjust: string; }
```

**Dexie tables:** `tracks`, `config` (singleton), `milestones`, `dailyLogs` (key `date`), `scratchCards` (key `trackId`), `reviews` (key `weekStart`). Schedule phases can live in `seed/` code. Seed data loads into the DB on first run if empty; logs, scratch cards and reviews are user-generated.

## 4. Seed Data — the plan, encoded

Pre-load all of this so the app is usable the moment it opens.

**Tracks:**

| id | name | category | metric | active | architect-critical |
| --- | --- | --- | --- | --- | --- |
| T01 | Java refresher | technical | deep | true | false |
| T02 | Architecture | technical | deep | true | **true** |
| T03 | Problem solving | technical | deep | **false** | false |
| T04 | AI / GenAI | technical | deep | true | **true** |
| T05 | Domain / Business | technical | deep | true | false |
| T06 | Baby care | life | habit | true | false |
| T07 | Health / Fitness | life | habit | true | false |
| T08 | Family | life | habit | true | false |
| T09 | Finance | life | deep | true | false |
| T10 | Comms / Leadership | soft | deep | true | false |
| T11 | Languages | soft | habit | true | false |

**Schedule — Phase 1 (weeks 1–4).** Minutes as weekday / tuesday / weekend:

| slot | tracks | label | weekday | tuesday | weekend |
| --- | --- | --- | --- | --- | --- |
| S1 | T01 | Java refresher | 120 | 120 | 120 |
| S2 | T02 | Architecture | 60 | 60 | 60 |
| S3 | T04 | AI / GenAI | 30 | 30 | 180 |
| S4 | T05 | Domain / Business | 0 | 0 | 60 |
| S5 | T06, T08 | Baby + Family | 30 | 30 | 30 |
| S6 | T07 | Health / Fitness | 90 | 0 | 60 |
| S7 | T09 | Finance | 0 | 0 | 60 |
| S8 | T10 | Comms / Leadership | 0 | 0 | 60 |
| S9 | T11 | Languages | 30 | 30 | 30 |

Daily totals MUST compute to: weekday 360 min (6.0 h), Tuesday 270 (4.5 h), weekend 660 (11.0 h); week = 3030 min (50.5 h). Assert this in a test. T03 has no slot (parked).

**Schedule — Phase 2 (week 5+):** identical to Phase 1 except **remove S1 (Java)** and set **S2 (Architecture) minutes to 180 / 180 / 180**. Daily and weekly totals stay identical.

**Config:** `startDate` set on first launch (default = next Sunday), `phase1Weeks` = 4, `weeklyTargetMinutes` = 3030.

**Milestones:**

| track | title | target |
| --- | --- | --- |
| T01 | Java refresher complete (Security, Observability, WebFlux, AI-in-Java) | End of Week 4 |
| T02 | Core distributed-systems text (e.g. DDIA) + system-design write-ups | By Month 3 |
| T04 | One POC → documented service with its own HLD | By Month 4 |
| T10 | Deliver 1 tech talk + start 1 mentoring relationship | Over the phase |
| T09 | One finance review (emergency fund, insurance, investments, nominees) | This quarter |
| T07 | Hit scheduled sessions ≥ 90% of weeks | Ongoing |
| T11 | Keep the daily 3-language streak; Arabic phrases first | Ongoing |
| T05 | Capture one domain learning per month | Ongoing |

## 5. Screen — Today (home)

**Header:**

- Date + **day-type badge**: e.g. "Tuesday · rest / cushion · 4.5 h", "Saturday · weekend · 11 h", "Monday · weekday · 6 h".
- **Progress ring**: minutes logged today vs planned today.
- Sprint week label (e.g. "Sprint · Week 2"). Phase 2 automatically reflects the Architecture bump.

**Task list** — one row per scheduled slot for today (planned > 0). Each row:

- Track colour dot + label (e.g. "T04 · AI / GenAI") + planned time ("3 h").
- **Complete toggle** — large tap target.
- **Time logged** — tap to type minutes, OR a **stopwatch** (start/stop). Stopwatch stores `timerStartedAt`; on stop, elapsed is added to `actualMinutes`. A running timer survives app close/reopen (compute elapsed from the stored start).
- **Per-task note** — expandable field, saved to that day's entry.
- Slots covering two tracks (Baby + Family) show both colour dots; completion/time apply to the slot.

**Footer:** optional **day note** (one line); small summary "logged X of Y min today".

**Behaviour:**

- Only one stopwatch runs at a time — starting one stops another and banks its time.
- Manual minute edits always allowed (override).
- Past days viewable/editable via a date stepper (backfill).

## 6. Screen — Progress

**Top:**

- **Weekly total vs target** — minutes logged this week vs 3030 (50.5 h), as a bar + number.
- **Load-check card (guardrail)** — shows missed scheduled sessions this week; when the warning threshold is hit, display an advisory referencing the plan's rule: "2+ sustained warning signs → cut load \~20% and re-plan." Advisory only, never blocking.

**Per-track cards** (parked T03 greyed or hidden):

- **Deep tracks** (T01, T02, T04, T05, T09, T10): this-week planned vs actual + adherence %, **cumulative hours since sprint start**, and their **milestones** (tickable here). Flag T02 & T04 as "architect-critical".
- **Habit tracks** (T06, T07, T08, T11): **current streak** (consecutive scheduled days completed) + this-week adherence %.

**Milestones** — full list with checkboxes; ticking updates `Milestone.done`. Can live inside the track cards or as its own block.

**Nice-to-have:** a small 4-week trend of logged hours (sparkline/bars) per track or overall.

## 7. Screen — Scratch Cards

One card per track (all 11, including parked T03 so notes persist).

Each card:

- Track name + colour; tap to expand.
- **Notes** — a persistent multiline running note (free text). Auto-saves. This is the track's working memory across days.
- **Open questions** — a checklist: add a question (text), mark resolved (kept, struck through, filterable), delete. Show the unresolved count on the collapsed card.

This is separate from the per-task daily note: the daily note is tied to a specific day's task; the scratch card is the track's standing notepad + open-question tracker. Both feed the same track but serve different jobs — quick daily capture vs durable per-track memory.

## 8. Core Logic & Formulas

**Day type** (Saudi week), `d = getDay()` (Sun=0 … Sat=6):

- `d === 2` → "tuesday"
- `d === 5 || d === 6` → "weekend"
- else (0,1,3,4) → "weekday"

**Sprint week & phase:**

- `weeksSinceStart = floor(daysBetween(startDate, date) / 7)`; `sprintWeek = weeksSinceStart + 1`.
- `phase = sprintWeek <= phase1Weeks ? "phase1" : "phase2"`.
- Today's slots = active phase's slots where `minutes[dayType(today)] > 0`.

**Planned minutes for a slot on a date** = `slot.minutes[dayType(date)]` from that date's phase. **Snapshot** this into the TaskEntry when first created, so historical logs stay stable after the Week-5 transition.

**Adherence (track, week)** = `actual / planned * 100` over that week's scheduled slots for the track (guard divide-by-zero).

**Cumulative hours (track)** = sum of `actualMinutes` across all logs for that track's slots since `startDate`, ÷ 60.

**Streak (habit track)** = count back from today over days the track was scheduled (`planned > 0`): a completed scheduled day extends the streak, an incomplete scheduled day breaks it, a non-scheduled day (e.g. T07 on Tuesday) is skipped — neither breaks nor extends.

**Missed sessions this week** = scheduled slots (planned > 0) from week start up to today that are not completed.

**Guardrail heuristic** = surface the Load-check advisory when missed sessions this week ≥ 4, OR weekly logged minutes fall below \~70% of planned. Copy references the "cut \~20%" rule. Constants tunable.

**Weekly-review nudge** = on the last Friday of a month, surface a review card (held / slipped / adjust), saved as a WeeklyReview.

**Stopwatch persistence** = on start, store `timerStartedAt` (epoch ms). Elapsed = `now - timerStartedAt`. On stop, `actualMinutes += round(elapsed / 60000)` and clear the timestamp. On app load, if a timestamp exists, show the timer running with correct elapsed.

## 9. Persistence, Offline, Settings & Export

**Persistence:** all user data in IndexedDB via Dexie. Writes are immediate (auto-save everywhere; no save button). Seed data loads on first run if the DB is empty.

**Offline / PWA:** vite-plugin-pwa with a web manifest (name, icons, `display: standalone`, theme colour) and a service worker that precaches the app shell. The app must fully load and function with no network. Installable via Add to Home Screen.

**Settings screen:**

- Set / adjust **sprint start date**.
- Adjust `phase1Weeks` and weekly target (advanced).
- **Export** — download all data (tracks state, logs, scratch cards, milestones, reviews, config) as a single JSON file.
- **Import** — load a previously exported JSON (restore / move devices).
- **Reset** — with confirm.

**Data safety:** storage is local to one device, so surface an occasional export reminder (e.g. monthly) to keep a backup.

## 10. Non-Goals, Build Order & Design

**Non-goals for v1** (do not build): multi-device sync, cloud accounts, login, push notifications, sharing, analytics, multi-user. Keep it single-user and local. Cross-device sync via a small backend is a planned v2 — keep the data layer clean so it can be added later.

**Suggested build order:**

1. Vite + React + TS + Tailwind + PWA scaffold; installable shell.
2. Dexie schema + Zustand store + seed loader.
3. Day-type / phase / today's-slots logic, with a test asserting totals 6.0 h / 4.5 h / 11.0 h and week = 50.5 h.
4. Today screen: task rows, complete toggle, manual minutes, day note.
5. Stopwatch with persistence.
6. Scratch cards screen (notes + open questions).
7. Progress screen: weekly total, per-track cards, streak / adherence / cumulative, milestones.
8. Guardrail load-check + weekly-review nudge.
9. Settings: start date, export / import, reset.
10. Polish: date stepper for past days, empty states, dark mode.

**Design direction:** mobile-first, one-hand friendly, large tap targets, minimal chrome. Bottom tab bar: Today · Progress · Scratch · Settings. Calm dark theme with per-track accent colours. Numbers and rings over text; everything one or two taps deep. It should feel like a reliable instrument, not a busy dashboard.
