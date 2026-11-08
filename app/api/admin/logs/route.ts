import { NextResponse } from "next/server";
import { isStaffRequest } from "../../../../lib/admin";
import { listAppLogs, listDeviceCrashReports } from "../../../../lib/logs";
import { listUserActivityLogs, deleteUserActivityLog } from "../../../../lib/user-logs";

export async function GET(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") || "crash";
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const data =
      kind === "app"
        ? await listAppLogs({ page, limit })
        : kind === "user"
          ? await listUserActivityLogs({ page, limit })
          : await listDeviceCrashReports({ page, limit });
    return NextResponse.json(data);
  } catch (error) {
    console.error("System logs failed", error);
    return NextResponse.json({ error: "Could not load logs." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table") || "device_crash_reports";
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "An id is required." }, { status: 400 });
    }
    let deleted = false;
    if (table === "device_crash_reports" || table === "app_logs") {
      const supabase = (await import("../../../../lib/supabase/server")).createServiceClient();
      const { error } = await supabase.from(table).delete().eq("id", id);
      deleted = !error;
    } else if (table === "user_activity_log") {
      deleted = await deleteUserActivityLog(id);
    } else {
      return NextResponse.json({ error: "Unknown table." }, { status: 400 });
    }
    if (!deleted) {
      return NextResponse.json({ error: "Could not delete the log entry." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id, table });
  } catch (error) {
    console.error("System logs delete failed", error);
    return NextResponse.json({ error: "Could not delete the log entry." }, { status: 500 });
  }
}
