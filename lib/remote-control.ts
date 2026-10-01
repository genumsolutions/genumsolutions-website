// =====================================================================
// remote-control.ts — website remote-control gate, PER TRANSPORT.
//
// History: a single `REMOTE_CONTROL_ENABLED` boolean used to gate the whole
// website control panel (owner decision 2026-09-15, HALT). That was the
// right call then, but one flag is now too coarse in BOTH directions:
//
//   - It hides the registry/garage, which needs no live link at all and is
//     useful today.
//   - Flipping it back to `true` would re-enable LAN transports that are
//     not merely untested from a browser but IMPOSSIBLE, so the site would
//     promise a car it can never reach.
//
// The real distinction is not "is control enabled", it is "can a browser on
// the public internet physically reach the device over this transport".
// That is what is modelled here.
//
// IMPORTANT - the "impossible" verdicts are browser/platform security
// boundaries, not untested code:
//   • Classic Bluetooth SPP is not exposed to web pages by ANY browser API.
//   • An HTTPS page cannot open ws:// (mixed content), and a car on its own
//     access point or a private LAN has no inbound route from the internet.
//   • mDNS (.local) is link-local and does not cross the internet.
// Only an outbound-dial transport (relay / broker) can work here, because
// in that shape the DEVICE initiates the connection and the website merely
// connects to a public endpoint.
//
// Control of fleet devices therefore continues via the GENUM app (which has
// real BT/LAN access) and each car's own hosted page (http://<car-ip>).
// =====================================================================

/**
 * What a website control panel can actually offer, per transport.
 *
 * `reachable`  - can a browser on the public internet reach a device this way?
 * `implemented`- is the code present in lib/robo-car-transport.ts?
 * `why`        - shown in the UI so the site never silently hides a reason.
 */
export type WebsiteTransportId =
  | "relay-wss"
  | "cloud-relay"
  | "mqtt-broker"
  | "web-bluetooth-ble"
  | "websocket-lan"
  | "http-lan"
  | "mdns"
  | "bt-classic";

export type TransportVerdict = {
  id: WebsiteTransportId;
  label: string;
  reachable: boolean;
  implemented: boolean;
  /** Shown in the UI. Never empty for an unreachable transport. */
  why: string;
};

/**
 * Single source of truth for what the website may offer.
 *
 * Order is deliberate: the one transport that will actually work over the
 * internet comes first, so a future control panel is built around it rather
 * than around the LAN transports that cannot work.
 */
export const WEBSITE_TRANSPORTS: readonly TransportVerdict[] = [
  {
    id: "relay-wss",
    label: "Cloud relay (WSS)",
    reachable: true,
    implemented: false,
    why: "The car dials OUT to the relay, so no inbound route is needed. This is the shape that works from the internet, and the one the website control panel will be built on. Car-side client not built yet.",
  },
  {
    id: "cloud-relay",
    label: "Internet relay",
    reachable: true,
    implemented: false,
    why: "Same outbound-dial shape as the WSS relay. Needs a public endpoint to connect to.",
  },
  {
    id: "mqtt-broker",
    label: "MQTT broker",
    reachable: true,
    implemented: false,
    why: "Both sides dial out to a public broker, so it can work from the internet. No broker or credentials have been chosen yet, and the 4WD4M firmware has no MQTT client.",
  },
  {
    id: "web-bluetooth-ble",
    label: "Bluetooth Low Energy (Web Bluetooth)",
    reachable: false,
    implemented: true,
    why: "Implemented in lib/robo-car-transport.ts, but Web Bluetooth only exists in Chrome/Edge/Android, needs a user gesture, and requires BLE GATT firmware. The 4WD4M has no BLE server yet, and a phone-only BLE link does not help the website reach a car over the internet.",
  },
  {
    id: "websocket-lan",
    label: "Wi-Fi WebSocket (LAN)",
    reachable: false,
    implemented: true,
    why: "An HTTPS website cannot open ws:// (mixed content), and the car sits behind a router with no inbound route. Only reachable when the browser is on the same LAN as the car.",
  },
  {
    id: "http-lan",
    label: "HTTP / REST (LAN)",
    reachable: false,
    implemented: true,
    why: "Same reachability problem: the car's LAN address is not routable from the public internet.",
  },
  {
    id: "mdns",
    label: "mDNS (.local)",
    reachable: false,
    implemented: false,
    why: "mDNS is link-local and never crosses the internet; genum-car.local only resolves on the same network segment.",
  },
  {
    id: "bt-classic",
    label: "Bluetooth Classic (SPP)",
    reachable: false,
    implemented: false,
    why: "Classic Bluetooth is not exposed to web pages by any browser API. This is a hard platform limit, not a missing feature.",
  },
] as const;

/**
 * Master gate for LIVE remote control.
 *
 * Stays `false` (owner decision 2026-09-15) and is intentionally NOT enough
 * on its own to decide what to show. Use `websiteTransportVerdict()` /
 * `reachableWebsiteTransports()` for that, so a panel can never enable a
 * transport that physically cannot work.
 */
export const REMOTE_CONTROL_ENABLED = false;

/** Verdicts for transports a website can genuinely use. */
export function reachableWebsiteTransports(): TransportVerdict[] {
  return WEBSITE_TRANSPORTS.filter((t) => t.reachable);
}

/** Verdict for one transport, or null if unknown. */
export function websiteTransportVerdict(id: WebsiteTransportId): TransportVerdict | null {
  return WEBSITE_TRANSPORTS.find((t) => t.id === id) ?? null;
}

/** True only when the transport is reachable AND implemented AND enabled. */
export function canWebsiteControl(id: WebsiteTransportId): boolean {
  const t = websiteTransportVerdict(id);
  return !!REMOTE_CONTROL_ENABLED && !!t && t.reachable && t.implemented;
}

/**
 * A human explanation for why a given transport is not offered, for the UI.
 * Returns null when the transport IS available.
 */
export function websiteTransportBlockReason(id: WebsiteTransportId): string | null {
  const t = websiteTransportVerdict(id);
  if (!t) return "Unknown transport.";
  if (t.reachable && t.implemented) {
    return REMOTE_CONTROL_ENABLED ? null : "Live control is paused.";
  }
  if (!t.reachable) return t.why;
  return "Not built yet.";
}
