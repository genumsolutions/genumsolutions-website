// =====================================================================
// relay-core.ts — the U-94 Internet-method relay, as a PURE module.
//
// Split out of index.ts on purpose: this file has NO imports at all, so it
// runs unchanged in Deno (the Edge Function) and in Node (the vitest suite).
// The whole point is that the relay's pairing/auth/forwarding rules are
// testable on a laptop with no Supabase project, no WSS server and no car.
//
// SCOPE — read before "improving" this (guide/PLAN-2026-10-04-U94-INTERNET-
// METHOD-DESIGN.md §4):
//   The relay is a dumb pipe. It pairs two sockets by car id, forwards bytes,
//   and stores NOTHING. It does not parse the car's wire grammar, does not
//   interpret STATE/CAPS, does not keep history, does not queue for retry.
//   Every one of those would be a second source of truth for car state, which
//   is exactly the failure this whole method is designed to avoid.
//
// THE ONE RULE THIS FILE EXISTS TO PROTECT (FIN-23/24 grammar lock):
//   The relay has its OWN control plane, and it is deliberately NOT the car's
//   wire grammar. Control frames are `\x00relay` + JSON. The relay never
//   invents a car token. There have been four separate rounds of bugs in this
//   project caused by assuming a command exists that the firmware does not
//   implement (REQ_CAPS, the U-82 probe, two harness REPLY faults), so the
//   relay's answer is structural: it cannot emit car grammar at all, because
//   car grammar is not something it knows.
// =====================================================================

/** Roles. The car dials out and so does the phone — neither listens. */
export type RelayRole = "car" | "controller";

export const RELAY_PROTOCOL_VERSION = 1 as const;

/** Control-plane prefix. A NUL byte cannot start a car line, so a car frame
 *  and a control frame can never be confused — including by the relay. */
export const RELAY_CONTROL_PREFIX = "\x00relay";

/** Hard caps. A runaway socket must not be able to exhaust the isolate. */
export const LIMITS = {
  /** car -> controller. The car's own builders are the contract: STATE into a
   *  448-byte buffer (`ModeManager.cpp:485`), NETW into 200, SCAN into 320. A
   *  single 128-byte cap in BOTH directions was wrong in a way only the car side
   *  could reveal: an honest STATE line with a router name, an IP, a board id and
   *  a `REPLY=` is over 128 bytes, so the relay dropped every state frame it was
   *  built to carry and the phone paired successfully into silence. Caps are
   *  therefore PER DIRECTION, from what each end can actually accept. */
  maxBytesCarToController: 448,
  /** controller -> car. `handleCommand()` copies into a 128-byte buffer, so a
   *  longer command is already truncated by the firmware; forwarding it wastes
   *  bytes and hides bugs. This is the cap that has to exist. */
  maxBytesControllerToCar: 128,
  /** Real frames are <= ~120 B (ROUTERS with 6 SSIDs is the worst case). */
  maxPendingBytes: 4096,
  /** Above this we drop the car's periodic frames rather than buffer them:
   *  a stale STATE is worth less than a fresh one (F-61 discipline — a
   *  queue that replays old state is a lie about the present). */
  maxQueuedFrames: 8,
} as const;

/** boardIdHex as the firmware prints it. Anchored, not "cleaned": a permissive
 * normaliser here would let `A1B2` and `a1b2` pair as different cars.
 *
 * SIX hex, not twelve. `WebServerComm::boardIdHex()` (WebServerComm.cpp:18)
 * prints `%06X` of `ESP.getEfuseMac() & 0xFFFFFF` — the last 6 hex, because the
 * ESP32 OUI bytes are identical across the fleet and carry no information. The
 * same 6-char string is what the car puts in `STATE;...;ID=`, what the owner
 * reads off the car's page, and what the app already persists as `fw:<id>`.
 * This regex said 12 for a long time, which meant it refused every car that
 * exists: a 6-char id can never match a 12-char pattern. Nothing caught it
 * because no car has ever spoken to a relay.
 *
 * Do not "fix" this by widening the car to a full MAC. That would invent a
 * second identifier for the same physical board and quietly break the app's
 * existing pairing. 24 bits of MAC is ~16.7M boards, and a collision still
 * cannot grant access anyway: the peppered token is required as well. */
