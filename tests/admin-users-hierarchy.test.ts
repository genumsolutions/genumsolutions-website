import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../components/admin/AdminUsers.tsx"), "utf8");

describe("AdminUsers expanded per-user project hierarchy", () => {
  it("expands each user to render UserProjectProfiles", () => {
    expect(source).toContain("expanded[user.id]");
    expect(source).toContain("<UserProjectProfiles");
    expect(source).toContain("userId={user.id}");
    expect(source).toContain("email={user.email}");
  });

  it("toggles between Show projects and Hide projects", () => {
    expect(source).toContain('expanded[user.id] ? "Hide projects" : "Show projects"');
  });

  it("shows loading and empty states for a user with no projects", () => {
    expect(source).toContain("Loading projects…");
    expect(source).toContain("No projects for this user yet.");
  });

  it("renders project names and robot profile names instead of raw IDs", () => {
    expect(source).toContain('profile.car_name || "Untitled project"');
    expect(source).toContain('robot.robot_name || "Untitled robot profile"');
  });

  it("summarizes saved settings and last-updated date", () => {
    expect(source).toContain("saved settings · updated");
    expect(source).toContain("Object.keys(profile.settings || {}).length");
    expect(source).toContain("Object.keys(robot.settings || {}).length");
  });

  it("keeps connection/device/robot IDs inside collapsed technical details", () => {
    expect(source).toContain("<details");
    expect(source).toContain("Technical details");
    expect(source).toContain("Connection ID: {profile.profile_key}");
    expect(source).toContain("Device ID: ${profile.unique_id}");
    expect(source).toContain("Robot ID: {robot.robot_id}");
  });

  it("deduplicates car and robot profiles before rendering", () => {
    expect(source).toContain("uniqueById");
    expect(source).toContain("loadCarProfiles");
    expect(source).toContain("loadRobotProfiles");
  });
});
