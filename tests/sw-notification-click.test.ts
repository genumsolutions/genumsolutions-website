// =====================================================================
// sw-notification-click.test.ts — behavioral unit test for the service
// worker's `notificationclick` handler (P3 §4 tap-through DEFER close).
//
// The old handler focused an existing tab but NEVER navigated it, so
// "tap notification → /account#orders" silently did nothing whenever a
// site tab was already open (the common case). public/sw.js has no
// exports; we eval its source in a sandbox whose `self` is a stub and
// drive click events through the registered listener, the same way the
// browser would.
// =====================================================================
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

type ClickEvent = {
  notification: { close: () => void; data: { url: string } };
  waitUntil: (p: Promise<unknown>) => void;
};

type Calls = { focused: string[]; navigated: string[]; opened: string[] };

interface FakeClient {
  url: string;
  focus?: () => Promise<void>;
  navigate?: (u: string) => Promise<void>;
}

// Reassigned by makeSandbox before any client callback can fire; captured
// by the stub clients' focus/navigate closures.
let calls: Calls;

function makeSandbox(opts: { clients?: FakeClient[] } = {}) {
  const clients: FakeClient[] = opts.clients ?? [];
  const recorded: Calls = { focused: [], navigated: [], opened: [] };
  calls = recorded;
  const waits: Array<Promise<unknown>> = [];
  const listeners = new Map<string, (ev: ClickEvent) => void>();
  const sandboxSelf = {
    location: { origin: "https://genum.test" },
    registration: { showNotification: (): Promise<void> => Promise.resolve() },
    clients: {
      matchAll: (): Promise<FakeClient[]> => Promise.resolve(clients),
      openWindow: (url: string): Promise<void> => {
        recorded.opened.push(url);
        return Promise.resolve();
      },
    },
    addEventListener: (type: string, fn: (ev: ClickEvent) => void): void => {
      listeners.set(type, fn);
    },
  };
  new Function("self", `"use strict";\n${SOURCE}`)(sandboxSelf);
  const handler = listeners.get("notificationclick");
  expect(typeof handler).toBe("function");
  return {
    click: (url: string): Promise<unknown> => {
      handler!({
        notification: { close: () => undefined, data: { url } },
        waitUntil: (p: Promise<unknown>) => {
          waits.push(p);
        },
      });
      return Promise.all(waits);
    },
  };
}

const winClient = (url: string): FakeClient => ({
  url,
  focus: async () => {
    calls.focused.push(url);
  },
  navigate: async (u: string) => {
    calls.navigated.push(u);
  },
});

describe("sw.js notificationclick (tap-through)", () => {
  it("navigates an existing tab to the payload target (focus alone is not enough)", async () => {
    const box = makeSandbox({ clients: [winClient("https://genum.test/checkout")] });
    await box.click("/account#orders");
    expect(calls.focused).toEqual(["https://genum.test/checkout"]);
    expect(calls.navigated).toEqual(["https://genum.test/account#orders"]);
    expect(calls.opened).toEqual([]);
  });

  it("resolves the payload target against the worker origin (relative url)", async () => {
    const box = makeSandbox({ clients: [winClient("https://genum.test/")] });
    await box.click("/account#orders");
    expect(calls.navigated).toEqual(["https://genum.test/account#orders"]);
  });

  it("falls back to openWindow when no window client exists", async () => {
    const box = makeSandbox({ clients: [] });
    await box.click("/account#orders");
    expect(calls.opened).toEqual(["https://genum.test/account#orders"]);
  });

  it("never navigates a foreign-origin client (opens a fresh window instead)", async () => {
    const box = makeSandbox({ clients: [winClient("https://evil.example/pwned")] });
    await box.click("/account#orders");
    expect(calls.navigated).toEqual([]);
    expect(calls.focused).toEqual([]);
    expect(calls.opened).toEqual(["https://genum.test/account#orders"]);
  });

  it("tolerates a client without navigate() (older browsers)", async () => {
    const box = makeSandbox({
      clients: [
        {
          url: "https://genum.test/account",
          focus: async () => {
            calls.focused.push("https://genum.test/account");
          },
        },
      ],
    });
    await box.click("/account#orders");
    expect(calls.focused).toEqual(["https://genum.test/account"]);
    expect(calls.opened).toEqual([]);
  });

  it("payload contract: push stores the click target in notification data", () => {
    expect(SOURCE).toContain('data: { url: payload.url || "/account" }');
    expect(SOURCE).toContain("event.notification.data.url");
  });
});
