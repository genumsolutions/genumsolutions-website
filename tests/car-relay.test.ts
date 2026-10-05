import { describe, expect, it } from "vitest";
import {
  LIMITS,
  RELAY_CONTROL_PREFIX,
  RELAY_PROTOCOL_VERSION,
  RelayHub,
  controlPing,
  controlPingEcho,
  isControl,
  parseControlEvent,
  parseEnrollment,
  parseHello,
  parsePing,
  parsePingEcho,
  relayForwardsControl,
  sha256Hex,
  tokenDigest,
  tokenDigestInput,
  tokensMatch,
  type HubEvent,
  type RelayPeer,
} from "../supabase/functions/car-relay/relay-core";

// =====================================================================
// U-94 Phase 1 relay core. No network, no Supabase, no car — every rule the
// relay enforces is asserted here so it can be checked before deployment.
//
// What these tests are FOR: the relay is a byte pipe, so its only real
// responsibilities are (1) refuse to pair the wrong peer, (2) never emit car
// grammar, and (3) not turn into a stale-state machine. Each of those has a
// test below, including the failure modes that would be invisible in a happy
// path run.
// =====================================================================

const BOARD = "A1B2C3";
// SIX hex, exactly as the firmware prints it: `WebServerComm::boardIdHex()`
// (WebServerComm.cpp:18) is `%06X` of `ESP.getEfuseMac() & 0xFFFFFF`. This
// fixture used to be 12 chars long, to match a relay regex that used to
// demand 12 - which meant the two agreed about a car that does not exist, and
// every real car would have been refused at the hello. If you change this
// string, change BOARD_ID_RE with it, and change the car with BOTH.
// The token these tests present. Any 32 lowercase-hex characters is a valid
// fake, so this is built with repeat() instead of written as a literal: a bare
// long hex string assigned to a name containing TOKEN is precisely the shape
// CI's gitleaks generic-api-key rule hunts, and it went red on this file twice
// before anyone here had leaked anything. The scanner is right to be suspicious
// of that shape, so the fixture gives it nothing to match — no allowlist
// needed, and a real key dropped in a test later still gets caught.
const TOKEN = "a".repeat(32);

/** A socket stand-in that records what the relay sent it. */
function fakePeer(name: string) {
  const sent: string[] = [];
  let closedWith: { code?: number; reason?: string } | null = null;
  const peer: RelayPeer = {
    send: (data) => {
      sent.push(data);
    },
    close: (code, reason) => {
      closedWith = { code, reason };
    },
  };
  return {
    name,
    peer,
    sent,
    get closedWith() {
      return closedWith;
    },
    /** Non-control frames only — i.e. what actually reached the car. */
    get wireFrames() {
      return sent.filter((s) => !isControl(s));
    },
    get controls() {
      return sent.filter((s) => isControl(s));
    },
  };
}

async function hubWith(token = TOKEN, boardIdHex = BOARD): Promise<RelayHub> {
  const hub = new RelayHub();
  await hub.setExpectedToken(boardIdHex, token);
  return hub;
}

/** The production shape: a hub whose digest function is peppered. */
async function pepperedHub(pepper: string, token = TOKEN, boardIdHex = BOARD): Promise<RelayHub> {
  const hub = new RelayHub({
    digest: (id, presented) => tokenDigest(id, presented, pepper),
  });
  await hub.setExpectedToken(boardIdHex, token);
  return hub;
}

const helloCar = (over: Record<string, unknown> = {}) => ({
  v: RELAY_PROTOCOL_VERSION,
  role: "car" as const,
  boardIdHex: BOARD,
  token: TOKEN,
  ...over,
});
const helloController = (over: Record<string, unknown> = {}) => ({
  v: RELAY_PROTOCOL_VERSION,
  role: "controller" as const,
  boardIdHex: BOARD,
  token: TOKEN,
  ...over,
});

// ---------------------------------------------------------------- handshake

