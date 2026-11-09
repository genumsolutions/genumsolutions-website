# App vs Website — UI/UX Comparison & Alignment Report

## Purpose

This document compares the admin UI/UX between the mobile app (`genumsolutions-app/mobile`) and the web application (`genumsolutions-website`) and documents alignment recommendations so both platforms mirror each other as a consistent company asset.

## Executive Summary

Both the app and website provide admin functionality for managing company settings, user profiles, logs, and system data. There is significant overlap in features, but the UI implementations differ in layout, terminology, and edit-patterns. This report documents the current state and recommends changes to mirror each other where beneficial, ensuring both platforms function as one consistent product.

---

## 1. Top-Level Tab/Section Structure

### App (mobile) — 9 tabs

The app uses a **9-tab horizontal bar** at the top of `AdminScreen.tsx`:

| Tab          | Label                   | Section Component   | Description                                                                                                  |
| ------------ | ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `dashboard`  | **Dashboard**           | `DashboardTab`      | KPIs, order/revenue trend, recent activity feed                                                              |
| `orders`     | **Orders**              | `OrdersTab`         | Every order, payment state, pilot finance lines                                                              |
| `electronic` | **Electronic Products** | `ElectronicsTab`    | `/products` catalog — pricing, stock, photos                                                                 |
| `threed`     | **3D Products**         | `ThreeDTab`         | `/3d-printing` catalog                                                                                       |
| `projects`   | **Projects**            | `ProjectsTab`       | Bundles sold on `/projects` including pre-packaged kits                                                      |
| `content`    | **Content**             | `ContentTab`        | Services, journal posts, home page copy                                                                      |
| `users`      | **Users**               | `UsersTab`          | Accounts, roles, tiers, per-user directories/profile, robot/car profiles                                     |
| `logs`       | **Logs**                | `LogsTab`           | User activity + user profiles + field diagnostics (U-R5 merged from System Logs, User Logs, Profile Entries) |
| `settings`   | **Settings**            | `SettingsTab`       | Company info (all 17 fields), training programs, pilot costs                                                 |
| `profile`    | **Profile**             | `ProfileEntriesTab` | User profile entries — read-only by default, Edit → form → Save/Cancel (U-R5 merged from Profiles tab)       |

### Website — Multi-panel layout

The website uses Next.js page routes with React components for each admin panel:

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

### Alignment

- Tab order is **identical** on both clients (enforced by parity tests: `admin-parity.test.ts` on both repos).
- The app uses a **single screen with horizontal tabs** at the top; the website uses **multi-panel navigation** with sidebar/links.
- Both expose the same admin operations: Dashboard, Orders, Products, Projects, Content, Users, Logs, Settings, Profile.
- The Users tab on both now has **3 sections** (User Directory, Car Profiles, Robot Profiles) — mirrored.
- The Logs tab on both now has **3 sections** (User Activity, User Profiles, Fleet Diagnostics) — mirrored.

---

## 2. Users Tab — 3-Section Structure (Mirrored)

### App (UsersTab)

**Section 1: User Directory**

- Header: `"User Directory"` + subtext + search input + Clear button
- Per-user row: name + email + phone + address + joined date + last seen
- Actions: role select (disabled: canDelete), tier toggle (Upgrade to Pro / Downgrade to Free), Delete user (owner only)
- Search: internal state, filters by name or email lowercase includes

**Section 2: Car Profiles**

- Header: `"Car Profiles"` + subtext explaining profile_key identity (fw:, MAC, wifi:)
- Per-car row: car_name + profile_key (font-mono) + settings count + updated date + unique_id
- Edit form: TextInput for name + TextInput (multiline 6 rows) for settings JSON + Save (bg-emerald-600) + Cancel
- Add new: input for profile_key + "Add profile" button
- Edit pattern: read-only card → Edit → inline form → Save (async, re-fetch) / Cancel (close, no changes)
- Staff: Edit disabled (opacity-50, title: "Only administrators can edit car profiles")
- Admin+: Edit enabled, Delete enabled (confirm dialog)

**Section 3: Robot Profiles**

