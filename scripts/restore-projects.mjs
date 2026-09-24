// =====================================================================
// restore-projects.mjs — re-adds the 5 workspace-root firmware projects to
// the live `products` table (owner decision 2026-09-24, P4). Idempotent:
// upsert by id, so re-running only refreshes the rows.
//
// Data parity: must stay in sync with the equivalent block in
// supabase/schema.sql.
//
// Run: node scripts/restore-projects.mjs
// =====================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SVC) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const PROJECTS = [
  {
    id: "4wd4m-basic",
    name: "Wireless 4WD Car",
    category: "Robot Cars",
    product_type: "Project package",
    inventory_type: "Catalog",
    price: 0,
    price_label: "Request quote",
    stock: 0,
    description:
      "Modular ESP32 4WD car. Bluetooth-SPP drive (4WD4M) plus a WiFi web-server + app drive (ESP_SER), an SH1106 OLED dashboard and a failsafe that stops the motors after 2 s of command silence. Wi-Fi provisioning happens over Bluetooth (WIFICFG).",
    note: "4WD car driven by the GENUM app, website or the car-served web page.",
    source_folder: "Genum_WIRELESS_CAR",
    estimated_duration: "2–3 hours",
    project_overview:
      "A complete 4WD robot-car platform built on the ESP32: Bluetooth SPP drive, a car-hosted responsive web page for WiFi drive, an OLED status dashboard, a 9-mode fleet registry and NVS-persisted Wi-Fi credentials.",
    objectives: [
      "Bluetooth-serial drive (4WD4M)",
      "WiFi web-server + app drive (ESP_SER)",
      "Wi-Fi provisioning over Bluetooth",
      "Automatic AP fallback (WirelessCar_Wifi)",
      "Failsafe motor stop after 2 s of command silence",
    ],
    materials_required: [
      "ESP32 Dev Module",
      "L298N motor driver",
      "4 × BO/brushed motors",
      "1.3 inch SH1106 OLED (I2C)",
      "Li-ion battery pack",
    ],
    learning_outcomes: [
      "Skid-steer (differential) drive kinematics",
      "ESP32 Bluetooth + WiFi coexistence",
      "WebSockets server + static web page",
      "NVS persistence (mode, speed, router list)",
      "Failsafe and watchdog design",
    ],
    build_steps: [
      "Wire the L298N, OLED and mode switch per Config.h",
      "Build with arduino-cli (PartitionScheme=huge_app required)",
      "Flash at 115200 baud and pair via Bluetooth",
      "Drive from the app (4WD4M) or the car web page (ESP_SER)",
      "Provision Wi-Fi over Bluetooth (WIFICFG) for networking",
    ],
    control_methods: ["Bluetooth SPP app (4WD4M)", "Car-hosted web page + WebSockets (ESP_SER)"],
    prerequisites: ["Arduino Core for ESP32 (3.3.x)", "WebSockets 2.7.2", "U8g2 (SH1106 OLED)"],
    deliverables: [
      "Genum_WIRELESS_CAR source tree with Config.h pins",
      "Wiring reference + flashing metadata",
      "storyboard.md OLED spec",
    ],
    car_mode_id: "4wd4m",
    sort_order: 1,
  },
  {
    id: "2wd1m-basic",
    name: "2WD1M Car",
    category: "Robot Cars",
    product_type: "Project package",
    inventory_type: "Catalog",
    price: 0,
    price_label: "Request quote",
    stock: 0,
    description:
      "Two-wheel car with a steering servo (2WD1M), driven over Bluetooth SPP by the hand-held ESP32 remote or app. Signed SPD (±255) controls the rear drive motor and SERVO (0..180) steers.",
    note: "2WD car with one drive motor plus a steering servo.",
    source_folder: "Genum_2WD1M_CAR",
    estimated_duration: "2 hours",
    project_overview:
      "A compact two-wheel + servo car firmware for the ESP32 with Bluetooth Classic SPP drive, an OLED dashboard and fleet mode-registry support for the 2WD1M control mode.",
    objectives: [
      "Signed-speed drive (SPD ±255)",
      "Servo steering (SERVO 0..180, centre 90)",
      "Bluetooth Classic SPP slave",
      "Fleet mode registry + COMING SOON frames",
      "Boot state restore (mode + speed)",
    ],
    materials_required: [
      "ESP32 Dev Module",
      "L298N motor driver",
      "1 × BO/brushed rear motor",
      "1 × steering servo",
      "1.3 inch SH1106 OLED (I2C)",
    ],
    learning_outcomes: [
      "Signed-speed motor control",
      "Servo steering geometry (centre 90)",
      "Bluetooth SPP pairing (PIN 1234)",
      "Boot splash + OLED dashboard",
    ],
    build_steps: [
      "Wire the L298N, servo and OLED per Config.h",
      "Build with arduino-cli at default partition",
      "Flash and pair via Bluetooth (PIN 1234)",
      "Drive with the ESP REMOTE or app in 2WD1M mode",
    ],
    control_methods: ["ESP REMOTE two-joystick (2WD1M)", "Bluetooth SPP app"],
    prerequisites: ["Arduino Core for ESP32 (3.3.x)", "U8g2 (SH1106 OLED)"],
    deliverables: ["Genum_2WD1M_CAR source tree", "Wiring reference + build metadata"],
    car_mode_id: "2wd1m",
    sort_order: 2,
  },
  {
    id: "self-balancing-basic",
    name: "Self-Balancing Car",
    category: "Robot Cars",
    product_type: "Project package",
    inventory_type: "Catalog",
    price: 0,
    price_label: "Request quote",
    stock: 0,
    description:
      "Two-wheeled self-balancing robot on the ESP32 with an MPU6050 IMU, runtime-tunable PID control, Bluetooth command/telemetry and an SH1106 OLED. Balances autonomously in AUTO mode.",
    note: "Self-balancing two-wheel bot with live PID tuning.",
    source_folder: "Genum_SELF_BALANCE_CAR",
    estimated_duration: "2–3 hours",
    project_overview:
      "A modular ESP32 self-balancing robot: MPU6050 + complementary filter, PID control tunable at runtime, Bluetooth telemetry (Kp/Ki/Kd/OUT/OFF), OLED status UI and a failsafe motor stop.",
    objectives: [
      "Autonomous balancing (MPU6050 + complementary filter)",
      "Runtime PID tuning with persistent storage",
      "Bluetooth telemetry + legacy PID commands",
      "OLED status + telemetry UI",
      "Failsafe motor stop on comms loss",
    ],
    materials_required: [
      "ESP32 Dev Module",
      "L298N H-bridge",
      "2 × DC motors",
      "MPU6050 IMU (I2C)",
      "1.3 inch SH1106 OLED (I2C)",
      "Pushbutton (mode switch)",
    ],
    learning_outcomes: [
      "PID control + complementary filtering",
      "IMU reading over I2C",
      "Runtime tuning via Bluetooth tokens",
      "Singleton persistence layer (NVS/EEPROM)",
      "Non-blocking main loop",
    ],
    build_steps: [
      "Wire I2C plus motor driver per Config.h defaults",
      "Build with arduino-cli at default partition",
      "Flash, then pair via Bluetooth (PIN 1234)",
      "Balance and tune Kp/Ki/Kd/OUT/OFF live from the app or remote",
    ],
    control_methods: ["ESP REMOTE (PID calibration)", "Bluetooth SPP app (AUTO drive)"],
    prerequisites: ["Arduino Core for ESP32 (3.3.x)", "U8g2 (SH1106 OLED)", "MPU6050 (I2C, Wire)"],
    deliverables: ["Genum_SELF_BALANCE_CAR source tree", "Wiring reference (pin map in Config.h)"],
    car_mode_id: "self-balancing",
    sort_order: 3,
  },
  {
    id: "esp32-remote",
    name: "ESP32 Remote Controller",
    category: "Robot Cars",
    product_type: "Project package",
    inventory_type: "Catalog",
    price: 0,
    price_label: "Request quote",
    stock: 0,
    description:
      "Bluetooth (SPP master) hand-held remote for the GENUM car fleet: two joysticks, an SH1106 OLED, mode switching, joystick calibration, telemetry parsing and a coalescing command queue with safe-stop on disconnect.",
    note: "Hand-held ESP32 remote that drives the 2WD1M, self-balancing and wireless cars.",
    source_folder: "Genum_REMOTE_ESP32",
    estimated_duration: "2 hours",
    project_overview:
      "The fleet remote controller firmware: dual-joystick drive input, OLED menus (greeting, discovery, dashboard, tuning), saved-network cache and always-on OTA so later updates are wireless.",
    objectives: [
      "Dual-joystick drive + steering input",
      "OLED UI: discovery, dashboard, tuning screens",
      "Mode switching incl. 2WD1M + AUTO calibration",
      "Joystick calibration + EEPROM state",
      "Safe-stop on disconnect + OTA updates",
    ],
    materials_required: [
      "ESP32 Dev Module",
      "2 × analog joysticks",
      "2 × pushbuttons + joystick click",
      "1.3 inch SH1106 OLED (I2C)",
    ],
    learning_outcomes: [
      "Bluetooth SPP master pairing",
      "Coalescing command queue",
      "OLED menu state-machine",
      "NVS/EEPROM persistence",
      "ArduinoOTA delivery",
    ],
    build_steps: [
      "Build with PartitionScheme=min_spiffs",
      "Flash once over USB (115200)",
      "Pair to a GENUM car (PIN 1234)",
      "Deliver later updates over the air (ESP32_Remote_OTA)",
    ],
    control_methods: ["ESP REMOTE hand-held (2WD1M / self-balancing / wireless)"],
    prerequisites: ["Arduino Core for ESP32 (3.3.x)", "U8g2 (SH1106 OLED)"],
    deliverables: ["Genum_REMOTE_ESP32 source tree", "Run sheets for device rounds 7–13"],
    car_mode_id: null,
    sort_order: 4,
  },
  {
    id: "smart-dustbin",
    name: "Smart Dustbin",
    category: "Robot Cars",
    product_type: "Project package",
    inventory_type: "Catalog",
    price: 0,
    price_label: "Request quote",
    stock: 0,
    description:
      "Autonomous smart dustbin: ESP32 + HC-SR04 ultrasonic + continuous servo. Approach detection opens the lid, open/close timing is tuned by constants, and the usage count persists across power cycles. Standalone IoT device.",
    note: "Hands-free lid that opens on approach, with persisted usage count.",
    source_folder: "Genum_SMART_DUSTBIN",
    estimated_duration: "1–2 hours",
    project_overview:
      "A single self-contained ESP32 sketch that senses an approaching hand or object with an ultrasonic sensor and opens the bin lid with a continuous servo, keeping a power-cycle-safe usage counter.",
    objectives: [
      "Ultrasonic approach detection (HC-SR04)",
      "Servo lid open/close on approach",
      "Tunable open/close timing constants",
      "Usage count persisted via Preferences",
      "Single self-contained sketch, no radio",
    ],
    materials_required: [
      "ESP32 Dev Module",
      "HC-SR04 ultrasonic sensor",
      "Continuous rotation servo",
      "Battery/power for the servo",
    ],
    learning_outcomes: [
      "Ultrasonic ranging (TRIG/ECHO GPIO)",
      "Servo PWM control",
      "Preferences-backed counters",
      "Simple state machine",
    ],
    build_steps: [
      "Wire ultrasonic (TRIG 5, ECHO 18) and servo (signal 23)",
      "Build with arduino-cli at default partition",
      "Flash over USB and power on",
      "Tune open/close timing in the sketch constants",
    ],
    control_methods: ["None — standalone IoT device"],
    prerequisites: ["Arduino Core for ESP32 (3.3.x)"],
    deliverables: ["Genum_SMART_DUSTBIN source tree", "Wiring reference (pin table)"],
    car_mode_id: null,
    sort_order: 5,
  },
];

const svc = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data, error } = await svc
    .from("products")
    .upsert(PROJECTS, { onConflict: "id" })
    .select("id, name, car_mode_id");
  if (error) throw error;
  for (const row of data ?? []) {
    console.log(`upserted ${row.name} (${row.id}) car_mode=${row.car_mode_id ?? "-"}`);
  }
  console.log(`restore-projects: ${(data ?? []).length} rows in place.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