describe("hello validation", () => {
  it("accepts a well-formed hello from either side", () => {
    expect(parseHello(helloCar())).toMatchObject({ ok: true });
    expect(parseHello(helloController({ fwVersion: "1.0.5" }))).toMatchObject({ ok: true });
    // Text and object forms must behave identically (the car sends text).
    expect(parseHello(JSON.stringify(helloCar())).ok).toBe(true);
  });

  it("refuses a wrong protocol version by name, not with a generic error", () => {
    const result = parseHello(helloCar({ v: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("v2");
  });

  it("refuses a role that is neither car nor controller", () => {
    const result = parseHello(helloCar({ role: "owner" }));
    expect(result).toEqual({ ok: false, error: "role must be car|controller" });
  });

  it("refuses a lowercase or short board id instead of normalising it", () => {
    // The pairing key must be byte-exact: `a1b2...` and `A1B2...` are two
    // different cars as far as the firmware is concerned, and "helpfully"
    // upper-casing here would let the wrong id pair.
    for (const bad of ["a1b2c3", "A1B2C3D", "A1B2C3G", "A1B2 C3", ""]) {
      expect(parseHello(helloCar({ boardIdHex: bad })).ok).toBe(false);
    }
    // And the shape itself: 6, not 5, not 7, not 12. This is the assertion that
    // would have caught the real mismatch, and it is the one that failed when
    // the regex and the firmware disagreed.
    for (const good of ["000000", "FFFFFF", BOARD]) {
      expect(parseHello(helloCar({ boardIdHex: good })).ok).toBe(true);
    }
  });

  it("refuses a token that is not 32 lowercase hex chars", () => {
    for (const bad of ["", "short", TOKEN.toUpperCase(), `${TOKEN}00`]) {
      expect(parseHello(helloCar({ token: bad })).ok).toBe(false);
    }
  });

  it("refuses malformed JSON rather than throwing", () => {
    expect(parseHello("{not json")).toEqual({ ok: false, error: "hello is not valid JSON" });
    expect(parseHello(42 as unknown as string).ok).toBe(false);
  });
});

// ------------------------------------------------------------------- tokens

describe("token handling", () => {
  // HONEST LIMIT, verified by mutation on 2026-10-05: NO test here can catch a
  // regression of tokensMatch() to an early-returning compare. Replacing the
  // constant-time loop with `if (a[i] !== b[i]) return false` leaves this suite
  // fully green, because a timing side channel is not observable from a
  // functional test. The property rests on reading the function, so it is
  // recorded here rather than implied by a passing test. The tests below cover
  // only that the compare is CORRECT, at every character position.
  it("compares equal and unequal tokens correctly", () => {
    expect(tokensMatch(TOKEN, TOKEN)).toBe(true);
    // Single-character mutations at the start, the middle and the end — the
    // compare must be wrong for ALL of them, not just an early position.
    expect(tokensMatch(TOKEN, "f" + TOKEN.slice(1))).toBe(false);
    expect(tokensMatch(TOKEN, TOKEN.slice(0, 16) + "9" + TOKEN.slice(17))).toBe(false);
    expect(tokensMatch(TOKEN, TOKEN.slice(0, 31) + "0")).toBe(false);
    expect(tokensMatch(TOKEN, "")).toBe(false);
  });

  it("stores a digest, not the token itself", async () => {
    // tokenDigestInput is a HASH INPUT, so it necessarily contains the token —
    // that is fine, it never leaves the process. The property that matters is
    // what lands in the `devices` table: the digest.
    const digest = await tokenDigest(BOARD, TOKEN);
    expect(digest).not.toContain(TOKEN);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // ...and it is derived from board id + token, so it is reproducible by the
    // verifier without storing the secret.
    await expect(tokenDigest(BOARD, TOKEN)).resolves.toBe(digest);
  });

  it("salts by board id, so one token on two cars gives two digests", () => {
    // Otherwise a digest lifted from the devices table would replay on the
    // other car.
    const a = tokenDigestInput(BOARD, TOKEN);
    const b = tokenDigestInput("FFFFFFFFFFFF", TOKEN);
    expect(a).not.toBe(b);
  });

  it("changes the digest when the pepper changes", async () => {
    const plain = await tokenDigest(BOARD, TOKEN);
    const peppered = await tokenDigest(BOARD, TOKEN, "pepper");
    expect(plain).not.toBe(peppered);
    expect(peppered).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a real SHA-256 hex digest", async () => {
    await expect(tokenDigest(BOARD, TOKEN)).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(sha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

// ------------------------------------------------------------------ pairing

describe("pairing", () => {
  it("pairs a car and a controller that present the right token", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), phone.peer);

    expect(hub.stats()).toEqual([
      expect.objectContaining({
        boardIdHex: BOARD,
        carOnline: true,
        controllerOnline: true,
      }),
    ]);
  });

  it("refuses an UNCLAIMED board id — unknown is not trusted-because-connected", async () => {
    const hub = new RelayHub();
    await expect(hub.join(helloCar(), fakePeer("car").peer)).rejects.toThrow("unclaimed car");
  });

  it("refuses a wrong token", async () => {
    const hub = await hubWith();
    await expect(
      hub.join(helloController({ token: "f" + TOKEN.slice(1) }), fakePeer("p").peer)
    ).rejects.toThrow("token mismatch");
  });

  it("refuses a SECOND controller rather than letting it take the link", async () => {
    // Two phones driving one car is how "it drove by itself" happens.
    const hub = await hubWith();
    const car = fakePeer("car");
    await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), fakePeer("p1").peer);
    await expect(hub.join(helloController(), fakePeer("p2").peer)).rejects.toThrow(
      "controller already connected"
    );
    // ...and the live link is untouched.
    expect(hub.stats()[0]?.controllerOnline).toBe(true);
  });

  it("refuses a second connection for the same car", async () => {
    const hub = await hubWith();
    await hub.join(helloCar(), fakePeer("car1").peer);
    await expect(hub.join(helloCar(), fakePeer("car2").peer)).rejects.toThrow(
      "car already connected"
    );
  });

  it("frees the slot on leave(), so a reconnect works", async () => {
    const hub = await hubWith();
    await hub.join(helloCar(), fakePeer("car").peer);
    hub.leave(BOARD, "car");
    await expect(hub.join(helloCar(), fakePeer("car2").peer)).resolves.toBeTruthy();
  });

  it("emits named events so a field report is diagnosable", async () => {
    const hub = await hubWith();
    const events: HubEvent[] = [];
    hub.onEvent((e) => events.push(e));
    const car = fakePeer("car");
    await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), fakePeer("p").peer);
    hub.leave(BOARD, "car");
    expect(events.map((e) => e.type)).toEqual([
      "car-online",
      "controller-online",
      "paired",
      "car-offline",
    ]);
  });

  it("records a refusal reason rather than a bare failure", async () => {
    const hub = await hubWith();
    const events: HubEvent[] = [];
    hub.onEvent((e) => events.push(e));
    await expect(
      hub.join(helloController({ token: "0".repeat(32) }), fakePeer("p").peer)
    ).rejects.toThrow();
    expect(events).toContainEqual({ type: "refused", boardIdHex: BOARD, reason: "token mismatch" });
  });

  it("tells the surviving peer when the other end leaves", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), phone.peer);
    car.sent.length = 0;
    hub.leave(BOARD, "car");
    expect(phone.controls).toHaveLength(1);
    expect(JSON.parse(phone.sent[0]!.slice(RELAY_CONTROL_PREFIX.length))).toMatchObject({
      ev: "link-down",
    });
  });
});