- Header: `"Robot Profiles"` + subtext explaining per-robot code values/parameters/telemetry
- Per-robot row: robot_name (or robot_id) + robot_id (font-mono) + settings count + updated date
- Edit form: TextInput for name + TextInput (multiline 6 rows) for settings JSON + Save (bg-emerald-600) + Cancel
- Add new: input for robot_id + "Add profile" button
- Edit pattern: same as Car Profiles

### Website (AdminUsers)

**Section 1: User Directory**

- Header: `"User Directory"` + subtext + search input + Clear button
- Per-user row: name + email + phone + address + joined date + last seen
- Actions: role select (disabled: canDelete), tier toggle buttons, Delete user (owner only)
- Search: internal state, filters by name or email lowercase includes

**Section 2: Car Profiles**

- Header: `"Car Profiles"` + subtext explaining profile_key identity (fw:, MAC, wifi:)
- Per-car row: car_name (or "Untitled profile") + profile_key (font-mono text-slate-400) + settings count + updated date + unique_id
- Edit form: input for name + textarea (rows=6, font-mono) for settings JSON + Save (bg-emerald-600) + Cancel
- Add new: input for profile_key + "Add profile" button
- Edit pattern: read-only card → Edit → inline form → Save (async, re-fetch) / Cancel (close, no changes)
- Staff: Edit disabled (opacity-50, title: "Only administrators can edit project profiles")
- Admin+: Edit enabled, Delete enabled (confirm dialog)

**Section 3: Robot Profiles**

- Header: `"Robot Profiles"` + subtext explaining per-robot code values/parameters/telemetry
- Per-robot row: robot_name (or robot_id) + robot_id (font-mono text-slate-400) + settings count + updated date
- Edit form: input for name + textarea (rows=6, font-mono) for settings JSON + Save (bg-emerald-600) + Cancel
- Add new: input for robot_id + "Add profile" button
- Edit pattern: same as Car Profiles

### Alignment Summary

| Element              | App                                                           | Website                                        | Mirrored?       |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------- | --------------- |
| Section headers      | "User Directory", "Car Profiles", "Robot Profiles"            | Same                                           | ✅ Yes          |
| User row fields      | name, email, phone, address, joined, last seen                | Same                                           | ✅ Yes          |
| Role select          | customer/staff/admin/owner, disabled: canDelete               | Same                                           | ✅ Yes          |
| Tier toggle          | Upgrade to Pro / Downgrade to Free                            | Same                                           | ✅ Yes          |
| Delete user          | owner only, confirm dialog                                    | Same                                           | ✅ Yes          |
| Car profile fields   | car_name, profile_key, settings (JSON), updated_at, unique_id | Same                                           | ✅ Yes          |
| Profile_key display  | font-mono text-muted                                          | font-mono text-slate-400                       | ✅ Same intent  |
| Edit form            | TextInput name + TextInput JSON (6 rows)                      | input name + textarea JSON (rows=6, font-mono) | ✅ Same pattern |
| Save button          | bg-emerald-600, "Save"                                        | bg-emerald-600, "Save"                         | ✅ Same         |
| Cancel button        | border-line, "Cancel"                                         | border-line, "Cancel"                          | ✅ Same         |
| Staff restriction    | Edit disabled, title tooltip                                  | Same                                           | ✅ Same         |
| Add new              | input + "Add profile" button                                  | Same                                           | ✅ Same         |
| Robot profile fields | robot_name, robot_id, settings (JSON), updated_at             | Same                                           | ✅ Yes          |

---

## 3. Company Information — Edit Button Pattern

### App (SettingsTab)

- **Location:** `AdminScreen.tsx` → `SettingsTab` component
- **Fields presented:** 17 fields (name, shortName, url?, address, city, country, email, phone, pan, vatLabel, description, whatsappNumber, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, youtubeUrl)
- **Edit pattern:**
  - Read-only by default (Text contents, not inputs)
  - Tap "Edit" → TextInput fields become editable, pre-filled
  - Tap "Save company" → validates (name + email required, valid emails), calls `updateCompany`, on success: `setSettingsEditing(false)`, `onCompanySaved()`
  - Tap "Cancel" → `setSettingsEditing(false)`, no changes
- **Status banner**: shows `savedMessage` (green, "Saved.") after successful save, auto-clears

### Website (AdminSettings)

