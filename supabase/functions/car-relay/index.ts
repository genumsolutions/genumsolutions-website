// =====================================================================
// car-relay — U-94 Phase 1. The Internet-method relay, as a Supabase Edge
// Function.
//
//   Q1 RULING (recorded 2026-10-05, guide/PLAN-2026-10-04-U94-INTERNET-
//   METHOD-DESIGN.md §6.1) = (a) Supabase Edge Function. The owner delegated
//   the choice and took the recommendation.
//
// WHAT THIS IS: a byte pipe. It pairs one car socket and one phone socket by
// `boardIdHex`, forwards frames between them, and stores NOTHING about car
// state. All of the interesting logic (auth, pairing, limits, latency) is in
// relay-core.ts, which has no imports and is covered by tests/.
//
// WHAT THIS IS NOT, and the mistake that keeps getting made in this project:
//   it is not a second command grammar, and it does not know the car's wire
//   vocabulary. Its own control frames are `\x00relay` + JSON. Four separate
//   rounds of bugs came from an agent assuming a firmware command existed
//   (REQ_CAPS twice, the U-82 probe, two harness REPLY faults) — so the relay
//   is built so it CANNOT emit car grammar even by accident.
//
// NOT DEPLOYED. 2026-10-05: written and unit-tested only. Deployment, the
// registry migration, and RLS are owner actions (see the plan's scope note).
//
// Deployment (owner, later — NOT done here):
//   1. Apply supabase/migrations/20261005130000_relay_token_digest.sql (SQL
//      editor or `supabase db push` — `npm run db:apply` only reads schema.sql).
//   2. supabase functions deploy car-relay --no-verify-jwt
//      (--no-verify-jwt is REQUIRED: the CAR cannot present a Supabase user
//       JWT — it has no session. Car auth is boardIdHex + the NVS token,
//       and the phone's JWT is checked here as a signed-in user who CLAIMS
//       the car. Two different identities, deliberately.)
//   3. supabase secrets set RELAY_TOKEN_PEPPER=...   (see pepper() below)
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  RELAY_PROTOCOL_VERSION,
  RelayHub,
  control,
  isControl,
  parseControlEvent,
  parseEnrollment,
  parseHello,
  relayForwardsControl,
  tokenDigest,
  type PeerHandle,
  type RelayPeer,
} from "./relay-core.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
/**
 * Server-side pepper. Mixed into every digest so that reading the relay-token
 * table does not hand an attacker a verifier for tokens they can then guess
 * offline. Without it the digest is a plain fast hash of a 128-bit secret,
 * which is still fine in practice — the pepper is defence in depth, and its
 * ABSENCE is why the relay refuses to pair when it is unset rather than
 * quietly hashing without it.
 */
const pepper = Deno.env.get("RELAY_TOKEN_PEPPER") || "";

const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * The hub compares a presented token against a stored digest, so it must hash
 * with the SAME pepper the row was written with. Injecting that here is what
 * makes the two sides provably agree — an earlier draft let the hub recompute
 * the digest itself, bare, and would have refused every honest client.
 */
const hub = new RelayHub({ digest: (boardIdHex, token) => tokenDigest(boardIdHex, token, pepper) });

/**
 * Claimed units and their relay-token digests, keyed by bare board id.
 *
 * Read from `device_relay_tokens`, NOT from a column on `devices`: the
 * "owner read devices" policy hands every claimed unit's row to its owner's
 * phone, and a verifier for a token that drives a car must not ride out to a
 * client (W-14 analog; see the migration header for the full reasoning).
 */
async function loadClaimedDigests(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!serviceKey) return out;
  const { data, error } = await db
    .from("device_relay_tokens")
    .select("token_digest, devices!inner(unique_id)");
  if (error) {
    console.error("relay: token digest read failed", error.message);
    return out;
  }
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const device = row.devices as { unique_id?: string } | null;
    const digest = typeof row.token_digest === "string" ? row.token_digest : "";
    // unique_id is stored as `fw:<boardIdHex>` — see register_device() and
    // the app's resolveProfileKey. The relay keys on the bare board id.
    const match = /^fw:([0-9A-F]{12})$/.exec(device?.unique_id ?? "");
    if (match && digest) out.set(match[1]!, digest);
  }
  return out;
}

/** Refresh the claim table and hand it to the hub. Claims are rare events. */
let digestsLoaded = false;
let digestsLoadedAt = 0;
async function ensureDigests(force = false): Promise<void> {
  const now = Date.now();
  if (!force && digestsLoaded && now - digestsLoadedAt < 30_000) return;
  hub.replaceDigests(await loadClaimedDigests());
  digestsLoaded = true;
  digestsLoadedAt = now;
}

