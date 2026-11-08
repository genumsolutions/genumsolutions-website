import { createServiceClient } from "./supabase/server";

// =====================================================================
// user-logs.ts — service-role reads/deletes for the new user-centric
// audit + profile-entry tables (user_activity_log, user_profile_entries,
// profile_entry_types). Only reached from admin-only API routes; never
// imported into a client component.
// =====================================================================

export type UserActivityLogEntry = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type ProfileEntryType = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};

export type UserProfileEntry = {
  id: string;
  user_id: string;
  type_id: string;
  title: string;
  body: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserLogsPage = {
  entries: UserActivityLogEntry[];
  total: number;
  page: number;
  totalPages: number;
};

export type ProfileEntriesPage = {
  entries: (UserProfileEntry & { typeName: string })[];
  total: number;
  page: number;
  totalPages: number;
};

type PageOptions = { page?: number; limit?: number };

function normalizePage(options: PageOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  return { page, limit };
}

export async function listUserActivityLogs(options: PageOptions = {}): Promise<UserLogsPage> {
  const { page, limit } = normalizePage(options);
  const supabase = createServiceClient();
  const { data, count } = await supabase
    .from("user_activity_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  const entries = (data as UserActivityLogEntry[] | null) ?? [];
  const total = count ?? 0;
  return { entries, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function deleteUserActivityLog(id: string): Promise<boolean> {
  const { error } = await createServiceClient().from("user_activity_log").delete().eq("id", id);
  return !error;
}

export async function listProfileEntryTypes(): Promise<ProfileEntryType[]> {
  const { data } = await createServiceClient()
    .from("profile_entry_types")
    .select("*")
    .order("name", { ascending: true });
  return (data as ProfileEntryType[] | null) ?? [];
}

export async function listUserProfileEntries(
  options: PageOptions = {}
): Promise<ProfileEntriesPage> {
  const { page, limit } = normalizePage(options);
  const supabase = createServiceClient();
  const { data, count } = await supabase
    .from("user_profile_entries")
    .select(
      `
      *,
      profile_entry_types (
        name
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  const rows = data as
    ((UserProfileEntry & { profile_entry_types?: { name: string } | null }) | null)[] | null;
  const entries = normalizeProfileEntries(rows);
  const total = count ?? 0;
  return { entries, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function deleteUserProfileEntry(id: string): Promise<boolean> {
  const { error } = await createServiceClient().from("user_profile_entries").delete().eq("id", id);
  return !error;
}

function normalizeProfileEntries(
  rows: ((UserProfileEntry & { profile_entry_types?: { name: string } | null }) | null)[] | null
): (UserProfileEntry & { typeName: string })[] {
  if (!rows) return [];
  const out: (UserProfileEntry & { typeName: string })[] = [];
  for (const r of rows) {
    if (!r) continue;
    out.push({
      id: r.id,
      user_id: r.user_id,
      type_id: r.type_id,
      title: r.title,
      body: r.body ?? {},
      created_at: r.created_at,
      updated_at: r.updated_at,
      typeName: r.profile_entry_types?.name ?? "",
    });
  }
  return out;
}
