import { NextResponse } from "next/server";
import { isStaffRequest } from "../../../../lib/admin";
import { getSiteContent, saveSiteContent } from "../../../../lib/content-store";
import { logActivity } from "../../../../lib/activity";
import { revalidateHomeContent } from "../../../../lib/revalidate";

export async function GET() {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getSiteContent());
}

export async function PUT(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.homeTitle || !body?.homeBody)
    return NextResponse.json({ error: "Homepage title and body are required." }, { status: 400 });
  await saveSiteContent({ homeTitle: String(body.homeTitle), homeBody: String(body.homeBody) });
  await logActivity({ action: "content.saved", entityType: "site_content", entityId: "home" });
  revalidateHomeContent();
  return NextResponse.json({ ok: true });
}
