"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initials } from "../lib/identity";
import { readLocalCart, unionQuantities, writeLocalCart } from "../lib/cart-client";
import { inputClass } from "../lib/styles";
import { isStaffRole } from "../lib/roles";

type Mode = "signin" | "signup" | "forgot" | "verify";
type VerifyPurpose = "signup" | "signin";

const callbackErrors: Record<string, string> = {
  link: "That email link is invalid, expired, or already used. Start again to get a fresh one.",
  google: "Google sign-in failed or was cancelled.",
  config: "Google sign-in is not configured yet. Use email and password for now.",
  no_account:
    "No account found for that Google address. Sign up first, then use Google to sign in.",
};

// Supabase can send failures as URL hash params (e.g.
// #error=server_error&error_description=Unable%20to%20exchange%20external%20code...)
// instead of query params, so the server callback never sees them. Read both
// places and surface the real description instead of a generic message.
function readSupabaseError(): { code: string; description: string } | null {
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = search.get("error") || hash.get("error") || hash.get("error_code") || "";
    const description =
      search.get("detail") || hash.get("error_description") || hash.get("error_code") || "";
    if (!code && !description) return null;
    let decoded = description;
    try {
      decoded = decodeURIComponent(description);
    } catch {
      decoded = description;
    }
    return { code, description: decoded };
  } catch {
    return null;
  }
}

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

const perks = [
  {
    title: "Your build list, everywhere",
    body: "Carts and saved parts follow you across devices.",
  },
  { title: "Orders at a glance", body: "Live status from checkout to doorstep or pickup." },
  { title: "Priority workshop support", body: "Messages route straight to our engineers." },
];

async function mergeLocalCart() {
  const localCart = readLocalCart();
  if (!localCart.length) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("/api/cart", { signal: controller.signal });
    const data = await response.json().catch(() => ({ cart: [] }));
    const merged = unionQuantities(Array.isArray(data.cart) ? data.cart : [], localCart);
    if (!merged.length) return;
    await fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart: merged }),
      signal: controller.signal,
    });
    writeLocalCart(merged);
  } catch {
    // Offline or timeout - the provider reconciles on the next page load anyway.
  } finally {
    clearTimeout(timeout);
  }
}

const labelClass = "block text-sm font-semibold text-ink";