const BOARD_ID_RE = /^[0-9A-F]{6}$/;

/** `devices.unique_id` for a v2 car is `fw:<boardIdHex>` — the app's
 *  resolveProfileKey (carProfileService.ts:39) prefixing the same 6 chars
 *  BOARD_ID_RE accepts, which the firmware prints in `STATE;...;ID=` and on
 *  its page. Same width, same refusal to normalise.
 *
 *  This is the pattern `loadClaimedDigests()` (index.ts) runs over every
 *  claimed row, and it lives HERE — one line below the hello's pattern — for
 *  one reason: it used to live in index.ts demanding **12**, where it matched
 *  nothing, so the digest map came back empty and every real car would have
 *  been refused as `unclaimed car` (U-95 Phase 5; the half of F-75 that never
 *  propagated past relay-core, because the edge-relay CI job only type-checks
 *  and two individually well-typed regexes reconcile happily). One producer's
 *  format, both consumers, one file — so the next disagreement is a failing
 *  test here, not a silently empty map there. */
export const CLAIM_UNIQUE_ID_RE = /^fw:([0-9A-F]{6})$/;

/** The bare board id inside a `devices.unique_id`, or null if it isn't one.
 *  The map key must be the BARE id: the car's hello sends that, never `fw:`. */
export function boardIdFromUniqueId(uniqueId: unknown): string | null {
  const match = typeof uniqueId === "string" ? CLAIM_UNIQUE_ID_RE.exec(uniqueId) : null;
  return match?.[1] ?? null;
}

/** Tokens are 32 hex chars (16 bytes). Fixed length so a truncated paste
 *  fails loudly instead of becoming a weak secret. */
const TOKEN_RE = /^[0-9a-f]{32}$/;

/** What the relay must know before it will pair anybody. */
export type RelayHello = {
  v: number;
  role: RelayRole;
  /** `boardIdHex` — the pairing key. Car side prints it from
   *  `WebServerComm::boardIdHex()` (WebServerComm.cpp:18 — the last 6 hex of
   *  the efuse MAC, UPPERCASE, via `%06X`); the phone reads it off the car's
   *  page. It is the same string the app already persists as `fw:<id>`. */
  boardIdHex: string;
  /** Shared secret. The car keeps it in NVS at `botcfg/relay_token`
   *  (Phase 2); the controller keeps it wherever Phase 3 decides. */
  token: string;
  /** Optional, honest-telemetry only. Never used for a security decision. */
  fwVersion?: string;
};

export type HelloParse = { ok: true; hello: RelayHello } | { ok: false; error: string };

/**
 * Parse + validate a hello frame.
 *
 * Every rejection is a NAMED reason, not a generic 401, because the two ends
 * are debugged by their owners on a phone and on a bench with no shared log.
 * "handshake refused" is the failure mode this whole design is avoiding.
 */
export function parseHello(input: string | Record<string, unknown>): HelloParse {
  let obj: Record<string, unknown>;
  if (typeof input === "string") {
    try {
      obj = JSON.parse(input) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "hello is not valid JSON" };
    }
  } else if (input && typeof input === "object") {
    obj = input;
  } else {
    return { ok: false, error: "hello must be JSON text or an object" };
  }

  if (obj.v !== RELAY_PROTOCOL_VERSION)
    return {
      ok: false,
      error: `unsupported relay protocol v${String(obj.v)} (expected ${RELAY_PROTOCOL_VERSION})`,
    };

  const role = obj.role;
  if (role !== "car" && role !== "controller")
    return { ok: false, error: "role must be car|controller" };

  const boardIdHex = obj.boardIdHex;
  if (typeof boardIdHex !== "string" || !BOARD_ID_RE.test(boardIdHex))
    return {
      ok: false,
      error: "boardIdHex must be 6 uppercase hex chars (the value the car's page prints)",
    };

  const token = obj.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token))
    return { ok: false, error: "token must be 32 lowercase hex chars" };

  const fwVersion = obj.fwVersion;
  return {
    ok: true,
    hello: {
      v: RELAY_PROTOCOL_VERSION,
      role,
      boardIdHex,
      token,
      ...(typeof fwVersion === "string" ? { fwVersion } : {}),
    },
  };
}

