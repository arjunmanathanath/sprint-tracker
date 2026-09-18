import type { SchedulePhase, ScheduleSlot } from "../types";

// Spec §4 — Phase 1 (weeks 1–4). Minutes as weekday / tuesday / weekend.
const PHASE1_SLOTS: ScheduleSlot[] = [
  { id: "S1", trackIds: ["T01"], label: "Java refresher", minutes: { weekday: 120, tuesday: 120, weekend: 120 } },
  { id: "S2", trackIds: ["T02"], label: "Architecture", minutes: { weekday: 60, tuesday: 60, weekend: 60 } },
  { id: "S3", trackIds: ["T04"], label: "AI / GenAI", minutes: { weekday: 30, tuesday: 30, weekend: 180 } },
  { id: "S4", trackIds: ["T05"], label: "Domain / Business", minutes: { weekday: 0, tuesday: 0, weekend: 60 } },
  { id: "S5", trackIds: ["T06", "T08"], label: "Baby + Family", minutes: { weekday: 30, tuesday: 30, weekend: 30 } },
  { id: "S6", trackIds: ["T07"], label: "Health / Fitness", minutes: { weekday: 90, tuesday: 0, weekend: 60 } },
  { id: "S7", trackIds: ["T09"], label: "Finance", minutes: { weekday: 0, tuesday: 0, weekend: 60 } },
  { id: "S8", trackIds: ["T10"], label: "Comms / Leadership", minutes: { weekday: 0, tuesday: 0, weekend: 60 } },
  { id: "S9", trackIds: ["T11"], label: "Languages", minutes: { weekday: 30, tuesday: 30, weekend: 30 } },
];

// Phase 2 (week 5+): drop S1 (Java), Architecture takes its time (180 / 180 / 180).
const PHASE2_SLOTS: ScheduleSlot[] = PHASE1_SLOTS.filter((s) => s.id !== "S1").map((s) =>
  s.id === "S2" ? { ...s, minutes: { weekday: 180, tuesday: 180, weekend: 180 } } : s,
);

export const PHASES: Record<SchedulePhase["id"], SchedulePhase> = {
  phase1: { id: "phase1", slots: PHASE1_SLOTS },
  phase2: { id: "phase2", slots: PHASE2_SLOTS },
};

export const ALL_SLOT_IDS = PHASE1_SLOTS.map((s) => s.id);
