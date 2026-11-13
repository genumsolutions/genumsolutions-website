import { NextResponse } from "next/server";
import { sendEmail } from "../../../../lib/email";
import { insertPrintQuote } from "../../../../lib/print-store";
import {
  MAX_QUOTE_FILES,
  MAX_QUOTE_FILE_BYTES,
  quoteFileExtension,
  quoteStorageName,
  validateQuoteDraft,
} from "../../../../lib/print-quote";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";
import {
  createServiceClient,
  getSessionUser,
  supabaseConfigured,
} from "../../../../lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "print-quote-files";

function formatMb(bytes: number) {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export async function POST(request: Request) {
  const limit = checkRateLimit(`print-quote:${clientIp(request)}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many quote requests. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  // multipart/form-data (files optional) or plain JSON from the app.
  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  let files: File[] = [];
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (value instanceof File) continue;
        body[key] = value;
      }
      files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const validation = validateQuoteDraft(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const draft = validation.value;

  if (files.length > MAX_QUOTE_FILES)
    return NextResponse.json({ error: `Attach up to ${MAX_QUOTE_FILES} files.` }, { status: 400 });
  for (const file of files) {
    if (file.size > MAX_QUOTE_FILE_BYTES)
      return NextResponse.json(
        { error: `Each file must be smaller than ${formatMb(MAX_QUOTE_FILE_BYTES)}.` },
        { status: 400 }
      );
    if (!quoteFileExtension(file.name))
      return NextResponse.json(
        { error: "Attach STL, OBJ, 3MF, STEP, ZIP, PDF, JPG, PNG or WebP files." },
        { status: 400 }
      );
  }
  if (files.length > 0 && !supabaseConfigured())
    return NextResponse.json(
      { error: "File uploads are unavailable right now. Send the files to our email instead." },
      { status: 503 }
    );

  const user = await getSessionUser();
  const uploadedPaths: string[] = [];

  try {
    if (files.length > 0) {
      const db = createServiceClient();
      for (const file of files) {
        const objectName = quoteStorageName(file.name);
        const { error } = await db.storage
          .from(BUCKET)
          .upload(objectName, await file.arrayBuffer(), {
            contentType: file.type || "application/octet-stream",
            cacheControl: "private, max-age=0",
            upsert: false,
          });
        if (error) throw error;
        uploadedPaths.push(objectName);
      }
    }

    const id = await insertPrintQuote({
      userId: user?.id ?? null,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      description: draft.description,
      material: draft.material,
      quantity: draft.quantity,
      dimensions: draft.dimensions,
      timeline: draft.timeline,
      referenceUrls: draft.referenceUrls,
      fileUrls: uploadedPaths,
    });

    // Email is best-effort: the request is already persisted for the admin.
    try {
      await sendEmail({
        replyTo: draft.email,
        subject: `New 3D print quote request from ${draft.name}`,
        text: [
          `Name: ${draft.name}`,
          `Email: ${draft.email}`,
          `Phone: ${draft.phone || "—"}`,
          `Material: ${draft.material || "Not specified"}`,
          `Quantity: ${draft.quantity}`,
          `Dimensions: ${draft.dimensions || "—"}`,
          `Timeline: ${draft.timeline || "—"}`,
          `Files: ${uploadedPaths.length > 0 ? `${uploadedPaths.length} attached (admin → 3D Products → Requests)` : "none"}`,
          draft.referenceUrls.length > 0 ? `Links: ${draft.referenceUrls.join(", ")}` : "",
          "",
          "Description:",
          draft.description,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch (error) {
      console.error("Print quote email failed (request persisted)", error);
    }

    return NextResponse.json({
      ok: true,
      id,
      message: "Thanks — your request is in. We will review the files and come back with a quote.",
    });
  } catch (error) {
    console.error("Print quote failed", error);
    // Never leave orphaned customer files behind a failed insert.
    if (uploadedPaths.length > 0 && supabaseConfigured()) {
      try {
        await createServiceClient().storage.from(BUCKET).remove(uploadedPaths);
      } catch (cleanupError) {
        console.error("Print quote file cleanup failed", cleanupError);
      }
    }
    return NextResponse.json(
      {
        error:
          "We could not save your request right now. Email us the file and we will pick it up from there.",
      },
      { status: 500 }
    );
  }
}
