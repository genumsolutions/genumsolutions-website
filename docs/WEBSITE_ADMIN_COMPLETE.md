# Website (genumsolutions-website) — Complete Admin UI Documentation

## 1. Admin Dashboard Overview

The website admin dashboard provides centralized management for all administrative functions. It uses a panel-based layout rather than a simple tab bar, with all admin panels accessible through the admin navigation.

### 1.1 Top-Level Navigation Structure

The website admin uses Next.js page routes with React components for each admin panel:

| Section/Path         | Component                            | Description                                                               |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `/admin`             | `AdminDashboard.tsx`                 | Main dashboard overview — KPIs, recent activity                           |
| `/admin/settings`    | `AdminSettings.tsx`                  | Company information editing (17 fields)                                   |
| `/admin/logs`        | `AdminLogs.tsx` (via `AdminLogsHub`) | System logs, user activity, user profiles, fleet diagnostics (3 sections) |
| `/admin/users`       | `AdminUsers.tsx`                     | User directory, car profiles, robot profiles (3 sections)                 |
| `/admin/products`    | `AdminProducts.tsx`                  | Electronic products catalog                                               |
| `/admin/3d-printing` | `Admin3DProducts.tsx`                | 3D printing products catalog                                              |
| `/admin/projects`    | `AdminProjects.tsx`                  | Project packages, components                                              |
| `/admin/content`     | `AdminContent.tsx`                   | Services, journal, home page copy                                         |
| `/admin/activity`    | `AdminActivity.tsx`                  | Activity tracking                                                         |
| `/admin/finance`     | `AdminFinance.tsx`                   | Financial data, orders, transactions                                      |

Tab order is identical on the app and website (enforced by parity tests).

### 1.2 Active Tab: Users — Reorganized (Nov 2026)

The **Users** tab (`AdminUsers.tsx`) now has 3 sections, mirroring the app's Users tab structure:

#### Section 1: User Directory

**Header**:

- Label: `"User Directory"` (text-xs font-black uppercase tracking-widest text-navy)
- Subtext: `"Search and manage user accounts and their basic information."`
- Components: search input, Clear button

**Per-user row layout**:

- Container: `li border border-line bg-white p-4`
- Top row: name + email + phone (if present) + address (if present) + joined date + last seen (if present)
- Bottom row (flex-col sm:flex-row gap-3 sm:items-center sm:justify-between): role select (disabled: canDelete), tier toggle buttons (Upgrade to Pro / Downgrade to Free), Delete user button (owner only)

**Search**: internal `search` state, filters by name or email lowercase includes.

**Interactions**:

- Role select: `onValueChange` → validates role
- Tier toggle: calls `setMessage("Upgrade/Downgrade ...")` — informational only
- Delete user: confirm dialog, calls delete

#### Section 2: Car Profiles

**Header**:

- Label: `"Car Profiles"` (text-xs font-black uppercase tracking-widest text-navy)
- Subtext: `"Per-car rows from car_profiles — the profile key is the board's stable identity (fw:, Bluetooth MAC, wifi:). The app reads the same rows; no Wi-Fi passwords are stored here."`

**Per-car row**:

- Container: `li rounded-lg border border-line bg-white p-3`
- Top: car name (or "Untitled profile") + profile_key (font-mono text-slate-400), settings keys count + updated date + unique_id (if present)
- Actions row: Edit button (disabled: !canDelete, title: "Only administrators can edit project profiles"), Delete button (canDelete, red)

**Edit form (inline):**

- `input` for name (placeholder "Profile display name")
- `textarea` (rows=6, font-mono) for settings JSON (placeholder "Project profile settings JSON")
- Save button: bg-emerald-600, "Save"
- Cancel button: border-line, "Cancel"
- Save → `send("upsertCarProfile", {profileKey, carName, settings})` → onSuccess: re-fetch, `setEditingKey(null)`
- Cancel → `setEditingKey(null)` (no changes)

**Add new (canDelete):**

- `input` for new profile key (placeholder "e.g. fw:1FB608")
- "Add profile" button
- Add → `send("upsertCarProfile", ...)` → onSuccess: re-fetch

**Edit pattern (consistent across app and website):**

1. Read-only card by default (name, profile_key, settings count, date, Edit + Delete buttons)
2. Tap "Edit" → inline form appears (inputs for name + JSON, Save/Cancel buttons)
3. Tap "Save" → async call, on success: form closes, re-fetch, `setMessage("Project profile saved for ...")`
4. Tap "Cancel" → form closes, no changes, `setEditingKey(null)`
5. Staff: Edit button disabled (`opacity-50`), title tooltip says "Only administrators can edit project profiles"
6. Admin+: Edit enabled, Delete enabled (with confirm dialog)

