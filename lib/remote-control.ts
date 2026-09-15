// =====================================================================
// remote-control.ts — website remote-control gate.
//
// The website's /tools page previously exposed a live control panel
// (Web Bluetooth / WS to the car + relay/slider decks). Browsers cannot
// open ws:// to a LAN car from HTTPS and cannot speak classic SPP, and
// the transport decision (D-1) is parked. Owner decision 2026-09-15:
// HALT all website remote control for now.
//
// Flip this to `true` to bring the live decks back (one-line reversible).
// Control of fleet devices continues via the GENUM app and each car's
// own hosted page (http://<car-ip>).
// =====================================================================

export const REMOTE_CONTROL_ENABLED = false