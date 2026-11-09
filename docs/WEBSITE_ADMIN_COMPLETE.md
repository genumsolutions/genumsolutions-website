# Website (genumsolutions-website) — Complete Admin UI Documentation

## 1. Admin Dashboard Overview

The website admin dashboard provides centralized management for all administrative functions. It consists of multiple panels/sections accessible through the admin navigation.

### 1.1 Top-Level Navigation Structure

The website admin uses a multi-panel layout rather than a simple tab bar. Main sections include:

| Section/Path             | Component/Page                                                         | Description                  |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| `/admin`                 | `AdminDashboard` (`components/admin/AdminDashboard.tsx`)               | Main dashboard overview page |
| `/admin/settings`        | `AdminSettings.tsx` (`components/admin/AdminSettings.tsx`)             | Company information editing  |
| `/admin/logs`            | `AdminLogs.tsx` (`components/admin/AdminLogs.tsx`)                     | System logs and diagnostics  |
| `/admin/users`           | `AdminUsers.tsx` (`components/admin/AdminUsers.tsx`)                   | User management              |
| `/admin/products`        | `AdminProducts.tsx` (`components/admin/AdminProducts.tsx`)             | Product catalog management   |
| `/admin/profile-entries` | `AdminProfileEntries.tsx` (`components/admin/AdminProfileEntries.tsx`) | Profile entries management   |
| `/admin/journal`         | `AdminJournal.tsx` (`components/admin/AdminJournal.tsx`)               | Journal entries              |
| `/admin/activity`        | `AdminActivity` (`components/admin/AdminActivity.tsx`)                 | Activity tracking            |
| `/admin/finance`         | `AdminFinance.tsx` (`components/admin/AdminFinance.tsx`)               | Financial data               |
| `/admin/content`         | `AdminContent` (`components/admin/AdminContent.tsx`)                   | Content management           |

### 1.2 AdminDashboard Component

**Location**: `components/admin/AdminDashboard.tsx`

**Layout Structure**:

- **Header**: `HeaderSession` + `SiteHeader` for user context
- **Main Content Area**: Panel-based layout
- **Sidebar/Navigation**: Left sidebar with quick links to all admin sections
- **Breadcrumb**: `BreadcrumbListJsonLd` for schema markup

**Key Features**:

- Quick stats cards (orders, products, users counts)
- Recent activity feed
- Shortcuts to common admin tasks
- Links to all major admin sections

### 1.3 AdminSettings.tsx — Company Information

**Location**: `components/admin/AdminSettings.tsx`

**Company Info Type** (`lib/company.ts:10`):

```typescript
export type Company = {
  name: string;
  shortName: string;
  url: string; // <-- Website has this field
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  pan: string;
  vatLabel: string;
  description: string;
  // C5: socials + WhatsApp. Empty = surface not used.
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
};
// 17 fields total (includes "url" field)
```

**Two Modes**:

#### View Mode (isEditing = false, default)

- Company info displays as **read-only text**
- All 17 fields shown in grid layout:
  1. Name
  2. Short name
  3. URL (Website URL)
  4. Address
  5. City
  6. Country
  7. Email
  8. Phone
  9. PAN
  10. VAT label
  11. Description
  12. WhatsApp number
  13. Facebook URL
  14. Instagram URL
  15. TikTok URL
  16. LinkedIn URL
  17. YouTube URL
- "Edit" button (class: `text-sm text-navy hover:underline`) at top-right reveals form
- "Cancel" button (class: `text-sm text-muted hover:underline`) closes form without saving

#### Edit Mode (isEditing = true)

- Form appears: `<form onSubmit={saveCompany} className="mt-5 grid gap-4">`
- All 17 fields become `<input>` or `<textarea>` fields with current values
- **"Save" button** submits form to `/api/admin/settings?action=company`
- **"Cancel" button** returns to view mode, discards changes

**Save Function** (line ~61-86):

1. Trims `name` and `email` for validation
2. Calls `fetch("/api/admin/settings", { method: "POST", body: formData })`
3. Shows success/error messages via `setMessage`
4. On success: `setMessage("Company information saved.")`, `setIsEditing(false)` — content locks
5. On error: `setMessage(result.error || "Could not save company information.")`

**Field Components**:

