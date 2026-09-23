import { createServiceClient } from "./supabase/server";

// =====================================================================
// Admin-side per-user engineering data (tier + robot preference rows).
// Everything here runs on the SERVICE ROLE from admin-only API routes:
// tier changes bypass protect_tier_column the same way role changes
// bypass protect_role_column, and robot_user_settings rows are reachable
// for every user so the admin panel can manage any account's profile.
// =====================================================================

export type UserTier = "free" | "pro";

export async function updateUserTier(userId: string, tier: UserTier): Promise<boolean> {
  const { error } = await createServiceClient().from("profiles").update({ tier }).eq("id", userId);
  return !error;
}

export type RobotSettingRow = {
  robot_id: string;
  robot_name: string;
  settings: Record<string, unknown>;
  updated_at: string;
};

export async function listUserRobotSettings(userId: string): Promise<RobotSettingRow[]> {
  const { data } = await createServiceClient()
    .from("robot_user_settings")
    .select("robot_id, robot_name, settings, updated_at")
    .eq("user_id", userId)
    .order("robot_name", { ascending: true });
  return (data as RobotSettingRow[] | null) || [];
}

export async function upsertUserRobotSettings(
  userId: string,
  robotId: string,
  robotName: string,
  settings: Record<string, unknown>
): Promise<boolean> {
  const { error } = await createServiceClient().from("robot_user_settings").upsert(
    {
      user_id: userId,
      robot_id: robotId,
      robot_name: robotName,
      settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,robot_id" }
  );
  return !error;
}

export async function deleteUserRobotSetting(userId: string, robotId: string): Promise<boolean> {
  const { error } = await createServiceClient()
    .from("robot_user_settings")
    .delete()
    .eq("user_id", userId)
    .eq("robot_id", robotId);
  return !error;
}
