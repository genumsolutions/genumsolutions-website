"use client";

// =====================================================================
// CarProfilesPanel — the signed-in customer's car-profile manager
// (website mirror of the app's Car Profile card in the Connections Hub).
//
// Every car the user links from the app gets one profile row
// (`car_profiles`, keyed by the car's STABLE identity: fw board id / BT
// MAC / wifi identity). The row holds the last-saved drive settings the
// app restores on the next link — mode, speed, steer, trim, joystick,
// saved routers, Wi-Fi history (names only; passwords never leave the
// phone/car). Profiles are created by the app on link; the website lets
// the user review them, rename them, or remove them, so the account's
// fleet stays organized from either client. Both clients converge on the
// same rows (last-saved-wins sync in the app).
// =====================================================================

import { useCallback, useEffect, useState } from "react";

type CarProfileRow = {
  profile_key: string;
  car_name: string;
  unique_id: string | null;
  settings: Record<string, unknown>;
  wifi_history: Array<{ ssid: string; lastSeen: number }> | null;
  updated_at: string;
};

const MODE_NAMES: Record<string, string> = {
  "4wd4m": "4WD4M",
  "2wd1m": "2WD1M",
  "self-balancing": "Self-balance",
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function SettingsSummary({ row }: { row: CarProfileRow }) {
  const s = row.settings || {};
  const modeId = asString(s.mode_id);
  const speed = asNumber(s.speed);
  const steer = asNumber(s.steer_limit);
  const trim = asNumber(s.trim);
  const routers = Array.isArray(s.saved_routers) ? s.saved_routers.length : 0;
  const pieces: string[] = [];
  if (modeId) pieces.push(MODE_NAMES[modeId] ?? modeId);
  if (speed != null) pieces.push(`speed ${speed}`);
  if (steer != null && steer !== 90) pieces.push(`steer ${steer}°`);
  if (trim != null && trim !== 0) pieces.push(`trim ${trim > 0 ? "+" : ""}${trim}`);
  if (routers > 0) pieces.push(`${routers} router${routers === 1 ? "" : "s"}`);
  return (
    <p className="truncate text-xs text-slate-500">
      {pieces.length > 0 ? pieces.join(" · ") : "No saved settings yet"}
      {" · updated "}
      {new Date(row.updated_at).toLocaleDateString()}
    </p>
  );
}

export default function CarProfilesPanel() {
  const [profiles, setProfiles] = useState<CarProfileRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CarProfileRow | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/user/car-profiles");
    if (response.ok) {
      const data = await response.json();
      setProfiles(data.profiles || []);
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Could not load your car profiles.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRename() {
    if (!editing) return;
    setSaving(true);
    setSaved(false);
    setError("");
    const response = await fetch("/api/user/car-profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileKey: editing.profile_key,
        carName: draft.trim(),
      }),
    });
    if (response.ok) {
      setSaved(true);
      setEditing(null);
      void load();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Could not rename.");
    }
    setSaving(false);
  }

  async function removeRow(row: CarProfileRow) {
    setError("");
    setSaved(false);
    const response = await fetch(
      `/api/user/car-profiles?profileKey=${encodeURIComponent(row.profile_key)}`,
      { method: "DELETE" }
    );
    if (response.ok) {
      setProfiles((cur) => cur.filter((p) => p.profile_key !== row.profile_key));
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Could not delete.");
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Car profiles</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every car you link from the GENUM app keeps its last-saved settings here, under your
            account — the app restores them automatically on any phone.
          </p>
        </div>
      </div>

      {!loaded ? (
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
          {profiles.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No cars yet — link your 4WD4M, 2WD1M, or self-balance car from the app&apos;s
              Connections Hub and its profile appears here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {profiles.map((row) => (
                <li key={row.profile_key} className="py-3">
                  {editing?.profile_key === row.profile_key ? (
                    <div>
                      <p className="font-mono text-xs text-slate-500">{row.profile_key}</p>
                      <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        maxLength={120}
                        className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                        aria-label={`Name for ${row.car_name || row.profile_key}`}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => void saveRename()}
                          disabled={saving || !draft.trim()}
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
                          {row.car_name || "Unnamed car"}
                          {row.unique_id ? (
                            <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                              {row.unique_id}
                            </span>
                          ) : null}
                        </p>
                        <SettingsSummary row={row} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditing(row);
                            setDraft(row.car_name || "");
                            setSaved(false);
                          }}
                          className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-navy transition hover:border-navy"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => void removeRow(row)}
                          className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-red-600 transition hover:border-red-600"
                        >
                          Remove
                        </button>
                      </div>
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