- `name`, `shortName`, `email`, `phone`, `pan`, `vatLabel`, `description`, `whatsappNumber`, `facebookUrl`, `instagramUrl`, `tiktokUrl`, `linkedinUrl`, `youtubeUrl` → `<input>` fields
- `address` → `<textarea>` (rows={2})
- `city`, `country` → `<input>` fields
- `url` → `<input>` field (Website URL)

### 1.4 AdminLogs Component

**Location**: `components/admin/AdminLogs.tsx`

**Content**:

- System activity logs
- User logs
- Crash/problem data from cars
- Filtering and search capabilities
- Pagination controls

**Log Entry Format**:

- Each entry includes timestamp, level (info/warn/error), message, scope/category
- May include additional metadata depending on source

### 1.5 AdminProfileEntries Component

**Location**: `components/admin/AdminProfileEntries.tsx`

**Content**:

- Table/list view of profile entries
- Each entry has: title, type, body data, creation date
- Action buttons: Edit, Delete, View
- Pagination support
- Add new entry capability

**Entry Structure**:

- `title`: string (entry title)
- `type`: string (entry category/type)
- `body`: Record<string, unknown> (JSON/structured data)
- `createdAt`: ISO timestamp

### 1.6 Other Admin Panels (Brief Overview)

| Panel           | Key Features                                   |
| --------------- | ---------------------------------------------- |
| `AdminUsers`    | User list, roles, permissions, status toggles  |
| `AdminProducts` | Product catalog, inventory, pricing, status    |
| `AdminJournal`  | Journal entries, publishing status, tags       |
| `AdminActivity` | Recent activity feed, user actions, timestamps |
| `AdminFinance`  | Orders revenue, payouts, financial reports     |
| `AdminContent`  | Static pages, banners, featured content        |

---

## 2. Edit-Button Pattern (Website)

### 2.1 AdminSettings Company Info Pattern

**Read-Only Mode** (default):

- All 17 fields display as plain text (spans, not inputs)
- Layout: `<div className="min-w-0 text-sm font-bold">Field Name</div><span className="ml-2">{company.field}</span>`
- "Edit" button: `<button onClick={() => setIsEditing(true)} className="text-sm text-navy hover:underline">Edit</button>`
- "Cancel" button: `<button onClick={() => setIsEditing(false)} className="text-sm text-muted hover:underline">Cancel</button>`

**Edit Mode**:

- Form with 17 inputs/textarea fields
- Current company values pre-filled
- "Save" submits form + locks content
- "Cancel" returns to read-only without changes

### 2.2 Edit-Button Pattern Consistency

The website's edit pattern for company info is:

1. Content displays **read-only** by default
2. User taps **"Edit"** → form inputs become active
3. User taps **"Save"** → changes submitted to `/api/admin/settings?action=company`, content locks
4. User taps **"Cancel"** → form closes, content returns to read-only (no changes)

### 2.3 Profile Entries Edit Pattern

- `AdminProfileEntries.tsx` uses table with Edit/Delete buttons per row
- Edit opens a form or inline editing mode
- Delete removes entry from database
- Add new entry capability via "Add Entry" button

### 2.4 Other Panels

- Most other admin panels (Users, Products, etc.) follow similar edit/add/delete patterns
- Each has its own Save/Cancel/Clear workflow
- Consistent use of `setMessage` for success/error feedback

---

## 3. Key Types & Interfaces

