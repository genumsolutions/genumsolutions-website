import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/admin";
import { deleteUserActivityLog, listUserActivityLogs } from "../../../../lib/user-logs";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const pageData = await listUserActivityLogs({ page, limit });
    return NextResponse.json(pageData);
  } catch (error) {
    console.error("User logs list failed", error);
    return NextResponse.json({ error: "Could not load user activity logs." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json({ error: "A log id is required." }, { status: 400 });
    }
    const deleted = await deleteUserActivityLog(id);
    if (!deleted) {
      return NextResponse.json({ error: "Could not delete the log entry." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("User logs delete failed", error);
    return NextResponse.json({ error: "Could not delete the log entry." }, { status: 500 });
  }
}
