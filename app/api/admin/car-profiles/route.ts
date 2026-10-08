import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { isAdminRequest } from "../../../../lib/admin";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const profileKey = searchParams.get("profileKey");
    const userId = searchParams.get("userId");

    if (!profileKey && !userId) {
      return NextResponse.json({ error: "profileKey or userId is required" }, { status: 400 });
    }

    const db = createServiceClient();

    if (profileKey) {
      const { data: profile, error } = await db
        .from("car_profiles")
        .select("*")
        .eq("profile_key", profileKey)
        .single();

      if (error || !profile) {
        return NextResponse.json({ error: "Car profile not found" }, { status: 404 });
      }
      return NextResponse.json({ profiles: [profile] });
    } else if (userId) {
      const { data: profiles, error } = await db
        .from("car_profiles")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to fetch car profiles:", error);
        return NextResponse.json({ error: "Failed to load car profiles" }, { status: 500 });
      }
      return NextResponse.json({ profiles: profiles || [] });
    }
  } catch (error) {
    console.error("Fetch car profiles failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const profileKey = searchParams.get("profileKey");
    const ssid = searchParams.get("ssid");

    if (!profileKey || !ssid) {
      return NextResponse.json({ error: "profileKey and ssid are required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Fetch the car profile
    const { data: profile, error: fetchError } = await db
      .from("car_profiles")
      .select("settings")
      .eq("profile_key", profileKey)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: "Car profile not found" }, { status: 404 });
    }

    const settings = profile.settings as Record<string, unknown> | null;
    const savedRouters = (settings?.saved_routers as string[] | undefined) ?? [];

    const filtered = savedRouters.filter((r) => r !== ssid);

    if (filtered.length === savedRouters.length) {
      return NextResponse.json({ error: "Router not found in saved list" }, { status: 404 });
    }

    const { error: updateError } = await db
      .from("car_profiles")
      .update({ settings: { ...settings, saved_routers: filtered } })
      .eq("profile_key", profileKey);

    if (updateError) {
      console.error("Failed to update car profile:", updateError);
      return NextResponse.json({ error: "Failed to delete router from profile" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: ssid });
  } catch (error) {
    console.error("Delete saved router failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
