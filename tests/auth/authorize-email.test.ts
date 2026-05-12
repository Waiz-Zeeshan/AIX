/**
 * Tests the signIn authorization predicate end-to-end against the seeded DB.
 *
 * Covers SRS §10.1 Sign-in Flow:
 *  - Step 3: domain check against EventConfig.allowedEmailDomains
 *  - Step 4: user must exist in User table
 *
 * Skipped if DATABASE_URL isn't set.
 */

import { describe, it, expect } from "vitest";
import { authorizeEmail } from "@/lib/auth-helpers";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const ADMIN_EMAILS = ["waiz.zeeshan@camp1.tkxel.com"];

d("authorizeEmail (SRS §10.1)", () => {
  it("rejects an unknown domain", async () => {
    const result = await authorizeEmail("someone@gmail.com", ADMIN_EMAILS);
    expect(result).toBeNull();
  });

  it("rejects a known domain with no User record", async () => {
    const result = await authorizeEmail("nobody@tkxel.com", ADMIN_EMAILS);
    expect(result).toBeNull();
  });

  it("accepts a pre-imported user on an allowed domain", async () => {
    const result = await authorizeEmail(
      "waiz.zeeshan@camp1.tkxel.com",
      ADMIN_EMAILS
    );
    expect(result).not.toBeNull();
    expect(result?.email).toBe("waiz.zeeshan@camp1.tkxel.com");
    expect(result?.isAdmin).toBe(true);
  });

  it("rejects malformed email (no @)", async () => {
    const result = await authorizeEmail("not-an-email", ADMIN_EMAILS);
    expect(result).toBeNull();
  });

  it("normalizes email casing", async () => {
    const result = await authorizeEmail(
      "WAIZ.ZEESHAN@CAMP1.TKXEL.COM",
      ADMIN_EMAILS
    );
    expect(result).not.toBeNull();
  });
});
