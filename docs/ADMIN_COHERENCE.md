# Admin coherence: one dashboard, two clients

The website dashboard (`components/AdminPanel.tsx`) and the app console
(`mobile/src/screens/AdminScreen.tsx`) are the same product on two screens.
They read the same Supabase tables, expose the same tabs in the same order, and
allow the same operations. A change to one without the other is a bug; both
parity tests enforce it:

- `genumsolutions-website/tests/admin-parity.test.ts`
- `genumsolutions-app/mobile/src/config/admin-parity.test.ts`

## Tab inventory (7, identical on both)

| Tab                 | Contents                                                       |
| ------------------- | -------------------------------------------------------------- |
| Dashboard           | KPIs, revenue trend, recent activity                           |
| Orders              | Orders + finance/transactions                                  |
| Electronic Products | `/products` — Catalog · Categories · Import subtabs            |
| 3D Products         | `/3d-printing` catalog + import                                |
| Projects            | Project packages (5-level editor), components, pricing, import |
| Users               | Accounts · Project profiles · Messages · Diagnostics           |
| Settings            | Company record · Home page · Storefront services · Journal     |

**2026-11-18:** the Content tab was merged into Settings on both clients. The
company record, home-page copy, storefront services and the journal are four
sections of one tab, because they all answer "what does the site say about us"
and each cost its own click. The panels themselves were not rewritten.

The Logs tab became the **Diagnostics** window inside **Users** (it groups
system diagnostics, user activity and profile entries into three sections). The
panels themselves were not rewritten — `AdminLogs`, `AdminUserLogs` and
`AdminProfileEntries` are mounted inside `AdminLogsHub`, so a fix in a panel
still applies everywhere it is used.

### Users windows

_Accounts · Project profiles · Messages · Diagnostics._

- **Accounts** — the directory with role, tier, joined/last seen, per-user
  projects and delete (admin only).
- **Project profiles** — every saved `car_profiles` row across builders, newest
  first, searchable by builder/car/profile key/unique id, with a settings count
  and last update. Read-only by design: repairs go through the account row so
  there is one write path. Served by `/api/admin/users?profiles=1`.
- **Messages** — customer messages plus newsletter opt-ins.
- **Diagnostics** — the crash-report/app-log panels, the activity log and the
  profile-entry log, opening on the fleet diagnostics.

### Settings depth

- **Company** has three nested sections — Details / Contact / Social — over one
  `company_info` row. The sheet edits a **draft**: typing no longer touches the
  saved record, Cancel discards, Save validates name/email (the email format is
  checked) and shows the database error inside the sheet. Each field carries a
  line explaining where its value appears.
- **Home page** has four nested sections — Hero / Training / Pilot costs /
  Curriculum — instead of one scroll mixing four record types.

## Section subtabs (identical on both clients)

**Electronic Products** — `Catalog · Categories · Import`. The catalog list is
unchanged. Categories is a read-only roll-up per category (items,
visible/hidden, stock, price range) whose rows jump into the catalog filtered to
that category. Import hosts the link importer, which no longer shares the page
with the list. 3D Products keeps its own `PrintSectionTabs` studio.

**Projects** — the tab opens on a section strip: `Catalog · Categories ·
Pricing · Software & features · 3D materials · Coding procedure`. Catalog keeps
the existing list/editor. The other five roll every package up under one
question — how it is filed, what it costs, what it runs on, what it is printed
from, how it is built — and each row opens that package's editor on the
matching sub-tab. Pricing reads all rows in one request (the route returns the
whole table when no `projectId` is passed); a family picked in Categories
filters the catalog through the separate `project_category` filter.

The package editor is one hierarchy level at a time, in this order:

| Subtab              | Fields                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Category            | id, name, summary, category, project category, description, overview, outcomes, prerequisites, deliverables, audience, difficulty, image |
| Pricing             | price, stock, price label, SKU, warranty, delivery, maintenance notes                                                                    |
| Code details        | language/toolchain, repository, libraries, source folder, docs/video links, control methods, spec lines, code notes                      |
| 3D material details | materials required, printer, filament, layer height, infill, print time, material notes                                                  |
| Coding procedure    | build steps, coding procedure steps, procedure notes, estimated duration                                                                 |

Component links and the package quote stay in their own panels under the
project list (they key off a saved project id).

**Where the new project fields live.** Category is `products.project_category`;
pricing is `project_pricing`; code details, 3D material details and coding
procedure are stored in `products.import_meta.projectDetails`:

```jsonc
{
  "projectDetails": {
    "code": { "language": "", "repositoryUrl": "", "libraries": "", "notes": "" },
    "material": {
      "printer": "",
      "filament": "",
      "layerHeight": "",
      "infill": "",
      "printTime": "",
      "notes": "",
    },
    "procedure": { "steps": [""], "notes": "" },
  },
}
```

