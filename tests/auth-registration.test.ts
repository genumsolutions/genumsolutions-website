import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Registration and sign-in rules (2026-11-12): "Register with Google" may
// create an account, but "Continue with Google" on the sign-in form must not -
// the callback refuses a brand-new row unless the intent cookie says register.
// A first registration confirms by emailed code (or link, on the default free
// mailer). Suspicious sign-in also requires an emailed code. These guards pin
// the behaviour on BOTH surfaces.
const panel = readFileSync(resolve(__dirname, "../components/AuthPanel.tsx"), "utf8");
const register = readFileSync(resolve(__dirname, "../app/api/auth/register/route.ts"), "utf8");
const resend = readFileSync(resolve(__dirname, "../app/api/auth/resend/route.ts"), "utf8");
const callback = readFileSync(resolve(__dirname, "../app/auth/callback/route.ts"), "utf8");
const google = readFileSync(resolve(__dirname, "../app/api/auth/google/route.ts"), "utf8");
const schema = readFileSync(resolve(__dirname, "../supabase/schema.sql"), "utf8");

describe("registration flow", () => {
  it("never blocks a brand-new Google account at the database", () => {
    expect(schema).not.toMatch(/create trigger block_new_google_account/i);
    expect(schema).not.toMatch(/create or replace function public\.block_new_google_account/i);
  });

  it("refuses to register via the sign-in form's Google button", () => {
    expect(google).toContain("intent=register");
    expect(callback).toContain("no_account");
    expect(panel).toContain('"/api/auth/google?intent=register"');
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
    expect(register).toContain("emailRedirectTo");
    expect(register).toContain("/auth/callback?next=");
    expect(register).toContain("needsEmailConfirmation: true");
    expect(callback).toContain('type === "signup"');
    expect(callback).toContain("/account?welcome=1");
    expect(resend).toContain('type: "signup"');
    // The panel collects and submits a one-time code instead of leaving the
    // customer stuck at the sign-in form after "check your email".
    expect(panel).toContain("/api/auth/verify");
    expect(panel).toContain('mode === "verify"');
  });
});
