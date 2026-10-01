// Garage — the signed-in user's own devices, with the name THEY gave each one.
//
// This is a self-service surface, so there is no userId prop: the route reads
// the session. It shows the pairing name as well as the app name, because the
// operating system lists the ADVERTISED name ("4WD CAR"), not the display
// name — showing only one of the two is how a user ends up convinced their
// car has vanished.
//
// It deliberately shows NO live telemetry and no driving controls. LAN
// transports cannot reach a car from this server at all (see
// lib/remote-control.ts), so a speed slider here would be a lie.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Car, Pencil, Check, X, Trash2, Clock } from "lucide-react";
import { pairingLabel } from "../lib/device-registry";

type Device = {
  deviceId: string;
  displayName: string;
  uniqueId: string;
  isFavourite: boolean;
  lastSeenAt: string | null;
  fwVersion: string;
  pairingName: string;
  model: { id: string; repo: string; fwName: string } | null;
};

function relativeTime(iso: string | null): string {
  if (!iso) return "Never seen";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never seen";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function GaragePanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/devices");
      if (res.status === 401) {
        // Not an error state: the garage is a signed-in surface, so a
        // visitor is simply not signed in. Showing a red box here would imply
        // something is broken.
        setSignedIn(false);
        setDevices([]);
        return;
      }
      if (!res.ok) throw new Error("Could not load your devices.");
      const json = (await res.json()) as { devices?: Device[] };
      setSignedIn(true);
      setDevices(json.devices ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (d: Device) => {
    setEditingId(d.deviceId);
    setDraft(d.displayName);
  };

  const save = async (d: Device) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: d.deviceId, displayName: draft }),
      });
      if (!res.ok) throw new Error("Could not save that name.");
      setDevices((prev) =>
        prev.map((x) => (x.deviceId === d.deviceId ? { ...x, displayName: draft.trim() } : x))
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that name.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Device) => {
    if (!confirm(`Remove ${d.displayName} from your garage?`)) return;
    try {
      const res = await fetch(`/api/user/devices?deviceId=${encodeURIComponent(d.deviceId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not remove that device.");
      setDevices((prev) => prev.filter((x) => x.deviceId !== d.deviceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that device.");
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your devices…
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {signedIn ? "My garage" : "Your garage"}
        </h3>
        {signedIn ? (
          <span className="text-xs text-slate-500">
            {devices.length} device{devices.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {signedIn && devices.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs leading-5 text-slate-600">
          No devices yet. Drive a car once in the GENUM app and it will appear here, where you can
          give it a name of your own.
        </p>
      ) : null}

      {!signedIn ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs leading-5 text-slate-600">
          <a href="/account" className="font-semibold text-blue-600 underline">
            Sign in
          </a>{" "}
          to see the devices your account owns and name them.
        </p>
      ) : null}

      <ul className="space-y-2">
        {devices.map((d) => {
          const editing = editingId === d.deviceId;
          return (
            <li key={d.deviceId} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <Car className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={60}
                        autoFocus
                        aria-label="Device name"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void save(d);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => void save(d)}
                        disabled={saving}
                        aria-label="Save name"
                        className="rounded-lg bg-blue-600 p-1.5 text-white disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel"
                        className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="truncate text-sm font-medium text-slate-900">
                        {d.displayName}
                        {d.isFavourite ? (
                          <span className="ml-2 text-xs text-amber-500">★ favourite</span>
                        ) : null}
                      </p>
                      {/* The pairing name is the difference between "my car is
                          missing" and "oh, it is listed under 4WD CAR". */}
                      {d.pairingName !== d.displayName ? (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{d.pairingName}</p>
                      ) : null}
                    </>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {relativeTime(d.lastSeenAt)}
                    </span>
                    {d.fwVersion ? <span>fw {d.fwVersion}</span> : null}
                    {d.uniqueId ? <span className="font-mono">{d.uniqueId}</span> : null}
                  </div>
                </div>

                {!editing ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(d)}
                      aria-label={`Rename ${d.displayName}`}
                      className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void remove(d)}
                      aria-label={`Remove ${d.displayName}`}
                      className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// pairingLabel is used by the API route; re-exported here so the pairing
// wording has a single definition the panel and the route cannot diverge on.
export { pairingLabel };
