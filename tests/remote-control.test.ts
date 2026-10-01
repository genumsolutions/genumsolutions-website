// =====================================================================
// remote-control tests - the guard on what the website may claim it can do.
//
// This file exists because the previous gate was ONE boolean. That made it
// too coarse in both directions: it hid the registry/garage (which needs no
// live link and is useful today), and flipping it back on would have
// re-enabled LAN transports that are not untested but IMPOSSIBLE from a
// public HTTPS page.
//
// The tests below pin the physical reachability verdicts, so a future
// "let's just enable it" change fails here instead of shipping a control
// panel that promises a car the website can never reach.
// =====================================================================
import { describe, it, expect } from "vitest";
import {
  WEBSITE_TRANSPORTS,
  REMOTE_CONTROL_ENABLED,
  reachableWebsiteTransports,
  websiteTransportVerdict,
  websiteTransportBlockReason,
  canWebsiteControl,
  type WebsiteTransportId,
} from "../lib/remote-control";

describe("website transport verdicts are physical, not aspirational", () => {
  it("classifies classic Bluetooth SPP as unreachable", () => {
    // There is no browser API for SPP. This cannot be fixed by writing code.
    const t = websiteTransportVerdict("bt-classic");
    expect(t).not.toBeNull();
    expect(t!.reachable).toBe(false);
    expect(t!.why.toLowerCase()).toContain("not exposed to web pages");
  });

  it("classifies LAN WebSocket and HTTP as unreachable", () => {
    // Mixed content + no inbound route. Being implemented in code is not the
    // same as being reachable, which is exactly the confusion the old
    // single flag allowed.
    for (const id of ["websocket-lan", "http-lan"] as WebsiteTransportId[]) {
      const t = websiteTransportVerdict(id);
      expect(t, id).not.toBeNull();
      expect(t!.reachable, `${id} must be unreachable from the internet`).toBe(false);
      expect(t!.implemented, `${id} code does exist`).toBe(true);
    }
  });

  it("classifies mDNS as unreachable", () => {
    const t = websiteTransportVerdict("mdns");
    expect(t!.reachable).toBe(false);
    expect(t!.why.toLowerCase()).toContain("link-local");
  });

  it("classifies Web Bluetooth as unreachable over the internet", () => {
    // The code is real, but BLE is a phone-proximity technology. It cannot be
    // how the public website reaches a car.
    const t = websiteTransportVerdict("web-bluetooth-ble");
    expect(t!.reachable).toBe(false);
    expect(t!.implemented).toBe(true);
    expect(t!.why.toLowerCase()).toContain("chrome");
  });

  it("marks every outbound-dial transport as reachable", () => {
    // These are the only shapes that can work from a public HTTPS page,
    // because the DEVICE initiates the connection.
    for (const id of ["relay-wss", "cloud-relay", "mqtt-broker"] as WebsiteTransportId[]) {
      expect(websiteTransportVerdict(id)!.reachable, id).toBe(true);
    }
  });
});

describe("every verdict is honest", () => {
  it("gives an unreachable transport a real explanation", () => {
    for (const t of WEBSITE_TRANSPORTS) {
      if (!t.reachable) {
        expect(t.why.length, `${t.id} needs a reason`).toBeGreaterThan(20);
      }
    }
  });

  it("has no duplicate transport ids", () => {
    const ids = WEBSITE_TRANSPORTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts the working transport first so panels are built around it", () => {
    // If the ordering ever puts an impossible transport at the top, a panel
    // built off this list would start with something that cannot work.
    expect(WEBSITE_TRANSPORTS[0]!.id).toBe("relay-wss");
    expect(WEBSITE_TRANSPORTS[0]!.reachable).toBe(true);
  });
});

describe("live control stays off", () => {
  it("is still disabled", () => {
    expect(REMOTE_CONTROL_ENABLED).toBe(false);
  });

  it("allows nothing to be controlled while the master gate is off", () => {
    for (const t of WEBSITE_TRANSPORTS) {
      expect(canWebsiteControl(t.id), `${t.id} must be off`).toBe(false);
    }
  });

  it("blocks every transport with a stated reason", () => {
    for (const t of WEBSITE_TRANSPORTS) {
      const reason = websiteTransportBlockReason(t.id);
      expect(reason, `${t.id} must explain itself`).toBeTruthy();
    }
  });
});

describe("reachable helper", () => {
  it("returns only reachable transports", () => {
    for (const t of reachableWebsiteTransports()) expect(t.reachable).toBe(true);
    expect(reachableWebsiteTransports().length).toBeGreaterThan(0);
  });

  it("excludes every impossible transport", () => {
    const ids = reachableWebsiteTransports().map((t) => t.id);
    for (const id of ["bt-classic", "websocket-lan", "http-lan", "mdns"]) {
      expect(ids, `${id} must never be offered`).not.toContain(id);
    }
  });
});

describe("unknown transports are refused, not guessed", () => {
  it("returns null for an unknown id", () => {
    expect(websiteTransportVerdict("carrier-pigeon" as WebsiteTransportId)).toBeNull();
  });

  it("refuses to control an unknown transport", () => {
    expect(canWebsiteControl("carrier-pigeon" as WebsiteTransportId)).toBe(false);
  });

  it("explains an unknown transport rather than silently allowing it", () => {
    expect(websiteTransportBlockReason("carrier-pigeon" as WebsiteTransportId)).toBe(
      "Unknown transport."
    );
  });
});
