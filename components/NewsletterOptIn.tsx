"use client";

import { useState } from "react";
import { Send } from "lucide-react";

// C4 (2026-09-23): reusable newsletter opt-in. `variant="footer"` matches the
// footer's ink background; `variant="checkout"` the light card style. The
// consent checkbox is REQUIRED before submit (owner-reviewed wording).
export default function NewsletterOptIn({
  variant = "footer",
}: {
  variant?: "footer" | "checkout";
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const isFooter = variant === "footer";

  async function subscribe(event: React.FormEvent) {
    event.preventDefault();
    if (!consent) {
      setState("error");
      setFeedback("Please tick the consent box to subscribe.");
      return;
    }
    setState("busy");
    setFeedback("");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: variant }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setState("done");
        setFeedback(data.message || "You are on the list.");
        setEmail("");
        setConsent(false);
      } else {
        setState("error");
        setFeedback(data.error || "Could not subscribe right now.");
      }
    } catch {
      setState("error");
      setFeedback("Could not subscribe right now. Please try again later.");
    }
  }

  if (state === "done") {
    return (
      <p
        role="status"
        className={`text-sm font-bold ${isFooter ? "text-gold" : "text-emerald-700"}`}
      >
        {feedback} ✓
      </p>
    );
  }

  return (
    <form onSubmit={subscribe} className="mt-2 space-y-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`newsletter-email-${variant}`}>
          Email address
        </label>
        <input
          id={`newsletter-email-${variant}`}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={
            isFooter
              ? "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-gold"
              : "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-navy"
          }
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
            isFooter
              ? "bg-gold text-ink hover:bg-gold-dark"
              : "bg-navy text-white hover:bg-navy-dark"
          }`}
        >
          {state === "busy" ? (
            "…"
          ) : (
            <>
              <Send size={13} aria-hidden="true" /> Subscribe
            </>
          )}
        </button>
      </div>
      <label
        className={`flex cursor-pointer items-start gap-2 text-xs leading-4 ${isFooter ? "text-white/50" : "text-slate-500"}`}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-gold"
        />
        <span>
          Email me news about new kits, projects, and training. I can unsubscribe anytime.
        </span>
      </label>
      {state === "error" && (
        <p className={`text-xs font-bold ${isFooter ? "text-red-300" : "text-red-600"}`}>
          {feedback}
        </p>
      )}
    </form>
  );
}
