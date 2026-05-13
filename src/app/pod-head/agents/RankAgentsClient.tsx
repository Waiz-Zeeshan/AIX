"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DragRankList, type RankItem } from "@/components/DragRankList";
import { PitchCard } from "@/components/PitchCard";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePodHeadAgentSelections } from "@/lib/preferences-actions";

export interface AgentPoolItem {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  skills: string[];
  pitch: string;
}

interface Props {
  pool: AgentPoolItem[];
  allSkills: string[];
  initialRanked: string[];
  requiredCount: number;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const PAGE_SIZE = 30;

export function RankAgentsClient({
  pool,
  allSkills,
  initialRanked,
  requiredCount
}: Props) {
  const [ranked, setRanked] = useState<string[]>(initialRanked);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const lastSavedRef = useRef<string>(initialRanked.join(","));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, AgentPoolItem>();
    for (const a of pool) m.set(a.id, a);
    return m;
  }, [pool]);

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
        await savePodHeadAgentSelections(ids);
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
      void persist(ranked);
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ranked, persist]);

  const rankedSet = useMemo(() => new Set(ranked), [ranked]);

  // Filter pool: not already ranked + matches search + matches skills.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const skillFilter = selectedSkills.length > 0 ? new Set(selectedSkills) : null;

    return pool.filter((a) => {
      if (rankedSet.has(a.id)) return false;
      if (skillFilter) {
        let hit = false;
        for (const s of a.skills) {
          if (skillFilter.has(s)) {
            hit = true;
            break;
          }
        }
        if (!hit) return false;
      }
      if (q) {
        const hay =
          a.name.toLowerCase() +
          " " +
          a.skills.join(" ").toLowerCase() +
          " " +
          a.pitch.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pool, rankedSet, search, selectedSkills]);

  // Reset pagination when filters change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, selectedSkills]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const addToRanking = (id: string) => {
    setRanked((cur) => {
      if (cur.includes(id)) return cur;
      if (cur.length >= requiredCount) return cur;
      return [...cur, id];
    });
  };

  const removeFromRanking = (id: string) => {
    setRanked((cur) => cur.filter((x) => x !== id));
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((cur) =>
      cur.includes(skill) ? cur.filter((s) => s !== skill) : [...cur, skill]
    );
  };

  const atCapacity = ranked.length >= requiredCount;

  const rankedItems: RankItem[] = ranked.map((id) => {
    const a = byId.get(id);
    return {
      id,
      label: a?.name ?? id,
      content: a ? (
        <span className="line-clamp-1">
          {a.skills.slice(0, 4).join(" · ") || a.bio || a.pitch}
        </span>
      ) : null
    };
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-fg">
            Agent pool
          </h2>
          <span className="text-xs text-fg-muted">
            {filtered.length} of {pool.length - ranked.length} available
          </span>
        </div>

        <div className="mt-3 space-y-3">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, skill, or pitch text…"
          />

          {allSkills.length > 0 ? (
            <details className="rounded-md border border-border-default">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-fg">
                Filter by skill{" "}
                {selectedSkills.length > 0 ? (
                  <span className="ml-1 rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-display font-semibold text-white">
                    {selectedSkills.length}
                  </span>
                ) : null}
              </summary>
              <div className="border-t border-border-default px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {allSkills.map((s) => {
                    const active = selectedSkills.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSkill(s)}
                        className={
                          (active
                            ? "bg-brand-accent text-white "
                            : "bg-surface-alt text-fg hover:bg-brand-accent-soft hover:text-brand-electric ") +
                          "rounded-full px-2 py-0.5 text-xs transition"
                        }
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                {selectedSkills.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSkills([])}
                    className="mt-2 text-xs text-brand-accent underline"
                  >
                    Clear skill filters
                  </button>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {visible.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-8 text-center text-sm text-fg-muted">
              No Agents match your filters.
            </p>
          ) : (
            visible.map((a) => (
              <PitchCard
                key={a.id}
                name={a.name}
                role="AGENT"
                email={a.email}
                bio={a.bio}
                skills={a.skills}
                pitch={a.pitch}
                action={
                  <Button
                    type="button"
                    onClick={() => addToRanking(a.id)}
                    disabled={atCapacity}
                    variant="accent"
                    size="sm"
                  >
                    {atCapacity ? "Full" : "Add"}
                  </Button>
                }
              />
            ))
          )}
          {hasMore ? (
            <Button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
            </Button>
          ) : null}
        </div>
      </section>

      <section className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-fg">
            Your top {requiredCount} ({ranked.length}/{requiredCount})
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
            emptyMessage="Add Agents from the pool to begin ranking."
          />
        </div>
        {errorMsg ? (
          <Alert variant="danger" className="mt-3 text-xs">
            {errorMsg}
          </Alert>
        ) : null}
        {ranked.length !== requiredCount ? (
          <Alert variant="warning" className="mt-3 text-xs">
            Select exactly {requiredCount} Agents before submitting.
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