#### Section 3: Robot Profiles

**Header**:

- Label: `"Robot Profiles"` (text-xs font-black uppercase tracking-widest text-navy)
- Subtext: `"Per-robot code values, parameters, and telemetry channels — stored separately from orders/carts. The app reads the same rows."`

**Per-robot row**:

- Container: `li rounded-lg border border-line bg-white p-3`
- Top: robot name (or robot_id if name empty) + robot_id (font-mono text-slate-400), settings keys count + updated date
- Actions row: Edit button, Delete button (canDelete, red)

**Edit form (inline):**

- `input` for robot name (placeholder "Robot display name")
- `textarea` (rows=6, font-mono) for settings JSON (placeholder "Settings JSON")
- Save button: bg-emerald-600, "Save"
- Cancel button: border-line, "Cancel"
- Save → `send("upsertRobotSetting", {robotId, robotName, settings})` → onSuccess: re-fetch, `setEditingId(null)`
- Cancel → `setEditingId(null)` (no changes)

**Add new (canDelete):**

- `input` for new robot id (placeholder "e.g. 2wd1m-basic")
- "Add profile" button
- Add → `send("upsertRobotSetting", ...)` → onSuccess: re-fetch

**Edit pattern (same as Car Profiles and app):**

1. Read-only card by default (name, robot_id, settings count, updated date, Edit + Delete buttons)
2. Tap "Edit" → inline form appears (inputs for name + JSON, Save/Cancel)
3. Tap "Save" → async call, on success: form closes, re-fetch, `setMessage("Robot settings saved for ...")`
4. Tap "Cancel" → form closes, no changes
5. Delete: confirm dialog, calls delete

### 1.3 Active Tab: Logs (3 sections)

The Logs tab has 3 sections via a section switch, mirroring the app's Logs tab:

| Section               | Content                                                              | Component                  |
| --------------------- | -------------------------------------------------------------------- | -------------------------- |
| **User Activity**     | `user_activity_log` rows, filtered by search                         | `ActivityTable`            |
| **User Profiles**     | `user_profile_entries` rows, filtered by search, edit button per row | `ProfileEntriesTable`      |
| **Fleet Diagnostics** | `device_crash_reports` + `app_logs` with scope filter                | `CrashReports` + `AppLogs` |

**Section selector** (top): 3 pills, active pill has bg-navy text-white, inactive has text-slate-500.

**Columns for User Activity**: timestamp, user (email), action, entity (type + id), details (JSON summary), level (badge).

**Columns for User Profiles**: title, type, created_at, actions (Edit).

**Fleet Diagnostics**:

- Crash reports table: timestamp, car name, board id, error summary, reported_at
- App logs section: scope filter dropdown, severity radio, search input, Apply button, log rows

### 1.4 Active Tab: Settings

The Settings tab (`AdminSettings.tsx`) has company information editing.

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

**Edit pattern (same as app):**

1. Fields display **read-only** as plain text by default
2. User taps **"Edit"** → all input/textarea fields become editable, pre-filled
3. User taps **"Save"** → submits to `/api/admin/settings?action=company`, on success: `setIsEditing(false)`, `setMessage("Company information saved.")`
4. User taps **"Cancel"** → `setIsEditing(false)`, no changes

## 2. Key Types & Interfaces

### 2.1 `Company`

```typescript
// lib/company.ts
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

### 2.2 `CarProfileRow`

```typescript
type CarProfileRow = {
  id: string;
  profile_key: string; // Stable identity: fw:boardId, MAC, or wifi:uuid
  car_name: string;
  unique_id: string;
  settings: Record<string, unknown>;
  updated_at: string;
};
```

### 2.3 `RobotRow`

```typescript
type RobotRow = {
  robot_id: string;
  robot_name: string;
  settings: Record<string, unknown>;
  updated_at: string;
};
```

### 2.4 `ManagedUser`

```typescript
// components/admin/admin-types.ts
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

## 3. Data Model

### 3.1 Tables (same as app)

