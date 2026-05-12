"use client";

/**
 * Orch preference picker (SRS §6.2 FR-O2 + FR-O3).
 *
 * Left pane: searchable pool of Pod Heads not yet selected. Each card has an
 * "Add" button. Right pane: currently-ranked Pod Heads in a DragRankList with
 * "Remove" buttons. When the selection reaches `targetCount`, further adds are
 * disabled.
 *
 * Auto-save: any change to the ranked list debounces 500ms then calls
 * `saveOrchPodHeadSelections`. The initial mount does NOT trigger a save —
 * only real user changes do.
 *
 * Final submit calls `markPreferencesSubmitted` and surfaces missing tasks if
 * the server rejects the submission.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { DragRankList, type RankItem } from "@/components/DragRankList";
import { PitchCard } from "@/components/PitchCard";
import {
  markPreferencesSubmitted,
  saveOrchPodHeadSelections
} from "@/lib/preferences-actions";

export interface PodHeadOption {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  skills: string[];
  pitch: string;
}

interface Props {
  podHeads: PodHeadOption[];
  initialSelectedIds: string[];
  targetCount: number;
  initialSubmittedAt: string | null;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 500;

export function OrchRankPicker({
  podHeads,
  initialSelectedIds,
  targetCount,
  initialSubmittedAt
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialSubmittedAt
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [isSubmitting, startSubmit] = useTransition();

  // Map id -> option for O(1) lookups.
  const byId = useMemo(() => {
    const map = new Map<string, PodHeadOption>();
    for (const ph of podHeads) map.set(ph.id, ph);
    return map;
  }, [podHeads]);

  // Skip auto-save on the initial mount; only persist real user edits.
  const isFirstRender = useRef(true);
  const lastSavedRef = useRef<string>(initialSelectedIds.join(","));

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Only persist a *complete* selection — server-side validation requires
    // exactly N ids. Partial drafts stay client-side until the user finishes
    // choosing.
    if (selectedIds.length !== targetCount) {
      setSaveState({ kind: "idle" });
      return;
    }

    const signature = selectedIds.join(",");
    if (signature === lastSavedRef.current) return;

    setSaveState({ kind: "saving" });
    const handle = setTimeout(() => {
      saveOrchPodHeadSelections(selectedIds)
        .then(() => {
          lastSavedRef.current = signature;
          setSaveState({ kind: "saved", at: Date.now() });
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to save.";
          setSaveState({ kind: "error", message });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [selectedIds, targetCount]);

  const filteredPool = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const pool = podHeads.filter((ph) => !selectedSet.has(ph.id));
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((ph) => {
      if (ph.name.toLowerCase().includes(q)) return true;
      if (ph.pitch.toLowerCase().includes(q)) return true;
      for (const s of ph.skills) {
        if (s.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [podHeads, selectedIds, query]);

  const atCapacity = selectedIds.length >= targetCount;

  const rankItems: RankItem[] = useMemo(() => {
    return selectedIds
      .map((id) => byId.get(id))
      .filter((ph): ph is PodHeadOption => Boolean(ph))
      .map((ph) => ({
        id: ph.id,
        label: ph.name,
        content: (
          <span className="text-zinc-500">
            {ph.skills.slice(0, 4).join(", ") || ph.email}
          </span>
        )
      }));
  }, [selectedIds, byId]);

  const handleAdd = (id: string) => {
    if (atCapacity) return;
    if (selectedIds.includes(id)) return;
    setSelectedIds([...selectedIds, id]);
  };

  const handleRemove = (id: string) => {
    setSelectedIds(selectedIds.filter((x) => x !== id));
  };

  const handleReorder = (newOrder: string[]) => {
    setSelectedIds(newOrder);
  };

  const canSubmit =
    selectedIds.length === targetCount &&
    saveState.kind !== "saving" &&
    !isSubmitting;

  const handleSubmit = () => {
    setSubmitError(null);
    setMissing([]);
    startSubmit(() => {
      markPreferencesSubmitted()
        .then((result) => {
          if (result.ok) {
            setSubmittedAt(new Date().toISOString());
          } else {
            setMissing(result.missing);
          }
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Submission failed.";
          setSubmitError(message);
        });
    });
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-zinc-700 dark:text-zinc-300">
            Pick <strong>{targetCount}</strong> Pod Heads and rank them top to
            bottom. You can drag, use the keyboard, or remove items to
            re-rank.
          </p>
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="pool-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="pool-heading" className="text-lg font-medium">
              Pod Heads
            </h2>
            <span className="text-xs text-zinc-500">
              {filteredPool.length} available
            </span>
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, skill, or pitch…"
            className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />

          {atCapacity ? (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              You&apos;ve selected {targetCount} Pod Heads — the maximum.
              Remove someone on the right to add a different person.
            </p>
          ) : null}

          {filteredPool.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              No Pod Heads match your search.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredPool.map((ph) => (
                <li key={ph.id}>
                  <PitchCard
                    name={ph.name}
                    role="POD_HEAD"
                    email={ph.email}
                    bio={ph.bio}
                    skills={ph.skills}
                    pitch={ph.pitch}
                    action={
                      <button
                        type="button"
                        onClick={() => handleAdd(ph.id)}
                        disabled={atCapacity}
                        aria-label={`Add ${ph.name}`}
                        title={
                          atCapacity
                            ? `You already have ${targetCount} selected. Remove one to add another.`
                            : `Add ${ph.name}`
                        }
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
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

        <aside aria-labelledby="ranked-heading" className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-baseline justify-between">
            <h2 id="ranked-heading" className="text-lg font-medium">
              Your ranking
            </h2>
            <span className="text-xs text-zinc-500" aria-live="polite">
              {selectedIds.length} / {targetCount}
            </span>
          </div>

          <div className="mt-3">
            <DragRankList
              items={rankItems}
              onChange={handleReorder}
              onRemove={handleRemove}
              emptyMessage="No Pod Heads selected yet. Add some from the list."
            />
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900"
            >
              {isSubmitting
                ? "Submitting…"
                : submittedAt
                  ? "Resubmit preferences"
                  : "Submit preferences"}
            </button>

            {selectedIds.length !== targetCount ? (
              <p className="text-xs text-zinc-500">
                Pick {targetCount - selectedIds.length} more to enable
                submit.
              </p>
            ) : null}

            {submittedAt ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Submitted {new Date(submittedAt).toLocaleString()}. You can
                still edit and resubmit while preferences are open.
              </p>
            ) : null}

            {missing.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Still missing: {missing.join(", ")}.
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {submitError}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === "idle") {
    return <span className="text-xs text-zinc-500">Changes auto-save.</span>;
  }
  if (state.kind === "saving") {
    return (
      <span className="text-xs text-zinc-600 dark:text-zinc-300">
        Saving…
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <span className="text-xs text-emerald-700 dark:text-emerald-400">
        Saved {new Date(state.at).toLocaleTimeString()}
      </span>
    );
  }
  return (
    <span className="text-xs text-red-700 dark:text-red-400">
      Save failed: {state.message}
    </span>
  );
}
