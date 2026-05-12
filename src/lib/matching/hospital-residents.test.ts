import { describe, it, expect } from "vitest";
import { hospitalResidents } from "./hospital-residents";
import type { HRInput } from "./types";

describe("hospitalResidents", () => {
  it("Test 3 (Adversarial): all residents rank the same top hospital — hospital's ranking decides", () => {
    const input: HRInput = {
      residents: [
        { id: "r1", preferences: ["h1", "h2"] },
        { id: "r2", preferences: ["h1", "h2"] },
        { id: "r3", preferences: ["h1", "h2"] },
        { id: "r4", preferences: ["h1", "h2"] },
      ],
      hospitals: [
        { id: "h1", capacity: 2, preferences: ["r3", "r1", "r2", "r4"] },
        { id: "h2", capacity: 2, preferences: ["r2", "r4", "r1", "r3"] },
      ],
    };

    const res = hospitalResidents(input);

    // h1's top two by its own ranking are r3 and r1.
    expect(res.rosters.h1).toEqual(["r3", "r1"]);
    // h2 then takes from the remainder (r2, r4), in its own preference order.
    expect(res.rosters.h2).toEqual(["r2", "r4"]);
    expect(res.matched).toEqual({ r1: "h1", r2: "h2", r3: "h1", r4: "h2" });
    expect(res.stragglers).toEqual([]);
  });

  it("Test 5 (Determinism): same input twice yields identical output", () => {
    const input: HRInput = {
      residents: [
        { id: "r1", preferences: ["h2", "h1", "h3"] },
        { id: "r2", preferences: ["h1", "h3", "h2"] },
        { id: "r3", preferences: ["h1", "h2", "h3"] },
        { id: "r4", preferences: ["h3", "h2", "h1"] },
        { id: "r5", preferences: ["h2", "h3", "h1"] },
      ],
      hospitals: [
        { id: "h1", capacity: 2, preferences: ["r3", "r2", "r1", "r5", "r4"] },
        { id: "h2", capacity: 2, preferences: ["r1", "r5", "r3", "r4", "r2"] },
        { id: "h3", capacity: 1, preferences: ["r4", "r2", "r1", "r5", "r3"] },
      ],
    };

    const a = hospitalResidents(input);
    const b = hospitalResidents(input);
    expect(a).toEqual(b);
  });

  it("Test 6 (Capacity exactness): balanced totals + full lists → every hospital at exact capacity, zero stragglers", () => {
    const input: HRInput = {
      residents: [
        { id: "r1", preferences: ["h1", "h2", "h3"] },
        { id: "r2", preferences: ["h2", "h1", "h3"] },
        { id: "r3", preferences: ["h3", "h1", "h2"] },
        { id: "r4", preferences: ["h1", "h3", "h2"] },
        { id: "r5", preferences: ["h2", "h3", "h1"] },
        { id: "r6", preferences: ["h3", "h2", "h1"] },
      ],
      hospitals: [
        { id: "h1", capacity: 2, preferences: ["r1", "r2", "r3", "r4", "r5", "r6"] },
        { id: "h2", capacity: 2, preferences: ["r5", "r2", "r1", "r6", "r3", "r4"] },
        { id: "h3", capacity: 2, preferences: ["r3", "r6", "r4", "r1", "r5", "r2"] },
      ],
    };

    const res = hospitalResidents(input);

    expect(res.rosters.h1).toHaveLength(2);
    expect(res.rosters.h2).toHaveLength(2);
    expect(res.rosters.h3).toHaveLength(2);
    expect(res.stragglers).toEqual([]);

    // Every resident matched to some hospital.
    for (const r of input.residents) {
      expect(res.matched[r.id]).not.toBeNull();
    }
  });

  it("Rosters are ordered by the hospital's preference (best first)", () => {
    const input: HRInput = {
      residents: [
        { id: "r1", preferences: ["h1"] },
        { id: "r2", preferences: ["h1"] },
        { id: "r3", preferences: ["h1"] },
      ],
      hospitals: [
        // Hospital prefers r3 best, then r1, then r2.
        { id: "h1", capacity: 3, preferences: ["r3", "r1", "r2"] },
      ],
    };

    const res = hospitalResidents(input);
    expect(res.rosters.h1).toEqual(["r3", "r1", "r2"]);
  });

  it("Worked example from SRS §16 Appendix A: 2 Pod Heads cap 2, 4 Agents", () => {
    // Setup verbatim from SRS §16 Appendix A:
    //   A1: [PH1, PH2], A2: [PH1, PH2], A3: [PH2, PH1], A4: [PH1, PH2]
    //   PH1: [A1, A3] (A2, A4 not on list)
    //   PH2: [A2, A4] (A1, A3 not on list)
    const input: HRInput = {
      residents: [
        { id: "A1", preferences: ["PH1", "PH2"] },
        { id: "A2", preferences: ["PH1", "PH2"] },
        { id: "A3", preferences: ["PH2", "PH1"] },
        { id: "A4", preferences: ["PH1", "PH2"] },
      ],
      hospitals: [
        { id: "PH1", capacity: 2, preferences: ["A1", "A3"] },
        { id: "PH2", capacity: 2, preferences: ["A2", "A4"] },
      ],
    };

    const res = hospitalResidents(input);

    expect(res.rosters.PH1).toEqual(["A1", "A3"]);
    expect(res.rosters.PH2).toEqual(["A2", "A4"]);
    expect(res.matched).toEqual({ A1: "PH1", A2: "PH2", A3: "PH1", A4: "PH2" });
    expect(res.stragglers).toEqual([]);
  });

  it("Residents with empty preferences are stragglers", () => {
    const input: HRInput = {
      residents: [
        { id: "r1", preferences: [] },
        { id: "r2", preferences: ["h1"] },
      ],
      hospitals: [{ id: "h1", capacity: 1, preferences: ["r2"] }],
    };

    const res = hospitalResidents(input);
    expect(res.matched.r1).toBeNull();
    expect(res.matched.r2).toBe("h1");
    expect(res.stragglers).toEqual(["r1"]);
    expect(res.rosters.h1).toEqual(["r2"]);
  });

  it("Resident not on any hospital's preference list becomes a straggler", () => {
    const input: HRInput = {
      residents: [
        { id: "r1", preferences: ["h1"] },
        { id: "r2", preferences: ["h1"] },
      ],
      // r2 prefers h1 but isn't on h1's list — h1 rejects.
      hospitals: [{ id: "h1", capacity: 1, preferences: ["r1"] }],
    };

    const res = hospitalResidents(input);
    expect(res.matched.r1).toBe("h1");
    expect(res.matched.r2).toBeNull();
    expect(res.stragglers).toEqual(["r2"]);
  });

  it("Stats: totalProposals counts every proposal (including re-proposals), rounds > 0", () => {
    const input: HRInput = {
      residents: [
        { id: "r1", preferences: ["h1", "h2"] },
        { id: "r2", preferences: ["h1", "h2"] },
      ],
      hospitals: [
        { id: "h1", capacity: 1, preferences: ["r2", "r1"] },
        { id: "h2", capacity: 1, preferences: ["r1", "r2"] },
      ],
    };

    const res = hospitalResidents(input);
    // r1 proposes to h1 (accepted), r2 proposes to h1 (displaces r1),
    // r1 then proposes to h2 (accepted). Total = 3 proposals.
    expect(res.stats.totalProposals).toBe(3);
    expect(res.stats.rounds).toBeGreaterThan(0);
    expect(res.matched).toEqual({ r1: "h2", r2: "h1" });
  });
});
