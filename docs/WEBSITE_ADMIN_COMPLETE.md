# Website (genumsolutions-website) — Complete Admin UI Documentation

## 1. Admin Dashboard Overview

The authenticated `/admin` page mounts the website's `AdminPanel`, which
provides seven top-level tabs and nested sections within Orders, Users and
Settings.

### 1.1 Top-Level Navigation Structure

The website and app expose the same seven top-level tabs, enforced by parity
tests. All tabs are panels within `/admin`; Orders, Users and Settings have
their own subtabs. The former Content tab merged into Settings on 2026-11-18.

| Top-level tab       | Contents                                 |
| ------------------- | ---------------------------------------- |
| Dashboard           | KPIs and recent activity                 |
| Orders              | Orders, payments, and finance            |
| Electronic Products | Product catalog                          |
| 3D Products         | 3D printing catalog                      |
| Projects            | Packages, components, pricing, import    |
| Users               | Directory, messages, profiles, and Logs  |
| Settings            | Company · Home page · Services · Journal |

### 1.2 Users Subtab: Directory and Projects (2026-11)

The **Users** subtab (`AdminUsers.tsx`) is the directory. Messages and Logs are
separate subtabs of the top-level Users tab, and a user's projects open inside the
row that owns them — there are no separate profile sections.

**Header**:

- Label: `"User Directory"` (text-xs font-black uppercase tracking-widest text-navy)
- Components: search input, Clear button

**Per-user row layout**:

- Container: `li border border-line bg-white p-4`
- Top row: name + email + phone (if present) + address (if present) + joined date + last seen (if present)
- Bottom row (`flex-col sm:flex-row gap-3 sm:items-center sm:justify-between`): role select (admins and owners only), tier toggle (Upgrade to Pro / Downgrade to Free), **Show projects** expander, Delete user (owner only)

**Show projects** (every role may read):

- Calls the admin user route with `listCarProfiles` and `listRobotSettings` for
  that user and renders two read-only lists, "Projects (n)" from `car_profiles`
  and "Robot profiles (n)" from `robot_user_settings`.
- Each row: name (or "Untitled project"), saved-settings count + updated date, and
  a collapsed **Technical details** disclosure holding the connection/profile key
  (the board's stable identity: `fw:`, Bluetooth MAC or `wifi:`) and device id.
  No Wi-Fi passwords are stored in these rows.
- Admins and owners get a Delete per profile (`deleteCarProfile` /
  `deleteRobotSetting`); deletion asks for confirmation first. Staff read only.

**Search**: internal `search` state, filters by name or email lowercase includes.

**Interactions**:

- Role select: `onChange` → validated role change (`admin`/`owner` only)
- Tier toggle: Upgrade/Downgrade, informational toast
- Delete user: confirm dialog, calls delete (owner only)

### 1.3 Active Tab: Logs (3 sections)

The Logs tab has 3 sections via a section switch, mirroring the app's Logs tab:

| Section               | Content                                                            | Component                  |
| --------------------- | ------------------------------------------------------------------ | -------------------------- |
| **User Activity**     | `user_activity_log` rows, filtered by search                       | `ActivityTable`            |
| **User Profiles**     | `user_profile_entries` rows, filtered by search, admin-only delete | `ProfileEntriesTable`      |
| **Fleet Diagnostics** | `device_crash_reports` + `app_logs` with scope filter              | `CrashReports` + `AppLogs` |

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

The tab is split into the three sections the app uses — **Company details**
(Name, Short name, URL, Address, City, Country, PAN, VAT label), **Contact**
(Email, Phone, Description) and **Social & messaging** (WhatsApp, Facebook,
Instagram, TikTok, LinkedIn, YouTube) — each with its own hint line.

**Edit pattern (same as app):**

1. Fields display **read-only** as plain text by default
2. User taps **"Edit"** → the section's fields open in `AdminEditorSheet`, pre-filled
3. User taps **"Save"** → submits to `/api/admin/settings?action=company`, on success: the sheet closes and `setMessage("Company information saved.")`
4. User taps **"Cancel"** → the sheet closes, no changes

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

These fields are shown in each user's **Show projects** expander (the collapsed
Technical details line) and in the app's UserPreferencesScreen My Devices section.

