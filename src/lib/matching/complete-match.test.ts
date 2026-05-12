import { describe, it, expect } from "vitest";
import { completeMatch } from "./complete-match";
import type { Hospital, HRResult } from "./types";

describe("completeMatch", () => {
  it("SRS §14.2 Test 2 (Sparse): places stragglers with exhausted short preference lists", () => {
    // Residents r1,r2 had short preference lists and ended up as stragglers.
    // h1 already filled by r3; h2 has 1 slot open; h3 has 2 slots open.
    const hospitals: Hospital[] = [
      { id: "h1", capacity: 1, preferences: ["r3", "r1"] },
      { id: "h2", capacity: 2, preferences: ["r4", "r2"] },
      { id: "h3", capacity: 2, preferences: ["r5", "r1", "r2"] },
    ];
    const hrResult: HRResult = {
      matched: {
        r1: null,
        r2: null,
        r3: "h1",
        r4: "h2",
        r5: "h3",
      },
      rosters: {
        h1: ["r3"],
        h2: ["r4"],
        h3: ["r5"],
      },
      stragglers: ["r1", "r2"],
      stats: { totalProposals: 7, rounds: 3 },
    };

    const out = completeMatch(hrResult, hospitals);

    // Both stragglers placed.
    expect(out.completedPlacements.sort()).toEqual(["r1", "r2"]);
    expect(out.matched.r1).not.toBeNull();
    expect(out.matched.r2).not.toBeNull();

    // Capacities respected.
    for (const h of hospitals) {
      expect(out.rosters[h.id].length).toBeLessThanOrEqual(h.capacity);
    }

    // Total placements equal sum of pre-existing + 2.
    const totalPlaced = Object.values(out.rosters).reduce(
      (n, r) => n + r.length,
      0
    );
    expect(totalPlaced).toBe(5);

    // No straggler key remains in the type (sanity).
    expect("stragglers" in out).toBe(false);
  });

  it("Tier 1: places straggler into the hospital that ranked them best", () => {
    // r1 is straggler. h1 ranks r1 at index 2; h2 ranks r1 at index 0.
    // Both have a free slot. r1 should land at h2.
    const hospitals: Hospital[] = [
      { id: "h1", capacity: 2, preferences: ["r2", "r3", "r1"] },
      { id: "h2", capacity: 2, preferences: ["r1", "r4"] },
    ];
    const hrResult: HRResult = {
      matched: { r1: null, r2: "h1", r4: "h2" },
      rosters: {
        h1: ["r2"],
        h2: ["r4"],
      },
      stragglers: ["r1"],
      stats: { totalProposals: 3, rounds: 2 },
    };

    const out = completeMatch(hrResult, hospitals);

    expect(out.matched.r1).toBe("h2");
    // h2 roster re-sorted by preference: r1 (rank 0) before r4 (rank 1).
    expect(out.rosters.h2).toEqual(["r1", "r4"]);
    expect(out.rosters.h1).toEqual(["r2"]);
  });

  it("Tier 2: falls back to lowest-id open hospital when no hospital ranked the straggler", () => {
    // r9 isn't in any hospital's preferences. Open hospitals: h2, h3 (h1 full).
    // Lowest-id open hospital is h2.
    const hospitals: Hospital[] = [
      { id: "h1", capacity: 1, preferences: ["r1"] },
      { id: "h2", capacity: 2, preferences: ["r2"] },
      { id: "h3", capacity: 2, preferences: ["r3"] },
    ];
    const hrResult: HRResult = {
      matched: { r1: "h1", r2: "h2", r3: "h3", r9: null },
      rosters: {
        h1: ["r1"],
        h2: ["r2"],
        h3: ["r3"],
      },
      stragglers: ["r9"],
      stats: { totalProposals: 3, rounds: 1 },
    };

    const out = completeMatch(hrResult, hospitals);

    expect(out.matched.r9).toBe("h2");
    // Unranked resident goes to the end of h2's roster.
    expect(out.rosters.h2).toEqual(["r2", "r9"]);
  });

  it("Capacity respected: only one slot open → only one straggler placed, rest break early", () => {
    // Total capacity = 3, three residents already placed. h3 has 1 open slot.
    const hospitals: Hospital[] = [
      { id: "h1", capacity: 1, preferences: ["r1"] },
      { id: "h2", capacity: 1, preferences: ["r2"] },
      { id: "h3", capacity: 2, preferences: ["r3", "r4", "r5"] },
    ];
    const hrResult: HRResult = {
      matched: { r1: "h1", r2: "h2", r3: "h3", r4: null, r5: null },
      rosters: {
        h1: ["r1"],
        h2: ["r2"],
        h3: ["r3"],
      },
      stragglers: ["r4", "r5"],
      stats: { totalProposals: 5, rounds: 2 },
    };

    const out = completeMatch(hrResult, hospitals);

    // Only one slot open → only one placement, the first by id ASC: r4.
    expect(out.completedPlacements).toEqual(["r4"]);
    expect(out.matched.r4).toBe("h3");
    expect(out.matched.r5).toBeNull();
    // Capacities still respected.
    for (const h of hospitals) {
      expect(out.rosters[h.id].length).toBeLessThanOrEqual(h.capacity);
    }
  });

  it("does not mutate the caller's inputs", () => {
    const hospitals: Hospital[] = [
      { id: "h1", capacity: 2, preferences: ["r1", "r2"] },
      { id: "h2", capacity: 1, preferences: ["r3"] },
    ];
    const hrResult: HRResult = {
      matched: { r1: "h1", r2: null, r3: "h2" },
      rosters: {
        h1: ["r1"],
        h2: ["r3"],
      },
      stragglers: ["r2"],
      stats: { totalProposals: 3, rounds: 1 },
    };

    const rostersSnapshot = JSON.parse(JSON.stringify(hrResult.rosters));
    const matchedSnapshot = JSON.parse(JSON.stringify(hrResult.matched));
    const stragglersSnapshot = [...hrResult.stragglers];
    const hospitalsSnapshot = JSON.parse(JSON.stringify(hospitals));

    completeMatch(hrResult, hospitals);

    expect(hrResult.rosters).toEqual(rostersSnapshot);
    expect(hrResult.matched).toEqual(matchedSnapshot);
    expect(hrResult.stragglers).toEqual(stragglersSnapshot);
    expect(hospitals).toEqual(hospitalsSnapshot);
  });

  it("deterministic: same input twice → identical output", () => {
    const hospitals: Hospital[] = [
      { id: "h1", capacity: 2, preferences: ["r1", "r4", "r2"] },
      { id: "h2", capacity: 2, preferences: ["r3", "r5"] },
      { id: "h3", capacity: 2, preferences: ["r6"] },
    ];
    const hrResult: HRResult = {
      matched: {
        r1: "h1",
        r3: "h2",
        r6: "h3",
        r2: null,
        r4: null,
        r5: null,
      },
      rosters: {
        h1: ["r1"],
        h2: ["r3"],
        h3: ["r6"],
      },
      stragglers: ["r5", "r2", "r4"],
      stats: { totalProposals: 8, rounds: 3 },
    };

    const a = completeMatch(hrResult, hospitals);
    const b = completeMatch(hrResult, hospitals);

    expect(a).toEqual(b);
  });
});
