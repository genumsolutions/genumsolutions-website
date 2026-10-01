// =====================================================================
// robo-car-catalog tests — the protocol contract, and the guard against
// the website and the app disagreeing about a mode's NAME.
//
// The drift this file exists to prevent (found 2026-10-01): the website's
// bundled catalogue spelled mode names with a middle dot
// ("Bluetooth · 2WD + Servo (1M)") while the database and the app used an
// em dash ("Bluetooth — 2WD + Servo (1M)"). Both paths render from the same
// nine modes, so one user saw one name online and a different one offline,
// and an owner reading a bug report could not tell which they had.
//
// Separately, six of the nine modes have no firmware. Before `isPlanned`
// existed, a deck offered them as drivable: the user picked one, nothing
// happened, and the car looked broken. These tests pin the flag to the same
// six ids the database records, so the offline fallback cannot quietly claim
// a mode is ready when the firmware table says otherwise.
// =====================================================================
import { describe, expect, it } from "vitest";
import {
  ROBOCAR_MODES,
  CAR_TYPE_MAP,
  resolveCarType,
  DEVICE_MODE_ORDER,
  nextDeviceMode,
} from "../lib/robo-car-catalog";

/** Mirrors public.robo_car_modes_flags (migration 20261001130000). */
const DB_PLANNED = new Set([
  "obstacle-us",
  "obstacle-ir",
  "website-client",
  "website-server",
  "path-follow",
  "rf-manual",
]);
/** The three modes with real firmware behind them. */
const DB_LIVE = new Set(["4wd4m", "2wd1m", "self-balancing"]);

describe("mode names are app-compatible", () => {
  it("uses the em dash the database and the app use, never a middle dot", () => {
    // U+2014, not U+00B7. This is the exact string the app renders.
    for (const m of ROBOCAR_MODES) {
      expect(m.name, `${m.id} must not use a middle dot`).not.toContain("\u00b7");
    }
  });

  it("matches the database names exactly", () => {
    // Verbatim from the live robo_car_modes table.
    const dbNames: Record<string, string> = {
      "4wd4m": "4WD4M",
      "2wd1m": "Bluetooth \u2014 2WD + Servo (1M)",
      "self-balancing": "Self-Balancing",
      "obstacle-us": "Obstacle Avoidance \u2014 Ultrasonic",
      "obstacle-ir": "Obstacle Avoidance \u2014 IR",
      "website-client": "Website Controlled \u2014 Client",
      "website-server": "Website Controlled \u2014 Server",
      "path-follow": "Path Following \u2014 IR",
      "rf-manual": "Manual \u2014 RF",
    };
    for (const m of ROBOCAR_MODES) {
      expect(m.name, `${m.id} name must equal the database`).toBe(dbNames[m.id]);
    }
  });

  it("matches the database car labels exactly", () => {
    // Two rounds of drift, both found by comparing this file to the live
    // table rather than trusting a comment:
    //
    //   1. migration 20261001130000 title-cased seven modes but skipped
    //      'self-balancing', leaving the DB at "Self-balancing" while the
    //      owner decision and the app test said "Self-Balancing". The row was
    //      the outlier and migration 20261001150000 corrected it - the app
    //      copy was NOT changed to match the stale row, because the app reads
    //      this table DB-first and would have reintroduced the old label.
    //   2. The website's bundled copy had kept the pre-migration labels
    //      entirely ("4-wheel-drive", "Obstacle avoider"), so eight of nine
    //      rows disagreed between the online and offline paths.
    const dbCars: Record<string, string> = {
      "4wd4m": "4-Wheel Drive",
      "2wd1m": "2-Wheel Drive",
      "self-balancing": "Self-Balancing",
      "obstacle-us": "Obstacle Avoider",
      "obstacle-ir": "Obstacle Avoider",
      "website-client": "Website Car",
      "website-server": "Website Car",
      "path-follow": "Line Follower",
      "rf-manual": "RF Car",
    };
    for (const m of ROBOCAR_MODES) {
      expect(m.car, `${m.id} car label must equal the database`).toBe(dbCars[m.id]);
    }
  });
});