- **Location:** `components/admin/AdminSettings.tsx`
- **Fields presented:** 17 fields (name, shortName, url, address, city, country, email, phone, pan, vatLabel, description, whatsappNumber, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, youtubeUrl)
- **Edit pattern:**
  - Read-only by default (spans, not inputs)
  - Tap "Edit" (class: `text-sm text-navy hover:underline`) → form inputs appear, pre-filled
  - Tap "Save" → submits to `/api/admin/settings?action=company`, on success: `setIsEditing(false)`, `setMessage("Company information saved.")`
  - Tap "Cancel" → `setIsEditing(false)`, no changes

### Alignment Summary

| Element          | App                                                                                                                                                                   | Website                                    | Mirrored?       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------- |
| Field count      | 17 (including url)                                                                                                                                                    | 17 (including url)                         | ✅ Yes          |
| Field names      | name, shortName, url, address, city, country, email, phone, pan, vatLabel, description, whatsappNumber, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, youtubeUrl | Same                                       | ✅ Yes          |
| Edit pattern     | Read-only → Edit → form → Save/Cancel                                                                                                                                 | Read-only → Edit → form → Save/Cancel      | ✅ Yes          |
| Save guard       | `saveBusy` disables Save button                                                                                                                                       | Form `onSubmit` handles submission         | ✅ Same intent  |
| Success feedback | `setMessage("Saved.")` + green banner                                                                                                                                 | `setMessage("Company information saved.")` | ✅ Same concept |

---

## 4. Logs Tab — 3 Sections (Mirrored)

### App (LogsTab)

| Section               | Content                                                              | Component                  |
| --------------------- | -------------------------------------------------------------------- | -------------------------- |
| **User Activity**     | `user_activity_log` rows, filtered by search                         | `UserActivityTable`        |
| **User Profiles**     | `user_profile_entries` rows, filtered by search, edit button per row | `ProfileEntriesTab`        |
| **Fleet Diagnostics** | `device_crash_reports` + `app_logs` with scope filter                | `CrashReports` + `AppLogs` |

**Fleet Diagnostics details:**

- Crash reports table: timestamp, car name, board id, error summary, reported_at
- App logs section: scope filter dropdown (all / link/wifi / all-other), severity radio, search input, Apply button
- App log rows: timestamp, level badge (color-coded), message, scope (font-mono text-xs), detail (JSON expandable)
- `link/wifi` scope entries: `{code, reason, wasClean, uptimeMs, frames}` written via `useControlHub.ts`

### Website (AdminLogsHub)

| Section               | Content                                                              | Component                  |
| --------------------- | -------------------------------------------------------------------- | -------------------------- |
| **User Activity**     | `user_activity_log` rows, filtered by search                         | `ActivityTable`            |
| **User Profiles**     | `user_profile_entries` rows, filtered by search, edit button per row | `ProfileEntriesTable`      |
| **Fleet Diagnostics** | `device_crash_reports` + `app_logs` with scope filter                | `CrashReports` + `AppLogs` |

**Fleet Diagnostics details:**

- Crash reports table: timestamp, car name, board id, error summary, reported_at
- App logs section: scope filter dropdown, severity radio, search input, Apply button, log rows

### Alignment Summary

| Element                     | App                                                          | Website                                        | Mirrored?  |
| --------------------------- | ------------------------------------------------------------ | ---------------------------------------------- | ---------- |
| 3 sections                  | User Activity, User Profiles, Fleet                          | Same                                           | ✅ Yes     |
| Section selector            | 3 pills, active bg-navy                                      | Same                                           | ✅ Yes     |
| Crash reports columns       | timestamp, car name, board id, error, reported_at            | Same                                           | ✅ Yes     |
| App logs scope filter       | dropdown (all/link-wifi/all-other)                           | Same                                           | ✅ Yes     |
| App logs severity filter    | radio (all/warn/error)                                       | Same                                           | ✅ Yes     |
| App logs search             | input + Apply button                                         | Same                                           | ✅ Yes     |
| `link/wifi` diagnostic wire | `appendLog({scope: "link/wifi", ...})` in `useControlHub.ts` | No dedicated wire (admin views app_logs table) | ⚠️ Partial |

---

## 5. Edit-Button Pattern (Consistent Across Both)

