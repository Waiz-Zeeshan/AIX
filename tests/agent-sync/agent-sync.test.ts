import { describe, expect, it } from "vitest";

import {
  nameFromEmail,
  planAgentSync,
  type ExistingAgent,
  type PodHeadDirEntry
} from "@/lib/agent-sync";

const PODS: PodHeadDirEntry[] = [
  { podHeadProfileId: "ph1", name: "Mustabeen Iqbal", email: "mi@tkxel.com", empId: "865" },
  { podHeadProfileId: "ph2", name: "Hamza Sohail", email: "hs@tkxel.com", empId: "1154" },
  { podHeadProfileId: "ph3", name: "Mirza Muhammad Obaid", email: "mmo@tkxel.com", empId: "436" },
  { podHeadProfileId: "ph4", name: "Iqbal Qasim Khan", email: "iqk@tkxel.com", empId: "512" },
  { podHeadProfileId: "ph5", name: "Syeda Sara Naseer", email: "ssn@tkxel.com", empId: "962" },
  { podHeadProfileId: "ph6", name: "Anam Khalid", email: "ak@tkxel.com", empId: "49" },
  { podHeadProfileId: "ph7", name: "Mehroz Ahmad", email: "ma@tkxel.com", empId: "806" },
  { podHeadProfileId: "ph8", name: "Mohsin Ali", email: "moa@tkxel.com", empId: null },
  { podHeadProfileId: "ph9", name: "Aqeel Ahmad", email: "aa@tkxel.com", empId: "402" },
  { podHeadProfileId: "ph10", name: "Faheem Imran", email: "fi@tkxel.com", empId: "2484" },
  { podHeadProfileId: "ph11", name: "Usman Ghani", email: "ug@tkxel.com", empId: null },
  { podHeadProfileId: "ph12", name: "Atiya Abid", email: "atia@tkxel.com", empId: "2475" },
  { podHeadProfileId: "ph13", name: "Abdur Rehman", email: "ar@tkxel.com", empId: "1382" }
];

// Headers copied verbatim from the live Google Form export (incl. the
// duplicated "6th Priority Pod", the "Pority" typo, and the "Preffered" typo).
const LIVE_HEADER = [
  "Timestamp",
  "Email Address",
  "Official Email",
  "Quick Intro of your self",
  "1st Preffered domain you want to work on?",
  "2nd Preffered domain you want to work on?",
  "1st Priority Pod",
  "2nd Priority Pod",
  "3rd Priority Pod",
  "4th Priority Pod",
  "5th Priority Pod",
  "6th Priority Pod",
  "6th Priority Pod",
  "7th Priority Pod",
  "8th Pority Pod",
  "9th Priority Pod",
  "10th Priority Pod"
];

const BASE = {
  topN: 10,
  allowedEmailDomains: ["tkxel.com", "tkxel.io"],
  podHeads: PODS,
  existingAgents: [] as ExistingAgent[]
};

function row(over: Partial<Record<string, string>> = {}): string[] {
  const r: string[] = new Array(LIVE_HEADER.length).fill("");
  r[0] = "5/13/2026 1:18:28";
  r[1] = "husnain.nasir@tkxel.io";
  r[2] = "Husnain.nasir@tkxel.io";
  r[3] = "Quick intro pitch — at least one sentence.";
  r[4] = "Engineering";
  r[5] = "Sales";
  // priorities 1..10 (skip the duplicate column at index 12)
  r[6] = "Mustabeen Iqbal";
  r[7] = "Hamza Sohail";
  r[8] = "Mirza Muhammad Obaid";
  r[9] = "Iqbal Qasim Khan";
  r[10] = "Syeda Sara Naseer";
  r[11] = "Anam Khalid";
  r[12] = ""; // duplicate "6th Priority Pod" header — ignored
  r[13] = "Mehroz Ahmad";
  r[14] = "Mohsin Ali"; // "8th Pority Pod"
  r[15] = "Aqeel Ahmad";
  r[16] = "Faheem Imran";

  for (const [k, v] of Object.entries(over)) {
    r[Number(k)] = v ?? "";
  }
  return r;
}

