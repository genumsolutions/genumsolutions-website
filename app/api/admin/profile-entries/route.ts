import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/admin";
import {
  deleteUserProfileEntry,
  listProfileEntryTypes,
  listUserProfileEntries,
} from "../../../../lib/user-logs";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const [result, types] = await Promise.all([
      listUserProfileEntries({ page, limit }),
      listProfileEntryTypes(),
    ]);
    // Flat page shape, same as every other admin list route
    // (/api/admin/user-logs, /api/admin/logs). This used to nest the page
    // object under `entries`, so the panel's `data.entries.map(...)` threw
    // and the tab rendered an error instead of a list.
    return NextResponse.json({
      entries: result.entries,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      types,
    });
  } catch (error) {
    console.error("Profile entries list failed", error);
    return NextResponse.json({ error: "Could not load profile entries." }, { status: 500 });
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
      return NextResponse.json({ error: "An entry id is required." }, { status: 400 });
    }
    const deleted = await deleteUserProfileEntry(id);
    if (!deleted) {
      return NextResponse.json({ error: "Could not delete the profile entry." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Profile entries delete failed", error);
    return NextResponse.json({ error: "Could not delete the profile entry." }, { status: 500 });
  }
}
