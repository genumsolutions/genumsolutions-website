import { NextResponse } from "next/server";
import { createClient, getSessionUser, supabaseConfigured } from "../../../../lib/supabase/server";
import { isValidAdminRole } from "../../../../lib/roles";

// Lightweight session probe for the header pill: identity + role only,
// no carts or messages, so every page load stays cheap.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ user: null });
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null });
    let name = user.email.split("@")[0];
    let role = "customer";
    try {
      const { data: profile } = await createClient()
        .from("profiles")
        .select("name, role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.name) name = profile.name;
      // U-24 (2026-09-24): the owner and staff roles are admin-capable too —
      // the old `=== "admin"` check collapsed the owner account to "customer",
      // which hid the Admin dashboard link. Server RBAC still re-verifies
      // every action, so returning the true role only widens the header gate.
      if (profile && isValidAdminRole(profile.role)) role = profile.role;
    } catch {
      // Profile lookup is best-effort; defaults above are fine.
    }
    return NextResponse.json({ user: { name, email: user.email, role } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
