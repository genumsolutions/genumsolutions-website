# Website (genumsolutions-website) — Admin UI Blueprint

## Overview

Admin panels located in `components/admin/`. Provides centralized admin dashboard for managing company settings, user profiles, logs, products, content, and system configuration.

## Top-Level Navigation

The website admin uses Next.js page routes with React components for each admin panel:

| Path | Component | Description |
| --- | --- | --- |
| `/admin` | `AdminDashboard.tsx` | Main dashboard overview — KPIs, recent activity |
| `/admin/settings` | `AdminSettings.tsx` | Company information editing (17 fields) |
| `/admin/logs` | `AdminLogs.tsx` (via `AdminLogsHub`) | System logs, user activity, user profiles, fleet diagnostics (3 sections) |
| `/admin/users` | `AdminUsers.tsx` | User directory, car profiles, robot profiles (3 sections) |
| `/admin/products` | `AdminProducts.tsx` | Electronic products catalog |
| `/admin/3d-printing` | `Admin3DProducts.tsx` | 3D printing products catalog |
| `/admin/projects` | `AdminProjects.tsx` | Project packages, components |
| `/admin/content` | `AdminContent.tsx` | Services, journal, home page copy |
| `/admin/activity` | `AdminActivity.tsx` | Activity tracking |
| `/admin/finance` | `AdminFinance.tsx` | Financial data, orders, transactions |

Tab order is identical on the app and website (enforced by parity tests: `admin-parity.test.ts`).

## Active Tab: Users — 3 Sections (Nov 2026 Reorganization)

The Users tab (`AdminUsers.tsx`) now has 3 sections, mirroring the app's Users tab structure.

### Section Selector (Top)

- 3 pills: "User Directory", "Car Profiles", "Robot Profiles"
- Active pill: `border-b-2 border-navy text-navy py-1`
- Inactive pill: `border-b-0 py-1`
- Layout: `flex border-b border-line pb-3 mb-4`

### Section 1: User Directory

**Component:** `UsersDirectory` (defined in AdminUsers.tsx)

**Header:**

- Label: `"User Directory"` (text-xs font-black uppercase tracking-widest text-navy)
- Subtext: "Search and manage user accounts and their basic information."
- Components: search input (`textInput` style, placeholder "Search users..."), Clear button (bg-navy px-4 py-2 text-xs font-black text-white)

**State:**

- `search: string` — internal search state, filters by name or email lowercase includes

**Per-user row (`li`):**

- Container: `border border-line bg-white p-4`
- Layout: `flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between`
- Top section (min-w-0): name (text-sm font-bold) + email (font-normal text-slate-500) + phone (text-xs text-slate-400, if present) + address (break-words text-xs text-slate-400, if present) + joined date (text-xs text-slate-400) + last seen (text-xs text-slate-400, if present)
- Bottom section (flex w-full flex-wrap gap-2 sm:w-auto):
  - Role select (disabled: !canDelete): border-line bg-white px-2 py-1.5 text-xs font-bold
  - Tier toggle: Upgrade to Pro (border-line px-3 py-1.5 text-xs font-bold text-slate-500) or Downgrade to Free (same style)
  - Delete user (owner only, canDelete): border-red-200 px-3 py-1.5 text-xs font-bold text-red-600

**Edit pattern:** Read-only by default. No "Edit" button — role/tier are inline controls.

### Section 2: Car Profiles

**Component:** `CarProfilesSection` (defined in AdminUsers.tsx)

**Header:**

- Label: `"Car Profiles"` (text-xs font-black uppercase tracking-widest text-navy)
- Subtext: "Per-car rows from car_profiles — the profile key is the board's stable identity (fw:, Bluetooth MAC, wifi:). The app reads the same rows; no Wi-Fi passwords are stored here."

**State:**

- `profiles: CarProfileRow[] | null` — null = loading, [] = empty, [rows] = data
- `editingKey: string | null` — which profile is being edited (null = none)
- `draftName: string`, `draftJson: string` — form fields

**Per-car row (`li`):**

- Container: `rounded-lg border border-line bg-white p-3`
- Layout: `flex flex-wrap items-center justify-between gap-2`
- Left (min-w-0): car name (text-xs font-bold, or "Untitled profile") + profile_key (font-mono font-normal text-slate-400) + settings count + updated date + unique_id (if present, "id {unique_id}")
- Right (flex gap-2):
  - Edit button (disabled: !canDelete, title: "Only administrators can edit project profiles"): border-line px-3 py-1 text-xs font-bold text-navy
  - Delete button (canDelete): border-red-200 px-3 py-1 text-xs font-bold text-red-600