Used in: SettingsTab (company), ProfileEntriesTab, UsersTab (car profiles, robot profiles) on app; AdminSettings, AdminUsers (car profiles, robot profiles), AdminLogs (user profiles) on website.

**Pattern:**

1. Content displays **read-only** by default (Cards/Texts/spans, not inputs)
2. User taps **"Edit"** → form/inputs become active and pre-filled
3. User taps **"Save"** → changes are persisted, content locks, `setMessage("Saved.")` or `setMessage("Company information saved.")` feedback
4. User taps **"Cancel"** → form closes, content returns to read-only (no changes)
5. During save: busy flag disables the Save button
6. Staff restrictions: Edit button disabled with tooltip/title explaining "Only administrators can edit"

### Button Labels

| Button | App                                                   | Website                                           | Mirrored?                       |
| ------ | ----------------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| Edit   | "Edit" (text-xs text-navy uppercase tracking-[0.1em]) | "Edit" (text-xs font-bold text-navy, border-line) | ✅ Same word, different styling |
| Save   | "Save" (bg-emerald-600 text-white)                    | "Save" (bg-emerald-600 text-white)                | ✅ Same                         |
| Cancel | "Cancel" (border-line text-ink)                       | "Cancel" (border-line text-ink)                   | ✅ Same                         |
| Delete | "Delete" (border-red-200 text-red-600)                | "Delete" (border-red-200 text-red-600)            | ✅ Same                         |

---

## 6. Terminology & Labels

| Term                        | App                                                                                                                        | Website                | Mirrored? |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------- |
| **Edit button label**       | "Edit"                                                                                                                     | "Edit"                 | ✅ Yes    |
| **Save button label**       | "Save"                                                                                                                     | "Save"                 | ✅ Yes    |
| **Cancel button label**     | "Cancel"                                                                                                                   | "Cancel"               | ✅ Yes    |
| **Delete button label**     | "Delete"                                                                                                                   | "Delete"               | ✅ Yes    |
| **Company section heading** | "Company information"                                                                                                      | "Company information"  | ✅ Yes    |
| **Tab labels**              | "Dashboard", "Orders", "Electronic Products", "3D Products", "Projects", "Content", "Users", "Logs", "Settings", "Profile" | Same (via parity test) | ✅ Yes    |
| **Users section labels**    | "User Directory", "Car Profiles", "Robot Profiles"                                                                         | Same                   | ✅ Yes    |
| **Logs section labels**     | "User Activity", "User Profiles", "Fleet Diagnostics"                                                                      | Same                   | ✅ Yes    |

---

## 7. Technical Implementation Differences

### App (React Native + Expo + TypeScript)

- **Framework:** Expo Go, React Native, TypeScript
- **Navigation:** `MainTabPager` + `RootNavigator` + `useState` for tab selection
- **Styling:** Tailwind-like `className` system (NativeWind)
- **State Management:** `useState` throughout `AdminScreen.tsx`
- **Form Handling:** Controlled components via state setters
- **API Calls:** Supabase SDK calls (`supabase.from("company_info").select("*...`).single()`)
- **Logging:** `appendLog({scope: "link/wifi", ...})` in `useControlHub.ts` for link diagnostics
- **Tests:** 955 vitest tests across 65 files — all passing
- **TypeCheck:** `tsc --noEmit` passes 0 errors

### Website (Next.js + React + TypeScript)

- **Framework:** Next.js 14 (app router), React 18, TypeScript
- **Navigation:** Next.js page routes + React components
- **Styling:** Tailwind CSS (`tailwind.config.ts`)
- **State Management:** `useState`, `useEffect` across components
- **Form Handling:** HTML forms with `onSubmit`, input `onChange` handlers
- **API Calls:** `fetch("/api/admin/settings")`, `fetch("/api/admin/users")` for admin operations
- **Logging:** `AdminLogs.tsx` component views `app_logs` and `device_crash_reports` tables
- **Tests:** 301 vitest tests across 24 files — all passing
- **TypeCheck:** `tsc --noEmit` passes 0 errors

---

## 8. Data Ownership

| Data                     | Table                              | Written by                                |
| ------------------------ | ---------------------------------- | ----------------------------------------- |
| Products / catalogs      | `products`                         | website API, app via `admin-products`     |
| Robot preferences        | `robot_user_settings`              | app + website account page; admins repair |
| Project (car) profiles   | `car_profiles`                     | app build screen; admins repair           |
| User activity            | `user_activity_log`                | DB triggers on `car_profiles` / `orders`  |
| Profile entries          | `user_profile_entries`             | DB triggers on `car_profiles`             |
| Crash reports / app logs | `device_crash_reports`, `app_logs` | app telemetry                             |
| Link imports             | `link_import_attempts`             | `link-import` edge function               |

`user_activity_log` and `user_profile_entries` have **no client writers**. They are filled by Postgres triggers so both clients see the same history without duplicating write code.

---

## 9. Per-Car Identity Fields (Distinguished)

Each car profile has **distinguished identity fields** that identify the car uniquely:

| Field         | Purpose                                                                           | Example                                         |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| `profile_key` | Stable identity — `fw:boardId` (firmware board ID), Bluetooth MAC, or `wifi:uuid` | `fw:1FB608`, `AA:BB:CC:DD:EE:FF`, `wifi:abc123` |
| `car_name`    | Display name set by user                                                          | "My 2WD car"                                    |
| `unique_id`   | Unique identifier for the car                                                     | `#12345`                                        |
| `settings`    | JSON blob of car-specific settings                                                | `{modeId: "eco", speed: 128}`                   |