describe("planned modes match the database flag table", () => {
  it("marks exactly the six modes the database marks planned", () => {
    const bundled = new Set(ROBOCAR_MODES.filter((m) => m.isPlanned).map((m) => m.id));
    expect([...bundled].sort()).toEqual([...DB_PLANNED].sort());
  });

  it("leaves the three firmware-backed modes drivable", () => {
    for (const m of ROBOCAR_MODES) {
      if (DB_LIVE.has(m.id)) expect(m.isPlanned, `${m.id} is live`).toBeFalsy();
    }
  });

  it("covers all nine modes between planned and live", () => {
    expect(ROBOCAR_MODES).toHaveLength(9);
    expect(DB_PLANNED.size + DB_LIVE.size).toBe(9);
  });

  it("still gives a planned mode a real blurb and controls", () => {
    // "Planned" means no firmware yet, not "no design". Dropping the copy
    // would leave the mode unexplained in the catalogue.
    for (const m of ROBOCAR_MODES) {
      expect(m.blurb.length, `${m.id} blurb`).toBeGreaterThan(10);
      expect(m.controls.length, `${m.id} controls`).toBeGreaterThan(0);
    }
  });
});

describe("protocol tokens are unchanged", () => {
  it("keeps the wire token for every mode", () => {
    // These are what the firmware matches on. Renaming a display name must
    // never touch these. The nine tokens are exactly MODE_CMDS[]:
    //   4WD4M, ESP_SER, PATH, OBS_US, OBS_IR, MAN, AUTO, ESP_CLI, 2WD1M
    const tokens: Record<string, string> = {
      "4wd4m": "4WD4M",
      "website-server": "ESP_SER",
      "path-follow": "PATH",
      "obstacle-us": "OBS_US",
      "obstacle-ir": "OBS_IR",
      "rf-manual": "MAN",
      "self-balancing": "AUTO",
      "website-client": "ESP_CLI",
      "2wd1m": "2WD1M",
    };
    for (const m of ROBOCAR_MODES) {
      expect(m.token, `${m.id} token`).toBe(tokens[m.id]);
    }
  });

  it("has a unique token per mode", () => {
    const t = ROBOCAR_MODES.map((m) => m.token);
    expect(new Set(t).size).toBe(9);
  });

  it("has unique device indices across the nine modes", () => {
    const idx = ROBOCAR_MODES.map((m) => m.deviceIndex);
    expect(new Set(idx).size).toBe(9);
  });

  it("steps the cycle in the firmware's MODE_CMDS[] order", () => {
    // The physical mode button cycles this order, so "Next mode" must match
    // it or the app and the car disagree about which mode comes next.
    expect(DEVICE_MODE_ORDER.map((m) => m.token)).toEqual([
      "4WD4M",
      "ESP_SER",
      "PATH",
      "OBS_US",
      "OBS_IR",
      "MAN",
      "AUTO",
      "ESP_CLI",
      "2WD1M",
    ]);
  });

  it("wraps from the last mode back to the first", () => {
    const last = DEVICE_MODE_ORDER[DEVICE_MODE_ORDER.length - 1]!;
    expect(nextDeviceMode(last).id).toBe(DEVICE_MODE_ORDER[0]!.id);
  });
});

describe("resolveCarType", () => {
  it("resolves by id and by token, case-insensitively", () => {
    expect(resolveCarType("4wd4m")?.id).toBe("4wd4m");
    expect(resolveCarType("4WD4M")?.id).toBe("4wd4m");
    expect(resolveCarType("obs_us")?.id).toBe("obstacle-us");
  });

  it("returns undefined for an unknown mode rather than guessing", () => {
    expect(resolveCarType("self-driving")).toBeUndefined();
  });

  it("indexes every mode by id in CAR_TYPE_MAP", () => {
    for (const m of ROBOCAR_MODES) {
      expect(CAR_TYPE_MAP[m.id]?.token, m.id).toBe(m.token);
    }
  });

  it("resolves MAN to the RF mode, not to the self-balancing car", () => {
    // MAN and AUTO are different modes: MAN is rf-manual, AUTO is
    // self-balancing. Pinned because the two car types both present a
    // "manual" idea and a re-sort would reroute one to the other.
    expect(resolveCarType("MAN")?.id).toBe("rf-manual");
    expect(resolveCarType("AUTO")?.id).toBe("self-balancing");
  });
});