| Table                  | Purpose                                        | Key fields                                                             |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `profiles`             | User-level profile (theme, role, tier)         | user_id, theme_preference, role, tier                                  |
| `car_profiles`         | Per-car profile (board identity, settings)     | profile_key, car_name, unique_id, settings (JSON), wifi_history (JSON) |
| `robot_user_settings`  | Per-robot code values / parameters / telemetry | robot_id, robot_name, settings (JSON), updated_at                      |
| `user_activity_log`    | User actions (filled by DB triggers)           | id, action, entity_type, entity_id, user_email, details, created_at    |
| `user_profile_entries` | User profile entries (filled by DB triggers)   | id, title, type, body, user_id, created_at                             |
| `device_crash_reports` | Crash reports from fleet                       | id, car_name, board_id, error_summary, reported_at                     |
| `app_logs`             | App logs with scope                            | id, level, message, scope, detail, created_at                          |

### 3.2 Per-Car Identity Fields (same as app)

Each car profile has **distinguished identity fields**:

- `profile_key`: Stable identity — `fw:boardId` (firmware board ID), Bluetooth MAC address, or `wifi:uuid`
- `car_name`: Display name set by user
- `unique_id`: Unique identifier for the car
- `settings`: JSON blob of car-specific settings

These fields are shown in the Users tab Car Profiles section and in the UserPreferencesScreen My Devices section (on the app side).

## 4. Responsive Design

The website uses Tailwind CSS with responsive prefixes:

- `sm:` for small screens and up — layout changes from vertical stack to side-by-side
- `flex-col sm:flex-row` — vertical on mobile, horizontal on desktop
- `w-full sm:w-64` — full width on mobile, fixed width on desktop
- `sm:flex-row sm:items-center sm:justify-between` — action cluster stacks on mobile, side-by-side on desktop

The Users tab layout example:

- Top section selector: `flex border-b border-line pb-3 mb-4` (horizontal on all sizes)
- User directory rows: `flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between` (stacked on mobile, side-by-side on desktop)
- Action cluster: `flex w-full flex-wrap gap-2 sm:w-auto` (full width on mobile, auto width on desktop)

The Settings tab:

- View mode: grid of fields, responsive to screen width
- Edit mode: form with grid gap-4, responsive grid

## 5. Alignment with App

| Feature                 | Website                                                  | App                                                      | Status                 |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ---------------------- |
| Tab order (9 tabs)      | Identical                                                | Identical                                                | ✅ Mirrored            |
| Users tab structure     | 3 sections: User Directory, Car Profiles, Robot Profiles | 3 sections: User Directory, Car Profiles, Robot Profiles | ✅ Mirrored (Nov 2026) |
| Edit-button pattern     | Read-only → Edit → form → Save/Cancel                    | Read-only → Edit → form → Save/Cancel                    | ✅ Mirrored            |
| Company info fields     | 17 fields (incl. url)                                    | 17 fields (incl. url)                                    | ✅ Mirrored            |
| Car profiles per user   | profile_key, car_name, unique_id, settings               | profile_key, car_name, unique_id, settings               | ✅ Mirrored            |
| Robot profiles per user | robot_id, robot_name, settings                           | robot_id, robot_name, settings                           | ✅ Mirrored            |
| Logs tab sections       | 3 sections (user-activity, user-profiles, fleet)         | 3 sections (user-activity, user-profiles, fleet)         | ✅ Mirrored            |
| Settings responsive     | Mobile + desktop, responsive                             | Mobile-first, stacks vertically                          | ✅ Both                |

## 6. Documentation Deliverables

Docs in `genumsolutions-website/docs/`:

- `WEBSITE_ADMIN_COMPLETE.md` — This complete admin UI documentation
- `ADMIN_UI_BLUEPRINT.md` — Website admin UI blueprint (structure, patterns, types)
- `APP_WEBSITE_UI_COMPARISON.md` — App vs website comparison report
- `ADMIN_COHERENCE.md` — Admin coherence doc (tab inventory, role permissions, data ownership)
- `LINK_RESILIENCE.md` — Should reference app's guide; documents diagnostic wire for website admins

## 7. Test Status

- **301 vitest tests** across 24 files — all passing
- **TypeScript `tsc --noEmit`** — 0 errors
- **Parity tests** — enforce identical tab structure on app and website

---

_Documentation generated: 2026-11-09_
_Total docs: WEBSITE_ADMIN_COMPLETE.md, ADMIN_UI_BLUEPRINT.md, APP_WEBSITE_UI_COMPARISON.md, ADMIN_COHERENCE.md_
_Both repos: TypeScript 0 errors, green CI on all tests (982 mobile + 301 website)_
