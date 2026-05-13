"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DragRankList, type RankItem } from "@/components/DragRankList";
import { PitchCard } from "@/components/PitchCard";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <h2 className="font-display text-base font-semibold text-fg">
            Available Orchs
          </h2>
          <span className="text-xs text-fg-muted">
            {unranked.length} remaining
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {unranked.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-8 text-center text-sm text-fg-muted">
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
                  <Button
                    type="button"
                    onClick={() => addToRanking(o.id)}
                    variant="accent"
                    size="sm"
                  >
                    Add
                  </Button>
                }
              />
            ))
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-fg">
            Your ranking ({ranked.length}/{requiredCount})
          </h2>
          <SaveBadge status={status} />
        </div>
        <p className="mt-1 text-xs text-fg-muted">
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
          <Alert variant="danger" className="mt-3 text-xs">
            {errorMsg}
          </Alert>
        ) : null}
        {ranked.length !== requiredCount ? (
          <Alert variant="warning" className="mt-3 text-xs">
            Rank all {requiredCount} Orchs before submitting.
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