// ------------------------------------------------- the pepper seam (index.ts)

describe("storage-fed digests", () => {
  // These four exist because of a real defect found on 2026-10-05, before the
  // relay was ever deployed: index.ts validated the presented token itself and
  // never told the hub, so RelayHub.join() saw an empty digest table and threw
  // "unclaimed car" at every peer. The relay would have answered a perfectly
  // healthy car with a refusal, and the bench would have read it as a firmware
  // fault — the same shape as the REQ_CAPS harness rows (F-70).
  it("pairs from a digest table loaded from storage (the real production path)", async () => {
    // Built the way index.ts builds it: a digest computed elsewhere and handed
    // over, with NO setExpectedToken() call anywhere.
    const stored = new Map([[BOARD, await tokenDigest(BOARD, TOKEN)]]);
    const hub = new RelayHub();
    hub.replaceDigests(stored);

    const car = fakePeer("car");
    const phone = fakePeer("phone");
    const carHandle = await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), phone.peer);

    // ...and it forwards, so this is a working link and not just a joined pair.
    expect(hub.forward(carHandle, "STATE;speed=100")).toBe("forwarded");
    expect(phone.wireFrames).toEqual(["STATE;speed=100"]);
  });

  it("refuses everything when the digest table is empty", async () => {
    const hub = new RelayHub();
    hub.replaceDigests(new Map());
    await expect(hub.join(helloCar(), fakePeer("car").peer)).rejects.toThrow("unclaimed car");
  });

  it("a refresh REPLACES the table, so a revoked token stops working", async () => {
    const hub = new RelayHub();
    hub.replaceDigests(new Map([[BOARD, await tokenDigest(BOARD, TOKEN)]]));
    await hub.join(helloCar(), fakePeer("car").peer);
    hub.leave(BOARD, "car");

    // Rotating the token writes a new digest; until the relay re-reads storage
    // the OLD one still pairs, and after the refresh only the new one does.
    hub.replaceDigests(new Map([[BOARD, await tokenDigest(BOARD, "b".repeat(32))]]));
    await expect(hub.join(helloCar(), fakePeer("car").peer)).rejects.toThrow("token mismatch");
    await hub.join(helloCar({ token: "b".repeat(32) }), fakePeer("car").peer);
    expect(hub.stats()[0]?.carOnline).toBe(true);
  });

  it("compares with the SAME pepper storage used, on both sides", async () => {
    // A hub that hashed bare while the row was written peppered would refuse
    // every honest client while every test that used setExpectedToken stayed
    // green — which is exactly what happened before the digest function was
    // injected. Both rows below are written by the INJECTED function.
    const hub = await pepperedHub("s3cret");
    const car = fakePeer("car");
    await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), fakePeer("p").peer);
    expect(hub.stats()[0]).toMatchObject({ carOnline: true, controllerOnline: true });

    // And a digest row written WITHOUT the pepper is not accepted by a
    // peppered relay: setting the pepper invalidates every previously enrolled
    // car, loudly, instead of silently pairing on stale rows.
    const peppered = new RelayHub({
      digest: (id, presented) => tokenDigest(id, presented, "s3cret"),
    });
    peppered.replaceDigests(new Map([[BOARD, await tokenDigest(BOARD, TOKEN)]]));
    await expect(peppered.join(helloCar(), fakePeer("c").peer)).rejects.toThrow("token mismatch");
  });
});

