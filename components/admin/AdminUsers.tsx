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

// ============================================================
// UsersDirectory - Shows user directory rows
// ============================================================

function UsersDirectory({
  users,
  canDelete,
  isOwner,
  setMessage,
}: {
  users: UserDirRow[];
  canDelete: boolean;
  isOwner: boolean;
  setMessage: (msg: string) => void;
}) {
  // Use the search state internally
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter((user) => {
    const matchesQuery =
      !search ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    return matchesQuery;
  });

  const renderHeader = () => (
    <div className="mb-3">
      <p className="text-xs font-black uppercase tracking-widest text-navy">
        User Directory
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Search and manage user accounts and their basic information.
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
  );

  return (
    <div>
      {renderHeader()}
      {filteredUsers.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No users found.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filteredUsers.map((user) => (
            <li key={user.id} className="border border-line bg-white p-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {user.name || "—"} {" "}<span className="font-normal text-slate-500">· {user.email}</span></p>
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
                <span className="flex flex-wrap gap-2 sm:w-auto">
                  <select
                    disabled={!canDelete}
                    aria-label={`Role for ${user.email}`}
                    className="border border-line bg-white px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="customer">customer</option>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                    <option value="owner" disabled>
                      owner
                    </option>
                  </select>
                  {user.tier === "pro" ? (
                    <button
                      onClick={() =>
                        setMessage(`Upgrade ${user.email} to PRO? (Pro unlocks per-robot preference profiles.)`)
                      }
                      className="border border-line px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-slate-500"
                    >
                      Upgrade to Pro
                    </button>
                  ) : (
                    <button
                      onClick={() => setMessage(`Downgrade ${user.email} to FREE? (Robot preference rows are kept but become read-only.)`)}
                      className="border border-line px-3 py-1.5 text-xs font-bold text-slate-500 transition:hover:border-slate-500"
                    >
                      Downgrade to Free
                    </button>
                  )}
                  {isOwner && canDelete && (
                    <button
                      onClick={() =>
                        window.confirm(
                          `Permanently delete ${user.email}? This removes their account and all related data. This cannot be undone.`
                        ) && void setSearch("")
                      }
                      className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                    >
                      Delete user
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ======================
// CarProfilesSection
// ======================

function CarProfilesSection({
  userId,
  email,
  profiles,
  setMessage,
  canDelete,
}: {
  userId: string;
  email: string;
  profiles: CarProfileRow[] | null;
  setMessage: (msg: string) => void;
  canDelete: boolean;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftJson, setDraftJson] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listCarProfiles", userId }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage(err.error || "Could not load car profiles.");
        return;
      }
    } catch {
      // keep current profiles
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  async function send(
    action: string,
    extra: Record<string, unknown>,
    successNote: string
  ): Promise<boolean> {
    setMessage(successNote);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, ...extra }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.error || "Action failed.");
        return false;
      }
      void load();
      return true;
    } catch {
      setMessage("Could not reach the server. Try again.");
      return false;
    }
  }

  function startEdit(profile: CarProfileRow) {
    setEditingKey(profile.profile_key);
    setDraftName(profile.car_name);
    setDraftJson(JSON.stringify(profile.settings ?? {}, null, 2));
  }

  async function saveEdit(profileKey: string) {
    let settings: unknown;
    try {
      settings = JSON.parse(draftJson || "{}");
    } catch {
      setMessage("Settings must be valid JSON.");
      return;
    }
    const ok = await send(
      "upsertCarProfile",
      { profileKey, carName: draftName, settings },
      `Project profile saved for ${email}.`
    );
    if (ok) setEditingKey(null);
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-navy">
        Car Profiles
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Per-car rows from car_profiles — the profile key is the board's stable identity (
        <span className="font-mono">fw:</span>, Bluetooth MAC,
        <span className="font-mono">wifi:</span>). The app reads the same rows; no Wi-Fi passwords
        are stored here.
      </p>
      {profiles === null ? (
        <p className="mt-3 text-xs text-slate-500" role="status">Loading…</p>
      ) : profiles.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No car profiles for this user yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded-lg border border-line bg-white p-3">
              {editingKey === profile.profile_key ? (
                <div>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Profile display name"
                    aria-label="Project profile name"
                    className={`w-full text-xs ${inputClass}`}
                  />
                  <textarea
                    value={draftJson}
                    onChange={(e) => setDraftJson(e.target.value)}
                    rows={6}
                    aria-label="Project profile settings JSON"
                    className={`mt-2 w-full font-mono text-xs ${inputClass}`}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void saveEdit(profile.profile_key)}
                      disabled={false}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">
                      {profile.car_name || "Untitled profile"} {" "}<span className="font-mono font-normal text-slate-400">· {profile.profile_key}</span></p>
                    <p className="truncate font-mono text-[11px] text-slate-500">
                      {Object.keys(profile.settings || {}).length} keys · updated{" "}
                      {new Date(profile.updated_at).toLocaleDateString()}
                      {profile.unique_id ? ` · id ${profile.unique_id}` : ""}
                    </p>
                  </div>
                  <span className="flex gap-2">
                    <button
                      onClick={() => startEdit(profile)}
                      disabled={!canDelete}
                      title={
                        canDelete ? "" : "Only administrators can edit project profiles"
                      }
                      className="rounded-full border border-line px-3 py-1 text-xs font-bold text-navy transition hover:border-navy disabled:opacity-50"
                    >
                      Edit
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete the ${profile.car_name || profile.profile_key} profile for ${email}?`
                            )
                          ) {
                            void send(
                              "deleteCarProfile",
                              { profileKey: profile.profile_key },
                              "Project profile deleted."
                            );
                          }
                        }}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canDelete && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-slate-500">
            Add profile by key
            <input
              value=""
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="e.g. fw:1FB608"
              aria-label="New project profile key"
              className={`mt-1 w-48 text-xs ${inputClass}`}
            />
          </label>
          <button
            onClick={() => {
              const profileKey = "";
              if (!profileKey) {
                setMessage("Enter a profile key first.");
                return;
              }
              void send(
                "upsertCarProfile",
                { profileKey, carName: profileKey, settings: {} },
                `Project profile "${profileKey}" created for ${email}.`
              );
            }}
            disabled={false}
            className="rounded-full border border-line px-4 py-2 text-xs font-bold text-navy transition hover:border-navy disabled:opacity-60"
          >
            Add profile
          </button>
        </div>
      )}
    </div>
  );
}

// ======================
// RobotProfilesSection
// ======================

function RobotProfilesSection({
  userId,
  email,
  robots,
  setMessage,
  canDelete,
}: {
  userId: string;
  email: string;
  robots: RobotRow[] | null;
  setMessage: (msg: string) => void;
  canDelete: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftJson, setDraftJson] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listRobotSettings", userId }),
      });
      if (response.ok) {
        await response.json();
      }
    } catch {
      // keep current robots
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  async function send(
    action: string,
    extra: Record<string, unknown>,
    successNote: string
  ) {
    setMessage(successNote);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, ...extra }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        void load();
      } else setMessage(body.error || "Action failed.");
    } catch {
      setMessage("Could not reach the server. Try again.");
    }
  }

  function startEdit(robot: RobotRow) {
    setEditingId(robot.robot_id);
    setDraftName(robot.robot_name);
    setDraftJson(JSON.stringify(robot.settings ?? {}, null, 2));
  }

  async function saveEdit() {
    if (!editingId) return;
    let settings: unknown;
    try {
      settings = JSON.parse(draftJson || "{}");
    } catch {
      setMessage("Settings must be valid JSON.");
      return;
    }
    await send(
      "upsertRobotSetting",
      { robotId: editingId, robotName: draftName, settings },
      `Robot settings saved for ${email}.`
    );
    setEditingId(null);
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-navy">
        Robot Profiles
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Per-robot code values, parameters, and telemetry channels — stored separately from
        orders/carts. The app reads the same rows.
      </p>
      {robots === null ? (
        <p className="mt-3 text-xs text-slate-500" role="status">Loading…</p>
      ) : robots.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No robot profiles for this user yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {robots.map((robot) => (
            <li key={robot.robot_id} className="rounded-lg border border-line bg-white p-3">
              {editingId === robot.robot_id ? (
                <div>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Robot display name"
                    aria-label="Robot display name"
                    className={`w-full text-xs ${inputClass}`}
                  />
                  <textarea
                    value={draftJson}
                    onChange={(e) => setDraftJson(e.target.value)}
                    rows={6}
                    aria-label="Settings JSON"
                    className={`mt-2 w-full font-mono text-xs ${inputClass}`}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void saveEdit()}
                      disabled={false}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">
                      {robot.robot_name || robot.robot_id} {" "}<span className="font-mono font-normal text-slate-400">· {robot.robot_id}</span></p>
                    <p className="truncate font-mono text-[11px] text-slate-500">
                      {Object.keys(robot.settings || {}).length} keys · updated{" "}
                      {new Date(robot.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="flex gap-2">
                    <button
                      onClick={() => startEdit(robot)}
                      className="rounded-full border border-line px-3 py-1 text-xs font-bold text-navy transition hover:border-navy"
                    >
                      Edit
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete the ${robot.robot_name || robot.robot_id} profile for ${email}?`
                            )
                          ) {
                            void send(
                              "deleteRobotSetting",
                              { robotId: robot.robot_id },
                              "Robot profile deleted."
                            );
                          }
                        }}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition:hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-slate-500">
          Add robot by id
          <input
            value=""
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. 2wd1m-basic"
            aria-label="New robot id"
            className={`mt-1 w-48 text-xs ${inputClass}`}
          />
        </label>
        <button
          onClick={() => {
            const robotId = "";
            if (!robotId) {
              setMessage("Enter a robot id first.");
              return;
            }
            void send(
              "upsertRobotSetting",
              { robotId, robotName: robotId, settings: {} },
              `Robot profile "${robotId}" created for ${email}.`
            );
          }}
          disabled={false}
          className="rounded-full border border-line px-4 py-2 text-xs font-bold text-navy transition:hover:border-navy disabled:opacity-60"
        >
          Add profile
        </button>
      </div>
    </div>
  );
}