export default function AuthPanel({ initialMode = "signin" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Set when registration needs a confirmed email address, so the sign-in
  // notice can offer a resend instead of leaving the user stuck.
  const [pendingEmail, setPendingEmail] = useState("");
  // Why the code step is showing: a first registration, or a suspicious sign-in.
  const [verifyPurpose, setVerifyPurpose] = useState<VerifyPurpose>("signup");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Probe the session on mount — if already signed in, redirect home so the
    // auth panel never shows for logged-in users. This uses the same
    // server-side probe as the header, because the cookie-bound Supabase client
    // lives in lib/supabase/server and cannot be imported into a client
    // component.
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setIsSignedIn(true);
          router.replace("/");
          return;
        }
      })
      .catch(() => {
        // Offline or logged out: leave the form visible.
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const supabaseError = readSupabaseError();
    const problem = new URLSearchParams(window.location.search).get("error");
    if (supabaseError?.description) {
      const prefix =
        problem === "no_account"
          ? callbackErrors.no_account
          : problem === "config"
            ? callbackErrors.config
            : problem === "google" || supabaseError.code === "google"
              ? callbackErrors.google
              : "Sign-in failed.";
      setError(`${prefix} Reason: ${supabaseError.description}`);
    } else if (problem && callbackErrors[problem]) {
      setError(callbackErrors[problem]);
    }
  }, []);

  // If already signed in, don't show the auth panel — the effect above has
  // already started the redirect home.
  if (isSignedIn) {
    return null;
  }

  // Avoid flashing the sign-in/create-account form while we probe for an
  // existing session (e.g. just after login or on a direct /login visit).
  if (checkingSession) {
    return (
      <main className="grid-paper min-h-[calc(100vh-64px)]">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl items-center justify-center px-5 py-14 lg:px-8">
          <div className="stamp-ring w-full max-w-md border-t-4 border-navy bg-white p-8 text-center">
            <p className="font-display text-lg font-bold text-ink">Checking your account…</p>
            <p className="mt-2 text-sm text-muted">Please wait a moment.</p>
          </div>
        </div>
      </main>
    );
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    const endpoint =
      mode === "signin"
        ? "/api/auth/login"
        : mode === "signup"
          ? "/api/auth/register"
          : mode === "verify"
            ? "/api/auth/verify"
            : "/api/auth/reset";
    const payload =
      mode === "verify"
        ? { email: pendingEmail, token: String(form.code || ""), purpose: verifyPurpose }
        : form;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.needsEmailConfirmation) {
          const address = String(result.email || form.email || "");
          setPendingEmail(address);
          setVerifyPurpose("signup");
          setError(result.error || "Please confirm your email before signing in.");
          setBusy(false);
          return;
        }
        setError(result.error || "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      if (mode === "forgot") {
        setNotice("If an account exists for that email, a password-reset link is on its way.");
        setBusy(false);
        return;
      }
      if (result.needsEmailConfirmation) {
        const registered = String(form.email || "");
        setPendingEmail(registered);
        setVerifyPurpose("signup");
        switchMode("verify");
        setNotice(
          `Signed up. Open the confirmation link we emailed to ${registered} to finish signing up, then sign in. If that email includes a code, you can enter it below.`
        );
        setBusy(false);
        return;
      }
      if (result.requiresVerification) {
        // Suspicious sign-in: the password alone is not enough this time.
        setPendingEmail(String(result.email || form.email || ""));
        setVerifyPurpose("signin");
        switchMode("verify");
        setNotice(result.message || "For your security, enter the one-time code we emailed you.");
        setBusy(false);
        return;
      }
      // Fire-and-forget: the cart provider reconciles on the next page load,
      // so waiting here only delayed the redirect.
      void mergeLocalCart();
      // U-24 (2026-09-24): staff/admin/owner all land on the admin home.
      const dest = isStaffRole(result.role) ? "/admin" : "/account";
      const toast =
        mode === "verify" ? (verifyPurpose === "signup" ? "signed_up" : "signed_in") : "signed_in";
      router.replace(`${dest}${dest.includes("?") ? "&" : "?"}auth=${toast}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  // First registration needs a confirmed email; without this the "check your
  // email" notice was a dead end when the message never arrived.
  async function resendConfirmation() {
    if (!pendingEmail) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, purpose: verifyPurpose }),
      });
      if (!response.ok) throw new Error("resend failed");
      setNotice(`Email sent to ${pendingEmail}. If it is not there in a minute, check spam.`);
    } catch {
      setNotice("Could not resend just now. Please try again in a few minutes.");
    } finally {
      setBusy(false);
    }
  }

  const copy: Record<Mode, { title: string; body: string; button: string }> = {
    signin: {
      title: "Welcome back.",
      body: "Sign in to pick up your build list, track orders, and manage the site if you are staff.",
      button: "Sign in",
    },
    signup: {
      title: "Sign up for an account.",
      body: "Sign up once for orders, saved builds, and support - free, and ready in under a minute.",
      button: "Sign up",
    },
    verify: {
      title: "Confirm your email.",
      body: "Open the confirmation link we sent, or enter a code if your email includes one.",
      button: "Confirm code",
    },
    forgot: {
      title: "Reset your password.",
      body: "Enter your account email and we will send you a secure reset link.",
      button: "Send reset link",
    },
  };

  return (
    <main className="grid-paper min-h-[calc(100vh-64px)]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1fr_420px] lg:gap-16 lg:px-8">
        <aside className="hidden lg:block">
          <p className="text-xs font-black uppercase tracking-[.25em] text-navy">
            GENUM Solutions Pvt. Ltd.
          </p>
          <h2 className="mt-4 font-display text-5xl font-bold leading-[1.05] text-ink">
            One account.
            <br />
            Every build.
          </h2>
          <ul className="mt-10 space-y-7">
            {perks.map((perk) => (
              <li key={perk.title} className="flex gap-4">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-black text-white">
                  {initials(perk.title).slice(0, 1)}
                </span>
                <span>
                  <strong className="block font-display text-lg text-ink">{perk.title}</strong>
                  <span className="mt-1 block text-sm leading-6 text-muted">{perk.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-12 border-t border-line pt-5 text-xs font-bold uppercase tracking-widest text-muted">
            Robotics · Electronics · 3D printing · AI — Kathmandu, Nepal
          </p>
        </aside>

        <section className="w-full justify-self-center">
          <div className="stamp-ring border-t-4 border-navy bg-white p-7 sm:p-9">
            <Link
              href="/"
              className="flex items-center gap-2.5 lg:hidden"
              aria-label="GENUM SOLUTIONS home"
            >
              <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line">
                <Image
                  src="/logo.png"
                  alt="GENUM SOLUTIONS stamp"
                  width={112}
                  height={112}
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="leading-none">
                <strong className="block font-display text-base font-bold tracking-tight text-ink">
                  GENUM
                </strong>
                <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.3em] text-navy">
                  Solutions Pvt.&thinsp;Ltd.
                </span>
              </span>
            </Link>
            <h1 className="mt-8 font-display text-3xl font-bold text-ink sm:text-4xl lg:mt-0">
              {copy[mode].title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">{copy[mode].body}</p>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                <p>{error}</p>
                {pendingEmail && mode === "signin" && (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={busy}
                    className="mt-2 block text-xs font-black uppercase tracking-widest underline transition hover:opacity-70 disabled:opacity-60"
                  >
                    Resend confirmation email
                  </button>
                )}
              </div>
            )}
            {notice && (
              <div
                role="status"
                className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              >
                <p>{notice}</p>
                {pendingEmail && (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={busy}
                    className="mt-2 block text-xs font-black uppercase tracking-widest underline transition hover:opacity-70 disabled:opacity-60"
                  >
                    Resend email
                  </button>
                )}
              </div>
            )}

            <form onSubmit={submit}>
              {mode === "signup" && (
                <label className={`${labelClass} mt-7 block`}>
                  Full name
                  <input
                    name="name"
                    required
                    minLength={2}
                    autoComplete="name"
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
              )}
              {mode !== "verify" && (
                <label className={`${labelClass} mt-5 block`}>
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={`mt-2 w-full ${inputClass}`}
                  />
                </label>
              )}

              {mode === "verify" && (
                <label className={`${labelClass} mt-5 block`}>
                  Code sent to {pendingEmail}
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="\\d{6,10}"
                    maxLength={10}
                    required
                    autoComplete="one-time-code"
                    placeholder="12345678"
                    className={`mt-2 w-full ${inputClass} tracking-[.4em]`}
                  />
                </label>
              )}

              {mode !== "forgot" && mode !== "verify" && (
                <label className={`${labelClass} mt-5 block`}>
                  Password
                  <span className="relative mt-2 block">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className={`mt-2 w-full ${inputClass} pr-16`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 px-4 text-xs font-bold uppercase tracking-wide text-muted transition hover:text-navy"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>
              )}

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="mt-3 block text-sm font-semibold text-navy transition hover:text-navy-dark"
                >
                  Forgot password?
                </button>
              )}

              <button
                disabled={busy}
                className="mt-7 w-full rounded-lg bg-navy px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark disabled:opacity-60"
              >
                {busy ? "Please wait…" : copy[mode].button}
              </button>
            </form>

            {mode !== "forgot" && mode !== "verify" && (
              <>
                <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted">
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>
                <a
                  href={mode === "signup" ? "/api/auth/google?intent=signup" : "/api/auth/google"}
                  onClick={() => setGoogleBusy(true)}
                  aria-disabled={googleBusy}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border-2 border-line bg-white px-5 py-3.5 text-sm font-bold text-ink transition hover:border-navy hover:bg-navy-light"
                >
                  {GoogleIcon}
                  {googleBusy
                    ? "Connecting…"
                    : mode === "signup"
                      ? "Sign up with Google"
                      : "Continue with Google"}
                </a>
              </>
            )}

            <div className="mt-6 space-y-2 border-t border-line pt-5">
              {mode !== "signup" && (
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="block text-sm font-semibold text-navy transition hover:text-navy-dark"
                >
                  New here? Sign up
                </button>
              )}
              {mode !== "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="block text-sm font-semibold text-navy transition hover:text-navy-dark"
                >
                  I already have an account
                </button>
              )}
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="block text-sm font-semibold text-navy transition hover:text-navy-dark"
                >
                  Back to sign in
                </button>
              )}
              {mode === "verify" && (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="block text-sm font-semibold text-navy transition hover:text-navy-dark"
                >
                  Use a different email
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
