"use client";

// =====================================================================
// RobotPreferencesPanel — the signed-in customer's own robot preference
// manager (website mirror of the app's Robot Preferences screen).
//
// Pro users can review + edit the per-robot settings (code values,
// parameters, telemetry channels) that the app stores for them in the
// dedicated robot_user_settings table — completely separate from
// orders/carts. The same rows the app writes are editable here, so both
// clients converge on one profile per robot.
// =====================================================================

import { useCallback, useEffect, useState } from "react";

type RobotRow = {
  robot_id: string;
  robot_name: string;
  settings: Record<string, unknown>;
  updated_at: string;
};

export default function RobotPreferencesPanel({ tier }: { tier: "free" | "pro" }) {
  const [robots, setRobots] = useState<RobotRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<RobotRow | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/user/robot-settings");
    if (response.ok) {
      const data = await response.json();
      setRobots(data.robots || []);
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Could not load your robot settings.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRow() {
    if (!editing) return;
    setSaving(true);
    setSaved(false);
    setError("");
    let settings: unknown;
    try {
      settings = JSON.parse(draft || "{}");
    } catch {
      setError("Settings must be valid JSON.");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/user/robot-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ robotId: editing.robot_id, robotName: editing.robot_name, settings }),
    });
    if (response.ok) {
      setSaved(true);
      setEditing(null);
      void load();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Could not save.");
    }
    setSaving(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Robot preferences</h2>
          <p className="mt-1 text-sm text-slate-600">
            Your own code values, parameters, and telemetry channels for each robot — kept separate
            from orders.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${tier === "pro" ? "bg-navy text-white" : "bg-slate-100 text-slate-500"}`}
        >
          {tier === "pro" ? "Pro" : "Free"}
        </span>
      </div>

      {tier !== "pro" ? (
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-slate-600">
          Per-robot preference profiles are a <strong>Pro</strong> feature. Ask GENUM Solutions to
          upgrade your account, and this section — plus the in-app Remote window — unlocks.
        </p>
      ) : !loaded ? (
        <p className="mt-4 text-sm text-slate-500" role="status">
          Loading…
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="mt-3 text-sm font-bold text-red-600">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="mt-3 text-sm font-bold text-emerald-700">
              Saved.
            </p>
          )}
          {robots.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No robot profiles yet — open the app&apos;s Settings → Robot preferences to create
              one, or add one here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {robots.map((robot) => (
                <li key={robot.robot_id} className="py-3">
                  {editing?.robot_id === robot.robot_id ? (
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {robot.robot_name || robot.robot_id}
                      </p>
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        rows={6}
                        className={`mt-2 w-full font-mono text-xs ${"rounded-lg border border-line bg-white px-3 py-2"}`}
                        aria-label={`Settings JSON for ${robot.robot_name || robot.robot_id}`}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => void saveRow()}
                          disabled={saving}
                          className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded-full border border-line px-4 py-2 text-xs font-bold text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">
                          {robot.robot_name || robot.robot_id}
                        </p>
                        <p className="truncate font-mono text-xs text-slate-500">
                          {Object.keys(robot.settings || {}).length} keys · updated{" "}
                          {new Date(robot.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditing(robot);
                          setDraft(JSON.stringify(robot.settings ?? {}, null, 2));
                          setSaved(false);
                        }}
                        className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-navy transition hover:border-navy"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
