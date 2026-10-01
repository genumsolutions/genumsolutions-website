// =====================================================================
// device-registry.ts — the website's reader for the shared device registry
// (`device_models`, `devices`, `user_devices`) plus the planned-mode flags.
//
// Added 2026-10-01. Before this, none of those tables had ANY website read,
// which meant the site could not show a garage and could not surface the
// fact that six of the nine modes have no firmware behind them.
//
// Source of truth follows the same pattern the repo already uses elsewhere
// (`getManagedRoBoModes`, `getProjectCategories`): database first, bundled
// fallback when Supabase is unavailable, and never throw. A marketing site
// must still render with the database down.
//
// RLS note: `device_models` is public-read, so the anon client can fetch it.
// `devices` and `user_devices` are NOT — they need the signed-in user's own
// session, so those reads go through createClient() (RLS-scoped), never the
// anon key and never the service role for a self-service request.
// =====================================================================
import { createClient, createServiceClient, supabaseConfigured } from "./supabase/server";

export type DeviceTransport =
  | "classic-bt"
  | "ble"
  | "wifi"
  | "wifi-ap"
  | "wifi-sta"
  | "http"
  | "websocket"
  | "rf"
  | "wifi-ap-ota";

export type DeviceModel = {
  id: string;
  displayName: string;
  repo: string;
  fwName: string;
  fwVersion: string;
  /**
   * FROZEN advertised Bluetooth name. What the OS pairing list shows, and
   * deliberately NOT the same string as displayName — renaming hardware
   * breaks saved pairings, so the registry records the two separately.
   */
  btName: string | null;
  apSsid: string | null;
  apIp: string | null;
  transports: DeviceTransport[];
};

/** Bundled fallback; mirrors guide/DEVICE-REGISTRY.json. */
export const LOCAL_DEVICE_MODELS: DeviceModel[] = [
  {
    id: "4wd4m",
    displayName: "4WD 4-Motor Car",
    repo: "Genum_4WD4M_CAR",
    fwName: "4WD4M Car",
    fwVersion: "1.0.0",
    btName: "4WD CAR",
    apSsid: "4WDCar_Wifi",
    apIp: "192.168.245.1",
    transports: ["classic-bt", "wifi-ap", "wifi-sta", "http", "websocket"],
  },
  {
    id: "2wd1m",
    displayName: "2WD + Servo Car (1 Motor)",
    repo: "Genum_2WD1M_CAR",
    fwName: "2 Wheel Drive Car",
    fwVersion: "1.0.4",
    btName: "2 WHEEL DRIVE CAR",
    apSsid: null,
    apIp: null,
    transports: ["classic-bt"],
  },
  {
    id: "self-balancing",
    displayName: "Self-Balancing Car",
    repo: "Genum_SELF_BALANCE_CAR",
    fwName: "Self Balancing Bot",
    fwVersion: "1.2.2",
    btName: "SELF BALANCING BOT",
    apSsid: null,
    apIp: null,
    transports: ["classic-bt", "wifi"],
  },
  {
    id: "wireless-car",
    displayName: "Wireless Car",
    repo: "Genum_WIRELESS_CAR",
    fwName: "Wireless Car",
    fwVersion: "1.8.0",
    btName: "WIRELESS CAR",
    apSsid: null,
    apIp: null,
    transports: ["classic-bt", "wifi-ap", "wifi-sta", "http", "websocket"],
  },
  {
    id: "smart-dustbin",
    displayName: "Smart Dustbin",
    repo: "Genum_SMART_DUSTBIN",
    fwName: "Smart Dustbin",
    fwVersion: "1.0.0",
    btName: null,
    apSsid: null,
    apIp: null,
    transports: ["wifi"],
  },
  {
    id: "remote-esp32",
    displayName: "ESP32 Remote Controller",
    repo: "Genum_REMOTE_ESP32",
    fwName: "Esp32 Remote",
    fwVersion: "1.6.7",
    btName: "REMOTE_CTRL",
    apSsid: "ESP32_Remote_OTA",
    apIp: null,
    transports: ["classic-bt", "rf", "wifi-ap-ota"],
  },
];