// ---------------------------------------------------------------- forwarding

describe("frame forwarding", () => {
  it("passes car frames to the controller untouched", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    const carHandle = await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), phone.peer);

    expect(hub.forward(carHandle, "STATE;speed=120;mode=4WD4M")).toBe("forwarded");
    expect(phone.wireFrames).toEqual(["STATE;speed=120;mode=4WD4M"]);
  });

  it("passes controller frames to the car untouched", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    await hub.join(helloCar(), car.peer);
    const phoneHandle = await hub.join(helloController(), phone.peer);

    expect(hub.forward(phoneHandle, "SPD180")).toBe("forwarded");
    expect(car.wireFrames).toEqual(["SPD180"]);
  });

  it("never routes a frame back to its own sender", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    const carHandle = await hub.join(helloCar(), car.peer);
    const phoneHandle = await hub.join(helloController(), phone.peer);

    hub.forward(carHandle, "STATE;speed=1");
    hub.forward(phoneHandle, "SPD180");
    expect(phone.wireFrames).toEqual(["STATE;speed=1"]);
    expect(car.wireFrames).toEqual(["SPD180"]);
  });

  it("drops a phone command longer than the car can accept, and counts it", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    await hub.join(helloCar(), car.peer);
    const phoneHandle = await hub.join(helloController(), phone.peer);

    // ModeManager copies into a 128-byte buffer, so anything past that is
    // already truncated by the firmware.
    expect(hub.forward(phoneHandle, "X".repeat(LIMITS.maxBytesControllerToCar + 1))).toBe(
      "dropped-oversized"
    );
    expect(car.wireFrames).toEqual([]);
    // Counted on the SENDER's handle: the phone's frame is the oversized one,
    // and the car is the innocent party here.
    expect(hub.stats()[0]?.controllerDropped?.oversized).toBe(1);
  });

  it("carries a STATE line far longer than a command, because the car builds 448", async () => {
    // THE REGRESSION THIS ROW EXISTS FOR. The cap used to be one number (128)
    // for both directions, justified as "handleCommand copies into 128 bytes" —
    // which is true of the phone's COMMANDS and false of the car's OUTPUT.
    // Meanwhile the car's own builders say otherwise: STATE into 448
    // (ModeManager.cpp:485), NETW into 200, SCAN into 320. So every honest
    // state frame was dropped as oversized and the phone paired into silence.
    //
    // These are the real shapes, not invented ones: a 32-char SSID, a different
    // 32-char SSID being switched to (WANT=), the AP id, the LAN IP and the
    // board id — which is what the car emits once it has joined a router.
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    const carHandle = await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), phone.peer);

    const state =
      "STATE;MODE=4WD4M;SPD=150;TRIM=0;STATUS=Stopped;SSID=TP-Link_9F2C_LivingRoom;" +
      "WANT=TP-Link_9F2C_LivingRoom_5G;AP=4WDCar_Wifi;IP=192.168.0.107;ID=A1B2C3\n";
    expect(state.length).toBeGreaterThan(128);
    expect(state.length).toBeLessThanOrEqual(LIMITS.maxBytesCarToController);
    expect(hub.forward(carHandle, state)).toBe("forwarded");
    expect(phone.wireFrames).toEqual([state]);

    // A full REPLY= (the router-registry list rides STATE, up to 191 bytes) and
    // a scan line are the two shapes most likely to cross 128 in the wild.
    const withReply = `STATE;MODE=4WD4M;SPD=0;TRIM=0;STATUS=Stopped;REPLY=ROUTERS;ADDED;${"A".repeat(150)}\n`;
    expect(withReply.length).toBeGreaterThan(128);
    expect(hub.forward(carHandle, withReply)).toBe("forwarded");
    expect(phone.wireFrames).toHaveLength(2);

    const scan = `SCAN;${"B".repeat(30)},-60,1;${"C".repeat(30)},-70,0;${"D".repeat(30)},-55,0;${"E".repeat(30)},-80,1\n`;
    expect(scan.length).toBeGreaterThan(128);
    expect(hub.forward(carHandle, scan)).toBe("forwarded");
    expect(phone.wireFrames).toHaveLength(3);

    // Still capped: the car must not be able to stream unbounded frames either.
    expect(hub.forward(carHandle, "X".repeat(LIMITS.maxBytesCarToController + 1))).toBe(
      "dropped-oversized"
    );
    expect(hub.stats()[0]?.carDropped?.oversized).toBe(1);
  });

  it("drops a frame with no peer instead of queueing it for later", async () => {
    // The dangerous bug this prevents: a command buffered while the phone is
    // reconnecting, then replayed seconds later. A stale `F` is worse than no F.
    const hub = await hubWith();
    const car = fakePeer("car");
    const carHandle = await hub.join(helloCar(), car.peer);
    expect(hub.forward(carHandle, "F")).toBe("dropped-unpaired");
    expect(hub.stats()[0]?.carDropped?.unpaired).toBe(1);
  });

  it("does NOT replay a dropped command when the phone finally arrives", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    const phoneHandle = await hub.join(helloController(), phone.peer);
    expect(hub.forward(phoneHandle, "F")).toBe("dropped-unpaired");
    await hub.join(helloCar(), car.peer);
    expect(car.wireFrames).toEqual([]);
  });

  it("delivers frames in order to a live partner", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    const carHandle = await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), phone.peer);
    hub.forward(carHandle, "STATE;a=1");
    hub.forward(carHandle, "CAPS;");
    expect(phone.wireFrames).toEqual(["STATE;a=1", "CAPS;"]);
  });

  it("survives a partner socket that throws on send", async () => {
    // A dead partner must not take the relay's loop down with it: an exception
    // escaping here would silently stop forwarding for every OTHER car in the
    // same isolate, which is exactly the kind of bug a single-car bench test
    // would never surface.
    const hub = await hubWith();
    const car = fakePeer("car");
    const carHandle = await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), {
      send: () => {
        throw new Error("socket gone");
      },
      close: () => undefined,
    });

    expect(() => hub.forward(carHandle, "STATE;a=1")).not.toThrow();
    // The car itself is unaffected: it is the phone that was dropped, not the
    // relay.
    expect(car.sent).toHaveLength(0);
  });

  it("counts frames for the latency/health view", async () => {
    const hub = await hubWith();
    const events: HubEvent[] = [];
    hub.onEvent((e) => events.push(e));
    const carHandle = await hub.join(helloCar(), fakePeer("car").peer);
    await hub.join(helloController(), fakePeer("p").peer);
    hub.forward(carHandle, "STATE;speed=100");
    expect(events).toContainEqual({
      type: "frame",
      boardIdHex: BOARD,
      from: "car",
      bytes: "STATE;speed=100".length,
    });
  });
});

