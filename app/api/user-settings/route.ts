import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/supabase/server";

// =====================================================================
// Per-user settings (GET/PUT) — the shared customization store for the
// app + website. Everything routes through Supabase only (the project's
// bridge rule): this route is a thin authenticated mirror of two pieces
// of shared truth, NOT a website-only store.
//
//   • profiles.theme_preference — the flat theme choice ('light' | 'dim',
//     owner decision 2026-09-22; legacy 'system' resolves to 'dim'). 'dim'
//     is canonical for dark; the app's 'dark' maps to it at its boundary
//     (settingsService).
//   • user_settings.settings    — a JSONB bag for arbitrary per-user
//     preferences (e.g. robot command keywords, notification quirks).
//     Both clients read/write the SAME rows, so a preference set in the
//     app shows up on the website and vice versa.
//
// RLS on user_settings restricts every row to its owner
// (user_id = auth.uid()), so the anon-key client below can never touch
// another user's settings.
// =====================================================================

const THEME_VALUES = ["light", "dim"] as const;
type ThemeValue = (typeof THEME_VALUES)[number];

function parseTheme(value: unknown): ThemeValue | null {
  return THEME_VALUES.includes(value as ThemeValue) ? (value as ThemeValue) : null;
}

// Settings must stay a flat-ish JSON object of scalars/strings/arrays —
// reject non-objects and absurd sizes so one bad client can't bloat rows.
function sanitizeSettings(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) continue;
    if (raw == null || ["string", "number", "boolean"].includes(typeof raw)) {
      out[key] = raw;
    } else if (
      Array.isArray(raw) &&
      raw.length <= 100 &&
      raw.every((item) => ["string", "number", "boolean"].includes(typeof item))
    ) {
      out[key] = raw;
    }
    // nested objects are dropped — extend deliberately if ever needed
  }
  return out;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { createClient } = await import("../../../lib/supabase/server");
  const db = createClient();
  const [profileResult, settingsResult] = await Promise.all([
    db.from("profiles").select("theme_preference").eq("id", user.id).maybeSingle(),
    db.from("user_settings").select("settings, updated_at").eq("user_id", user.id).maybeSingle(),
  ]);

  const rawTheme = profileResult.data?.theme_preference;
  const theme: ThemeValue = rawTheme === "system" ? "dim" : (parseTheme(rawTheme) ?? "light");
  return NextResponse.json({
    theme,
    settings: settingsResult.data?.settings ?? {},
    updatedAt: settingsResult.data?.updated_at ?? null,
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to save your settings." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { createClient } = await import("../../../lib/supabase/server");
  const db = createClient();

  let themeTouched = false;
  const theme = parseTheme(body.theme);
  if (theme) {
    const { error } = await db
      .from("profiles")
      .update({ theme_preference: theme })
      .eq("id", user.id);
    if (error)
      return NextResponse.json({ error: "Could not save the theme preference." }, { status: 500 });
    themeTouched = true;
  }

  let settingsTouched = false;
  if ("settings" in body) {
    const settings = sanitizeSettings(body.settings);
    if (!settings)
      return NextResponse.json(
        { error: "settings must be an object of simple values." },
        { status: 400 }
      );
    const { error } = await db
      .from("user_settings")
      .upsert(
        { user_id: user.id, settings, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error)
      return NextResponse.json({ error: "Could not save your settings." }, { status: 500 });
    settingsTouched = true;
  }

  if (!themeTouched && !settingsTouched) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
