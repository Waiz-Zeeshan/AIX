"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DragRankList, type RankItem } from "@/components/DragRankList";
import { savePodHeadProjectPicks } from "@/lib/preferences-actions";

export interface ProjectPoolItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  capacity: number;
}

interface Props {
  pool: ProjectPoolItem[];
  initialPicked: string[];
  requiredCount: number;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const RANK_LABELS = ["Primary", "Secondary", "Tertiary", "Quaternary"];

export function PickProjectsClient({
  pool,
  initialPicked,
  requiredCount
}: Props) {
  const [picked, setPicked] = useState<string[]>(initialPicked);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lastSavedRef = useRef<string>(initialPicked.join(","));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, ProjectPoolItem>();
    for (const p of pool) m.set(p.id, p);
    return m;
  }, [pool]);

  const pickedSet = useMemo(() => new Set(picked), [picked]);

  const persist = useCallback(
    async (ids: string[]) => {
      if (ids.length !== requiredCount) {
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
        await savePodHeadProjectPicks(ids);
        lastSavedRef.current = key;
        setStatus("saved");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Save failed.");
      }
    },
    [requiredCount]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist(picked);
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [picked, persist]);

  const atCapacity = picked.length >= requiredCount;

  const togglePick = (id: string) => {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= requiredCount) return cur;
      return [...cur, id];
    });
  };

  const removePick = (id: string) => {
    setPicked((cur) => cur.filter((x) => x !== id));
  };

  const rankedItems: RankItem[] = picked.map((id) => {
    const p = byId.get(id);
    const rankLabel = (idx: number) => RANK_LABELS[idx] ?? `Rank ${idx + 1}`;
    const indexOf = picked.indexOf(id);
    return {
      id,
      label: p?.title ?? id,
      content: p ? (
        <span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {rankLabel(indexOf)}
          </span>
          {p.tags.length > 0 ? <> · {p.tags.slice(0, 4).join(", ")}</> : null}
        </span>
      ) : null
    };
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">All projects</h2>
          <span className="text-xs text-zinc-500">{pool.length} available</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pool.map((p) => {
            const isPicked = pickedSet.has(p.id);
            const disabled = !isPicked && atCapacity;
            return (
              <article
                key={p.id}
                className={
                  (isPicked
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 "
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ") +
                  "rounded-md border p-4"
                }
              >
                <header className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {p.title}
                  </h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    cap {p.capacity}
                  </span>
                </header>
                {p.tags.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <li
                        key={t}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 line-clamp-3 text-xs text-zinc-600 dark:text-zinc-400">
                  {p.description}
                </p>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => togglePick(p.id)}
                    disabled={disabled}
                    className={
                      (isPicked
                        ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 "
                        : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 ") +
                      "rounded-md border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    {isPicked ? "Picked" : disabled ? "Full" : "Pick"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">
            Your picks ({picked.length}/{requiredCount})
          </h2>
          <SaveBadge status={status} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Drag to reorder. Rank 1 is your primary; rank 2 is your fallback.
        </p>
        <div className="mt-3">
          <DragRankList
            items={rankedItems}
            onChange={(order) => setPicked(order)}
            onRemove={(id) => removePick(id)}
            emptyMessage={`Pick ${requiredCount} projects from the list.`}
          />
        </div>
        {errorMsg ? (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">
            {errorMsg}
          </p>
        ) : null}
        {picked.length !== requiredCount ? (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Pick exactly {requiredCount} projects before submitting.
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
