// =====================================================================
// project-types.ts — every build family the workshop actually has.
//
// The root of this repo holds the source projects (Genum_2WD1M_CAR,
// Genum_4WD4M_CAR, Genum_SELF_BALANCE_CAR, Genum_REMOTE_ESP32,
// Genum_SMART_DUSTBIN, Genum_WIRELESS_CAR, Genum_2WD1M_CAR_NEW), and the
// `robo_car_modes` table holds the driving modes those projects demonstrate.
// Until now /projects listed the catalog but never said which of those builds
// exist — so a visitor could not tell that obstacle avoidance, path following,
// RF manual and the Wi-Fi client/server cars are real projects.
//
// This file is the one place that mapping lives. Each entry names the source
// folder it came from, the catalog row that sells it (`productId`), and the
// modes it covers, so the project page can show the whole family with a live
// count instead of a hardcoded list.
// =====================================================================

export type ProjectType = {
  id: string;
  /** What the build is called on the projects page. */
  name: string;
  /** Folder in the repo root the firmware/project came from. */
  sourceFolder: string;
  /** Catalog row that sells this build (null when it is a mode, not a product). */
  productId: string | null;
  summary: string;
  /** `robo_car_modes` ids this family covers. */
  modes: string[];
};

export const PROJECT_TYPES: ProjectType[] = [
  {
    id: "4wd4m",
    name: "4WD4M Car",
    sourceFolder: "Genum_4WD4M_CAR",
    productId: "4wd4m-basic",
    summary:
      "Four-wheel, four-motor chassis driven through a TB6612FNG with ESP32 — the base platform for most other modes.",
    modes: ["4wd4m"],
  },
  {
    id: "2wd1m",
    name: "2WD1M Car",
    sourceFolder: "Genum_2WD1M_CAR · Genum_2WD1M_CAR_NEW",
    productId: "2wd1m-basic",
    summary:
      "Two-wheel drive with a single motor channel per side; the smallest kit that still teaches steering and speed.",
    modes: ["2wd1m"],
  },
  {
    id: "self-balancing",
    name: "Self-Balancing Car",
    sourceFolder: "Genum_SELF_BALANCE_CAR",
    productId: "self-balancing-basic",
    summary:
      "MPU6050 plus a PID loop keeps a two-wheel chassis upright; the same panel tunes the PID live.",
    modes: ["self-balancing"],
  },
  {
    id: "wireless",
    name: "Wireless Car (Wi-Fi)",
    sourceFolder: "Genum_WIRELESS_CAR",
    productId: "website-client-basic",
    summary:
      "ESP32 on Wi-Fi, driven from this site in client or server mode — no Bluetooth pairing, no app install.",
    modes: ["website-client", "website-server"],
  },
  {
    id: "remote",
    name: "ESP32 Remote Controller",
    sourceFolder: "Genum_REMOTE_ESP32",
    productId: "esp32-remote",
    summary:
      "The hand-held ESP32 remote: joysticks, channel switches and a screen, mirrored one-to-one in the Control Panel.",
    modes: ["rf-manual"],
  },
  {
    id: "obstacle",
    name: "Obstacle-Avoidance Car",
    sourceFolder: "Genum_2WD1M_CAR · Genum_WIRELESS_CAR",
    productId: "obstacle-us-basic",
    summary:
      "Ultrasonic or IR ranging decides when to stop and turn; both variants ship from the same chassis.",
    modes: ["obstacle-us", "obstacle-ir"],
  },
  {
    id: "path-follow",
    name: "Path-Following Car",
    sourceFolder: "Genum_2WD1M_CAR_NEW",
    productId: "path-follow-basic",
    summary: "IR array follows a taped line, with the same motor layer as the manual cars.",
    modes: ["path-follow"],
  },
  {
    id: "bluetooth",
    name: "Bluetooth Car",
    sourceFolder: "Genum_2WD1M_CAR",
    productId: "esp32-bluetooth-robot-car",
    summary:
      "Phone-controlled teaching car (MIT App Inventor or the app) with OLED status and a manual stop.",
    modes: ["2wd1m"],
  },
  {
    id: "smart-dustbin",
    name: "Smart Dustbin",
    sourceFolder: "Genum_SMART_DUSTBIN",
    productId: "smart-dustbin",
    summary:
      "Ultrasonic lid, fill-level readout and a compactor relay — the same project used in the Smart City stream.",
    modes: [],
  },
  {
    id: "multimode",
    name: "Arduino Multimode Car",
    sourceFolder: "Genum_2WD1M_CAR · Genum_4WD4M_CAR",
    productId: "arduino-multimode-robot-car",
    summary:
      "One Arduino Uno build that switches between Bluetooth, obstacle avoidance and learning modes.",
    modes: [],
  },
];

/** Product ids a project type sells, for counting against the catalog. */
export function projectTypeProductIds(type: ProjectType): string[] {
  return type.productId ? [type.productId] : [];
}
