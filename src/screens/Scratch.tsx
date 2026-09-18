import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { useStatsCtx } from "../store/hooks";
import type { ScratchCard, Track } from "../types";
import { formatShort } from "../logic/dates";
import { recentTaskNotes } from "../logic/stats";
import { AutoSaveText } from "../components/AutoSaveText";
import { IconChevronDown, IconPlus, IconTrash } from "../components/Icons";
import { Pill } from "../components/ui";

const EMPTY_CARD = (trackId: string): ScratchCard => ({ trackId, notes: "", openQuestions: [] });

export function Scratch() {
  const tracks = useStore((s) => s.tracks);
  const scratch = useStore((s) => s.scratch);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur px-4 pt-safe">
        <div className="flex items-baseline justify-between pt-4 pb-3 border-b border-border">
          <h1 className="text-base font-semibold">Scratch cards</h1>
          <span className="text-xs text-muted">one per track · notes + open questions</span>
        </div>
      </header>
      <div className="px-4 pt-3 space-y-2.5">
        {tracks.map((t) => (
          <ScratchCardView
            key={t.id}
            track={t}
            card={scratch[t.id] ?? EMPTY_CARD(t.id)}
            open={open === t.id}
            onToggle={() => setOpen(open === t.id ? null : t.id)}
          />
        ))}
      </div>
    </main>
  );
}

function ScratchCardView({
  track,
  card,
  open,
  onToggle,
}: {
  track: Track;
  card: ScratchCard;
  open: boolean;
  onToggle: () => void;
}) {
  const setScratchNotes = useStore((s) => s.setScratchNotes);
  const addQuestion = useStore((s) => s.addQuestion);
  const setQuestionResolved = useStore((s) => s.setQuestionResolved);
  const deleteQuestion = useStore((s) => s.deleteQuestion);
  const openDay = useStore((s) => s.openDay);
  const ctx = useStatsCtx();
  const [draft, setDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const recent = useMemo(() => (open ? recentTaskNotes(track.id, ctx, 5) : []), [open, track.id, ctx]);

  const unresolved = card.openQuestions.filter((q) => !q.resolved);
  const resolved = card.openQuestions.filter((q) => q.resolved);
  const visible = showResolved ? card.openQuestions : unresolved;
  const hasNotes = card.notes.trim().length > 0;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addQuestion(track.id, text);
    setDraft("");
  };

  return (
    <section
      className={`rounded-2xl bg-surface border border-border ${track.active ? "" : "opacity-70"}`}
      style={{ borderLeftColor: track.color, borderLeftWidth: 3 }}
    >
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left" aria-expanded={open}>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: track.color }} aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">
            {track.shortLabel} · {track.name}
          </span>
          <span className="block text-xs text-muted mt-0.5">
            {unresolved.length > 0 ? `${unresolved.length} open` : "no open questions"}
            {hasNotes && " · notes"}
            {!track.active && " · parked"}
          </span>
        </span>
        {unresolved.length > 0 && <Pill tone="accent">{unresolved.length}</Pill>}
        <IconChevronDown className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Notes</p>
            <AutoSaveText
              value={card.notes}
              onSave={(v) => setScratchNotes(track.id, v)}
              placeholder="Running notes for this track — what you're reading, what to try next, links…"
              multiline
              rows={5}
              resetKey={track.id}
              ariaLabel={`${track.name} notes`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Open questions</p>
              {resolved.length > 0 && (
                <button type="button" onClick={() => setShowResolved((v) => !v)} className="text-[11px] text-muted underline underline-offset-2">
                  {showResolved ? "Hide resolved" : `Show resolved (${resolved.length})`}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Add a question…"
                aria-label="New question"
                autoComplete="off"
                className="flex-1 min-w-0 rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-sm outline-none focus:border-accent placeholder:text-muted/70"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!draft.trim()}
                className="shrink-0 w-11 h-11 rounded-xl bg-accent text-bg flex items-center justify-center disabled:opacity-40"
                aria-label="Add question"
              >
                <IconPlus />
              </button>
            </div>
            {visible.length === 0 ? (
              <p className="text-xs text-muted mt-2 px-1">Nothing open.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {visible.map((q) => (
                  <li key={q.id} className="flex items-start gap-2 rounded-xl px-1 py-1">
                    <input
                      type="checkbox"
                      checked={q.resolved}
                      onChange={(e) => setQuestionResolved(track.id, q.id, e.target.checked)}
                      aria-label={q.resolved ? "Mark unresolved" : "Mark resolved"}
                      className="mt-1 w-5 h-5 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className={`flex-1 text-sm leading-relaxed ${q.resolved ? "line-through text-muted" : ""}`}>{q.text}</span>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(track.id, q.id)}
                      className="shrink-0 p-1.5 -mr-1 text-muted/70 active:text-danger"
                      aria-label="Delete question"
                    >
                      <IconTrash size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {recent.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Recent daily notes</p>
              <ul className="space-y-1.5">
                {recent.map((n) => (
                  <li key={`${n.date}-${n.slotId}`}>
                    <button
                      type="button"
                      onClick={() => openDay(n.date)}
                      className="w-full text-left rounded-xl bg-surface-2 px-3 py-2 active:bg-border"
                    >
                      <span className="block text-[11px] text-muted">{formatShort(n.date)}</span>
                      <span className="block text-sm leading-snug whitespace-pre-line">{n.note}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
