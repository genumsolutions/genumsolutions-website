import { beforeEach, describe, expect, it, vi } from "vitest";

// car-profiles route: self-service reads, admin override, strict input
// validation, and RLS-scoped supabase calls. Mirrors the admin-parity /
// admin-roles test style: mock the supabase server module + activity log,
// drive the real route handlers with synthetic Requests.

const state = vi.hoisted(() => {
  type Call = { table: string; op: string; args: unknown[] };
  const calls: Call[] = [];
  const makeChain = (table: string, result: { data: unknown; error: unknown }) => {
    const record =
      (op: string) =>
      (...args: unknown[]) => {
        calls.push({ table, op, args });
        return chain;
      };
    const chain: Record<string, unknown> = {
      select: record("select"),
      eq: record("eq"),
      order: async () => result,
      maybeSingle: async () => ({ data: { role: state.role, tier: "pro" } }),
      update: record("update"),
      delete: record("delete"),
    };
    return chain;
  };
  return {
    calls,
    makeChain,
    role: "customer" as string | null,
    sessionUser: { id: "00000000-0000-0000-0000-000000000001" } as { id: string } | null,
    rows: [] as unknown,
    rowError: null as unknown,
  };
});

vi.mock("../lib/supabase/server", () => ({
  getSessionUser: async () => (state.sessionUser ? { id: state.sessionUser.id } : null),
  createClient: () => ({
    from: (table: string) => state.makeChain(table, { data: state.rows, error: state.rowError }),
  }),
  createServiceClient: () => ({
    from: (table: string) => state.makeChain(table, { data: state.rows, error: state.rowError }),
  }),
}));

vi.mock("../lib/activity", () => ({
  logActivity: async () => undefined,
}));

import { DELETE, GET, PATCH } from "../app/api/user/car-profiles/route";

const SELF = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000009";

const url = (q = "") => `http://localhost/api/user/car-profiles${q}`;

function reset() {
  state.calls.length = 0;
  state.role = "customer";
  state.sessionUser = { id: SELF };
  state.rows = [];
  state.rowError = null;
}

describe("car-profiles route", () => {
  beforeEach(reset);

  it("GET returns 401 without a session", async () => {
    state.sessionUser = null;
    const res = await GET(new Request(url()));
    expect(res.status).toBe(401);
  });

  it("GET rejects malformed userId with 400", async () => {
    const res = await GET(new Request(url("?userId=not-a-uuid")));
    expect(res.status).toBe(400);
  });

  it("GET rejects reading another user's rows with 403", async () => {
    const res = await GET(new Request(url(`?userId=${OTHER}`)));
    expect(res.status).toBe(403);
  });

  it("GET returns the user's rows via the scoped (anon-key) client", async () => {
    state.rows = [
      {
        profile_key: "fw:1A2B3C",
        car_name: "Shop car",
        unique_id: "1A2B3C",
        settings: { mode_id: "4wd4m", speed: 170 },
        wifi_history: [],
        updated_at: "2026-09-29T00:00:00Z",
      },
    ];
    const res = await GET(new Request(url()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profiles: Array<{ profile_key: string }> };
    expect(body.profiles[0]?.profile_key).toBe("fw:1A2B3C");
    // Customer path must use createClient (RLS-scoped), not the service role.
    const ups = state.calls.filter((c) => c.op === "select");
    expect(ups.length).toBeGreaterThan(0);
  });

  it("PATCH rejects an empty name and a foreign profileKey", async () => {
    const empty = await PATCH(
      new Request(url(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileKey: "fw:1A2B3C", carName: "  " }),
      })
    );
    expect(empty.status).toBe(400);

    const foreign = await PATCH(
      new Request(url(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: OTHER,
          profileKey: "fw:1A2B3C",
          carName: "Mine now",
        }),
      })
    );
    expect(foreign.status).toBe(403);
  });

  it("PATCH renames through the scoped client with updated_at", async () => {
    const res = await PATCH(
      new Request(url(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileKey: "fw:1A2B3C", carName: "New name" }),
      })
    );
    expect(res.status).toBe(200);
    const update = state.calls.find((c) => c.op === "update");
    expect(update).toBeTruthy();
    expect((update!.args[0] as { car_name: string }).car_name).toBe("New name");
    const eqs = state.calls.filter((c) => c.op === "eq").map((c) => c.args[0]);
    expect(eqs).toContain("profile_key");
    expect(eqs).toContain("user_id");
  });

  it("DELETE removes by user_id + profile_key", async () => {
    const res = await DELETE(new Request(url("?profileKey=fw%3A1A2B3C")));
    expect(res.status).toBe(200);
    expect(state.calls.some((c) => c.op === "delete")).toBe(true);
    const eqs = state.calls.filter((c) => c.op === "eq").map((c) => c.args[0]);
    expect(eqs).toContain("profile_key");
    expect(eqs).toContain("user_id");
  });

  it("DELETE requires a profileKey", async () => {
    const res = await DELETE(new Request(url()));
    expect(res.status).toBe(400);
  });
});
