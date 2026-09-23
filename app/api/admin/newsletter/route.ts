import { NextResponse } from "next/server";
import { isAdminRequest, isStaffRequest } from "../../../../lib/admin";
import { listNewsletterSubscribers } from "../../../../lib/newsletter";

// C4 (2026-09-23): admin list + removal for the newsletter opt-ins.
// GET is staff+ (like the messages panel); DELETE is admin+ (deletion rule).
export async function GET(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

    const { rows, total } = await listNewsletterSubscribers({
      limit,
      offset: (page - 1) * limit,
    });
    return NextResponse.json({
      subscribers: rows,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("Admin newsletter list failed", error);
    return NextResponse.json({ error: "Could not load subscribers." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const { createServiceClient } = await import("../../../../lib/supabase/server");
    const { error } = await createServiceClient()
      .from("newsletter_subscribers")
      .delete()
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Could not remove subscriber." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin newsletter delete failed", error);
    return NextResponse.json({ error: "Could not remove subscriber." }, { status: 500 });
  }
}