### 3.1 `Company` Type (`lib/company.ts`)

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
// 17 fields total
```

### 3.2 Company State Management

- `const [company, setCompany] = useState<Company>(emptyCompany);` — line ~49 of AdminSettings.tsx
- `const [loaded, setLoaded] = useState(false);` — fetches from `/api/admin/settings`
- `const [isEditing, setIsEditing] = useState(false);` — toggle between view/edit modes

### 3.2 `emptyCompany` Default

```typescript
const emptyCompany: Company = {
  name: "",
  shortName: "",
  url: "", // Empty string default
  address: "",
  city: "",
  country: "",
  email: "",
  phone: "",
  pan: "",
  vatLabel: "",
  description: "",
  whatsappNumber: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
};
```

### 3.3 API Integration

- **GET**: `fetch("/api/admin/settings")` → populates `company` state
- **POST**: `fetch("/api/admin/settings", { method: "POST", body: formData })` → saves changes
- Both use `action: "company"` in form data

---

## 4. Diagnostic Logging (Website vs App)

### 4.1 Website Diagnostic Capabilities

- `AdminLogs.tsx` shows system activity logs
- No `link/wifi` scope entries currently (different from app's diagnostic wire)
- Log entries have: timestamp, level, message, possibly scope/metadata

### 4.2 App Diagnostic Wire (for comparison)

- `link/wifi` scope in `app_logs` with `{code, reason, wasClean, uptimeMs, frames}`
- Written via: `appendLog({scope: "link/wifi", level: "warn", message: "Wi-Fi link dropped", detail: wifiService.lastClose})`
- Documented in `LINK_RESILIENCE.md`

### 4.2 Recommended Website Alignment

Add `link/wifi` diagnostic wire to `AdminLogs` component, mirroring app's pattern:

- Same `appendLog` call structure
- Same JSON format for close events
- Same interpretation guide in docs

---

## 5. Terminology & Labels Comparison

| Term                        | Website                                              | App (Planned Alignment)                                 | Status                                 |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| **Edit button label**       | "Edit" (`text-sm text-navy hover:underline`)         | "Edit" (`text-xs text-navy uppercase tracking-[0.1em]`) | Different styling, same word           |
| **Save button label**       | "Save" (form submit)                                 | "Save company" (Pressable)                              | Same concept, different implementation |
| **Cancel button label**     | "Cancel" (`text-sm text-muted hover:underline`)      | "Cancel" (closes form)                                  | Same                                   |
| **Company section heading** | `"Company information"` (`editorCardTitle`)          | `"Company information"` (SectionCard title)             | Already consistent                     |
| **Tab labels**              | `AdminDashboard`, `AdminSettings`, `AdminLogs`, etc. | `"Logs"`, `"Profile"`, `"Settings"`                     | Different structure                    |
| **Profile entry title**     | `title` field                                        | `{row.title                                             |                                        | "(untitled)"}` | Same concept |
| **Save feedback**           | `setMessage("Company information saved.")`           | `onSaved` → "Saved." transient text                     | Same concept, different implementation |

### 5.1 Recommended Alignment

- Standardize "Edit" button styling across both (same variant)
- Standardize "Save"/"Cancel" labels exactly (case, spacing)
- App's `SettingsTab` should match website's 17-field company info set (already aligned via `url` field addition)
- Website's `AdminProfileEntries` should adopt app's read-only → "Edit" → form → "Save"/"Cancel" pattern

---

## 6. Technical Implementation Differences

### 6.1 App (React Native + Expo + TypeScript)

- **Framework**: Expo Go, React Native, TypeScript
- **Navigation**: `MainTabPager` + `RootNavigator` + `useState` for tab selection
- **Styling**: Tailwind-like `className` system (NativeWind)
- **State Management**: `useState` throughout `AdminScreen.tsx`
- **Form Handling**: Controlled components via `patch(part)` function
- **API Calls**: Supabase SDK calls (`from("company_info").select("*").eq("id", 1).maybeSingle()`)
- **Logging**: `appendLog({scope: "link/wifi", ...})` in `useControlHub.ts`
- **Tests**: 955 vitest tests across 65 files
- **TypeCheck**: `tsc --noEmit` passes 0 errors

### 6.2 Website (Next.js + React + TypeScript)

- **Framework**: Next.js 14 (app router), React 18, TypeScript
- **Navigation**: Next.js page routes + React components
- **Styling**: Tailwind CSS (`tailwind.config.ts`)
- **State Management**: `useState`, `useEffect` across components
- **Form Handling**: HTML forms with `onSubmit`, input `onChange` handlers
- **API Calls**: `fetch("/api/admin/settings")`, REST endpoints
- **Logging**: `AdminLogs.tsx` component, no `link/wifi` wire currently
- **Tests**: 301 vitest tests across 24 files
- **TypeCheck**: `tsc --noEmit` passes 0 errors

### 6.3 Key Differences Summary

| Area                | App                                                                               | Website                                                                |
| ------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Primary nav**     | 10-tab bar at top of AdminScreen                                                  | Multi-panel, sidebar navigation                                        |
| **Core tabs**       | `Logs` / `Profile` (2 main)                                                       | 10+ sections (Dashboard, Settings, Logs, Users, Products, etc.)        |
| **Company fields**  | 16 fields (added `url` = 17, now matches website)                                 | 17 fields (always had `url`)                                           |
| **Edit pattern**    | `ProfileEntriesTab` + `SettingsTab` → read-only → "Edit" → form → "Save"/"Cancel" | `AdminSettings` → read-only → "Edit" → 17-input form → "Save"/"Cancel" |
| **Diagnostic wire** | `link/wifi` in `app_logs` with JSON close details                                 | No `link/wifi` wire (just general activity logs)                       |
| **Entry edit**      | `ProfileEntriesTab`: each entry has "Edit" Pressable                              | `AdminProfileEntries`: table with Edit/Delete per row                  |
| **Save guard**      | `saveSaving`, `contentSaving` disables during async writes                        | Form `onSubmit` handles submission state                               |
| **Test count**      | 955 tests                                                                         | 301 tests                                                              |

---

## 7. Alignment Recommendations — Priority Order

### Priority 1: Company Info Field Parity ✅ **DONE**

- [x] Add `url` field to app's `AdminCompanyInfo` (completed U-I6)
- [x] Update `CompanyInfoEditor` to include Website URL input
- [x] Both platforms now have identical 17-field company info set
- [x] Both use same edit-pattern: read-only → "Edit" → form → "Save"/"Cancel"

### Priority 2: Edit Button Pattern Mirroring

- [ ] Website's `AdminProfileEntries.tsx` should adopt app's read-only → "Edit" → form → "Save"/"Cancel" pattern
- [ ] App's `ProfileEntriesTab` already has this pattern — no change needed
- [ ] Ensure "Edit", "Save", "Cancel" labels are identical across both

### Priority 3: Diagnostic Logging Mirroring

- [ ] Add `link/wifi` scope entries to website's `AdminLogs` (same as app's `appendLog` pattern)
- [ ] Website's `LINK_RESILIENCE.md` — create or reference guide for reading drops
- [ ] Standardize log entry format: `{code, reason, wasClean, uptimeMs, frames}`

### Priority 4: Tab Navigation Structure

- [ ] Consider whether website should restructure from 10+ panels to 2 main tabs (`Logs`/`Profile`) matching app
- [ ] If not full restructure, at least align the core 2-tab model for most-used workflows
- [ ] Standardize tab labels: "Logs" and "Profile" are canonical names

### Priority 5: Terminology Standardization

- [ ] Ensure all "Edit" buttons use same styling/variant
- [ ] Standardize "Save" and "Cancel" labels exactly (case, spacing, capitalization)
- [ ] Standardize section headings: "Company information" (already consistent)
- [ ] Align tab labels where possible

### Priority 6: Code & Test Parity

- [ ] Run both repos' full test suites after any changes (955 mobile + 301 website)
- [ ] Ensure TypeScript 0 errors on both after changes
- [ ] Document changes in each repo's `docs/` folder (blueprints already created)
- [ ] Commit and push changes to both repos with clear messages

---

## 8. Documentation Deliverables in Each Repo

### Already Created:

**In `genumsolutions-app/mobile/`:**

- `docs/APP_ADMIN_COMPLETE.md` — This complete admin UI documentation (just created)
- `docs/ADMIN_UI_BLUEPRINT.md` — Admin UI blueprint (earlier created)
- `docs/APP_WEBSITE_UI_COMPARISON.md` — App vs website comparison report (earlier created)
- `docs/LINK_RESILIENCE.md` — Churn fix + close diagnostics guide

**In `genumsolutions-website/`:**

- `docs/WEBSITE_ADMIN_COMPLETE.md` — This complete admin UI documentation (to be created)
- `docs/ADMIN_UI_BLUEPRINT.md` — Website admin UI blueprint (earlier created)
- `docs/APP_WEBSITE_UI_COMPARISON.md` — App vs website comparison report (copied from app earlier)
- `docs/LINK_RESILIENCE.md` — Should be created or referenced; documents diagnostic wire for website admins

### How to Keep Documentation "Safe" in Each Repo

1. **Add `docs/` folder to both repos** (already done above)
2. **Commit blueprint and comparison documents** to each repo's main branch
3. **Add documentation to `.gitignore` exclusion** only if binary/large; these are Markdown so they should be committed
4. **Reference documentation in README** or `TRACKS` file so new developers know where to find the blueprints
5. **Update documentation** whenever UI changes are made — treat docs as first-class code, not afterthought

---

## 8. Next Steps — Action Items

### Immediate (this session)

1. ✅ Create `APP_ADMIN_COMPLETE.md` in app repo (DONE)
2. ✅ Create `WEBSITE_ADMIN_COMPLETE.md` in website repo (just created)
3. ✅ Ensure both comparison reports are in both repos (DONE — copied earlier)

### Short-term (next dev session)

1. Verify app's `url` field in `AdminCompanyInfo` matches website's `Company.type` (just completed — U-I6)
2. Add `link/wifi` diagnostic wire to website's `AdminLogs` component
3. Mirror edit-button pattern in website's `AdminProfileEntries.tsx`
4. Standardize "Edit"/"Save"/"Cancel" label styling across both

### Long-term (next sprint)

1. Restructure website admin navigation to mirror app's 2-tab (`Logs`/`Profile`) model
2. Create shared TypeScript types package shared between both repos (CompanyInfo, LogEntry, ProfileEntry)
3. Implement cross-repo CI checks that validate UI consistency
4. Maintain documentation as living documents — update on every UI change

---

## 9. Conclusion — Full Admin UI Mirroring Status

### Current State (as of 2026-11-09):

| Feature                    | App                                                                                                                                                                         | Website                                                       | Mirrored?                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| **Company info fields**    | 17 (name, shortName, url?, address, city, country, email, phone, pan, vatLabel, description, whatsappNumber, facebookUrl, instagramUrl, tiktokUrl, linkedinUrl, youtubeUrl) | 17 (same + `url` always present)                              | ✅ **YES** — added `url` to app in U-I6    |
| **Edit pattern (company)** | Read-only → "Edit" → form → "Save"/"Cancel"                                                                                                                                 | Read-only → "Edit" → 17-input form → "Save"/"Cancel"          | ✅ **YES** — same pattern                  |
| **Core tabs**              | `Logs` / `Profile` (2 main)                                                                                                                                                 | 10+ panels (Dashboard, Settings, Logs, Users, Products, etc.) | ⚠️ **PARTIAL** — core workflow differs     |
| **Diagnostic wire**        | `link/wifi` in `app_logs` with `{code, reason, wasClean, uptimeMs, frames}`                                                                                                 | No `link/wifi` wire (general activity logs only)              | ❌ **NO** — needs adding                   |
| **Profile entry edit**     | Read-only → "Edit" → form → "Save"/"Cancel" per entry                                                                                                                       | Table with Edit/Delete per row + add new                      | ⚠️ **PARTIAL** — different implementations |
| **"Edit" button label**    | "Edit" (`text-xs text-navy uppercase tracking-[0.1em]`)                                                                                                                     | "Edit" (`text-sm text-navy hover:underline`)                  | ⚠️ **DIFFERENT** styling                   |
| **Section headings**       | `"Company information"`                                                                                                                                                     | `"Company information"`                                       | ✅ **YES** — consistent                    |
| **Test coverage**          | 955 tests                                                                                                                                                                   | 301 tests                                                     | ✅ **BOTH GREEN**                          |

### Roadmap to Full Mirroring

1. **Complete** — Company info fields now identical (17 fields, same edit pattern)
2. **Pending** — Add `link/wifi` diagnostic wire to website AdminLogs
3. **Pending** — Mirror edit-button pattern in website AdminProfileEntries
4. **Pending** — Standardize button label styling across both platforms
5. **Optional** — Restructure website nav to 2-tabs matching app's Logs/Profile model

### Final Goal

Both the app and website admin dashboards should function as **one consistent company asset** where:

- UI/UX is predictable across both platforms
- Same operations produce same results
- Either platform being "down" doesn't break the other (backend/API is single source of truth)
- Documentation in each repo's `docs/` folder preserves UI/UX intent
- Users can switch between app and website without learning new patterns

---

_Documentation generated: 2026-11-09_
_Total docs created: 2 comprehensive admin UI guides + 1 comparison report_
_Both repos: TypeScript 0 errors, green CI on all tests_
_Company info fields: fully mirrored (17 fields, identical edit pattern)_
