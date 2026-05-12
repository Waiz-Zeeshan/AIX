"use client";

/**
 * Agent's rank-picker UI (SRS §6.4: FR-AG2 + FR-AG3 + FR-AG4).
 *
 * Two-column layout:
 *   - Left: searchable pool of Pod Heads (PitchCards with "Add" buttons).
 *   - Right: ordered ranking (DragRankList) with "Remove" per item.
 *
 * Behavior:
 *   - Search filters case-insensitively over name + skills + pitch.
 *   - "Add" disabled when the ranking has reached N.
 *   - Auto-save: ranking changes debounce 500ms then call the server action.
 *     The initial value coming from the server is NOT re-saved.
 *   - Final submit calls the submit action; result enables a "Submitted at"
 *     stamp. Per SRS §5.3, the list stays editable while PREFERENCES is OPEN.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DragRankList, type RankItem } from "@/components/DragRankList";
import { PitchCard } from "@/components/PitchCard";

import type { ActionResult, SubmitResult } from "./actions";

export interface PodHeadOption {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  skills: string[];
  pitch: string;
}

export interface AgentRankPickerProps {
  podHeads: PodHeadOption[];
  initialRanking: string[];
  maxRanks: number;
  initialSubmittedAt: string | null;
  saveAction: (ids: string[]) => Promise<ActionResult>;
  submitAction: () => Promise<SubmitResult>;
}

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const SAVE_DEBOUNCE_MS = 500;

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function AgentRankPicker({
  podHeads,
  initialRanking,
  maxRanks,
  initialSubmittedAt,
  saveAction,
  submitAction
}: AgentRankPickerProps) {
  const byId = useMemo(() => {
    const m = new Map<string, PodHeadOption>();
    for (const p of podHeads) m.set(p.id, p);
    return m;
  }, [podHeads]);

  // Seed state from props but only use ids that still exist in the pool.
  const seededInitial = useMemo(
    () => initialRanking.filter((id) => byId.has(id)),
    [initialRanking, byId]
  );

  const [ranking, setRanking] = useState<string[]>(seededInitial);
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [submittedAt, setSubmittedAt] = useState<Date | null>(
    initialSubmittedAt ? new Date(initialSubmittedAt) : null
  );
  const [dirtySinceSubmit, setDirtySinceSubmit] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track which ranking we last persisted so we don't re-fire saves on mount
  // or when an in-flight save resolves and triggers a re-render.
  const lastSavedRef = useRef<string[]>(seededInitial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === Auto-save (debounced) ===
  useEffect(() => {
    if (arraysEqual(ranking, lastSavedRef.current)) return;
    if (ranking.length !== maxRanks) {
      // We only persist a full, valid ranking — partial drafts stay client-side.
      setSaveStatus({ kind: "idle" });
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const snapshot = ranking.slice();
      setSaveStatus({ kind: "saving" });
      void saveAction(snapshot).then((res) => {
        if (res.ok) {
          lastSavedRef.current = snapshot;
          setSaveStatus({ kind: "saved", at: Date.now() });
        } else {
          setSaveStatus({
            kind: "error",
            message: res.error ?? "Could not save."
          });
        }
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ranking, maxRanks, saveAction]);

  // === Search index ===
  const normalizedSearch = search.trim().toLowerCase();
  const inRanking = useMemo(() => new Set(ranking), [ranking]);

  const filtered = useMemo(() => {
    const pool = podHeads.filter((p) => !inRanking.has(p.id));
    if (!normalizedSearch) return pool;
    return pool.filter((p) => {
      const haystack =
        p.name.toLowerCase() +
        "  " +
        p.skills.join(" ").toLowerCase() +
        "  " +
        p.pitch.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [podHeads, inRanking, normalizedSearch]);

  const atCapacity = ranking.length >= maxRanks;

  // === Handlers ===
  const handleAdd = useCallback(
    (id: string) => {
      if (atCapacity) return;
      setRanking((prev) => (prev.includes(id) ? prev : [...prev, id]));
      if (submittedAt) setDirtySinceSubmit(true);
    },
    [atCapacity, submittedAt]
  );

  const handleRemove = useCallback(
    (id: string) => {
      setRanking((prev) => prev.filter((x) => x !== id));
      if (submittedAt) setDirtySinceSubmit(true);
    },
    [submittedAt]
  );

  const handleReorder = useCallback(
    (next: string[]) => {
      setRanking(next);
      if (submittedAt) setDirtySinceSubmit(true);
    },
    [submittedAt]
  );

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitMessage(null);
    try {
      const res = await submitAction();
      if (res.ok) {
        setSubmittedAt(res.submittedAt ? new Date(res.submittedAt) : new Date());
        setDirtySinceSubmit(false);
        setSubmitMessage(null);
      } else {
        setSubmitMessage(res.error ?? "Could not submit.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [submitAction]);

  const rankItems: RankItem[] = useMemo(
    () =>
      ranking
        .map((id) => byId.get(id))
        .filter((p): p is PodHeadOption => Boolean(p))
        .map((p) => ({
          id: p.id,
          label: p.name,
          content: (
            <div>
              {p.skills.length > 0 ? (
                <div className="mb-1 text-zinc-500">
                  {p.skills.slice(0, 4).join(" · ")}
                  {p.skills.length > 4 ? ` · +${p.skills.length - 4}` : ""}
                </div>
              ) : null}
              <div className="line-clamp-2">{p.pitch}</div>
            </div>
          )
        })),
    [ranking, byId]
  );

  const submitReady = ranking.length === maxRanks;
  const submitLabel = submittedAt
    ? dirtySinceSubmit
      ? "Re-submit preferences"
      : "Submitted"
    : "Submit preferences";

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Pool */}
      <section aria-labelledby="pool-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="pool-heading" className="text-lg font-medium">
            Pod Head pool
          </h2>
          <p className="text-xs text-zinc-500">
            {filtered.length} of {podHeads.length - inRanking.size} matching
          </p>
        </div>
        <div className="mt-3">
          <label htmlFor="pod-head-search" className="sr-only">
            Search Pod Heads
          </label>
          <input
            id="pod-head-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, skill, or pitch…"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {atCapacity ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            You&rsquo;ve picked {maxRanks} Pod Heads. Remove one to add another.
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {normalizedSearch
              ? "No Pod Heads match your search."
              : podHeads.length - inRanking.size === 0
                ? "Every Pod Head is already in your ranking."
                : "No Pod Heads available."}
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <PitchCard
                  name={p.name}
                  role="POD_HEAD"
                  bio={p.bio}
                  skills={p.skills}
                  pitch={p.pitch}
                  email={p.email}
                  action={
                    <button
                      type="button"
                      onClick={() => handleAdd(p.id)}
                      disabled={atCapacity}
                      aria-label={`Add ${p.name} to your ranking`}
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                    >
                      Add
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ranking */}
      <aside aria-labelledby="ranking-heading" className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="ranking-heading" className="text-lg font-medium">
            Your ranking
          </h2>
          <p className="text-xs font-mono tabular-nums text-zinc-500">
            {ranking.length}/{maxRanks}
          </p>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Drag rows (or use Space + arrow keys) to reorder. Rank 1 is your top pick.
        </p>

        <div className="mt-3">
          <DragRankList
            items={rankItems}
            onChange={handleReorder}
            onRemove={handleRemove}
            emptyMessage="Add Pod Heads from the pool to start ranking."
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-xs">
          <SaveIndicator status={saveStatus} pendingPartial={!submitReady && ranking.length > 0} />
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!submitReady || isSubmitting || (Boolean(submittedAt) && !dirtySinceSubmit)}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : submitLabel}
          </button>

          {submittedAt ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              Preferences submitted at {formatTime(submittedAt)}.
              {dirtySinceSubmit
                ? " You have unsaved changes since then — submit again to re-stamp."
                : ""}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              {submitReady
                ? "Ready to submit."
                : `Pick ${maxRanks - ranking.length} more Pod Head${maxRanks - ranking.length === 1 ? "" : "s"} to enable submit.`}
            </p>
          )}

          {submitMessage ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {submitMessage}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function SaveIndicator({
  status,
  pendingPartial
}: {
  status: SaveStatus;
  pendingPartial: boolean;
}) {
  if (status.kind === "saving") {
    return <span className="text-zinc-500">Saving…</span>;
  }
  if (status.kind === "saved") {
    return <span className="text-emerald-700 dark:text-emerald-300">Saved</span>;
  }
  if (status.kind === "error") {
    return (
      <span className="text-red-700 dark:text-red-300">{status.message}</span>
    );
  }
  if (pendingPartial) {
    return (
      <span className="text-zinc-500">
        Draft — saves when you reach the full count.
      </span>
    );
  }
  return <span className="text-transparent">.</span>;
}
