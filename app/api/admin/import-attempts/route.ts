import { NextResponse } from "next/server";
import { isStaffRequest } from "../../../../lib/admin";
import { listImportAttempts, SUPPORTED_PROVIDERS } from "../../../../lib/link-import-attempts";

/**
 * U-35 (2026-09-25): staff read of the link-import attempt log.
 *
 * Powers the "Sources staff are trying" strip in the admin Catalog tab, so the
 * owner can see which hosts get pasted that we do not yet support, and add the
 * next provider to the edge function registry on evidence.
 */
export async function GET(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 25;
    const { attempts, demand } = await listImportAttempts({ limit });
    return NextResponse.json({ attempts, demand, supported: SUPPORTED_PROVIDERS });
  } catch (error) {
    console.error("Import attempts read failed", error);
    return NextResponse.json({ error: "Could not load import attempts." }, { status: 500 });
  }
}