/** The token never appears in a response body, a log line or an event name. */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  // ---- enrollment: the only writer of a relay-token digest.
  //      POST { boardIdHex, token } with the caller's user JWT. The caller must
  //      already have CLAIMED that unit (Q2 ruling), and the digest is computed
  //      here because the pepper lives here and nowhere else.
  if (url.pathname.endsWith("/car-relay/enroll")) {
    return enroll(req);
  }

  // ---- health: counts and timestamps only, never car state (the hub's own
  //      promise). Authenticated even so — "which board ids are online right
  //      now" is fleet information, and this relay has no anonymous surface.
  if (url.pathname.endsWith("/car-relay/health")) {
    if (!bearerToken(req)) return json({ error: "sign in to read relay health" }, 401);
    await ensureDigests();
    return json({ ok: true, protocol: RELAY_PROTOCOL_VERSION, peers: hub.stats() });
  }

  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return json(
      {
        error: "car-relay speaks WebSocket only.",
        hint: "GET /functions/v1/car-relay with Upgrade: websocket, then send a hello frame.",
        protocol: RELAY_PROTOCOL_VERSION,
      },
      426
    );
  }

  if (!pepper) {
    // Fail closed and LOUDLY. Pairing without the pepper would still work, but
    // silently downgrading auth is how a W-14-analog secret ends up in a log.
    console.error("car-relay: RELAY_TOKEN_PEPPER is not set; refusing to pair.");
    return json({ error: "relay not configured (RELAY_TOKEN_PEPPER unset)" }, 503);
  }

  await ensureDigests();

  const { socket, response } = Deno.upgradeWebSocket(req);
  // The request's Authorization header is read here, not inside wire(): a
  // controller's identity must be captured at upgrade time, because by the
  // time the hello frame arrives we may be in a different task and must not
  // be re-reading a Request that has already been consumed.
  const jwt = bearerToken(req);
  wire(socket, jwt);
  return response;
});

/**
 * Close codes the two ends are debugged with. Distinct codes because the phone
 * and the bench each need to tell "you are not enrolled" from "someone else
 * has this car" from "that token is wrong" — a single code for all three is
 * how a wrong-password report becomes a wrong-car report.
 */
const CLOSE_UNAUTHENTICATED = 4401;
const CLOSE_FORBIDDEN = 4403;
const CLOSE_TAKEN = 4409;
const CLOSE_REFUSED = 4400;

function closeCodeFor(message: string): number {
  if (message === "token mismatch") return CLOSE_UNAUTHENTICATED;
  if (message === "unclaimed car") return CLOSE_FORBIDDEN;
  if (message.endsWith("already connected")) return CLOSE_TAKEN;
  return CLOSE_REFUSED;
}

function wire(socket: WebSocket, jwt: string | null): void {
  // The handle from join(). Held here because forward() needs it per frame and
  // there is no way to look it back up — the hub deliberately does not expose
  // "get peer by role", since that would let a caller forward into a link it
  // does not own.
  let handle: PeerHandle | null = null;
  let joined: { boardIdHex: string; role: "car" | "controller" } | null = null;

  const peer: RelayPeer = {
    send: (data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    },
    close: (code, reason) => {
      try {
        socket.close(code, reason);
      } catch {
        /* already closed */
      }
    },
  };

  socket.onopen = () => {
    socket.send(control({ ev: "hello-required", protocol: RELAY_PROTOCOL_VERSION }));
  };

  socket.onmessage = async (event) => {
    const raw = typeof event.data === "string" ? event.data : "";
    if (!raw) return;

    // ---- handshake: the FIRST frame must be the hello. Nothing else is
    //      accepted before pairing, so an unauthenticated socket cannot make
    //      the relay forward anything.
    if (!joined) {
      const parsed = parseHello(raw);
      if (!parsed.ok) {
        peer.close(CLOSE_REFUSED, parsed.error);
        return;
      }
      const hello = parsed.hello;

      // The controller must be a signed-in user who has CLAIMED this car
      // (Q2 ruling). Without this check, knowing a board id + token would be
      // enough to drive the car from anyone else's phone. The CAR has no
      // session and no JWT — its identity is board id + token, full stop.
      if (hello.role === "controller" && !(await controllerClaimsCar(jwt, hello.boardIdHex))) {
        peer.close(CLOSE_FORBIDDEN, "this account has not claimed that car");
        return;
      }

      try {
        await ensureDigests();
        // The hub owns the token/unclaimed/already-connected decision, using the
        // digests loaded above. index.ts deliberately does NOT re-implement
        // that comparison: two verifiers are two answers, and they drift.
        handle = await hub.join(hello, peer);
        joined = { boardIdHex: hello.boardIdHex, role: hello.role };
        peer.send(control({ ev: "paired", boardIdHex: hello.boardIdHex, role: hello.role }));
      } catch (error) {
        const reason = error instanceof Error ? error.message : "handshake failed";
        peer.close(closeCodeFor(reason), reason);
      }
      return;
    }

    // ---- control plane, after pairing.
    //
    // The relay ORIGINATES two frames (`hello-required`, `paired`) and forwards
    // two more (the latency pair). It does not answer a ping with its own echo:
    // doing that measures the relay and calls it the car, and the car's real
    // echo then arrives as an unknown control frame and is refused. The rule
    // lives in relay-core so it is testable on a laptop — see
    // relayForwardsControl().
    if (isControl(raw)) {
      const ev = parseControlEvent(raw);
      if (ev && relayForwardsControl(ev)) {
        if (handle) hub.forward(handle, raw);
        return;
      }
      // Anything else is refused by name rather than ignored, so a mismatched
      // client build fails loudly instead of hanging.
      peer.send(
        control({
          ev: "refused",
          boardIdHex: joined.boardIdHex,
          detail: ev ? `control frame not relayed: ${ev}` : "unreadable control frame",
        })
      );
      return;
    }

    if (handle) hub.forward(handle, raw);
  };

  socket.onclose = () => {
    if (joined) hub.leave(joined.boardIdHex, joined.role);
    joined = null;
    handle = null;
  };

  socket.onerror = () => {
    if (joined) hub.leave(joined.boardIdHex, joined.role);
    joined = null;
    handle = null;
  };
}

