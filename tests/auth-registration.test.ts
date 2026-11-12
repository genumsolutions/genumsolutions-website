import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Registration is the one auth flow that has changed direction repeatedly
// (2026-11-12): Google first refused brand-new accounts ("No account found"),
// then registration had to work, the copy had to say "Register" instead of
// "create an account", and a first registration must confirm its email. These
// guards pin the resulting behaviour on BOTH surfaces.
const panel = readFileSync(resolve(__dirname, "../components/AuthPanel.tsx"), "utf8");
const register = readFileSync(resolve(__dirname, "../app/api/auth/register/route.ts"), "utf8");
const resend = readFileSync(resolve(__dirname, "../app/api/auth/resend/route.ts"), "utf8");
const callback = readFileSync(resolve(__dirname, "../app/auth/callback/route.ts"), "utf8");
const schema = readFileSync(resolve(__dirname, "../supabase/schema.sql"), "utf8");

describe("registration flow", () => {
  it("never blocks a brand-new Google account", () => {
    expect(schema).not.toMatch(/create trigger block_new_google_account/i);
    expect(schema).not.toMatch(/create or replace function public\.block_new_google_account/i);
    expect(callback).not.toContain("no_account");
  });

  it("labels Google by intent, on the same button in both modes", () => {
    expect(panel).toContain('? "Register with Google"');
    expect(panel).toContain(': "Continue with Google"');
  });

  it("says Register instead of create an account", () => {
    expect(panel).toContain('button: "Register"');
    expect(panel).toContain("New here? Register");
    expect(panel).not.toContain("Create account");
    expect(panel).not.toContain("Create your account");
  });

  it("sends a first registration through email confirmation", () => {
    // The confirmation link must come back to this host and land on the
    // account page with the confirmed notice, not on the reset form.
    expect(register).toContain("emailRedirectTo");
    expect(register).toContain("/auth/callback?next=");
    expect(register).toContain("needsEmailConfirmation: true");
    expect(callback).toContain('type === "signup"');
    expect(callback).toContain("/account?welcome=1");
    expect(resend).toContain('type: "signup"');
  });
});
