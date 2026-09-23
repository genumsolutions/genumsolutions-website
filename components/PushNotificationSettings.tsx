"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from "../lib/web-push";

// Account-page notification settings (W-3). Guest-visible copy steers to
// sign-in; the browser's own permission prompt is only ever triggered from
// the explicit button click (never on page load).
export default function PushNotificationSettings() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPushStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function onSubscribe() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await subscribeToPush();
    if (result.ok) {
      setMessage("Order updates will now pop up on this device.");
    } else {
      setError(result.error || "Could not turn notifications on.");
    }
    setStatus(await getPushStatus().catch(() => null));
    setBusy(false);
  }

  async function onUnsubscribe() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await unsubscribeFromPush();
    if (!result.ok) setError(result.error || "Could not turn notifications off.");
    setStatus(await getPushStatus().catch(() => null));
    setBusy(false);
  }

  if (!status?.supported) return null;

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-xl font-bold text-ink">Order notifications</h2>
      <p className="mt-2 text-sm text-slate-600">
        Get a push on this device when your order status changes (payment confirmed, shipped,
        cancelled) — even with GENUM closed.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {status.subscribed ? (
          <button
            onClick={onUnsubscribe}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg border border-line px-5 py-3 text-sm font-bold text-ink transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <BellOff size={16} aria-hidden="true" />
            )}
            Turn off on this device
          </button>
        ) : (
          <button
            onClick={onSubscribe}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white transition hover:bg-navy-dark disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Bell size={16} aria-hidden="true" />
            )}
            Turn on notifications
          </button>
        )}
        {status.permission === "denied" && !status.subscribed && (
          <span className="text-xs text-slate-500">
            Notifications are blocked for this site — enable them in your browser settings.
          </span>
        )}
        {message && (
          <span role="status" className="text-sm font-bold text-emerald-700">
            {message}
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm font-bold text-red-600">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