describe("nameFromEmail helper", () => {
  it("title-cases dotted local-parts", () => {
    expect(nameFromEmail("husnain.nasir@tkxel.io")).toBe("Husnain Nasir");
    expect(nameFromEmail("waseem.akram@tkxel.com")).toBe("Waseem Akram");
  });

  it("handles dashes, underscores, and plus signs", () => {
    expect(nameFromEmail("first-last@x.y")).toBe("First Last");
    expect(nameFromEmail("first_last@x.y")).toBe("First Last");
    expect(nameFromEmail("fahad+test@x.y")).toBe("Fahad Test");
  });

  it("returns the input when local-part is empty", () => {
    expect(nameFromEmail("@x.y")).toBe("@x.y");
  });
});

describe("planAgentSync — header detection on live form shape", () => {
  it("parses the literal live header (with typos + duplicate)", () => {
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, row()] });
    expect(plan.summary.creates).toBe(1);
    expect(plan.summary.skips).toBe(0);
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.name).toBe("Husnain Nasir");
    expect(o.pitch).toBe("Quick intro pitch — at least one sentence.");
    expect(o.email).toBe("husnain.nasir@tkxel.io");
    expect(o.rankings).toEqual([
      "ph1","ph2","ph3","ph4","ph5","ph6","ph7","ph8","ph9","ph10"
    ]);
    expect(o.preferredDomains).toEqual(["Engineering", "Sales"]);
  });

  it("surfaces a warning for duplicate priority columns", () => {
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, row()] });
    expect(plan.warnings.some((w) => w.includes("duplicate priority column for rank 6"))).toBe(true);
  });

  it("throws if a priority rank is missing entirely", () => {
    // Remove the "5th Priority Pod" column.
    const trimmed = LIVE_HEADER.filter((_h, i) => i !== 10);
    expect(() => planAgentSync({ ...BASE, rows: [trimmed, row().filter((_c, i) => i !== 10)] }))
      .toThrow(/rank 5/);
  });

  it("throws if no email column is present", () => {
    const headerNoEmail = LIVE_HEADER.map((h, i) => (i === 1 || i === 2 ? "junk" : h));
    expect(() => planAgentSync({ ...BASE, rows: [headerNoEmail, row()] })).toThrow(
      /email/i
    );
  });

  it("throws if pitch column is missing", () => {
    const headerNoPitch = LIVE_HEADER.map((h, i) => (i === 3 ? "ignored" : h));
    expect(() => planAgentSync({ ...BASE, rows: [headerNoPitch, row()] })).toThrow(
      /intro|description/i
    );
  });
});

