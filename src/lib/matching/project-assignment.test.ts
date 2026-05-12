import { describe, expect, it } from "vitest";
import { assignProjects } from "./project-assignment";
import type { ProjectAssignmentInput } from "./types";

function makeInput(
  podHeads: ProjectAssignmentInput["podHeads"],
  projects: ProjectAssignmentInput["projects"],
  projectsPerPodHead = 2,
): ProjectAssignmentInput {
  return { podHeads, projects, projectsPerPodHead };
}

describe("assignProjects — SRS §7.5", () => {
  it("Test 9 (FCFS): earlier submitter wins contested primary; later falls back", () => {
    const input = makeInput(
      [
        {
          id: "A",
          preferencesSubmittedAt: "2025-01-01T00:00:10Z",
          projectPicks: ["X", "Y"],
        },
        {
          id: "B",
          preferencesSubmittedAt: "2025-01-01T00:00:20Z",
          projectPicks: ["X", "Z"],
        },
      ],
      [
        { id: "X", capacity: 1 },
        { id: "Y", capacity: 5 },
        { id: "Z", capacity: 5 },
      ],
    );

    const result = assignProjects(input);

    expect(result.assignments.A[0]).toBe("X");
    expect(result.assignments.B[0]).toBe("Z"); // B's rank-2 since X is full

    const aRank1 = result.dispositions.find(
      (d) => d.podHeadId === "A" && d.rank === 1,
    );
    const bRank1 = result.dispositions.find(
      (d) => d.podHeadId === "B" && d.rank === 1,
    );
    expect(aRank1?.outcome).toBe("PRIMARY_HONORED");
    expect(bRank1?.outcome).toBe("FELL_BACK_TO_BALANCE");
  });

  it("nulls last: a real timestamp beats null even when null sorts earlier by id", () => {
    // A has null (auto-filled); B has a real time. B should be processed first.
    const input = makeInput(
      [
        { id: "A", preferencesSubmittedAt: null, projectPicks: ["X", "Y"] },
        {
          id: "B",
          preferencesSubmittedAt: "2025-01-01T00:00:20Z",
          projectPicks: ["X", "Z"],
        },
      ],
      [
        { id: "X", capacity: 1 },
        { id: "Y", capacity: 5 },
        { id: "Z", capacity: 5 },
      ],
    );

    const result = assignProjects(input);
    expect(result.assignments.B[0]).toBe("X");
    expect(result.assignments.A[0]).toBe("Y"); // A falls back to its rank-2

    const bRank1 = result.dispositions.find(
      (d) => d.podHeadId === "B" && d.rank === 1,
    );
    const aRank1 = result.dispositions.find(
      (d) => d.podHeadId === "A" && d.rank === 1,
    );
    expect(bRank1?.outcome).toBe("PRIMARY_HONORED");
    expect(aRank1?.outcome).toBe("FELL_BACK_TO_BALANCE");
  });

  it("every Pod Head gets two DISTINCT project ids", () => {
    const input = makeInput(
      [
        {
          id: "A",
          preferencesSubmittedAt: "2025-01-01T00:00:10Z",
          projectPicks: ["X", "Y"],
        },
        {
          id: "B",
          preferencesSubmittedAt: "2025-01-01T00:00:20Z",
          projectPicks: ["X", "Y"],
        },
        {
          id: "C",
          preferencesSubmittedAt: "2025-01-01T00:00:30Z",
          projectPicks: ["Y", "Z"],
        },
      ],
      [
        { id: "X", capacity: 2 },
        { id: "Y", capacity: 2 },
        { id: "Z", capacity: 2 },
      ],
    );

    const result = assignProjects(input);
    for (const ph of input.podHeads) {
      const slots = result.assignments[ph.id];
      expect(slots).toHaveLength(2);
      expect(slots[0]).not.toBe(slots[1]);
    }
  });

  it("capacity is never exceeded under tight caps", () => {
    // 4 pod heads, 4 slots total per project; total demand = 8 across 4 projects cap 2 each.
    const input = makeInput(
      [
        {
          id: "A",
          preferencesSubmittedAt: "2025-01-01T00:00:01Z",
          projectPicks: ["P1", "P2"],
        },
        {
          id: "B",
          preferencesSubmittedAt: "2025-01-01T00:00:02Z",
          projectPicks: ["P1", "P2"],
        },
        {
          id: "C",
          preferencesSubmittedAt: "2025-01-01T00:00:03Z",
          projectPicks: ["P1", "P2"],
        },
        {
          id: "D",
          preferencesSubmittedAt: "2025-01-01T00:00:04Z",
          projectPicks: ["P1", "P2"],
        },
      ],
      [
        { id: "P1", capacity: 2 },
        { id: "P2", capacity: 2 },
        { id: "P3", capacity: 2 },
        { id: "P4", capacity: 2 },
      ],
    );

    const result = assignProjects(input);
    for (const pid of ["P1", "P2", "P3", "P4"]) {
      expect(result.loads[pid]).toBeLessThanOrEqual(2);
    }
    // Total assignments = 4 PHs * 2 slots = 8.
    const total = Object.values(result.loads).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  it("is deterministic: same input twice yields identical output", () => {
    const build = (): ProjectAssignmentInput =>
      makeInput(
        [
          {
            id: "A",
            preferencesSubmittedAt: "2025-01-01T00:00:10Z",
            projectPicks: ["X", "Y"],
          },
          {
            id: "B",
            preferencesSubmittedAt: "2025-01-01T00:00:20Z",
            projectPicks: ["X", "Z"],
          },
          {
            id: "C",
            preferencesSubmittedAt: null,
            projectPicks: ["Y", "Z"],
          },
        ],
        [
          { id: "X", capacity: 1 },
          { id: "Y", capacity: 3 },
          { id: "Z", capacity: 3 },
        ],
      );

    const r1 = assignProjects(build());
    const r2 = assignProjects(build());
    expect(r2).toEqual(r1);
  });

  it("balanced fallback: all primaries conflict; ties broken by id ASC", () => {
    // 3 PHs all want X (cap 1) primary, all want Y (cap 1) secondary.
    // After A gets X, B and C fall to secondary Y — only one slot. Last falls
    // back to argmin-available, which between Z1/Z2 (both empty) should pick
    // Z1 (id ASC).
    const input = makeInput(
      [
        {
          id: "A",
          preferencesSubmittedAt: "2025-01-01T00:00:01Z",
          projectPicks: ["X", "Y"],
        },
        {
          id: "B",
          preferencesSubmittedAt: "2025-01-01T00:00:02Z",
          projectPicks: ["X", "Y"],
        },
        {
          id: "C",
          preferencesSubmittedAt: "2025-01-01T00:00:03Z",
          projectPicks: ["X", "Y"],
        },
      ],
      [
        { id: "X", capacity: 1 },
        { id: "Y", capacity: 1 },
        { id: "Z1", capacity: 5 },
        { id: "Z2", capacity: 5 },
      ],
    );

    const result = assignProjects(input);

    expect(result.assignments.A[0]).toBe("X"); // earliest got primary
    expect(result.assignments.B[0]).toBe("Y"); // next deferred took secondary
    // C: both X and Y full → least-loaded among remaining → Z1 (id ASC tie-break).
    expect(result.assignments.C[0]).toBe("Z1");

    // Caps respected.
    expect(result.loads.X).toBe(1);
    expect(result.loads.Y).toBe(1);

    // Every PH gets distinct two-slot assignment.
    for (const ph of input.podHeads) {
      const slots = result.assignments[ph.id];
      expect(slots[0]).not.toBe(slots[1]);
    }

    // Dispositions for the fallback cases.
    const bRank1 = result.dispositions.find(
      (d) => d.podHeadId === "B" && d.rank === 1,
    );
    const cRank1 = result.dispositions.find(
      (d) => d.podHeadId === "C" && d.rank === 1,
    );
    expect(bRank1?.outcome).toBe("FELL_BACK_TO_BALANCE");
    expect(cRank1?.outcome).toBe("FELL_BACK_TO_BALANCE");
  });

  it("rank=2 honored when secondary pick is placed in slot 2", () => {
    const input = makeInput(
      [
        {
          id: "A",
          preferencesSubmittedAt: "2025-01-01T00:00:10Z",
          projectPicks: ["X", "Y"],
        },
      ],
      [
        { id: "X", capacity: 1 },
        { id: "Y", capacity: 1 },
      ],
    );
    const result = assignProjects(input);
    expect(result.assignments.A).toEqual(["X", "Y"]);
    const r1 = result.dispositions.find((d) => d.podHeadId === "A" && d.rank === 1);
    const r2 = result.dispositions.find((d) => d.podHeadId === "A" && d.rank === 2);
    expect(r1?.outcome).toBe("PRIMARY_HONORED");
    expect(r2?.outcome).toBe("SECONDARY_HONORED");
  });

  it("does not mutate the caller's input arrays", () => {
    const podHeads = [
      {
        id: "B",
        preferencesSubmittedAt: "2025-01-01T00:00:20Z",
        projectPicks: ["X", "Y"],
      },
      {
        id: "A",
        preferencesSubmittedAt: "2025-01-01T00:00:10Z",
        projectPicks: ["X", "Y"],
      },
    ];
    const projects = [
      { id: "X", capacity: 1 },
      { id: "Y", capacity: 5 },
      { id: "Z", capacity: 5 },
    ];
    const podHeadsBefore = JSON.stringify(podHeads);
    const projectsBefore = JSON.stringify(projects);

    assignProjects({ podHeads, projects, projectsPerPodHead: 2 });

    expect(JSON.stringify(podHeads)).toBe(podHeadsBefore);
    expect(JSON.stringify(projects)).toBe(projectsBefore);
  });

  it("throws for unsupported projectsPerPodHead", () => {
    expect(() =>
      assignProjects({
        podHeads: [],
        projects: [],
        projectsPerPodHead: 3,
      }),
    ).toThrow();
  });
});