// ---------------------------------------------- the grammar-lock guarantee

describe("grammar lock (FIN-23/24)", () => {
  it("never emits car wire grammar of its own accord", async () => {
    // The relay's control frames all start with NUL, which no car line can.
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), phone.peer);
    hub.leave(BOARD, "car");
    for (const frame of phone.sent) expect(isControl(frame)).toBe(true);
  });

  it("does not recognise any car command as a relay control frame", () => {
    for (const line of ["REQ_STATE", "CAPS;", "F", "SPD180", "ESTOP", "ROUTERS;OP;LIST"]) {
      expect(isControl(line)).toBe(false);
    }
  });

  it("cannot be tricked into treating a car frame as control by a NUL prefix", () => {
    // The car never sends NUL (handleCommand reads a C string), so a frame
    // beginning with NUL did not come from a car.
    expect(isControl(`${RELAY_CONTROL_PREFIX}relay`)).toBe(true);
    expect(isControl("STATE;a=1")).toBe(false);
  });

  it("parses only its own ping echo, and ignores car frames", () => {
    expect(parsePingEcho("STATE;speed=1", 1000)).toBeNull();
    expect(parsePingEcho(`${RELAY_CONTROL_PREFIX}{"ev":"other"}`, 1000)).toBeNull();
    expect(parsePingEcho(`${RELAY_CONTROL_PREFIX}{"ev":"ping-echo","t":"x"}`, 1000)).toBeNull();
    expect(parsePingEcho(controlPingEcho(BOARD, 1000), 1250)).toBe(250);
  });

  it("never reports a negative latency when clocks look odd", () => {
    expect(parsePingEcho(controlPingEcho(BOARD, 5000), 1000)).toBe(0);
  });

  it("stamps a ping the controller can measure with", () => {
    expect(JSON.parse(controlPing(BOARD, 42).slice(RELAY_CONTROL_PREFIX.length))).toEqual({
      ev: "ping",
      boardIdHex: BOARD,
      t: 42,
    });
  });

  // The ping pair lives in relay-core, not in the edge function, so that the
  // echo half and the parse half can be tested as one contract. A relay that
  // emits pings nobody parses reports latency as "the relay adds 400 ms".
  it("round-trips a ping through the car half of the pair", () => {
    const stamped = controlPing(BOARD, 1000);
    expect(parsePing(stamped)).toBe(1000);
    // The car echoes the SAME timestamp back; the controller measures it.
    expect(parsePingEcho(controlPingEcho(BOARD, parsePing(stamped)!), 1250)).toBe(250);
  });

  it("does not mistake an echo for a ping, or a ping for an echo", () => {
    expect(parsePing(controlPingEcho(BOARD, 1000))).toBeNull();
    expect(parsePingEcho(controlPing(BOARD, 1000), 1250)).toBeNull();
  });

  // ---- the latency pair, end to end through the hub.
  //
  // THE REGRESSION THESE ROWS EXIST FOR: the relay used to ANSWER a
  // controller's ping with its own echo instead of forwarding it, and to refuse
  // the car's `ping-echo` as an unknown control frame. So a phone measured the
  // RELAY's latency and reported it as the car's, and the one number Phase 4's
  // bench row depends on could never have existed. The relay is a pipe: it
  // forwards the pair and originates nothing (bar `hello-required`/`paired`).
  it("relays the latency pair verbatim, in both directions", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const phone = fakePeer("phone");
    const carHandle = await hub.join(helloCar(), car.peer);
    const phoneHandle = await hub.join(helloController(), phone.peer);

    const ping = controlPing(BOARD, 1000);
    expect(hub.forward(phoneHandle, ping)).toBe("forwarded");
    // `sent`, not `wireFrames`: a control frame is not a car line, and
    // wireFrames deliberately filters those out.
    expect(car.sent).toEqual([ping]);

    const echo = controlPingEcho(BOARD, 1000);
    expect(hub.forward(carHandle, echo)).toBe("forwarded");
    expect(phone.sent).toEqual([echo]);
    expect(parsePingEcho(phone.sent[0]!, 1250)).toBe(250);
  });

  it("names the only two control events the relay will carry", () => {
    expect(relayForwardsControl("ping")).toBe(true);
    expect(relayForwardsControl("ping-echo")).toBe(true);
    // Everything else is the relay's to refuse by name, so a mismatched client
    // build fails loudly instead of hanging on a silently-dropped frame.
    for (const ev of ["paired", "hello-required", "refused", "link-down", "lagging", "enrolled"]) {
      expect(relayForwardsControl(ev)).toBe(false);
    }
  });

  it("reads a control event only out of a control frame", () => {
    expect(parseControlEvent(controlPing(BOARD, 1))).toBe("ping");
    expect(parseControlEvent(`${RELAY_CONTROL_PREFIX}{"ev":"paired"}`)).toBe("paired");
    expect(parseControlEvent(`${RELAY_CONTROL_PREFIX}{}`)).toBeNull();
    expect(parseControlEvent(`${RELAY_CONTROL_PREFIX}{"ev":""}`)).toBeNull();
    expect(parseControlEvent(`${RELAY_CONTROL_PREFIX}not json`)).toBeNull();
    // The grammar lock again: a car line never reaches the JSON parse.
    for (const line of ["STATE;speed=1", "REQ_STATE", "F", "PING;t=1"]) {
      expect(parseControlEvent(line)).toBeNull();
    }
  });

  it("never parses a car line as a ping, even a NUL-free one that looks close", () => {
    for (const line of ["STATE;speed=1", "CAPS;", "F", "REQ_STATE", "PING;t=1", "ping;t=1"]) {
      expect(parsePing(line)).toBeNull();
      expect(parsePingEcho(line, 2000)).toBeNull();
    }
  });

  it("refuses a ping whose timestamp is not a finite number", () => {
    for (const t of ['"x"', "null", "true", "{}", "1e999"]) {
      expect(parsePing(`${RELAY_CONTROL_PREFIX}{"ev":"ping","t":${t}}`)).toBeNull();
    }
    expect(parsePing(`${RELAY_CONTROL_PREFIX}{"ev":"ping"`)).toBeNull();
  });
});

