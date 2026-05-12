/**
 * Compact profile card used when participants browse a pool. Shows name,
 * skills (chips), bio (truncated), and pitch (full, expandable).
 *
 * Pure presentational component — no client logic, safe to render from RSC.
 */

import type { Role } from "@prisma/client";

export interface PitchCardProps {
  name: string;
  role?: Role | null;
  bio?: string | null;
  skills?: string[];
  pitch: string;
  email?: string;
  // Trailing slot for action buttons ("Add to ranking", "Remove", etc.)
  action?: React.ReactNode;
}

const ROLE_LABEL: Record<Role, string> = {
  ORCH: "Orch",
  POD_HEAD: "Pod Head",
  AGENT: "Agent"
};

export function PitchCard({
  name,
  role,
  bio,
  skills,
  pitch,
  email,
  action
}: PitchCardProps) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{name}</h3>
          {(role || email) && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {role ? ROLE_LABEL[role] : null}
              {role && email ? " · " : null}
              {email}
            </p>
          )}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      {skills && skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <li
              key={s}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {s}
            </li>
          ))}
        </ul>
      ) : null}

      {bio ? (
        <p className="mt-3 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
          {bio}
        </p>
      ) : null}

      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
          Read pitch
        </summary>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {pitch}
        </p>
      </details>
    </article>
  );
}
