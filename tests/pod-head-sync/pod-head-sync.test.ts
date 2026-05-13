import { describe, expect, it } from "vitest";

import {
  planPodHeadSync,
  splitNameAndEmpId,
  type ExistingUser
} from "@/lib/pod-head-sync";

const LIVE_HEADER = [
  "POD Heads Emails",
  "Name with EMP ID",
  "Phone Number",
  "Department"
];

const BASE = {
  allowedEmailDomains: ["tkxel.com", "tkxel.io"],
  existingUsers: [] as ExistingUser[]
};

function row(over: Partial<Record<number, string>> = {}): string[] {
  const r = [
    "ameer.aftab@tkxel.io",
    "Abdullah Ameer Aftab - 2499",
    "03454803384",
    "Engineering"
  ];
  for (const [k, v] of Object.entries(over)) {
    r[Number(k)] = v ?? "";
  }
  return r;
}

describe("splitNameAndEmpId", () => {
  it("splits 'Name - 1234'", () => {
    expect(splitNameAndEmpId("Abdullah Ameer Aftab - 2499")).toEqual({
      name: "Abdullah Ameer Aftab",
      empId: "2499"
    });
    expect(splitNameAndEmpId("Abu Bakar Riaz - 1818")).toEqual({
      name: "Abu Bakar Riaz",
      empId: "1818"
    });
  });

  it("handles en-dash and em-dash separators", () => {
    expect(splitNameAndEmpId("Foo Bar – 99")).toEqual({ name: "Foo Bar", empId: "99" });
    expect(splitNameAndEmpId("Baz — 100")).toEqual({ name: "Baz", empId: "100" });
  });

  it("keeps the whole cell as name when no EMP ID suffix", () => {
    expect(splitNameAndEmpId("Just a Name")).toEqual({
      name: "Just a Name",
      empId: null
    });
  });

  it("returns empty name + null empId for blank input", () => {
    expect(splitNameAndEmpId("")).toEqual({ name: "", empId: null });
    expect(splitNameAndEmpId("   ")).toEqual({ name: "", empId: null });
  });

  it("strips a dangling trailing dash when no empId follows it", () => {
    expect(splitNameAndEmpId("Foo Bar -")).toEqual({
      name: "Foo Bar",
      empId: null
    });
    expect(splitNameAndEmpId("Foo Bar – ")).toEqual({
      name: "Foo Bar",
      empId: null
    });
    expect(splitNameAndEmpId("Foo Bar —")).toEqual({
      name: "Foo Bar",
      empId: null
    });
  });

  it("preserves internal dashes (does not strip 'Smith-Jones')", () => {
    expect(splitNameAndEmpId("Smith-Jones")).toEqual({
      name: "Smith-Jones",
      empId: null
    });
  });

  it("accepts dashes with no surrounding spaces", () => {
    expect(splitNameAndEmpId("Hafiz Muhammad Umair-1676")).toEqual({
      name: "Hafiz Muhammad Umair",
      empId: "1676"
    });
  });

  it("accepts dashes with space on only one side", () => {
    expect(splitNameAndEmpId("Hafiz -1676")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
    expect(splitNameAndEmpId("Hafiz- 1676")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
  });

  it("accepts Unicode dash variants (hyphen / nb-hyphen / minus sign)", () => {
    // U+2010 Unicode hyphen
    expect(splitNameAndEmpId("Foo Bar ‐ 99")).toEqual({
      name: "Foo Bar",
      empId: "99"
    });
    // U+2011 non-breaking hyphen
    expect(splitNameAndEmpId("Foo Bar‑1234")).toEqual({
      name: "Foo Bar",
      empId: "1234"
    });
    // U+2212 minus sign (Google Sheets sometimes substitutes this)
    expect(splitNameAndEmpId("Foo Bar − 42")).toEqual({
      name: "Foo Bar",
      empId: "42"
    });
  });

  it("accepts trailing junk after the empId (no end anchor)", () => {
    expect(splitNameAndEmpId("Hafiz - 1676 (Engineering)")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
    expect(splitNameAndEmpId("Hafiz - 1676 / TKXEL Pakistan")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
    expect(splitNameAndEmpId("Hafiz - 1676 Senior Engineer")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
    expect(splitNameAndEmpId("Hafiz - 1676   ")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
  });

  it("accepts non-digit filler between dash and digits", () => {
    // Operator wrote "EMP" prefix between dash and the number.
    expect(splitNameAndEmpId("Hafiz - EMP 1676")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
    expect(splitNameAndEmpId("Hafiz - ID:1676")).toEqual({
      name: "Hafiz",
      empId: "1676"
    });
  });

  it("internal-dash name with empId: name preserved, empId extracted", () => {
    // Greedy first group means "Smith-Jones - 1234" parses as Smith-Jones / 1234,
    // not Smith / 1234. The last dash-followed-by-digits wins.
    expect(splitNameAndEmpId("Smith-Jones - 1234")).toEqual({
      name: "Smith-Jones",
      empId: "1234"
    });
    expect(splitNameAndEmpId("Smith-Jones-1234")).toEqual({
      name: "Smith-Jones",
      empId: "1234"
    });
  });

  it("digits inside the name are not mistaken for empId when no trailing dash-digits exist", () => {
    // No dash followed by digits → null empId. The "5" inside "Section 5" stays
    // part of the name.
    expect(splitNameAndEmpId("Section 5 Squad")).toEqual({
      name: "Section 5 Squad",
      empId: null
    });
  });
});

describe("planPodHeadSync — standalone EMP ID column", () => {
  // The live operator sheet has SIX columns: email | Name (bare) | EMP ID
  // (just the number) | Name with EMP ID (combined) | Phone | Department.
  // The bare "Name" column has no dash, so empId can only come from either
  // the standalone EMP ID column or the combined cell.
  const SIX_COL_HEADER = [
    "Email Address",
    "Name",
    "EMP ID",
    "Name with EMP ID",
    "Phone Number",
    "Department"
  ];

  function sixColRow(over: Partial<Record<number, string>> = {}): string[] {
    const r = [
      "ameer.aftab@tkxel.io",
      "Abdullah Ameer Aftab",
      "2499",
      "Abdullah Ameer Aftab - 2499",
      "03454803384",
      "Engineering"
    ];
    for (const [k, v] of Object.entries(over)) {
      r[Number(k)] = v ?? "";
    }
    return r;
  }

  it("reads empId from the standalone EMP ID column when present", () => {
    const plan = planPodHeadSync({ ...BASE, rows: [SIX_COL_HEADER, sixColRow()] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.name).toBe("Abdullah Ameer Aftab");
    expect(o.empId).toBe("2499");
  });

  it("reads empId from the standalone column even when the name cell has no dash", () => {
    // Name column has no dash; without the standalone column, empId would be null.
    const plan = planPodHeadSync({
      ...BASE,
      rows: [
        SIX_COL_HEADER,
        sixColRow({ 3: "" }) // drop the combined column's value
      ]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBe("2499");
  });

  it("falls back to the combined Name-with-EMP-ID cell when no standalone column", () => {
    // 4-column sheet, no separate EMP ID column.
    const plan = planPodHeadSync({ ...BASE, rows: [LIVE_HEADER, row()] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBe("2499");
  });

  it("standalone column wins over the combined cell when both exist", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [
        SIX_COL_HEADER,
        sixColRow({ 2: "9999", 3: "Abdullah Ameer Aftab - 1111" })
      ]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBe("9999");
  });

  it("tolerates non-digit characters in the standalone column", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [SIX_COL_HEADER, sixColRow({ 2: "EMP-2499" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBe("2499");
  });

  it("accepts 'Employee ID' as the standalone header", () => {
    const header = [
      "Email Address",
      "Name",
      "Employee ID",
      "Phone Number",
      "Department"
    ];
    const row5 = [
      "ameer.aftab@tkxel.io",
      "Abdullah Ameer Aftab",
      "2499",
      "03454803384",
      "Engineering"
    ];
    const plan = planPodHeadSync({ ...BASE, rows: [header, row5] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBe("2499");
  });

  it("leaves empId null when both standalone column and combined cell are blank", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [SIX_COL_HEADER, sixColRow({ 2: "", 3: "" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBeNull();
  });
});

describe("planPodHeadSync — header detection", () => {
  it("parses the live Pod-Head header", () => {
    const plan = planPodHeadSync({ ...BASE, rows: [LIVE_HEADER, row()] });
    expect(plan.summary).toEqual({
      rowsTotal: 1,
      creates: 1,
      updates: 0,
      skips: 0
    });
    expect(plan.warnings).toEqual([]);
  });

  it("throws if email column missing", () => {
    expect(() =>
      planPodHeadSync({
        ...BASE,
        rows: [["junk", "Name with EMP ID", "Phone", "Department"], row()]
      })
    ).toThrow(/email/i);
  });

  it("accepts Official Email as an alias for the email column", () => {
    const alt = ["Official Email", "Name with EMP ID", "Phone Number", "Department"];
    const plan = planPodHeadSync({ ...BASE, rows: [alt, row()] });
    expect(plan.summary.creates).toBe(1);
  });

  it("flags duplicate columns in warnings", () => {
    const dup = [...LIVE_HEADER, "Department"];
    const r = [...row(), "Sales"];
    const plan = planPodHeadSync({ ...BASE, rows: [dup, r] });
    expect(plan.warnings).toEqual([
      expect.stringContaining("duplicate department")
    ]);
  });
});

describe("planPodHeadSync — happy path", () => {
  it("captures email, name, phone, department, empId", () => {
    const plan = planPodHeadSync({ ...BASE, rows: [LIVE_HEADER, row()] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.email).toBe("ameer.aftab@tkxel.io");
    expect(o.name).toBe("Abdullah Ameer Aftab");
    expect(o.empId).toBe("2499");
    expect(o.phone).toBe("03454803384");
    expect(o.department).toBe("Engineering");
  });

  it("derives name from email when name cell is blank", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 1: "" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.name).toBe("Ameer Aftab");
    expect(o.empId).toBeNull();
  });

  it("treats phone and department as nullable", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 2: "", 3: "" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.phone).toBeNull();
    expect(o.department).toBeNull();
  });

  it("lowercases the email", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 0: "AMEER.AFTAB@TKXEL.IO" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.email).toBe("ameer.aftab@tkxel.io");
  });

  it("marks existing POD_HEAD as update", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingUsers: [
        { email: "ameer.aftab@tkxel.io", role: "POD_HEAD", empId: null }
      ]
    });
    expect(plan.summary).toMatchObject({ creates: 0, updates: 1, skips: 0 });
  });

  it("silently ignores fully-blank rows", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, ["", "", "", ""], row()]
    });
    expect(plan.summary).toMatchObject({ creates: 1, skips: 0 });
  });
});

describe("planPodHeadSync — row-level skips", () => {
  it("skips when email is blank but other cells present", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 0: "" })]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("email")
    });
  });

  it("skips when domain not allowed", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 0: "x@example.com" })]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("example.com")
    });
  });

  it("skips duplicate email within the sheet", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row(), row()]
    });
    expect(plan.summary).toMatchObject({ creates: 1, skips: 1 });
  });

  it("skips when existing user has non-POD_HEAD role", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingUsers: [
        { email: "ameer.aftab@tkxel.io", role: "AGENT", empId: null }
      ]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("AGENT")
    });
  });

  it("skips invalid email shape", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 0: "not-an-email" })]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("invalid")
    });
  });
});

