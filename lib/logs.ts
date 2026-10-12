import { createServiceClient } from "./supabase/server";

// Fleet-facing diagnostics for the admin "System Logs" panel. Two bounded,
// newest-first lists mirroring the app's two write paths:
//
//   1. device_crash_reports — one row per connection session the app synced
//      from a car's restart record (crashReportService).
//   2. app_logs — warn/error ring-buffer rows flushed from the phone
//      (appLogService + logger).
//
// Both are service-client reads under the /api/admin/logs route, which is
// gated by isStaffRequest() — never exposed raw to the client.

type CrashReportRow = {
  id: string;
  board_id: string;
  model_id: string | null;
  fw_version: string;
  app_version: string;
  platform: string;
  connection_method: string;
  reset_reason: string | null;
  boot_count: number | null;
  crash_count: number | null;
  last_crash_phase: string | null;
  last_crash_heap: number | null;
  has_crash: boolean;
  reported_at: string;
};

type AppLogRow = {
  id: string;
  app_version: string;
  platform: string;
  scope: string;
  level: "info" | "warn" | "error";
  message: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type LogsList<T> = {
  entries: T[];
  total: number;
  page: number;
  totalPages: number;
};

type PageOptions = { page?: number; limit?: number };

function normalizePage(options: PageOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  return { page, limit };
}

export async function listDeviceCrashReports(
  options: PageOptions = {}
): Promise<LogsList<CrashReportRow>> {
  const { page, limit } = normalizePage(options);
  const supabase = createServiceClient();
  const { data, count } = await supabase
    .from("device_crash_reports")
    .select("*", { count: "exact" })
    .order("reported_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  const entries = (data as CrashReportRow[] | null) ?? [];
  const total = count ?? 0;
  return { entries, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listAppLogs(options: PageOptions = {}): Promise<LogsList<AppLogRow>> {
  const { page, limit } = normalizePage(options);
  const supabase = createServiceClient();
  const { data, count } = await supabase
    .from("app_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  const entries = (data as AppLogRow[] | null) ?? [];
  const total = count ?? 0;
  return { entries, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
