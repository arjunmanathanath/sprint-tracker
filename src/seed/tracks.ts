import type { Track } from "../types";

// Spec §4 — tracks. Colours are per-track accents used for dots, rings and cards.
export const SEED_TRACKS: Track[] = [
  { id: "T01", name: "Java refresher", shortLabel: "T01", category: "technical", metricType: "deep", color: "#f97316", active: true, architectCritical: false },
  { id: "T02", name: "Architecture", shortLabel: "T02", category: "technical", metricType: "deep", color: "#60a5fa", active: true, architectCritical: true },
  { id: "T03", name: "Problem solving", shortLabel: "T03", category: "technical", metricType: "deep", color: "#a1a1aa", active: false, architectCritical: false },
  { id: "T04", name: "AI / GenAI", shortLabel: "T04", category: "technical", metricType: "deep", color: "#a78bfa", active: true, architectCritical: true },
  { id: "T05", name: "Domain / Business", shortLabel: "T05", category: "technical", metricType: "deep", color: "#fbbf24", active: true, architectCritical: false },
  { id: "T06", name: "Baby care", shortLabel: "T06", category: "life", metricType: "habit", color: "#f472b6", active: true, architectCritical: false },
  { id: "T07", name: "Health / Fitness", shortLabel: "T07", category: "life", metricType: "habit", color: "#4ade80", active: true, architectCritical: false },
  { id: "T08", name: "Family", shortLabel: "T08", category: "life", metricType: "habit", color: "#fb7185", active: true, architectCritical: false },
  { id: "T09", name: "Finance", shortLabel: "T09", category: "life", metricType: "deep", color: "#34d399", active: true, architectCritical: false },
  { id: "T10", name: "Comms / Leadership", shortLabel: "T10", category: "soft", metricType: "deep", color: "#22d3ee", active: true, architectCritical: false },
  { id: "T11", name: "Languages", shortLabel: "T11", category: "soft", metricType: "habit", color: "#e879f9", active: true, architectCritical: false },
];
