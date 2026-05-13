"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DragRankList, type RankItem } from "@/components/DragRankList";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <span className="font-display font-semibold text-brand-accent">
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
          <h2 className="font-display text-base font-semibold text-fg">
            All projects
          </h2>
          <span className="text-xs text-fg-muted">{pool.length} available</span>
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
                    ? "border-brand-accent bg-brand-accent-soft "
                    : "border-border-default bg-surface ") +
                  "rounded-lg border p-4 transition"
                }
              >
                <header className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold tracking-tight text-fg">
                    {p.title}
                  </h3>
                  <Badge variant="neutral">cap {p.capacity}</Badge>
                </header>
                {p.tags.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <li
                        key={t}
                        className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[11px] font-medium text-brand-electric"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 line-clamp-3 text-xs text-fg-muted">
                  {p.description}
                </p>
                <div className="mt-3 flex items-center justify-end">
                  <Button
                    type="button"
                    onClick={() => togglePick(p.id)}
                    disabled={disabled}
                    variant={isPicked ? "accent" : "secondary"}
                    size="sm"
                  >
                    {isPicked ? "Picked" : disabled ? "Full" : "Pick"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-fg">
            Your picks ({picked.length}/{requiredCount})
          </h2>
          <SaveBadge status={status} />
        </div>
        <p className="mt-1 text-xs text-fg-muted">
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
          <Alert variant="danger" className="mt-3 text-xs">
            {errorMsg}
          </Alert>
        ) : null}
        {picked.length !== requiredCount ? (
          <Alert variant="warning" className="mt-3 text-xs">
            Pick exactly {requiredCount} projects before submitting.
          </Alert>
        ) : null}
      </section>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <Badge variant="neutral">Saving…</Badge>;
  }
  if (status === "saved") {
    return <Badge variant="success">Saved</Badge>;
  }
  if (status === "error") {
    return <Badge variant="danger">Save failed</Badge>;
  }
  return null;
}