Both clients already write `import_meta` whole, so the blocks round-trip with no
schema change; the shape has exactly one reader/writer per repo
(`lib/project-details.ts` here, `mobile/src/config/projectDetails.ts` in the
app). The management token needed for DDL was expired on 2026-11-18, which is
why the jsonb bag was chosen. The public project page does not render these
three blocks yet; that is the follow-up once the columns land.

**The columns are written in code, and the migration is still unapplied.**
`supabase/migrations/20261118180000_project_details_columns.sql` adds twelve
`products.project_*` columns and backfills them from the JSON block, and
`docs/PROJECT_DETAILS_COLUMNS.md` is the runbook: rollout order (backfill →
reader with JSON fallback → dual write → drop the JSON copy), the verification
queries, and the rollback.

Both clients now ship the reader and the dual writer: each field prefers its
column, falls back to the JSON block per field, and saves keep writing both
copies. The columns are only included in a save after a one-time probe
(`select project_code_language from products limit 1`) confirms they exist,
because an unknown column is a `42703` that would fail the whole product save.
So until the migration runs, behaviour is exactly the JSON layout above; after
it, the same builds start filling the columns with no redeploy.

## Who can do what

| Role     | Read admin data | Edit content/products | Delete rows | Repair project profiles        | Delete users |
| -------- | --------------- | --------------------- | ----------- | ------------------------------ | ------------ |
| customer | –               | –                     | –           | own rows only (app)            | –            |
| staff    | ✅              | ✅                    | ❌          | read only                      | ❌           |
| admin    | ✅              | ✅                    | ✅          | ✅ app · delete only (website) | ❌           |
| owner    | ✅              | ✅                    | ✅          | ✅ app · delete only (website) | ✅           |

Enforced in three places that agree: `lib/roles.ts` + `lib/admin.ts` on the
website, `public.is_staff()` / `public.is_admin()` RLS in Postgres, and the
`canDelete` prop in both UIs. RLS is the backstop — the app writes directly,
so a missing policy shows up as a silent no-op, which is exactly how the admin
lost access to robot profiles before `20261109_admin_manage_rls.sql`.

## Data ownership

| Data                     | Table                              | Written by                                |
| ------------------------ | ---------------------------------- | ----------------------------------------- |
| Products / catalogs      | `products`                         | website API, app via `admin-products`     |
| Robot preferences        | `robot_user_settings`              | app + website account page; admins repair |
| Project (car) profiles   | `car_profiles`                     | app build screen; admins repair           |
| User activity            | `user_activity_log`                | DB triggers on `car_profiles` / `orders`  |
| Profile entries          | `user_profile_entries`             | DB triggers on `car_profiles`             |
| Crash reports / app logs | `device_crash_reports`, `app_logs` | app telemetry                             |
| Link imports             | `link_import_attempts`             | `link-import` edge function               |

`user_activity_log` and `user_profile_entries` have **no client writers**.
They are filled by Postgres triggers (`20261109_user_logs_writers.sql`) so both
clients see the same history without duplicating write code.

## Per-user profiles

Expanding a user in **Users** ("Show projects" / "Hide projects") lists the
rows that user created, read-only for every role:

1. **Robot profiles** — `robot_user_settings`: robot name, saved-settings count,
   updated date, and the robot id behind a Technical details disclosure.
2. **Projects** — `car_profiles`: project name, saved-settings count, updated
   date, and the profile key (the board's stable identity) plus device id behind
   a Technical details disclosure.

Admin and owner can delete a row on both clients (confirm first). Repairing a row
is app-only today: the app opens a JSON editor for `car_profiles.settings` and an
upsert form keyed by profile key, gated by the same `canDelete` check. The website
retired that form and offers delete only; its actions still live in
`app/api/admin/users/route.ts` and the RLS in `20261109_admin_update_profiles.sql`
still allows the app's writes.

## Deliberate asymmetries

These are the only places the two clients differ, and each is by design:

| Website                          | App                              | Why                                            |
| -------------------------------- | -------------------------------- | ---------------------------------------------- |
| Cookie session, `/api/admin/*`   | Supabase session, direct reads   | No server to protect a service key on a phone  |
| Server-rendered panels           | Native lists, 20-row pages       | Same data, phone-sized                         |
| Per-user profiles: read + delete | Read + delete + JSON repair form | The app is where a broken board row gets fixed |
| `next/image` AVIF/WebP           | `expo-image` cache               | Same stored files, per-platform delivery       |

Newsletter opt-ins are no longer an asymmetry: both consoles list
`newsletter_subscribers` under Users → Messages, with staff read and admin
delete.

UI/UX polish is intentionally pending: operations and data parity came first.