**Edit form (inline, when editingKey === profile.profile_key):**

- TextInput for name (placeholder "Profile display name", w-full text-xs)
- Textarea for settings JSON (rows=6, font-mono text-xs, placeholder "Project profile settings JSON")
- Save button: bg-emerald-600 px-4 py-1.5 text-xs font-black text-white
- Cancel button: border-line px-4 py-1.5 text-xs font-bold text-ink

**Add new (when canDelete):**

- Label (text-xs font-bold text-slate-500): "Add profile by key" + input (placeholder "e.g. fw:1FB608", w-48 text-xs)
- Button: border-line px-4 py-2 text-xs font-bold text-navy

**Edit pattern:**

1. Read-only card by default (name, profile_key, settings count, date, Edit + Delete buttons)
2. Tap "Edit" → inline form appears (inputs for name + JSON, Save/Cancel buttons)
3. Tap "Save" → `send("upsertCarProfile", {profileKey, carName, settings})` → onSuccess: `setEditingKey(null)`, re-fetch, `setMessage("Project profile saved for ...")`
4. Tap "Cancel" → `setEditingKey(null)` (no changes)
5. Staff: Edit button disabled (opacity-50, title tooltip)
6. Admin+: Edit enabled, Delete enabled (confirm dialog)

### Section 3: Robot Profiles

**Component:** `RobotProfilesSection` (defined in AdminUsers.tsx)

**Header:**

- Label: `"Robot Profiles"` (text-xs font-black uppercase tracking-widest text-navy)
- Subtext: "Per-robot code values, parameters, and telemetry channels — stored separately from orders/carts. The app reads the same rows."

**State:**

- `robots: RobotRow[] | null` — null = loading, [] = empty, [rows] = data
- `editingId: string | null` — which robot is being edited (null = none)
- `draftName: string`, `draftJson: string` — form fields

**Per-robot row (`li`):**

- Container: `rounded-lg border border-line bg-white p-3`
- Layout: `flex flex-wrap items-center justify-between gap-2`
- Left (min-w-0): robot name (text-xs font-bold, or robot_id if name empty) + robot_id (font-mono font-normal text-slate-400) + settings count + updated date
- Right (flex gap-2):
  - Edit button: border-line px-3 py-1 text-xs font-bold text-navy
  - Delete button (canDelete): border-red-200 px-3 py-1 text-xs font-bold text-red-600

**Edit form (inline, when editingId === robot.robot_id):**

- TextInput for name (placeholder "Robot display name", w-full text-xs)
- Textarea for settings JSON (rows=6, font-mono text-xs, placeholder "Settings JSON")
- Save button: bg-emerald-600 px-4 py-1.5 text-xs font-black text-white
- Cancel button: border-line px-4 py-1.5 text-xs font-bold text-ink

**Add new (when canDelete):**

- Label (text-xs font-bold text-slate-500): "Add robot by id" + input (placeholder "e.g. 2wd1m-basic", w-48 text-xs)
- Button: border-line px-4 py-2 text-xs font-bold text-navy

**Edit pattern:**

1. Read-only card by default (name, robot_id, settings count, updated date, Edit + Delete buttons)
2. Tap "Edit" → inline form appears (inputs for name + JSON, Save/Cancel buttons)
3. Tap "Save" → `send("upsertRobotSetting", {robotId, robotName, settings})` → onSuccess: `setEditingId(null)`, re-fetch, `setMessage("Robot settings saved for ...")`
4. Tap "Cancel" → `setEditingId(null)` (no changes)
5. Delete: confirm dialog, calls `send("deleteRobotSetting", ...)`

---

## Active Tab: Logs — 3 Sections

The Logs tab has 3 sections via a section switch, mirroring the app's Logs tab.

### Section Selector (Top)

- 3 pills: "User Activity", "User Profiles", "Fleet Diagnostics"
- Active pill: bg-navy text-white
- Inactive pill: text-slate-500
- Layout: flex gap-1 pb-3 mb-4

### Section 1: User Activity

**Component:** `ActivityTable` inside `AdminLogsHub`

**Content:** `user_activity_log` rows, filtered by search input.

**Columns:**

