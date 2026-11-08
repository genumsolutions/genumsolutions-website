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
    const [entries, types] = await Promise.all([
      listUserProfileEntries({ page, limit }),
      listProfileEntryTypes(),
    ]);
    return NextResponse.json({ entries, types, page, hasMore: entries.entries.length === limit });
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
