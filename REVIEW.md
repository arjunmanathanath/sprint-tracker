# Sprint Tracker — Review (2026-09-18)

Code review + browser walkthrough of v1, followed by a functional gap analysis.

## A/B. Bugs found and fixed

| # | Area | Bug | Fix |
| --- | --- | --- | --- |
| B1 | Settings | Clearing "Phase 1 length" or "Weekly target" committed `0` immediately (phase flipped to 2; input snapped to "0" so a new value could not be typed) | `NumberField` keeps a draft and commits only a valid in-range value on blur/Enter; otherwise reverts |
| B2 | Task row | A long skip reason overflowed the card and ran under the stopwatch button | `Pill` truncates with an ellipsis inside its container |
| B3 | resolveDay | A stale `plannedMinutes: 0` snapshot (entry created while off-schedule) showed "0 min" for a scheduled slot | Fall back to the schedule when the snapshot is 0 (a scheduled slot always plans > 0) |
| B4 | Sheet | Page scrolled behind an open bottom sheet | Body scroll locked while a sheet is open |
| B5 | Store | Persistence-error banner never cleared | Cleared on the next successful write; banner is tap-to-dismiss |
| B6 | Reset | After Reset → onboarding, the app opened on Settings | Reset switches the tab back to Today |
| B7 | Task row | Stopwatch offered on any past/future day | Offered only for today and yesterday (late-night sessions); older days are backfilled by typing minutes; a running timer is always shown so it can be stopped |
| B8 | Export | `lastExportAt` was marked before the file was saved; blob downloads are unreliable in iOS home-screen PWAs | Share sheet when `navigator.canShare({files})` (Save to Files / Drive), download otherwise, "Download instead" link; marked only after success; cancelling the share sheet does nothing |
| B9 | resolveDay | A skipped-with-reason entry that fell off the schedule lost its reason from view | `skipped` counts as data |
| — | Reason sheet | Tapping a selected quick-reason chip could not deselect it | Toggle |

Verified numbers on the Progress screen against hand calculation for a week with completed, paused, skipped and missed days (28 missed, 38 h planned-so-far, 49 h adjusted target, 15 % T01 adherence, T07 "1 excused"). 44 tests green; production build emits the PWA.

## D. Functional gaps and improvements

Grouped by the spec's principles. **P1** = recommended next, small and high-value. **P2** = worthwhile. **P3** = nice to have.

**Update:** all four P1 items are implemented (tick-fill, Partial, Trim, Load adjustment), and the P2 batch
(forgotten-stopwatch guard, sustained-warning tracking, persistent storage after onboarding, recent daily
notes in scratch cards, 14-day strip) plus "keep the Today date across tabs"; all with tests. See README.

### Tick and log, fast

| P | Gap | Proposal |
| --- | --- | --- |
| P1 ✅ | Ticking a task complete with nothing logged leaves `actualMinutes = 0`, so adherence and cumulative hours never move for "tick-only" users. | When completing a task with 0 minutes logged and no timer running, fill in the planned minutes (still editable). Un-completing does not touch the minutes. |
| P1 ✅ | A session with minutes logged but not ticked (e.g. 45 of 60) renders as red "Missed" on past days. | Add a **Partial** state (amber) when `actual > 0 && !completed`. Keep the spec's missed count unchanged. |
| P2 ✅ | A forgotten stopwatch silently banks hours. | Banner when a timer has run > 4 h; on stop of a > 4 h timer, ask to confirm the minutes. |
| P3 | Stopwatch reaching the planned time does nothing. | Offer "Mark done" inline once elapsed ≥ planned. |
| P3 ✅ | The Today date resets when switching tabs mid-backfill. | Keep `date` in the store. |

### Recalibrate (the added requirement)

| P | Gap | Proposal |
| --- | --- | --- |
| P1 ✅ | The guardrail says "cut load ~20 % and re-plan" but the app cannot act on it. | **Load adjustment**: `config.loadFactor` (e.g. 0.8) with a from/until date. Planned minutes for slots scale by it (snapshotted per day as today). One-tap "Cut load 20 % for 2 weeks" on the load-check card; badge in the Today header; control in Settings. |
| P1 ✅ | Pause (whole day) and skip (whole task) are the only excuses; "I could only do 45 min because X" has no honest representation. | **Trim** a task for the day with a reason: sets that day's planned snapshot to the trimmed value and records `adjustReason`. Hitting the trimmed number counts as done; nothing is red. |
| P2 ✅ | "2+ sustained warning signs" is not measurable — the advisory only knows about the current week. | Track warning weeks over the last 4; show "2nd week in a row" and only escalate to the cut-load copy when ≥ 2. |
| P3 | Excused minutes simply vanish from the target. | Optional "catch-up pool": show excused minutes this week and count time logged beyond a day's plan against it. |
| P3 | Reviews are nudged monthly (spec) though the type is `WeeklyReview`. | Setting: review cadence weekly / monthly; also surface the nudge on Today. |

### Honest signals

| P | Gap | Proposal |
| --- | --- | --- |
| P2 ✅ | No at-a-glance history of days. | 14-day status strip (done / partial / missed / paused / rest) on Progress. |
| P3 | Milestone hints say "By Month 3" but nothing shows the sprint month. | Header: "Week 7 · Month 2". |
| P3 | Phase 2 starts silently. | One-time banner on the first day of week 5. |

### Two note surfaces

| P | Gap | Proposal |
| --- | --- | --- |
| P2 ✅ | Daily task notes and the track's scratch card never meet, although the spec says both feed the same track. | Show the last 5 dated task notes inside each scratch card ("Recent daily notes"). |
| P3 | Deleting an open question is immediate. | 5-second undo toast. |

### Depend-on-able

| P | Gap | Proposal |
| --- | --- | --- |
| P2 ✅ | Persistent storage is only requested from Settings. | Call `navigator.storage.persist()` right after onboarding (installed PWAs get it silently). |
| P3 | `autoUpdate` service worker reloads the page when a new build is deployed, even mid-typing. | Switch to `prompt` mode with an "Update available · Reload" toast. |
| P3 | `maximum-scale=1` blocks pinch-zoom (kept to stop iOS auto-zooming 14 px inputs). | Use 16 px inputs on touch devices and drop `maximum-scale`. |

### Schedule-aware

| P | Gap | Proposal |
| --- | --- | --- |
| P3 | No view of the full weekly plan. | "Plan" sheet: slots × day types grid, with the phase-2 diff highlighted. |
| P3 | Milestones are fixed seed data. | Add / edit / archive milestones per track. |
| P3 | Onboarding does not mention pause/skip. | Three-bullet "how it works" on onboarding. |

### Explicitly out of scope (v1 non-goals)

Sync, accounts, notifications, sharing, multi-user, light theme.
