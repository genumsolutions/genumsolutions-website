// =====================================================================
// device-registry tests — the shared identity contract between the
// firmware, the database and both front-ends.
//
// The fleet drifted into FOUR different names for one device (repo folder,
// firmware FW_NAME, advertised Bluetooth/AP name, app catalogue) before
// this registry existed. These tests pin the facts that stopped it.
// =====================================================================
import { describe, it, expect } from "vitest";
import {
  LOCAL_DEVICE_MODELS,
  localModel,
  pairingLabel,
  type DeviceModel,
} from "../lib/device-registry";

describe("bundled device registry", () => {
  it("has unique model ids", () => {
    const ids = LOCAL_DEVICE_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every model at a real repo folder name", () => {
    for (const m of LOCAL_DEVICE_MODELS) {
      expect(m.repo, `${m.id} repo`).toMatch(/^Genum_[A-Z0-9_]+$/);
    }
  });

  it("records advertised names exactly as the firmware advertises them", () => {
    // Verified against firmware sources, not invented:
    //   Genum_4WD4M_CAR/BluetoothComm.cpp:13 -> SerialBT.begin("4WD CAR")
    //   Genum_REMOTE_ESP32.ino               -> SerialBT.begin("REMOTE_CTRL")
    //   Genum_WIRELESS_CAR/BluetoothComm.cpp -> SerialBT.begin("WIRELESS CAR")
    // A Map rather than Object.fromEntries: a missing key then fails the
    // assertion below instead of throwing an opaque undefined dereference.
    const byId = new Map(LOCAL_DEVICE_MODELS.map((m) => [m.id, m]));
    const bt = (id: string) => byId.get(id)!.btName;
    expect(bt("4wd4m")).toBe("4WD CAR");
    expect(bt("remote-esp32")).toBe("REMOTE_CTRL");
    expect(bt("wireless-car")).toBe("WIRELESS CAR");
    expect(bt("2wd1m")).toBe("2 WHEEL DRIVE CAR");
    expect(bt("self-balancing")).toBe("SELF BALANCING BOT");
    expect(bt("smart-dustbin")).toBeNull();
  });

  it("keeps the 4WD4M AP identity it actually advertises", () => {
    const m = localModel("4wd4m");
    expect(m?.apSsid).toBe("4WDCar_Wifi");
    expect(m?.apIp).toBe("192.168.245.1");
  });

  it("never derives the advertised name from the display name", () => {
    // The edit this forbids: setting btName = displayName, which renames the
    // hardware and breaks every saved pairing. Case-only differences are
    // legitimate (the firmware upper-cases FW_NAME), so compare exactly.
    for (const m of LOCAL_DEVICE_MODELS) {
      if (m.btName === null) continue;
      expect(m.btName, `${m.id} advertised name`).not.toBe(m.displayName);
    }
  });

  it("keeps the upper-cased FW_NAME convention where the firmware uses it", () => {
    // Build the index explicitly rather than with Object.fromEntries so a
    // missing key is a test failure, not an undefined dereference.
    const byId = new Map(LOCAL_DEVICE_MODELS.map((m) => [m.id, m]));
    for (const id of ["2wd1m", "self-balancing", "wireless-car"]) {
      const m = byId.get(id);
      expect(m, `${id} must exist in the registry`).toBeDefined();
      expect(m!.btName, id).toBe(m!.fwName.toUpperCase());
    }
    // These two deviate from the rule on purpose and are frozen.
    const fourWd = byId.get("4wd4m")!;
    const remote = byId.get("remote-esp32")!;
    expect(fourWd.btName).not.toBe(fourWd.fwName.toUpperCase());
    expect(remote.btName).not.toBe(remote.fwName.toUpperCase());
  });

  it("gives every model a version and at least one transport", () => {
    for (const m of LOCAL_DEVICE_MODELS) {
      expect(m.fwVersion, `${m.id}`).toMatch(/^\d+\.\d+\.\d+$/);
      expect(m.transports.length, `${m.id} transports`).toBeGreaterThan(0);
    }
  });

  it("includes the models that have firmware but no app mode entry", () => {
    // wireless-car is fw 1.8.0 — the most mature in the fleet — and was
    // invisible to the front-ends before the registry existed.
    expect(localModel("wireless-car")).not.toBeNull();
    expect(localModel("smart-dustbin")).not.toBeNull();
  });

  it("returns null for an unknown model rather than inventing one", () => {
    expect(localModel("teleport-car")).toBeNull();
  });
});

describe("pairingLabel", () => {
  const model: DeviceModel = {
    id: "4wd4m",
    displayName: "4WD 4-Motor Car",
    repo: "Genum_4WD4M_CAR",
    fwName: "4WD4M Car",
    fwVersion: "1.0.0",
    btName: "4WD CAR",
    apSsid: "4WDCar_Wifi",
    apIp: "192.168.245.1",
    transports: ["classic-bt"],
  };

  it("shows the announced name when it differs from the display name", () => {
    // The OS pairing list says "4WD CAR". Showing only "4WD 4-Motor Car"
    // would leave a user unable to find their own car.
    expect(pairingLabel(model)).toContain("4WD CAR");
    expect(pairingLabel(model)).toContain("4WD 4-Motor Car");
  });

  it("does not repeat the name when they are identical", () => {
    expect(pairingLabel({ ...model, btName: "4WD 4-Motor Car" })).toBe("4WD 4-Motor Car");
  });

  it("is honest about an unknown unit", () => {
    expect(pairingLabel(null)).toBe("Unknown device");
  });
});