describe("planPodHeadSync — EMP ID handling", () => {
  it("persists empId from the 'Name - 1234' suffix", () => {
    const plan = planPodHeadSync({ ...BASE, rows: [LIVE_HEADER, row()] });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBe("2499");
  });

  it("allows missing empId (no suffix in name cell)", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row({ 1: "Just A Name" })]
    });
    const o = plan.outcomes[0];
    if (o.kind === "skip") throw new Error("expected create");
    expect(o.empId).toBeNull();
  });

  it("skips a second row carrying the same empId", () => {
    const second = row({ 0: "another@tkxel.io" });
    // Same empId "2499" by virtue of cloning the default name cell.
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row(), second]
    });
    expect(plan.summary).toMatchObject({ creates: 1, skips: 1 });
    expect(plan.outcomes[1]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("EMP ID")
    });
  });

  it("skips when an empId already belongs to a different user in DB", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingUsers: [
        { email: "someone.else@tkxel.io", role: "POD_HEAD", empId: "2499" }
      ]
    });
    expect(plan.outcomes[0]).toMatchObject({
      kind: "skip",
      reason: expect.stringContaining("already belongs")
    });
  });

  it("accepts the same empId when the existing row is the same email (update path)", () => {
    const plan = planPodHeadSync({
      ...BASE,
      rows: [LIVE_HEADER, row()],
      existingUsers: [
        { email: "ameer.aftab@tkxel.io", role: "POD_HEAD", empId: "2499" }
      ]
    });
    expect(plan.summary).toMatchObject({ creates: 0, updates: 1, skips: 0 });
  });
});
