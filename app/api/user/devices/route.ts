// GET/PATCH/DELETE — the signed-in user's own devices (the garage).
//
// Self-service only: the userId is taken from the SESSION, never from the
// query string. There is deliberately no admin override here. Reading another
// account's devices is an admin concern and belongs in the admin surface, not
// behind a userId parameter on a self-service route.
//
//   GET    → every unit the user owns, with THEIR name for it
//   PATCH  → rename one unit ({ deviceId, displayName })
//   DELETE → forget one unit ({ deviceId })
//
// RLS: user_devices is scoped by auth.uid() on its own policies, so using the
// RLS-scoped client is the enforcement mechanism, not an optimisation. The
// service role is never used here: it would bypass exactly the policy that
// keeps one user's garage private.
//
// Note on what this route does NOT do: it never writes car settings and never
// attempts live control. Driving a car stays in the app and (once built) the
// outbound relay, because LAN transports are unreachable from this server.

import { NextResponse } from "next/server";
import { createClient, getSessionUser } from "../../../../lib/supabase/server";
import { getModePlannedFlags, getUserDevices, pairingLabel } from "../../../../lib/device-registry";
import { logActivity } from "../../../../lib/activity";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 60;

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [devices, plannedFlags] = await Promise.all([
    getUserDevices(session.id),
    getModePlannedFlags(),
  ]);

  return NextResponse.json({
    devices: devices.map((d) => ({
      ...d,
      // The pairing name matters: the OS lists "4WD CAR", not "4WD 4-Motor Car".
      pairingName: pairingLabel(d.model),
    })),
    // Shipped alongside so the panel can be honest about unbuilt modes without
    // a second round trip.
    plannedModes: plannedFlags.filter((f) => f.isPlanned),
  });
}

export async function PATCH(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { deviceId, displayName } = (body ?? {}) as {
    deviceId?: unknown;
    displayName?: unknown;
  };

  if (typeof deviceId !== "string" || !UUID_RE.test(deviceId))
    return NextResponse.json({ error: "A valid deviceId is required." }, { status: 400 });
  if (typeof displayName !== "string")
    return NextResponse.json({ error: "displayName must be text." }, { status: 400 });

  const clean = displayName.trim().slice(0, MAX_NAME);
  // An empty name is allowed and means "fall back to the model name", but a
  // name that is only whitespace must not be stored as such.
  if (displayName.trim().length === 0 && displayName.length > 0)
    return NextResponse.json({ error: "Name cannot be only spaces." }, { status: 400 });

  const supabase = createClient();
  // RLS rejects the row if this device is not the caller's, which is the point.
  const { data, error } = await supabase
    .from("user_devices")
    .upsert(
      { user_id: session.id, device_id: deviceId, display_name: clean },
      { onConflict: "user_id,device_id" }
    )
    .select("device_id, display_name")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Could not save that name." }, { status: 500 });

  await logActivity({
    userId: session.id,
    action: "device.renamed",
    entityType: "device",
    entityId: deviceId,
    details: { displayName: clean },
  });
  return NextResponse.json({ device: data ?? { device_id: deviceId, display_name: clean } });
}

export async function DELETE(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const deviceId = params.get("deviceId") ?? "";
  if (!UUID_RE.test(deviceId))
    return NextResponse.json({ error: "A valid deviceId is required." }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase
    .from("user_devices")
    .delete()
    .eq("user_id", session.id)
    .eq("device_id", deviceId);

  if (error) return NextResponse.json({ error: "Could not remove that device." }, { status: 500 });

  await logActivity({
    userId: session.id,
    action: "device.removed",
    entityType: "device",
    entityId: deviceId,
  });
  return NextResponse.json({ ok: true });
}
