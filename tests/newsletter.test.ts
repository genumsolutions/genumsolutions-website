import { describe, expect, it } from "vitest";
import { isValidEmail } from "../lib/newsletter";

// C4 (2026-09-23): only the pure validation logic is unit-testable here —
// the upsert/list paths hit Supabase and are covered by the live harness
// (scripts/verify-newsletter.mjs) instead of mocking the client.
describe("isValidEmail (C4 newsletter)", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("jane.doe+news@sub.example.co.uk")).toBe(true);
  });

  it("rejects malformed or oversized values", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@tld")).toBe(false);
    expect(isValidEmail("spaces in@example.com")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});