- Timestamp (text-xs text-slate-500)
- User (email, text-sm font-medium text-ink)
- Action (text-sm font-medium capitalize)
- Entity (type + id, text-xs text-slate-500, font-mono)
- Details (JSON summary, text-xs text-slate-500, max-w-[200px])
- Level (badge: info=blue, warn=amber, error=red)

### Section 2: User Profiles

**Component:** `ProfileEntriesTable` inside `AdminLogsHub`

**Content:** `user_profile_entries` rows, filtered by search input.

**Columns:**

- Title (text-sm font-medium text-ink, or "(untitled)" if empty)
- Type (text-xs text-slate-500, capitalize)
- Created at (text-xs text-slate-500)
- Actions: Edit button (border-line px-3 py-1 text-xs font-bold text-navy)

**Edit pattern:** Same as app — read-only by default, Edit → form → Save/Cancel.

### Section 3: Fleet Diagnostics

**Components:** `CrashReports` + `AppLogs` inside `AdminLogsHub`

**Crash Reports table:**

- Columns: Timestamp, Car name, Board id, Error summary, Reported at
- Empty state: "No crash reports yet."

**App Logs section:**

- Scope filter: dropdown (All scopes, link/wifi, all-other) — same as app
- Severity filter: radio (All severities, Warnings only, Errors only) — same as app
- Search input: text input, placeholder "Filter logs…"
- Apply button: bg-navy px-4 py-2 text-xs font-black text-white
- Log rows: Timestamp, Level badge (color-coded), Message (text-sm), Scope (font-mono text-xs text-slate-500), Detail (JSON expandable via expand button)

---

## Active Tab: Settings

**Component:** `AdminSettings.tsx`

**Company Information** (17 fields):

1. Name (input)
2. Short name (input)
3. URL / Website URL (input) — unique to website, matches app after U-I6
4. Address (textarea, rows=2)
5. City (input)
6. Country (input)
7. Email (input, required)
8. Phone (input)
9. PAN (input)
10. VAT label (input)
11. Description (input)
12. WhatsApp number (input)
13. Facebook URL (input)
14. Instagram URL (input)
15. TikTok URL (input)
16. LinkedIn URL (input)
17. YouTube URL (input)

**Edit pattern:**

1. Read-only mode (default): fields display as plain text spans
2. Tap "Edit" (text-sm text-navy hover:underline) → form inputs appear, pre-filled
3. Tap "Save" (form submit) → submits to `/api/admin/settings?action=company`, on success: `setIsEditing(false)`, `setMessage("Company information saved.")`
4. Tap "Cancel" (text-sm text-muted hover:underline) → `setIsEditing(false)`, no changes

---

## Key Types

### `Company` (`lib/company.ts`)

```typescript
export type Company = {
  name: string;
  shortName: string;
  url: string; // Website URL
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  pan: string;
  vatLabel: string;
  description: string;
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
};
// 17 fields total (matches app exactly)
```

### `CarProfileRow` (defined in AdminUsers.tsx)

```typescript
type CarProfileRow = {
  id: string;
  profile_key: string;  // Stable identity: fw:boardId, MAC, or wifi:uuid
  car_name: string;
  unique_id: string;
  settings: Record<string, unknown>;
  updated_at: string;
};
```

### `RobotRow` (defined in AdminUsers.tsx)

```typescript
type RobotRow = {
  robot_id: string;
  robot_name: string;
  settings: Record<string, unknown>;
  updated_at: string;
};
```

### `ManagedUser` (`components/admin/admin-types.ts`)

```typescript
export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  tier?: string;
  createdAt: string;
  lastSignInAt: string | null;
};
```

## Responsive Design

The website uses Tailwind CSS with responsive prefixes:

- `sm:` for small screens and up — layout changes from vertical stack to side-by-side
- `flex-col sm:flex-row` — vertical on mobile, horizontal on desktop
- `w-full sm:w-64` — full width on mobile, fixed width on desktop
- `sm:flex-row sm:items-center sm:justify-between` — action cluster stacks on mobile, side-by-side on desktop

---

_Document generated: 2026-11-09_
_Total docs in website repo: WEBSITE_ADMIN_COMPLETE.md, ADMIN_UI_BLUEPRINT.md, APP_WEBSITE_UI_COMPARISON.md, ADMIN_COHERENCE.md_
_Both repos: TypeScript 0 errors, green CI on all tests (955 mobile + 301 website)_
