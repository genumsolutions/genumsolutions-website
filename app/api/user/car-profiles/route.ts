import { NextResponse } from "next/server";
import { createClient, createServiceClient, getSessionUser } from "../../../../lib/supabase/server";
import { logActivity } from "../../../../lib/activity";
import { isStaffRole } from "../../../../lib/roles";

// Car profiles — the per-user, per-car profile rows the mobile app mirrors
// (`car_profiles` table; see mobile/src/services/carProfileService.ts and
// supabase/schema.sql). The website is a READ/ORGANIZE surface: it lets the
// signed-in user see every car profile their account holds and rename /
// delete rows, so a profile created on a phone can be managed from the web
// too. Drive control stays in the app; the website never writes settings.
//
//   GET  ?userId=<uuid>   → every (profile_key, car_name, settings…) row for
//                           a user (self-service; admin may read any user —
//                           the admin panel keeps each user fully tracked)
//   PATCH { userId, profileKey, carName } → rename one profile row
//   DELETE ?userId=&profileKey= → remove one profile row (owner or admin)
//
// profile_key is the car's STABLE identity: `fw:<boardId>` | BT MAC |
// `wifi:<identity>`. Rows hold NO secrets — Wi-Fi passwords never leave the
// phone/car; history and router lists are names only.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveViewer() {
  const session = await getSessionUser();
  if (!session) return null;
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tier")
    .eq("id", session.id)
    .maybeSingle();
  return { session, isAdmin: isStaffRole(profile?.role) };
}

export async function GET(request: Request) {
  const viewer = await resolveViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const userId = params.get("userId") || viewer.session.id;
  if (!UUID_RE.test(userId))
    return NextResponse.json({ error: "A valid userId is required." }, { status: 400 });
  if (userId !== viewer.session.id && !viewer.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = viewer.isAdmin ? createServiceClient() : createClient();
  const { data, error } = await supabase
    .from("car_profiles")
    .select("profile_key, car_name, unique_id, settings, wifi_history, updated_at")
    .eq("user_id", userId)
    .order("car_name", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load car profiles." }, { status: 500 });
  return NextResponse.json({ profiles: data || [] });
}

export async function PATCH(request: Request) {
  const viewer = await resolveViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const userId = String(body?.userId || viewer.session.id);
  const profileKey = String(body?.profileKey || "").trim();
  const carName = String(body?.carName || "").slice(0, 120);
  if (!UUID_RE.test(userId))
    return NextResponse.json({ error: "A valid userId is required." }, { status: 400 });
  if (!profileKey || profileKey.length > 120) {
    return NextResponse.json({ error: "A valid profileKey is required." }, { status: 400 });
  }
  if (!carName.trim()) {
    return NextResponse.json({ error: "carName cannot be empty." }, { status: 400 });
  }
  if (userId !== viewer.session.id && !viewer.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase =
    viewer.isAdmin && userId !== viewer.session.id ? createServiceClient() : createClient();
  const { error } = await supabase
    .from("car_profiles")
    .update({ car_name: carName, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("profile_key", profileKey);
  if (error)
    return NextResponse.json({ error: "Could not rename the car profile." }, { status: 500 });
  await logActivity({
    action: "user.car_profile_renamed",
    entityType: "user",
    entityId: userId,
    details: { profileKey },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const viewer = await resolveViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const userId = params.get("userId") || viewer.session.id;
  const profileKey = (params.get("profileKey") || "").trim();
  if (!UUID_RE.test(userId) || !profileKey || profileKey.length > 120) {
    return NextResponse.json(
      { error: "A valid userId and profileKey are required." },
      { status: 400 }
    );
  }
  if (userId !== viewer.session.id && !viewer.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase =
    viewer.isAdmin && userId !== viewer.session.id ? createServiceClient() : createClient();
  const { error } = await supabase
    .from("car_profiles")
    .delete()
    .eq("user_id", userId)
    .eq("profile_key", profileKey);
  if (error)
    return NextResponse.json({ error: "Could not delete the car profile." }, { status: 500 });
  await logActivity({
    action: "user.car_profile_deleted",
    entityType: "user",
    entityId: userId,
    details: { profileKey },
  });
  return NextResponse.json({ ok: true });
}