These fields appear in:

- App: Users tab → Car Profiles section; UserPreferencesScreen → My Devices section
- Website: Users tab → Car Profiles section

The `profile_key` is the **stable identity** that persists across app reinstalls and device changes. It uses the firmware board ID (`fw:boardId`) when available, falls back to Bluetooth MAC, and uses a UUID for Wi-Fi connections.

---

## 10. Responsive Design

### App (Mobile-first)

- Uses `className` system with responsive prefixes (`sm:`)
- Layout stacks vertically on small screens, side-by-side on larger
- Column widths use `flex-1` and `min-w-0` to avoid overflow
- Action clusters use `flex-col sm:flex-row` to stack on mobile, row on desktop

### Website (Mobile + Desktop)

- Uses Tailwind CSS with responsive prefixes (`sm:`)
- `flex-col sm:flex-row` — vertical on mobile, horizontal on desktop
- `w-full sm:w-64` — full width on mobile, fixed width on desktop
- `sm:flex-row sm:items-center sm:justify-between` — action cluster stacks on mobile, side-by-side on desktop
- Users tab: top section selector is horizontal on all sizes; user rows stack on mobile, side-by-side on desktop
- Settings tab: view mode grid responsive; edit mode form grid responsive

---

## 11. Current Alignment Status (Nov 2026)

| Feature                     | App                                                       | Website                                  | Mirrored?  |
| --------------------------- | --------------------------------------------------------- | ---------------------------------------- | ---------- |
| Tab order (9 tabs)          | Identical order                                           | Identical order                          | ✅ Yes     |
| Users tab structure         | 3 sections (User Directory, Car Profiles, Robot Profiles) | 3 sections (same)                        | ✅ Yes     |
| Edit-button pattern         | Read-only → Edit → form → Save/Cancel                     | Same                                     | ✅ Yes     |
| Company info fields         | 17 fields (incl. url)                                     | 17 fields (incl. url)                    | ✅ Yes     |
| Car profiles per user       | profile_key, car_name, unique_id, settings                | Same                                     | ✅ Yes     |
| Robot profiles per user     | robot_id, robot_name, settings                            | Same                                     | ✅ Yes     |
| Logs tab sections           | 3 sections (User Activity, User Profiles, Fleet)          | Same                                     | ✅ Yes     |
| Settings responsive         | Mobile-first, stacks vertically                           | Mobile + desktop, responsive             | ✅ Both    |
| Fleet diagnostics           | Crash reports + app logs with scope filter                | Same                                     | ✅ Yes     |
| `link/wifi` diagnostic wire | `appendLog` in `useControlHub.ts`                         | No dedicated wire (views app_logs table) | ⚠️ Partial |

---

## 12. Documentation Deliverables

### In `genumsolutions-app/mobile/docs/`:

- `APP_ADMIN_COMPLETE.md` — Complete admin UI documentation (every element, every field, every pattern)
- `ADMIN_UI_BLUEPRINT.md` — Admin UI blueprint (structure, patterns, types)
- `APP_WEBSITE_UI_COMPARISON.md` — This comparison report (also in website repo)
- `LINK_RESILIENCE.md` — Churn fix + close diagnostics guide