describe("planAgentSync — email column resolution", () => {
  it("prefers Official Email when both present and differ", () => {
    const r = row({ 1: "google.account@tkxel.com", 2: "official@tkxel.com" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.email).toBe("official@tkxel.com");
  });

  it("falls back to Email Address when Official Email is blank", () => {
    const r = row({ 1: "fallback@tkxel.com", 2: "" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.email).toBe("fallback@tkxel.com");
  });

  it("skips when both email columns are blank", () => {
    const r = row({ 1: "", 2: "" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    // Row has pitch + priorities, so it isn't silent-blank; expect a skip.
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("missing email")
    });
  });

  it("lowercases the chosen email", () => {
    const r = row({ 1: "X@tkxel.com", 2: "Y@TKXEL.COM" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.email).toBe("y@tkxel.com");
  });
});

describe("planAgentSync — Pod-Head matching with EMP IDs", () => {
  it("matches priority cells in 'Name - 1234' format by EMP ID", () => {
    const r = row({
      6: "Mustabeen Iqbal - 865",
      7: "Hamza Sohail - 1154",
      8: "Mirza Muhammad Obaid - 436",
      9: "Iqbal Qasim Khan - 512",
      10: "Syeda Sara Naseer - 962",
      11: "Anam Khalid - 49",
      13: "Mehroz Ahmad - 806",
      14: "Mohsin Ali", // no empId; falls back to name match
      15: "Aqeel Ahmad - 402",
      16: "Faheem Imran - 2484"
    });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    expect(plan.summary).toMatchObject({ creates: 1, skips: 0 });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.rankings).toEqual([
      "ph1", "ph2", "ph3", "ph4", "ph5", "ph6", "ph7", "ph8", "ph9", "ph10"
    ]);
  });

  it("prefers EMP ID over name when the cell name doesn't match", () => {
    // Wrong name spelling, but the empId "865" still resolves to Mustabeen Iqbal.
    const r = row({ 6: "Mustabean Iqbol - 865" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.rankings[0]).toBe("ph1");
  });

  it("falls back to name match when the cell's empId is unknown", () => {
    // Right name, wrong empId — should still match by name.
    const r = row({ 6: "Mustabeen Iqbal - 9999" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.rankings[0]).toBe("ph1");
  });

  it("skips when both empId and name are unknown", () => {
    const r = row({ 6: "Nobody Knows - 9999" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("not found")
    });
  });

  it("matches Pod Heads with no stored empId by name only", () => {
    // ph8 Mohsin Ali has empId=null. Cell with a suffix should fall back to name.
    // Column 14 = "8th Pority Pod" → rankings[7].
    const r = row({ 14: "Mohsin Ali - 1234" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.rankings[7]).toBe("ph8");
  });
});

describe("planAgentSync — tolerant Pod Head name lookups", () => {
  // Live-data bug: a priority cell contained "Hafiz Muhammad Umair -" with a
  // trailing dash but no EMP ID. The lookup was case-folding + collapsing
  // whitespace but not stripping the dangling separator, so the row skipped
  // even though the Pod Head existed.
  const TRAILING_PODS: PodHeadDirEntry[] = [
    ...PODS,
    {
      podHeadProfileId: "phHMU",
      name: "Hafiz Muhammad Umair",
      email: "m.umair@tkxel.io",
      empId: null
    },
    {
      podHeadProfileId: "phSJ",
      name: "Smith-Jones",
      email: "sj@tkxel.io",
      empId: null
    }
  ];

  it("resolves a priority cell with a trailing hyphen ('Hafiz Muhammad Umair -')", () => {
    const r = row({ 6: "Hafiz Muhammad Umair -" });
    const plan = planAgentSync({
      ...BASE,
      podHeads: TRAILING_PODS,
      rows: [LIVE_HEADER, r]
    });
    expect(plan.summary).toMatchObject({ creates: 1, skips: 0 });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.rankings[0]).toBe("phHMU");
  });

  it("resolves trailing en-dash and em-dash variants", () => {
    const planEn = planAgentSync({
      ...BASE,
      podHeads: TRAILING_PODS,
      rows: [LIVE_HEADER, row({ 6: "Hafiz Muhammad Umair – " })]
    });
    const planEm = planAgentSync({
      ...BASE,
      podHeads: TRAILING_PODS,
      rows: [LIVE_HEADER, row({ 6: "Hafiz Muhammad Umair —" })]
    });
    expect(planEn.summary.creates).toBe(1);
    expect(planEm.summary.creates).toBe(1);
    const oEn = planEn.outcomes[0];
    const oEm = planEm.outcomes[0];
    if (oEn.kind === "skip" || oEm.kind === "skip") throw new Error("expected create");
    expect(oEn.rankings[0]).toBe("phHMU");
    expect(oEm.rankings[0]).toBe("phHMU");
  });

  it("does not mangle internal-dash names ('Smith-Jones' still matches)", () => {
    const r = row({ 6: "Smith-Jones" });
    const plan = planAgentSync({
      ...BASE,
      podHeads: TRAILING_PODS,
      rows: [LIVE_HEADER, r]
    });
    expect(plan.summary.creates).toBe(1);
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.rankings[0]).toBe("phSJ");
  });

  it("still reports 'not found' for a genuinely unknown name with a trailing dash", () => {
    const r = row({ 6: "Nobody Knows -" });
    const plan = planAgentSync({
      ...BASE,
      podHeads: TRAILING_PODS,
      rows: [LIVE_HEADER, r]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("not found")
    });
  });
});

describe("planAgentSync — preferred domains", () => {
  it("captures both domains in order", () => {
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, row()] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.preferredDomains).toEqual(["Engineering", "Sales"]);
  });

  it("drops empty 2nd domain", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 5: "" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.preferredDomains).toEqual(["Engineering"]);
  });

  it("dedupes case-insensitively", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 4: "Engineering", 5: "engineering" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.preferredDomains).toEqual(["Engineering"]);
  });

  it("works when both empty", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 4: "", 5: "" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.preferredDomains).toEqual([]);
  });
});