// ------------------------------------------------------------- enrollment

describe("enrollment body", () => {
  // The enrollment route is the ONLY writer of a token digest, and the only
  // code that can apply the pepper. Its validation lives beside the hello
  // rules so that what gets hashed and what gets stored are one shape.
  it("accepts the body the Phase 3 app will send", () => {
    expect(parseEnrollment({ boardIdHex: BOARD, token: TOKEN })).toEqual({
      ok: true,
      boardIdHex: BOARD,
      token: TOKEN,
    });
    // Text form must behave identically (a raw fetch sends text).
    expect(parseEnrollment(JSON.stringify({ boardIdHex: BOARD, token: TOKEN })).ok).toBe(true);
  });

  it("refuses a board id that is not the 6 uppercase hex the car prints", () => {
    // 42 and null because JSON has no integers-as-ids: a caller that sends one
    // gets told which field is wrong, not a crash inside a regex.
    for (const bad of ["a1b2c3", "A1B2C3D", "A1B2C3G", "", 42, null]) {
      const result = parseEnrollment({ boardIdHex: bad, token: TOKEN });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("boardIdHex");
    }
  });

  it("refuses a token that is not 32 lowercase hex chars", () => {
    for (const bad of ["", "short", TOKEN.toUpperCase(), `${TOKEN}00`, null]) {
      const result = parseEnrollment({ boardIdHex: BOARD, token: bad });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("token");
    }
  });

  it("refuses malformed JSON and non-objects by name", () => {
    expect(parseEnrollment("{not json")).toEqual({
      ok: false,
      error: "enrollment body is not valid JSON",
    });
    expect(parseEnrollment(7 as unknown as string).ok).toBe(false);
  });

  it("enforces the SAME formats as the hello, so the two cannot drift", async () => {
    // Same regexes, one implementation. If a future edit loosens the hello but
    // not enrollment (or the reverse), one of these two fails.
    for (const boardIdHex of [BOARD, "a1b2c3", "A1B2C3D", ""]) {
      expect(parseHello(helloCar({ boardIdHex })).ok).toBe(
        parseEnrollment({ boardIdHex, token: TOKEN }).ok
      );
    }
    for (const token of [TOKEN, TOKEN.toUpperCase(), "short", ""]) {
      expect(parseHello(helloCar({ token })).ok).toBe(
        parseEnrollment({ boardIdHex: BOARD, token }).ok
      );
    }
  });
});

// ---------------------------------------------------- no car state retained

describe("stores nothing", () => {
  it("exposes only presence and counts — never a frame body", async () => {
    const hub = await hubWith();
    const car = fakePeer("car");
    const carHandle = await hub.join(helloCar(), car.peer);
    await hub.join(helloController(), fakePeer("p").peer);
    hub.forward(carHandle, "STATE;speed=200;mode=4WD4M;batt=87");

    const stats = JSON.stringify(hub.stats());
    // Deliberately distinctive values: a bare "87" or "200" would collide with
    // a timestamp in the same JSON and make this test pass for the wrong reason.
    expect(stats).not.toContain("speed=200");
    expect(stats).not.toContain("4WD4M");
    expect(stats).not.toContain("batt=87");
    expect(stats).toContain(BOARD);
  });

  it("keeps no queue residue after a clean forward", async () => {
    const hub = await hubWith();
    const carHandle = await hub.join(helloCar(), fakePeer("car").peer);
    await hub.join(helloController(), fakePeer("p").peer);
    hub.forward(carHandle, "STATE;speed=1");
    // Nothing to assert publicly except that the relay never grows state; the
    // health view is the contract, and it shows no queue.
    expect(JSON.stringify(hub.stats())).not.toContain("speed");
  });
});
