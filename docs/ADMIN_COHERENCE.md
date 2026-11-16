# Admin coherence: one dashboard, two clients

The website dashboard (`components/AdminPanel.tsx`) and the app console
(`mobile/src/screens/AdminScreen.tsx`) are the same product on two screens.
They read the same Supabase tables, expose the same tabs in the same order, and
allow the same operations. A change to one without the other is a bug; both
parity tests enforce it:

- `genumsolutions-website/tests/admin-parity.test.ts`
- `genumsolutions-app/mobile/src/config/admin-parity.test.ts`

## Tab inventory (8, identical on both)

| Tab                 | Contents                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| Dashboard           | KPIs, revenue trend, recent activity                                     |
| Orders              | Orders + finance/transactions                                            |
| Electronic Products | `/products` catalog + import                                             |
| 3D Products         | `/3d-printing` catalog + import                                          |
| Projects            | Project packages, components, import                                     |
| Content             | Services, journal, home copy, training programs                          |
| Users               | Directory, messages + newsletter opt-ins, per-user projects, Logs subtab |
| Settings            | Company info, store settings                                             |

The **Logs** subtab is inside **Users**, not a top-level tab. It groups system
diagnostics, user activity, and profile entries into three sections. The panels
themselves were not rewritten — `AdminLogs`, `AdminUserLogs` and
`AdminProfileEntries` are mounted inside `AdminLogsHub`, so a fix in a panel
still applies everywhere it is used.

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