// ======================
// AdminUsers - Main component with 3-section Users tab
// ======================

export default function AdminUsers({ setMessage, canDelete, currentRole }: Props) {
  const [userData, setUserData] = useState<UserPage & {
    users: (ManagedUser & { tier?: string })[];
  }>({ users: [], page: 1, hasMore: false });
  const [loaded, setLoaded] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  void setUserQuery; // used in loadUsers for filtering
  const [selectedSection, setSelectedSection] = useState("directory"); // "directory" | "car-profiles" | "robot-profiles"

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

  // Helper: extract user directory rows from ManagedUser
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

  // Since ManagedUser doesn't have car_profiles/robot_user_settings,
  // we fetch them separately or show empty states.
  // The profiles will be loaded per-user when their section is selected.

  return (
    <section
      role="tabpanel"
      id="panel-users"
      aria-labelledby="tab-users"
      aria-label="User management"
      className="mt-4 space-y-4"
    >
      {/* Top section: 3 tab buttons */}
      <div className="flex border-b border-line pb-3 mb-4">
        <button
          onClick={() => setSelectedSection("directory")}
          className={selectedSection === "directory"
            ? "border-b-2 border-navy text-navy py-1"
            : "border-b-0 py-1"}
        >
          User Directory
        </button>
        <button
          onClick={() => setSelectedSection("car-profiles")}
          className={selectedSection === "car-profiles"
            ? "border-b-2 border-navy text-navy py-1"
            : "border-b-0 py-1"}
        >
          Car Profiles
        </button>
        <button
          onClick={() => setSelectedSection("robot-profiles")}
          className={selectedSection === "robot-profiles"
            ? "border-b-2 border-navy text-navy py-1"
            : "border-b-0 py-1"}
        >
          Robot Profiles
        </button>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500" role="status">Loading…</p>
      ) : userData.users.length === 0 ? (
        <p className="text-sm text-slate-500">No users found.</p>
      ) : (
        <>
          {selectedSection === "directory" && (
            <UsersDirectory
              users={userDirRows}
              canDelete={canDelete}
              isOwner={currentRole === "owner"}
              setMessage={setMessage}
            />
          )}
          {selectedSection === "car-profiles" && (
            <CarProfilesSection
              userId=""
              email=""
              profiles={[]} // Will be populated when section is activated, or show empty state
              setMessage={setMessage}
              canDelete={canDelete}
            />
          )}
          {selectedSection === "robot-profiles" && (
            <RobotProfilesSection
              userId=""
              email=""
              robots={null} // Will be populated when section is activated
              setMessage={setMessage}
              canDelete={canDelete}
            />
          )}
        </>
      )}

      <Pager
        page={userData.page}
        totalPages={userData.page + (userData.hasMore ? 1 : 0)}
        onPage={(page) => void loadUsers(page)}
      />
    </section>
  );
}