"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DragRankList, type RankItem } from "@/components/DragRankList";
import { PitchCard } from "@/components/PitchCard";
import { savePodHeadOrchRankings } from "@/lib/preferences-actions";

export interface OrchPoolItem {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  pitch: string;
}

interface Props {
  pool: OrchPoolItem[];
  initialRanked: string[];
  requiredCount: number;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function RankOrchsClient({ pool, initialRanked, requiredCount }: Props) {
  const [ranked, setRanked] = useState<string[]>(initialRanked);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastSavedRef = useRef<string>(initialRanked.join(","));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, OrchPoolItem>();
    for (const o of pool) m.set(o.id, o);
    return m;
  }, [pool]);

  const unranked = useMemo(
    () => pool.filter((o) => !ranked.includes(o.id)),
    [pool, ranked]
  );

  const persist = useCallback(
    async (ids: string[]) => {
      if (ids.length !== requiredCount) {
        // Don't auto-save partial rankings — server requires exact count.
        setStatus("idle");
        return;
      }
      const key = ids.join(",");
      if (key === lastSavedRef.current) {
        setStatus("saved");
        return;
      }
      setStatus("saving");
      setErrorMsg(null);
      try {
        await savePodHeadOrchRankings(ids);
        lastSavedRef.current = key;
        setStatus("saved");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Save failed.");
      }
    },
    [requiredCount]
  );

  // Debounced auto-save when `ranked` changes.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist(ranked);
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ranked, persist]);

  const addToRanking = (id: string) => {
    setRanked((cur) => (cur.includes(id) ? cur : [...cur, id]));
  };

  const removeFromRanking = (id: string) => {
    setRanked((cur) => cur.filter((x) => x !== id));
  };

  const rankedItems: RankItem[] = ranked.map((id) => {
    const o = byId.get(id);
    return {
      id,
      label: o?.name ?? id,
      content: o ? (
        <span className="line-clamp-1">{o.bio ?? o.pitch}</span>
      ) : null
    };
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Available Orchs</h2>
          <span className="text-xs text-zinc-500">
            {unranked.length} remaining
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {unranked.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              All Orchs are ranked.
            </p>
          ) : (
            unranked.map((o) => (
              <PitchCard
                key={o.id}
                name={o.name}
                role="ORCH"
                email={o.email}
                bio={o.bio}
                pitch={o.pitch}
                action={
                  <button
                    type="button"
                    onClick={() => addToRanking(o.id)}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Add
                  </button>
                }
              />
            ))
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">
            Your ranking ({ranked.length}/{requiredCount})
          </h2>
          <SaveBadge status={status} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Drag to reorder, or use Space/Enter + Arrow keys.
        </p>
        <div className="mt-3">
          <DragRankList
            items={rankedItems}
            onChange={(order) => setRanked(order)}
            onRemove={(id) => removeFromRanking(id)}
            emptyMessage="Add Orchs from the left to begin ranking."
          />
        </div>
        {errorMsg ? (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">
            {errorMsg}
          </p>
        ) : null}
        {ranked.length !== requiredCount ? (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Rank all {requiredCount} Orchs before submitting.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
        Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-900 dark:bg-red-900 dark:text-red-100">
        Save failed
      </span>
    );
  }
  return null;
}