describe("planAgentSync — row-level skips", () => {
  it("skips when domain not allowed", () => {
    const r = row({ 1: "x@example.com", 2: "x@example.com" });
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, r] });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("example.com")
    });
  });

  it("skips when pitch is blank", () => {
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, row({ 3: "" })] });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("intro")
    });
  });

  it("skips when a priority cell is blank", () => {
    const plan = planAgentSync({ ...BASE, rows: [LIVE_HEADER, row({ 9: "" })] });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("priority 4 is empty")
    });
  });

  it("skips on unknown Pod Head", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 9: "Nobody Knows" })]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("not found")
    });
  });

  it("skips on ambiguous Pod Head", () => {
    const dupes: PodHeadDirEntry[] = [
      ...PODS,
      { podHeadProfileId: "ph14", name: "Mustabeen Iqbal", email: "dup@x.y", empId: null }
    ];
    const plan = planAgentSync({
      ...BASE,
      podHeads: dupes,
      rows: [LIVE_HEADER, row()]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("ambiguous")
    });
  });

  it("skips when same Pod Head appears twice in row", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 7: "Mustabeen Iqbal" })]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("listed twice")
    });
  });

  it("skips duplicate emails within sheet", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row(), row()]
    });
    expect(plan.summary).toMatchObject({ creates: 1, skips: 1 });
  });

  it("silently ignores fully-blank rows", () => {
    const blank = new Array(LIVE_HEADER.length).fill("");
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, blank, row()]
    });
    expect(plan.summary).toMatchObject({ creates: 1, skips: 0 });
  });
});

describe("planAgentSync — preserve manual edits", () => {
  it("skips agents who have submitted preferences", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingAgents: [
        {
          email: "husnain.nasir@tkxel.io",
          role: "AGENT",
          preferencesSubmitted: true,
          hasManualRankings: false
        }
      ]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("submitted")
    });
  });

  it("skips agents who have manual rankings", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingAgents: [
        {
          email: "husnain.nasir@tkxel.io",
          role: "AGENT",
          preferencesSubmitted: false,
          hasManualRankings: true
        }
      ]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("manually-edited")
    });
  });

  it("skips when existing user has non-AGENT role", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingAgents: [
        {
          email: "husnain.nasir@tkxel.io",
          role: "POD_HEAD",
          preferencesSubmitted: false,
          hasManualRankings: false
        }
      ]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("POD_HEAD")
    });
  });

  it("marks the row as update (not create) when the agent already exists", () => {
    const plan = planAgentSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingAgents: [
        {
          email: "husnain.nasir@tkxel.io",
          role: "AGENT",
          preferencesSubmitted: false,
          hasManualRankings: false
        }
      ]
    });
    expect(plan.summary).toMatchObject({ creates: 0, updates: 1 });
  });
});