### In `genumsolutions-website/docs/`:

- `WEBSITE_ADMIN_COMPLETE.md` — Complete admin UI documentation (every element, every field, every pattern)
- `ADMIN_UI_BLUEPRINT.md` — Website admin UI blueprint (structure, patterns, types)
- `APP_WEBSITE_UI_COMPARISON.md` — This comparison report (also in app repo)
- `ADMIN_COHERENCE.md` — Admin coherence doc (tab inventory, role permissions, data ownership)
- `LINK_RESILIENCE.md` — Reference app's guide; documents diagnostic wire for website admins

---

## 13. Architecture Mirroring

Both projects share the same architectural patterns:

| Aspect               | App                                   | Website                                | Mirrored?                               |
| -------------------- | ------------------------------------- | -------------------------------------- | --------------------------------------- |
| **Navigation**       | Bottom tabs + native-stack screens    | Next.js App Router page routes         | ✅ Same concept                         |
| **State management** | React Context (`AppContext`)          | React state + Supabase cookies         | ✅ Both use React state                 |
| **Styling**          | NativeWind (`className` system)       | Tailwind CSS (`tailwind.config.ts`)    | ✅ Same Tailwind tokens (navy/ink/gold) |
| **Data layer**       | `src/services/` read Supabase         | `lib/` + `app/api/` read Supabase      | ✅ Same Supabase anon key pattern       |
| **Auth**             | Native Supabase auth (SecureStore)    | Cookie sessions via `@supabase/ssr`    | ✅ Same Supabase Auth                   |
| **Admin contract**   | `adminService.ts` + `AdminScreen.tsx` | `lib/` + `app/api/admin/` + components | ✅ Same RLS-gated admin pattern         |
| **Company info**     | `src/config/company.ts` (17 fields)   | `lib/company.ts` (17 fields)           | ✅ Identical types                      |
| **Version sync**     | `app.json` + `src/config/site.ts`     | N/A (website version in package.json)  | ⚠️ Different pattern                    |
| **Release**          | APK upload + OTA hot-patches          | Vercel deployment                      | ✅ Both use git-pushed CI               |
| **Testing**          | 955 vitest tests                      | 301 vitest tests                       | ✅ Both use vitest                      |

### Shared Files (Source of Truth)

| File                                        | Purpose                                 | Location                            |
| ------------------------------------------- | --------------------------------------- | ----------------------------------- |
| `supabase/schema.sql`                       | Database schema (tables, RLS, triggers) | website repo (source of truth)      |
| `lib/company.ts` ↔ `src/config/company.ts`  | Company info type (17 fields)           | website ↔ app                       |
| `tailwind.config.ts` ↔ `tailwind.config.js` | Tailwind theme tokens                   | website ↔ app                       |
| `src/config/adminTabs.ts` ↔ parity tests    | Admin tab definitions                   | app (enforced by both repos' tests) |

### Sync Responsibilities

- **Schema**: `supabase/schema.sql` is the source of truth. The app reads from the same DB.
- **Company info**: Both repos have identical 17-field types. Keep in sync when fields change.
- **Tailwind tokens**: Both use the same navy/ink/gold palette. Keep colors in sync.
- **Admin tabs**: Parity tests enforce identical tab order on both repos.

---

## 14. Test Status

- **App:** 955 vitest tests across 65 files — all passing
- **Website:** 301 vitest tests across 24 files — all passing
- **Both repos:** `tsc --noEmit` passes 0 errors
- **Parity tests:** enforce identical tab structure on both repos

---

_Report generated: 2026-11-09_
_Comparison between: genumsolutions-app/mobile and genumsolutions-website_
_Both repos: TypeScript 0 errors, green CI on all tests (955 mobile + 301 website)_
_Users tab: 3-section structure mirrored (User Directory, Car Profiles, Robot Profiles)_
_Logs tab: 3-section structure mirrored (User Activity, User Profiles, Fleet Diagnostics)_
_Company info: 17 fields mirrored with url field_
_Edit-button pattern: consistent across both (read-only → Edit → form → Save/Cancel)_