/**
 * Constant-time token compare.
 *
 * Length is compared up front (it is not secret — it is fixed), then every
 * byte, accumulating differences instead of returning early. An early return
 * makes the compare time a function of the matching prefix length, which is
 * the whole of the attack.
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * SHA-256, hex. Used to compare hashes rather than raw tokens so a relay
 * operator (or a log line, or a heap dump) never holds the secret itself.
 * Deno and Node both ship WebCrypto, so there is no import here.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The token as it should be hashed: version-tagged, salted by board id, and
 * optionally server-peppered.
 *
 * Board-id salting means one token used on two cars produces two unrelated
 * digests, so a digest lifted from the `devices` table cannot be replayed
 * against the other car. The pepper (absent in tests, set in production from
 * `RELAY_TOKEN_PEPPER`) means the stored digest is not itself a verifier for
 * a guessable secret.
 */
export function tokenDigestInput(boardIdHex: string, token: string, pepper = ""): string {
  const salt = `genum-relay:v${RELAY_PROTOCOL_VERSION}:${boardIdHex}`;
  return pepper ? `${pepper}:${salt}:${token}` : salt + `:${token}`;
}

/** A live socket, as much as the hub needs. Injected so tests need no network. */
export type RelayPeer = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

export type PeerHandle = {
  role: RelayRole;
  boardIdHex: string;
  /** Frames waiting for the other end. Bounded; see LIMITS. */
  queue: string[];
  queuedBytes: number;
  /** Frames the relay dropped, by reason. Surfaced in health output so a
   *  "the app just hangs up" report is diagnosable. */
  dropped: { overflow: number; oversized: number; unpaired: number };
  connectedAtMs: number;
};

export type HubEvent =
  | { type: "paired"; boardIdHex: string; role: "controller"; sinceMs: number }
  | { type: "car-online"; boardIdHex: string }
  | { type: "car-offline"; boardIdHex: string }
  | { type: "controller-online"; boardIdHex: string }
  | { type: "controller-offline"; boardIdHex: string }
  | { type: "refused"; boardIdHex: string; reason: string }
  | { type: "frame"; boardIdHex: string; from: RelayRole; bytes: number };

/**
 * One car <-> one controller pairing.
 *
 * Deliberate limits, each one a decision rather than an omission:
 *
 *  1. **One live link per car, one controller.** A second controller is
 *     REFUSED, not queued and not silently given the link. Two phones driving
 *     one car is how "it drove by itself" happens; a takeover has to be an
 *     explicit act (Phase 3 can add one, deliberately).
 *  2. **Both ends must present the same token.** Compared by hash, constant
 *     time. A phone that guesses a board id learns nothing.
 *  3. **No history, no queue-for-retry.** Frames that arrive with no peer are
 *     counted and dropped. Replaying a stale command to a car is worse than
 *     not sending it — the command may be `F`.
 *  4. **Frames are bytes here.** The hub never looks inside one, so the
 *     locked grammar cannot be extended from here (see the header).
 */
