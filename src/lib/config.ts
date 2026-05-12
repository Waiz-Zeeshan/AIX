import type { EventConfig } from "@prisma/client";
import { db } from "./db";

// EventConfig is a process-singleton (id=1). Cached in-memory to avoid hitting
// the DB on every request. Cache is invalidated on any update via updateConfig().

const CACHE_TTL_MS = 60_000;

let cached: { value: EventConfig; expiresAt: number } | null = null;

export async function getConfig(): Promise<EventConfig> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const config = await db.eventConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  cached = { value: config, expiresAt: Date.now() + CACHE_TTL_MS };
  return config;
}

export async function updateConfig(
  data: Partial<Omit<EventConfig, "id" | "updatedAt">>
): Promise<EventConfig> {
  const config = await db.eventConfig.update({
    where: { id: 1 },
    data
  });
  cached = { value: config, expiresAt: Date.now() + CACHE_TTL_MS };
  return config;
}

export function invalidateConfigCache(): void {
  cached = null;
}

// Balance equation invariant (SRS §7.4): podHeadCount = orchCount * podHeadsPerOrch
// and agentCount (implied = podHeadCount * agentsPerPodHead).
export function assertBalanced(config: EventConfig): void {
  const expectedPodHeads = config.orchCount * config.podHeadsPerOrch;
  if (config.podHeadCount !== expectedPodHeads) {
    throw new Error(
      `EventConfig out of balance: podHeadCount=${config.podHeadCount} but ` +
        `orchCount*podHeadsPerOrch=${expectedPodHeads}. ` +
        `Matching coverage is not guaranteed.`
    );
  }
}
