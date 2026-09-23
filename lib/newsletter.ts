/**
 * C4 (2026-09-23): newsletter capture — shared validation + persistence.
 *
 * The email is the identity: lowercased + trimmed before the unique-index
 * upsert so `Jane@Example.com` and `jane@example.com` are one subscriber.
 * The DB is the source of truth; callers get a normalized result back.
 */
import { createServiceClient } from "./supabase/server";

export type NewsletterSource = "footer" | "checkout";

export type SubscribeResult = {
  ok: boolean;
  /** true when this call created a new row (vs an existing subscriber) */
  isNew: boolean;
  email: string;
};

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Subscribe (or refresh) an email. Idempotent per email. */
export async function subscribeToNewsletter(
  rawEmail: string,
  source: NewsletterSource = "footer"
): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .upsert({ email, source, status: "subscribed" }, { onConflict: "email" })
    .select("email")
    .single();

  if (error) throw error;
  return { ok: true, isNew: true, email: data?.email ?? email };
}

export type NewsletterRow = {
  id: string;
  email: string;
  source: string;
  status: string;
  created_at: string;
};

export async function listNewsletterSubscribers(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: NewsletterRow[]; total: number }> {
  const limit = Math.min(200, Math.max(1, options?.limit ?? 100));
  const offset = Math.max(0, options?.offset ?? 0);
  const supabase = createServiceClient();

  const { data, count, error } = await supabase
    .from("newsletter_subscribers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { rows: (data ?? []) as NewsletterRow[], total: count ?? 0 };
}