export type RelayHubOptions = {
  nowMs?: () => number;
  /**
   * How the relay turns a presented (boardIdHex, token) into the value it
   * compares against the stored digest.
   *
   * INJECTED, and this is not stylistic: production stores a PEPPERED digest,
   * so the comparison has to hash with the same pepper the storage used. A hub
   * that recomputed the digest internally with the bare `tokenDigest` would
   * refuse every honest client — which is exactly the bug this seam exists to
   * make impossible. The pepper itself never enters this file; index.ts reads
   * it from the environment and closes over it here.
   */
  digest?: (boardIdHex: string, token: string) => Promise<string>;
};

export class RelayHub {
  /** car slot + controller slot, keyed by boardIdHex. */
  private cars = new Map<string, { peer: RelayPeer; handle: PeerHandle }>();
  private controllers = new Map<string, { peer: RelayPeer; handle: PeerHandle }>();
  private expectedDigest = new Map<string, string>();
  private listeners: Array<(e: HubEvent) => void> = [];
  private nowMs: () => number;
  private digestOf: (boardIdHex: string, token: string) => Promise<string>;

  constructor(options: RelayHubOptions = {}) {
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.digestOf = options.digest ?? ((boardIdHex, token) => tokenDigest(boardIdHex, token));
  }

  onEvent(fn: (e: HubEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: HubEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  /**
   * Replace the whole expected-digest table from storage.
   *
   * The relay reads this from the claimed-device table and refreshes it when
   * that table changes, so the hub must be able to take a REPLACEMENT map, not
   * only add to it. An earlier draft of index.ts validated the token itself and
   * never told the hub, so `join()` saw an empty table and refused every peer
   * — a relay that answered "unclaimed car" to a perfectly good car. One
   * method, called once per refresh, is the whole contract.
   */
  replaceDigests(digests: ReadonlyMap<string, string>): void {
    this.expectedDigest = new Map(digests);
  }

  /**
   * Register a digest a token must hash to, given the TOKEN. Convenience for
   * tests and one-off callers; production feeds the hub digests read back from
   * storage via `replaceDigests`.
   *
   * Hashes with the SAME digest function join() compares with, so a peppered
   * hub is peppered on both sides of the equation.
   *
   * No registered digest means no pairing — an unknown car is not "trusted
   * because the network let it connect" (Q2 ruling: identity and claiming stay
   * with the website's device registry; there is no second identity path and no
   * PIN on the car's OLED).
   */
  async setExpectedToken(boardIdHex: string, token: string): Promise<void> {
    this.expectedDigest.set(boardIdHex, await this.digestOf(boardIdHex, token));
  }

  /** Register a digest computed elsewhere (e.g. read back from storage). */
  setExpectedDigest(boardIdHex: string, digest: string): void {
    this.expectedDigest.set(boardIdHex, digest);
  }

  /**
   * Add one authenticated socket. Returns the handle so the caller can pump
   * frames through `forward`. Throws on refusal — the caller closes with the
   * message, because a refused socket must NOT linger as a half-open peer.
   *
   * Async only because the token digest is SHA-256 (WebCrypto is promise-only
   * in both Deno and Node). The stored value is a real hash of the secret, not
   * a toy mix: this digest IS the thing that must not be recoverable from a
   * log line or a heap dump.
   */
  async join(hello: RelayHello, peer: RelayPeer): Promise<PeerHandle> {
    const expected = this.expectedDigest.get(hello.boardIdHex);
    if (!expected) {
      this.emit({
        type: "refused",
        boardIdHex: hello.boardIdHex,
        reason: "unclaimed car (no registry row for this board id)",
      });
      throw new Error("unclaimed car");
    }
    if (!tokensMatch(expected, await this.digestOf(hello.boardIdHex, hello.token))) {
      this.emit({
        type: "refused",
        boardIdHex: hello.boardIdHex,
        reason: "token mismatch",
      });
      throw new Error("token mismatch");
    }

    const table = hello.role === "car" ? this.cars : this.controllers;
    if (table.has(hello.boardIdHex)) {
      this.emit({
        type: "refused",
        boardIdHex: hello.boardIdHex,
        reason: hello.role === "car" ? "car already connected" : "controller already connected",
      });
      throw new Error(
        hello.role === "car" ? "car already connected" : "controller already connected"
      );
    }

    const handle: PeerHandle = {
      role: hello.role,
      boardIdHex: hello.boardIdHex,
      queue: [],
      queuedBytes: 0,
      dropped: { overflow: 0, oversized: 0, unpaired: 0 },
      connectedAtMs: this.nowMs(),
    };
    table.set(hello.boardIdHex, { peer, handle });

    this.emit(
      hello.role === "car"
        ? { type: "car-online", boardIdHex: hello.boardIdHex }
        : { type: "controller-online", boardIdHex: hello.boardIdHex }
    );
    if (hello.role === "controller" && this.cars.has(hello.boardIdHex)) {
      this.emit({
        type: "paired",
        boardIdHex: hello.boardIdHex,
        role: "controller",
        sinceMs: handle.connectedAtMs,
      });
      // Drain whatever the car said while the phone was still dialling, so the
      // phone's first paint is real state and not an empty screen.
      this.flush(handle);
    }
    return handle;
  }

  /** Remove a socket. The partner is told, on the relay's own control plane. */
  leave(boardIdHex: string, role: RelayRole, reason = "closed"): void {
    const table = role === "car" ? this.cars : this.controllers;
    const entry = table.get(boardIdHex);
    if (!entry) return;
    table.delete(boardIdHex);
    this.emit(
      role === "car"
        ? { type: "car-offline", boardIdHex }
        : { type: "controller-offline", boardIdHex }
    );
    const partner = role === "car" ? this.controllers.get(boardIdHex) : this.cars.get(boardIdHex);
    if (partner) {
      try {
        partner.peer.send(control({ ev: "link-down", boardIdHex, reason }));
      } catch {
        // A dead partner is not an error worth escalating; leave() is called
        // from the socket's own close handler in the common case.
      }
    }
  }

  /**
   * Forward one frame from `handle` to its partner, if there is one.
   *
   * Returns what happened, because the caller (index.ts) logs it and the
   * tests assert on it. A frame with no partner is DROPPED, not buffered:
   * the car re-broadcasts STATE every 1500 ms anyway, so a stale command
   * sitting in a queue would be a command arriving seconds late.
   *
   * The size cap is the DIRECTION's cap, not one number for both: see
   * LIMITS.maxBytesCarToController / maxBytesControllerToCar.
   */
  forward(
    handle: PeerHandle,
    frame: string
  ): "forwarded" | "queued" | "dropped-oversized" | "dropped-unpaired" {
    const bytes = frame.length;
    const cap =
      handle.role === "car" ? LIMITS.maxBytesCarToController : LIMITS.maxBytesControllerToCar;
    if (bytes > cap) {
      handle.dropped.oversized += 1;
      return "dropped-oversized";
    }
    this.emit({ type: "frame", boardIdHex: handle.boardIdHex, from: handle.role, bytes });

    const to = handle.role === "car" ? this.controllers : this.cars;
    const partner = to.get(handle.boardIdHex);
    if (!partner) {
      handle.dropped.unpaired += 1;
      return "dropped-unpaired";
    }

    // If the partner is behind, buffer briefly — but only up to the cap, and
    // the newest frames win (a queue replays in order, so a full queue is
    // dropped from the FRONT: the oldest state is the least true one).
    if (
      partner.handle.queue.length >= LIMITS.maxQueuedFrames ||
      partner.handle.queuedBytes + bytes > LIMITS.maxPendingBytes
    ) {
      partner.handle.dropped.overflow += 1;
      try {
        partner.peer.send(control({ ev: "lagging", boardIdHex: handle.boardIdHex }));
      } catch {
        /* ignore */
      }
    } else {
      partner.handle.queue.push(frame);
      partner.handle.queuedBytes += bytes;
      this.flush(partner.handle);
    }
    return partner.handle.queue.length > 0 ? "queued" : "forwarded";
  }

  /** Push a peer's queued frames out, oldest first. */
  private flush(handle: PeerHandle): void {
    const to = handle.role === "car" ? this.cars : this.controllers;
    const entry = to.get(handle.boardIdHex);
    if (!entry) return;
    while (handle.queue.length > 0) {
      const frame = handle.queue[0]!;
      try {
        entry.peer.send(frame);
      } catch {
        // Partner died mid-flush. Drop the rest; leave() will clean up.
        handle.queue.length = 0;
        handle.queuedBytes = 0;
        return;
      }
      handle.queue.shift();
      handle.queuedBytes -= frame.length;
    }
  }

  /** Health/latency view. No car state — counts and timestamps only. */
  stats(): Array<{
    boardIdHex: string;
    carOnline: boolean;
    controllerOnline: boolean;
    controllerSinceMs: number | null;
    carDropped: PeerHandle["dropped"] | null;
    controllerDropped: PeerHandle["dropped"] | null;
  }> {
    const ids = new Set<string>([...this.cars.keys(), ...this.controllers.keys()]);
    return [...ids].map((boardIdHex) => {
      const car = this.cars.get(boardIdHex);
      const ctl = this.controllers.get(boardIdHex);
      return {
        boardIdHex,
        carOnline: Boolean(car),
        controllerOnline: Boolean(ctl),
        controllerSinceMs: ctl ? ctl.handle.connectedAtMs : null,
        carDropped: car ? car.handle.dropped : null,
        controllerDropped: ctl ? ctl.handle.dropped : null,
      };
    });
  }
}

/** SHA-256 digest of a token. One helper for both sides (the edge function's
 *  verifier and the hub's comparison) so they can never drift apart. */
export function tokenDigest(boardIdHex: string, token: string, pepper = ""): Promise<string> {
  return sha256Hex(tokenDigestInput(boardIdHex, token, pepper));
}

/** Build a control-plane frame. The ONLY thing the relay ever originates. */
export function control(payload: Record<string, unknown>): string {
  return `${RELAY_CONTROL_PREFIX}${JSON.stringify(payload)}`;
}

/** True when a frame from the wire is a control frame (not a car line). */
export function isControl(frame: string): boolean {
  return frame.startsWith(RELAY_CONTROL_PREFIX);
}

/**
 * End-to-end latency sample: the controller stamps a frame, the car echoes
 * it back, and the controller measures. Phase 4's bench row needs this number
 * and there is nowhere else it can come from — the relay does not log bodies.
 *
 * BOTH halves live here, not in the edge function: a parse rule that only
 * exists inside index.ts is a rule nothing can test on a laptop, and a
 * mismatched pair (one half tested, the other half shipped) is how a latency
 * number gets reported as "the relay adds 400 ms" when the truth is that the
 * echo parser silently returned null.
 */
export type RelayControlPayload = {
  ev: string;
  [k: string]: unknown;
};

/** Build the one ping frame the controller sends. */
export function controlPing(boardIdHex: string, tMs: number): string {
  return control({ ev: "ping", boardIdHex, t: tMs });
}

/** Build the echo the CAR sends back for a relay ping (control plane only). */
export function controlPingEcho(boardIdHex: string, tMs: number): string {
  return control({ ev: "ping-echo", boardIdHex, t: tMs });
}

/**
 * The timestamp inside a `ping` control frame, or null if this is not one.
 *
 * `isControl` is checked first, so a car line can never reach the JSON parse —
 * the grammar lock is not "we would recognise it if we saw it", it is "we do
 * not look".
 */
export function parsePing(frame: string): number | null {
  if (!isControl(frame)) return null;
  try {
    const payload = JSON.parse(frame.slice(RELAY_CONTROL_PREFIX.length)) as RelayControlPayload;
    if (payload.ev !== "ping") return null;
    const t = payload.t;
    if (typeof t !== "number" || !Number.isFinite(t)) return null;
    return t;
  } catch {
    return null;
  }
}

/** Read a ping echo back and measure the round trip, or null if this is not one. */
export function parsePingEcho(frame: string, nowMs: number): number | null {
  if (!isControl(frame)) return null;
  try {
    const payload = JSON.parse(frame.slice(RELAY_CONTROL_PREFIX.length)) as RelayControlPayload;
    if (payload.ev !== "ping-echo") return null;
    const t = payload.t;
    if (typeof t !== "number" || !Number.isFinite(t)) return null;
    return Math.max(0, nowMs - t);
  } catch {
    return null;
  }
}

/**
 * The control event name in a frame, or null when it is not a control frame
 * with a usable payload.
 *
 * `isControl` is checked first, so a car line can never reach the JSON parse —
 * the grammar lock is not "we would recognise it if we saw it", it is "we do
 * not look".
 */
export function parseControlEvent(frame: string): string | null {
  if (!isControl(frame)) return null;
  try {
    const payload = JSON.parse(frame.slice(RELAY_CONTROL_PREFIX.length)) as RelayControlPayload;
    return typeof payload.ev === "string" && payload.ev.length > 0 ? payload.ev : null;
  } catch {
    return null;
  }
}

/**
 * Does this control event CROSS the wire, or is it the relay's to refuse?
 *
 * THE RULE, and the bug it fixes: the relay ORIGINATES nothing but
 * `hello-required` and `paired`. Everything a client sends is either a car
 * line (forwarded) or a control frame, and of those only the latency pair is
 * forwarded — `ping` from the controller to the car, `ping-echo` back. Every
 * other control event is refused BY NAME, so a mismatched client build fails
 * loudly instead of hanging.
 *
 * An earlier draft had the relay ANSWER a controller's ping with its own echo,
 * which was wrong twice over: the controller would have measured the relay's
 * own latency and reported it as the car's, and the car's real echo — the whole
 * point of Phase 4's latency row — was refused as an unknown control frame.
 * The relay is a pipe. It does not terminate a latency measurement.
 */
export function relayForwardsControl(ev: string): boolean {
  return ev === "ping" || ev === "ping-echo";
}

// =====================================================================
// ENROLLMENT — the write side of the pairing contract.
//
// The relay can only pair a car whose token digest is ALREADY stored (Q2
// ruling: the website's device registry). Nothing in the schema can compute
// that digest, because the pepper is an edge-function secret. So the relay
// function is also the only thing that can write it — which is why the body
// validation lives beside the other rules rather than in a route handler: the
// shape that gets stored and the shape that gets hashed are one shape, checked
// once.
// =====================================================================

export type EnrollmentParse =
  { ok: true; boardIdHex: string; token: string } | { ok: false; error: string };

/**
 * Validate an enrollment body. Accepts JSON text or an object.
 *
 * Rejections are NAMED, same as the hello: the caller is a phone talking to
 * the cloud, and "handshake refused" with no reason is the failure mode this
 * whole method is designed to avoid.
 */
export function parseEnrollment(input: string | Record<string, unknown>): EnrollmentParse {
  let obj: Record<string, unknown>;
  if (typeof input === "string") {
    try {
      obj = JSON.parse(input) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "enrollment body is not valid JSON" };
    }
  } else if (input && typeof input === "object") {
    obj = input;
  } else {
    return { ok: false, error: "enrollment body must be JSON text or an object" };
  }

  const boardIdHex = obj.boardIdHex;
  if (typeof boardIdHex !== "string" || !BOARD_ID_RE.test(boardIdHex)) {
    return { ok: false, error: "boardIdHex must be 6 uppercase hex chars" };
  }
  const token = obj.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return { ok: false, error: "token must be 32 lowercase hex chars" };
  }
  return { ok: true, boardIdHex, token };
}
