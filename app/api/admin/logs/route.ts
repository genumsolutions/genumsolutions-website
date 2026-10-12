import { NextResponse } from "next/server";
import { isStaffRequest } from "../../../../lib/admin";
import { listAppLogs, listDeviceCrashReports } from "../../../../lib/logs";

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
        : await listDeviceCrashReports({ page, limit });
    return NextResponse.json(data);
  } catch (error) {
    console.error("System logs failed", error);
    return NextResponse.json({ error: "Could not load logs." }, { status: 500 });
  }
}
