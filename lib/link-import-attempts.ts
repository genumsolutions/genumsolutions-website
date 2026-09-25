import { createServiceClient } from "./supabase/server";

/**
 * U-35 (2026-09-25): read side for the `link_import_attempts` telemetry the
 * `link-import` edge function writes on every preview.
 *
 * Owner: "don't keep track of any new providers submitted by the users too."
 * Two shapes come out of here:
 *   - `attempts`  — the most recent pastes (recent-first)
 *   - `demand`    — the actionable roll-up: which hosts staff tried that we do
 *                   NOT support, and how often. That is the list to read before
 *                   adding the next provider to the edge function's registry.
 */

export type ImportOutcome = "extracted" | "provider-empty" | "provider-error" | "no-provider";

export interface ImportAttempt {
  id: number;
  host: string;
  provider: string | null;
  providerLabel: string | null;
  outcome: ImportOutcome;
  error: string | null;
  createdAt: string;
}

export interface ImportAttemptRow {
  id: number | string;
  host: string;
  provider: string | null;
  provider_label: string | null;
  outcome: string;
  error: string | null;
  created_at: string;
}

export interface UnsupportedDemand {
  host: string;
  attempts: number;
  lastSeen: string;
}

/** Providers currently registered in the edge function, for the admin banner. */
export const SUPPORTED_PROVIDERS = [
  { id: "makerworld", label: "MakerWorld", hosts: ["makerworld.com", "makerworld.com.cn"] },
  { id: "printables", label: "Printables", hosts: ["printables.com"] },
] as const;

function rowToAttempt(row: ImportAttemptRow): ImportAttempt {
  return {
    id: Number(row.id),
    host: row.host,
    provider: row.provider,
    providerLabel: row.provider_label,
    outcome: (row.outcome as ImportOutcome) ?? "no-provider",
    error: row.error,
    createdAt: row.created_at,
  };
}

export async function listImportAttempts(
  options: { limit?: number } = {}
): Promise<{ attempts: ImportAttempt[]; demand: UnsupportedDemand[] }> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("link_import_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("link_import_attempts read failed", error);
    return { attempts: [], demand: [] };
  }

  const rows = (data as ImportAttemptRow[] | null) ?? [];
  const attempts = rows.map(rowToAttempt);

  // Demand roll-up: hosts that resolved to NO provider (or failed) are the
  // "please support this" signals. Aggregated client-side from the same page of
  // rows so the admin needs one query, not two.
  const counts = new Map<string, { attempts: number; lastSeen: string }>();
  for (const a of attempts) {
    if (a.provider) continue;
    const prev = counts.get(a.host);
    if (prev) {
      prev.attempts += 1;
      if (a.createdAt > prev.lastSeen) prev.lastSeen = a.createdAt;
    } else {
      counts.set(a.host, { attempts: 1, lastSeen: a.createdAt });
    }
  }
  const demand: UnsupportedDemand[] = [...counts.entries()]
    .map(([host, v]) => ({ host, attempts: v.attempts, lastSeen: v.lastSeen }))
    .sort((a, b) => b.attempts - a.attempts || b.lastSeen.localeCompare(a.lastSeen));

  return { attempts, demand };
}
