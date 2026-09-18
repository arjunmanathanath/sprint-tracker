import type { Milestone } from "../types";

// Spec §4 — milestones (tickable on the Progress screen).
export const SEED_MILESTONES: Milestone[] = [
  { id: "M01", trackId: "T01", title: "Java refresher complete (Security, Observability, WebFlux, AI-in-Java)", targetHint: "End of Week 4", done: false },
  { id: "M02", trackId: "T02", title: "Core distributed-systems text (e.g. DDIA) + system-design write-ups", targetHint: "By Month 3", done: false },
  { id: "M03", trackId: "T04", title: "One POC → documented service with its own HLD", targetHint: "By Month 4", done: false },
  { id: "M04", trackId: "T10", title: "Deliver 1 tech talk + start 1 mentoring relationship", targetHint: "Over the phase", done: false },
  { id: "M05", trackId: "T09", title: "One finance review (emergency fund, insurance, investments, nominees)", targetHint: "This quarter", done: false },
  { id: "M06", trackId: "T07", title: "Hit scheduled sessions ≥ 90% of weeks", targetHint: "Ongoing", done: false },
  { id: "M07", trackId: "T11", title: "Keep the daily 3-language streak; Arabic phrases first", targetHint: "Ongoing", done: false },
  { id: "M08", trackId: "T05", title: "Capture one domain learning per month", targetHint: "Ongoing", done: false },
];
