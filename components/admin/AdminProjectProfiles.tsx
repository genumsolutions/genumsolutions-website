"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cardRow, inputClass } from "../../lib/styles";

// =====================================================================
// AdminProjectProfiles — the Users tab's Project profiles window.
//
// Until now saved builder profiles were only visible inside each account
// (AdminUsers) and in the profile-entry log. That answered "what did this
// person change" but not "which projects exist at all", so support could not
// see a broken profile unless the owner told them whose it was. This lists
// every car_profiles row across builders, newest first, read-only.
//
// Read-only is deliberate: an edit belongs on the account record so there is
// exactly one write path for a builder's settings.
// =====================================================================

type ProjectProfile = {
  id: string;
  userId: string;
  ownerName: string;
  profileKey: string;
  carName: string;
  uniqueId: string;
  settingsCount: number;
  updatedAt: string;
};

function when(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminProjectProfiles() {
  const [profiles, setProfiles] = useState<ProjectProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users?profiles=1");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Could not load project profiles.");
      setProfiles((data.profiles ?? []) as ProjectProfile[]);
      setTruncated(data.truncated === true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load project profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter((profile) =>
      `${profile.ownerName} ${profile.userId} ${profile.carName} ${profile.profileKey} ${profile.uniqueId}`
        .toLowerCase()
        .includes(needle)
    );
  }, [profiles, query]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Project profiles</h2>
          <p className="mt-1 text-sm text-muted">
            Every saved builder profile across all accounts, newest first. Read-only — repairs go
            through the account row so there is one write path.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-[36px] rounded-full border border-line px-4 text-xs font-black text-navy transition hover:border-navy"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by builder, car, profile key or unique id"
        aria-label="Search project profiles"
        className={`mt-3 w-full ${inputClass}`}
      />

      <p className="mt-3 text-xs text-muted">
        {filtered.length} of {profiles.length} profiles
        {truncated ? " · showing the 300 most recent" : ""}
      </p>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading project profiles…</p>
      ) : error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-full bg-navy px-4 py-2 text-xs font-black text-white"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {profiles.length === 0
            ? "No builder has saved a project profile yet."
            : "No profile matches that search."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {filtered.map((profile) => (
            <li key={profile.id} className={cardRow}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {profile.carName || profile.profileKey || "Unnamed profile"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {profile.ownerName || profile.userId || "Unknown builder"}
                  {profile.profileKey ? ` · key ${profile.profileKey}` : ""}
                  {profile.uniqueId ? ` · car ${profile.uniqueId}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {profile.settingsCount} settings · updated {when(profile.updatedAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
