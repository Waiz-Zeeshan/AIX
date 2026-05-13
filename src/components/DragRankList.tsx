"use client";

/**
 * Accessible drag-to-rank list (SRS §9.3, §11.6).
 *
 * Supports:
 *   - Pointer: HTML5 drag-and-drop to reorder.
 *   - Keyboard: Tab to focus a row, Space/Enter to pick up, ArrowUp/Down to
 *     move, Space/Enter again to drop, Esc to cancel.
 *
 * Announces actions through an `aria-live="polite"` region so screen readers
 * follow along (WCAG 2.1 AA).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent
} from "react";

export interface RankItem {
  id: string;
  label: string;
  content?: React.ReactNode;
}

export interface DragRankListProps {
  items: RankItem[];
  onChange: (newOrder: string[]) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const next = arr.slice();
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

export function DragRankList({
  items,
  onChange,
  onRemove,
  disabled = false,
  emptyMessage = "Nothing selected yet."
}: DragRankListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const rowRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());

  const announce = useCallback((msg: string) => {
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(msg));
  }, []);

  useEffect(() => {
    if (!grabbedId) return;
    rowRefs.current.get(grabbedId)?.focus();
  }, [grabbedId, items]);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-8 text-center text-sm text-fg-muted">
        {emptyMessage}
      </div>
    );
  }

  const handleDragStart = (e: DragEvent<HTMLLIElement>, index: number) => {
    if (disabled) return;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", items[index].id);
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, index: number) => {
    if (disabled || dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (index !== overIndex) setOverIndex(index);
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>, index: number) => {
    if (disabled || dragIndex === null) return;
    e.preventDefault();
    const next = move(items, dragIndex, index);
    onChange(next.map((i) => i.id));
    setDragIndex(null);
    setOverIndex(null);
    announce(`Moved ${items[dragIndex].label} to position ${index + 1} of ${items.length}.`);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>, index: number) => {
    if (disabled) return;
    const item = items[index];

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbedId === item.id) {
        setGrabbedId(null);
        announce(`Dropped ${item.label} at position ${index + 1} of ${items.length}.`);
      } else if (grabbedId === null) {
        setGrabbedId(item.id);
        announce(
          `Picked up ${item.label} at position ${index + 1} of ${items.length}. Use arrow keys to move.`
        );
      }
      return;
    }

    if (e.key === "Escape" && grabbedId) {
      e.preventDefault();
      setGrabbedId(null);
      announce("Cancelled.");
      return;
    }

    if (grabbedId === item.id && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? -1 : 1;
      const next = move(items, index, index + delta);
      if (next === items) return;
      onChange(next.map((i) => i.id));
      announce(
        `Moved ${item.label} to position ${index + 1 + delta} of ${items.length}.`
      );
    }
  };

  return (
    <div>
      <ol className="space-y-2">
        {items.map((item, index) => {
          const isGrabbed = grabbedId === item.id;
          const isHoverTarget = overIndex === index && dragIndex !== null && dragIndex !== index;

          return (
            <li
              key={item.id}
              ref={(node) => {
                rowRefs.current.set(item.id, node);
              }}
              draggable={!disabled}
              tabIndex={disabled ? -1 : 0}
              aria-roledescription="sortable item"
              aria-grabbed={isGrabbed || undefined}
              aria-label={`${item.label}, rank ${index + 1} of ${items.length}`}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                "flex items-start gap-3 rounded-md border bg-surface px-3 py-2 outline-none transition",
                isGrabbed
                  ? "border-brand-accent ring-2 ring-brand-accent/30"
                  : isHoverTarget
                    ? "border-border-strong"
                    : "border-border-default",
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-grab focus:ring-2 focus:ring-brand-accent/40"
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent-soft text-xs font-display font-semibold tabular-nums text-brand-electric"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg">{item.label}</div>
                {item.content ? (
                  <div className="mt-1 text-xs text-fg-muted">{item.content}</div>
                ) : null}
              </div>
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => {
                    onRemove(item.id);
                    announce(`Removed ${item.label}.`);
                  }}
                  disabled={disabled}
                  aria-label={`Remove ${item.label}`}
                  className="ml-2 rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-fg-muted transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>
    </div>
  );
}
