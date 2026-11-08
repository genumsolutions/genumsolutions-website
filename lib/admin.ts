import { createClient, supabaseConfigured } from "./supabase/server";
import { isAdminRole, isOwnerEmail, isOwnerRole, isStaffRole, isValidAdminRole } from "./roles";
import type { AdminRole } from "./roles";

// Admin is any signed-in user whose profile row has role in ('staff','admin','owner'),
// plus the owner email which is owner by definition (see OWNER_EMAIL).
export async function getCurrentAdmin(): Promise<{ id: string; email: string } | null> {
  if (!supabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    if (isOwnerEmail(data.user.email)) {
      return { id: data.user.id, email: data.user.email ?? "" };
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!isValidAdminRole(profile?.role)) return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  } catch {
    return null;
  }
}

// Admin gate is admin+owner only; staff must not pass here (they get
// isStaffRequest instead). Reads and day-to-day editing are staff+, but role
// assignment and every destructive delete require admin.
export async function isAdminRequest(): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    return isAdminRole(await currentProfileRole());
  } catch {
    return false;
  }
}

export async function isStaffRequest(): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    return isStaffRole(await currentProfileRole());
  } catch {
    return false;
  }
}

export async function isOwnerRequest(): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    return isOwnerRole(await currentProfileRole());
  } catch {
    return false;
  }
}

// Raw role string for the signed-in admin ('staff' | 'admin' | 'owner'), used
// by the server page to hand UI gating to the client admin shell.
export async function getCurrentUserRole(): Promise<AdminRole | null> {
  if (!supabaseConfigured()) return null;
  try {
    const role = await currentProfileRole();
    return isValidAdminRole(role) ? role : null;
  } catch {
    return null;
  }
}

// Reads the signed-in user's effective role ('' when no user / no row).
// The owner email counts as 'owner' even without a profiles row.
async function currentProfileRole(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "";
  if (isOwnerEmail(data.user.email)) return "owner";
  if (!supabaseConfigured()) return "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile) return String(profile.role ?? "");
  return "";
}
