# Admin coherence: one dashboard, two clients

The website dashboard (`components/AdminPanel.tsx`) and the app console
(`mobile/src/screens/AdminScreen.tsx`) are the same product on two screens.
They read the same Supabase tables, expose the same tabs in the same order, and
allow the same operations. A change to one without the other is a bug; both
parity tests enforce it:

- `genumsolutions-website/tests/admin-parity.test.ts`
- `genumsolutions-app/mobile/src/config/admin-parity.test.ts`

## Tab inventory (9, identical on both)

| Tab                 | Contents                                            |
| ------------------- | --------------------------------------------------- |
| Dashboard           | KPIs, revenue trend, recent activity                |
| Orders              | Orders + finance/transactions                       |
| Electronic Products | `/products` catalog + import                        |
| 3D Products         | `/3d-printing` catalog + import                     |
| Projects            | Project packages, components, import                |
| Content             | Services, journal, home copy, training programs     |
| Users               | Directory, roles/tiers, messages, per-user profiles |
| Logs                | User activity · User profiles · Fleet diagnostics   |
| Settings            | Company info, store settings                        |

The three former monitoring tabs (**System Logs**, **User Logs**, **Profile
Entries**) were merged into **Logs** in November 2026 with a section switch.
The panels themselves were not rewritten — `AdminLogs`, `AdminUserLogs` and
`AdminProfileEntries` are mounted inside `AdminLogsHub`, so a fix in a panel
still applies everywhere it is used.

## Who can do what

| Role     | Read admin data | Edit content/products | Delete rows | Edit user/project profiles | Delete users |
| -------- | --------------- | --------------------- | ----------- | -------------------------- | ------------ |
| customer | –               | –                     | –           | own rows only (app)        | –            |
| staff    | ✅              | ✅                    | ❌          | read only                  | ❌           |
| admin    | ✅              | ✅                    | ✅          | ✅                         | ❌           |
| owner    | ✅              | ✅                    | ✅          | ✅                         | ✅           |

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

Expanding a user in **Users** opens two managers on both clients:

1. **Robot preferences** — `robot_user_settings`, edit key/value settings per
   robot, add or delete rows. Staff may read; admin+ may write.
2. **Project profiles** — `car_profiles`, rename a board, repair its settings
   JSON, create by profile key, or delete. Staff may read; admin+ may write
   (`20261109_admin_update_profiles.sql` adds the RLS, the website actions
   live in `app/api/admin/users/route.ts`).

## Deliberate asymmetries

These are the only places the two clients differ, and each is by design:

| Website                            | App                            | Why                                           |
| ---------------------------------- | ------------------------------ | --------------------------------------------- |
| Cookie session, `/api/admin/*`     | Supabase session, direct reads | No server to protect a service key on a phone |
| Server-rendered panels             | Native lists, 20-row pages     | Same data, phone-sized                        |
| Drag-free forms with JSON textarea | Same, keyboard-friendly        | Keep the operations identical, not the pixels |
| `next/image` AVIF/WebP             | `expo-image` cache             | Same stored files, per-platform delivery      |

UI/UX polish is intentionally pending: operations and data parity came first.
