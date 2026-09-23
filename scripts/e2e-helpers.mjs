// =====================================================================
// e2e-helpers.mjs — shared helpers for the production E2E harnesses.
//
// purgeTestUsers(service): pre-flight self-heal that removes ANY leftover
// `@genumtest.invalid` fixture users from an earlier aborted run, so the
// DB never accumulates test residue even when a run dies mid-way (the
// cleanup block in `finally` never gets a chance to run). Safe: only
// `.invalid` emails match; real accounts are never touched. Also sweeps
// any P3 smoke-probe orders still attributed to those users.
//
// Called at the top of each harness BEFORE its own fixtures are created.
// =====================================================================
import { createClient } from "@supabase/supabase-js";

export function serviceFromEnv(env) {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function purgeTestUsers(service) {
  if (!service) return { users: 0, orders: 0 };
  let removed = 0;
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { users: 0, orders: 0 }; // best-effort; never crash a harness on purge
  const stale = (data?.users ?? []).filter((u) =>
    u.email?.toLowerCase().endsWith("@genumtest.invalid")
  );
  for (const u of stale) {
    try {
      await service.from("orders").delete().eq("user_id", u.id);
      await service.auth.admin.deleteUser(u.id);
      removed++;
    } catch {
      // best-effort
    }
  }
  if (removed) console.log(`self-heal: purged ${removed} stale @genumtest.invalid user(s)`);
  return { users: removed, orders: 0 };
}