## 4. Responsive Design

The website uses Tailwind CSS with responsive prefixes:

- `sm:` for small screens and up — layout changes from vertical stack to side-by-side
- `flex-col sm:flex-row` — vertical on mobile, horizontal on desktop
- `w-full sm:w-64` — full width on mobile, fixed width on desktop
- `sm:flex-row sm:items-center sm:justify-between` — action cluster stacks on mobile, side-by-side on desktop

The Users tab layout example:

- Section strip (Users / Messages / Logs): one row, horizontal scroll on narrow screens
- User directory rows: `flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between` (stacked on mobile, side-by-side on desktop)
- Action cluster: `flex w-full flex-wrap gap-2 sm:w-auto` (full width on mobile, auto width on desktop)

The Settings tab:

- View mode: read-only label/value rows in the section card
- Edit mode: `AdminEditorSheet` (bottom sheet under 640px, centred dialog above it) with a scrolling body

## 5. Alignment with App

| Feature                 | Website                                             | App                                          | Status      |
| ----------------------- | --------------------------------------------------- | -------------------------------------------- | ----------- |
| Tab order (7 tabs)      | Identical                                           | Identical                                    | ✅ Mirrored |
| Users subtabs           | Users, Messages, Logs                               | Users, Messages, Logs                        | ✅ Mirrored |
| Users projects          | Per-user **Show projects** expander (read-only)     | Same expander, same rows                     | ✅ Mirrored |
| Users → Messages        | Contact messages **plus** newsletter opt-ins        | Contact messages **plus** newsletter opt-ins | ✅ Mirrored |
| Edit-button pattern     | Read-only → Edit → `AdminEditorSheet` → Save/Cancel | Read-only → Edit → sheet → Save/Cancel       | ✅ Mirrored |
| Company info fields     | 17 fields (incl. url)                               | 17 fields (incl. url)                        | ✅ Mirrored |
| Car profiles per user   | profile_key, car_name, unique_id, settings          | profile_key, car_name, unique_id, settings   | ✅ Mirrored |
| Robot profiles per user | robot_id, robot_name, settings                      | robot_id, robot_name, settings               | ✅ Mirrored |
| Logs subtab sections    | User activity, user profiles, fleet diagnostics     | Same order and labels                        | ✅ Mirrored |
| Settings responsive     | Mobile + desktop, responsive                        | Mobile-first, stacks vertically              | ✅ Both     |

## 6. Documentation Deliverables

Docs in `genumsolutions-website/docs/`:

- `WEBSITE_ADMIN_COMPLETE.md` — This complete admin UI documentation
- `ADMIN_UI_BLUEPRINT.md` — Website admin UI blueprint (structure, patterns, types)
- `APP_WEBSITE_UI_COMPARISON.md` — App vs website comparison report
- `ADMIN_COHERENCE.md` — Admin coherence doc (tab inventory, role permissions, data ownership)
- `LINK_RESILIENCE.md` — Should reference app's guide; documents diagnostic wire for website admins

## 7. Test Status

- **406 vitest tests** across 36 files — all passing (2026-11-16)
- **TypeScript `tsc --noEmit`** — 0 errors
- **Parity tests** — enforce identical tab structure on app and website

---

_Documentation generated: 2026-11-09, reconciled with the shipped console 2026-11-16_
_Total docs: WEBSITE_ADMIN_COMPLETE.md, ADMIN_UI_BLUEPRINT.md, APP_WEBSITE_UI_COMPARISON.md, ADMIN_COHERENCE.md_
_Both repos: TypeScript 0 errors, green CI on all tests (1,067 mobile + 406 website)_
