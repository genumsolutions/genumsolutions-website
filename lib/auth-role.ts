import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isOwnerEmail, isValidAdminRole } from "./roles";

// Shared by every route that ends in a session (password login, emailed code,
// OAuth callback) so all three answer the same role and the UI routes admins to
// /admin and customers to /account. Server RBAC never trusts this value.
export async function resolveSignInRole(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">
): Promise<string> {
  if (isOwnerEmail(user.email)) return "owner";
  try {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    // U-24: staff/admin/owner are all admin-capable.
    if (data && isValidAdminRole(data.role)) return data.role;
  } catch {
    // Profile lookup is best-effort; default to customer.
  }
  return "customer";
}
