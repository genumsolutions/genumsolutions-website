import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Sign-up and sign-in rules (2026-11-12, revised): Google is a first-class
// registration path on BOTH forms. An OAuth sign-in for an address with no
// account creates the account and signs it in - nothing is created and then
// deleted. The earlier "sign-in must not register" guard deleted a fresh row
// whenever its intent hint was missing, so real sign-ups vanished minutes after
// registering. A first sign-up still confirms by emailed code (or link, on the
// default free mailer). These guards pin the behaviour.
const panel = readFileSync(resolve(__dirname, "../components/AuthPanel.tsx"), "utf8");
const register = readFileSync(resolve(__dirname, "../app/api/auth/register/route.ts"), "utf8");
const resend = readFileSync(resolve(__dirname, "../app/api/auth/resend/route.ts"), "utf8");
const callback = readFileSync(resolve(__dirname, "../app/auth/callback/route.ts"), "utf8");
const google = readFileSync(resolve(__dirname, "../app/api/auth/google/route.ts"), "utf8");
const schema = readFileSync(resolve(__dirname, "../supabase/schema.sql"), "utf8");

describe("Google sign-in and sign-up", () => {
  it("never blocks a brand-new Google account at the database", () => {
    expect(schema).not.toMatch(/create trigger block_new_google_account/i);
    expect(schema).not.toMatch(/create or replace function public\.block_new_google_account/i);
  });

  it("never creates and then deletes a freshly registered Google account", () => {
    expect(callback).not.toContain("deleteUser");
    expect(callback).not.toContain("no_account");
    expect(callback).not.toContain("genum_google_intent");
    // The app used to hand a fresh row back to the website for deletion.
    expect(existsSync(resolve(__dirname, "../app/api/auth/google/fresh/route.ts"))).toBe(false);
  });

  it("has one Google entry point for both forms", () => {
    expect(google).toContain('provider: "google"');
    expect(google).not.toContain("genum_google_intent");
    expect(panel).toContain('href="/api/auth/google"');
  });

  it("labels Google by form, on the same button in both modes", () => {
    expect(panel).toContain('? "Sign up with Google"');
    expect(panel).toContain(': "Continue with Google"');
  });
});

describe("sign-up flow", () => {
  it("says Sign up instead of create an account", () => {
    expect(panel).toContain('button: "Sign up"');
    expect(panel).toContain("New here? Sign up");
    expect(panel).not.toContain("Create account");
    expect(panel).not.toContain("Create your account");
  });

  it("sends a first sign-up through email confirmation", () => {
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