/**
 * Store (or rotate) a car's relay-token digest.
 *
 * Gates, in order: signed in → the relay is configured (pepper present) →
 * the body is well formed → this account has claimed that unit → upsert. A
 * caller who fails any of them learns only that.
 *
 * Rotating is allowed on purpose: re-enrolling is how a car that lost its NVS
 * (a re-flash wipes `botcfg`) comes back, and the gate is ownership of the
 * unit, which a stranger does not have. The response carries the board id and
 * nothing else — never the token, never the digest (F-68: a credential never
 * rides an echo).
 */
async function enroll(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "enroll is POST only" }, 405);
  if (!pepper) return json({ error: "relay not configured (RELAY_TOKEN_PEPPER unset)" }, 503);

  const jwt = bearerToken(req);
  if (!jwt || !serviceKey) return json({ error: "sign in first" }, 401);

  const userId = await authenticatedUserId(jwt);
  if (!userId) return json({ error: "sign in first" }, 401);

  const body = await req.text();
  const parsed = parseEnrollment(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { boardIdHex, token } = parsed;
  if (!(await controllerClaimsCar(jwt, boardIdHex))) {
    return json({ error: "register or claim that car before enrolling it" }, 403);
  }

  const { data: device, error: deviceError } = await db
    .from("devices")
    .select("id")
    .eq("unique_id", `fw:${boardIdHex}`)
    .maybeSingle();
  if (deviceError || !device?.id) {
    return json({ error: "that car is not in the device registry yet" }, 404);
  }

  const digest = await tokenDigest(boardIdHex, token, pepper);
  const { error: writeError } = await db
    .from("device_relay_tokens")
    .upsert({ device_id: device.id, token_digest: digest }, { onConflict: "device_id" });
  if (writeError) {
    console.error("relay: enrollment write failed", writeError.message);
    return json({ error: "could not store the token" }, 500);
  }
  // Anything cached about this car is now potentially stale (the token may have
  // been rotated), so the claim table is re-read before the next handshake.
  await ensureDigests(true);
  return json({ ok: true, boardIdHex });
}

/** The caller's user id, verified rather than decoded. Null on ANY error. */
async function authenticatedUserId(jwt: string): Promise<string | null> {
  try {
    const { data, error } = await db.auth.getUser(jwt);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * Is this request's JWT a signed-in user who has claimed `boardIdHex`?
 *
 * The JWT is verified by Supabase's gateway, so `auth.getUser(jwt)` here is a
 * fresh check rather than a decode. Returns false on ANY error — a check that
 * fails open is not a check.
 */
async function controllerClaimsCar(jwt: string | null, boardIdHex: string): Promise<boolean> {
  if (!jwt || !serviceKey) return false;
  const userId = await authenticatedUserId(jwt);
  if (!userId) return false;
  try {
    const { data: rows, error: claimError } = await db
      .from("user_devices")
      .select("device_id, devices!inner(unique_id)")
      .eq("user_id", userId);
    if (claimError) return false;
    return (rows ?? []).some((row: Record<string, unknown>) => {
      const device = row.devices as { unique_id?: string } | null;
      return device?.unique_id === `fw:${boardIdHex}`;
    });
  } catch {
    return false;
  }
}

/** Extract the bearer token from the request's headers. */
function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.headers.get("x-relay-jwt");
}