export type UserDevice = {
  deviceId: string;
  /** The owner's own name for this unit; falls back to the model name. */
  displayName: string;
  model: DeviceModel | null;
  /** Stable identity: `fw:<boardId>` | BT MAC | `wifi:<ssid>`. */
  uniqueId: string;
  isFavourite: boolean;
  lastSeenAt: string | null;
  fwVersion: string;
};

export type ModePlannedFlag = {
  modeId: string;
  isPlanned: boolean;
  firmwareRepo: string | null;
  note: string;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function parseModel(row: Record<string, unknown>): DeviceModel | null {
  const id = str(row.id);
  const displayName = str(row.display_name);
  if (!id || !displayName) return null;
  return {
    id,
    displayName,
    repo: str(row.repo) ?? "",
    fwName: str(row.fw_name) ?? "",
    fwVersion: str(row.fw_version) ?? "",
    btName: str(row.bt_name),
    apSsid: str(row.ap_ssid),
    apIp: str(row.ap_ip),
    transports: Array.isArray(row.transports)
      ? (row.transports.filter((t) => typeof t === "string") as DeviceTransport[])
      : [],
  };
}

export function localModel(id: string): DeviceModel | null {
  return LOCAL_DEVICE_MODELS.find((m) => m.id === id) ?? null;
}

/** All fleet models, database-first with the bundled fallback. */
export async function getDeviceModels(): Promise<DeviceModel[]> {
  if (!supabaseConfigured()) return LOCAL_DEVICE_MODELS;
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("device_models")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return LOCAL_DEVICE_MODELS;
    const parsed = (data as Record<string, unknown>[]).map(parseModel);
    const models = parsed.filter((m): m is DeviceModel => m !== null);
    return models.length ? models : LOCAL_DEVICE_MODELS;
  } catch (error) {
    console.error("device_models read failed; using bundled registry.", error);
    return LOCAL_DEVICE_MODELS;
  }
}

/** Flags for modes whose firmware does not exist yet. */
export async function getModePlannedFlags(): Promise<ModePlannedFlag[]> {
  if (!supabaseConfigured()) return [];
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("robo_car_modes_flags")
      .select("mode_id,is_planned,firmware_repo,note");
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      modeId: String(r.mode_id ?? ""),
      isPlanned: r.is_planned === true,
      firmwareRepo: str(r.firmware_repo),
      note: str(r.note) ?? "",
    }));
  } catch (error) {
    console.error("robo_car_modes_flags read failed.", error);
    return [];
  }
}

/**
 * The signed-in user's garage.
 *
 * Uses the RLS-scoped client, never the service role: this is a self-service
 * read, and using the service client would bypass the row policies that
 * exist to keep one user's devices private from another.
 */
export async function getUserDevices(userId: string): Promise<UserDevice[]> {
  if (!supabaseConfigured()) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_devices")
      .select(
        "device_id,display_name,is_favourite,devices(id,unique_id,model_id,fw_version,last_seen_at)"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).flatMap((row) => {
      const device = (row.devices ?? null) as Record<string, unknown> | null;
      const deviceId = str(row.device_id);
      if (!deviceId) return [];
      const modelId = device ? str(device.model_id) : null;
      const own = str(row.display_name);
      return [
        {
          deviceId,
          uniqueId: (device ? str(device.unique_id) : null) ?? "",
          displayName: own || localModel(modelId ?? "")?.displayName || "Car",
          model: modelId ? localModel(modelId) : null,
          isFavourite: row.is_favourite === true,
          lastSeenAt: device ? str(device.last_seen_at) : null,
          fwVersion: (device ? str(device.fw_version) : null) ?? "",
        },
      ];
    });
  } catch (error) {
    console.error("user_devices read failed.", error);
    return [];
  }
}

/**
 * The name a user will actually SEE when pairing, which is not the same as
 * the name in the app. A car shown as "4WD 4-Motor Car" is announced as
 * "4WD CAR", and the operating system lists the announced name — so showing
 * both is what stops "where has my car gone" confusion.
 */
export function pairingLabel(model: DeviceModel | null): string {
  if (!model) return "Unknown device";
  if (model.btName && model.btName !== model.displayName)
    return `${model.displayName} — pairs as “${model.btName}”`;
  return model.displayName;
}
