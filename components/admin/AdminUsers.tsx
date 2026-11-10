"use client";

import { useEffect, useState } from "react";
import { inputClass } from "../../lib/styles";
import type { UserPage, ManagedUser } from "./admin-types";
import { PAGE_SIZE } from "./admin-types";
import { Pager } from "./admin-helpers";

type RobotRow = {
  robot_id: string;
  robot_name: string;
  settings: Record<string, unknown>;
  updated_at: string;
};

type CarProfileRow = {
  id: string;
  profile_key: string;
  car_name: string;
  unique_id: string;
  settings: Record<string, unknown>;
  updated_at: string;
};

type UserDirRow = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  createdAt?: string;
  lastSignInAt?: string;
  role?: "customer" | "staff" | "admin" | "owner";
  tier?: "free" | "pro";
};

type Props = {
  setMessage: (msg: string) => void;
  canDelete: boolean;
  currentRole: "staff" | "admin" | "owner";
};
function uniqueById<
  T extends { id?: string; profile_key?: string; robot_id?: string; unique_id?: string },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = String(
      (row as { unique_id?: string }).unique_id ||
        row.id ||
        row.profile_key ||
        row.robot_id ||
        JSON.stringify(row)
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadCarProfiles(userId: string): Promise<CarProfileRow[]> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "listCarProfiles", userId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not load project profiles.");
  return uniqueById((body.profiles ?? []) as CarProfileRow[]);
}

async function loadRobotProfiles(userId: string): Promise<RobotRow[]> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "listRobotSettings", userId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not load robot profiles.");
  return uniqueById((body.robots ?? []) as RobotRow[]);
}

function UserProjectProfiles({
  userId,
  email,
  setMessage,
  canDelete,
}: {
  userId: string;
  email: string;
  setMessage: (msg: string) => void;
  canDelete: boolean;
}) {
  const [carProfiles, setCarProfiles] = useState<CarProfileRow[] | null>(null);
  const [robotProfiles, setRobotProfiles] = useState<RobotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setError(null);
    Promise.all([loadCarProfiles(userId), loadRobotProfiles(userId)])
      .then(([cars, robots]) => {
        if (!active) return;
        setCarProfiles(cars);
        setRobotProfiles(robots);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not load projects.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function deleteCar(profileKey: string) {
    if (!window.confirm(`Delete the project profile for ${email}?`)) return;
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteCarProfile", userId, profileKey }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error || "Could not delete the project profile.");
      return;
    }
    setCarProfiles((prev) => (prev ? prev.filter((p) => p.profile_key !== profileKey) : prev));
    setMessage("Project profile deleted.");
  }

  async function deleteRobot(robotId: string) {
    if (!window.confirm(`Delete the robot profile for ${email}?`)) return;
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteRobotSetting", userId, robotId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error || "Could not delete the robot profile.");
      return;
    }
    setRobotProfiles((prev) => (prev ? prev.filter((r) => r.robot_id !== robotId) : prev));
    setMessage("Robot profile deleted.");
  }

  if (error) {
    return <p className="mt-2 text-xs text-red-600">{error}</p>;
  }
  if (carProfiles === null || robotProfiles === null) {
    return (
      <p className="mt-2 text-xs text-slate-500" role="status">
        Loading projects…
      </p>
    );
  }
  if (carProfiles.length === 0 && robotProfiles.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">No projects for this user yet.</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {carProfiles.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-navy">
            Projects ({carProfiles.length})
          </p>
          <ul className="mt-2 space-y-2">
            {carProfiles.map((profile) => (
              <li
                key={profile.id || profile.profile_key}
                className="rounded-lg border border-line bg-white p-3"
              >
                <p className="truncate text-xs font-bold">
                  {profile.car_name || "Untitled project"}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {Object.keys(profile.settings || {}).length} saved settings · updated{" "}
                  {new Date(profile.updated_at).toLocaleDateString()}
                </p>
                <details className="mt-1 text-[11px] text-slate-400">
                  <summary className="cursor-pointer font-bold">Technical details</summary>
                  <p className="mt-1 font-mono break-all">
                    Connection ID: {profile.profile_key}
                    {profile.unique_id ? ` · Device ID: ${profile.unique_id}` : ""}
                  </p>
                </details>
                {canDelete && (
                  <button
                    onClick={() => void deleteCar(profile.profile_key)}
                    className="mt-2 rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {robotProfiles.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-navy">
            Robot profiles ({robotProfiles.length})
          </p>
          <ul className="mt-2 space-y-2">
            {robotProfiles.map((robot) => (
              <li key={robot.robot_id} className="rounded-lg border border-line bg-white p-3">
                <p className="truncate text-xs font-bold">{robot.robot_name || robot.robot_id}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {Object.keys(robot.settings || {}).length} saved settings · updated{" "}
                  {new Date(robot.updated_at).toLocaleDateString()}
                </p>
                <details className="mt-1 text-[11px] text-slate-400">
                  <summary className="cursor-pointer font-bold">Technical details</summary>
                  <p className="mt-1 font-mono break-all">Robot ID: {robot.robot_id}</p>
                </details>
                {canDelete && (
                  <button
                    onClick={() => void deleteRobot(robot.robot_id)}
                    className="mt-2 rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminUsers({ setMessage, canDelete, currentRole: _currentRole }: Props) {
  const [userData, setUserData] = useState<
    UserPage & { users: (ManagedUser & { tier?: string })[] }
  >({
    users: [],
    page: 1,
    hasMore: false,
  });
  const [loaded, setLoaded] = useState(false);
  const userQuery = "";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers(page: number) {
    setLoaded(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (userQuery.trim()) params.set("q", userQuery.trim());
      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) setUserData(await response.json());
    } finally {
      setLoaded(true);
    }
  }

  const userDirRows = (userData.users || []).map((user): UserDirRow => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt ?? undefined,
    role: user.role as "customer" | "staff" | "admin" | "owner",
    tier: user.tier as "free" | "pro",
  }));

  const filteredUsers = userDirRows.filter((user) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${user.name} ${user.email}`.toLowerCase().includes(needle);
  });

  return (
    <section
      role="tabpanel"
      id="panel-users"
      aria-labelledby="tab-users"
      aria-label="User management"
      className="mt-4 space-y-4"
    >
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-navy">User Directory</p>
        <p className="mt-1 text-xs text-slate-500">
          Each account expands to show its projects and robot profiles.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            aria-label="Search users"
            className={`mt-1 w-full sm:ml-2 sm:mt-0 sm:w-64 ${inputClass}`}
          />
          <button
            onClick={() => setSearch("")}
            className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark"
          >
            Clear
          </button>
        </div>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500" role="status">
          Loading…
        </p>
      ) : filteredUsers.length === 0 ? (
        <p className="text-sm text-slate-500">No users found.</p>
      ) : (
        <ul className="space-y-3">
          {filteredUsers.map((user) => (
            <li key={user.id} className="border border-line bg-white p-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {user.name || "—"}{" "}
                    <span className="font-normal text-slate-500">· {user.email}</span>
                  </p>
                  {user.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
                  {user.address && (
                    <p className="break-words text-xs text-slate-400">{user.address}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    Joined {new Date(user.createdAt ?? Date.now()).toLocaleDateString()}
                    {user.lastSignInAt
                      ? ` · Last seen ${new Date(user.lastSignInAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [user.id]: !prev[user.id] }))}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-navy transition hover:border-navy"
                >
                  {expanded[user.id] ? "Hide projects" : "Show projects"}
                </button>
              </div>
              {expanded[user.id] && (
                <UserProjectProfiles
                  userId={user.id}
                  email={user.email}
                  setMessage={setMessage}
                  canDelete={canDelete}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Pager
        page={userData.page}
        totalPages={userData.page + (userData.hasMore ? 1 : 0)}
        onPage={(page) => void loadUsers(page)}
      />
    </section>
  );
}
